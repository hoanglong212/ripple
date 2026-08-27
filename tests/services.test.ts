import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { explainPathEnvelope } from "@/app/api/versions/[...versionId]/route";
import type {
  DatasetStats,
  DownstreamImpactItem,
  GraphDependencyPath,
  GraphRepository,
  PackageDetail,
  PackageSearchResult,
  VersionDetail,
} from "@/lib/domain/packages";
import { errorResponse } from "@/lib/http/responses";
import {
  DatabaseUnavailableError,
  InvalidInputError,
  NotIndexedError,
} from "@/lib/services/errors";
import { PackageService } from "@/lib/services/package-service";
import { VersionService } from "@/lib/services/version-service";
import type { DependencyGraph } from "@/scripts/ingestion/deps-dev-client";
import { extractCanonicalGraph } from "@/scripts/ingestion/discover";

class FakeGraphRepository implements GraphRepository {
  impactResults: DownstreamImpactItem[] | null = [];
  packageDetail: PackageDetail | null = null;
  searchResults: PackageSearchResult[] = [];
  versionDetail: VersionDetail | null = null;
  lastSearch: { limit: number; query: string } | null = null;
  lastVersionId: string | null = null;
  lastImpact: { maxDepth: number; versionId: string } | null = null;
  existingVersionIds = new Set<string>();
  pathResult: GraphDependencyPath | null = null;
  lastPath: {
    maxDepth: number;
    sourceVersionId: string;
    targetVersionId: string;
  } | null = null;

  async findDatasetStats(): Promise<DatasetStats> {
    return {
      packageCount: 426,
      relationshipCount: 636,
      versionCount: 449,
    };
  }

  async findShortestDependencyPath(
    sourceVersionId: string,
    targetVersionId: string,
    maxDepth: number,
  ): Promise<GraphDependencyPath | null> {
    this.lastPath = { maxDepth, sourceVersionId, targetVersionId };
    return this.pathResult;
  }

  async findDownstreamImpact(
    versionId: string,
    maxDepth: number,
  ): Promise<DownstreamImpactItem[] | null> {
    this.lastImpact = { maxDepth, versionId };
    return this.impactResults;
  }

  async searchPackages(
    query: string,
    limit: number,
  ): Promise<PackageSearchResult[]> {
    this.lastSearch = { limit, query };
    return this.searchResults;
  }

  async findPackage(): Promise<PackageDetail | null> {
    return this.packageDetail;
  }

  async findVersion(versionId: string): Promise<VersionDetail | null> {
    this.lastVersionId = versionId;
    return this.versionDetail;
  }

  async versionExists(versionId: string): Promise<boolean> {
    return this.existingVersionIds.has(versionId);
  }
}

describe("Ripple P0 services", () => {
  it("returns an exact package search result", async () => {
    const repository = new FakeGraphRepository();
    repository.searchResults = [
      { name: "express", indexedVersionCount: 1 },
    ];
    const service = new PackageService(repository);

    const result = await service.searchPackages("  express  ");

    assert.deepEqual(result, [
      { name: "express", indexedVersionCount: 1 },
    ]);
    assert.deepEqual(repository.lastSearch, { query: "express", limit: 20 });
  });

  it("retrieves only indexed versions in descending semver order", async () => {
    const repository = new FakeGraphRepository();
    repository.packageDetail = {
      name: "example",
      versions: [
        { id: "example@1.9.0", version: "1.9.0" },
        { id: "example@2.0.0-beta.1", version: "2.0.0-beta.1" },
        { id: "example@1.10.0", version: "1.10.0" },
        { id: "example@2.0.0", version: "2.0.0" },
      ],
    };
    const service = new PackageService(repository);

    const result = await service.getPackage("example");

    assert.deepEqual(
      result.versions.map((version) => version.version),
      ["2.0.0", "2.0.0-beta.1", "1.10.0", "1.9.0"],
    );
  });

  it("retrieves direct dependencies for one exact Version ID", async () => {
    const repository = new FakeGraphRepository();
    repository.versionDetail = {
      id: "express@5.2.1",
      packageName: "express",
      version: "5.2.1",
      dependencies: [
        {
          dependencyPackageName: "debug",
          dependencyVersionId: "debug@4.4.3",
          requirement: "^4.4.0",
        },
      ],
    };
    const service = new VersionService(repository);

    const result = await service.getVersion("express@5.2.1");

    assert.equal(repository.lastVersionId, "express@5.2.1");
    assert.deepEqual(result.dependencies, [
      {
        dependencyPackageName: "debug",
        dependencyVersionId: "debug@4.4.3",
        requirement: "^4.4.0",
      },
    ]);
  });

  it("reports a missing package", async () => {
    const service = new PackageService(new FakeGraphRepository());

    await assert.rejects(service.getPackage("missing-package"), (error) => {
      return (
        error instanceof NotIndexedError && error.code === "PACKAGE_NOT_INDEXED"
      );
    });
  });

  it("reports a missing exact version", async () => {
    const service = new VersionService(new FakeGraphRepository());

    await assert.rejects(service.getVersion("express@0.0.0"), (error) => {
      return (
        error instanceof NotIndexedError && error.code === "VERSION_NOT_INDEXED"
      );
    });
  });

  it("summarizes bounded downstream impact for one exact Version ID", async () => {
    const repository = new FakeGraphRepository();
    repository.impactResults = [
      {
        affectedVersionId: "express@5.2.1",
        hopCount: 1,
        pathVersionIds: ["express@5.2.1", "debug@4.4.3"],
      },
      {
        affectedVersionId: "serve-static@2.2.1",
        hopCount: 2,
        pathVersionIds: [
          "serve-static@2.2.1",
          "send@1.2.1",
          "debug@4.4.3",
        ],
      },
    ];
    const service = new VersionService(repository);

    const result = await service.getDownstreamImpact("debug@4.4.3");

    assert.deepEqual(repository.lastImpact, {
      maxDepth: 4,
      versionId: "debug@4.4.3",
    });
    assert.equal(result.totalReachable, 2);
    assert.equal(result.directCount, 1);
    assert.equal(result.transitiveCount, 1);
    assert.equal(result.maxObservedDepth, 2);
  });

  it("returns an empty downstream-impact result", async () => {
    const service = new VersionService(new FakeGraphRepository());

    const result = await service.getDownstreamImpact("leaf@1.0.0");

    assert.equal(result.totalReachable, 0);
    assert.equal(result.maxObservedDepth, 0);
    assert.deepEqual(result.affectedVersions, []);
  });

  it("reports a missing downstream-impact target", async () => {
    const repository = new FakeGraphRepository();
    repository.impactResults = null;
    const service = new VersionService(repository);

    await assert.rejects(
      service.getDownstreamImpact("missing@1.0.0"),
      (error) =>
        error instanceof NotIndexedError &&
        error.code === "VERSION_NOT_INDEXED",
    );
  });

  it("explains the known four-hop Babel to picocolors path", async () => {
    const repository = new FakeGraphRepository();
    const source = "@babel/core@8.0.1";
    const target = "picocolors@1.1.1";
    repository.existingVersionIds.add(source);
    repository.existingVersionIds.add(target);
    repository.pathResult = {
      versionIds: [
        source,
        "@babel/helper-compilation-targets@8.0.0",
        "browserslist@4.28.8",
        "update-browserslist-db@1.3.1",
        target,
      ],
      requirements: ["^8.0.0", "^4.24.0", "^1.3.0", "^1.1.1"],
    };
    const service = new VersionService(repository);

    const result = await service.explainPath(source, target);

    assert.equal(result.hops, 4);
    assert.deepEqual(repository.lastPath, {
      maxDepth: 5,
      sourceVersionId: source,
      targetVersionId: target,
    });
    assert.deepEqual(result.relationships[3], {
      fromVersionId: "update-browserslist-db@1.3.1",
      requirement: "^1.1.1",
      toVersionId: target,
    });
  });

  it("wraps Explain Path in the shared API response contract", async () => {
    const explanation = {
      datasetQualifier: "Within Ripple’s indexed npm snapshot.",
      hops: 1,
      path: ["express@5.2.1", "debug@4.4.3"],
      relationships: [
        {
          fromVersionId: "express@5.2.1",
          requirement: "^4.4.0",
          toVersionId: "debug@4.4.3",
        },
      ],
      source: "express@5.2.1",
      target: "debug@4.4.3",
    };

    assert.deepEqual(explainPathEnvelope(explanation), {
      data: { path: explanation },
      meta: { scope: "Within Ripple’s indexed npm snapshot." },
    });
  });

  it("returns an empty Explain Path result when no path exists", async () => {
    const repository = new FakeGraphRepository();
    repository.existingVersionIds.add("express@5.2.1");
    repository.existingVersionIds.add("@babel/core@8.0.1");
    const service = new VersionService(repository);

    const result = await service.explainPath(
      "express@5.2.1",
      "@babel/core@8.0.1",
    );

    assert.equal(result.hops, 0);
    assert.deepEqual(result.path, []);
    assert.deepEqual(result.relationships, []);
  });

  it("reports a missing Explain Path version", async () => {
    const repository = new FakeGraphRepository();
    repository.existingVersionIds.add("express@5.2.1");
    const service = new VersionService(repository);

    await assert.rejects(
      service.explainPath("express@5.2.1", "missing@1.0.0"),
      (error) =>
        error instanceof NotIndexedError &&
        error.code === "VERSION_NOT_INDEXED",
    );
  });
});

describe("deps.dev canonical graph extraction", () => {
  const node = (
    name: string,
    version: string,
    relation: "SELF" | "DIRECT" | "INDIRECT",
    bundled = false,
  ) => ({
    bundled,
    errors: [],
    relation,
    versionKey: { name, system: "NPM", version },
  });

  it("keeps only root-origin dependency edges", () => {
    const graph: DependencyGraph = {
      error: "",
      nodes: [
        node("root", "1.0.0", "SELF"),
        node("direct", "2.0.0", "DIRECT"),
        node("transitive", "3.0.0", "INDIRECT"),
      ],
      edges: [
        { fromNode: 0, requirement: "^2.0.0", toNode: 1 },
        { fromNode: 1, requirement: "^3.0.0", toNode: 2 },
      ],
    };

    const result = extractCanonicalGraph(graph);

    assert.deepEqual(result.dependencies, [
      {
        requirement: "^2.0.0",
        target: { name: "direct", system: "NPM", version: "2.0.0" },
      },
    ]);
  });

  it("filters bundled direct dependency nodes", () => {
    const graph: DependencyGraph = {
      error: "",
      nodes: [
        node("root", "1.0.0", "SELF"),
        node("kept", "2.0.0", "DIRECT"),
        node("parent>bundled", "3.0.0", "DIRECT", true),
      ],
      edges: [
        { fromNode: 0, requirement: "^2.0.0", toNode: 1 },
        { fromNode: 0, requirement: "^3.0.0", toNode: 2 },
      ],
    };

    const result = extractCanonicalGraph(graph);

    assert.equal(result.skippedBundled, 1);
    assert.deepEqual(
      result.dependencies.map((dependency) => dependency.target.name),
      ["kept"],
    );
  });
});

describe("HTTP error mapping", () => {
  it("separates validation, missing, application, and database failures", async () => {
    const validationError = new z.ZodError([
      {
        code: "custom",
        message: "Invalid transport input.",
        path: ["query"],
      },
    ]);
    const cases = [
      {
        error: validationError,
        status: 400,
        code: "INVALID_INPUT",
      },
      {
        error: new InvalidInputError("Invalid service input."),
        status: 400,
        code: "INVALID_INPUT",
      },
      {
        error: new NotIndexedError("VERSION_NOT_INDEXED", "Missing."),
        status: 404,
        code: "VERSION_NOT_INDEXED",
      },
      {
        error: new Error("Unexpected bug."),
        status: 500,
        code: "INTERNAL_ERROR",
      },
      {
        error: new DatabaseUnavailableError(),
        status: 503,
        code: "DATABASE_UNAVAILABLE",
      },
    ] as const;
    const originalConsoleError = console.error;
    console.error = () => undefined;

    try {
      for (const item of cases) {
        const response = errorResponse(item.error);
        const payload = await response.json();
        assert.equal(response.status, item.status);
        assert.deepEqual(payload.data, {});
        assert.equal(payload.meta.error.code, item.code);
      }
    } finally {
      console.error = originalConsoleError;
    }
  });
});
