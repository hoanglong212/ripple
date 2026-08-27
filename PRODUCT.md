# Ripple product context

<!-- impeccable:product-schema 1 -->

## Platform

Responsive web application built with Next.js and Tailwind CSS.

## Users

- Recruiters evaluating the technical depth and product thinking of an internship submission.
- Developers investigating how one exact npm release depends on, affects, or connects to another exact release.

## Product Purpose

Ripple traces the impact of exact npm releases and explains why versions are connected. It makes the version-level dependency truth understandable without presenting the product as a raw graph database viewer.

## Positioning

A package name is not enough: different versions of the same package can resolve different dependency trees. Ripple answers dependency questions for one exact release at a time.

## Operating Context

The primary recruiter journey should be understandable within 30 seconds: see the exact-version premise, inspect the AJV comparison, try a known example, and understand the three supported analysis questions. The package page is the working developer tool for selecting an indexed release and inspecting its direct dependencies, downstream impact, and an explainable path.

## Capabilities and Constraints

- Dependency Explorer shows the direct dependencies of an exact indexed version.
- Downstream Impact shows versions that can reach an exact indexed version.
- Explain Path shows why two exact indexed versions are connected.
- The dataset is a bounded npm snapshot: 426 packages, 449 versions, and 636 dependency relationships.
- Existing APIs, graph queries, database logic, data model, and architecture must remain unchanged.
- No package descriptions or external product data are available or required.

## Brand Commitments

- Product name: Ripple.
- Voice: precise, calm, transparent, and developer-focused.
- Visual character: clean, technical, premium, and expressive, combining developer-tool precision with a recognizable dependency-signal motif.
- Strong typography, generous spacing, clear hierarchy, subtle borders, and code-like treatment for exact version identifiers.
- Use purposeful color, code-native dependency diagrams, and motion that explains propagation or state changes.
- Avoid generic dashboards, excessive cards, decorative animation, stock imagery, and AI-generated visual tropes.

## Evidence on Hand

- AJV version contrast: `ajv@6.15.0` resolves `json-schema-traverse@0.4.1`, while `ajv@8.20.0` resolves `json-schema-traverse@1.0.0`.
- Downstream impact example: `@hapi/hoek`.
- Explain Path example: `@babel/core@8.0.1` to `picocolors@1.1.1` in four hops.
- Dataset qualifier: “Within Ripple's indexed npm snapshot.”

## Product Principles

1. Exact versions over package-level averages.
2. Explain relationships, not just list graph records.
3. Make bounded scope visible and trustworthy.
4. Lead with a worked example before asking users to understand the model.
5. Keep every interface state useful, quiet, and legible.
