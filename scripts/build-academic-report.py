"""Build the 12-page academic report with IEEE-style citations and real evidence.
Run from autosec/: python scripts/build-report.py
Inputs live in docs/, ../output/evidence and ../output/screenshots/report-2026-10-24.
"""
from pathlib import Path
from html import escape
import json, re, hashlib, math
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Preformatted, Table, TableStyle, Image, KeepTogether, Flowable
from reportlab.graphics.shapes import Drawing, Rect, Line, Circle, Polygon, String, Path as GPath
from reportlab.graphics import renderSVG
from pypdf import PdfReader
import pypdfium2 as pdfium

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT.parent/'output';PDF=OUT/'pdf'
EV=OUT/'evidence' if (OUT/'evidence/report-fixtures-2026-10-24.json').exists() else ROOT/'deliverables/evidence'
PDF.mkdir(parents=True,exist_ok=True)
FIG=OUT/'figures';FIG.mkdir(exist_ok=True)
SHOT=OUT/'screenshots/report-2026-10-24' if (OUT/'screenshots/report-2026-10-24').exists() else ROOT/'deliverables/screenshots/report-2026-10-24'
W=A4[0]-124
fontdir=Path('C:/Windows/Fonts')
paths=[fontdir/f for f in ['times.ttf','timesbd.ttf','timesi.ttf','consola.ttf']]
if not fontdir.exists():paths=[Path('/usr/share/fonts/truetype/dejavu')/f for f in ['DejaVuSerif.ttf','DejaVuSerif-Bold.ttf','DejaVuSerif-Italic.ttf','DejaVuSansMono.ttf']]
for name,p in zip(['Paper','PaperBold','PaperItalic','PaperCode'],paths):pdfmetrics.registerFont(TTFont(name,str(p)))
pdfmetrics.registerFontFamily('Paper',normal='Paper',bold='PaperBold',italic='PaperItalic',boldItalic='PaperBold')
symbol_path=fontdir/'seguisym.ttf' if fontdir.exists() else paths[0]
pdfmetrics.registerFont(TTFont('PaperSymbol',str(symbol_path)))
BODY=ParagraphStyle('body',fontName='Paper',fontSize=11,leading=13.7,alignment=TA_JUSTIFY,spaceAfter=8,allowWidows=0,allowOrphans=0)
H1=ParagraphStyle('h1',fontName='PaperBold',fontSize=15,leading=18,spaceAfter=12,keepWithNext=True)
H2=ParagraphStyle('h2',fontName='PaperBold',fontSize=11.8,leading=15,spaceBefore=5,spaceAfter=8,keepWithNext=True)
CELL=ParagraphStyle('cell',fontName='Paper',fontSize=9.2,leading=11.2)
HEAD=ParagraphStyle('head',parent=CELL,fontName='PaperBold')
CAP=ParagraphStyle('cap',fontName='Paper',fontSize=9.2,leading=11.5,alignment=TA_CENTER,spaceBefore=5,spaceAfter=9)
CODE=ParagraphStyle('code',fontName='PaperCode',fontSize=8.4,leading=11,leftIndent=9,spaceBefore=2,spaceAfter=10)
REF=ParagraphStyle('reference',fontName='Paper',fontSize=9.8,leading=12.5,leftIndent=19,firstLineIndent=-19,spaceAfter=10,splitLongWords=True)
CENTER=ParagraphStyle('center',parent=BODY,alignment=TA_CENTER)
data=json.loads((EV/'report-fixtures-2026-10-24.json').read_text(encoding='utf-8'))
tests=json.loads((EV/'tests.json').read_text(encoding='utf-8-sig'))
refs=json.loads((ROOT/'docs/REFERENCES.json').read_text(encoding='utf-8'))
source=(ROOT/'docs/FINAL_REPORT.md').read_text(encoding='utf-8-sig')
assert len(refs)>=10 and all(2021<=r['year']<=2026 for r in refs)

def norm(s):
    return str(s).replace('\ufeff','').replace('—','-').replace('–','-').replace('‑','-').replace('∅','{}')
def inline(s):
    s=escape(norm(s));kept=[]
    def protect(m):
        kept.append('<font name="PaperCode" size="9">'+m.group(1)+'</font>');return '@@K'+str(len(kept)-1)+'@@'
    s=re.sub(r'`([^`]+)`',protect,s)
    s=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',s)
    for i,v in enumerate(kept):s=s.replace('@@K'+str(i)+'@@',v)
    # Times New Roman lacks several set-theory glyphs. Embed a real symbol font.
    for ch in set(s):
        if ord(ch)>127 and ord(ch) not in pdfmetrics.getFont('Paper').face.charToGlyph:
            s=s.replace(ch,'<font name="PaperSymbol">'+ch+'</font>')
    return s

def table(caption,headers,rows,widths):
    values=[[Paragraph(inline(c),HEAD if i==0 else CELL) for c in row] for i,row in enumerate([headers]+rows)]
    t=Table(values,colWidths=widths,repeatRows=1,hAlign='CENTER')
    t.setStyle(TableStyle([('LINEABOVE',(0,0),(-1,0),.7,colors.black),('LINEBELOW',(0,0),(-1,0),.5,colors.black),('LINEBELOW',(0,-1),(-1,-1),.6,colors.black),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    return KeepTogether([Paragraph(caption,CAP),t,Spacer(1,8)])

black=colors.HexColor('#20262d');gray=colors.HexColor('#f0f2f4')
def txt(d,x,y,s,size=10,bold=False,anchor='middle'):
    d.add(String(x,y,norm(s),fontName='PaperBold' if bold else 'Paper',fontSize=size,fillColor=black,textAnchor=anchor))
def arrow(d,x1,y1,x2,y2,label=None):
    d.add(Line(x1,y1,x2,y2,strokeColor=black,strokeWidth=.8));ang=math.atan2(y2-y1,x2-x1);a=5
    d.add(Polygon([x2,y2,x2-a*math.cos(ang-.45),y2-a*math.sin(ang-.45),x2-a*math.cos(ang+.45),y2-a*math.sin(ang+.45)],fillColor=black,strokeColor=black))
    if label:txt(d,(x1+x2)/2,(y1+y2)/2+7,label,9)
def box(d,x,y,w,h,lines):
    d.add(Rect(x,y,w,h,fillColor=gray,strokeColor=black,strokeWidth=.65))
    for i,line in enumerate(lines):txt(d,x+w/2,y+h/2+(len(lines)-1)*6-i*12,line,10,i==0)
def architecture():
    d=Drawing(W,175);c=W/2
    box(d,c-105,137,210,30,['React input and two-task interface'])
    arrow(d,c,137,c,120);box(d,c-96,89,192,30,['Disposable Web Worker'])
    arrow(d,c-36,89,115,71);arrow(d,c+36,89,W-115,71)
    box(d,8,35,214,35,['Regular layer','regex → NFA → DFA → minimum'])
    box(d,W-222,35,214,35,['Structural layer','text → tokens → LL(1) parse'])
    arrow(d,115,35,160,18);arrow(d,W-115,35,W-160,18)
    txt(d,c,3,'Independent verdicts, diagnostics and optional traces',11,True)
    return d
def pipeline():
    d=Drawing(W,42);labels=['Regex AST','ε-NFA','Subset DFA','Minimal DFA'];bw=98;gap=(W-4*bw)/3
    for i,l in enumerate(labels):
        x=i*(bw+gap);box(d,x,8,bw,28,[l])
        if i<3:arrow(d,x+bw,22,x+bw+gap,22)
    return d
def nfa():
    d=Drawing(W,130);coords={0:(26,57),1:(99,57),2:(172,57),4:(245,57),5:(318,57),3:(W-28,57)}
    for e in data['regular']['nfa']['edges']:
        x1,y1=coords[e['from']];x2,y2=coords[e['to']];symbol=e['symbol'] or 'ε'
        if (e['from'],e['to']) in [(2,3),(5,4)]:
            height=113 if e['from']==2 else 12
            p=GPath(strokeColor=black,strokeWidth=.8,fillColor=None);p.moveTo(x1,y1+(14 if height>57 else -14));p.curveTo(x1,height,x2,height,x2,y2+(14 if height>57 else -14));d.add(p)
            tip=y2+(14 if height>57 else -14);arrow(d,x2,tip+(5 if height>57 else -5),x2,tip);txt(d,(x1+x2)/2,height-5 if height>57 else height+5,symbol,10)
        else:arrow(d,x1+14,y1,x2-14,y2,symbol)
    for q,(x,y) in coords.items():
        d.add(Circle(x,y,14,fillColor=colors.white,strokeColor=black,strokeWidth=1));txt(d,x,y-3,'q'+str(q),9)
        if q in data['regular']['nfa']['accepts']:d.add(Circle(x,y,11,fillColor=None,strokeColor=black,strokeWidth=.8))
    arrow(d,0,57,12,57);txt(d,W/2,2,'All stored transitions shown; double circle marks acceptance.',9)
    return d
def product():
    d=Drawing(W,100);xs=[35,165,295,W-35];ys=[74,27];cmp=data['comparison']['comparison']
    for row,key in enumerate(['leftTrace','rightTrace']):
        trace=cmp[key];txt(d,6,ys[row]+17,'A' if row==0 else 'B',10,True)
        for i,s in enumerate(trace):
            if i:arrow(d,xs[i-1]+15,ys[row],xs[i]-15,ys[row],s['symbol'])
            d.add(Circle(xs[i],ys[row],14,fillColor=colors.white,strokeColor=black,strokeWidth=.9));txt(d,xs[i],ys[row]-3,'q'+str(s['active'][0]),9)
            if s['accepting']:d.add(Circle(xs[i],ys[row],11,fillColor=None,strokeColor=black,strokeWidth=.8))
    txt(d,W/2,0,'After --a: A accepts; B rejects. Only the witness path is drawn.',9)
    return d
def testchart():
    d=Drawing(W,84);maxw=W-145
    for y,label,num in [(56,'Engine cases',83),(29,'DOM cases',7)]:
        txt(d,0,y+2,label,10,False,'start');d.add(Rect(95,y,maxw*num/83,14,fillColor=colors.HexColor('#626d7a'),strokeColor=None));txt(d,103+maxw*num/83,y+3,str(num),10,True,'start')
    txt(d,W/2,4,'8 languages × 127 strings × 3 recognisers = 3,048 recognition checks',10)
    return d

tables={
 'RELATED_TABLE':('TABLE I. DOCUMENTED EMPHASIS AND AUTOSEC DESIGN POSITION',['Work','Documented emphasis','AUTOSEC emphasis'],[
 ['FSM visualisation [2]–[4]','Transformations, computation graphs and machine/stack execution.','A command with two verdicts, then a shortest rule disagreement.'],
 ['Recipe support [5]','Regex design process and targeted diagnostic feedback.','A small set of prepared contrasts and optional computed steps.'],
 ['automata [6]','Python API, simulation, conversion, language operations and equivalence.','Direct browser forms without coding an automata API.'],
 ['AALpy [7]','Active model learning, testing and equivalence oracles.','Exact product search between two supplied regex-derived DFAs.']], [91,183,W-274]),
 'NOTATION_TABLE':('TABLE II. NOTATION USED THROUGHOUT THE REPORT',['Symbol','Meaning'],[['Σ*','All finite strings over Σ, including ε.'],['L(r), L(G)','Languages denoted by a regex and generated by the grammar.'],['δ*(q, w)','State reached after consuming w from state q.'],['A △ B','Symmetric difference: strings in exactly one language.'],['[s, e)','Start included; end excluded. Source offsets are zero-based.'],['$','End-of-input marker, not a character in the command.']],[85,W-85]),
 'METHOD_TABLE':('TABLE III. METHODOLOGY AND CORRESPONDING ARTEFACT',['Stage','Concrete procedure','Evidence'],[
 ['Specification','Fix regex subset, token categories and nested grammar.','Definitions and productions.'],['Construction','Generate automata and predictive decisions from inputs.','Machine edges, sets and traces.'],['Verification','Use independent predicates and exact comparisons.','90 tests and worker fixtures.'],['Presentation','Exercise examples and capture real rendered results.','Cursor-free browser captures.']],[85,233,W-318]),
 'SUBSET_TABLE':('TABLE IV. REACHABLE DFA SUBSETS FOR ab*',['DFA state','Represented NFA set','Accepting?'],[[f'q{i}','{'+','.join(map(str,s))+'}','Yes' if i in data['regular']['dfa']['accepts'] else 'No'] for i,s in enumerate(data['regular']['dfa']['members'])],[80,245,W-325]),
 'GRAMMAR_TABLE':('TABLE V. FIRST/FOLLOW SETS COMPUTED FROM THE FIXED GRAMMAR',['Nonterminal','FIRST','FOLLOW'],[[n,'{'+', '.join(data['cases'][0]['grammar']['first'][n])+'}','{'+', '.join(data['cases'][0]['grammar']['follow'][n])+'}'] for n in data['cases'][0]['grammar']['first']],[75,195,W-270]),
 'PARSER_TABLE':('TABLE VI. FIRST FOUR ACTIONS FOR THE VALID COMMAND',['Step','Stack top first','Applied action'],[[str(i+1),' '.join(s['stack']),s['action']] for i,s in enumerate(data['cases'][0]['parse']['trace'][:4])],[35,180,W-215]),
 'WITNESS_TABLE':('TABLE VII. COMPUTED ACCEPTANCE ALONG THE SHORTEST WITNESS',['Prefix','A state / acceptance','B state / acceptance'],[[data['comparison']['comparison']['witness'][:i] if i else 'ε',f'q{a["active"][0]} / '+('accept' if a['accepting'] else 'reject'),f'q{b["active"][0]} / '+('accept' if b['accepting'] else 'reject')] for i,(a,b) in enumerate(zip(data['comparison']['comparison']['leftTrace'],data['comparison']['comparison']['rightTrace']))],[90,(W-90)/2,(W-90)/2]),
 'RESULTS_TABLE':('TABLE VIII. OBSERVED VERIFICATION RESULTS',['Check','Observed result','Interpretation'],[
 ['Engine / DOM suite','83 / 7 passing','90 test cases; not 90 user participants.'],['Production build','Passed','TypeScript and Vite build successful.'],['ab* construction','6 → 4 → 3 states','NFA, DFA and minimal DFA.'],['Default comparison','--a; 5 processed pairs','A accepts and B rejects.'],['a+ versus aa*','Equivalent','Reachable product exhausted.'],['a* versus a+','Empty witness ε','Initial acceptance disagrees.']],[112,129,W-241]),
 'CASES_TABLE':('TABLE IX. TWO INDEPENDENT OUTCOMES ON THE SAME INPUT',['Input','Flag found?','Syntax accepted?'],[[c['input'],'Yes' if c['patternMatched'] else 'No','Yes' if c['structureAccepted'] else 'No'] for c in [data['cases'][0],data['cases'][1],data['cases'][3],data['cases'][4],data['cases'][5]]],[268,90,W-358])
}

class Cover(Flowable):
    def __init__(self):
        super().__init__();self.width=W;self.height=650
    def draw(self):
        c=self.canv
        def line(s,y,size=12,bold=False):c.setFont('PaperBold' if bold else 'Paper',size);c.drawCentredString(W/2,y,s)
        line('MODELS OF COMPUTATION (BACSE201)',610,16,True)
        line('PROJECT REPORT',579,14,True)
        line('AUTOSEC',515,26,True)
        line('Counterexample-Driven Automata and Syntax Demo',481,14,True)
        line('Team Members',373,12,True)
        line('Bhoumik Singh Rajput  |  25BYB0120',344)
        line('Vihaan Jinesh Jain  |  25BYB0130',321)
        line('Faculty',250,12,True)
        line('Dr. Dharmendra Singh Rajput',223,13,True)
        line('School of Computer Science Engineering and Information Systems',198,11)
        line('Vellore Institute of Technology, Vellore',145,12)
        line('Academic Year 2026–2027',122,12)

entries=[('I. Introduction and Related Work',3),('II. Formal Definitions and Recognition Semantics',4),('III. Methodology and System Architecture',5),('IV. Regular-Language Construction',6),('V. Lexical Analysis and Predictive Parsing',7),('VI. Shortest-Counterexample Method',8),('VII. Actual Application Screenshots',9),('VIII. Evaluation and Observed Results',10),('IX. Discussion, Limitations and Conclusion',11),('References',12)]
class Contents(Flowable):
    def __init__(self):
        super().__init__();self.width=W;self.height=180
    def draw(self):
        c=self.canv
        for i,(name,page) in enumerate(entries):
            y=168-i*17;c.setFont('Paper',10.5);c.drawString(4,y,name);c.drawRightString(W-4,y,str(page));c.linkRect('',f'page-{page}',(0,y-3,W,y+12),relative=1,thickness=0)

def figure(d,filename,caption=None):
    renderSVG.drawToFile(d,str(FIG/filename))
    return KeepTogether([d]+([Paragraph(caption,CAP)] if caption else [Spacer(1,6)]))
def shot(file,width,caption):
    im=Image(str(SHOT/file));im.drawWidth=width;im.drawHeight=width*im.imageHeight/im.imageWidth;im.hAlign='CENTER'
    return KeepTogether([im,Paragraph(caption,CAP)])

def reference(r):
    if r['id']==1:
        return inline('[1] '+r['authors']+', ')+ '<i>'+escape(r['title'])+'</i>, 7th ed. Burlington, MA, USA: Jones &amp; Bartlett Learning, 2023. <link href="'+escape(r['url'])+'" color="#24496b">[Online]</link>'
    line=f'[{r["id"]}] {r["authors"]}, “{r["title"]},” <i>{r["venue"]}</i>'
    if r['detail']:line+=', '+r['detail']
    line+=f', {r["year"]}.'
    if r.get('doi'):line+=' doi: '+r['doi']+'.'
    # A compact clickable title avoids unbreakable raw URLs in the PDF.
    link=' <link href="'+escape(r['url'])+'" color="#24496b">[Online]</link>'
    return inline(line).replace('&lt;i&gt;','<i>').replace('&lt;/i&gt;','</i>')+link

expanded=source
story=[];lines=source.splitlines();i=0
while i<len(lines):
    s=lines[i].strip();i+=1
    if not s:continue
    if s=='<!-- pagebreak -->':story.append(PageBreak());continue
    if s=='{{COVER}}':story.append(Cover());expanded=expanded.replace(s,'# AUTOSEC\n\nCounterexample-Driven Automata and Syntax Demo\n\nBhoumik Singh Rajput (25BYB0120); Vihaan Jinesh Jain (25BYB0130)\n\nFaculty: Dr. Dharmendra Singh Rajput. VIT Vellore. BACSE201, 2026–27.');continue
    if s=='{{CONTENTS}}':story.append(Contents());expanded=expanded.replace(s,'\n'.join(f'- {n}: p. {p}' for n,p in entries));continue
    if s in ['{{DEFINITION_EQUATIONS}}','{{PRODUCT_EQUATION}}']:
        eqs=['L(M) = {w ∈ Σ* | δ*(q₀, w) ∈ F}                 (1)','ε-closure(S) = {q | ∃s ∈ S, s →ε* q}           (2)'] if s=='{{DEFINITION_EQUATIONS}}' else ['L(A) △ L(B) = (L(A) − L(B)) ∪ (L(B) − L(A))     (3)','|w*| = min {|w| : w ∈ L(A) △ L(B)}            (4)']
        story.extend([Paragraph(inline(e),CENTER) for e in eqs]);expanded=expanded.replace(s,'\n\n'.join(eqs));continue
    if s=='{{REFERENCES}}':
        story.extend(Paragraph(reference(r),REF) for r in refs)
        expanded=expanded.replace(s,'\n\n'.join(f'[{r["id"]}] {r["authors"]}, "{r["title"]}," {r["venue"]}, {r["detail"]}, {r["year"]}. '+('doi: '+r['doi']+'. ' if r.get('doi') else '')+r['url'] for r in refs));continue
    figures={
      '{{ARCHITECTURE_FIGURE}}':(architecture,'01-architecture.svg','Fig. 1. Independent regular and structural pipelines inside a local worker.'),
      '{{REGEX_PIPELINE}}':(pipeline,'02-regex-pipeline.svg',None),
      '{{NFA_FIGURE}}':(nfa,'03-ab-star-nfa.svg','Fig. 2. Actual Thompson ε-NFA for ab*. State IDs and edges follow the worker fixture.'),
      '{{PRODUCT_FIGURE}}':(product,'04-product-witness.svg','Fig. 3. Paired DFA run along --a. Numeric labels belong to separate machines.'),
      '{{TEST_FIGURE}}':(testchart,'05-test-counts.svg','Fig. 6. Passing automated test cases and the embedded recognition-check count.')}
    if s in figures:
        fn,name,cap=figures[s];story.append(figure(fn(),name,cap));expanded=expanded.replace(s,f'![{cap or "Construction pipeline"}](../figures/{name})');continue
    shots={
      '{{VALID_SCREENSHOT}}':('01-valid-command.jpg',370,'Fig. 4. Actual Check text view: the flag is found and the nested command is valid.'),
      '{{INVALID_SCREENSHOT}}':('06-rejection-detail.jpg',410,'Fig. 5. Actual viewport excerpt: the flag remains present while a missing value makes syntax invalid.'),
      '{{COMPARE_SCREENSHOT}}':('03-counterexample.jpg',335,'Fig. 7. Actual Compare rules view: --a is accepted only by Rule A.')}
    if s in shots:
        file,width,cap=shots[s];story.append(shot(file,width,cap));expanded=expanded.replace(s,f'![{cap}](../screenshots/report-2026-10-24/{file})');continue
    if s.startswith('{{'):
        key=s[2:-2];cap,headers,rows,widths=tables[key];story.append(table(cap,headers,rows,widths));expanded=expanded.replace(s,cap+'\n\n| '+' | '.join(headers)+' |\n| '+' | '.join('---' for _ in headers)+' |\n'+'\n'.join('| '+' | '.join(row)+' |' for row in rows));continue
    if s.startswith('```'):
        code=[]
        while i<len(lines) and not lines[i].startswith('```'):code.append(norm(lines[i]));i+=1
        i+=1;story.append(Preformatted('\n'.join(code),CODE));continue
    if s.startswith('## '):story.append(Paragraph(inline(s[3:]),H1));continue
    if s.startswith('### '):story.append(Paragraph(inline(s[4:]),H2));continue
    para=[s]
    while i<len(lines) and lines[i].strip() and not lines[i].startswith(('#','{{','```','<!--')):para.append(lines[i].strip());i+=1
    story.append(Paragraph(inline(' '.join(para)),BODY))

def footer(c,doc):
    c.bookmarkPage(f'page-{doc.page}')
    if doc.page>1:
        c.saveState();c.setFont('Paper',9);c.setFillColor(colors.HexColor('#59616b'));c.drawString(56,27,'AUTOSEC | Models of Computation');c.drawRightString(A4[0]-56,27,str(doc.page));c.restoreState()
target=PDF/'AUTOSEC_Final_Report.pdf'
doc=SimpleDocTemplate(str(target),pagesize=A4,leftMargin=56,rightMargin=56,topMargin=46,bottomMargin=44,title='AUTOSEC: Counterexample-Driven Automata and Syntax Demo',author='Bhoumik Singh Rajput; Vihaan Jinesh Jain')
doc.build(story,onFirstPage=footer,onLaterPages=footer)
reader=PdfReader(target)
if len(reader.pages)!=12:raise RuntimeError(f'Expected 12 pages, got {len(reader.pages)}. Resolve layout before delivery.')
text='\n'.join(p.extract_text() or '' for p in reader.pages)
assert '{{' not in text and '\ufffd' not in text
assert all(f'[{i}]' in text for i in range(1,len(refs)+1))
(PDF/'AUTOSEC_Final_Report_Source.md').write_text(expanded,encoding='utf-8')
folder=OUT/'qa/report-2026-10-24';folder.mkdir(parents=True,exist_ok=True)
for i,p in enumerate(pdfium.PdfDocument(str(target))):p.render(scale=1.5).to_pil().save(folder/f'page-{i+1:02}.png')
check={'date':'2026-10-24','pages':12,'references':len(refs),'referenceYears':[r['year'] for r in refs],'allReferencesWithinFiveYears':True,'unresolvedPlaceholders':False,'reportSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'style':'A4 academic project report, IEEE-style technical prose, numbered references, Roman section/table numbering; not represented as an IEEE publication','screenshots':'Genuine browser captures; no visible pointer; full originals and one viewport excerpt included','textLengths':[len(p.extract_text() or '') for p in reader.pages]}
(EV/'report-format-check.json').write_text(json.dumps(check,indent=2),encoding='utf-8')
print(json.dumps(check,indent=2))
