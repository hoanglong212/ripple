import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ROOT_CATEGORIES } from "./roots";

const nonEmptyText = z.string().trim().min(1);
const nonNegativeInteger = z.number().int().nonnegative();

export const snapshotSchema = z
  .object({
    metadata: z
      .object({
        generatedAt: z.iso.datetime(),
        source: z.literal("deps.dev v3 GetDependencies"),
        rootPackages: z.array(
          z
            .object({
              category: z.enum(ROOT_CATEGORIES),
              id: nonEmptyText,
              name: nonEmptyText,
              version: nonEmptyText,
            })
            .strict(),
        ),
        maxDiscoveryDepth: z.number().int().positive(),
        maxVersions: z.number().int().positive(),
        counts: z
          .object({
            packages: nonNegativeInteger,
            versions: nonNegativeInteger,
            dependencies: nonNegativeInteger,
          })
          .strict(),
        skippedBundled: nonNegativeInteger,
        erroredGraphs: nonNegativeInteger,
        erroredNodes: nonNegativeInteger,
        skippedAtVersionCap: nonNegativeInteger,
        unexpandedAtDepthLimit: nonNegativeInteger,
        connectivity: z
          .object({
            totalWeaklyConnectedComponents: nonNegativeInteger,
            largestWeaklyConnectedComponentSize: nonNegativeInteger,
            largestComponentPercentage: z.number().min(0).max(100),
          })
          .strict(),
      })
      .strict(),
    packages: z.array(z.object({ name: nonEmptyText }).strict()),
    versions: z.array(
      z
        .object({
          id: nonEmptyText,
          packageName: nonEmptyText,
          version: nonEmptyText,
        })
        .strict(),
    ),
    dependencies: z.array(
      z
        .object({
          fromVersionId: nonEmptyText,
          toVersionId: nonEmptyText,
          requirement: nonEmptyText,
        })
        .strict(),
    ),
  })
  .strict();

export type RippleSnapshot = z.infer<typeof snapshotSchema>;
export type ConnectivityReport = RippleSnapshot["metadata"]["connectivity"];

export class SnapshotValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Snapshot validation failed with ${issues.length} issue(s).`);
    this.name = "SnapshotValidationError";
  }
}

function versionId(packageName: string, version: string): string {
  return `${packageName}@${version}`;
}

function dependencyId(
  dependency: RippleSnapshot["dependencies"][number],
): string {
  return [
    dependency.fromVersionId,
    dependency.toVersionId,
    dependency.requirement,
  ].join("\0");
}

export function calculateConnectivity(
  snapshot: Pick<RippleSnapshot, "versions" | "dependencies">,
): ConnectivityReport {
  const adjacency = new Map<string, Set<string>>();

  for (const version of snapshot.versions) {
    adjacency.set(version.id, new Set());
  }

  for (const dependency of snapshot.dependencies) {
    adjacency.get(dependency.fromVersionId)?.add(dependency.toVersionId);
    adjacency.get(dependency.toVersionId)?.add(dependency.fromVersionId);
  }

  const visited = new Set<string>();
  let totalWeaklyConnectedComponents = 0;
  let largestWeaklyConnectedComponentSize = 0;

  for (const versionIdValue of adjacency.keys()) {
    if (visited.has(versionIdValue)) {
      continue;
    }

    totalWeaklyConnectedComponents += 1;
    let componentSize = 0;
    const pending = [versionIdValue];
    visited.add(versionIdValue);

    while (pending.length > 0) {
      const current = pending.pop();
      if (current === undefined) {
        continue;
      }

      componentSize += 1;
      for (const neighbour of adjacency.get(current) ?? []) {
        if (!visited.has(neighbour)) {
          visited.add(neighbour);
          pending.push(neighbour);
        }
      }
    }

    largestWeaklyConnectedComponentSize = Math.max(
      largestWeaklyConnectedComponentSize,
      componentSize,
    );
  }

  const largestComponentPercentage =
    snapshot.versions.length === 0
      ? 0
      : Number(
          (
            (largestWeaklyConnectedComponentSize / snapshot.versions.length) *
            100
          ).toFixed(2),
        );

  return {
    totalWeaklyConnectedComponents,
    largestWeaklyConnectedComponentSize,
    largestComponentPercentage,
  };
}

export function validateSnapshot(input: unknown): {
  connectivity: ConnectivityReport;
  snapshot: RippleSnapshot;
} {
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) {
    throw new SnapshotValidationError(
      parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "snapshot"}: ${issue.message}`,
      ),
    );
  }

  const snapshot = parsed.data;
  const issues: string[] = [];
  const packageNames = new Set<string>();

  for (const packageNode of snapshot.packages) {
    if (packageNames.has(packageNode.name)) {
      issues.push(`Duplicate Package.name ${packageNode.name}.`);
    }
    if (packageNode.name.includes(">")) {
      issues.push(
        `Bundled node identity leaked into Package.name ${packageNode.name}.`,
      );
    }
    packageNames.add(packageNode.name);
  }

  const versions = new Map<
    string,
    RippleSnapshot["versions"][number]
  >();
  for (const version of snapshot.versions) {
    if (versions.has(version.id)) {
      issues.push(`Duplicate Version.id ${version.id}.`);
    }
    if (!packageNames.has(version.packageName)) {
      issues.push(
        `Version ${version.id} has no Package ${version.packageName}.`,
      );
    }
    if (version.packageName.includes(">")) {
      issues.push(
        `Bundled node identity leaked into Version ${version.id}.`,
      );
    }
    const expectedId = versionId(version.packageName, version.version);
    if (version.id !== expectedId) {
      issues.push(
        `Version ${version.id} does not match its Package/version identity ${expectedId}.`,
      );
    }
    versions.set(version.id, version);
  }

  const dependencyIds = new Set<string>();
  for (const dependency of snapshot.dependencies) {
    if (!versions.has(dependency.fromVersionId)) {
      issues.push(
        `Dependency source ${dependency.fromVersionId} does not exist.`,
      );
    }
    if (!versions.has(dependency.toVersionId)) {
      issues.push(
        `Dependency target ${dependency.toVersionId} does not exist.`,
      );
    }
    if (dependency.requirement.trim() === "") {
      issues.push(
        `Dependency ${dependency.fromVersionId} -> ${dependency.toVersionId} has an empty requirement.`,
      );
    }

    const logicalId = dependencyId(dependency);
    if (dependencyIds.has(logicalId)) {
      issues.push(
        `Duplicate dependency ${dependency.fromVersionId} -> ${dependency.toVersionId} (${dependency.requirement}).`,
      );
    }
    dependencyIds.add(logicalId);
  }

  if (snapshot.metadata.counts.packages !== snapshot.packages.length) {
    issues.push("metadata.counts.packages does not match packages.length.");
  }
  if (snapshot.metadata.counts.versions !== snapshot.versions.length) {
    issues.push("metadata.counts.versions does not match versions.length.");
  }
  if (
    snapshot.metadata.counts.dependencies !== snapshot.dependencies.length
  ) {
    issues.push(
      "metadata.counts.dependencies does not match dependencies.length.",
    );
  }
  if (snapshot.versions.length > snapshot.metadata.maxVersions) {
    issues.push("Snapshot exceeds metadata.maxVersions.");
  }

  const connectivity = calculateConnectivity(snapshot);
  if (
    JSON.stringify(connectivity) !==
    JSON.stringify(snapshot.metadata.connectivity)
  ) {
    issues.push("metadata.connectivity does not match the calculated report.");
  }

  if (issues.length > 0) {
    throw new SnapshotValidationError(issues);
  }

  return { connectivity, snapshot };
}

async function runCli(): Promise<void> {
  const ingestionDirectory = path.dirname(fileURLToPath(import.meta.url));
  const snapshotPath = path.resolve(
    ingestionDirectory,
    "..",
    "data",
    "ripple-snapshot.json",
  );
  const input: unknown = JSON.parse(await readFile(snapshotPath, "utf8"));
  const { connectivity, snapshot } = validateSnapshot(input);

  console.log(`Validated ${snapshotPath}`);
  console.log(`Packages: ${snapshot.packages.length}`);
  console.log(`Versions: ${snapshot.versions.length}`);
  console.log(`Dependency edges: ${snapshot.dependencies.length}`);
  console.log(
    `Weakly connected components: ${connectivity.totalWeaklyConnectedComponents}`,
  );
  console.log(
    `Largest component: ${connectivity.largestWeaklyConnectedComponentSize} versions (${connectivity.largestComponentPercentage.toFixed(2)}%)`,
  );

  if (connectivity.largestComponentPercentage < 85) {
    console.warn(
      "Warning: less than 85% of Version nodes are in the largest weakly connected component; consider adjusting the curated roots.",
    );
  }
}

const entryPoint = process.argv[1]
  ? path.resolve(process.argv[1])
  : undefined;
if (entryPoint === fileURLToPath(import.meta.url)) {
  runCli().catch((error: unknown) => {
    if (error instanceof SnapshotValidationError) {
      console.error(error.message);
      for (const issue of error.issues) {
        console.error(`- ${issue}`);
      }
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  });
}
