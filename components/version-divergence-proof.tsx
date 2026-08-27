import Link from "next/link";

/*
 * Static and verified against the indexed snapshot. This proof renders even
 * when CognoDB is unavailable and never makes a data request.
 */
const RELEASES = {
  earlier: {
    label: "Earlier release",
    version: "ajv@6.15.0",
  },
  later: {
    label: "Later release",
    version: "ajv@8.20.0",
  },
} as const;

const SHARED_DEPENDENCY = {
  earlier: { name: "fast-deep-equal@3.1.3", requirement: "^3.1.1" },
  later: { name: "fast-deep-equal@3.1.3", requirement: "^3.1.3" },
} as const;

const CHANGED_DEPENDENCY = {
  earlier: { name: "json-schema-traverse@0.4.1", requirement: "^0.4.1" },
  later: { name: "json-schema-traverse@1.0.0", requirement: "^1.0.0" },
} as const;

const RELEASE_ONLY_DEPENDENCIES = {
  earlier: [
    { name: "fast-json-stable-stringify@2.1.0", requirement: "^2.0.0" },
    { name: "uri-js@4.4.1", requirement: "^4.2.2" },
  ],
  later: [
    { name: "fast-uri@3.1.6", requirement: "^3.0.1" },
    { name: "require-from-string@2.0.2", requirement: "^2.0.2" },
  ],
} as const;

type Dependency = {
  name: string;
  requirement: string;
};

function DirectionalConnector({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "changed" | "neutral";
}) {
  const isChanged = tone === "changed";

  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-2 py-1 text-center">
      <span
        className={`font-mono text-[0.62rem] uppercase tracking-[0.12em] ${
          isChanged ? "text-amber" : "text-mist-600"
        }`}
      >
        {label}
      </span>
      <svg
        aria-hidden="true"
        className={`h-5 w-20 rotate-90 sm:h-4 sm:w-full sm:rotate-0 ${
          isChanged ? "text-amber" : "text-mist-700"
        }`}
        fill="none"
        viewBox="0 0 144 16"
      >
        <path d="M1 8H137" stroke="currentColor" strokeDasharray={isChanged ? "3 4" : undefined} />
        <path d="m132 2 6 6-6 6" stroke="currentColor" />
      </svg>
    </div>
  );
}

function DependencyNode({
  dependency,
  releaseLabel,
  tone = "neutral",
}: {
  dependency: Dependency;
  releaseLabel: string;
  tone?: "changed" | "neutral";
}) {
  const isChanged = tone === "changed";

  return (
    <div
      className={`min-w-0 border px-4 py-3.5 sm:px-5 ${
        isChanged
          ? "border-amber/40 bg-amber/[0.06]"
          : "border-[var(--hairline)] bg-ink-900"
      }`}
    >
      <span className="mb-2 block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-mist-700 sm:hidden">
        {releaseLabel}
      </span>
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
        <code
          className={`min-w-0 break-all font-mono text-xs font-medium sm:text-[0.8rem] ${
            isChanged ? "text-amber" : "text-mist-200"
          }`}
        >
          {dependency.name}
        </code>
        <code className="shrink-0 font-mono text-[0.65rem] text-mist-600">
          {dependency.requirement}
        </code>
      </div>
    </div>
  );
}

function ComparisonRow({
  earlier,
  label,
  later,
  tone = "neutral",
}: {
  earlier: Dependency;
  label: string;
  later: Dependency;
  tone?: "changed" | "neutral";
}) {
  return (
    <li className="grid gap-3 border-b border-[var(--hairline)] px-4 py-5 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)] sm:items-center sm:px-6 lg:grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)]">
      <DependencyNode dependency={earlier} releaseLabel={RELEASES.earlier.label} tone={tone} />
      <DirectionalConnector label={label} tone={tone} />
      <DependencyNode dependency={later} releaseLabel={RELEASES.later.label} tone={tone} />
    </li>
  );
}

function ReleaseOnlyList({
  dependencies,
  releaseLabel,
}: {
  dependencies: readonly Dependency[];
  releaseLabel: string;
}) {
  return (
    <div className="min-w-0 border border-[var(--hairline)] bg-ink-900">
      <p className="border-b border-[var(--hairline)] px-4 py-2.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist-600 sm:hidden">
        {releaseLabel}
      </p>
      <ul className="divide-y divide-[var(--hairline)]">
        {dependencies.map((dependency) => (
          <li
            className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 px-4 py-3 sm:px-5"
            key={dependency.name}
          >
            <code className="min-w-0 break-all font-mono text-xs text-mist-300">
              {dependency.name}
            </code>
            <code className="shrink-0 font-mono text-[0.65rem] text-mist-600">
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
    <section aria-labelledby="divergence-heading" className="scroll-mt-20" id="version-divergence">
      <header className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
        <div>
          <h2
            className="max-w-3xl text-3xl font-semibold leading-[1.04] tracking-[-0.04em] text-mist-100 sm:text-[2.75rem]"
            id="divergence-heading"
          >
            Same package. Different dependency truth.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-mist-500">
            A package name looks stable. Its outgoing dependency edges are not.
            Compare two real AJV releases without merging their histories.
          </p>
        </div>

        <div className="flex items-end gap-4 border-t border-[var(--hairline-strong)] pt-4 lg:border-l lg:border-t-0 lg:pb-1 lg:pl-6 lg:pt-0">
          <strong className="font-mono text-3xl font-medium leading-none text-amber">3 / 4</strong>
          <span className="max-w-32 text-xs leading-5 text-mist-600">
            resolved dependency targets differ
          </span>
        </div>
      </header>

      <div className="mt-10 border border-[var(--hairline-strong)] bg-ink-850">
        <div className="grid grid-cols-2 border-b border-[var(--hairline-strong)] bg-ink-900 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)]">
          <div className="min-w-0 px-4 py-4 sm:px-6">
            <span className="block font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist-600">
              {RELEASES.earlier.label}
            </span>
            <code className="mt-1.5 block break-all font-mono text-sm font-semibold text-mist-100">
              {RELEASES.earlier.version}
            </code>
          </div>
          <div className="hidden items-center justify-center border-x border-[var(--hairline)] sm:flex">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist-700">
              release delta
            </span>
          </div>
          <div className="min-w-0 border-l border-[var(--hairline)] px-4 py-4 text-right sm:border-l-0 sm:px-6">
            <span className="block font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist-600">
              {RELEASES.later.label}
            </span>
            <code className="mt-1.5 block break-all font-mono text-sm font-semibold text-mist-100">
              {RELEASES.later.version}
            </code>
          </div>
        </div>

        <ul>
          <ComparisonRow
            earlier={SHARED_DEPENDENCY.earlier}
            label="same target"
            later={SHARED_DEPENDENCY.later}
          />
          <ComparisonRow
            earlier={CHANGED_DEPENDENCY.earlier}
            label="exact version changed"
            later={CHANGED_DEPENDENCY.later}
            tone="changed"
          />
        </ul>

        <div className="px-4 py-5 sm:px-6">
          <div className="mb-3 flex items-center gap-3">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist-600">
              Release-specific edges
            </span>
            <span aria-hidden="true" className="h-px flex-1 bg-[var(--hairline)]" />
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)] sm:items-center lg:grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)]">
            <ReleaseOnlyList
              dependencies={RELEASE_ONLY_DEPENDENCIES.earlier}
              releaseLabel={RELEASES.earlier.label}
            />
            <DirectionalConnector label="different edges" />
            <ReleaseOnlyList
              dependencies={RELEASE_ONLY_DEPENDENCIES.later}
              releaseLabel={RELEASES.later.label}
            />
          </div>
        </div>
      </div>

      <footer className="mt-6 grid gap-6 border-t border-[var(--hairline)] pt-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <p className="max-w-3xl text-sm leading-6 text-mist-500">
          A package-level graph would merge both lists and describe an AJV
          release that never shipped. Ripple keeps each edge attached to the
          exact version that declared it.
        </p>
        <Link
          className="inline-flex min-h-10 items-center justify-center border border-signal px-4 text-sm font-semibold text-signal transition-colors hover:bg-signal hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950"
          href="/packages/ajv"
        >
          Inspect both AJV releases
        </Link>
      </footer>
    </section>
  );
}
