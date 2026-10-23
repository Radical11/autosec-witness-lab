# Verification — simplified demo

Updated 23 October 2026. This record describes the current two-view interface; earlier full-lab evidence is a historical snapshot.

## Passed

- 83 engine tests and seven rewritten DOM tests: 90 total.
- TypeScript and Vite production build.
- Genuine Chrome via Playwright at http://127.0.0.1:4173/, 1280×900 and 390×844. Browser plugin was unavailable in this session.
- Valid nested command; missing flag value; missing closing parenthesis; optional token/parser steps; old results cleared after editing; valid command without a flag.
- Real worker comparison: shortest --a witness, acceptance disagreement, equivalent a+/aa*, empty-string a*/a+ witness and malformed regex diagnostics.
- Real browser cancellation with delayed worker loading, followed by a check that no late acceptance appears.
- No console/page errors observed, no external requests, and no horizontal overflow in the sampled mobile views.
- Keyboard activation/submission is covered in the DOM tests. The exact engine remains independent of the UI and retains exhaustive short-language and exact equivalence checks.

Screenshots: output/screenshots/simple-demo/ (outside the repository). Temporary QA script also stays outside committed source.

## Scope

The UI now exposes two tasks only. Full-lab persistence, JSON/SVG export, graphs, URL illustration, separate PDA animation and printable report controls were removed. Their old UI tests were replaced with tests for the current demo. Engine utilities not exposed by the UI are not advertised as visible features.

The full interface remains recoverable through Git tag full-lab-v1. Existing historical raw evidence is dated; it is not evidence of the current UI. Current release CI and deployment checks are recorded separately when published.

## Remaining limits

Testing samples one browser and two viewport sizes. Comprehensive accessibility, all operating systems and the actual faculty rubric have not been audited. Rehearse on the presentation laptop. Native printing is no longer an app feature.

GitHub Pages remains the fallback public host because the earlier Sites connector project lookup returned project_not_found. No duplicate Site is created.
