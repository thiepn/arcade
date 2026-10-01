import { P18_GAME_CLARITY_BY_ID, P18_GAME_TITLE_TO_ID, type P18GameClarityProfile } from './gameClarityProfiles';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const GAMEPLAY_TEXT_ENTRY = 'input[type="text"], input:not([type]), textarea, [contenteditable="true"], [contenteditable=""]';

interface ShellState {
  shell: HTMLElement;
  stage: HTMLElement;
  profile: P18GameClarityProfile;
  observer: MutationObserver;
  hint: HTMLElement | null;
  hintDismissed: boolean;
  activeDialog: HTMLElement | null;
  dialogCleanup: (() => void) | null;
  dialogIsolation: Array<{ element: HTMLElement; inert: boolean }>;
  stageTabIndexAdded: boolean;
  onPointerDown: (event: PointerEvent) => void;
  onKeyDown: (event: KeyboardEvent) => void;
}

const shellStates = new Map<HTMLElement, ShellState>();
let installed = false;
let documentObserver: MutationObserver | null = null;
let teardownGlobal: (() => void) | null = null;

const normalise = (value: string) => value.replace(/\s+/g, ' ').trim().toUpperCase();

const getProfile = (shell: HTMLElement) => {
  const canonicalTitle = normalise(shell.querySelector('h1 > span')?.textContent ?? '');
  const id = P18_GAME_TITLE_TO_ID[canonicalTitle];
  return id ? P18_GAME_CLARITY_BY_ID[id] : null;
};

const setAccessibleControlNames = (state: ShellState) => {
  const { shell } = state;
  const pauseVisible = Boolean(shell.querySelector('[data-p18-dialog="pause"]'));
  const resultVisible = Boolean(shell.querySelector('[data-p18-dialog="result"]'));
  const labels: Array<[string, string, string?]> = [
    ['game-back-btn', 'Back to Arcade', resultVisible ? 'Escape' : undefined],
    ['game-restart-btn', 'Restart game', 'R'],
    ['game-pause-btn', pauseVisible ? 'Resume game' : 'Pause game', resultVisible ? undefined : 'Escape'],
  ];

  for (const [id, label, shortcut] of labels) {
    const button = shell.querySelector<HTMLElement>(`#${id}`);
    if (!button) continue;
    button.setAttribute('aria-label', label);
    if (shortcut) button.setAttribute('aria-keyshortcuts', shortcut);
    else button.removeAttribute('aria-keyshortcuts');
  }

  const pause = shell.querySelector<HTMLElement>('#game-pause-btn');
  if (pause) pause.setAttribute('aria-pressed', pauseVisible ? 'true' : 'false');

  const sound = shell.querySelector<HTMLElement>('#game-sound-btn');
  if (sound) {
    const enabled = sound.getAttribute('aria-pressed') === 'true';
    sound.setAttribute('aria-label', enabled ? 'Mute sound' : 'Unmute sound');
    sound.setAttribute('aria-keyshortcuts', 'M');
  }

  const fullscreen = shell.querySelector<HTMLElement>('#game-fullscreen-btn');
  if (fullscreen) {
    const fullscreenElement = document.fullscreenElement;
    const exiting = Boolean(fullscreenElement && (fullscreenElement === shell || shell.contains(fullscreenElement)));
    fullscreen.setAttribute('aria-label', exiting ? 'Exit fullscreen' : 'Enter fullscreen');
    fullscreen.setAttribute('aria-keyshortcuts', 'Alt+Enter');
    fullscreen.setAttribute('aria-pressed', exiting ? 'true' : 'false');
  }

  const haptics = shell.querySelector<HTMLElement>('#game-haptics-btn');
  if (haptics) {
    const enabled = haptics.getAttribute('aria-pressed') === 'true';
    haptics.setAttribute('aria-label', enabled ? 'Disable haptic feedback' : 'Enable haptic feedback');
  }
};

const createText = (tag: keyof HTMLElementTagNameMap, className: string, text: string) => {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
};

const createList = (label: string, items: readonly string[]) => {
  const section = document.createElement('div');
  section.className = 'p18-teaching-group';
  section.appendChild(createText('div', 'p18-teaching-label', label));
  const list = document.createElement('ul');
  list.className = 'p18-teaching-list';
  for (const item of items) list.appendChild(createText('li', '', item));
  section.appendChild(list);
  return section;
};

const findPauseOverlay = (shell: HTMLElement) => {
  const heading = Array.from(shell.querySelectorAll('h2')).find((node) => normalise(node.textContent ?? '') === 'GAME PAUSED');
  return heading?.closest<HTMLElement>('.absolute.inset-0') ?? null;
};

const findResultOverlay = (shell: HTMLElement) => {
  // The action ID is stable across normal and new-high-score results, whereas
  // the visible high-score badge contains nested AP-PB text and is not an
  // exact text node. Anchor result discovery to the actual result action.
  const playAgain = shell.querySelector<HTMLElement>('#btn-play-again');
  if (playAgain) return playAgain.closest<HTMLElement>('.absolute.inset-0');

  const marker = Array.from(shell.querySelectorAll('span, div')).find((node) => {
    const text = normalise(node.textContent ?? '');
    return text === 'SESSION COMPLETE' || text.startsWith('NEW HIGH SCORE!');
  });
  return marker?.closest<HTMLElement>('.absolute.inset-0') ?? null;
};

const decoratePause = (state: ShellState, overlay: HTMLElement) => {
  if (overlay.dataset.p18Dialog === 'pause') return;
  overlay.dataset.p18Dialog = 'pause';
  overlay.classList.add('p18-pause-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const heading = Array.from(overlay.querySelectorAll('h2')).find((node) => normalise(node.textContent ?? '') === 'GAME PAUSED');
  if (heading) {
    const id = `p18-pause-title-${state.profile.id}`;
    heading.id = id;
    overlay.setAttribute('aria-labelledby', id);
  } else {
    overlay.setAttribute('aria-label', `${state.profile.title} paused`);
  }

  const innerDialog = heading?.parentElement;
  innerDialog?.classList.add('p18-pause-dialog');

  const howHeading = Array.from(overlay.querySelectorAll('div')).find((node) => normalise(node.textContent ?? '') === 'HOW TO PLAY');
  const card = howHeading?.parentElement;
  if (!card || card.querySelector('[data-p18-clarity-panel="true"]')) return;

  card.classList.add('p18-how-to-play-card');
  card.setAttribute('aria-label', 'How to play');
  const legacy = card.querySelector('p');
  if (legacy) {
    legacy.hidden = true;
    legacy.setAttribute('aria-hidden', 'true');
    legacy.setAttribute('data-p18-legacy-instructions', 'true');
  }

  const panel = document.createElement('div');
  panel.dataset.p18ClarityPanel = 'true';
  panel.className = 'p18-clarity-panel';

  const objective = document.createElement('section');
  objective.className = 'p18-objective';
  objective.appendChild(createText('div', 'p18-teaching-label', 'OBJECTIVE'));
  objective.appendChild(createText('p', '', state.profile.objective));
  panel.appendChild(objective);

  const controls = document.createElement('div');
  controls.className = 'p18-controls-grid';
  controls.appendChild(createList('ESSENTIAL', state.profile.essential));
  if (state.profile.secondary.length) controls.appendChild(createList('SECONDARY', state.profile.secondary));
  panel.appendChild(controls);

  const mastery = document.createElement('section');
  mastery.className = 'p18-mastery';
  mastery.appendChild(createText('div', 'p18-teaching-label', `MASTERY — ${state.profile.masteryName}`));
  mastery.appendChild(createText('p', '', state.profile.mastery));
  panel.appendChild(mastery);

  const watch = document.createElement('section');
  watch.className = 'p18-watch';
  watch.appendChild(createText('div', 'p18-teaching-label', 'WATCH FOR'));
  watch.appendChild(createText('p', '', state.profile.danger));
  panel.appendChild(watch);

  card.appendChild(panel);
};

const decorateResult = (state: ShellState, overlay: HTMLElement) => {
  if (overlay.dataset.p18Dialog === 'result') return;
  overlay.dataset.p18Dialog = 'result';
  overlay.classList.add('p18-result-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const heading = overlay.querySelector('h2');
  if (heading) {
    const id = `p18-result-title-${state.profile.id}`;
    heading.id = id;
    overlay.setAttribute('aria-labelledby', id);
  } else {
    overlay.setAttribute('aria-label', `${state.profile.title} result`);
  }

  const dialog = heading?.parentElement;
  dialog?.classList.add('p18-result-dialog');
  if (!dialog || dialog.querySelector('[data-p18-result-guidance="true"]')) return;

  const guidance = document.createElement('section');
  guidance.dataset.p18ResultGuidance = 'true';
  guidance.className = 'p18-result-guidance';

  const rule = document.createElement('div');
  rule.className = 'p18-result-row';
  rule.appendChild(createText('span', 'p18-result-label', 'FAILURE RULE'));
  rule.appendChild(createText('p', '', state.profile.failure));
  guidance.appendChild(rule);

  const next = document.createElement('div');
  next.className = 'p18-result-row';
  next.appendChild(createText('span', 'p18-result-label', 'NEXT TRY'));
  next.appendChild(createText('p', '', state.profile.nextTry));
  guidance.appendChild(next);

  const actions = Array.from(dialog.children).find((child) => child instanceof HTMLElement && child.querySelector('button'));
  if (actions) dialog.insertBefore(guidance, actions);
  else dialog.appendChild(guidance);
};

const releaseDialogIsolation = (state: ShellState) => {
  for (const record of state.dialogIsolation.splice(0).reverse()) {
    record.element.inert = record.inert;
  }
};

const applyDialogIsolation = (state: ShellState, dialog: HTMLElement) => {
  releaseDialogIsolation(state);
  let current: HTMLElement | null = dialog;
  while (current && current !== state.shell) {
    const parent = current.parentElement;
    if (!parent) break;
    for (const sibling of Array.from(parent.children)) {
      if (!(sibling instanceof HTMLElement) || sibling === current) continue;
      state.dialogIsolation.push({ element: sibling, inert: sibling.inert });
      sibling.inert = true;
    }
    current = parent;
  }
};

const setupDialogFocus = (state: ShellState, dialog: HTMLElement | null) => {
  if (state.activeDialog === dialog) return;
  state.dialogCleanup?.();
  state.dialogCleanup = null;
  state.activeDialog = dialog;

  if (!dialog) {
    let frame = 0;
    let attempts = 0;
    const restoreStageFocus = () => {
      if (!state.shell.isConnected || !state.stage.isConnected) return;
      const textEntry = state.stage.querySelector<HTMLElement>(GAMEPLAY_TEXT_ENTRY);
      const focusTarget =
        textEntry &&
        !textEntry.hasAttribute('disabled') &&
        !textEntry.closest('[inert], [aria-hidden="true"]')
          ? textEntry
          : state.stage;
      focusTarget.focus({ preventScroll: true });
      attempts++;
      if (attempts < 4) {
        frame = requestAnimationFrame(restoreStageFocus);
      }
    };
    frame = requestAnimationFrame(restoreStageFocus);
    state.dialogCleanup = () => cancelAnimationFrame(frame);
    return;
  }

  applyDialogIsolation(state, dialog);
  if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');

  const visibleFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => {
    const rect = element.getBoundingClientRect();
    return !element.hidden && !element.inert && element.getAttribute('aria-hidden') !== 'true' && rect.width > 0 && rect.height > 0;
  });
  const focusPreferred = () => {
    // Result screens explicitly advertise Space as Play Again. Make that action
    // the initial focus owner so native Space/Enter activation matches the UI.
    const preferred = dialog.dataset.p18Dialog === 'result'
      ? dialog.querySelector<HTMLElement>('#btn-play-again')
      : null;
    const target = preferred && !preferred.inert ? preferred : visibleFocusable()[0] ?? dialog;
    target.focus({ preventScroll: true });
  };

  const frame = requestAnimationFrame(focusPreferred);
  const onFocusIn = (event: FocusEvent) => {
    const target = event.target instanceof Node ? event.target : null;
    if (target && dialog.contains(target)) return;
    focusPreferred();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const focusable = visibleFocusable();
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!dialog.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus({ preventScroll: true });
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  state.shell.addEventListener('focusin', onFocusIn, true);
  dialog.addEventListener('keydown', onKeyDown);
  state.dialogCleanup = () => {
    cancelAnimationFrame(frame);
    state.shell.removeEventListener('focusin', onFocusIn, true);
    dialog.removeEventListener('keydown', onKeyDown);
    releaseDialogIsolation(state);
  };
};

const hintStorageKey = (id: string) => `micro-arcade:p18-hint:${id}`;

const hintAlreadySeen = (id: string) => {
  try {
    return window.localStorage.getItem(hintStorageKey(id)) === '1';
  } catch {
    return false;
  }
};

const markHintSeen = (id: string) => {
  try {
    window.localStorage.setItem(hintStorageKey(id), '1');
  } catch {}
};

const isGameplayActive = (state: ShellState) =>
  state.stage.closest('main')?.getAttribute('data-gameplay-active') === 'true';

const isInteractiveTarget = (target: EventTarget | null) => {
  const element = target instanceof Element ? target : null;
  return Boolean(element?.closest('button, a[href], input, textarea, select, [role="button"], [contenteditable="true"], [contenteditable=""]'));
};

const removeHint = (state: ShellState) => {
  if (state.hintDismissed) return;
  state.hintDismissed = true;
  state.hint?.remove();
  state.hint = null;
  markHintSeen(state.profile.id);
};

const ensureFirstRunHint = (state: ShellState) => {
  if (!state.profile.firstRunHint || state.hintDismissed || state.hint || hintAlreadySeen(state.profile.id)) return;
  const hint = document.createElement('div');
  hint.className = 'p18-first-run-hint';
  hint.dataset.p18FirstRunHint = state.profile.id;
  hint.setAttribute('role', 'status');
  hint.setAttribute('aria-live', 'polite');
  hint.textContent = state.profile.firstRunHint;
  // Do not cover game HUDs or resize the playfield when the hint disappears.
  (state.shell.querySelector('.arcade-game-status') ?? state.stage).appendChild(hint);
  state.hint = hint;
};

const refreshShell = (state: ShellState) => {
  setAccessibleControlNames(state);
  state.stage.setAttribute('role', 'region');
  state.stage.setAttribute('aria-label', `${state.profile.title} gameplay area. ${state.profile.objective}`);
  state.stage.dataset.p18Stage = state.profile.id;
  ensureFirstRunHint(state);

  const pause = findPauseOverlay(state.shell);
  const result = pause ? null : findResultOverlay(state.shell);
  if (pause) decoratePause(state, pause);
  if (result) decorateResult(state, result);
  setupDialogFocus(state, pause ?? result);
  setAccessibleControlNames(state);
};

const decorateShell = (shell: HTMLElement) => {
  if (shellStates.has(shell)) return;
  const profile = getProfile(shell);
  const stage = (shell.querySelector('main > div') ?? shell.querySelector('main')) as HTMLElement | null;
  if (!profile || !stage) return;

  shell.dataset.p18Game = profile.id;
  shell.dataset.p18Clarity = 'ready';

  const state = {} as ShellState;
  state.shell = shell;
  state.stage = stage;
  state.profile = profile;
  state.hint = null;
  state.hintDismissed = hintAlreadySeen(profile.id);
  state.activeDialog = null;
  state.dialogCleanup = null;
  state.dialogIsolation = [];
  state.stageTabIndexAdded = !stage.hasAttribute('tabindex');
  if (state.stageTabIndexAdded) stage.setAttribute('tabindex', '-1');
  state.onPointerDown = (event) => {
    if (!isGameplayActive(state) || isInteractiveTarget(event.target)) return;
    removeHint(state);
  };
  state.onKeyDown = (event) => {
    if (!isGameplayActive(state) || isInteractiveTarget(event.target)) return;
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat || event.isComposing) return;
    if (['Tab', 'Escape', 'r', 'R', 'm', 'M'].includes(event.key)) return;
    removeHint(state);
  };
  stage.addEventListener('pointerdown', state.onPointerDown, { capture: true, passive: true });
  window.addEventListener('keydown', state.onKeyDown, { capture: true });

  state.observer = new MutationObserver(() => refreshShell(state));
  state.observer.observe(shell, { childList: true, subtree: true, attributes: true, attributeFilter: ['title'] });
  shellStates.set(shell, state);
  refreshShell(state);
};

const cleanupShell = (shell: HTMLElement) => {
  const state = shellStates.get(shell);
  if (!state) return;
  state.observer.disconnect();
  state.dialogCleanup?.();
  state.stage.removeEventListener('pointerdown', state.onPointerDown, true);
  window.removeEventListener('keydown', state.onKeyDown, true);
  state.hint?.remove();
  state.stage.removeAttribute('data-p18-stage');
  state.stage.removeAttribute('role');
  state.stage.removeAttribute('aria-label');
  if (state.stageTabIndexAdded) state.stage.removeAttribute('tabindex');
  releaseDialogIsolation(state);
  shell.removeAttribute('data-p18-game');
  shell.removeAttribute('data-p18-clarity');
  shellStates.delete(shell);
};

const discover = () => {
  for (const shell of Array.from(document.querySelectorAll<HTMLElement>('.game-shell'))) decorateShell(shell);
  for (const shell of Array.from(shellStates.keys())) {
    if (!shell.isConnected) cleanupShell(shell);
  }
};

const handleFullscreenChange = () => {
  discover();
  for (const state of shellStates.values()) {
    if (state.shell.isConnected) refreshShell(state);
  }
};

export const installGameClarityRuntime = () => {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return teardownGlobal ?? (() => {});
  installed = true;
  documentObserver = new MutationObserver(discover);
  documentObserver.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  discover();

  teardownGlobal = () => {
    documentObserver?.disconnect();
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    for (const shell of Array.from(shellStates.keys())) cleanupShell(shell);
    documentObserver = null;
    teardownGlobal = null;
    installed = false;
  };
  return teardownGlobal;
};
