#!/usr/bin/env node
/* ============ sim/deathtrace.js — ¿de qué muere una partida? ============
 * Uso: node sim/deathtrace.js --dex 462 --seed 101 [--bot best] [--ban auto] [--upgrades max]
 *        [--max 1900] [--last 60] [--opts '{...}'] [--json f]
 *
 * Juega UNA partida igual que run.js y apunta cada golpe recibido: segundo, daño real,
 * de dónde viene (contacto, disparo, zona/peligro, líquido, trampa, Arceus), el tipo del
 * golpe y su multiplicador contra los tipos del jugador, quién lo dio (contacto: el enemigo
 * que acaba de tocar), enemigos a 60/120 px, vida tras el golpe, hueco activo, grieta/evento.
 * Imprime el resumen de los últimos --last segundos antes de caer (por fuente, por tipo y
 * por enemigo), los últimos golpes y una línea por cada 10 s del final (vida, enemigos cerca,
 * velocidad del bot). No toca el juego: envuelve pl.hurt desde el bot.
 */
const path = require('path'), fs = require('fs');
const { runOne } = require('./engine');

function parseArgs(a) {
  const o = {};
  for (let i = 2; i < a.length; i++) if (a[i].startsWith('--')) { const k = a[i].slice(2); o[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; }
  return o;
}
const a = parseArgs(process.argv);
const dex = +a.dex, seed = +(a.seed || 1), botName = a.bot || 'best', last = +(a.last || 60);
const mk = require(path.join(__dirname, 'bots', botName));
const bot = mk(a.opts ? JSON.parse(a.opts) : {});

let ban;
if (a.ban === 'auto') { const { load } = require('./load'); const G0 = load(1).G; ban = mk.bans ? mk.bans(G0.DEX_BY[dex], G0) : undefined; }
else if (a.ban) ban = String(a.ban).split(',');

const hits = [], ticks = [];
let wrapped = false, lastPos = null;
const move0 = bot.move.bind(bot);
bot.move = function (api) {
  const { G, pl } = api;
  if (!wrapped) {
    wrapped = true;
    const inner = pl.hurt;                 // el envoltorio del motor (mide y aplica)
    pl.hurt = function (amount, type, pure, cat) {      // cat: físico/especial (19-10-2026)
      const before = this.hp;
      const stack = new Error().stack.split('\n').slice(2, 6).join(' ');
      let src = 'otro';
      if (/combat\.js:\d+/.test(stack)) src = /pl\.hurt\(e\.dmg|combat\.js:66\d/.test(stack) ? 'contacto' : 'disparo';
      // (combat.js del 19-10-2026: disparo enemigo en la línea 772, contacto en la 877)
      if (/combat\.js:77\d/.test(stack)) src = 'disparo';
      if (/combat\.js:87\d/.test(stack)) src = 'contacto';
      if (/hazards\.js/.test(stack)) src = 'zona';
      if (/interact\.js/.test(stack)) src = 'trampa';
      if (/judgment\.js/.test(stack)) src = 'arceus';
      if (/player\.js/.test(stack)) src = 'líquido';
      let who = '';
      if (src === 'contacto') {
        const touching = G.EnemyMgr.queryCircle(this.x, this.y, this.r + 60).filter(e => !e.dead && Math.abs(e.touchCd - 0.55) < 1e-9);
        who = touching.map(e => e.name + (e.boss ? '(jefe)' : '')).join('/');
      }
      const k = type ? G.Types.mult(type, this.mon.types) : 1;
      const near = r => G.EnemyMgr.queryCircle(this.x, this.y, r).filter(e => !e.dead).length;
      inner.call(this, amount, type, pure, cat);
      const d = before - this.hp;
      if (d > 0) hits.push({ t: +api.time.toFixed(1), d: Math.round(d), raw: Math.round(amount), src, type: type || '-', k, who,
        hp: Math.round(this.hp), max: Math.round(this.maxHp), n60: near(60), n120: near(120), total: G.EnemyMgr.count,
        active: (this.slots[this.active] || []).map(m => m.id).join('+'),
        arena: !!G.Rift.inArena, ev: G.Events.current || '', red: +this.reduction.toFixed(2) });
    };
  }
  const v = move0(api);
  const t = api.time;
  if (!ticks.length || t - ticks[ticks.length - 1].t >= 1) {
    const sp = lastPos ? Math.hypot(pl.x - lastPos[0], pl.y - lastPos[1]) : 0;
    lastPos = [pl.x, pl.y];
    const near = r => G.EnemyMgr.queryCircle(pl.x, pl.y, r).filter(e => !e.dead).length;
    ticks.push({ t: +t.toFixed(0), hp: Math.round(pl.hp), max: Math.round(pl.maxHp), lv: pl.level, n: G.EnemyMgr.count, n120: near(120), n250: near(250),
                 moved: Math.round(sp), active: (pl.slots[pl.active] || []).map(m => m.id + ':' + m.lvl).join('+'), arena: !!G.Rift.inArena });
  }
  return v;
};

let levels = a.upgrades === 'none' ? {} : 'max';
const r = runOne({ dex, seed, bot, upgrades: levels, maxTime: +(a.max || 1900), ban });
const end = r.timeExact;
const lastHits = hits.filter(h => h.t >= end - last);
const agg = key => { const o = {}; for (const h of lastHits) { const k = key(h); o[k] = (o[k] || 0) + h.d; } return Object.entries(o).sort((x, y) => y[1] - x[1]); };
console.log(`${r.name} semilla ${seed}: ${Math.floor(r.time / 60)}:${String(r.time % 60).padStart(2, '0')} ${r.dead ? 'CAE' : 'aguanta'}  nv ${r.level}  derrotados ${r.kills}  objeto ${r.item}  reducción ${r.reduce}`);
console.log('huecos:', r.moves.join(' | '));
console.log(`golpes totales ${hits.length}, daño ${hits.reduce((s, h) => s + h.d, 0)}; últimos ${last} s: ${lastHits.length} golpes, ${lastHits.reduce((s, h) => s + h.d, 0)} de daño`);
console.log('por fuente:', agg(h => h.src).map(([k, v]) => k + ' ' + v).join(', '));
console.log('por tipo (×mult):', agg(h => h.type + '×' + h.k).map(([k, v]) => k + ' ' + v).join(', '));
console.log('por enemigo:', agg(h => h.who || h.src).slice(0, 8).map(([k, v]) => k + ' ' + v).join(', '));
console.log('últimos golpes:');
for (const h of hits.slice(-12)) console.log(`  ${h.t}s -${h.d} (bruto ${h.raw}) ${h.src} ${h.type}×${h.k} ${h.who} vida ${h.hp}/${h.max} cerca60 ${h.n60} cerca120 ${h.n120} total ${h.total} activo ${h.active}${h.arena ? ' GRIETA' : ''}${h.ev ? ' evento ' + h.ev : ''}`);
console.log('final, cada 10 s:');
for (const k of ticks.filter(k => k.t >= end - last && k.t % 10 === 0)) console.log(`  ${k.t}s vida ${k.hp}/${k.max} nv ${k.lv} enemigos ${k.n} (120px ${k.n120}, 250px ${k.n250}) movido ${k.moved}px/s activo ${k.active}${k.arena ? ' GRIETA' : ''}`);
if (a.json) fs.writeFileSync(a.json, JSON.stringify({ r, hits, ticks }, null, 1));
