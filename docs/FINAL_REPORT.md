{{COVER}}

<!-- pagebreak -->

## Abstract

Pattern occurrence and syntactic validity are distinct properties of an input. AUTOSEC is a browser-local teaching application that evaluates these properties independently and explains differences between regular rules through shortest counterexamples. A TypeScript engine parses supported regular expressions, constructs Thompson ε-nondeterministic finite automata, computes ε-closures, performs subset construction, and minimises the resulting deterministic machines. A second pipeline tokenises a restricted nested command language and performs predictive parsing using calculated FIRST/FOLLOW sets and a single-lookahead parsing table. Breadth-first search over a product automaton returns either language equivalence or a shortest string accepted by exactly one rule. The interface presents two tasks, Check text and Compare rules, with optional execution traces. Eight independently specified languages were evaluated on all 127 binary strings of length at most six. Genuine application screenshots illustrate valid nested syntax, a missing flag value, and the distinguishing string `--a`. The contribution is the integration of independent pattern and syntax verdicts with a reproducible counterexample workflow. The evaluation establishes observed implementation behaviour; educational effectiveness remains a question for a future user study.

**Index Terms:** formal languages, finite automata, regular expressions, predictive parsing, context-free grammar, shortest counterexample, educational software.

### Report organisation

{{CONTENTS}}

### Project scope

- **Course basis:** Regular-language recognition, nested syntax, and language comparison share one command-like example. Reference [1] provides the formal-language and automata background.
- **Interaction:** Users inspect a result, make a small change, and examine why acceptance changes. The application analyses inputs as text.
- **Presentation:** The interface concentrates on two tasks; this report supplies the definitions, diagrams, methodology, evaluation, and limitations.

<!-- pagebreak -->

## I. Introduction and Related Work

### A. Problem statement

The strings `inspect --tag sample` and `inspect --tag` both contain a flag-shaped substring. Their syntax differs because every flag requires a value.

- **Pattern occurrence:** Both strings contain `--tag`, so the regular pattern matches both inputs.
- **Syntactic validity:** Only the first string supplies the required value. The parser rejects the second at end-of-input.
- **Nested structure:** Parenthesised command groups require the parser to retain expected closing delimiters. A local flag match does not establish this structural property.

Recent educational work explains regex-to-automaton transformations [2], nondeterministic rejection [3], and machine/stack behaviour [4]. Recipe-based diagnostics support regex development [5]. Table I compares their documented emphasis with AUTOSEC's design; it is a qualitative comparison rather than a system benchmark.

{{RELATED_TABLE}}

### B. Distinction and objectives

AUTOSEC combines **two independent verdicts on the same command** with **a shortest witness between two explicit rules** in a two-task interface.

- **Design contribution:** Inspect a command, identify a syntax failure, change a rule, and explain the disagreement through computed traces.
- **Established foundations:** The automata library supplies transformations and language operations [6]; AALpy uses counterexamples in model learning [7]. AUTOSEC's contribution concerns integration and presentation.
- **Implementation objectives:** Compute verdicts from explicit machines, preserve token offsets, explain the first syntax failure, and reproduce rule disagreements.
- **Evaluation boundary:** Independent predicates and recorded examples check implementation behaviour. Comparative accuracy, usability, and speed require a separate study.

<!-- pagebreak -->

## II. Formal Definitions and Recognition Semantics

### A. Symbols, languages and finite-state machines

An **alphabet** Σ is a finite set of symbols. A **string** w is a finite sequence over Σ; ε denotes the empty string and |w| its length. A **language** is a set of strings, L ⊆ Σ*.

- **Regular expression:** A language description formed through literals, concatenation, union, and repetition. In the supported syntax, `r*` denotes zero or more repetitions, `r+` one or more, and `r?` zero or one.
- **Deterministic finite automaton (DFA):** M = (Q, Σ, δ, q₀, F), where Q is a finite state set, δ: Q × Σ → Q is the transition function, q₀ ∈ Q is the initial state, and F ⊆ Q is the accepting set. The extended transition δ* consumes a string.
- **ε-nondeterministic finite automaton (ε-NFA):** A machine permitting multiple successor states and transitions that consume no character. Its active configuration is a set of states; ε-closure(S) includes S and every state reachable from S using only ε-transitions.

{{DEFINITION_EQUATIONS}}

### B. Syntax and distinguishing inputs

- **Context-free grammar (CFG):** G = (V, T, P, S), with nonterminals V, terminals T, productions P, and start symbol S.
- **Token:** A lexical category, source text, and interval [start, end), preserving the input location.
- **LL(1) parser:** A predictive parser that reads left to right, constructs a leftmost derivation, and selects a production using one lookahead token and the stack top.
- **Pushdown automaton (PDA):** A finite-control machine with a stack. AUTOSEC demonstrates this memory through pending symbols in its predictive parser.

{{NOTATION_TABLE}}

- **Pattern and syntax:** Pattern search tests substring membership in L(r); syntax tests complete token-sequence membership in L(G).
- **Comparison:** Both regular rules use whole-string membership. A distinguishing string lies in their symmetric difference; a shortest witness minimises length and need not be unique.
- **Quoted input:** Raw matching may find `--tag` inside `inspect "--tag"`, while the lexer treats the quoted text as one value.

<!-- pagebreak -->

## III. Methodology and System Architecture

### A. Design and verification procedure

The methodology evaluates a reproducible input or rule pair through four stages:

1) **Specification:** Define the regular-expression subset, fixed command grammar, token categories, and recognition semantics.
2) **Construction:** Implement explicit automata, calculated grammar sets, predictive decisions, and execution traces.
3) **Integration:** Connect independent pattern and syntax pipelines through a small browser interface.
4) **Verification:** Check independent language predicates, exact product comparisons, malformed inputs, and the running interface. Related educational activity design informs the context [8].

{{ARCHITECTURE_FIGURE}}

### B. Computation protocol

- **Interface:** React manages input and result state; Vite builds the TypeScript application.
- **Dispatch:** Form submission creates a disposable module Web Worker and sends `{id, task, data}`. The dispatcher calls `analyse()` or compiles both rules before `compareDfa()`.
- **Response and lifecycle:** The worker returns serialisable machines, tokens, traces, and diagnostics. Editing clears results; switching views disposes of pending computation. The algorithm engine remains independent of rendering.

{{METHOD_TABLE}}

### C. Resource and operational boundaries

- **Resource limits:** 98 ASCII symbols; 128 regex characters; 2,048 input characters; 256 NFA states; 512 DFA states; and a 12-second request timeout.
- **Incomplete analysis:** Cancellation or resource exhaustion produces **analysis incomplete**, not rejection or equivalence. Unsupported constructs receive diagnostics.
- **Local operation:** Ordinary use requires no external service. Input is not sent to a backend, executed as commands, or used to visit entered URLs.

<!-- pagebreak -->

## IV. Regular-Language Construction

### A. Parsing and Thompson construction

The regular-language pipeline follows these steps:

1) **Parse:** `parseRegex()` constructs an abstract syntax tree using alternation, concatenation, and repetition precedence.
2) **Construct:** `thompson()` builds entry/exit fragments. Literal edges consume symbols; concatenation, alternation, and repetition introduce the required ε-links, branches, and loops.
3) **Check the subset:** Character classes such as `[a-z]` expand into supported symbols. Backreferences, lookarounds, anchors, and counted repetitions are rejected.

{{REGEX_PIPELINE}}

### B. Worked construction for ab*

- **Language:** `ab*` denotes `a` followed by zero or more `b` symbols. Fig. 2 uses the engine's recorded state IDs and edges.
- **Acceptance after a:** ε-closure reaches {1,2,3,4}, including accepting NFA state 3; therefore `a` is accepted.
- **Subset states:** Each reachable closed set becomes a DFA state. The empty subset represents a rejecting sink when reachable, as recorded in Table IV.

{{NFA_FIGURE}}

{{SUBSET_TABLE}}

### C. Minimisation and implementation limits

- **Partition refinement:** Accepting and rejecting states are separated, then blocks with distinguishable transitions are split. DFA states 1 and 3 merge because they have the same future language.
- **Observed construction:** **6 NFA → 4 DFA → 3 minimal-DFA states**. The Hopcroft-style worklist uses straightforward set scans; the optimised textbook running-time bound is not claimed.
- **Coverage:** Extended derivative-based regex research supports constructs outside this demo [9]. This is a scope comparison rather than a component dependency or a claim of full regex compatibility.

<!-- pagebreak -->

## V. Lexical Analysis and Predictive Parsing

### A. Fixed nested command language

- **Tokens:** The lexer recognises WORD, lowercase FLAG, double-quoted QUOTED values, `;`, `(`, and `)`. Quoted values permit escaped quotes and backslashes.
- **Constraints:** Adjacent words, flags, and quoted values require whitespace. Every flag requires a value; token offsets identify the original input span.
- **Failure boundary:** Lexing and parsing remain separate. A lexical failure prevents acceptance of a partial stream.

```text
Script    → Statement Rest
Rest      → ; Statement Rest | ε
Statement → WORD Args | ( Script )
Args      → Arg Args | ε
Arg       → FLAG Value | Value
Value     → WORD | QUOTED
```

### B. Calculated decisions

- **FIRST(A):** Terminals that can begin strings derived from A, including ε when A is nullable.
- **FOLLOW(A):** Terminals that can immediately follow A; `$` marks end-of-input.
- **Table construction:** `grammarInfo()` calculates the sets to a fixed point and detects duplicate table assignments. The grammar has no conflicts; an empty array represents the empty production.

{{GRAMMAR_TABLE}}

### C. Dry run and stack interpretation

1) **Initial state:** For `inspect --tag sample; (scan file)`, the stack begins with Script over `$`. The worker records **8 tokens and 25 parser actions**.
2) **Expansion:** Right-hand sides are pushed in reverse order so the leftmost symbol is processed next. An opening group leaves a closing `)` pending until its inner Script finishes.

{{PARSER_TABLE}}

- **Missing value:** `inspect --tag` leaves Value pending at offset 13 while the pattern still matches. Removing the valid example's final `)` leaves a closing delimiter pending at offset 32.
- **Verification scope:** Diagnostics retain zero-based offsets. POSIX lexing [10] and verified lexer work [11] address stronger proof obligations; this implementation is tested rather than mechanically verified.

<!-- pagebreak -->

## VI. Shortest-Counterexample Method

### A. Product construction

- **State pairs:** For generated DFAs A and B, a product node is (p, q). Each symbol advances both components; an undefined transition enters an implicit rejecting sink.
- **Disagreement condition:** A node distinguishes the languages exactly when one component accepts and the other rejects.
- **Search domain:** The search uses the union of both alphabets and visits each reachable pair once.

{{PRODUCT_EQUATION}}

```text
queue ← [(startA, startB)]
for each pair in queue, in discovery order:
    if acceptingA(pair.left) XOR acceptingB(pair.right):
        return the input reconstructed through parent links
    for each symbol in the shared alphabet:
        enqueue the successor pair if it has not been seen
return equivalent
```

### B. Shortestness argument and observed witness

1) **Shortestness:** Every edge consumes one character. Breadth-first search visits nondecreasing input lengths; the first acceptance-disagreeing node therefore has a shortest path.
2) **Predecessors:** One shortest predecessor per pair suffices because future acceptance depends on the pair, not its earlier path.
3) **Equivalence:** Exhausting the reachable product without disagreement establishes an empty symmetric difference. Interruption produces an incomplete result.

{{PRODUCT_FIGURE}}

{{WITNESS_TABLE}}

- **Observed witness:** A = `--[a-z]+` requires at least one lowercase letter after two hyphens; B = `--[a-z][a-z]+` requires at least two. The witness `--a` is found after **5 processed pairs**. Every shorter string is rejected by both rules; numeric state labels are local to each machine.
- **Complexity and scope:** Product search uses O(kmn) time and O(mn) storage for m and n completed DFA states and alphabet size k, excluding compilation. This exact comparison differs from AALpy's learning/oracle workflow [7].

<!-- pagebreak -->

## VII. Actual Application Screenshots

- **Capture conditions:** The application ran at `http://127.0.0.1:4173/` with an 1100 × 900 desktop viewport. Full captures accompany the repository.
- **Evidence integrity:** Fig. 4 shows valid nested syntax; Fig. 5 isolates the missing-value diagnostic in a directly captured viewport excerpt. Results are unaltered; images are resized only for placement.

{{VALID_SCREENSHOT}}

{{INVALID_SCREENSHOT}}

- **Pattern result:** Both examples contain `--tag`; the regular pattern is found.
- **Syntax result:** Deleting the flag value changes acceptance to rejection. Pattern occurrence and complete-command validity are separate decisions.

<!-- pagebreak -->

## VIII. Evaluation and Observed Results

### A. Verification protocol

1) **Independent predicates:** Eight languages are evaluated on every string over {a,b} of length 0 through 6: 1 + 2 + 4 + 8 + 16 + 32 + 64 = 127 strings per language.
2) **Recognition checks:** Each expected answer is compared with NFA, DFA, and minimal-DFA simulation, producing **3,048 recognition checks** within the parameterised test cases.
3) **Complementary methods:** Exact product comparisons check language preservation; short-string enumeration alone does not prove behaviour for arbitrary strings. Engine and Document Object Model (DOM) interaction tests remain separate.

{{TEST_FIGURE}}

{{RESULTS_TABLE}}

### B. Behavioural cases and evidence provenance

{{CASES_TABLE}}

- **Browser cases:** Valid syntax, a missing value, the default witness and trace, and a missing bracket were reproduced. At 390px, document and viewport widths matched; no console warnings or errors were observed.
- **Additional checks:** A separate real-browser review verified cancellation, equivalence, an empty witness, and invalid-regex diagnostics. DOM cancellation tests also passed.
- **Evidence limits:** Built-worker fixtures check assets and serialisation, not browser timing. Threat-detection accuracy, learning gains, and comparative performance were not measured.

<!-- pagebreak -->

## IX. Discussion, Limitations and Conclusion

### A. Interpretation and contribution

- **Conceptual distinction:** A matching substring can occur in invalid syntax; a shortest witness explains disagreement between regular rules.
- **Role of nesting:** The non-nested command subset can be regular. Unrestricted nesting in the grammar motivates stack memory, while the implementation enforces finite resource bounds.
- **Contribution:** AUTOSEC integrates these observations in a compact workflow alongside the broader libraries [6], [7] and visualisation systems [2]-[4].

{{COMPARE_SCREENSHOT}}

### B. Threats to validity and future evaluation

- **Selected examples:** Prepared demonstrations do not establish general usability. ASCII, token, regex, and state bounds restrict coverage.
- **Verification limits:** Some tests share infrastructure; independent predicates and exact product checks provide complementary evidence. Browser observations cover one browser and two viewport sizes.
- **Accessibility:** Labels and keyboard controls support inspection, but comprehensive Web Content Accessibility Guidelines (WCAG) 2.2 [12] compliance remains unassessed.
- **Future study:** Compare unaided and tool-assisted explanations, measuring witness reasoning, task time, and error rates. Educational activity design [8] and concise diagnostics [5] provide starting points for evaluating understanding.

### C. Conclusion

AUTOSEC integrates automata construction, predictive parsing, and exact product search in a small browser application. Recorded tests, worked traces, and genuine screenshots support the reported behaviour. Its contribution is a reproducible route from an input or rule change to an explicit explanation. Educational effectiveness and comparative performance remain open evaluation questions.

<!-- pagebreak -->

## References

{{REFERENCES}}
