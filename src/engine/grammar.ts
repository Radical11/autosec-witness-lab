import { LabError, validateText } from "./automata";
export interface Token {
  type: string;
  text: string;
  start: number;
  end: number;
}
export interface Diagnostic {
  message: string;
  offset: number;
  expected?: string[];
}
export interface LexResult {
  tokens: Token[];
  error?: Diagnostic;
}
export const GRAMMAR: Record<string, string[][]> = {
  Script: [["Statement", "Rest"]],
  Rest: [[";", "Statement", "Rest"], []],
  Statement: [
    ["WORD", "Args"],
    ["(", "Script", ")"],
  ],
  Args: [["Arg", "Args"], []],
  Arg: [["FLAG", "Value"], ["Value"]],
  Value: [["WORD"], ["QUOTED"]],
};
export interface GrammarInfo {
  first: Record<string, string[]>;
  follow: Record<string, string[]>;
  table: Record<string, Record<string, string[]>>;
  terminals: string[];
}
export interface ParseNode {
  id: number;
  symbol: string;
  children: number[];
  token?: Token;
}
export interface ParseStep {
  stack: string[];
  remaining: string[];
  action: string;
  offset: number;
}
export interface ParseResult {
  accepted: boolean;
  trace: ParseStep[];
  nodes: ParseNode[];
  error?: Diagnostic;
}
export function tokenize(text: string): LexResult {
  validateText(text);
  const tokens: Token[] = [];
  let p = 0;
  const fail = (message: string, offset = p): LexResult => ({
    tokens,
    error: { message, offset },
  });
  let needsSpace = false;
  while (p < text.length) {
    if (/\s/.test(text[p])) {
      p++;
      needsSpace = false;
      continue;
    }
    const start = p,
      c = text[p];
    if (";()".includes(c)) {
      tokens.push({ type: c, text: c, start, end: ++p });
      needsSpace = false;
      continue;
    }
    if (needsSpace)
      return fail("Separate words, flags, and quoted values with whitespace.");
    if (c === '"') {
      p++;
      let closed = false;
      while (p < text.length) {
        if (text[p] === "\\") {
          if (!['"', "\\"].includes(text[p + 1]))
            return fail(
              "Inside quotes, only escaped quotes and backslashes are supported.",
              p,
            );
          p += 2;
        } else if (text[p] === '"') {
          p++;
          closed = true;
          break;
        } else p++;
      }
      if (!closed)
        return fail(
          "Unterminated quoted value: add a closing double quote.",
          start,
        );
      tokens.push({
        type: "QUOTED",
        text: text.slice(start, p),
        start,
        end: p,
      });
      needsSpace = true;
      continue;
    }
    if (text.startsWith("--", p)) {
      const flag = text.slice(p).match(/^--[a-z]+/);
      if (!flag)
        return fail("A flag must contain -- followed by lowercase letters.");
      p += flag[0].length;
      tokens.push({ type: "FLAG", text: flag[0], start, end: p });
      needsSpace = true;
      continue;
    }
    const word = text.slice(p).match(/^[A-Za-z0-9_./:][A-Za-z0-9_./:\-]*/);
    if (word) {
      p += word[0].length;
      tokens.push({ type: "WORD", text: word[0], start, end: p });
      needsSpace = true;
      continue;
    }
    return fail(
      `Unsupported character ${JSON.stringify(c)} in this command language.`,
    );
  }
  return { tokens };
}
function firstSequence(
  sequence: string[],
  first: Record<string, Set<string>>,
): Set<string> {
  const out = new Set<string>();
  let nullable = true;
  for (const symbol of sequence) {
    const set = first[symbol] ?? new Set([symbol]);
    set.forEach((t) => {
      if (t !== "ε") out.add(t);
    });
    if (!set.has("ε")) {
      nullable = false;
      break;
    }
  }
  if (nullable) out.add("ε");
  return out;
}
export function grammarInfo(): GrammarInfo {
  const nonterminals = Object.keys(GRAMMAR),
    first: Record<string, Set<string>> = {},
    follow: Record<string, Set<string>> = {};
  nonterminals.forEach((n) => {
    first[n] = new Set();
    follow[n] = new Set();
  });
  follow.Script.add("$");
  let changed = true;
  while (changed) {
    changed = false;
    for (const [n, rules] of Object.entries(GRAMMAR))
      for (const rule of rules)
        for (const t of firstSequence(rule, first))
          if (!first[n].has(t)) {
            first[n].add(t);
            changed = true;
          }
  }
  changed = true;
  while (changed) {
    changed = false;
    for (const [n, rules] of Object.entries(GRAMMAR))
      for (const rule of rules)
        rule.forEach((b, i) => {
          if (!follow[b]) return;
          const rest = firstSequence(rule.slice(i + 1), first),
            addition = [...rest].filter((t) => t !== "ε");
          if (rest.has("ε")) addition.push(...follow[n]);
          addition.forEach((t) => {
            if (!follow[b].has(t)) {
              follow[b].add(t);
              changed = true;
            }
          });
        });
  }
  const table: GrammarInfo["table"] = {};
  for (const [n, rules] of Object.entries(GRAMMAR)) {
    table[n] = {};
    for (const rule of rules) {
      const set = firstSequence(rule, first),
        keys = [...set].filter((t) => t !== "ε");
      if (set.has("ε")) keys.push(...follow[n]);
      for (const key of keys) {
        if (Object.hasOwn(table[n], key))
          throw new LabError(`LL(1) conflict at ${n}, ${key}.`);
        table[n][key] = rule;
      }
    }
  }
  return {
    first: Object.fromEntries(
      nonterminals.map((n) => [n, [...first[n]].sort()]),
    ),
    follow: Object.fromEntries(
      nonterminals.map((n) => [n, [...follow[n]].sort()]),
    ),
    table,
    terminals: [
      ...new Set(
        Object.values(GRAMMAR)
          .flat(2)
          .filter((t) => !GRAMMAR[t]),
      ),
    ]
      .sort()
      .concat("$"),
  };
}
export function parseTokens(
  tokens: Token[],
  inputLength: number,
  info = grammarInfo(),
): ParseResult {
  const nodes: ParseNode[] = [{ id: 0, symbol: "Script", children: [] }],
    trace: ParseStep[] = [];
  const stack = [
    { symbol: "$", node: -1 },
    { symbol: "Script", node: 0 },
  ];
  let cursor = 0;
  while (stack.length) {
    if (trace.length > 10000)
      throw new LabError(
        "Analysis incomplete: parser trace limit reached.",
        "incomplete",
      );
    const top = stack.at(-1)!,
      token = tokens[cursor],
      lookahead = token?.type ?? "$",
      offset = token?.start ?? inputLength;
    const base = {
      stack: [...stack].reverse().map((x) => x.symbol),
      remaining: tokens
        .slice(cursor)
        .map((t) => t.type)
        .concat("$"),
      offset,
    };
    if (top.symbol === "$" && lookahead === "$") {
      trace.push({ ...base, action: "Accept: input and stack reached $." });
      return { accepted: true, trace, nodes };
    }
    if (!GRAMMAR[top.symbol]) {
      if (top.symbol !== lookahead) {
        const error = {
          message: `Expected ${top.symbol}; found ${lookahead}.`,
          offset,
          expected: [top.symbol],
        };
        trace.push({ ...base, action: `Reject: ${error.message}` });
        return { accepted: false, trace, nodes, error };
      }
      stack.pop();
      if (top.node >= 0) nodes[top.node].token = token;
      cursor++;
      trace.push({
        ...base,
        action: `Match ${lookahead}: ${JSON.stringify(token.text)}`,
      });
      continue;
    }
    const rule = info.table[top.symbol][lookahead];
    if (!rule) {
      const expected = Object.keys(info.table[top.symbol]);
      const error = {
        message: `No production for ${top.symbol} with ${lookahead}. Expected ${expected.join(", ")}.`,
        offset,
        expected,
      };
      trace.push({ ...base, action: `Reject: ${error.message}` });
      return { accepted: false, trace, nodes, error };
    }
    stack.pop();
    const children = (rule.length ? rule : ["ε"]).map((symbol) => {
      const id = nodes.length;
      nodes.push({ id, symbol, children: [] });
      return id;
    });
    nodes[top.node].children = children;
    for (let i = rule.length - 1; i >= 0; i--)
      stack.push({ symbol: rule[i], node: children[i] });
    trace.push({ ...base, action: `${top.symbol} → ${rule.join(" ") || "ε"}` });
  }
  throw new LabError("Unexpected empty parser stack.");
}
export interface PdaStep {
  index: number;
  symbol: string;
  stack: string[];
  action: string;
  state: string;
}
export function runPda(input: string): {
  accepted: boolean;
  steps: PdaStep[];
  error?: Diagnostic;
} {
  validateText(input);
  const stack: string[] = [],
    steps: PdaStep[] = [
      {
        index: 0,
        symbol: "ε",
        stack: [],
        action: "Start with bottom marker ⊥.",
        state: "qRead",
      },
    ];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (/\s/.test(c)) {
      steps.push({
        index: i + 1,
        symbol: c,
        stack: [...stack],
        action: "Skip whitespace.",
        state: "qRead",
      });
      continue;
    }
    if ("([{".includes(c)) {
      stack.push(c);
      steps.push({
        index: i + 1,
        symbol: c,
        stack: [...stack],
        action: `Push ${c}.`,
        state: "qRead",
      });
    } else if (pairs[c] && stack.at(-1) === pairs[c]) {
      stack.pop();
      steps.push({
        index: i + 1,
        symbol: c,
        stack: [...stack],
        action: `Pop ${pairs[c]} on ${c}.`,
        state: "qRead",
      });
    } else {
      const error = {
        message: pairs[c]
          ? `Unmatched or mismatched closing delimiter ${c}.`
          : "Only brackets () [] {} and whitespace are supported in this PDA demonstration.",
        offset: i,
      };
      steps.push({
        index: i + 1,
        symbol: c,
        stack: [...stack],
        action: error.message,
        state: "qReject",
      });
      return { accepted: false, steps, error };
    }
  }
  const error = stack.length
    ? {
        message: `${stack.length} opening delimiter(s) remain on the stack.`,
        offset: input.length,
      }
    : undefined;
  steps.push({
    index: input.length,
    symbol: "$",
    stack: [...stack],
    action: error?.message ?? "Accept: input ended with only ⊥ remaining.",
    state: error ? "qReject" : "qAccept",
  });
  return { accepted: !error, steps, error };
}
