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
    <main className="min-h-screen bg-[#f8f7ff]">
      <header className="border-b border-violet-200/70 bg-[#f8f7ff]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <Link
            aria-label="Ripple home"
            className="flex items-center gap-3 text-lg font-semibold tracking-[-0.03em] text-zinc-950"
            href="/"
          >
            <span className="grid size-8 place-items-center bg-violet-600 font-mono text-xs text-white shadow-[0_8px_22px_-8px_rgba(124,58,237,0.85)]">
              R/
            </span>
            Ripple
          </Link>
          <Link
            className="border-b border-violet-300 pb-1 text-sm font-semibold text-violet-800 hover:border-violet-700 hover:text-violet-950"
            href="/"
          >
            ← Search packages
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        <PackageDetailView packageName={packageName} />
        <div className="mt-12">
          <DatasetTransparency compact />
        </div>
      </div>
    </main>
  );
}
