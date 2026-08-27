import type {
  DependencyGraph,
  DepsDevClient,
  VersionKey,
} from "./deps-dev-client";
import type { RootPackage } from "./roots";

export interface SnapshotPackage {
  name: string;
}

export interface SnapshotVersion {
  id: string;
  packageName: string;
  version: string;
}

export interface SnapshotDependency {
  fromVersionId: string;
  toVersionId: string;
  requirement: string;
}

export interface DiscoveryDiagnostics {
  cacheHits: number;
  cacheMisses: number;
  erroredGraphs: number;
  erroredNodes: number;
  graphsAttempted: number;
  graphsSucceeded: number;
  skippedBundled: number;
  skippedAtVersionCap: number;
  unexpandedAtDepthLimit: number;
}

export interface DiscoveryError {
  versionId: string;
  message: string;
}

export interface DiscoveryResult {
  dependencies: SnapshotDependency[];
  diagnostics: DiscoveryDiagnostics;
  errors: DiscoveryError[];
  generatedAt: string;
  packages: SnapshotPackage[];
  versions: SnapshotVersion[];
}

export interface DiscoveryOptions {
  concurrency: number;
  maxDiscoveryDepth: number;
  maxVersions: number;
  roots: readonly RootPackage[];
}

interface QueuedVersion {
  depth: number;
  key: VersionKey;
}

interface AcquisitionOutcome {
  request: QueuedVersion;
  result:
    | Awaited<ReturnType<DepsDevClient["getDependencyGraph"]>>
    | undefined;
  error: unknown;
}

export interface CanonicalGraph {
  dependencies: Array<{
    requirement: string;
    target: VersionKey;
  }>;
  root: VersionKey;
  skippedBundled: number;
}

class UnusableGraphError extends Error {
  constructor(
    message: string,
    readonly erroredNodes = 0,
  ) {
    super(message);
    this.name = "UnusableGraphError";
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function versionId(versionKey: Pick<VersionKey, "name" | "version">) {
  return `${versionKey.name}@${versionKey.version}`;
}

function dependencyId(dependency: SnapshotDependency): string {
  return [
    dependency.fromVersionId,
    dependency.toVersionId,
    dependency.requirement,
  ].join("\0");
}

function toSnapshotVersion(versionKey: VersionKey): SnapshotVersion {
  return {
    id: versionId(versionKey),
    packageName: versionKey.name,
    version: versionKey.version,
  };
}

function assertNpmVersionKey(
  versionKey: VersionKey,
  context: string,
): void {
  if (versionKey.system.toUpperCase() !== "NPM") {
    throw new UnusableGraphError(
      `${context} uses unsupported system ${versionKey.system}.`,
    );
  }

  if (versionKey.name.includes(">")) {
    throw new UnusableGraphError(
      `${context} contains a bundled-style package identity.`,
    );
  }
}

export function extractCanonicalGraph(graph: DependencyGraph): CanonicalGraph {
  if (graph.error.trim() !== "") {
    throw new UnusableGraphError(`deps.dev graph error: ${graph.error}`);
  }

  if (graph.nodes.length === 0) {
    throw new UnusableGraphError("deps.dev graph has no root node.");
  }

  const erroredNodes = graph.nodes.filter((node) => node.errors.length > 0);
  if (erroredNodes.length > 0) {
    throw new UnusableGraphError(
      `deps.dev graph reports errors on ${erroredNodes.length} node(s).`,
      erroredNodes.length,
    );
  }

  const root = graph.nodes[0];
  if (root.relation !== "SELF" || root.bundled) {
    throw new UnusableGraphError(
      "deps.dev node 0 is not a usable, unbundled SELF root.",
    );
  }
  assertNpmVersionKey(root.versionKey, "Root node");

  let skippedBundled = 0;
  const directDependencies = new Map<
    string,
    { requirement: string; target: VersionKey }
  >();

  for (const edge of graph.edges) {
    // This is the central correctness boundary: edges from transitive nodes in
    // this resolved graph never become canonical edges for the root Version.
    if (edge.fromNode !== 0) {
      continue;
    }

    const targetNode = graph.nodes[edge.toNode];
    if (targetNode === undefined) {
      throw new UnusableGraphError(
        `Root edge points to missing node index ${edge.toNode}.`,
      );
    }

    if (targetNode.bundled) {
      skippedBundled += 1;
      continue;
    }

    assertNpmVersionKey(targetNode.versionKey, "Direct dependency node");
    const requirement = edge.requirement.trim();
    if (requirement === "") {
      throw new UnusableGraphError(
        `Root edge to ${versionId(targetNode.versionKey)} has an empty requirement.`,
      );
    }

    const logicalId = [
      versionId(targetNode.versionKey),
      requirement,
    ].join("\0");
    directDependencies.set(logicalId, {
      requirement,
      target: targetNode.versionKey,
    });
  }

  return {
    dependencies: [...directDependencies.values()].sort((left, right) => {
      return (
        compareText(versionId(left.target), versionId(right.target)) ||
        compareText(left.requirement, right.requirement)
      );
    }),
    root: root.versionKey,
    skippedBundled,
  };
}

async function acquireFrontier(
  client: DepsDevClient,
  frontier: QueuedVersion[],
  concurrency: number,
): Promise<AcquisitionOutcome[]> {
  const outcomes = new Array<AcquisitionOutcome>(frontier.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < frontier.length) {
      const index = nextIndex;
      nextIndex += 1;
      const request = frontier[index];

      try {
        outcomes[index] = {
          request,
          result: await client.getDependencyGraph(request.key),
          error: undefined,
        };
      } catch (error: unknown) {
        outcomes[index] = { request, result: undefined, error };
      }
    }
  }

  const workerCount = Math.min(concurrency, frontier.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return outcomes;
}

export async function discoverSnapshot(
  client: DepsDevClient,
  options: DiscoveryOptions,
): Promise<DiscoveryResult> {
  if (options.maxDiscoveryDepth < 1) {
    throw new Error("maxDiscoveryDepth must be at least 1.");
  }
  if (options.maxVersions < options.roots.length) {
    throw new Error("maxVersions must be at least the number of roots.");
  }
  if (options.concurrency < 1) {
    throw new Error("concurrency must be at least 1.");
  }

  const versions = new Map<string, SnapshotVersion>();
  const dependencies = new Map<string, SnapshotDependency>();
  const queuedIds = new Set<string>();
  const errors: DiscoveryError[] = [];
  const fetchedAtValues: string[] = [];
  let erroredGraphs = 0;
  let erroredNodes = 0;
  let graphsAttempted = 0;
  let graphsSucceeded = 0;
  let skippedBundled = 0;
  let skippedAtVersionCap = 0;
  let unexpandedAtDepthLimit = 0;

  let frontier: QueuedVersion[] = options.roots
    .map((root) => ({
      depth: 0,
      key: { system: "NPM", name: root.name, version: root.version },
    }))
    .sort((left, right) => compareText(versionId(left.key), versionId(right.key)));

  for (const item of frontier) {
    const id = versionId(item.key);
    if (queuedIds.has(id)) {
      throw new Error(`Duplicate configured root ${id}.`);
    }
    queuedIds.add(id);
  }

  for (
    let depth = 0;
    depth < options.maxDiscoveryDepth && frontier.length > 0;
    depth += 1
  ) {
    console.log(
      `Acquiring depth ${depth}: ${frontier.length} exact version graph(s).`,
    );
    graphsAttempted += frontier.length;
    const outcomes = await acquireFrontier(
      client,
      frontier,
      options.concurrency,
    );
    const nextFrontier = new Map<string, QueuedVersion>();

    for (const outcome of outcomes) {
      const requestedId = versionId(outcome.request.key);

      if (outcome.result === undefined) {
        erroredGraphs += 1;
        errors.push({
          versionId: requestedId,
          message:
            outcome.error instanceof Error
              ? outcome.error.message
              : String(outcome.error),
        });
        continue;
      }

      fetchedAtValues.push(outcome.result.fetchedAt);

      let canonical: CanonicalGraph;
      try {
        canonical = extractCanonicalGraph(outcome.result.graph);
      } catch (error: unknown) {
        erroredGraphs += 1;
        if (error instanceof UnusableGraphError) {
          erroredNodes += error.erroredNodes;
        }
        errors.push({
          versionId: requestedId,
          message: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      graphsSucceeded += 1;
      skippedBundled += canonical.skippedBundled;
      const sourceId = versionId(canonical.root);

      if (!versions.has(sourceId)) {
        if (versions.size >= options.maxVersions) {
          skippedAtVersionCap += 1;
          continue;
        }
        versions.set(sourceId, toSnapshotVersion(canonical.root));
      }

      for (const direct of canonical.dependencies) {
        const targetId = versionId(direct.target);

        if (!versions.has(targetId)) {
          if (versions.size >= options.maxVersions) {
            skippedAtVersionCap += 1;
            continue;
          }
          versions.set(targetId, toSnapshotVersion(direct.target));
        }

        const dependency: SnapshotDependency = {
          fromVersionId: sourceId,
          toVersionId: targetId,
          requirement: direct.requirement,
        };
        dependencies.set(dependencyId(dependency), dependency);

        const targetDepth = depth + 1;
        if (
          targetDepth < options.maxDiscoveryDepth &&
          !queuedIds.has(targetId)
        ) {
          queuedIds.add(targetId);
          nextFrontier.set(targetId, {
            depth: targetDepth,
            key: direct.target,
          });
        } else if (
          targetDepth === options.maxDiscoveryDepth &&
          !queuedIds.has(targetId)
        ) {
          queuedIds.add(targetId);
          unexpandedAtDepthLimit += 1;
        }
      }
    }

    frontier = [...nextFrontier.values()].sort((left, right) =>
      compareText(versionId(left.key), versionId(right.key)),
    );
  }

  const packages = [...new Set([...versions.values()].map((item) => item.packageName))]
    .sort(compareText)
    .map((name) => ({ name }));
  const cacheStats = client.cacheStats;

  return {
    dependencies: [...dependencies.values()].sort((left, right) => {
      return (
        compareText(left.fromVersionId, right.fromVersionId) ||
        compareText(left.toVersionId, right.toVersionId) ||
        compareText(left.requirement, right.requirement)
      );
    }),
    diagnostics: {
      cacheHits: cacheStats.hits,
      cacheMisses: cacheStats.misses,
      erroredGraphs,
      erroredNodes,
      graphsAttempted,
      graphsSucceeded,
      skippedBundled,
      skippedAtVersionCap,
      unexpandedAtDepthLimit,
    },
    errors,
    generatedAt:
      fetchedAtValues.sort(compareText).at(-1) ?? new Date(0).toISOString(),
    packages,
    versions: [...versions.values()].sort((left, right) =>
      compareText(left.id, right.id),
    ),
  };
}
