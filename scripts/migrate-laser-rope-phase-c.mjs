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
  if (count !== 1) {
    throw new Error(`${path}: expected one ${label} match, found ${count}`);
  }
  writeFileSync(path, source.replace(search, replacement));
}

const gamePath = 'src/games/LaserRopeGame.tsx';

replaceOnce(
  gamePath,
  "import { LaserRopeHud } from '../components/LaserRopeHud';",
  `import { LaserRopeHud } from '../components/LaserRopeHud';
import { LaserRopeStartPanel } from '../components/LaserRopeStartPanel';`,
  'Phase C start-panel import',
);

replaceOnce(
  gamePath,
  `  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const [hudState, setHudState] = useState({`,
  `  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const hasStartedRef = useRef(false);
  const [hasStarted, setHasStarted] = useState(false);

  const [hudState, setHudState] = useState({`,
  'Phase C intro state',
);

replaceOnce(
  gamePath,
  `  const triggerJump = () => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;`,
  `  const startRun = () => {
    if (hasStartedRef.current || isPausedRef.current) return;
    hasStartedRef.current = true;
    setHasStarted(true);
    const state = gameStateRef.current;
    state.feedbackBanner = {
      title: 'SYSTEM LIVE',
      detail: 'LOW / DUAL = JUMP  •  HIGH = SLIDE',
      color: '#67E8F9',
      life: 0.85,
      maxLife: 0.85,
    };
    state.screenFlashColor = '#38BDF8';
    state.screenFlashAlpha = Math.max(state.screenFlashAlpha, 0.055);
    if (soundEnabled) sounds.playClick();
  };

  const triggerJump = () => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;
    if (!hasStartedRef.current) {
      startRun();
      return;
    }`,
  'Phase C start-gated jump',
);

replaceOnce(
  gamePath,
  `  const triggerSlide = () => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;

    if (state.isGrounded) {`,
  `  const triggerSlide = () => {
    const state = gameStateRef.current;
    if (!state.isAlive || isPausedRef.current) return;
    if (!hasStartedRef.current) {
      startRun();
      return;
    }

    if (state.isGrounded) {`,
  'Phase C start-gated slide',
);

replaceOnce(
  gamePath,
  `    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {`,
  `    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasStartedRef.current && e.code === 'Enter') {
        e.preventDefault();
        startRun();
        return;
      }
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {`,
  'Phase C Enter-to-start control',
);

replaceOnce(
  gamePath,
  `      if (!isPausedRef.current && state.isAlive) {`,
  `      if (!isPausedRef.current && state.isAlive && hasStartedRef.current) {`,
  'Phase C gameplay start gate',
);

replaceOnce(
  gamePath,
  `                state.deathPresentationTimer = 0.45;`,
  `                state.deathPresentationTimer = 0.7;`,
  'Phase C death transition duration',
);

replaceOnce(
  gamePath,
  `                setSafeTimeout(() => onGameOver(state.score), 400);`,
  `                setSafeTimeout(() => onGameOver(state.score), 650);`,
  'Phase C game-over transition delay',
);

replaceOnce(
  gamePath,
  `      <canvas ref={canvasRef} className="w-full h-full min-h-0 block touch-none" />

      {/* On-screen Jump & Slide Controls */}`, 
  `      <canvas ref={canvasRef} className="w-full h-full min-h-0 block touch-none" />

      {!hasStarted && <LaserRopeStartPanel onStart={startRun} />}

      {/* On-screen Jump & Slide Controls */}`,
  'Phase C start overlay',
);

replaceOnce(
  gamePath,
  `      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-auto z-10">`,
  `      <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3 sm:left-4 sm:right-4 flex items-center justify-between gap-2 pointer-events-auto z-10">`,
  'Phase C control layout',
);

replaceOnce(
  gamePath,
  `          className="px-6 h-12 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-purple-500/50 text-purple-300 font-black flex items-center justify-center gap-1.5 active:scale-95 shadow-lg cursor-pointer"
          aria-label="Slide / Duck"
        >
          <ArrowDown className="w-5 h-5" />
          <span className="font-mono text-xs font-black">SLIDE / DUCK</span>`,
  `          className="h-12 min-w-0 flex-1 sm:flex-none sm:min-w-[150px] sm:px-5 rounded-xl bg-[#090D18]/92 hover:bg-purple-500/10 border border-purple-400/45 text-purple-200 font-black flex items-center justify-center gap-2 active:scale-[0.97] shadow-lg shadow-purple-950/25 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
          aria-label="Slide under high beams. Keyboard S or Arrow Down."
        >
          <ArrowDown className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span className="flex flex-col items-start font-mono-arcade leading-none">
            <span className="text-[10px] sm:text-xs font-black">SLIDE</span>
            <span className="mt-1 text-[7px] font-bold text-purple-300/55">S / ↓ · HIGH</span>
          </span>`,
  'Phase C slide control',
);

replaceOnce(
  gamePath,
  `          className="px-7 h-12 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-black flex items-center justify-center gap-1.5 active:scale-95 shadow-lg shadow-pink-500/30 cursor-pointer"
          aria-label="Jump / Double Jump"
        >
          <ArrowUp className="w-5 h-5" />
          <span className="font-mono text-xs font-black">JUMP</span>`,
  `          className="h-12 min-w-0 flex-1 sm:flex-none sm:min-w-[150px] sm:px-5 rounded-xl bg-cyan-300 hover:bg-cyan-200 text-slate-950 font-black flex items-center justify-center gap-2 active:scale-[0.97] shadow-lg shadow-cyan-500/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
          aria-label="Jump over low and dual beams. Keyboard Space, W, or Arrow Up."
        >
          <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span className="flex flex-col items-start font-mono-arcade leading-none">
            <span className="text-[10px] sm:text-xs font-black">JUMP</span>
            <span className="mt-1 text-[7px] font-black text-slate-700/65">SPACE / ↑ · LOW</span>
          </span>`,
  'Phase C jump control',
);

const shellPath = 'src/components/GameShell.tsx';

replaceOnce(
  shellPath,
  `  const [gameOverData, setGameOverData] = useState<{
    score: number;
    best: number;
    isNewHigh: boolean;
  } | null>(null);`,
  `  const [gameOverData, setGameOverData] = useState<{
    score: number;
    best: number;
    isNewHigh: boolean;
  } | null>(null);

  const isLaserRope = game.id === 'laserrope';
  const laserRopeGrade = useMemo(() => {
    if (!isLaserRope || !gameOverData) return null;
    const score = gameOverData.score;
    if (score >= 12000) return 'S+';
    if (score >= 8000) return 'S';
    if (score >= 5000) return 'A';
    if (score >= 2500) return 'B';
    return 'C';
  }, [gameOverData, isLaserRope]);`,
  'Laser Rope shell presentation state',
);

replaceOnce(
  shellPath,
  `            <div className="absolute inset-0 bg-[#0A0A0B]/90 backdrop-blur-md z-40 flex flex-col items-center justify-center gap-4 p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-150">`,
  `            <div className={\`absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 p-4 sm:p-6 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 \${isLaserRope ? 'bg-[#020617]/94' : 'bg-[#0A0A0B]/90'}\`}>`,
  'Laser Rope pause backdrop',
);

replaceOnce(
  shellPath,
  `              <div className="p-6 rounded-2xl bg-[#141418] border border-[#27272A] text-center max-w-sm w-full shadow-2xl flex flex-col items-center">`,
  `              <div className={\`p-5 sm:p-6 rounded-2xl text-center max-w-sm w-full shadow-2xl flex flex-col items-center \${isLaserRope ? 'bg-[#050B16]/96 border border-cyan-300/25 shadow-cyan-950/30' : 'bg-[#141418] border border-[#27272A]'}\`}>`,
  'Laser Rope pause panel',
);

replaceOnce(
  shellPath,
  `                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-[#F43F5E] mb-3 shadow-lg shadow-rose-500/10">`,
  `                <div className={\`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-lg \${isLaserRope ? 'bg-cyan-400/10 border border-cyan-300/30 text-cyan-200 shadow-cyan-500/10' : 'bg-rose-500/15 border border-rose-500/30 text-[#F43F5E] shadow-rose-500/10'}\`}>`,
  'Laser Rope pause icon',
);

replaceOnce(
  shellPath,
  `<h2 className="text-xl font-black text-white font-mono-arcade tracking-wide mb-1">GAME PAUSED</h2>`,
  `<h2 className="text-xl font-black text-white font-mono-arcade tracking-wide mb-1">{isLaserRope ? 'SYSTEM PAUSED' : 'GAME PAUSED'}</h2>`,
  'Laser Rope pause title',
);

replaceOnce(
  shellPath,
  `<div className="flex items-center gap-1.5 text-cyan-400 font-mono-arcade text-xs font-bold mb-1.5 uppercase">
                    <Sparkles className="w-3.5 h-3.5" /> How To Play
                  </div>`,
  `<div className="flex items-center gap-1.5 text-cyan-400 font-mono-arcade text-xs font-bold mb-1.5 uppercase">
                    <Sparkles className="w-3.5 h-3.5" /> {isLaserRope ? 'Reflex Protocol' : 'How To Play'}
                  </div>`,
  'Laser Rope pause protocol label',
);

replaceOnce(
  shellPath,
  `                  <p className="text-xs text-zinc-200 leading-relaxed font-sans font-medium">
                    {game.instructions}
                  </p>
                </div>`,
  `                  <p className="text-xs text-zinc-200 leading-relaxed font-sans font-medium">
                    {game.instructions}
                  </p>
                  {isLaserRope && (
                    <div className="mt-3 grid grid-cols-2 gap-2 font-mono-arcade text-[8px] font-black">
                      <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] px-2 py-2 text-cyan-200">
                        JUMP <span className="block mt-1 text-zinc-500">SPACE · W · ↑</span>
                      </div>
                      <div className="rounded-lg border border-purple-400/20 bg-purple-400/[0.05] px-2 py-2 text-purple-200">
                        SLIDE <span className="block mt-1 text-zinc-500">S · ↓</span>
                      </div>
                    </div>
                  )}
                </div>`,
  'Laser Rope pause controls',
);

replaceOnce(
  shellPath,
  `            <div className="absolute inset-0 bg-[#0A0A0B]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">`,
  `            <div className={\`absolute inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md \${isLaserRope ? 'bg-[#020617]/95' : 'bg-[#0A0A0B]/90'}\`}>`,
  'Laser Rope game-over backdrop',
);

replaceOnce(
  shellPath,
  `              <div className="w-full max-w-sm p-6 rounded-2xl bg-[#18181B] border border-[#27272A] shadow-2xl flex flex-col items-center text-center">`,
  `              <div className={\`w-full max-w-sm p-5 sm:p-6 rounded-2xl shadow-2xl flex flex-col items-center text-center \${isLaserRope ? 'bg-[#050B16]/98 border border-rose-400/25 shadow-rose-950/30' : 'bg-[#18181B] border border-[#27272A]'}\`}>`,
  'Laser Rope game-over panel',
);

replaceOnce(
  shellPath,
  `                    SESSION COMPLETE
                  </span>`,
  `                    {isLaserRope ? 'RUN TERMINATED' : 'SESSION COMPLETE'}
                  </span>`,
  'Laser Rope game-over label',
);

replaceOnce(
  shellPath,
  `                </div>

                {/* Action Buttons */}`, 
  `                </div>

                {isLaserRope && laserRopeGrade && (
                  <div className="mb-5 flex w-full items-center justify-between rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] px-4 py-3 font-mono-arcade">
                    <div className="text-left">
                      <div className="text-[8px] font-black uppercase tracking-[0.18em] text-cyan-300/55">REFLEX GRADE</div>
                      <div className="mt-1 text-[9px] font-bold text-zinc-400">READ · REACT · SURVIVE</div>
                    </div>
                    <div className="text-3xl font-black text-cyan-200 drop-shadow-[0_0_12px_rgba(103,232,249,0.35)]">{laserRopeGrade}</div>
                  </div>
                )}

                {/* Action Buttons */}`,
  'Laser Rope reflex grade',
);

const registryPath = 'src/data/games.ts';
replaceOnce(
  registryPath,
  `    instructions: 'Tap or press Space to jump. Double tap for double jump over sweeping lasers.',
    controlsHint: 'Click / Tap / Space',`,
  `    instructions: 'Jump LOW and DUAL sweeps with Space, W, Arrow Up, or the Jump button. Slide under HIGH sweeps with S, Arrow Down, or the Slide button. Watch the warning rings before patterns change.',
    controlsHint: 'Jump: Space / W / ↑ • Slide: S / ↓ • Tap Buttons',`,
  'Laser Rope control guidance',
);

console.log(
  'Applied Laser Rope Reflex Phase C: animated start briefing, themed pause and result presentation, reflex grade, clearer jump/slide hints, responsive controls, and polished death transition.',
);
