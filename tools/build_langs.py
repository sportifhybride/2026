# -*- coding: utf-8 -*-
"""Genere : (1) le <head> SEO des pages francaises, (2) les vraies pages /en/ et /es/, (3) sitemap.xml.
Usage (depuis le dossier tools) :  python3 build_i18n.py && python3 build_langs.py
Necessite : python3, playwright (chromium). Relancer apres toute modification des pages francaises."""
import os,re,sys,shutil,threading,http.server,socketserver,functools
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import seo
from playwright.sync_api import sync_playwright
SITE=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','site'))
PAGES=seo.PAGES
def read(p): return open(p,encoding='utf8').read()
def write(p,s):
    os.makedirs(os.path.dirname(p),exist_ok=True); open(p,'w',encoding='utf8').write(s)
def faq_of(html):
    return [(re.sub(r'<[^>]+>','',q).strip(),re.sub(r'<[^>]+>','',a).strip()) for q,a in re.findall(r'<details class="faq"><summary>(.*?)</summary><p>(.*?)</p></details>',html,flags=re.S)]
def set_head(html,page,lang,faq=None):
    i=html.index('<head>')+6; j=html.index('</head>')
    head=seo.clean_head(html[i:j])
    # insere le bloc SEO apres la balise viewport
    m=re.search(r'<meta name="viewport"[^>]*>',head)
    blk=seo.head_block(page,lang,faq)
    head=head[:m.end()]+blk+head[m.end():]
    return html[:i]+head+html[j:]
# 1) pages francaises : head SEO
for p in PAGES:
    f=os.path.join(SITE,p+'.html'); h=read(f)
    h=set_head(h,p,'fr',faq_of(h) if p=='faq' else None)
    h=re.sub(r'<html lang="[^"]*"[^>]*>','<html lang="fr">',h,count=1)
    write(f,h)
# 2) serveur local
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*a,**k): super().__init__(*a,directory=SITE,**k)
    def log_message(self,*a): pass
socketserver.TCPServer.allow_reuse_address=True
srv=socketserver.TCPServer(('127.0.0.1',8799),Q); threading.Thread(target=srv.serve_forever,daemon=True).start()
def rewrite_links(html,lang):
    pre='/'+lang
    def link(m):
        attr,val=m.group(1),m.group(2)
        if attr!='href': return m.group(0)
        if re.match(r'^(https?:|mailto:|tel:|/|data:|javascript:)',val): return m.group(0)
        frag=''
        if '#' in val: val,frag=val.split('#',1); frag='#'+frag
        if val=='' : return m.group(0)
        slug=val[:-5] if val.endswith('.html') else val
        if slug in PAGES:
            tgt=pre+'/' if slug=='index' else pre+'/'+slug
            return f'href="{tgt}{frag}"'
        return m.group(0)
    return re.sub(r'(href)="([^"]*)"',link,html)
with sync_playwright() as pw:
    br=pw.chromium.launch()
    for lang in ('en','es'):
        for p in PAGES:
            ctx=br.new_context(); pg=ctx.new_page()
            pg.route('**/script.js',lambda r:r.abort())
            pg.add_init_script("window.HC_BUILD=true;localStorage.setItem('hc-lang','%s')"%lang)
            pg.goto(f'http://127.0.0.1:8799/{p}.html'); pg.wait_for_timeout(500)
            pg.evaluate("document.querySelectorAll('.lang').forEach(function(e){e.innerHTML=''})")
            html=pg.content(); ctx.close()
            faq=faq_of(html) if p=='faq' else None
            html=set_head(html,p,lang,faq)
            html=re.sub(r'<html lang="[^"]*"[^>]*>',f'<html lang="{lang}" data-static-lang="{lang}">',html,count=1)
            html=html.replace('<meta charset="utf-8">','<meta charset="utf-8"><base href="/">',1)
            html=rewrite_links(html,lang)
            # liens internes absolus sur l'ancre seule (#x) : base href="/" les casserait
            pth='/'+lang+'/' if p=='index' else '/'+lang+'/'+p
            html=re.sub(r'href="(#[^"]*)"',lambda m:f'href="{pth}{m.group(1)}"',html)
            write(os.path.join(SITE,lang,p+'.html'),html if p!='index' else html)
            if p=='index': write(os.path.join(SITE,lang,'index.html'),html)
    br.close()
srv.shutdown()
# 3) sitemap
x='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
for p in PAGES:
    for l in ('fr','en','es'):
        x+=f'  <url><loc>{seo.url(p,l)}</loc>'
        for l2 in ('fr','en','es'): x+=f'<xhtml:link rel="alternate" hreflang="{l2}" href="{seo.url(p,l2)}"/>'
        x+=f'<xhtml:link rel="alternate" hreflang="x-default" href="{seo.url(p,"fr")}"/></url>\n'
x+='</urlset>\n'
write(os.path.join(SITE,'sitemap.xml'),x)
print('ok',len(PAGES)*3,'urls')
