import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import dagre from "@dagrejs/dagre";
import { showSymbol, type DFA, type NFA } from "./engine/automata";
export function download(
  name: string,
  data: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Badge({
  children,
  kind = "neutral",
}: {
  children: ReactNode;
  kind?: "good" | "bad" | "neutral" | "amber";
}) {
  return <span className={`badge ${kind}`}>{children}</span>;
}
export function Panel({
  title,
  eyebrow,
  children,
  actions,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          {title && <h2>{title}</h2>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
export function Playback({
  max,
  step,
  setStep,
  label = "Replay",
}: {
  max: number;
  step: number;
  setStep: (n: number) => void;
  label?: string;
}) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setStep(Math.min(max, step + 1)), 650);
    if (step >= max) setPlaying(false);
    return () => clearInterval(id);
  }, [playing, step, max, setStep]);
  return (
    <div className="playback" aria-label={label}>
      <button
        className="icon-button"
        aria-label={`${label}: restart`}
        onClick={() => {
          setPlaying(false);
          setStep(0);
        }}
      >
        <RotateCcw size={15} />
      </button>
      <button
        className="icon-button"
        aria-label={`${label}: previous step`}
        disabled={!step}
        onClick={() => {
          setPlaying(false);
          setStep(step - 1);
        }}
      >
        <ChevronLeft size={17} />
      </button>
      <button
        className="play-button"
        aria-label={`${label}: ${playing ? "pause" : "play"}`}
        disabled={!max}
        onClick={() => {
          if (step >= max) setStep(0);
          setPlaying(!playing);
        }}
      >
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <button
        className="icon-button"
        aria-label={`${label}: next step`}
        disabled={step >= max}
        onClick={() => {
          setPlaying(false);
          setStep(step + 1);
        }}
      >
        <ChevronRight size={17} />
      </button>
      <input
        aria-label={`${label}: step`}
        type="range"
        min="0"
        max={max}
        value={Math.min(step, max)}
        onChange={(e) => {
          setPlaying(false);
          setStep(+e.target.value);
        }}
      />
      <span className="mono small">
        {Math.min(step, max)} / {max}
      </span>
    </div>
  );
}
function compact(chars: string[]) {
  if (chars.length > 80) return "ASCII";
  const cs = [...new Set(chars)].sort(
    (a, b) => a.charCodeAt(0) - b.charCodeAt(0),
  );
  const out: string[] = [];
  for (let i = 0; i < cs.length; i++) {
    let j = i;
    while (
      j + 1 < cs.length &&
      cs[j + 1].charCodeAt(0) === cs[j].charCodeAt(0) + 1
    )
      j++;
    if (j - i >= 2) {
      out.push(`${showSymbol(cs[i])}–${showSymbol(cs[j])}`);
      i = j;
    } else out.push(showSymbol(cs[i]));
  }
  return out.join(", ");
}
export function AutomatonGraph({
  machine,
  active = [],
  title = "Automaton",
}: {
  machine: NFA | DFA;
  active?: number[];
  title?: string;
}) {
  const marker = useId().replaceAll(":", ""),
    [zoom, setZoom] = useState(0.85);
  const layout = useMemo(() => {
    if (machine.stateCount > 80) return null;
    const edges =
      "edges" in machine
        ? machine.edges
        : Object.entries(machine.delta).flatMap(([from, row]) =>
            Object.entries(row).map(([symbol, to]) => ({
              from: +from,
              to,
              symbol,
            })),
          );
    const grouped = new Map<
      string,
      { from: number; to: number; chars: string[]; epsilon: boolean }
    >();
    edges.forEach((e) => {
      const key = `${e.from}:${e.to}`;
      if (!grouped.has(key))
        grouped.set(key, { from: e.from, to: e.to, chars: [], epsilon: false });
      const g = grouped.get(key)!;
      if (e.symbol === null) g.epsilon = true;
      else g.chars.push(e.symbol);
    });
    const g = new dagre.graphlib.Graph()
      .setGraph({
        rankdir: "LR",
        ranksep: 66,
        nodesep: 26,
        marginx: 48,
        marginy: 35,
      })
      .setDefaultEdgeLabel(() => ({}));
    for (let i = 0; i < machine.stateCount; i++)
      g.setNode(String(i), { width: 48, height: 48 });
    [...grouped.values()].forEach((e) => {
      const label = [e.epsilon ? "ε" : "", compact(e.chars)]
        .filter(Boolean)
        .join(", ");
      g.setEdge(String(e.from), String(e.to), {
        label,
        width: Math.min(160, Math.max(20, label.length * 7)),
        height: 19,
      });
    });
    dagre.layout(g);
    return {
      graph: g,
      nodes: g.nodes().map((id) => ({ id: +id, ...g.node(id) })),
      edges: g
        .edges()
        .map((e) => ({
          from: +e.v,
          to: +e.w,
          ...(g.edge(e) as {
            points: { x: number; y: number }[];
            x: number;
            y: number;
            width: number;
            label: string;
          }),
          full: grouped.get(`${e.v}:${e.w}`)!,
        })),
      width: g.graph().width! + 20,
      height: Math.max(150, g.graph().height!),
    };
  }, [machine]);
  if (!layout)
    return (
      <div className="empty">
        This machine has {machine.stateCount} states. Use the complete
        transition table below; diagram rendering is limited to 80 states for
        readability.
      </div>
    );
  const start = layout.nodes.find((n) => n.id === machine.start)!;
  const exportSvg = () => {
    const svg = document.getElementById(`graph-${marker}`)?.cloneNode(true) as
      SVGElement | undefined;
    if (!svg) return;
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("width", String(layout.width));
    svg.setAttribute("height", String(layout.height));
    download(
      "autosec-automaton.svg",
      new XMLSerializer().serializeToString(svg),
      "image/svg+xml",
    );
  };
  return (
    <div className="graph-wrap">
      <div className="graph-toolbar">
        <span>
          <i className="dot teal" /> Active state{" "}
          <span className="graph-key">◎ Accepting state</span>
        </span>
        <div>
          <button
            className="text-button"
            aria-label="Zoom out"
            onClick={() => setZoom(Math.max(0.3, zoom - 0.15))}
          >
            −
          </button>
          <span className="small mono">{Math.round(zoom * 100)}%</span>
          <button
            className="text-button"
            aria-label="Zoom in"
            onClick={() => setZoom(Math.min(1.6, zoom + 0.15))}
          >
            +
          </button>
          <button className="text-button" onClick={exportSvg}>
            <Download size={14} /> SVG
          </button>
        </div>
      </div>
      <div className="graph-scroll">
        <svg
          id={`graph-${marker}`}
          role="img"
          aria-label={title}
          width={layout.width * zoom}
          height={layout.height * zoom}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
        >
          <title>
            {title}; start q{machine.start}; accepting{" "}
            {machine.accepts.map((n) => `q${n}`).join(", ") || "none"}
          </title>
          <defs>
            <marker
              id={marker}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" fill="#74878b" />
            </marker>
          </defs>
          <path
            d={`M${start.x - 49},${start.y} L${start.x - 25},${start.y}`}
            stroke="#74878b"
            strokeWidth="1.8"
            markerEnd={`url(#${marker})`}
          />
          {layout.edges.map((e, i) => (
            <g key={i}>
              <path
                d={e.points
                  .map((p, j) => `${j ? "L" : "M"}${p.x},${p.y}`)
                  .join(" ")}
                fill="none"
                stroke={active.includes(e.from) ? "#148879" : "#97a5a6"}
                strokeWidth={active.includes(e.from) ? 2 : 1.4}
                markerEnd={`url(#${marker})`}
              />
              <rect
                x={e.x - e.width / 2 - 3}
                y={e.y - 10}
                width={e.width + 6}
                height="20"
                rx="3"
                fill="#f8faf8"
              />
              <text
                x={e.x}
                y={e.y + 4}
                textAnchor="middle"
                fill="#50676b"
                fontFamily="monospace"
                fontSize="11"
              >
                <title>
                  {e.full.epsilon ? "ε; " : ""}
                  {e.full.chars.map(showSymbol).join(", ")}
                </title>
                {e.label}
              </text>
            </g>
          ))}
          {layout.nodes.map((n) => (
            <g key={n.id}>
              <circle
                cx={n.x}
                cy={n.y}
                r="23"
                fill={active.includes(n.id) ? "#137e70" : "#ffffff"}
                stroke={active.includes(n.id) ? "#137e70" : "#799195"}
                strokeWidth="1.7"
              />
              {machine.accepts.includes(n.id) && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r="18"
                  fill="none"
                  stroke={active.includes(n.id) ? "#ffffff" : "#799195"}
                  strokeWidth="1.2"
                />
              )}
              <text
                x={n.x}
                y={n.y + 4}
                textAnchor="middle"
                fill={active.includes(n.id) ? "#ffffff" : "#28474e"}
                fontFamily="monospace"
                fontSize="12"
              >
                q{n.id}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {active.includes(-1) && (
        <p className="small error-text">
          Active state: implicit dead state ⊥ (symbol outside this machine’s
          alphabet).
        </p>
      )}
    </div>
  );
}
export function DataTable({
  headers,
  rows,
  caption,
}: {
  headers: string[];
  rows: ReactNode[][];
  caption?: string;
}) {
  return (
    <div className="table-scroll">
      <table>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <td key={j}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function DfaTable({ dfa }: { dfa: DFA }) {
  const [page, setPage] = useState(0);
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    dfa.alphabet.forEach((c) => {
      const key = Array.from(
        { length: dfa.stateCount },
        (_, q) => dfa.delta[q][c],
      ).join(",");
      map.set(key, [...(map.get(key) ?? []), c]);
    });
    return [...map.values()];
  }, [dfa]);
  return (
    <>
      <DataTable
        caption="Equivalent symbol columns are grouped; every transition is represented."
        headers={["State", "Represents", ...groups.map(compact)]}
        rows={Array.from({ length: dfa.stateCount }, (_, q) => q)
          .slice(page * 25, page * 25 + 25)
          .map((q) => [
            `${q === dfa.start ? "→ " : ""}${dfa.accepts.includes(q) ? "* " : ""}q${q}`,
            `{${dfa.members[q].join(", ") || "∅"}}`,
            ...groups.map((cs) => `q${dfa.delta[q][cs[0]]}`),
          ])}
      />
      {dfa.stateCount > 25 && (
        <div className="row">
          <button disabled={!page} onClick={() => setPage(page - 1)}>
            Previous states
          </button>
          <span>
            {page * 25 + 1}–{Math.min((page + 1) * 25, dfa.stateCount)} /{" "}
            {dfa.stateCount}
          </span>
          <button
            disabled={(page + 1) * 25 >= dfa.stateCount}
            onClick={() => setPage(page + 1)}
          >
            Next states
          </button>
        </div>
      )}
    </>
  );
}
