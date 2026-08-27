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
          <Link
            className="font-mono text-xs text-mist-500 transition-colors hover:text-signal"
            href="/"
          >
            ← search packages
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
