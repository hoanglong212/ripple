# Ripple technical design

Status: frozen P0 architecture, implemented and verified. This document remains the source of truth for Ripple's product and system boundaries.

The canonical graph model is defined in [graph-model.md](./graph-model.md):

```cypher
(:Package)-[:HAS_VERSION]->(:Version)-[:DEPENDS_ON { requirement }]->(:Version)
```

## Product scope

Ripple answers dependency questions over a deliberately selected set of npm packages and exact versions. Package nodes support identity and search; Version nodes and their relationships provide dependency truth.

The required dataset wording in product and API surfaces is:

> Ripple contains a curated, bounded snapshot of selected npm packages and versions. Results describe only the versions indexed in Ripple and are not a complete view of the npm ecosystem.

The shorter qualifier “within Ripple's indexed snapshot” should accompany individual impact and path results where space is limited. Ripple must not describe a missing or unreachable result as a claim about the entire npm ecosystem.

## Delivery order

P0 consists of:

1. Package Search.
2. Package Detail with an indexed-version selector.
3. Downstream Impact for one exact version.
4. An explainable dependency path between two exact versions.

The first P1 feature is Version Divergence. It compares dependency outcomes between selected exact versions, but its product contract and query design are intentionally deferred until P0 semantics are validated.

## P0 user flows

### 1. Package Search

1. The caller supplies a package-name query.
2. Ripple searches only the `Package` identity layer.
3. Results return canonical Package names that are present in the indexed snapshot.
4. Selecting a result opens that Package's detail resource.

Search does not traverse dependencies and does not imply that all npm packages or versions are indexed.

### 2. Package Detail and indexed-version selection

1. The caller requests one Package by canonical name.
2. Ripple returns the Package and only the exact Versions connected by `HAS_VERSION`.
3. The caller selects one returned `Version.id`.
4. Any dependency data is then loaded for that exact Version, never for the Package as a whole.

The version selector is an indexed-version selector, not a complete npm version history.

### 3. Downstream Impact

1. The caller selects one exact target `Version.id`.
2. Ripple verifies that the Version is indexed.
3. Ripple follows incoming `DEPENDS_ON` relationships from that exact target to find exact source Versions that can reach it.
4. Results contain exact Version IDs, hop counts, and enough path information to explain inclusion.
5. Traversal is bounded by a server-controlled maximum; a caller cannot request an unbounded graph expansion.

Ripple must not first find the target's Package and then traverse from every version of that Package.

### 4. Explainable dependency path

1. The caller supplies exact `fromVersionId` and `toVersionId` values.
2. Ripple verifies both exact Versions are indexed.
3. Ripple finds a directed dependency path from the source Version to the target Version within the configured traversal bound.
4. The response returns the ordered Version nodes and ordered relationships.
5. Each relationship includes its `requirement`, allowing the caller to explain every hop.

If both Versions exist but no qualifying path exists, that is a successful empty result rather than a missing-resource error.

## Exact-version semantics

All P0 traversal inputs and outputs use exact `Version.id` values such as `app-a@1.0.0`. A semver range is valid only as the `requirement` metadata on a `DEPENDS_ON` relationship; it is never a traversal start or destination.

The following sequence is required for traversal operations:

1. Match the starting Version directly by its unique `Version.id`.
2. Match a destination directly by its unique `Version.id` when the operation has one.
3. Traverse `DEPENDS_ON` only between Version nodes.
4. Preserve the direction of dependency edges.
5. Return exact Version IDs and relationship requirements in path order.

The following sequence is forbidden for exact-version questions:

1. Match a Package.
2. Expand every `HAS_VERSION` relationship.
3. Treat the combined dependency edges of those Versions as the answer.

That forbidden approach mixes releases and can create dependencies and paths that no single published version has.

## API boundaries

The P0 API is read-only. Every response uses a stable `{ data, meta }` envelope.

| Boundary | Purpose | Primary input | Result |
| --- | --- | --- | --- |
| `GET /api/packages?query=` | Search Package identity | Package-name text | Indexed Package summaries |
| `GET /api/packages/{name}` | Package detail | URL-encoded canonical Package name | Package plus indexed exact versions |
| `GET /api/versions/{id}` | Exact-version detail | URL-encoded `Version.id` | Exact Version and its direct dependency edges |
| `GET /api/versions/{id}/impact` | Downstream impact | Exact `Version.id`; optional bounded depth | Exact impacted Versions and explanatory paths |
| `GET /api/versions/{id}/path?target={targetId}` | Explain dependency path | Two exact Version IDs | Ordered nodes and relationships, or an empty path |
| `GET /api/dataset` | Dataset transparency | None | Live Package, Version, and `DEPENDS_ON` totals |

Scoped package names and Version IDs must be URL-encoded as path or query values. Inputs are validated at the transport boundary. The API returns application DTOs composed of strings, numbers, arrays, and objects; Neo4j driver `Node`, `Relationship`, `Path`, and integer objects must not cross the API boundary.

Every response that could be interpreted as ecosystem-wide must include either the full dataset-scope wording or the short indexed-snapshot qualifier.

No public mutation or ingestion API is part of P0.

## Repository and service architecture

Implementation should keep transport, product semantics, graph access, and ingestion separate.

```text
Request
    |
    v
API transport / input validation
    |
    v
P0 service (exact-version rules, bounds, DTO mapping)
    |
    v
Graph repository (Cypher and Neo4j value conversion)
    |
    v
CognoDB via neo4j-driver

Separate ingestion pipeline
    |
    +--> deps.dev acquisition and validation
    +--> root-origin edge extraction
    +--> idempotent graph writes
```

### Transport layer

Next.js route handlers are thin adapters. They validate and decode input, call one service operation, map known errors to HTTP responses, and serialize DTOs. They do not contain Cypher or dependency semantics.

### Service layer

Services own use-case semantics:

- exact-Version requirements;
- traversal direction and server-controlled bounds;
- distinction between a missing resource and an empty result;
- dataset-scope metadata;
- composition of repository results into stable response DTOs.

Services must not expose Neo4j-specific values to callers.

### Repository layer

The graph repository is the only application layer that contains Cypher or imports `neo4j-driver`. Its P0 responsibilities are:

- search Package nodes by name;
- retrieve a Package and its indexed Versions;
- retrieve one Version by exact ID;
- retrieve the direct dependencies of one exact Version;
- perform bounded reverse traversal from one exact Version;
- find a bounded directed path between two exact Versions;
- convert Neo4j records and integer values into plain application values.

Repository methods accept already validated exact identifiers. Each operation owns and closes its session. The server-side driver is long-lived and shared across operations, then closed once during process shutdown rather than once per query.

### Ingestion boundary

Ingestion is a separate workflow, not an API request side effect. For each indexed exact Version, it obtains that Version's own deps.dev resolved graph and retains only edges that originate at that graph's root. Those root-origin edges become the source Version's outgoing `DEPENDS_ON` relationships.

The ingestion workflow must validate records before writing, use deterministic identities, and be safe to retry without creating duplicate logical nodes or edges. Dataset selection is explicit and bounded; ingestion must not recursively attempt to mirror all of npm.

### Configuration boundary

CognoDB connection values remain server-only environment variables:

- `COGNODB_URI`
- `COGNODB_USER`
- `COGNODB_PASSWORD`

They must never use a `NEXT_PUBLIC_` prefix or be returned by an API.

## Error states

| Condition | API behavior | Meaning presented to the caller |
| --- | --- | --- |
| Missing or malformed query/input | `400` with `INVALID_INPUT` | The request could not be evaluated. |
| A traversal input is a range rather than an exact Version ID | `400` with `EXACT_VERSION_REQUIRED` | Select an exact indexed version. |
| Requested traversal depth exceeds the server limit | `400` with `TRAVERSAL_LIMIT_EXCEEDED` | Narrow the requested traversal. |
| Package is absent | `404` with `PACKAGE_NOT_INDEXED` | The package is not in Ripple's indexed snapshot. |
| Exact Version is absent | `404` with `VERSION_NOT_INDEXED` | The exact version is not in Ripple's indexed snapshot. |
| Both path endpoints exist but no path connects them | `200` with `path: null` | No path was found within Ripple's indexed snapshot and traversal bound. |
| Downstream traversal finds no versions | `200` with an empty result | No downstream impact was found within the indexed snapshot and traversal bound. |
| CognoDB is unavailable or times out | `503` with `DATABASE_UNAVAILABLE` | The graph service is temporarily unavailable. |
| Unexpected repository/query failure | `500` with `INTERNAL_ERROR` | The request failed without exposing credentials, Cypher, or database internals. |

Logs may include an internal correlation ID and sanitized operational context. They must not include CognoDB credentials.

## H0 validation

The H0 technical spike passed against the real CognoDB c0 instance. It verified:

- parameterized exact Version lookup;
- unique constraints for `Package.name` and `Version.id`;
- variable-length `DEPENDS_ON` traversal;
- reverse traversal to find exact Versions that can reach a target Version;
- `shortestPath()` between exact Versions;
- `nodes(path)` extraction;
- `relationships(path)` extraction, including each relationship's `requirement`.

`PROFILE` was invoked during the spike, but the returned plan did not expose meaningful database-hit detail. H0 therefore establishes query compatibility only. It does not establish latency, throughput, index utilization, database-hit counts, scaling behavior, or any other performance claim.

H0 data is temporary. The spike uses namespaced identities plus the `RippleGraphSpike` label and `spikeId: "ripple-graph-spike-v1"`, then removes those entities in a `finally` block. `npm run graph:cleanup-spike` is the dedicated recovery command for historical H0 residue; it previews the exact scope and preserves all `rippleDataset: "ripple-p0"` entities.

## Intentionally out of scope

The following are not part of this design phase or P0 implementation scope:

- features beyond the completed P0 vertical slices;
- automated ingestion scheduling or operational orchestration;
- crawling or mirroring the whole npm ecosystem;
- treating Ripple results as complete npm ecosystem results;
- Package-level `DEPENDS_ON` relationships;
- traversal that substitutes every Version of a Package for one exact Version;
- dependency mutation through public APIs;
- vulnerability, license, popularity, or package-quality analysis;
- authentication, authorization, tenancy, and billing;
- live npm synchronization or change-data capture;
- caching and performance targets not supported by measurements;
- performance conclusions from the H0 `PROFILE` output;
- Version Divergence implementation beyond identifying it as the first P1 feature;
- graph entities or relationships beyond the frozen Package, Version, `HAS_VERSION`, and `DEPENDS_ON` model.
