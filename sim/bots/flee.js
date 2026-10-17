// Bot de referencia (muy tonto): huye del centro de masa de lo cercano y coge la primera carta.
module.exports = () => ({
  name: 'flee',
  move({ pl, time, sense }) {
    let sx = 0, sy = 0;
    for (const e of sense().enemies) {
      const dx = e.x - pl.x, dy = e.y - pl.y, d2 = dx * dx + dy * dy;
      if (d2 > 160 * 160) continue;
      const d = Math.sqrt(d2) || 1; sx -= dx / d / d; sy -= dy / d / d;
    }
    const n = Math.hypot(sx, sy);
    return n > 0 ? [sx / n, sy / n] : [Math.cos(time * 0.3), Math.sin(time * 0.3)];
  },
  card: () => 0
});
