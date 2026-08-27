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
      className={`overflow-hidden border border-zinc-200 bg-white ${
        compact ? "p-5 sm:p-6" : "p-6 sm:p-8 lg:p-10"
      }`}
    >
      <div className={`grid gap-8 ${compact ? "lg:grid-cols-[1fr_1.6fr]" : "lg:grid-cols-[0.8fr_1.2fr]"}`}>
        <div>
          <p className="text-sm font-medium text-blue-700">Dataset and trust</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-zinc-950 sm:text-3xl">
            Transparent by design.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-zinc-600">
            A curated, bounded snapshot — not the complete npm ecosystem. Every
            analysis result stays within versions Ripple has actually indexed.
          </p>
        </div>
        <div className="grid border-l border-t border-zinc-200 sm:grid-cols-3">
          {stats.map((stat) => (
            <div className="border-b border-r border-zinc-200 p-5" key={stat.label}>
              <p className="font-mono text-3xl font-semibold tracking-[-0.04em] text-zinc-950">
                {stat.value?.toLocaleString() ?? "—"}
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-zinc-900">
          Within Ripple&apos;s indexed npm snapshot.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
          <span>Bounded snapshot</span>
          <span>Exact-version model</span>
          <span>
            {state.status === "error"
              ? "Live totals unavailable"
              : state.status === "loading"
                ? "Loading graph totals…"
                : "Live graph totals"}
          </span>
        </div>
      </div>
    </aside>
  );
}
