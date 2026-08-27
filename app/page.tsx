import Link from "next/link";
import { DatasetTransparency } from "@/components/dataset-transparency";
import { PackageSearch } from "@/components/package-search";

const FEATURES = [
  {
    description:
      "Inspect exact package versions and the direct dependencies resolved for each release.",
    eyebrow: "Version-level truth",
    number: "01",
    title: "Dependency Explorer",
  },
  {
    description:
      "See which indexed versions can reach a selected version, including direct and transitive impact.",
    eyebrow: "Reverse traversal",
    number: "02",
    title: "Downstream Impact",
  },
  {
    description:
      "Follow the shortest dependency chain and read the requirement declared at every hop.",
    eyebrow: "Explainable paths",
    number: "03",
    title: "Explain Path",
  },
] as const;

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <div className="surface-grid border-b border-slate-200">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
          <Link
            aria-label="Ripple home"
            className="flex items-center gap-2.5 text-xl font-semibold tracking-[-0.03em] text-slate-950"
            href="/"
          >
            <span className="grid size-8 place-items-center rounded-full bg-slate-950 text-sm text-white">
              r
            </span>
            ripple<span className="-ml-2.5 text-cyan-600">/</span>
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-slate-600">
            <span className="size-1.5 rounded-full bg-cyan-500" />
            npm snapshot
          </div>
        </header>

        <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 pb-20 pt-12 sm:px-10 sm:pb-24 sm:pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-16 lg:pb-28 lg:pt-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Version-level dependency intelligence
            </p>
            <h1 className="mt-6 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl">
              Understand how dependencies propagate.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
              Explore npm dependency relationships at the version level.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-600">
              <span className="flex items-center gap-2">
                <span className="font-mono text-cyan-700">Package</span>
                identity
              </span>
              <span aria-hidden="true" className="text-slate-300">
                →
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-cyan-700">Version</span>
                dependency truth
              </span>
            </div>
          </div>

          <PackageSearch />
        </section>
      </div>

      <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
        <DatasetTransparency />

        <div className="mt-20 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
              Three focused tools
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
              Trace dependencies without losing exact-version context.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-slate-500">
            Every result stays bounded to versions actually indexed in Ripple.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              className="flex min-h-64 flex-col rounded-[1.75rem] border border-slate-200 bg-white p-6 sm:p-7"
              key={feature.title}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-11 place-items-center rounded-full bg-slate-950 font-mono text-sm font-semibold text-white">
                  {feature.number}
                </span>
                <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800">
                  {feature.eyebrow}
                </span>
              </div>
              <div className="mt-auto pt-10">
                <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {feature.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <p className="font-semibold text-slate-800">ripple/</p>
          <p>Exact-version npm dependency exploration.</p>
        </div>
      </footer>
    </main>
  );
}
