# AUTOSEC
## Counterexample-Driven Automata and Syntax Lab

Models of Computation (BACSE201) — Final Project Report

Bhoumik Singh Rajput — 25BYB0120

Vihaan Jinesh Jain — 25BYB0130

Guide: Dr. Dharmendra Singh Rajput (SCORE)

Vellore Institute of Technology, Vellore

Academic Year 2026–27 · 22 October 2026

### Abstract

AUTOSEC is an educational browser application that connects pattern recognition and nested syntax analysis to their computational models. A regular-expression engine constructs ε-NFAs, determinises them, and minimises the resulting DFAs. A separate lexer and predictive parser validate a restricted command-like language. The main contribution is a counterexample-driven workflow: two regular languages are compared exactly, a shortest distinguishing string is generated when they differ, and both machines replay that string together. Input mutations make the independence of pattern observations and structural acceptance visible. The implementation includes source offsets, construction traces, FIRST/FOLLOW sets, an LL(1) table, derivation trees, a delimiter PDA, and portable case evidence.

Verification includes {{TEST_COUNT}} passing automated cases and execution of the actual production worker bundle. Real-browser visual QA and UI screenshots remain unverified because browser automation was disabled. The project makes no claim of production cybersecurity accuracy or a new automata algorithm.

<!-- pagebreak -->

## 1. Problem, objectives, and contribution

A textual signature does not determine whether an entire input has a valid structure. For example, both `inspect --tag sample` and `inspect --tag` contain a long flag. The second fails our grammar because every flag needs a value. Conversely, a valid script may contain none of the selected signatures. Treating these observations as one security label loses the explanation.

AUTOSEC addresses this teaching problem through two separate recognition layers and a comparison experiment. The regular layer makes regex construction and deterministic recognition inspectable. The structural layer explains token order and recursive grouping. The comparison feature connects closure properties, product automata, and shortest paths to a concrete question: what is the smallest input on which two rules disagree?

### Objectives

- Implement real regex-to-automata transformations and expose their intermediate data.
- Validate nested command-like scripts with a generated predictive parsing table.
- Produce shortest regular-language counterexamples and synchronised replay.
- Explain changes caused by small input mutations rather than returning an unexplained label.
- Preserve reproducible case inputs, rules, offsets, results, and verification evidence.

### Originality and boundaries

The contribution is the integration of standard algorithms into one experiment: compare rules, obtain a witness, trace both machines, and contrast raw pattern findings with syntax. It develops the supplied AUTOSEC Review 1 proposal. A classmate's general automata-editor report influenced presentation expectations only; its prose, benchmarks, AI assistant, and collaboration product direction were not adopted.

The application never executes commands or fetches entered URLs. It recognises an intentionally restricted language and selected patterns. Acceptance by a recogniser is not a conclusion about malicious intent or safety. Turing machines, shared editing, arbitrary grammar editing, real-shell semantics, threat intelligence, and machine-learning classification are outside this version.

## 2. System architecture

The React/TypeScript interface runs entirely in the browser. Pure engine modules expose explicit serialisable structures for automata, tokens, diagnostics, parsing steps and comparison results. A disposable Web Worker performs analysis, compilation or comparison. Cancelling terminates the worker; a 12-second budget also terminates long computations. The interface retains previous results only with a visible stale-result label when inputs change.

```text
Input + selected signatures
  ├─ Regex parser → Thompson ε-NFA → subsets → DFA → minimisation
  ├─ Lexer → tokens + offsets → FIRST/FOLLOW → LL(1) parser + tree
  └─ Mutation → rerun both observations → before/after comparison

Rule A + Rule B → product DFA BFS → equivalence OR shortest witness
                                       └─ synchronised replay
```

<!-- pagebreak -->

## 3. Regular-language engine

A DFA is M = (Q, Σ, δ, q0, F), with a finite state set Q, alphabet Σ, start q0, accepting set F, and deterministic transition function δ. An ε-NFA permits multiple destinations and transitions that consume no input. These models recognise the regular languages [1, 3].

### Regex syntax and Thompson construction

A recursive-descent parser implements alternation, concatenation and repetition precedence. Supported forms are ASCII literals, escapes, character classes/ranges, grouping, `*`, `+`, `?`, and explicit ε. Unsupported constructs are diagnosed with a source offset. Empty groups and alternatives must use ε explicitly. The engine does not delegate user regex matching to JavaScript's native RegExp.

Thompson construction creates fragments with entry and exit states. Concatenation connects fragments by ε. Alternation creates branching ε-edges. Repetition adds skip and/or loop edges. The engine stores every state and edge, allowing NFA simulation and visual inspection. This implements the established construction rather than a new matching algorithm [1, 4].

### Closure, determinisation and minimisation

For a set S, ε-closure(S) includes S and all states reachable through zero or more ε-edges. Determinisation starts with ε-closure({q0}); for each symbol it computes move followed by closure. Only reachable subsets are generated. The empty subset, when reached, is a rejecting sink. Each construction step records its source, symbol, move set, closure, and destination.

Minimisation first removes unreachable states, separates accepting and non-accepting blocks, and refines partitions using a Hopcroft-style worklist [2]. The result preserves the recognised language. The implementation uses straightforward set scans; this report does not claim the optimised O(|Σ| n log n) bound for its data structures.

### Matching semantics

Whole-string recognition consumes the complete input. Substring comparison wraps each rule with prefix and suffix loops over the same 98-symbol ASCII domain. Signature analysis separately reports non-overlapping leftmost-longest matches in raw text, using half-open intervals [start, end). A zero-length match advances the search position to guarantee termination.

| Demo rule | ε-NFA states | DFA states | Minimal DFA states |
| --- | --- | --- | --- |
| `--[a-z]+` | {{LEFT_NFA}} | {{LEFT_DFA}} | {{LEFT_MIN}} |
| `--[a-z][a-z]+` | {{RIGHT_NFA}} | {{RIGHT_DFA}} | {{RIGHT_MIN}} |

These values are read from the production worker output. Neither example reduces during minimisation; state reduction is demonstrated and verified using other machines, including a redundant DFA test.

<!-- pagebreak -->

## 4. Exact comparison and shortest witnesses

To compare two DFAs, AUTOSEC explores their product from (q0A, q0B). The comparison alphabet is the union of the two alphabets. Missing transitions enter an implicit rejecting sink. A product state distinguishes the languages exactly when one component is accepting and the other is not: it belongs to the symmetric difference [3].

Breadth-first search visits paths in increasing input length. The first acceptance disagreement therefore yields a shortest distinguishing string. Parent pointers and input symbols reconstruct that string. Symbols are ordered by ASCII code for deterministic tie-breaking. If every reachable pair agrees, the languages are equivalent. Cancellation, state limits, or timeout return incomplete and do not establish equivalence.

### Measured signature comparison

Rule A: `--[a-z]+` accepts at least one lowercase letter after two hyphens. Rule B: `--[a-z][a-z]+` requires at least two. The production worker returned witness `{{WITNESS}}`, with {{PAIRS}} product-state pairs examined. Rule A accepts it and Rule B rejects it.

{{WITNESS_TABLE}}

{{WITNESS_FIGURE}}

Figure 1. Actual worker trace along the shortest witness. Each circle is a reported minimal-DFA state; a double circle marks an accepting state. This is a generated algorithm diagram, not an application screenshot. Non-witness transitions are omitted from this path figure; complete transitions remain in the evidence JSON and app tables.

The comparison `a+` versus `aa*` returned equivalent. The engine tests also verify `a*` versus `a+`, whose shortest witness is ε. Testing all shorter strings for selected pairs independently checks the minimal-length claim.

<!-- pagebreak -->

## 5. Lexer, grammar, and predictive parser

The command language is deliberately small and is not a shell. Tokens retain exact text and zero-based source offsets. WORD matches an ASCII letter, digit, underscore, dot, slash, or colon followed by these characters or hyphens. FLAG matches `--[a-z]+`. QUOTED allows spaces, escaped quotes and escaped backslashes. Words, flags and quoted values require whitespace separation. Parentheses and semicolons delimit themselves.

```text
Script    → Statement Rest
Rest      → ; Statement Rest | ε
Statement → WORD Args | ( Script )
Args      → Arg Args | ε
Arg       → FLAG Value | Value
Value     → WORD | QUOTED
```

The grammar is fixed, while its FIRST/FOLLOW sets and parsing table are computed from productions. FIRST sets grow to a fixed point; FOLLOW propagates FIRST of suffixes and the enclosing FOLLOW when a suffix is nullable. Table entries use FIRST, with FOLLOW selecting nullable productions. A conflict check rejects ambiguous table cells. The supplied grammar produces no LL(1) conflicts.

{{SETS_TABLE}}

The table-driven parser starts with Script above $. It either expands a nonterminal using the lookahead table or matches a terminal. Each action records the current stack (top at left), remaining input, action and offset. It simultaneously constructs a derivation tree. A missing table entry or mismatching terminal returns the first diagnostic and expected alternatives.

### Real nested-script result

```text
inspect --tag "sample data"; (check file; scan --mode quick)
```

The production worker produced {{TOKENS}} tokens and {{PARSE_ACTIONS}} parsing actions, consuming the full input and accepting it. The long-flag signature matched twice; the separator signature matched twice; the traversal signature did not match. A lexical error prevents grammar parsing rather than attempting to reinterpret a partial token sequence as valid input.

<!-- pagebreak -->

## 6. PDA, mutation, and evidence features

### Stack-based recognition

The dedicated PDA demonstration recognises correctly nested parentheses, square brackets and braces, ignoring whitespace. It uses state qRead, an explicit stack bottom marker, a push on each opener, and a pop only when the closer matches the stack top. End-of-input with only the bottom marker remaining enters qAccept. An unexpected closer, mismatched pair, unsupported character or unclosed opener rejects.

For `([{}])()`, the stack grows and shrinks consistently and ends empty. For `([)]`, the closing parenthesis conflicts with the top `[`, so the machine rejects even though opening and closing counts balance. The app records each transition and permits stepwise replay.

The command grammar's nested groups provide the substantive context-free feature. The flat subset without recursive grouping can be regular. A grammar being context-free does not by itself prove its language is non-regular. The formal language allows arbitrary depth, while the application has finite input and computation limits.

### Mutation experiments

The app can remove a closing parenthesis, delete the value after a flag, or append a separator. Each edit reruns both analysis layers and shows before/after pattern, grammar and token counts. For a nested script, removing its closer may leave all signatures unchanged while causing a structural failure. Edits that lack a target explain that no change was possible.

| Input | Selected pattern present? | Grammar accepted? |
| --- | --- | --- |
| `inspect --tag x` | Yes | Yes |
| `inspect --tag` | Yes | No |
| `inspect file` | No | Yes |
| `(inspect file` | No | No |

All four combinations are verified by automated tests. Pattern observations must therefore not be collapsed into the grammar result. The quoted input `inspect "--tag"` also demonstrates raw pattern presence without a FLAG token.

### Portable evidence

Cases contain name, input, selected signatures, comparison rules and matching mode. Browser storage retains up to 30 named cases. JSON schema v1 adds engine version, export time and current analysis when available. Imports validate the schema and regexes, reject invalid sizes/types, and recompute rather than trusting saved verdicts. Diagrams export as SVG; a print stylesheet produces a case analysis report.

The supplementary URL panel illustrates HTTP(S) components using the browser URL parser after a restricted format check. It does not implement or claim full RFC 3986 conformance [5]. It does not navigate to the supplied text.

<!-- pagebreak -->

## 7. Verification and measured results

{{TEST_COUNT}} automated tests passed in two suites: 83 engine cases and seven DOM integration cases. The recognition tests enumerate all 127 strings over {a,b} through length six for eight independently specified languages, comparing ε-NFA, DFA and minimal-DFA acceptance with the expected predicate. Exact DFA-equivalence checks verify preservation after minimisation.

Other tests cover ε-cycles, nullable patterns, escaped literals, dead/unreachable states, malformed regexes, ASCII/input/state limits, differing alphabets, substring semantics, shortest witnesses, parser failures, nested groups, escaped quotes, PDA mismatches, the four independent verdict combinations, mutations, and case import/export validation.

| Check | Observed result | Interpretation |
| --- | --- | --- |
| Engine suite | 83 passing tests | Algorithms and integration inputs checked |
| DOM suite | 7 passing tests | React interaction/state flows checked in jsdom |
| Production build | TypeScript + Vite successful | Static production bundle generated |
| Built-worker harness | Passed; {{RUNTIME_MS}} ms | Actual worker asset computed expected results under Node transport |
| Signature comparison | `--a`; A accepts, B rejects | Expected shortest-witness outcome |
| Equivalent rules | `a+` and `aa*` equivalent | Product-state exhaustion agrees |
| Dependency audit | Zero known vulnerabilities at final local audit | Registry audit snapshot, not a complete security audit |

The worker harness runs the unmodified production Web Worker bundle with a Node worker_threads transport shim. It validates serialised requests/results and engine integration, but does not verify browser module-worker loading. Its elapsed time is a single local observation, not a performance benchmark or a browser latency claim.

### Verification limits

Local browser automation returned “Local browser use is disabled in Work settings.” Consequently, real-browser UI interaction, visual layout, narrow-screen overflow, browser storage persistence, actual download/print behaviour and UI screenshots were not verified. The DOM suite substitutes worker transport and storage and cannot establish these browser properties. No generated mock image is presented as a screenshot.

The remaining manual checklist is supplied in the viva guide: inspect desktop and 390px layouts, complete the demo, use keyboard playback, reload saved cases, roundtrip a downloaded JSON file, export SVG, print PDF, test cancellation, and capture genuine screenshots.

### Deployment record

{{DEPLOYMENT_STATUS}}

<!-- pagebreak -->

## 8. Course mapping, limitations, and conclusion

| MOC topic | Implemented role |
| --- | --- |
| Regular expressions | Signature and comparison languages |
| ε-NFA and ε-closure | Thompson fragments and nondeterministic simulation |
| DFA / subset construction | Reachable closed subsets and transition traces |
| Minimisation | Partition refinement with equivalent-state merging |
| Closure / product constructions | Symmetric difference and exact equivalence |
| Lexical analysis | Tokens with precise source offsets |
| CFG / FIRST / FOLLOW / LL(1) | Nested script syntax and predictive decisions |
| Derivations / parse trees | Recorded production expansions and matched terminals |
| Pushdown automata | Nested-delimiter recognition and stack replay |

### Practical limitations

The supported domain is 98 ASCII symbols. Regex length is capped at 128, input length at 2,048, NFA states at 256, and DFA states at 512. Each worker has a 12-second budget. State explosion is possible during subset construction; product exploration can also grow with both machines. Exceeding these limits is incomplete analysis. Graph rendering stops at 80 states for readability while complete transition data remains available.

No real-shell semantics, threat datasets, network monitoring, operating-system access, arbitrary grammar editor, Turing-machine simulator, collaborative editing or AI generation is included. Recognisers and parsers concern the defined languages only. Real-browser QA and genuine screenshots remain outstanding as disclosed above.

### Conclusion

AUTOSEC implements and connects several MOC constructions in a working browser application. Its contribution is an explainable experiment: modify a rule, obtain a shortest counterexample, replay the machines, and contrast regular-pattern observations with nested syntax recognition. The test evidence supports the reported algorithmic outcomes. The project claims an educational integration of established theory, not a new computational model or a production threat detector.

### References

[1] K. Thompson, “Programming Techniques: Regular Expression Search Algorithm,” Communications of the ACM, vol. 11, no. 6, pp. 419–422, 1968. DOI: 10.1145/363347.363387.

[2] J. E. Hopcroft, “An n log n Algorithm for Minimizing States in a Finite Automaton,” The Theory of Machines and Computations, pp. 189–196, 1971.

[3] J. E. Hopcroft, R. Motwani and J. D. Ullman, Introduction to Automata Theory, Languages, and Computation, 3rd ed., Addison-Wesley, 2006.

[4] R. Cox, “Regular Expression Matching Can Be Simple And Fast,” January 2007. https://swtch.com/~rsc/regexp/regexp1.html. Accessed 22 October 2026.

[5] T. Berners-Lee, R. Fielding and L. Masinter, “Uniform Resource Identifier (URI): Generic Syntax,” RFC 3986, January 2005. https://www.rfc-editor.org/rfc/rfc3986. Accessed 22 October 2026.
