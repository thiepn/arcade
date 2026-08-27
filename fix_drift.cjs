const fs = require('fs');
let code = fs.readFileSync('src/games/DriftGame.tsx', 'utf8');

// 1. Fix resizeCanvas
code = code.replace(
`    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      gameStateRef.current.carX = canvas.width / 2;
      gameStateRef.current.carY = canvas.height * 0.76;
    };`,
`    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      gameStateRef.current.carX = w / 2;
      gameStateRef.current.carY = h * 0.76;
    };`
);

// 2. Fix loop width/height scaling
code = code.replace(
`    const loop = () => {
      const st = gameStateRef.current;
      const w = canvas.width;
      const h = canvas.height;`,
`    const loop = () => {
      const st = gameStateRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.save();
      ctx.scale(dpr, dpr);`
);

// 3. Add ctx.restore() at the end of loop
// The end of loop is around 942, before animationFrameId = requestAnimationFrame(loop);
code = code.replace(
`      if (st.isAlive) {
        animationFrameId = requestAnimationFrame(loop);
      }
    };`,
`      ctx.restore();
      if (st.isAlive) {
        animationFrameId = requestAnimationFrame(loop);
      }
    };`
);

fs.writeFileSync('src/games/DriftGame.tsx', code);
console.log('Fixed DriftGame.tsx');
