# AUTOSEC small demo package

Public demo: https://radical11.github.io/autosec-witness-lab/
Source repository: https://github.com/Radical11/autosec-witness-lab

## Open first

- output/pdf/AUTOSEC_Final_Report.pdf: full 12-page report with IEEE-style technical language, methodology, formal definitions, seven figures, nine tables, discussion and 12 references from 2022–2025.
- output/pdf/AUTOSEC_Demo_and_Viva_Guide.pdf: one-page demonstration and viva sheet.
- output/pdf/AUTOSEC_Team_Explanation_and_Code_Guide.pdf: six-page guide to the current app, algorithms and code.
- autosec/README.md: setup, features, grammar, limits and source map.
- autosec/docs/VERIFICATION.md: exact verification scope and remaining checks.

## Run

Install Node 24 LTS if necessary. On Windows, double-click autosec/START_AUTOSEC.cmd. Alternatively, open a terminal in autosec, run npm.cmd ci, then npm.cmd run dev. No API keys, database or backend are needed.

The prebuilt local production app is in autosec/dist. Serve it over HTTP with npm.cmd run preview after installation. Do not open index.html through file:// because module workers need an HTTP origin. For tests: npm.cmd test. For a clean build: npm.cmd run build.

## Edit / regenerate

The full TypeScript source and lockfile are included. The report's editable Markdown source is in autosec/docs/FINAL_REPORT.md and the measured expanded copy is in output/pdf/AUTOSEC_Final_Report_Source.md. The renderer is autosec/scripts/build-report.py (Python + reportlab + pypdfium2 + pillow). The viva source is autosec/docs/DEMO_AND_VIVA.md. Regenerate tests with npm.cmd run test:evidence, then the worker proof with node scripts/runtime-proof.mjs after a build.

The small app has only Check text and Compare rules. Click Valid command, Missing value and Missing bracket, then compare the default rules to obtain --a. Optional steps explain the results. Graphs, exports, saved cases and separate PDA/URL screens are removed.

output/examples contains engine fixtures for reference; the small app has no JSON-import control. output/evidence/tests.json and the dated browser records describe the checks. Other evidence files are dated historical snapshots or engine fixtures. output/screenshots/report-2026-10-24 contains the clean captures used by the report; output/figures contains editable SVG diagrams. The ZIP excludes node_modules, .git, tokens, original third-party PDFs and temporary renders. Git tag full-lab-v1 preserves the earlier interface.

## Remaining presentation gate

All 90 automated tests and the production build passed again on 24 October. In-app-browser captures on 24 October verified the principal examples and narrow layout; the broader Chrome run on 23 October also covered equivalence, invalid patterns and cancellation. No external requests were observed in the 23 October isolated browser run. No console errors or mobile overflow were observed in the sampled layouts. Exhaustive cross-browser/accessibility testing is not claimed. Check the faculty rubric and rehearse on the presentation laptop.
