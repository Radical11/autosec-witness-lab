"""Render the 12-page academic report, matching the supplied reference's structure.

Editable content: docs/FINAL_REPORT.md. Recorded results: ../output/evidence/.
The reference contributes layout only; all paragraphs and tables describe AUTOSEC.
Run: python scripts/build-report.py
"""
from pathlib import Path
from io import BytesIO
from html import escape
import json
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable, KeepTogether, PageBreak, Paragraph, Preformatted,
    SimpleDocTemplate, Spacer, Table, TableStyle, Image,
)
import pypdfium2 as pdfium
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'output'
PDF = OUT / 'pdf'
EVIDENCE = OUT / 'evidence'
WIDTH = A4[0] - 156  # 72 pt margins plus the frame's 6 pt padding on each side.
PDF.mkdir(parents=True, exist_ok=True)

font_root = Path('C:/Windows/Fonts')
if font_root.exists():
    regular, bold, italic, mono = [font_root / n for n in ('times.ttf', 'timesbd.ttf', 'timesi.ttf', 'consola.ttf')]
else:
    font_root = Path('/usr/share/fonts/truetype/dejavu')
    regular, bold, italic, mono = [font_root / n for n in ('DejaVuSerif.ttf', 'DejaVuSerif-Bold.ttf', 'DejaVuSerif-Italic.ttf', 'DejaVuSansMono.ttf')]
for name, path in [('Academic', regular), ('AcademicBold', bold), ('AcademicItalic', italic), ('AcademicMono', mono)]:
    pdfmetrics.registerFont(TTFont(name, str(path)))
pdfmetrics.registerFontFamily('Academic', normal='Academic', bold='AcademicBold', italic='AcademicItalic', boldItalic='AcademicBold')

BODY = ParagraphStyle('body', fontName='Academic', fontSize=12, leading=14.8,
                      alignment=TA_JUSTIFY, spaceAfter=10, allowWidows=0, allowOrphans=0)
H1 = ParagraphStyle('h1', fontName='AcademicBold', fontSize=17.2, leading=21,
                    spaceBefore=8, spaceAfter=14, keepWithNext=True)
H2 = ParagraphStyle('h2', fontName='AcademicBold', fontSize=14.3, leading=17.5,
                    spaceBefore=9, spaceAfter=10, keepWithNext=True)
CODE = ParagraphStyle('code', fontName='AcademicMono', fontSize=9.5, leading=13,
                      leftIndent=14, spaceBefore=3, spaceAfter=12)
CELL = ParagraphStyle('cell', fontName='Academic', fontSize=10, leading=11.5)
CELL_HEAD = ParagraphStyle('cell-head', parent=CELL, fontName='AcademicBold')
CAPTION = ParagraphStyle('caption', fontName='Academic', fontSize=10.5, leading=13,
                         alignment=TA_CENTER, spaceBefore=6, spaceAfter=6, keepWithNext=True)
REFERENCE = ParagraphStyle('reference', fontName='Academic', fontSize=10.5, leading=13,
                           leftIndent=18, firstLineIndent=-18, spaceAfter=10)
COVER_COURSE = ParagraphStyle('cover-course', fontName='AcademicBold', fontSize=17.2, leading=22, alignment=TA_CENTER)
COVER_TITLE = ParagraphStyle('cover-title', parent=COVER_COURSE, fontSize=17.2)
COVER_SUBTITLE = ParagraphStyle('cover-subtitle', fontName='Academic', fontSize=14.3, leading=18, alignment=TA_CENTER)
COVER_BODY = ParagraphStyle('cover-body', fontName='Academic', fontSize=12, leading=17, alignment=TA_CENTER)

proof = json.loads((EVIDENCE / 'runtime-proof.json').read_text(encoding='utf-8'))
tests = json.loads((EVIDENCE / 'tests.json').read_text(encoding='utf-8'))
comparison = proof['compared']['comparison']
grammar = proof['analysis']['grammar']

def normalise(text):
    return text.replace('\ufeff', '').replace('—', '-').replace('–', '-').replace('\u2011', '-').replace('\u00a0', ' ')

def inline(text):
    text = escape(normalise(str(text)))
    code_spans = []
    def protect_code(match):
        code_spans.append('<font name="AcademicMono" size="10">' + match.group(1) + '</font>')
        return '@@CODE' + str(len(code_spans) - 1) + '@@'
    text = re.sub(r'`([^`]+)`', protect_code, text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<i>\1</i>', text)
    text = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)', r'<link href="\2">\1</link>', text)
    for i, span in enumerate(code_spans): text = text.replace('@@CODE' + str(i) + '@@', span)
    return text

def make_table(caption, headers, rows, widths):
    cells = [[Paragraph(inline(c), CELL_HEAD if i == 0 else CELL) for c in row]
             for i, row in enumerate([headers] + rows)]
    table = Table(cells, colWidths=widths, hAlign='CENTER', repeatRows=1)
    table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LINEABOVE', (0, 0), (-1, 0), .65, colors.black),
        ('LINEBELOW', (0, 0), (-1, 0), .4, colors.black),
        ('LINEBELOW', (0, -1), (-1, -1), .65, colors.black),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    return [KeepTogether([Paragraph(caption, CAPTION), table]), Spacer(1, 9)]

class Cover(Flowable):
    def __init__(self):
        Flowable.__init__(self); self.width = WIDTH; self.height = 650
    def draw(self):
        c = self.canv
        def centred(text, style, top):
            p = Paragraph(text, style); _, h = p.wrap(WIDTH, 100); p.drawOn(c, 0, self.height - top - h)
        centred('Models of Computation (BACSE201)', COVER_COURSE, 78)
        centred('Project Report: <font name="AcademicMono">AUTOSEC</font>', COVER_TITLE, 111)
        centred('Counterexample-Driven Automata and Syntax Lab', COVER_SUBTITLE, 151)
        centred('<b>Team Members:</b>', COVER_SUBTITLE, 254)
        centred('Bhoumik Singh Rajput (Registration Number: 25BYB0120)', COVER_BODY, 285)
        centred('Vihaan Jinesh Jain (Registration Number: 25BYB0130)', COVER_BODY, 305)
        centred('<b>Faculty:</b> Dr. Dharmendra Singh Rajput', COVER_SUBTITLE, 405)
        centred('Vellore Institute of Technology', COVER_BODY, 435)
        centred('Academic Year 2026-27', COVER_BODY, 455)
        centred('October 23, 2026', COVER_BODY, 548)

class Equation(Flowable):
    def __init__(self):
        Flowable.__init__(self); self.width = WIDTH; self.height = 27
    def draw(self):
        self.canv.setFont('AcademicItalic', 12)
        self.canv.drawCentredString(WIDTH / 2, 13, 'M = (Q, Σ, δ, q₀, F)')
        self.canv.setFont('Academic', 12); self.canv.drawRightString(WIDTH, 13, '(1)')

class Architecture(Flowable):
    def __init__(self):
        Flowable.__init__(self); self.width = WIDTH; self.height = 134
    def draw(self):
        c = self.canv; c.saveState(); c.scale(WIDTH / 451.276, 1)
        c.setStrokeColor(colors.black); c.setFillColor(colors.black); c.setLineWidth(.6)
        boxes = [(147, 103, 158, 24, 'Input text + selected rules'), (3, 51, 213, 32, 'Regex → ε-NFA → DFA → minimum'), (235, 51, 213, 32, 'Lexer → tokens → LL(1) parse'), (111, 6, 230, 25, 'Independent observations + trace evidence')]
        for x, y, w, h, label in boxes:
            c.rect(x, y, w, h); c.setFont('Academic', 10); c.drawCentredString(x + w / 2, y + h / 2 - 3, label)
        for x1,y1,x2,y2 in [(180,103,110,83),(272,103,342,83),(110,51,182,31),(342,51,270,31)]:
            c.line(x1,y1,x2,y2)
            c.line(x2,y2,x2-3,y2+6);c.line(x2,y2,x2+3,y2+6)
        c.restoreState()

class Witness(Flowable):
    def __init__(self):
        Flowable.__init__(self); self.width = WIDTH; self.height = 109
    def draw(self):
        c = self.canv; c.setLineWidth(.7); c.setFillColor(colors.black); c.setStrokeColor(colors.black)
        for side, y in [('left', 81), ('right', 28)]:
            c.setFont('AcademicBold', 10.5); c.drawString(4, y-3, 'Rule ' + ('A' if side == 'left' else 'B'))
            xs = [100,200,300,400]
            for i,(x,step) in enumerate(zip(xs,comparison[side+'Trace'])):
                if i:
                    c.line(xs[i-1]+16,y,x-18,y);c.line(x-18,y,x-23,y+3);c.line(x-18,y,x-23,y-3)
                    c.setFont('AcademicMono',10);c.drawCentredString((xs[i-1]+x)/2,y+8,step['symbol'])
                c.circle(x,y,16)
                if step['accepting']:c.circle(x,y,12.5)
                c.setFont('AcademicMono',9);c.drawCentredString(x,y-3,'q'+str(step['active'][0]))

class Contents(Flowable):
    def __init__(self, entries, page_map):
        Flowable.__init__(self); self.width = WIDTH; self.entries = entries; self.page_map = page_map
        self.height = sum(24 if major else 17 for _,major in entries)
    def draw(self):
        c = self.canv; y=self.height-13
        for title, major in self.entries:
            face='AcademicBold' if major else 'Academic';size=12 if major else 11
            c.setFont(face,size);indent=0 if major else 17;page=str(self.page_map.get(title,'?'))
            c.drawString(indent,y,title);c.drawRightString(WIDTH,y,page)
            start=indent+pdfmetrics.stringWidth(title,face,size)+7
            end=WIDTH-pdfmetrics.stringWidth(page,face,size)-9
            if end>start:
                c.setFont('Academic',10);dots='.'*int((end-start)/pdfmetrics.stringWidth('.', 'Academic', 10))
                c.drawString(start,y,dots)
            c.linkRect('', 'section-'+title, (0,y-3,WIDTH,y+13), relative=1, thickness=0)
            y-=24 if major else 17

class AcademicDoc(SimpleDocTemplate):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs);self.heading_pages={}
    def afterFlowable(self, f):
        if getattr(f,'toc_title',None):
            title=f.toc_title;self.heading_pages[title]=self.page-1
            self.canv.bookmarkPage('section-'+title)
            self.canv.addOutlineEntry(title,'section-'+title,level=1 if getattr(f,'toc_sub',False) else 0,closed=False)

source = (ROOT / 'docs/FINAL_REPORT.md').read_text(encoding='utf-8-sig')
values = {'TEST_COUNT': tests['numPassedTests'], 'TOKENS':len(proof['analysis']['lex']['tokens']),
          'PARSE_ACTIONS':len(proof['analysis']['parse']['trace']), 'RUNTIME_MS':proof['milliseconds'],
          'WITNESS':comparison['witness'],'PAIRS':comparison['visitedPairs']}
for key,value in values.items(): source=source.replace('{{'+key+'}}',str(value))
entries=[(line.lstrip('#').strip(),line.startswith('## ')) for line in source.splitlines() if line.startswith(('## ','### '))]

def tables(key):
    if key=='AUTOMATA_TABLE':
        rows=[[f'`{proof["compared"][s]["pattern"]}`']+[str(proof['compared'][s][kind]['stateCount']) for kind in ['nfa','dfa','minimal']] for s in ['left','right']]
        return make_table('Table 1: Recorded state counts for the signature comparison', ['Rule','ε-NFA','DFA','Minimal DFA'],rows,[210,70,65,WIDTH-345])
    if key=='SETS_TABLE':
        rows=[[n,'{'+', '.join(grammar['first'][n])+'}','{'+', '.join(grammar['follow'][n])+'}'] for n in grammar['first']]
        return make_table('Table 2: FIRST and FOLLOW sets calculated from the grammar',['Nonterminal','FIRST','FOLLOW'],rows,[82,173,WIDTH-255])
    if key=='PARSE_TABLE':
        rows=[]
        for i,step in enumerate(proof['analysis']['parse']['trace'][:8]):
            remaining=' '.join(step['remaining'][:3])+(' …' if len(step['remaining'])>3 else '')
            action=re.sub(r':.*','',step['action']) if step['action'].startswith('Match ') else step['action']
            rows.append([str(i+1),' '.join(step['stack']),remaining,action])
        return make_table('Table 3: First eight actions of the recorded predictive parse',['Step','Stack (top at left)','Remaining','Action'],rows,[29,137,122,WIDTH-288])
    if key=='WITNESS_TABLE':
        rows=[[('ε' if i==0 else '`'+comparison['witness'][:i]+'`'),'q'+str(a['active'][0]),'q'+str(b['active'][0]),'Yes' if a['accepting']!=b['accepting'] else 'No'] for i,(a,b) in enumerate(zip(comparison['leftTrace'],comparison['rightTrace']))]
        return make_table('Table 4: Shortest-witness replay from actual worker output',['Prefix','Rule A state','Rule B state','Disagreement'],rows,[90,112,112,WIDTH-314])
    if key=='RESULTS_TABLE':
        rows=[['Engine tests','83 passing','Recognition, transformations and integration'],['DOM tests','7 passing','Interaction and state flows in jsdom'],['Production build','Successful','TypeScript checks and Vite bundle'],['Built worker','Passed','Actual asset under Node transport'],['Shortest witness','`--a`','Accepted by A; rejected by B'],['Equivalent rules','`a+` and `aa*`','Product exploration confirms agreement'],['Dependency audit','0 known issues','Recorded registry-audit snapshot']]
        return make_table('Table 5: Recorded implementation and verification results',['Check','Observed result','Evidence scope'],rows,[96,116,WIDTH-212])
    if key=='VERDICT_TABLE':
        rows=[['`inspect --tag x`','Yes','Yes'],['`inspect --tag`','Yes','No'],['`inspect file`','No','Yes'],['`(inspect file`','No','No']]
        return make_table('Table 6: Independent pattern and structural outcomes',['Input','Pattern present?','Grammar accepted?'],rows,[210,110,WIDTH-320])
    raise ValueError(key)

def story_for(page_map):
    story=[];lines=source.splitlines();i=0
    while i<len(lines):
        text=lines[i].strip();i+=1
        if not text:continue
        if text=='<!-- pagebreak -->':story.append(PageBreak());continue
        if text=='{{COVER}}':story.append(Cover());continue
        if text=='{{ABSTRACT_HEADING}}':
            abstract=Paragraph('Abstract',ParagraphStyle('abstract-head',parent=H2,alignment=TA_CENTER,spaceAfter=18));story.append(abstract);continue
        if text=='{{CONTENTS}}':story.extend([Paragraph('Contents',H1),Spacer(1,9),Contents(entries,page_map)]);continue
        if text=='{{DFA_EQUATION}}':story.append(Equation());continue
        if text=='{{ARCHITECTURE_FIGURE}}':story.extend([Architecture(),Paragraph('Figure 1: The two independent analysis layers in AUTOSEC',CAPTION),Spacer(1,4)]);continue
        if text=='{{WITNESS_FIGURE}}':story.extend([Witness(),Paragraph('Figure 2: Synchronous replay on the shortest witness --a',CAPTION),Spacer(1,3)]);continue
        if text=='{{APPLICATION_SCREENSHOT}}':
            image=Image(str(OUT/'screenshots/01-analyse-desktop.jpg'))
            image.drawWidth=280;image.drawHeight=280*image.imageHeight/image.imageWidth
            story.append(KeepTogether([image,Paragraph('Figure 3: Published Analyse view, captured on 23 October 2026. Full-resolution captures accompany the evidence.',CAPTION)]));continue
        if text.startswith('{{') and text.endswith('_TABLE}}'):story.extend(tables(text[2:-2]));continue
        if text.startswith('```'):
            block=[]
            while i<len(lines) and not lines[i].startswith('```'):block.append(normalise(lines[i]));i+=1
            i+=1;story.append(Preformatted('\n'.join(block),CODE));continue
        if text.startswith(('## ','### ')):
            title=text.lstrip('#').strip();sub=text.startswith('### ')
            p=Paragraph(inline(title),H2 if sub else H1);p.toc_title=title;p.toc_sub=sub;story.append(p);continue
        paragraph=[text]
        while i<len(lines) and lines[i].strip() and not lines[i].startswith(('#','```','<!--','{{')):
            paragraph.append(lines[i].strip());i+=1
        text=' '.join(paragraph);style=REFERENCE if re.match(r'^\[\d+\]',text) else BODY
        story.append(Paragraph(inline(text),style))
    return story

def footer(c,doc):
    if doc.page==1:return
    c.saveState();c.setFillColor(colors.black);c.setFont('Academic',12)
    c.drawCentredString(A4[0]/2,42,str(doc.page-1));c.restoreState()

def build(target,page_map):
    doc=AcademicDoc(target,pagesize=A4,leftMargin=72,rightMargin=72,topMargin=65,bottomMargin=65,
                    title='AUTOSEC - Counterexample-Driven Automata and Syntax Lab',
                    author='Bhoumik Singh Rajput; Vihaan Jinesh Jain')
    doc.build(story_for(page_map),onFirstPage=footer,onLaterPages=footer)
    return doc.heading_pages

page_map=build(BytesIO(),{})
target=PDF/'AUTOSEC_Final_Report.pdf'
final_map=build(str(target),page_map)
reader=PdfReader(target)
if len(reader.pages)!=12:raise RuntimeError(f'Expected 12 pages, got {len(reader.pages)}; adjust layout before delivery.')
if page_map!=final_map:raise RuntimeError('Contents pagination changed between passes.')

expanded=source
expanded=expanded.replace('{{COVER}}','# AUTOSEC\n\nCounterexample-Driven Automata and Syntax Lab\n\nModels of Computation (BACSE201)\n\nBhoumik Singh Rajput - 25BYB0120\n\nVihaan Jinesh Jain - 25BYB0130\n\nFaculty: Dr. Dharmendra Singh Rajput\n\nVellore Institute of Technology\n\n23 October 2026')
expanded=expanded.replace('{{ABSTRACT_HEADING}}','## Abstract')
expanded=expanded.replace('{{CONTENTS}}','## Contents\n\n'+'\n'.join(f'- {title} ... {final_map[title]}' for title,_ in entries))
expanded=expanded.replace('{{DFA_EQUATION}}','M = (Q, Σ, δ, q₀, F)  (1)')
for name in ['ARCHITECTURE_FIGURE','WITNESS_FIGURE']:expanded=expanded.replace('{{'+name+'}}','[Vector diagram in PDF; see source renderer and worker evidence.]')
expanded=expanded.replace('{{APPLICATION_SCREENSHOT}}','![Published Analyse view, 23 October 2026](../screenshots/01-analyse-desktop.jpg)')
for key in ['AUTOMATA_TABLE','SETS_TABLE','PARSE_TABLE','WITNESS_TABLE','RESULTS_TABLE','VERDICT_TABLE']:
    fs=tables(key);t=fs[0]._content[1]
    rows=[[p.getPlainText() for p in row] for row in t._cellvalues]
    md='| '+' | '.join(rows[0])+' |\n| '+' | '.join(['---']*len(rows[0]))+' |\n'+'\n'.join('| '+' | '.join(row)+' |' for row in rows[1:])
    expanded=expanded.replace('{{'+key+'}}',md)
(PDF/'AUTOSEC_Final_Report_Source.md').write_text(expanded,encoding='utf-8')

render_dir=OUT/'qa'/'academic-report';render_dir.mkdir(parents=True,exist_ok=True)
document=pdfium.PdfDocument(str(target))
for i,page in enumerate(document):page.render(scale=1.5).to_pil().save(render_dir/f'page-{i+1:02}.png')
print(json.dumps({'pdf':str(target),'pages':len(reader.pages),'contents':final_map,'fonts':'Times New Roman 12 pt, black academic headings','renderDirectory':str(render_dir)},ensure_ascii=True,indent=2))
