import Link from "next/link";

const RELEASES = [
  {
    dependency: "json-schema-traverse@0.4.1",
    requirement: "^0.4.1",
    version: "ajv@6.15.0",
  },
  {
    dependency: "json-schema-traverse@1.0.0",
    requirement: "^1.0.0",
    version: "ajv@8.20.0",
  },
] as const;

export function VersionDivergenceProof() {
  return (
    <section aria-labelledby="divergence-heading" id="version-divergence">
      <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
        <div>
          <h2
            className="text-4xl font-semibold leading-tight tracking-[-0.04em] text-zinc-950 sm:text-5xl"
            id="divergence-heading"
          >
            Same package.
            <br />
            <span className="text-violet-600">Different dependency truth.</span>
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-zinc-600">
            The name stays the same. The dependency tree does not. Package-level
            answers blur together releases that never shipped together.
          </p>
          <Link
            className="mt-7 inline-flex items-center gap-2 border-b border-violet-500 pb-1 text-sm font-semibold text-violet-700 hover:border-violet-800 hover:text-violet-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600"
            href="/packages/ajv"
          >
            Inspect both AJV releases <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="overflow-hidden border border-violet-200 bg-[#fbfaff] shadow-[0_24px_60px_-44px_rgba(76,29,149,0.5)]">
          <div className="flex items-center justify-between border-b border-violet-100 bg-violet-50 px-5 py-3 text-xs text-violet-950/60 sm:px-6">
            <span>One package identity</span>
            <span>Two release truths</span>
          </div>
          {RELEASES.map((release, index) => (
            <div
              className={`grid gap-5 px-5 py-7 sm:grid-cols-[minmax(0,0.9fr)_3rem_minmax(0,1.1fr)] sm:items-center sm:px-6 ${
                index === 0 ? "border-b border-violet-100 bg-orange-50/70" : "bg-violet-50/70"
              }`}
              key={release.version}
            >
              <div>
                <p className={`mb-2 text-xs font-medium ${index === 0 ? "text-orange-700" : "text-violet-700"}`}>
                  {index === 0 ? "Earlier release" : "Later release"}
                </p>
                <code className="break-all text-base font-semibold text-zinc-950">
                  {release.version}
                </code>
              </div>
              <div className="flex items-center gap-3 text-zinc-300 sm:block sm:text-center">
                <span className="h-px flex-1 bg-zinc-300 sm:hidden" />
                <span aria-hidden="true" className={`font-mono ${index === 0 ? "text-orange-500" : "text-violet-500"}`}>
                  →
                </span>
                <span className="h-px flex-1 bg-zinc-300 sm:hidden" />
              </div>
              <div className={`border-l pl-4 ${index === 0 ? "border-orange-400" : "border-violet-500"}`}>
                <p className="mb-2 text-xs text-zinc-500">
                  requires <code className={index === 0 ? "text-orange-700" : "text-violet-700"}>{release.requirement}</code>
                </p>
                <code className="break-all text-base font-semibold text-zinc-950">
                  {release.dependency}
                </code>
              </div>
            </div>
          ))}
          <div className="grid gap-2 border-t border-violet-100 bg-white px-5 py-5 text-sm leading-6 text-zinc-700 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-4 sm:px-6">
            <span className="w-fit rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
              What changed?
            </span>
            <span>
              AJV moved from <code className="font-semibold text-orange-700">0.4.1</code> to{" "}
              <code className="font-semibold text-violet-700">1.0.0</code>. A package-only view would hide this release-level difference.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
