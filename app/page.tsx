import Link from "next/link";
import { DatasetTransparency } from "@/components/dataset-transparency";
import { DependencyRippleVisual } from "@/components/dependency-ripple-visual";
import { PackageSearch } from "@/components/package-search";
import { VersionDivergenceProof } from "@/components/version-divergence-proof";

const CAPABILITIES = [
  {
    detail:
      "Inspect the resolved outgoing edges and declared requirement for one version.",
    name: "Dependency Explorer",
    question: "What does this exact release depend on?",
  },
  {
    detail:
      "Trace direct and transitive dependents without mixing package releases.",
    name: "Downstream Impact",
    question: "Who is affected if this release changes?",
  },
  {
    detail: "Follow the shortest dependency chain, requirement by requirement.",
    name: "Explain Path",
    question: "Why are these versions connected?",
  },
] as const;

/*
 * Each glyph depicts the actual shape of its traversal — fan-out, fan-in, and
 * a chain. Monochrome on purpose: the accent marks the release under analysis.
 */
function CapabilityGlyph({ index }: { index: number }) {
  const line = "var(--hairline-strong)";

  if (index === 0) {
    return (
      <svg aria-hidden="true" fill="none" height="44" viewBox="0 0 64 44" width="64">
        <path d="M18 22 L44 10M18 22 L44 22M18 22 L44 34" stroke={line} strokeWidth="1" />
        <rect fill="var(--color-signal)" height="10" width="10" x="13" y="17" />
        <rect height="7" stroke={line} width="7" x="44" y="6.5" />
        <rect height="7" stroke={line} width="7" x="44" y="18.5" />
        <rect height="7" stroke={line} width="7" x="44" y="30.5" />
      </svg>
    );
  }

  if (index === 1) {
    return (
      <svg aria-hidden="true" fill="none" height="44" viewBox="0 0 64 44" width="64">
        <path d="M20 10 L46 22M20 22 L46 22M20 34 L46 22" stroke={line} strokeWidth="1" />
        <rect height="7" stroke={line} width="7" x="13" y="6.5" />
        <rect height="7" stroke={line} width="7" x="13" y="18.5" />
        <rect height="7" stroke={line} width="7" x="13" y="30.5" />
        <rect fill="var(--color-signal)" height="10" width="10" x="46" y="17" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" fill="none" height="44" viewBox="0 0 64 44" width="64">
      <path d="M18 22 H26M33 22 H40M47 22 H51" stroke={line} strokeWidth="1" />
      <rect fill="var(--color-signal)" height="10" width="10" x="8" y="17" />
      <rect height="7" stroke={line} width="7" x="26" y="18.5" />
      <rect height="7" stroke={line} width="7" x="40" y="18.5" />
      <path d="M51 18 L56 22 L51 26" stroke="var(--color-signal)" strokeWidth="1.2" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-ink-900">
      <header className="sticky top-0 z-20 border-b border-[var(--hairline)] bg-ink-900/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <Link
            aria-label="Ripple home"
            className="flex items-center gap-3 text-[0.95rem] font-semibold tracking-[-0.02em] text-mist-100"
            href="/"
          >
            <span className="grid size-7 place-items-center bg-signal font-mono text-[0.7rem] font-bold text-ink-950">
              R/
            </span>
            Ripple
          </Link>
          <p className="hidden items-center gap-2 font-mono text-[0.7rem] text-mist-600 sm:flex">
            <span className="size-1.5 bg-signal" />
            exact-version npm intelligence
          </p>
        </div>
      </header>

      {/* Hero ------------------------------------------------------------ */}
      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto grid w-full max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1.06fr_0.94fr] lg:items-center lg:gap-16 lg:px-12 lg:py-28">
          <div className="reveal-up">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-signal">
              npm dependency impact
            </p>
            <div className="rule-signal mt-4 h-px w-24" />
            <h1 className="mt-7 max-w-3xl text-balance text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.04em] text-mist-100 sm:text-6xl lg:text-[4.1rem] lg:leading-[0.97]">
              Understand what changes behind every package version.
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-mist-500 sm:text-lg sm:leading-8">
              Ripple traces exact npm releases, their dependencies, and their
              impact — because a package name does not tell the whole story.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                className="lift inline-flex h-12 items-center justify-center border border-signal bg-signal px-6 text-sm font-semibold text-ink-950 hover:bg-[var(--color-signal-deep)] sm:w-48"
                href="/packages/ajv"
              >
                Try the AJV example
              </Link>
              <Link
                className="lift inline-flex h-12 items-center justify-center border border-[var(--hairline-strong)] px-6 text-sm font-semibold text-mist-300 hover:border-signal hover:text-signal sm:w-48"
                href="#package-search"
              >
                Search packages
              </Link>
            </div>
          </div>

          <div className="reveal-up" style={{ animationDelay: "120ms" }}>
            <DependencyRippleVisual />
          </div>
        </div>
      </section>

      {/* The argument ---------------------------------------------------- */}
      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
          <VersionDivergenceProof />
        </div>
      </section>

      {/* Capabilities ---------------------------------------------------- */}
      <section className="border-b border-[var(--hairline)]" id="capabilities">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
          <div className="max-w-2xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-mist-600">
              capabilities
            </p>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-mist-100 sm:text-[2.75rem] sm:leading-[1.06]">
              Three questions. One exact release at the center.
            </h2>
            <p className="mt-5 text-base leading-7 text-mist-500">
              Ripple keeps the direction of every edge visible, so each answer
              reads like a cause-and-effect story rather than a graph dump.
            </p>
          </div>

          <div className="mt-14 border-t border-[var(--hairline)]">
            {CAPABILITIES.map((capability, index) => (
              <article
                className="group grid gap-6 border-b border-[var(--hairline)] py-8 transition-colors hover:bg-ink-850 sm:grid-cols-[5rem_1fr] sm:gap-10 sm:px-2 lg:grid-cols-[5rem_13rem_1fr_18rem] lg:items-center"
                key={capability.name}
              >
                <div className="text-mist-600 transition-colors group-hover:text-mist-300">
                  <CapabilityGlyph index={index} />
                </div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-signal">
                  {capability.name}
                </p>
                <h3 className="text-xl font-semibold tracking-[-0.025em] text-mist-100 sm:text-2xl">
                  {capability.question}
                </h3>
                <p className="text-sm leading-6 text-mist-500">
                  {capability.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Search ---------------------------------------------------------- */}
      <section className="border-b border-[var(--hairline)] bg-ink-950" id="package-search">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.72fr_1.28fr] lg:items-start lg:gap-20 lg:px-12">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-mist-100 sm:text-[2.5rem] sm:leading-[1.08]">
              Look up any public npm package.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-mist-500">
              Learn what a package does, how to install it, and where its docs
              live. If Ripple has indexed it, continue into exact-version
              dependency analysis.
            </p>
          </div>
          <PackageSearch />
        </div>
      </section>

      {/* Dataset --------------------------------------------------------- */}
      <section>
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
          <DatasetTransparency />
        </div>
      </section>

      <footer className="border-t border-[var(--hairline)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-mist-600 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p className="font-semibold text-mist-300">Ripple</p>
          <p className="font-mono text-xs">
            dependency answers for exact npm releases
          </p>
        </div>
      </footer>
    </main>
  );
}
