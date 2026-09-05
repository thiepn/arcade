import { GAMES_REGISTRY } from '../data/games';
import { P23_CLARITY_EXTENSION_BY_ID, type P23GameId } from './p23ClarityProfileExtensions';

const IDS = new Set<P23GameId>(['typerush', 'perfectstop', 'reaction', 'pulse', 'laserrope', 'flappyaero', 'stack']);
const TITLE_TO_ID: Record<string, P23GameId> = {
  'TYPE RUSH': 'typerush',
  'PERFECT STOP': 'perfectstop',
  REACTION: 'reaction',
  PULSE: 'pulse',
  'LASER ROPE REFLEX': 'laserrope',
  'AERO PULSE': 'flappyaero',
  STACK: 'stack',
};

let installed = false;
let observer: MutationObserver | null = null;

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toUpperCase();

const identify = (shell: HTMLElement): P23GameId | null => {
  const p18 = shell.dataset.p18Game as P23GameId | undefined;
  if (p18 && IDS.has(p18)) return p18;
  return TITLE_TO_ID[normalize(shell.querySelector('h1 > span')?.textContent ?? '')] ?? null;
};

const extendPulseRegistryControls = () => {
  const pulse = GAMES_REGISTRY.find((game) => game.id === 'pulse');
  if (!pulse) return;
  pulse.controlsHint = 'Click / Tap / Space • A/D or Left/Right: Next Groove Path • F / Shift: Sync Wager';
  pulse.instructions = 'Tap/Space on the beat. Queue the next Groove Path with A/D or Left/Right, and press F/Shift or tap Wager to arm the earned Sync Wager without changing ordinary judgement.';
  pulse.description = 'Read six groove patterns as authored Groove Paths, choose the next path at safe boundaries, sustain Fever combos, and spend earned Sync Wagers on an optional ±10px bonus window.';
};

const extendPause = (shell: HTMLElement, id: P23GameId) => {
  const dialog = shell.querySelector<HTMLElement>('[data-p19-dialog="pause"], [data-p18-dialog="pause"]');
  const mastery = dialog?.querySelector<HTMLElement>('.p18-mastery');
  if (!mastery || mastery.querySelector('[data-p23-teaching]')) return;
  const profile = P23_CLARITY_EXTENSION_BY_ID[id];
  const block = document.createElement('div');
  block.className = 'p23-pause-extension';
  block.dataset.p23Teaching = id;
  const title = document.createElement('div');
  title.className = 'p23-pause-label';
  title.textContent = `P23 — ${profile.masteryName}`;
  const masteryText = document.createElement('p');
  masteryText.textContent = profile.mastery;
  const benefit = document.createElement('p');
  benefit.textContent = `PAYOFF: ${profile.benefit}`;
  const danger = document.createElement('p');
  danger.textContent = `BOUNDARY: ${profile.danger}`;
  const nextTry = document.createElement('p');
  nextTry.textContent = `NEXT TRY: ${profile.nextTry}`;
  if (profile.sourceControls) {
    const controls = document.createElement('p');
    controls.textContent = `CONTROLS: ${profile.sourceControls}`;
    block.append(title, masteryText, benefit, danger, nextTry, controls);
  } else {
    block.append(title, masteryText, benefit, danger, nextTry);
  }
  mastery.appendChild(block);
};

const scan = () => {
  const shell = document.querySelector<HTMLElement>('.game-shell');
  if (!shell) return;
  const id = identify(shell);
  if (id) extendPause(shell, id);
};

export const installP23TransformationRuntime = () => {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  extendPulseRegistryControls();
  observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true });
  scan();
};

export const uninstallP23TransformationRuntime = () => {
  observer?.disconnect();
  observer = null;
  installed = false;
};
