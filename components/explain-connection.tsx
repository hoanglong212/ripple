"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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

function packageNameFromVersionId(versionId: string): string {
  const separator = versionId.lastIndexOf("@");
  return separator > 0 ? versionId.slice(0, separator) : versionId;
}

function versionHref(versionId: string): string {
  const packageName = packageNameFromVersionId(versionId);
  const packagePath = packageName.split("/").map(encodeURIComponent).join("/");
  return `/packages/${packagePath}?version=${encodeURIComponent(versionId)}`;
}

const CURATED_TARGETS: Record<string, string> = {
  "@babel/core@8.0.1": "picocolors@1.1.1",
};

export function ExplainConnection({
  initialTargetVersionId,
  sourceVersionId,
  targetSuggestions,
}: {
  initialTargetVersionId?: string;
  sourceVersionId: string;
  targetSuggestions: DirectDependency[];
}) {
  const preferredTarget =
    initialTargetVersionId ?? CURATED_TARGETS[sourceVersionId] ?? "";
  const [targetVersionId, setTargetVersionId] = useState(preferredTarget);
  const [state, setState] = useState<ExplainState>({ status: "idle" });
  const activeRequest = useRef<AbortController | null>(null);
  const hasUserEditedTarget = useRef(false);

  const suggestions = Array.from(
    new Set(
      [
        preferredTarget,
        ...targetSuggestions.map((item) => item.dependencyVersionId),
      ].filter((versionId): versionId is string => versionId !== ""),
    ),
  );
  const firstSuggestion = suggestions[0] ?? "";

  const requestExplanation = useCallback(
    async (target: string) => {
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
    },
    [sourceVersionId],
  );

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
    if (
      hasUserEditedTarget.current ||
      targetVersionId !== "" ||
      firstSuggestion === ""
    ) {
      return;
    }

    setTargetVersionId(firstSuggestion);
  }, [firstSuggestion, targetVersionId]);

  useEffect(() => {
    if (preferredTarget === "") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void requestExplanation(preferredTarget);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [preferredTarget, requestExplanation]);

  async function explainConnection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = targetVersionId.trim();
    if (target === "") {
      setState({ status: "idle" });
      return;
    }

    await requestExplanation(target);
  }

  return (
    <section
      aria-labelledby="explain-heading"
      className="border border-[var(--hairline)] bg-ink-850 p-6 sm:p-8 lg:p-10"
      id="explain-path"
    >
      <div>
        <h2
          className="text-3xl font-semibold tracking-[-0.04em] text-mist-100"
          id="explain-heading"
        >
          Why are these versions connected?
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-mist-500">
          Explain Path shows the evidence behind every connection: which exact
          release declared a dependency range and which exact release that range
          resolved to in Ripple&apos;s snapshot.
        </p>
      </div>

      <form
        className="mt-7 grid gap-4 border border-[var(--hairline)] bg-ink-950 p-5 text-mist-100 sm:grid-cols-[1fr_auto] sm:items-end sm:p-6"
        onSubmit={explainConnection}
      >
        <div>
          <div className="mb-4 flex min-w-0 items-center gap-2 text-xs text-mist-600">
            <span className="shrink-0 font-semibold">Tracing from</span>
            <code className="truncate border-l border-signal bg-ink-800 px-2 py-1 text-mist-100">
              {sourceVersionId}
            </code>
          </div>
          <label
            className="mb-2 block text-xs font-semibold text-mist-500"
            htmlFor="target-version"
          >
            Target exact Version ID
          </label>
          <input
            className="w-full border border-[var(--hairline-strong)] bg-ink-850 px-4 py-3.5 font-mono text-sm text-mist-100 outline-none placeholder:text-mist-600 focus:border-signal focus:ring-2 focus:ring-signal/30"
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
          {suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-semibold text-mist-600">
                Suggested targets
              </span>
              {suggestions.slice(0, 5).map((versionId) => (
                <button
                  aria-pressed={targetVersionId === versionId}
                  className={`border px-2.5 py-1.5 font-mono text-[0.68rem] transition-colors ${
                    targetVersionId === versionId
                      ? "border-signal bg-signal/10 text-signal"
                      : "border-[var(--hairline)] text-mist-500 hover:border-signal hover:text-mist-200"
                  }`}
                  key={versionId}
                  onClick={() => {
                    hasUserEditedTarget.current = true;
                    setTargetVersionId(versionId);
                    void requestExplanation(versionId);
                  }}
                  type="button"
                >
                  {versionId}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="border border-signal bg-signal px-5 py-3.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-[var(--color-signal-deep)] disabled:cursor-not-allowed disabled:border-[var(--hairline)] disabled:bg-ink-800 disabled:text-mist-700"
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
            <p className="flex items-center gap-2 text-sm font-medium text-mist-500">
              <span className="size-2 bg-signal" />
              Finding the shortest dependency path…
            </p>
            <div className="h-48 bg-ink-800" />
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
    <div className="reveal-up border border-[var(--hairline)] bg-ink-800/40 p-5 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-[var(--hairline)] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-mist-100">
            Why this path exists
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-mist-500">
            This is the shortest chain of direct dependency declarations that
            connects the selected source and target.
          </p>
        </div>
        <p className="w-fit bg-signal px-3 py-1.5 font-mono text-xs font-semibold text-ink-950">
          {explanation.hops} {explanation.hops === 1 ? "hop" : "hops"}
        </p>
      </div>

      <ol className="divide-y divide-[var(--hairline)]">
        {explanation.relationships.map((relationship, index) => (
          <li className="py-6" key={`${relationship.fromVersionId}\0${relationship.toVersionId}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-mist-600">
                Hop {index + 1}
              </span>
              <span className="flex items-center gap-2 text-xs text-mist-600">
                Declared requirement
                <code className="border border-signal/30 bg-signal/[0.07] px-2.5 py-1 font-semibold text-signal">
                  {relationship.requirement}
                </code>
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] sm:items-center">
              <Link
                className="min-w-0 border border-[var(--hairline)] bg-ink-800 px-4 py-3 transition-colors hover:border-signal"
                href={versionHref(relationship.fromVersionId)}
              >
                <span className="block text-[0.65rem] font-semibold text-signal">
                  Declaring release
                </span>
                <code className="mt-1.5 block break-all text-xs font-semibold text-mist-100">
                  {relationship.fromVersionId}
                </code>
              </Link>

              <div className="flex flex-col items-center gap-1.5 text-center">
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-mist-600">
                  resolves to
                </span>
                <svg aria-hidden="true" className="h-4 w-full text-signal" fill="none" viewBox="0 0 80 16">
                  <path d="M1 8h73m-5-5 5 5-5 5" stroke="currentColor" />
                </svg>
              </div>

              <Link
                className="min-w-0 border border-amber/40 bg-amber/[0.05] px-4 py-3 transition-colors hover:border-amber"
                href={versionHref(relationship.toVersionId)}
              >
                <span className="block text-[0.65rem] font-semibold text-amber">
                  Resolved exact dependency
                </span>
                <code className="mt-1.5 block break-all text-xs font-semibold text-mist-100">
                  {relationship.toVersionId}
                </code>
              </Link>
            </div>

            {/*
              Only the first hop is spelled out in prose. Once the reader knows
              how to read a hop, repeating the same sentence for every remaining
              hop adds height without adding information.
            */}
            {index === 0 && (
              <p className="mt-4 max-w-4xl text-sm leading-6 text-mist-500">
                <code className="text-mist-200">{relationship.fromVersionId}</code>{" "}
                declared <code className="text-mist-200">{packageNameFromVersionId(relationship.toVersionId)}</code>{" "}
                with the range <code className="text-signal">{relationship.requirement}</code>.
                In Ripple&apos;s indexed snapshot, that declaration resolved to{" "}
                <code className="text-amber">{relationship.toVersionId}</code>. Every
                hop below reads the same way: a declared range on the left, the
                exact release it resolved to on the right.
              </p>
            )}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 border-t border-[var(--hairline)] pt-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-mist-200">What Ripple proves</p>
          <p className="mt-2 text-xs leading-5 text-mist-600">
            Every hop is a direct DEPENDS_ON declaration with a non-empty
            requirement and an exact resolved target.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-mist-200">What metadata cannot prove</p>
          <p className="mt-2 text-xs leading-5 text-mist-600">
            Dependency metadata does not record the maintainer&apos;s product or
            implementation rationale. Ripple explains the technical connection,
            not undocumented intent.
          </p>
        </div>
        <p className="font-mono text-[0.65rem] text-mist-700 sm:col-span-2">
          {explanation.datasetQualifier}
        </p>
      </div>
    </div>
  );
}

function MessageCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="border border-[var(--hairline)] bg-ink-800 px-6 py-6">
      <span className="mb-4 grid size-9 place-items-center bg-ink-850 font-mono text-sm font-semibold text-mist-600">
        —
      </span>
      <p className="font-semibold text-mist-100">{title}</p>
      <p className="mt-1 text-sm leading-6 text-mist-500">{message}</p>
    </div>
  );
}
