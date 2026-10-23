"""Render the internal team explanation from Markdown and actual engine fixtures.
Run from autosec/: python scripts/build-team-guide.py
"""
from pathlib import Path
from html import escape
import json, re
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Preformatted, Table, TableStyle, Image, KeepTogether
import pypdfium2 as pdfium
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'output';PDF=OUT/'pdf';PDF.mkdir(exist_ok=True)
WIDTH=A4[0]-122
fonts=Path('C:/Windows/Fonts')
if fonts.exists():
    paths=[fonts/x for x in ['arial.ttf','arialbd.ttf','ariali.ttf','consola.ttf']]
else:
    paths=[Path('/usr/share/fonts/truetype/dejavu')/x for x in ['DejaVuSans.ttf','DejaVuSans-Bold.ttf','DejaVuSans-Oblique.ttf','DejaVuSansMono.ttf']]
for name,path in zip(['Guide','GuideBold','GuideItalic','GuideCode'],paths):pdfmetrics.registerFont(TTFont(name,str(path)))
pdfmetrics.registerFontFamily('Guide',normal='Guide',bold='GuideBold',italic='GuideItalic',boldItalic='GuideBold')
BODY=ParagraphStyle('body',fontName='Guide',fontSize=10.7,leading=15.2,spaceAfter=10,allowWidows=0,allowOrphans=0)
H1=ParagraphStyle('h1',fontName='GuideBold',fontSize=18,leading=23,textColor=colors.HexColor('#17444a'),spaceAfter=17,keepWithNext=True)
H2=ParagraphStyle('h2',fontName='GuideBold',fontSize=13.5,leading=18,spaceBefore=9,spaceAfter=12,keepWithNext=True)
CODE=ParagraphStyle('code',fontName='GuideCode',fontSize=8.5,leading=11.5,leftIndent=10,spaceBefore=3,spaceAfter=13)
CELL=ParagraphStyle('cell',fontName='Guide',fontSize=9.1,leading=12)
HEAD=ParagraphStyle('head',parent=CELL,fontName='GuideBold')
CAP=ParagraphStyle('caption',fontName='Guide',fontSize=9,leading=12,spaceBefore=6,spaceAfter=13,textColor=colors.HexColor('#54686c'))

def normal(text):return str(text).replace('\ufeff','').replace('—','-').replace('–','-').replace('\u2011','-').replace('∅','{}')
def inline(text):
    text=escape(normal(text));protected=[]
    def code(m):
        protected.append('<font name="GuideCode" size="9">'+m.group(1)+'</font>');return '@@C'+str(len(protected)-1)+'@@'
    text=re.sub(r'`([^`]+)`',code,text)
    text=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',text)
    for i,c in enumerate(protected):text=text.replace('@@C'+str(i)+'@@',c)
    return text
def table(headers,rows,widths=None):
    if widths is None:widths=([135,WIDTH-135] if len(headers)==2 else [WIDTH/len(headers)]*len(headers))
    cells=[[Paragraph(inline(c),HEAD if i==0 else CELL) for c in row] for i,row in enumerate([headers]+rows)]
    t=Table(cells,colWidths=widths,hAlign='LEFT',repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#edf3f2')),('LINEBELOW',(0,0),(-1,0),.6,colors.HexColor('#9fb7b9')),('LINEBELOW',(0,1),(-1,-1),.3,colors.HexColor('#d7e1e2')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    return [t,Spacer(1,12)]

fixture=json.loads((OUT/'evidence/team-guide-examples.json').read_text(encoding='utf-8'))
regular=fixture['regular'];simple=fixture['simple'];cmp=fixture['comparison']['comparison']
source=(ROOT/'docs/TEAM_EXPLANATION_AND_CODE_GUIDE.md').read_text(encoding='utf-8-sig').replace('{{SIMPLE_ACTIONS}}',str(len(simple['parse']['trace'])))
automata_source=(ROOT/'src/engine/automata.ts').read_text(encoding='utf-8')
compile_code=automata_source[automata_source.index('export function compile('):automata_source.index('export function runDfa(')].strip()
dynamic={
 'SIMPLE_TOKEN_TABLE':(['Text','Token type','Interval'],[[t['text'],t['type'],f'[{t["start"]}, {t["end"]})'] for t in simple['lex']['tokens']],[190,100,WIDTH-290]),
 'SUBSET_TABLE':(['DFA state','NFA states represented','Accepting?'],[[f'q{i}','{'+','.join(map(str,s))+'}' if s else '∅','Yes' if i in regular['dfa']['accepts'] else 'No'] for i,s in enumerate(regular['dfa']['members'])],[82,245,WIDTH-327]),
 'DFA_TABLE':(['DFA state','Read a','Read b'],[[f'q{i}',f'q{regular["dfa"]["delta"][str(i)]["a"]}',f'q{regular["dfa"]["delta"][str(i)]["b"]}'] for i in range(regular['dfa']['stateCount'])],[WIDTH/3]*3),
 'MINIMISATION_TABLE':(['Minimal state','Original DFA members','Accepting?'],[[f'q{i}','{'+','.join(map(str,s))+'}','Yes' if i in regular['minimal']['accepts'] else 'No'] for i,s in enumerate(regular['minimal']['members'])],[100,230,WIDTH-330]),
 'WITNESS_TRACE':(['Prefix','A state','B state','Disagreement?'],[[('ε' if i==0 else cmp['witness'][:i]),'q'+str(a['active'][0]),'q'+str(b['active'][0]),'Yes' if a['accepting']!=b['accepting'] else 'No'] for i,(a,b) in enumerate(zip(cmp['leftTrace'],cmp['rightTrace']))],[80,100,100,WIDTH-280]),
 'GRAMMAR_SETS':(['Nonterminal','FIRST','FOLLOW'],[[n,'{'+','.join(simple['grammar']['first'][n])+'}','{'+','.join(simple['grammar']['follow'][n])+'}'] for n in simple['grammar']['first']],[75,170,WIDTH-245]),
 'SIMPLE_PARSE':(['Step','Stack before action','Action'],[[str(i+1),' '.join(s['stack']),s['action']] for i,s in enumerate(simple['parse']['trace'])],[35,170,WIDTH-205]),
}

def render(md,target,short_viva=False):
    story=[];lines=md.splitlines();i=0
    while i<len(lines):
        text=lines[i].strip();i+=1
        if not text:continue
        if text=='<!-- pagebreak -->':story.append(PageBreak());continue
        if text=='{{COMPILE_CODE}}':story.append(Preformatted(compile_code,CODE));continue
        if text=='{{ANALYSIS_SCREENSHOT}}':
            p=OUT/'screenshots/01-analyse-desktop.jpg'
            image=Image(str(p));image.drawWidth=WIDTH;image.drawHeight=WIDTH*image.imageHeight/image.imageWidth
            story.append(KeepTogether([image,Paragraph('Genuine desktop capture of the published app, 23 October 2026. Full-resolution screenshots accompany the package.',CAP)]));continue
        if text.startswith('{{') and text.endswith('}}'):
            key=text[2:-2];headers,rows,widths=dynamic[key];story.extend(table(headers,rows,widths));continue
        if text.startswith('```'):
            block=[]
            while i<len(lines) and not lines[i].startswith('```'):block.append(normal(lines[i]));i+=1
            i+=1;story.append(Preformatted('\n'.join(block),CODE));continue
        if text.startswith('|'):
            rows=[]
            while True:
                cells=[x.strip() for x in text.strip('|').split('|')]
                if not all(re.match(r'^:?-+:?$',x.replace(' ','')) for x in cells):rows.append(cells)
                if i>=len(lines) or not lines[i].strip().startswith('|'):break
                text=lines[i].strip();i+=1
            if any(len(r)!=len(rows[0]) for r in rows):raise ValueError('Malformed table')
            widths=None
            if rows[0][0]=='File':widths=[190,WIDTH-190]
            if rows[0][0]=='Technology':widths=[142,WIDTH-142]
            story.extend(table(rows[0],rows[1:],widths));continue
        if text.startswith('# '):story.append(Paragraph(inline(text[2:]),H1));continue
        if text.startswith('## '):story.append(Paragraph(inline(text[3:]),H2));continue
        paragraph=[text]
        while i<len(lines) and lines[i].strip() and not lines[i].startswith(('#','{{','```','<!--','|')):
            paragraph.append(lines[i].strip());i+=1
        story.append(Paragraph(inline(' '.join(paragraph)),BODY))
    def footer(c,doc):
        label='Demo and viva guide' if short_viva else 'Team explanation and code guide'
        c.saveState();c.setFont('Guide',8);c.setFillColor(colors.HexColor('#74848a'));c.drawString(61,30,'AUTOSEC | '+label+' | 23 October 2026');c.drawRightString(A4[0]-61,30,str(doc.page));c.restoreState()
    title='AUTOSEC - Demo and Viva Guide' if short_viva else 'AUTOSEC - Team Explanation and Code Guide'
    doc=SimpleDocTemplate(str(target),pagesize=A4,leftMargin=55,rightMargin=55,topMargin=47,bottomMargin=53,title=title,author='Bhoumik Singh Rajput; Vihaan Jinesh Jain')
    doc.build(story,onFirstPage=footer,onLaterPages=footer)

target=PDF/'AUTOSEC_Team_Explanation_and_Code_Guide.pdf'
render(source,target)
expanded=source.replace('{{COMPILE_CODE}}','```typescript\n'+compile_code+'\n```').replace('{{ANALYSIS_SCREENSHOT}}','[Genuine application screenshot: ../screenshots/01-analyse-desktop.jpg]')
for key,(headers,rows,_) in dynamic.items():
    value='| '+' | '.join(headers)+' |\n| '+' | '.join(['---']*len(headers))+' |\n'+'\n'.join('| '+' | '.join(r)+' |' for r in rows)
    expanded=expanded.replace('{{'+key+'}}',value)
(PDF/'AUTOSEC_Team_Guide_Source.md').write_text(expanded,encoding='utf-8')
reader=PdfReader(target)
folder=OUT/'qa/team-guide';folder.mkdir(parents=True,exist_ok=True)
document=pdfium.PdfDocument(str(target))
for n,page in enumerate(document):page.render(scale=1.35).to_pil().save(folder/f'page-{n+1:02}.png')
print(json.dumps({'pdf':str(target),'pages':len(reader.pages),'textLengths':[len(p.extract_text() or '') for p in reader.pages]}))

# Keep the short viva sheet consistent with the newer browser-verification record.
viva=PDF/'AUTOSEC_Demo_and_Viva_Guide.pdf'
BODY.fontSize=9.5;BODY.leading=13.1;BODY.spaceAfter=8
H1.fontSize=17;H1.leading=21;H1.spaceAfter=12
H2.fontSize=12.5;H2.leading=16;H2.spaceAfter=9
CELL.fontSize=8.5;CELL.leading=11
HEAD.fontSize=8.5;HEAD.leading=11
render((ROOT/'docs/DEMO_AND_VIVA.md').read_text(encoding='utf-8'),viva,short_viva=True)
viva_doc=pdfium.PdfDocument(str(viva))
for old in folder.glob('viva-[0-9][0-9].png'):old.unlink()
for n,page in enumerate(viva_doc):page.render(scale=1.35).to_pil().save(folder/f'viva-{n+1:02}.png')
print(json.dumps({'vivaPdf':str(viva),'pages':len(viva_doc)}))
