// toss.js — Le toss au début d'un match quand la première attaque est « Au hasard » (solo) : deux disques sont lancés,
// tu paries qu'ils retombent du même côté (deux faces, ou deux revers) ou pas ; gagné : tu choisis d'attaquer ou de
// défendre ; perdu : l'adversaire choisit.
const TOSS = { open: false, bet: null, done: null };
const tossWanted = () => !G.net && !G.tuto && !G.practice && G.form.first === 'r' && !G.tossed;
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
function showToss(then) {
  TOSS.open = true; TOSS.bet = null; TOSS.done = then;
  $('stratCard').style.display = 'none'; $('tossCard').style.display = ''; $('overlay').classList.remove('hidden');
  const d = up => `<span class="tdisc">${tossDiscSvg(up)}<em></em></span>`;
  $('tossDiscs').className = 'tossDiscs ready'; $('tossDiscs').innerHTML = d(true) + '<span class="tsign"></span>' + d(true);
  const pair = (a, b) => `<span class="tpair">${tossDiscSvg(a, true)}${tossDiscSvg(b, true)}</span>`;
  $('tossSame').innerHTML = pair(true, true) + 'Même côté<small>les deux à l’endroit, ou les deux à l’envers</small>';
  $('tossDiff').innerHTML = pair(true, false) + 'Côtés différents<small>un à l’endroit, l’autre à l’envers</small>';
  $('tossText').innerHTML = 'Deux disques vont être lancés en l’air. Ils retomberont-ils <b>du même côté</b>, ou <b>pas</b> ? Gagne le pari et tu choisis.';
  $('tossBet').style.display = ''; $('tossPick').style.display = 'none'; $('tossGo').style.display = 'none';
}
function tossThrow(bet) {
  if (!TOSS.open || TOSS.bet) return;
  TOSS.bet = bet; $('tossBet').style.display = 'none';
  const a = Math.random() < 0.5, b = Math.random() < 0.5, same = a === b, won = (bet === 'same') === same;
  const D = $('tossDiscs'); D.className = 'tossDiscs flip';
  try { SOUNDS.tick(); } catch (e) { }
  $('tossText').textContent = 'Les disques tournent…';
  setTimeout(() => {
    const ds = D.querySelectorAll('.tdisc');
    [a, b].forEach((f, k) => { ds[k].innerHTML = tossDiscSvg(f) + `<em>${f ? 'à l’endroit' : 'à l’envers'}</em>`; });
    const sg = D.querySelector('.tsign'); sg.textContent = same ? '=' : '≠'; sg.className = 'tsign ' + (won ? 'ok' : 'ko');
    D.className = 'tossDiscs landed';
    const res = same ? 'Même côté !' : 'Côtés différents !';
    if (won) {
      try { SOUNDS.qte(0.9); } catch (e) { }
      $('tossText').innerHTML = `<b>${res}</b> Tu as gagné le toss : à toi de choisir.`;
      $('tossPick').style.display = '';
    } else {
      const atk = Math.random() < 0.7, opp = 1 - G.me;                   // l'adversaire préfère souvent attaquer
      tossEnd(atk ? opp : G.me, `<b>${res}</b> Perdu… les ${tn(opp)} choisissent ${atk ? 'd’attaquer' : 'de défendre (ils pullent)'}.`);
    }
  }, 1300);
}
function tossChoose(attack) { tossEnd(attack ? G.me : 1 - G.me, attack ? 'Tu commences en <b>attaque</b> : tu reçois le pull.' : 'Tu commences en <b>défense</b> : ton équipe pulle.'); }
function tossEnd(receiver, html) {
  G.firstRoll = receiver; G.tossed = true; G.receiving = receiver;
  if (typeof placeOnPullLines === 'function') placeOnPullLines();
  $('tossPick').style.display = 'none'; $('tossText').innerHTML = html; $('tossGo').style.display = '';
}
function tossGo() {
  if (!TOSS.open) return;
  TOSS.open = false; $('tossCard').style.display = 'none';
  const f = TOSS.done; TOSS.done = null; if (f) f();
}
if (typeof document !== 'undefined' && document.getElementById('tossCard')) {
  $('tossSame').addEventListener('click', () => tossThrow('same'));
  $('tossDiff').addEventListener('click', () => tossThrow('diff'));
  $('tossAtk').addEventListener('click', () => tossChoose(true));
  $('tossDef').addEventListener('click', () => tossChoose(false));
  $('tossGo').addEventListener('click', tossGo);
}
