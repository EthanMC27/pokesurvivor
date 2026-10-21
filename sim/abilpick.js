/* ============ sim/abilpick.js — qué habilidad poner a cada Pokémon en los barridos ============
 * (22-10-2026) Para la criba no se pueden probar todas las habilidades de los 966: se elige la
 * que parece mejor con una nota fija por habilidad (≈ × al daño o al aguante en una partida
 * normal). Es una CONJETURA para ordenar: lo que importa se mide luego hueco a hueco (--abil 0/1/2).
 *
 *   pick(G, dex, hidden) -> hueco (0, 1 o 2). Sin `hidden`, sólo 0 y 1 (lo que da una Cápsula
 *   Habilidad normal, 1.500 monedas); con él también la oculta (Cápsula Oculta, 5.000).
 * En engine.js: o.abil = 'best' (sin oculta) o 'best-h' (con oculta).
 */
const NOTE = {
  'huge-power': 1.45, 'pure-power': 1.45, 'schooling': 1.35, 'adaptability': 1.18,
  'beast-boost': 1.14, 'moxie': 1.14, 'chilling-neigh': 1.14, 'grim-neigh': 1.14,
  'protean': 1.12, 'libero': 1.12, 'anger-point': 1.1, 'hustle': 1.08, 'no-guard': 1.08,
  'stance-change': 1.08, 'speed-boost': 1.08, 'analytic': 1.07, 'sturdy': 1.06,
  'technician': 1.05, 'tough-claws': 1.05, 'sheer-force': 1.05, 'super-luck': 1.05, 'fur-coat': 1.05,
  'water-bubble': 1.1, 'regenerator': 1.04, 'levitate': 1.04, 'fluffy': 1.04, 'ice-scales': 1.04,
  'skill-link': 1.04, 'mold-breaker': 1.04, 'multiscale': 1.03, 'shadow-shield': 1.03,
  'compound-eyes': 1.03, 'sniper': 1.03, 'intimidate': 1.03, 'run-away': 1.03, 'iron-fist': 1.03,
  'strong-jaw': 1.03, 'sharpness': 1.03, 'mega-launcher': 1.03, 'rivalry': 1.03, 'keen-eye': 1.03,
  'plus': 1.02, 'minus': 1.02, 'tinted-lens': 1.03, 'pressure': 1.03, 'shell-armor': 1.03, 'battle-armor': 1.03,
  'truant': 0.85, 'slow-start': 0.95, 'defeatist': 0.97, 'klutz': 0.99, 'solar-power': 1.0
};
// +X % con su tipo: vale si el Pokémon es de ese tipo.
const TYPED = { 'steelworker': 'steel', 'steely-spirit': 'steel', 'dragons-maw': 'dragon', 'transistor': 'electric' };

function note(G, id, mon) {
  if (!id) return 0;
  const fx = G.AbilityFX.FX[id];
  if (!fx) return 1.04;                                   // genérica: +8 % con su tipo principal
  let n = TYPED[id] ? (mon.types.includes(TYPED[id]) ? 1.12 : 1) : NOTE[id] || 1.0;
  if (fx.plus) n *= 1.04;                                 // suma la genérica
  return n;
}

function pick(G, dex, hidden) {
  const l = G.DEX_ABIL[dex] || [0, 0, 0], mon = G.DEX_BY[dex];
  let best = 0, bn = -1;
  for (const s of hidden ? [0, 1, 2] : [0, 1]) {
    const n = note(G, l[s], mon);
    if (l[s] && n > bn + 1e-9) { best = s; bn = n; }
  }
  return best;
}

module.exports = { pick, note, NOTE };
