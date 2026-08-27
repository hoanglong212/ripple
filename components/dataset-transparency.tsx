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
    { bar: "bg-signal", label: "Indexed packages", value: dataset?.packageCount },
    { bar: "bg-mist-300", label: "Exact versions", value: dataset?.versionCount },
    { bar: "bg-amber", label: "Dependency relationships", value: dataset?.relationshipCount },
  ];
  const maxValue = Math.max(...stats.map((stat) => stat.value ?? 0), 1);

  return (
    <aside
      aria-label="Dataset metadata"
      aria-live="polite"
      className={`border border-[var(--hairline)] bg-ink-850 ${
        compact ? "p-5 sm:p-6" : "p-6 sm:p-8 lg:p-10"
      }`}
    >
      <div className={`grid gap-10 ${compact ? "lg:grid-cols-[0.8fr_1.2fr]" : "lg:grid-cols-[0.72fr_1.28fr]"}`}>
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.035em] text-mist-100 sm:text-3xl">
            See the boundary, not just the totals.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-mist-500">
            Package discovery covers the public npm catalog. The chart shows the
            smaller, curated graph Ripple can analyze with exact-version truth.
          </p>
          {dataset && (
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-[var(--hairline)] pt-5">
              <p>
                <strong className="block font-mono text-lg text-mist-100">
                  {(dataset.versionCount / dataset.packageCount).toFixed(2)}
                </strong>
                <span className="text-xs text-mist-600">versions per package</span>
              </p>
              <p>
                <strong className="block font-mono text-lg text-mist-100">
                  {(dataset.relationshipCount / dataset.versionCount).toFixed(2)}
                </strong>
                <span className="text-xs text-mist-600">edges per version</span>
              </p>
            </div>
          )}
        </div>

        <div className="border-y border-[var(--hairline)] py-6">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h3 className="text-sm font-semibold text-mist-200">Indexed graph volume</h3>
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-mist-700">
              relative scale
            </span>
          </div>
          <dl className="space-y-5">
          {stats.map((stat) => (
            <div key={stat.label}>
              <div className="mb-2 flex items-end justify-between gap-4">
                <dt className="text-xs text-mist-500">{stat.label}</dt>
                <dd className="font-mono text-lg font-semibold tabular-nums text-mist-100">
                  {stat.value?.toLocaleString() ?? "—"}
                </dd>
              </div>
              <div aria-hidden="true" className="h-2 overflow-hidden bg-ink-950">
                <div
                  className={`h-full transition-[width] duration-700 ease-out ${stat.bar}`}
                  style={{ width: `${((stat.value ?? 0) / maxValue) * 100}%` }}
                />
              </div>
            </div>
          ))}
          </dl>
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-3 border-t border-[var(--hairline)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-mist-300">
          Graph analysis: within Ripple&apos;s indexed npm snapshot.
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
