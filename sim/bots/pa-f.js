/* ============ sim/bots/pa-f.js — pro-a + cartas v2 CONGELADAS (banco del movimiento) ============
 *
 * Para medir cambios del movimiento de pro-a sin que las cartas cambien por debajo:
 * usa cards-v2-frozen.js (copia de cards.js v2 del 17-10-2026) y sus vetos.
 * Uso: node sim/run.js --bot pa-f --ban auto --upgrades max ... [--opts '{...}' → pro-a]
 */
const cards = require('./cards-v2-frozen');

module.exports = (opts = {}) => {
  const bot = require('./pro-a')(Object.assign({}, opts, { cards: 'v2f' }));
  bot.name = 'pa-f';
  return bot;
};
module.exports.bans = (dex, G) => cards.bans(dex, G);
