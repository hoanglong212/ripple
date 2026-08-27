// The homepage's authored focal illustration. One source release, its three
// resolved targets, and the requirement declared on each edge — drawn in a
// single accent so the diagram reads as an instrument trace, not decoration.
//
// The requirement sits inside its target card rather than floating on the
// curve: an edge label overlapping its own edge is unreadable at any size.
const SOURCE = "ajv@8.20.0";

const TARGETS = [
  {
    edge: "M 236 208 C 306 208, 322 84, 392 84",
    requirement: "^3.0.1",
    target: "fast-uri@3.1.6",
    y: 84,
  },
  {
    edge: "M 236 208 C 306 208, 322 208, 392 208",
    requirement: "^1.0.0",
    target: "json-schema-traverse@1.0.0",
    y: 208,
  },
  {
    edge: "M 236 208 C 306 208, 322 332, 392 332",
    requirement: "^2.0.2",
    target: "require-from-string@2.0.2",
    y: 332,
  },
] as const;

export function DependencyRippleVisual() {
  return (
    <figure
      aria-label="Diagram: ajv@8.20.0 resolves three exact dependency versions, each carrying its declared requirement"
      className="overflow-hidden border border-[var(--hairline)] bg-ink-850"
      role="img"
    >
      <figcaption className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-3 font-mono text-[0.7rem] tracking-wide text-mist-600">
        <span className="flex items-center gap-2">
          <span className="size-1.5 bg-signal" />
          dependency trace
        </span>
        <span>root-origin edges</span>
      </figcaption>

      <svg
        className="block w-full"
        role="presentation"
        viewBox="0 0 640 416"
        xmlns="http://www.w3.org/2000/svg"
      >
        {TARGETS.map((item) => (
          <g key={`${item.target}-edge`}>
            <path
              d={item.edge}
              fill="none"
              stroke="var(--color-signal)"
              strokeOpacity="0.16"
              strokeWidth="1"
            />
            <path
              className="edge-flow"
              d={item.edge}
              fill="none"
              stroke="var(--color-signal)"
              strokeOpacity="0.8"
              strokeWidth="1.25"
            />
          </g>
        ))}

        {/* Source release. A stroke-only ring marks selection; a filled slab
            would read as a highlighter rather than an instrument cursor. */}
        <g>
          <rect
            className="node-breathe"
            fill="none"
            height="92"
            stroke="var(--color-signal)"
            strokeWidth="1"
            style={{ transformOrigin: "134px 208px" }}
            width="214"
            x="27"
            y="162"
          />
          <rect
            fill="var(--color-ink-800)"
            height="72"
            stroke="var(--color-signal)"
            strokeWidth="1.25"
            width="196"
            x="38"
            y="172"
          />
          <text
            fill="var(--color-mist-600)"
            fontFamily="var(--font-mono)"
            fontSize="10"
            x="54"
            y="196"
          >
            selected release
          </text>
          <text
            fill="var(--color-signal)"
            fontFamily="var(--font-mono)"
            fontSize="15"
            fontWeight="600"
            x="54"
            y="220"
          >
            {SOURCE}
          </text>
        </g>

        {/* Resolved exact targets, each carrying its own declared requirement. */}
        {TARGETS.map((item) => (
          <g key={`${item.target}-node`}>
            <rect
              fill="var(--color-ink-800)"
              height="66"
              stroke="var(--hairline-strong)"
              strokeWidth="1"
              width="222"
              x="392"
              y={item.y - 33}
            />
            <rect
              fill="var(--color-signal)"
              height="66"
              width="2"
              x="392"
              y={item.y - 33}
            />
            <text
              fill="var(--color-mist-600)"
              fontFamily="var(--font-mono)"
              fontSize="10"
              x="408"
              y={item.y - 11}
            >
              requires {item.requirement}
            </text>
            <text
              fill="var(--color-mist-100)"
              fontFamily="var(--font-mono)"
              fontSize="12"
              x="408"
              y={item.y + 11}
            >
              {item.target}
            </text>
          </g>
        ))}
      </svg>

      <p className="border-t border-[var(--hairline)] px-5 py-3.5 text-xs leading-5 text-mist-600">
        Each line is one declared dependency edge from this exact release. Change
        the release and the lines change with it.
      </p>
    </figure>
  );
}
