/* ============ sim/bots/best.js — el mejor bot hasta ahora ============
 *
 * Ganador de la ronda 2 (16-10-2026, sim/out/r2-*.json): pro-a con la política de
 * cartas v2 (cards.js). 5 Pokémon × 20 semillas, --upgrades max --ban auto --max 1900:
 * mediana 13:27 (pro-b v2 10:23, pro-a v1 7:40, pro-b v1 6:34), 30/100 llegan al min 30.
 *
 * Ronda 3 (17-10-2026, sim/out/r3/): pro-a pasa a cards.js kindMul.melee = 0,3 (antes 0,6):
 * el foco deja de ser un golpe de cerca (Golpe Kárate, Lengüetazo) que te mete en la horda.
 * 4 Pokémon (94, 4, 68, 9) × 40 semillas, tope 20 min: ×1,18 y ×1,09 de tiempo (Machamp ×1,60 y
 * ×1,44). Probado y descartado (sin mejora clara en 80-240 partidas): wT, vetos de Coraza, más
 * ataque, hpAhead, poisonK, cerco, lethal, marginT, replanear cada fotograma, wXp, banda por
 * daño, vida baja (lowHpK/lowBand), salidas de los rincones (escW, +4 % sin significación) y
 * kindMul.cone 0,6. Las opciones siguen en pro-a.js (apagadas).
 *
 * Uso: node sim/run.js --bot best --ban auto ...   (las --opts se pasan a pro-a;
 * 'cards' vale 'v2' salvo que se diga otra cosa).
 */
const cards = require('./cards');

module.exports = (opts = {}) => {
  const bot = require('./pro-a')(Object.assign({ cards: 'v2' }, opts));
  bot.name = 'best(pro-a+' + (opts.cards || 'v2') + ')';
  return bot;
};
// Vetos para --ban auto: los de la política v2.
module.exports.bans = (dex, G) => cards.bans(dex, G);
