/* ============ sim/bots/best-c22.js — prueba: pro-a del 21-10 (sin inK) + cards.js actual (con abilK) ============ */
module.exports = (opts = {}) => {
  const bot = require('./pro-a-v5-frozen')(opts);
  bot.name = 'best-c22';
  return bot;
};
module.exports.bans = (dex, G, opts) => require('./cards').bans(dex, G, opts || {});
