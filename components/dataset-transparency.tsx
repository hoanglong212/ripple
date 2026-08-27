"use client";

import { useEffect, useState } from "react";
import type { DatasetStats } from "@/lib/domain/packages";

interface DatasetResponse {
  data: { dataset: DatasetStats };
  meta: { scope: string };
}

type DatasetState =
  | { status: "loading" }
  | { status: "success"; response: DatasetResponse }
  | { status: "error" };

export function DatasetTransparency({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<DatasetState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadDatasetStats() {
      try {
        const response = await fetch("/api/dataset", {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) {
          setState({ status: "error" });
          return;
        }
        const payload: DatasetResponse = await response.json();
        setState({ status: "success", response: payload });
      } catch {
        if (!controller.signal.aborted) {
          setState({ status: "error" });
        }
      }
    }

    void loadDatasetStats();
    return () => controller.abort();
  }, []);

  const dataset = state.status === "success" ? state.response.data.dataset : null;
  const stats = [
    { label: "Indexed packages", value: dataset?.packageCount },
    { label: "Exact versions", value: dataset?.versionCount },
    { label: "Dependency relationships", value: dataset?.relationshipCount },
  ];

  return (
    <aside
      aria-label="Dataset metadata"
      aria-live="polite"
      className={`border border-[var(--hairline)] bg-ink-850 ${
        compact ? "p-5 sm:p-6" : "p-6 sm:p-8 lg:p-10"
      }`}
    >
      <div
        className={`grid gap-8 ${
          compact ? "lg:grid-cols-[1fr_1.6fr]" : "lg:grid-cols-[0.8fr_1.2fr]"
        }`}
      >
        <div>
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-mist-600">
            dataset and trust
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-mist-100 sm:text-3xl">
            Transparent by design.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-mist-500">
            A curated, bounded snapshot — not the complete npm ecosystem. Every
            analysis result stays within versions Ripple has actually indexed.
          </p>
        </div>
        <div className="grid border-t border-[var(--hairline)] sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              className="border-b border-l-2 border-b-[var(--hairline)] border-l-signal/40 px-5 py-5 first:border-l-signal"
              key={stat.label}
            >
              <p className="font-mono text-3xl font-semibold tracking-[-0.04em] text-mist-100">
                {stat.value?.toLocaleString() ?? "—"}
              </p>
              <p className="mt-2 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-mist-600">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-3 border-t border-[var(--hairline)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-mist-300">
          Within Ripple&apos;s indexed npm snapshot.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[0.7rem] text-mist-600">
          <span>bounded snapshot</span>
          <span>exact-version model</span>
          <span>
            {state.status === "error"
              ? "totals unavailable"
              : state.status === "loading"
                ? "loading totals…"
                : "live graph totals"}
          </span>
        </div>
      </div>
    </aside>
  );
}
