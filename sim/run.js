#!/usr/bin/env node
/* Uso: node sim/run.js --dex 94 --bot spacer --seeds 1-20 [--upgrades max] [--max 2700] [--jobs 8] [--json out.json]
 *        [--dt 1/60] [--ban id1,id2 | --ban auto] [--bind '{"shadow-ball":0}'] [--opts '{...}']
 *        [--immortal [--mortal-rifts] [--mortal-judge]] [--quiet] [--table]
 *
 *   --dex 4,94,68     varios Pokémon: se lanzan todos y se resume cada uno (tabla).
 *   --ban auto        vetos de la política de cartas: `bans` del bot o de bots/cards.js
 *                     (array, { dex: [...] } o función (dex, G) -> [...]); si no hay, ninguno.
 *   --immortal        no se muere (ver FIDELITY.md); --mortal-rifts: en la grieta sí (se puede
 *                     perder); --mortal-judge: en la Sentencia sí (acaba al caer).
 *   --table           sólo la tabla final (sin una línea por partida).
 *
 * Lanza N partidas (una por semilla y Pokémon) en paralelo y resume. Los hilos se reutilizan
 * (el código del juego se compila una vez por hilo); cada partida carga el juego y el bot de
 * cero, así que el resultado no depende del orden ni del hilo.
 *
 * Exporta: runJobs(jobs, nHilos, onDone), summarize(resultados), table(filas), range('1-5,8').
 */
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os'), path = require('path'), fs = require('fs');

const BOTS = path.join(__dirname, 'bots');

function runJob(job) {
  const { runOne } = require('./engine');
  // Bot de cero en cada partida (por si guarda algo a nivel de módulo).
  for (const k of Object.keys(require.cache)) if (k.startsWith(BOTS)) delete require.cache[k];
  const mk = require(path.join(BOTS, job.bot));
  return runOne({ dex: job.dex, seed: job.seed, bot: mk(job.botOpts || {}), upgrades: job.upgrades, maxTime: job.maxTime, start: job.start, item: job.item,
                  dt: job.dt, ban: job.ban, bind: job.bind, immortal: job.immortal, mortalRifts: job.mortalRifts, mortalJudge: job.mortalJudge });
}

if (!isMainThread) {
  const safe = job => { try { return runJob(job); } catch (e) { return { error: String(e && e.stack || e), job }; } };
  if (workerData && workerData.job) {            // (forma antigua: un hilo por partida)
    parentPort.postMessage(safe(workerData.job));
  } else {
    parentPort.on('message', job => parentPort.postMessage(safe(job)));
  }
  return;
}

function parseArgs(a) {
  const o = {};
  for (let i = 2; i < a.length; i++) if (a[i].startsWith('--')) { const k = a[i].slice(2); o[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; }
  return o;
}
function range(s) { const out = []; for (const part of String(s).split(',')) { const [a, b] = part.split('-').map(Number); for (let i = a; i <= (b || a); i++) out.push(i); } return out; }

/** Reparte las partidas entre nWorkers hilos (reutilizados). Devuelve los resultados en el orden de `jobs`. */
async function runJobs(jobs, nWorkers = Math.max(1, os.cpus().length - 2), onDone) {
  const results = new Array(jobs.length);
  let next = 0;
  const lane = async () => {
    let w = null;
    const spawn = () => { w = new Worker(__filename); };
    while (next < jobs.length) {
      const i = next++;
      if (!w) spawn();
      results[i] = await new Promise(res => {
        const onMsg = m => { cleanup(); res(m); };
        const onErr = e => { cleanup(); w.terminate(); w = null; res({ error: String(e && e.stack || e), job: jobs[i] }); };
        const onExit = c => { cleanup(); w = null; res({ error: 'el hilo se cerró (' + c + ')', job: jobs[i] }); };
        const cleanup = () => { w.off('message', onMsg); w.off('error', onErr); w.off('exit', onExit); };
        w.on('message', onMsg); w.once('error', onErr); w.once('exit', onExit);
        w.postMessage(jobs[i]);
      });
      if (onDone) onDone(results[i], i);
    }
    if (w) await w.terminate();
  };
  await Promise.all(Array.from({ length: Math.min(nWorkers, jobs.length) }, lane));
  return results;
}

// ---------------- resúmenes ----------------

const sorted = a => a.filter(x => x != null && !Number.isNaN(x)).sort((x, y) => x - y);
const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
const med = a => q(a, 0.5);
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

/** Resumen de un grupo de partidas (los campos antiguos se mantienen). */
function summarize(rs) {
  const ok = rs.filter(r => r && !r.error);
  const v = k => sorted(ok.map(r => typeof k === 'function' ? k(r) : r[k]));
  const t = v('time');
  const out = { n: ok.length, errors: rs.length - ok.length, timeMed: med(t), timeMean: Math.round(mean(t)), timeP10: q(t, 0.1), timeP90: q(t, 0.9),
                levelMed: med(v('level')), killsMed: med(v('kills')), bossesMean: +mean(v('bosses')).toFixed(2), reached30: ok.filter(r => r.time >= 1800).length };
  // (añadidos)
  out.levelMean = +mean(v('level')).toFixed(1);
  out.killsMean = Math.round(mean(v('kills')));
  out.bondsMean = +mean(v('bonds')).toFixed(2);
  out.riftsMean = +mean(v('riftsSeen')).toFixed(2);
  if (ok.some(r => r.immortal)) {
    // vidas antes de la Sentencia (ficheros antiguos sin lives30: la curva del minuto 30, o el total)
    const pre = r => { if (r.lives30 != null) return r.lives30; const c = (r.curve || []).find(x => x.m === 30); return c ? c.lives : r.lives; };
    const l = v('lives'), l30 = v(pre);
    Object.assign(out, { livesMed: +med(l).toFixed(2), livesMean: +mean(l).toFixed(2), lives30Med: +med(l30).toFixed(2), lives30Mean: +mean(l30).toFixed(2) });
  }
  const j = ok.filter(r => r.judge);
  if (j.length) out.judge = { n: j.length, bossesMed: med(sorted(j.map(r => r.judge.bosses))), timeMed: Math.round(med(sorted(j.map(r => r.judge.time)))) };
  return out;
}

/** Tabla de texto con columnas alineadas. filas: [{ label, s: summarize(...) }] */
function table(rows) {
  const anyImm = rows.some(r => r.s.livesMed != null), anyJ = rows.some(r => r.s.judge);
  const head = ['', 'n', 't med', 't media', 'p10', 'p90', 'nv med', 'derrot. med', 'jefes', 'vínc.', '≥30'];
  if (anyImm) head.push('vidas<30 med', 'vidas<30 media');
  if (anyJ) head.push('Sentencia: leg. med', 's');
  const mmss = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
  const lines = rows.map(({ label, s }) => {
    const c = [label, s.n + (s.errors ? '+' + s.errors + 'err' : ''), mmss(s.timeMed), mmss(s.timeMean), mmss(s.timeP10), mmss(s.timeP90), s.levelMed, s.killsMed,
               s.bossesMean, s.bondsMean, s.reached30 + '/' + s.n];
    if (anyImm) c.push(s.lives30Med != null ? s.lives30Med : '-', s.lives30Mean != null ? s.lives30Mean : '-');
    if (anyJ) c.push(s.judge ? s.judge.bossesMed : '-', s.judge ? s.judge.timeMed : '-');
    return c.map(String);
  });
  const all = [head, ...lines];
  const w = head.map((_, k) => Math.max(...all.map(r => (r[k] || '').length)));
  const fmt = r => r.map((x, k) => k === 0 ? x.padEnd(w[k]) : x.padStart(w[k])).join('  ');
  return [fmt(head), w.map(n => '-'.repeat(n)).join('  '), ...lines.map(fmt)].join('\n');
}

/** Vetos de la política de cartas (--ban auto). */
function autoBans(botName, dex) {
  const tryMod = p => { try { return require(p); } catch (e) { return null; } };
  for (const m of [tryMod(path.join(BOTS, botName)), tryMod(path.join(BOTS, 'cards'))]) {
    if (!m || m.bans == null) continue;
    let b = m.bans;
    if (typeof b === 'function') { const { load } = require('./load'); b = b(dex, load(1).G); }
    else if (!Array.isArray(b) && typeof b === 'object') b = b[dex];
    if (Array.isArray(b)) return b.slice();
  }
  return undefined;
}

module.exports = { runJobs, summarize, range, table };

if (require.main === module) {
  const a = parseArgs(process.argv);
  const seeds = range(a.seeds || '1-8');
  const dexs = String(a.dex || 4).split(',').map(Number);
  const upgrades = a.upgrades === 'max' ? 'max' : a.upgrades ? JSON.parse(a.upgrades) : {};
  const bot = a.bot || 'flee';
  const jobs = [];
  for (const dex of dexs) {
    const ban = a.ban === 'auto' ? autoBans(bot, dex) : a.ban ? String(a.ban).split(',') : undefined;
    if (a.ban === 'auto' && !a.quiet) console.log(`vetos (auto) ${dex}: ${ban && ban.length ? ban.join(', ') : 'ninguno'}`);
    for (const seed of seeds) jobs.push({ dex, seed, bot, upgrades, maxTime: +a.max || 2700, start: a.start, item: a.item,
      botOpts: a.opts ? JSON.parse(a.opts) : {},
      dt: a.dt ? (String(a.dt).includes('/') ? 1 / +String(a.dt).split('/')[1] : +a.dt) : undefined,
      ban, bind: a.bind ? JSON.parse(a.bind) : undefined, immortal: !!a.immortal, mortalRifts: !!a['mortal-rifts'], mortalJudge: !!a['mortal-judge'] });
  }
  const t0 = Date.now();
  const line = r => r.error ? 'ERROR ' + r.error.split('\n').slice(0, 3).join(' | ')
    : `${r.name} seed ${r.seed}: ${r.time}s nv${r.level} ${r.kills} derrotados, jefes ${r.bosses}, vínculos ${r.bonds}` +
      (r.immortal ? `, vidas ${r.lives30 != null ? r.lives30 : r.lives}` : '') + (r.judge ? `, Sentencia ${Math.round(r.judge.time)}s ${r.judge.bosses} leg.` : '') +
      `, ${r.moves.join(' / ')}${r.item ? ' [' + r.item + ']' : ''}`;
  runJobs(jobs, +a.jobs || undefined, r => { if (!a.quiet && !a.table) console.log(line(r)); })
    .then(rs => {
      const secs = ((Date.now() - t0) / 1000).toFixed(0);
      if (dexs.length === 1 && !a.table) console.log(JSON.stringify(summarize(rs)), `(${secs} s reales)`);
      const rows = dexs.map(dex => { const g = rs.filter(r => (r.dex != null ? r.dex : r.job && r.job.dex) === dex); return { label: g.find(r => r.name) ? `${g.find(r => r.name).name} (${dex})` : String(dex), s: summarize(g) }; });
      if (dexs.length > 1) rows.push({ label: 'todos', s: summarize(rs) });
      if (dexs.length > 1 || a.table) console.log(`\n${bot}, ${seeds.length} semillas${a.immortal ? ', inmortal' : ''} (${secs} s reales)\n` + table(rows));
      if (a.json) fs.writeFileSync(a.json, JSON.stringify(rs, null, 1));
    });
}
