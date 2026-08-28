# Ripple

[![CI](https://github.com/hoanglong212/ripple/actions/workflows/ci.yml/badge.svg)](https://github.com/hoanglong212/ripple/actions/workflows/ci.yml)

**Exact-version npm dependency impact tracer.**

Dependency answers that are true for one exact version — not averaged across a package.
Ripple attaches every dependency edge to an exact published release, then answers what that
release depends on, which releases depend on it, and why two releases are connected —
carrying the semver requirement declared at every hop.

- **Live demo:** [ripple-five-kappa.vercel.app](https://ripple-five-kappa.vercel.app)
- **Demo video:** [two-minute walkthrough](https://drive.google.com/file/d/1yWPaLehMCc3DaE4BlIhZvqbc1jvlBFpq/view?usp=sharing) — switching one release changes every answer on the page.

![Ripple homepage proving why exact versions matter](docs/images/01-hero.png)

## The problem

Ask "what does `ajv` depend on?" and most tools answer for the *package*. There is no such
answer.

| `ajv@6.15.0` | `ajv@8.20.0` |
| --- | --- |
| `fast-deep-equal@3.1.3` — `^3.1.1` | `fast-deep-equal@3.1.3` — `^3.1.3` |
| `fast-json-stable-stringify@2.1.0` — `^2.0.0` | `fast-uri@3.1.6` — `^3.0.1` |
| **`json-schema-traverse@0.4.1`** — `^0.4.1` | **`json-schema-traverse@1.0.0`** — `^1.0.0` |
| `uri-js@4.4.1` — `^4.2.2` | `require-from-string@2.0.2` — `^2.0.2` |

Three of four dependencies differ. `json-schema-traverse` resolves to a *different exact
version of the same package*, and even the shared dependency carries a different declared
requirement.

Store dependencies on a `Package` node and these two lists have to merge. The merged node
then claims AJV depends on `json-schema-traverse` 0.4.1 **and** 1.0.0 at once, and on both
`uri-js` **and** `fast-uri`. No published release ever did. Every impact result built on
that node answers a question about a package that never shipped.

Switching releases in Ripple changes the downstream answer too: `ajv@8.20.0` is reachable
from 9 indexed versions, `ajv@6.15.0` from 1. A package-level graph reports one number for
both.

## Data model

```cypher
(:Package)-[:HAS_VERSION]->(:Version)-[:DEPENDS_ON { requirement }]->(:Version)
```

Two labelled node types and two typed relationships. The same AJV case from above, drawn as
the graph actually stores it:

```mermaid
graph LR
  P(["Package<br/>name: ajv"])
  V6(["Version<br/>id: ajv@6.15.0"])
  V8(["Version<br/>id: ajv@8.20.0"])
  T4(["Version<br/>id: json-schema-traverse@0.4.1"])
  T1(["Version<br/>id: json-schema-traverse@1.0.0"])

  P -- HAS_VERSION --> V6
  P -- HAS_VERSION --> V8
  V6 -- "DEPENDS_ON<br/>requirement: ^0.4.1" --> T4
  V8 -- "DEPENDS_ON<br/>requirement: ^1.0.0" --> T1
```

| Element | Properties | Purpose |
| --- | --- | --- |
| `(:Package)` | `name` (unique) | Identity and search. Carries no dependency data. |
| `(:Version)` | `id` (unique, `name@version`), `version`, `packageName` | One exact published release. |
| `[:HAS_VERSION]` | — | Ownership. Exactly one Package per Version. |
| `[:DEPENDS_ON]` | `requirement` (non-empty) | One resolved dependency edge between two exact releases, carrying the semver range that was declared for it. |

Both `ajv` releases hang off one `Package` node, but their `DEPENDS_ON` edges never touch it.
That is the whole design: `Package` answers "what is this", `Version` answers "what does this
depend on".

`Package` is the identity and search layer. You type `ajv`, not `ajv@8.20.0`. It carries no
dependency data.

`Version` is the truth layer. Every dependency edge connects two exact releases and carries
the requirement declared for that edge. Traversal starts and ends at exact `Version.id`
values, so a result can never blend two releases.

The graph holds **0** package-level dependency edges, and `npm run graph:verify` asserts
that against the live database on every run.

## Why a graph database?

Every question Ripple answers is variable-length reachability over the same edge type. Not
"join these two tables" but "walk `DEPENDS_ON` backwards from this release until you run out
of edges or hit the depth bound, and tell me the shortest route to each release you found".

In Cypher that is the whole query — shown here without the dataset-scoping filters that the
real one in [`graph-repository.ts`](lib/repositories/graph-repository.ts) also carries:

```cypher
MATCH path = (affected:Version)-[:DEPENDS_ON*1..4]->(target:Version)
WHERE target.id = $versionId
WITH affected, path ORDER BY length(path)
WITH affected, collect(path)[0] AS shortestPath
RETURN affected.id, length(shortestPath) AS hopCount
```

The relational equivalent is a recursive CTE. This one is PostgreSQL — it leans on `ARRAY`
and `DISTINCT ON`, and a portable version would be longer still:

```sql
WITH RECURSIVE reachable(affected_id, target_id, depth, visited) AS (
  SELECT source_id, target_id, 1, ARRAY[source_id, target_id]
    FROM depends_on WHERE target_id = $1
  UNION ALL
  SELECT d.source_id, r.target_id, r.depth + 1, r.visited || d.source_id
    FROM depends_on d JOIN reachable r ON d.target_id = r.affected_id
   WHERE r.depth < 4                       -- depth bound lives in the query text
     AND NOT d.source_id = ANY(r.visited)  -- cycle guard written by hand
)
SELECT DISTINCT ON (affected_id) affected_id, depth
  FROM reachable ORDER BY affected_id, depth;  -- shortest-per-target, also by hand
```

Three things the graph gives us that the CTE makes us build:

1. **Cycle safety is the engine's job.** npm dependency graphs contain cycles. Cypher's
   variable-length match will not revisit a relationship within a path; in SQL we carry a
   `visited` array and filter against it on every recursion step.
2. **Shortest-path-per-target is a primitive.** `shortestPath()` and `collect(path)[0]` after
   an `ORDER BY length(path)` replace a `DISTINCT ON` over every path we generated.
3. **The traversal reads like the question.** `-[:DEPENDS_ON*1..4]->` is the sentence "up to
   four dependency hops". Explain Path is one `shortestPath()` call and returns the
   relationships themselves, so the `requirement` on every hop comes back with the path
   instead of needing a second pass to re-fetch the edges.

**The honest limit of this argument.** At the current snapshot — 875 nodes and 1,085
relationships — Postgres would serve these queries perfectly well, and the CTE above works.
The case for a graph database here is the shape of the query and the fact that the model
reads the way the domain does, not present-day performance. The gap widens with depth and
breadth: each extra hop is one character in Cypher and another `JOIN` boundary plus a longer
`visited` array in SQL.

## What it does

Names below match the shipped interface. The homepage lists them as capabilities; the
package page renders each one as a section.

- **Package Search** — *Look up any public npm package.* Finds any public npm package and
  marks whether Ripple has indexed it (`indexed`, `not-indexed`, or `unavailable`).
- **Dependency Explorer** — the **Dependencies** section on a package page. What this exact
  release depends on, showing the declared range and the exact version it resolved to.
- **Downstream Impact** — the **Downstream impact** section. Which indexed releases can
  reach this one, direct and transitive, and how many hops away.
- **Explain Path** — the **Why are these versions connected?** section. The shortest
  directed chain between two exact releases, requirement by requirement.

Selecting a different release re-answers all three questions for that release.

![Exact-version selector and release summary for ajv](docs/images/02-ajv-versions.png)

## See it work

### Downstream impact

`@hapi/hoek@11.0.7` is reachable from **24** indexed versions — 22 direct dependents and 2
transitive, with a maximum observed depth of 2. The result describes only the graph Ripple
has indexed; it is not an ecosystem-wide blast radius.

![Downstream impact for @hapi/hoek@11.0.7](docs/images/03-hoek-impact.png)

### Explain Path

`npm run graph:verify` asserts this four-hop path against the live database:

```text
@babel/core@8.0.1
  --(^8.0.0)--> @babel/helper-compilation-targets@8.0.0
  --(^4.24.0)--> browserslist@4.28.8
  --(^1.3.0)--> update-browserslist-db@1.3.1
  --(^1.1.1)--> picocolors@1.1.1
```

Each label in parentheses is the `requirement` property stored on that edge.

![Four-hop explained path from @babel/core@8.0.1 to picocolors@1.1.1](docs/images/04-explain-path.png)

## Dataset and limitations

The deterministic snapshot was resolved from 25 curated root packages at a discovery depth
of 4, and currently contains:

- **426** packages
- **449** exact versions
- **449** `HAS_VERSION` relationships
- **636** `DEPENDS_ON` relationships

**Within Ripple's indexed npm snapshot.** This is a curated, bounded dataset — not the
complete npm ecosystem.

Known gaps in the current snapshot, recorded in `scripts/data/ripple-snapshot.json`:

- **21** deps.dev graphs were rejected during ingestion and contributed no edges.
- **17** discovered versions were left unexpanded at the depth bound.
- The graph has **13** weakly connected components; the largest holds 85.3% of versions.

Every impact and path result is therefore a **lower bound**. Traversal depth is
server-controlled, so a caller cannot request an unbounded expansion. A missing dependency
or path means it was not found within Ripple's indexed data and traversal limit; it is not
a claim about all of npm.

## Model invariants

The [data model](#data-model) above is enforced, not just described:

- `Package.name` is unique.
- `Version.id` is unique and identifies one exact release.
- Every Version has exactly one owning Package.
- `DEPENDS_ON` connects Version nodes only.
- Every dependency edge has a non-empty `requirement`.
- Exact-version questions never expand every Version belonging to a Package.

The full rationale is documented in [docs/graph-model.md](docs/graph-model.md).

## Query parameterisation

Every value that originates outside the process — package names, version IDs, search terms,
traversal targets, result limits — is passed as a driver parameter. No user input is ever
concatenated into Cypher.

There is exactly one interpolated value in the codebase, and it is the traversal depth:

```ts
// lib/repositories/graph-repository.ts
-[dependencies:DEPENDS_ON*1..${maxDepth}]->(target)
```

**Cypher does not accept a parameter in a variable-length bound.** `*1..$maxDepth` is a
syntax error; the bounds must be literals in the query text. The alternatives are writing one
query per depth, or building the bound in the host language. Ripple does the latter, under
three constraints:

1. **The value is never user-supplied.** It comes from a private constant on the service —
   `MAX_DOWNSTREAM_DEPTH = 4`, `MAX_EXPLAIN_PATH_DEPTH = 5`. No route handler, query string,
   or request body can influence it, so a caller cannot request an unbounded expansion.
2. **It is validated as an integer inside a fixed range before it reaches the template.**
   `Number.isSafeInteger(maxDepth)` plus an explicit range check; anything else throws before
   a query string exists.
3. **It is the only interpolation.** Every other value in those same queries — `$versionId`,
   `$datasetId`, `$sourceVersionId`, `$targetVersionId`, `$limit` — is a parameter.

The result is that the query text is fully determined by two compile-time constants, and the
only thing that varies per request travels as a parameter.

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
- The graph repository is the only application layer containing Cypher, and maps Neo4j
  values to plain DTOs.
- A shared server-side driver instance is reused across requests.
- Ingestion and database scripts are separate from web requests.

The repository is consumed through an interface, so services are tested against an
in-memory fake with no database.

See [docs/technical-design.md](docs/technical-design.md) for the frozen P0 boundaries.

## Two sources, one boundary

Ripple reads from two places, and they answer different questions:

| Source | Answers | Scope |
| --- | --- | --- |
| CognoDB graph | dependencies, downstream impact, paths | the 426-package indexed snapshot |
| npm registry | name, description, latest version, links | all public npm packages |

The registry was added because search over a 426-package snapshot returns nothing for almost
every real query — typing `react` produced an empty result and read as a broken product, not
as a bounded one. The catalog makes the boundary visible instead of invisible: every package
carries a `graphStatus` of `indexed`, `not-indexed`, or `unavailable`, and a package outside
the snapshot gets a page that says so and explains what Ripple cannot answer for it.

**What this does not change.** The registry never contributes a dependency edge, a hop count,
or a path. Every graph answer still comes only from exact versions in the snapshot. The
registry supplies identity and description; the graph supplies dependency truth. They are
merged for display and never for traversal.

Both calls run concurrently and fail independently: a dead registry degrades to graph-only
results, a dead CognoDB degrades to catalog-only results with `graphStatus: "unavailable"`,
and only a double failure surfaces an error. All four combinations are covered by tests.

## Measured latency

The H0 spike established query compatibility, not performance. A production smoke-test run
on 28 August 2026 measured these end-to-end response times against the public Vercel alias:

| Request | Observed response time |
| --- | ---: |
| Homepage | 1,076 ms |
| AJV package page | 969 ms |
| Dataset API | 1,035 ms |
| `ajv@8.20.0` Version API | 659 ms |
| `@hapi/hoek@11.0.7` impact API | 450 ms |
| Four-hop Babel → picocolors path API | 661 ms |

These are single-request observations from one client, not a load test, percentile, or SLA.
They include internet transit, Vercel execution, and the hosted CognoDB round-trip, and will
vary with region and cold starts. Most graph reads use one query; Explain Path validates
both endpoints in parallel before its bounded traversal, so it uses two query phases. No
result performs a query per returned row.

## Ingestion correctness

deps.dev is the only external source used for the P0 snapshot. Ripple acquires the resolved
graph for each exact source version and applies one rule before producing canonical edges:

> Keep an edge only when its `fromNode` is the root node of that source version's own
> deps.dev graph.

Transitive edges present elsewhere in that response are not copied onto the source Version.
Their source versions are acquired separately during bounded recursive discovery, so each
Version earns its own outgoing edges from its own resolved graph.

Without this rule every path would collapse to a single hop, hop counts would be
meaningless, and Explain Path would have nothing to explain.

Bundled nodes are filtered, exact versions are deduplicated, malformed graphs are rejected
(21 in the current build), and the artifact is validated before seeding.

## Read-only API

All success and error responses use the same top-level envelope:

```json
{ "data": {}, "meta": {} }
```

Routes:

- `GET /api/packages?query=ajv`
- `GET /api/packages/{name}`
- `GET /api/versions/{versionId}`
- `GET /api/versions/{versionId}/impact`
- `GET /api/versions/{sourceVersionId}/path?target={targetVersionId}`
- `GET /api/dataset`

Errors map to `400` (invalid input), `404` (not indexed), `503` (database unavailable), and
`500` (unexpected application failure). Responses contain plain JSON DTOs only; Neo4j driver
objects never cross the repository boundary.

## Setup

Requirements: Node.js 20.9 or newer, npm, and a CognoDB instance.

### 1. Create the CognoDB instance

1. Sign up at [console.cognodb.com](https://console.cognodb.com/signup). The free tier needs
   no credit card.
2. Create a free **c0** instance and pick a region. It provisions in under a minute. Each
   workspace gets one free instance.
3. Copy the connection details. The URI has the form
   `bolt+s://<instance-id>.databases.cognodb.cloud`, the username is `cognodb`, and the
   password is generated for you. **The password is shown exactly once** — copy or download
   it before leaving the page.

CognoDB speaks openCypher over Bolt and works with the official Neo4j drivers, so this
project uses `neo4j-driver` unmodified. The free c0 instance (0.5 vCPU, 256 MB RAM, 1 GB
disk) comfortably holds this snapshot — 875 nodes and 1,085 relationships.

### 2. Install and configure

```bash
npm install
cp .env.example .env.local
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead.

Set the server-only CognoDB values in `.env.local`. Never expose them through a
`NEXT_PUBLIC_*` variable.

```dotenv
COGNODB_URI=
COGNODB_USER=
COGNODB_PASSWORD=
```

### 3. Seed the graph and run

`graph:constraints` creates the uniqueness constraints, `graph:seed` loads the committed
snapshot, and `graph:verify` asserts the model invariants against the live instance —
including that the graph holds zero package-level dependency edges.

```bash
npm run graph:constraints
npm run graph:seed
npm run graph:verify
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm run graph:spike` runs the historical H0 compatibility check against a namespaced
identity space and cannot touch production nodes; `npm run graph:cleanup-spike` previews and
removes only spike residue. deps.dev responses are cached under `scripts/cache/` and ignored
by Git.

## Deployment

The web application is compatible with Vercel's Node.js runtime and does not require a
`vercel.json`. Add `COGNODB_URI`, `COGNODB_USER`, and `COGNODB_PASSWORD` as encrypted project
environment variables for Production and Preview. Do not prefix them with `NEXT_PUBLIC_`.

The hosted database must be reachable from Vercel, support the Bolt URI in `COGNODB_URI`,
and already contain the verified Ripple snapshot. Run constraints, seed, and verification
once from a trusted local or CI environment; do not seed during `npm run build` or from an
application request. The shared driver uses a five-connection pool and bounded connection,
acquisition, and retry timeouts for serverless instances.

## Testing

```bash
npm run lint
npm run test
npm run build
npm run graph:verify
```

`npm run test` runs 30 tests across four suites: exact-version service semantics, deps.dev
root-origin extraction and bundled-node filtering, HTTP error mapping, and Neo4j record
mapping.

Because two independent sources now back the catalog, the search path is tested for every
combination of them failing — graph only, catalog only, both, and neither — so a dead npm
registry degrades to graph results and a dead CognoDB degrades to catalog results rather than
failing the request.

Record mapping is the gnarliest code in the app — hand-unwrapping Neo4j `Node` and
`Relationship` properties, telling "not indexed" apart from "indexed with no results", and
deciding which driver faults mean the database is unavailable. A fake driver exercises all of
it without a database, including session cleanup when mapping throws.

Route handlers are not covered by dedicated HTTP integration tests. Service boundaries,
response mapping, and Neo4j record mapping are covered by the test suite; `graph:verify`
validates the database contract directly against the live graph.

## How this was built

AI tools were used throughout this project — scaffolding the Next.js application, iterating
on the user interface, and general implementation assistance. Commits are batched because
work was committed at the end of each session rather than continuously.

The following decisions are mine:

- **The Package / Version split.** Modelling `Package` as an identity layer carrying no
  dependency data, and `Version` as the only place dependency edges live, so that no result
  can merge two releases. See
  [Why Package and Version are separate](#why-package-and-version-are-separate).
- **The root-origin ingestion rule.** Keeping an edge only when its `fromNode` is the root
  node of that source version's own deps.dev graph. This came from debugging why every path
  was collapsing into a single hop. See [Ingestion correctness](#ingestion-correctness).
- **The two-source boundary.** Letting the npm registry supply identity and description
  while the graph stays the only source of dependency edges, hop counts, and paths — merged
  for display, never for traversal. See
  [Two sources, one boundary](#two-sources-one-boundary).
- **The dataset limitation decisions.** Keeping the snapshot bounded and deterministic, and
  publishing its gaps — rejected ingests, unexpanded versions, disconnected components —
  rather than presenting a partial crawl as an ecosystem-wide result. See
  [Dataset and limitations](#dataset-and-limitations).

## Scope

P0 is complete. Authentication, vulnerability and license analysis, maintainer data, AI
features, full-ecosystem crawling, and Package-level dependency edges are intentionally out
of scope.

Package descriptions **were** out of scope in the frozen P0 design and are now shipped — see
[Two sources, one boundary](#two-sources-one-boundary) for why that changed and what it does
not change. `docs/technical-design.md` records the amendment.

The first P1 feature is Version Divergence — a direct comparison between two exact versions
of one package, which the AJV case above is the argument for.

## License

Released under the [MIT License](LICENSE).
