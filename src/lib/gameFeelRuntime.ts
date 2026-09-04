import { P17_GAME_TITLE_TO_ID } from './gameFeelProfiles';

export type P17FeedbackKind =
  | 'input'
  | 'success'
  | 'strong'
  | 'mastery'
  | 'warning'
  | 'failure'
  | 'transition';

export const P17_MAX_FEEDBACK_NODES = 8;
export const P17_FEEDBACK_EVENT = 'arcade:p17-feedback';

const FAILURE_TERMS = [
  'MISS', 'WRONG', 'FALSE START', 'TIMEOUT', 'HOLD BREAK', 'GAME OVER', 'FAILED',
  'CRASH', 'COLLISION', 'DESTROYED', 'NO OVERLAP', 'LOST',
];
const MASTERY_TERMS = [
  'PERFECT', 'TETRIS', 'B2B', 'CLEAR CHAIN', 'CONTRACT COMPLETE', 'CONTRACT CLEAR',
  'RAZOR', 'OVERCLOCK', 'FOCUS CLEAR', 'FOCUS SUCCESS', 'REDLINE', 'APEX', 'PHASE CUT',
  'SURGE', 'HUNT RUSH', 'PHASE THREAD', 'BURST', 'POWER PLAY', 'SYNC WAGER', 'RESONANCE',
  'MASTER ROUTE', 'ENCORE', 'MULTIBALL', 'BOSS DEFEATED', 'VICTORY', 'NEW HIGH', 'HIGH SCORE',
];
const WARNING_TERMS = [
  'WARNING', 'DANGER', 'INCOMING', 'HOLD', 'SAFE LANE', 'LASER RISING', 'FINAL CHAOS',
];
const STRONG_SUCCESS_TERMS = [
  'GREAT', 'COMBO', 'STREAK', 'LEVEL UP', 'SECTOR CLEAR', 'ROUND CLEAR', 'CAPTURE',
  'WARP', 'FEVER', 'CHAIN', 'TRIPLE', 'DOUBLE',
];

interface ShellState {
  shell: HTMLElement;
  stage: HTMLElement;
  layer: HTMLElement;
  nodes: HTMLElement[];
  nodeCursor: number;
  sequence: number;
  observer: MutationObserver;
  lastScore: number | null;
  lastBest: number | null;
  semanticCooldowns: Map<P17FeedbackKind, number>;
  timers: Set<number>;
}

interface P17FeedbackDetail {
  kind?: P17FeedbackKind;
  x?: number;
  y?: number;
}

const shellStates = new Map<HTMLElement, ShellState>();
let installed = false;
let documentObserver: MutationObserver | null = null;
let motionQuery: MediaQueryList | null = null;
let teardownGlobalListeners: (() => void) | null = null;

const normalise = (value: string) => value.replace(/\s+/g, ' ').trim().toUpperCase();

const isReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const syncMotionPreference = () => {
  document.documentElement.dataset.p17Motion = isReducedMotion() ? 'reduced' : 'full';
};

const identifyGame = (shell: HTMLElement) => {
  const heading = normalise(shell.querySelector('h1')?.textContent ?? '');
  return P17_GAME_TITLE_TO_ID[heading] ?? 'unknown';
};

const readHeaderMetric = (shell: HTMLElement, label: 'SCORE' | 'BEST') => {
  const labels = Array.from(shell.querySelectorAll('header span'));
  const labelElement = labels.find((element) => normalise(element.textContent ?? '') === label);
  const container = labelElement?.parentElement;
  if (!container) return null;
  const candidates = Array.from(container.querySelectorAll('span'))
    .filter((element) => element !== labelElement)
    .map((element) => Number((element.textContent ?? '').replace(/[^0-9.-]/g, '')))
    .filter(Number.isFinite);
  return candidates[0] ?? null;
};

const scheduleShellTimer = (state: ShellState, callback: () => void, durationMs: number) => {
  const timer = window.setTimeout(() => {
    state.timers.delete(timer);
    callback();
  }, durationMs);
  state.timers.add(timer);
};

const restartClass = (
  state: ShellState,
  element: HTMLElement,
  className: string,
  durationMs: number,
) => {
  const sequence = String((Number(element.dataset.p17Sequence ?? '0') || 0) + 1);
  element.dataset.p17Sequence = sequence;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  scheduleShellTimer(state, () => {
    if (element.dataset.p17Sequence === sequence) element.classList.remove(className);
  }, durationMs);
};

const emitBurst = (
  state: ShellState,
  kind: P17FeedbackKind,
  clientX?: number,
  clientY?: number,
): boolean => {
  const now = performance.now();
  const previous = state.semanticCooldowns.get(kind) ?? -Infinity;
  const cooldown = kind === 'mastery' || kind === 'transition' ? 180 : 70;
  if (kind !== 'input' && now - previous < cooldown) return false;
  state.semanticCooldowns.set(kind, now);

  const node = state.nodes[state.nodeCursor % state.nodes.length];
  state.nodeCursor = (state.nodeCursor + 1) % state.nodes.length;
  state.sequence += 1;
  const sequence = String(state.sequence);
  const rect = state.stage.getBoundingClientRect();
  const x = Number.isFinite(clientX) ? Math.max(0, Math.min(rect.width, (clientX as number) - rect.left)) : rect.width / 2;
  const y = Number.isFinite(clientY) ? Math.max(0, Math.min(rect.height, (clientY as number) - rect.top)) : rect.height / 2;

  node.dataset.p17Kind = kind;
  node.dataset.p17Sequence = sequence;
  node.style.setProperty('--p17-x', `${x}px`);
  node.style.setProperty('--p17-y', `${y}px`);
  node.classList.remove('is-active');
  void node.offsetWidth;
  node.classList.add('is-active');

  const lifetime = isReducedMotion() ? 120 : kind === 'mastery' || kind === 'transition' ? 440 : 260;
  scheduleShellTimer(state, () => {
    if (node.dataset.p17Sequence === sequence) node.classList.remove('is-active');
  }, lifetime);

  if (kind === 'mastery') restartClass(state, state.stage, 'p17-stage-mastery', lifetime);
  if (kind === 'failure') restartClass(state, state.stage, 'p17-stage-failure', lifetime);
  if (kind === 'warning') restartClass(state, state.stage, 'p17-stage-warning', lifetime);
  if (kind === 'strong') restartClass(state, state.stage, 'p17-stage-strong', lifetime);
  if (kind === 'transition') restartClass(state, state.stage, 'p17-stage-transition', lifetime);
  return true;
};

const classifySemanticText = (raw: string): P17FeedbackKind | null => {
  const text = normalise(raw);
  if (!text || text.length > 110) return null;
  if (FAILURE_TERMS.some((term) => text.includes(term))) return 'failure';
  if (MASTERY_TERMS.some((term) => text.includes(term))) return 'mastery';
  if (WARNING_TERMS.some((term) => text.includes(term))) return 'warning';
  if (STRONG_SUCCESS_TERMS.some((term) => text.includes(term))) return 'strong';
  if (text === 'GOOD' || text === 'CLEAR' || text === 'SUCCESS') return 'success';
  return null;
};

const scanSemanticMutation = (state: ShellState, mutation: MutationRecord) => {
  const candidates: Node[] = [];
  if (mutation.type === 'characterData') candidates.push(mutation.target);
  for (const node of Array.from(mutation.addedNodes)) candidates.push(node);

  for (const node of candidates) {
    if (!state.stage.contains(node)) continue;
    let text = '';
    if (node.nodeType === Node.TEXT_NODE) text = node.textContent ?? '';
    else if (node instanceof HTMLElement) {
      if (node.matches('button, input, textarea, select')) continue;
      text = node.textContent ?? '';
    }
    const kind = classifySemanticText(text);
    if (!kind) continue;
    if (!emitBurst(state, kind)) continue;
    const anchor = node instanceof HTMLElement ? node : node.parentElement;
    if (anchor && state.stage.contains(anchor)) {
      restartClass(state, anchor, `p17-semantic-${kind}`, kind === 'mastery' ? 420 : 260);
    }
  }
};

const scanScore = (state: ShellState) => {
  const score = readHeaderMetric(state.shell, 'SCORE');
  const best = readHeaderMetric(state.shell, 'BEST');

  if (score !== null) {
    if (state.lastScore !== null && score > state.lastScore) {
      const scoreLabel = Array.from(state.shell.querySelectorAll('header span'))
        .find((element) => normalise(element.textContent ?? '') === 'SCORE');
      const metric = scoreLabel?.parentElement as HTMLElement | null;
      if (metric) restartClass(state, metric, 'p17-score-bump', 220);
      const crossedMilestone = score >= 1000 && Math.floor(score / 1000) > Math.floor(state.lastScore / 1000);
      emitBurst(state, crossedMilestone ? 'strong' : 'success');
    }
    state.lastScore = score;
  }

  if (best !== null) {
    if (state.lastBest !== null && best > state.lastBest) {
      const bestLabel = Array.from(state.shell.querySelectorAll('header span'))
        .find((element) => normalise(element.textContent ?? '') === 'BEST');
      const metric = bestLabel?.parentElement as HTMLElement | null;
      if (metric) restartClass(state, metric, 'p17-best-bump', 360);
    }
    state.lastBest = best;
  }
};

const createFeedbackLayer = (stage: HTMLElement) => {
  const layer = document.createElement('div');
  layer.className = 'p17-feedback-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.dataset.p17FeedbackLayer = 'true';
  const nodes = Array.from({ length: P17_MAX_FEEDBACK_NODES }, () => {
    const node = document.createElement('span');
    node.className = 'p17-feedback-burst';
    node.setAttribute('aria-hidden', 'true');
    layer.appendChild(node);
    return node;
  });
  stage.appendChild(layer);
  return { layer, nodes };
};

const decorateShell = (shell: HTMLElement) => {
  if (shellStates.has(shell)) return;
  const stage = (shell.querySelector('main > div') ?? shell.querySelector('main')) as HTMLElement | null;
  if (!stage) return;

  shell.dataset.p17Game = identifyGame(shell);
  shell.dataset.p17Feel = 'ready';
  const { layer, nodes } = createFeedbackLayer(stage);
  const state = {} as ShellState;
  state.shell = shell;
  state.stage = stage;
  state.layer = layer;
  state.nodes = nodes;
  state.nodeCursor = 0;
  state.sequence = 0;
  state.lastScore = readHeaderMetric(shell, 'SCORE');
  state.lastBest = readHeaderMetric(shell, 'BEST');
  state.semanticCooldowns = new Map();
  state.timers = new Set();
  state.observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) scanSemanticMutation(state, mutation);
    scanScore(state);
    if (state.shell.dataset.p17Game === 'unknown') state.shell.dataset.p17Game = identifyGame(state.shell);
  });
  state.observer.observe(shell, { childList: true, subtree: true, characterData: true });
  shellStates.set(shell, state);
};

const cleanupShell = (shell: HTMLElement) => {
  const state = shellStates.get(shell);
  if (!state) return;
  state.observer.disconnect();
  for (const timer of state.timers) window.clearTimeout(timer);
  state.timers.clear();
  state.layer.remove();
  shell.removeAttribute('data-p17-game');
  shell.removeAttribute('data-p17-feel');
  shellStates.delete(shell);
};

const pruneDetachedShells = () => {
  for (const shell of shellStates.keys()) {
    if (!document.documentElement.contains(shell)) cleanupShell(shell);
  }
};

const findStateFromTarget = (target: EventTarget | null) => {
  const element = target instanceof Element ? target : null;
  const shell = element?.closest('.game-shell') as HTMLElement | null;
  return shell ? shellStates.get(shell) ?? null : null;
};

const onPointerDown = (event: PointerEvent) => {
  const state = findStateFromTarget(event.target);
  if (!state) return;
  const element = event.target instanceof Element ? event.target : null;
  const control = element?.closest('button, [role="button"]') as HTMLElement | null;
  if (control) restartClass(state, control, 'p17-control-ack', 140);
  if (element && state.stage.contains(element)) emitBurst(state, 'input', event.clientX, event.clientY);
};

const onKeyDown = (event: KeyboardEvent) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  const shell = document.querySelector('.game-shell') as HTMLElement | null;
  if (!shell) return;
  const state = shellStates.get(shell);
  if (!state) return;
  emitBurst(state, 'input');
};

const onExplicitFeedback = (event: Event) => {
  const custom = event as CustomEvent<P17FeedbackDetail>;
  const shell = document.querySelector('.game-shell') as HTMLElement | null;
  const state = shell ? shellStates.get(shell) : null;
  if (!state) return;
  emitBurst(state, custom.detail?.kind ?? 'success', custom.detail?.x, custom.detail?.y);
};

export const emitP17GameFeel = (kind: P17FeedbackKind, detail: Omit<P17FeedbackDetail, 'kind'> = {}) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(P17_FEEDBACK_EVENT, { detail: { ...detail, kind } }));
};

export const installGameFeelRuntime = () => {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return teardownGlobalListeners ?? (() => {});
  installed = true;
  syncMotionPreference();
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  motionQuery.addEventListener('change', syncMotionPreference);

  const discoverShells = () => {
    for (const shell of Array.from(document.querySelectorAll('.game-shell'))) decorateShell(shell as HTMLElement);
    pruneDetachedShells();
  };

  document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
  document.addEventListener('keydown', onKeyDown, { capture: true });
  window.addEventListener(P17_FEEDBACK_EVENT, onExplicitFeedback as EventListener);

  documentObserver = new MutationObserver(discoverShells);
  documentObserver.observe(document.body, { childList: true, subtree: true });
  discoverShells();

  teardownGlobalListeners = () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener(P17_FEEDBACK_EVENT, onExplicitFeedback as EventListener);
    motionQuery?.removeEventListener('change', syncMotionPreference);
    documentObserver?.disconnect();
    for (const shell of Array.from(shellStates.keys())) cleanupShell(shell);
    documentObserver = null;
    motionQuery = null;
    teardownGlobalListeners = null;
    installed = false;
    delete document.documentElement.dataset.p17Motion;
  };

  return teardownGlobalListeners;
};
