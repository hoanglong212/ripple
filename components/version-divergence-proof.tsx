const RELEASES = [
  {
    label: "Earlier release",
    releaseOnly: ["uri-js@4.4.1", "fast-json-stable-stringify@2.1.0"],
    requirement: "^0.4.1",
    resolvedDependency: "json-schema-traverse@0.4.1",
    version: "ajv@6.15.0",
  },
  {
    label: "Later release",
    releaseOnly: ["fast-uri@3.1.6", "require-from-string@2.0.2"],
    requirement: "^1.0.0",
    resolvedDependency: "json-schema-traverse@1.0.0",
    version: "ajv@8.20.0",
  },
] as const;

const SHARED_DEPENDENCY = "fast-deep-equal@3.1.3";

function ReleaseProof({ release }: { release: (typeof RELEASES)[number] }) {
  return (
    <div className="min-w-0 border border-[var(--hairline)] bg-ink-900 p-4 sm:p-5">
      <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist-600">
        {release.label}
      </span>
      <code className="mt-2 block break-all font-mono text-sm font-semibold text-mist-100">
        {release.version}
      </code>

      <div className="mt-5 border border-amber/40 bg-amber/[0.06] p-3.5">
        <span className="block text-[0.65rem] font-semibold text-amber">
          resolves exactly to
        </span>
        <code className="mt-2 block break-all font-mono text-xs font-semibold text-mist-100">
          {release.resolvedDependency}
        </code>
        <code className="mt-2 block font-mono text-[0.65rem] text-mist-600">
          declared range {release.requirement}
        </code>
      </div>

      <div className="mt-4 border-t border-[var(--hairline)] pt-3">
        <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-amber">
          only in this release
        </span>
        <ul className="mt-2 space-y-1">
          {release.releaseOnly.map((dependency) => (
            <li
              className="flex min-w-0 items-baseline gap-2 font-mono text-[0.68rem] text-mist-300"
              key={dependency}
            >
              <span aria-hidden="true" className="size-1 shrink-0 bg-amber" />
              <span className="min-w-0 break-all">{dependency}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function VersionDivergenceProof() {
  return (
    <figure
      aria-label="AJV exact-version comparison: json-schema-traverse resolves to 0.4.1 for ajv 6.15.0 and to 1.0.0 for ajv 8.20.0, each release also carries two dependencies the other does not, and only fast-deep-equal 3.1.3 is shared"
      className="overflow-hidden border border-[var(--hairline-strong)] bg-ink-850"
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] px-4 py-3.5 sm:px-5">
        <span className="flex items-center gap-2 text-xs font-semibold text-mist-300">
          <span className="size-1.5 bg-signal" />
          A real release comparison
        </span>
        <span className="font-mono text-[0.65rem] text-amber">
          3 of 4 dependencies differ
        </span>
      </figcaption>

      <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] sm:items-stretch sm:p-5">
        <ReleaseProof release={RELEASES[0]} />
        <div className="flex items-center justify-center gap-3 sm:flex-col">
          <span aria-hidden="true" className="h-px flex-1 bg-[var(--hairline-strong)] sm:h-full sm:w-px sm:flex-none" />
          <span className="grid size-8 shrink-0 place-items-center border border-[var(--hairline-strong)] bg-ink-900 font-mono text-[0.65rem] font-semibold text-mist-500">
            VS
          </span>
          <span aria-hidden="true" className="h-px flex-1 bg-[var(--hairline-strong)] sm:h-full sm:w-px sm:flex-none" />
        </div>
        <ReleaseProof release={RELEASES[1]} />
      </div>

      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-[var(--hairline)] px-4 py-3 text-[0.68rem] text-mist-600 sm:px-5">
        <span className="font-semibold text-mist-500">Shared by both releases</span>
        <code className="font-mono text-mist-300">{SHARED_DEPENDENCY}</code>
        <span>— the only one of the four that matches.</span>
      </p>

      <p className="border-t border-[var(--hairline)] bg-ink-900 px-4 py-4 text-sm leading-6 text-mist-500 sm:px-5">
        Same package dependency. Different resolved version. A package-level
        answer would merge both columns and describe an AJV release that never
        shipped.
      </p>
    </figure>
  );
}
