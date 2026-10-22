import { describe, expect, it } from "vitest";
import {
  accepts,
  compile,
  compareDfa,
  epsilonClosure,
  findMatches,
  minimize,
  parseRegex,
  runDfa,
  runNfa,
  thompson,
  type DFA,
} from "../src/engine/automata";
import {
  grammarInfo,
  parseTokens,
  runPda,
  tokenize,
} from "../src/engine/grammar";
import {
  analyse,
  DEFAULT_RULES,
  EXAMPLES,
  mutate,
  parseCaseFile,
  caseFile,
  inspectUrl,
} from "../src/engine/analysis";
function words(alphabet: string[], max: number): string[] {
  const all = [""];
  let frontier = [""];
  for (let i = 0; i < max; i++) {
    frontier = frontier.flatMap((w) => alphabet.map((c) => w + c));
    all.push(...frontier);
  }
  return all;
}
const parse = (s: string) => {
  const lex = tokenize(s);
  return !lex.error && parseTokens(lex.tokens, s.length).accepted;
};
describe("Regex construction and recognition", () => {
  const languages: [string, (s: string) => boolean][] = [
    ["ε", (s) => s === ""],
    ["a*", (s) => [...s].every((c) => c === "a")],
    ["(a|b)*abb", (s) => s.endsWith("abb")],
    ["a?b+", (s) => /^a?b+$/.test(s)],
    ["[a-b]+", (s) => /^[ab]+$/.test(s)],
    ["(ε|a)b", (s) => s === "b" || s === "ab"],
    ["a(b|ε)*", (s) => /^ab*$/.test(s)],
    ["(ab|ba)+", (s) => /^(ab|ba)+$/.test(s)],
  ];
  it.each(languages)(
    "matches the independently specified language %s exhaustively through length 6",
    (pattern, oracle) => {
      const c = compile(pattern);
      for (const text of words(["a", "b"], 6)) {
        const expected = oracle(text);
        expect(
          runNfa(c.nfa, text).at(-1)!.accepting,
          `${pattern}: NFA ${text}`,
        ).toBe(expected);
        expect(accepts(c.dfa, text), `${pattern}: DFA ${text}`).toBe(expected);
        expect(accepts(c.minimal, text), `${pattern}: minimal ${text}`).toBe(
          expected,
        );
      }
      expect(compareDfa(c.dfa, c.minimal).equivalent).toBe(true);
    },
  );
  it("computes transitive epsilon closure including cycles and the source", () => {
    expect(
      epsilonClosure(
        {
          stateCount: 4,
          start: 0,
          accepts: [3],
          alphabet: ["a"],
          edges: [
            { from: 0, to: 1, symbol: null },
            { from: 1, to: 2, symbol: null },
            { from: 2, to: 1, symbol: null },
            { from: 2, to: 3, symbol: "a" },
          ],
        },
        [0],
      ),
    ).toEqual([0, 1, 2]);
  });
  it.each([
    "[z-a]",
    "a**",
    "a|",
    "()",
    "[a",
    "(a",
    "a)",
    "\\d",
    "a{2}",
    "^a",
    ".",
    "[^a]",
    "",
    "\\",
    "(?=a)",
    "[]",
    "é",
  ])("rejects unsupported or malformed expression %s", (pattern) =>
    expect(() => parseRegex(pattern)).toThrow(),
  );
  it("recognises escaped literals and control characters", () => {
    expect(accepts(compile("\\.\\*\\(\\)\\[\\]\\\\").minimal, ".*()[]\\")).toBe(
      true,
    );
    expect(accepts(compile("a\\tb").minimal, "a\tb")).toBe(true);
  });
  it("totalises missing transitions with a reachable empty-subset sink", () => {
    const c = compile("ab");
    const sink = c.dfa.members.findIndex((s) => !s.length);
    expect(sink).toBeGreaterThanOrEqual(0);
    for (const symbol of c.dfa.alphabet)
      expect(c.dfa.delta[sink][symbol]).toBe(sink);
    expect(runDfa(c.minimal, "z").at(-1)!.accepting).toBe(false);
  });
  it("removes unreachable states and merges equivalent states", () => {
    const dfa: DFA = {
      stateCount: 4,
      start: 0,
      accepts: [1, 2, 3],
      alphabet: ["a", "b"],
      delta: {
        0: { a: 1, b: 2 },
        1: { a: 1, b: 2 },
        2: { a: 2, b: 1 },
        3: { a: 3, b: 3 },
      },
      members: [[0], [1], [2], [3]],
    };
    const m = minimize(dfa).dfa;
    expect(m.stateCount).toBe(2);
    expect(compareDfa(dfa, m).equivalent).toBe(true);
    expect(m.members.flat()).not.toContain(3);
  });
  it("bounds pattern and DFA growth with an incomplete result", () => {
    expect(() => compile("a".repeat(129))).toThrow("incomplete");
    expect(() =>
      compile("(a|b)*a(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)"),
    ).toThrow("DFA state limit");
  });
});
describe("Exact comparisons and substring semantics", () => {
  it.each([
    ["a|b", "a", "b"],
    ["a*", "a+", ""],
    ["ab", "ac", "ab"],
    ["[a-c]", "[a-b]", "c"],
  ])("finds shortest witness for %s versus %s", (a, b, witness) => {
    const l = compile(a).minimal,
      r = compile(b).minimal,
      result = compareDfa(l, r);
    expect(result.witness).toBe(witness);
    expect(result.leftAccepted).not.toBe(result.rightAccepted);
    for (const s of words(
      [...new Set([...l.alphabet, ...r.alphabet])],
      Math.max(0, witness.length - 1),
    ))
      if (s.length < witness.length) expect(accepts(l, s)).toBe(accepts(r, s));
  });
  it("proves equivalent differently written rules", () =>
    expect(
      compareDfa(compile("a+").minimal, compile("aa*").minimal).equivalent,
    ).toBe(true));
  it("uses a common alphabet and implicit dead states", () => {
    expect(compareDfa(compile("a").minimal, compile("b").minimal).witness).toBe(
      "a",
    );
  });
  it("wraps both rules consistently for substring comparison", () => {
    const whole = compile("a").minimal,
      sub = compile("a", "substring").minimal;
    expect(accepts(whole, "bab")).toBe(false);
    expect(accepts(sub, "bab")).toBe(true);
    expect(
      compareDfa(
        compile("a*", "substring").minimal,
        compile("b*", "substring").minimal,
      ).equivalent,
    ).toBe(true);
    expect(
      compareDfa(
        compile("ab", "substring").minimal,
        compile("a", "substring").minimal,
      ).witness,
    ).toBe("a");
  });
  it("finds non-overlapping leftmost-longest spans, including nullable patterns", () => {
    expect(
      findMatches(compile("--[a-z]+").minimal, "scan --mode quick --tag x"),
    ).toEqual([
      { start: 5, end: 11 },
      { start: 18, end: 23 },
    ]);
    expect(findMatches(compile("a*").minimal, "b")).toEqual([
      { start: 0, end: 0 },
      { start: 1, end: 1 },
    ]);
  });
});
describe("Grammar, lexer, predictive parser, and PDA", () => {
  it("derives FIRST/FOLLOW sets and nullable parsing-table entries", () => {
    const g = grammarInfo();
    expect(g.first.Script).toEqual(["(", "WORD"]);
    expect(g.first.Value).toEqual(["QUOTED", "WORD"]);
    expect(g.follow.Script).toEqual(["$", ")"]);
    expect(g.follow.Args).toEqual(["$", ")", ";"]);
    expect(g.table.Rest[")"]).toEqual([]);
    expect(g.table.Arg.FLAG).toEqual(["FLAG", "Value"]);
  });
  it.each([
    "inspect",
    "inspect file",
    'inspect --tag "sample data"',
    "(inspect; (scan file)); check",
    'inspect --tag "say \\"hello\\""'.replaceAll("\\\\", "\\"),
    'inspect ""',
    "(inspect)",
  ])("accepts %s", (s) => expect(parse(s)).toBe(true));
  it.each([
    "",
    "()",
    "inspect --tag",
    "--tag file",
    "(inspect",
    "inspect)",
    "inspect;",
    ";inspect",
    "inspect;;scan",
    "inspect | scan",
    "inspect --TAG x",
    "inspect --tag1 x",
    'inspect"x"',
    'inspect "x"word',
    'inspect "unterminated',
    'inspect "bad\\q"',
  ])("rejects %s", (s) => expect(parse(s)).toBe(false));
  it("preserves exact token source spans and rejection offsets", () => {
    const s = 'inspect --tag "sample data"',
      lex = tokenize(s);
    expect(lex.tokens.map((t) => s.slice(t.start, t.end))).toEqual([
      "inspect",
      "--tag",
      '"sample data"',
    ]);
    expect(
      parseTokens(tokenize("inspect --tag").tokens, 13).error?.offset,
    ).toBe(13);
    expect(tokenize("inspect @").error?.offset).toBe(8);
  });
  it("records derivation nodes, stack snapshots, and final acceptance", () => {
    const p = parseTokens(tokenize("(inspect file)").tokens, 14);
    expect(p.trace.at(-1)?.action).toContain("Accept");
    expect(p.nodes.some((n) => n.symbol === "ε")).toBe(true);
    expect(p.nodes.filter((n) => n.token).map((n) => n.token!.text)).toContain(
      "file",
    );
  });
  it.each(["", "()", "([]{})", "((()))", "() [] {}"])("PDA accepts %s", (s) => {
    expect(runPda(s).accepted).toBe(true);
    expect(runPda(s).steps.at(-1)!.stack).toEqual([]);
  });
  it.each(["(", "())(", "([)]", "abc"])("PDA rejects %s", (s) =>
    expect(runPda(s).accepted).toBe(false),
  );
});
describe("Integration, mutations, and portable evidence", () => {
  it.each([
    ["inspect --tag x", true, true],
    ["inspect --tag", true, false],
    ["inspect file", false, true],
    ["(inspect file", false, false],
  ])("keeps both verdicts independent for %s", (s, pattern, syntax) => {
    const a = analyse(s as string);
    expect(a.patternMatched).toBe(pattern);
    expect(a.structureAccepted).toBe(syntax);
  });
  it("keeps a quoted signature distinct from token meaning", () => {
    const a = analyse('inspect "--tag"');
    expect(a.patternMatched).toBe(true);
    expect(a.lex.tokens[1].type).toBe("QUOTED");
  });
  it("all curated examples tokenize as intended", () => {
    for (const e of EXAMPLES)
      expect(tokenize(e.input).error, e.name).toBeUndefined();
  });
  it("makes each promised mutation with an observable consequence", () => {
    const s = "(inspect --tag x)";
    expect(parse(s)).toBe(true);
    for (const k of ["closing", "value", "separator"] as const) {
      const m = mutate(s, k);
      expect(m.input).not.toBe(s);
      expect(parse(m.input)).toBe(false);
    }
    expect(mutate("inspect", "closing").input).toBe("inspect");
  });
  it("roundtrips a versioned case and rejects invalid imports", () => {
    const c = {
      name: "Demo",
      input: "inspect file",
      left: "a+",
      right: "aa*",
      mode: "whole" as const,
      rules: DEFAULT_RULES,
    };
    expect(
      parseCaseFile(JSON.parse(JSON.stringify(caseFile(c, analyse(c.input))))),
    ).toEqual(c);
    expect(() => parseCaseFile({ schemaVersion: 2, case: c })).toThrow();
    expect(() =>
      parseCaseFile({
        schemaVersion: 1,
        case: { ...c, rules: [{ name: "x", pattern: "[" }] },
      }),
    ).toThrow();
    expect(() =>
      parseCaseFile({
        schemaVersion: 1,
        case: { ...c, input: "x".repeat(2049) },
      }),
    ).toThrow("incomplete");
  });
  it("inspects limited URL components without navigation", () => {
    expect(inspectUrl("https://example.com/search?q=test")?.query).toBe(
      "q=test",
    );
    expect(inspectUrl("javascript:alert(1)")).toBeNull();
  });
  it("validates input bounds and character domain", () => {
    expect(() => analyse("x".repeat(2049))).toThrow("incomplete");
    expect(() => analyse("inspect 😀")).toThrow("ASCII");
    expect(() => thompson("a".repeat(128), "substring")).toThrow("incomplete");
  });
});
