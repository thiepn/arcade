import { readFileSync, writeFileSync } from 'node:fs';

function replaceOrThrow(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`MA3 patch target missing: ${label}`);
  return source.replace(search, replacement);
}

// index.html — installability, accessibility, safe-area viewport, no remote font dependency.
writeFileSync('index.html', `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0A0A0B" />
    <meta name="color-scheme" content="dark" />
    <meta name="application-name" content="Micro Arcade" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Micro Arcade" />
    <title>MICRO ARCADE — Tiny games. Instant play.</title>
    <meta name="description" content="A collection of extremely simple, instantly understandable arcade mini-games. Play instantly in 1-5 minute sessions." />
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="icon" type="image/png" sizes="192x192" href="./icons/icon-192.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="./icons/apple-touch-icon.png" />
  </head>
  <body class="bg-neutral-950 text-neutral-100 font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden min-h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`);

// Vite base path is explicit for GitHub Pages while remaining root-relative locally/custom hosting.
writeFileSync('vite.config.ts', `import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
`);

// Package scripts.
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.scripts['build:pages'] = 'VITE_BASE_PATH=/arcade/ vite build';
pkg.scripts['quality:ma3'] = 'bun scripts/audit-ma3.mjs';
writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

// App wiring.
let app = readFileSync('src/App.tsx', 'utf8');
app = replaceOrThrow(
  app,
  "import { StressTester } from './components/StressTester';",
  "import { StressTester } from './components/StressTester';\nimport { PwaStatus } from './components/PwaStatus';",
  'App PwaStatus import',
);
app = replaceOrThrow(
  app,
  "      {import.meta.env.DEV && stressTesterOpen && (\n        <StressTester onClose={() => setStressTesterOpen(false)} />\n      )}",
  "      <PwaStatus activeGame={Boolean(activeGame)} />\n\n      {import.meta.env.DEV && stressTesterOpen && (\n        <StressTester onClose={() => setStressTesterOpen(false)} />\n      )}",
  'App PwaStatus render',
);
writeFileSync('src/App.tsx', app);

// GameShell wiring.
let shell = readFileSync('src/components/GameShell.tsx', 'utf8');
shell = replaceOrThrow(
  shell,
  "import { beginLeaderboardSession, submitLeaderboardScore, type LeaderboardPlaySession } from '../lib/leaderboards';",
  "import { beginLeaderboardSession, submitLeaderboardScore, type LeaderboardPlaySession } from '../lib/leaderboards';\nimport { useGamepadBridge } from '../hooks/useGamepadBridge';",
  'GameShell gamepad import',
);
shell = replaceOrThrow(
  shell,
  "  Smartphone,\n} from 'lucide-react';",
  "  Smartphone,\n  Gamepad2,\n} from 'lucide-react';",
  'GameShell Gamepad2 icon import',
);
shell = replaceOrThrow(
  shell,
  "  const shellRef = useRef<HTMLDivElement>(null);\n  const prevScoreRef = useRef(0);",
  "  const shellRef = useRef<HTMLDivElement>(null);\n  const gameStageRef = useRef<HTMLElement>(null);\n  const gamepadCursorRef = useRef<HTMLDivElement>(null);\n  const prevScoreRef = useRef(0);",
  'GameShell refs',
);
shell = replaceOrThrow(
  shell,
  "  const [gameOverData, setGameOverData] = useState<{\n    score: number;\n    best: number;\n    isNewHigh: boolean;\n  } | null>(null);",
  "  const [gameOverData, setGameOverData] = useState<{\n    score: number;\n    best: number;\n    isNewHigh: boolean;\n  } | null>(null);\n\n  const gamepad = useGamepadBridge({\n    gameId: game.id,\n    targetRef: gameStageRef,\n    cursorRef: gamepadCursorRef,\n    paused: isPaused,\n    gameOver: Boolean(gameOverData),\n  });",
  'GameShell gamepad hook',
);
shell = replaceOrThrow(
  shell,
  "  // Key to force-remount the mini-game component upon instant restart",
  `  // Keep mobile displays awake during active gameplay when the browser permits it.
  useEffect(() => {
    if (isPaused || gameOverData || !("wakeLock" in navigator)) return;
    let released = false;
    let sentinel = null;
    const acquire = async () => {
      if (released || document.hidden) return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {}
    };
    const onVisibility = () => {
      if (!document.hidden && !released) void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel) void sentinel.release().catch(() => {});
    };
  }, [gameOverData, isPaused]);

  // Lock background page scrolling/pull-to-refresh while the full-screen game shell is active.
  useEffect(() => {
    document.body.classList.add('game-active');
    return () => document.body.classList.remove('game-active');
  }, []);

  // Key to force-remount the mini-game component upon instant restart`,
  'GameShell wake lock + body state',
);
shell = replaceOrThrow(
  shell,
  "      className={`fixed inset-0 z-50 bg-[#0A0A0B] flex flex-col items-center justify-between text-[#E4E4E7] overflow-hidden select-none ${",
  "      className={`game-shell fixed inset-0 z-50 bg-[#0A0A0B] flex flex-col items-center justify-between text-[#E4E4E7] overflow-hidden select-none ${",
  'GameShell class',
);
shell = replaceOrThrow(
  shell,
  "              <span className=\"hidden sm:inline\">ARCADE</span>\n          </button>",
  "              <span className=\"hidden sm:inline\">ARCADE</span>\n          </button>",
  'noop sentinel',
);
// Controller indicator beside game title.
shell = replaceOrThrow(
  shell,
  "              <span\n                className=\"text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 hidden xs:inline-block\"",
  "              {gamepad.connected && (\n                <span className=\"inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[8px] font-mono-arcade font-black text-cyan-300 shrink-0\" title={gamepad.controllerName ?? 'Gamepad connected'}>\n                  <Gamepad2 className=\"w-3 h-3\" />\n                  <span className=\"hidden md:inline\">{gamepad.pointerMode ? 'CURSOR' : 'PAD'}</span>\n                </span>\n              )}\n              <span\n                className=\"text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 hidden xs:inline-block\"",
  'GameShell gamepad indicator',
);
shell = replaceOrThrow(
  shell,
  "      <main\n        className={`relative flex-1 w-full flex items-center justify-center overflow-hidden transition-all duration-150 ${",
  "      <main\n        ref={gameStageRef}\n        className={`relative flex-1 w-full flex items-center justify-center overflow-hidden transition-all duration-150 ${",
  'GameShell stage ref',
);
shell = replaceOrThrow(
  shell,
  "          {/* Subtle grid background */}\n          <div className=\"absolute inset-0 opacity-15 arcade-grid-bg pointer-events-none\" />",
  "          {/* Subtle grid background */}\n          <div className=\"absolute inset-0 opacity-15 arcade-grid-bg pointer-events-none\" />\n\n          <div\n            ref={gamepadCursorRef}\n            id=\"gamepad-virtual-cursor\"\n            className=\"gamepad-virtual-cursor\"\n            aria-hidden=\"true\"\n          />",
  'GameShell virtual cursor',
);
shell = replaceOrThrow(
  shell,
  "          <span>Controls: {game.controlsHint}</span>\n          <span className=\"hidden sm:inline\">F: Fullscreen • Esc: Pause • R: Restart</span>",
  "          <span>{gamepad.connected ? (gamepad.pointerMode ? 'Gamepad: Stick cursor • A hold/click • B pause/back' : 'Gamepad: Stick/D-pad move • A action • B pause/back') : `Controls: ${game.controlsHint}`}</span>\n          <span className=\"hidden sm:inline\">F: Fullscreen • Esc: Pause • R: Restart</span>",
  'GameShell footer gamepad hint',
);
writeFileSync('src/components/GameShell.tsx', shell);

// Gamepad mapping correction + avoid redundant React state setters every animation frame.
let bridge = readFileSync('src/hooks/useGamepadBridge.ts', 'utf8');
bridge = replaceOrThrow(bridge, "if (gameId === 'rhythm') return ['KeyF', 'KeyJ', 'KeyA', 'KeyK'];", "if (gameId === 'rhythm') return ['KeyF', 'KeyJ', 'KeyD', 'KeyK'];", 'Rhythm face mapping');
bridge = replaceOrThrow(
  bridge,
  "    let cursorInitialized = false;\n    const heldKeys = new Set<KeyCode>();",
  "    let cursorInitialized = false;\n    let reportedConnected = false;\n    let reportedName: string | null = null;\n    const heldKeys = new Set<KeyCode>();",
  'Gamepad reported state refs',
);
bridge = replaceOrThrow(
  bridge,
  "      setConnected(Boolean(next));\n      setControllerName(next?.id || null);\n      return next;",
  "      const nextConnected = Boolean(next);\n      const nextName = next?.id || null;\n      if (nextConnected !== reportedConnected) {\n        reportedConnected = nextConnected;\n        setConnected(nextConnected);\n      }\n      if (nextName !== reportedName) {\n        reportedName = nextName;\n        setControllerName(nextName);\n      }\n      return next;",
  'Gamepad state throttling',
);
writeFileSync('src/hooks/useGamepadBridge.ts', bridge);

// Mobile/safe-area/reduced-motion CSS appended once.
let css = readFileSync('src/index.css', 'utf8');
if (!css.includes('/* MA3 — PWA / mobile shell */')) {
  css += `\n/* MA3 — PWA / mobile shell */\nhtml, body, #root {\n  min-height: 100%;\n}\n\nhtml {\n  background: #0A0A0B;\n}\n\nbody {\n  margin: 0;\n  min-height: 100vh;\n  min-height: 100dvh;\n}\n\nbutton, [role=\"button\"] {\n  touch-action: manipulation;\n  -webkit-tap-highlight-color: transparent;\n}\n\nbody.game-active {\n  overflow: hidden;\n  overscroll-behavior: none;\n}\n\n.game-shell {\n  width: 100vw;\n  height: 100vh;\n  height: 100dvh;\n  box-sizing: border-box;\n  padding-top: env(safe-area-inset-top);\n  padding-left: env(safe-area-inset-left);\n  padding-right: env(safe-area-inset-right);\n  padding-bottom: env(safe-area-inset-bottom);\n  overscroll-behavior: none;\n}\n\n.game-shell button {\n  min-width: 40px;\n  min-height: 40px;\n}\n\n.game-shell footer {\n  padding-bottom: max(0.375rem, env(safe-area-inset-bottom));\n}\n\n.pwa-status-safe {\n  bottom: max(0.75rem, env(safe-area-inset-bottom));\n}\n\n.gamepad-virtual-cursor {\n  position: fixed;\n  left: -11px;\n  top: -11px;\n  width: 22px;\n  height: 22px;\n  display: none;\n  z-index: 38;\n  pointer-events: none;\n  border: 2px solid rgba(255, 255, 255, 0.95);\n  border-radius: 999px;\n  background: rgba(56, 189, 248, 0.2);\n  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2), 0 0 16px rgba(56, 189, 248, 0.7);\n  will-change: transform;\n}\n\n@media (min-width: 640px) {\n  .game-shell button {\n    min-width: 0;\n    min-height: 0;\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after {\n    scroll-behavior: auto !important;\n    animation-duration: 0.01ms !important;\n    animation-iteration-count: 1 !important;\n    transition-duration: 0.01ms !important;\n  }\n}\n`;
}
writeFileSync('src/index.css', css);

// CI: certify both root-hosted and GitHub-Pages build variants.
let ci = readFileSync('.github/workflows/ci.yml', 'utf8');
ci = replaceOrThrow(
  ci,
  "      - run: bun run build\n",
  "      - run: bun run build\n      - run: MA3_EXPECT_BASE=/ bun run quality:ma3\n      - run: bun run build:pages\n      - run: MA3_EXPECT_BASE=/arcade/ bun run quality:ma3\n",
  'CI MA3 certification',
);
writeFileSync('.github/workflows/ci.yml', ci);

console.log('MA3 shell wiring applied');
