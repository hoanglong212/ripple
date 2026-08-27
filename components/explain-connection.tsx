"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type {
  DirectDependency,
  ExplainPath,
} from "@/lib/domain/packages";

interface ErrorResponse {
  meta?: { error?: { code?: string; message?: string } };
}

interface ExplainPathResponse {
  data: { path: ExplainPath };
  meta: { scope: string };
}

type ExplainState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; explanation: ExplainPath }
  | { status: "missing"; message: string }
  | { status: "error"; message: string };

function apiPath(identity: string): string {
  return `/api/versions/${identity
    .split("/")
    .map(encodeURIComponent)
    .join("/")}/path`;
}

export function ExplainConnection({
  sourceVersionId,
  targetSuggestions,
}: {
  sourceVersionId: string;
  targetSuggestions: DirectDependency[];
}) {
  const [targetVersionId, setTargetVersionId] = useState("");
  const [state, setState] = useState<ExplainState>({ status: "idle" });
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      activeRequest.current?.abort();
    },
    [],
  );

  async function explainConnection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = targetVersionId.trim();
    if (target === "") {
      setState({ status: "idle" });
      return;
    }

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setState({ status: "loading" });

    try {
      const response = await fetch(
        `${apiPath(sourceVersionId)}?target=${encodeURIComponent(target)}`,
        {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        const payload: ErrorResponse = await response.json();
        const message =
          payload.meta?.error?.message ??
          "Ripple’s graph is temporarily unavailable.";
        setState({
          status:
            payload.meta?.error?.code === "VERSION_NOT_INDEXED"
              ? "missing"
              : "error",
          message,
        });
        return;
      }

      const payload: ExplainPathResponse = await response.json();
      setState({ status: "success", explanation: payload.data.path });
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Ripple’s graph is temporarily unavailable.",
        });
      }
    }
  }

  const suggestions = Array.from(
    new Set(targetSuggestions.map((item) => item.dependencyVersionId)),
  );

  return (
    <section
      aria-labelledby="explain-heading"
      className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8"
    >
      <div className="flex gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cyan-50 font-mono text-xs font-semibold text-cyan-800">
          03
        </span>
        <div>
          <h2
            className="text-2xl font-semibold tracking-[-0.025em] text-slate-950"
            id="explain-heading"
          >
            Explain connection
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Find the shortest directed dependency path from the selected source
            to another exact indexed version.
          </p>
        </div>
      </div>

      <form
        className="mt-6 grid gap-4 rounded-2xl bg-slate-950 p-5 sm:grid-cols-[1fr_auto] sm:items-end sm:p-6"
        onSubmit={explainConnection}
      >
        <div>
          <div className="mb-4 flex min-w-0 items-center gap-2 text-xs text-slate-400">
            <span className="shrink-0 uppercase tracking-[0.12em]">Source</span>
            <code className="truncate rounded-md bg-white/10 px-2 py-1 text-slate-200">
              {sourceVersionId}
            </code>
          </div>
          <label
            className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300"
            htmlFor="target-version"
          >
            Target exact Version ID
          </label>
          <input
            className="w-full rounded-xl border border-white/10 bg-white px-4 py-3.5 font-mono text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/25"
            id="target-version"
            list="target-version-suggestions"
            onChange={(event) => {
              setTargetVersionId(event.target.value);
              setState({ status: "idle" });
            }}
            placeholder="picocolors@1.1.1"
            value={targetVersionId}
          />
          <datalist id="target-version-suggestions">
            {suggestions.map((versionId) => (
              <option key={versionId} value={versionId} />
            ))}
          </datalist>
        </div>
        <button
          className="rounded-xl bg-cyan-400 px-5 py-3.5 text-sm font-semibold text-cyan-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/60"
          disabled={targetVersionId.trim() === "" || state.status === "loading"}
          type="submit"
        >
          {state.status === "loading" ? "Finding path…" : "Explain connection"}
        </button>
      </form>

      <div className="mt-5">
        {state.status === "idle" && (
          <MessageCard
            message="Choose a suggested dependency or enter any exact indexed Version ID."
            title="No target selected"
          />
        )}
        {state.status === "loading" && (
          <div className="space-y-3" role="status">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <span className="size-2 rounded-full bg-cyan-500" />
              Finding the shortest dependency path…
            </p>
            <div className="h-48 rounded-2xl bg-slate-100" />
          </div>
        )}
        {(state.status === "missing" || state.status === "error") && (
          <MessageCard
            message={state.message}
            title={
              state.status === "missing"
                ? "Version not indexed"
                : "Database unavailable"
            }
          />
        )}
        {state.status === "success" &&
          (state.explanation.path.length === 0 ? (
            <MessageCard
              message="No directed dependency path was found within Ripple’s five-hop traversal bound."
              title="No path found"
            />
          ) : (
            <PathResult explanation={state.explanation} />
          ))}
      </div>
    </section>
  );
}

function PathResult({ explanation }: { explanation: ExplainPath }) {
  return (
    <div className="surface-grid rounded-2xl border border-slate-200 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="font-semibold text-slate-950">Shortest dependency path</p>
          <p className="mt-1 text-xs text-slate-500">
            Within Ripple&apos;s indexed npm snapshot.
          </p>
        </div>
        <p className="rounded-full bg-slate-950 px-3 py-1.5 font-mono text-xs font-semibold text-white">
          {explanation.hops} {explanation.hops === 1 ? "hop" : "hops"}
        </p>
      </div>

      <ol className="mt-6 max-w-2xl">
        {explanation.path.map((versionId, index) => {
          const relationship = explanation.relationships[index];
          const isSource = index === 0;
          const isTarget = index === explanation.path.length - 1;

          return (
            <Fragment key={versionId}>
              <li>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-cyan-700">
                  {isSource ? "Source" : isTarget ? "Target" : "Dependency"}
                </p>
                <div
                  className={`mt-1.5 rounded-xl border px-4 py-3 ${
                    isSource || isTarget
                      ? "border-slate-300 bg-white"
                      : "border-slate-200 bg-white/70"
                  }`}
                >
                  <code className="block break-all text-sm font-semibold text-slate-950">
                    {versionId}
                  </code>
                </div>
              </li>
              {relationship && (
                <li
                  aria-label={`Requires ${relationship.requirement}`}
                  className="my-2 flex items-center gap-3 pl-4 text-slate-400"
                >
                  <span aria-hidden="true" className="text-lg leading-none">
                    ↓
                  </span>
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    DEPENDS_ON
                  </span>
                  <code className="rounded-md bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-900">
                    requirement {relationship.requirement}
                  </code>
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>

      <p className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">
        Each connector is one directed DEPENDS_ON relationship declared by the
        version above it. {explanation.datasetQualifier}
      </p>
    </div>
  );
}

function MessageCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-6">
      <span className="mb-4 grid size-9 place-items-center rounded-full bg-white font-mono text-sm font-semibold text-slate-500">
        —
      </span>
      <p className="font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{message}</p>
    </div>
  );
}
