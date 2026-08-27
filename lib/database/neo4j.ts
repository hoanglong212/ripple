import neo4j, { type Driver } from "neo4j-driver";
import { z } from "zod";
import { DatabaseUnavailableError } from "@/lib/services/errors";

const environmentSchema = z.object({
  COGNODB_URI: z.string().trim().min(1, "COGNODB_URI is required"),
  COGNODB_USER: z.string().trim().min(1, "COGNODB_USER is required"),
  COGNODB_PASSWORD: z.string().min(1, "COGNODB_PASSWORD is required"),
});

const globalForNeo4j = globalThis as typeof globalThis & {
  rippleNeo4jDriver?: Driver;
};

export function getNeo4jDriver(): Driver {
  if (globalForNeo4j.rippleNeo4jDriver === undefined) {
    const parsedEnvironment = environmentSchema.safeParse(process.env);
    if (!parsedEnvironment.success) {
      throw new DatabaseUnavailableError(
        "Ripple’s graph connection is not configured.",
        { cause: parsedEnvironment.error },
      );
    }
    const environment = parsedEnvironment.data;

    globalForNeo4j.rippleNeo4jDriver = neo4j.driver(
      environment.COGNODB_URI,
      neo4j.auth.basic(
        environment.COGNODB_USER,
        environment.COGNODB_PASSWORD,
      ),
      { disableLosslessIntegers: true },
    );
  }

  return globalForNeo4j.rippleNeo4jDriver;
}
