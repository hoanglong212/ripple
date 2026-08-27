import Link from "next/link";
import { DatasetTransparency } from "@/components/dataset-transparency";
import { PackageDetailView } from "@/components/package-detail";

export default async function PackagePage({
  params,
}: {
  params: Promise<{ name: string[] }>;
}) {
  const { name } = await params;
  const packageName = name.map(decodeURIComponent).join("/");

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-10">
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
          <Link
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            href="/"
          >
            ← Search packages
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-10 sm:py-14">
        <PackageDetailView packageName={packageName} />
        <div className="mt-12">
          <DatasetTransparency compact />
        </div>
      </div>
    </main>
  );
}
