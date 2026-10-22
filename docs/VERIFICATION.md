# Verification record

Date: 22 October 2026. The machine's timezone is Asia/Kolkata.

## Confirmed

- 83 engine tests and seven jsdom interaction tests pass (90 total).
- Eight independent language predicates are checked on all 127 strings over `{a,b}` through length six, against the ε-NFA, DFA, and minimal DFA recognisers.
- Exact product-DFA equivalence checks verify minimisation on these examples and a deliberately redundant DFA.
- Whole-string and substring semantics, ε witnesses, common alphabets, implicit dead states, shortest witness lengths, malformed regexes and resource bounds are checked.
- The grammar computes FIRST/FOLLOW and its LL(1) table from productions. Valid/invalid nested scripts, escapes, source offsets, partial trees, PDA order failures, and all four pattern/grammar result combinations are tested.
- DOM tests exercise examples, mutation/restore, witness replay, equivalence, stale-result labels, invalid regex diagnostics, grammar/stack interaction, case persistence across remount, JSON export callback and import recomputation, cancellation, and keyboard activation.
- TypeScript and Vite production build succeeds. The actual built worker runs through `scripts/runtime-proof.mjs`, including nested-script analysis, shortest `--a` witness and `a+`/`aa*` equivalence.
- Registry dependency audit: zero known vulnerabilities at the final local check.
- GitHub Actions also performs clean `npm ci`, tests, a Pages-mode production build, and built-worker verification on Linux/Node 24 before deploying.

The timestamped raw results are delivered in `output/evidence/tests.json` and `output/evidence/runtime-proof.json` in the workspace. Deployment outcome and HTTP asset checks are separately recorded in `output/evidence/deployment.json`.

## Unverified

Browser automation returned **“Local browser use is disabled in Work settings.”** No alternative automation was used to bypass that setting. Therefore real-browser rendering, 390px overflow behaviour, native storage persistence, actual JSON/SVG download and print behaviour, browser module-worker startup, and genuine UI screenshots remain unverified.

The jsdom tests are not real-browser tests: storage and worker transport are substituted. The worker proof executes the actual production asset under Node, not a browser. Algorithm diagrams in the PDF are generated from actual result data and are explicitly labelled as diagrams, not screenshots.

The manual browser checklist in `docs/DEMO_AND_VIVA.md` remains the final presentation-readiness gate. Screenshot files have intentionally not been fabricated.

## Publishing deviation

Sites successfully returned project ID `appgprj_6ada273dc5f08191b14b98e84660ffa1`, which remains in `.openai/hosting.json`. Subsequent get/access/credential calls returned `project_not_found`, and listing the selected account returned no Sites. No duplicate Site was created. GitHub Pages is the fallback public host using the authenticated `Radical11` account. The GitHub source and local package are complete independently of Sites account recovery.
