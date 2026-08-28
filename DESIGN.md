# Ripple frontend design system

Ripple uses a **dependency instrument** concept. Exact releases, declared
requirements, and resolved targets appear as signals on a precise technical
surface—not as rows in a generic database viewer.

## Visual foundation

### Typography

- Inter Tight carries navigation, headings, explanation, controls, and status
  copy.
- JetBrains Mono carries package names, exact Version IDs, requirements,
  counts, path labels, and measurement-like metadata.
- Headings are semibold with tight but readable tracking. Exact identifiers
  wrap when truncation would hide dependency truth.

### Color

- The ink ramp forms the near-black instrument canvas and surface hierarchy.
- The mist ramp forms the text and muted-data hierarchy.
- Signal lime identifies the exact release being analysed, active controls,
  dependency direction, and selected state.
- Amber is reserved for a value that changed between releases.
- Rose is reserved for error states.
- Color always carries meaning. Additional decorative hues are out of system.

## Layout grammar

- Pages use a centered max-width container with responsive padding.
- Hairline borders structure the interface; large radii and floating card
  collections are avoided.
- Landing sections alternate narrative and evidence, while package analysis
  sections follow the reading order: identity and version selector, release
  summary, dependencies, impact, explain path, dataset scope.
- Asymmetric desktop grids collapse to one linear flow on mobile.
- Diagrams and worked examples come before dense result lists.

## Reusable patterns

### Dependency trace

One selected source release fans out to resolved exact targets. Animated dashed
edges retain the requirement on each line, making propagation visible before a
visitor reads supporting copy.

### Version divergence

The AJV comparison marks the dependency value that changed in amber and keeps
unchanged or version-specific values quieter. It is visual evidence that a
package name cannot supply version-level truth.

### Data-first package summary

The selected exact release and its key counts appear before analysis results.
Short direction labels stay beside the data instead of occupying a separate
teaching block:

- source → dependency;
- affected version → source;
- source → intermediate releases → target.

### Contextual edge reading

Dependency rows and explained paths keep the source release, declared
requirement, and resolved exact target together. Plain-English guidance appears
only where it helps interpret the adjacent result.

### Dataset trust

The live package, version, and relationship totals remain visible beside the
bounded-snapshot disclaimer: “Within Ripple's indexed npm snapshot.”

## Interaction and motion

- Primary actions and selected versions use signal lime; secondary actions use
  a hairline border.
- Focus, caret, selection, and scrollbars are themed from the same palette.
- The authored focal motion is dependency propagation: dash movement travels
  away from the selected release while the source node breathes subtly.
- API-backed row sets reveal once when real data arrives; search result rows
  use a bounded stagger.
- Under reduced-motion preferences, signal paths become static and all spatial
  entrance motion is removed.

## Responsive and accessibility rules

- CTAs are equal width on desktop and stack full-width on mobile.
- Exact identifiers wrap instead of causing page-level horizontal scrolling.
- Dense version sets use a native select; smaller sets use visible version
  buttons.
- Color is reinforced by direction, labels, borders, and position.
- Loading, empty, missing, and database-error states preserve the same
  instrument surface and name the user’s next useful action.
