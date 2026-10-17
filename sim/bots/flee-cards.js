// Prueba: movimiento de flee.js + decisiones de cards.js.
module.exports = (opts = {}) => Object.assign(require('./flee')(opts), require('./cards')(opts), { name: 'flee-cards' });
