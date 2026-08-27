import semver from "semver";
import type {
  GraphRepository,
  PackageDetail,
  PackageSearchResult,
} from "@/lib/domain/packages";
import { InvalidInputError, NotIndexedError } from "./errors";

const SEARCH_LIMIT = 20;

export class PackageService {
  constructor(private readonly repository: GraphRepository) {}

  async searchPackages(query: string): Promise<PackageSearchResult[]> {
    const normalized = query.trim();
    if (normalized === "") {
      throw new InvalidInputError("Enter a package name to search.");
    }

    return this.repository.searchPackages(normalized, SEARCH_LIMIT);
  }

  async getPackage(name: string): Promise<PackageDetail> {
    const normalized = name.trim();
    if (normalized === "") {
      throw new InvalidInputError("Package name is required.");
    }

    const packageDetail = await this.repository.findPackage(normalized);
    if (packageDetail === null) {
      throw new NotIndexedError(
        "PACKAGE_NOT_INDEXED",
        `${normalized} is not in Ripple’s indexed snapshot.`,
      );
    }

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
}
