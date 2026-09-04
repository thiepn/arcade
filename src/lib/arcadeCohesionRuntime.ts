/* P19 — shared product cohesion runtime. Presentation/semantics only. */

let installed = false;
let observer: MutationObserver | null = null;
let teardownGlobal: (() => void) | null = null;

const normalise = (value: string) => value.replace(/\s+/g, ' ').trim().toUpperCase();

const add = (element: Element | null | undefined, ...classes: string[]) => {
  if (element instanceof HTMLElement) element.classList.add(...classes);
};

const decorateHome = () => {
  const root = document.getElementById('root');
  const app = root?.firstElementChild;
  add(app, 'p19-app');
  if (app instanceof HTMLElement) app.dataset.p19Arcade = 'cohesive';

  const brand = document.getElementById('brand-logo-btn');
  add(brand, 'p19-brand-button');
  if (brand && !brand.getAttribute('aria-label')) brand.setAttribute('aria-label', 'Micro Arcade — All Games');

  const header = brand?.closest('header');
  add(header, 'p19-home-header');
  if (header instanceof HTMLElement) header.dataset.p19Surface = 'home-header';

  const cards = Array.from(document.querySelectorAll<HTMLElement>('[id^="game-card-"]'));
  for (const card of cards) {
    add(card, 'p19-game-card');
    card.dataset.p19GameCard = card.id.replace(/^game-card-/, '');
    add(card.querySelector('[id^="play-btn-"]'), 'p19-card-launch');
    add(card.querySelector('[id^="fav-btn-"]'), 'p19-card-favorite');
  }
  if (cards.length) add(cards[0].parentElement, 'p19-game-grid');

  const emptyHeading = Array.from(document.querySelectorAll('h3')).find((node) => normalise(node.textContent ?? '') === 'NO MINI-GAMES FOUND');
  add(emptyHeading?.parentElement, 'p19-empty-state');

  const homeFooter = Array.from(document.querySelectorAll('footer')).find((node) => !node.closest('.game-shell'));
  if (homeFooter instanceof HTMLElement) {
    homeFooter.dataset.p19Surface = 'home-footer';
    for (const button of Array.from(homeFooter.querySelectorAll('button'))) add(button, 'p19-footer-action');
  }
};

const decorateLoadingStates = () => {
  for (const status of Array.from(document.querySelectorAll<HTMLElement>('[role="status"][aria-busy="true"]'))) {
    add(status, 'p19-loading-state');
    status.dataset.p19State = 'loading';
    const panel = status.firstElementChild;
    add(panel, 'p19-loading-panel');
  }
};

const decorateRecoveryStates = () => {
  for (const alert of Array.from(document.querySelectorAll<HTMLElement>('[role="alert"]'))) {
    const panel = alert.closest('section') ?? alert;
    if (normalise(panel.textContent ?? '').includes('ARCADE RECOVERED')) {
      add(panel, 'p19-recovery-panel');
      panel.dataset.p19State = 'recovery';
      for (const button of Array.from(panel.querySelectorAll<HTMLButtonElement>('button'))) {
        const label = normalise(button.textContent ?? '');
        if (label.includes('BACK TO ARCADE')) add(button, 'p19-action-secondary');
        else add(button, 'p19-action-primary');
      }
    }
  }
};

const decorateAppModals = () => {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'));
  for (const dialog of dialogs) {
    if (dialog.closest('.game-shell')) continue;
    add(dialog, 'p19-modal-overlay');
    dialog.dataset.p19Modal = 'canonical';
    const panel = dialog.firstElementChild;
    add(panel, 'p19-modal-panel');
    if (panel instanceof HTMLElement) panel.dataset.p19Panel = 'canonical';

    const header = panel?.firstElementChild;
    if (header instanceof HTMLElement && header.querySelector('h1, h2')) add(header, 'p19-modal-header');

    for (const button of Array.from(dialog.querySelectorAll<HTMLElement>('button[aria-label*="Close" i]'))) add(button, 'p19-icon-button');
  }

  // If a regression ever renders multiple app-level modal dialogs simultaneously,
  // keep only the topmost dialog interactive rather than exposing stacked focus surfaces.
  const appDialogs = dialogs.filter((dialog) => !dialog.closest('.game-shell'));
  if (appDialogs.length > 1) {
    const ranked = appDialogs
      .map((dialog, index) => ({ dialog, index, z: Number.parseInt(getComputedStyle(dialog).zIndex || '0', 10) || 0 }))
      .sort((a, b) => a.z - b.z || a.index - b.index);
    const top = ranked[ranked.length - 1]?.dialog;
    for (const { dialog } of ranked) {
      const hidden = dialog !== top;
      dialog.classList.toggle('p19-stack-hidden', hidden);
      if (hidden) {
        dialog.setAttribute('aria-hidden', 'true');
        dialog.setAttribute('inert', '');
      } else {
        dialog.removeAttribute('aria-hidden');
        dialog.removeAttribute('inert');
      }
    }
  } else {
    for (const dialog of appDialogs) {
      dialog.classList.remove('p19-stack-hidden');
      dialog.removeAttribute('aria-hidden');
      dialog.removeAttribute('inert');
    }
  }
};

const decorateShell = () => {
  const shell = document.querySelector<HTMLElement>('.game-shell');
  if (!shell) return;
  shell.dataset.p19Shell = 'canonical';
  add(shell, 'p19-shell');

  const toolbar = shell.querySelector('header');
  add(toolbar, 'p19-shell-toolbar');
  if (toolbar instanceof HTMLElement) toolbar.dataset.p19Surface = 'toolbar';

  const back = shell.querySelector('#game-back-btn');
  add(back, 'p19-nav-button');
  for (const id of ['game-haptics-btn','game-fullscreen-btn','game-restart-btn','game-pause-btn','game-sound-btn']) {
    add(shell.querySelector(`#${id}`), 'p19-icon-button');
  }

  // Keep the global sound setting semantically identical between the home header
  // and every game shell. The visible Lucide icon is already the canonical state
  // source in GameShell; P19 exposes that same state to assistive technology.
  const soundButton = shell.querySelector<HTMLButtonElement>('#game-sound-btn');
  if (soundButton) {
    const iconClass = soundButton.querySelector('svg')?.getAttribute('class') ?? '';
    const soundEnabled = iconClass.includes('lucide-volume-2') && !iconClass.includes('lucide-volume-x');
    soundButton.setAttribute('aria-label', soundEnabled ? 'Mute sound' : 'Unmute sound');
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
  }

  const stage = shell.querySelector('main');
  add(stage, 'p19-shell-stage');
  add(stage?.firstElementChild, 'p19-stage-frame');

  const pause = shell.querySelector<HTMLElement>('[data-p18-dialog="pause"]');
  if (pause) {
    add(pause, 'p19-pause-overlay');
    pause.dataset.p19Dialog = 'pause';
    const panel = pause.querySelector('.p18-pause-dialog');
    add(panel, 'p19-pause-panel');
    if (panel instanceof HTMLElement) panel.dataset.p19Panel = 'pause';
    const buttons = Array.from(pause.querySelectorAll<HTMLButtonElement>('button'));
    for (const button of buttons) {
      const label = normalise(button.textContent ?? '');
      if (label.includes('RESUME')) add(button, 'p19-action-primary');
      else if (label.includes('RESTART')) add(button, 'p19-action-secondary');
      else if (label.includes('EXIT TO ARCADE')) {
        button.textContent = 'BACK TO ARCADE';
        button.setAttribute('aria-label', 'Back to Arcade');
        add(button, 'p19-action-tertiary');
      } else if (label.includes('BACK TO ARCADE')) {
        button.setAttribute('aria-label', 'Back to Arcade');
        add(button, 'p19-action-tertiary');
      }
    }
  }

  const result = shell.querySelector<HTMLElement>('[data-p18-dialog="result"]');
  if (result) {
    add(result, 'p19-result-overlay');
    result.dataset.p19Dialog = 'result';
    const panel = result.querySelector('.p18-result-dialog');
    add(panel, 'p19-result-panel');
    if (panel instanceof HTMLElement) panel.dataset.p19Panel = 'result';
    add(result.querySelector('#btn-play-again'), 'p19-action-primary');
    add(result.querySelector('#btn-view-leaderboard'), 'p19-action-secondary');
    add(result.querySelector('#btn-next-random'), 'p19-action-secondary');
    add(result.querySelector('#btn-exit-arcade'), 'p19-action-tertiary');
  }

  const hintFooter = Array.from(shell.querySelectorAll('footer')).find((node) => node.closest('.game-shell') === shell);
  add(hintFooter, 'p19-shell-hint');
};

const decorate = () => {
  document.documentElement.dataset.p19Cohesion = 'ready';
  decorateHome();
  decorateLoadingStates();
  decorateRecoveryStates();
  decorateAppModals();
  decorateShell();
};

export const installArcadeCohesionRuntime = () => {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return teardownGlobal ?? (() => {});
  installed = true;
  decorate();
  observer = new MutationObserver(decorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  teardownGlobal = () => {
    observer?.disconnect();
    observer = null;
    delete document.documentElement.dataset.p19Cohesion;
    installed = false;
    teardownGlobal = null;
  };
  return teardownGlobal;
};
