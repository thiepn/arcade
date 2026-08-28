import { readFileSync, writeFileSync, rmSync } from 'node:fs';

function replaceOnce(text, oldValue, newValue, label) {
  if (!text.includes(oldValue)) throw new Error(`Missing expected pattern: ${label}`);
  return text.replace(oldValue, newValue);
}

// 1) Restore the complete orphaned Knife Target game to the cabinet.
{
  const path = 'src/data/games.ts';
  let text = readFileSync(path, 'utf8');
  text = replaceOnce(
    text,
    "import { AstroBlasterGame } from '../games/AstroBlasterGame';\n",
    "import { AstroBlasterGame } from '../games/AstroBlasterGame';\nimport { KnifeTargetGame } from '../games/KnifeTargetGame';\n",
    'KnifeTarget import',
  );

  const entry = `  {
    id: 'knifetarget',
    title: 'Knife Target',
    tagline: 'Thread blades into a spinning cyber core.',
    description: 'Throw blades into a rotating target without striking embedded knives or deflector shields. Slice crystals, build multipliers, and survive escalating stages.',
    category: 'Timing',
    sessionLength: '1–3 min',
    accentColor: '#38bdf8',
    accentGlow: 'rgba(56, 189, 248, 0.4)',
    accentBg: 'rgba(56, 189, 248, 0.1)',
    instructions: 'Tap, click, or press Space to throw. Avoid embedded blades and red deflector shields.',
    controlsHint: 'Click / Tap / Space',
    icon: 'Target',
    component: KnifeTargetGame,
  },
`;
  text = replaceOnce(text, "  {\n    id: 'airhockey',", `${entry}  {\n    id: 'airhockey',`, 'KnifeTarget registry entry');
  writeFileSync(path, text);
}

// 2) Keep Cloudflare accepted game IDs and score validation in lockstep.
{
  const path = 'worker/src/index.ts';
  let text = readFileSync(path, 'utf8');
  text = replaceOnce(
    text,
    "'rhythm','tower','pacmaze','flappyaero','roadcross','bubblebuster','astroblaster','laserrope','blockdrop','airhockey',",
    "'rhythm','tower','pacmaze','flappyaero','roadcross','bubblebuster','astroblaster','laserrope','blockdrop','knifetarget','airhockey',",
    'KnifeTarget backend game ID',
  );
  text = replaceOnce(
    text,
    "  airhockey: { maxScore: 1_000_000, minDurationMs: 250, maxDurationMs: 30 * 60 * 1000 },\n",
    "  knifetarget: { maxScore: 10_000_000, minDurationMs: 500, maxDurationMs: 30 * 60 * 1000 },\n  airhockey: { maxScore: 1_000_000, minDurationMs: 250, maxDurationMs: 30 * 60 * 1000 },\n",
    'KnifeTarget score rule',
  );
  writeFileSync(path, text);
}

// 3) Road Cross: implement the swipe control already promised by the UI.
{
  const path = 'src/games/RoadCrossGame.tsx';
  let text = readFileSync(path, 'utf8');
  text = replaceOnce(
    text,
    '  const setSafeTimeout = useSafeTimeout();\n',
    '  const setSafeTimeout = useSafeTimeout();\n  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);\n',
    'Road Cross pointer start ref',
  );

  const start = text.indexOf('  // Screen tap / click navigation\n');
  const end = text.indexOf('  const generateLanesUpTo', start);
  if (start < 0 || end < 0) throw new Error('Missing expected pattern: Road Cross click navigation block');

  const pointerHandlers = `  // Unified pointer navigation: short press = contextual tap, swipe = cardinal move.
  const handleTapAt = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    const boardWidth = COLS_COUNT * TILE_SIZE;
    const offsetX = (rect.width - boardWidth) / 2;
    const playerScreenX = offsetX + gameStateRef.current.col * TILE_SIZE + TILE_SIZE / 2;

    if (clickY > rect.height * 0.75 && Math.abs(clickX - playerScreenX) < 40) {
      triggerMove(0, -1);
    } else if (clickX < playerScreenX - 35) {
      triggerMove(-1, 0);
    } else if (clickX > playerScreenX + 35) {
      triggerMove(1, 0);
    } else {
      triggerMove(0, 1);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const startPoint = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!startPoint) {
      handleTapAt(e.clientX, e.clientY);
      return;
    }

    const dx = e.clientX - startPoint.x;
    const dy = e.clientY - startPoint.y;
    const threshold = 24;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) {
      handleTapAt(e.clientX, e.clientY);
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) triggerMove(dx > 0 ? 1 : -1, 0);
    else triggerMove(0, dy < 0 ? 1 : -1);
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
  };

`;
  text = `${text.slice(0, start)}${pointerHandlers}${text.slice(end)}`;
  text = replaceOnce(
    text,
    '      onClick={handleCanvasClick}\n',
    '      onPointerDown={handlePointerDown}\n      onPointerUp={handlePointerUp}\n      onPointerCancel={handlePointerCancel}\n',
    'Road Cross render input',
  );
  writeFileSync(path, text);
}

// 4) Shared shell: background pause, held-key safety, and mobile gesture isolation.
{
  const path = 'src/components/GameShell.tsx';
  let text = readFileSync(path, 'utf8');
  const visibilityEffect = `  // Backgrounding or locking a device must never let a live run advance unseen.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !gameOverHandledRef.current) setIsPaused(true);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

`;
  text = replaceOnce(
    text,
    '  // Global game shell keyboard shortcuts\n',
    `${visibilityEffect}  // Global game shell keyboard shortcuts\n`,
    'visibility auto-pause',
  );
  text = replaceOnce(
    text,
    '    const handleGlobalKey = (e: KeyboardEvent) => {\n',
    '    const handleGlobalKey = (e: KeyboardEvent) => {\n      if (e.repeat) return;\n',
    'repeat-safe shell shortcuts',
  );
  text = replaceOnce(
    text,
    "      >\n        <div\n          className={`relative w-full h-full bg-[#0A0A0B] overflow-hidden flex items-center justify-center transition-all ${",
    "        style={{ touchAction: 'none', overscrollBehavior: 'none' }}\n      >\n        <div\n          className={`relative w-full h-full bg-[#0A0A0B] overflow-hidden flex items-center justify-center transition-all ${",
    'game stage gesture isolation',
  );
  writeFileSync(path, text);
}

// Remove temporary MA1 execution-only machinery from the final branch diff.
for (const path of [
  '.github/workflows/apply-ma1-fixes.yml',
  '.github/workflows/ma1-scan.yml',
  'scripts/apply-ma1-fixes.mjs',
]) {
  rmSync(path, { force: true });
}
