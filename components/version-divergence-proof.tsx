import Link from "next/link";

/*
 * Static and verified against the indexed snapshot. This section is the
 * product's argument, so it must render identically even when CognoDB is
 * unreachable — it never queries.
 *
 * tone: "changed" = same package resolved to a different exact version; that is
 * the single fact the whole model exists to preserve.
 */
const RELEASES = [
  {
    dependencies: [
      { name: "fast-deep-equal@3.1.3", requirement: "^3.1.1", tone: "shared" },
      { name: "fast-json-stable-stringify@2.1.0", requirement: "^2.0.0", tone: "only" },
      { name: "json-schema-traverse@0.4.1", requirement: "^0.4.1", tone: "changed" },
      { name: "uri-js@4.4.1", requirement: "^4.2.2", tone: "only" },
    ],
    label: "Earlier release",
    version: "ajv@6.15.0",
  },
  {
    dependencies: [
      { name: "fast-deep-equal@3.1.3", requirement: "^3.1.3", tone: "shared" },
      { name: "fast-uri@3.1.6", requirement: "^3.0.1", tone: "only" },
      { name: "json-schema-traverse@1.0.0", requirement: "^1.0.0", tone: "changed" },
      { name: "require-from-string@2.0.2", requirement: "^2.0.2", tone: "only" },
    ],
    label: "Later release",
    version: "ajv@8.20.0",
  },
] as const;

type Tone = "shared" | "only" | "changed";

const TONE_BORDER: Record<Tone, string> = {
  changed: "border-l-amber bg-amber/[0.05]",
  only: "border-l-[var(--hairline-strong)]",
  shared: "border-l-transparent",
};

const TONE_TEXT: Record<Tone, string> = {
  changed: "text-amber",
  only: "text-mist-300",
  shared: "text-mist-600",
};

function ReleaseColumn({ release }: { release: (typeof RELEASES)[number] }) {
  return (
    <div className="border border-[var(--hairline)] bg-ink-850">
      <div className="flex items-baseline justify-between gap-3 border-b border-[var(--hairline)] px-4 py-3.5 sm:px-5">
        <code className="break-all font-mono text-sm font-semibold text-mist-100">
          {release.version}
        </code>
        <span className="shrink-0 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-mist-600">
          {release.label}
        </span>
      </div>
      <ul>
        {release.dependencies.map((dependency) => (
          <li
            className={`flex items-center justify-between gap-3 border-b border-l-2 border-b-[var(--hairline)] px-4 py-3 last:border-b-0 sm:px-5 ${
              TONE_BORDER[dependency.tone]
            }`}
            key={dependency.name}
          >
            <code
              className={`min-w-0 break-all font-mono text-xs ${TONE_TEXT[dependency.tone]}`}
            >
              {dependency.name}
            </code>
            <code className="shrink-0 font-mono text-[0.68rem] text-mist-600">
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
      <div className="grid gap-12 lg:grid-cols-[0.68fr_1.32fr] lg:gap-16">
        <div>
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-mist-600">
            why the name is not enough
          </p>
          <h2
            className="mt-5 text-3xl font-semibold leading-[1.08] tracking-[-0.04em] text-mist-100 sm:text-[2.75rem]"
            id="divergence-heading"
          >
            Same package.
            <br />
            Different dependency truth.
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-mist-500">
            The name stays the same. The dependency tree does not. Package-level
            answers blur together releases that never shipped together.
          </p>

          <dl className="mt-8 space-y-3 border-t border-[var(--hairline)] pt-6 text-sm">
            <div className="flex items-baseline gap-3">
              <dt className="w-24 shrink-0 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-amber">
                changed
              </dt>
              <dd className="text-mist-500">
                <code className="font-mono text-xs text-mist-300">
                  json-schema-traverse
                </code>{" "}
                resolves to 0.4.1 in one release and 1.0.0 in the other.
              </dd>
            </div>
            <div className="flex items-baseline gap-3">
              <dt className="w-24 shrink-0 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-mist-500">
                replaced
              </dt>
              <dd className="text-mist-500">
                <code className="font-mono text-xs text-mist-300">uri-js</code>{" "}
                gives way to{" "}
                <code className="font-mono text-xs text-mist-300">fast-uri</code>{" "}
                entirely.
              </dd>
            </div>
          </dl>

          <Link
            className="mt-8 inline-flex items-center gap-2 border-b border-signal pb-1 text-sm font-semibold text-signal transition-colors hover:border-mist-100 hover:text-mist-100"
            href="/packages/ajv"
          >
            Inspect both AJV releases <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div>
          <div className="grid gap-4 lg:grid-cols-2">
            {RELEASES.map((release) => (
              <ReleaseColumn key={release.version} release={release} />
            ))}
          </div>
          <p className="mt-5 border-l-2 border-l-amber bg-amber/[0.05] px-4 py-3.5 text-sm leading-6 text-mist-500">
            Three of four dependencies differ. A graph that stores dependencies
            on the <span className="font-mono text-xs text-mist-300">Package</span>{" "}
            node has to merge these lists — and then claims AJV depends on
            json-schema-traverse 0.4.1 <em>and</em> 1.0.0 at once. No published
            release ever did.
          </p>
        </div>
      </div>
    </section>
  );
}
