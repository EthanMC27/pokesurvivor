#!/usr/bin/env node
/* ============ sim/compare.js — compara resultados de run.js --json ============
 * Uso: node sim/compare.js a.json b.json ... [--by dex] [--csv]
 *   Una fila por fichero (o por fichero y Pokémon con --by dex): tiempo (mediana, media,
 *   p10, p90), nivel, derrotados, jefes, vínculos, partidas que llegan al minuto 30 y, si
 *   son inmortales, vidas perdidas antes de la Sentencia (mediana y media) y legendarios
 *   vencidos en la Sentencia.
 *   --csv: la misma tabla en CSV.
 */
const fs = require('fs'), path = require('path');
const { summarize, table } = require('./run');

const args = process.argv.slice(2);
const by = args.includes('--by') ? args[args.indexOf('--by') + 1] : null;
const csv = args.includes('--csv');
const files = args.filter((x, i) => !x.startsWith('--') && args[i - 1] !== '--by');
if (!files.length) { console.log('Uso: node sim/compare.js a.json b.json ... [--by dex] [--csv]'); process.exit(1); }

const rows = [];
for (const f of files) {
  const rs = JSON.parse(fs.readFileSync(f, 'utf8'));
  const name = path.basename(f, '.json');
  if (by) {
    const keys = [...new Set(rs.filter(r => !r.error).map(r => r[by]))];
    for (const k of keys) {
      const g = rs.filter(r => r[by] === k);
      const nm = by === 'dex' && g[0] && g[0].name ? `${g[0].name}` : String(k);
      rows.push({ label: `${name} · ${nm}`, s: summarize(g) });
    }
  } else rows.push({ label: name, s: summarize(rs) });
}

if (csv) {
  const cols = ['n', 'errors', 'timeMed', 'timeMean', 'timeP10', 'timeP90', 'levelMed', 'levelMean', 'killsMed', 'killsMean', 'bossesMean', 'bondsMean', 'riftsMean', 'reached30',
                'livesMed', 'livesMean', 'lives30Med', 'lives30Mean'];
  console.log(['label', ...cols, 'judgeBossesMed', 'judgeTimeMed'].join(','));
  for (const { label, s } of rows) console.log([JSON.stringify(label), ...cols.map(c => s[c] != null ? s[c] : ''), s.judge ? s.judge.bossesMed : '', s.judge ? s.judge.timeMed : ''].join(','));
} else {
  console.log(table(rows));
}
