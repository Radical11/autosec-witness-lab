import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Check,
  CircleHelp,
  FileDown,
  FlaskConical,
  GitCompareArrows,
  Layers,
  LoaderCircle,
  Play,
  Plus,
  Save,
  ScanLine,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import {
  AutomatonGraph,
  Badge,
  DataTable,
  DfaTable,
  Panel,
  Playback,
  download,
} from "./components";
import {
  ENGINE_VERSION,
  LIMITS,
  runDfa,
  runNfa,
  showSymbol,
  type Compilation,
  type Comparison,
} from "./engine/automata";
import {
  DEFAULT_RULES,
  EXAMPLES,
  caseFile,
  inspectUrl,
  mutate,
  parseCaseFile,
  type Analysis,
  type CaseInput,
  type Mutation,
} from "./engine/analysis";
import { GRAMMAR, runPda, type ParseNode } from "./engine/grammar";

type Tab = "Analyse" | "Automata Lab" | "Grammar & Stack" | "Evidence";
type Compared = {
  left: Compilation;
  right: Compilation;
  comparison: Comparison;
};
const INITIAL: CaseInput = {
  name: "Nested inspection",
  input: EXAMPLES[0].input,
  rules: DEFAULT_RULES,
  left: "--[a-z]+",
  right: "--[a-z][a-z]+",
  mode: "whole",
};
const STORAGE = "autosec-cases-v1";
function readSaved(): CaseInput[] {
  try {
    const a = JSON.parse(localStorage.getItem(STORAGE) || "[]");
    return Array.isArray(a)
      ? a.slice(0, 30).flatMap((c) => {
          try {
            return [parseCaseFile({ schemaVersion: 1, case: c })];
          } catch {
            return [];
          }
        })
      : [];
  } catch {
    return [];
  }
}
export default function App() {
  const [tab, setTab] = useState<Tab>("Analyse"),
    [c, setC] = useState<CaseInput>(INITIAL);
  const [analysis, setAnalysis] = useState<Analysis | null>(null),
    [compiled, setCompiled] = useState<Compilation | null>(null),
    [compared, setCompared] = useState<Compared | null>(null);
  const [analysisInput, setAnalysisInput] = useState<CaseInput | null>(null),
    [model, setModel] = useState<"minimal" | "dfa" | "nfa">("minimal");
  const [simulationText, setSimulationText] = useState("--tag"),
    [machineStep, setMachineStep] = useState(0),
    [compareStep, setCompareStep] = useState(0),
    [parseStep, setParseStep] = useState(0);
  const [busy, setBusy] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [error, setError] = useState<{
      message: string;
      kind?: string;
      offset?: number;
    } | null>(null);
  const [saved, setSaved] = useState<CaseInput[]>(readSaved),
    [help, setHelp] = useState(false),
    [mutation, setMutation] = useState<{
      before: Analysis;
      text: string;
      explanation: string;
    } | null>(null);
  const worker = useRef<Worker | null>(null),
    request = useRef(0),
    timeout = useRef<ReturnType<typeof setTimeout> | null>(null),
    mounted = useRef(false);
  const patch = (part: Partial<CaseInput>) =>
    setC((prev) => ({ ...prev, ...part }));
  function terminate() {
    worker.current?.terminate();
    worker.current = null;
    if (timeout.current) clearTimeout(timeout.current);
    setBusy(null);
  }
  function execute(task: "analyse" | "compile" | "compare", data = c) {
    terminate();
    setError(null);
    setNotice("");
    setBusy(task);
    const id = ++request.current;
    const w = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    w.onmessage = (event) => {
      if (event.data.id !== request.current) return;
      const out = event.data;
      terminate();
      if (out.error) {
        setError(out.error);
        return;
      }
      if (task === "analyse") {
        setAnalysis(out.result);
        setAnalysisInput(structuredClone(data));
        setParseStep(0);
      }
      if (task === "compile") {
        setCompiled(out.result);
        setMachineStep(0);
      }
      if (task === "compare") {
        setCompared(out.result);
        setCompareStep(0);
        setCompiled(out.result.left);
        setMachineStep(0);
      }
    };
    w.onerror = (e) => {
      terminate();
      setError({
        message: `Analysis incomplete: ${e.message || "worker could not complete."}`,
        kind: "incomplete",
      });
    };
    w.postMessage({ id, task, data });
    timeout.current = setTimeout(() => {
      terminate();
      setError({
        message:
          "Analysis incomplete: computation exceeded the 12-second budget. Try a smaller rule.",
        kind: "incomplete",
      });
    }, 12000);
  }
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      execute("analyse", INITIAL);
    }
    return () => {
      worker.current?.terminate();
      if (timeout.current) clearTimeout(timeout.current);
      mounted.current = false;
    };
  }, []); // initial demonstration only
  const stale =
    !!analysisInput &&
    (c.input !== analysisInput.input ||
      JSON.stringify(c.rules) !== JSON.stringify(analysisInput.rules));
  const compileStale =
    !!compiled && (compiled.pattern !== c.left || compiled.mode !== c.mode);
  const compareStale =
    !!compared &&
    (compared.left.pattern !== c.left ||
      compared.right.pattern !== c.right ||
      compared.left.mode !== c.mode);
  const currentAnalysis = !stale ? analysis : null;
  const activeMachine = compiled?.[model];
  let simulation: ReturnType<typeof runDfa> = [],
    simError = "";
  try {
    if (compiled)
      simulation =
        model === "nfa"
          ? runNfa(compiled.nfa, simulationText)
          : runDfa(compiled[model], simulationText);
  } catch (e) {
    simError = (e as Error).message;
  }
  const trace =
    simulation[Math.min(machineStep, Math.max(0, simulation.length - 1))];
  function load(data: CaseInput) {
    terminate();
    setC(structuredClone(data));
    setMutation(null);
    setCompared(null);
    setCompiled(null);
    setNotice(`Loaded “${data.name}”.`);
    execute("analyse", data);
    setTab("Analyse");
  }
  function save() {
    const next = [
      structuredClone(c),
      ...saved.filter((x) => x.name !== c.name),
    ].slice(0, 30);
    try {
      localStorage.setItem(STORAGE, JSON.stringify(next));
      setSaved(next);
      setNotice(`Saved “${c.name}” on this browser.`);
    } catch {
      setError({
        message:
          "Browser storage is unavailable or full. Export JSON to keep this case.",
      });
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 4_000_000)
        throw new Error("Case files must be smaller than 4 MB.");
      const data = parseCaseFile(JSON.parse(await file.text()));
      load(data);
      setNotice(
        "Imported case; results are recomputed using the current engine.",
      );
    } catch (e) {
      setError({ message: `Import failed: ${(e as Error).message}` });
    }
  }
  function applyMutation(kind: Mutation) {
    if (!currentAnalysis) return;
    const m = mutate(c.input, kind);
    setMutation({
      before: currentAnalysis,
      text: m.input,
      explanation: m.explanation,
    });
    const next = { ...c, input: m.input };
    setC(next);
    execute("analyse", next);
  }
  const navigation: { name: Tab; icon: ReactNode; number: string }[] = [
    { name: "Analyse", icon: <ScanLine size={18} />, number: "01" },
    {
      name: "Automata Lab",
      icon: <GitCompareArrows size={18} />,
      number: "02",
    },
    { name: "Grammar & Stack", icon: <Layers size={18} />, number: "03" },
    { name: "Evidence", icon: <BookOpen size={18} />, number: "04" },
  ];
  const headings: Record<Tab, [string, string]> = {
    Analyse: [
      "Every string has a story.",
      "Follow the patterns. Inspect the structure. Understand the difference.",
    ],
    "Automata Lab": [
      "Find the difference. Prove it.",
      "Turn rules into machines, then let a shortest counterexample do the explaining.",
    ],
    "Grammar & Stack": [
      "Structure needs memory.",
      "Trace a derivation, inspect a parsing decision, and watch the stack at work.",
    ],
    Evidence: [
      "Make the result reproducible.",
      "Save an experiment, export its inputs, and take the explanation with you.",
    ],
  };
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="#main" onClick={() => setTab("Analyse")}>
          <span className="brand-symbol">
            <ShieldCheck size={23} />
          </span>
          <span>
            AUTOSEC<small>AUTOMATA & SYNTAX LAB</small>
          </span>
        </a>
        <div className="sidebar-caption">WORKSPACE</div>
        <nav aria-label="Workspace navigation">
          {navigation.map((n) => (
            <button
              key={n.name}
              aria-current={tab === n.name ? "page" : undefined}
              className={`nav-item ${tab === n.name ? "selected" : ""}`}
              onClick={() => {
                setTab(n.name);
                setError(null);
              }}
            >
              {n.icon}
              <span>{n.name}</span>
              <small>{n.number}</small>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="eyebrow">THE IDEA</span>
          <p>
            A matching pattern and a valid structure answer different questions.
          </p>
          <div className="mini-machine">
            <span>RE</span>
            <ArrowRight size={12} />
            <span>FA</span>
            <ArrowRight size={12} />
            <span>?</span>
          </div>
          <button className="text-button" onClick={() => setHelp(true)}>
            Explore the concepts <ArrowRight size={13} />
          </button>
        </div>
        <div className="sidebar-footer">
          <span className="live-dot" /> Runs in your browser
          <small>
            BACSE201 · Models of Computation
            <br />
            Engine {ENGINE_VERSION}
          </small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            Workspace <span>/</span> <strong>{tab}</strong>
          </span>
          <div className="row">
            <Badge kind="neutral">COURSE PROJECT</Badge>
            <button
              className="icon-button"
              aria-label="Open project help"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="little-line" /> EXPERIMENT. OBSERVE. EXPLAIN.
              </div>
              <h1>{headings[tab][0]}</h1>
              <p>{headings[tab][1]}</p>
            </div>
            <button
              className="secondary"
              onClick={() => {
                setTab("Automata Lab");
                const data = {
                  ...c,
                  left: "--[a-z]+",
                  right: "--[a-z][a-z]+",
                  mode: "whole" as const,
                };
                setC(data);
                execute("compare", data);
              }}
            >
              <FlaskConical size={16} /> Run signature demo{" "}
              <ArrowRight size={15} />
            </button>
          </div>
          {busy && (
            <div className="status-banner" role="status">
              <LoaderCircle className="spin" size={17} /> Computing{" "}
              {busy === "compare"
                ? "product automaton"
                : busy === "compile"
                  ? "automata"
                  : "analysis"}
              …{" "}
              <button
                onClick={() => {
                  request.current++;
                  terminate();
                  setError({
                    message:
                      "Analysis incomplete: computation cancelled. Previous results, if shown, are labelled separately.",
                    kind: "incomplete",
                  });
                }}
              >
                <Square size={12} /> Cancel
              </button>
            </div>
          )}
          {error && (
            <div className="status-banner error" role="alert">
              <X size={17} />
              <span>
                {error.kind === "incomplete" ? "INCOMPLETE · " : ""}
                {error.message}
                {error.offset !== undefined && ` (offset ${error.offset})`}
              </span>
              <button aria-label="Dismiss error" onClick={() => setError(null)}>
                <X size={14} />
              </button>
            </div>
          )}
          {notice && (
            <div className="status-banner" role="status">
              <Check size={16} />
              {notice}
              <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
                <X size={14} />
              </button>
            </div>
          )}
          {tab === "Analyse" && (
            <>
              <div className="analysis-layout">
                <div>
                  <Panel
                    title="Inspect an input"
                    eyebrow="01 / TEXT ANALYSIS"
                    actions={<Badge>TEXT ONLY</Badge>}
                  >
                    <label htmlFor="source">Command-like script</label>
                    <div className="code-input">
                      <div className="editor-label">
                        <span>
                          <i className="dot teal" /> INPUT
                        </span>
                        <span>
                          ASCII · {c.input.length} / {LIMITS.input}
                        </span>
                      </div>
                      <textarea
                        id="source"
                        value={c.input}
                        onChange={(e) => patch({ input: e.target.value })}
                        spellCheck={false}
                        rows={4}
                        maxLength={LIMITS.input + 1}
                      />
                      <div className="editor-bottom">
                        <span>Quotes · flags · nested groups</span>
                        <kbd>;</kbd>
                        <kbd>( )</kbd>
                      </div>
                    </div>
                    <div className="row input-actions">
                      <span className="small muted">
                        Your text is analysed locally.
                      </span>
                      <button
                        className="primary"
                        disabled={!!busy}
                        onClick={() => {
                          setMutation(null);
                          execute("analyse");
                        }}
                      >
                        <Play size={14} /> Analyse input{" "}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                    <div className="examples">
                      <span className="eyebrow">TRY AN EXAMPLE</span>
                      <div className="chips">
                        {EXAMPLES.map((e, i) => (
                          <button
                            key={e.name}
                            className={
                              c.input === e.input ? "chip active" : "chip"
                            }
                            title={e.note}
                            onClick={() => {
                              const data = {
                                ...c,
                                input: e.input,
                                name: e.name,
                              };
                              setC(data);
                              setMutation(null);
                              execute("analyse", data);
                            }}
                          >
                            <span>{String(i + 1).padStart(2, "0")}</span>
                            {e.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </Panel>
                  {analysis && (
                    <>
                      <div className="section-title">
                        <span>ANALYSIS OVERVIEW</span>
                        <span className="small muted">
                          {stale
                            ? "Previous result · input has changed"
                            : "Two independent observations"}
                        </span>
                      </div>
                      <div className={`verdicts ${stale ? "stale" : ""}`}>
                        <Verdict
                          number="A"
                          title="Pattern layer"
                          value={
                            analysis.patternMatched
                              ? "Signature found"
                              : "No signature found"
                          }
                          good={analysis.patternMatched}
                          subtitle={`${analysis.signatures.filter((s) => s.matched).length} of ${analysis.signatures.length} rules matched · raw-text search`}
                          icon={<ScanLine size={22} />}
                        />
                        <Verdict
                          number="B"
                          title="Structure layer"
                          value={
                            analysis.structureAccepted
                              ? "Valid structure"
                              : "Invalid structure"
                          }
                          good={analysis.structureAccepted}
                          subtitle={
                            analysis.lex.error
                              ? "Lexical error · parsing not attempted"
                              : analysis.structureAccepted
                                ? "Accepted by the restricted command grammar"
                                : "Rejected by the restricted command grammar"
                          }
                          icon={<Layers size={22} />}
                        />
                      </div>
                      <div className="note-line">
                        <CircleHelp size={15} />
                        <span>
                          A match is an observation, not a threat verdict. Valid
                          syntax does not establish safety.
                        </span>
                      </div>
                      {!stale && <AnalysisDetails analysis={analysis} />}
                    </>
                  )}
                </div>
                <div className="right-rail">
                  <Panel
                    title="The recognition pipeline"
                    eyebrow="UNDER THE HOOD"
                  >
                    <div className="pipeline">
                      <PipelineNode
                        n="1"
                        title="Raw input"
                        text="A string, with exact source offsets."
                      />
                      <ArrowDown size={16} />
                      <PipelineNode
                        n="2"
                        title="Regular patterns"
                        text="Regex → ε-NFA → DFA → minimal DFA."
                      />
                      <ArrowDown size={16} />
                      <PipelineNode
                        n="3"
                        title="Structured tokens"
                        text="Lexer → CFG → predictive parse."
                      />
                      <ArrowDown size={16} />
                      <PipelineNode
                        n="4"
                        title="Separate conclusions"
                        text="Patterns and syntax, explained together."
                      />
                    </div>
                    <button
                      className="text-button wide"
                      onClick={() => setTab("Automata Lab")}
                    >
                      Inspect the machines <ArrowRight size={14} />
                    </button>
                  </Panel>
                  <Panel title="Change one thing" eyebrow="MUTATION EXPERIMENT">
                    <p className="small muted">
                      Edit the input and observe which layer changes its answer.
                    </p>
                    <div className="mutation-actions">
                      <button
                        disabled={!currentAnalysis || !!busy}
                        onClick={() => applyMutation("closing")}
                      >
                        <WandSparkles size={15} /> Remove closing bracket
                      </button>
                      <button
                        disabled={!currentAnalysis || !!busy}
                        onClick={() => applyMutation("value")}
                      >
                        <WandSparkles size={15} /> Delete a flag value
                      </button>
                      <button
                        disabled={!currentAnalysis || !!busy}
                        onClick={() => applyMutation("separator")}
                      >
                        <WandSparkles size={15} /> Append a separator
                      </button>
                    </div>
                    {mutation && (
                      <div className="mutation-result">
                        <p>{mutation.explanation}</p>
                        {currentAnalysis && (
                          <DataTable
                            headers={["Observation", "Before", "After"]}
                            rows={[
                              [
                                "Pattern",
                                mutation.before.patternMatched
                                  ? "Match"
                                  : "No match",
                                analysis?.patternMatched ? "Match" : "No match",
                              ],
                              [
                                "Structure",
                                mutation.before.structureAccepted
                                  ? "Valid"
                                  : "Invalid",
                                analysis?.structureAccepted
                                  ? "Valid"
                                  : "Invalid",
                              ],
                              [
                                "Tokens",
                                mutation.before.lex.tokens.length,
                                analysis?.lex.tokens.length,
                              ],
                            ]}
                          />
                        )}
                        <button
                          className="text-button"
                          onClick={() => {
                            const data = { ...c, input: mutation.before.input };
                            setC(data);
                            setMutation(null);
                            execute("analyse", data);
                          }}
                        >
                          Restore original <ArrowRight size={12} />
                        </button>
                      </div>
                    )}
                  </Panel>
                </div>
              </div>
              <div className="two-columns">
                <Panel
                  title="Selected signatures"
                  eyebrow="REGULAR LANGUAGE RULES"
                >
                  <p className="small muted">
                    Substring search over raw text. Matches are non-overlapping
                    and leftmost-longest; offsets start at zero.
                  </p>
                  <div className="rule-editor">
                    {c.rules.map((r, i) => (
                      <div className="rule-row" key={i}>
                        <input
                          aria-label={`Signature ${i + 1} name`}
                          value={r.name}
                          maxLength={100}
                          onChange={(e) =>
                            patch({
                              rules: c.rules.map((r, j) =>
                                i === j ? { ...r, name: e.target.value } : r,
                              ),
                            })
                          }
                        />
                        <input
                          aria-label={`Signature ${i + 1} regex`}
                          className="mono"
                          value={r.pattern}
                          maxLength={129}
                          onChange={(e) =>
                            patch({
                              rules: c.rules.map((r, j) =>
                                i === j ? { ...r, pattern: e.target.value } : r,
                              ),
                            })
                          }
                        />
                        <button
                          className="icon-button"
                          aria-label={`Remove signature ${i + 1}`}
                          disabled={c.rules.length === 1}
                          onClick={() =>
                            patch({ rules: c.rules.filter((_, j) => i !== j) })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    className="text-button"
                    disabled={c.rules.length >= 8}
                    onClick={() =>
                      patch({
                        rules: [
                          ...c.rules,
                          { name: "New signature", pattern: "test" },
                        ],
                      })
                    }
                  >
                    <Plus size={14} /> Add signature
                  </button>
                </Panel>
                <UrlDemo />
              </div>
            </>
          )}
          {tab === "Automata Lab" && (
            <>
              <Panel
                title="Two rules. One decisive example."
                eyebrow="LANGUAGE COMPARISON"
                actions={<Badge kind="amber">EXACT PRODUCT SEARCH</Badge>}
              >
                <div className="comparison-inputs">
                  <div>
                    <label htmlFor="left-rule">Rule A</label>
                    <input
                      id="left-rule"
                      className="mono large-input"
                      value={c.left}
                      maxLength={129}
                      onChange={(e) => patch({ left: e.target.value })}
                    />
                  </div>
                  <div className="compare-mark">⇄</div>
                  <div>
                    <label htmlFor="right-rule">Rule B</label>
                    <input
                      id="right-rule"
                      className="mono large-input"
                      value={c.right}
                      maxLength={129}
                      onChange={(e) => patch({ right: e.target.value })}
                    />
                  </div>
                </div>
                <div className="row wrap comparison-controls">
                  <div className="segmented" aria-label="Matching mode">
                    <button
                      aria-pressed={c.mode === "whole"}
                      className={c.mode === "whole" ? "active" : ""}
                      onClick={() => patch({ mode: "whole" })}
                    >
                      Whole string
                    </button>
                    <button
                      aria-pressed={c.mode === "substring"}
                      className={c.mode === "substring" ? "active" : ""}
                      onClick={() => patch({ mode: "substring" })}
                    >
                      Substring
                    </button>
                  </div>
                  <div className="row">
                    <button
                      className="secondary"
                      disabled={!!busy}
                      onClick={() => execute("compile")}
                    >
                      Build rule A
                    </button>
                    <button
                      className="primary"
                      disabled={!!busy}
                      onClick={() => execute("compare")}
                    >
                      <GitCompareArrows size={16} /> Find a counterexample
                    </button>
                  </div>
                </div>
                <p className="small muted">
                  {c.mode === "whole"
                    ? "Whole-string mode: the entire string must belong to each rule’s language."
                    : "Substring mode: a rule may match anywhere in the string. Both machines use the same supported ASCII alphabet."}
                </p>
                <div className="chips">
                  <button
                    className="chip"
                    onClick={() =>
                      patch({ left: "a+", right: "aa*", mode: "whole" })
                    }
                  >
                    Equivalent forms
                  </button>
                  <button
                    className="chip"
                    onClick={() =>
                      patch({ left: "a*", right: "a+", mode: "whole" })
                    }
                  >
                    An empty-string witness
                  </button>
                  <button
                    className="chip"
                    onClick={() =>
                      patch({
                        left: "(a|b)*abb",
                        right: "(a|b)*ab",
                        mode: "whole",
                      })
                    }
                  >
                    Different suffixes
                  </button>
                </div>
              </Panel>
              {compared && (
                <div className={compareStale ? "stale" : ""}>
                  <Panel
                    title={
                      compared.comparison.equivalent
                        ? "These rules recognise the same language."
                        : "A smallest difference, made visible."
                    }
                    eyebrow={
                      compareStale
                        ? "PREVIOUS COMPARISON · RULES HAVE CHANGED"
                        : "COMPARISON RESULT"
                    }
                    actions={
                      <Badge
                        kind={compared.comparison.equivalent ? "good" : "amber"}
                      >
                        {compared.comparison.equivalent
                          ? "EQUIVALENT"
                          : "WITNESS FOUND"}
                      </Badge>
                    }
                  >
                    <div className="witness">
                      <div>
                        <span className="eyebrow">
                          {compared.comparison.equivalent
                            ? "PRODUCT AUTOMATON"
                            : "SHORTEST DISTINGUISHING STRING"}
                        </span>
                        <div className="witness-string">
                          {compared.comparison.equivalent
                            ? "L(A) = L(B)"
                            : compared.comparison.witness === ""
                              ? "ε"
                              : JSON.stringify(compared.comparison.witness)}
                        </div>
                        <p className="small muted">
                          {compared.comparison.equivalent
                            ? "Every reachable pair agrees on acceptance. This is an equivalence check, not a sample-based guess."
                            : `${compared.comparison.witness!.length} character(s). Breadth-first search reaches a pair with different acceptance; no shorter witness exists.`}
                        </p>
                      </div>
                      <div className="witness-stat">
                        <strong>{compared.comparison.visitedPairs}</strong>
                        <span>state pairs examined</span>
                        <small>
                          {compared.left.mode === "whole"
                            ? "Whole-string"
                            : "Substring"}{" "}
                          semantics
                        </small>
                      </div>
                    </div>
                    {!compared.comparison.equivalent && (
                      <>
                        <Playback
                          max={compared.comparison.witness!.length}
                          step={compareStep}
                          setStep={setCompareStep}
                          label="Counterexample replay"
                        />
                        <div className="two-columns compare-machines">
                          {(["left", "right"] as const).map((side, i) => {
                            const t =
                              (side === "left"
                                ? compared.comparison.leftTrace
                                : compared.comparison.rightTrace)![
                                compareStep
                              ] ??
                              (side === "left"
                                ? compared.comparison.leftTrace
                                : compared.comparison.rightTrace)![0];
                            return (
                              <div key={side}>
                                <div className="row between">
                                  <span className="mono">
                                    {i ? "B" : "A"} · {compared[side].pattern}
                                  </span>
                                  <Badge kind={t.accepting ? "good" : "bad"}>
                                    {compareStep ===
                                    compared.comparison.witness!.length
                                      ? t.accepting
                                        ? "Accepted"
                                        : "Rejected"
                                      : t.accepting
                                        ? "Accepting state"
                                        : "Non-accepting state"}
                                  </Badge>
                                </div>
                                <AutomatonGraph
                                  machine={compared[side].minimal}
                                  active={t.active}
                                  title={`Rule ${i ? "B" : "A"} counterexample replay`}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <button
                          className="text-button"
                          onClick={() => {
                            setSimulationText(compared.comparison.witness!);
                            setMachineStep(0);
                          }}
                        >
                          Use witness in rule A simulator{" "}
                          <ArrowRight size={14} />
                        </button>
                      </>
                    )}
                  </Panel>
                </div>
              )}
              {compiled && (
                <Panel
                  title="Inside rule A"
                  eyebrow={
                    compileStale
                      ? "PREVIOUS MACHINE · RULE OR MODE HAS CHANGED"
                      : "CONSTRUCTION & SIMULATION"
                  }
                  actions={
                    <span className="mono small">{compiled.pattern}</span>
                  }
                >
                  <div className="machine-stats">
                    <MachineStat name="ε-NFA" n={compiled.nfa.stateCount} />
                    <ArrowRight size={18} />
                    <MachineStat name="DFA" n={compiled.dfa.stateCount} />
                    <ArrowRight size={18} />
                    <MachineStat
                      name="Minimal DFA"
                      n={compiled.minimal.stateCount}
                    />
                    <div className="machine-saved">
                      <strong>
                        {compiled.dfa.stateCount - compiled.minimal.stateCount}
                      </strong>{" "}
                      states removed
                    </div>
                  </div>
                  <div className="row wrap between">
                    <div className="segmented">
                      {(["nfa", "dfa", "minimal"] as const).map((m) => (
                        <button
                          key={m}
                          className={model === m ? "active" : ""}
                          aria-pressed={model === m}
                          onClick={() => {
                            setModel(m);
                            setMachineStep(0);
                          }}
                        >
                          {m === "nfa"
                            ? "ε-NFA"
                            : m === "dfa"
                              ? "DFA"
                              : "Minimal DFA"}
                        </button>
                      ))}
                    </div>
                    <Badge>
                      {compiled.mode === "whole" ? "WHOLE STRING" : "SUBSTRING"}
                    </Badge>
                  </div>
                  <div className="row sim-input">
                    <label htmlFor="simulation-text">Simulation input</label>
                    <input
                      id="simulation-text"
                      className="mono"
                      value={simulationText}
                      maxLength={2049}
                      onChange={(e) => {
                        setSimulationText(e.target.value);
                        setMachineStep(0);
                      }}
                    />
                    {simulation.length > 0 && (
                      <Badge
                        kind={simulation.at(-1)!.accepting ? "good" : "bad"}
                      >
                        Final:{" "}
                        {simulation.at(-1)!.accepting ? "accepted" : "rejected"}
                      </Badge>
                    )}
                  </div>
                  {simError ? (
                    <p className="error-text">{simError}</p>
                  ) : (
                    <>
                      <Playback
                        max={Math.max(0, simulation.length - 1)}
                        step={machineStep}
                        setStep={setMachineStep}
                        label="Machine replay"
                      />
                      <div className="consumed">
                        <span>
                          {simulationText.slice(0, trace?.index ?? 0)}
                        </span>
                        <b>│</b>
                        {simulationText.slice(trace?.index ?? 0) ||
                          (simulationText ? "" : "ε")}
                        <small>
                          Active:{" "}
                          {trace?.active.length
                            ? trace.active
                                .map((q) => (q === -1 ? "⊥" : `q${q}`))
                                .join(", ")
                            : "∅"}{" "}
                          · {trace?.accepting ? "accepting" : "non-accepting"}
                        </small>
                      </div>
                      {activeMachine && (
                        <AutomatonGraph
                          machine={activeMachine}
                          active={trace?.active}
                          title={`${model} for ${compiled.pattern}`}
                        />
                      )}
                    </>
                  )}
                  <details>
                    <summary>Formal definition & transition table</summary>
                    <p className="mono small">
                      Q = {"{"}q0 … q{activeMachine!.stateCount - 1}
                      {"}"}; start = q{activeMachine!.start}; F = {"{"}
                      {activeMachine!.accepts.map((q) => `q${q}`).join(", ")}
                      {"}"}; |Σ| = {activeMachine!.alphabet.length}
                    </p>
                    {model === "nfa" ? (
                      <DataTable
                        headers={["From", "Input", "To"]}
                        rows={compiled.nfa.edges.map((e) => [
                          `q${e.from}`,
                          showSymbol(e.symbol),
                          `q${e.to}`,
                        ])}
                      />
                    ) : (
                      <DfaTable
                        key={`${compiled.pattern}-${model}-${compiled.mode}`}
                        dfa={compiled[model]}
                      />
                    )}
                  </details>
                  <details>
                    <summary>ε-closures for every NFA state</summary>
                    <DataTable
                      headers={["State", "ε-closure"]}
                      rows={compiled.closures.map((s, i) => [
                        `q${i}`,
                        `{${s.map((q) => `q${q}`).join(", ")}}`,
                      ])}
                    />
                  </details>
                  <ConstructionSteps compiled={compiled} />
                  <details>
                    <summary>Minimisation partition refinement</summary>
                    <p className="small muted">
                      Hopcroft refinement splits blocks until no symbol
                      distinguishes states within a block. Block IDs refer to
                      the original DFA.
                    </p>
                    <DataTable
                      headers={["Refinement", "Partition"]}
                      rows={compiled.partitions.map((p, i) => [
                        i,
                        p
                          .map((g) => `{${g.map((q) => `q${q}`).join(", ")}}`)
                          .join(" | "),
                      ])}
                    />
                  </details>
                  <details>
                    <summary>
                      Supported regex syntax & computational limits
                    </summary>
                    <SyntaxHelp />
                  </details>
                </Panel>
              )}
              {!compiled && (
                <Panel>
                  <div className="empty">
                    <GitCompareArrows size={34} />
                    <h2>Give a rule a state of its own.</h2>
                    <p>
                      Build rule A or compare both rules to inspect the
                      generated machines.
                    </p>
                    <SyntaxHelp />
                  </div>
                </Panel>
              )}
            </>
          )}
          {tab === "Grammar & Stack" && (
            <>
              <div className="two-columns">
                <Panel
                  title="The language of this experiment"
                  eyebrow="FIXED LL(1) GRAMMAR"
                >
                  <pre className="grammar-source">
                    {Object.entries(GRAMMAR)
                      .map(
                        ([n, rules]) =>
                          `${n.padEnd(10)} → ${rules.map((r) => r.join(" ") || "ε").join(" | ")}`,
                      )
                      .join("\n")}
                  </pre>
                  <p className="small muted">
                    WORD begins with a letter, digit, underscore, dot, slash, or
                    colon; subsequent characters may also include a hyphen. FLAG
                    is <code>--[a-z]+</code>. QUOTED uses double quotes and
                    supports escaped quotes/backslashes. Adjacent values require
                    whitespace; parentheses and separators delimit themselves.
                  </p>
                  <div className="callout">
                    <Layers size={18} />
                    <p>
                      Arbitrarily nested groups require a stack. The simpler
                      subset without nesting can be regular; using a CFG alone
                      does not prove a language is non-regular.
                    </p>
                  </div>
                </Panel>
                <Panel
                  title="Parse your current script"
                  eyebrow="CONNECTED TO ANALYSE"
                >
                  <div className="code-preview">
                    {c.input || "(empty input)"}
                  </div>
                  <button
                    className="primary"
                    disabled={!!busy}
                    onClick={() => execute("analyse")}
                  >
                    Compute grammar trace <ArrowRight size={15} />
                  </button>
                  {stale && (
                    <p className="small error-text">
                      Input or rules changed. Recompute before using the trace.
                    </p>
                  )}
                  {currentAnalysis && (
                    <div className="parse-verdict">
                      <Badge
                        kind={
                          currentAnalysis.structureAccepted ? "good" : "bad"
                        }
                      >
                        {currentAnalysis.structureAccepted
                          ? "Grammar accepted"
                          : "Grammar rejected"}
                      </Badge>
                      <p className="small">
                        {currentAnalysis.lex.error?.message ??
                          currentAnalysis.parse?.error?.message ??
                          `${currentAnalysis.parse?.trace.length} parser actions; full input consumed.`}
                      </p>
                    </div>
                  )}
                </Panel>
              </div>
              {currentAnalysis && (
                <>
                  <Panel
                    title="Calculated sets and parsing table"
                    eyebrow="PREDICTIVE PARSING"
                  >
                    <div className="two-columns">
                      <DataTable
                        headers={["Nonterminal", "FIRST", "FOLLOW"]}
                        rows={Object.keys(GRAMMAR).map((n) => [
                          n,
                          `{${currentAnalysis.grammar.first[n].join(", ")}}`,
                          `{${currentAnalysis.grammar.follow[n].join(", ")}}`,
                        ])}
                      />
                      <div className="small muted">
                        <p>
                          FIRST and FOLLOW are computed to a fixed point from
                          the productions. The table includes ε-productions
                          using FOLLOW.
                        </p>
                        <Badge kind="good">No LL(1) conflicts</Badge>
                        <p>
                          Stack top is displayed on the left. The dollar sign $
                          marks the end of input.
                        </p>
                      </div>
                    </div>
                    <details>
                      <summary>Show the complete LL(1) parsing table</summary>
                      <DataTable
                        headers={[
                          "Nonterminal",
                          ...currentAnalysis.grammar.terminals,
                        ]}
                        rows={Object.keys(GRAMMAR).map((n) => [
                          n,
                          ...currentAnalysis.grammar.terminals.map((t) => {
                            const r = currentAnalysis.grammar.table[n][t];
                            return r ? `${n} → ${r.join(" ") || "ε"}` : "—";
                          }),
                        ])}
                      />
                    </details>
                  </Panel>
                  {currentAnalysis.parse && (
                    <Panel
                      title="Follow the derivation"
                      eyebrow="PARSER REPLAY"
                    >
                      <Playback
                        max={currentAnalysis.parse.trace.length - 1}
                        step={parseStep}
                        setStep={setParseStep}
                        label="Parser replay"
                      />
                      <div className="parse-current">
                        <span className="eyebrow">ACTION {parseStep + 1}</span>
                        <strong>
                          {currentAnalysis.parse.trace[parseStep]?.action}
                        </strong>
                        <div className="two-columns">
                          <div>
                            <label>Stack · top at left</label>
                            <code>
                              {currentAnalysis.parse.trace[
                                parseStep
                              ]?.stack.join(" ")}
                            </code>
                          </div>
                          <div>
                            <label>Remaining tokens</label>
                            <code>
                              {currentAnalysis.parse.trace[
                                parseStep
                              ]?.remaining.join(" ")}
                            </code>
                          </div>
                        </div>
                      </div>
                      <details>
                        <summary>
                          Complete parsing trace (
                          {currentAnalysis.parse.trace.length} actions)
                        </summary>
                        <DataTable
                          headers={["Step", "Stack", "Remaining", "Action"]}
                          rows={currentAnalysis.parse.trace.map((s, i) => [
                            i + 1,
                            s.stack.join(" "),
                            s.remaining.join(" "),
                            s.action,
                          ])}
                        />
                      </details>
                      <details>
                        <summary>
                          Parse tree{" "}
                          {currentAnalysis.parse.accepted
                            ? ""
                            : "(partial at rejection)"}
                        </summary>
                        <ParseTree nodes={currentAnalysis.parse.nodes} />
                      </details>
                    </Panel>
                  )}
                </>
              )}
              <PdaLab />
            </>
          )}
          {tab === "Evidence" && (
            <>
              <div className="two-columns">
                <Panel
                  title="Keep this experiment"
                  eyebrow="LOCAL CASE LIBRARY"
                >
                  <label htmlFor="case-name">Case name</label>
                  <input
                    id="case-name"
                    maxLength={100}
                    value={c.name}
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                  <div className="code-preview">
                    {c.input || "(empty input)"}
                  </div>
                  <div className="row wrap">
                    <button className="primary" onClick={save}>
                      <Save size={15} /> Save case
                    </button>
                    <button
                      className="secondary"
                      onClick={() =>
                        download(
                          "autosec-case.json",
                          JSON.stringify(caseFile(c, currentAnalysis), null, 2),
                        )
                      }
                    >
                      <FileDown size={15} /> Export JSON
                    </button>
                  </div>
                  <p className="small muted">
                    Saved on this browser only. Exported schema v1 includes
                    inputs, rules, matching mode, and current analysis when
                    available. Imported results are recomputed.
                  </p>
                  <label className="upload-box">
                    <Upload size={21} />
                    <strong>Import an AUTOSEC case</strong>
                    <span>JSON · schema v1 · up to 4 MB</span>
                    <input
                      aria-label="Import case JSON"
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => {
                        void importFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </Panel>
                <Panel
                  title="A report you can explain"
                  eyebrow="PORTABLE RESULTS"
                >
                  <p>
                    Print the latest analysis with its signatures, token
                    offsets, verdicts, grammar, and any completed rule
                    comparison.
                  </p>
                  <div className="export-card">
                    <BookOpen size={27} />
                    <div>
                      <strong>{c.name || "Untitled experiment"}</strong>
                      <span>
                        {currentAnalysis
                          ? "Current analysis ready"
                          : "Run the current analysis first"}{" "}
                        · Engine {ENGINE_VERSION}
                      </span>
                    </div>
                  </div>
                  <button
                    className="secondary"
                    disabled={!currentAnalysis}
                    onClick={() => window.print()}
                  >
                    <FileDown size={16} /> Print / save analysis PDF
                  </button>
                  <p className="small muted">
                    Use your browser’s “Save as PDF”. For diagrams, use the SVG
                    button inside each automaton.
                  </p>
                  <div className="callout">
                    <ShieldCheck size={18} />
                    <p>
                      The program makes no threat-detection accuracy claim. A
                      signature is a selected textual pattern, and acceptance
                      concerns the defined language.
                    </p>
                  </div>
                </Panel>
              </div>
              <Panel
                title="Saved cases"
                eyebrow={`${saved.length} / 30 BROWSER-LOCAL EXPERIMENTS`}
              >
                {saved.length ? (
                  <div className="saved-list">
                    {saved.map((s, i) => (
                      <div key={i}>
                        <span className="saved-icon">
                          <BookOpen size={18} />
                        </span>
                        <div>
                          <strong>{s.name || "Untitled experiment"}</strong>
                          <code>{s.input || "ε"}</code>
                        </div>
                        <button className="secondary" onClick={() => load(s)}>
                          Load <ArrowRight size={13} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Delete ${s.name}`}
                          onClick={() => {
                            const next = saved.filter((_, j) => i !== j);
                            try {
                              localStorage.setItem(
                                STORAGE,
                                JSON.stringify(next),
                              );
                              setSaved(next);
                            } catch {
                              setError({
                                message: "Could not update browser storage.",
                              });
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty">
                    <BookOpen size={28} />
                    <p>Your saved experiments will appear here.</p>
                  </div>
                )}
              </Panel>
              <Panel
                title="How this connects to MOC"
                eyebrow="CONCEPT → IMPLEMENTATION"
              >
                <DataTable
                  headers={["Course concept", "Where it appears"]}
                  rows={[
                    [
                      "Regular expressions & Thompson construction",
                      "Editable signatures become actual ε-NFAs.",
                    ],
                    [
                      "ε-closure & subset construction",
                      "Inspect intermediate closures and reachable subsets.",
                    ],
                    [
                      "DFA minimisation",
                      "Hopcroft partition refinement and reduced machines.",
                    ],
                    [
                      "Closure properties & product automata",
                      "A BFS over the symmetric difference finds shortest distinguishing inputs.",
                    ],
                    [
                      "Lexical analysis",
                      "Words, flags, quoted strings, separators, and source offsets.",
                    ],
                    [
                      "CFG, FIRST/FOLLOW & LL(1)",
                      "Fixed-point set calculation, generated parsing table, derivation tree.",
                    ],
                    [
                      "Pushdown automata",
                      "A delimiter recogniser with visible pushes, pops, and rejection.",
                    ],
                    [
                      "Formal verification",
                      "Equivalence checks and reproducible, independently specified tests.",
                    ],
                  ]}
                />
              </Panel>
            </>
          )}
          <footer className="main-footer">
            <span>
              AUTOSEC <b>·</b> A counterexample-driven learning experiment
            </span>
            <span>Built for understanding, one transition at a time.</span>
          </footer>
        </main>
      </div>
      <div className="print-report">
        <h1>AUTOSEC analysis report</h1>
        <p>
          {c.name} · Engine {ENGINE_VERSION}
        </p>
        <p>
          Bhoumik Singh Rajput (25BYB0120) · Vihaan Jinesh Jain (25BYB0130)
          <br />
          Models of Computation — BACSE201 · Dr. Dharmendra Singh Rajput
        </p>
        <h2>Input</h2>
        <pre>{c.input}</pre>
        {currentAnalysis ? (
          <>
            <p>
              Pattern matched: {String(currentAnalysis.patternMatched)}; grammar
              accepted: {String(currentAnalysis.structureAccepted)}
            </p>
            <AnalysisDetails analysis={currentAnalysis} />
          </>
        ) : (
          <p>No current analysis. Recompute before printing.</p>
        )}
        <h2>Restricted grammar</h2>
        <pre>
          {Object.entries(GRAMMAR)
            .map(
              ([n, r]) =>
                `${n} → ${r.map((s) => s.join(" ") || "ε").join(" | ")}`,
            )
            .join("\n")}
        </pre>
        {compared && !compareStale && (
          <>
            <h2>Rule comparison · {compared.left.mode}</h2>
            <p>
              A: {compared.left.pattern}; B: {compared.right.pattern}
            </p>
            <p>
              {compared.comparison.equivalent
                ? "Equivalent languages."
                : `Shortest witness: ${JSON.stringify(compared.comparison.witness)}; A accepted: ${compared.comparison.leftAccepted}; B accepted: ${compared.comparison.rightAccepted}`}
            </p>
          </>
        )}
        <p>
          This educational analysis does not establish whether text is malicious
          or safe.
        </p>
      </div>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <dialog
            open
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setHelp(false);
            }}
          >
            <div className="row between">
              <h2 id="help-title">A lab for asking “why?”</h2>
              <button
                className="icon-button"
                aria-label="Close help"
                autoFocus
                onClick={() => setHelp(false)}
              >
                <X size={20} />
              </button>
            </div>
            <p>
              AUTOSEC uses formal-language algorithms to explain text. It does
              not execute your input or assess real-world security.
            </p>
            <ol>
              <li>Analyse a nested script and compare the two verdicts.</li>
              <li>
                Remove one closing bracket. Watch only the structural result
                change.
              </li>
              <li>
                Compare <code>--[a-z]+</code> with <code>--[a-z][a-z]+</code>.
                The shortest witness is <code>--a</code>.
              </li>
              <li>
                Replay both machines, then inspect FIRST/FOLLOW and the parsing
                stack.
              </li>
              <li>Save or export your experiment in Evidence.</li>
            </ol>
            <SyntaxHelp />
            <p className="small muted">
              Bhoumik Singh Rajput · 25BYB0120
              <br />
              Vihaan Jinesh Jain · 25BYB0130
              <br />
              Guide: Dr. Dharmendra Singh Rajput · VIT Vellore
            </p>
            <button className="primary" onClick={() => setHelp(false)}>
              Start exploring <ArrowRight size={15} />
            </button>
          </dialog>
        </div>
      )}
    </div>
  );
}
function Verdict({
  number,
  title,
  value,
  good,
  subtitle,
  icon,
}: {
  number: string;
  title: string;
  value: string;
  good: boolean;
  subtitle: string;
  icon: ReactNode;
}) {
  return (
    <div className={`verdict ${good ? "positive" : "negative"}`}>
      <div className="row between">
        <span className="eyebrow">
          {number} / {title}
        </span>
        {icon}
      </div>
      <h3>{value}</h3>
      <p>{subtitle}</p>
      <div className="verdict-line" />
    </div>
  );
}
function PipelineNode({
  n,
  title,
  text,
}: {
  n: string;
  title: string;
  text: string;
}) {
  return (
    <div className="pipeline-node">
      <span>{n}</span>
      <div>
        <strong>{title}</strong>
        <small>{text}</small>
      </div>
    </div>
  );
}
function MachineStat({ name, n }: { name: string; n: number }) {
  return (
    <div>
      <span className="eyebrow">{name}</span>
      <strong>
        {n}
        <small> states</small>
      </strong>
    </div>
  );
}
function AnalysisDetails({ analysis: a }: { analysis: Analysis }) {
  const diagnostic = a.lex.error ?? a.parse?.error;
  return (
    <>
      <Panel
        title="The patterns in your text"
        eyebrow="A / SIGNATURE OBSERVATIONS"
      >
        <DataTable
          headers={["Signature", "Rule", "Observation", "Offsets [start, end)"]}
          rows={a.signatures.map((s) => [
            s.name,
            <code>{s.pattern}</code>,
            <Badge kind={s.matched ? "amber" : "neutral"}>
              {s.matched
                ? `${s.matches.length} match${s.matches.length === 1 ? "" : "es"}`
                : "No match"}
            </Badge>,
            s.matches
              .map(
                (m) =>
                  `[${m.start}, ${m.end}) ${JSON.stringify(a.input.slice(m.start, m.end)) || "ε"}`,
              )
              .join(" · ") || "—",
          ])}
        />
      </Panel>
      <Panel
        title="From characters to tokens"
        eyebrow="B / LEXICAL STRUCTURE"
        actions={<Badge>{a.lex.tokens.length} TOKENS</Badge>}
      >
        <div className="tokens">
          {a.lex.tokens.map((t, i) => (
            <div
              className={`token token-${t.type === "WORD" ? "word" : t.type === "FLAG" ? "flag" : t.type === "QUOTED" ? "quoted" : "punct"}`}
              key={i}
            >
              <span>{t.type}</span>
              <code>{t.text}</code>
              <small>
                {t.start}–{t.end}
              </small>
            </div>
          ))}
          {!a.lex.tokens.length && (
            <p className="muted small">No complete tokens.</p>
          )}
        </div>
        {diagnostic && (
          <div className="diagnostic">
            <strong>First failure · offset {diagnostic.offset}</strong>
            <p>{diagnostic.message}</p>
            <pre>
              {a.input.slice(
                Math.max(0, diagnostic.offset - 35),
                diagnostic.offset,
              )}
              <mark>{a.input[diagnostic.offset] || " ⟨end⟩ "}</mark>
              {a.input.slice(diagnostic.offset + 1, diagnostic.offset + 36)}
            </pre>
          </div>
        )}
      </Panel>
    </>
  );
}
function SyntaxHelp() {
  return (
    <div className="syntax-help">
      <p>
        <strong>Regex subset:</strong> literal characters, escapes,{" "}
        <code>[a-z]</code>, concatenation, <code>a|b</code>, <code>(ab)</code>,{" "}
        <code>* + ?</code>, and <code>ε</code>. Use <code>\.</code> for a
        literal dot. Empty groups, anchors, lookarounds, backreferences,
        wildcard dots, negated classes, and counted repetition are rejected.
      </p>
      <p>
        Alphabet: printable ASCII plus tab, newline, carriage return. Maximum
        128 regex characters, 2,048 input characters, 256 NFA states, 512 DFA
        states. Comparison runs in a cancellable worker with a 12-second budget.
        A stopped or bounded computation is incomplete.
      </p>
    </div>
  );
}
function ConstructionSteps({ compiled }: { compiled: Compilation }) {
  const [page, setPage] = useState(0);
  const steps = compiled.subsetSteps;
  return (
    <details>
      <summary>Subset construction ({steps.length} transitions)</summary>
      <p className="small muted">
        Each DFA state represents an ε-closed set of NFA states. The empty
        subset is the explicit sink.
      </p>
      <DataTable
        headers={["DFA from", "Symbol", "Move", "ε-closure", "DFA to"]}
        rows={steps
          .slice(page * 50, page * 50 + 50)
          .map((s) => [
            `q${s.from}`,
            showSymbol(s.symbol),
            `{${s.move.join(", ") || "∅"}}`,
            `{${s.closure.join(", ") || "∅"}}`,
            `q${s.to}`,
          ])}
      />
      {steps.length > 50 && (
        <div className="row">
          <button disabled={!page} onClick={() => setPage(page - 1)}>
            Previous transitions
          </button>
          <span className="small">
            {page * 50 + 1}–{Math.min(page * 50 + 50, steps.length)} /{" "}
            {steps.length}
          </span>
          <button
            disabled={(page + 1) * 50 >= steps.length}
            onClick={() => setPage(page + 1)}
          >
            Next transitions
          </button>
        </div>
      )}
    </details>
  );
}
function ParseTree({ nodes }: { nodes: ParseNode[] }) {
  function render(id: number): ReactNode {
    const n = nodes[id];
    return (
      <li key={id}>
        <span className={n.token ? "tree-terminal" : ""}>
          {n.symbol}
          {n.token && <code>{n.token.text}</code>}
        </span>
        {n.children.length > 0 && <ul>{n.children.map(render)}</ul>}
      </li>
    );
  }
  return (
    <div className="parse-tree">
      <ul>{render(0)}</ul>
    </div>
  );
}
function PdaLab() {
  const [input, setInput] = useState("([{}])()"),
    [step, setStep] = useState(0);
  let error = "",
    result: ReturnType<typeof runPda> | null = null;
  try {
    result = runPda(input);
  } catch (e) {
    error = (e as Error).message;
  }
  const current = result?.steps[Math.min(step, result.steps.length - 1)];
  return (
    <Panel
      title="A stack remembers what a state cannot"
      eyebrow="PUSHDOWN AUTOMATON · DELIMITERS"
      actions={
        result && (
          <Badge kind={result.accepted ? "good" : "bad"}>
            Final: {result.accepted ? "accepted" : "rejected"}
          </Badge>
        )
      }
    >
      <p className="small muted">
        Separate demonstration of the Dyck language with three bracket types.
        Whitespace is ignored. Push an opening delimiter, pop only its matching
        closer, then accept at end-of-input with an empty stack.
      </p>
      <label htmlFor="pda-input">Delimiter sequence</label>
      <input
        id="pda-input"
        value={input}
        maxLength={2049}
        className="mono"
        onChange={(e) => {
          setInput(e.target.value);
          setStep(0);
        }}
      />
      <div className="chips">
        <button
          className="chip"
          onClick={() => {
            setInput("([{}])()");
            setStep(0);
          }}
        >
          Balanced
        </button>
        <button
          className="chip"
          onClick={() => {
            setInput("([)]");
            setStep(0);
          }}
        >
          Mismatched
        </button>
        <button
          className="chip"
          onClick={() => {
            setInput("((())");
            setStep(0);
          }}
        >
          Missing closer
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {result && current && (
        <>
          <Playback
            max={result.steps.length - 1}
            step={step}
            setStep={setStep}
            label="PDA replay"
          />
          <div className="pda-view">
            <div>
              <span className="eyebrow">CURRENT ACTION · {current.state}</span>
              <h3>{current.action}</h3>
              <div className="consumed">
                <span>{input.slice(0, current.index)}</span>
                <b>│</b>
                {input.slice(current.index)}
              </div>
              <p className="small muted">
                Read {current.index} / {input.length} characters · stack depth{" "}
                {current.stack.length}
              </p>
            </div>
            <div className="stack-column">
              <span className="eyebrow">TOP ↓</span>
              {[...current.stack].reverse().map((s, i) => (
                <div key={i}>{s}</div>
              ))}
              <div className="bottom">⊥</div>
            </div>
          </div>
          <details>
            <summary>Complete PDA transition trace</summary>
            <DataTable
              headers={[
                "Step",
                "Read",
                "Stack bottom → top",
                "State",
                "Action",
              ]}
              rows={result.steps.map((s, i) => [
                i,
                showSymbol(s.symbol),
                `⊥ ${s.stack.join(" ")}`,
                s.state,
                s.action,
              ])}
            />
          </details>
        </>
      )}
    </Panel>
  );
}
function UrlDemo() {
  const [url, setUrl] = useState("https://example.com/search?q=test");
  const parts = inspectUrl(url);
  return (
    <Panel title="A URL, taken apart" eyebrow="SUPPLEMENTARY EXAMPLE">
      <label htmlFor="url-example">HTTP(S) text · never opened</label>
      <input
        id="url-example"
        value={url}
        maxLength={2048}
        className="mono"
        onChange={(e) => setUrl(e.target.value)}
      />
      {parts ? (
        <div className="url-parts">
          {Object.entries(parts).map(([k, v]) => (
            <div key={k}>
              <span>{k}</span>
              <code>{v || "—"}</code>
            </div>
          ))}
        </div>
      ) : (
        <p className="small error-text">
          Outside this limited HTTP(S) example format.
        </p>
      )}
      <p className="small muted">
        Component illustration using the browser URL parser after a restricted
        format check. This is separate from the command CFG and is not a
        complete RFC 3986 validator.
      </p>
    </Panel>
  );
}
