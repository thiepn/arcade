/**
 * P17 reduced-motion bridge for canvas-rendered games.
 * The global feel runtime keeps data-p17-motion synchronized with the OS setting;
 * canvas games can consult this without creating one matchMedia listener per game.
 */
export const isArcadeReducedMotion = () =>
  typeof document !== 'undefined' && document.documentElement.dataset.p17Motion === 'reduced';
