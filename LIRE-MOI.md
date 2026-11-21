# Hybride Coaching v22 — site + comptes réels

Contenu du dossier :
- `site/` : le site (pages, images, script.js, admin.html)
- `functions/api/[[path]].js` : le petit serveur (comptes, connexion, commandes, admin)
- `wrangler.toml` : lie le site à la base de données `hybride-coaching` (déjà créée dans ton compte Cloudflare)
- `schema.sql` : plan de la base (déjà appliqué, juste pour référence)

## Mise en ligne (une seule fois, ~15 min)

Pourquoi GitHub : l'envoi par glisser-déposer de Cloudflare Pages ne prend PAS en compte le dossier `functions`. Il faut relier le site à GitHub.

1. **GitHub** : crée (ou réutilise) un dépôt, puis mets-y TOUT le contenu de ce dossier (`site`, `functions`, `wrangler.toml`, `schema.sql`) à la racine. Ne mets jamais ta clé d'administration dedans.
2. **Cloudflare** → Workers & Pages → Create → onglet **Pages** → **Connect to Git** → choisis le dépôt.
   - Framework : None
   - Build command : (laisser vide)
   - Build output directory : `site`
   → Save and Deploy.
3. **Brancher la base** : ton projet Pages → Settings → **Bindings** → Add → **D1 database** → nom de variable `DB` → base `hybride-coaching`. Fais-le pour *Production* (et *Preview* si proposé). Puis Deployments → Retry deployment.
4. **Domaine** : retire `sportifhybride.com` de l'ancien projet (Custom domains → supprimer), puis ajoute-le au nouveau projet (Custom domains → Set up a domain).
5. **Vérifier** : ouvre `https://sportifhybride.com/api/me` → tu dois voir `{"user":null,"orders":[]}`. Puis crée un compte test sur `/compte`.

## Au quotidien
- Une commande arrive → elle apparaît sur `https://sportifhybride.com/admin` (saisis ta clé d'administration). Quand tu as reçu le paiement (Revolut), clique **Payée ✓** : le programme passe en « Payée — disponible » dans l'espace du client.
- Tu envoies le PDF par WhatsApp/e-mail avec la référence (HC-00001…).
- Mot de passe oublié : le client te contacte, tu me demandes de le réinitialiser (pas d'envoi d'e-mail automatique pour l'instant).

## Sécurité
- Mots de passe : jamais en clair (PBKDF2 + sel). Sessions : cookie HttpOnly, 30 jours.
- Les prix sont vérifiés côté serveur (catalogue dans `[[path]].js`) : si tu changes un prix sur le site, change-le aussi dans le catalogue.
- La clé d'administration n'est stockée qu'en empreinte dans la base. Si tu la perds, demande-moi d'en créer une nouvelle.

## Limites actuelles
- Pas d'e-mail automatique (confirmation, mot de passe oublié) ni de livraison automatique du PDF : prévu pour une v23 (service d'e-mail gratuit + stockage R2).
- Vérifie ta situation légale avant de vendre régulièrement (je ne suis pas juriste).

## v45 : langues, référencement, newsletter

- **Pages EN/ES réelles** : `site/en/*` et `site/es/*` sont générées à partir des pages françaises (Google peut les indexer, avec les balises hreflang). **Après toute modification d'une page française**, relancer depuis le dossier `tools` (fourni à part dans `Outils-generation-langues.zip`, à dézipper à côté de `site`) :
  `python3 build_i18n.py && python3 build_langs.py` (nécessite Python + Playwright/Chromium). Cela régénère aussi le `<head>` SEO (titres, descriptions, données structurées) et `sitemap.xml`.
- Titres et descriptions SEO : `tools/seo.py`. Traductions : `tools/en.json`, `tools/es.json`, `tools/extras.py`.
- **Chaîne WhatsApp (newsletter)** : le lien de la chaîne est dans `site/script.js`, ligne `window.HC_NEWSLETTER_URL`. Elle est déjà renseignée (chaîne « Hybride Coaching · Newsletter de la semaine »).
- **À faire côté Google** : ajouter le site dans Google Search Console (propriété « sportifhybride.com »), y envoyer `https://sportifhybride.com/sitemap.xml`, mettre le lien du site dans la bio Instagram / TikTok / YouTube / LinkedIn / Strava, et ajouter le lien d'avis Google quand la fiche sera validée.

## v47
- Sous-programmes : bouton « En savoir plus », deux formules (sans suivi = prix affiché, avec suivi = +5 €), Home Body ajouté.
- Serveur : `functions/api/[[path]].js` contient les nouveaux prix (clés « … + suivi », Home Body, Nutrition seul 10 €).
- Création de site : rubrique à part (menu après Outils, bandeaux, pied de page).
- Pages légales réécrites ; `_headers` renforcé (CSP, HSTS…).

## Avis clients, envoi par e-mail, revenus (v67-v68)
- /admin (clé d'administration) : Commandes (dates de début/fin), Relances d'avis (après la fin du programme), Revenus (compteur + autres revenus), Par programme, Avis (à valider), Codes d'avis.
- Le code d'avis (AV-XXXX-XXXX, usage unique, sans date limite) se crée quand tu cliques « Payée ».
- Tous les récapitulatifs partent par e-mail. Envoi automatique (gratuit) via Resend : variables RESEND_API_KEY et MAIL_FROM (ex. `Victor <contact@sportifhybride.com>`, domaine à vérifier chez Resend) dans Pages → Settings → Variables and Secrets. Sans elles, utilise le bouton E-mail de /admin.
- Le compteur démarre avec 140 € (site Pro + déjà vendu), ajouté une seule fois.

## Connexion à /admin (v349)
- Première visite sur /admin : le site te demande de créer ton mot de passe (10 caractères minimum). Ouvre /admin tout de suite après le déploiement. Ensuite, onglet « Paramètres » pour le changer.
- Double vérification facultative : si `ADMIN_EMAIL`, `RESEND_API_KEY` et `MAIL_FROM` sont définis dans Pages → Settings → Variables and Secrets, un code à 3 chiffres est envoyé par e-mail après le mot de passe. Si l'envoi échoue, supprime `ADMIN_EMAIL` le temps de réparer.
- Variante : si la variable `ADMIN_PASSWORD` existe, elle remplace le mot de passe de la base (et se change dans Cloudflare).
