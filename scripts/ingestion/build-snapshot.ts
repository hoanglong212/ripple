import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DepsDevClient } from "./deps-dev-client";
import { discoverSnapshot, versionId } from "./discover";
import {
  DEPS_DEV_CONCURRENCY,
  MAX_DISCOVERY_DEPTH,
  MAX_VERSIONS,
  ROOT_PACKAGES,
} from "./roots";
import {
  calculateConnectivity,
  type RippleSnapshot,
  SnapshotValidationError,
  validateSnapshot,
} from "./validate-snapshot";

const ingestionDirectory = path.dirname(fileURLToPath(import.meta.url));
const scriptsDirectory = path.resolve(ingestionDirectory, "..");
const cacheDirectory = path.join(scriptsDirectory, "cache");
const dataDirectory = path.join(scriptsDirectory, "data");
const snapshotPath = path.join(dataDirectory, "ripple-snapshot.json");

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function buildSnapshot(): Promise<void> {
  const client = new DepsDevClient(cacheDirectory);
  const discovery = await discoverSnapshot(client, {
    concurrency: DEPS_DEV_CONCURRENCY,
    maxDiscoveryDepth: MAX_DISCOVERY_DEPTH,
    maxVersions: MAX_VERSIONS,
    roots: ROOT_PACKAGES,
  });

  const connectivity = calculateConnectivity(discovery);
  const snapshot: RippleSnapshot = {
    metadata: {
      generatedAt: discovery.generatedAt,
      source: "deps.dev v3 GetDependencies",
      rootPackages: ROOT_PACKAGES.map((root) => ({
        category: root.category,
        id: versionId({ name: root.name, version: root.version }),
        name: root.name,
        version: root.version,
      })).sort((left, right) => compareText(left.id, right.id)),
      maxDiscoveryDepth: MAX_DISCOVERY_DEPTH,
      maxVersions: MAX_VERSIONS,
      counts: {
        packages: discovery.packages.length,
        versions: discovery.versions.length,
        dependencies: discovery.dependencies.length,
      },
      skippedBundled: discovery.diagnostics.skippedBundled,
      erroredGraphs: discovery.diagnostics.erroredGraphs,
      erroredNodes: discovery.diagnostics.erroredNodes,
      skippedAtVersionCap: discovery.diagnostics.skippedAtVersionCap,
      unexpandedAtDepthLimit:
        discovery.diagnostics.unexpandedAtDepthLimit,
      connectivity,
    },
    packages: discovery.packages,
    versions: discovery.versions,
    dependencies: discovery.dependencies,
  };

  validateSnapshot(snapshot);
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  if (discovery.errors.length > 0) {
    console.warn("\nSkipped graph details:");
    for (const error of discovery.errors.slice(0, 20)) {
      console.warn(`- ${error.versionId}: ${error.message}`);
    }
    if (discovery.errors.length > 20) {
      console.warn(`- ...and ${discovery.errors.length - 20} more.`);
    }
  }

  console.log("\n=== Ripple snapshot summary ===");
  console.log(`Artifact: ${snapshotPath}`);
  console.log(`Packages: ${snapshot.packages.length}`);
  console.log(`Versions: ${snapshot.versions.length}`);
  console.log(`Dependency edges: ${snapshot.dependencies.length}`);
  console.log(
    `Bundled nodes skipped: ${snapshot.metadata.skippedBundled}`,
  );
  console.log(`Graph errors: ${snapshot.metadata.erroredGraphs}`);
  console.log(
    `Largest component: ${connectivity.largestWeaklyConnectedComponentSize} versions (${connectivity.largestComponentPercentage.toFixed(2)}%)`,
  );
  console.log(
    `Cache hits/misses: ${discovery.diagnostics.cacheHits}/${discovery.diagnostics.cacheMisses}`,
  );

  if (connectivity.largestComponentPercentage < 85) {
    console.warn(
      "Warning: less than 85% of Version nodes are in the largest weakly connected component; consider adjusting the curated roots.",
    );
  }
}

buildSnapshot().catch((error: unknown) => {
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
