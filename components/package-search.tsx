"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import type { PackageSearchResult } from "@/lib/domain/packages";

interface SearchResponse {
  data: { packages: PackageSearchResult[] };
  meta: { scope: string };
}

interface ErrorResponse {
  meta?: { error?: { message?: string } };
}

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; response: SearchResponse }
  | { status: "error"; message: string };

function packageHref(name: string): string {
  return `/packages/${name.split("/").map(encodeURIComponent).join("/")}`;
}

export function PackageSearch() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized === "") {
      setState({ status: "error", message: "Enter a package name to search." });
      return;
    }

    setState({ status: "loading" });

    try {
      const response = await fetch(
        `/api/packages?query=${encodeURIComponent(normalized)}`,
        { headers: { Accept: "application/json" } },
      );
      const payload: SearchResponse & ErrorResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.meta?.error?.message ??
            "Ripple’s graph is temporarily unavailable.",
        );
      }

      setState({ status: "success", response: payload });
    } catch (error: unknown) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Ripple’s graph is temporarily unavailable.",
      });
    }
  }

  return (
    <section
      aria-labelledby="search-heading"
      className="border border-zinc-700 bg-zinc-900 p-5 text-white sm:p-7"
    >
      <div className="mb-5">
        <h2
          className="text-xl font-semibold tracking-[-0.025em] text-white"
          id="search-heading"
        >
          Find an indexed package
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Select a package, then choose the exact release you want to inspect.
        </p>
      </div>

      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
        <label className="sr-only" htmlFor="package-query">
          Package name
        </label>
        <input
          autoComplete="off"
          className="min-w-0 flex-1 border border-zinc-600 bg-white px-4 py-3.5 text-base text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
          id="package-query"
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try ajv, @hapi/hoek, or @babel/core"
          type="search"
          value={query}
        />
        <button
          className="bg-blue-500 px-6 py-3.5 font-semibold text-white hover:bg-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-white/60"
          disabled={state.status === "loading"}
          type="submit"
        >
          {state.status === "loading" ? "Searching…" : "Search"}
        </button>
      </form>

      <div aria-live="polite" className="mt-5 min-h-28">
        {state.status === "idle" && (
          <div className="border border-zinc-700 bg-zinc-950 px-5 py-5">
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-zinc-300">
              <span>Package</span>
              <span className="text-blue-400">→</span>
              <span>Exact version</span>
              <span className="text-blue-400">→</span>
              <span>Dependency truth</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-500">
              Analysis never begins from a package-level dependency guess.
            </p>
          </div>
        )}

        {state.status === "loading" && (
          <div className="space-y-3" role="status">
            <p className="text-sm font-medium text-zinc-300">
              Searching the indexed snapshot…
            </p>
            <div className="h-16 bg-white/[0.07]" />
            <div className="h-16 bg-white/[0.07]" />
          </div>
        )}

        {state.status === "error" && (
          <div className="border border-rose-400/30 bg-rose-400/10 px-5 py-4">
            <p className="font-semibold text-rose-100">Search unavailable</p>
            <p className="mt-1 text-sm text-rose-200">{state.message}</p>
          </div>
        )}

        {state.status === "success" &&
          (state.response.data.packages.length === 0 ? (
            <div className="border border-white/10 bg-white/[0.04] px-5 py-5">
              <p className="font-semibold text-white">No indexed package found</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Try another identity. Ripple is a curated snapshot, not the full
                npm ecosystem.
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                {state.response.data.packages.length} result
                {state.response.data.packages.length === 1 ? "" : "s"}
              </p>
              <ul className="divide-y divide-zinc-200 overflow-hidden bg-white text-zinc-950">
                {state.response.data.packages.map((packageResult) => (
                  <li key={packageResult.name}>
                    <Link
                      className="group flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                      href={packageHref(packageResult.name)}
                    >
                      <span className="min-w-0">
                        <span className="block break-all font-mono text-sm font-semibold text-zinc-950">
                          {packageResult.name}
                        </span>
                        <span className="mt-1 block text-xs text-zinc-500">
                          {packageResult.indexedVersionCount} indexed version
                          {packageResult.indexedVersionCount === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="grid size-9 shrink-0 place-items-center border border-zinc-200 text-blue-700 group-hover:border-blue-600"
                      >
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-zinc-400">
                {state.response.meta.scope}
              </p>
            </div>
          ))}
      </div>
    </section>
  );
}
