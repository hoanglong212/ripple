const EDGES = [
  {
    color: "var(--ripple-cyan)",
    label: "^3.0.1",
    path: "M 154 210 C 270 210, 300 78, 434 78",
  },
  {
    color: "var(--ripple-violet-soft)",
    label: "^1.0.0",
    path: "M 154 210 C 282 210, 306 210, 434 210",
  },
  {
    color: "var(--ripple-mint)",
    label: "^2.0.2",
    path: "M 154 210 C 270 210, 300 342, 434 342",
  },
] as const;

export function DependencyRippleVisual() {
  return (
    <figure
      aria-label="Animated diagram showing dependency signals propagating from ajv version 8.20.0 to three exact dependency versions"
      className="ripple-visual relative min-h-[27rem] overflow-hidden border border-violet-300/40 bg-[#17132c] text-white shadow-[0_28px_70px_-34px_rgba(61,43,145,0.65)] sm:min-h-[31rem]"
      role="img"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-xs text-violet-100/70">
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400" />
          Live dependency trace
        </span>
        <span className="font-mono">root-origin edges</span>
      </div>

      <svg
        aria-hidden="true"
        className="absolute inset-x-0 top-14 h-[23rem] w-full sm:h-[27rem]"
        preserveAspectRatio="none"
        viewBox="0 0 640 420"
      >
        {EDGES.map((edge) => (
          <g key={edge.path}>
            <path
              className="dependency-edge-base"
              d={edge.path}
              fill="none"
              stroke="rgba(255,255,255,0.13)"
              strokeWidth="2"
            />
            <path
              className="dependency-edge-signal"
              d={edge.path}
              fill="none"
              stroke={edge.color}
              strokeLinecap="round"
              strokeWidth="2.5"
            />
          </g>
        ))}
      </svg>

      <div className="ripple-source absolute left-[6%] top-[42%] z-10 w-[42%] max-w-48 border border-violet-300/50 bg-violet-500/20 p-4 backdrop-blur-sm">
        <p className="text-[0.68rem] font-medium text-violet-200">Selected exact release</p>
        <code className="mt-2 block break-all text-sm font-semibold text-white">
          ajv@8.20.0
        </code>
        <p className="mt-3 flex items-center gap-2 text-[0.68rem] text-violet-200/75">
          <span className="size-1.5 rounded-full bg-violet-300" />
          dependency truth starts here
        </p>
      </div>

      <div className="absolute right-[5%] top-[17%] z-10 w-[38%] border border-cyan-300/35 bg-[#211c39]/95 p-3">
        <p className="text-[0.64rem] text-cyan-200">requires ^3.0.1</p>
        <code className="mt-1 block break-all text-xs font-semibold">fast-uri@3.1.6</code>
      </div>
      <div className="absolute right-[5%] top-[45%] z-10 w-[38%] border border-violet-300/35 bg-[#211c39]/95 p-3">
        <p className="text-[0.64rem] text-violet-200">requires ^1.0.0</p>
        <code className="mt-1 block break-all text-xs font-semibold">
          json-schema-traverse@1.0.0
        </code>
      </div>
      <div className="absolute right-[5%] top-[73%] z-10 w-[38%] border border-emerald-300/35 bg-[#211c39]/95 p-3">
        <p className="text-[0.64rem] text-emerald-200">requires ^2.0.2</p>
        <code className="mt-1 block break-all text-xs font-semibold">
          require-from-string@2.0.2
        </code>
      </div>

      <figcaption className="absolute inset-x-5 bottom-4 z-10 border-t border-white/10 pt-3 text-xs leading-5 text-violet-100/65">
        Each signal is one declared dependency edge from this exact release.
      </figcaption>
    </figure>
  );
}
