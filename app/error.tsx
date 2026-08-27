"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="surface-grid flex min-h-screen items-center px-6 py-16">
      <div className="mx-auto w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.45)] sm:p-10">
        <div className="grid size-12 place-items-center rounded-full bg-rose-50 font-mono font-semibold text-rose-700">
          !
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-rose-700">
          Graph unavailable
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">
          Ripple could not load this view.
        </h1>
        <p className="mt-3 leading-7 text-slate-600">
          The indexed graph may be temporarily unavailable. Your selected package
          and version have not been changed.
        </p>
        <button
          className="mt-7 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
