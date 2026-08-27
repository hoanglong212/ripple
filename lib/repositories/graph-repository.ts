import neo4j, {
  type Driver,
  type Record as Neo4jRecord,
} from "neo4j-driver";
import { getNeo4jDriver } from "@/lib/database/neo4j";
import {
  RIPPLE_DATASET_ID,
  type DatasetStats,
  type DirectDependency,
  type DownstreamImpactItem,
  type GraphDependencyPath,
  type GraphRepository,
  type PackageDetail,
  type PackageSearchResult,
  type VersionDetail,
} from "@/lib/domain/packages";
import { DatabaseUnavailableError } from "@/lib/services/errors";

const DATASET_STATS_QUERY = `
  MATCH (package:Package)
  WHERE package.rippleDataset = $datasetId
  WITH count(package) AS packageCount
  MATCH (version:Version)
  WHERE version.rippleDataset = $datasetId
  WITH packageCount, count(version) AS versionCount
  MATCH (:Version)-[dependency:DEPENDS_ON]->(:Version)
  WHERE dependency.rippleDataset = $datasetId
  RETURN packageCount,
         versionCount,
         count(dependency) AS relationshipCount
`;

const SEARCH_PACKAGES_QUERY = `
  MATCH (package:Package)
  WHERE package.rippleDataset = $datasetId
    AND toLower(package.name) CONTAINS toLower($query)
  OPTIONAL MATCH (package)-[ownership:HAS_VERSION]->(version:Version)
  WHERE ownership.rippleDataset = $datasetId
    AND version.rippleDataset = $datasetId
  RETURN package.name AS name,
         count(version) AS indexedVersionCount,
         CASE
           WHEN toLower(package.name) = toLower($query) THEN 0
           ELSE 1
         END AS exactRank
  ORDER BY exactRank, name
  LIMIT $limit
`;

const FIND_PACKAGE_QUERY = `
  MATCH (package:Package)
  WHERE package.name = $name
    AND package.rippleDataset = $datasetId
  OPTIONAL MATCH (package)-[ownership:HAS_VERSION]->(version:Version)
  WHERE ownership.rippleDataset = $datasetId
    AND version.rippleDataset = $datasetId
  RETURN package.name AS name,
         version.id AS versionId,
         version.version AS version
  ORDER BY versionId
`;

const FIND_VERSION_QUERY = `
  MATCH (package:Package)-[ownership:HAS_VERSION]->(version:Version)
  WHERE package.rippleDataset = $datasetId
    AND ownership.rippleDataset = $datasetId
    AND version.id = $versionId
    AND version.rippleDataset = $datasetId
  OPTIONAL MATCH (version)-[dependency:DEPENDS_ON]->(target:Version)
  WHERE dependency.rippleDataset = $datasetId
    AND target.rippleDataset = $datasetId
  RETURN package.name AS packageName,
         version.id AS id,
         version.version AS version,
         target.packageName AS dependencyPackageName,
         target.id AS dependencyVersionId,
         dependency.requirement AS requirement
  ORDER BY dependencyPackageName, dependencyVersionId
`;

const VERSION_EXISTS_QUERY = `
  MATCH (version:Version)
  WHERE version.id = $versionId
    AND version.rippleDataset = $datasetId
  RETURN count(version) > 0 AS exists
`;

function downstreamImpactQuery(maxDepth: number): string {
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1 || maxDepth > 8) {
    throw new Error("Downstream traversal depth is outside repository bounds.");
  }

  return `
    MATCH (target:Version)
    WHERE target.id = $versionId
      AND target.rippleDataset = $datasetId
    OPTIONAL MATCH path=(affected:Version)
      -[dependencies:DEPENDS_ON*1..${maxDepth}]->(target)
    WHERE affected.rippleDataset = $datasetId
      AND all(
        dependency IN relationships(path)
        WHERE dependency.rippleDataset = $datasetId
      )
      AND all(
        node IN nodes(path)
        WHERE node.rippleDataset = $datasetId
      )
    WITH target, affected, path
    ORDER BY affected.id, length(path)
    WITH target, affected, collect(path)[0] AS shortestPath
    RETURN target.id AS targetVersionId,
           affected.id AS affectedVersionId,
           length(shortestPath) AS hopCount,
           [node IN nodes(shortestPath) | node.id] AS pathVersionIds
    ORDER BY hopCount, affectedVersionId
  `;
}

function shortestDependencyPathQuery(maxDepth: number): string {
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1 || maxDepth > 5) {
    throw new Error("Explain Path depth is outside repository bounds.");
  }

  return `
    MATCH (source:Version), (target:Version)
    WHERE source.id = $sourceVersionId
      AND source.rippleDataset = $datasetId
      AND target.id = $targetVersionId
      AND target.rippleDataset = $datasetId
    OPTIONAL MATCH path = shortestPath(
      (source)-[:DEPENDS_ON*1..${maxDepth}]->(target)
    )
    WHERE path IS NULL OR (
      all(
        dependency IN relationships(path)
        WHERE dependency.rippleDataset = $datasetId
      )
      AND all(
        node IN nodes(path)
        WHERE node.rippleDataset = $datasetId
      )
    )
    RETURN nodes(path) AS pathNodes,
           relationships(path) AS pathRelationships
  `;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`CognoDB returned an invalid ${field}.`);
  }
  return value;
}

function asNumber(value: unknown, field: string): number {
  if (typeof value === "number") {
    return value;
  }
  if (neo4j.isInt(value)) {
    return value.toNumber();
  }
  throw new Error(`CognoDB returned an invalid ${field}.`);
}

export class Neo4jGraphRepository implements GraphRepository {
  constructor(private readonly driver: Driver) {}

  async findDatasetStats(): Promise<DatasetStats> {
    return this.read(
      DATASET_STATS_QUERY,
      { datasetId: RIPPLE_DATASET_ID },
      (records) => {
        if (records.length !== 1) {
          throw new Error("CognoDB returned invalid dataset metadata.");
        }
        return {
          packageCount: asNumber(records[0].get("packageCount"), "package count"),
          relationshipCount: asNumber(
            records[0].get("relationshipCount"),
            "relationship count",
          ),
          versionCount: asNumber(records[0].get("versionCount"), "version count"),
        };
      },
    );
  }

  async findDownstreamImpact(
    versionId: string,
    maxDepth: number,
  ): Promise<DownstreamImpactItem[] | null> {
    return this.read(
      downstreamImpactQuery(maxDepth),
      { datasetId: RIPPLE_DATASET_ID, versionId },
      (records) => {
        if (records.length === 0) {
          return null;
        }

        return records.flatMap((record) => {
          const affectedVersionId = record.get("affectedVersionId");
          const hopCount = record.get("hopCount");
          const pathVersionIds = record.get("pathVersionIds");

          if (
            typeof affectedVersionId !== "string" ||
            !Array.isArray(pathVersionIds) ||
            !pathVersionIds.every((value) => typeof value === "string")
          ) {
            return [];
          }

          return [
            {
              affectedVersionId,
              hopCount: asNumber(hopCount, "downstream hop count"),
              pathVersionIds,
            },
          ];
        });
      },
    );
  }

  async findShortestDependencyPath(
    sourceVersionId: string,
    targetVersionId: string,
    maxDepth: number,
  ): Promise<GraphDependencyPath | null> {
    return this.read(
      shortestDependencyPathQuery(maxDepth),
      {
        datasetId: RIPPLE_DATASET_ID,
        sourceVersionId,
        targetVersionId,
      },
      (records) => {
        if (records.length === 0) {
          return null;
        }

        const pathNodes: unknown = records[0].get("pathNodes");
        const pathRelationships: unknown = records[0].get("pathRelationships");
        if (pathNodes === null && pathRelationships === null) {
          return null;
        }
        if (!Array.isArray(pathNodes) || !Array.isArray(pathRelationships)) {
          throw new Error("CognoDB returned an invalid dependency path.");
        }

        const versionIds = pathNodes.map((node, index) => {
          const properties =
            typeof node === "object" && node !== null && "properties" in node
              ? node.properties
              : null;
          const id =
            typeof properties === "object" &&
            properties !== null &&
            "id" in properties
              ? properties.id
              : null;
          return asString(id, `path node ${index + 1} Version.id`);
        });
        const requirements = pathRelationships.map((relationship, index) => {
          const properties =
            typeof relationship === "object" &&
            relationship !== null &&
            "properties" in relationship
              ? relationship.properties
              : null;
          const requirement =
            typeof properties === "object" &&
            properties !== null &&
            "requirement" in properties
              ? properties.requirement
              : null;
          return asString(
            requirement,
            `path relationship ${index + 1} requirement`,
          );
        });

        if (requirements.length !== versionIds.length - 1) {
          throw new Error("CognoDB returned an inconsistent dependency path.");
        }

        return { requirements, versionIds };
      },
    );
  }

  async searchPackages(
    query: string,
    limit: number,
  ): Promise<PackageSearchResult[]> {
    return this.read(
      SEARCH_PACKAGES_QUERY,
      { datasetId: RIPPLE_DATASET_ID, query, limit },
      (records) =>
      records.map((record) => ({
        indexedVersionCount: asNumber(
          record.get("indexedVersionCount"),
          "indexedVersionCount",
        ),
        name: asString(record.get("name"), "Package.name"),
      })),
    );
  }

  async findPackage(name: string): Promise<PackageDetail | null> {
    return this.read(
      FIND_PACKAGE_QUERY,
      { datasetId: RIPPLE_DATASET_ID, name },
      (records) => {
      if (records.length === 0) {
        return null;
      }

      const versions = records.flatMap((record) => {
        const id = record.get("versionId");
        const version = record.get("version");

        return typeof id === "string" && typeof version === "string"
          ? [{ id, version }]
          : [];
      });

      return {
        name: asString(records[0].get("name"), "Package.name"),
        versions,
      };
      },
    );
  }

  async findVersion(versionId: string): Promise<VersionDetail | null> {
    return this.read(
      FIND_VERSION_QUERY,
      { datasetId: RIPPLE_DATASET_ID, versionId },
      (records) => {
      if (records.length === 0) {
        return null;
      }

      const dependencies: DirectDependency[] = records.flatMap((record) => {
        const dependencyPackageName = record.get("dependencyPackageName");
        const dependencyVersionId = record.get("dependencyVersionId");
        const requirement = record.get("requirement");

        return typeof dependencyPackageName === "string" &&
          typeof dependencyVersionId === "string" &&
          typeof requirement === "string"
          ? [
              {
                dependencyPackageName,
                dependencyVersionId,
                requirement,
              },
            ]
          : [];
      });

      return {
        dependencies,
        id: asString(records[0].get("id"), "Version.id"),
        packageName: asString(
          records[0].get("packageName"),
          "Package.name",
        ),
        version: asString(records[0].get("version"), "Version.version"),
      };
      },
    );
  }

  async versionExists(versionId: string): Promise<boolean> {
    return this.read(
      VERSION_EXISTS_QUERY,
      { datasetId: RIPPLE_DATASET_ID, versionId },
      (records) => records[0]?.get("exists") === true,
    );
  }

  private async read<T>(
    query: string,
    parameters: Record<string, unknown>,
    map: (records: Neo4jRecord[]) => T,
  ): Promise<T> {
    let session: ReturnType<Driver["session"]> | undefined;

    try {
      session = this.driver.session({
        defaultAccessMode: neo4j.session.READ,
      });
      const result = await session.executeRead((transaction) =>
        transaction.run(query, parameters),
      );
      return map(result.records);
    } catch (error: unknown) {
      if (
        error instanceof neo4j.Neo4jError &&
        (neo4j.isRetryableError(error) ||
          error.code === neo4j.error.SERVICE_UNAVAILABLE ||
          error.code === neo4j.error.SESSION_EXPIRED)
      ) {
        throw new DatabaseUnavailableError(undefined, { cause: error });
      }
      throw error;
    } finally {
      await session?.close();
    }
  }
}

let repository: GraphRepository | undefined;

export function getGraphRepository(): GraphRepository {
  repository ??= new Neo4jGraphRepository(getNeo4jDriver());
  return repository;
}
