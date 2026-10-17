/* ============ sim/bots/with-cards.js — un bot de movimiento con OTRA política de cartas ============
 *
 * Los bots de movimiento (spacer, dodger, forager) hacen require('./cards') al
 * crearse y esa política decide también el hueco activo. Para comparar
 * políticas (A/B) sin tocar esos bots, esto cambia por un momento lo que
 * devuelve require('./cards') mientras se crea el bot.
 *
 *   withCards('spacer', './cards-v1')(opts)   → spacer con la política congelada v1
 */
const path = require('path');

module.exports = function withCards(mover, cardsPath) {
  return (opts = {}) => {
    const key = require.resolve('./cards');
    const prev = require.cache[key];
    const factory = require(path.join(__dirname, cardsPath));
    require.cache[key] = { id: key, filename: key, loaded: true, exports: factory, children: [], paths: [] };
    try {
      const bot = require('./' + mover)(opts);
      bot.name = mover + '+' + path.basename(cardsPath);
      return bot;
    } finally {
      if (prev) require.cache[key] = prev; else delete require.cache[key];
    }
  };
};
