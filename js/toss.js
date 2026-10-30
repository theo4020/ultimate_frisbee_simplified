// toss.js — Le toss au début d'un match quand la première attaque est « Au hasard » (solo) : deux disques sont lancés,
// tu paries qu'ils retombent du même côté (deux faces, ou deux revers) ou pas ; gagné : tu choisis d'attaquer ou de
// défendre ; perdu : l'adversaire choisit.
const TOSS = { open: false, bet: null, done: null };
const tossWanted = () => !G.net && !G.tuto && !G.practice && G.form.first === 'r' && !G.tossed;
function showToss(then) {
  TOSS.open = true; TOSS.bet = null; TOSS.done = then;
  $('stratCard').style.display = 'none'; $('tossCard').style.display = ''; $('overlay').classList.remove('hidden');
  $('tossDiscs').className = 'tossDiscs'; $('tossDiscs').innerHTML = '<i class="tdisc"><b></b></i><i class="tdisc"><b></b></i>';
  $('tossText').innerHTML = 'Deux disques vont être lancés en l’air. Ils retomberont du <b>même côté</b> (deux faces ou deux revers), ou de <b>côtés différents</b> ? Gagne le pari et tu choisis.';
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
    [a, b].forEach((f, k) => { ds[k].classList.add(f ? 'face' : 'back'); ds[k].querySelector('b').textContent = f ? 'Face' : 'Revers'; });
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
