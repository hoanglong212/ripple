import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import neo4j, { type Driver } from "neo4j-driver";
import { createCognoDbDriver } from "./constraints";
import {
  type RippleSnapshot,
  validateSnapshot,
} from "../ingestion/validate-snapshot";

const databaseDirectory = path.dirname(fileURLToPath(import.meta.url));
const snapshotPath = path.resolve(
  databaseDirectory,
  "..",
  "data",
  "ripple-snapshot.json",
);
const EXPLAIN_PATH_SOURCE = "@babel/core@8.0.1";
const EXPLAIN_PATH_TARGET = "picocolors@1.1.1";
const DIRECT_DEPENDENCY_VERSION = "express@5.2.1";
const REVERSE_TRAVERSAL_VERSION = "debug@4.4.3";

type QueryParameters = Record<string, unknown>;
type QueryRows = Array<Record<string, unknown>>;

const COUNT_PACKAGES_QUERY = `
  MATCH (package:Package)
  WHERE package.name IN $packageNames
  RETURN count(package) AS count
`;

const COUNT_VERSIONS_QUERY = `
  MATCH (version:Version)
  WHERE version.id IN $versionIds
  RETURN count(version) AS count
`;

const OWNERSHIP_QUERY = `
  UNWIND $versionIds AS versionId
  OPTIONAL MATCH (package:Package)-[ownership:HAS_VERSION]->(
    version:Version { id: versionId }
  )
  RETURN versionId,
         count(ownership) AS ownershipCount,
         collect(package.name) AS owners
  ORDER BY versionId
`;

const DEPENDENCIES_QUERY = `
  MATCH (source:Version)-[dependency:DEPENDS_ON]->(target)
  WHERE source.id IN $versionIds
  RETURN source.id AS fromVersionId,
         target.id AS toVersionId,
         labels(target) AS targetLabels,
         dependency.requirement AS requirement
  ORDER BY fromVersionId, toVersionId, requirement
`;

const PACKAGE_DEPENDENCIES_QUERY = `
  MATCH (package:Package)-[dependency:DEPENDS_ON]-()
  WHERE package.name IN $packageNames
  RETURN count(DISTINCT dependency) AS count
`;

const EXACT_LOOKUP_QUERY = `
  MATCH (package:Package)-[:HAS_VERSION]->(
    version:Version { id: $versionId }
  )
  RETURN package.name AS packageName,
         version.id AS id,
         version.version AS version
`;

const DIRECT_DEPENDENCIES_QUERY = `
  MATCH (source:Version { id: $versionId })-[dependency:DEPENDS_ON]->(
    target:Version
  )
  RETURN target.id AS dependency,
         dependency.requirement AS requirement
  ORDER BY dependency
`;

const REVERSE_TRAVERSAL_QUERY = `
  MATCH path = (source:Version)-[:DEPENDS_ON*1..4]->(
    target:Version { id: $versionId }
  )
  WHERE source.id IN $versionIds
    AND all(node IN nodes(path) WHERE node.id IN $versionIds)
  WITH source, min(length(path)) AS hops
  RETURN source.id AS versionThatCanReachTarget, hops
  ORDER BY hops, versionThatCanReachTarget
  LIMIT 25
`;

const EXPLAIN_PATH_QUERY = `
  MATCH (source:Version { id: $sourceId }),
        (target:Version { id: $targetId })
  MATCH path = shortestPath((source)-[:DEPENDS_ON*1..4]->(target))
  WHERE all(node IN nodes(path) WHERE node.id IN $versionIds)
  RETURN length(path) AS hops,
         [node IN nodes(path) | node.id] AS nodes,
         [relationship IN relationships(path) | {
           type: type(relationship),
           requirement: relationship.requirement
         }] AS relationships
`;

function asNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (neo4j.isInt(value)) {
    return value.toNumber();
  }
  throw new Error(`Expected a numeric Neo4j value, received ${String(value)}.`);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function logicalDependencyId(
  fromVersionId: string,
  toVersionId: string,
  requirement: string,
): string {
  return [fromVersionId, toVersionId, requirement].join("\0");
}

async function readSnapshot(): Promise<RippleSnapshot> {
  const input: unknown = JSON.parse(await readFile(snapshotPath, "utf8"));
  return validateSnapshot(input).snapshot;
}

async function runRead(
  driver: Driver,
  query: string,
  parameters: QueryParameters = {},
): Promise<QueryRows> {
  const session = driver.session({
    defaultAccessMode: neo4j.session.READ,
  });

  try {
    const result = await session.executeRead((transaction) =>
      transaction.run(query, parameters),
    );
    return result.records.map((record) => record.toObject());
  } finally {
    await session.close();
  }
}

function oneCount(rows: QueryRows): number {
  return asNumber(rows[0]?.count);
}

async function verify(): Promise<void> {
  const snapshot = await readSnapshot();
  const packageNames = snapshot.packages.map((item) => item.name);
  const versionIds = snapshot.versions.map((item) => item.id);
  const versionIdSet = new Set(versionIds);
  const expectedOwners = new Map(
    snapshot.versions.map((version) => [version.id, version.packageName]),
  );
  const expectedDependencies = new Set(
    snapshot.dependencies.map((dependency) =>
      logicalDependencyId(
        dependency.fromVersionId,
        dependency.toVersionId,
        dependency.requirement,
      ),
    ),
  );
  const driver = createCognoDbDriver();

  try {
    await driver.verifyConnectivity();

    const [packageRows, versionRows, ownershipRows, dependencyRows, packageDependencyRows] =
      await Promise.all([
        runRead(driver, COUNT_PACKAGES_QUERY, { packageNames }),
        runRead(driver, COUNT_VERSIONS_QUERY, { versionIds }),
        runRead(driver, OWNERSHIP_QUERY, { versionIds }),
        runRead(driver, DEPENDENCIES_QUERY, { versionIds }),
        runRead(driver, PACKAGE_DEPENDENCIES_QUERY, { packageNames }),
      ]);

    const packageCount = oneCount(packageRows);
    const versionCount = oneCount(versionRows);
    const hasVersionCount = ownershipRows.reduce(
      (total, row) => total + asNumber(row.ownershipCount),
      0,
    );
    const packageDependencyCount = oneCount(packageDependencyRows);
    const failures: string[] = [];

    if (packageCount !== snapshot.metadata.counts.packages) {
      failures.push(
        `Package count ${packageCount} does not match ${snapshot.metadata.counts.packages}.`,
      );
    }
    if (versionCount !== snapshot.metadata.counts.versions) {
      failures.push(
        `Version count ${versionCount} does not match ${snapshot.metadata.counts.versions}.`,
      );
    }
    if (dependencyRows.length !== snapshot.metadata.counts.dependencies) {
      failures.push(
        `DEPENDS_ON count ${dependencyRows.length} does not match ${snapshot.metadata.counts.dependencies}.`,
      );
    }
    if (hasVersionCount !== snapshot.metadata.counts.versions) {
      failures.push(
        `HAS_VERSION count ${hasVersionCount} does not equal Version count ${snapshot.metadata.counts.versions}.`,
      );
    }

    for (const row of ownershipRows) {
      const id = asString(row.versionId);
      const count = asNumber(row.ownershipCount);
      const owners = Array.isArray(row.owners)
        ? row.owners.filter((owner): owner is string => typeof owner === "string")
        : [];

      if (id === undefined || count !== 1 || owners[0] !== expectedOwners.get(id)) {
        failures.push(
          `Version ${id ?? "<unknown>"} has ${count} owner(s): ${owners.join(", ") || "none"}.`,
        );
      }
    }

    const actualDependencies = new Map<string, number>();
    for (const row of dependencyRows) {
      const source = asString(row.fromVersionId);
      const target = asString(row.toVersionId);
      const requirement = asString(row.requirement);
      const targetLabels = Array.isArray(row.targetLabels)
        ? row.targetLabels.filter(
            (label): label is string => typeof label === "string",
          )
        : [];

      if (
        source === undefined ||
        target === undefined ||
        !versionIdSet.has(source) ||
        !versionIdSet.has(target) ||
        !targetLabels.includes("Version")
      ) {
        failures.push(
          `Dependency endpoint is outside the snapshot Version set: ${source ?? "<missing>"} -> ${target ?? "<missing>"}.`,
        );
        continue;
      }
      if (requirement === undefined || requirement.trim() === "") {
        failures.push(`Dependency ${source} -> ${target} has no requirement.`);
        continue;
      }

      const logicalId = logicalDependencyId(source, target, requirement);
      actualDependencies.set(
        logicalId,
        (actualDependencies.get(logicalId) ?? 0) + 1,
      );
    }

    for (const [logicalId, count] of actualDependencies) {
      if (count > 1) {
        failures.push(`Duplicate logical dependency ${logicalId} appears ${count} times.`);
      }
      if (!expectedDependencies.has(logicalId)) {
        failures.push(`Unexpected logical dependency ${logicalId}.`);
      }
    }
    for (const logicalId of expectedDependencies) {
      if (!actualDependencies.has(logicalId)) {
        failures.push(`Missing logical dependency ${logicalId}.`);
      }
    }

    if (packageDependencyCount !== 0) {
      failures.push(
        `${packageDependencyCount} Package-level DEPENDS_ON relationship(s) exist.`,
      );
    }

    const exactLookup = await runRead(driver, EXACT_LOOKUP_QUERY, {
      versionId: EXPLAIN_PATH_SOURCE,
    });
    if (exactLookup.length !== 1) {
      failures.push(`Exact lookup for ${EXPLAIN_PATH_SOURCE} did not return one row.`);
    }

    const directDependencies = versionIdSet.has(DIRECT_DEPENDENCY_VERSION)
      ? await runRead(driver, DIRECT_DEPENDENCIES_QUERY, {
          versionId: DIRECT_DEPENDENCY_VERSION,
        })
      : [];
    if (
      versionIdSet.has(DIRECT_DEPENDENCY_VERSION) &&
      directDependencies.length === 0
    ) {
      failures.push(
        `${DIRECT_DEPENDENCY_VERSION} is indexed but returned no direct dependencies.`,
      );
    }

    const reverseTraversal = versionIdSet.has(REVERSE_TRAVERSAL_VERSION)
      ? await runRead(driver, REVERSE_TRAVERSAL_QUERY, {
          versionId: REVERSE_TRAVERSAL_VERSION,
          versionIds,
        })
      : [];

    const explainPath = await runRead(driver, EXPLAIN_PATH_QUERY, {
      sourceId: EXPLAIN_PATH_SOURCE,
      targetId: EXPLAIN_PATH_TARGET,
      versionIds,
    });
    const explainHops =
      explainPath.length === 1 ? asNumber(explainPath[0].hops) : 0;
    if (explainPath.length !== 1 || explainHops < 3 || explainHops > 4) {
      failures.push(
        `Expected a 3–4 hop path from ${EXPLAIN_PATH_SOURCE} to ${EXPLAIN_PATH_TARGET}; received ${explainHops || "none"}.`,
      );
    }

    console.log("\n=== Live graph checks ===");
    console.log("Exact Version lookup:");
    console.dir(exactLookup, { depth: null });
    console.log(`Direct dependencies for ${DIRECT_DEPENDENCY_VERSION}:`);
    console.dir(directDependencies, { depth: null });
    console.log(`Reverse traversal from ${REVERSE_TRAVERSAL_VERSION}:`);
    console.dir(reverseTraversal, { depth: null });
    console.log(
      `Explain Path ${EXPLAIN_PATH_SOURCE} -> ${EXPLAIN_PATH_TARGET}:`,
    );
    console.dir(explainPath, { depth: null });

    console.log("\n=== CognoDB verification summary ===");
    console.log(
      `Packages: ${packageCount}/${snapshot.metadata.counts.packages}`,
    );
    console.log(
      `Versions: ${versionCount}/${snapshot.metadata.counts.versions}`,
    );
    console.log(
      `HAS_VERSION: ${hasVersionCount}/${snapshot.metadata.counts.versions}`,
    );
    console.log(
      `DEPENDS_ON: ${dependencyRows.length}/${snapshot.metadata.counts.dependencies}`,
    );
    console.log(`Package-level DEPENDS_ON: ${packageDependencyCount}`);
    console.log(`Verification failures: ${failures.length}`);

    if (failures.length > 0) {
      throw new Error(`\n- ${failures.join("\n- ")}`);
    }

    console.log("All snapshot and live graph checks passed.");
  } finally {
    await driver.close();
  }
}

verify().catch((error: unknown) => {
  console.error("CognoDB verification failed:", error);
  process.exitCode = 1;
});
