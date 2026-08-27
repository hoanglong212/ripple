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
      className="border border-[var(--hairline)] bg-ink-850 p-5 sm:p-7"
    >
      <div className="mb-5">
        <h2
          className="text-xl font-semibold tracking-[-0.025em] text-mist-100"
          id="search-heading"
        >
          Find an indexed package
        </h2>
        <p className="mt-2 text-sm leading-6 text-mist-500">
          Select a package, then choose the exact release you want to inspect.
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
          placeholder="ajv, @hapi/hoek, @babel/core"
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
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-mist-300">
              <span>Package</span>
              <span className="text-signal">→</span>
              <span>Exact version</span>
              <span className="text-signal">→</span>
              <span>Dependency truth</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-mist-600">
              Analysis never begins from a package-level dependency guess.
            </p>
          </div>
        )}

        {state.status === "loading" && (
          <div className="space-y-3" role="status">
            <p className="font-mono text-xs text-mist-500">
              searching the indexed snapshot…
            </p>
            <div className="h-16 border border-[var(--hairline)] bg-ink-800" />
            <div className="h-16 border border-[var(--hairline)] bg-ink-800" />
          </div>
        )}

        {state.status === "error" && (
          <div className="border-l-2 border-l-rose bg-rose/[0.06] px-5 py-4">
            <p className="text-sm font-semibold text-rose">Search unavailable</p>
            <p className="mt-1 text-sm leading-6 text-mist-500">{state.message}</p>
          </div>
        )}

        {state.status === "success" &&
          (state.response.data.packages.length === 0 ? (
            <div className="border border-[var(--hairline)] bg-ink-950 px-5 py-5">
              <p className="text-sm font-semibold text-mist-100">
                No indexed package found
              </p>
              <p className="mt-1 text-sm leading-6 text-mist-500">
                Try another identity. Ripple is a curated snapshot, not the full
                npm ecosystem.
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
                      className="group flex items-center justify-between gap-4 px-1 py-4 transition-colors hover:bg-ink-800"
                      href={packageHref(packageResult.name)}
                    >
                      <span className="min-w-0 px-3">
                        <span className="block break-all font-mono text-sm font-semibold text-mist-100 transition-colors group-hover:text-signal">
                          {packageResult.name}
                        </span>
                        <span className="mt-1 block font-mono text-[0.7rem] text-mist-600">
                          {packageResult.indexedVersionCount} indexed version
                          {packageResult.indexedVersionCount === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="mr-3 shrink-0 font-mono text-mist-600 transition-colors group-hover:text-signal"
                      >
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-4 font-mono text-[0.7rem] text-mist-600">
                {state.response.meta.scope}
              </p>
            </div>
          ))}
      </div>
    </section>
  );
}
