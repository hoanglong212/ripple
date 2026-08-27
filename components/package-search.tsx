"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import type { PackageSearchResult } from "@/lib/domain/packages";

interface SearchResponse {
  data: { packages: PackageSearchResult[] };
  meta: { catalogScope?: string; scope: string };
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
      className="border border-[var(--hairline)] bg-ink-850 p-5 sm:p-7"
    >
      <div className="mb-5">
        <h2
          className="text-xl font-semibold tracking-[-0.025em] text-mist-100"
          id="search-heading"
        >
          Search the npm package catalog
        </h2>
        <p className="mt-2 text-sm leading-6 text-mist-500">
          Find any public npm package. Ripple marks which results have
          exact-version graph analysis available.
        </p>
      </div>

      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
        <label className="sr-only" htmlFor="package-query">
          Package name
        </label>
        <input
          autoComplete="off"
          className="min-w-0 flex-1 border border-[var(--hairline-strong)] bg-ink-950 px-4 py-3.5 font-mono text-sm text-mist-100 outline-none transition-colors placeholder:text-mist-700 focus:border-signal"
          id="package-query"
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try react, ajv, or @babel/core"
          type="search"
          value={query}
        />
        <button
          className="border border-signal bg-signal px-6 py-3.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-[var(--color-signal-deep)] disabled:cursor-not-allowed disabled:border-[var(--hairline-strong)] disabled:bg-transparent disabled:text-mist-700"
          disabled={state.status === "loading"}
          type="submit"
        >
          {state.status === "loading" ? "Searching…" : "Search"}
        </button>
      </form>

      <div aria-live="polite" className="mt-5 min-h-28">
        {state.status === "idle" && (
          <div className="border border-[var(--hairline)] bg-ink-950 px-5 py-5">
            <div className="flex flex-wrap items-center gap-3 text-xs text-mist-300">
              <span className="font-mono">npm catalog</span>
              <svg aria-hidden="true" className="h-3 w-8 text-mist-700" fill="none" viewBox="0 0 32 12">
                <path d="M1 6h27m-4-4 4 4-4 4" stroke="currentColor" />
              </svg>
              <span className="font-mono">package guide</span>
              <svg aria-hidden="true" className="h-3 w-8 text-signal" fill="none" viewBox="0 0 32 12">
                <path d="M1 6h27m-4-4 4 4-4 4" stroke="currentColor" />
              </svg>
              <span className="font-mono">indexed graph</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-mist-600">
              Every public package is discoverable. Dependency traversal begins
              only when Ripple has indexed an exact release.
            </p>
          </div>
        )}

        {state.status === "loading" && (
          <div className="space-y-3" role="status">
            <p className="font-mono text-xs text-mist-500">
              searching the public npm catalog…
            </p>
            <div className="h-16 border border-[var(--hairline)] bg-ink-800" />
            <div className="h-16 border border-[var(--hairline)] bg-ink-800" />
          </div>
        )}

        {state.status === "error" && (
          <div className="border border-rose/30 bg-rose/[0.06] px-5 py-4">
            <p className="text-sm font-semibold text-rose">Search unavailable</p>
            <p className="mt-1 text-sm leading-6 text-mist-500">{state.message}</p>
          </div>
        )}

        {state.status === "success" &&
          (state.response.data.packages.length === 0 ? (
            <div className="border border-[var(--hairline)] bg-ink-950 px-5 py-5">
              <p className="text-sm font-semibold text-mist-100">
                No public package found
              </p>
              <p className="mt-1 text-sm leading-6 text-mist-500">
                Check the package spelling or try a broader search term.
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-mist-600">
                {state.response.data.packages.length} result
                {state.response.data.packages.length === 1 ? "" : "s"}
              </p>
              <ul className="stagger border-t border-[var(--hairline)]">
                {state.response.data.packages.map((packageResult) => (
                  <li className="border-b border-[var(--hairline)]" key={packageResult.name}>
                    <Link
                      className="group grid gap-3 px-4 py-5 transition-colors hover:bg-ink-800 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      href={packageHref(packageResult.name)}
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2.5">
                          <span className="break-all font-mono text-sm font-semibold text-mist-100 transition-colors group-hover:text-signal">
                            {packageResult.name}
                          </span>
                          <span
                            className={`border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.08em] ${
                              packageResult.graphStatus === "indexed"
                                ? "border-signal/40 bg-signal/[0.07] text-signal"
                                : "border-[var(--hairline)] text-mist-600"
                            }`}
                          >
                            {packageResult.graphStatus === "indexed"
                              ? `${packageResult.indexedVersionCount} graph version${packageResult.indexedVersionCount === 1 ? "" : "s"}`
                              : packageResult.graphStatus === "unavailable"
                                ? "graph status unavailable"
                                : "npm catalog"}
                          </span>
                        </span>
                        {packageResult.description && (
                          <span className="mt-2 line-clamp-2 block text-sm leading-6 text-mist-500">
                            {packageResult.description}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-3 font-mono text-[0.68rem] text-mist-600">
                        {packageResult.latestVersion && (
                          <span>latest {packageResult.latestVersion}</span>
                        )}
                        <svg aria-hidden="true" className="h-4 w-5 transition-colors group-hover:text-signal" fill="none" viewBox="0 0 20 16">
                          <path d="M1 8h16m-5-5 5 5-5 5" stroke="currentColor" />
                        </svg>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-4 space-y-1 font-mono text-[0.68rem] text-mist-600">
                <p>{state.response.meta.catalogScope}</p>
                <p>Graph badges: {state.response.meta.scope}</p>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
