import { lazy } from 'react';
import { GAMES_REGISTRY } from '../data/games';
import { P17_GAME_FEEL_PROFILES } from './gameFeelProfiles';
import { P18_GAME_CLARITY_PROFILES } from './gameClarityProfiles';
import { getSafeCanvasDpr } from './mobileRuntime';

const titleAliases = new Map([
  ['Gravity', 'Vector Golf'],
  ['Astro Blaster 360', 'Hex Capture'],
]);

const replaceAliasText = (value: string) => {
  let next = value.replace(/Astro Blaster 360/g, 'Hex Capture');
  next = next.replace(/\bGravity\b(?!\s+Tower)/g, 'Vector Golf');
  return next;
};

const replacementCanvasSpecs = [
  { selector: 'canvas[aria-label="Vector Golf course"]', logicalWidth: 900, logicalHeight: 560 },
  { selector: 'canvas[aria-label="Hex Capture territory field"]', logicalWidth: 840, logicalHeight: 560 },
] as const;

const sizedCanvases = new WeakSet<HTMLCanvasElement>();

const installResponsiveCanvas = (canvas: HTMLCanvasElement, logicalWidth: number, logicalHeight: number) => {
  if (sizedCanvases.has(canvas)) return;
  sizedCanvases.add(canvas);

  let frame = 0;
  const resize = () => {
    frame = 0;
    if (!canvas.isConnected) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    const dpr = getSafeCanvasDpr(rect.width, rect.height, window.devicePixelRatio || 1);
    const backingWidth = Math.max(1, Math.round(rect.width * dpr));
    const backingHeight = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== backingWidth) canvas.width = backingWidth;
    if (canvas.height !== backingHeight) canvas.height = backingHeight;

    // The games keep a stable logical simulation space while the backing store
    // follows the real rendered box. This prevents browser bitmap stretching at
    // narrow/tall viewports and keeps DPR memory bounded by the shared runtime.
    const ctx = canvas.getContext('2d');
    ctx?.setTransform(backingWidth / logicalWidth, 0, 0, backingHeight / logicalHeight, 0, 0);
  };
  const schedule = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(resize);
  };

  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
  observer?.observe(canvas);
  window.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule, { passive: true });
  // WebKit can defer the first ResizeObserver/rAF past geometry inspection.
  // Establish a correct backing ratio synchronously on mount, then use the
  // scheduled path for later viewport changes.
  resize();
};

const installReplacementCanvasSizing = (root: ParentNode) => {
  for (const spec of replacementCanvasSpecs) {
    const matches: HTMLCanvasElement[] = [];
    if (root instanceof HTMLCanvasElement && root.matches(spec.selector)) matches.push(root);
    matches.push(...Array.from(root.querySelectorAll<HTMLCanvasElement>(spec.selector)));
    for (const canvas of matches) installResponsiveCanvas(canvas, spec.logicalWidth, spec.logicalHeight);
  }
};

const patchVisibleAliases = (root: ParentNode) => {
  installReplacementCanvasSizing(root);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  for (const node of textNodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest('script, style')) continue;

    // P17/P18 discover the internal compatibility slot from the original title.
    // On a live game shell, wait until both runtimes have attached before changing
    // the visible label. Home cards can be aliased immediately.
    const shell = parent.closest<HTMLElement>('.game-shell');
    if (shell && (!shell.dataset.p17Game || !shell.dataset.p18Game)) continue;

    const value = node.nodeValue ?? '';
    const replacement = replaceAliasText(value);
    if (replacement !== value) node.nodeValue = replacement;
  }

  const elements = root instanceof Element ? [root, ...Array.from(root.querySelectorAll('*'))] : Array.from(root.querySelectorAll('*'));
  for (const element of elements) {
    for (const attribute of ['aria-label', 'title']) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const replacement = replaceAliasText(value);
      if (replacement !== value) element.setAttribute(attribute, replacement);
    }
  }
};

let aliasesInstalled = false;
const installVisibleAliases = () => {
  if (aliasesInstalled || typeof document === 'undefined') return;
  aliasesInstalled = true;
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      patchVisibleAliases(document.body);
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-label', 'title', 'data-p17-game', 'data-p18-game'],
  });
  schedule();
};

const updateTeachingProfiles = () => {
  const vectorFeel = P17_GAME_FEEL_PROFILES.find((profile) => profile.id === 'gravity');
  if (vectorFeel) Object.assign(vectorFeel, {
    title: 'Vector Golf',
    identity: 'precision bank-shot physics',
    ordinary: 'aim, launch, wall contact and star pickup remain distinct and readable',
    mastery: 'under-par clears, bank-shot routes and clean cup finishes receive stronger emphasis',
    failure: 'hazard resets and over-stroked holes clearly identify what cost the run',
    highSpeed: false,
  });
  const hexFeel = P17_GAME_FEEL_PROFILES.find((profile) => profile.id === 'astroblaster');
  if (hexFeel) Object.assign(hexFeel, {
    title: 'Hex Capture',
    identity: 'territory-risk tension',
    ordinary: 'safe movement, trail drawing and territory closure stay visually separated',
    mastery: 'large captures and consecutive clean closures dominate routine movement',
    failure: 'enemy-to-trail contact is unmistakable at the moment a life is lost',
    highSpeed: false,
  });

  const vectorClarity = P18_GAME_CLARITY_PROFILES.find((profile) => profile.id === 'gravity');
  if (vectorClarity) Object.assign(vectorClarity, {
    title: 'Vector Golf',
    objective: 'Sink the ball through six compact neon holes in as few strokes as possible.',
    essential: ['Drag from the ball — aim and set power', 'Arrow keys — fine-tune aim', 'Space — take the keyboard shot'],
    secondary: ['W / S — adjust keyboard shot power', 'Collect route stars and use bank shots for bonus score'],
    masteryName: 'Vector Route',
    mastery: 'Finish under par while collecting stars and using deliberate wall banks instead of brute-force strokes.',
    danger: 'Hazards and excessive strokes reduce the value of a hole and can end a weak run early.',
    benefit: 'Under-par holes, route stars, clean banks, and controlled cup speed.',
    failure: 'A hazard reset or stroke-limit miss shows which line or power choice failed.',
    nextTry: 'Read the full rebound path before shooting; shorter controlled shots are often better than maximum power.',
    sourceControls: 'Drag Aim • Arrows: Aim • W/S: Power • Space: Shoot',
    visualRedundancy: 'Aim line, power meter, obstacle geometry, stars and cup shape communicate state beyond color.',
    firstRunHint: 'DRAG FROM THE BALL — RELEASE TO SHOOT',
    highSpeed: false,
  });
  const hexClarity = P18_GAME_CLARITY_PROFILES.find((profile) => profile.id === 'astroblaster');
  if (hexClarity) Object.assign(hexClarity, {
    title: 'Hex Capture',
    objective: 'Claim 72% of the field by leaving safe territory, drawing a trail, and reconnecting it.',
    essential: ['Arrow keys / WASD — move one grid step', 'Space — arm a capture route'],
    secondary: ['Reconnect your trail to safe territory to seal an area', 'Use the on-screen pad and CAPTURE button on touch devices'],
    masteryName: 'Clean Closure',
    mastery: 'Large closures and consecutive captures raise the chain bonus, but longer exposed trails are more dangerous.',
    danger: 'An enemy touching your exposed trail costs a life.',
    benefit: 'Large safe closures, fast routes, and maintained capture chains.',
    failure: 'The struck trail remains highlighted so the exposed route is clear.',
    nextTry: 'Cut off small safe regions first; short closures build territory without leaving a long vulnerable trail.',
    sourceControls: 'WASD / Arrows • Space: Capture • Touch D-Pad',
    visualRedundancy: 'Captured cells, active trail, player marker, enemy marker and percentage labels use shape and position as well as color.',
    firstRunHint: 'PRESS SPACE — LEAVE THE BORDER — RECONNECT TO CAPTURE',
    highSpeed: false,
  });
};

export function applyReplacementGames() {
  const vector = GAMES_REGISTRY.find((game) => game.id === 'gravity');
  if (vector) Object.assign(vector, {
    tagline: 'Bank. Bounce. Sink.',
    description: 'Six compact neon mini-golf holes built around deliberate bank shots, route stars, moving hazards, and under-par mastery.',
    category: 'Physics',
    sessionLength: '2–4 min',
    accentColor: '#22d3ee',
    accentGlow: 'rgba(34, 211, 238, 0.42)',
    accentBg: 'rgba(34, 211, 238, 0.11)',
    instructions: 'Drag from the ball to aim and set power, or use arrows plus W/S and Space. Collect route stars, use wall banks, and finish each hole under par for the strongest score.',
    controlsHint: 'Drag Aim • Arrows: Aim • W/S: Power • Space: Shoot',
    icon: 'Crosshair',
    component: lazy(() => import('../games/VectorGolf').then(({ VectorGolf }) => ({ default: VectorGolf }))),
  });

  const hex = GAMES_REGISTRY.find((game) => game.id === 'astroblaster');
  if (hex) Object.assign(hex, {
    tagline: 'Leave safety. Close the loop. Claim the field.',
    description: 'A fast territory-capture game: draw exposed routes through the grid, reconnect to safety, and trap space before roaming hunters touch your trail.',
    category: 'Strategy',
    sessionLength: '1–3 min',
    accentColor: '#a78bfa',
    accentGlow: 'rgba(167, 139, 250, 0.44)',
    accentBg: 'rgba(167, 139, 250, 0.11)',
    instructions: 'Move with WASD or arrows. Press Space to arm a capture, leave safe territory, then reconnect your trail. Reach 72% before losing three lives.',
    controlsHint: 'WASD / Arrows • Space: Capture • Touch D-Pad',
    icon: 'Hexagon',
    component: lazy(() => import('../games/HexCapture').then(({ HexCapture }) => ({ default: HexCapture }))),
  });

  updateTeachingProfiles();
  installVisibleAliases();
}

export const REPLACEMENT_TITLE_ALIASES = titleAliases;