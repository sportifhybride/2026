import json,re,sys
sys.path.insert(0,'.')
from extras import EXACT,REGEX
en=json.load(open('en.json'));es=json.load(open('es.json'))
for fr,e,s in EXACT:
    en.setdefault(fr,e); es.setdefault(fr,s)
# retire les identites (fr==traduction) pour alleger
en={k:v for k,v in en.items() if k.strip()!=v.strip()}
es={k:v for k,v in es.items() if k.strip()!=v.strip()}
rx={'en':[[a,b] for a,b,c in REGEX],'es':[[a,c] for a,b,c in REGEX if c!=b or True]}
# ES: la regle prix ne doit rien changer ($1 €) -> inutile, on l'enleve
rx['es']=[r for r in rx['es'] if r[0]!=r'(\d+) €']
js="/* Traductions FR / EN / ES — genere. Le francais est la langue d'origine des pages. */\nwindow.HC_I18N="+json.dumps({'en':en,'es':es,'rx':rx},ensure_ascii=False,separators=(',',':'))+";\n"
js+=open('engine.js',encoding='utf8').read()
open('../site/i18n.js','w',encoding='utf8').write(js)
print(len(en),len(es),len(js))
