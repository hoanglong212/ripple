import { z } from "zod";

export const packageSearchSchema = z.object({
  query: z
    .string({ error: "A package query is required." })
    .trim()
    .min(1, "Enter a package name to search.")
    .max(100, "Package search is limited to 100 characters."),
});

export const packageNameSchema = z
  .string()
  .trim()
  .min(1, "Package name is required.")
  .max(214, "Package name is too long.");

export const versionIdSchema = z
  .string()
  .trim()
  .min(1, "Version ID is required.")
  .max(300, "Version ID is too long.");

export const explainPathQuerySchema = z.object({
  target: versionIdSchema,
});
