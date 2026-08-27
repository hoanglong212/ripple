/*
 * The homepage's authored focal illustration: Ripple's graph model itself,
 * not one worked example.
 *
 *   (:Package)-[:HAS_VERSION]->(:Version)-[:DEPENDS_ON { requirement }]->(:Version)
 *
 * The argument is carried by the drawing rather than a caption. One package
 * owns three indexed versions, but only the selected one resolves dependency
 * edges; the other two show faded stubs, because their dependency truth is
 * their own and is never merged into the package.
 */

const VERSIONS = [
  { label: "version", selected: false, x: 92 },
  { label: "exact version", selected: true, x: 261 },
  { label: "version", selected: false, x: 430 },
] as const;

const DEPENDENCIES = [
  { edge: "M 320 244 C 320 302, 246 302, 246 348", x: 182 },
  { edge: "M 320 244 C 320 302, 466 302, 466 348", x: 402 },
] as const;

const VERSION_WIDTH = 118;
const DEPENDENCY_WIDTH = 128;

export function DependencyRippleVisual() {
  return (
    <figure
      aria-label="Diagram of Ripple's graph model: one Package owns several indexed Versions through HAS_VERSION, and only the selected exact Version resolves DEPENDS_ON edges, each carrying its declared requirement"
      className="overflow-hidden border border-[var(--hairline)] bg-ink-850"
      role="img"
    >
      <figcaption className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-3 font-mono text-[0.7rem] tracking-wide text-mist-600">
        <span className="flex items-center gap-2">
          <span className="size-1.5 bg-signal" />
          graph model
        </span>
        <span>exact-version traversal</span>
      </figcaption>

      <svg
        className="block w-full"
        role="presentation"
        viewBox="0 0 640 430"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* HAS_VERSION — ownership is structural, so these edges stay static. */}
        {VERSIONS.map((version) => (
          <path
            d={`M 320 80 C 320 130, ${version.x + VERSION_WIDTH / 2} 130, ${
              version.x + VERSION_WIDTH / 2
            } 190`}
            fill="none"
            key={`edge-${version.x}`}
            stroke="var(--hairline-strong)"
            strokeWidth="1"
          />
        ))}

        {/* DEPENDS_ON — traversal, so these carry the moving signal. */}
        {DEPENDENCIES.map((dependency) => (
          <g key={`dep-${dependency.x}`}>
            <path
              d={dependency.edge}
              fill="none"
              stroke="var(--color-signal)"
              strokeOpacity="0.18"
              strokeWidth="1"
            />
            <path
              className="edge-flow"
              d={dependency.edge}
              fill="none"
              stroke="var(--color-signal)"
              strokeOpacity="0.85"
              strokeWidth="1.25"
            />
          </g>
        ))}

        {/* Unselected versions keep their own edges — shown, not traversed. */}
        {VERSIONS.filter((version) => !version.selected).map((version) => (
          <path
            d={`M ${version.x + VERSION_WIDTH / 2} 244 V 300`}
            key={`stub-${version.x}`}
            stroke="var(--hairline-strong)"
            strokeDasharray="3 5"
            strokeWidth="1"
          />
        ))}

        {/* Relationship names, in the left margin so no label sits on an edge. */}
        <text fill="var(--color-mist-600)" fontFamily="var(--font-mono)" fontSize="11" x="14" y="140">
          HAS_VERSION
        </text>
        <text fill="var(--color-signal)" fontFamily="var(--font-mono)" fontSize="11" x="14" y="298">
          DEPENDS_ON
        </text>
        <text fill="var(--color-mist-600)" fontFamily="var(--font-mono)" fontSize="11" x="14" y="313">
          {"{ requirement }"}
        </text>

        {/* Package identity layer. */}
        <g>
          <rect
            fill="var(--color-ink-800)"
            height="52"
            stroke="var(--hairline-strong)"
            strokeWidth="1"
            width="160"
            x="240"
            y="28"
          />
          <text fill="var(--color-mist-600)" fontFamily="var(--font-mono)" fontSize="10" x="256" y="48">
            identity layer
          </text>
          <text fill="var(--color-mist-100)" fontFamily="var(--font-mono)" fontSize="14" x="256" y="68">
            package
          </text>
        </g>

        {/* Indexed versions. Only one is under analysis. */}
        {VERSIONS.map((version) => (
          <g key={`node-${version.x}`}>
            {version.selected && (
              <rect
                className="node-breathe"
                fill="none"
                height="72"
                stroke="var(--color-signal)"
                strokeWidth="1"
                style={{ transformOrigin: "320px 216px" }}
                width="142"
                x="249"
                y="180"
              />
            )}
            <rect
              fill="var(--color-ink-800)"
              height="52"
              stroke={version.selected ? "var(--color-signal)" : "var(--hairline-strong)"}
              strokeWidth={version.selected ? "1.25" : "1"}
              width={VERSION_WIDTH}
              x={version.x}
              y="190"
            />
            <text
              fill="var(--color-mist-600)"
              fontFamily="var(--font-mono)"
              fontSize="10"
              x={version.x + 14}
              y="210"
            >
              {version.selected ? "selected" : "indexed"}
            </text>
            <text
              fill={version.selected ? "var(--color-signal)" : "var(--color-mist-500)"}
              fontFamily="var(--font-mono)"
              fontSize="12"
              x={version.x + 14}
              y="230"
            >
              {version.label}
            </text>
          </g>
        ))}

        {/* Resolved dependency versions. */}
        {DEPENDENCIES.map((dependency) => (
          <g key={`target-${dependency.x}`}>
            <rect
              fill="var(--color-ink-800)"
              height="48"
              stroke="var(--hairline-strong)"
              strokeWidth="1"
              width={DEPENDENCY_WIDTH}
              x={dependency.x}
              y="348"
            />
            <rect fill="var(--color-signal)" height="48" width="2" x={dependency.x} y="348" />
            <text
              fill="var(--color-mist-600)"
              fontFamily="var(--font-mono)"
              fontSize="10"
              x={dependency.x + 14}
              y="368"
            >
              resolved
            </text>
            <text
              fill="var(--color-mist-100)"
              fontFamily="var(--font-mono)"
              fontSize="13"
              x={dependency.x + 14}
              y="386"
            >
              version
            </text>
          </g>
        ))}
      </svg>

      <p className="border-t border-[var(--hairline)] px-5 py-3.5 text-xs leading-5 text-mist-600">
        A package owns many indexed versions, but dependency truth belongs to one
        exact release. Ripple never merges them.
      </p>
    </figure>
  );
}
