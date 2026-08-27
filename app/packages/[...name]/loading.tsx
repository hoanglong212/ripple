export default function PackageLoading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <div className="flex items-center gap-3 font-mono text-xs text-mist-500" role="status">
        <span className="size-1.5 bg-signal" />
        loading package identity and indexed versions…
      </div>
      <div className="mt-6 h-64 border border-[var(--hairline)] bg-ink-850" />
      <div className="mt-6 h-80 border border-[var(--hairline)] bg-ink-850" />
    </main>
  );
}
