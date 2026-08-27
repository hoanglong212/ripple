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
      className="rounded-[2rem] border border-slate-800 bg-slate-950 p-6 text-white shadow-[0_32px_80px_-42px_rgba(15,23,42,0.8)] sm:p-8"
    >
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Search the index
        </p>
        <h2
          className="mt-2 text-2xl font-semibold tracking-tight text-white"
          id="search-heading"
        >
          Start with a package identity.
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Choose an indexed package, then inspect one exact version at a time.
        </p>
      </div>

      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
        <label className="sr-only" htmlFor="package-query">
          Package name
        </label>
        <input
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white px-4 py-3.5 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/25"
          id="package-query"
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try ajv, @hapi/hoek, or @babel/core"
          type="search"
          value={query}
        />
        <button
          className="rounded-xl bg-cyan-400 px-6 py-3.5 font-semibold text-cyan-950 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/60"
          disabled={state.status === "loading"}
          type="submit"
        >
          {state.status === "loading" ? "Searching…" : "Search"}
        </button>
      </form>

      <div aria-live="polite" className="mt-6 min-h-32">
        {state.status === "idle" && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-5">
            <div className="flex items-center gap-3 font-mono text-xs text-slate-300">
              <span className="rounded-md bg-white/10 px-2 py-1">Package</span>
              <span className="text-cyan-300">→</span>
              <span className="rounded-md bg-white/10 px-2 py-1">Version</span>
              <span className="text-cyan-300">→</span>
              <span className="rounded-md bg-white/10 px-2 py-1">Dependency</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Search matches package identities. Traversal begins only after an
              exact indexed version is selected.
            </p>
          </div>
        )}

        {state.status === "loading" && (
          <div className="space-y-3" role="status">
            <p className="text-sm font-medium text-slate-300">
              Searching the indexed snapshot…
            </p>
            <div className="h-16 rounded-2xl bg-white/[0.07]" />
            <div className="h-16 rounded-2xl bg-white/[0.07]" />
          </div>
        )}

        {state.status === "error" && (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-5 py-4">
            <p className="font-semibold text-rose-100">Search unavailable</p>
            <p className="mt-1 text-sm text-rose-200">{state.message}</p>
          </div>
        )}

        {state.status === "success" &&
          (state.response.data.packages.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-5">
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
              <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white text-slate-950">
                {state.response.data.packages.map((packageResult) => (
                  <li key={packageResult.name}>
                    <Link
                      className="group flex items-center justify-between gap-4 px-5 py-4 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500"
                      href={packageHref(packageResult.name)}
                    >
                      <span className="min-w-0">
                        <span className="block break-all font-mono text-sm font-semibold text-slate-950">
                          {packageResult.name}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {packageResult.indexedVersionCount} indexed version
                          {packageResult.indexedVersionCount === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-cyan-900 group-hover:bg-cyan-100"
                      >
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-slate-400">
                {state.response.meta.scope}
              </p>
            </div>
          ))}
      </div>
    </section>
  );
}
