
/* ---------- moteur ---------- */
(function(){
  var LANGS = ['fr','en','es'];
  var LABEL = {fr:'FR — Français', en:'EN — English', es:'ES — Español'};
  var CODE  = {fr:'FR', en:'EN', es:'ES'};
  var SKIP = {SCRIPT:1,STYLE:1,NOSCRIPT:1,CODE:1,PRE:1};
  var ATTRS = ['alt','placeholder','title','aria-label'];
  var lang = 'fr';
  var recs = new WeakMap();      // noeud texte -> {fr,out}
  var arec = new WeakMap();      // element -> {attr:{fr,out}}
  var RX = {};
  LANGS.forEach(function(l){ RX[l] = (window.HC_I18N.rx[l]||[]).map(function(r){ return [new RegExp(r[0],'g'), r[1]]; }); });

  function tr(fr, l){
    if(l==='fr') return fr;
    var lead = fr.match(/^\s*/)[0], tail = fr.match(/\s*$/)[0], core = fr.trim();
    if(!core) return fr;
    var d = window.HC_I18N[l], hit = d[core];
    if(hit !== undefined) return lead + hit + tail;
    var out = core, ch = false;
    RX[l].forEach(function(r){ var o = out.replace(r[0], r[1]); if(o!==out){ out=o; ch=true; } });
    return ch ? lead + out + tail : fr;
  }
  window.hcT = function(fr){ return tr(fr, lang); };

  function doText(n){
    var v = n.nodeValue, rec = recs.get(n);
    if(!rec){ if(!v || !v.trim()) return; rec = {fr:v, out:v, l:'fr'}; recs.set(n, rec); }
    else if(v !== rec.out){ rec.fr = v; }
    else if(rec.l === lang) return;
    var out = tr(rec.fr, lang); rec.out = out; rec.l = lang;
    if(v !== out) n.nodeValue = out;
  }

  function doAttrs(el){
    var rec = arec.get(el); if(!rec){ rec = {}; arec.set(el, rec); }
    ATTRS.forEach(function(a){
      if(!el.hasAttribute(a)) return;
      var cur = el.getAttribute(a), r = rec[a];
      if(!r){ if(!cur.trim()) return; r = rec[a] = {fr:cur, out:cur}; }
      else if(cur !== r.out){ r.fr = cur; }
      var out = tr(r.fr, lang); r.out = out;
      if(cur !== out) el.setAttribute(a, out);
    });
  }

  function walk(root){
    if(!root) return;
    if(root.nodeType === 3){ if(!SKIP[root.parentNode && root.parentNode.nodeName] && !(root.parentNode && root.parentNode.closest && root.parentNode.closest('.lang'))) doText(root); return; }
    if(root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if(root.nodeType === 1){
      if(SKIP[root.nodeName] || root.closest('.lang')) return;
      doAttrs(root);
    }
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function(n){
        if(n.nodeType === 1){
          if(SKIP[n.nodeName] || (n.classList && n.classList.contains('lang'))) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while((n = w.nextNode())){ if(n.nodeType === 3) doText(n); else doAttrs(n); }
  }

  var meta = {};
  function doHead(){
    var d = document.querySelector('meta[name=description]');
    if(d){ if(meta.d === undefined || d.content !== meta.dOut) meta.d = d.content; var o = tr(meta.d, lang); meta.dOut = o; d.content = o; }
    var og = document.querySelectorAll('meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]');
    og.forEach(function(m){ if(!m._fr) m._fr = m.content; m.content = tr(m._fr, lang); });
    if(meta.t === undefined || document.title !== meta.tOut) meta.t = document.title;
    var t = tr(meta.t, lang); meta.tOut = t; document.title = t;
  }

  var obs = null, busy = false;
  function startObs(){
    if(obs) return;
    obs = new MutationObserver(function(list){
      if(lang === 'fr' && !hasRecs) { /* rien a faire */ }
      list.forEach(function(m){
        if(m.type === 'childList'){ m.addedNodes.forEach(function(n){ walk(n); }); }
        else if(m.type === 'characterData'){ walk(m.target); }
        else if(m.type === 'attributes'){ doAttrs(m.target); }
      });
    });
    obs.observe(document.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:ATTRS});
  }
  var hasRecs = true;

  function setLang(l, silent){
    if(LANGS.indexOf(l) < 0) l = 'fr';
    lang = l;
    walk(document.body);
    doHead();
    document.documentElement.lang = l;
    try{ localStorage.setItem('hc-lang', l); }catch(e){}
    document.querySelectorAll('.lang').forEach(function(box){ refreshUI(box); });
    window.dispatchEvent(new CustomEvent('hc-lang', {detail:l}));
  }
  var STATIC = ['index','programmes','coaching','force','detente','performance-athletique','musculation','nutrition','creation-site','avis','parcours','outils','faq','contact','mentions-legales','cgv','confidentialite','cookies'];
  function slugOf(){
    var p = location.pathname.replace(/^\/(en|es)(?=\/|$)/,'').replace(/\.html$/,'').replace(/^\/+|\/+$/g,'');
    if(p === 'resultats') p = 'avis';
    return p || 'index';
  }
  function pathFor(l, slug){ var pre = l === 'fr' ? '' : '/' + l; return slug === 'index' ? (pre || '') + '/' : pre + '/' + slug; }
  function choose(l){
    var slug = slugOf();
    if(STATIC.indexOf(slug) >= 0 && !window.HC_BUILD){
      try{ localStorage.setItem('hc-lang', l); }catch(e){}
      var target = pathFor(l, slug);
      if(location.pathname.replace(/\.html$/,'') !== target) { location.href = target + location.hash; return; }
    }
    setLang(l);
  }
  window.hcSetLang = setLang;
  window.hcLang = function(){ return lang; };

  /* ---------- menu deroulant ---------- */
  var uid = 0;
  function buildUI(box){
    var id = 'hclang' + (++uid);
    box.innerHTML =
      '<button type="button" class="langbtn" aria-haspopup="listbox" aria-expanded="false" aria-controls="'+id+'" aria-label="Language / Langue / Idioma">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3c2.6 2.6 4 5.7 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.7-4-9s1.4-6.4 4-9z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>' +
        '<span class="langcode"></span>' +
        '<svg class="langchev" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</button>' +
      '<ul class="langmenu" id="'+id+'" role="listbox" hidden>' +
        LANGS.map(function(l){ return '<li role="option" data-lang="'+l+'" tabindex="-1"><span class="langtxt">'+LABEL[l]+'</span><svg class="langok" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></li>'; }).join('') +
      '</ul>';
    var btn = box.querySelector('.langbtn'), menu = box.querySelector('.langmenu');
    function open(o){
      menu.hidden = !o; btn.setAttribute('aria-expanded', o ? 'true' : 'false'); box.classList.toggle('open', o);
      if(o){ var cur = menu.querySelector('[aria-selected="true"]'); if(cur) cur.focus(); }
    }
    btn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); open(menu.hidden); });
    menu.addEventListener('click', function(e){
      var li = e.target.closest('li'); if(!li) return;
      e.preventDefault(); e.stopPropagation();
      choose(li.getAttribute('data-lang')); open(false); btn.focus();
    });
    box.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){ open(false); btn.focus(); return; }
      var items = Array.prototype.slice.call(menu.querySelectorAll('li'));
      var i = items.indexOf(document.activeElement);
      if(e.key === 'ArrowDown'){ e.preventDefault(); if(menu.hidden) open(true); else items[(i+1)%items.length].focus(); }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); if(!menu.hidden) items[(i-1+items.length)%items.length].focus(); }
      else if((e.key === 'Enter' || e.key === ' ') && i >= 0){ e.preventDefault(); choose(items[i].getAttribute('data-lang')); open(false); btn.focus(); }
    });
    document.addEventListener('click', function(e){ if(!box.contains(e.target)) open(false); });
    refreshUI(box);
  }
  function refreshUI(box){
    var c = box.querySelector('.langcode'); if(c) c.textContent = CODE[lang];
    box.querySelectorAll('li').forEach(function(li){
      var on = li.getAttribute('data-lang') === lang;
      li.setAttribute('aria-selected', on ? 'true' : 'false');
      li.classList.toggle('on', on);
    });
  }

  function init(){
    document.querySelectorAll('.lang').forEach(buildUI);
    var saved = 'fr', sl = document.documentElement.getAttribute('data-static-lang');
    try{
      var q = /[?&]lang=(fr|en|es)\b/.exec(location.search);
      saved = q ? q[1] : (localStorage.getItem('hc-lang') || 'fr');
    }catch(e){}
    if(sl){ saved = sl; }
    else if(saved !== 'fr' && !window.HC_BUILD && STATIC.indexOf(slugOf()) >= 0){
      location.replace(pathFor(saved, slugOf()) + location.hash); return;
    }
    startObs();
    setLang(saved);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
