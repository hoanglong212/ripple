# Ripple graph model

Status: frozen for P0 design. Changes to this model require an explicit design review before ingestion or product implementation proceeds.

## Canonical model

```cypher
(:Package)-[:HAS_VERSION]->(:Version)-[:DEPENDS_ON { requirement }]->(:Version)
```

`Package` is the identity and search layer. `Version` is the dependency-truth layer. Dependency questions are always evaluated between exact versions.

## Nodes

### Package

A `Package` represents one canonical npm package identity.

Required properties:

| Property | Type | Meaning |
| --- | --- | --- |
| `name` | string | Canonical npm package name, including its scope when applicable. |

Constraint:

```cypher
CREATE CONSTRAINT package_name_unique IF NOT EXISTS
FOR (package:Package)
REQUIRE package.name IS UNIQUE
```

`Package.name` is used for package search and for locating the set of versions that Ripple has indexed. A Package node does not carry dependency truth.

### Version

A `Version` represents one exact published version of one npm package.

Required properties:

| Property | Type | Meaning |
| --- | --- | --- |
| `id` | string | Globally unique exact-version ID in the form `<package-name>@<version>`, for example `express@5.1.0`. |
| `version` | string | Exact npm version, for example `5.1.0`; never a range. |

Constraint:

```cypher
CREATE CONSTRAINT version_id_unique IF NOT EXISTS
FOR (version:Version)
REQUIRE version.id IS UNIQUE
```

The owning package name is available through the incoming `HAS_VERSION` relationship. An ingestion implementation may carry a denormalized `packageName` property for operational convenience, but `HAS_VERSION` remains the authoritative ownership link and the value must agree with the Package name.

## Relationships

### HAS_VERSION

```cypher
(package:Package)-[:HAS_VERSION]->(version:Version)
```

`HAS_VERSION` connects a searchable package identity to an exact version that is present in Ripple's indexed snapshot. It does not mean that every version ever published to npm is present.

`HAS_VERSION` has no required properties.

### DEPENDS_ON

```cypher
(source:Version)-[:DEPENDS_ON { requirement: "^4.4.1" }]->(target:Version)
```

`DEPENDS_ON` records that one exact source version has a root-origin dependency edge whose resolved target is one exact Version node.

Required properties:

| Property | Type | Meaning |
| --- | --- | --- |
| `requirement` | string | The dependency requirement attached to the source version's root-origin edge, such as `^4.4.1`. |

For later ingestion, these relationships must come only from the root-origin dependency edges of each version's own deps.dev resolved graph. Ripple must not copy every transitive edge returned for a root and attach those edges directly to that root. Transitive reachability is derived by traversing the direct, root-origin edges contributed independently by each indexed Version.

## Invariants

1. `Package.name` is unique.
2. `Version.id` is unique and identifies one exact package version.
3. Every indexed Version has exactly one incoming `HAS_VERSION` relationship from its owning Package.
4. A Version's exact package and version identity must agree with its owning Package and its `id`.
5. `DEPENDS_ON` may connect only `Version` nodes; it never starts from or ends at a `Package` node.
6. Every `DEPENDS_ON` relationship has a non-empty `requirement` property.
7. Every `DEPENDS_ON` edge is a root-origin edge from the source version's own deps.dev resolved graph.
8. Ingestion is idempotent for the same source Version and dependency edge; rerunning ingestion must not create duplicate logical edges.
9. P0 traversal starts from exact `Version.id` values and returns exact Version IDs.
10. An exact-version question must never be answered by expanding all versions connected to a Package.
11. A missing Package or Version means “not indexed in Ripple,” not “does not exist in npm.”
12. Ripple contains a curated, bounded npm snapshot; completeness beyond the indexed snapshot is never implied.

## Why Package and Version are separate

Package identity and dependency truth change at different rates and answer different questions.

The Package layer provides a stable search target for a name such as `express`. It groups the exact versions Ripple chose to index and supports a version selector without duplicating the package identity on every search result.

The Version layer captures facts that vary by release. `express@4.21.2` and `express@5.1.0` can resolve different dependencies, requirements, and paths. Storing those edges on exact Version nodes preserves that distinction and makes traversal results explainable.

This separation also makes the dataset boundary visible: a Package can exist in Ripple while only a subset of its versions is connected through `HAS_VERSION`.

## Why Package-level DEPENDS_ON would be incorrect

A relationship such as the following is forbidden:

```cypher
(:Package { name: "app-a" })-[:DEPENDS_ON]->(:Package { name: "express" })
```

It loses both sides of the exact dependency fact:

- It does not identify which version of `app-a` declared the dependency.
- It does not identify which exact version of `express` was resolved.
- It cannot accurately retain a requirement that may differ between source versions.
- It combines dependency edges from unrelated releases and creates false reachability.
- It could make an impact or path result appear valid for every version of a package when it is valid for only one.

Package-level edges are therefore unsuitable for P0 downstream-impact and path questions.

## ASCII graph diagram

```text
Curated Ripple snapshot

(:Package {name: "app-a"})
        |
        | :HAS_VERSION
        v
(:Version {id: "app-a@1.0.0"})
        |
        | :DEPENDS_ON {requirement: "^5.1.0"}
        v
(:Version {id: "express@5.1.0"}) <---[:HAS_VERSION]--- (:Package {name: "express"})
        |
        | :DEPENDS_ON {requirement: "^4.4.1"}
        v
(:Version {id: "debug@4.4.1"})   <---[:HAS_VERSION]--- (:Package {name: "debug"})

(:Package {name: "app-b"})
        |
        | :HAS_VERSION
        v
(:Version {id: "app-b@2.0.0"})
        |
        | :DEPENDS_ON {requirement: "^3.0.0"}
        v
(:Version {id: "koa@3.0.0"})     <---[:HAS_VERSION]--- (:Package {name: "koa"})
        |
        | :DEPENDS_ON {requirement: "^4.4.1"}
        +-------------------------------------------> (:Version {id: "debug@4.4.1"})
```

Only versions explicitly indexed in the curated snapshot appear in this graph.
