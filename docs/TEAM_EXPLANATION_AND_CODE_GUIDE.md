# AUTOSEC: understand the project before presenting it

**Team reading guide - Bhoumik Singh Rajput and Vihaan Jinesh Jain**

Prepared 23 October 2026. This explains the actual implementation and is separate from the 12-page academic report.

## 1. Is it ready for full marks?

**It is a substantial course project, but full marks cannot be guaranteed.** The strongest parts are the implemented automata algorithms, the shortest-counterexample feature, the connection to CFG/PDA topics, and the reproducible tests. The current review reran all 90 automated tests and the production build successfully. Real browser checks now also cover the main analysis, witness replay, grammar/PDA views, persistence, and JSON/SVG export.

A real mobile overflow defect was found during this review and fixed. The comparison graphs now scroll inside their own panels instead of stretching the page. The fix was checked locally, deployed, and checked again at a 390px viewport. Genuine application screenshots are included with the package.

The remaining grading risks are practical: we have not been given the faculty's marking rubric; browser print output and browser cancellation/timeout have not been verified; and your explanation during the viva still matters. There is no honest basis for assigning a predicted mark or promising 100%.

**Before presenting:** check the required report sections against the rubric, run the demo on the actual presentation laptop, and ensure both of you can explain the counterexample, ε-closure, FIRST/FOLLOW, and the role of the stack. A polished interface cannot replace that understanding.

**How to use this guide:** read Sections 2-5 for the overall idea, 6-12 for the algorithms, 13-15 for the code, and 16-18 for verification and viva preparation. Keep the app open while reading the examples.

<!-- pagebreak -->

# 2. The idea and the notation

AUTOSEC asks different questions about the same text. A **signature** is a pattern we choose to look for. A **grammar** describes which token sequences count as well-formed scripts. Neither is a determination of malicious intent.

| Symbol or term | Meaning in this project |
| --- | --- |
| String | A finite sequence of characters, such as `--tag`. |
| Alphabet Σ | The set of symbols a machine may read. The app supports printable ASCII and tab/newline/carriage return. |
| Language L | A set of strings satisfying a rule. |
| ε | The empty string: zero characters. An ε-edge consumes nothing. |
| ∅ | The empty set. It is different from ε. |
| Q, q₀, F | All states, start state, and accepting states. |
| δ(q, a) | The next state after reading symbol a from state q. |
| NFA | An automaton that may have several active states. |
| DFA | An automaton with one next state for each state/symbol pair. |
| CFG | Context-free grammar: productions defining structured strings. |
| PDA | Pushdown automaton: a finite-state controller plus a stack. |
| $ | End-of-input marker used by the parser; the user does not type it. |
| Witness | An input demonstrating that two languages differ. |
| [start, end) | A zero-based source interval including start and excluding end. |

For `inspect --tag`, the flag pattern matches, but the grammar rejects because the flag has no value. For `inspect file`, the grammar accepts, while none of the default signatures match. These two observations are deliberately independent.

Do not say that a CFG makes every described language non-regular. The important context-free feature here is arbitrarily nested groups. A flat command subset can be regular. The implementation has finite resource limits even though the mathematical grammar permits arbitrary nesting.

<!-- pagebreak -->

# 3. What each screen does

| Screen | What to do | What it teaches |
| --- | --- | --- |
| Analyse | Enter a script, choose signatures, inspect verdicts/tokens, and apply mutations. | Pattern presence is different from structural validity. |
| Automata Lab | Build a rule, inspect NFA/DFA/minimal DFA, compare two rules, and replay inputs. | Transformations preserve a language; product search can distinguish languages. |
| Grammar & Stack | Inspect productions, FIRST/FOLLOW, the LL(1) table, parser trace/tree, and delimiter PDA. | Token order, derivations, lookahead decisions, and stack memory. |
| Evidence | Save/load cases, export/import JSON, print an analysis, or export diagrams from graph panels. | Reproducibility and traceable results. |

{{ANALYSIS_SCREENSHOT}}

The screenshot is from the real published application. The nested example has both a signature observation and valid structure. Removing its last `)` leaves the flags in the text but makes the script incomplete. The browser review checked this exact change.

The URL panel is a limited component example. It does not fetch the URL, query a reputation service, or classify phishing. Its browser URL parser is separate from our command CFG and automata engine.

<!-- pagebreak -->

# 4. The tech stack, without the buzzwords

A **frontend** is the part running in the browser. A **backend** is application logic hosted on a server. AUTOSEC has a frontend and a local computation engine; it does not need an application backend.

| Technology | Actual responsibility |
| --- | --- |
| TypeScript | JavaScript with compile-time types. It describes machines, tokens, traces, and component props. |
| React 19 | Updates the interface when state changes: selected tab, input, result, playback step, and saved cases. |
| Vite 8 | Development server and production bundler. It transforms TypeScript/TSX and emits the main app and worker assets. |
| Web Workers | Browser threads for analysis, compilation and comparison, keeping heavy work off the UI thread. |
| Dagre | Calculates graph node/edge positions. It does not recognise languages or construct the automata. |
| SVG | Draws the automata and supports vector diagram downloads. |
| Lucide React | Interface icons. These are presentation assets, not algorithms. |
| CSS | Layout, typography, responsive behaviour, graph scrolling and print styling. |
| localStorage | Persists up to 30 named cases in the current browser/origin. It is not a cloud database. |
| JSON | The versioned case interchange format and worker message/result format. |
| Vitest + Testing Library + jsdom | Algorithm tests and simulated DOM interaction tests. jsdom is not a real browser. |
| Node.js + npm | Install dependencies, run development/build/tests, and execute the worker proof harness. |
| GitHub Actions + Pages | CI verification and static public hosting. The deployed algorithms still run in the visitor's browser. |

There is no trained model, LLM API, malware dataset, Python application backend, SQLite database, login service, or live operating-system monitoring in this implementation. Python is used for generating the report/package; it is not part of the app's runtime engine.

<!-- pagebreak -->

# 5. Follow one input through the whole app

Start with:

```text
inspect --tag "sample data"
```

**Step 1 - input state.** The textarea updates the current case in React. Pressing Analyse sends a copy of the case to a worker. Merely editing text does not make the previous result current; a stale-result label warns when inputs have changed.

**Step 2 - independent signature search.** `analyse()` compiles each selected regex into a minimal DFA. `findMatches()` searches the raw text. The default long-flag rule finds `--tag` at [8, 13). This search is not token-aware: flag-looking text inside quotes can also match.

**Step 3 - tokenisation.** The lexer produces the following actual tokens:

{{SIMPLE_TOKEN_TABLE}}

The quoted value remains one token even though it contains a space. Splitting the string at spaces would lose that structure.

**Step 4 - parsing.** `grammarInfo()` calculates the sets/table from productions. `parseTokens()` consumes the token types and accepts after {{SIMPLE_ACTIONS}} recorded actions. It also records offsets and builds derivation nodes.

**Step 5 - results.** The worker posts serialisable results back to React. React renders the signature observations and grammar result separately, along with tables, token chips and explanations. It does not execute `inspect`; that name is illustrative text.

**Now remove the value:** `inspect --tag` still contains a matching flag, but parsing reaches $ while expecting Value. This is the easiest example for explaining the purpose of the two layers.

<!-- pagebreak -->

# 6. Regex parsing and Thompson construction

A regular expression describes a language. In whole-string mode, `ab*` means one `a` followed by zero or more `b` characters. It accepts `a`, `ab`, and `abbb`; it rejects ε, `b`, and `aab`.

The editable regex parser is implemented in `src/engine/automata.ts`. It uses recursive-descent functions: `alternative()`, `concatenation()`, `repeated()`, and `atom()`. This implements precedence: repetition binds most tightly, then concatenation, then alternation.

For `ab*`, the abstract syntax tree (AST) has this shape:

```text
concat
  left:  chars ['a']
  right: repeat '*'
           child: chars ['b']
```

The AST is a structured description of the expression. It is not yet an automaton. `thompson()` converts it into fragments with entry/exit states. Concatenation connects fragments with ε; alternation adds ε-branches; `*` allows both skipping and repeating a fragment; `+` requires at least one occurrence; `?` allows zero or one.

For this example the real engine creates six NFA states, start q0 and accepting state q3. The consuming edges are q0 --a→ q1 and q4 --b→ q5. The remaining connections are ε-edges.

```text
q1 →ε q2     q2 →ε q3     q2 →ε q4
q5 →ε q3     q5 →ε q4
```

These edges explain why `a` is accepted without reading a `b`: after consuming `a`, ε-steps can reach q3. They also explain repetition: after a `b`, q5 can return to q4 without consuming input.

Small native JavaScript regex checks are used for lexer/character validation. The editable rule recognition itself uses the constructed automata, not a single native `RegExp.test()` call pretending to be an NFA/DFA.

<!-- pagebreak -->

# 7. ε-closure and subset construction, worked out

An ε-closure contains the states reachable without consuming another character, including the starting state. For the actual `ab*` NFA, ε-closure({q1}) is {q1, q2, q3, q4}. It includes q3, so a run that just consumed `a` is already accepting.

`epsilonClosure()` uses a queue and a `seen` set. Each newly reached state is queued once. The set prevents ε-cycles from causing an infinite loop.

A DFA state represents an entire ε-closed NFA state set. The real subset construction produces:

{{SUBSET_TABLE}}

After reading `a` from DFA q0, move reaches NFA q1 and closure expands it to {1,2,3,4}, represented by DFA q1. After the following `b`, the active NFA set is {3,4,5}, represented by DFA q3. Both are accepting because they contain NFA accepting state 3.

DFA q2 represents ∅, the empty subset. No NFA run remains active there, so it is a rejecting sink. It is a real DFA state in the table, not an indication that the implementation forgot a transition.

{{DFA_TABLE}}

**Why do this transformation?** NFA simulation must track a set of active states. The DFA packs each reachable set into one state, so simulation becomes a table lookup for each input character. Determinisation changes representation, not language-recognition power. The number of reachable subsets can still grow exponentially in the worst case, which is why the app imposes a state cap.

<!-- pagebreak -->

# 8. Minimisation: fewer states, same language

Two states may be different objects but have identical future behaviour. If no suffix distinguishes their acceptance, a minimal DFA can merge them. Minimisation preserves the accepted language; it does not remove characters from the input or merely make the diagram prettier.

For `ab*`, the four-state DFA reduces to three states. Original DFA states q1 and q3 merge: both accept, both go to the rejecting sink on `a`, and both remain in the same accepting group on `b`.

{{MINIMISATION_TABLE}}

`minimize()` first finds reachable states. It then separates accepting and non-accepting blocks and refines them using transition preimages. If a symbol sends only part of a block into a selected block, that block must split. The worklist continues until no split remains. The implementation follows Hopcroft's partition-refinement/worklist idea with straightforward set scans; do not claim its data structures achieve the fully optimised textbook bound.

The `members` field has two related meanings. In a DFA from subset construction it lists NFA state IDs. In the minimal DFA it lists the original DFA states that were merged. State names are local to each machine. Minimal q1 is not automatically the same object as NFA q1.

**A useful viva observation:** the default flag rules each remain unchanged after minimisation. That is not a failure. A recogniser may already be minimal. Use `ab*` to demonstrate a real reduction: 6 NFA states → 4 DFA states → 3 minimal states.

**Acceptance versus proof:** checking a few sample inputs is evidence, not a general proof of equivalence. The test suite also uses the product-machine equivalence procedure to compare a DFA with its minimised form.

<!-- pagebreak -->

# 9. The distinctive feature: a shortest counterexample

Compare these rules in whole-string mode:

```text
A: --[a-z]+
B: --[a-z][a-z]+
```

A needs at least one lowercase letter after two hyphens; B needs at least two. The shortest witness is `--a`. A accepts it and B rejects it. The actual trace is:

{{WITNESS_TRACE}}

`compareDfa()` explores pairs of states. A pair is a disagreement when exactly one component is accepting. This is recognition of the symmetric difference of the languages. Missing transitions go to an implicit rejecting sink, so rules with different alphabets can still be compared consistently.

The search is breadth-first. It examines the empty prefix, then one-character prefixes, then two-character prefixes, and so on. Therefore the first acceptance disagreement has minimum length. Each queued pair stores its parent index and the symbol used to reach it; following parents backwards reconstructs the witness. ASCII order makes ties deterministic.

If every reachable pair is exhausted without a disagreement, the languages are equivalent. For `a+` versus `aa*`, this is the result. For `a*` versus `a+`, the start states already disagree, so the witness is ε: type nothing into the simulator, rather than typing the Greek character.

Whole-string and substring modes are different experiments. With substring mode, both rules receive the same ASCII prefix/suffix wrapper. A nullable rule such as `a*` then matches somewhere in every supported input. A cancelled, oversized or timed-out computation is incomplete; it must never be called equivalent merely because no witness was returned yet.

<!-- pagebreak -->

# 10. The grammar, FIRST and FOLLOW

The lexer converts characters into token categories. The parser works with those categories rather than with the spelling of each word. Our fixed grammar is:

```text
Script    → Statement Rest
Rest      → ; Statement Rest | ε
Statement → WORD Args | ( Script )
Args      → Arg Args | ε
Arg       → FLAG Value | Value
Value     → WORD | QUOTED
```

A statement can be a command or a parenthesised script. Rest allows additional statements separated by semicolons. Args allows zero or more arguments. A flag is followed by a required value. No production generates an empty Script, so empty groups and a trailing separator are invalid.

**FIRST(X)** asks which terminal could begin something derived from X. FIRST(Value) is {WORD, QUOTED}. FIRST(Args) also contains ε because no arguments are allowed.

**FOLLOW(X)** asks which terminal can immediately follow X in a valid sentential form. FOLLOW(Script) contains $ at the end and `)` when the script is inside a group.

`grammarInfo()` does not store these answers as fixed tables. It repeatedly adds new information to sets until a pass adds nothing. It then builds the predictive table from FIRST, using FOLLOW for ε-rules, and checks for conflicting assignments.

{{GRAMMAR_SETS}}

For lookahead FLAG, the table chooses `Arg → FLAG Value`. For lookahead `)` after the last argument, Args can use ε. An ε-production removes a pending nonterminal without consuming a token. The empty production is stored as `[]` in the code; the character ε is a display convention.

<!-- pagebreak -->

# 11. Predictive parsing, one complete short example

For `inspect --tag "sample data"`, the token stream is WORD FLAG QUOTED $. The parser starts with Script above $. Stack top appears at the left in the app, even though the implementation uses the end of a JavaScript array as the top.

{{SIMPLE_PARSE}}

To expand a production, the code pops its nonterminal, creates child nodes for the derivation tree, and pushes the right-hand side in reverse order. Reverse pushing makes the leftmost grammar symbol the next stack item processed.

To match a terminal, it pops that terminal and advances the token cursor. For acceptance, the input and stack must both reach $. Merely reaching an accepting-looking intermediate configuration is insufficient.

If the input is `inspect --tag`, processing reaches Value with lookahead $. There is no table entry for that pair, so the parser rejects and reports the expected alternatives. It does not invent a value or silently ignore the flag. A lexical error, such as an unterminated quote, stops before this parser stage.

The derivation tree and trace are different views of the same process: the tree records which productions and terminals were used, while the trace records the order of decisions and the changing stack/input. They are generated from the actual parse, not from a prewritten animation.

<!-- pagebreak -->

# 12. The PDA and input mutations

A stack is last-in, first-out memory. A PDA can remember pending opening brackets at arbitrary theoretical nesting depth. The app's delimiter example accepts matched `()`, `[]`, and `{}` combinations, ignoring whitespace.

For `([{}])()`, the stack above the bottom marker changes as follows:

| Character | Operation | Stack, bottom to top |
| --- | --- | --- |
| ( | Push ( | ( |
| [ | Push [ | ( [ |
| { | Push { | ( [ { |
| } | Pop { | ( [ |
| ] | Pop [ | ( |
| ) | Pop ( | empty |
| ( | Push ( | ( |
| ) | Pop ( | empty |

At end-of-input, an empty stack above ⊥ permits acceptance. For `([)]`, the first `)` mismatches the top `[`, so rejection occurs immediately. Equal counts do not establish correct nesting.

This PDA is a dedicated delimiter recogniser. It is not a general CFG-to-PDA converter, an operating-system command interpreter, or an automaton automatically inferred from any grammar you supply. The LL(1) parser also uses a stack, but the two views serve different demonstrations.

The mutations connect the layers. Removing the last closing parenthesis can leave the flag signatures unchanged but invalidate the script. Deleting a value can leave FLAG followed by end-of-input or punctuation. Appending `;` creates a missing statement. A mutation is a controlled edit, not a security attack detector.

In theory, the nested language allows arbitrary depth. In the app, finite input/state/time limits protect responsiveness. Present this as an implementation bound, not as a claim that a real computer has infinite memory.

<!-- pagebreak -->

# 13. Where to find things in the code

Read the engine before attempting to understand the whole interface. All paths below are relative to the `autosec` project folder.

| File | What to look for |
| --- | --- |
| `src/main.tsx` | Mounts React and imports the stylesheet. |
| `src/App.tsx` | Current case, selected screen, requests, result state, mutations, import/export and view composition. |
| `src/components.tsx` | Reusable panels/tables, playback controls, Dagre layout, SVG graph rendering and downloads. |
| `src/engine/automata.ts` | `parseRegex`, `thompson`, `epsilonClosure`, `determinize`, `minimize`, `compile`, simulation, comparison and matching. |
| `src/engine/grammar.ts` | Fixed grammar, lexer, FIRST/FOLLOW/table computation, predictive parser and delimiter PDA. |
| `src/engine/analysis.ts` | Default signatures/examples, `analyse`, mutations, limited URL panel and case validation. |
| `src/worker.ts` | Receives analyse/compile/compare requests and posts results or errors. |
| `src/styles.css` | Visual layout, responsive rules, scroll containers and print stylesheet. |
| `tests/engine.test.ts` | Algorithm and integration assertions. |
| `tests/app.test.tsx` | React interactions under jsdom with substituted worker/storage. |
| `scripts/runtime-proof.mjs` | Runs the actual production worker asset under Node. |
| `vite.config.ts` | React plugin and GitHub Pages base path. |
| `.github/workflows/deploy.yml` | Clean install, test, build, worker proof and deployment. |

**Reading order:** start at `analyse()`; follow `compile()` into automata; follow tokenisation into `parseTokens()`; inspect `compareDfa()`; then read the request handler in App and the worker transport. Finally inspect the visual components.

The larger App component is a maintainability compromise for this prototype. Separating each screen into its own component would help future development, but doing so is not necessary to explain the current algorithms. The pure engine separation is the more important boundary for understanding and testing this project.

<!-- pagebreak -->

# 14. Read the key code, not just the filenames

This is the actual `compile()` function:

{{COMPILE_CODE}}

`thompson()` produces the NFA. `determinize()` returns both the DFA and construction steps. `minimize()` returns the smaller DFA and refinement partitions. The final object contains the real machines plus the information needed to explain them. The interface does not construct a separate fake graph for presentation.

**Types describe the contract.** NFA has a state count, start, accepting states, labelled edges, and alphabet. A null edge symbol means ε. DFA stores a transition table `delta[state][symbol]` and a `members` array. Compilation bundles the related machines and traces. RunStep records a consumed-input index, last symbol, active state IDs and whether that prefix is accepting.

**Collections have a reason.** A Set removes duplicate states. A Map connects a stable subset key to a DFA state ID. Arrays act as queues, stacks and ordered traces. A canonical sorted state-set key prevents the same subset from being created twice under different orderings.

**Useful TypeScript syntax:** `const` keeps a variable binding fixed; it does not make the contents of an object immutable. `??` supplies a default only when a value is null/undefined. `?.` safely reads an optional value. A type assertion such as `as` does not validate an imported file at runtime; this is why `parseCaseFile()` explicitly checks JSON structure, sizes and patterns.

During the viva, explain the data passing between functions and why the intermediate objects exist. Reciting syntax without connecting it to the automata is less useful.

<!-- pagebreak -->

# 15. Frontend state, workers and portable cases

In `App.tsx`, `c` is the current case. `analysis`, `compiled` and `compared` store completed results. `machineStep`, `compareStep` and `parseStep` choose which recorded action to display. Playback changes these indices; it does not rerun an algorithm from scratch for every animation frame.

`execute()` terminates any old worker, creates a new one, assigns a request ID, sends a task and installs a timeout. The worker calls the pure engine and posts a serialisable result. A returned ID must match the current request before the UI accepts the result.

```text
App state → postMessage({id, task, data})
          → worker chooses analyse / compile / compare
          → pure engine computes serialisable result
          → postMessage({id, task, result})
          → React state update → visible explanation
```

**A worker is not a backend.** It runs in the visitor's browser, on another thread. Node's worker_threads proof harness is a development/CI check of the built asset; the published web app does not need a Node server.

Case files contain schemaVersion 1, engineVersion, export time, a case and an optional analysis result. The case contains name, input, selected rules, matching mode and comparison rules. Imports validate these inputs and rerun analysis instead of trusting a saved acceptance label.

One implementation caveat: case validation currently compiles imported/saved patterns on the UI thread. Main analysis and comparison run in workers, but a future hardening step could move this validation there too. Do not claim every computation in the program is off the main thread.

localStorage is specific to the browser and origin. A case saved on the public site is not automatically available on localhost or another laptop. Export JSON to move it. Saving an existing name replaces that entry, and the library retains at most 30 cases.

The browser review confirmed saving across reload, JSON download/reimport with recomputation, and SVG download. A source-code size limit or an incomplete-result label is a protection against resource exhaustion, not a proof that the input is invalid in its mathematical language.

<!-- pagebreak -->

# 16. Testing evidence and the remaining mark risks

| Evidence | What it supports | What it does not prove |
| --- | --- | --- |
| 83 engine tests | Expected recognition, transformations, grammar behaviour and selected edge cases. | Correctness for every imaginable input. |
| Seven DOM tests | State changes, buttons, import/export callbacks, keyboard activation and cancellation in jsdom. | Actual browser rendering, file dialogs or native printing. |
| Exhaustive short strings | For eight independent languages, all 127 strings over {a,b} through length six agree with NFA/DFA/minimal DFA. | All strings of unbounded length by itself. |
| Exact DFA comparisons | Product search checks language equivalence for the tested machines. | A claim about unrelated production regex extensions. |
| Built-worker harness | The actual bundled worker computes expected results under Node transport. | Browser rendering by itself. |
| Real browser review, 23 Oct | Main workflows, witness replay, parsing/PDA, storage, JSON/SVG download, and sampled desktop/mobile layouts. | Exhaustive browser/accessibility coverage or verified printed PDF output. |

The current browser review found and corrected a CSS selector typo: `.compare-machines > .div` matched a class name instead of the actual child divs. Changing it to `.compare-machines > div` applied `min-width: 0`, keeping wide SVG graphs inside their own scrolling panels. The published narrow-layout check now fits the viewport.

**Highest-priority remaining actions:** obtain the actual rubric; test the app on the presentation laptop; check browser printing if you plan to demonstrate it; and practise the explanation without this document. A related-work comparison, task allocation page, specific cover wording or certificate should be added only if required by the faculty's format.

Do not claim a phishing-detection accuracy percentage, a new algorithm, AI functionality, support for a full shell, or a proof from a few screenshots. The correct contribution is the integrated experiment with explainable, checkable formal-language results.

<!-- pagebreak -->

# 17. The five-minute demonstration and viva answers

| Time | Demonstration | Say this |
| --- | --- | --- |
| 0:00-0:45 | Analyse the nested example. | Patterns and complete structure answer different questions. |
| 0:45-1:15 | Remove a closing parenthesis, then restore it. | The signature remains; the grammar rejects an incomplete group. |
| 1:15-2:20 | Compare the default flag rules and replay `--a`. | BFS finds a shortest input accepted by exactly one DFA. |
| 2:20-2:50 | Compare `a+` and `aa*`. | Exploring every reachable product pair establishes equivalence. |
| 2:50-3:20 | Build `ab*`. | The actual counts are 6 NFA, 4 DFA and 3 minimal states. |
| 3:20-4:20 | Inspect grammar sets/trace and choose PDA Mismatched. | One-lookahead parsing and stack order are visible. |
| 4:20-5:00 | Save/export a case. | Inputs and rules are portable, and imports recompute results. |

**What is unique?** The combination of shortest language counterexamples, synchronised replay, and mutations that separate pattern observations from structure. The underlying algorithms are standard.

**Why is the witness shortest?** BFS visits input lengths in increasing order. The first acceptance-disagreeing pair has a shortest path from the start pair.

**Does NFA-to-DFA increase power?** No. It changes representation while preserving the language.

**Why use a PDA?** Unbounded theoretical nesting needs stack memory; a finite set of states cannot remember arbitrary pending depth.

**Why not just native regex?** Editable patterns are compiled into inspectable automata. The internal constructions are part of the course objective.

**What does a matched flag prove?** Only that the chosen textual pattern occurred. It proves neither grammatical validity nor malicious intent.

**What happens on timeout?** The result is incomplete. No equivalence or acceptance claim is manufactured.

Both team members should understand these answers and the code path. Decide your speaking split after practising; do not claim an implementation contribution split that you cannot substantiate.

<!-- pagebreak -->

# 18. Check your understanding and run the project

Try these before reading the answer key.

1. With the default rules, what are the two verdicts for `inspect file`?

2. Why can `inspect "--tag"` match a signature without producing a FLAG token?

3. Is ε-closure({q1}) allowed to contain q1 itself?

4. For `ab*`, why are the NFA sets {1,2,3,4} and {3,4,5} both accepting?

5. Why can two original DFA states share one minimal-DFA state?

6. What is the shortest whole-string witness for `a*` versus `a+`?

7. Why does `([)]` fail even though the opening/closing counts match?

8. Does a cancelled comparison establish equivalence?

**Answer key:** (1) No default signature, valid structure. (2) Matching is over raw characters; the lexer keeps the quoted value as one QUOTED token. (3) Yes: zero ε-steps are permitted. (4) Both contain NFA accepting state 3. (5) No future suffix distinguishes their acceptance. (6) The empty string. (7) The closer mismatches the stack top. (8) No; it is incomplete.

From a terminal inside the `autosec` folder:

```text
npm.cmd ci
npm.cmd run dev
npm.cmd test
npm.cmd run build
node scripts/runtime-proof.mjs
npm.cmd run preview
```

Use Node 24 LTS as in the CI setup. On non-Windows systems, use `npm` in place of `npm.cmd`. There is no secret key or database to configure. Serve the built app over HTTP: opening `dist/index.html` with file:// is not a valid module-worker setup.

If a regex is rejected, inspect its diagnostic and the supported subset. If a group is rejected, inspect the first parser failure and stack. If a graph is wide, zoom or scroll inside its panel. If cases disappear on another device/origin, import an exported JSON file. Keep an export and the local source available for the presentation.

**Your one-sentence explanation:** “AUTOSEC shows why text patterns and nested syntax are different language properties, and explains a change between two regular rules using a shortest counterexample.”
