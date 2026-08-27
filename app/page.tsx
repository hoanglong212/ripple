import Link from "next/link";
import { DatasetTransparency } from "@/components/dataset-transparency";
import { PackageSearch } from "@/components/package-search";
import { VersionDivergenceProof } from "@/components/version-divergence-proof";

const FEATURES = [
  {
    description:
      "Direct dependencies resolved for one exact release, each with the requirement that was actually declared.",
    label: "Dependency Explorer",
    number: "01",
    question: "What does this release actually depend on?",
  },
  {
    description:
      "Every indexed version that can reach this one, split into direct and transitive, with hop counts. Bounded at four hops.",
    label: "Downstream Impact",
    number: "02",
    question: "Who breaks if I change this?",
  },
  {
    description:
      "The shortest directed chain between two exact versions, carrying the requirement declared at every step.",
    label: "Explain Path",
    number: "03",
    question: "Why are these two connected?",
  },
] as const;

const EXAMPLES = [
  {
    href: "/packages/ajv",
    hint: "Two indexed releases, three of four dependencies differ",
    label: "See it: ajv 6 vs ajv 8",
    primary: true,
  },
  {
    href: "/packages/%40hapi%2Fhoek",
    hint: "24 indexed versions can reach one release",
    label: "Trace @hapi/hoek's dependents",
    primary: false,
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
              npm dependency impact
            </p>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-slate-950 sm:text-6xl lg:text-[4.2rem] lg:leading-[0.98]">
              Which exact versions break if this one changes?
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">
              Package-level dependency tools cannot answer that. Different
              releases of the same package resolve different dependencies.
              Ripple models every edge between exact versions and shows the
              requirement declared at every hop.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {EXAMPLES.map((example) => (
                <Link
                  className={`group rounded-2xl px-5 py-4 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${
                    example.primary
                      ? "bg-slate-950 text-white hover:bg-slate-800"
                      : "border border-slate-300 bg-white/70 text-slate-800 hover:border-slate-950"
                  }`}
                  href={example.href}
                  key={example.href}
                >
                  <span className="block text-sm font-semibold">
                    {example.label}{" "}
                    <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </span>
                  <span
                    className={`mt-1 block text-xs leading-5 ${
                      example.primary ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {example.hint}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <PackageSearch />
        </section>
      </div>

      <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
        <VersionDivergenceProof />

        <div className="mt-20 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
              Three questions Ripple answers
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
              key={feature.label}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-11 place-items-center rounded-full bg-slate-950 font-mono text-sm font-semibold text-white">
                  {feature.number}
                </span>
                <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800">
                  {feature.label}
                </span>
              </div>
              <div className="mt-auto pt-10">
                <h3 className="text-xl font-semibold leading-7 tracking-tight text-slate-950">
                  {feature.question}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {feature.description}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-20">
          <DatasetTransparency />
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
