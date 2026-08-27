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
  const hasUserEditedTarget = useRef(false);

  const suggestions = Array.from(
    new Set(targetSuggestions.map((item) => item.dependencyVersionId)),
  );
  const firstSuggestion = suggestions[0] ?? "";

  useEffect(
    () => () => {
      activeRequest.current?.abort();
    },
    [],
  );

  // Direct dependencies arrive after this component mounts. Seed the field with
  // the first one so the form is runnable without typing an exact Version ID,
  // but never overwrite a target the user has already touched.
  useEffect(() => {
    if (hasUserEditedTarget.current || firstSuggestion === "") {
      return;
    }

    setTargetVersionId(firstSuggestion);
  }, [firstSuggestion]);

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

  return (
    <section
      aria-labelledby="explain-heading"
      className="border border-violet-200 bg-white p-6 shadow-[0_24px_60px_-50px_rgba(124,58,237,0.55)] sm:p-8 lg:p-10"
    >
      <div>
        <p className="text-sm font-medium text-violet-700">
          Why are these versions connected?
        </p>
        <h2
          className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-zinc-950"
          id="explain-heading"
        >
          Explain Path
        </h2>
        <p className="mt-2 max-w-2xl text-base leading-6 text-zinc-600">
          Follow the shortest directed dependency chain from this release to
          another exact indexed version.
        </p>
      </div>

      <div className="mt-7 grid gap-3 border border-violet-200 bg-violet-50/60 p-5 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
        <div>
          <p className="text-xs font-medium text-violet-700">1 · Source</p>
          <code className="mt-2 block truncate text-xs font-semibold text-zinc-950">
            {sourceVersionId}
          </code>
        </div>
        <span aria-hidden="true" className="hidden text-violet-400 sm:block">→</span>
        <div>
          <p className="text-xs font-medium text-violet-700">2 · Ripple traces</p>
          <p className="mt-2 text-xs text-zinc-600">Every release and requirement</p>
        </div>
        <span aria-hidden="true" className="hidden text-violet-400 sm:block">→</span>
        <div>
          <p className="text-xs font-medium text-violet-700">3 · Target</p>
          <p className="mt-2 text-xs text-zinc-600">The exact version you choose</p>
        </div>
      </div>

      <form
        className="mt-5 grid gap-4 border border-violet-200 bg-[#17132c] p-5 text-white sm:grid-cols-[1fr_auto] sm:items-end sm:p-6"
        onSubmit={explainConnection}
      >
        <div>
          <div className="mb-4 flex min-w-0 items-center gap-2 text-xs text-violet-200/70">
            <span className="shrink-0 font-semibold">Source</span>
            <code className="truncate border-l border-violet-400 bg-white/10 px-2 py-1 text-white">
              {sourceVersionId}
            </code>
          </div>
          <label
            className="mb-2 block text-xs font-semibold text-violet-200"
            htmlFor="target-version"
          >
            Target exact Version ID
          </label>
          <input
            className="w-full border border-violet-300 bg-white px-4 py-3.5 font-mono text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
            id="target-version"
            list="target-version-suggestions"
            onChange={(event) => {
              hasUserEditedTarget.current = true;
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
          className="bg-violet-500 px-5 py-3.5 text-sm font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
          disabled={targetVersionId.trim() === "" || state.status === "loading"}
          type="submit"
        >
          {state.status === "loading" ? "Finding path…" : "Explain connection"}
        </button>
      </form>

      <div className="mt-5">
        {state.status === "idle" && (
          <MessageCard
            message={
              targetVersionId.trim() === ""
                ? "Choose a suggested dependency or enter any exact indexed Version ID."
                : "Run Explain connection to trace the shortest directed path, or replace the target with any other exact indexed Version ID."
            }
            title={
              targetVersionId.trim() === ""
                ? "No target selected"
                : "Ready to explain"
            }
          />
        )}
        {state.status === "loading" && (
          <div className="space-y-3" role="status">
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-600">
              <span className="size-2 rounded-full bg-blue-600" />
              Finding the shortest dependency path…
            </p>
            <div className="h-48 bg-zinc-100" />
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
    <div className="result-reveal border border-violet-200 bg-violet-50/40 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4 border-b border-violet-200 pb-4">
        <div>
          <p className="font-semibold text-zinc-950">Shortest dependency path</p>
          <p className="mt-1 text-xs text-zinc-500">
            Within Ripple&apos;s indexed npm snapshot.
          </p>
        </div>
        <p className="rounded-full bg-violet-600 px-3 py-1.5 font-mono text-xs font-semibold text-white">
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
                <p
                  className={`text-xs font-semibold ${
                    isSource
                      ? "text-violet-700"
                      : isTarget
                        ? "text-orange-700"
                        : "text-cyan-700"
                  }`}
                >
                  {isSource ? "Source" : isTarget ? "Target" : "Dependency"}
                </p>
                <div
                  className={`mt-1.5 border px-4 py-3 ${
                    isSource || isTarget
                      ? isSource
                        ? "border-violet-300 bg-violet-50"
                        : "border-orange-300 bg-orange-50"
                      : "border-cyan-200 bg-cyan-50/70"
                  }`}
                >
                  <code className="block break-all text-sm font-semibold text-zinc-950">
                    {versionId}
                  </code>
                </div>
              </li>
              {relationship && (
                <li
                  aria-label={`Requires ${relationship.requirement}`}
                  className="my-2 flex items-center gap-3 pl-4 text-violet-400"
                >
                  <span aria-hidden="true" className="text-lg leading-none">
                    ↓
                  </span>
                  <span className="text-xs font-semibold text-zinc-500">
                    DEPENDS_ON
                  </span>
                  <code className="border border-violet-200 bg-white px-2 py-1 text-xs font-semibold text-violet-900">
                    requirement {relationship.requirement}
                  </code>
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>

      <p className="mt-6 border-t border-violet-200 pt-4 text-xs text-zinc-500">
        Each connector is one directed DEPENDS_ON relationship declared by the
        version above it. {explanation.datasetQualifier}
      </p>
    </div>
  );
}

function MessageCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="border border-zinc-200 bg-zinc-50 px-6 py-6">
      <span className="mb-4 grid size-9 place-items-center bg-white font-mono text-sm font-semibold text-zinc-500">
        —
      </span>
      <p className="font-semibold text-zinc-950">{title}</p>
      <p className="mt-1 text-sm leading-6 text-zinc-600">{message}</p>
    </div>
  );
}
