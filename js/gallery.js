// gallery.js — Galerie des systèmes publiés par les joueurs (serveur : worker/index.js, /api/gallery).
// Parcourir et ajouter : pour tout le monde. Publier, retirer, aimer (❤) : avec un compte (account.js).

const GAL = { items: [], timer: 0 };
function galApi(op, body) {
  const a = accGet();
  return fetch('api/gallery', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ op }, a ? { name: a.name, token: a.token } : {}, body || {})) })
    .then(r => r.json().catch(() => ({})).then(j => (r.ok ? j : { error: j.error || (r.status === 404 ? 'galerie indisponible ici (elle marche sur ' + NEW_HOST + ')' : 'erreur ' + r.status), status: r.status })))
    .catch(() => ({ error: 'galerie injoignable' }));
}

// onglets « Mes systèmes » / « Galerie »
function sysTabs(t) { $('sysTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); }
function showGallery() {
  ED.sys = null; ED.ro = null; stopAnim();
  $('sysList').style.display = 'none'; $('sysEdit').style.display = 'none'; $('galView').style.display = '';
  sysTabs('gal');
  galLoad();
}
function galLoad() {
  $('galStatus').textContent = 'Chargement…';
  galApi('list', { kind: $('galKind').value, sort: $('galSort').value, q: $('galQ').value.trim() }).then(j => {
    if (j.error) { $('galItems').innerHTML = ''; $('galStatus').textContent = '⚠️ ' + j.error; return; }
    GAL.items = j.items;
    $('galStatus').textContent = j.items.length ? '' : 'Rien pour l’instant : sois le premier à publier un système !';
    galRender();
  });
}
function galRender() {
  const me = (accGet() || {}).name || '';
  $('galItems').innerHTML = GAL.items.map(e => `<li>
    <span class="kind ${e.kind}">${KIND_LABEL[e.kind] || 'Système'}</span>
    <div class="gi"><b>${esc(e.name)}</b><small>par ${esc(e.by)} · ${esc(e.info || '')}</small></div>
    <button data-a="like" data-id="${e.id}" class="like${e.liked ? ' on' : ''}" title="J’aime">❤ ${e.likes}</button>
    <button data-a="view" data-id="${e.id}">Voir</button>
    <button data-a="add" data-id="${e.id}" class="primary">＋</button>
    ${e.by.toLowerCase() === me.toLowerCase() ? `<button data-a="del" data-id="${e.id}" class="ghost" title="Retirer de la galerie">✕</button>` : ''}
  </li>`).join('');
  $('galItems').querySelectorAll('button').forEach(b => b.onclick = () => {
    const e = GAL.items.find(x => x.id === b.dataset.id); if (!e) return;
    if (b.dataset.a === 'like') galLike(e);
    else if (b.dataset.a === 'view') galGet(e).then(it => it && editSystem(it.sys, it));
    else if (b.dataset.a === 'add') galGet(e).then(it => it && galAdd(it));
    else if (b.dataset.a === 'del') askConfirm(`Retirer « ${e.name} » de la galerie ?`, 'Retirer', () => galUnpublish(e.id));
  });
}
// une publication complète (le système avec ses positions et ses courses)
function galGet(e) {
  return galApi('get', { id: e.id }).then(j => {
    if (j.error) { $('galStatus').textContent = '⚠️ ' + j.error; return null; }
    const it = j.item;
    it.sys = cleanSystem(Object.assign({}, it.sys, { id: sysId(), name: it.name, by: it.by }));
    return it.sys ? it : null;
  });
}
function galLike(e) {
  if (!accGet()) { $('galStatus').textContent = 'Crée un compte (👤 à côté de ton pseudo) pour donner des ❤.'; return; }
  galApi('like', { id: e.id }).then(j => {
    if (j.error) { $('galStatus').textContent = '⚠️ ' + j.error; return; }
    e.likes = j.likes; e.liked = j.liked; galRender();
  });
}
// ajouter une publication à ses systèmes (une copie : la modifier ne change pas l'original)
function galAdd(it) {
  if (!it) return;
  const L = sysList();
  if (L.length >= SYS_MAX) { toast(`Tu as déjà ${SYS_MAX} systèmes : supprimes-en un pour en ajouter.`); return; }
  const s = cleanSystem(Object.assign({}, it.sys, { id: sysId(), pub: undefined }));
  sysSave(L.concat([s]));
  toast(`✅ « ${s.name} » ajouté à tes systèmes`);
  if ($('stratCard').style.display !== 'none' || cardStack.some(x => x.card === 'stratCard')) refreshOptions();
}
// publier (ou mettre à jour) un de ses systèmes
function galPublish(s) {
  if (!accGet()) { toast('Crée un compte (👤 à côté de ton pseudo) pour publier dans la galerie.'); return; }
  galApi('publish', { sys: playOut(s) }).then(j => {
    if (j.error) { toast('⚠️ ' + j.error); return; }
    const L = sysList().map(x => (x.id === s.id ? Object.assign({}, x, { pub: j.id }) : x));
    sysSave(L); showSystems();
    toast(s.pub ? `🌍 « ${s.name} » mis à jour dans la galerie` : `🌍 « ${s.name} » publié dans la galerie`);
  });
}
function galUnpublish(id) {
  galApi('unpublish', { id }).then(j => {
    if (j.error) { $('galStatus').textContent = '⚠️ ' + j.error; return; }
    sysSave(sysList().map(x => (x.pub === id ? Object.assign({}, x, { pub: undefined }) : x)));
    galLoad();
  });
}

if (typeof document !== 'undefined' && document.getElementById('galView')) {
  $('sysTabs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => (b.dataset.t === 'gal' ? showGallery() : showSystems())));
  $('galKind').addEventListener('change', galLoad);
  $('galSort').addEventListener('change', galLoad);
  $('galQ').addEventListener('input', () => { clearTimeout(GAL.timer); GAL.timer = setTimeout(galLoad, 350); });
  $('galBack').addEventListener('click', () => { stopAnim(); closeCard(); if ($('stratCard').style.display !== 'none') refreshOptions(); });
}
