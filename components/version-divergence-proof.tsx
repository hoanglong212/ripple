import Link from "next/link";

// Static, verified against the indexed snapshot. This section is an argument,
// not a query: it must render identically even when CognoDB is unreachable.
const COMPARISON = {
  left: {
    versionId: "ajv@6.15.0",
    dependencies: [
      { name: "fast-deep-equal@3.1.3", requirement: "^3.1.1", tone: "shared" },
      {
        name: "fast-json-stable-stringify@2.1.0",
        requirement: "^2.0.0",
        tone: "unique",
      },
      {
        name: "json-schema-traverse@0.4.1",
        requirement: "^0.4.1",
        tone: "diverged",
      },
      { name: "uri-js@4.4.1", requirement: "^4.2.2", tone: "unique" },
    ],
  },
  right: {
    versionId: "ajv@8.20.0",
    dependencies: [
      { name: "fast-deep-equal@3.1.3", requirement: "^3.1.3", tone: "shared" },
      { name: "fast-uri@3.1.6", requirement: "^3.0.1", tone: "unique" },
      {
        name: "json-schema-traverse@1.0.0",
        requirement: "^1.0.0",
        tone: "diverged",
      },
      {
        name: "require-from-string@2.0.2",
        requirement: "^2.0.2",
        tone: "unique",
      },
    ],
  },
} as const;

type Tone = "shared" | "unique" | "diverged";

const TONE_STYLES: Record<Tone, string> = {
  diverged: "border-amber-300 bg-amber-50",
  shared: "border-slate-200 bg-white",
  unique: "border-slate-200 bg-white",
};

function DependencyColumn({
  side,
}: {
  side: (typeof COMPARISON)["left" | "right"];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <code className="block break-all font-mono text-sm font-semibold text-slate-950">
        {side.versionId}
      </code>
      <p className="mt-1 text-xs text-slate-500">4 direct dependencies</p>
      <ul className="mt-4 space-y-2">
        {side.dependencies.map((dependency) => (
          <li
            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
              TONE_STYLES[dependency.tone]
            }`}
            key={dependency.name}
          >
            <code className="min-w-0 break-all font-mono text-xs font-medium text-slate-800">
              {dependency.name}
            </code>
            <code className="shrink-0 font-mono text-[0.68rem] text-slate-500">
              {dependency.requirement}
            </code>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VersionDivergenceProof() {
  return (
    <section
      aria-labelledby="divergence-heading"
      className="scroll-mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8"
      id="version-divergence"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
            Why the package name is not enough
          </p>
          <h2
            className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl"
            id="divergence-heading"
          >
            Same package. Different dependency truth.
          </h2>
        </div>
        <Link
          className="w-fit rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-950 hover:bg-slate-950 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
          href="/packages/ajv"
        >
          Open this in Ripple →
        </Link>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <DependencyColumn side={COMPARISON.left} />
        <DependencyColumn side={COMPARISON.right} />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
        <p className="text-base leading-7 text-slate-700">
          Three of four dependencies differ.{" "}
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 font-mono text-sm font-semibold text-amber-900">
            json-schema-traverse
          </span>{" "}
          resolves to a different exact version of the same package, and even
          the one shared dependency carries a different declared requirement.
        </p>
        <p className="mt-4 text-base leading-7 text-slate-700">
          A graph that stores dependencies on the{" "}
          <span className="font-mono text-sm font-semibold text-slate-950">
            Package
          </span>{" "}
          node has to merge these two lists. It then claims AJV depends on
          json-schema-traverse 0.4.1 <em>and</em> 1.0.0 at the same time, and on
          both uri-js <em>and</em> fast-uri. No published release ever did.
          Every impact result built on that node is answering a question about a
          package that never shipped.
        </p>
      </div>
    </section>
  );
}
