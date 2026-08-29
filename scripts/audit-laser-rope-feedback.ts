import { readFileSync } from 'node:fs';

const errors: string[] = [];
const assert = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};

const source = readFileSync('src/games/LaserRopeGame.tsx', 'utf8');

// Preserve the actual gameplay repair without requiring a separate presentation system.
for (const token of [
  'const dt = Math.min(deltaSec, 0.05)',
  'state.playerVY = state.jumpCount === 0 ? 560 : 480',
  'const gravity = 1450',
  'state.playerVY -= gravity * dt',
  'state.playerY += state.playerVY * dt',
  'state.playerVY = -750',
  'state.speedChangeTimer -= dt',
  'state.modeChangeTimer -= dt',
  'state.sweepAngle += effectiveSpeed * state.direction * dt',
  'const relPrev = Math.atan2',
  'const relCurr = Math.atan2',
  'if (state.direction > 0)',
  'if (state.laserMode === \'HIGH\')',
  'evaded = state.isSliding',
  'if (state.playerY > 24)',
  'if (state.hasShield)',
  'state.jumpStreak++',
  'state.feverCharge = Math.min(100, state.feverCharge + 15)',
  'if (state.jumpStreak >= 20) state.multiplier = 4',
  'onScoreUpdate(state.score)',
]) {
  assert(source.includes(token), `Laser Rope gameplay feedback/fairness rule is missing: ${token}`);
}

for (const token of [
  "text: '⚡ DIRECTION REVERSED!'",
  "text: '⚠️ HIGH BEAM - SLIDE / DUCK!'",
  "text: '🛡️ SHIELD READY'",
  "text: 'SHIELD DEFLECTED!'",
]) {
  assert(source.includes(token), `Laser Rope inline feedback is missing: ${token}`);
}

// These effects were coupled to the unwanted standalone visual redesign.
for (const token of [
  'drawLaserRopeFeedbackBanner',
  'drawLaserRopeFeedbackBursts',
  'drawLaserRopeScreenFlash',
  'drawLaserRopeSpawnTelegraph',
  'drawLaserRopeSweepTelegraph',
  'feedbackBanner',
  'feedbackBursts',
]) {
  assert(!source.includes(token), `standalone Laser Rope feedback framework returned: ${token}`);
}

if (errors.length) {
  console.error('Laser Rope Reflex gameplay-feedback audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  'Laser Rope Reflex gameplay-feedback audit passed: elapsed-time jump/sweep physics, bidirectional crossing detection, jump/slide rules, shield handling, multipliers, fever, and lightweight in-game feedback are preserved without a separate visual framework.',
);
