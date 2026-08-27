import Link from "next/link";
import { DatasetTransparency } from "@/components/dataset-transparency";
import { DependencyRippleVisual } from "@/components/dependency-ripple-visual";
import { PackageSearch } from "@/components/package-search";
import { VersionDivergenceProof } from "@/components/version-divergence-proof";

const CAPABILITIES = [
  {
    name: "Dependency Explorer",
    question: "What does this exact release depend on?",
    detail: "Inspect the resolved outgoing edges and declared requirement for one version.",
  },
  {
    name: "Downstream Impact",
    question: "Who is affected if this release changes?",
    detail: "Trace direct and transitive dependents without mixing package releases.",
  },
  {
    name: "Explain Path",
    question: "Why are these versions connected?",
    detail: "Follow the shortest dependency chain, requirement by requirement.",
  },
] as const;

function CapabilityIcon({ index }: { index: number }) {
  if (index === 0) {
    return (
      <svg fill="none" height="28" viewBox="0 0 28 28" width="28">
        <circle cx="7" cy="14" r="3" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="21" cy="7" r="3" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="21" cy="21" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 13L18 8.5M10 15L18 19.5" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (index === 1) {
    return (
      <svg fill="none" height="28" viewBox="0 0 28 28" width="28">
        <circle cx="21" cy="14" r="3" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="7" cy="21" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 8.5L18 13M10 19.5L18 15" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg fill="none" height="28" viewBox="0 0 28 28" width="28">
      <circle cx="6" cy="14" r="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="22" cy="14" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 14H19" stroke="currentColor" strokeDasharray="2 3" strokeWidth="1.8" />
      <path d="M15.5 10.5L19 14L15.5 17.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f8f7ff]">
      <header className="border-b border-violet-200/70 bg-[#f8f7ff]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <Link
            aria-label="Ripple home"
            className="flex items-center gap-3 text-lg font-semibold tracking-[-0.03em] text-[#191625]"
            href="/"
          >
            <span className="grid size-8 place-items-center bg-violet-600 font-mono text-xs text-white shadow-[0_8px_22px_-8px_rgba(124,58,237,0.85)]">
              R/
            </span>
            Ripple
          </Link>
          <p className="hidden items-center gap-2 text-xs font-medium text-violet-950/60 sm:flex">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Exact-version npm intelligence
          </p>
        </div>
      </header>

      <section className="border-b border-violet-200/70 bg-[#f8f7ff]">
        <div className="mx-auto grid w-full max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-20 lg:px-12 lg:py-32">
          <div>
            <h1 className="max-w-4xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-zinc-950 sm:text-7xl lg:text-[5.25rem]">
              Understand what changes behind every{" "}
              <span className="text-violet-600">package version.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-zinc-600 sm:text-xl">
              Ripple traces exact npm releases, their dependencies, and their
              impact — because a package name does not tell the whole story.
            </p>
            <div className="mt-10 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row">
              <Link
                className="inline-flex h-12 w-full items-center justify-center bg-violet-600 px-5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(124,58,237,0.9)] hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 sm:w-44"
                href="/packages/ajv"
              >
                Try AJV Example
              </Link>
              <Link
                className="inline-flex h-12 w-full items-center justify-center border border-violet-300 bg-white px-5 text-sm font-semibold text-violet-950 hover:border-violet-600 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 sm:w-44"
                href="#package-search"
              >
                Search Packages
              </Link>
            </div>
          </div>

          <DependencyRippleVisual />
        </div>
      </section>

      <section className="border-b border-violet-200/70 bg-white">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
          <VersionDivergenceProof />
        </div>
      </section>

      <section className="border-b border-violet-200/70 bg-[#f1efff]" id="capabilities">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-5xl">
              Three questions. One exact release at the center.
            </h2>
            <p className="mt-5 text-base leading-7 text-violet-950/65">
              Ripple keeps the direction of every edge visible, so each answer
              reads like a cause-and-effect story rather than a graph dump.
            </p>
          </div>
          <div className="mt-14 overflow-hidden border border-violet-200 bg-white shadow-[0_24px_60px_-44px_rgba(76,29,149,0.55)]">
            {CAPABILITIES.map((capability, index) => (
              <article
                className="group grid gap-5 border-b border-violet-100 p-6 last:border-b-0 sm:grid-cols-[4.5rem_0.75fr_1.05fr_1fr] sm:items-center sm:gap-8 sm:p-8"
                key={capability.name}
              >
                <div
                  aria-hidden="true"
                  className={`grid size-14 place-items-center rounded-2xl ${
                    index === 0
                      ? "bg-cyan-100 text-cyan-700"
                      : index === 1
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-violet-100 text-violet-700"
                  }`}
                >
                  <CapabilityIcon index={index} />
                </div>
                <h3 className="font-mono text-sm font-semibold text-violet-700">
                  {capability.name}
                </h3>
                <p className="text-xl font-semibold tracking-[-0.02em] text-zinc-950">
                  {capability.question}
                </p>
                <p className="text-sm leading-6 text-violet-950/65">{capability.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-violet-950 bg-[#17132c] text-white" id="package-search">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.7fr_1.3fr] lg:items-start lg:gap-20 lg:px-12">
          <div>
            <h2 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Start with a package. Inspect one release.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-zinc-400">
              Package search finds the identity. Ripple begins dependency
              analysis only after an exact indexed version is selected.
            </p>
          </div>
          <PackageSearch />
        </div>
      </section>

      <section className="bg-[#f8f7ff]">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
          <DatasetTransparency />
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p className="font-semibold text-zinc-950">Ripple</p>
          <p>Dependency answers for exact npm releases.</p>
        </div>
      </footer>
    </main>
  );
}
