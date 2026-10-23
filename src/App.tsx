import { useEffect, useRef, useState } from "react";
import type { Analysis, CaseInput } from "./engine/analysis";
import type { Compilation, Comparison } from "./engine/automata";

const FLAG = { name: "Flag", pattern: "--[a-z]+" };
const EXAMPLES = [
  { name: "Valid command", input: "inspect --tag sample; (scan file)" },
  { name: "Missing value", input: "inspect --tag" },
  { name: "Missing bracket", input: "inspect --tag sample; (scan file" },
];
const BASE: CaseInput = {
  name: "Demo",
  input: EXAMPLES[0].input,
  rules: [FLAG],
  mode: "whole",
  left: "--[a-z]+",
  right: "--[a-z][a-z]+",
};
type Compared = {
  left: Compilation;
  right: Compilation;
  comparison: Comparison;
};
type Problem = { message: string; offset?: number };

// One disposable worker per request. Editing, switching views or cancelling stops it.
function useComputation<T>(task: "analyse" | "compare") {
  const [result, setResult] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Problem | null>(null);
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function stop() {
    worker.current?.terminate();
    worker.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  function reset() {
    stop();
    setBusy(false);
    setResult(null);
    setError(null);
  }
  function run(data: CaseInput) {
    reset();
    setBusy(true);
    try {
      const w = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });
      worker.current = w;
      const fail = (problem: Problem) => {
        if (worker.current !== w) return;
        stop();
        setBusy(false);
        setError(problem);
      };
      w.onmessage = ({ data: out }) => {
        if (worker.current !== w) return;
        stop();
        setBusy(false);
        if (out.error) setError(out.error);
        else setResult(out.result);
      };
      w.onerror = () =>
        fail({ message: "Analysis incomplete. Please try again." });
      timer.current = setTimeout(
        () => fail({ message: "Analysis incomplete: time limit reached." }),
        12000,
      );
      w.postMessage({ id: 1, task, data });
    } catch {
      stop();
      setBusy(false);
      setError({ message: "Analysis incomplete: worker could not start." });
    }
  }
  function cancel() {
    reset();
    setError({ message: "Analysis incomplete: cancelled." });
  }
  useEffect(() => () => stop(), []);
  return { result, busy, error, reset, run, cancel };
}

function ErrorMessage({ error }: { error: Problem | null }) {
  return error ? (
    <p role="alert" className="error">
      {error.message}
      {error.offset !== undefined ? ` (position ${error.offset + 1})` : ""}
    </p>
  ) : null;
}
function Submit({
  busy,
  cancel,
  label,
}: {
  busy: boolean;
  cancel: () => void;
  label: string;
}) {
  return (
    <div className="actions">
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Checking…" : label}
      </button>
      {busy && (
        <button type="button" onClick={cancel}>
          Cancel
        </button>
      )}
    </div>
  );
}
function syntaxMessage(result: Analysis) {
  if (result.structureAccepted)
    return "Every flag has a value and every group closes.";
  if (result.lex.error) return result.lex.error.message;
  const step = result.parse?.trace.at(-1);
  if (step?.stack[0] === "Value") return "A flag needs a word or quoted value.";
  if (result.parse?.error?.expected?.includes(")"))
    return "A group is missing its closing bracket.";
  return (
    result.parse?.error?.message ?? "The command does not follow the grammar."
  );
}

function CheckText() {
  const [input, setInput] = useState(BASE.input);
  const computation = useComputation<Analysis>("analyse");
  const { result, busy, error } = computation;
  function edit(value: string) {
    setInput(value);
    computation.reset();
  }
  return (
    <section aria-labelledby="check-heading">
      <h2 id="check-heading">Check a command</h2>
      <p className="intro">
        Find a flag pattern and check the command structure.
      </p>
      <div className="examples" aria-label="Examples">
        {EXAMPLES.map((example) => (
          <button
            key={example.name}
            type="button"
            onClick={() => {
              setInput(example.input);
              computation.run({ ...BASE, input: example.input });
            }}
          >
            {example.name}
          </button>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          computation.run({ ...BASE, input });
        }}
      >
        <label htmlFor="command">Command</label>
        <textarea
          id="command"
          value={input}
          maxLength={2048}
          spellCheck={false}
          onChange={(event) => edit(event.target.value)}
        />
        <Submit busy={busy} cancel={computation.cancel} label="Check input" />
      </form>
      <ErrorMessage error={error} />
      {result && (
        <div className="result" aria-live="polite">
          <div className="verdicts">
            <div>
              <h3>Pattern</h3>
              <strong className={result.patternMatched ? "good" : "neutral"}>
                {result.patternMatched ? "Found" : "Not found"}
              </strong>
              <p>
                {result.patternMatched ? (
                  <>
                    <code>
                      {result.signatures[0].matches
                        .map((match) => input.slice(match.start, match.end))
                        .join(", ")}
                    </code>{" "}
                    matches <code>{FLAG.pattern}</code>.
                  </>
                ) : (
                  <>
                    No flag matches <code>{FLAG.pattern}</code>.
                  </>
                )}
              </p>
            </div>
            <div>
              <h3>Syntax</h3>
              <strong className={result.structureAccepted ? "good" : "error"}>
                {result.structureAccepted ? "Valid" : "Invalid"}
              </strong>
              <p>{syntaxMessage(result)}</p>
            </div>
          </div>
          <details>
            <summary>Show steps</summary>
            <h3>Tokens</h3>
            <div className="tokens">
              {result.lex.tokens.map((token, i) => (
                <span key={i}>
                  <code>{token.text}</code>
                  <small>{token.type}</small>
                </span>
              ))}
            </div>
            <h3>Parser</h3>
            {result.parse ? (
              <ol className="parser-steps">
                {result.parse.trace.map((step, i) => (
                  <li key={i}>
                    <code>{step.action}</code>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Parsing stopped because the text contains a lexical error.</p>
            )}
            <h3>Grammar</h3>
            <pre>{`Script    → Statement Rest\nRest      → ; Statement Rest | ε\nStatement → WORD Args | ( Script )\nArgs      → Arg Args | ε\nArg       → FLAG Value | Value\nValue     → WORD | QUOTED`}</pre>
          </details>
        </div>
      )}
    </section>
  );
}

function CompareRules() {
  const [left, setLeft] = useState(BASE.left);
  const [right, setRight] = useState(BASE.right);
  const computation = useComputation<Compared>("compare");
  const { result, busy, error } = computation;
  const comparison = result?.comparison;
  return (
    <section aria-labelledby="compare-heading">
      <h2 id="compare-heading">Compare two rules</h2>
      <p className="intro">
        Find the shortest input accepted by just one rule.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          computation.run({ ...BASE, left, right });
        }}
      >
        <div className="rule-fields">
          <div>
            <label htmlFor="rule-a">Rule A</label>
            <input
              id="rule-a"
              value={left}
              maxLength={128}
              spellCheck={false}
              onChange={(event) => {
                setLeft(event.target.value);
                computation.reset();
              }}
            />
          </div>
          <div>
            <label htmlFor="rule-b">Rule B</label>
            <input
              id="rule-b"
              value={right}
              maxLength={128}
              spellCheck={false}
              onChange={(event) => {
                setRight(event.target.value);
                computation.reset();
              }}
            />
          </div>
        </div>
        <p className="hint">Rules are matched against the whole input.</p>
        <Submit busy={busy} cancel={computation.cancel} label="Compare rules" />
      </form>
      <ErrorMessage error={error} />
      {comparison && (
        <div className="result" aria-live="polite">
          <h3>
            {comparison.equivalent ? "Same language" : "Shortest example"}
          </h3>
          {comparison.equivalent ? (
            <p>Both rules accept exactly the same inputs.</p>
          ) : (
            <>
              <div className="witness">
                <code>
                  {comparison.witness === ""
                    ? "ε (empty input)"
                    : comparison.witness}
                </code>
              </div>
              <div className="verdicts comparison-verdicts">
                <div>
                  <h3>Rule A</h3>
                  <strong
                    className={comparison.leftAccepted ? "good" : "error"}
                  >
                    {comparison.leftAccepted ? "Accepts" : "Rejects"}
                  </strong>
                </div>
                <div>
                  <h3>Rule B</h3>
                  <strong
                    className={comparison.rightAccepted ? "good" : "error"}
                  >
                    {comparison.rightAccepted ? "Accepts" : "Rejects"}
                  </strong>
                </div>
              </div>
              <details>
                <summary>Show steps</summary>
                <p>
                  The search checks shorter inputs first. These are the DFA
                  states reached by the example.
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Input read</th>
                        <th>Rule A state</th>
                        <th>Rule B state</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.leftTrace!.map((step, i) => (
                        <tr key={i}>
                          <td>
                            <code>
                              {i ? comparison.witness!.slice(0, i) : "ε"}
                            </code>
                          </td>
                          <td>q{step.active[0]}</td>
                          <td>q{comparison.rightTrace![i].active[0]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [view, setView] = useState<"check" | "compare">("check");
  return (
    <main>
      <header>
        <h1>AUTOSEC</h1>
        <p>Pattern and syntax demo</p>
      </header>
      <nav aria-label="Demo views">
        <button
          type="button"
          aria-current={view === "check" ? "page" : undefined}
          onClick={() => setView("check")}
        >
          Check text
        </button>
        <button
          type="button"
          aria-current={view === "compare" ? "page" : undefined}
          onClick={() => setView("compare")}
        >
          Compare rules
        </button>
      </nav>
      {view === "check" ? <CheckText /> : <CompareRules />}
      <footer>Text is analysed locally. Commands are never executed.</footer>
    </main>
  );
}
