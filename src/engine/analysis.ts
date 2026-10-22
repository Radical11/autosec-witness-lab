import {
  compile,
  findMatches,
  runDfa,
  validateText,
  ENGINE_VERSION,
  type Mode,
} from "./automata";
import { tokenize, parseTokens, grammarInfo } from "./grammar";
export const DEFAULT_RULES = [
  { name: "Long flag", pattern: "--[a-z]+" },
  { name: "Statement separator", pattern: ";" },
  { name: "Parent traversal", pattern: "\\.\\./" },
];
export interface CaseInput {
  name: string;
  input: string;
  rules: { name: string; pattern: string }[];
  mode: Mode;
  left: string;
  right: string;
}
export function analyse(input: string, rules = DEFAULT_RULES) {
  validateText(input);
  if (rules.length > 8)
    throw new Error("At most eight signatures are supported.");
  const signatures = rules.map((rule) => {
    const machine = compile(rule.pattern);
    const matches = findMatches(machine.minimal, input);
    return {
      ...rule,
      matches,
      matched: matches.length > 0,
      stateCount: machine.minimal.stateCount,
    };
  });
  const lex = tokenize(input),
    info = grammarInfo();
  const parse = lex.error
    ? undefined
    : parseTokens(lex.tokens, input.length, info);
  return {
    engineVersion: ENGINE_VERSION,
    input,
    signatures,
    lex,
    parse,
    grammar: info,
    patternMatched: signatures.some((s) => s.matched),
    structureAccepted: !!parse?.accepted,
  };
}
export type Analysis = ReturnType<typeof analyse>;
export const EXAMPLES = [
  {
    name: "Nested inspection",
    input: 'inspect --tag "sample data"; (check file; scan --mode quick)',
    note: "A valid nested script with flags and separators.",
  },
  {
    name: "Missing flag value",
    input: "inspect --tag",
    note: "The signature matches, but the parser needs a value.",
  },
  {
    name: "Plain command",
    input: "inspect file",
    note: "Valid syntax without any selected signature.",
  },
  {
    name: "Broken structure",
    input: "(inspect file",
    note: "No signature match, and the group never closes.",
  },
  {
    name: "Quoted signature",
    input: 'inspect "--tag"',
    note: "Raw text matches a signature; the lexer recognises one quoted value.",
  },
  {
    name: "Escaped quotes",
    input: 'inspect --tag "say \\"hello\\""'.replaceAll("\\\\", "\\"),
    note: "An escaped quote remains inside a single value.",
  },
];
export type Mutation = "closing" | "value" | "separator";
export function mutate(
  input: string,
  kind: Mutation,
): { input: string; explanation: string } {
  if (kind === "closing") {
    const at = input.lastIndexOf(")");
    return at < 0
      ? {
          input,
          explanation: "No closing parenthesis was available to remove.",
        }
      : {
          input: input.slice(0, at) + input.slice(at + 1),
          explanation: `Removed the closing parenthesis at offset ${at}.`,
        };
  }
  if (kind === "separator")
    return {
      input: input + ";",
      explanation:
        "Appended a separator: the grammar now expects another statement.",
    };
  const lex = tokenize(input);
  const at = lex.tokens.findIndex(
    (t, i, ts) =>
      t.type === "FLAG" && ["WORD", "QUOTED"].includes(ts[i + 1]?.type),
  );
  if (at < 0)
    return {
      input,
      explanation: "No flag followed by a value was available to edit.",
    };
  const value = lex.tokens[at + 1];
  return {
    input: input.slice(0, value.start) + input.slice(value.end),
    explanation: `Deleted the value ${JSON.stringify(value.text)} at offsets ${value.start}–${value.end}.`,
  };
}
export function inspectUrl(input: string) {
  // Deliberately restricted HTTP(S) examples, not RFC 3986 conformance validation.
  if (!/^https?:\/\/[A-Za-z0-9.-]+(?::[0-9]+)?(?:[/?#][^\s]*)?$/.test(input))
    return null;
  try {
    const u = new URL(input);
    return {
      scheme: u.protocol.slice(0, -1),
      host: u.host,
      path: u.pathname,
      query: u.search.slice(1),
      fragment: u.hash.slice(1),
    };
  } catch {
    return null;
  }
}
export function parseCaseFile(raw: unknown): CaseInput {
  if (!raw || typeof raw !== "object")
    throw new Error("Expected a versioned AUTOSEC case object.");
  const x = raw as Record<string, unknown>;
  if (x.schemaVersion !== 1 || !x.case || typeof x.case !== "object")
    throw new Error("Unsupported case file. Expected schemaVersion 1.");
  const c = x.case as Record<string, unknown>;
  for (const key of ["name", "input", "left", "right"])
    if (typeof c[key] !== "string")
      throw new Error(`Case ${key} must be text.`);
  if ((c.name as string).length > 100)
    throw new Error("Case name is too long.");
  if (c.mode !== "whole" && c.mode !== "substring")
    throw new Error("Unknown matching mode.");
  if (!Array.isArray(c.rules) || !c.rules.length || c.rules.length > 8)
    throw new Error("Expected one to eight signatures.");
  validateText(c.input as string);
  for (const r of c.rules) {
    if (
      !r ||
      typeof r.name !== "string" ||
      r.name.length > 100 ||
      typeof r.pattern !== "string"
    )
      throw new Error("Invalid signature.");
    compile(r.pattern);
  }
  compile(c.left as string, c.mode);
  compile(c.right as string, c.mode);
  return {
    name: c.name as string,
    input: c.input as string,
    rules: c.rules,
    mode: c.mode,
    left: c.left as string,
    right: c.right as string,
  };
}
export function caseFile(c: CaseInput, result: Analysis | null) {
  return {
    schemaVersion: 1,
    engineVersion: ENGINE_VERSION,
    exportedAt: new Date().toISOString(),
    case: c,
    result,
  };
}
export function simulation(
  compilation: ReturnType<typeof compile>,
  text: string,
) {
  return runDfa(compilation.minimal, text);
}
