# -*- coding: utf-8 -*-
"""Donnees SEO (titre, description) par page et par langue + fabrique du bloc <head>."""
import json,re
BASE='https://sportifhybride.com'
BRAND='Hybride Coaching'
PAGES=['index','programmes','coaching','force','detente','performance-athletique','musculation','nutrition','creation-site','avis','parcours','outils','faq','contact','mentions-legales','cgv','confidentialite','cookies']
# (titre fr, desc fr, titre en, desc en, titre es, desc es)
D={
'index':("Coach sportif en ligne | Hybride Coaching, Sportif Hybride","Programmes de force, musculation, détente et course à pied, et coaching personnalisé en ligne par Victor Castillo, étudiant en STAPS. Tous niveaux, partout dans le monde.",
 "Online Sports Coach | Hybride Coaching, Sportif Hybride","Strength, jump, athletic performance and bodybuilding programs, plus personal running coaching online by Victor Castillo, sports science student. All levels, worldwide.",
 "Entrenador deportivo online | Hybride Coaching, Sportif Hybride","Programas de fuerza, salto, rendimiento atlético y musculación, y coaching personalizado de running online con Victor Castillo, estudiante de ciencias del deporte. Todos los niveles, en todo el mundo."),
'programmes':("Programmes de force, musculation et détente | Hybride Coaching","Programmes d'entraînement en ligne : force (bench, deadlift, squat), détente, performance athlétique, musculation, nutrition et création de site. À partir de 15 €.",
 "Strength, Bodybuilding & Jump Training Programs | Hybride Coaching","Online training programs: strength (bench, deadlift, squat), jump training, athletic performance, bodybuilding, nutrition and website creation. From €15.",
 "Programas de fuerza, musculación y salto | Hybride Coaching","Programas de entrenamiento online: fuerza (press banca, peso muerto, sentadilla), salto, rendimiento atlético, musculación, nutrición y creación de sitios web. Desde 15 €."),
'coaching':("Coaching course à pied personnalisé en ligne | Hybride Coaching","Coaching personnalisé de course à pied, du 5 km au marathon sur route, à partir de 8 semaines. Plan sur mesure, suivi hebdomadaire et appuyé sur la science, par Victor Castillo.",
 "Personal Online Running Coaching | Hybride Coaching","Personalized running coaching from 5K to marathon on the road, from 8 weeks. Custom plan, weekly follow-up and science-based approach, by Victor Castillo.",
 "Coaching personalizado de running online | Hybride Coaching","Coaching personalizado de carrera a pie, de 5 km a maratón en ruta, desde 8 semanas. Plan a medida, seguimiento semanal y base científica, por Victor Castillo."),
'force':("Programme de force : bench, deadlift, squat | Hybride Coaching","Programmes de force en ligne : développé couché, soulevé de terre, squat, ou le pack SBD powerlifting. Plans de 2 mois à 15 €, par Victor Castillo.",
 "Strength Program: Bench, Deadlift, Squat | Hybride Coaching","Online strength programs: bench press, deadlift, squat, or the SBD powerlifting bundle. 2-month plans at €15, by Victor Castillo.",
 "Programa de fuerza: press banca, peso muerto, sentadilla | Hybride Coaching","Programas de fuerza online: press banca, peso muerto, sentadilla o el pack SBD powerlifting. Planes de 2 meses a 15 €, por Victor Castillo."),
'detente':("Programme de détente et explosivité | Hybride Coaching","Programmes pour gagner en détente, puissance et explosivité : en salle de musculation ou à la maison / en extérieur. Plans de 2 mois à 15 €.",
 "Vertical Jump & Explosiveness Program | Hybride Coaching","Programs to build vertical jump, power and explosiveness: in the gym or at home / outdoors. 2-month plans at €15.",
 "Programa de salto y explosividad | Hybride Coaching","Programas para ganar salto, potencia y explosividad: en el gimnasio o en casa / al aire libre. Planes de 2 meses a 15 €."),
'performance-athletique':("Programme de performance athlétique | Hybride Coaching","Programmes de performance athlétique pour progresser en vitesse, puissance et condition physique : en salle ou à la maison / en extérieur.",
 "Athletic Performance Program | Hybride Coaching","Athletic performance programs to improve speed, power and conditioning: in the gym or at home / outdoors.",
 "Programa de rendimiento atlético | Hybride Coaching","Programas de rendimiento atlético para mejorar velocidad, potencia y condición física: en el gimnasio o en casa / al aire libre."),
'musculation':("Programmes de musculation : full body, gym bro, popeye | Hybride Coaching","Programmes de musculation en ligne : 3 fois full body, gym bro, le double double, jambe de fer, popeye. Plans de 2 mois à 15 €.",
 "Bodybuilding Programs: Full Body, Bro Split | Hybride Coaching","Online bodybuilding programs: 3x full body, gym bro split, double double, iron legs, popeye. 2-month plans at €15.",
 "Programas de musculación: full body, gym bro | Hybride Coaching","Programas de musculación online: 3 veces full body, gym bro, el doble doble, pierna de hierro, popeye. Planes de 2 meses a 15 €."),
'nutrition':("Suivi nutrition sportive dès 5 € par mois | Hybride Coaching","Suivi du poids et des macronutriments, accompagnement perte de poids, prise de muscle ou perte de masse grasse. À partir de 5 € par mois.",
 "Sports Nutrition Tracking from €5/Month | Hybride Coaching","Weight and macronutrient tracking, support for weight loss, muscle gain or fat loss. From €5 per month.",
 "Seguimiento de nutrición deportiva desde 5 €/mes | Hybride Coaching","Seguimiento del peso y los macronutrientes, acompañamiento para perder peso, ganar músculo o perder grasa. Desde 5 € al mes."),
'creation-site':("Création de site internet sur mesure | Hybride Coaching","Création de site internet sur mesure, nom de domaine inclus, livré sous 7 jours environ. Par Victor Castillo.",
 "Custom Website Creation | Hybride Coaching","Custom website creation, domain name included, delivered in about 7 days. By Victor Castillo.",
 "Creación de sitios web a medida | Hybride Coaching","Creación de sitios web a medida, dominio incluido, entrega en unos 7 días. Por Victor Castillo."),
'avis':("Avis et résultats des sportifs accompagnés | Hybride Coaching","14 témoignages de sportifs que j'ai accompagnés : basket, course à pied, demi-fond, musculation. Leurs avis et leurs résultats.",
 "Reviews & Results from Coached Athletes | Hybride Coaching","14 testimonials from athletes I've coached: basketball, running, middle-distance, bodybuilding. Their reviews and results.",
 "Opiniones y resultados de deportistas | Hybride Coaching","14 testimonios de deportistas a los que he entrenado: baloncesto, running, medio fondo, musculación. Sus opiniones y resultados."),
'parcours':("Victor Castillo : parcours et expérience de coach | Hybride Coaching","Victor Castillo, 19 ans, étudiant en L2 STAPS à Paris Cité, ancien basketteur national et athlète de demi-fond. Mon parcours, mes sports, mon expérience d'encadrement.",
 "About Victor Castillo: Background & Coaching Experience | Hybride Coaching","Victor Castillo, 19, L2 sports science student at Paris Cité, former national-level basketball player and middle-distance athlete. My background, sports and coaching experience.",
 "Sobre Victor Castillo: trayectoria y experiencia | Hybride Coaching","Victor Castillo, 19 años, estudiante de ciencias del deporte en Paris Cité, exjugador de baloncesto de nivel nacional y atleta de medio fondo. Mi trayectoria, mis deportes y mi experiencia como entrenador."),
'outils':("Outils : calculateur 1RM et zones de course | Hybride Coaching","Outils gratuits : calcul de ta charge maximale (1RM) et de tes zones d'entraînement en course à pied.",
 "Free Tools: 1RM Calculator & Running Zones | Hybride Coaching","Free tools: estimate your one-rep max (1RM) and your running training zones.",
 "Herramientas: calculadora 1RM y zonas de carrera | Hybride Coaching","Herramientas gratuitas: calcula tu repetición máxima (1RM) y tus zonas de entrenamiento de carrera."),
'faq':("FAQ : questions fréquentes sur le coaching | Hybride Coaching","Réponses aux questions fréquentes : niveaux, plans d'entraînement, suivi, paiement et délais.",
 "FAQ: Frequently Asked Questions About Coaching | Hybride Coaching","Answers to common questions: levels, training plans, follow-up, payment and timing.",
 "FAQ: preguntas frecuentes sobre el coaching | Hybride Coaching","Respuestas a las preguntas frecuentes: niveles, planes de entrenamiento, seguimiento, pago y plazos."),
'contact':("Contact : écris à Victor Castillo | Hybride Coaching","Parlons de ton objectif. Écris-moi sur WhatsApp ou par e-mail pour un programme ou un coaching.",
 "Contact Victor Castillo | Hybride Coaching","Let's talk about your goal. Message me on WhatsApp or by email about a program or coaching.",
 "Contacto: escribe a Victor Castillo | Hybride Coaching","Hablemos de tu objetivo. Escríbeme por WhatsApp o por correo sobre un programa o el coaching."),
'mentions-legales':("Mentions légales | Hybride Coaching","Mentions légales du site Hybride Coaching.","Legal Notice | Hybride Coaching","Legal notice of the Hybride Coaching website.","Aviso legal | Hybride Coaching","Aviso legal del sitio Hybride Coaching."),
'cgv':("Conditions générales de vente | Hybride Coaching","Conditions générales de vente des programmes et du coaching Hybride Coaching.","Terms of Sale | Hybride Coaching","Terms of sale for Hybride Coaching programs and coaching.","Condiciones de venta | Hybride Coaching","Condiciones de venta de los programas y del coaching de Hybride Coaching."),
'confidentialite':("Politique de confidentialité | Hybride Coaching","Politique de confidentialité et protection des données du site Hybride Coaching.","Privacy Policy | Hybride Coaching","Privacy policy and data protection of the Hybride Coaching website.","Política de privacidad | Hybride Coaching","Política de privacidad y protección de datos del sitio Hybride Coaching."),
'cookies':("Politique de cookies | Hybride Coaching","Politique de cookies du site Hybride Coaching.","Cookie Policy | Hybride Coaching","Cookie policy of the Hybride Coaching website.","Política de cookies | Hybride Coaching","Política de cookies del sitio Hybride Coaching."),
}
LOC={'fr':'fr_FR','en':'en_US','es':'es_ES'}
IDX={'fr':0,'en':2,'es':4}
def url(page,lang):
    pre='' if lang=='fr' else '/'+lang
    if page=='index': return BASE+(pre or '')+'/'
    return BASE+pre+'/'+page
def esc(s): return s.replace('&','&amp;').replace('"','&quot;').replace('<','&lt;')
SAME=["https://www.instagram.com/sportifhybride","https://www.tiktok.com/@sportifhybride","https://www.youtube.com/@victor800m","https://fr.linkedin.com/in/victor-castillo-a945b0148","https://strava.app.link/5R9wd7EG37b"]
def ld(page,lang,faq=None):
    out=[]
    if page=='index':
        out.append({"@context":"https://schema.org","@graph":[
          {"@type":"WebSite","@id":BASE+"/#site","url":BASE+"/","name":"Hybride Coaching - Sportif Hybride","alternateName":["Sportif Hybride","Hybride Coaching","Victor Castillo"],"inLanguage":["fr","en","es"]},
          {"@type":"Person","@id":BASE+"/#victor","name":"Victor Castillo","alternateName":"Sportif Hybride","url":BASE+"/","image":BASE+"/assets/hero.webp","jobTitle":"Online sports coach: strength, bodybuilding and running","alumniOf":"Université Paris Cité","knowsAbout":["strength training","bodybuilding","running","middle-distance running","athletic performance","sports nutrition"],"sameAs":SAME},
          {"@type":"ProfessionalService","@id":BASE+"/#service","name":"Hybride Coaching","url":BASE+"/","image":BASE+"/assets/hero.webp","founder":{"@id":BASE+"/#victor"},"serviceType":["Online sports coaching","Training programs","Running coaching"],"areaServed":"Worldwide","availableLanguage":["French","English","Spanish"],"sameAs":SAME}]})
    elif page!='index':
        name=D[page][IDX[lang]].split(' | ')[0]
        home={'fr':'Accueil','en':'Home','es':'Inicio'}[lang]
        out.append({"@context":"https://schema.org","@type":"BreadcrumbList","itemList":None} if False else
          {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
            {"@type":"ListItem","position":1,"name":home,"item":url('index',lang)},
            {"@type":"ListItem","position":2,"name":name,"item":url(page,lang)}]})
    if faq:
        out.append({"@context":"https://schema.org","@type":"FAQPage","inLanguage":lang,"mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in faq]})
    return ''.join('<script type="application/ld+json">'+json.dumps(o,ensure_ascii=False,separators=(',',':'))+'</script>' for o in out)
def head_block(page,lang,faq=None):
    t=D[page][IDX[lang]]; d=D[page][IDX[lang]+1]; u=url(page,lang)
    h=f'<title>{esc(t)}</title><meta name="description" content="{esc(d)}"><meta name="robots" content="index,follow,max-image-preview:large">'
    h+=f'<link rel="canonical" href="{u}">'
    for l in ('fr','en','es'): h+=f'<link rel="alternate" hreflang="{l}" href="{url(page,l)}">'
    h+=f'<link rel="alternate" hreflang="x-default" href="{url(page,"fr")}">'
    h+=f'<meta property="og:type" content="website"><meta property="og:site_name" content="Hybride Coaching - Sportif Hybride"><meta property="og:locale" content="{LOC[lang]}">'
    for l in ('fr','en','es'):
        if l!=lang: h+=f'<meta property="og:locale:alternate" content="{LOC[l]}">'
    h+=f'<meta property="og:title" content="{esc(t)}"><meta property="og:description" content="{esc(d)}"><meta property="og:url" content="{u}"><meta property="og:image" content="{BASE}/assets/hero.webp">'
    h+=f'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{esc(t)}"><meta name="twitter:description" content="{esc(d)}"><meta name="twitter:image" content="{BASE}/assets/hero.webp">'
    h+=ld(page,lang,faq)
    return h
def clean_head(h):
    h=re.sub(r'<title>.*?</title>','',h,flags=re.S)
    h=re.sub(r'<meta name="description"[^>]*>','',h)
    h=re.sub(r'<meta name="robots" content="index[^>]*>','',h)
    h=re.sub(r'<link rel="(canonical|alternate)"[^>]*>','',h)
    h=re.sub(r'<meta (property="(og|twitter):[^"]*"|name="twitter:[^"]*")[^>]*>','',h)
    h=re.sub(r'<script type="application/ld\+json">.*?</script>','',h,flags=re.S)
    return h
