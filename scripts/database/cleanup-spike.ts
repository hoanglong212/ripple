import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import neo4j, { type Driver, type Record as Neo4jRecord } from "neo4j-driver";
import { RIPPLE_DATASET_ID } from "../../lib/domain/packages";
import { validateSnapshot } from "../ingestion/validate-snapshot";
import { createCognoDbDriver } from "./constraints";
import { H0_SPIKE_ID, H0_SPIKE_LABEL } from "./spike-metadata";

const databaseDirectory = path.dirname(fileURLToPath(import.meta.url));
const snapshotPath = path.resolve(databaseDirectory, "..", "data", "ripple-snapshot.json");

const TARGETED_NODES_QUERY = `
  MATCH (node:RippleGraphSpike)
  WHERE node.spikeId = $spikeId
  RETURN labels(node) AS labels,
         node.name AS name,
         node.id AS id,
         node.rippleDataset AS rippleDataset
  ORDER BY name, id
`;

const ATTACHED_RELATIONSHIPS_QUERY = `
  MATCH (node:RippleGraphSpike)-[relationship]-()
  WHERE node.spikeId = $spikeId
  WITH DISTINCT relationship
  RETURN type(relationship) AS type,
         relationship.spikeId AS spikeId,
         relationship.rippleDataset AS rippleDataset
  ORDER BY type
`;

const DELETE_SPIKE_RELATIONSHIPS_QUERY = `
  MATCH (node:RippleGraphSpike)-[relationship]-()
  WHERE node.spikeId = $spikeId
    AND relationship.spikeId = $spikeId
    AND relationship.rippleDataset IS NULL
  WITH DISTINCT relationship
  DELETE relationship
  RETURN count(relationship) AS count
`;

const DELETE_TEMPORARY_NODES_QUERY = `
  MATCH (node:RippleGraphSpike)
  WHERE node.spikeId = $spikeId
    AND node.rippleDataset IS NULL
    AND NOT (node:Package AND node.name IN $productionPackageNames)
    AND NOT (node:Version AND node.id IN $productionVersionIds)
  DETACH DELETE node
  RETURN count(node) AS count
`;

const SANITIZE_PRODUCTION_NODES_QUERY = `
  MATCH (node:RippleGraphSpike)
  WHERE node.spikeId = $spikeId
    AND (
      node.rippleDataset = $datasetId
      OR (node:Package AND node.name IN $productionPackageNames)
      OR (node:Version AND node.id IN $productionVersionIds)
    )
  REMOVE node:RippleGraphSpike
  REMOVE node.spikeId
  REMOVE node.spikeTemporary
  RETURN count(node) AS count
`;

const REMAINING_NODES_QUERY = `
  MATCH (node:RippleGraphSpike)
  WHERE node.spikeId = $spikeId
  RETURN count(node) AS count
`;

const REMAINING_RELATIONSHIPS_QUERY = `
  MATCH ()-[relationship]-()
  WHERE relationship.spikeId = $spikeId
  RETURN count(DISTINCT relationship) AS count
`;

type QueryParameters = Record<string, unknown>;

export interface CleanupSummary {
  affectedNodes: number;
  affectedRelationships: number;
  deletedNodes: number;
  deletedRelationships: number;
  retainedProductionNodes: number;
}

async function readSnapshotIdentities(): Promise<{
  packageNames: string[];
  versionIds: string[];
}> {
  const input: unknown = JSON.parse(await readFile(snapshotPath, "utf8"));
  const snapshot = validateSnapshot(input).snapshot;
  return {
    packageNames: snapshot.packages.map((item) => item.name),
    versionIds: snapshot.versions.map((item) => item.id),
  };
}

async function runRead(
  driver: Driver,
  query: string,
  parameters: QueryParameters,
): Promise<Neo4jRecord[]> {
  const session = driver.session({ defaultAccessMode: neo4j.session.READ });
  try {
    const result = await session.executeRead((transaction) =>
      transaction.run(query, parameters),
    );
    return result.records;
  } finally {
    await session.close();
  }
}

async function runWrite(
  driver: Driver,
  query: string,
  parameters: QueryParameters,
): Promise<number> {
  const session = driver.session({ defaultAccessMode: neo4j.session.WRITE });
  try {
    const result = await session.executeWrite((transaction) =>
      transaction.run(query, parameters),
    );
    const count: unknown = result.records[0]?.get("count") ?? 0;
    return typeof count === "number"
      ? count
      : neo4j.isInt(count)
        ? count.toNumber()
        : 0;
  } finally {
    await session.close();
  }
}

function asNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (neo4j.isInt(value)) {
    return value.toNumber();
  }
  return 0;
}

export async function cleanupSpikeData(
  driver: Driver,
): Promise<CleanupSummary> {
  const identities = await readSnapshotIdentities();
  const parameters = {
    datasetId: RIPPLE_DATASET_ID,
    productionPackageNames: identities.packageNames,
    productionVersionIds: identities.versionIds,
    spikeId: H0_SPIKE_ID,
  };
  const [nodeRecords, relationshipRecords] = await Promise.all([
    runRead(driver, TARGETED_NODES_QUERY, parameters),
    runRead(driver, ATTACHED_RELATIONSHIPS_QUERY, parameters),
  ]);

  console.log("\n=== H0 spike cleanup preview ===");
  console.log(`Target label: ${H0_SPIKE_LABEL}`);
  console.log(`Target spikeId: ${H0_SPIKE_ID}`);
  console.log(`Affected nodes: ${nodeRecords.length}`);
  console.log(`Affected relationships: ${relationshipRecords.length}`);
  if (nodeRecords.length > 0) {
    console.table(nodeRecords.map((record) => record.toObject()));
  }

  const retainedProductionNodes = nodeRecords.filter((record) => {
    const labels = record.get("labels");
    const name = record.get("name");
    const id = record.get("id");
    const dataset = record.get("rippleDataset");
    return (
      dataset === RIPPLE_DATASET_ID ||
      (Array.isArray(labels) &&
        labels.includes("Package") &&
        typeof name === "string" &&
        identities.packageNames.includes(name)) ||
      (Array.isArray(labels) &&
        labels.includes("Version") &&
        typeof id === "string" &&
        identities.versionIds.includes(id))
    );
  }).length;

  if (retainedProductionNodes > 0) {
    console.log(
      `Safety guard: retaining and sanitizing ${retainedProductionNodes} production node(s); none will be deleted.`,
    );
  }

  const deletedRelationships = await runWrite(
    driver,
    DELETE_SPIKE_RELATIONSHIPS_QUERY,
    parameters,
  );
  const deletedNodes = await runWrite(
    driver,
    DELETE_TEMPORARY_NODES_QUERY,
    parameters,
  );
  const sanitizedNodes = await runWrite(
    driver,
    SANITIZE_PRODUCTION_NODES_QUERY,
    parameters,
  );
  const remainingNodes = await runRead(driver, REMAINING_NODES_QUERY, parameters);
  const remainingRelationships = await runRead(
    driver,
    REMAINING_RELATIONSHIPS_QUERY,
    parameters,
  );
  const nodeCount = asNumber(remainingNodes[0]?.get("count"));
  const relationshipCount = asNumber(
    remainingRelationships[0]?.get("count"),
  );

  if (nodeCount !== 0 || relationshipCount !== 0) {
    throw new Error(
      `H0 cleanup left ${nodeCount} targeted node(s) and ${relationshipCount} targeted relationship(s).`,
    );
  }

  console.log("\n=== H0 spike cleanup result ===");
  console.log(`Temporary nodes deleted: ${deletedNodes}`);
  console.log(`Temporary relationships deleted: ${deletedRelationships}`);
  console.log(`Production nodes retained and sanitized: ${sanitizedNodes}`);
  console.log("Remaining H0 spike nodes: 0");
  console.log("Remaining H0 spike relationships: 0");

  return {
    affectedNodes: nodeRecords.length,
    affectedRelationships: relationshipRecords.length,
    deletedNodes,
    deletedRelationships,
    retainedProductionNodes: sanitizedNodes,
  };
}

async function runCli(): Promise<void> {
  const driver = createCognoDbDriver();
  try {
    await driver.verifyConnectivity();
    await cleanupSpikeData(driver);
  } finally {
    await driver.close();
  }
}

const entryPoint = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (entryPoint === fileURLToPath(import.meta.url)) {
  runCli().catch((error: unknown) => {
    console.error("H0 spike cleanup failed:", error);
    process.exitCode = 1;
  });
}
