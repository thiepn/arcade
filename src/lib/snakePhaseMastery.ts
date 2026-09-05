import { requestP22GameplayEvent } from './p22GameplayEvents';

export const SNAKE_PHASE_THREAD_EXTENSION_EVERY = 3;
export const SNAKE_PHASE_THREAD_EXTENSION_TICKS = 6;
export const SNAKE_PHASE_THREAD_MAX_GHOST_TICKS = 90;

export const getSnakePhaseThreadReward = (chain: number): number => {
  const safeChain = Math.max(1, Math.floor(chain));
  const baseReward = 150 * Math.min(8, safeChain);
  const chapterBonus = requestP22GameplayEvent({
    gameId: 'snake',
    kind: 'phase-thread',
    value: safeChain,
  });
  return baseReward + chapterBonus;
};

export const shouldExtendSnakePhaseThread = (chain: number): boolean =>
  chain > 0 && chain % SNAKE_PHASE_THREAD_EXTENSION_EVERY === 0;

export const extendSnakeGhostTimerForThread = (currentTicks: number, chain: number): number => {
  if (!shouldExtendSnakePhaseThread(chain)) return currentTicks;
  return Math.min(
    SNAKE_PHASE_THREAD_MAX_GHOST_TICKS,
    currentTicks + SNAKE_PHASE_THREAD_EXTENSION_TICKS,
  );
};
