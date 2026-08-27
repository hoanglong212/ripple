import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import neo4j, { type Driver, type QueryResult } from "neo4j-driver";
import { RIPPLE_DATASET_ID } from "../../lib/domain/packages";
import {
  createCognoDbDriver,
  ensureConstraints,
} from "./constraints";
import {
  type RippleSnapshot,
  validateSnapshot,
} from "../ingestion/validate-snapshot";

const BATCH_SIZE = 300;
const databaseDirectory = path.dirname(fileURLToPath(import.meta.url));
const snapshotPath = path.resolve(
  databaseDirectory,
  "..",
  "data",
  "ripple-snapshot.json",
);

const PACKAGE_QUERY = `
  UNWIND $rows AS row
  MERGE (package:Package { name: row.name })
  SET package.rippleDataset = $datasetId
  RETURN count(package) AS processed
`;

const VERSION_QUERY = `
  UNWIND $rows AS row
  MATCH (package:Package { name: row.packageName })
  MERGE (version:Version { id: row.id })
  SET version.packageName = row.packageName,
      version.version = row.version,
      version.rippleDataset = $datasetId
  MERGE (package)-[ownership:HAS_VERSION]->(version)
  SET ownership.rippleDataset = $datasetId
  RETURN count(version) AS processed
`;

const DEPENDENCY_QUERY = `
  UNWIND $rows AS row
  MATCH (source:Version { id: row.fromVersionId })
  MATCH (target:Version { id: row.toVersionId })
  MERGE (source)-[dependency:DEPENDS_ON]->(target)
  SET dependency.requirement = row.requirement,
      dependency.rippleDataset = $datasetId
  RETURN count(dependency) AS processed
`;

const MISSING_ENDPOINTS_QUERY = `
  UNWIND $rows AS row
  OPTIONAL MATCH (source:Version {
    id: row.fromVersionId,
    rippleDataset: $datasetId
  })
  OPTIONAL MATCH (target:Version {
    id: row.toVersionId,
    rippleDataset: $datasetId
  })
  WITH row, source, target
  WHERE source IS NULL OR target IS NULL
  RETURN count(*) AS missing,
         collect({
           fromVersionId: row.fromVersionId,
           toVersionId: row.toVersionId
         })[0..20] AS examples
`;

interface SeedPhaseSummary {
  batches: number;
  rows: number;
}

function asNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (neo4j.isInt(value)) {
    return value.toNumber();
  }
  throw new Error(`Expected a numeric Neo4j value, received ${String(value)}.`);
}

async function readSnapshot(): Promise<RippleSnapshot> {
  const input: unknown = JSON.parse(await readFile(snapshotPath, "utf8"));
  return validateSnapshot(input).snapshot;
}

function batchesOf<T>(rows: readonly T[]): T[][] {
  const batches: T[][] = [];

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    batches.push(rows.slice(start, start + BATCH_SIZE));
  }

  return batches;
}

async function writeBatch<T>(
  driver: Driver,
  query: string,
  rows: readonly T[],
): Promise<QueryResult> {
  const session = driver.session({
    defaultAccessMode: neo4j.session.WRITE,
  });

  try {
    return await session.executeWrite((transaction) =>
      transaction.run(query, { datasetId: RIPPLE_DATASET_ID, rows }),
    );
  } finally {
    await session.close();
  }
}

async function runPhase<T>(
  driver: Driver,
  label: string,
  query: string,
  rows: readonly T[],
): Promise<SeedPhaseSummary> {
  const batches = batchesOf(rows);
  let processed = 0;

  console.log(`\n${label}: ${rows.length} row(s) in ${batches.length} batch(es).`);

  for (const [index, batch] of batches.entries()) {
    const result = await writeBatch(driver, query, batch);
    const batchProcessed = asNumber(result.records[0]?.get("processed"));

    if (batchProcessed !== batch.length) {
      throw new Error(
        `${label} batch ${index + 1} matched ${batchProcessed} of ${batch.length} rows. The transaction was committed but the seed is incomplete; run verification before retrying.`,
      );
    }

    processed += batchProcessed;
  }

  console.log(`${label} complete: ${processed} row(s).`);
  return { batches: batches.length, rows: processed };
}

async function assertDependencyEndpoints(
  driver: Driver,
  rows: RippleSnapshot["dependencies"],
): Promise<void> {
  const session = driver.session({
    defaultAccessMode: neo4j.session.READ,
  });

  try {
    const result = await session.executeRead((transaction) =>
      transaction.run(MISSING_ENDPOINTS_QUERY, {
        datasetId: RIPPLE_DATASET_ID,
        rows,
      }),
    );
    const missing = asNumber(result.records[0]?.get("missing"));

    if (missing > 0) {
      const examples: unknown = result.records[0]?.get("examples");
      throw new Error(
        `Dependency endpoint validation failed for ${missing} row(s): ${JSON.stringify(examples)}`,
      );
    }
  } finally {
    await session.close();
  }
}

async function seed(): Promise<void> {
  const snapshot = await readSnapshot();
  const driver = createCognoDbDriver();

  try {
    await driver.verifyConnectivity();
    console.log(`Validated snapshot ${snapshotPath}.`);
    console.log(
      `Snapshot counts: ${snapshot.packages.length} packages, ${snapshot.versions.length} versions, ${snapshot.dependencies.length} dependencies.`,
    );

    await ensureConstraints(driver);
    console.log("Unique constraints are ready.");

    const packages = await runPhase(
      driver,
      "Phase 1 — Packages",
      PACKAGE_QUERY,
      snapshot.packages,
    );
    const versions = await runPhase(
      driver,
      "Phase 2 — Versions",
      VERSION_QUERY,
      snapshot.versions,
    );
    await assertDependencyEndpoints(driver, snapshot.dependencies);
    console.log("Dependency endpoint preflight passed.");
    const dependencies = await runPhase(
      driver,
      "Phase 3 — Dependencies",
      DEPENDENCY_QUERY,
      snapshot.dependencies,
    );

    console.log("\n=== CognoDB seed summary ===");
    console.log(`Packages: ${packages.rows} rows / ${packages.batches} batches`);
    console.log(`Versions: ${versions.rows} rows / ${versions.batches} batches`);
    console.log(
      `Dependencies: ${dependencies.rows} rows / ${dependencies.batches} batches`,
    );
    console.log(`Batch size: ${BATCH_SIZE}`);
  } finally {
    await driver.close();
  }
}

seed().catch((error: unknown) => {
  console.error("CognoDB seed failed:", error);
  process.exitCode = 1;
});
