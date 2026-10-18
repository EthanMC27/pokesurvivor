#!/usr/bin/env node
/* ============ sim/cardlab.js — análisis de cartas y comparaciones emparejadas ============
 *
 *   node sim/cardlab.js stats a.json [b.json ...]        qué se coge (por partida, mediana)
 *   node sim/cardlab.js pair A.json B.json [--by dex]    B frente a A, partida a partida
 *                                                         (misma semilla y Pokémon)
 *   Varios ficheros por lado: A1.json+A2.json (se juntan).
 *
 * Métricas por partida:
 *   pot15/pot30   cartas de Potencia cogidas hasta el min 15 / 30
 *   cd, def, hp   Reflejos, Coraza, Vigor (toda la partida)
 *   upSide        mejoras de movimientos que acaban FUERA del grupo principal
 *                 (el hueco con más movimientos) — en la práctica, mejoras que no disparan
 *   potOff        % de tandas (con `of`, engine.js 17-10-2026) en las que salía Potencia
 *   potPass       Potencia ofrecida y no cogida
 *   full          % de niveles con los 4 huecos llenos (estimado: no hay carta 'new' en la tanda)
 *
 * Emparejado: media de ln(tB/tA) con IC 95 % por bootstrap (las semillas cuentan como
 * unidad), ×geo = exp(media), ganadas/perdidas/empates (empate = ambas llegan al tope).
 */
const fs = require('fs');

const load = spec => spec.split('+').flatMap(f => JSON.parse(fs.readFileSync(f, 'utf8'))).filter(r => r && !r.error);

function metrics(r) {
  const c = r.cards || [];
  const n = (pred) => c.filter(pred).length;
  const st = id => n(x => x.key === 'stat:' + id);
  const main = (r.moves || []).map(s => s.split('+').map(x => x.split(':')[0])).sort((a, b) => b.length - a.length)[0] || [];
  const withOf = c.filter(x => x.of);
  const potOffered = withOf.filter(x => x.of.includes('stat:atk'));
  return {
    time: r.time, level: r.level, kills: r.kills, bonds: r.bonds, atkMul: r.atkMul, reduce: r.reduce, cdMul: r.cdMul,
    pot15: n(x => x.key === 'stat:atk' && x.t <= 900), pot30: n(x => x.key === 'stat:atk' && x.t <= 1800), pot: st('atk'),
    cd: st('cd'), def: st('def'), hp: st('hp'), rgn: st('rgn'), xp: st('xp'), spd: st('spd'), mag: st('mag'), heal: st('heal'),
    newC: n(x => x.key.startsWith('new:')), up: n(x => x.key.startsWith('up:')), evo: n(x => x.key.startsWith('evo:')),
    upSide: n(x => x.key.startsWith('up:') && !main.includes(x.key.slice(3))),
    nMoves: (r.moves || []).reduce((a, s) => a + s.split('+').length, 0),
    potOff: withOf.length ? 100 * potOffered.length / withOf.length : null,
    potPass: withOf.length ? potOffered.filter(x => x.key !== 'stat:atk').length : null,
    full: withOf.length ? 100 * withOf.filter(x => !x.of.some(k => k.startsWith('new:'))).length / withOf.length : null,
    lv15: ((r.curve || []).find(x => x.m === 15) || {}).lv
  };
}

const sorted = a => a.filter(x => x != null && !Number.isNaN(x)).sort((x, y) => x - y);
const med = a => { a = sorted(a); return a.length ? a[a.length >> 1] : null; };
const mean = a => { a = a.filter(x => x != null); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
const mmss = s => s == null ? '-' : Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
const f1 = x => x == null ? '-' : (Math.round(x * 10) / 10).toString();

const KEYS = ['level', 'pot15', 'pot', 'cd', 'def', 'hp', 'rgn', 'xp', 'upSide', 'newC', 'nMoves', 'potOff', 'potPass', 'full'];

function statsCmd(files) {
  for (const f of files) {
    const rs = load(f);
    const groups = {};
    for (const r of rs) (groups[r.dex] = groups[r.dex] || []).push(metrics(r));
    groups.all = rs.map(metrics);
    console.log('\n' + f + '  (medianas)');
    console.log(['dex', 'n', 't med', ...KEYS].map(s => s.padStart(7)).join(''));
    for (const k in groups) {
      const g = groups[k];
      console.log([k, g.length, mmss(med(g.map(x => x.time))), ...KEYS.map(K => f1(med(g.map(x => x[K]))))].map(s => String(s).padStart(7)).join(''));
    }
  }
}

// bootstrap con generador fijo (reproducible)
function boot(d, N = 4000) {
  let s = 987654321;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x80000000; };
  const ms = [];
  for (let k = 0; k < N; k++) { let t = 0; for (let i = 0; i < d.length; i++) t += d[Math.floor(rnd() * d.length)]; ms.push(t / d.length); }
  ms.sort((x, y) => x - y);
  return [ms[Math.floor(N * 0.025)], ms[Math.floor(N * 0.975)]];
}

function pairRows(A, B) {
  const key = r => r.dex + ':' + r.seed;
  const mb = new Map(B.map(r => [key(r), r]));
  const out = [];
  for (const a of A) { const b = mb.get(key(a)); if (b) out.push({ dex: a.dex, a: metrics(a), b: metrics(b), capA: a.time >= (a.judgeAt || 1e9) || !a.dead, capB: !b.dead }); }
  return out;
}

function pairSummary(rows) {
  const d = rows.map(p => Math.log(p.b.time / p.a.time));
  const m = mean(d);
  const ci = d.length > 2 ? boot(d) : [NaN, NaN];
  const w = rows.filter(p => p.b.time > p.a.time + 2).length, l = rows.filter(p => p.b.time < p.a.time - 2).length;
  const dm = k => { const x = rows.map(p => p.b[k] != null && p.a[k] != null ? p.b[k] - p.a[k] : null); return mean(x); };
  return { n: rows.length, tA: med(rows.map(p => p.a.time)), tB: med(rows.map(p => p.b.time)), geo: Math.exp(m), lo: Math.exp(ci[0]), hi: Math.exp(ci[1]), w, l,
    r30A: rows.filter(p => p.a.time >= 1800).length, r30B: rows.filter(p => p.b.time >= 1800).length,
    dLv: dm('level'), dPot: dm('pot'), dPot15: dm('pot15'), dDef: dm('def'), dHp: dm('hp'), dCd: dm('cd'), dUpSide: dm('upSide'), dOff: dm('potOff'), dFull: dm('full') };
}

function pairCmd(fa, fb, by) {
  const rows = pairRows(load(fa), load(fb));
  const head = ['', 'n', 'A med', 'B med', '×geo', 'IC95', 'B gana', 'pierde', '≥30 A', '≥30 B', 'Δnv', 'ΔPot', 'ΔPot15', 'ΔCor', 'ΔVig', 'ΔRef', 'ΔupFuera', 'ΔPotOf%', 'Δllenos%'];
  const line = (lab, s) => [lab, s.n, mmss(s.tA), mmss(s.tB), s.geo.toFixed(3), s.lo.toFixed(2) + '-' + s.hi.toFixed(2), s.w, s.l, s.r30A, s.r30B,
    f1(s.dLv), f1(s.dPot), f1(s.dPot15), f1(s.dDef), f1(s.dHp), f1(s.dCd), f1(s.dUpSide), f1(s.dOff), f1(s.dFull)];
  const lines = [];
  if (by !== false) {
    const dexs = [...new Set(rows.map(p => p.dex))];
    for (const dx of dexs) lines.push(line(String(dx), pairSummary(rows.filter(p => p.dex === dx))));
  }
  const all = pairSummary(rows);
  lines.push(line('todos', all));
  const W = head.map((_, k) => Math.max(head[k].length, ...lines.map(r => String(r[k]).length)));
  console.log(`B = ${fb}\nA = ${fa}`);
  console.log(head.map((h, k) => k ? String(h).padStart(W[k]) : String(h).padEnd(W[k])).join('  '));
  for (const r of lines) console.log(r.map((x, k) => k ? String(x).padStart(W[k]) : String(x).padEnd(W[k])).join('  '));
  return all;
}

module.exports = { metrics, pairRows, pairSummary, load };

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'stats') statsCmd(rest);
  else if (cmd === 'pair') pairCmd(rest[0], rest[1], !rest.includes('--nodex'));
  else console.log('uso: cardlab.js stats f.json ... | pair A.json B.json [--nodex]');
}
