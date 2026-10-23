# AUTOSEC — Small MOC Demo

By Bhoumik Singh Rajput (25BYB0120) and Vihaan Jinesh Jain (25BYB0130). Faculty: Dr. Dharmendra Singh Rajput, VIT Vellore. BACSE201, 2026–27.

Two short demonstrations:

1. **Check text:** find the flag pattern `--[a-z]+` and independently check whether the command follows the fixed grammar. Three example buttons show valid syntax, a missing value and a missing closing bracket. Tokens, parser actions and the grammar are under **Show steps**.
2. **Compare rules:** enter two regexes and find a shortest whole-string input accepted by just one. The default pair returns `--a`. Equivalent rules return **Same language**. DFA traces are under **Show steps**.

The interface is intentionally plain. No dashboard, graph editor, separate PDA/URL screen, case library, exports or print controls. The standard automata and grammar algorithms still compute the results; inputs are never executed.

Public demo: https://radical11.github.io/autosec-witness-lab/

Source: https://github.com/Radical11/autosec-witness-lab

## Run offline

With Node 24 LTS and dependencies already installed:

```powershell
npm.cmd run build
npm.cmd run preview -- --port 4173
```

Open http://127.0.0.1:4173/. Internet is unnecessary while using the locally served app. A first-time dependency installation needs `npm.cmd ci`; development uses `npm.cmd run dev`. On other systems use `npm`.

## Two-minute demo

- Click **Valid command**: pattern found, syntax valid.
- Click **Missing value**: pattern found, syntax invalid. A matching flag does not prove a complete command.
- Click **Missing bracket**: nested structure fails.
- Open **Compare rules**, click its compare button: `--a` is accepted by A and rejected by B.
- Optional: expand **Show steps** to explain a decision. Try `a+` and `aa*` for equivalence.

## Code

- `src/App.tsx`: two views, worker lifecycle and result display.
- `src/styles.css`: plain responsive layout.
- `src/worker.ts`: dispatches analysis and comparison to the engine.
- `src/engine/analysis.ts`: pattern matching plus lexical/syntactic analysis. Some full-lab helper functions remain as engine utilities; they are not demo controls.
- `src/engine/automata.ts`: regex parsing, Thompson NFA, closure, determinisation, minimisation, simulation and product-DFA BFS.
- `src/engine/grammar.ts`: lexer, computed FIRST/FOLLOW and LL(1) table, predictive parser. The standalone delimiter-PDA helper remains engine-only.

The reduced UI uses whole-string comparison and one fixed flag signature. It does not expose every engine capability. The grammar supports nested commands, semicolon separators, lowercase flags requiring values, and quoted values. Formal limits remain: ASCII text, 128 regex characters, 2,048 input characters, 256 NFA states, 512 DFA states, 12 seconds per worker request. Cancellation/limits mean **incomplete**, never equivalence.

## Verify

```powershell
npm.cmd test
npm.cmd run build
node scripts/runtime-proof.mjs
```

The suite contains 83 engine and seven current-demo DOM tests. Current browser scope is recorded in `docs/VERIFICATION.md`. The earlier full interface is preserved in the Git tag `full-lab-v1`; the current paper/demo describe the simplified version. See `docs/TEAM_EXPLANATION_AND_CODE_GUIDE.md` and `docs/DEMO_AND_VIVA.md`.
