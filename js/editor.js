// editor.js — « Mes systèmes » : créer, modifier, supprimer ses formations, plays et défenses.
// Le terrain de l'éditeur montre le thrower (H) et son repère : vers la droite = vers l'en-but attaqué,
// vers le haut = côté open, vers le bas = côté break (voir systems.js).
//  • Formation : glisser ①–④ pour les placer ; « Consignes » : rôle, zone de coupe, quand couper… de chaque poste.
//  • Play : choisir la formation de départ, puis glisser depuis un joueur jusqu'à sa destination (courses).
//  • Défense : glisser 1–4 (places) ; la mark et chaque défenseur ont leurs consignes (zone ou individuelle).

const ED = { sys: null, mode: 'place', drag: null, anim: null, sel: -1, ro: null };   // ro : aperçu d'une publication de la galerie
const EF = [-10, 38], ES = [-18.5, 18.5];                      // fenêtre du terrain affichée (mètres)
function edCanvas() { return $('edField'); }
function edScale() { const c = edCanvas(); return { w: c.width, h: c.height, kx: c.width / (EF[1] - EF[0]), ky: c.height / (ES[1] - ES[0]) }; }
const edToPx = ([f, s]) => { const k = edScale(); return [(f - EF[0]) * k.kx, (ES[1] - s) * k.ky]; };
const edFromPx = (x, y) => { const k = edScale(); return [EF[0] + x / k.kx, ES[1] - y / k.ky]; };

// ---------- liste ----------
function showSystems() {
  ED.sys = null; ED.ro = null; stopAnim();
  $('sysList').style.display = ''; $('sysEdit').style.display = 'none'; $('galView').style.display = 'none';
  sysTabs('mine');
  const L = sysList();
  const row = s => `<li><span class="kind ${s.kind}">${KIND_LABEL[s.kind]}</span><b>${esc(s.name)}</b>
    <small>${sysInfo(s)}${s.by ? ' · par ' + esc(s.by) : ''}</small>
    <button data-a="pub" data-id="${s.id}" class="${s.pub ? 'on' : ''}" title="${s.pub ? 'Publié dans la galerie : touche pour mettre à jour' : 'Publier dans la galerie'}">${s.pub ? '🌍 ✓' : '🌍'}</button>
    <button data-a="edit" data-id="${s.id}">Modifier</button><button data-a="del" data-id="${s.id}" class="ghost">✕</button></li>`;
  $('sysItems').innerHTML = L.length ? L.map(row).join('') : '<li class="empty">Aucun système pour l’instant : crée ta première formation, ton premier play ou ta première défense.</li>';
  $('sysNewOff').disabled = $('sysNewPlay').disabled = $('sysNewDef').disabled = L.length >= SYS_MAX;
  $('sysCount').textContent = `${L.length} / ${SYS_MAX}`;
  $('sysItems').querySelectorAll('button').forEach(b => b.onclick = () => {
    const s = sysById(b.dataset.id); if (!s) return;
    if (b.dataset.a === 'edit') editSystem(JSON.parse(JSON.stringify(s)));
    else if (b.dataset.a === 'pub') galPublish(s);
    else askConfirm(`Supprimer « ${s.name} » ?`, 'Supprimer', () => { sysSave(sysList().filter(x => x.id !== s.id)); unpickDeleted(); showSystems(); });
  });
}
const KIND_LABEL = { off: 'Formation', play: 'Play', def: 'Défense' };
function sysInfo(s) {
  if (s.kind === 'play') return `${s.steps.length} course${s.steps.length > 1 ? 's' : ''} · depuis ${esc(baseName(s.base))}`;
  if (s.kind === 'off') return s.postes.filter(P => P.role === 'dump').length ? 'avec handler' : '4 cutters';
  const z = s.postes.filter(P => P.mission === 'zone').length;
  return z === 4 ? 'zone' : z === 0 ? 'man' : 'mixte (' + z + ' en zone)';
}
function unpickDeleted() {
  for (const k of ['osys', 'dsys']) if (G.form[k] && !sysById(G.form[k])) G.form[k] = null;
  for (const n of [1, 2]) if (G.form['play' + n] === 'sys' && !sysById(G.form['p' + n + 'sys'])) G.form['play' + n] = 'none';
  saveSettings();
}

// ---------- édition ----------
function editSystem(s, ro) {
  ED.sys = s; ED.mode = 'place'; ED.sel = -1; ED.ro = ro || null;
  $('sysList').style.display = 'none'; $('galView').style.display = 'none'; $('sysEdit').style.display = '';
  $('edName').value = s.name; $('edName').readOnly = !!ro;
  $('edSave').style.display = ro ? 'none' : ''; $('edAdd').style.display = ro ? '' : 'none';
  $('edCancel').textContent = ro ? '← Retour à la galerie' : 'Annuler';
  $('edBy').textContent = ro ? `Publié par ${ro.by} · ❤ ${ro.likes}` : '';
  edResize(); edRender();
}
function edResize() {
  const c = edCanvas(), w = Math.min(c.parentNode.clientWidth || 500, 620, innerHeight * 0.62 * (EF[1] - EF[0]) / (ES[1] - ES[0]));
  c.width = Math.round(w * devicePixelRatio); c.height = Math.round(w * (ES[1] - ES[0]) / (EF[1] - EF[0]) * devicePixelRatio);
  c.style.width = w + 'px'; c.style.height = c.height / devicePixelRatio + 'px';
}
function edRender() {
  const s = ED.sys; if (!s) return;
  const K = s.kind;
  $('edTitle').textContent = KIND_LABEL[K] + (ED.ro ? ' (aperçu)' : '');
  if (K === 'off' && ED.mode !== 'post') ED.mode = 'place';
  if (K === 'play') ED.mode = 'cut';
  if (K === 'def' && ED.mode !== 'post') ED.mode = 'place';
  $('edModes').innerHTML = K === 'play'
    ? `<label class="edBase">Formation de départ <select id="edBaseSel">${playBases(s)}</select></label><button id="edPlay">▶ Aperçu</button>`
    : `<button data-m="place" class="${ED.mode === 'place' ? 'on' : ''}">✋ Placer</button><button data-m="post" class="${ED.mode === 'post' ? 'on' : ''}">🎯 Consignes</button>`;
  $('edModes').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { if (ED.ro) return; ED.mode = b.dataset.m; edRender(); });
  $('edModes').classList.toggle('ro', !!ED.ro);
  if ($('edPlay')) $('edPlay').onclick = startAnim;
  if ($('edBaseSel')) $('edBaseSel').onchange = e => { s.base = e.target.value; edRender(); };
  $('edHelp').textContent = ED.ro ? (K === 'play' ? 'Aperçu en lecture seule : ▶ Aperçu montre ses courses. Ajoute-le à tes systèmes pour le modifier.' : 'Aperçu en lecture seule. Ajoute-le à tes systèmes pour le modifier.')
    : K === 'off' ? (ED.mode === 'place' ? 'Glisse ①–④ pour placer ta formation autour du thrower (H). Après chaque passe, le joueur le plus proche de chaque place prend ce poste.'
      : 'Consignes de chaque poste. « Au choix de l’IA » : elle lit l’espace comme dans les formations du jeu.')
    : K === 'play' ? 'Les joueurs partent des places de la formation choisie. Glisse depuis un joueur (ou le bout de sa flèche) jusqu’à sa destination. Le play se joue quand tu l’appelles (Play 1 ou Play 2).'
    : ED.mode === 'place' ? 'Glisse 1–4 pour placer tes défenseurs. En zone, il garde cette place ; en man, il garde l’attaquant le plus proche de cette place. M marque le thrower.'
    : 'Consignes de la mark et de chaque défenseur. Tu peux mélanger zone et man.';
  edCanvas().style.display = '';
  $('edSteps').innerHTML = K === 'off' ? (ED.mode === 'post' ? postesHtml(s) : '')
    : K === 'play' ? `<label class="edSetup"><input type="checkbox" id="edSetupCb"${s.setup ? ' checked' : ''}> Se mettre en place avant de partir
      <small>(quand tu l’appelles : chacun file d’abord à sa place, 1,5 s au plus, puis les courses commencent)</small></label>` + stepsHtml(s)
    : ED.mode === 'post' ? defHtml(s) : '';
  if ($('edSetupCb')) $('edSetupCb').onchange = e => { s.setup = e.target.checked; };
  bindSteps(s);
  if (ED.ro) $('edSteps').querySelectorAll('select, input, .sb').forEach(el => { if (el.classList.contains('sb')) el.style.display = 'none'; else el.disabled = true; });
  if (ED.ro && $('edBaseSel')) $('edBaseSel').disabled = true;
  drawEditor();
}
// formations proposées comme départ d'un play : celles du jeu, puis les tiennes
function playBases(s) {
  const mine = sysList().filter(x => x.kind === 'off');
  const opt = (v, l) => `<option value="${v}"${v === s.base ? ' selected' : ''}>${esc(l)}</option>`;
  let h = Object.keys(FORM_TEMPLATES).map(k => opt(k, FORM_NAMES[k])).join('');
  if (mine.length) h += '<optgroup label="Mes formations">' + mine.map(f => opt('sys:' + f.id, '★ ' + f.name)).join('') + '</optgroup>';
  if (!FORM_TEMPLATES[s.base] && !mine.some(f => 'sys:' + f.id === s.base)) h += opt(s.base, 'Formation d’origine');   // galerie, formation supprimée
  return h;
}
const edPos = s => (s.kind === 'play' ? playPos(s) : s.kind === 'def' ? s.postes.map(P => P.pos) : s.pos);
const NUM = ['①', '②', '③', '④'];
// point de départ de la course i : la fin de la course précédente du même joueur, sinon sa place
function stepFrom(s, i) {
  for (let k = i - 1; k >= 0; k--) if (s.steps[k].p === s.steps[i].p) return s.steps[k].to;
  return edPos(s)[s.steps[i].p];
}
// où finit la dernière course d'un joueur (sa place s'il n'en a pas)
function chainEnd(s, p) { for (let k = s.steps.length - 1; k >= 0; k--) if (s.steps[k].p === p) return s.steps[k].to; return edPos(s)[p]; }
const WAITS = [0, 0.3, 0.6, 1, 1.5, 2, 3];
function stepsHtml(s) {
  if (!s.steps.length) return '<p class="net">Aucune course pour l’instant : glisse depuis un joueur jusqu’à sa destination.</p>';
  return '<ol class="steps">' + s.steps.map((st, i) => `<li><b>${NUM[st.p]}</b> ${st.to[0] >= 0 ? '+' : ''}${Math.round(st.to[0])} m,
    ${st.to[1] >= 0 ? 'open' : 'break'} ${Math.abs(Math.round(st.to[1]))} m
    <label>${i === 0 ? 'départ après' : 'puis après'} <select data-i="${i}">${WAITS.map(w => `<option value="${w}"${Math.abs(w - st.wait) < 0.05 ? ' selected' : ''}>${String(w).replace('.', ',')} s</option>`).join('')}</select></label>
    <span class="sb"><button data-up="${i}" ${i ? '' : 'disabled'}>↑</button><button data-dn="${i}" ${i < s.steps.length - 1 ? '' : 'disabled'}>↓</button><button data-rm="${i}" class="ghost">✕</button></span></li>`).join('') + '</ol>';
}
// consignes des postes ①–④ (formation perso)
function postesHtml(s) {
  s.postes = (s.postes || []).concat([]).slice(0, 4); while (s.postes.length < 4) s.postes.push(cleanPoste(null));
  return '<div class="postes">' + s.postes.map((P, i) => `<div class="poste"><b>${NUM[i]} ${esc(POSTE_OPTS.role[P.role])}</b>`
    + Object.keys(POSTE_OPTS).map(k => `<label>${POSTE_LBL[k]}<select data-p="${i}" data-k="${k}">${Object.entries(POSTE_OPTS[k]).map(([v, l]) => `<option value="${v}"${v === P[k] ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`).join('')
    + '</div>').join('') + '</div><p class="net">Handler : se propose derrière le thrower et vient le chercher quand le stall monte · Deep : reste loin devant et attaque le deep · À son tour : dans l’ordre des postes, un seul à la fois.</p>';
}
// consignes d'une défense : la mark, puis chaque défenseur (les réglages affichés dépendent de sa mission)
function defHtml(s) {
  const sel = (attr, opts, v) => `<select ${attr}>${Object.entries(opts).map(([k, l]) => `<option value="${k}"${k === String(v) ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const mark = '<div class="poste"><b>M · la mark</b>' + Object.keys(MARK_OPTS).map(k => `<label>${MARK_LBL[k]}${sel(`data-mk="${k}"`, MARK_OPTS[k], s.mark[k])}</label>`).join('') + '</div>';
  return '<div class="postes">' + mark + s.postes.map((P, i) => `<div class="poste"><b>${i + 1} · ${DEF_OPTS.mission[P.mission]}</b>`
    + DEF_SHOW[P.mission].map(k => `<label>${DEF_LBL[k]}${sel(`data-dp="${i}" data-k="${k}"`, DEF_OPTS[k], P[k])}</label>`).join('') + '</div>').join('')
    + '</div><p class="net">Man : il garde l’attaquant le plus proche de sa place · Suit le plus deep : un deep qui protège le fond · Presse le thrower : se rapproche du disque (hors du cercle) · Double team : le défenseur le plus proche qui peut aider vient presser le thrower.</p>';
}
function bindSteps(s) {
  const q = sel => $('edSteps').querySelectorAll(sel);
  q('select[data-i]').forEach(e => e.onchange = () => { s.steps[+e.dataset.i].wait = +e.value; });
  q('[data-up]').forEach(b => b.onclick = () => { const i = +b.dataset.up; [s.steps[i - 1], s.steps[i]] = [s.steps[i], s.steps[i - 1]]; edRender(); });
  q('[data-dn]').forEach(b => b.onclick = () => { const i = +b.dataset.dn; [s.steps[i + 1], s.steps[i]] = [s.steps[i], s.steps[i + 1]]; edRender(); });
  q('[data-rm]').forEach(b => b.onclick = () => { s.steps.splice(+b.dataset.rm, 1); edRender(); });
  q('select[data-mk]').forEach(e => e.onchange = () => { s.mark[e.dataset.mk] = e.value; });
  q('select[data-dp]').forEach(e => e.onchange = () => { s.postes[+e.dataset.dp][e.dataset.k] = e.value; if (e.dataset.k === 'mission') edRender(); else drawEditor(); });
  q('select[data-p]').forEach(e => e.onchange = () => { s.postes[+e.dataset.p][e.dataset.k] = e.value; if (e.dataset.k === 'role') edRender(); else drawEditor(); });
}

// ---------- dessin ----------
function drawEditor(animPos) {
  const s = ED.sys, c = edCanvas(); if (!s || c.style.display === 'none') return;
  const g = c.getContext('2d'), k = edScale(), r = 1.5 * k.kx;
  g.clearRect(0, 0, k.w, k.h);
  g.fillStyle = '#2f7d32'; g.fillRect(0, 0, k.w, k.h);
  g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1 * devicePixelRatio; g.fillStyle = 'rgba(255,255,255,.55)';
  g.font = `${11 * devicePixelRatio}px system-ui`;
  for (let f = 0; f <= EF[1]; f += 10) { const [x] = edToPx([f, 0]); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, k.h); g.stroke(); if (f) g.fillText('+' + f + ' m', x + 3 * devicePixelRatio, k.h - 5 * devicePixelRatio); }
  g.fillText('côté open ↑', 6 * devicePixelRatio, 14 * devicePixelRatio);
  g.fillText('côté break ↓', 6 * devicePixelRatio, k.h - 18 * devicePixelRatio);
  g.textAlign = 'right'; g.fillText('attaque →', k.w - 6 * devicePixelRatio, 14 * devicePixelRatio); g.textAlign = 'left';
  // cercle de stall autour du porteur
  const [hx, hy] = edToPx([0, 0]);
  g.setLineDash([4 * devicePixelRatio, 4 * devicePixelRatio]); g.beginPath(); g.arc(hx, hy, STALL_R * k.kx, 0, 7); g.stroke(); g.setLineDash([]);
  const token = ([x, y], label, fill, txt = '#fff') => {
    g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.5 * devicePixelRatio; g.stroke();
    g.fillStyle = txt; g.font = `bold ${13 * devicePixelRatio}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, x, y + 0.5); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  };
  if (s.kind === 'play') {
    s.steps.forEach((st, i) => {                                // flèches des courses, numérotées dans l'ordre
      const from = edToPx(stepFrom(s, i)), to = edToPx(st.to);
      edArrow(g, from, to, i === ED.sel ? '#facc15' : 'rgba(250,204,21,.75)', r);
      g.fillStyle = '#facc15'; g.font = `bold ${12 * devicePixelRatio}px system-ui`;
      g.fillText(String(i + 1), (from[0] + to[0]) / 2 + 4, (from[1] + to[1]) / 2 - 4);
    });
    token([hx, hy], 'H', '#e2e8f0', '#1e293b');
    playPos(s).forEach((p, i) => token(edToPx(animPos ? animPos[i] : p), String(i + 1), '#3b82f6'));
    if (ED.drag && ED.drag.cut) edArrow(g, edToPx(chainEnd(s, ED.drag.i)), ED.drag.at, '#fff', r);
  } else if (s.kind === 'off') {
    token([hx, hy], 'H', '#e2e8f0', '#1e293b');
    s.pos.forEach((p, i) => { const role = s.postes[i].role;   // relais en jaune, profond en violet
      token(edToPx(p), String(i + 1), role === 'dump' ? '#ca8a04' : role === 'deep' ? '#7c3aed' : '#3b82f6'); });
  } else {
    token([hx, hy], 'H', '#e2e8f0', '#1e293b');
    const mk = MARK_K[s.mark.dist] || 1;                         // la mark, côté break (forcé)
    token(edToPx(s.mark.force === 'straight' ? [1.4 * mk, 0] : [1 * mk, -1.3 * mk]), 'M', '#ef4444');
    s.postes.forEach((P, i) => {                                 // zone : rouge plein · individuelle : contour orange (il garde l'attaquant proche)
      token(edToPx(P.pos), String(i + 1), P.mission === 'man' ? '#c2410c' : '#ef4444');
      if (P.mission === 'man') { const [x, y] = edToPx(P.pos); g.strokeStyle = 'rgba(253,186,116,.7)'; g.setLineDash([3 * devicePixelRatio, 3 * devicePixelRatio]); g.beginPath(); g.arc(x, y, r * 2.4, 0, 7); g.stroke(); g.setLineDash([]); }
    });
  }
}
function edArrow(g, [x0, y0], [x1, y1], col, r) {
  const a = Math.atan2(y1 - y0, x1 - x0), sx = x0 + Math.cos(a) * r, sy = y0 + Math.sin(a) * r;
  g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2.5 * devicePixelRatio;
  g.beginPath(); g.moveTo(sx, sy); g.lineTo(x1, y1); g.stroke();
  const h = 9 * devicePixelRatio;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - h * Math.cos(a - 0.45), y1 - h * Math.sin(a - 0.45)); g.lineTo(x1 - h * Math.cos(a + 0.45), y1 - h * Math.sin(a + 0.45)); g.fill();
}

// ---------- souris / doigt sur le terrain ----------
function edPoint(e) { const c = edCanvas(), b = c.getBoundingClientRect(); return [(e.clientX - b.left) * c.width / b.width, (e.clientY - b.top) * c.height / b.height]; }
function edHit([x, y]) {
  const s = ED.sys, r = 2.4 * edScale().kx, near = p => { const [px, py] = edToPx(p); return Math.hypot(px - x, py - y) < r; };
  if (s.kind === 'off') { for (let i = 0; i < 4; i++) if (near(s.pos[i])) return { t: 'pos', i }; }
  else if (s.kind === 'play') {
    for (let i = s.steps.length - 1; i >= 0; i--) if (near(s.steps[i].to) && !s.steps.slice(i + 1).some(x => x.p === s.steps[i].p)) return { t: 'pos', i: s.steps[i].p };   // enchaîner depuis la fin de sa course
    for (let i = s.steps.length - 1; i >= 0; i--) if (near(s.steps[i].to)) return { t: 'step', i };
    for (let i = 0; i < 4; i++) if (near(playPos(s)[i])) return { t: 'pos', i };
  } else for (let i = 0; i < 4; i++) if (near(s.postes[i].pos)) return { t: 'zone', i };
  return null;
}
function edDown(e) {
  if (!ED.sys || ED.anim || ED.ro) return;
  const pt = edPoint(e), h = edHit(pt);
  if (!h) return;
  e.preventDefault(); edCanvas().setPointerCapture(e.pointerId);
  ED.drag = Object.assign(h, { cut: ED.sys.kind === 'play' && h.t === 'pos', at: pt });
  ED.sel = h.t === 'step' ? h.i : -1;
}
function edMove(e) {
  const D = ED.drag; if (!D) return;
  e.preventDefault();
  const pt = edPoint(e), w = sysPt(edFromPx(...pt)); D.at = pt;
  if (D.cut) { drawEditor(); return; }
  if (D.t === 'pos') ED.sys.pos[D.i] = w; else if (D.t === 'step') ED.sys.steps[D.i].to = w; else if (D.t === 'zone') ED.sys.postes[D.i].pos = w;
  drawEditor();
}
function edUp(e) {
  const D = ED.drag; if (!D) return;
  ED.drag = null;
  const s = ED.sys;
  if (D.cut) {
    const to = sysPt(edFromPx(...edPoint(e)));
    const from = chainEnd(s, D.i);
    if (Math.hypot(to[0] - from[0], to[1] - from[1]) > 2 && s.steps.length < SYS_STEPS) s.steps.push({ p: D.i, to, wait: s.steps.length ? 1 : 0.6 });
  }
  edRender();
}

// ---------- aperçu animé : les courses dans l'ordre, à la vitesse d'un coupeur ----------
// Un joueur qui a plusieurs courses repart de là où il est ; après sa dernière course, il revient à sa place en trottinant.
function startAnim() {
  const s = ED.sys; if (!s || !s.steps.length) return;
  stopAnim();
  // comme en match : chaque course part « wait » secondes après la précédente, mais pas avant que son joueur ait fini la sienne
  const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  const prog = (r, t) => Math.min(1, Math.max(0, (t - r.t) / r.dur));
  const runs = [], lastOf = [];
  let t0 = 0;
  for (const st of s.steps) {
    const prev = lastOf[st.p], from = prev ? prev.to : playPos(s)[st.p];
    const r = { p: st.p, from, to: st.to, t: Math.max(t0 + st.wait, prev ? prev.t + prev.dur + 0.7 : 0) };
    r.dur = Math.max(0.2, Math.hypot(r.to[0] - from[0], r.to[1] - from[1]) / SPD.cut);
    runs.push(r); lastOf[st.p] = r; t0 = r.t;
  }
  for (const r of lastOf) if (r) r.last = true;
  const P0 = playPos(s), end = Math.max(...runs.map(r => r.t + r.dur + 0.7 + Math.hypot(r.to[0] - P0[r.p][0], r.to[1] - P0[r.p][1]) / SPD.jog));
  const start = performance.now();
  const tick = now => {
    const t = (now - start) / 1000, cur = P0.map(q => q.slice());
    for (let p = 0; p < 4; p++) {
      const r = runs.filter(q => q.p === p && q.t <= t).pop(); if (!r) continue;
      cur[p] = lerp(r.from, r.to, prog(r, t));
      if (r.last) { const back = (t - r.t - r.dur - 0.7) / (Math.hypot(r.to[0] - P0[p][0], r.to[1] - P0[p][1]) / SPD.jog || 1); if (back > 0) cur[p] = lerp(r.to, P0[p], Math.min(1, back)); }
    }
    drawEditor(cur);
    if (t < end + 0.8) ED.anim = requestAnimationFrame(tick); else stopAnim();
  };
  ED.anim = requestAnimationFrame(tick);
}
function stopAnim() { if (ED.anim) cancelAnimationFrame(ED.anim); ED.anim = null; if (ED.sys) drawEditor(); }

function edSaveCurrent() {
  const s = ED.sys; if (!s) return;
  s.name = $('edName').value;
  const L = sysList().slice(), c = cleanSystem(playOut(s)), i = L.findIndex(x => x.id === c.id);
  if (i >= 0) L[i] = c; else L.push(c);
  sysSave(L); toast('✅ « ' + c.name + ' » enregistré');
  showSystems();
  if ($('stratCard').style.display !== 'none' || cardStack.some(x => x.card === 'stratCard')) refreshOptions();
}

function openSystems() { openCard('sysCard'); showSystems(); }
if (typeof document !== 'undefined' && document.getElementById('sysCard')) {
  $('sysB').addEventListener('click', openSystems);
  $('sysBack').addEventListener('click', () => { stopAnim(); closeCard(); if ($('stratCard').style.display !== 'none') refreshOptions(); });
  $('sysNewOff').addEventListener('click', () => editSystem(Object.assign(SYS_NEW.off(), { id: sysId() })));
  $('sysNewPlay').addEventListener('click', () => editSystem(Object.assign(SYS_NEW.play(), { id: sysId() })));
  $('sysNewDef').addEventListener('click', () => editSystem(Object.assign(SYS_NEW.def(), { id: sysId() })));
  $('edSave').addEventListener('click', edSaveCurrent);
  $('edCancel').addEventListener('click', () => { if (ED.ro) showGallery(); else showSystems(); });
  $('edAdd').addEventListener('click', () => galAdd(ED.ro));
  const c = edCanvas();
  c.addEventListener('pointerdown', edDown); c.addEventListener('pointermove', edMove);
  c.addEventListener('pointerup', edUp); c.addEventListener('pointercancel', () => { ED.drag = null; drawEditor(); });
  window.addEventListener('resize', () => { if (ED.sys) { edResize(); drawEditor(); } });
}
