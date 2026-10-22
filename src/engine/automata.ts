/** Formal-language engine. No DOM, network, eval, or command execution. */
export const ENGINE_VERSION = "1.0.0";
export const LIMITS = { pattern: 128, input: 2048, nfa: 256, dfa: 512 };
export const TEXT_ALPHABET = [
  "\t",
  "\n",
  "\r",
  ...Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)),
];
export type Mode = "whole" | "substring";
export class LabError extends Error {
  constructor(
    message: string,
    public kind: "invalid" | "incomplete" = "invalid",
    public offset?: number,
  ) {
    super(message);
  }
}
type Ast =
  | { type: "empty" }
  | { type: "chars"; chars: string[] }
  | { type: "concat" | "alt"; left: Ast; right: Ast }
  | { type: "repeat"; child: Ast; op: "*" | "+" | "?" };
export type Edge = { from: number; to: number; symbol: string | null };
export interface NFA {
  stateCount: number;
  start: number;
  accepts: number[];
  edges: Edge[];
  alphabet: string[];
}
export interface DFA {
  stateCount: number;
  start: number;
  accepts: number[];
  delta: Record<number, Record<string, number>>;
  alphabet: string[];
  members: number[][];
}
export interface SubsetStep {
  from: number;
  symbol: string;
  move: number[];
  closure: number[];
  to: number;
}
export interface Compilation {
  pattern: string;
  mode: Mode;
  nfa: NFA;
  dfa: DFA;
  minimal: DFA;
  closures: number[][];
  subsetSteps: SubsetStep[];
  partitions: number[][][];
}
export interface RunStep {
  index: number;
  symbol: string | null;
  active: number[];
  accepting: boolean;
}
export interface Comparison {
  equivalent: boolean;
  witness: string | null;
  visitedPairs: number;
  leftAccepted?: boolean;
  rightAccepted?: boolean;
  leftTrace?: RunStep[];
  rightTrace?: RunStep[];
}
const sorted = (s: Iterable<number>) => [...s].sort((a, b) => a - b);
const symbols = (s: Iterable<string>) =>
  [...new Set(s)].sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0));
export const showSymbol = (s: string | null) =>
  s === null
    ? "ε"
    : s === " "
      ? "␠"
      : s === "\n"
        ? "\\n"
        : s === "\t"
          ? "\\t"
          : s === "\r"
            ? "\\r"
            : s;
export function validateText(text: string) {
  if (text.length > LIMITS.input)
    throw new LabError(
      `Analysis incomplete: input exceeds ${LIMITS.input} characters.`,
      "incomplete",
    );
  const index = [...text].findIndex((c) => !TEXT_ALPHABET.includes(c));
  if (index !== -1)
    throw new LabError(
      "Only printable ASCII text and tab/newline/carriage return are supported.",
      "invalid",
      index,
    );
}
export function parseRegex(pattern: string): Ast {
  if (pattern.length > LIMITS.pattern)
    throw new LabError(
      `Analysis incomplete: regex exceeds ${LIMITS.pattern} characters.`,
      "incomplete",
    );
  if (!pattern.length)
    throw new LabError(
      "Enter a regex. Use ε for the empty string.",
      "invalid",
      0,
    );
  let pos = 0;
  const fail = (m: string): never => {
    throw new LabError(m, "invalid", pos);
  };
  function escaped(): string {
    pos++;
    if (pos >= pattern.length)
      return fail("An escape must be followed by a literal.");
    const c = pattern[pos++];
    if ("nrt".includes(c))
      return ({ n: "\n", r: "\r", t: "\t" } as Record<string, string>)[c];
    if (/[A-Za-z0-9]/.test(c))
      return fail(
        "Shorthand classes and backreferences are unsupported. Use an explicit class such as [0-9].",
      );
    if (!TEXT_ALPHABET.includes(c))
      return fail("Escaped literals must be ASCII.");
    return c;
  }
  function classChar(): string {
    if (pattern[pos] === "\\") return escaped();
    const c = pattern[pos++];
    if (!c || !TEXT_ALPHABET.includes(c))
      return fail("Character classes support ASCII characters only.");
    return c;
  }
  function atom(): Ast {
    const c = pattern[pos];
    if (c === "(") {
      pos++;
      const a = alternative();
      if (pattern[pos] !== ")") return fail("Missing closing parenthesis.");
      pos++;
      return a;
    }
    if (c === "ε") {
      pos++;
      return { type: "empty" };
    }
    if (c === "\\") return { type: "chars", chars: [escaped()] };
    if (c === "[") {
      pos++;
      if (pattern[pos] === "^")
        return fail("Negated character classes are unsupported.");
      const chars: string[] = [];
      while (pos < pattern.length && pattern[pos] !== "]") {
        const first = classChar();
        if (
          pattern[pos] === "-" &&
          pattern[pos + 1] &&
          pattern[pos + 1] !== "]"
        ) {
          pos++;
          const last = classChar();
          if (first.charCodeAt(0) > last.charCodeAt(0))
            return fail("Character range must be in ascending order.");
          for (let k = first.charCodeAt(0); k <= last.charCodeAt(0); k++)
            chars.push(String.fromCharCode(k));
        } else chars.push(first);
      }
      if (pattern[pos] !== "]") return fail("Missing closing square bracket.");
      pos++;
      if (!chars.length)
        return fail("Empty character classes are unsupported.");
      return { type: "chars", chars: symbols(chars) };
    }
    if (!c || "|)*+?]".includes(c))
      return fail("Expected a literal, ε, a group, or a character class.");
    if (".^${}".includes(c))
      return fail(
        `Unsupported regex operator ${c}. Escape it to match the literal character.`,
      );
    if (!TEXT_ALPHABET.includes(c))
      return fail("Regex literals must be printable ASCII.");
    pos++;
    return { type: "chars", chars: [c] };
  }
  function repeated(): Ast {
    let a = atom();
    if (pattern[pos] && "*+?".includes(pattern[pos])) {
      const op = pattern[pos++] as "*" | "+" | "?";
      a = { type: "repeat", child: a, op };
    }
    if (pattern[pos] && "*+?".includes(pattern[pos]))
      return fail("Repeated quantifiers are unsupported.");
    return a;
  }
  function concatenation(): Ast {
    if (!pattern[pos] || "|)".includes(pattern[pos]))
      return fail(
        "Empty alternatives/groups are unsupported. Use ε explicitly.",
      );
    let a = repeated();
    while (pos < pattern.length && !"|)".includes(pattern[pos]))
      a = { type: "concat", left: a, right: repeated() };
    return a;
  }
  function alternative(): Ast {
    let a = concatenation();
    while (pattern[pos] === "|") {
      pos++;
      a = { type: "alt", left: a, right: concatenation() };
    }
    return a;
  }
  const a = alternative();
  if (pos !== pattern.length) fail("Unexpected closing parenthesis.");
  return a;
}
export function thompson(pattern: string, mode: Mode = "whole"): NFA {
  const ast = parseRegex(pattern);
  let count = 0;
  const edges: Edge[] = [];
  const state = () => {
    if (count >= LIMITS.nfa)
      throw new LabError(
        "Analysis incomplete: NFA state limit reached.",
        "incomplete",
      );
    return count++;
  };
  const edge = (from: number, to: number, symbol: string | null = null) =>
    edges.push({ from, to, symbol });
  function build(a: Ast): [number, number] {
    if (a.type === "concat") {
      const l = build(a.left),
        r = build(a.right);
      edge(l[1], r[0]);
      return [l[0], r[1]];
    }
    const start = state(),
      end = state();
    if (a.type === "empty") edge(start, end);
    if (a.type === "chars") a.chars.forEach((c) => edge(start, end, c));
    if (a.type === "alt") {
      const l = build(a.left),
        r = build(a.right);
      edge(start, l[0]);
      edge(start, r[0]);
      edge(l[1], end);
      edge(r[1], end);
    }
    if (a.type === "repeat") {
      const c = build(a.child);
      edge(start, c[0]);
      edge(c[1], end);
      if (a.op !== "+") edge(start, end);
      if (a.op !== "?") edge(c[1], c[0]);
    }
    return [start, end];
  }
  let [start, end] = build(ast);
  if (mode === "substring") {
    const s = state(),
      e = state();
    edge(s, start);
    edge(end, e);
    TEXT_ALPHABET.forEach((c) => {
      edge(s, s, c);
      edge(e, e, c);
    });
    start = s;
    end = e;
  }
  return {
    stateCount: count,
    start,
    accepts: [end],
    edges,
    alphabet: symbols(
      edges.flatMap((e) => (e.symbol === null ? [] : [e.symbol])),
    ),
  };
}
export function epsilonClosure(nfa: NFA, states: number[]): number[] {
  const seen = new Set(states),
    queue = [...states];
  const eps = new Map<number, number[]>();
  nfa.edges.forEach((e) => {
    if (e.symbol === null) eps.set(e.from, [...(eps.get(e.from) ?? []), e.to]);
  });
  for (let i = 0; i < queue.length; i++)
    for (const next of eps.get(queue[i]) ?? [])
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
  return sorted(seen);
}
export function determinize(nfa: NFA): { dfa: DFA; steps: SubsetStep[] } {
  const subsets = [epsilonClosure(nfa, [nfa.start])],
    ids = new Map([[subsets[0].join(","), 0]]);
  const delta: DFA["delta"] = {},
    steps: SubsetStep[] = [];
  const moves = new Map<string, number[]>();
  nfa.edges.forEach((e) => {
    if (e.symbol !== null) {
      const k = `${e.from}:${e.symbol}`;
      moves.set(k, [...(moves.get(k) ?? []), e.to]);
    }
  });
  for (let i = 0; i < subsets.length; i++) {
    delta[i] = {};
    for (const symbol of nfa.alphabet) {
      const move = sorted(
        new Set(subsets[i].flatMap((q) => moves.get(`${q}:${symbol}`) ?? [])),
      );
      const closure = epsilonClosure(nfa, move),
        key = closure.join(",");
      if (!ids.has(key)) {
        if (subsets.length >= LIMITS.dfa)
          throw new LabError(
            "Analysis incomplete: DFA state limit reached.",
            "incomplete",
          );
        ids.set(key, subsets.length);
        subsets.push(closure);
      }
      const to = ids.get(key)!;
      delta[i][symbol] = to;
      steps.push({ from: i, symbol, move, closure, to });
    }
  }
  return {
    dfa: {
      stateCount: subsets.length,
      start: 0,
      accepts: subsets.flatMap((s, i) =>
        s.some((q) => nfa.accepts.includes(q)) ? [i] : [],
      ),
      delta,
      alphabet: [...nfa.alphabet],
      members: subsets,
    },
    steps,
  };
}
export function minimize(dfa: DFA): { dfa: DFA; partitions: number[][][] } {
  // Remove unreachable states before Hopcroft partition refinement.
  const reachable = new Set([dfa.start]),
    queue = [dfa.start];
  for (let i = 0; i < queue.length; i++)
    for (const c of dfa.alphabet) {
      const q = dfa.delta[queue[i]][c];
      if (!reachable.has(q)) {
        reachable.add(q);
        queue.push(q);
      }
    }
  const accepting = new Set(dfa.accepts);
  let p = [
    new Set([...reachable].filter((q) => accepting.has(q))),
    new Set([...reachable].filter((q) => !accepting.has(q))),
  ].filter((s) => s.size);
  const work = [...p],
    partitions = [p.map(sorted)];
  while (work.length) {
    const a = work.pop()!;
    for (const c of dfa.alphabet) {
      const preimage = new Set(
        [...reachable].filter((q) => a.has(dfa.delta[q][c])),
      );
      const next: Set<number>[] = [];
      for (const y of p) {
        const inside = new Set([...y].filter((q) => preimage.has(q))),
          outside = new Set([...y].filter((q) => !preimage.has(q)));
        if (inside.size && outside.size) {
          next.push(inside, outside);
          const idx = work.indexOf(y);
          if (idx >= 0) work.splice(idx, 1, inside, outside);
          else work.push(inside.size <= outside.size ? inside : outside);
        } else next.push(y);
      }
      if (next.length !== p.length) partitions.push(next.map(sorted));
      p = next;
    }
  }
  // Stable labels: start block first, other blocks ordered by least original state.
  p.sort((a, b) =>
    a.has(dfa.start)
      ? -1
      : b.has(dfa.start)
        ? 1
        : Math.min(...a) - Math.min(...b),
  );
  const map = new Map<number, number>();
  p.forEach((g, i) => g.forEach((q) => map.set(q, i)));
  const delta: DFA["delta"] = {};
  p.forEach((g, i) => {
    const q = g.values().next().value!;
    delta[i] = {};
    dfa.alphabet.forEach((c) => {
      delta[i][c] = map.get(dfa.delta[q][c])!;
    });
  });
  return {
    dfa: {
      stateCount: p.length,
      start: 0,
      accepts: p.flatMap((g, i) =>
        [...g].some((q) => accepting.has(q)) ? [i] : [],
      ),
      delta,
      alphabet: [...dfa.alphabet],
      members: p.map(sorted),
    },
    partitions,
  };
}
export function compile(pattern: string, mode: Mode = "whole"): Compilation {
  const nfa = thompson(pattern, mode),
    { dfa, steps } = determinize(nfa),
    min = minimize(dfa);
  return {
    pattern,
    mode,
    nfa,
    dfa,
    minimal: min.dfa,
    closures: Array.from({ length: nfa.stateCount }, (_, q) =>
      epsilonClosure(nfa, [q]),
    ),
    subsetSteps: steps,
    partitions: min.partitions,
  };
}
export function runDfa(dfa: DFA, text: string): RunStep[] {
  validateText(text);
  let q = dfa.start;
  const trace: RunStep[] = [
    { index: 0, symbol: null, active: [q], accepting: dfa.accepts.includes(q) },
  ];
  [...text].forEach((symbol, i) => {
    q = dfa.delta[q]?.[symbol] ?? -1;
    trace.push({
      index: i + 1,
      symbol,
      active: [q],
      accepting: dfa.accepts.includes(q),
    });
  });
  return trace;
}
export function runNfa(nfa: NFA, text: string): RunStep[] {
  validateText(text);
  let active = epsilonClosure(nfa, [nfa.start]);
  const trace: RunStep[] = [
    {
      index: 0,
      symbol: null,
      active,
      accepting: active.some((q) => nfa.accepts.includes(q)),
    },
  ];
  [...text].forEach((symbol, i) => {
    active = epsilonClosure(
      nfa,
      sorted(
        new Set(
          nfa.edges
            .filter((e) => active.includes(e.from) && e.symbol === symbol)
            .map((e) => e.to),
        ),
      ),
    );
    trace.push({
      index: i + 1,
      symbol,
      active,
      accepting: active.some((q) => nfa.accepts.includes(q)),
    });
  });
  return trace;
}
export const accepts = (dfa: DFA, text: string) =>
  runDfa(dfa, text).at(-1)!.accepting;
export function compareDfa(left: DFA, right: DFA): Comparison {
  const alphabet = symbols([...left.alphabet, ...right.alphabet]);
  const nodes = [{ l: left.start, r: right.start, parent: -1, symbol: "" }],
    seen = new Set([`${left.start},${right.start}`]);
  for (let index = 0; index < nodes.length; index++) {
    const n = nodes[index],
      l = left.accepts.includes(n.l),
      r = right.accepts.includes(n.r);
    if (l !== r) {
      const chars: string[] = [];
      let i = index;
      while (nodes[i].parent !== -1) {
        chars.push(nodes[i].symbol);
        i = nodes[i].parent;
      }
      const witness = chars.reverse().join("");
      return {
        equivalent: false,
        witness,
        visitedPairs: index + 1,
        leftAccepted: l,
        rightAccepted: r,
        leftTrace: runDfa(left, witness),
        rightTrace: runDfa(right, witness),
      };
    }
    for (const symbol of alphabet) {
      const l = left.delta[n.l]?.[symbol] ?? -1,
        r = right.delta[n.r]?.[symbol] ?? -1,
        key = `${l},${r}`;
      if (!seen.has(key)) {
        seen.add(key);
        nodes.push({ l, r, parent: index, symbol });
      }
    }
  }
  return { equivalent: true, witness: null, visitedPairs: nodes.length };
}
export function findMatches(
  dfa: DFA,
  text: string,
): { start: number; end: number }[] {
  validateText(text);
  const matches: { start: number; end: number }[] = [];
  // Non-overlapping leftmost-longest matches; zero-length matches advance one character.
  for (let start = 0; start <= text.length;) {
    let q = dfa.start,
      end = dfa.accepts.includes(q) ? start : -1;
    for (let i = start; i < text.length; i++) {
      q = dfa.delta[q]?.[text[i]] ?? -1;
      if (q === -1) break;
      if (dfa.accepts.includes(q)) end = i + 1;
    }
    if (end !== -1) {
      matches.push({ start, end });
      start = Math.max(end, start + 1);
    } else start++;
  }
  return matches;
}
