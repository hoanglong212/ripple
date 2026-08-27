import path from "node:path";
import { fileURLToPath } from "node:url";
import neo4j, { type Driver } from "neo4j-driver";
import { z } from "zod";

const environmentSchema = z.object({
  COGNODB_URI: z.string().trim().min(1, "COGNODB_URI is required"),
  COGNODB_USER: z.string().trim().min(1, "COGNODB_USER is required"),
  COGNODB_PASSWORD: z.string().min(1, "COGNODB_PASSWORD is required"),
});

const CONSTRAINT_QUERIES = [
  `
    CREATE CONSTRAINT ripple_package_name_unique IF NOT EXISTS
    FOR (package:Package)
    REQUIRE package.name IS UNIQUE
  `,
  `
    CREATE CONSTRAINT ripple_version_id_unique IF NOT EXISTS
    FOR (version:Version)
    REQUIRE version.id IS UNIQUE
  `,
] as const;

export function createCognoDbDriver(): Driver {
  const environment = environmentSchema.parse(process.env);

  return neo4j.driver(
    environment.COGNODB_URI,
    neo4j.auth.basic(
      environment.COGNODB_USER,
      environment.COGNODB_PASSWORD,
    ),
    { disableLosslessIntegers: true },
  );
}

export async function ensureConstraints(driver: Driver): Promise<void> {
  for (const query of CONSTRAINT_QUERIES) {
    const session = driver.session({
      defaultAccessMode: neo4j.session.WRITE,
    });

    try {
      await session.run(query);
    } finally {
      await session.close();
    }
  }
}

async function runCli(): Promise<void> {
  const driver = createCognoDbDriver();

  try {
    await driver.verifyConnectivity();
    await ensureConstraints(driver);
    console.log("Ensured unique constraints for Package.name and Version.id.");
  } finally {
    await driver.close();
  }
}

const entryPoint = process.argv[1]
  ? path.resolve(process.argv[1])
  : undefined;
if (entryPoint === fileURLToPath(import.meta.url)) {
  runCli().catch((error: unknown) => {
    console.error("Constraint setup failed:", error);
    process.exitCode = 1;
  });
}
