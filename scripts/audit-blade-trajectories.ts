import { readFileSync } from 'node:fs';
import {
  BLADE_APEX_MAX_RATIO,
  BLADE_APEX_MIN_RATIO,
  BLADE_FIXED_STEP_SEC,
  BLADE_LANDING_MARGIN_RATIO,
  BLADE_SIMULATION_HZ,
  createBladeLaunchTrajectory,
  getBladeSimulationStepBatch,
} from '../src/lib/bladeTrajectory';

const heights = [440, 500, 660, 900, 1080];
const apexSamples = [0, 0.5, 0.999999];
const tolerancePx = 0.75;
const errors: string[] = [];
const source = readFileSync('src/games/BladeGame.tsx', 'utf8');

for (const height of heights) {
  const width = Math.round(height * 1.5);
  const startX = width * 0.35;
  const startY = height + 25;

  for (const apexSample of apexSamples) {
    const randomValues = [apexSample, 0.65];
    const trajectory = createBladeLaunchTrajectory({
      startX,
      startY,
      width,
      height,
      random: () => randomValues.shift() ?? 0.5,
    });

    let y = startY;
    let vy = trajectory.vy;
    let measuredApexY = y;
    let frames = 0;

    while (frames < 240) {
      vy += trajectory.gravity;
      y += vy;
      measuredApexY = Math.min(measuredApexY, y);
      frames++;
      if (vy >= 0) break;
    }

    if (Math.abs(measuredApexY - trajectory.apexY) > tolerancePx) {
      errors.push(
        height + 'px sample ' + apexSample + ': measured apex ' + measuredApexY.toFixed(2) +
          ' != requested ' + trajectory.apexY.toFixed(2),
      );
    }

    const measuredRatio = measuredApexY / height;
    if (
      measuredRatio < BLADE_APEX_MIN_RATIO - 0.002 ||
      measuredRatio > BLADE_APEX_MAX_RATIO + 0.002
    ) {
      errors.push(
        height + 'px sample ' + apexSample + ': apex ratio ' + measuredRatio.toFixed(4) +
          ' is outside the certified upper band',
      );
    }

    const minLandingX = width * BLADE_LANDING_MARGIN_RATIO;
    const maxLandingX = width * (1 - BLADE_LANDING_MARGIN_RATIO);
    if (trajectory.landingX < minLandingX || trajectory.landingX > maxLandingX) {
      errors.push(height + 'px sample ' + apexSample + ': projected landing is outside the arena');
    }

    if (trajectory.framesToApex < 45 || trajectory.framesToApex > 75) {
      errors.push(
        height + 'px sample ' + apexSample + ': ' + trajectory.framesToApex.toFixed(1) +
          ' frames to apex is outside the playable range',
      );
    }
  }
}

if (BLADE_SIMULATION_HZ !== 60) {
  errors.push(`expected a 60 Hz Laser Blade simulation, found ${BLADE_SIMULATION_HZ}`);
}
if (!source.includes('getBladeSimulationStepBatch(state.physicsAccumulator, dt)')) {
  errors.push('BladeGame does not consume elapsed time through the fixed-step runtime clock');
}
if (!source.includes('for (let simStep = 0; simStep < batch.steps && state.isAlive; simStep++)')) {
  errors.push('BladeGame gameplay updates are not bounded by the fixed-step batch');
}
if (!source.includes('physicsAccumulator: 0')) {
  errors.push('BladeGame does not persist a simulation accumulator');
}
if (!source.includes('state.comboTimer--') || !source.includes('state.spawnTimer++')) {
  errors.push('BladeGame combo/spawn cadence is missing from the certified simulation');
}
if (!source.includes('state.shake *= Math.pow(0.86')) {
  errors.push('BladeGame screen shake remains render-frame dependent');
}

const simulateStepCount = (fps: number, seconds = 4) => {
  let accumulator = 0;
  let steps = 0;
  const dt = 1 / fps;
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
    const batch = getBladeSimulationStepBatch(accumulator, dt);
    accumulator = batch.remainderSec;
    steps += batch.steps;
  }
  return steps;
};
const expectedSteps = Math.round(4 / BLADE_FIXED_STEP_SEC);
for (const fps of [30, 60, 120, 144, 240]) {
  const steps = simulateStepCount(fps);
  if (Math.abs(steps - expectedSteps) > 1) {
    errors.push(`${fps} FPS executes ${steps} Blade simulation steps instead of about ${expectedSteps}`);
  }
}

if (errors.length) {
  console.error('Laser Blade trajectory/runtime audit failed:');
  for (const error of errors) console.error('- ' + error);
  process.exit(1);
}

console.log(
  'Laser Blade audit passed: trajectories remain playable and gameplay timing is refresh-rate invariant at 30/60/120/144/240 Hz.',
);
