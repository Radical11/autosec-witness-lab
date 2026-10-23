# Verification record

Updated: 23 October 2026. The machine's timezone is Asia/Kolkata.

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

## Real-browser review on 23 October

Browser access became available. The published app was checked through genuine UI interactions in the Codex in-app browser. Verified flows: initial nested analysis; remove/restore a closing bracket; shortest `--a` witness and acceptance-disagreeing replay; equivalent forms; ε witness; invalid-regex diagnostic; parser replay through acceptance; mismatched PDA rejection; saved-case persistence across reload; JSON download/reimport with recomputation; SVG download; and keyboard End on playback ranges. No console errors were observed during the inspected session.

The review found a mobile CSS selector defect: `.compare-machines > .div` did not apply `min-width: 0` to the actual grid children. Correcting it to `.compare-machines > div` contained wide graphs in their scroll panels. Both the local fix and deployed release were checked at a 390px viewport; document width was 375px, with no page-wide overflow. The sampled desktop view also fit a 1440px viewport. Screenshots are genuine browser captures in `output/screenshots/`, and detailed results are in `output/evidence/browser-review-2026-10-23.json`.

The 90-test suite and production build were rerun successfully. CI for release `fc5d69f` also passed. The dated original Node-worker measurement is preserved separately from these new browser checks.

## Still unverified

Native browser print output, browser cancellation/timeout interaction, exhaustive cross-browser behaviour, and comprehensive assistive-technology testing have not been verified. Cancellation is covered in the DOM tests. The DOM suite substitutes worker/storage and the Node harness is not a browser test; neither is being relabelled as real-browser evidence.

The remaining presentation gate is a rehearsal on the actual presentation laptop and a check against the faculty's actual marking rubric, which has not been supplied. The separate team guide explains the implementation and viva topics.

## Publishing deviation

Sites successfully returned project ID `appgprj_6ada273dc5f08191b14b98e84660ffa1`, which remains in `.openai/hosting.json`. Subsequent get/access/credential calls returned `project_not_found`, and listing the selected account returned no Sites. No duplicate Site was created. GitHub Pages is the fallback public host using the authenticated `Radical11` account. The GitHub source and local package are complete independently of Sites account recovery.
