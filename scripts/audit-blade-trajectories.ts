import {
  BLADE_APEX_MAX_RATIO,
  BLADE_APEX_MIN_RATIO,
  BLADE_LANDING_MARGIN_RATIO,
  createBladeLaunchTrajectory,
} from '../src/lib/bladeTrajectory';

const heights = [440, 500, 660, 900, 1080];
const apexSamples = [0, 0.5, 0.999999];
const tolerancePx = 0.75;
const errors: string[] = [];

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

if (errors.length) {
  console.error('Laser Blade trajectory audit failed:');
  for (const error of errors) console.error('- ' + error);
  process.exit(1);
}

console.log(
  'Laser Blade trajectory audit passed: every certified mobile/desktop height reaches the ' +
    (BLADE_APEX_MIN_RATIO * 100).toFixed(0) + '–' +
    (BLADE_APEX_MAX_RATIO * 100).toFixed(0) + '% upper arena band.',
);
