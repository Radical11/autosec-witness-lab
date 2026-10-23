# AUTOSEC — Counterexample-Driven Automata and Syntax Lab

A Models of Computation course project by **Bhoumik Singh Rajput (25BYB0120)** and **Vihaan Jinesh Jain (25BYB0130)**. Guide: **Dr. Dharmendra Singh Rajput**, VIT Vellore. Course: **BACSE201**, academic year 2026–27.

AUTOSEC explains how regular patterns and nested syntax behave, then compares two regular languages with a shortest counterexample. It is an educational text-analysis tool; it does not execute input or classify real threats.

**Public demo:** https://radical11.github.io/autosec-witness-lab/

**Source:** https://github.com/Radical11/autosec-witness-lab

GitHub Pages hosts the demo after the registered Sites project became inaccessible to the connector. Its original identity is preserved in `.openai/hosting.json`; no duplicate Site was created.

## Run locally

Use Node 22.12+ or Node 24 LTS, then:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the Local URL printed by Vite. Windows users should use `npm.cmd` if the PowerShell npm shim fails. On other systems, `npm` is sufficient. There is no backend, API key, login, or database.

```powershell
npm.cmd test
npm.cmd run build
node scripts/runtime-proof.mjs
npm.cmd run preview
```

`dist/` is the production static build. Serve it over HTTP; opening `index.html` through `file://` will not load module workers. For a GitHub Pages build use `npm.cmd run build -- --mode github-pages`.

## A five-minute demonstration

1. **Analyse:** Load “Nested inspection”. Both layers accept their respective conditions. Remove a closing bracket: the flag signatures still match, but the grammar rejects the script.
2. **Automata Lab:** Compare `--[a-z]+` and `--[a-z][a-z]+` in Whole string mode. The shortest witness is `--a`. Replay both minimal DFAs to show the acceptance disagreement.
3. Compare `a+` and `aa*`: reachable product-state exploration proves equivalence. Compare `a*` and `a+`: the shortest witness is the empty string ε.
4. **Grammar & Stack:** Inspect computed FIRST/FOLLOW, the LL(1) table, parser stack and derivation tree. In the separate PDA demo, compare `([{}])()` with `([)]`.
5. **Evidence:** Save a case locally, export JSON, and import it. Inputs and rules are validated and results recomputed. Use Print to save a concise analysis PDF; export automata as SVG.

## What is implemented

- Recursive-descent regex parser → Thompson ε-NFA → ε-closure → reachable subset construction → Hopcroft partition refinement.
- Exact regular-language comparison using BFS over the product DFA's symmetric difference; missing transitions use a common implicit rejecting sink. Parent pointers reconstruct the witness.
- Whole-string and substring semantics. Substring mode wraps each regex with ASCII-prefix/suffix loops. Signature analysis independently reports non-overlapping leftmost-longest raw-text matches and half-open offsets.
- Lexer with source offsets; fixed-point FIRST/FOLLOW; generated conflict-checked LL(1) table; table-driven predictive parser with derivation nodes and complete trace.
- Delimiter PDA, nested-script mutations, versioned JSON interchange, browser-local cases, SVG diagrams and print reporting.
- Computation in disposable Web Workers, cancellation, explicit resource limits, and incomplete outcomes.

## Defined language and limits

```text
Script    → Statement Rest
Rest      → ; Statement Rest | ε
Statement → WORD Args | ( Script )
Args      → Arg Args | ε
Arg       → FLAG Value | Value
Value     → WORD | QUOTED
```

`WORD` matches `[A-Za-z0-9_./:][A-Za-z0-9_./:\-]*`; `FLAG` matches `--[a-z]+`; quoted values allow `\"` and `\\`. Values need whitespace separation; punctuation delimits itself. Flags always require values. Empty scripts/groups and trailing separators are rejected.

Regexes support ASCII literals, escapes, ranges/classes, grouping, alternation, concatenation, `*`, `+`, `?`, and explicit `ε`. Wildcard `.`, anchors, shorthand classes, backreferences, lookarounds, counted repetitions, negated classes and empty alternatives/groups are rejected. Escape metacharacters to use them literally.

The alphabet has 98 symbols: 95 printable ASCII characters, plus tab, newline and carriage return. Limits: 128 regex characters; 2,048 input characters; 256 NFA states; 512 DFA states; 12 seconds per worker operation. Diagrams render up to 80 states; full machine data remains available in tables. Expensive computations can return **incomplete**, never a false proof. The non-nested command subset can be regular; nested grouping is the meaningful context-free feature.

The URL panel is a separate, restricted HTTP(S) component example, not RFC 3986 conformance validation. The browser URL parser may normalise components. No entered URL is fetched. Optional Google Fonts may load when online; fallback system fonts preserve local use.

## Source map and reproducibility

- `src/engine/`: pure formal-language algorithms and serializable types; no React or network access.
- `src/worker.ts`: computation transport and error classification.
- `src/App.tsx`, `src/components.tsx`: interactive views, state, playback, diagrams and evidence actions.
- `tests/engine.test.ts`: 83 algorithm/integration cases, including exhaustive short-string recognition against independent predicates.
- `tests/app.test.tsx`: seven jsdom interaction cases. Worker transport and storage are substituted in these tests.
- `scripts/runtime-proof.mjs`: executes the actual built worker bundle using Node worker_threads. Tests message serialization and computed outputs, not browser rendering.

Versioned case JSON uses `schemaVersion: 1`, `engineVersion`, `exportedAt`, `case`, and an optional current `result`. `case` contains `name`, `input`, `rules`, `mode`, `left`, `right`. Unknown schema versions and malformed rules are rejected. Imports ignore saved result claims and rerun the engine. Browser storage retains up to 30 named cases; saving the same name replaces that entry.

## Verification boundary

Automated algorithm and DOM tests and the production build pass. The actual production worker bundle has been executed successfully. On 23 October 2026, real-browser checks verified the main flows, persistence, JSON/SVG downloads, and selected desktop/mobile layouts. A comparison-graph overflow issue was fixed and rechecked on the deployed mobile view. Genuine screenshots are supplied. **Native browser print output, browser cancellation/timeout, and exhaustive cross-browser/accessibility coverage remain unverified.** DOM tests are documented separately. See `docs/VERIFICATION.md` for the full evidence boundary.

For a beginner-friendly explanation of the app, algorithms, tech stack and source, read `docs/TEAM_EXPLANATION_AND_CODE_GUIDE.md` and the accompanying PDF in the submission package.

## Contribution and attribution

The original contribution is the integrated counterexample, input-mutation, and multi-model explanation workflow; the automata/parsing algorithms are standard. The project develops the supplied AUTOSEC Review 1 proposal. The classmate report was consulted only as a presentation reference; its text, benchmarks, collaboration feature, and AI feature were not copied.

Theory references: Thompson (1968), Hopcroft (1971), and Hopcroft/Motwani/Ullman, _Introduction to Automata Theory, Languages, and Computation_, 3rd edition. Implementation background: [Russ Cox, Regular Expression Matching Can Be Simple And Fast](https://swtch.com/~rsc/regexp/regexp1.html). URL vocabulary: [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986).
