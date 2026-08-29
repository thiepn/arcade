import { readFileSync, writeFileSync } from 'node:fs';

const gamePath = 'src/games/LaserRopeGame.tsx';
const presentationAuditPath = 'scripts/audit-laser-rope-presentation.ts';
const feedbackAuditPath = 'scripts/audit-laser-rope-feedback.ts';

const replaceOnce = (source, before, after, label) => {
  if (!source.includes(before)) {
    throw new Error(`Missing migration anchor: ${label}`);
  }
  return source.replace(before, after);
};

let game = readFileSync(gamePath, 'utf8');

game = replaceOnce(
  game,
  "    feverPercent: 0,\n    hasShield: false,\n  });",
  "    feverPercent: 0,\n    hasShield: false,\n    laserMode: 'LOW' as 'LOW' | 'HIGH' | 'DUAL',\n  });",
  'HUD laser mode state',
);

game = replaceOnce(
  game,
  "      const centerX = w / 2;\n      const groundY = h * 0.72;",
  "      const centerX = w / 2;\n      const groundY = h * 0.72;\n      // Preserve the original compact arena style, but shrink it when needed so\n      // the floor and beam emitters never clip on narrow phone canvases.\n      const arenaRadiusX = Math.min(165, Math.max(80, w / 2 - 16));\n      const arenaRadiusY = Math.max(28, arenaRadiusX * (58 / 165));\n      const beamRadius = Math.max(70, arenaRadiusX - 10);",
  'responsive arena dimensions',
);

game = replaceOnce(
  game,
  "          if (state.jumpStreak > 6 && Math.random() < 0.4) {\n            state.laserMode = 'HIGH';\n            state.popups.push({",
  "          if (state.jumpStreak > 6 && Math.random() < 0.4) {\n            state.laserMode = 'HIGH';\n            // HIGH is always a single sweep. Explicitly reset this after DUAL so\n            // the previous two-beam state cannot leak into the new mode.\n            state.beamsCount = 1;\n            state.popups.push({",
  'HIGH beam count reset',
);

game = replaceOnce(
  game,
  "          } else if (state.jumpStreak >= 12 && Math.random() < 0.35) {\n            state.laserMode = 'DUAL';\n            state.beamsCount = 2;\n          } else {",
  "          } else if (state.jumpStreak >= 12 && Math.random() < 0.35) {\n            state.laserMode = 'DUAL';\n            state.beamsCount = 2;\n            state.popups.push({\n              id: state.nextId++,\n              x: centerX,\n              y: groundY - 150,\n              text: '⚠️ DUAL BEAM - JUMP!',\n              color: '#F43F5E',\n              life: 1.0,\n            });\n          } else {",
  'DUAL inline warning',
);

game = replaceOnce(
  game,
  "        state.sweepSpeed += (state.speedTarget - state.sweepSpeed) * 0.08;",
  "        const sweepSmoothing = 1 - Math.pow(0.92, dt * 60);\n        state.sweepSpeed += (state.speedTarget - state.sweepSpeed) * sweepSmoothing;",
  'refresh-normalized sweep smoothing',
);

game = replaceOnce(
  game,
  "      ctx.ellipse(0, 0, 165, 58, 0, 0, Math.PI * 2);",
  "      ctx.ellipse(0, 0, arenaRadiusX, arenaRadiusY, 0, 0, Math.PI * 2);",
  'responsive floor oval',
);

game = replaceOnce(
  game,
  "      ctx.ellipse(0, 0, 85, 30, 0, 0, Math.PI * 2);",
  "      ctx.ellipse(0, 0, arenaRadiusX * 0.52, arenaRadiusY * 0.52, 0, 0, Math.PI * 2);",
  'responsive floor ring',
);

game = replaceOnce(
  game,
  "      ctx.ellipse(0, 32, 28, 10, 0, 0, Math.PI * 2);",
  "      ctx.ellipse(\n        0,\n        arenaRadiusY * 0.55,\n        Math.max(22, arenaRadiusX * 0.17),\n        Math.max(8, arenaRadiusY * 0.17),\n        0,\n        0,\n        Math.PI * 2,\n      );",
  'responsive jump target ring',
);

game = replaceOnce(
  game,
  "      // Render Rotating Lasers\n      const beamRadius = 155;\n      const activeBeams =",
  "      // Render Rotating Lasers\n      const activeBeams =",
  'remove fixed beam radius',
);

game = replaceOnce(
  game,
  "        ctx.strokeStyle = state.isFeverActive\n          ? '#FACC15'\n          : state.laserMode === 'HIGH'\n          ? '#A855F7'\n          : '#EF4444';\n        ctx.lineWidth = 3.5;",
  "        const beamColor = state.isFeverActive\n          ? '#FACC15'\n          : state.laserMode === 'HIGH'\n          ? '#A855F7'\n          : '#EF4444';\n        ctx.strokeStyle = beamColor;\n        ctx.shadowColor = beamColor;\n        ctx.shadowBlur = 10;\n        ctx.lineWidth = 3.5;",
  'lightweight beam glow',
);

game = replaceOnce(
  game,
  "        ctx.quadraticCurveTo(lx * 0.5, ly * 0.5 + 6, lx, ly);\n        ctx.stroke();\n\n        // Inner Core",
  "        ctx.quadraticCurveTo(lx * 0.5, ly * 0.5 + 6, lx, ly);\n        ctx.stroke();\n        ctx.shadowBlur = 0;\n\n        // Inner Core",
  'reset beam glow',
);

game = replaceOnce(
  game,
  "          prev.feverPercent === feverPercent &&\n          prev.hasShield === state.hasShield",
  "          prev.feverPercent === feverPercent &&\n          prev.hasShield === state.hasShield &&\n          prev.laserMode === state.laserMode",
  'HUD equality mode',
);

game = replaceOnce(
  game,
  "          feverPercent,\n          hasShield: state.hasShield,\n        };",
  "          feverPercent,\n          hasShield: state.hasShield,\n          laserMode: state.laserMode,\n        };",
  'HUD return mode',
);

game = replaceOnce(
  game,
  "          <div className=\"px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-pink-400 font-mono text-xs font-black backdrop-blur-md\">\n            STREAK: {hudState.jumpStreak}\n          </div>\n\n          {hudState.multiplier > 1 && (",
  "          <div className=\"px-2.5 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-pink-400 font-mono text-xs font-black backdrop-blur-md\">\n            STREAK: {hudState.jumpStreak}\n          </div>\n\n          <div className=\"px-2 py-1 rounded-xl bg-[#18181B]/90 border border-[#27272A] text-zinc-400 font-mono text-[10px] sm:text-xs font-black backdrop-blur-md\">\n            MODE:{' '}\n            <span\n              className={\n                hudState.laserMode === 'HIGH'\n                  ? 'text-purple-300'\n                  : hudState.laserMode === 'DUAL'\n                    ? 'text-pink-400'\n                    : 'text-cyan-300'\n              }\n            >\n              {hudState.laserMode}\n            </span>\n          </div>\n\n          {hudState.multiplier > 1 && (",
  'inline mode HUD pill',
);

game = replaceOnce(
  game,
  "      className=\"relative w-full h-full min-h-[440px] flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none\"",
  "      className=\"relative w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#050508] select-none overflow-hidden touch-none\"",
  'shrink-safe game root',
);

game = replaceOnce(
  game,
  "      <canvas ref={canvasRef} className=\"w-full h-full block\" />",
  "      <canvas ref={canvasRef} className=\"w-full h-full min-h-0 block\" />",
  'shrink-safe canvas',
);

game = replaceOnce(
  game,
  "      <div className=\"absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-auto z-10\">",
  "      <div className=\"absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3 sm:left-4 sm:right-4 flex items-center justify-between gap-2 pointer-events-auto z-10\">",
  'responsive control row',
);

game = replaceOnce(
  game,
  "          className=\"px-6 h-12 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-purple-500/50 text-purple-300 font-black flex items-center justify-center gap-1.5 active:scale-95 shadow-lg cursor-pointer\"",
  "          className=\"h-12 min-w-0 flex-1 sm:flex-none sm:px-6 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-purple-500/50 text-purple-300 font-black flex items-center justify-center gap-1.5 active:scale-95 shadow-lg cursor-pointer\"",
  'responsive slide button',
);

game = replaceOnce(
  game,
  "          className=\"px-7 h-12 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-black flex items-center justify-center gap-1.5 active:scale-95 shadow-lg shadow-pink-500/30 cursor-pointer\"",
  "          className=\"h-12 min-w-0 flex-1 sm:flex-none sm:px-7 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-black flex items-center justify-center gap-1.5 active:scale-95 shadow-lg shadow-pink-500/30 cursor-pointer\"",
  'responsive jump button',
);

writeFileSync(gamePath, game);

let presentationAudit = readFileSync(presentationAuditPath, 'utf8');
presentationAudit = replaceOnce(
  presentationAudit,
  "  'const groundY = h * 0.72',\n  '<canvas ref={canvasRef}',",
  "  'const groundY = h * 0.72',\n  'const arenaRadiusX = Math.min(165',\n  'const arenaRadiusY = Math.max(28',\n  'const beamRadius = Math.max(70, arenaRadiusX - 10)',\n  '<canvas ref={canvasRef}',",
  'presentation responsive tokens',
);
presentationAudit = replaceOnce(
  presentationAudit,
  "  'SPEED:',\n  'JUMP',",
  "  'SPEED:',\n  \"MODE:{' '}\",\n  'min-h-0',\n  'JUMP',",
  'presentation HUD/layout tokens',
);
presentationAudit = replaceOnce(
  presentationAudit,
  "for (const token of [\n  \"const isLaserRope = game.id === 'laserrope'\",",
  "assert(!game.includes('ctx.ellipse(0, 0, 165, 58'), 'fixed-width Laser Rope arena returned');\nassert(!game.includes('const beamRadius = 155'), 'fixed Laser Rope beam radius returned');\n\nfor (const token of [\n  \"const isLaserRope = game.id === 'laserrope'\",",
  'presentation fixed-size rejection',
);
presentationAudit = presentationAudit.replace(
  "Laser Rope Reflex site-cohesion audit passed: the game uses the shared arcade shell and inline canvas/HUD language, with no bespoke start screen, HUD framework, or game-specific pause/result UI.",
  "Laser Rope Reflex site-cohesion audit passed: shared arcade shell, shrink-safe responsive arena, inline HUD/controls, and no bespoke start screen or game-specific pause/result UI are certified.",
);
writeFileSync(presentationAuditPath, presentationAudit);

let feedbackAudit = readFileSync(feedbackAuditPath, 'utf8');
feedbackAudit = replaceOnce(
  feedbackAudit,
  "  'state.sweepAngle += effectiveSpeed * state.direction * dt',\n  'const relPrev = Math.atan2',",
  "  'state.sweepAngle += effectiveSpeed * state.direction * dt',\n  'const sweepSmoothing = 1 - Math.pow(0.92, dt * 60)',\n  \"state.laserMode = 'HIGH';\\n            // HIGH is always a single sweep.\\n            state.beamsCount = 1\",\n  'const relPrev = Math.atan2',",
  'feedback fairness tokens',
);
feedbackAudit = replaceOnce(
  feedbackAudit,
  "  \"text: '⚠️ HIGH BEAM - SLIDE / DUCK!'\",\n  \"text = '🛡️ SHIELD READY'\",",
  "  \"text: '⚠️ HIGH BEAM - SLIDE / DUCK!'\",\n  \"text: '⚠️ DUAL BEAM - JUMP!'\",\n  \"text = '🛡️ SHIELD READY'\",",
  'DUAL feedback token',
);
feedbackAudit = feedbackAudit.replace(
  "elapsed-time jump/sweep physics, bidirectional crossing detection, jump/slide rules, shield handling, multipliers, fever, and lightweight in-game feedback are preserved without a separate visual framework.",
  "elapsed-time jump/sweep physics, refresh-normalized speed ramping, mode-safe beam counts, bidirectional crossing detection, jump/slide rules, shield handling, and lightweight in-game feedback are preserved without a separate visual framework.",
);
writeFileSync(feedbackAuditPath, feedbackAudit);

console.log('Laser Rope cohesion polish migration applied.');
