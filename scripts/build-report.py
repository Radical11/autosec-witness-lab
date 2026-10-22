"""Render editable Markdown report sources using measured engine/CI evidence.
Run from autosec/: python scripts/build-report.py
Requires reportlab, pypdfium2, pillow (available in the supplied Codex runtime).
No browser screenshots are synthesized by this script.
"""
from pathlib import Path
import json, re, math
from html import escape
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Preformatted, Flowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'output'
PDF = OUT / 'pdf'
EVIDENCE = OUT / 'evidence'
PDF.mkdir(parents=True, exist_ok=True)
fonts = Path('C:/Windows/Fonts')
if fonts.exists():
    regular, bold, mono = fonts/'arial.ttf', fonts/'arialbd.ttf', fonts/'consola.ttf'
else:
    regular = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
    bold = regular.with_name('DejaVuSans-Bold.ttf')
    mono = regular.with_name('DejaVuSansMono.ttf')
pdfmetrics.registerFont(TTFont('Body', str(regular)))
pdfmetrics.registerFont(TTFont('BodyBold', str(bold)))
pdfmetrics.registerFont(TTFont('Code', str(mono)))
pdfmetrics.registerFontFamily('Body', normal='Body', bold='BodyBold', italic='Body', boldItalic='BodyBold')
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='MainTitle', fontName='BodyBold', fontSize=29, leading=36, textColor=colors.HexColor('#203b48'), spaceAfter=13))
styles.add(ParagraphStyle(name='ReportSubtitle', fontName='Body', fontSize=17, leading=23, spaceAfter=20, textColor=colors.HexColor('#3c5260')))
styles.add(ParagraphStyle(name='Section', fontName='BodyBold', fontSize=14, leading=19, spaceAfter=13, spaceBefore=4, keepWithNext=True, textColor=colors.HexColor('#203b48')))
styles.add(ParagraphStyle(name='Subsection', fontName='BodyBold', fontSize=10.5, leading=15, spaceBefore=11, spaceAfter=7, keepWithNext=True))
styles.add(ParagraphStyle(name='ReportBody', fontName='Body', fontSize=9.1, leading=13.4, spaceAfter=9))
styles.add(ParagraphStyle(name='TableCell', fontName='Body', fontSize=8, leading=11, spaceAfter=0))
styles.add(ParagraphStyle(name='TableHead', fontName='BodyBold', fontSize=8, leading=11, textColor=colors.HexColor('#203b48')))
styles.add(ParagraphStyle(name='CodeBlock', fontName='Code', fontSize=8, leading=12, backColor=colors.HexColor('#f4f6f7'), borderPadding=9, spaceAfter=13))

def normalise(s):
    return s.replace('—', '-').replace('–', '-').replace('\u2011', '-').replace('\u00a0', ' ')

def inline(s):
    s = escape(normalise(s))
    s = re.sub(r'`([^`]+)`', lambda m: '<font name="Code">'+m.group(1)+'</font>', s)
    s = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', s)
    s = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)', r'<link href="\2" color="#30677a">\1</link>', s)
    return s

class WitnessFigure(Flowable):
    def __init__(self, proof):
        super().__init__(); self.width=480; self.height=160; self.proof=proof
    def draw(self):
        c=self.canv
        for side,row in [('left',110),('right',44)]:
            trace=self.proof['compared']['comparison'][side+'Trace']
            c.setFont('BodyBold',9);c.setFillColor(colors.HexColor('#294b54'));c.drawString(0,row+9,'Rule '+('A' if side=='left' else 'B'))
            xs=[105,204,303,402]
            for i,(x,t) in enumerate(zip(xs,trace)):
                if i:
                    c.setStrokeColor(colors.HexColor('#7e9799'));c.line(xs[i-1]+19,row,x-22,row)
                    p=c.beginPath();p.moveTo(x-22,row);p.lineTo(x-28,row+3);p.lineTo(x-28,row-3);p.close();c.setFillColor(colors.HexColor('#7e9799'));c.drawPath(p,stroke=0,fill=1)
                    c.setFont('Code',10);c.drawCentredString((xs[i-1]+x)/2,row+10,t['symbol'])
                c.setFillColor(colors.HexColor('#e8f0ee') if t['accepting'] else colors.white);c.setStrokeColor(colors.HexColor('#315e63'));c.circle(x,row,18,stroke=1,fill=1)
                if t['accepting']:c.circle(x,row,14,stroke=1,fill=0)
                c.setFont('Code',9);c.setFillColor(colors.HexColor('#294b54'));c.drawCentredString(x,row-3,'q'+str(t['active'][0]))
        c.setFont('Body',8);c.setFillColor(colors.HexColor('#526a70'));c.drawString(0,6,'Input: --a     |     A accepts     |     B rejects     |     3 input symbols')

def table(rows):
    cols=len(rows[0]); widths=([150,330] if cols==2 else [120,180,180] if cols==3 else [160]+[320/(cols-1)]*(cols-1))
    data=[[Paragraph(inline(x),styles['TableHead' if i==0 else 'TableCell']) for x in r] for i,r in enumerate(rows)]
    t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#edf1f3')),('LINEBELOW',(0,0),(-1,0),.7,colors.HexColor('#a7b9c1')),('LINEBELOW',(0,1),(-1,-1),.35,colors.HexColor('#dbe2e5')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
    return t

def render_markdown(source, target, proof=None):
    lines=source.splitlines(); story=[]; i=0
    while i<len(lines):
        line=lines[i].strip()
        if not line: i+=1;continue
        if line=='<!-- pagebreak -->':story.append(PageBreak());i+=1;continue
        if line=='{{WITNESS_FIGURE}}':story.append(WitnessFigure(proof));i+=1;continue
        if line.startswith('```'):
            i+=1;code=[]
            while i<len(lines) and not lines[i].startswith('```'):code.append(normalise(lines[i]));i+=1
            story.append(Preformatted('\n'.join(code),styles['CodeBlock']));i+=1;continue
        if line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].strip().startswith('|'):
                cells=[x.strip() for x in lines[i].strip().strip('|').split('|')]
                if not all(re.match(r'^:?-+:?$',x.replace(' ','')) for x in cells):rows.append(cells)
                i+=1
            # Inline regex alternatives may use |; these report tables avoid them.
            if rows and all(len(r)==len(rows[0]) for r in rows):story.extend([table(rows),Spacer(1,11)])
            else:raise ValueError('Malformed markdown table: '+str(rows))
            continue
        if line.startswith('# '):story.append(Spacer(1,15));story.append(Paragraph(inline(line[2:]),styles['MainTitle']));i+=1;continue
        if line.startswith('## '):story.append(Paragraph(inline(line[3:]),styles['ReportSubtitle' if line.startswith('## Counterexample') else 'Section']));i+=1;continue
        if line.startswith('### '):story.append(Paragraph(inline(line[4:]),styles['Subsection']));i+=1;continue
        if line.startswith('- '):story.append(Paragraph('• '+inline(line[2:]),styles['ReportBody']));i+=1;continue
        paragraph=[line];i+=1
        while i<len(lines) and lines[i].strip() and not lines[i].startswith(('#','|','```','<!--','- ')):
            paragraph.append(lines[i].strip());i+=1
        story.append(Paragraph(inline(' '.join(paragraph)),styles['ReportBody']))
    def footer(c,doc):
        c.saveState();c.setStrokeColor(colors.HexColor('#c9d4d8'));c.line(55,43,540,43);c.setFont('Body',7);c.setFillColor(colors.HexColor('#75858c'));c.drawString(55,30,'AUTOSEC | BACSE201 | Bhoumik Singh Rajput & Vihaan Jinesh Jain');c.drawRightString(540,30,str(doc.page));c.restoreState()
    doc=SimpleDocTemplate(str(target),pagesize=A4,rightMargin=57,leftMargin=57,topMargin=47,bottomMargin=58,title=target.stem.replace('_',' '),author='Bhoumik Singh Rajput; Vihaan Jinesh Jain')
    doc.build(story,onFirstPage=footer,onLaterPages=footer)

proof=json.loads((EVIDENCE/'runtime-proof.json').read_text(encoding='utf-8'))
tests=json.loads((EVIDENCE/'tests.json').read_text(encoding='utf-8'))
deployment=json.loads((EVIDENCE/'deployment.json').read_text(encoding='utf-8')) if (EVIDENCE/'deployment.json').exists() else {'status':'pending','note':'Publication is being prepared. Check deployment.json for the final state.'}
replacements={'TEST_COUNT':str(tests['numPassedTests']),'WITNESS':proof['compared']['comparison']['witness'],'PAIRS':str(proof['compared']['comparison']['visitedPairs']),'TOKENS':str(len(proof['analysis']['lex']['tokens'])),'PARSE_ACTIONS':str(len(proof['analysis']['parse']['trace'])),'RUNTIME_MS':str(proof['milliseconds'])}
for side in ['left','right']:
    for kind,field in [('NFA','nfa'),('DFA','dfa'),('MIN','minimal')]:replacements[side.upper()+'_'+kind]=str(proof['compared'][side][field]['stateCount'])
cmp=proof['compared']['comparison']
replacements['WITNESS_TABLE']='| Prefix consumed | Rule A state | Rule B state | Acceptance disagreement? |\n| --- | --- | --- | --- |\n'+'\n'.join('| '+('ε' if i==0 else '`'+cmp['witness'][:i]+'`')+' | q'+str(a['active'][0])+' | q'+str(b['active'][0])+' | '+('Yes' if a['accepting']!=b['accepting'] else 'No')+' |' for i,(a,b) in enumerate(zip(cmp['leftTrace'],cmp['rightTrace'])))
g=proof['analysis']['grammar']
replacements['SETS_TABLE']='| Nonterminal | FIRST | FOLLOW |\n| --- | --- | --- |\n'+'\n'.join('| '+n+' | {'+', '.join(g['first'][n])+'} | {'+', '.join(g['follow'][n])+'} |' for n in g['first'])
replacements['DEPLOYMENT_STATUS']=deployment.get('note','')+'\n\n'+('Verified public demo: '+deployment['url'] if deployment.get('status')=='succeeded' else 'Public deployment is not confirmed.')
source=(ROOT/'docs/FINAL_REPORT.md').read_text(encoding='utf-8')
for key,value in replacements.items():source=source.replace('{{'+key+'}}',value)
(PDF/'AUTOSEC_Final_Report_Source.md').write_text(source.replace('{{WITNESS_FIGURE}}','[Generated witness trace figure: see PDF and runtime-proof.json.]'),encoding='utf-8')
render_markdown(source,PDF/'AUTOSEC_Final_Report.pdf',proof)
render_markdown((ROOT/'docs/DEMO_AND_VIVA.md').read_text(encoding='utf-8'),PDF/'AUTOSEC_Demo_and_Viva_Guide.pdf')
renders=OUT/'qa/pdf-pages';renders.mkdir(parents=True,exist_ok=True)
for target in PDF.glob('*.pdf'):
    document=pdfium.PdfDocument(str(target))
    print(target.name,'pages',len(document))
    for page_no,page in enumerate(document):
        image=page.render(scale=1.35).to_pil();image.save(renders/f'{target.stem}-{page_no+1:02}.png')
print('Report sources, PDFs, and rendered verification pages written.')
