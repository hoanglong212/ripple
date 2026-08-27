"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  DownstreamImpact,
  IndexedVersion,
  PackageDetail,
  VersionDetail,
} from "@/lib/domain/packages";
import { ExplainConnection } from "@/components/explain-connection";

interface PackageResponse {
  data: { package: PackageDetail };
  meta: { scope: string };
}

interface VersionResponse {
  data: { version: VersionDetail };
  meta: { scope: string };
}

interface ImpactResponse {
  data: { impact: DownstreamImpact };
  meta: { scope: string };
}

interface ErrorResponse {
  meta?: { error?: { code?: string; message?: string } };
}

type PackageState =
  | { status: "loading" }
  | { status: "success"; response: PackageResponse }
  | { status: "missing"; message: string }
  | { status: "error"; message: string };

type VersionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; response: VersionResponse }
  | { status: "missing"; message: string }
  | { status: "error"; message: string };

type ImpactState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; response: ImpactResponse }
  | { status: "missing"; message: string }
  | { status: "error"; message: string };

function apiPath(prefix: string, identity: string): string {
  return `${prefix}/${identity.split("/").map(encodeURIComponent).join("/")}`;
}

async function readError(response: Response): Promise<{
  code?: string;
  message: string;
}> {
  const payload: ErrorResponse = await response.json();
  return {
    code: payload.meta?.error?.code,
    message:
      payload.meta?.error?.message ??
      "Ripple’s graph is temporarily unavailable.",
  };
}

export function PackageDetailView({ packageName }: { packageName: string }) {
  const [packageState, setPackageState] = useState<PackageState>({
    status: "loading",
  });
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [versionState, setVersionState] = useState<VersionState>({
    status: "idle",
  });
  const [impactState, setImpactState] = useState<ImpactState>({
    status: "idle",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadPackage() {
      setPackageState({ status: "loading" });

      try {
        const response = await fetch(apiPath("/api/packages", packageName), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) {
          const error = await readError(response);
          setPackageState({
            status: error.code === "PACKAGE_NOT_INDEXED" ? "missing" : "error",
            message: error.message,
          });
          return;
        }

        const payload: PackageResponse = await response.json();
        setPackageState({ status: "success", response: payload });
        setSelectedVersionId(payload.data.package.versions[0]?.id ?? "");
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setPackageState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Ripple’s graph is temporarily unavailable.",
          });
        }
      }
    }

    void loadPackage();
    return () => controller.abort();
  }, [packageName]);

  useEffect(() => {
    if (selectedVersionId === "") {
      return;
    }

    const controller = new AbortController();

    async function loadVersion() {
      setVersionState({ status: "loading" });

      try {
        const response = await fetch(
          apiPath("/api/versions", selectedVersionId),
          {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          const error = await readError(response);
          setVersionState({
            status: error.code === "VERSION_NOT_INDEXED" ? "missing" : "error",
            message: error.message,
          });
          return;
        }

        const payload: VersionResponse = await response.json();
        setVersionState({ status: "success", response: payload });
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setVersionState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Ripple’s graph is temporarily unavailable.",
          });
        }
      }
    }

    void loadVersion();
    return () => controller.abort();
  }, [selectedVersionId]);

  useEffect(() => {
    if (selectedVersionId === "") {
      return;
    }

    const controller = new AbortController();

    async function loadImpact() {
      setImpactState({ status: "loading" });

      try {
        const response = await fetch(
          `${apiPath("/api/versions", selectedVersionId)}/impact`,
          {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          const error = await readError(response);
          setImpactState({
            status: error.code === "VERSION_NOT_INDEXED" ? "missing" : "error",
            message: error.message,
          });
          return;
        }

        const payload: ImpactResponse = await response.json();
        setImpactState({ status: "success", response: payload });
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setImpactState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Ripple’s graph is temporarily unavailable.",
          });
        }
      }
    }

    void loadImpact();
    return () => controller.abort();
  }, [selectedVersionId]);

  if (packageState.status === "loading") {
    return (
      <div className="space-y-6" role="status">
        <div className="flex items-center gap-3 text-sm font-semibold text-zinc-600">
          <span className="size-2 rounded-full bg-blue-600" />
          Loading package identity and indexed versions…
        </div>
        <div className="h-64 border border-zinc-200 bg-white" />
        <div className="h-80 border border-zinc-200 bg-white" />
      </div>
    );
  }

  if (packageState.status === "missing") {
    return (
      <StatusCard
        action
        message={packageState.message}
        title="Package not indexed"
      />
    );
  }

  if (packageState.status === "error") {
    return (
      <StatusCard
        action
        message={packageState.message}
        title="Database unavailable"
        tone="error"
      />
    );
  }

  const packageDetail = packageState.response.data.package;
  const versionCount = packageDetail.versions.length;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden border border-violet-200 bg-white shadow-[0_24px_60px_-48px_rgba(76,29,149,0.5)]">
        <div className="grid lg:grid-cols-[1fr_22rem]">
          <div className="p-6 sm:p-9 lg:p-10">
            <p className="text-sm font-medium text-violet-700">Package identity</p>
            <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-3">
              <h1 className="break-all font-mono text-4xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-6xl">
                {packageDetail.name}
              </h1>
              <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-800">
                {versionCount} indexed version{versionCount === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-8 max-w-2xl border-l border-violet-500 pl-5">
              <h2 className="text-base font-semibold text-zinc-950">Why versions matter</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                Different releases can resolve different dependency trees.
              </p>
            </div>
            <p className="mt-8 text-xs text-zinc-500">
              {packageState.response.meta.scope}
            </p>
          </div>

          <div className="flex flex-col justify-between border-t border-violet-200 bg-violet-50/70 p-6 sm:p-8 lg:border-l lg:border-t-0">
            <div>
              <p className="text-sm font-semibold text-zinc-950">Indexed version selector</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Choose the exact release Ripple should use for every answer below.
              </p>
              {selectedVersionId !== "" && (
                <div className="mt-5 border border-violet-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white">
                      V
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.68rem] text-violet-700">All analysis starts from</p>
                      <code className="mt-1 block truncate text-xs font-semibold text-zinc-950">
                        {selectedVersionId}
                      </code>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {versionCount > 0 ? (
              <VersionSelector
                onSelect={setSelectedVersionId}
                selectedVersionId={selectedVersionId}
                versions={packageDetail.versions}
              />
            ) : (
              <p className="mt-8 text-sm font-semibold text-zinc-700">
                No indexed versions
              </p>
            )}
          </div>
        </div>
      </section>

      {selectedVersionId !== "" && (
        <AnalysisGuide selectedVersionId={selectedVersionId} />
      )}

      <section
        aria-labelledby="dependencies-heading"
        className="border border-cyan-200 bg-white p-6 shadow-[0_24px_60px_-50px_rgba(8,145,178,0.55)] sm:p-8 lg:p-10"
      >
        <SectionHeader
          description="This release depends on:"
          meta={
            versionState.status === "success"
              ? `${versionState.response.data.version.dependencies.length} direct`
              : undefined
          }
          id="dependencies-heading"
          question="What does this exact release depend on?"
          title="Dependency Truth"
        />

        {selectedVersionId !== "" && (
          <div className="mt-7 flex flex-col gap-3 border-y border-cyan-200 bg-cyan-50/60 px-4 py-4 text-xs sm:flex-row sm:items-center sm:gap-4">
            <code className="break-all font-semibold text-zinc-900">
              {selectedVersionId}
            </code>
            <span className="shrink-0 font-mono font-semibold text-cyan-700">
              DEPENDS_ON {"{ requirement }"} →
            </span>
            <span className="font-mono text-zinc-500">exact Version</span>
          </div>
        )}

        {packageDetail.versions.length === 0 && (
          <StatusCard
            message="This package currently has no indexed versions."
            title="No indexed versions"
          />
        )}

        {selectedVersionId !== "" && versionState.status === "loading" && (
          <LoadingPanel label="Loading direct dependency edges…" rows={3} />
        )}

        {selectedVersionId !== "" &&
          (versionState.status === "error" || versionState.status === "missing") && (
          <StatusCard
            message={versionState.message}
            tone={versionState.status === "error" ? "error" : "neutral"}
            title={
              versionState.status === "missing"
                ? "Version not indexed"
                : "Database unavailable"
            }
          />
        )}

        {selectedVersionId !== "" &&
          versionState.status === "success" &&
          (versionState.response.data.version.dependencies.length === 0 ? (
            <StatusCard
              message="This exact version has no outgoing dependency edges in Ripple’s indexed snapshot."
              title="No direct dependencies"
            />
          ) : (
            <div className="result-reveal">
              <DependencyEdgeExample
                dependency={versionState.response.data.version.dependencies[0]}
                sourceVersionId={selectedVersionId}
              />
              <div className="mt-8 flex items-center justify-between gap-4">
                <h3 className="text-sm font-semibold text-zinc-950">
                  All direct dependencies
                </h3>
                <p className="text-xs text-zinc-500">
                  Resolved from this release
                </p>
              </div>
              <ul className="mt-3 divide-y divide-cyan-100 border-y border-cyan-100">
                {versionState.response.data.version.dependencies.map(
                  (dependency) => (
                    <li
                      className="flex min-w-0 items-center justify-between gap-4 py-4"
                      key={`${dependency.dependencyVersionId}\0${dependency.requirement}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="size-2 shrink-0 rounded-full bg-cyan-400" />
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-semibold text-zinc-950">
                            {dependency.dependencyPackageName}
                          </p>
                          <p className="mt-1 break-all font-mono text-xs text-zinc-500">
                            {dependency.dependencyVersionId}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="block text-xs text-zinc-500">
                          requires
                        </span>
                        <code className="mt-1 block border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800">
                          {dependency.requirement}
                        </code>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
      </section>

      <section
        aria-labelledby="impact-heading"
        className="border border-emerald-200 bg-white p-6 shadow-[0_24px_60px_-50px_rgba(5,150,105,0.45)] sm:p-8 lg:p-10"
      >
        <SectionHeader
          description="Who depends on this exact release?"
          id="impact-heading"
          question="Who is affected if this release changes?"
          title="Impact"
        />

        {selectedVersionId !== "" && impactState.status === "loading" && (
          <LoadingPanel label="Tracing incoming dependency paths…" rows={2} />
        )}

        {selectedVersionId !== "" &&
          (impactState.status === "error" || impactState.status === "missing") && (
            <StatusCard
              message={impactState.message}
              tone={impactState.status === "error" ? "error" : "neutral"}
              title={
                impactState.status === "missing"
                  ? "Version not indexed"
                  : "Database unavailable"
              }
            />
          )}

        {selectedVersionId !== "" && impactState.status === "success" && (
          <ImpactResults impact={impactState.response.data.impact} />
        )}
      </section>

      {selectedVersionId !== "" && (
        <ExplainConnection
          key={selectedVersionId}
          sourceVersionId={selectedVersionId}
          targetSuggestions={
            versionState.status === "success"
              ? versionState.response.data.version.dependencies
              : []
          }
        />
      )}
    </div>
  );
}

function AnalysisGuide({ selectedVersionId }: { selectedVersionId: string }) {
  const steps = [
    {
      color: "bg-cyan-100 text-cyan-800",
      description: "Outgoing arrows show what this release needs.",
      label: "Dependencies",
      path: "source → dependency",
    },
    {
      color: "bg-emerald-100 text-emerald-800",
      description: "Incoming paths show which releases could be affected.",
      label: "Impact",
      path: "affected version → source",
    },
    {
      color: "bg-violet-100 text-violet-800",
      description: "A chain explains every step between two releases.",
      label: "Explain Path",
      path: "source → … → target",
    },
  ] as const;

  return (
    <section
      aria-labelledby="analysis-guide-heading"
      className="overflow-hidden border border-violet-200 bg-[#17132c] text-white shadow-[0_24px_60px_-46px_rgba(76,29,149,0.6)]"
    >
      <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
        <div className="p-6 sm:p-8">
          <h2
            className="text-2xl font-semibold tracking-[-0.03em]"
            id="analysis-guide-heading"
          >
            How to read this page
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-violet-100/70">
            Every section keeps{" "}
            <code className="font-semibold text-white">{selectedVersionId}</code>{" "}
            at the center. The direction of the arrows changes the question.
          </p>
        </div>
        <div className="grid border-t border-white/10 sm:grid-cols-3 lg:border-l lg:border-t-0">
          {steps.map((step) => (
            <div
              className="border-b border-white/10 p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
              key={step.label}
            >
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${step.color}`}>
                {step.label}
              </span>
              <code className="mt-4 block text-[0.68rem] text-violet-200">
                {step.path}
              </code>
              <p className="mt-2 text-xs leading-5 text-violet-100/65">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DependencyEdgeExample({
  dependency,
  sourceVersionId,
}: {
  dependency: VersionDetail["dependencies"][number];
  sourceVersionId: string;
}) {
  return (
    <div className="mt-6 overflow-hidden border border-cyan-200 bg-cyan-50/50">
      <div className="border-b border-cyan-200 bg-white px-5 py-4">
        <h3 className="font-semibold text-zinc-950">Worked example: read one edge</h3>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          Ripple separates the declared requirement from the exact release it
          resolved to.
        </p>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)] sm:items-center">
        <div className="border border-violet-200 bg-white p-4">
          <p className="text-xs font-medium text-violet-700">Source release</p>
          <code className="mt-2 block break-all text-sm font-semibold text-zinc-950">
            {sourceVersionId}
          </code>
        </div>
        <div className="relative flex flex-col items-center justify-center gap-2 py-2">
          <code className="rounded-full bg-cyan-600 px-3 py-1 text-xs font-semibold text-white">
            requires {dependency.requirement}
          </code>
          <svg
            aria-hidden="true"
            className="h-5 w-full text-cyan-500"
            preserveAspectRatio="none"
            viewBox="0 0 160 20"
          >
            <path
              className="dependency-edge-signal"
              d="M2 10H150"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            />
            <path d="M145 5L151 10L145 15" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
        <div className="border border-cyan-200 bg-white p-4">
          <p className="text-xs font-medium text-cyan-700">Resolved exact dependency</p>
          <code className="mt-2 block break-all text-sm font-semibold text-zinc-950">
            {dependency.dependencyVersionId}
          </code>
        </div>
      </div>
      <p className="border-t border-cyan-200 px-5 py-4 text-sm leading-6 text-zinc-700">
        Read this as:{" "}
        <code className="font-semibold text-violet-700">{sourceVersionId}</code>{" "}
        declared <code className="font-semibold text-cyan-700">{dependency.requirement}</code>{" "}
        and resolved to{" "}
        <code className="font-semibold text-cyan-700">{dependency.dependencyVersionId}</code>.
      </p>
    </div>
  );
}

// Beyond this many indexed versions the pills stop being scannable and a
// native select is the better control.
const SEGMENTED_SELECTOR_LIMIT = 6;

function VersionSelector({
  onSelect,
  selectedVersionId,
  versions,
}: {
  onSelect: (versionId: string) => void;
  selectedVersionId: string;
  versions: IndexedVersion[];
}) {
  if (versions.length > SEGMENTED_SELECTOR_LIMIT) {
    return (
      <div className="mt-8">
        <label
          className="mb-2 block text-xs font-semibold text-zinc-600"
          htmlFor="indexed-version"
        >
          Exact version
        </label>
        <select
          className="w-full border border-violet-300 bg-white px-4 py-3.5 font-mono text-sm font-semibold text-zinc-950 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
          id="indexed-version"
          onChange={(event) => onSelect(event.target.value)}
          value={selectedVersionId}
        >
          {versions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.version}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <p
        className="mb-2 text-xs font-semibold text-zinc-600"
        id="version-selector-label"
      >
        Exact version
      </p>
      <div
        aria-labelledby="version-selector-label"
        className="flex flex-wrap gap-2"
        role="group"
      >
        {versions.map((version) => {
          const isSelected = version.id === selectedVersionId;

          return (
            <button
              aria-pressed={isSelected}
              className={`border px-4 py-3 font-mono text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${
                isSelected
                  ? "border-violet-600 bg-violet-600 text-white shadow-[0_10px_24px_-12px_rgba(124,58,237,0.85)]"
                  : "border-violet-200 bg-white text-zinc-700 hover:border-violet-500"
              }`}
              key={version.id}
              onClick={() => onSelect(version.id)}
              type="button"
            >
              {version.version}
            </button>
          );
        })}
      </div>
      {versions.length > 1 && (
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          Switch releases to compare dependency truth.
        </p>
      )}
    </div>
  );
}

function ImpactResults({ impact }: { impact: DownstreamImpact }) {
  if (impact.totalReachable === 0) {
    return (
      <StatusCard
        message="No exact versions can reach this version within Ripple’s four-hop traversal bound."
        title="No downstream impact"
      />
    );
  }

  const metrics = [
    ["Direct", impact.directCount],
    ["Transitive", impact.transitiveCount],
    ["Maximum observed depth", impact.maxObservedDepth],
  ] as const;

  const example = impact.affectedVersions[0];

  return (
    <div className="result-reveal mt-7">
      {example && (
        <div className="mb-5 grid gap-4 border border-emerald-200 bg-emerald-50/60 p-5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
          <div>
            <p className="text-xs font-medium text-emerald-800">An affected release</p>
            <code className="mt-2 block break-all text-sm font-semibold text-zinc-950">
              {example.affectedVersionId}
            </code>
          </div>
          <div className="flex items-center gap-2 text-emerald-600">
            <span className="h-px flex-1 bg-emerald-300 sm:w-12" />
            <span className="text-xs font-semibold">
              can reach in {example.hopCount} {example.hopCount === 1 ? "hop" : "hops"}
            </span>
            <span aria-hidden="true">→</span>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-medium text-violet-700">Selected release</p>
            <code className="mt-2 block break-all text-sm font-semibold text-zinc-950">
              {impact.targetVersionId}
            </code>
          </div>
          <p className="text-sm leading-6 text-zinc-600 sm:col-span-3">
            If the selected release changes, versions that depend on it directly
            or through other dependencies may be affected. Ripple follows those
            incoming paths up to four hops.
          </p>
        </div>
      )}
      <div className="grid gap-0 border border-emerald-200 lg:grid-cols-[0.72fr_1.28fr]">
      <div className="bg-[#12372d] p-5 text-white sm:p-6">
        <p className="text-2xl font-semibold tracking-tight">
          {impact.totalReachable} {impact.totalReachable === 1 ? "version" : "versions"}{" "}
          reachable
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          Within Ripple&apos;s indexed npm snapshot.
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-5 lg:grid-cols-1">
          {metrics.map(([label, value]) => (
            <div className="lg:flex lg:items-center lg:justify-between" key={label}>
              <dt className="text-xs leading-5 text-zinc-400">{label}</dt>
              <dd className="mt-1 font-mono text-xl font-semibold text-white lg:mt-0">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="border-t border-emerald-200 p-5 sm:p-6 lg:border-l lg:border-t-0">
        <h3 className="text-sm font-semibold text-zinc-950">
          Affected versions
        </h3>
        <ul className="mt-3 divide-y divide-emerald-100">
          {impact.affectedVersions.map((version) => (
            <li
              className="flex items-start justify-between gap-5 py-3.5"
              key={version.affectedVersionId}
              title={version.pathVersionIds.join(" → ")}
            >
              <div className="min-w-0">
                <code className="break-all text-sm font-semibold text-zinc-950">
                  {version.affectedVersionId}
                </code>
                {version.pathVersionIds.length > 2 && (
                  <p className="mt-1 line-clamp-1 font-mono text-[0.68rem] text-zinc-400">
                    {version.pathVersionIds.join(" → ")}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                {version.hopCount} {version.hopCount === 1 ? "hop" : "hops"}
              </span>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </div>
  );
}

function SectionHeader({
  id,
  title,
  question,
  description,
  meta,
}: {
  id: string;
  title: string;
  question: string;
  description: string;
  meta?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p
          className={`text-sm font-medium ${
            id === "dependencies-heading" ? "text-cyan-700" : "text-emerald-700"
          }`}
        >
          {question}
        </p>
          <h2
            className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-zinc-950"
            id={id}
          >
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-base leading-6 text-zinc-600">
            {description}
          </p>
      </div>
      {meta && (
        <span className="w-fit border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600">
          {meta}
        </span>
      )}
    </div>
  );
}

function LoadingPanel({ label, rows }: { label: string; rows: number }) {
  return (
    <div className="mt-6 space-y-3" role="status">
      <p className="flex items-center gap-2 text-sm font-medium text-zinc-600">
        <span className="size-2 rounded-full bg-blue-600" />
        {label}
      </p>
      {Array.from({ length: rows }, (_, index) => (
        <div className="h-20 bg-zinc-100" key={index} />
      ))}
    </div>
  );
}

function StatusCard({
  title,
  message,
  action = false,
  tone = "neutral",
}: {
  title: string;
  message: string;
  action?: boolean;
  tone?: "neutral" | "error";
}) {
  return (
    <div
      className={`mt-6 border px-6 py-6 ${
        tone === "error"
          ? "border-rose-200 bg-rose-50"
          : "border-zinc-200 bg-zinc-50"
      }`}
    >
      <span
        className={`mb-4 grid size-9 place-items-center rounded-full font-mono text-sm font-semibold ${
          tone === "error"
            ? "bg-rose-100 text-rose-700"
            : "bg-white text-zinc-600"
        }`}
      >
        {tone === "error" ? "!" : "—"}
      </span>
      <p className="font-semibold text-zinc-950">{title}</p>
      <p className="mt-1 text-sm leading-6 text-zinc-600">{message}</p>
      {action && (
        <Link
          className="mt-5 inline-block bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white"
          href="/"
        >
          Return to package search
        </Link>
      )}
    </div>
  );
}
