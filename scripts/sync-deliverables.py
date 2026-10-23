"""Copy final, reviewed outputs into the repository without temporary QA files."""
from pathlib import Path
import shutil, json, hashlib
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT.parent/'output';DEST=ROOT/'deliverables'
paths=[]
for folder in ['pdf','figures','examples','screenshots/report-2026-10-24','screenshots/simple-demo']:
    for p in sorted((OUT/folder).rglob('*')):
        if p.is_file():paths.append((p,DEST/p.relative_to(OUT)))
evidence=['tests.json','report-fixtures-2026-10-24.json','report-format-check.json','browser-review-2026-10-24.json','simple-demo-browser.json','deployment.json','build-verification-2026-10-24.json','reference-audit-2026-10-24.json','submission-info.json','team-guide-examples.json']
for name in evidence:
    p=OUT/'evidence'/name
    if p.exists():paths.append((p,DEST/'evidence'/name))
for p in sorted((ROOT/'dist').rglob('*')):
    if p.is_file():paths.append((p,DEST/'app'/p.relative_to(ROOT/'dist')))
for name in ['AUTOSEC_Submission.zip','START_HERE.md']:
    p=OUT/name
    if p.exists():paths.append((p,DEST/name))
for source,target in paths:
    target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
manifest={str(p.relative_to(DEST)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(DEST.rglob('*')) if p.is_file() and p.name!='SHA256_MANIFEST.json'}
(DEST/'SHA256_MANIFEST.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps({'copiedFiles':len(paths),'manifestFiles':len(manifest),'directory':str(DEST)}))
