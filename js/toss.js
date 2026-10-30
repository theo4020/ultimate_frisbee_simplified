// toss.js — Le toss au début d'un match quand la première attaque est « Au hasard » : deux disques sont lancés, on parie
// qu'ils retombent du même côté (deux à l'endroit, ou deux à l'envers) ou pas ; gagné : on choisit d'attaquer ou de
// défendre ; perdu : l'adversaire choisit.
// En solo, c'est toi qui paries. En ligne, c'est l'hôte qui fait tout (le hasard) et envoie l'état à chacun : le capitaine
// des Rouges parie (celui des Bleus s'il n'y a personne en face), le capitaine de l'équipe gagnante choisit (l'IA si personne).
// État S : st 'bet' | 'flip' | 'res' (on attend le choix) | 'done' ; bt/bid : équipe et humain qui parient ; a, b : les disques
// (true = à l'endroit) ; bet ; pk/pid : équipe et humain qui choisissent (pid null : l'IA) ; recv : équipe qui attaque.
const TOSS = { open: false, S: null, done: null, timer: 0 };
const TOSS_FLIP = 1300;
const tossWanted = () => !G.tuto && !G.practice && !G.coopRoom && G.form.first === 'r' && !G.tossed && (!G.net || G.net === 'host');
// un disque posé sur l'herbe, vu un peu de côté : à l'endroit (bombé, avec ses anneaux et son logo) ou à l'envers
// (on voit l'intérieur creux) ; mini : petite icône pour les boutons du pari
function tossDiscSvg(up, mini) {
  const or = typeof discSkin === 'function' && discSkin() === 'orange';
  const c = or ? ['#ffb15c', '#ff8a1f', '#c2570c'] : ['#ffffff', '#e5e9f0', '#9aa6b8'], logo = typeof tcol === 'function' ? tcol(G.me) : '#3b82f6';
  const id = 'td' + (++tossDiscSvg.n), sh = mini ? '' : '<ellipse cx="50" cy="47" rx="41" ry="6.5" fill="rgba(0,0,0,.32)"/>';
  const body = up
    ? `<path d="M12 29 L12 34 A38 12 0 0 0 88 34 L88 29 Z" fill="${c[2]}"/>
       <ellipse cx="50" cy="29" rx="38" ry="12" fill="url(#${id})"/>
       <ellipse cx="50" cy="29" rx="29" ry="8.6" fill="none" stroke="rgba(15,23,42,.13)" stroke-width="1.4"/>
       <ellipse cx="50" cy="29" rx="13" ry="3.9" fill="none" stroke="${logo}" stroke-width="3"/>
       <ellipse cx="40" cy="24.5" rx="15" ry="2.6" fill="rgba(255,255,255,.75)"/>`
    : `<path d="M12 30 A38 15 0 0 0 88 30 Z" fill="${c[2]}"/>
       <ellipse cx="50" cy="30" rx="38" ry="12" fill="${c[0]}"/>
       <ellipse cx="50" cy="30.6" rx="32.5" ry="9.4" fill="url(#${id})"/>
       <path d="M17.5 31 A32.5 9.4 0 0 0 82.5 31" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.6"/>`;
  const grad = up ? `<radialGradient id="${id}" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></radialGradient>`
    : `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${or ? '#9a3f06' : '#5f6d82'}"/><stop offset=".6" stop-color="${c[2]}"/><stop offset="1" stop-color="${c[0]}"/></linearGradient>`;
  return `<svg viewBox="0 ${mini ? 14 : 8} 100 ${mini ? 36 : 46}" aria-hidden="true"><defs>${grad}</defs>${sh}${body}</svg>`;
}
tossDiscSvg.n = 0;
// ---------- partie commune (solo et en ligne) ----------
function tossOpen() { TOSS.open = true; ['stratCard', 'gameMenuCard', 'ctrlCard'].forEach(c => { $(c).style.display = 'none'; }); $('tossCard').style.display = ''; $('overlay').classList.remove('hidden'); }
// solo : then() lance le point ; en ligne (hôte) : le point démarre tout seul après le résultat
function showToss(then) {
  TOSS.done = then || null;
  tossSet({ st: 'bet', bt: G.me, bid: G.myId, a: null, b: null, bet: null, pk: null, pid: null, recv: null });
}
function hostToss() {
  const c = captain(1) || captain(0);
  TOSS.done = null;
  tossSet({ st: 'bet', bt: c.team, bid: c.id, a: null, b: null, bet: null, pk: null, pid: null, recv: null });
}
function tossSet(S) {
  TOSS.S = S;
  if (G.net === 'host') {
    netSend({ t: 'toss', s: S });
    clearTimeout(TOSS.idle);                                     // un joueur parti ou qui ne répond pas : on ne bloque pas la partie
    if (S.st === 'bet') TOSS.idle = setTimeout(() => tossBet(Math.random() < 0.5 ? 'same' : 'diff'), 25000);
    if (S.st === 'res') TOSS.idle = setTimeout(() => tossPick(Math.random() < 0.7), 25000);
  }
  tossShow(S);
}
const tossWon = S => (S.bet === 'same') === (S.a === S.b);
function tossBet(bet) {                                          // un pari (local, ou reçu d'un invité par l'hôte)
  const S = TOSS.S; if (!S || S.st !== 'bet') return;
  const a = Math.random() < 0.5, b = Math.random() < 0.5;
  tossSet(Object.assign({}, S, { st: 'flip', bet, a, b }));
  clearTimeout(TOSS.timer);
  TOSS.timer = setTimeout(() => {
    const T = TOSS.S; if (!T || T.st !== 'flip') return;
    const pk = tossWon(T) ? T.bt : 1 - T.bt, c = G.net ? captain(pk) : (pk === G.me ? meH() : null);
    const R = Object.assign({}, T, { st: 'res', pk, pid: c ? c.id : null });
    if (!c) { R.st = 'done'; R.recv = Math.random() < 0.7 ? pk : 1 - pk; }   // l'IA choisit : souvent attaquer
    tossSet(R); if (R.st === 'done') tossFinish(R);
  }, TOSS_FLIP);
}
function tossPick(attack) {
  const S = TOSS.S; if (!S || S.st !== 'res') return;
  const R = Object.assign({}, S, { st: 'done', recv: attack ? S.pk : 1 - S.pk });
  tossSet(R); tossFinish(R);
}
function tossFinish(R) {
  G.firstRoll = R.recv; G.tossed = true; G.receiving = R.recv;
  if (typeof placeOnPullLines === 'function') placeOnPullLines();
  if (G.net === 'host') { clearTimeout(TOSS.timer); TOSS.timer = setTimeout(() => { if (TOSS.open) { tossClose(); startPoint(); } }, 2600); }
}
function tossClose() { TOSS.open = false; TOSS.S = null; clearTimeout(TOSS.timer); clearTimeout(TOSS.idle); $('tossCard').style.display = 'none'; }
function tossGo() {
  if (!TOSS.open) return;
  const f = TOSS.done; TOSS.done = null; tossClose(); if (f) f();
}
// ce que chacun voit, de son point de vue
function tossShow(S) {
  tossOpen();
  const me = G.me, mine = S.bid === G.myId, D = $('tossDiscs'), nm = t => 'les ' + tn(t), Nm = t => 'Les ' + tn(t);
  const disc = (up, lbl) => `<span class="tdisc">${tossDiscSvg(up)}<em>${lbl || ''}</em></span>`;
  const show = (id, on) => { $(id).style.display = on ? '' : 'none'; };
  show('tossBet', S.st === 'bet' && mine); show('tossPick', S.st === 'res' && S.pid === G.myId); show('tossGo', S.st === 'done' && !G.net);
  if (S.st === 'bet' || !D.querySelector('.tdisc')) {
    D.innerHTML = disc(true) + '<span class="tsign"></span>' + disc(true);
    const pair = (a, b) => `<span class="tpair">${tossDiscSvg(a, true)}${tossDiscSvg(b, true)}</span>`;
    $('tossSame').innerHTML = pair(true, true) + 'Même côté<small>les deux à l’endroit, ou les deux à l’envers</small>';
    $('tossDiff').innerHTML = pair(true, false) + 'Côtés différents<small>un à l’endroit, l’autre à l’envers</small>';
  }
  if (S.st === 'bet') {
    D.className = 'tossDiscs ready';
    const who = G.net ? (humanById(S.bid) ? humanLabel(humanById(S.bid)) : '') : '';
    $('tossText').innerHTML = mine ? 'Deux disques vont être lancés en l’air. Retomberont-ils <b>du même côté</b>, ou <b>pas</b> ? Gagne le pari et tu choisis.'
      : `${Nm(S.bt)} parient${who ? ` (${esc(who)})` : ''} : les deux disques retomberont-ils du même côté ? Le gagnant choisit d’attaquer ou de défendre.`;
    return;
  }
  if (S.st === 'flip') {
    if (D.className !== 'tossDiscs flip') { D.className = 'tossDiscs flip'; try { SOUNDS.tick(); } catch (e) { } }
    $('tossText').innerHTML = `${mine ? 'Tu as' : Nm(S.bt) + ' ont'} parié : <b>${S.bet === 'same' ? 'même côté' : 'côtés différents'}</b>. Les disques tournent…`;
    return;
  }
  // résultat : les disques posés, = ou ≠ (en jaune si ton équipe a gagné le toss)
  const won = tossWon(S), mineWon = (won ? S.bt : 1 - S.bt) === me;
  if (!D.className.includes('landed')) {
    const ds = D.querySelectorAll('.tdisc');
    [S.a, S.b].forEach((f, k) => { ds[k].innerHTML = tossDiscSvg(f) + `<em>${f ? 'à l’endroit' : 'à l’envers'}</em>`; });
    const sg = D.querySelector('.tsign'); sg.textContent = S.a === S.b ? '=' : '≠'; sg.className = 'tsign ' + (mineWon ? 'ok' : 'ko');
    D.className = 'tossDiscs landed';
    if (mineWon) try { SOUNDS.qte(0.9); } catch (e) { }
  }
  const res = `<b>${S.a === S.b ? 'Même côté !' : 'Côtés différents !'}</b> `;
  const winTxt = mine ? (won ? 'Tu as gagné le toss' : 'Perdu…') : `${Nm(S.bt)} ${won ? 'gagnent' : 'perdent'} le toss`;
  if (S.st === 'res') {
    $('tossText').innerHTML = res + winTxt + (S.pid === G.myId ? ' : à toi de choisir.' : ` : ${nm(S.pk)} choisissent…`);
    return;
  }
  const chose = S.pk === me && S.pid === G.myId ? '' : `${Nm(S.pk)} choisissent ${S.recv === S.pk ? 'd’attaquer' : 'de défendre (ils pullent)'}. `;
  const you = me === 0 || me === 1 ? (S.recv === me ? 'Tu commences en <b>attaque</b> : tu reçois le pull.' : 'Tu commences en <b>défense</b> : ton équipe pulle.') : '';
  $('tossText').innerHTML = (S.pid === G.myId ? '' : res + winTxt + '. ') + chose + you + (G.net ? ' <small>Le point commence…</small>' : '');
}
// ---------- en ligne ----------
function tossNet(S) { if (G.net === 'guest' && S && typeof S === 'object') { TOSS.S = S; tossShow(S); } }   // (invité) état reçu de l'hôte
function tossHostMsg(h, m) {                                     // (hôte) pari ou choix d'un invité
  const S = TOSS.S; if (!S || !h) return;
  if (m.t === 'tossBet' && S.st === 'bet' && h.id === S.bid) tossBet(m.bet === 'diff' ? 'diff' : 'same');
  if (m.t === 'tossPick' && S.st === 'res' && h.id === S.pid) tossPick(!!m.atk);
}
const tossAct = (bet, atk) => {
  if (G.net === 'guest') { netSend(bet ? { t: 'tossBet', bet } : { t: 'tossPick', atk }); return; }
  if (bet) tossBet(bet); else tossPick(atk);
};
if (typeof document !== 'undefined' && document.getElementById('tossCard')) {
  $('tossSame').addEventListener('click', () => tossAct('same'));
  $('tossDiff').addEventListener('click', () => tossAct('diff'));
  $('tossAtk').addEventListener('click', () => tossAct(null, true));
  $('tossDef').addEventListener('click', () => tossAct(null, false));
  $('tossGo').addEventListener('click', tossGo);
}
