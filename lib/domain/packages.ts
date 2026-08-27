export const DATASET_SCOPE = "Within Ripple’s indexed npm snapshot.";
export const RIPPLE_DATASET_ID = "ripple-p0";

export interface DatasetStats {
  packageCount: number;
  relationshipCount: number;
  versionCount: number;
}

export interface PackageSearchResult {
  indexedVersionCount: number;
  name: string;
}

export interface IndexedVersion {
  id: string;
  version: string;
}

export interface PackageDetail {
  name: string;
  versions: IndexedVersion[];
}

export interface DirectDependency {
  dependencyPackageName: string;
  dependencyVersionId: string;
  requirement: string;
}

export interface VersionDetail {
  dependencies: DirectDependency[];
  id: string;
  packageName: string;
  version: string;
}

export interface DownstreamImpactItem {
  affectedVersionId: string;
  hopCount: number;
  pathVersionIds: string[];
}

export interface DownstreamImpact {
  affectedVersions: DownstreamImpactItem[];
  directCount: number;
  maxObservedDepth: number;
  maxTraversalDepth: number;
  targetVersionId: string;
  totalReachable: number;
  transitiveCount: number;
}

export interface GraphDependencyPath {
  requirements: string[];
  versionIds: string[];
}

export interface ExplainPathRelationship {
  fromVersionId: string;
  requirement: string;
  toVersionId: string;
}

export interface ExplainPath {
  datasetQualifier: string;
  hops: number;
  path: string[];
  relationships: ExplainPathRelationship[];
  source: string;
  target: string;
}

export interface GraphRepository {
  findDatasetStats(): Promise<DatasetStats>;
  findDownstreamImpact(
    versionId: string,
    maxDepth: number,
  ): Promise<DownstreamImpactItem[] | null>;
  findShortestDependencyPath(
    sourceVersionId: string,
    targetVersionId: string,
    maxDepth: number,
  ): Promise<GraphDependencyPath | null>;
  findPackage(name: string): Promise<PackageDetail | null>;
  findVersion(versionId: string): Promise<VersionDetail | null>;
  searchPackages(query: string, limit: number): Promise<PackageSearchResult[]>;
  versionExists(versionId: string): Promise<boolean>;
}
