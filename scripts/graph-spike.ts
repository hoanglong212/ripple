import neo4j, {
  type Driver,
  type ProfiledPlan,
  type ResultSummary,
} from "neo4j-driver";
import { cleanupSpikeData } from "./database/cleanup-spike";
import {
  createCognoDbDriver,
  ensureConstraints,
} from "./database/constraints";
import {
  H0_SPIKE_ID,
  H0_SPIKE_PACKAGES,
  H0_SPIKE_VERSIONS,
} from "./database/spike-metadata";

// H0 data is temporary. Every identity is namespaced, every entity carries
// spike metadata, and the finally block removes it before the driver closes.

type QueryParameters = Record<string, unknown>;
type QueryRows = Array<Record<string, unknown>>;

async function runQuery(
  driver: Driver,
  query: string,
  parameters: QueryParameters = {},
  write = false,
): Promise<{ rows: QueryRows; summary: ResultSummary }> {
  const session = driver.session({
    defaultAccessMode: write ? neo4j.session.WRITE : neo4j.session.READ,
  });

  try {
    const result = await session.run(query, parameters);
    return {
      rows: result.records.map((record) => record.toObject()),
      summary: result.summary,
    };
  } finally {
    await session.close();
  }
}

function printRows(title: string, rows: QueryRows): void {
  console.log(`\n=== ${title} ===`);
  console.dir(rows, { colors: true, depth: null });
}

function serialiseProfile(plan: ProfiledPlan): Record<string, unknown> {
  return {
    operator: plan.operatorType,
    rows: plan.rows,
    databaseHits: plan.dbHits,
    pageCacheHits: plan.pageCacheHits,
    pageCacheMisses: plan.pageCacheMisses,
    identifiers: plan.identifiers,
    children: plan.children.map(serialiseProfile),
  };
}

function spikeParameters(): QueryParameters {
  return {
    packages: H0_SPIKE_PACKAGES,
    spikeId: H0_SPIKE_ID,
    versions: H0_SPIKE_VERSIONS,
  };
}

async function seedGraph(driver: Driver): Promise<void> {
  const { summary } = await runQuery(
    driver,
    `
      CREATE (appA:Package:RippleGraphSpike {
        name: $packages.appA, spikeId: $spikeId, spikeTemporary: true
      })
      CREATE (appAVersion:Version:RippleGraphSpike {
        id: $versions.appA, packageName: $packages.appA, version: "1.0.0",
        spikeId: $spikeId, spikeTemporary: true
      })
      CREATE (express:Package:RippleGraphSpike {
        name: $packages.express, spikeId: $spikeId, spikeTemporary: true
      })
      CREATE (expressVersion:Version:RippleGraphSpike {
        id: $versions.express, packageName: $packages.express, version: "5.1.0",
        spikeId: $spikeId, spikeTemporary: true
      })
      CREATE (debug:Package:RippleGraphSpike {
        name: $packages.debug, spikeId: $spikeId, spikeTemporary: true
      })
      CREATE (debugVersion:Version:RippleGraphSpike {
        id: $versions.debug, packageName: $packages.debug, version: "4.4.1",
        spikeId: $spikeId, spikeTemporary: true
      })
      CREATE (appB:Package:RippleGraphSpike {
        name: $packages.appB, spikeId: $spikeId, spikeTemporary: true
      })
      CREATE (appBVersion:Version:RippleGraphSpike {
        id: $versions.appB, packageName: $packages.appB, version: "2.0.0",
        spikeId: $spikeId, spikeTemporary: true
      })
      CREATE (koa:Package:RippleGraphSpike {
        name: $packages.koa, spikeId: $spikeId, spikeTemporary: true
      })
      CREATE (koaVersion:Version:RippleGraphSpike {
        id: $versions.koa, packageName: $packages.koa, version: "3.0.0",
        spikeId: $spikeId, spikeTemporary: true
      })

      CREATE (appA)-[:HAS_VERSION { spikeId: $spikeId }]->(appAVersion)
      CREATE (express)-[:HAS_VERSION { spikeId: $spikeId }]->(expressVersion)
      CREATE (debug)-[:HAS_VERSION { spikeId: $spikeId }]->(debugVersion)
      CREATE (appB)-[:HAS_VERSION { spikeId: $spikeId }]->(appBVersion)
      CREATE (koa)-[:HAS_VERSION { spikeId: $spikeId }]->(koaVersion)

      CREATE (appAVersion)-[:DEPENDS_ON {
        requirement: "^5.1.0", spikeId: $spikeId
      }]->(expressVersion)
      CREATE (expressVersion)-[:DEPENDS_ON {
        requirement: "^4.4.1", spikeId: $spikeId
      }]->(debugVersion)
      CREATE (appBVersion)-[:DEPENDS_ON {
        requirement: "^3.0.0", spikeId: $spikeId
      }]->(koaVersion)
      CREATE (koaVersion)-[:DEPENDS_ON {
        requirement: "^4.4.1", spikeId: $spikeId
      }]->(debugVersion)
    `,
    spikeParameters(),
    true,
  );

  const updates = summary.counters.updates();
  console.log(
    `Seeded ${updates.nodesCreated} temporary nodes and ${updates.relationshipsCreated} temporary relationships.`,
  );
}

async function runSpikeQueries(driver: Driver): Promise<void> {
  const parameters = spikeParameters();
  const exactLookup = await runQuery(
    driver,
    `
      MATCH (version:Version:RippleGraphSpike)
      WHERE version.id = $versions.express
        AND version.spikeId = $spikeId
      RETURN version.id AS id,
             version.packageName AS packageName,
             version.version AS version
    `,
    parameters,
  );
  printRows("Parameterized exact Version lookup", exactLookup.rows);

  const traversalPattern = `
      MATCH path = (source:Version:RippleGraphSpike)
        -[:DEPENDS_ON*1..3]->(dependency:Version:RippleGraphSpike)
      WHERE source.id = $versions.appA
        AND source.spikeId = $spikeId
        AND dependency.spikeId = $spikeId
        AND all(relationship IN relationships(path)
                WHERE relationship.spikeId = $spikeId)
      RETURN [node IN nodes(path) | node.id] AS path,
             length(path) AS hops
      ORDER BY hops, path
  `;
  const traversal = await runQuery(driver, traversalPattern, parameters);
  printRows("Variable-length DEPENDS_ON traversal (*1..3)", traversal.rows);

  const reverseTraversal = await runQuery(
    driver,
    `
      MATCH path = (target:Version:RippleGraphSpike)
        <-[:DEPENDS_ON*1..3]-(source:Version:RippleGraphSpike)
      WHERE target.id = $versions.debug
        AND target.spikeId = $spikeId
        AND source.spikeId = $spikeId
        AND all(relationship IN relationships(path)
                WHERE relationship.spikeId = $spikeId)
      RETURN source.id AS versionThatCanReachTarget,
             length(path) AS hops
      ORDER BY hops, versionThatCanReachTarget
    `,
    parameters,
  );
  printRows("Reverse traversal to the temporary debug version", reverseTraversal.rows);

  const shortestPath = await runQuery(
    driver,
    `
      MATCH (source:Version:RippleGraphSpike),
            (target:Version:RippleGraphSpike)
      WHERE source.id = $versions.appA
        AND source.spikeId = $spikeId
        AND target.id = $versions.debug
        AND target.spikeId = $spikeId
      MATCH path = shortestPath((source)-[:DEPENDS_ON*1..3]->(target))
      WHERE all(relationship IN relationships(path)
                WHERE relationship.spikeId = $spikeId)
      RETURN [node IN nodes(path) | node.id] AS shortestPath,
             length(path) AS hops
    `,
    parameters,
  );
  printRows("shortestPath() for temporary H0 versions", shortestPath.rows);

  const pathDetails = await runQuery(
    driver,
    `
      MATCH path = (source:Version:RippleGraphSpike)
        -[:DEPENDS_ON*1..3]->(target:Version:RippleGraphSpike)
      WHERE source.id = $versions.appA
        AND source.spikeId = $spikeId
        AND target.id = $versions.debug
        AND target.spikeId = $spikeId
        AND all(relationship IN relationships(path)
                WHERE relationship.spikeId = $spikeId)
      RETURN [node IN nodes(path) | {
               labels: labels(node), id: node.id
             }] AS nodes,
             [relationship IN relationships(path) | {
               type: type(relationship), requirement: relationship.requirement
             }] AS relationships
    `,
    parameters,
  );
  printRows("nodes(path) and relationships(path)", pathDetails.rows);

  const profiledTraversal = await runQuery(
    driver,
    `PROFILE ${traversalPattern}`,
    parameters,
  );
  printRows("PROFILE traversal results", profiledTraversal.rows);

  console.log("\n=== PROFILE execution plan ===");
  if (profiledTraversal.summary.profile === false) {
    console.log("The database did not return a PROFILE execution plan.");
  } else {
    console.dir(serialiseProfile(profiledTraversal.summary.profile), {
      colors: true,
      depth: null,
    });
  }
}

async function main(): Promise<void> {
  const driver = createCognoDbDriver();

  try {
    await driver.verifyConnectivity();
    console.log("Connected to CognoDB for the isolated, temporary H0 spike.");
    await ensureConstraints(driver);
    console.log("Ensured unique constraints for Package.name and Version.id.");
    await cleanupSpikeData(driver);

    try {
      await seedGraph(driver);
      await runSpikeQueries(driver);
    } finally {
      console.log("\nRemoving temporary H0 data before exit.");
      await cleanupSpikeData(driver);
    }
  } finally {
    await driver.close();
    console.log("\nCognoDB driver closed once.");
  }
}

main().catch((error: unknown) => {
  console.error("Graph spike failed:", error);
  process.exitCode = 1;
});
