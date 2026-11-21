(function(){
  var KEY='', ORD=[];
  var SITE='https://sportifhybride.com';
  var $=function(i){return document.getElementById(i)};
  function esc(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function call(p,b){b=b||{};b.key=KEY;return fetch(p,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'Erreur');return d},function(){throw new Error('Réponse illisible')})})}
  function toast(t){var d=document.createElement('div');d.className='toast';d.textContent=t;document.body.appendChild(d);setTimeout(function(){d.remove()},2200)}
  function dt(s){if(!s)return '';var d=new Date(String(s).replace(' ','T')+'Z');if(isNaN(d))return s;return d.toLocaleString('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',',' à')}
  function num(t){var d=String(t||'').replace(/[^\d+]/g,'');if(!d)return '';if(d.charAt(0)==='+')return d.slice(1).replace(/\D/g,'');if(d.indexOf('00')===0)return d.slice(2);if(d.length===10&&d.charAt(0)==='0')return '33'+d.slice(1);if(d.length===9)return '33'+d;return d.replace(/\D/g,'')}
  var PAY={paypal:'PayPal',revolut:'Revolut',virement:'Virement bancaire'};
  function recap(o){
    return ['Bonjour '+(o.client_prenom||'')+',','','Merci pour ta commande chez Hybride Coaching !','',
      'RÉCAPITULATIF DE COMMANDE',
      'Référence : '+o.ref,
      'Produit : '+o.produit,
      'Prix : '+o.prix_eur+' €',
      'Mode de paiement : '+(PAY[o.methode]||o.methode||'-'),
      'Commande passée le : '+dt(o.created_at),
      'Paiement confirmé le : '+dt(o.paid_at),'',
      'Ton code pour laisser un avis (usage unique) : '+o.code,
      'Tu peux le saisir ici : '+SITE+'/avis.html','',
      'Victor Castillo · Hybride Coaching'].join('\n')
  }
  function msgButtons(o){
    if(o.status!=='payee'||!o.code)return '';
    var m=recap(o),n=num(o.client_tel);
    if(n)return '<a class="abtn" target="_blank" rel="noopener" href="https://wa.me/'+n+'?text='+encodeURIComponent(m)+'">WhatsApp</a><a class="abtn" href="sms:+'+n+'?body='+encodeURIComponent(m)+'">SMS</a><button data-copy="'+o.id+'">Copier</button>';
    if(o.client_email)return '<a class="abtn" href="mailto:'+encodeURIComponent(o.client_email).replace('%40','@')+'?subject='+encodeURIComponent('Ta commande '+o.ref+' · Hybride Coaching')+'&body='+encodeURIComponent(m)+'">E-mail</a><button data-copy="'+o.id+'">Copier</button>';
    return '<button data-copy="'+o.id+'">Copier</button>';
  }
  function stats(){
    var p=ORD.filter(function(o){return o.status==='payee'}),w=ORD.filter(function(o){return o.status==='en_attente'});
    var ca=p.reduce(function(a,o){return a+o.prix_eur},0);
    var mois=new Date().toISOString().slice(0,7),cm=p.filter(function(o){return String(o.paid_at||'').slice(0,7)===mois}).reduce(function(a,o){return a+o.prix_eur},0);
    $('stats').innerHTML='<div class="stat"><b>'+ORD.length+'</b><span>commandes</span></div><div class="stat"><b>'+p.length+'</b><span>payées</span></div><div class="stat"><b>'+w.length+'</b><span>en attente</span></div><div class="stat"><b>'+ca+' €</b><span>encaissé au total</span></div><div class="stat"><b>'+cm+' €</b><span>encaissé ce mois-ci</span></div>';
  }
  function drawOrders(){
    stats();
    $('rows').innerHTML=ORD.map(function(o){
      var cl=esc((o.client_prenom||'')+' '+(o.client_nom||''))+'<br>'+esc(o.client_email||'')+'<br>'+esc(o.client_tel||'');
      var code=o.code?'<span class="code">'+esc(o.code)+'</span><br><small>'+(o.code_used?'utilisé':'non utilisé')+'</small>':'-';
      return '<tr><td>'+esc(o.ref)+'</td><td>'+esc(dt(o.created_at))+'</td><td>'+esc(o.produit)+'</td><td>'+o.prix_eur+' €</td><td>'+esc(o.methode||'-')+'</td><td>'+cl+'</td><td><b>'+esc(o.status)+'</b>'+(o.paid_at?'<br>'+esc(dt(o.paid_at)):'')+'</td><td>'+code+'</td>'
        +'<td><button data-id="'+o.id+'" data-st="payee">Payée ✓</button><button data-id="'+o.id+'" data-st="en_attente">En attente</button><button data-id="'+o.id+'" data-st="annulee">Annuler</button><br>'+msgButtons(o)+'</td></tr>';
    }).join('')||'<tr><td colspan="9">Aucune commande.</td></tr>';
  }
  function loadOrders(){return call('/api/admin/orders').then(function(d){$('login').hidden=true;$('panel').hidden=false;ORD=d.orders;drawOrders()}).catch(function(e){$('err').textContent=e.message})}
  function stars(n){return '★★★★★☆☆☆☆☆'.slice(5-n,10-n)}
  function loadReviews(){return call('/api/admin/reviews').then(function(d){
    var p=d.reviews.filter(function(r){return r.status==='pending'}).length;$('pendN').textContent=p?'('+p+')':'';
    $('revs').innerHTML=d.reviews.map(function(r){
      return '<div class="rv'+(r.status==='pending'?' pend':'')+'"><b>'+esc(r.prenom+' '+r.nom)+', '+r.age+' ans</b> · '+esc(r.programme)+' · <span style="color:#ffb400">'+stars(r.rating)+'</span> · <i>'+esc(r.status==='pending'?'à valider':r.status==='published'?'publié':'refusé')+'</i> · '+esc(dt(r.created_at))
        +'<p>'+esc(r.comment)+'</p><button data-rv="'+r.id+'" data-act="publish">Publier</button><button data-rv="'+r.id+'" data-act="reject">Refuser</button><button data-rv="'+r.id+'" data-act="delete">Supprimer</button></div>';
    }).join('')||'<p class="muted">Aucun avis pour le moment.</p>';
  })}
  function loadCodes(){return call('/api/admin/codes').then(function(d){
    $('codes').innerHTML=d.codes.map(function(c){return '<tr><td><span class="code">'+esc(c.code)+'</span></td><td>'+esc(c.ref||c.note||'-')+'</td><td>'+esc(dt(c.created_at))+'</td><td>'+(c.used_at?esc(dt(c.used_at)):'non')+'</td></tr>'}).join('')||'<tr><td colspan="4">Aucun code.</td></tr>';
  })}
  function tab(n){
    [].forEach.call(document.querySelectorAll('[data-tab]'),function(b){b.classList.toggle('on',b.dataset.tab===n)});
    [].forEach.call(document.querySelectorAll('[data-pane]'),function(s){s.hidden=s.dataset.pane!==n});
    if(n==='reviews')loadReviews().catch(function(e){alert(e.message)});
    if(n==='codes')loadCodes().catch(function(e){alert(e.message)});
  }
  function csv(){
    var L=[['Réf','Créée','Produit','Prix','Moyen','Prénom','Nom','Email','Tel','Statut','Payée le','Code avis']];
    ORD.forEach(function(o){L.push([o.ref,o.created_at,o.produit,o.prix_eur,o.methode||'',o.client_prenom,o.client_nom,o.client_email,o.client_tel,o.status,o.paid_at||'',o.code||''])});
    var t=L.map(function(r){return r.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'}).join(';')}).join('\n');
    var a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+t],{type:'text/csv'}));a.download='commandes.csv';document.body.appendChild(a);a.click();a.remove();
  }
  $('go').onclick=function(){KEY=$('key').value.trim();$('key').value='';$('err').textContent='';loadOrders().then(function(){return loadReviews()}).catch(function(){})};
  $('key').onkeydown=function(e){if(e.key==='Enter')$('go').click()};
  $('refresh').onclick=function(){loadOrders()};
  $('csv').onclick=csv;
  document.querySelector('.admtabs').onclick=function(e){var b=e.target.closest('button');if(b)tab(b.dataset.tab)};
  $('newcode').onclick=function(){call('/api/admin/code',{note:$('note').value}).then(function(d){$('note').value='';toast('Code créé : '+d.code);loadCodes()}).catch(function(x){alert(x.message)})};
  $('rows').onclick=function(e){
    var c=e.target.closest('[data-copy]');
    if(c){var o=ORD.filter(function(x){return String(x.id)===c.dataset.copy})[0];if(o&&navigator.clipboard)navigator.clipboard.writeText(recap(o)).then(function(){toast('Message copié')});return}
    var b=e.target.closest('button[data-st]');if(!b)return;
    call('/api/admin/mark',{id:b.dataset.id,status:b.dataset.st}).then(function(d){if(d.sent)toast('Récapitulatif envoyé par '+(d.sent==='sms'?'SMS':'e-mail')+' · code '+d.code);else if(d.code)toast((d.sendError?d.sendError+' · ':'')+'Code d\'avis : '+d.code+' (envoi : utilise les boutons)');return loadOrders()}).catch(function(x){alert(x.message)})
  };
  $('revs').onclick=function(e){var b=e.target.closest('button[data-rv]');if(!b)return;
    if(b.dataset.act==='delete'&&!confirm('Supprimer cet avis définitivement ?'))return;
    call('/api/admin/review-set',{id:b.dataset.rv,action:b.dataset.act}).then(loadReviews).catch(function(x){alert(x.message)})};
})();
