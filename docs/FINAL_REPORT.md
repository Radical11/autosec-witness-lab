{{COVER}}

<!-- pagebreak -->

{{ABSTRACT_HEADING}}

AUTOSEC is a browser-based learning environment for examining how regular patterns and nested syntax require different computational models. A user enters a command-like string and receives two independent observations: whether selected textual signatures occur, and whether the token sequence belongs to a restricted command language. The regular-language engine parses expressions, constructs Thompson ε-NFAs, calculates ε-closures, performs subset construction, and minimises the resulting DFAs. The structural engine preserves token offsets, calculates FIRST and FOLLOW sets, builds an LL(1) parsing table, and records a predictive-parsing trace and derivation tree.

The central contribution is a counterexample-driven experiment. Given two regular expressions, AUTOSEC searches their product automaton for a shortest string accepted by exactly one rule. Synchronised replay makes the disagreement visible. Input mutations, including removal of a closing group or a flag value, then demonstrate why signature presence and grammatical validity must be interpreted separately. A dedicated pushdown-automaton view explains delimiter nesting through stack operations.

The implementation uses React and TypeScript, with computational tasks isolated in cancellable Web Workers. Portable case files preserve experiment inputs and rules. Recorded verification comprises {{TEST_COUNT}} passing automated tests, a successful production build, and execution of the actual production worker bundle. Real-browser visual verification and application screenshots were unavailable in the verification environment and are not claimed. AUTOSEC is an educational integration of established formal-language algorithms; it neither executes submitted commands nor claims production threat-detection accuracy.

**Keywords:** finite automata, regular expressions, ε-closure, subset construction, DFA minimisation, context-free grammar, predictive parsing, pushdown automata, shortest counterexample.

<!-- pagebreak -->

{{CONTENTS}}

<!-- pagebreak -->

## 1 Introduction

Finding a pattern in text and recognising the structure of an entire input are different tasks. Consider `inspect --tag sample` and `inspect --tag`. Both contain a long flag, but the second is incomplete when a flag must have a value. A single combined label would conceal which property actually failed. AUTOSEC makes that distinction the starting point of an interactive Models of Computation project.

The project develops the original multi-level AUTOSEC proposal into an explainable experiment. Users inspect signature matches, token boundaries, machine transitions, parser decisions and stack contents. They can also compare two rules and obtain a smallest example of changed behaviour. This connects the theory of recognised languages to an observable result rather than only displaying a final accept/reject label.

The objectives are to implement the standard constructions correctly, expose their intermediate representations, distinguish local patterns from recursive syntax, and preserve enough evidence to reproduce an experiment. The application treats all submitted commands and URLs as text. It does not execute a shell, inspect the operating system, fetch an entered URL, or infer malicious intent from syntax.

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

Whole-string mode requires the complete input to belong to a rule's language. Substring comparison instead allows the rule to occur anywhere, using prefix and suffix loops over the same supported ASCII domain for both machines. Signature analysis reports non-overlapping, leftmost-longest raw-text matches with half-open offsets [start, end). Nullable matches advance the search position so that matching always terminates.

<!-- pagebreak -->

## 3 System architecture

AUTOSEC separates the visual interface, pure algorithmic engine and computation transport. React manages the four workspace views: Analyse, Automata Lab, Grammar & Stack, and Evidence. TypeScript engine modules contain the mathematical data and algorithms without depending on the document interface or network access. The same machine structures support simulation, transition tables and graph rendering.

{{ARCHITECTURE_FIGURE}}

### 3.1 Computation and explanation

The regular layer receives a pattern and returns its NFA, DFA, minimal DFA, closures and construction trace. The structural layer receives tokens and returns calculated grammar sets, a parsing table, parser actions, diagnostics and derivation nodes. The comparison module returns either equivalence or a distinguishing string with the two execution traces.

Analysis, compilation and comparison run in disposable Web Workers. Cancellation terminates the worker, and a 12-second budget bounds each operation. A stopped computation is labelled incomplete. If the user edits an input after obtaining a result, the interface identifies the previous result as stale rather than presenting it as the new answer.

### 3.2 Evidence and local operation

No application backend, database, account or paid API is required. Cases are stored in the browser and can be exported using a versioned JSON format. Imported inputs and patterns are validated, and saved verdicts are recomputed. Automata export as SVG and analysis pages have a print layout. The recorded public deployment uses GitHub Pages; the same source can run locally through Vite.

The URL panel is a supplementary component illustration. It applies a restricted HTTP(S) check and then the browser URL parser to display scheme, host, path, query and fragment. It is separate from the command grammar and does not claim complete RFC 3986 validation [5].

<!-- pagebreak -->

## 4 Structural analysis

### 4.1 Tokenisation and command grammar

The lexer recognises WORD, FLAG, QUOTED, semicolon and parenthesis tokens. WORD begins with an ASCII letter, digit, underscore, dot, slash or colon; later characters may also include hyphens. FLAG is `--[a-z]+`. Double-quoted values support escaped quotes and backslashes. Whitespace separates adjacent values, while parentheses and semicolons delimit themselves. Every token retains its exact text and zero-based source interval.

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

The recorded nested example is:

```text
inspect --tag "sample data";
(check file; scan --mode quick)
```

The line break above is for readability. The actual input has {{TOKENS}} tokens and is accepted after {{PARSE_ACTIONS}} parser actions. Table 3 summarises the initial stack configurations and parsing decisions; the remaining input is shortened for readability.

{{PARSE_TABLE}}

If a lexical error occurs, parsing is not attempted on the partial token stream. Otherwise, a missing table entry or mismatching terminal identifies the first failure and expected alternatives. For `inspect --tag`, the parser reaches end-of-input while expecting Value, so the flag signature can match even though the structure is rejected.

### 4.4 Pushdown-automaton demonstration

The delimiter PDA pushes `(`, `[` or `{` and pops only its matching closer. It accepts at end-of-input when no unmatched opener remains. The sequence `([{}])()` is balanced; `([)]` fails because the first closer conflicts with the stack top. Matching counts alone are insufficient. Arbitrarily nested groups supply the meaningful context-free property; the simpler flat command subset may be regular. The application's finite resource limits do not change this theoretical distinction.

<!-- pagebreak -->

## 5 Counterexample-driven comparison

### 5.1 Product search and equivalence

AUTOSEC compares two DFAs over the union of their alphabets. A missing transition enters an implicit rejecting sink. Starting from the pair of initial states, it explores the product graph. A pair distinguishes the languages when exactly one component accepts, corresponding to the symmetric difference of the languages [3].

Breadth-first search visits input lengths in increasing order. The first disagreement therefore gives a shortest witness, reconstructed through parent pointers. ASCII symbol order gives deterministic tie-breaking. Exhausting all reachable pairs without disagreement establishes equivalence. A timeout, cancellation or exceeded limit instead yields incomplete analysis.

### 5.2 Recorded shortest witness

Rule A, `--[a-z]+`, permits one or more letters after two hyphens. Rule B, `--[a-z][a-z]+`, requires at least two. The production worker returned `{{WITNESS}}`, examining {{PAIRS}} state pairs before finding the disagreement. A accepts the witness; B rejects it.

{{WITNESS_TABLE}}

{{WITNESS_FIGURE}}

The figure is generated from actual worker traces, not an application screenshot; non-witness edges are omitted. Another recorded comparison establishes equivalence of `a+` and `aa*`. Tests also verify the ε witness for `a*` versus `a+`, and independently enumerate shorter strings for selected comparisons to check minimality.

<!-- pagebreak -->

## 6 Implementation and results

### 6.1 Verification method

The recorded verification run on 22 October 2026 passed {{TEST_COUNT}} tests: 83 engine cases and seven DOM integration cases. For eight independently specified languages, tests enumerate all 127 strings over {a,b} through length six. ε-NFA, DFA and minimal-DFA results are compared with the expected predicate. Exact product-DFA checks also verify language preservation after minimisation.

Additional tests cover ε-cycles, escapes, invalid regexes, dead and unreachable states, resource bounds, different alphabets, substring semantics, grammar errors, nested groups, PDA order failures, mutations and case validation. DOM tests exercise interaction and state changes in jsdom, with substituted storage and worker transport.

{{RESULTS_TABLE}}

### 6.2 Production-worker and deployment evidence

The actual built worker asset was executed using Node worker_threads. It accepted the nested script, returned the expected shortest flag witness, and confirmed `a+`/`aa*` equivalence. The measured {{RUNTIME_MS}} ms is a single local harness observation, not a browser-performance benchmark. A clean Linux GitHub Actions workflow independently passed installation, tests, the production build and worker verification before deployment.

The recorded public demo is [AUTOSEC on GitHub Pages](https://radical11.github.io/autosec-witness-lab/). Anonymous HTTP checks returned 200 for its HTML, JavaScript, CSS and worker, with the published worker matching the local asset. Real-browser rendering, browser storage, downloads, print behaviour and screenshots remain unverified because local browser automation was disabled. Neither DOM tests nor Node execution are presented as browser verification.

<!-- pagebreak -->

## 7 Contributions, applications and limitations

### 7.1 Distinctive workflow

The contribution is the integration of shortest counterexamples, synchronised replay and input mutation with two separate recognition layers. It is not a new regex, parsing or minimisation algorithm. A learner can change a rule, obtain the smallest observable difference, and inspect the states that explain it. The structural view then shows why the same text may have a different result under a different language property.

The mutation controls remove a closing parenthesis, delete a flag value, or append a separator. Each edit reruns both layers and compares token counts and verdicts. An unavailable edit explains that no matching target was present. Table 6 gives the four independently tested combinations using the default selected signatures.

{{VERDICT_TABLE}}

### 7.2 Applications

During a course review, the comparison view demonstrates product constructions and shortest paths through a concrete example. In individual study, the closures, subsets and partition traces help locate an incorrect manual step. The grammar view connects lexical categories to predictive choices, while the PDA view makes stack order visible. Exported cases preserve inputs and rules for repeating the explanation later.

### 7.3 Limitations

The supported domain has 98 symbols: printable ASCII plus tab, newline and carriage return. Bounds are 128 regex characters, 2,048 input characters, 256 NFA states and 512 DFA states, with 12 seconds per worker task. Diagrams above 80 states use complete transition tables instead. Large derivation trees use a paginated node table. State explosion can still make a computation incomplete. No arbitrary grammar editor, real-shell execution, threat intelligence, Turing-machine simulator, shared editing or AI-generated automata are included. Syntactic acceptance does not establish security, and genuine browser screenshots remain a presentation item requiring separate verification.

<!-- pagebreak -->

## 8 Conclusion and future work

AUTOSEC turns standard Models of Computation constructions into a connected experiment. Its regular layer exposes the transformation from regex to ε-NFA, DFA and minimal DFA. Its structural layer explains token order and nesting through computed grammar sets, predictive parsing and a stack demonstration. The shortest-counterexample feature joins these ideas with a precise, reproducible difference between two regular languages.

Recorded tests support the reported algorithmic outcomes while the verification boundary remains explicit. The project demonstrates educational integration and explanation rather than a new computational model or production threat detection. Future work can add verified browser screenshots, richer large-machine navigation and additional curated language exercises. A general grammar editor would require explicit handling of conflicts and transformations beyond the current fixed LL(1) grammar.

The source repository, local build, versioned cases and raw test evidence accompany the report. They allow a reviewer to relate a displayed answer to its input, algorithm and recorded result.

## References

[1] K. Thompson, “Programming Techniques: Regular Expression Search Algorithm,” *Communications of the ACM*, vol. 11, no. 6, pp. 419-422, 1968. DOI: 10.1145/363347.363387.

[2] J. E. Hopcroft, “An n log n Algorithm for Minimizing States in a Finite Automaton,” in *The Theory of Machines and Computations*, pp. 189-196, 1971.

[3] J. E. Hopcroft, R. Motwani and J. D. Ullman, *Introduction to Automata Theory, Languages, and Computation*, 3rd ed. Addison-Wesley, 2006.

[4] R. Cox, “Regular Expression Matching Can Be Simple And Fast,” January 2007. [Available online](https://swtch.com/~rsc/regexp/regexp1.html). Accessed 22 October 2026.

[5] T. Berners-Lee, R. Fielding and L. Masinter, “Uniform Resource Identifier (URI): Generic Syntax,” RFC 3986, January 2005. [Available online](https://www.rfc-editor.org/rfc/rfc3986). Accessed 22 October 2026.
