/* ============ sim/bots/best-pre22.js — el best del 21-10-2026, sin saber de habilidades ============
 * pro-a-v5-frozen + cards-v4-frozen (a8ee098). Para comparar con el best actual (abilK en cards.js,
 * inK en pro-a.js). Vetos: los mismos que best.
 */
module.exports = (opts = {}) => {
  const bot = require('./pro-a-v5-frozen')(Object.assign({}, opts, { cards: 'v4f' }));
  bot.name = 'best-pre22';
  return bot;
};
module.exports.bans = (dex, G, opts) => require('./cards-v4-frozen').bans(dex, G, opts || {});
