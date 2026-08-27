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
      className={`overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white ${
        compact ? "p-5 sm:p-6" : "p-6 sm:p-8"
      }`}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-slate-950">Dataset</p>
        <p className="text-xs text-slate-500">Live graph totals</p>
      </div>
      <div
        className={`grid gap-5 ${
          compact ? "sm:grid-cols-3" : "sm:grid-cols-[1fr_1fr_1.25fr]"
        }`}
      >
        {stats.map((stat) => (
          <div className="border-l-2 border-cyan-500 pl-4" key={stat.label}>
            <p className="font-mono text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              {stat.value?.toLocaleString() ?? "—"}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-col gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-800">
          <span className="mr-2 text-xs uppercase tracking-[0.12em] text-cyan-700">
            Scope
          </span>
          Within Ripple&apos;s indexed npm snapshot.
        </p>
        <p className="text-xs leading-5 text-slate-500">
          {state.status === "error"
            ? "Live dataset counts are temporarily unavailable."
            : state.status === "loading"
              ? "Loading verified graph totals…"
              : "A curated, bounded dataset — not the complete npm ecosystem."}
        </p>
      </div>
    </aside>
  );
}
