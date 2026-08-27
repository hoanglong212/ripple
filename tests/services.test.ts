import assert from "node:assert/strict";
import { describe, it } from "node:test";
import neo4j, { type Driver, type Record as Neo4jRecord } from "neo4j-driver";
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
import { Neo4jGraphRepository } from "@/lib/repositories/graph-repository";
import type {
  NpmRegistry,
  RegistryPackageDetail,
  RegistryPackageSummary,
} from "@/lib/registry/npm-registry-client";
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

class FakeNpmRegistry implements NpmRegistry {
  packageDetail: RegistryPackageDetail | null = null;
  searchResults: RegistryPackageSummary[] = [];
  // Set to make both calls reject, so the degradation branches of
  // Promise.allSettled can be exercised rather than only the happy path.
  failure: Error | null = null;

  async findPackage(): Promise<RegistryPackageDetail | null> {
    if (this.failure !== null) {
      throw this.failure;
    }
    return this.packageDetail;
  }

  async searchPackages(): Promise<RegistryPackageSummary[]> {
    if (this.failure !== null) {
      throw this.failure;
    }
    return this.searchResults;
  }
}

class UnavailableGraphRepository extends FakeGraphRepository {
  override async searchPackages(): Promise<PackageSearchResult[]> {
    throw new DatabaseUnavailableError();
  }

  override async findPackage(): Promise<PackageDetail | null> {
    throw new DatabaseUnavailableError();
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

  it("discovers public npm packages outside the graph snapshot", async () => {
    const repository = new FakeGraphRepository();
    const registry = new FakeNpmRegistry();
    registry.searchResults = [
      {
        description: "React is a JavaScript library for building user interfaces.",
        latestVersion: "19.2.8",
        name: "react",
      },
    ];
    const service = new PackageService(repository, registry);

    const result = await service.searchPackages("react");

    assert.deepEqual(result, [
      {
        description: "React is a JavaScript library for building user interfaces.",
        graphStatus: "not-indexed",
        indexedVersionCount: 0,
        latestVersion: "19.2.8",
        name: "react",
      },
    ]);
  });

  it("returns an npm package guide without inventing graph versions", async () => {
    const repository = new FakeGraphRepository();
    const registry = new FakeNpmRegistry();
    registry.packageDetail = {
      description: "React is a JavaScript library for building user interfaces.",
      homepageUrl: "https://react.dev/",
      keywords: ["react"],
      latestVersion: "19.2.8",
      name: "react",
      npmUrl: "https://www.npmjs.com/package/react",
      repositoryUrl: "https://github.com/react/react.git",
    };
    const service = new PackageService(repository, registry);

    const result = await service.getPackage("react");

    assert.equal(result.graphStatus, "not-indexed");
    assert.deepEqual(result.versions, []);
    assert.equal(result.metadata?.installCommand, "npm install react");
    assert.equal(result.metadata?.description, registry.packageDetail.description);
  });

  it("keeps graph results when the npm catalog is unavailable", async () => {
    const repository = new FakeGraphRepository();
    repository.searchResults = [{ indexedVersionCount: 2, name: "ajv" }];
    const registry = new FakeNpmRegistry();
    registry.failure = new Error("registry down");
    const service = new PackageService(repository, registry);

    const result = await service.searchPackages("ajv");

    assert.deepEqual(result, [
      { graphStatus: "indexed", indexedVersionCount: 2, name: "ajv" },
    ]);
  });

  it("marks graph status unavailable when CognoDB is down but the catalog answers", async () => {
    const registry = new FakeNpmRegistry();
    registry.searchResults = [{ latestVersion: "8.20.0", name: "ajv" }];
    const service = new PackageService(new UnavailableGraphRepository(), registry);

    const result = await service.searchPackages("ajv");

    assert.equal(result.length, 1);
    assert.equal(result[0].graphStatus, "unavailable");
    assert.equal(result[0].indexedVersionCount, 0);
  });

  it("surfaces the catalog failure when neither source answers", async () => {
    const registry = new FakeNpmRegistry();
    registry.failure = new Error("registry down");
    const service = new PackageService(new UnavailableGraphRepository(), registry);

    await assert.rejects(service.searchPackages("ajv"), /registry down/);
  });

  it("keeps indexed packages the catalog did not return, matched case-insensitively", async () => {
    const repository = new FakeGraphRepository();
    repository.searchResults = [
      { indexedVersionCount: 2, name: "AJV" },
      { indexedVersionCount: 1, name: "ajv-keywords" },
    ];
    const registry = new FakeNpmRegistry();
    registry.searchResults = [{ latestVersion: "8.20.0", name: "ajv" }];
    const service = new PackageService(repository, registry);

    const result = await service.searchPackages("ajv");

    // "AJV" and "ajv" are one package: the catalog entry wins the row and the
    // indexed count survives the merge. "ajv-keywords" has no catalog row, so
    // it must still be listed rather than dropped.
    assert.equal(result.length, 2);
    const merged = result.find((item) => item.name === "ajv");
    assert.equal(merged?.indexedVersionCount, 2);
    assert.equal(merged?.graphStatus, "indexed");
    assert.equal(
      result.find((item) => item.name === "ajv-keywords")?.graphStatus,
      "indexed",
    );
  });

  it("reports a package missing from both the graph and the catalog", async () => {
    const service = new PackageService(
      new FakeGraphRepository(),
      new FakeNpmRegistry(),
    );

    await assert.rejects(
      service.getPackage("definitely-not-a-real-package"),
      (error) =>
        error instanceof NotIndexedError &&
        error.code === "PACKAGE_NOT_INDEXED",
    );
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

/*
 * Repository-layer coverage.
 *
 * This is where Neo4j values are converted into plain DTOs, and it is the
 * gnarliest code in the app: hand-unwrapping Node and Relationship properties,
 * distinguishing "not indexed" from "indexed with no results", and deciding
 * which driver failures mean the database is unavailable. A fake driver lets
 * all of that be exercised without a database.
 */
function fakeRecord(fields: Record<string, unknown>): Neo4jRecord {
  return { get: (key: string) => fields[key] } as unknown as Neo4jRecord;
}

function fakeDriver(
  records: Neo4jRecord[] | (() => never),
): { closes: number; driver: Driver } {
  const state = { closes: 0 };
  const driver = {
    session: () => ({
      executeRead: async (work: (tx: unknown) => unknown) =>
        work({
          run: () => {
            if (typeof records === "function") {
              records();
            }
            return { records };
          },
        }),
      close: async () => {
        state.closes += 1;
      },
    }),
  } as unknown as Driver;

  return {
    get closes() {
      return state.closes;
    },
    driver,
  };
}

const PATH_NODE = (id: string) => ({ properties: { id } });
const PATH_REL = (requirement: string) => ({ properties: { requirement } });

describe("Neo4j record mapping", () => {
  it("unwraps path nodes and relationships into plain values", async () => {
    const { driver } = fakeDriver([
      fakeRecord({
        pathNodes: [PATH_NODE("ajv@8.20.0"), PATH_NODE("fast-uri@3.1.6")],
        pathRelationships: [PATH_REL("^3.0.1")],
      }),
    ]);

    const result = await new Neo4jGraphRepository(driver)
      .findShortestDependencyPath("ajv@8.20.0", "fast-uri@3.1.6", 5);

    assert.deepEqual(result, {
      requirements: ["^3.0.1"],
      versionIds: ["ajv@8.20.0", "fast-uri@3.1.6"],
    });
  });

  it("returns no path when both endpoints exist but nothing connects them", async () => {
    // shortestPath() yields one row of nulls rather than zero rows, and that
    // is a successful empty result, not a missing resource.
    const { driver } = fakeDriver([
      fakeRecord({ pathNodes: null, pathRelationships: null }),
    ]);

    const result = await new Neo4jGraphRepository(driver)
      .findShortestDependencyPath("a@1.0.0", "b@1.0.0", 5);

    assert.equal(result, null);
  });

  it("rejects a path whose requirements do not line up with its nodes", async () => {
    const { driver } = fakeDriver([
      fakeRecord({
        pathNodes: [PATH_NODE("a@1.0.0"), PATH_NODE("b@1.0.0")],
        pathRelationships: [PATH_REL("^1.0.0"), PATH_REL("^2.0.0")],
      }),
    ]);

    await assert.rejects(
      new Neo4jGraphRepository(driver)
        .findShortestDependencyPath("a@1.0.0", "b@1.0.0", 5),
      /inconsistent dependency path/,
    );
  });

  it("distinguishes an unindexed impact target from one with no dependents", async () => {
    const missing = fakeDriver([]);
    assert.equal(
      await new Neo4jGraphRepository(missing.driver)
        .findDownstreamImpact("nope@1.0.0", 4),
      null,
      "zero rows means the target Version is not indexed",
    );

    const noDependents = fakeDriver([
      fakeRecord({
        affectedVersionId: null,
        hopCount: null,
        pathVersionIds: null,
        targetVersionId: "leaf@1.0.0",
      }),
    ]);
    assert.deepEqual(
      await new Neo4jGraphRepository(noDependents.driver)
        .findDownstreamImpact("leaf@1.0.0", 4),
      [],
      "a row of nulls means the target exists with nothing pointing at it",
    );
  });

  it("converts Neo4j integer hop counts to plain numbers", async () => {
    const { driver } = fakeDriver([
      fakeRecord({
        affectedVersionId: "webpack@5.109.2",
        hopCount: neo4j.int(2),
        pathVersionIds: ["webpack@5.109.2", "schema-utils@4.3.3", "ajv@8.20.0"],
      }),
    ]);

    const result = await new Neo4jGraphRepository(driver)
      .findDownstreamImpact("ajv@8.20.0", 4);

    assert.equal(result?.[0].hopCount, 2);
    assert.equal(typeof result?.[0].hopCount, "number");
  });

  it("skips malformed dependency rows rather than emitting partial edges", async () => {
    const { driver } = fakeDriver([
      fakeRecord({
        dependencyPackageName: "fast-uri",
        dependencyVersionId: "fast-uri@3.1.6",
        id: "ajv@8.20.0",
        packageName: "ajv",
        requirement: "^3.0.1",
        version: "8.20.0",
      }),
      fakeRecord({
        dependencyPackageName: "broken",
        dependencyVersionId: null,
        id: "ajv@8.20.0",
        packageName: "ajv",
        requirement: "^1.0.0",
        version: "8.20.0",
      }),
    ]);

    const result = await new Neo4jGraphRepository(driver).findVersion("ajv@8.20.0");

    assert.equal(result?.dependencies.length, 1);
    assert.equal(result?.dependencies[0].dependencyVersionId, "fast-uri@3.1.6");
  });

  it("closes the session even when mapping throws", async () => {
    const handle = fakeDriver([
      fakeRecord({ pathNodes: "not-an-array", pathRelationships: [] }),
    ]);

    await assert.rejects(
      new Neo4jGraphRepository(handle.driver)
        .findShortestDependencyPath("a@1.0.0", "b@1.0.0", 5),
      /invalid dependency path/,
    );
    assert.equal(handle.closes, 1);
  });

  it("reports an unreachable database as unavailable, and leaves other faults alone", async () => {
    const unavailable = fakeDriver(() => {
      throw new neo4j.Neo4jError(
        "gone",
        neo4j.error.SERVICE_UNAVAILABLE,
        "50N42",
        "service unavailable",
      );
    });
    await assert.rejects(
      new Neo4jGraphRepository(unavailable.driver).versionExists("a@1.0.0"),
      (error) => error instanceof DatabaseUnavailableError,
    );

    const programmerError = fakeDriver(() => {
      throw new Error("bad Cypher");
    });
    await assert.rejects(
      new Neo4jGraphRepository(programmerError.driver).versionExists("a@1.0.0"),
      (error) =>
        error instanceof Error &&
        !(error instanceof DatabaseUnavailableError) &&
        error.message === "bad Cypher",
    );
  });
});
