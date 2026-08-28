import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, search, replacement, label) {
  const source = readFileSync(path, 'utf8');
  let count = 0;
  if (typeof search === 'string') {
    count = source.split(search).length - 1;
  } else {
    const flags = search.flags.includes('g') ? search.flags : `${search.flags}g`;
    count = [...source.matchAll(new RegExp(search.source, flags))].length;
  }
  if (count !== 1) throw new Error(`${path}: expected one ${label} match, found ${count}`);
  writeFileSync(path, source.replace(search, replacement));
}

const path = 'src/games/ChronoGame.tsx';

replaceOnce(
  path,
  "import { useGameLoop, useSafeTimeout } from '../hooks/useGameLoop';",
  `import { useGameLoop } from '../hooks/useGameLoop';
import {
  CHRONO_MAX_ACTIVE_WALLS,
  CHRONO_OPEN_SPAN,
  CHRONO_SIDES,
  CHRONO_TRANSITION_GRACE_FRAMES,
  getChronoDesiredWallSpeed,
  getChronoOpenSideForAngle,
  getChronoSpawnInterval,
  getChronoStageForScore,
  getChronoWallColor,
  isAngleInChronoGap,
  planChronoWall,
  selectNextChronoWall,
} from '../lib/chronoWavePlanner';`,
  'Chrono planner imports',
);

replaceOnce(
  path,
  `  cleared: boolean;
}`,
  `  cleared: boolean;
  impactFrame: number;
  stage: number;
}`,
  'wall planning metadata',
);

replaceOnce(
  path,
  `    lastOpenSide: 0,
    consecutiveSameGap: 0,`,
  `    lastOpenSide: getChronoOpenSideForAngle(0),
    consecutiveSameGap: 0,
    lastPlannedImpactFrame: 0,
    forcedNextOpenSide: getChronoOpenSideForAngle(0) as number | null,
    transitionGraceFrames: 0,`,
  'reachability planner state',
);

replaceOnce(
  path,
  '    spawnInterval: 85,',
  '    spawnInterval: getChronoSpawnInterval(1),',
  'safe stage-one spawn interval',
);

replaceOnce(
  path,
  `    // Clear all walls on screen
    const wallCount = state.walls.length;
    state.walls = [];
    const bonus = 1500 + wallCount * 500;`,
  `    // Clear all walls and restart the planner from the player's current lane.
    const wallCount = state.walls.length;
    state.walls = [];
    state.shards = [];
    state.lastPlannedImpactFrame = state.gameTimeFrames;
    state.lastOpenSide = getChronoOpenSideForAngle(state.playerAngle);
    state.forcedNextOpenSide = state.lastOpenSide;
    state.consecutiveSameGap = 0;
    state.transitionGraceFrames = Math.max(state.transitionGraceFrames, 30);
    state.spawnTimer = 0;
    const bonus = 1500 + wallCount * 500;`,
  'EMP planner reset',
);

replaceOnce(
  path,
  /  const setSafeTimeout = useSafeTimeout\(\);\n\n  const spawnWall = useCallback\(\(maxRadius: number\) => \{[\s\S]*?\n  \}, \[\]\);/,
  `  const spawnWall = useCallback((maxRadius: number) => {
    const state = gameStateRef.current;
    const plan = planChronoWall({
      currentFrame: state.gameTimeFrames,
      spawnRadius: maxRadius,
      playerRadius: state.playerRadius,
      desiredSpeed: getChronoDesiredWallSpeed(state.stage, state.speedMultiplier),
      rotationSpeed: state.rotationSpeed,
      lastImpactFrame: state.lastPlannedImpactFrame,
      lastOpenSide: state.lastOpenSide,
      consecutiveSameGap: state.consecutiveSameGap,
      forcedOpenSide: state.forcedNextOpenSide,
    });

    state.lastPlannedImpactFrame = plan.impactFrame;
    state.lastOpenSide = plan.openSide;
    state.consecutiveSameGap = plan.consecutiveSameGap;
    state.forcedNextOpenSide = null;

    const color = getChronoWallColor(state.stage);
    state.walls.push({
      radius: maxRadius,
      sides: CHRONO_SIDES,
      openSide: plan.openSide,
      openSpan: plan.openSpan,
      speed: plan.speed,
      color,
      cleared: false,
      impactFrame: plan.impactFrame,
      stage: state.stage,
    });

    if (Math.random() < 0.45) {
      state.shards.push({
        angle: ((plan.openSide + plan.openSpan * 0.5) / CHRONO_SIDES) * Math.PI * 2,
        radius: state.playerRadius,
        collected: false,
      });
    }
  }, []);

  const beginStageTransition = (nextStage: number, cx: number, cy: number) => {
    const state = gameStateRef.current;
    if (nextStage <= state.stage) return;

    state.stage = nextStage;
    state.spawnInterval = getChronoSpawnInterval(nextStage);
    state.walls = [];
    state.shards = [];
    state.spawnTimer = 0;
    state.transitionGraceFrames = CHRONO_TRANSITION_GRACE_FRAMES;
    state.invulnerableTime = Math.max(
      state.invulnerableTime,
      CHRONO_TRANSITION_GRACE_FRAMES,
    );
    state.lastPlannedImpactFrame = state.gameTimeFrames;
    state.lastOpenSide = getChronoOpenSideForAngle(state.playerAngle);
    state.forcedNextOpenSide = state.lastOpenSide;
    state.consecutiveSameGap = 0;
    setStage(nextStage);

    const messages = [
      '',
      '',
      'STAGE 2: ACCELERATING',
      'STAGE 3: QUANTUM DENSITY',
      'STAGE 4: HYPER DRIVE',
    ];
    addScorePopup(messages[nextStage] ?? \\`STAGE \\${nextStage}\\`, cx, cy - 40, getChronoWallColor(nextStage));
    if (soundEnabled) sounds.playVictory();
  };`,
  'reachable wall planner and stage transition',
);

replaceOnce(
  path,
  `    const handleKeyDown = (e: KeyboardEvent) => {
      const state = gameStateRef.current;`,
  `    const handleKeyDown = (e: KeyboardEvent) => {
      const state = gameStateRef.current;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
      }`,
  'keyboard default prevention',
);

replaceOnce(
  path,
  `    onUpdate: (ctx, dt, curW, curH) => {
      const state = gameStateRef.current;

      const cx = curW * 0.5;`,
  `    onUpdate: (ctx, dt, curW, curH) => {
      const state = gameStateRef.current;
      const frameScale = Math.min(dt * 60, 2);

      const cx = curW * 0.5;`,
  'frame-rate normalization',
);

replaceOnce(
  path,
  `        state.shake *= 0.88;`,
  `        state.shake *= Math.pow(0.88, frameScale);`,
  'frame-rate-aware shake',
);

replaceOnce(
  path,
  `        state.corePulse += 0.05;
        state.gameTimeFrames++;`,
  `        state.corePulse += 0.05 * frameScale;
        state.gameTimeFrames += frameScale;`,
  'simulation clock normalization',
);

replaceOnce(
  path,
  `        if (state.invulnerableTime > 0) {
          state.invulnerableTime--;
        }`,
  `        if (state.invulnerableTime > 0) {
          state.invulnerableTime = Math.max(0, state.invulnerableTime - frameScale);
        }`,
  'invulnerability normalization',
);

replaceOnce(
  path,
  `            state.playerAngle += Math.sign(diff) * Math.min(Math.abs(diff) * 0.35, state.rotationSpeed * 1.5);`,
  `            state.playerAngle +=
              Math.sign(diff) *
              Math.min(Math.abs(diff) * 0.35, state.rotationSpeed * 1.5 * frameScale);`,
  'direct aiming normalization',
);

replaceOnce(
  path,
  `          state.playerAngle += state.playerTurnDir * state.rotationSpeed;`,
  `          state.playerAngle += state.playerTurnDir * state.rotationSpeed * frameScale;`,
  'button rotation normalization',
);

replaceOnce(
  path,
  `        // Spawn timer scales with game speed
        state.spawnTimer += state.speedMultiplier;
        if (state.spawnTimer >= state.spawnInterval) {
          state.spawnTimer = 0;
          spawnWall(maxSpawnRadius);
        }`,
  `        // Stage transitions pause spawning, clear mixed-color walls, and force
        // the first new opening around the player's current position.
        if (state.transitionGraceFrames > 0) {
          state.transitionGraceFrames = Math.max(
            0,
            state.transitionGraceFrames - frameScale,
          );
        } else {
          state.spawnTimer += state.speedMultiplier * frameScale;
          const activeWallCount = state.walls.filter(
            (wall) => !wall.cleared && wall.radius > state.playerRadius,
          ).length;
          if (
            state.spawnTimer >= state.spawnInterval &&
            activeWallCount < CHRONO_MAX_ACTIVE_WALLS
          ) {
            state.spawnTimer = 0;
            spawnWall(maxSpawnRadius);
          } else if (activeWallCount >= CHRONO_MAX_ACTIVE_WALLS) {
            state.spawnTimer = Math.min(state.spawnTimer, state.spawnInterval);
          }
        }`,
  'safe spawn scheduler',
);

replaceOnce(
  path,
  `          const wall = state.walls[i];
          wall.radius -= wall.speed;

          // Check if wall passes player orbital ring
          const pR = state.playerRadius;
          if (Math.abs(wall.radius - pR) < wall.speed * 1.25 && !wall.cleared) {
            // Determine player's sector segment index
            const sectorAngle = (Math.PI * 2) / wall.sides;
            const playerSector = Math.floor(state.playerAngle / sectorAngle);

            // Check if player is inside open span
            let isSafe = false;
            for (let span = 0; span < wall.openSpan; span++) {
              const safeSector = (wall.openSide + span) % wall.sides;
              if (playerSector === safeSector) {
                isSafe = true;
                break;
              }
            }`,
  `          const wall = state.walls[i];
          const previousRadius = wall.radius;
          wall.radius -= wall.speed * frameScale;

          // Crossing detection cannot skip at high refresh rates or after a slow frame.
          const pR = state.playerRadius;
          const crossedPlayer = previousRadius >= pR && wall.radius < pR;
          if (crossedPlayer && !wall.cleared) {
            const isSafe = isAngleInChronoGap(
              state.playerAngle,
              wall.openSide,
              wall.openSpan,
              wall.sides,
            );`,
  'continuous wall crossing and angular gap check',
);

replaceOnce(
  path,
  /\n              \/\/ Stage Progression\n              if \(state\.score > 2500 && state\.stage === 1\) \{[\s\S]*?\n              \}/,
  '',
  'inline unsafe stage progression',
);

replaceOnce(
  path,
  `        }

        // Energy Shards collection`,
  `        }

        const nextStage = getChronoStageForScore(state.score);
        if (nextStage > state.stage) {
          beginStageTransition(nextStage, cx, cy);
        }

        // Energy Shards collection`,
  'safe post-wall stage transition',
);

replaceOnce(
  path,
  `      if (state.walls.length > 0) {
        const closestWall = state.walls[0];
        const sectorAngle = (Math.PI * 2) / closestWall.sides;
        const midOpenAngle = (closestWall.openSide + closestWall.openSpan * 0.5) * sectorAngle;

        ctx.strokeStyle = 'rgba(52, 211, 153, 0.12)';
        ctx.lineWidth = 22;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(midOpenAngle) * maxSpawnRadius, cy + Math.sin(midOpenAngle) * maxSpawnRadius);
        ctx.stroke();
      }`,
  `      const closestWall = selectNextChronoWall(state.walls, state.playerRadius);
      if (closestWall) {
        const sectorAngle = (Math.PI * 2) / closestWall.sides;
        const midOpenAngle =
          (closestWall.openSide + closestWall.openSpan * 0.5) * sectorAngle;

        ctx.strokeStyle = 'rgba(52, 211, 153, 0.15)';
        ctx.lineWidth = 24;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
          cx + Math.cos(midOpenAngle) * maxSpawnRadius,
          cy + Math.sin(midOpenAngle) * maxSpawnRadius,
        );
        ctx.stroke();
      }`,
  'closest-wall telegraph',
);

replaceOnce(
  path,
  `        p.x += p.vx;
        p.y += p.vy;
        p.life++;`,
  `        p.x += p.vx * frameScale;
        p.y += p.vy * frameScale;
        p.life += frameScale;`,
  'particle frame normalization',
);

replaceOnce(
  path,
  `        fs.y -= 1;
        fs.life++;`,
  `        fs.y -= 1 * frameScale;
        fs.life += frameScale;`,
  'floating-score frame normalization',
);

writeFileSync(path, readFileSync(path, 'utf8'));
console.log('Applied reachable Chrono Wave wall planning, safe stage transitions, and frame-rate normalization.');
