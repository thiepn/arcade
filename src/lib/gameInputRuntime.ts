/* Shared game-shell input ownership.
 *
 * Browser buttons keep focus after pointer activation. In an arcade shell that is
 * dangerous: Space is a primary gameplay key, but a focused Pause/Restart/Sound
 * button will consume Space as a second button click. This runtime gives the
 * gameplay surface explicit focus ownership whenever chrome/dialog interactions
 * finish, without breaking intentional keyboard navigation through toolbar buttons.
 */

interface ShellInputState {
  shell: HTMLElement;
  observer: MutationObserver;
  dialogOpen: boolean;
  focusFrame: number | null;
  onClick: (event: MouseEvent) => void;
  onPointerDown: (event: PointerEvent) => void;
}

const shellStates = new Map<HTMLElement, ShellInputState>();
let installed = false;
let documentObserver: MutationObserver | null = null;
let teardownGlobal: (() => void) | null = null;

const GAME_DIALOG_SELECTOR = '[data-p18-dialog="pause"], [data-p18-dialog="result"], [role="dialog"][aria-modal="true"]';

const getGameplayTarget = (shell: HTMLElement): HTMLElement | null =>
  shell.querySelector<HTMLElement>('[data-p18-stage]')
  ?? shell.querySelector<HTMLElement>('main > div')
  ?? shell.querySelector<HTMLElement>('main');

const hasGameDialog = (shell: HTMLElement) => Boolean(shell.querySelector(GAME_DIALOG_SELECTOR));

const shellCanOwnFocus = (shell: HTMLElement) =>
  shell.isConnected
  && !shell.hasAttribute('inert')
  && shell.getAttribute('aria-hidden') !== 'true';

const prepareGameplayTarget = (target: HTMLElement) => {
  if (!target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
    target.dataset.arcadeManagedTabindex = 'true';
  }
  target.dataset.arcadeInputOwner = 'gameplay';
};

const focusGameplayNow = (state: ShellInputState) => {
  if (!shellCanOwnFocus(state.shell) || hasGameDialog(state.shell)) return;
  const target = getGameplayTarget(state.shell);
  if (!target) return;
  prepareGameplayTarget(target);
  target.focus({ preventScroll: true });
};

const queueGameplayFocus = (state: ShellInputState) => {
  if (state.focusFrame !== null) cancelAnimationFrame(state.focusFrame);
  state.focusFrame = requestAnimationFrame(() => {
    state.focusFrame = null;
    focusGameplayNow(state);
  });
};

const refreshShell = (state: ShellInputState) => {
  const target = getGameplayTarget(state.shell);
  if (target) prepareGameplayTarget(target);

  const dialogOpen = hasGameDialog(state.shell);
  if (state.dialogOpen && !dialogOpen) {
    // P18's legacy dialog cleanup returns focus to Pause. Run on the next frame
    // so the authoritative input owner is gameplay after Resume/Play Again/Esc.
    queueGameplayFocus(state);
  }
  state.dialogOpen = dialogOpen;
};

const decorateShell = (shell: HTMLElement) => {
  if (shellStates.has(shell)) return;

  const state = {} as ShellInputState;
  state.shell = shell;
  state.dialogOpen = hasGameDialog(shell);
  state.focusFrame = null;

  state.onPointerDown = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const gameplay = getGameplayTarget(shell);
    if (target && gameplay?.contains(target)) queueGameplayFocus(state);
  };

  state.onClick = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest<HTMLButtonElement>('button');
    if (!button || !shell.contains(button)) return;

    const toolbarButton = Boolean(button.closest('header'));
    const restartButton = button.id === 'game-restart-btn';

    // Pointer-used chrome should never remain the Space key's owner. Restart is
    // also a new gameplay session, so return focus after keyboard activation too.
    if ((toolbarButton && event.detail > 0) || restartButton) {
      queueGameplayFocus(state);
    }
  };

  shell.addEventListener('pointerdown', state.onPointerDown, true);
  shell.addEventListener('click', state.onClick, true);

  state.observer = new MutationObserver(() => refreshShell(state));
  state.observer.observe(shell, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-p18-dialog', 'role', 'aria-modal', 'inert', 'aria-hidden'],
  });

  shellStates.set(shell, state);
  refreshShell(state);
  queueGameplayFocus(state);
};

const cleanupShell = (shell: HTMLElement) => {
  const state = shellStates.get(shell);
  if (!state) return;

  state.observer.disconnect();
  shell.removeEventListener('pointerdown', state.onPointerDown, true);
  shell.removeEventListener('click', state.onClick, true);
  if (state.focusFrame !== null) cancelAnimationFrame(state.focusFrame);

  const target = getGameplayTarget(shell);
  if (target) {
    if (target.dataset.arcadeManagedTabindex === 'true') target.removeAttribute('tabindex');
    delete target.dataset.arcadeManagedTabindex;
    delete target.dataset.arcadeInputOwner;
  }

  shellStates.delete(shell);
};

const discover = () => {
  for (const shell of Array.from(document.querySelectorAll<HTMLElement>('.game-shell'))) decorateShell(shell);
  for (const shell of Array.from(shellStates.keys())) {
    if (!shell.isConnected) cleanupShell(shell);
  }
};

export const installGameInputRuntime = () => {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return teardownGlobal ?? (() => {});

  installed = true;
  documentObserver = new MutationObserver(discover);
  documentObserver.observe(document.body, { childList: true, subtree: true });
  discover();

  teardownGlobal = () => {
    documentObserver?.disconnect();
    for (const shell of Array.from(shellStates.keys())) cleanupShell(shell);
    documentObserver = null;
    teardownGlobal = null;
    installed = false;
  };

  return teardownGlobal;
};
