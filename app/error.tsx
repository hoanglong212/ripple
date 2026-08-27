"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center px-6 py-16">
      <div className="mx-auto w-full max-w-xl border border-[var(--hairline)] bg-ink-850 p-8 sm:p-10">
        <div className="h-px w-16 bg-rose" />
        <p className="mt-6 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-rose">
          graph unavailable
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-mist-100">
          Ripple could not load this view.
        </h1>
        <p className="mt-4 leading-7 text-mist-500">
          The indexed graph may be temporarily unavailable. Your selected package
          and version have not been changed.
        </p>
        <button
          className="lift mt-8 border border-signal bg-signal px-6 py-3 text-sm font-semibold text-ink-950 hover:bg-[var(--color-signal-deep)]"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
