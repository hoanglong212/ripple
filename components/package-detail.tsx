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
  meta: { catalogScope?: string; scope: string };
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

function packageVersionHref(packageName: string, versionId: string): string {
  const packagePath = packageName.split("/").map(encodeURIComponent).join("/");
  return `/packages/${packagePath}?version=${encodeURIComponent(versionId)}`;
}

const DEPENDENCIES_PER_PAGE = 8;

/*
 * Divergence counts are verified by hand against the indexed snapshot for the
 * curated demo packages. Every other multi-release package gets the neutral
 * prompt, because Ripple does not resolve a second release to count the
 * difference — the claim would not be backed by anything on the page.
 */
const CURATED_DIVERGENCE: Record<string, number> = {
  ajv: 3,
};

function divergenceMessage(
  packageName: string,
  selectedVersionId: string,
  versions: readonly { id: string }[],
  dependencyCount: number,
): string | null {
  const otherVersions = versions.filter(
    (version) => version.id !== selectedVersionId,
  );
  if (otherVersions.length === 0 || dependencyCount === 0) {
    return null;
  }

  if (otherVersions.length > 1) {
    return `${otherVersions.length} other indexed releases can resolve a different dependency set. Switch releases to compare.`;
  }

  const divergentCount = CURATED_DIVERGENCE[packageName];
  if (divergentCount !== undefined && divergentCount <= dependencyCount) {
    return `${otherVersions[0].id} resolves ${divergentCount} of these ${dependencyCount} dependencies differently. Switch releases to compare.`;
  }

  return `${otherVersions[0].id} can resolve a different dependency set. Switch releases to compare.`;
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

export function PackageDetailView({
  initialExplainTarget,
  initialVersionId,
  packageName,
}: {
  initialExplainTarget?: string;
  initialVersionId?: string;
  packageName: string;
}) {
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
  const [dependencyPage, setDependencyPage] = useState(1);

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
        const requestedVersion = payload.data.package.versions.find(
          (version) => version.id === initialVersionId,
        );
        setDependencyPage(1);
        setSelectedVersionId(
          requestedVersion?.id ?? payload.data.package.versions[0]?.id ?? "",
        );
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
  }, [initialVersionId, packageName]);

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
      <div aria-label="Loading package data" className="space-y-6" role="status">
        <section className="overflow-hidden border border-[var(--hairline)] bg-ink-850">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="p-6 sm:p-9 lg:p-10">
              <h1 className="break-all font-mono text-4xl font-semibold tracking-[-0.04em] text-mist-100 sm:text-6xl">
                {packageName}
              </h1>
              <p className="mt-4 flex items-center gap-2 text-sm text-mist-600">
                <span className="size-1.5 bg-signal" />
                Loading package details…
              </p>
            </div>
            <div className="border-t border-[var(--hairline)] bg-ink-800 p-6 sm:p-8 lg:border-l lg:border-t-0">
              <label className="text-sm font-semibold text-mist-100" htmlFor="loading-version-selector">
                Selected exact release
              </label>
              <select
                className="mt-3 w-full border border-[var(--hairline)] bg-ink-900 px-4 py-3.5 font-mono text-sm text-mist-600"
                disabled
                id="loading-version-selector"
              >
                <option>Loading indexed versions…</option>
              </select>
            </div>
          </div>
        </section>

        <section className="border border-[var(--hairline)] bg-ink-850 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-mist-100">Dependencies</h2>
          <p className="mt-2 text-sm text-mist-600">Loading outgoing dependency edges…</p>
          <div className="mt-6 space-y-3">
            <div className="h-16 bg-ink-800" />
            <div className="h-16 bg-ink-800" />
          </div>
        </section>

        <section className="border border-[var(--hairline)] bg-ink-850 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-mist-100">Downstream impact</h2>
          <p className="mt-2 text-sm text-mist-600">Tracing incoming dependency paths…</p>
          <div className="mt-6 h-20 bg-ink-800" />
        </section>
      </div>
    );
  }

  if (packageState.status === "missing") {
    return (
      <StatusCard
        action
        message={packageState.message}
        title="Package not found"
      />
    );
  }

  if (packageState.status === "error") {
    return (
      <StatusCard
        action
        message={packageState.message}
        title="Package lookup unavailable"
        tone="error"
      />
    );
  }

  const packageDetail = packageState.response.data.package;
  const versionCount = packageDetail.versions.length;
  const metadata = packageDetail.metadata;
  const graphStatus = packageDetail.graphStatus ?? "indexed";
  const isGraphIndexed = graphStatus === "indexed" && versionCount > 0;
  const directDependencies =
    versionState.status === "success"
      ? versionState.response.data.version.dependencies
      : [];
  const dependencyPageCount = Math.max(
    1,
    Math.ceil(directDependencies.length / DEPENDENCIES_PER_PAGE),
  );
  const activeDependencyPage = Math.min(dependencyPage, dependencyPageCount);
  const visibleDependencies = directDependencies.slice(
    (activeDependencyPage - 1) * DEPENDENCIES_PER_PAGE,
    activeDependencyPage * DEPENDENCIES_PER_PAGE,
  );
  const divergenceNotice =
    versionState.status === "success"
      ? divergenceMessage(
          packageDetail.name,
          selectedVersionId,
          packageDetail.versions,
          directDependencies.length,
        )
      : null;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden border border-[var(--hairline)] bg-ink-850">
        <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(19rem,0.7fr)]">
          <div className="p-6 sm:p-9 lg:p-10">
            <h1 className="break-all font-mono text-4xl font-semibold tracking-[-0.04em] text-mist-100 sm:text-6xl">
              {packageDetail.name}
            </h1>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-mist-600">
                Public npm package
              </span>
              <span
                className={`border px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.08em] ${
                  graphStatus === "indexed"
                    ? "border-signal/40 bg-signal/[0.07] text-signal"
                    : "border-[var(--hairline)] text-mist-500"
                }`}
              >
                {graphStatus === "indexed"
                  ? `${versionCount} indexed version${versionCount === 1 ? "" : "s"}`
                  : graphStatus === "unavailable"
                    ? "graph status unavailable"
                    : "catalog only"}
              </span>
            </div>

            {isGraphIndexed && (
              <>
                <dl className="mt-7 grid border-y border-[var(--hairline)] sm:grid-cols-3">
                  <div className="py-4 sm:pr-5">
                    <dd className="font-mono text-2xl font-semibold text-mist-100">
                      {versionState.status === "success"
                        ? versionState.response.data.version.dependencies.length
                        : "—"}
                    </dd>
                    <dt className="mt-1 text-xs leading-5 text-mist-600">
                      direct dependencies
                    </dt>
                  </div>
                  <div className="border-t border-[var(--hairline)] py-4 sm:border-l sm:border-t-0 sm:px-5">
                    <dd className="font-mono text-2xl font-semibold text-mist-100">
                      {impactState.status === "success"
                        ? impactState.response.data.impact.totalReachable
                        : "—"}
                    </dd>
                    <dt className="mt-1 text-xs leading-5 text-mist-600">
                      releases that depend on this
                    </dt>
                  </div>
                  <div className="border-t border-[var(--hairline)] py-4 sm:border-l sm:border-t-0 sm:px-5">
                    <dd className="font-mono text-2xl font-semibold text-mist-100">
                      {versionCount}
                    </dd>
                    <dt className="mt-1 text-xs leading-5 text-mist-600">
                      indexed releases of this package
                    </dt>
                  </div>
                </dl>

                <p className="mt-5 max-w-2xl text-sm leading-6 text-mist-400">
                  Every answer below is scoped to{" "}
                  <code className="font-mono text-mist-100">
                    {selectedVersionId || "the selected release"}
                  </code>
                  .{" "}
                  {versionCount > 1
                    ? "Switch releases to watch the dependency answer change."
                    : "Dependency edges belong to this exact release, not to the package name."}
                </p>
              </>
            )}

            <div className="mt-9 max-w-3xl border-t border-[var(--hairline)] pt-6">
              <h2 className="text-sm font-semibold text-mist-100">
                What this package does
              </h2>
              <p className="mt-3 text-base leading-7 text-mist-400">
                {metadata?.description ??
                  "The npm registry does not currently provide a description for this package."}
              </p>
            </div>

            {(metadata?.keywords.length ?? 0) > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {metadata?.keywords.map((keyword) => (
                  <span
                    className="border border-[var(--hairline)] px-2.5 py-1 font-mono text-[0.65rem] text-mist-600"
                    key={keyword}
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {metadata?.npmUrl && (
                <a
                  className="font-semibold text-signal underline decoration-signal/40 underline-offset-4 hover:decoration-signal"
                  href={metadata.npmUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  npm package page
                </a>
              )}
              {metadata?.homepageUrl && (
                <a
                  className="text-mist-400 underline decoration-[var(--hairline-strong)] underline-offset-4 hover:text-mist-100"
                  href={metadata.homepageUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Documentation
                </a>
              )}
              {metadata?.repositoryUrl && (
                <a
                  className="text-mist-400 underline decoration-[var(--hairline-strong)] underline-offset-4 hover:text-mist-100"
                  href={metadata.repositoryUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Source repository
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-col border-t border-[var(--hairline)] bg-ink-800 p-6 sm:p-8 lg:border-l lg:border-t-0">
            {isGraphIndexed ? (
              <div>
                <p className="text-sm font-semibold text-mist-100">
                  Selected exact release
                </p>
                <code className="mt-3 block break-all font-mono text-lg font-semibold text-signal">
                  {selectedVersionId || "Selecting release…"}
                </code>
                <p className="mt-2 text-xs leading-5 text-mist-600">
                  Change the release to update every answer on this page.
                </p>
                <VersionSelector
                  onSelect={(versionId) => {
                    setDependencyPage(1);
                    setSelectedVersionId(versionId);
                  }}
                  selectedVersionId={selectedVersionId}
                  versions={packageDetail.versions}
                />
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-mist-100">
                  Package guide available
                </p>
                <p className="mt-2 text-sm leading-6 text-mist-500">
                  {graphStatus === "unavailable"
                    ? "Ripple could not check graph coverage right now. Package information is still available from npm."
                    : "This package is discoverable, but its releases are not part of Ripple’s bounded graph snapshot yet."}
                </p>
              </div>
            )}

            <div className="mt-8 border-t border-[var(--hairline)] pt-6">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-semibold text-mist-300">Install</p>
                {metadata?.latestVersion && (
                  <code className="font-mono text-[0.65rem] text-mist-700">
                    npm latest {metadata.latestVersion}
                  </code>
                )}
              </div>
              <pre className="mt-3 overflow-x-auto border border-[var(--hairline)] bg-ink-950 px-4 py-3 font-mono text-xs text-signal">
                <code>{metadata?.installCommand ?? `npm install ${packageDetail.name}`}</code>
              </pre>
            </div>
          </div>
        </div>

      </section>

      {!isGraphIndexed && (
        <CatalogOnlyState
          graphStatus={graphStatus}
          packageName={packageDetail.name}
          scope={packageState.response.meta.scope}
        />
      )}

      {isGraphIndexed && (
        <section
          aria-labelledby="dependencies-heading"
          className="border border-[var(--hairline)] bg-ink-850 p-6 sm:p-8 lg:p-10"
        >
        <SectionHeader
          description={`What ${selectedVersionId || "this exact release"} needs to run. Each row shows the declared range and the exact version Ripple indexed.`}
          meta={
            versionState.status === "success"
              ? `${versionState.response.data.version.dependencies.length} direct`
              : undefined
          }
          id="dependencies-heading"
          title="Dependencies"
        />

        {divergenceNotice !== null && (
          <p className="mt-6 border-l-2 border-amber bg-amber/[0.06] px-4 py-3 text-sm leading-6 text-mist-300">
            {divergenceNotice}
          </p>
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
            <div className="mt-6 flex flex-col gap-4 border-y border-[var(--hairline)] py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-mist-100">
                  This release has no indexed outgoing dependencies.
                </p>
                <p className="mt-1 text-sm leading-6 text-mist-500">
                  The interesting question is who depends on it.
                </p>
              </div>
              <Link
                className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-signal"
                href="#impact-heading"
              >
                View downstream impact
                <svg aria-hidden="true" className="h-4 w-5" fill="none" viewBox="0 0 20 16">
                  <path d="M1 8h16m-5-5 5 5-5 5" stroke="currentColor" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="reveal-up">
              <div className="mt-6 flex items-center justify-between gap-4">
                <h3 className="text-sm font-semibold text-mist-100">Resolved edges</h3>
                <p aria-live="polite" className="text-xs text-mist-600">
                  Showing {(activeDependencyPage - 1) * DEPENDENCIES_PER_PAGE + 1}–
                  {Math.min(
                    activeDependencyPage * DEPENDENCIES_PER_PAGE,
                    directDependencies.length,
                  )}{" "}
                  of {directDependencies.length}
                </p>
              </div>
              <ul className="mt-3 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
                {visibleDependencies.map((dependency) => (
                    <li
                      key={`${dependency.dependencyVersionId}\0${dependency.requirement}`}
                    >
                      <Link
                        aria-label={`Open ${dependency.dependencyVersionId}`}
                        className="group grid min-w-0 gap-4 py-4 transition-colors hover:bg-ink-800 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-4"
                        href={packageVersionHref(
                          dependency.dependencyPackageName,
                          dependency.dependencyVersionId,
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="size-2 shrink-0 bg-signal" />
                          <div className="min-w-0">
                            <p className="truncate font-mono text-sm font-semibold text-mist-100 transition-colors group-hover:text-signal">
                              {dependency.dependencyPackageName}
                            </p>
                            <p className="mt-1 break-all font-mono text-xs text-mist-600">
                              {dependency.dependencyVersionId}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 sm:text-right">
                          <span className="block text-xs text-mist-600">requires</span>
                          <code className="mt-1 block w-fit border border-[var(--hairline-strong)] bg-signal/10 px-3 py-1.5 text-xs font-semibold text-signal sm:ml-auto">
                            {dependency.requirement}
                          </code>
                        </div>
                        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-mist-600 transition-colors group-hover:text-signal">
                          Open exact release
                          <svg aria-hidden="true" className="h-4 w-5" fill="none" viewBox="0 0 20 16">
                            <path d="M1 8h16m-5-5 5 5-5 5" stroke="currentColor" />
                          </svg>
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>

              {dependencyPageCount > 1 && (
                <nav
                  aria-label="Direct dependencies pagination"
                  className="mt-5 flex flex-col gap-3 border-t border-[var(--hairline)] pt-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="font-mono text-[0.68rem] text-mist-600">
                    Page {activeDependencyPage} of {dependencyPageCount}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="inline-flex min-h-10 items-center justify-center gap-2 border border-[var(--hairline-strong)] px-4 text-xs font-semibold text-mist-300 transition-colors hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:text-mist-700 disabled:hover:border-[var(--hairline-strong)]"
                      disabled={activeDependencyPage === 1}
                      onClick={() => setDependencyPage((page) => Math.max(1, page - 1))}
                      type="button"
                    >
                      <svg aria-hidden="true" className="h-4 w-5" fill="none" viewBox="0 0 20 16">
                        <path d="M19 8H3m5-5L3 8l5 5" stroke="currentColor" />
                      </svg>
                      Previous
                    </button>
                    <button
                      className="inline-flex min-h-10 items-center justify-center gap-2 border border-[var(--hairline-strong)] px-4 text-xs font-semibold text-mist-300 transition-colors hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:text-mist-700 disabled:hover:border-[var(--hairline-strong)]"
                      disabled={activeDependencyPage === dependencyPageCount}
                      onClick={() =>
                        setDependencyPage((page) =>
                          Math.min(dependencyPageCount, page + 1),
                        )
                      }
                      type="button"
                    >
                      Next
                      <svg aria-hidden="true" className="h-4 w-5" fill="none" viewBox="0 0 20 16">
                        <path d="M1 8h16m-5-5 5 5-5 5" stroke="currentColor" />
                      </svg>
                    </button>
                  </div>
                </nav>
              )}
            </div>
          ))}
        </section>
      )}

      {isGraphIndexed && (
        <section
          aria-labelledby="impact-heading"
          className="border border-[var(--hairline)] bg-ink-850 p-6 sm:p-8 lg:p-10"
        >
        <SectionHeader
          description={`Who depends on ${selectedVersionId || "this exact release"}, directly or through another indexed release.`}
          id="impact-heading"
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
      )}

      {isGraphIndexed && selectedVersionId !== "" && (
        <ExplainConnection
          initialTargetVersionId={initialExplainTarget}
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

function CatalogOnlyState({
  graphStatus,
  packageName,
  scope,
}: {
  graphStatus: "indexed" | "not-indexed" | "unavailable";
  packageName: string;
  scope: string;
}) {
  return (
    <section
      aria-labelledby="catalog-only-heading"
      className="border border-[var(--hairline)] bg-ink-850 p-6 sm:p-8 lg:p-10"
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
        <div>
          <h2
            className="text-2xl font-semibold tracking-[-0.03em] text-mist-100 sm:text-3xl"
            id="catalog-only-heading"
          >
            Package found. Graph analysis has a narrower scope.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-mist-500">
            Ripple can explain what <code className="text-mist-200">{packageName}</code>{" "}
            is and where to start. Dependencies, downstream impact, and paths
            require exact versions already indexed in CognoDB.
          </p>
          <p className="mt-5 font-mono text-[0.68rem] text-mist-600">
            {graphStatus === "unavailable"
              ? "Graph coverage could not be checked during this request."
              : scope}
          </p>
        </div>

        <div className="border-y border-[var(--hairline)] py-6">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)_3rem_minmax(0,1fr)] sm:items-center">
            <div>
              <span className="block font-mono text-[0.62rem] uppercase tracking-[0.1em] text-signal">
                available
              </span>
              <strong className="mt-2 block text-sm text-mist-100">npm package guide</strong>
              <span className="mt-1 block text-xs leading-5 text-mist-600">
                purpose, latest release, install command, official links
              </span>
            </div>
            <svg aria-hidden="true" className="hidden h-4 w-full text-mist-700 sm:block" fill="none" viewBox="0 0 48 16">
              <path d="M1 8h42m-5-5 5 5-5 5" stroke="currentColor" />
            </svg>
            <div>
              <span className="block font-mono text-[0.62rem] uppercase tracking-[0.1em] text-mist-600">
                boundary
              </span>
              <strong className="mt-2 block text-sm text-mist-100">exact version required</strong>
              <span className="mt-1 block text-xs leading-5 text-mist-600">
                analysis never guesses from a package name
              </span>
            </div>
            <svg aria-hidden="true" className="hidden h-4 w-full text-mist-700 sm:block" fill="none" viewBox="0 0 48 16">
              <path d="M1 8h42m-5-5 5 5-5 5" stroke="currentColor" />
            </svg>
            <div>
              <span className="block font-mono text-[0.62rem] uppercase tracking-[0.1em] text-amber">
                not available
              </span>
              <strong className="mt-2 block text-sm text-mist-100">dependency analysis</strong>
              <span className="mt-1 block text-xs leading-5 text-mist-600">
                only for releases inside the bounded graph snapshot
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
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
          className="mb-2 block text-xs font-semibold text-mist-500"
          htmlFor="indexed-version"
        >
          Exact version
        </label>
        <select
          className="w-full border border-[var(--hairline-strong)] bg-ink-850 px-4 py-3.5 font-mono text-sm font-semibold text-mist-100 outline-none focus:border-signal"
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
        className="mb-2 text-xs font-semibold text-mist-500"
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
              className={`border px-4 py-3 font-mono text-sm font-semibold focus:outline-none  ${
                isSelected
                  ? "border-signal bg-signal text-ink-950"
                  : "border-[var(--hairline)] bg-ink-850 text-mist-300 hover:border-signal"
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
        <p className="mt-3 text-xs leading-5 text-mist-600">
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
    <div className="reveal-up mt-7">
      {example && (
        <div className="mb-5 grid gap-4 border border-[var(--hairline)] bg-ink-800 p-5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
          <div>
            <p className="text-xs font-medium text-signal">An affected release</p>
            <code className="mt-2 block break-all text-sm font-semibold text-mist-100">
              {example.affectedVersionId}
            </code>
          </div>
          <div className="flex items-center gap-2 text-signal">
            <span className="h-px flex-1 bg-[var(--hairline-strong)] sm:w-12" />
            <span className="text-xs font-semibold">
              can reach in {example.hopCount} {example.hopCount === 1 ? "hop" : "hops"}
            </span>
            <span aria-hidden="true">→</span>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-medium text-signal">Selected release</p>
            <code className="mt-2 block break-all text-sm font-semibold text-mist-100">
              {impact.targetVersionId}
            </code>
          </div>
          <p className="text-sm leading-6 text-mist-500 sm:col-span-3">
            If the selected release changes, versions that depend on it directly
            or through other dependencies may be affected. Ripple follows those
            incoming paths up to four hops.
          </p>
        </div>
      )}
      <div className="grid gap-0 border border-[var(--hairline)] lg:grid-cols-[0.72fr_1.28fr]">
      <div className="bg-ink-800 p-5 text-mist-100 sm:p-6">
        <p className="font-mono text-3xl font-semibold tracking-tight text-signal">
          {impact.totalReachable}
        </p>
        <p className="mt-1 text-sm text-mist-300">
          {impact.totalReachable === 1 ? "version" : "versions"} reachable
        </p>
        <p className="mt-2 text-sm text-mist-600">
          Within Ripple&apos;s indexed npm snapshot.
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-[var(--hairline)] pt-5 lg:grid-cols-1">
          {metrics.map(([label, value]) => (
            <div className="lg:flex lg:items-center lg:justify-between" key={label}>
              <dt className="text-xs leading-5 text-mist-600">{label}</dt>
              <dd className="mt-1 font-mono text-xl font-semibold text-mist-100 lg:mt-0">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="border-t border-[var(--hairline)] p-5 sm:p-6 lg:border-l lg:border-t-0">
        <h3 className="text-sm font-semibold text-mist-100">
          Affected versions
        </h3>
        <ul className="mt-3 divide-y divide-[var(--hairline)]">
          {impact.affectedVersions.map((version) => (
            <li
              className="flex items-start justify-between gap-5 py-3.5"
              key={version.affectedVersionId}
              title={version.pathVersionIds.join(" → ")}
            >
              <div className="min-w-0">
                <code className="break-all text-sm font-semibold text-mist-100">
                  {version.affectedVersionId}
                </code>
                {version.pathVersionIds.length > 2 && (
                  <p className="mt-1 line-clamp-1 font-mono text-[0.68rem] text-mist-600">
                    {version.pathVersionIds.join(" → ")}
                  </p>
                )}
              </div>
              <span className="shrink-0 bg-signal/10 px-2.5 py-1 text-xs font-semibold text-signal">
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
  description,
  meta,
}: {
  id: string;
  title: string;
  description: string;
  meta?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2
          className="text-3xl font-semibold tracking-[-0.04em] text-mist-100"
          id={id}
        >
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-base leading-6 text-mist-500">
          {description}
        </p>
      </div>
      {meta && (
        <span className="w-fit border border-[var(--hairline)] px-3 py-1.5 text-xs font-semibold text-mist-500">
          {meta}
        </span>
      )}
    </div>
  );
}

function LoadingPanel({ label, rows }: { label: string; rows: number }) {
  return (
    <div className="mt-6 space-y-3" role="status">
      <p className="flex items-center gap-2 text-sm font-medium text-mist-500">
        <span className="size-2 bg-signal" />
        {label}
      </p>
      {Array.from({ length: rows }, (_, index) => (
        <div className="h-20 bg-ink-800" key={index} />
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
          ? "border-rose-200 bg-rose/[0.06]"
          : "border-[var(--hairline)] bg-ink-800"
      }`}
    >
      <span
        className={`mb-4 grid size-9 place-items-center rounded-full font-mono text-sm font-semibold ${
          tone === "error"
            ? "bg-rose-100 text-rose"
            : "bg-ink-850 text-mist-500"
        }`}
      >
        {tone === "error" ? "!" : "—"}
      </span>
      <p className="font-semibold text-mist-100">{title}</p>
      <p className="mt-1 text-sm leading-6 text-mist-500">{message}</p>
      {action && (
        <Link
          className="mt-5 inline-block bg-ink-950 px-4 py-2.5 text-sm font-semibold text-mist-100"
          href="/"
        >
          Return to package search
        </Link>
      )}
    </div>
  );
}
