# AUTOSEC: two-minute demo and viva

## Demonstration

1. Open Check text and click Valid command. Pattern is Found and Syntax is Valid.

2. Click Missing value. The flag still matches, but syntax is Invalid because every flag needs a value.

3. Click Missing bracket. The parser rejects the unclosed group.

4. Open Compare rules and press its compare button. The shortest example is --a: Rule A accepts; Rule B rejects.

5. If asked why, open Show steps. For equivalence, compare a+ with aa*.

## What to say

“AUTOSEC separates finding a text pattern from checking complete nested syntax. It also compares two regular rules and finds a shortest input that explains their difference.”

## Short answers

**What is the contribution?** A small, explainable demonstration combining independent pattern/syntax results with shortest counterexamples. The algorithms are established.

**What runs underneath?** Regex parser → Thompson ε-NFA → subset DFA → minimal DFA. Pattern searches use the generated DFA. The command lexer makes tokens; a computed LL(1) table drives parsing.

**Why --a?** A allows at least one lowercase letter after --. B requires at least two. No input of length below three distinguishes them.

**Why shortest?** Breadth-first search explores reachable product states in increasing path length and reconstructs the first acceptance disagreement.

**Why nesting?** Arbitrarily nested groups require stack memory in the theoretical language. The implemented grammar recognises this structure; a flat command subset can be regular.

**What is a Web Worker?** Another browser thread for calculation. It is not a backend. Cancelling terminates it, and incomplete work establishes no verdict.

**Does a match mean danger?** No. It only means that the raw-text pattern occurred. The app does not execute commands or detect real threats.

**What did you test?** 90 automated tests, production build and real browser checks of the small demo: valid/broken commands, rule witnesses, equivalence, empty witness, invalid regex, cancellation and desktop/mobile layouts. Comprehensive cross-browser/accessibility coverage is not claimed.

## Run locally

Use npm.cmd run preview -- --port 4173 after building. Open http://127.0.0.1:4173/. Keep the server running. No internet, API key or database is needed during use.
