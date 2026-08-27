export const MAX_DISCOVERY_DEPTH = 4;
export const MAX_VERSIONS = 2_500;
export const DEPS_DEV_CONCURRENCY = 6;

export const ROOT_CATEGORIES = [
  "build/tooling",
  "server/http",
  "bridge/shared",
] as const;

export type RootCategory = (typeof ROOT_CATEGORIES)[number];

export interface RootPackage {
  category: RootCategory;
  name: string;
  version: string;
}

// Exact versions are deliberately frozen. Updating them is a dataset-curation
// decision and must not happen implicitly during snapshot generation.
export const ROOT_PACKAGES: readonly RootPackage[] = [
  { category: "build/tooling", name: "typescript", version: "7.0.2" },
  { category: "build/tooling", name: "webpack", version: "5.109.2" },
  { category: "build/tooling", name: "vite", version: "8.2.2" },
  { category: "build/tooling", name: "rollup", version: "4.63.0" },
  { category: "build/tooling", name: "esbuild", version: "0.28.2" },
  { category: "build/tooling", name: "eslint", version: "10.9.1" },
  { category: "build/tooling", name: "prettier", version: "3.9.6" },
  { category: "build/tooling", name: "@babel/core", version: "8.0.1" },
  { category: "build/tooling", name: "postcss", version: "8.5.26" },

  { category: "server/http", name: "express", version: "5.2.1" },
  { category: "server/http", name: "koa", version: "3.2.1" },
  { category: "server/http", name: "fastify", version: "5.12.1" },
  { category: "server/http", name: "@hapi/hapi", version: "21.4.10" },
  { category: "server/http", name: "@nestjs/core", version: "11.1.6" },
  { category: "server/http", name: "axios", version: "1.11.0" },
  { category: "server/http", name: "undici", version: "8.10.0" },
  { category: "server/http", name: "ws", version: "8.21.3" },

  { category: "bridge/shared", name: "debug", version: "4.4.3" },
  { category: "bridge/shared", name: "semver", version: "7.8.5" },
  { category: "bridge/shared", name: "zod", version: "4.4.3" },
  { category: "bridge/shared", name: "lodash", version: "4.18.1" },
  { category: "bridge/shared", name: "minimist", version: "1.2.8" },
  { category: "bridge/shared", name: "chalk", version: "6.0.0" },
  { category: "bridge/shared", name: "commander", version: "15.0.0" },
  { category: "bridge/shared", name: "dotenv", version: "17.2.1" },
];
