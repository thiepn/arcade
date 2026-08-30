from pathlib import Path

path = Path('src/games/BladeGame.tsx')
s = path.read_text()

old = "import { createBladeLaunchTrajectory, getBladeGravity } from '../lib/bladeTrajectory';"
new = "import { createBladeLaunchTrajectory, getBladeGravity, getBladeSimulationStepBatch } from '../lib/bladeTrajectory';"
if old not in s:
    raise SystemExit('Blade trajectory import anchor not found')
s = s.replace(old, new, 1)

old = """    width: 420,
    height: 500,
  });
"""
new = """    width: 420,
    height: 500,
    physicsAccumulator: 0,
  });
"""
if old not in s:
    raise SystemExit('Blade state anchor not found')
s = s.replace(old, new, 1)

old = """    state.bladeTrail = [];
    state.spawnTimer = 20;
  }, []);
"""
new = """    state.bladeTrail = [];
    state.spawnTimer = 20;
    state.physicsAccumulator = 0;
  }, []);
"""
if old not in s:
    raise SystemExit('Blade reset anchor not found')
s = s.replace(old, new, 1)

old = """      ctx.save();
      // Screen Shake
      if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        state.shake *= 0.86;
        if (state.shake < 0.2) state.shake = 0;
      }
"""
new = """      ctx.save();
      // Screen shake decays by elapsed time, not render count.
      const frameScale = Math.max(0.001, Math.min(dt, 0.05) * 60);
      if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        state.shake *= Math.pow(0.86, frameScale);
        if (state.shake < 0.2) state.shake = 0;
      }
"""
if old not in s:
    raise SystemExit('Blade screen shake anchor not found')
s = s.replace(old, new, 1)

old = """      if (!isPausedRef.current && state.isAlive) {
        // Combo decay timer countdown
"""
new = """      if (!isPausedRef.current && state.isAlive) {
        const batch = getBladeSimulationStepBatch(state.physicsAccumulator, dt);
        state.physicsAccumulator = batch.remainderSec;

        // Preserve the original 60 Hz feel while making every gameplay timer and
        // physics update independent of the display refresh rate.
        for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++) {
        // Combo decay timer countdown
"""
if old not in s:
    raise SystemExit('Blade simulation start anchor not found')
s = s.replace(old, new, 1)

old = """        // Update Floating Popups
        for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
          const ft = state.floatingTexts[i];
          ft.y -= 1.1;
          ft.life++;
          if (ft.life >= ft.maxLife) {
            state.floatingTexts.splice(i, 1);
          }
        }
      }

      // ==========================================
"""
new = """        // Update Floating Popups
        for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
          const ft = state.floatingTexts[i];
          ft.y -= 1.1;
          ft.life++;
          if (ft.life >= ft.maxLife) {
            state.floatingTexts.splice(i, 1);
          }
        }
        }
      }

      // ==========================================
"""
if old not in s:
    raise SystemExit('Blade simulation end anchor not found')
s = s.replace(old, new, 1)

path.write_text(s)
