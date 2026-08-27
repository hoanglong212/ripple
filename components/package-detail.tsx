"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  DownstreamImpact,
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
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
          <span className="size-2 rounded-full bg-cyan-500" />
          Loading package identity and indexed versions…
        </div>
        <div className="h-72 rounded-[2rem] bg-slate-200/70" />
        <div className="h-80 rounded-[2rem] bg-slate-200/60" />
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

  return (
    <div className="space-y-8">
      <section className="surface-grid overflow-hidden rounded-[2rem] border border-slate-200">
        <div className="grid lg:grid-cols-[1fr_21rem]">
          <div className="bg-slate-950 p-7 text-white sm:p-10">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-cyan-400 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-950">
                Package
              </span>
              <span className="text-sm text-slate-400">Identity layer</span>
            </div>
            <h1 className="mt-7 break-all font-mono text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">
              {packageDetail.name}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
              Package identity anchors search. Dependency truth belongs to the
              exact indexed version selected beside it.
            </p>
            {selectedVersionId !== "" && (
              <div className="mt-8 inline-flex max-w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2">
                <span className="size-1.5 shrink-0 rounded-full bg-cyan-400" />
                <code className="truncate text-xs text-slate-200">
                  {selectedVersionId}
                </code>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between p-7 sm:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
                Indexed version selector
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Only versions present in Ripple are available.
              </p>
            </div>
            {packageDetail.versions.length > 0 ? (
              <div className="mt-8">
                <label
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                  htmlFor="indexed-version"
                >
                  Exact version
                </label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 font-mono text-sm font-semibold text-slate-950 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                  id="indexed-version"
                  onChange={(event) => setSelectedVersionId(event.target.value)}
                  value={selectedVersionId}
                >
                  {packageDetail.versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.version}
                    </option>
                  ))}
                </select>
                <p className="mt-3 text-xs text-slate-500">
                  {packageDetail.versions.length} indexed version
                  {packageDetail.versions.length === 1 ? "" : "s"}
                </p>
              </div>
            ) : (
              <p className="mt-8 text-sm font-semibold text-slate-700">
                No indexed versions
              </p>
            )}
          </div>
        </div>
        <div className="border-t border-slate-200 bg-white px-7 py-4 text-xs text-slate-500 sm:px-10">
          {packageState.response.meta.scope}
        </div>
      </section>

      <section
        aria-labelledby="dependencies-heading"
        className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8"
      >
        <SectionHeader
          description="Resolved outgoing dependency edges for the selected exact version."
          meta={
            versionState.status === "success"
              ? `${versionState.response.data.version.dependencies.length} direct`
              : undefined
          }
          number="01"
          title="Direct dependencies"
        />

        {selectedVersionId !== "" && (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs sm:flex-row sm:items-center sm:justify-center sm:gap-4">
            <code className="break-all font-semibold text-slate-900">
              {selectedVersionId}
            </code>
            <span className="shrink-0 font-mono font-semibold text-cyan-700">
              — DEPENDS_ON {"{ requirement }"} →
            </span>
            <span className="font-mono text-slate-500">exact Version</span>
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
            <ul className="mt-6 grid gap-3 lg:grid-cols-2">
              {versionState.response.data.version.dependencies.map(
                (dependency) => (
                  <li
                    className="flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4"
                    key={`${dependency.dependencyVersionId}\0${dependency.requirement}`}
                  >
                    <div className="min-w-0">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-slate-400">
                        Resolved dependency
                      </p>
                      <p className="mt-1 truncate font-mono text-sm font-semibold text-slate-950">
                        {dependency.dependencyPackageName}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-500">
                        {dependency.dependencyVersionId}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        requires
                      </span>
                      <code className="mt-1 block rounded-lg bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800">
                        {dependency.requirement}
                      </code>
                    </div>
                  </li>
                ),
              )}
            </ul>
          ))}
      </section>

      <section
        aria-labelledby="impact-heading"
        className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8"
      >
        <SectionHeader
          description="Exact indexed versions that can reach the selected version through dependency edges."
          number="02"
          title="Downstream impact"
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

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
      <div className="rounded-2xl bg-slate-950 p-5 text-white sm:p-6">
        <p className="text-2xl font-semibold tracking-tight">
          {impact.totalReachable} {impact.totalReachable === 1 ? "version" : "versions"}{" "}
          reachable
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Within Ripple&apos;s indexed npm snapshot.
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-5 lg:grid-cols-1">
          {metrics.map(([label, value]) => (
            <div className="lg:flex lg:items-center lg:justify-between" key={label}>
              <dt className="text-xs leading-5 text-slate-400">{label}</dt>
              <dd className="mt-1 font-mono text-xl font-semibold text-white lg:mt-0">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-2xl border border-slate-200 p-5 sm:p-6">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Affected versions
        </h3>
        <ul className="mt-3 divide-y divide-slate-200">
          {impact.affectedVersions.map((version) => (
            <li
              className="flex items-start justify-between gap-5 py-3.5"
              key={version.affectedVersionId}
              title={version.pathVersionIds.join(" → ")}
            >
              <div className="min-w-0">
                <code className="break-all text-sm font-semibold text-slate-950">
                  {version.affectedVersionId}
                </code>
                {version.pathVersionIds.length > 2 && (
                  <p className="mt-1 line-clamp-1 font-mono text-[0.68rem] text-slate-400">
                    {version.pathVersionIds.join(" → ")}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {version.hopCount} {version.hopCount === 1 ? "hop" : "hops"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SectionHeader({
  number,
  title,
  description,
  meta,
}: {
  number: string;
  title: string;
  description: string;
  meta?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cyan-50 font-mono text-xs font-semibold text-cyan-800">
          {number}
        </span>
        <div>
          <h2
            className="text-2xl font-semibold tracking-[-0.025em] text-slate-950"
            id={number === "01" ? "dependencies-heading" : "impact-heading"}
          >
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
      </div>
      {meta && (
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
          {meta}
        </span>
      )}
    </div>
  );
}

function LoadingPanel({ label, rows }: { label: string; rows: number }) {
  return (
    <div className="mt-6 space-y-3" role="status">
      <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <span className="size-2 rounded-full bg-cyan-500" />
        {label}
      </p>
      {Array.from({ length: rows }, (_, index) => (
        <div className="h-20 rounded-2xl bg-slate-100" key={index} />
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
      className={`mt-6 rounded-2xl border px-6 py-6 ${
        tone === "error"
          ? "border-rose-200 bg-rose-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <span
        className={`mb-4 grid size-9 place-items-center rounded-full font-mono text-sm font-semibold ${
          tone === "error"
            ? "bg-rose-100 text-rose-700"
            : "bg-white text-slate-600"
        }`}
      >
        {tone === "error" ? "!" : "—"}
      </span>
      <p className="font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{message}</p>
      {action && (
        <Link
          className="mt-5 inline-block rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
          href="/"
        >
          Return to package search
        </Link>
      )}
    </div>
  );
}
