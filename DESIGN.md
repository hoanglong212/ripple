# Ripple frontend design system

Ripple uses a **dependency-signal** concept: package identities, exact versions, requirements, and dependency paths are presented as precise records connected by visible directional signals. The interface combines developer-tool clarity with enough color and motion to make propagation understandable at a glance.

## Visual foundation

### Typography

- Use the sans stack from `app/globals.css` for navigation, headings, explanations, controls, and status copy: `Segoe UI Variable`, `Segoe UI`, Arial, sans-serif.
- Use the mono stack for package names, exact version IDs, requirements, counts, and graph relationship labels: `SFMono-Regular`, Consolas, `Liberation Mono`, monospace.
- Headings use semibold weight, tight letter spacing, and compact leading. Body copy stays regular-weight with generous line height.
- Exact identifiers must remain readable at narrow widths: allow wrapping with `break-all` where truncation would hide dependency truth.

### Color

- Primary surfaces: violet-tinted white, white, and deep violet-black.
- Primary text: zinc-950; supporting text: zinc-500/600.
- Dark sections and primary actions: zinc-950 with white text.
- Violet identifies the selected exact release and primary actions.
- Cyan identifies outgoing direct dependencies.
- Emerald identifies incoming downstream impact.
- Coral/orange contrasts older or changed release truth.
- Rose remains limited to error states.
- Soft tinted surfaces and restrained shadows may group an explanation, but every color must retain one stable semantic role.

## Layout grammar

- Pages use a centered `max-w-7xl` container with responsive horizontal padding: 5 on mobile, 8 on small screens, and 12 on large screens.
- Major landing-page sections are separated by full-width 1px zinc borders and generous vertical spacing (`py-20` through `py-32`).
- The package workspace uses a narrower reading container and stacked sections with consistent vertical gaps.
- Prefer divided rows, dependency maps, explanatory diagrams, and bordered lists over collections of floating cards.
- Surfaces are square or nearly square. Borders supply structure; shadows and decorative rounding are intentionally absent.
- Use asymmetric desktop grids when they clarify hierarchy: narrative on the left, evidence or interaction on the right. Collapse to a single linear flow on mobile.
- A 1px colored rule may mark an important dependency fact or exact-version value.

## Reusable page patterns

### Product header

Pair the compact `R/` product mark with the Ripple wordmark. Keep the right side limited to a short trust or context signal. Navigation remains quiet so the product premise leads.

### Dependency signal

Present one source release and its resolved targets inside a dark signal field. Animated dashed paths communicate propagation direction; labels preserve the declared requirement. This is the homepage’s authored focal illustration.

### Question-led section

Lead analysis sections with the user question in blue, followed by a strong capability title and one sentence describing what the result means. This pattern is shared by Dependency Truth, Impact, and Explain Path.

### Relationship row

Show a source exact version, a directional connector, the target exact version, and the requirement together. Requirements use compact color-tinted mono labels. Never reduce a relationship to package names alone.

### Worked edge example

On package pages, explain one real direct dependency before listing all edges. Separate the source exact release, declared requirement, and resolved exact target, then restate the relationship in plain English.

### Dataset trust panel

Combine a short bounded-snapshot explanation with the three live totals: indexed packages, exact versions, and dependency relationships. Always retain the scope statement: “Within Ripple's indexed npm snapshot.”

### Status panel

Loading, empty, missing, and unavailable states use the same bordered surface as results. Keep copy direct and task-specific. Loading states use quiet neutral blocks and a small blue status dot; errors use a restrained rose tint.

## Interaction states

- Primary actions use violet; the search action may use cyan/blue when placed on a dark surface.
- Secondary actions use a white surface with a zinc border. Paired calls to action must have equal width.
- Hover changes are small: darken a fill, strengthen a border, or shift text toward the semantic accent. Do not animate position or scale.
- All links, buttons, inputs, and selects need a visible violet `focus-visible` outline or ring.
- Selected version controls use violet/white. Unselected versions remain white with violet borders.
- Disabled actions use muted zinc colors and retain readable labels.
- Inputs preserve native semantics and clear labels; exact version entry uses monospace.

## Motion

- The homepage dependency signal is the one authored focal sequence: dashed energy moves from a selected exact release toward its resolved dependencies while two subtle source rings visualize propagation.
- API-backed results use one short clip reveal when the real data arrives.
- Motion never delays interaction and does not repeat as generic section entrances.
- Under `prefers-reduced-motion: reduce`, the signal becomes a continuous static line, source rings stop, and results render immediately.

## Responsive behavior

- Mobile follows the same narrative order as desktop: premise, proof, action, scope.
- Multi-column layouts collapse without hiding evidence or changing API-backed functionality.
- Paired CTAs stack full-width on mobile and become equal fixed-width buttons on larger screens.
- Relationship examples replace horizontal connectors with readable vertical separators when space is constrained.
- Tables and result rows should wrap exact identifiers rather than introduce page-level horizontal scrolling.
- Dense version sets use the native select; small sets use wrapping segmented buttons.

## Voice and content rules

- Write for a developer or recruiter who needs the product premise in under 30 seconds.
- Prefer questions and observable claims over graph terminology.
- Keep “package identity” and “exact-version dependency truth” visibly distinct.
- State traversal bounds and snapshot scope wherever a result could otherwise imply ecosystem-wide completeness.
- Do not add package descriptions, decorative metrics, speculative claims, or external metadata.
