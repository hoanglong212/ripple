# Ripple

> Dependency answers that are true for one exact version — not averaged across a package.

Ripple is a focused npm dependency explorer. It helps developers inspect what one published version depends on, see which indexed versions are affected by it, and explain the exact chain connecting two versions.

## Problem

Dependency questions are easy to phrase at the package level and easy to answer incorrectly there. A package can have many releases, and each release can resolve to a different graph. Combining those releases can invent dependencies or paths that were never true at the same time.

Ripple keeps every traversal anchored to an exact Version ID such as `ajv@8.20.0`. Package names are used for discovery; exact versions are used for dependency truth.

## Why Package and Version are separate

`Package` is the stable identity and search layer. `Version` represents one indexed release and owns the dependency edges resolved for that release.

This separation means:

- searching for `ajv` can return one Package identity;
- the version selector shows only releases indexed by Ripple;
- selecting `ajv@6.15.0` never traverses edges belonging to `ajv@8.20.0`;
- a semver range remains evidence on a dependency relationship, not a traversal starting point.

Putting `DEPENDS_ON` on Package nodes would erase release-specific truth and could produce misleading impact results or impossible paths.

## Features

### Dependency Explorer

Search the curated Package index, select an indexed exact version, and inspect its resolved direct dependencies with the declared requirement for every edge.

### Downstream Impact

Start from one exact version and follow incoming dependency relationships to find indexed versions that can reach it. Results distinguish direct from transitive impact and include hop counts.

### Explain Path

Choose exact source and target versions and read the shortest directed dependency chain between them. Ripple shows every Version ID, the hop count, and the requirement carried by each `DEPENDS_ON` relationship.

## Worked examples

### `ajv@6.15.0` vs `ajv@8.20.0`

The two indexed AJV releases each have four direct dependencies, but their dependency truth differs:

- `ajv@6.15.0` resolves `json-schema-traverse@0.4.1`, `uri-js@4.4.1`, and `fast-json-stable-stringify@2.1.0`.
- `ajv@8.20.0` resolves `json-schema-traverse@1.0.0`, `fast-uri@3.1.6`, and `require-from-string@2.0.2`.
- Both resolve `fast-deep-equal@3.1.3`, with different declared requirements.

This is why Ripple asks for an exact version before answering a dependency question.

### `@hapi/hoek` impact

Within the current snapshot, `@hapi/hoek@11.0.7` is reachable from 24 indexed versions: 22 direct dependents and two transitive dependents, with a maximum observed depth of two. The result describes only the graph Ripple has indexed; it is not an ecosystem-wide blast radius.

### Babel → picocolors

Ripple explains this verified four-hop path:

```text
@babel/core@8.0.1
  --(^8.0.0)--> @babel/helper-compilation-targets@8.0.0
  --(^4.24.0)--> browserslist@4.28.8
  --(^1.3.0)--> update-browserslist-db@1.3.1
  --(^1.1.1)--> picocolors@1.1.1
```

Each label in parentheses is the requirement stored on that edge.

## Graph model

```cypher
(:Package)-[:HAS_VERSION]->(:Version)-[:DEPENDS_ON { requirement }]->(:Version)
```

Core invariants:

- `Package.name` is unique.
- `Version.id` is unique and identifies an exact release.
- every Version has exactly one owning Package;
- `DEPENDS_ON` connects Version nodes only;
- every dependency edge has a non-empty `requirement`;
- exact-version questions never expand every Version belonging to a Package.

The full rationale is documented in [docs/graph-model.md](docs/graph-model.md).

## Dataset and limitations

The deterministic snapshot currently contains:

- **426 packages**
- **449 versions**
- **636 `DEPENDS_ON` relationships**

**Within Ripple's indexed npm snapshot.**

Ripple represents a curated, bounded npm snapshot—not the complete npm ecosystem. Traversal depth is server-controlled, so impact and path analysis are deliberately bounded. A missing dependency or path means it was not found within Ripple's indexed data and traversal limit; it is not a claim about all of npm.

## Architecture

```text
Next.js Route Handler
  → service layer
  → graph repository
  → neo4j-driver
  → CognoDB
```

- Route Handlers validate transport input with Zod and contain no Cypher.
- Services own exact-version semantics, traversal bounds, and resource errors.
- The graph repository is the only application layer containing Cypher and maps Neo4j values to plain DTOs.
- A shared server-side driver singleton manages CognoDB connectivity.
- The ingestion and database scripts remain separate from web requests.

The read-only API covers package search/detail, exact-version detail, downstream impact, Explain Path, and live dataset totals. See [docs/technical-design.md](docs/technical-design.md) for the frozen P0 boundaries.

## Ingestion correctness

deps.dev is the only external source used for the P0 snapshot. Ripple acquires the resolved graph for each exact source version and applies one critical rule before producing canonical edges:

> Keep an edge only when its `fromNode` is the root node of that source version's own deps.dev graph.

Transitive edges present elsewhere in that response are not copied into the source Version. Their source versions are acquired separately during bounded recursive discovery, so each Version earns its own outgoing edges from its own resolved graph. Bundled nodes are filtered, exact versions are deduplicated, malformed graphs are rejected, and the final artifact is validated before database seeding.

## Setup

Requirements:

- Node.js 20 or newer
- npm
- access to a CognoDB instance

Install dependencies and create local configuration:

```bash
npm install
cp .env.example .env.local
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead.

Set the server-only CognoDB values in `.env.local`:

```dotenv
COGNODB_URI=
COGNODB_USER=
COGNODB_PASSWORD=
```

Seed and verify the deterministic snapshot, then start Ripple:

```bash
npm run graph:seed
npm run graph:verify
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Before submitting changes, run:

```bash
npm run lint
npm run test
npm run build
npm run graph:verify
```
