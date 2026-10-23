"""Package source, local production assets, PDFs, examples and verification evidence.
Run from autosec/: python scripts/package-submission.py
"""
from pathlib import Path
import json, hashlib, subprocess, zipfile
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'output'
OUT.mkdir(exist_ok=True)
evidence=OUT/'evidence'
proof=json.loads((evidence/'runtime-proof.json').read_text(encoding='utf-8'))
tests=json.loads((evidence/'tests.json').read_text(encoding='utf-8'))
deployment=json.loads((evidence/'deployment.json').read_text(encoding='utf-8'))
examples=OUT/'examples';examples.mkdir(exist_ok=True)
data={'name':'Nested inspection','input':proof['analysis']['input'],'rules':[{'name':s['name'],'pattern':s['pattern']} for s in proof['analysis']['signatures']],'mode':'whole','left':'--[a-z]+','right':'--[a-z][a-z]+'}
for slug,result in [('nested-inspection',proof['analysis'])]+[(f['name'],f['result']) for f in proof['fixtures']]:
    c={**data,'name':slug.replace('-',' ').title(),'input':result['input']}
    (examples/(slug+'.json')).write_text(json.dumps({'schemaVersion':1,'engineVersion':'1.0.0','case':c,'result':result},indent=2),encoding='utf-8')
info={'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'testsPassed':tests['numPassedTests'],'deployment':deployment,'browserVisualQA':False,'uiScreenshotsCaptured':False}
(evidence/'submission-info.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
intro='''# AUTOSEC project package

Public demo: https://radical11.github.io/autosec-witness-lab/
Source repository: https://github.com/Radical11/autosec-witness-lab

## Open first

- output/pdf/AUTOSEC_Final_Report.pdf: plain academic final report.
- output/pdf/AUTOSEC_Demo_and_Viva_Guide.pdf: five-minute demo and viva answers.
- autosec/README.md: setup, features, grammar, limits and source map.
- autosec/docs/VERIFICATION.md: exact verification scope and remaining checks.

## Run

Install Node 24 LTS if necessary. On Windows, double-click autosec/START_AUTOSEC.cmd. Alternatively, open a terminal in autosec, run npm.cmd ci, then npm.cmd run dev. No API keys, database or backend are needed.

The prebuilt local production app is in autosec/dist. Serve it over HTTP with npm.cmd run preview after installation. Do not open index.html through file:// because module workers need an HTTP origin. For tests: npm.cmd test. For a clean build: npm.cmd run build.

## Edit / regenerate

The full TypeScript source and lockfile are included. The report's editable Markdown source is in autosec/docs/FINAL_REPORT.md and the measured expanded copy is in output/pdf/AUTOSEC_Final_Report_Source.md. The renderer is autosec/scripts/build-report.py (Python + reportlab + pypdfium2 + pillow). The viva source is autosec/docs/DEMO_AND_VIVA.md. Regenerate tests with npm.cmd run test:evidence, then the worker proof with node scripts/runtime-proof.mjs after a build.

output/examples contains four importable cases. output/evidence contains raw tests, actual production-worker results, deployment/HTTP checks and a source manifest. The ZIP excludes node_modules, .git, tokens, original third-party PDFs and temporary renders.

## Remaining presentation gate

All 90 automated tests and the production build pass. Real-browser visual QA and genuine UI screenshots remain unverified because local browser automation was disabled in Work settings. DOM tests and Node worker proof are documented separately. The PDF contains an actual algorithm-trace diagram, not a fabricated UI screenshot. Complete the manual checklist in the viva guide before presenting if screenshots are required.
'''
(OUT/'START_HERE.md').write_text(intro,encoding='utf-8')
archive=OUT/'AUTOSEC_Submission.zip'
files=[]
for p in sorted(ROOT.rglob('*')):
    if not p.is_file():continue
    rel=p.relative_to(ROOT)
    if any(x in {'.git','node_modules','.sites-runtime','.sites-checkout','__pycache__'} for x in rel.parts) or p.suffix=='.tsbuildinfo':continue
    files.append((p,'AUTOSEC/autosec/'+rel.as_posix()))
for folder in ['pdf','examples','evidence']:
    for p in sorted((OUT/folder).rglob('*')):
        if p.is_file():files.append((p,'AUTOSEC/output/'+p.relative_to(OUT).as_posix()))
files.append((OUT/'START_HERE.md','AUTOSEC/START_HERE.md'))
manifest={name:hashlib.sha256(p.read_bytes()).hexdigest() for p,name in files}
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=8) as z:
    for p,name in files:z.write(p,name)
    z.writestr('AUTOSEC/SHA256_MANIFEST.json',json.dumps(manifest,indent=2))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for name,checksum in manifest.items():assert hashlib.sha256(z.read(name)).hexdigest()==checksum
print(json.dumps({'archive':str(archive),'bytes':archive.stat().st_size,'files':len(files)+1,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'integrityVerified':True}))
