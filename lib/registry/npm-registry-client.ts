import { z } from "zod";

const REGISTRY_BASE_URL = "https://registry.npmjs.org";
const REGISTRY_TIMEOUT_MS = 6_000;
const REGISTRY_CACHE_SECONDS = 60 * 60;

const packageLinksSchema = z
  .object({
    homepage: z.string().optional(),
    npm: z.string().optional(),
    repository: z.string().optional(),
  })
  .optional();

const registrySearchSchema = z.object({
  objects: z.array(
    z.object({
      package: z.object({
        description: z.string().optional(),
        links: packageLinksSchema,
        name: z.string().min(1),
        version: z.string().optional(),
      }),
    }),
  ),
});

const repositorySchema = z.union([
  z.string(),
  z.object({
    url: z.string().optional(),
  }),
]);

const packageMetadataSchema = z.object({
  description: z.string().optional(),
  homepage: z.string().optional(),
  keywords: z.union([z.string(), z.array(z.string())]).optional(),
  name: z.string().min(1),
  repository: repositorySchema.optional(),
  version: z.string().optional(),
});

export interface RegistryPackageSummary {
  description?: string;
  latestVersion?: string;
  name: string;
}

export interface RegistryPackageDetail extends RegistryPackageSummary {
  homepageUrl?: string;
  keywords: string[];
  npmUrl: string;
  repositoryUrl?: string;
}

export interface NpmRegistry {
  findPackage(name: string): Promise<RegistryPackageDetail | null>;
  searchPackages(query: string, limit: number): Promise<RegistryPackageSummary[]>;
}

export class NpmRegistryUnavailableError extends Error {
  readonly code = "NPM_REGISTRY_UNAVAILABLE";

  constructor(options?: ErrorOptions) {
    super("The public npm package catalog is temporarily unavailable.", options);
    this.name = "NpmRegistryUnavailableError";
  }
}

function safeExternalUrl(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.startsWith("git+") ? value.slice(4) : value;
  return normalized.startsWith("https://") || normalized.startsWith("http://")
    ? normalized
    : undefined;
}

function normalizeKeywords(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((keyword) => keyword.trim() !== "").slice(0, 8);
  }

  return typeof value === "string"
    ? value
        .split(/[ ,]+/)
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
}

async function registryFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REGISTRY_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Ripple npm package explorer",
      },
      next: { revalidate: REGISTRY_CACHE_SECONDS },
      signal: controller.signal,
    });
  } catch (error: unknown) {
    throw new NpmRegistryUnavailableError({ cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

export class PublicNpmRegistryClient implements NpmRegistry {
  async searchPackages(
    query: string,
    limit: number,
  ): Promise<RegistryPackageSummary[]> {
    const url = new URL("/-/v1/search", REGISTRY_BASE_URL);
    url.searchParams.set("text", query);
    url.searchParams.set("size", String(limit));

    const response = await registryFetch(url.toString());
    if (!response.ok) {
      throw new NpmRegistryUnavailableError();
    }

    const payload = registrySearchSchema.safeParse(await response.json());
    if (!payload.success) {
      throw new NpmRegistryUnavailableError({ cause: payload.error });
    }

    return payload.data.objects.map(({ package: packageResult }) => ({
      description: packageResult.description,
      latestVersion: packageResult.version,
      name: packageResult.name,
    }));
  }

  async findPackage(name: string): Promise<RegistryPackageDetail | null> {
    const encodedName = encodeURIComponent(name);
    const response = await registryFetch(
      `${REGISTRY_BASE_URL}/${encodedName}/latest`,
    );

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new NpmRegistryUnavailableError();
    }

    const payload = packageMetadataSchema.safeParse(await response.json());
    if (!payload.success) {
      throw new NpmRegistryUnavailableError({ cause: payload.error });
    }

    const repositoryValue =
      typeof payload.data.repository === "string"
        ? payload.data.repository
        : payload.data.repository?.url;

    return {
      description: payload.data.description,
      homepageUrl: safeExternalUrl(payload.data.homepage),
      keywords: normalizeKeywords(payload.data.keywords),
      latestVersion: payload.data.version,
      name: payload.data.name,
      npmUrl: `https://www.npmjs.com/package/${encodedName}`,
      repositoryUrl: safeExternalUrl(repositoryValue),
    };
  }
}

let registryClient: NpmRegistry | undefined;

export function getNpmRegistryClient(): NpmRegistry {
  registryClient ??= new PublicNpmRegistryClient();
  return registryClient;
}
