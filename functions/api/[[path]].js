/* Serveur du site Hybride Coaching (Cloudflare Pages Functions + base D1)
   Toutes les routes commencent par /api/ . La base de donnees est liee sous le nom DB. */

const CATALOG = {
  "Formation PDF - Création de site": 15,
  "Performance en salle de musculation": 20,
  "Performance à la maison ou en extérieur": 20,
  "Nutrition seul": 10,
  "Nutrition avec accompagnement": 5,
  "Détente en salle de musculation": 15,
  "Détente à la maison ou en extérieur": 15,
  "Bench": 15,
  "Deadlift": 15,
  "Squat": 15,
  "Sbd Powerlifting": 20,
  "3 Fois Full": 15,
  "Gym Bro": 15,
  "Le Double Double": 15,
  "Jambe De Fer": 15,
  "Popeye": 15,
  "Home Body": 15,
  "Détente en salle de musculation + suivi": 20,
  "Détente à la maison ou en extérieur + suivi": 20,
  "Performance en salle de musculation + suivi": 25,
  "Performance à la maison ou en extérieur + suivi": 25,
  "Bench + suivi": 20,
  "Deadlift + suivi": 20,
  "Squat + suivi": 20,
  "Sbd Powerlifting + suivi": 25,
  "3 Fois Full + suivi": 20,
  "Gym Bro + suivi": 20,
  "Le Double Double + suivi": 20,
  "Jambe De Fer + suivi": 20,
  "Popeye + suivi": 20,
  "Home Body + suivi": 20,
  "Coaching sur mesure, 1 mois": 30,
  "Coaching course à pied, 2 mois": 30,
  "Coaching course à pied, 6 mois": 75,
  "Coaching course à pied, saison complète": 120
};

const enc = new TextEncoder();
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100000;
const COOKIE = 'hc_session';

/* ---------- utilitaires ---------- */
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });
}
const b64 = (buf) => { let s = ''; new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b))); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function sha256hex(str) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(str))); }
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function hashPassword(password, saltBytes) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: PBKDF2_ITERATIONS }, key, 256);
  return b64(bits);
}
function getCookie(request, name) {
  const c = request.headers.get('cookie') || '';
  for (const part of c.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}
function cookieHeader(value, maxAge) {
  return `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const validEmail = (e) => /^[^\s@]{1,64}@[^\s@]{1,200}\.[^\s@]{2,}$/.test(e) && e.length <= 150;

async function readBody(request) {
  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new HttpError(415, 'Format de requete invalide.');
  try { return await request.json(); } catch (e) { throw new HttpError(400, 'Requete illisible.'); }
}
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

/* ---------- sessions ---------- */
async function createSession(env, userId) {
  const raw = hex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256hex(raw);
  await env.DB.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`)
    .bind(tokenHash, userId).run();
  return raw;
}
async function currentUser(request, env) {
  const raw = getCookie(request, COOKIE);
  if (!raw || !/^[0-9a-f]{64}$/.test(raw)) return null;
  const tokenHash = await sha256hex(raw);
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.prenom, u.nom, u.tel FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > datetime('now')`).bind(tokenHash).first();
  return row || null;
}
const publicUser = (u) => ({ prenom: u.prenom, nom: u.nom, email: u.email, tel: u.tel || '' });

/* ---------- limitation des essais ---------- */
async function tooManyFails(env, key, max) {
  const since = Date.now() - 15 * 60 * 1000;
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_fails WHERE email = ? AND ts > ?').bind(key, since).first();
  return (r?.n || 0) >= max;
}
async function addFail(env, key) {
  await env.DB.prepare('INSERT INTO login_fails (email, ts) VALUES (?, ?)').bind(key, Date.now()).run();
  if (Math.random() < 0.05) await env.DB.prepare('DELETE FROM login_fails WHERE ts < ?').bind(Date.now() - 24 * 3600 * 1000).run();
}

/* ---------- administration ---------- */
async function checkAdmin(env, key) {
  if (await tooManyFails(env, '__admin__', 10)) throw new HttpError(429, 'Trop d’essais. Reessaie dans 15 minutes.');
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'admin_key_hash'").first();
  const ok = row && typeof key === 'string' && safeEqual(row.value, await sha256hex(key));
  if (!ok) { await addFail(env, '__admin__'); throw new HttpError(401, 'Cle incorrecte.'); }
}

/* ---------- routes ---------- */
async function register(request, env) {
  const b = await readBody(request);
  const prenom = clean(b.prenom, 60), nom = clean(b.nom, 60), tel = clean(b.tel, 30);
  const email = clean(b.email, 150).toLowerCase(), password = String(b.password ?? '');
  if (!prenom || !nom) throw new HttpError(400, 'Renseigne ton prenom et ton nom.');
  if (!validEmail(email)) throw new HttpError(400, 'Renseigne une adresse email valide.');
  if (password.length < 8 || password.length > 100) throw new HttpError(400, 'Le mot de passe doit contenir entre 8 et 100 caracteres.');
  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (exists) throw new HttpError(409, 'Un compte existe deja avec cet email. Connecte-toi.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);
  const res = await env.DB.prepare('INSERT INTO users (email, prenom, nom, tel, pass_hash, salt) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(email, prenom, nom, tel, hash, b64(salt)).run();
  const userId = res.meta.last_row_id;
  const token = await createSession(env, userId);
  return json({ ok: true, user: { prenom, nom, email, tel } }, 200, { 'set-cookie': cookieHeader(token, SESSION_DAYS * 86400) });
}

async function login(request, env) {
  const b = await readBody(request);
  const email = clean(b.email, 150).toLowerCase(), password = String(b.password ?? '');
  if (!validEmail(email) || !password) throw new HttpError(400, 'Renseigne ton email et ton mot de passe.');
  if (await tooManyFails(env, email, 8)) throw new HttpError(429, 'Trop d’essais. Reessaie dans 15 minutes.');
  const u = await env.DB.prepare('SELECT id, email, prenom, nom, tel, pass_hash, salt FROM users WHERE email = ?').bind(email).first();
  const salt = u ? unb64(u.salt) : crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);
  if (!u || !safeEqual(hash, u.pass_hash)) {
    await addFail(env, email);
    throw new HttpError(401, 'Email ou mot de passe incorrect.');
  }
  await env.DB.prepare('DELETE FROM login_fails WHERE email = ?').bind(email).run();
  const token = await createSession(env, u.id);
  return json({ ok: true, user: publicUser(u) }, 200, { 'set-cookie': cookieHeader(token, SESSION_DAYS * 86400) });
}

async function logout(request, env) {
  const raw = getCookie(request, COOKIE);
  if (raw && /^[0-9a-f]{64}$/.test(raw)) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256hex(raw)).run();
  }
  return json({ ok: true }, 200, { 'set-cookie': cookieHeader('', 0) });
}

async function me(request, env) {
  const u = await currentUser(request, env);
  if (!u) return json({ user: null, orders: [] });
  const { results } = await env.DB.prepare(
    'SELECT ref, produit, prix_eur, methode, status, created_at, paid_at FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 200').bind(u.id).all();
  return json({ user: publicUser(u), orders: results });
}

async function deleteAccount(request, env) {
  const u = await currentUser(request, env);
  if (!u) throw new HttpError(401, 'Connecte-toi.');
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(u.id).run();
  await env.DB.prepare('UPDATE orders SET user_id = NULL, client_prenom = ?, client_nom = ?, client_tel = ?, client_email = ? WHERE user_id = ?')
    .bind(u.prenom, u.nom, u.tel || '', u.email, u.id).run();
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(u.id).run();
  return json({ ok: true }, 200, { 'set-cookie': cookieHeader('', 0) });
}

async function createOrder(request, env) {
  const b = await readBody(request);
  const produit = clean(b.produit, 120);
  if (!Object.prototype.hasOwnProperty.call(CATALOG, produit)) throw new HttpError(400, 'Programme inconnu.');
  const prix = CATALOG[produit];
  const methode = ['paypal', 'revolut', 'virement'].includes(b.methode) ? b.methode : null;
  const u = await currentUser(request, env);
  let c;
  if (u) {
    c = { prenom: u.prenom, nom: u.nom, tel: u.tel || '', email: u.email };
  } else {
    const g = b.client || {};
    c = { prenom: clean(g.prenom, 60), nom: clean(g.nom, 60), tel: clean(g.tel, 30), email: clean(g.email, 150).toLowerCase() };
    if (!c.prenom || !c.nom || !validEmail(c.email)) throw new HttpError(400, 'Renseigne ton prenom, ton nom et un email valide.');
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE client_email = ? AND created_at > datetime('now','-1 hour')").bind(c.email).first();
    if ((r?.n || 0) >= 10) throw new HttpError(429, 'Trop de commandes en peu de temps.');
  }
  const tmp = 'T' + hex(crypto.getRandomValues(new Uint8Array(6)));
  const ins = await env.DB.prepare(
    'INSERT INTO orders (ref, user_id, produit, prix_eur, methode, client_prenom, client_nom, client_tel, client_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(tmp, u ? u.id : null, produit, prix, methode, c.prenom, c.nom, c.tel, c.email).run();
  const id = ins.meta.last_row_id;
  const ref = 'HC-' + String(id).padStart(5, '0');
  await env.DB.prepare('UPDATE orders SET ref = ? WHERE id = ?').bind(ref, id).run();
  return json({ ok: true, ref, produit, prix_eur: prix });
}

async function adminOrders(request, env) {
  const b = await readBody(request);
  await checkAdmin(env, b.key);
  const { results } = await env.DB.prepare(
    `SELECT o.id, o.ref, o.produit, o.prix_eur, o.methode, o.status, o.created_at, o.paid_at, o.client_prenom, o.client_nom, o.client_tel, o.client_email, o.user_id,
            rc.code AS code, rc.used_at AS code_used
     FROM orders o LEFT JOIN review_codes rc ON rc.order_id = o.id ORDER BY o.id DESC LIMIT 500`).all();
  return json({ orders: results });
}

/* ---------- codes d'avis (usage unique) ---------- */
const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode() {
  const a = crypto.getRandomValues(new Uint8Array(8));
  let t = '';
  for (const x of a) t += CODE_ALPHA[x % 32];
  return 'AV-' + t.slice(0, 4) + '-' + t.slice(4);
}
async function insertCode(env, orderId, note) {
  for (let i = 0; i < 6; i++) {
    const c = genCode();
    try { await env.DB.prepare('INSERT INTO review_codes (code, order_id, note) VALUES (?, ?, ?)').bind(c, orderId, note || null).run(); return c; }
    catch (e) { /* collision improbable : on retente */ }
  }
  throw new Error('code non genere');
}
async function codeForOrder(env, orderId) {
  const ex = await env.DB.prepare('SELECT code FROM review_codes WHERE order_id = ?').bind(orderId).first();
  return ex ? ex.code : await insertCode(env, orderId, null);
}
function normCode(v) {
  const r = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (r.length === 10 && r.startsWith('AV')) ? 'AV-' + r.slice(2, 6) + '-' + r.slice(6) : '';
}


/* ---------- envoi automatique du recapitulatif (actif seulement si les cles sont configurees) ---------- */
const PAYLBL = { paypal: 'PayPal', revolut: 'Revolut', virement: 'Virement bancaire' };
function parisDate(sqlUtc) {
  if (!sqlUtc) return '';
  const d = new Date(String(sqlUtc).replace(' ', 'T') + 'Z');
  if (isNaN(d)) return String(sqlUtc);
  return d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' à');
}
function e164(t) {
  let d = String(t || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d[0] === '+') return '+' + d.slice(1).replace(/\D/g, '');
  if (d.startsWith('00')) return '+' + d.slice(2);
  if (d.length === 10 && d[0] === '0') return '+33' + d.slice(1);
  if (d.length === 9) return '+33' + d;
  return '+' + d.replace(/\D/g, '');
}
const noAccent = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").replace(/[^\x20-\x7E\n]/g, ' ');
function recapText(o, code, site) {
  return ['Bonjour ' + (o.client_prenom || '') + ',', '', 'Merci pour ta commande chez Hybride Coaching !', '',
    'RÉCAPITULATIF DE COMMANDE', 'Référence : ' + o.ref, 'Produit : ' + o.produit, 'Prix : ' + o.prix_eur + ' €',
    'Mode de paiement : ' + (PAYLBL[o.methode] || o.methode || '-'),
    'Commande passée le : ' + parisDate(o.created_at), 'Paiement confirmé le : ' + parisDate(o.paid_at), '',
    'Ton code pour laisser un avis (usage unique) : ' + code, 'Tu peux le saisir ici : ' + site + '/avis.html', '',
    'Victor Castillo · Hybride Coaching'].join('\n');
}
function recapSms(o, code, site) {
  return noAccent('Hybride Coaching : commande ' + o.ref + ' (' + o.produit + ') ' + o.prix_eur + ' EUR, payee le ' + parisDate(o.paid_at) + ' (' + (PAYLBL[o.methode] || o.methode || '-') + '). Code avis (usage unique) : ' + code + ' sur ' + site.replace('https://', '') + '/avis.html');
}
/* regle : telephone si fourni (SMS), sinon e-mail */
async function sendRecap(env, o, code, origin) {
  const site = 'https://sportifhybride.com';
  try {
    if (o.client_tel && env.TWILIO_SID && env.TWILIO_TOKEN && (env.TWILIO_FROM || env.TWILIO_SERVICE)) {
      const f = new URLSearchParams({ To: e164(o.client_tel), Body: recapSms(o, code, site) });
      if (env.TWILIO_SERVICE) f.set('MessagingServiceSid', env.TWILIO_SERVICE); else f.set('From', env.TWILIO_FROM);
      const r = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + env.TWILIO_SID + '/Messages.json', {
        method: 'POST', headers: { authorization: 'Basic ' + btoa(env.TWILIO_SID + ':' + env.TWILIO_TOKEN), 'content-type': 'application/x-www-form-urlencoded' }, body: f });
      return r.ok ? { sent: 'sms' } : { sent: null, error: 'SMS refusé (' + r.status + ')' };
    }
    if (!o.client_tel && o.client_email && env.RESEND_API_KEY && env.MAIL_FROM) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ from: env.MAIL_FROM, to: [o.client_email], subject: 'Ta commande ' + o.ref + ' · Hybride Coaching', text: recapText(o, code, site) }) });
      return r.ok ? { sent: 'email' } : { sent: null, error: 'E-mail refusé (' + r.status + ')' };
    }
    return { sent: null };
  } catch (e) { return { sent: null, error: 'Envoi impossible' }; }
}

async function adminMark(request, env) {
  const b = await readBody(request);
  await checkAdmin(env, b.key);
  const status = String(b.status);
  if (!['en_attente', 'payee', 'annulee'].includes(status)) throw new HttpError(400, 'Statut invalide.');
  const id = parseInt(b.id, 10);
  if (!Number.isInteger(id)) throw new HttpError(400, 'Commande invalide.');
  const before = await env.DB.prepare('SELECT status FROM orders WHERE id = ?').bind(id).first();
  if (!before) throw new HttpError(404, 'Commande introuvable.');
  await env.DB.prepare(`UPDATE orders SET status = ?, paid_at = CASE WHEN ? = 'payee' THEN COALESCE(paid_at, datetime('now')) ELSE NULL END WHERE id = ?`)
    .bind(status, status, id).run();
  let code = null, sent = null, sendError = null;
  if (status === 'payee') {
    code = await codeForOrder(env, id);
    if (before.status !== 'payee') {
      const o = await env.DB.prepare('SELECT ref, produit, prix_eur, methode, created_at, paid_at, client_prenom, client_tel, client_email FROM orders WHERE id = ?').bind(id).first();
      const r = await sendRecap(env, o, code);
      sent = r.sent; sendError = r.error || null;
    }
  } else await env.DB.prepare('DELETE FROM review_codes WHERE order_id = ? AND used_at IS NULL').bind(id).run();
  return json({ ok: true, code, sent, sendError });
}

async function adminCodeNew(request, env) {
  const b = await readBody(request);
  await checkAdmin(env, b.key);
  const code = await insertCode(env, null, clean(b.note, 100));
  return json({ ok: true, code });
}
async function adminCodes(request, env) {
  const b = await readBody(request);
  await checkAdmin(env, b.key);
  const { results } = await env.DB.prepare(
    `SELECT rc.code, rc.note, rc.created_at, rc.used_at, o.ref FROM review_codes rc LEFT JOIN orders o ON o.id = rc.order_id ORDER BY rc.id DESC LIMIT 500`).all();
  return json({ codes: results });
}
async function adminReviews(request, env) {
  const b = await readBody(request);
  await checkAdmin(env, b.key);
  const { results } = await env.DB.prepare(
    `SELECT id, prenom, nom, age, programme, rating, comment, status, created_at FROM reviews ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, id DESC LIMIT 500`).all();
  return json({ reviews: results });
}
async function adminReviewSet(request, env) {
  const b = await readBody(request);
  await checkAdmin(env, b.key);
  const id = parseInt(b.id, 10);
  if (!Number.isInteger(id)) throw new HttpError(400, 'Avis invalide.');
  const act = String(b.action);
  if (act === 'delete') await env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
  else if (act === 'publish') await env.DB.prepare("UPDATE reviews SET status = 'published' WHERE id = ?").bind(id).run();
  else if (act === 'reject') await env.DB.prepare("UPDATE reviews SET status = 'rejected' WHERE id = ?").bind(id).run();
  else throw new HttpError(400, 'Action invalide.');
  return json({ ok: true });
}

/* ---------- avis publics ---------- */
async function publicReviews(env) {
  const { results } = await env.DB.prepare(
    `SELECT prenom, nom, age, programme, rating, comment, created_at FROM reviews WHERE status = 'published' ORDER BY id DESC LIMIT 100`).all();
  return json({ reviews: results.map((r) => ({ prenom: r.prenom, nom: (r.nom || '').slice(0, 1).toUpperCase() + '.', age: r.age, programme: r.programme, rating: r.rating, comment: r.comment, date: String(r.created_at || '').slice(0, 10) })) });
}
async function postReview(request, env) {
  const b = await readBody(request);
  if (b.website) return json({ ok: true });
  const ip = request.headers.get('cf-connecting-ip') || 'ip';
  const key = 'rv:' + ip;
  if (await tooManyFails(env, key, 8)) throw new HttpError(429, 'Trop d’essais. Reessaie dans 15 minutes.');
  const prenom = clean(b.prenom, 40), nom = clean(b.nom, 40), programme = clean(b.programme, 80);
  const age = parseInt(b.age, 10), rating = parseInt(b.rating, 10);
  const comment = clean(b.comment, 1200);
  const code = normCode(b.code);
  if (!prenom || !nom) throw new HttpError(400, 'Renseigne ton prénom et ton nom.');
  if (!Number.isInteger(age) || age < 10 || age > 99) throw new HttpError(400, 'Renseigne ton âge.');
  if (!programme) throw new HttpError(400, 'Choisis le programme concerné.');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Choisis une note de 1 à 5 étoiles.');
  if (comment.length < 10) throw new HttpError(400, 'Écris un commentaire (au moins 10 caractères).');
  if (!code) { await addFail(env, key); throw new HttpError(400, 'Code invalide ou déjà utilisé.'); }
  const row = await env.DB.prepare('SELECT id FROM review_codes WHERE code = ?').bind(code).first();
  const claim = row ? await env.DB.prepare("UPDATE review_codes SET used_at = datetime('now') WHERE id = ? AND used_at IS NULL").bind(row.id).run() : null;
  if (!claim || claim.meta.changes !== 1) { await addFail(env, key); throw new HttpError(400, 'Code invalide ou déjà utilisé.'); }
  try {
    await env.DB.prepare('INSERT INTO reviews (code_id, prenom, nom, age, programme, rating, comment) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(row.id, prenom, nom, age, programme, rating, comment).run();
  } catch (e) {
    await env.DB.prepare('UPDATE review_codes SET used_at = NULL WHERE id = ?').bind(row.id).run();
    throw e;
  }
  return json({ ok: true });
}

/* ---------- base : creation automatique des tables manquantes (sans effet si elles existent deja) ---------- */
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, prenom TEXT NOT NULL, nom TEXT NOT NULL, tel TEXT, pass_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)",
  "CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT NOT NULL UNIQUE, user_id INTEGER, produit TEXT NOT NULL, prix_eur INTEGER NOT NULL, methode TEXT, status TEXT NOT NULL DEFAULT 'en_attente', client_prenom TEXT, client_nom TEXT, client_tel TEXT, client_email TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), paid_at TEXT, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL)",
  "CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)",
  "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS login_fails (email TEXT NOT NULL, ts INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_fails ON login_fails(email, ts)",
  "CREATE TABLE IF NOT EXISTS review_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, order_id INTEGER, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), used_at TEXT)",
  "CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, code_id INTEGER, prenom TEXT NOT NULL, nom TEXT NOT NULL, age INTEGER, programme TEXT NOT NULL, rating INTEGER NOT NULL, comment TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status)"
];
let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  try { await env.DB.batch(SCHEMA.map((q) => env.DB.prepare(q))); schemaReady = true; }
  catch (e) { console.error('ensureSchema', e && e.message); }
}

const path_for_log = (r) => { try { return new URL(r.url).pathname; } catch (e) { return ''; } };

/* ---------- point d'entree ---------- */
export async function onRequest(context) {
  const { request, env, params } = context;
  try {
    if (!env.DB) throw new HttpError(500, 'Base de donnees non liee au site.');
    await ensureSchema(env);
    const path = '/' + (Array.isArray(params.path) ? params.path.join('/') : params.path || '');
    const method = request.method;

    if (method === 'POST') {
      const origin = request.headers.get('origin');
      if (origin && new URL(origin).host !== new URL(request.url).host) throw new HttpError(403, 'Origine refusee.');
    }
    if (method === 'GET' && path === '/me') return await me(request, env);
    if (method === 'GET' && path === '/reviews') return await publicReviews(env);
    if (method === 'POST') {
      if (path === '/register') return await register(request, env);
      if (path === '/login') return await login(request, env);
      if (path === '/logout') return await logout(request, env);
      if (path === '/orders') return await createOrder(request, env);
      if (path === '/account/delete') return await deleteAccount(request, env);
      if (path === '/admin/orders') return await adminOrders(request, env);
      if (path === '/admin/mark') return await adminMark(request, env);
      if (path === '/review') return await postReview(request, env);
      if (path === '/admin/code') return await adminCodeNew(request, env);
      if (path === '/admin/codes') return await adminCodes(request, env);
      if (path === '/admin/reviews') return await adminReviews(request, env);
      if (path === '/admin/review-set') return await adminReviewSet(request, env);
    }
    throw new HttpError(404, 'Introuvable.');
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('API error', path_for_log(request), e && e.message);
    const m = String((e && e.message) || '');
    /* DIAGNOSTIC TEMPORAIRE : affiche la cause reelle (a retirer une fois le probleme regle) */
    const hint = m ? ' [diagnostic : ' + m.slice(0, 160) + ']' : '';
    return json({ error: 'Erreur du serveur. Reessaie dans un instant.' + hint }, 500);
  }
}
