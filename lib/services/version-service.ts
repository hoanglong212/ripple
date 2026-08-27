import semver from "semver";
import type {
  DownstreamImpact,
  ExplainPath,
  GraphRepository,
  VersionDetail,
} from "@/lib/domain/packages";
import { InvalidInputError, NotIndexedError } from "./errors";
import { DATASET_SCOPE } from "@/lib/domain/packages";

export class VersionService {
  private static readonly MAX_DOWNSTREAM_DEPTH = 4;
  private static readonly MAX_EXPLAIN_PATH_DEPTH = 5;

  constructor(private readonly repository: GraphRepository) {}

  async getVersion(versionId: string): Promise<VersionDetail> {
    const normalized = versionId.trim();
    this.assertExactVersionId(normalized);

    const version = await this.repository.findVersion(normalized);
    if (version === null) {
      throw new NotIndexedError(
        "VERSION_NOT_INDEXED",
        `${normalized} is not in Ripple’s indexed snapshot.`,
      );
    }

    return version;
  }

  async getDownstreamImpact(versionId: string): Promise<DownstreamImpact> {
    const normalized = versionId.trim();
    this.assertExactVersionId(normalized);

    const affectedVersions = await this.repository.findDownstreamImpact(
      normalized,
      VersionService.MAX_DOWNSTREAM_DEPTH,
    );
    if (affectedVersions === null) {
      throw new NotIndexedError(
        "VERSION_NOT_INDEXED",
        `${normalized} is not in Ripple’s indexed snapshot.`,
      );
    }

    const directCount = affectedVersions.filter(
      (version) => version.hopCount === 1,
    ).length;

    return {
      affectedVersions,
      directCount,
      maxObservedDepth: affectedVersions.reduce(
        (maximum, version) => Math.max(maximum, version.hopCount),
        0,
      ),
      maxTraversalDepth: VersionService.MAX_DOWNSTREAM_DEPTH,
      targetVersionId: normalized,
      totalReachable: affectedVersions.length,
      transitiveCount: affectedVersions.length - directCount,
    };
  }

  async explainPath(
    sourceVersionId: string,
    targetVersionId: string,
  ): Promise<ExplainPath> {
    const source = sourceVersionId.trim();
    const target = targetVersionId.trim();
    this.assertExactVersionId(source);
    this.assertExactVersionId(target);

    const [sourceExists, targetExists] = await Promise.all([
      this.repository.versionExists(source),
      this.repository.versionExists(target),
    ]);
    if (!sourceExists) {
      throw new NotIndexedError(
        "VERSION_NOT_INDEXED",
        `${source} is not in Ripple’s indexed snapshot.`,
      );
    }
    if (!targetExists) {
      throw new NotIndexedError(
        "VERSION_NOT_INDEXED",
        `${target} is not in Ripple’s indexed snapshot.`,
      );
    }

    const graphPath = await this.repository.findShortestDependencyPath(
      source,
      target,
      VersionService.MAX_EXPLAIN_PATH_DEPTH,
    );
    if (graphPath === null) {
      return {
        datasetQualifier: DATASET_SCOPE,
        hops: 0,
        path: [],
        relationships: [],
        source,
        target,
      };
    }

    return {
      datasetQualifier: DATASET_SCOPE,
      hops: graphPath.requirements.length,
      path: graphPath.versionIds,
      relationships: graphPath.requirements.map((requirement, index) => ({
        fromVersionId: graphPath.versionIds[index],
        requirement,
        toVersionId: graphPath.versionIds[index + 1],
      })),
      source,
      target,
    };
  }

  private assertExactVersionId(versionId: string): void {
    const separator = versionId.lastIndexOf("@");
    const packageName = versionId.slice(0, separator);
    const version = versionId.slice(separator + 1);

    if (
      separator <= 0 ||
      packageName.trim() === "" ||
      semver.valid(version) === null
    ) {
      throw new InvalidInputError(
        "An exact Version ID such as express@5.2.1 is required.",
      );
    }
  }
}
