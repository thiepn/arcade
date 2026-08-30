import { readFileSync } from 'node:fs';
import {
  VANGUARD_FIXED_STEP_SEC,
  VANGUARD_PHYSICS_HZ,
  getVanguardPhysicsStepBatch,
} from '../src/lib/vanguardRuntime';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) errors.push(message); };
const source = readFileSync('src/games/VanguardGame.tsx', 'utf8');

assert(VANGUARD_PHYSICS_HZ === 60, `expected 60 Hz Vanguard simulation, found ${VANGUARD_PHYSICS_HZ}`);
assert(source.includes('getVanguardPhysicsStepBatch(state.physicsAccumulator, deltaSec)'), 'Vanguard does not batch elapsed time into fixed simulation steps');
assert(source.includes('for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++)'), 'Vanguard gameplay is not inside the fixed-step loop');
assert(source.includes('const dt = VANGUARD_FIXED_STEP_SEC'), 'Vanguard fixed-step dt is missing');
assert(source.includes('state.playerX += (state.targetX - state.playerX) * 0.35;'), 'Vanguard player smoothing contract changed unexpectedly');
assert(source.includes('enemy.x += enemy.vx;') && source.includes('b.x += b.vx;') && source.includes('drop.y += drop.vy;'), 'Vanguard entity motion is not covered by the fixed-step simulation');
assert(source.includes('state.shootCooldown++;') && source.includes('state.spawnTimer++;') && source.includes('enemy.shootTimer++;'), 'Vanguard firing/spawn cadence is not covered by the fixed-step simulation');
assert(source.includes('p.life -= 1.8 * dt;') && source.includes('popup.life -= 1.2 * dt;'), 'Vanguard effects are not advanced on gameplay time');
assert(source.includes('state.bombs <= 0 || !state.isAlive || isPausedRef.current'), 'Vanguard bomb action can mutate gameplay while paused');
assert(source.includes('if (isPausedRef.current || !gameStateRef.current.isAlive) return;'), 'Vanguard input can mutate gameplay while paused');
assert(source.includes('const isInitial = state.viewportWidth <= 0 || state.viewportHeight <= 0;'), 'Vanguard resize preservation guard is missing');
assert(source.includes('state.playerX *= scaleX;') && source.includes('state.targetY *= scaleY;'), 'Vanguard active player/target state is not preserved through resize');
assert(source.includes('state.physicsAccumulator = 0;'), 'Vanguard fixed-step remainder is not reset on resize');

const simulate = (fps: number, seconds = 7) => {
  let accumulator = 0;
  let playerX = 120;
  const targetX = 310;
  let starY = 15;
  let bulletY = 420;
  let enemyX = 80;
  let enemyY = -20;
  let enemyPhase = 0;
  let dropY = 100;
  let particleX = 30;
  let particleLife = 1;
  let popupY = 200;
  let popupLife = 1;
  let invulnerable = 70;
  let shootCooldown = 0;
  let spawnTimer = 0;
  let enemyShootTimer = 0;
  let shots = 0;
  let spawns = 0;
  let enemyShots = 0;
  let steps = 0;
  const renderDt = 1 / fps;
  const frames = Math.round(seconds * fps);
  for (let frame = 0; frame < frames; frame++) {
    const batch = getVanguardPhysicsStepBatch(accumulator, renderDt);
    accumulator = batch.remainderSec;
    for (let step = 0; step < batch.steps; step++) {
      const dt = VANGUARD_FIXED_STEP_SEC;
      playerX += (targetX - playerX) * 0.35;
      starY += 2.5;
      bulletY -= 9;
      enemyX += 1.2;
      enemyY += 2.2;
      enemyPhase += 0.05;
      dropY += 1.5;
      particleX += 2;
      particleLife -= 1.8 * dt;
      popupY -= 54 * dt;
      popupLife -= 1.2 * dt;
      if (invulnerable > 0) invulnerable--;
      shootCooldown++;
      if (shootCooldown >= 8) { shootCooldown = 0; shots++; }
      spawnTimer++;
      if (spawnTimer > 55) { spawnTimer = 0; spawns++; }
      enemyShootTimer++;
      if (enemyShootTimer > 65) { enemyShootTimer = 0; enemyShots++; }
      steps++;
    }
  }
  return { playerX, starY, bulletY, enemyX, enemyY, enemyPhase, dropY, particleX, particleLife, popupY, popupLife, invulnerable, shootCooldown, spawnTimer, enemyShootTimer, shots, spawns, enemyShots, steps };
};

const baseline = simulate(60);
for (const fps of [30, 60, 120, 144, 240]) {
  const result = simulate(fps);
  for (const key of ['playerX','starY','bulletY','enemyX','enemyY','enemyPhase','dropY','particleX','particleLife','popupY','popupLife'] as const) {
    assert(Math.abs(result[key] - baseline[key]) < 1e-6, `${fps} FPS changes Vanguard ${key}: ${result[key]} vs ${baseline[key]}`);
  }
  for (const key of ['invulnerable','shootCooldown','spawnTimer','enemyShootTimer','shots','spawns','enemyShots','steps'] as const) {
    assert(result[key] === baseline[key], `${fps} FPS changes Vanguard ${key}: ${result[key]} vs ${baseline[key]}`);
  }
}

if (errors.length) {
  console.error('GALAXY VANGUARD REFRESH-RATE AUDIT — FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('GALAXY VANGUARD REFRESH-RATE AUDIT — PASS');
console.log('Movement, firing, spawns, enemy cadence, drops, effects, pause input, and resize preservation are certified on the 60 Hz gameplay clock.');
