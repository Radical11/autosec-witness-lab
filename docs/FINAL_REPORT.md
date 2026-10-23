{{COVER}}

<!-- pagebreak -->

{{ABSTRACT_HEADING}}

AUTOSEC is a small browser-based demonstration of the difference between finding regular patterns and recognising nested syntax. A user enters a command-like string and receives two independent observations: whether the flag pattern occurs, and whether the token sequence belongs to a restricted command language. The regular-language engine parses expressions, constructs Thompson ε-NFAs, calculates ε-closures, performs subset construction, and minimises DFAs. The structural engine preserves token offsets, calculates FIRST and FOLLOW sets, builds an LL(1) table and records the parser actions.

The central contribution is a counterexample-driven experiment. Given two regular expressions, AUTOSEC searches their product automaton for a shortest string accepted by exactly one rule. Two acceptance results and an optional trace explain the disagreement. Three prepared command examples demonstrate valid nesting, a missing flag value and a missing closing bracket. The presentation deliberately contains only two short views: Check text and Compare rules.

The implementation uses React and TypeScript, with analysis and comparison isolated in cancellable Web Workers. Recorded verification comprises {{TEST_COUNT}} passing automated tests and a successful production build. Real browser checks on 23 October 2026 verified the simplified interface at desktop and mobile sizes, including actual-worker cancellation. Genuine screenshots accompany the evidence. AUTOSEC integrates established formal-language algorithms for education; it does not execute submitted commands or claim production threat-detection accuracy.

**Keywords:** finite automata, regular expressions, ε-closure, subset construction, DFA minimisation, context-free grammar, predictive parsing, pushdown automata, shortest counterexample.

<!-- pagebreak -->

{{CONTENTS}}

<!-- pagebreak -->

## 1 Introduction

Finding a pattern in text and recognising the structure of an entire input are different tasks. Consider `inspect --tag sample` and `inspect --tag`. Both contain a long flag, but the second is incomplete when a flag must have a value. A single combined label would conceal which property actually failed. AUTOSEC makes that distinction the starting point of an interactive Models of Computation project.

The project develops the original AUTOSEC proposal into a focused classroom demonstration. Users can inspect a pattern result, a syntax result, tokens and parser decisions. They can compare two rules and obtain a shortest example of changed behaviour. The interface intentionally omits a dashboard, graph editor, case library and export controls so that the central language properties can be explained in a short presentation.

The objectives are to implement standard constructions correctly, distinguish local patterns from recursive syntax and explain a shortest regular-language disagreement. Optional steps support a viva without crowding the main screen. The application treats submitted text as data. It does not execute a shell, inspect the operating system, fetch an entered URL or infer malicious intent from syntax.

## 2 Theoretical background

### 2.1 Formal definitions

A deterministic finite automaton is a five-tuple [3]:

{{DFA_EQUATION}}

Here Q is a finite set of states; Σ is the input alphabet; δ maps each state and input symbol to one destination; q₀ is the start state; and F is the set of accepting states. A string is accepted when consuming it from q₀ leaves the machine in F.

An ε-NFA permits a set of possible destinations and transitions that consume no input. Its active configuration is therefore a set of states. NFAs and DFAs recognise the same class of regular languages. A context-free grammar specifies productions over terminals and nonterminals, while a pushdown automaton adds a stack for properties such as arbitrarily deep nesting. These distinctions determine the role of each model in AUTOSEC.

<!-- pagebreak -->

### 2.2 Regular-language constructions

The regex parser uses the precedence order alternation, concatenation and repetition, with parentheses overriding that order. The supported subset contains ASCII literals, escaped literals, classes and ranges, grouping, alternation, `*`, `+`, `?`, and explicit ε. Unsupported constructs such as backreferences, lookaround and counted repetition produce a diagnostic instead of silently changing the requested language.

Thompson construction represents each parsed fragment by an entry and exit state [1, 4]. A literal adds a labelled edge. Concatenation connects fragment boundaries by ε. Alternation branches through ε-edges. Repetition adds the appropriate skip and loop transitions. The stored NFA is the machine used for simulation and visualisation.

For a state set S, ε-closure(S) includes S and every state reachable from it through zero or more ε-transitions. Subset construction starts from ε-closure({q₀}). For each symbol, it calculates the move set followed by ε-closure, creating only reachable DFA subsets. An empty subset, when reached, acts as a rejecting sink. The construction trace records these intermediate sets explicitly.

Minimisation first removes unreachable states and then refines accepting and non-accepting partitions using a Hopcroft-style worklist [2]. States that remain indistinguishable merge. AUTOSEC records the refinement partitions and checks language preservation in its tests. Its straightforward set-scanning implementation is not claimed to achieve the optimised textbook asymptotic bound.

{{AUTOMATA_TABLE}}

The measured flag examples above are already minimal after determinisation. Their unchanged counts are legitimate results. A separate test starts with a redundant four-state DFA and verifies a two-state minimal result after removing an unreachable state and merging equivalent states.

### 2.3 Recognition semantics

The comparison interface uses whole-string semantics: the complete input must belong to the rule language. Pattern analysis instead searches for the fixed flag expression within the command. It reports non-overlapping, leftmost-longest raw-text matches using half-open offsets [start, end). The engine also contains substring-comparison support, but this option is not exposed by the small demo. These two tasks must not be confused: a flag can occur inside a longer command even when that command is not itself a flag.

<!-- pagebreak -->

## 3 System architecture

AUTOSEC separates the interface, pure algorithmic engine and computation transport. React manages two views: Check text and Compare rules. TypeScript engine modules contain the mathematical data and algorithms without depending on the document interface or network access. Check text uses one fixed flag signature; Compare rules accepts two supported regexes. The same generated machines produce the actual results and trace data.

{{ARCHITECTURE_FIGURE}}

### 3.1 Computation and explanation

The regular layer receives a pattern and returns an NFA, DFA, minimal DFA and construction data. The structural layer receives tokens and returns calculated grammar sets, a parsing table, actions, diagnostics and derivation nodes. The UI presents only verdicts and optional steps. Comparison returns either equivalence or a distinguishing string with traces of both machines. State labels belong to their own machine and cannot be compared as if they were shared meanings.

Analysis, compilation and comparison run in disposable Web Workers. Cancellation terminates the worker, and a 12-second budget bounds each operation. A stopped computation is labelled incomplete. If the user edits an input after obtaining a result, the interface identifies the previous result as stale rather than presenting it as the new answer.

### 3.2 Simple presentation and local operation

No application backend, database, account or paid API is required. There is no case library, export workflow or print control in the simplified interface. The prebuilt app is served over a local HTTP origin and can be used without internet after installation. GitHub Pages hosts the public version. Opening the build directly through file:// is unsuitable for module workers.

The presentation sequence is deliberately short: check the valid example, choose a broken example, then compare the two flag rules. Each view has one primary action. Technical details remain collapsed under Show steps. System fonts and bundled assets avoid external runtime resources. Simplifying presentation does not replace the automata or parser with hardcoded answers.

<!-- pagebreak -->

## 4 Structural analysis

### 4.1 Tokenisation and command grammar

The lexer recognises WORD, FLAG, QUOTED, semicolon and parenthesis tokens. WORD begins with an ASCII letter, digit, underscore, dot, slash or colon; later characters may also include hyphens. FLAG is `--[a-z]+`. Double-quoted values support escaped quotes and backslashes. Whitespace separates adjacent values, while parentheses and semicolons delimit themselves. Every token retains its text and zero-based interval; the optional steps show the token categories.

```text
Script    → Statement Rest
Rest      → ; Statement Rest | ε
Statement → WORD Args | ( Script )
Args      → Arg Args | ε
Arg       → FLAG Value | Value
Value     → WORD | QUOTED
```

A script contains one or more statements separated by semicolons. A statement is either a command with arguments or a parenthesised script. Every flag requires a value. Empty groups and trailing separators are rejected. This is an intentionally restricted language rather than a complete operating-system shell.

### 4.2 FIRST, FOLLOW and the LL(1) table

FIRST sets are calculated to a fixed point from the productions. FOLLOW propagates FIRST of each suffix, and the enclosing FOLLOW when that suffix is nullable. The parser table uses FIRST for ordinary choices and FOLLOW for ε-productions. Duplicate assignments to a table cell are treated as conflicts. The implemented grammar produces no LL(1) conflicts.

{{SETS_TABLE}}

For example, lookahead FLAG selects `Arg → FLAG Value`, while lookahead QUOTED selects a value. A closing parenthesis or end marker can select a nullable tail where permitted by FOLLOW. These are calculated decisions rather than hand-entered parser responses.

<!-- pagebreak -->

### 4.3 Predictive parsing and diagnostics

The parser begins with Script above the end marker $. Stack top is shown at the left. A nonterminal expands using the current lookahead; a terminal must match the next token. Each action records the stack, remaining tokens, source offset and selected production or match. Production expansions also create the derivation tree.

The following engine fixture exercises a longer nested script:

```text
inspect --tag "sample data";
(check file; scan --mode quick)
```

The line break above is for readability. The actual input has {{TOKENS}} tokens and is accepted after {{PARSE_ACTIONS}} parser actions. Table 3 summarises the initial stack configurations and parsing decisions; the remaining input is shortened for readability.

{{PARSE_TABLE}}

If a lexical error occurs, parsing is not attempted on the partial token stream. Otherwise, a missing table entry or mismatching terminal identifies the first failure and expected alternatives. For `inspect --tag`, the parser reaches end-of-input while expecting Value, so the flag signature can match even though the structure is rejected.

### 4.4 Nesting and stack memory

The grammar handles nesting through pending symbols on its predictive-parser stack. Expanding `Statement → ( Script )` leaves a closing parenthesis to match after the inner Script. A missing closer therefore fails even when all flag patterns match. This is the stack-memory connection to PDAs. A separate delimiter-PDA helper remains in the engine and tests, but there is no standalone PDA screen in this small demo. Arbitrarily nested groups provide the meaningful context-free property; the flat subset may be regular.

<!-- pagebreak -->

## 5 Counterexample-driven comparison

### 5.1 Product search and equivalence

AUTOSEC compares two DFAs over the union of their alphabets. A missing transition enters an implicit rejecting sink. Starting from the pair of initial states, it explores the product graph. A pair distinguishes the languages when exactly one component accepts, corresponding to the symmetric difference of the languages [3].

Breadth-first search visits input lengths in increasing order. The first disagreement therefore gives a shortest witness, reconstructed through parent pointers. ASCII symbol order gives deterministic tie-breaking. Exhausting all reachable pairs without disagreement establishes equivalence. A timeout, cancellation or exceeded limit instead yields incomplete analysis.

### 5.2 Recorded shortest witness

Rule A, `--[a-z]+`, permits one or more letters after two hyphens. Rule B, `--[a-z][a-z]+`, requires at least two. The worker returns `{{WITNESS}}`, examining {{PAIRS}} pairs before finding the disagreement. A accepts; B rejects. The UI shows this example first and keeps the state trace inside Show steps. A later letter cannot repair the fact that the shorter input already distinguishes the two languages.

{{WITNESS_TABLE}}

{{WITNESS_FIGURE}}

The figure is generated from actual worker traces; it is an explanatory diagram for the paper, not a graph widget in the small app. Non-witness edges are omitted. A second comparison establishes equivalence of `a+` and `aa*`. Tests also verify the empty witness for `a*` versus `a+`, and enumerate shorter strings for selected comparisons to check minimality.

<!-- pagebreak -->

## 6 Implementation and results

### 6.1 Verification method

On 23 October 2026, {{TEST_COUNT}} tests passed: 83 engine and seven current-demo DOM cases. Eight languages were checked on all 127 strings over {a,b} through length six using NFA, DFA and minimal-DFA recognition. Exact product checks verify language preservation.

{{RESULTS_TABLE}}

### 6.2 Production-worker and deployment evidence

The bundled engine accepted nested syntax, returned `--a` and confirmed `a+`/`aa*` equivalence. The earlier {{RUNTIME_MS}} ms Node-harness observation is a dated local measurement, not a browser benchmark. Current browser checks use the actual worker.

Browser checks verified valid/broken commands, optional steps, witnesses, equivalence and invalid regex diagnostics. Cancellation was checked with delayed worker loading. At 390px there was no overflow. No external requests or console errors were observed. The [public demo](https://radical11.github.io/autosec-witness-lab/) shares the local source.

{{APPLICATION_SCREENSHOT}}

<!-- pagebreak -->

## 7 Contributions, applications and limitations

### 7.1 Distinctive workflow

The contribution is a compact experiment combining independent pattern/syntax results with a shortest regular-language counterexample. It is not a new regex, parsing or minimisation algorithm. A learner can enter a command, see which property holds, then compare two rules and inspect a smallest observable difference. The reduced interface keeps the focus on those questions rather than a large collection of tools.

The three example buttons supply a valid command, a missing flag value and a missing closing parenthesis. They rerun analysis on those inputs; they do not pretend to edit every possible command automatically. Users can also edit the text manually. Table 6 shows the four independent pattern/syntax combinations, verified with the single flag signature used by the demo.

{{VERDICT_TABLE}}

### 7.2 Applications

During a course review, comparison demonstrates product constructions and shortest paths through a concrete example. Check text connects lexical categories to complete nested syntax. Optional tokens, parser actions and state traces support explanation without filling the main screen. For private study, changing the input or either regex provides a repeatable experiment. The small surface is intended for a two-minute demonstration followed by questions.

### 7.3 Limitations

The engine domain has 98 symbols: printable ASCII plus tab, newline and carriage return. Limits are 128 regex characters, 2,048 input characters, 256 NFA states and 512 DFA states, with 12 seconds per worker request. The UI uses whole-string comparison and a fixed flag signature. There is no arbitrary grammar editor, graph viewer, saved-case library, export control, standalone PDA/URL screen, real-shell execution, threat intelligence or AI dependency. Syntactic acceptance does not establish security. Browser checks sample one browser and two sizes rather than exhaustive accessibility coverage.

<!-- pagebreak -->

## 8 Conclusion and future work

AUTOSEC turns standard Models of Computation constructions into two short experiments. Check text separates a regular raw-text pattern from nested command syntax. Compare rules produces either language equivalence or a shortest counterexample. Tokens, parser actions and a paired state trace are available on request. The regex-to-NFA-to-DFA pipeline and computed predictive table remain implemented underneath the deliberately simple interface.

Recorded tests support the reported algorithmic outcomes within explicit limits. The project demonstrates educational integration rather than a new computational model or production threat detection. Regex parsing, ε-transitions, subset construction, minimisation and product search map to finite-automata topics. Tokenisation, FIRST/FOLLOW and predictive parsing map to CFG and stack-memory topics. Future work can broaden browser coverage or add exercises, but those additions are not required by this demo.

The source repository, local build, editable report and raw evidence accompany the submission. The earlier full interface is preserved in Git tag full-lab-v1. The current report describes the reduced demo. A reviewer can relate the displayed verdicts and shortest example to the corresponding engine functions and tests.

## References

[1] K. Thompson, “Programming Techniques: Regular Expression Search Algorithm,” *Communications of the ACM*, vol. 11, no. 6, pp. 419-422, 1968. DOI: 10.1145/363347.363387.

[2] J. E. Hopcroft, “An n log n Algorithm for Minimizing States in a Finite Automaton,” in *The Theory of Machines and Computations*, pp. 189-196, 1971.

[3] J. E. Hopcroft, R. Motwani and J. D. Ullman, *Introduction to Automata Theory, Languages, and Computation*, 3rd ed. Addison-Wesley, 2006.

[4] R. Cox, “Regular Expression Matching Can Be Simple And Fast,” January 2007. [Available online](https://swtch.com/~rsc/regexp/regexp1.html). Accessed 22 October 2026.
