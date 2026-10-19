#!/usr/bin/env node
/* ============ sim/deathcause.js — de qué muere una partida ============
 * Uso: node sim/deathcause.js --dex 462 --seeds 301-305 [--bot best] [--ban auto | a,b,c] [--opts '{...}'] [--max 1900] [--last 15]
 *
 * Envuelve pl.hurt para apuntar cada golpe recibido: cuánto, de dónde (fichero:línea de quien
 * llama: combat.js 566 = disparo enemigo, 667 = contacto, hazards.js = zona avisada, judgment.js,
 * interact.js...), si se estaba en la grieta, y la vida que quedaba. Al morir da el reparto del
 * daño de los últimos `--last` segundos, el minuto y el nivel. Una partida por semilla, en serie.
 */
const path = require('path');
const { runOne } = require('./engine');
const { load } = require('./load');
const a = {}; const av = process.argv;
for (let i = 2; i < av.length; i++) if (av[i].startsWith('--')) a[av[i].slice(2)] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true;
const range = s => { const o = []; for (const p of String(s).split(',')) { const [x, y] = p.split('-').map(Number); for (let i = x; i <= (y || x); i++) o.push(i); } return o; };
const botName = a.bot || 'best', dex = +a.dex, last = +a.last || 15;
const opts = a.opts ? JSON.parse(a.opts) : {};
let ban;
if (a.ban === 'auto') { const { G } = load(1); ban = require('./bots/cards').bans(G.DEX_BY[dex], G); }
else if (a.ban) ban = String(a.ban).split(',');

for (const seed of range(a.seeds || '1')) {
  for (const k of Object.keys(require.cache)) if (k.includes(path.join('sim', 'bots'))) delete require.cache[k];
  const bot = require('./bots/' + botName)(opts);
  const log = [];
  const init0 = bot.init;
  bot.init = function (api) {
    const pl = api.pl, G = api.G, h0 = pl.hurt.bind(pl);
    pl.hurt = function (amount, type, pure) {
      // Primer marco que no sea este envoltorio ni el motor (engine.js también envuelve hurt).
      const st = (new Error().stack || '').split('\n').slice(2).find(l => !/deathcause\.js|engine\.js/.test(l)) || '';
      const m = st.match(/([\w-]+\.js):(\d+)/);
      // Contacto: quién toca (el más cercano) y cuántos hay a 120 px.
      let who = '';
      if (m && m[1] === 'combat.js' && +m[2] > 600) {
        const near = G.EnemyMgr.queryCircle(pl.x, pl.y, 120).filter(e => !e.dead);
        const e = near.sort((a, b) => G.U.dist2(a.x, a.y, pl.x, pl.y) - G.U.dist2(b.x, b.y, pl.x, pl.y))[0];
        // Por tamaño de la horda que te rodea (y si es un jefe): así se ve si te encierran.
        if (e) who = ' contacto' + (e.boss ? ' JEFE' : '') + (near.length >= 10 ? ' 10+ cerca' : near.length >= 4 ? ' 4-9 cerca' : ' 1-3 cerca');
      }
      const hp0 = pl.hp, r = h0(amount, type, pure);
      log.push({ t: api.G.Game.st.time, src: (m ? m[1] + ':' + m[2] : '?') + who, raw: amount, real: hp0 - pl.hp, arena: !!G.Rift.inArena, act: pl.active, judge: !!G.Judgment.active, hp: pl.hp });
      return r;
    };
    if (init0) return init0.call(this, api);
  };
  const r = runOne({ dex, seed, bot, upgrades: 'max', maxTime: +a.max || 1900, ban });
  const end = r.timeExact || r.time;
  const win = log.filter(x => x.t >= end - last);
  const acts = {}; for (const x of win) acts[x.act] = (acts[x.act] || 0) + 1;
  const by = {};
  for (const x of win) { const k = x.src + (x.arena ? ' (grieta)' : '') + (x.judge ? ' (Sentencia)' : ''); (by[k] = by[k] || { n: 0, real: 0 }); by[k].n++; by[k].real += x.real; }
  console.log(`${r.name} semilla ${seed}: ${r.dead ? 'cae' : 'vive'} a ${Math.floor(end / 60)}:${String(Math.round(end % 60)).padStart(2, '0')} nv ${r.level}, reducción ${r.reduce}, vida máx ${r.curve.length ? r.curve[r.curve.length - 1].hp : '?'}, objeto ${r.item}, hueco activo al final ${JSON.stringify(acts)}, huecos ${JSON.stringify(r.moves)}`);
  if (r.dead) for (const [k, v] of Object.entries(by).sort((x, y) => y[1].real - x[1].real))
    console.log(`   ${k.padEnd(30)} ${String(v.n).padStart(4)} golpes  ${v.real.toFixed(0).padStart(6)} de vida`);
}
