import { emitP17GameFeel } from './gameFeelRuntime';
import {
  P22_GAMEPLAY_EVENT,
  type P22GameId,
  type P22GameplayDetail,
} from './p22GameplayEvents';
import { P22_TEACHING } from './p22PromotionStructures';
import {
  createP22RunState,
  processP22GameplayEvent,
  type P22RoadDirection,
  type P22RunState,
} from './p22PromotionState';

const IDS = new Set<P22GameId>(['snake', 'orbit', 'neonrail', 'slingshot', 'bubblebuster', 'matrix', 'knifetarget', 'roadcross']);
const TITLE_TO_ID: Record<string, P22GameId> = {
  'CYBER SERPENT': 'snake',
  ORBIT: 'orbit',
  'NEON RAIL SHIFT': 'neonrail',
  'ORBITAL SLINGSHOT': 'slingshot',
  'ORB CANNON': 'bubblebuster',
  'MEMORY MATRIX': 'matrix',
  'KNIFE TARGET': 'knifetarget',
  'CYBER CROSSER': 'roadcross',
};

let installed = false;
let observer: MutationObserver | null = null;
let teardownGlobal: (() => void) | null = null;
let state: P22RunState | null = null;
let sessionToken: Element | null = null;
let hud: HTMLElement | null = null;
let pendingRoadDirection: P22RoadDirection | null = null;
let roadPointerStart: { x: number; y: number } | null = null;

const normalise = (value: string) => value.replace(/\s+/g, ' ').trim().toUpperCase();
const shell = () => document.querySelector<HTMLElement>('.game-shell');

const identifyGame = (element: HTMLElement): P22GameId | null => {
  const p18 = element.dataset.p18Game as P22GameId | undefined;
  if (p18 && IDS.has(p18)) return p18;
  const p17 = element.dataset.p17Game as P22GameId | undefined;
  if (p17 && IDS.has(p17)) return p17;
  return TITLE_TO_ID[normalise(element.querySelector('h1 > span')?.textContent ?? '')] ?? null;
};

const currentToken = (gameId: P22GameId) =>
  gameId === 'matrix'
    ? document.querySelector('#matrix-node-0')
    : document.querySelector('.game-shell main canvas');

const clearHud = () => {
  hud?.remove();
  hud = null;
};

const reset = (gameId: P22GameId, token: Element | null) => {
  clearHud();
  state = createP22RunState(gameId);
  sessionToken = token;
  pendingRoadDirection = null;
  roadPointerStart = null;
};

const ensureHud = (element: HTMLElement) => {
  if (!state) return null;
  if (hud?.isConnected) return hud;
  const stage = element.querySelector<HTMLElement>('main > div') ?? element.querySelector<HTMLElement>('main');
  if (!stage) return null;
  const panel = document.createElement('aside');
  panel.className = 'p22-promotion-hud';
  panel.dataset.p22Promotion = state.gameId;
  panel.setAttribute('aria-label', `${P22_TEACHING[state.gameId].title} progress`);
  const title = document.createElement('span');
  title.className = 'p22-hud-title';
  title.textContent = P22_TEACHING[state.gameId].title;
  const structure = document.createElement('span');
  structure.className = 'p22-hud-structure';
  structure.dataset.p22StructureValue = 'true';
  const step = document.createElement('span');
  step.className = 'p22-hud-step';
  step.dataset.p22StepValue = 'true';
  const bonus = document.createElement('span');
  bonus.className = 'p22-hud-bonus';
  bonus.dataset.p22BonusValue = 'true';
  panel.append(title, structure, step, bonus);
  stage.appendChild(panel);
  hud = panel;
  return panel;
};

const setTextIfChanged = (element: HTMLElement | null, value: string) => {
  if (element && element.textContent !== value) element.textContent = value;
};

const syncHud = (element: HTMLElement) => {
  if (!state) return;
  const panel = ensureHud(element);
  if (!panel) return;
  if (panel.dataset.p22Structure !== state.structure) panel.dataset.p22Structure = state.structure;
  if (panel.dataset.p22Step !== state.step) panel.dataset.p22Step = state.step;
  if (panel.dataset.p22Bonus !== String(state.bonus)) panel.dataset.p22Bonus = String(state.bonus);
  setTextIfChanged(panel.querySelector<HTMLElement>('[data-p22-structure-value]'), state.structure);
  setTextIfChanged(panel.querySelector<HTMLElement>('[data-p22-step-value]'), state.step);
  setTextIfChanged(panel.querySelector<HTMLElement>('[data-p22-bonus-value]'), `RUN +${state.bonus.toLocaleString()}`);
};

const extendPauseTeaching = (element: HTMLElement) => {
  if (!state) return;
  const dialog = element.querySelector<HTMLElement>('[data-p19-dialog="pause"], [data-p18-dialog="pause"]');
  const mastery = dialog?.querySelector<HTMLElement>('.p18-mastery');
  if (!mastery || mastery.querySelector('[data-p22-teaching]')) return;
  const profile = P22_TEACHING[state.gameId];
  const extension = document.createElement('div');
  extension.className = 'p22-pause-extension';
  extension.dataset.p22Teaching = state.gameId;
  const label = document.createElement('div');
  label.className = 'p22-pause-label';
  label.textContent = `P22 — ${profile.title}`;
  const summary = document.createElement('p');
  summary.textContent = profile.summary;
  const benefit = document.createElement('p');
  benefit.textContent = `PAYOFF: ${profile.benefit}`;
  const boundary = document.createElement('p');
  boundary.textContent = `BOUNDARY: ${profile.tradeoff}`;
  extension.append(label, summary, benefit, boundary);
  mastery.appendChild(extension);
};

const readFirewallStage = (element: HTMLElement) => {
  const match = (element.textContent ?? '').match(/FW\s+L(\d+)/i);
  return match ? Math.max(0, Number(match[1]) || 0) : 0;
};

const ensureActive = (gameId: P22GameId) => {
  const element = shell();
  if (!element || identifyGame(element) !== gameId) return null;
  const token = currentToken(gameId);
  if (!state || state.gameId !== gameId || (token && token !== sessionToken)) reset(gameId, token);
  else if (!sessionToken && token) sessionToken = token;
  syncHud(element);
  return element;
};

const onGameplayEvent = (event: Event) => {
  const detail = (event as CustomEvent<P22GameplayDetail>).detail;
  if (!detail || !IDS.has(detail.gameId)) return;
  const element = ensureActive(detail.gameId);
  if (!element || !state) return;
  const bonus = processP22GameplayEvent(state, detail, {
    firewallStage: readFirewallStage(element),
    roadDirection: detail.kind === 'road-move-accepted' ? pendingRoadDirection : null,
  });
  if (detail.kind === 'road-move-accepted') pendingRoadDirection = null;
  detail.bonus = bonus;
  if (bonus > 0) emitP17GameFeel('mastery');
  syncHud(element);
};

const scan = () => {
  const element = shell();
  if (!element) {
    clearHud();
    state = null;
    sessionToken = null;
    document.documentElement.removeAttribute('data-p22-promotion');
    return;
  }
  const gameId = identifyGame(element);
  if (!gameId) {
    clearHud();
    state = null;
    sessionToken = null;
    document.documentElement.removeAttribute('data-p22-promotion');
    return;
  }
  const token = currentToken(gameId);
  if (!state || state.gameId !== gameId || (token && token !== sessionToken)) reset(gameId, token);
  else if (!sessionToken && token) sessionToken = token;
  document.documentElement.dataset.p22Promotion = 'ready';
  syncHud(element);
  extendPauseTeaching(element);
  if (gameId === 'matrix') {
    const text = normalise(element.textContent ?? '');
    if (text.includes('DECRYPT ERROR') || text.includes('TIMEOUT')) state!.matrixOverclockChain = 0;
  }
};

const onKeyCapture = (event: KeyboardEvent) => {
  if (state?.gameId !== 'roadcross' || event.repeat) return;
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') pendingRoadDirection = 'left';
  else if (event.code === 'ArrowRight' || event.code === 'KeyD') pendingRoadDirection = 'right';
  else if (event.code === 'ArrowUp' || event.code === 'KeyW' || event.code === 'Space') pendingRoadDirection = 'forward';
  else if (event.code === 'ArrowDown' || event.code === 'KeyS') pendingRoadDirection = 'backward';
};

const onClickCapture = (event: MouseEvent) => {
  if (state?.gameId !== 'roadcross') return;
  const target = event.target instanceof Element ? event.target.closest('button') : null;
  const label = normalise(target?.getAttribute('aria-label') ?? '');
  if (label.includes('MOVE LEFT')) pendingRoadDirection = 'left';
  else if (label.includes('MOVE RIGHT')) pendingRoadDirection = 'right';
  else if (label.includes('MOVE FORWARD')) pendingRoadDirection = 'forward';
  else if (label.includes('MOVE BACKWARD')) pendingRoadDirection = 'backward';
};

const inferTapDirection = (event: PointerEvent): P22RoadDirection | null => {
  if (!state || state.gameId !== 'roadcross') return null;
  const container = document.querySelector<HTMLElement>('#road-cross-container');
  if (!container) return null;
  const rect = container.getBoundingClientRect();
  const available = Math.max(1, rect.width - 16);
  const scale = Math.min(1, available / (9 * 46));
  const offsetX = (rect.width - 9 * 46 * scale) / 2;
  const playerX = offsetX + (state.roadCol * 46 + 23) * scale;
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  if (localY > rect.height * 0.75 && Math.abs(localX - playerX) < 40) return 'backward';
  if (localX < playerX - 35) return 'left';
  if (localX > playerX + 35) return 'right';
  return 'forward';
};

const onPointerDownCapture = (event: PointerEvent) => {
  if (state?.gameId !== 'roadcross') return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target?.closest('#road-cross-container') || target.closest('button')) return;
  roadPointerStart = { x: event.clientX, y: event.clientY };
};

const onPointerUpCapture = (event: PointerEvent) => {
  if (state?.gameId !== 'roadcross') return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target?.closest('#road-cross-container') || target.closest('button')) return;
  const start = roadPointerStart;
  roadPointerStart = null;
  if (!start) {
    pendingRoadDirection = inferTapDirection(event);
    return;
  }
  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) pendingRoadDirection = inferTapDirection(event);
  else if (Math.abs(dx) > Math.abs(dy)) pendingRoadDirection = dx > 0 ? 'right' : 'left';
  else pendingRoadDirection = dy < 0 ? 'forward' : 'backward';
};

const onMutation = (mutations: MutationRecord[]) => {
  const onlyP22 = mutations.every((mutation) => {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    return Boolean(target?.closest('.p22-promotion-hud, .p22-pause-extension'));
  });
  if (!onlyP22) scan();
};

export const installP22PromotionRuntime = () => {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return teardownGlobal ?? (() => {});
  installed = true;
  window.addEventListener(P22_GAMEPLAY_EVENT, onGameplayEvent as EventListener);
  document.addEventListener('keydown', onKeyCapture, true);
  document.addEventListener('click', onClickCapture, true);
  document.addEventListener('pointerdown', onPointerDownCapture, true);
  document.addEventListener('pointerup', onPointerUpCapture, true);
  observer = new MutationObserver(onMutation);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  scan();
  teardownGlobal = () => {
    window.removeEventListener(P22_GAMEPLAY_EVENT, onGameplayEvent as EventListener);
    document.removeEventListener('keydown', onKeyCapture, true);
    document.removeEventListener('click', onClickCapture, true);
    document.removeEventListener('pointerdown', onPointerDownCapture, true);
    document.removeEventListener('pointerup', onPointerUpCapture, true);
    observer?.disconnect();
    observer = null;
    clearHud();
    state = null;
    sessionToken = null;
    pendingRoadDirection = null;
    roadPointerStart = null;
    document.documentElement.removeAttribute('data-p22-promotion');
    teardownGlobal = null;
    installed = false;
  };
  return teardownGlobal;
};
