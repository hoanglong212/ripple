import semver from "semver";
import type {
  GraphRepository,
  PackageDetail,
  PackageSearchResult,
} from "@/lib/domain/packages";
import type {
  NpmRegistry,
  RegistryPackageDetail,
} from "@/lib/registry/npm-registry-client";
import {
  DatabaseUnavailableError,
  InvalidInputError,
  NotIndexedError,
} from "./errors";

const SEARCH_LIMIT = 20;

export class PackageService {
  constructor(
    private readonly repository: GraphRepository,
    private readonly registry?: NpmRegistry,
  ) {}

  async searchPackages(query: string): Promise<PackageSearchResult[]> {
    const normalized = query.trim();
    if (normalized === "") {
      throw new InvalidInputError("Enter a package name to search.");
    }

    if (this.registry === undefined) {
      return this.repository.searchPackages(normalized, SEARCH_LIMIT);
    }

    const [graphResult, registryResult] = await Promise.allSettled([
      this.repository.searchPackages(normalized, SEARCH_LIMIT),
      this.registry.searchPackages(normalized, SEARCH_LIMIT),
    ]);

    if (
      graphResult.status === "rejected" &&
      !(graphResult.reason instanceof DatabaseUnavailableError)
    ) {
      throw graphResult.reason;
    }

    if (registryResult.status === "rejected") {
      if (graphResult.status === "rejected") {
        throw registryResult.reason;
      }

      return graphResult.value.map((packageResult) => ({
        ...packageResult,
        graphStatus: "indexed" as const,
      }));
    }

    const indexedPackages =
      graphResult.status === "fulfilled" ? graphResult.value : [];
    const indexedByName = new Map(
      indexedPackages.map((packageResult) => [
        packageResult.name.toLowerCase(),
        packageResult,
      ]),
    );
    const graphStatusWhenMissing =
      graphResult.status === "rejected" ? "unavailable" : "not-indexed";
    const merged: PackageSearchResult[] = registryResult.value.map(
      (registryPackage) => {
        const indexedPackage = indexedByName.get(
          registryPackage.name.toLowerCase(),
        );
        indexedByName.delete(registryPackage.name.toLowerCase());

        return {
          description: registryPackage.description,
          graphStatus: indexedPackage
            ? "indexed"
            : graphStatusWhenMissing,
          indexedVersionCount: indexedPackage?.indexedVersionCount ?? 0,
          latestVersion: registryPackage.latestVersion,
          name: registryPackage.name,
        };
      },
    );

    for (const indexedPackage of indexedByName.values()) {
      merged.push({ ...indexedPackage, graphStatus: "indexed" });
    }

    return merged
      .sort((left, right) => {
        const leftExact = left.name.toLowerCase() === normalized.toLowerCase();
        const rightExact = right.name.toLowerCase() === normalized.toLowerCase();
        return Number(rightExact) - Number(leftExact);
      })
      .slice(0, SEARCH_LIMIT);
  }

  async getPackage(name: string): Promise<PackageDetail> {
    const normalized = name.trim();
    if (normalized === "") {
      throw new InvalidInputError("Package name is required.");
    }

    if (this.registry === undefined) {
      const packageDetail = await this.repository.findPackage(normalized);
      if (packageDetail === null) {
        throw new NotIndexedError(
          "PACKAGE_NOT_INDEXED",
          `${normalized} is not in Ripple’s indexed snapshot.`,
        );
      }

      return this.sortPackageVersions(packageDetail);
    }

    const [graphResult, registryResult] = await Promise.allSettled([
      this.repository.findPackage(normalized),
      this.registry.findPackage(normalized),
    ]);

    if (
      graphResult.status === "rejected" &&
      !(graphResult.reason instanceof DatabaseUnavailableError)
    ) {
      throw graphResult.reason;
    }

    const graphPackage =
      graphResult.status === "fulfilled" ? graphResult.value : null;

    if (registryResult.status === "rejected") {
      if (graphPackage === null) {
        throw registryResult.reason;
      }

      return {
        ...this.sortPackageVersions(graphPackage),
        graphStatus: "indexed",
      };
    }

    const registryPackage = registryResult.value;
    if (graphPackage === null && registryPackage === null) {
      throw new NotIndexedError(
        "PACKAGE_NOT_INDEXED",
        `${normalized} was not found in the public npm registry.`,
      );
    }

    const packageDetail: PackageDetail = {
      graphStatus:
        graphResult.status === "rejected"
          ? "unavailable"
          : graphPackage === null
            ? "not-indexed"
            : "indexed",
      metadata: registryPackage
        ? this.toPackageMetadata(registryPackage)
        : undefined,
      name: graphPackage?.name ?? registryPackage?.name ?? normalized,
      versions: graphPackage?.versions ?? [],
    };

    return this.sortPackageVersions(packageDetail);
  }

  private sortPackageVersions(packageDetail: PackageDetail): PackageDetail {
    return {
      ...packageDetail,
      versions: [...packageDetail.versions].sort((left, right) => {
        const leftValid = semver.valid(left.version);
        const rightValid = semver.valid(right.version);

        if (leftValid !== null && rightValid !== null) {
          return semver.rcompare(leftValid, rightValid);
        }
        if (leftValid !== null) {
          return -1;
        }
        if (rightValid !== null) {
          return 1;
        }
        return left.version < right.version
          ? 1
          : left.version > right.version
            ? -1
            : 0;
      }),
    };
  }

  private toPackageMetadata(registryPackage: RegistryPackageDetail) {
    return {
      description: registryPackage.description,
      homepageUrl: registryPackage.homepageUrl,
      installCommand: `npm install ${registryPackage.name}`,
      keywords: registryPackage.keywords,
      latestVersion: registryPackage.latestVersion,
      npmUrl: registryPackage.npmUrl,
      repositoryUrl: registryPackage.repositoryUrl,
    };
  }
}
