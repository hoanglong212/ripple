export default function PackageLoading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10 sm:py-14">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-600" role="status">
        <span className="size-2 rounded-full bg-cyan-500" />
        Loading package identity and indexed versions…
      </div>
      <div className="mt-6 h-72 rounded-[2rem] bg-slate-200/70" />
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="h-56 rounded-[1.75rem] bg-slate-200/60 lg:col-span-2" />
        <div className="h-56 rounded-[1.75rem] bg-slate-200/60" />
      </div>
    </main>
  );
}
