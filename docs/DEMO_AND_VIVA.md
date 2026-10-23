# AUTOSEC: demo and viva guide

**Team:** Bhoumik Singh Rajput (25BYB0120), Vihaan Jinesh Jain (25BYB0130). **Guide:** Dr. Dharmendra Singh Rajput. **Course:** BACSE201, VIT Vellore.

## Opening explanation

“AUTOSEC analyses text from two independent perspectives. Finite automata recognise selected regular patterns, and a predictive parser checks a restricted nested command language. Our distinguishing feature compares two regex languages and generates a shortest counterexample, then replays both machines to explain the disagreement. It is a formal-language learning application, not a production threat detector.”

## Five-minute demo script

| Time      | Action                                                  | What to explain                                                                          |
| --------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 0:00–0:45 | Analyse the default nested inspection example           | Signatures and syntax answer different questions. Commands are never run.                |
| 0:45–1:15 | Remove a closing bracket                                | The flags remain present; the grammar rejects the unclosed group at the end. Restore it. |
| 1:15–2:30 | Run signature demo; replay `--a`                        | A accepts one or more letters; B needs at least two. BFS produces a shortest witness.    |
| 2:30–3:15 | Choose Equivalent forms and compare                     | `a+` and `aa*` have identical languages. All reachable product pairs agree.              |
| 3:15–4:15 | Open Grammar & Stack, reveal LL(1) table and parse tree | FIRST/FOLLOW are computed. The parser selects productions with one lookahead.            |
| 4:15–4:40 | Choose Mismatched in PDA lab                            | `([)]` fails even though counts match; stack order matters.                              |
| 4:40–5:00 | Save and export the case                                | Results are reproducible; imports rerun the algorithms.                                  |

## Questions and answers

**What is new?** The integrated workflow: shortest regular-language counterexamples, synchronised replay, and mutation experiments that distinguish lexical observations from structural acceptance. We do not claim a new minimisation or parsing algorithm.

**Why not use JavaScript's RegExp for the pattern engine?** We implement a defined regular subset and construct visible automata. A boolean library call would not expose closures, subsets, or partition refinement. The lexer uses simple recognisers; it is separate from the editable automata engine.

**How does Thompson construction work?** Build fragments with an entry/exit state. Concatenation connects fragments with ε; alternation branches with ε; repetition adds skip or loop transitions as appropriate.

**What does ε-closure include?** The starting states and all states reachable through zero or more ε-transitions without consuming input.

**What does a determinised state mean?** It represents an ε-closed set of simultaneously active NFA states. We generate only reachable subsets, including the empty-subset sink when needed.

**How does minimisation work?** Remove unreachable states, start with accepting/non-accepting blocks, and refine blocks using transition preimages until stable. Equivalent states then merge. The implementation uses Hopcroft's worklist rule; its straightforward set scanning is not claimed to achieve the textbook optimised asymptotic bound.

**Why is the counterexample shortest?** BFS visits product states by increasing input length. A pair is accepting in the symmetric difference exactly when only one component accepts. Parent pointers reconstruct the first such path. ASCII ordering breaks ties deterministically.

**What if no counterexample is found?** If all reachable product pairs are exhausted and none disagree, the two DFA languages are equivalent. If a limit, cancellation, or timeout interrupts computation, the answer is incomplete, not equivalent.

**What about different alphabets?** Compare over their union. A missing symbol transition moves to an implicit rejecting sink. In substring mode both expressions are wrapped using the same full supported ASCII alphabet.

**What is the empty-string witness?** For `a*` versus `a+`, ε is accepted by the first and rejected by the second; no input symbols are needed to distinguish them.

**Why CFG/PDA instead of only DFA?** Arbitrarily nested groups require unbounded depth tracking in the theoretical language. A stack remembers pending opening delimiters. The simpler flat command subset may be regular; merely describing it with a CFG does not prove otherwise.

**Is the implementation actually unbounded?** No finite application has unlimited resources. The formal grammar allows arbitrary nesting, while this implementation caps input length and computation for responsiveness.

**What are FIRST and FOLLOW?** FIRST(X) contains possible leading terminals of strings derivable from X (and ε if nullable). FOLLOW(X) contains terminals that may immediately follow X in a sentential form; $ marks end-of-input.

**Why LL(1)?** Alternatives in the fixed grammar have disjoint relevant lookahead choices. FIRST and FOLLOW fill the table without conflicts, so a table-driven parser uses one lookahead token.

**Does a matched signature mean malicious input?** No. `inspect "--tag"` contains flag-looking text inside a quoted argument. Pattern presence, token meaning, syntax validity, and real-world intent are different properties.

**How was it tested?** 83 engine cases plus seven jsdom interaction cases; exhaustive strings over `{a,b}` through length six for eight independently specified languages; exact DFA equivalence checks; built-worker execution. On 23 October, real-browser checks verified the main flows, persistence, JSON/SVG downloads and sampled desktop/mobile layouts. Genuine screenshots are supplied. Native print output and browser cancellation remain unverified.

**What are the limits?** ASCII only; restricted regex/command syntax; bounded state counts; no general grammar editor; no real-shell execution; no URL reputation; no ML accuracy claim. Diagrams larger than 80 states use complete tables instead.

## Final presentation checks

The 23 October review checked the main demo, keyboard range replay, save/reload, JSON download/reimport, SVG download and selected desktop/390px layouts, and captured genuine screenshots. It found and fixed a mobile comparison-graph overflow defect. Before presenting, rehearse on the actual presentation laptop, check the faculty rubric, and verify native browser print output and browser cancellation if you will demonstrate them. Broader browser/accessibility coverage is not claimed.
