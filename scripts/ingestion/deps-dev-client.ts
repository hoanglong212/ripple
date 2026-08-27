import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { gunzip, gzip } from "node:zlib";
import { promisify } from "node:util";
import { z } from "zod";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const DEPS_DEV_BASE_URL = "https://api.deps.dev/v3";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

export const versionKeySchema = z
  .object({
    system: z.string().trim().min(1),
    name: z.string().trim().min(1),
    version: z.string().trim().min(1),
  })
  .passthrough();

const dependencyNodeSchema = z
  .object({
    versionKey: versionKeySchema,
    bundled: z.boolean().optional().default(false),
    relation: z.enum(["SELF", "DIRECT", "INDIRECT"]),
    errors: z.array(z.string()).optional().default([]),
  })
  .passthrough();

const dependencyEdgeSchema = z
  .object({
    fromNode: z.number().int().nonnegative(),
    toNode: z.number().int().nonnegative(),
    requirement: z.string(),
  })
  .passthrough();

export const dependencyGraphSchema = z
  .object({
    nodes: z.array(dependencyNodeSchema),
    edges: z.array(dependencyEdgeSchema),
    error: z.string().optional().default(""),
  })
  .passthrough();

const cacheEntrySchema = z.object({
  fetchedAt: z.iso.datetime(),
  request: versionKeySchema,
  response: dependencyGraphSchema,
});

export type VersionKey = z.infer<typeof versionKeySchema>;
export type DependencyGraph = z.infer<typeof dependencyGraphSchema>;

export interface DependencyGraphResult {
  cache: "hit" | "miss";
  fetchedAt: string;
  graph: DependencyGraph;
}

export interface CacheStats {
  hits: number;
  misses: number;
}

class HttpResponseError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "HttpResponseError";
  }
}

function sameVersionKey(left: VersionKey, right: VersionKey): boolean {
  return (
    left.system === right.system &&
    left.name === right.name &&
    left.version === right.version
  );
}

function cacheFileName(versionKey: VersionKey): string {
  const identity = [
    versionKey.system,
    versionKey.name,
    versionKey.version,
  ].join("\0");
  const hash = createHash("sha256").update(identity).digest("hex");

  return `${hash}.json.gz`;
}

function dependencyGraphUrl(versionKey: VersionKey): string {
  const system = encodeURIComponent(versionKey.system.toLowerCase());
  const name = encodeURIComponent(versionKey.name);
  const version = encodeURIComponent(versionKey.version);

  return `${DEPS_DEV_BASE_URL}/systems/${system}/packages/${name}/versions/${version}:dependencies`;
}

export class DepsDevClient {
  private readonly stats: CacheStats = { hits: 0, misses: 0 };

  constructor(private readonly cacheDirectory: string) {}

  get cacheStats(): CacheStats {
    return { ...this.stats };
  }

  async getDependencyGraph(
    versionKey: VersionKey,
  ): Promise<DependencyGraphResult> {
    const cachePath = path.join(
      this.cacheDirectory,
      cacheFileName(versionKey),
    );
    const cached = await this.readCache(cachePath, versionKey);

    if (cached !== null) {
      this.stats.hits += 1;
      return { cache: "hit", ...cached };
    }

    this.stats.misses += 1;
    const fetched = await this.fetchDependencyGraph(versionKey);
    await this.writeCache(cachePath, versionKey, fetched);

    return { cache: "miss", ...fetched };
  }

  private async readCache(
    cachePath: string,
    versionKey: VersionKey,
  ): Promise<Omit<DependencyGraphResult, "cache"> | null> {
    try {
      const compressed = await readFile(cachePath);
      const uncompressed = await gunzipAsync(compressed);
      const parsed = cacheEntrySchema.safeParse(
        JSON.parse(uncompressed.toString("utf8")),
      );

      if (!parsed.success || !sameVersionKey(parsed.data.request, versionKey)) {
        return null;
      }

      return {
        fetchedAt: parsed.data.fetchedAt,
        graph: parsed.data.response,
      };
    } catch (error: unknown) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "";

      if (code !== "ENOENT") {
        console.warn(`Ignoring unreadable cache entry ${cachePath}.`);
      }

      return null;
    }
  }

  private async writeCache(
    cachePath: string,
    versionKey: VersionKey,
    fetched: Omit<DependencyGraphResult, "cache">,
  ): Promise<void> {
    await mkdir(this.cacheDirectory, { recursive: true });
    const entry = {
      fetchedAt: fetched.fetchedAt,
      request: versionKey,
      response: fetched.graph,
    };
    const compressed = await gzipAsync(JSON.stringify(entry), { level: 9 });
    await writeFile(cachePath, compressed);
  }

  private async fetchDependencyGraph(
    versionKey: VersionKey,
  ): Promise<Omit<DependencyGraphResult, "cache">> {
    const url = dependencyGraphUrl(versionKey);
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": "ripple-snapshot-builder/0.1",
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          throw new HttpResponseError(
            `deps.dev returned HTTP ${response.status} for ${versionKey.name}@${versionKey.version}`,
            retryable,
          );
        }

        const json: unknown = await response.json();
        const graph = dependencyGraphSchema.parse(json);

        return {
          fetchedAt: new Date().toISOString(),
          graph,
        };
      } catch (error: unknown) {
        lastError = error;
        const retryable =
          !(error instanceof HttpResponseError) || error.retryable;

        if (!retryable || attempt === MAX_ATTEMPTS) {
          break;
        }

        await delay(500 * 2 ** (attempt - 1));
      }
    }

    const detail =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
      `Unable to acquire deps.dev graph for ${versionKey.name}@${versionKey.version}: ${detail}`,
      { cause: lastError },
    );
  }
}
