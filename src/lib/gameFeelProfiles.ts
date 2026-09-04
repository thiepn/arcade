export type P17PriorityTier = 1 | 2 | 3 | 4;

export interface P17GameFeelProfile {
  id: string;
  title: string;
  identity: string;
  ordinary: string;
  mastery: string;
  failure: string;
  priority: P17PriorityTier;
  highSpeed: boolean;
}

/**
 * P17 keeps one explicit feel profile per shipped game. These are presentation
 * contracts, not gameplay rules: they describe what existing actions should
 * communicate and let the runtime preserve game-specific identity while sharing
 * bounded feedback primitives.
 */
export const P17_GAME_FEEL_PROFILES: readonly P17GameFeelProfile[] = Object.freeze([
  { id: 'orbit', title: 'Orbit', identity: 'orbital precision', ordinary: 'clean lane pulse and crystal acknowledgement', mastery: 'route/graze/formation clear reads as a deliberate orbital lock', failure: 'collision source and unsafe lane are immediately legible', priority: 3, highSpeed: false },
  { id: 'stack', title: 'Stack', identity: 'clean geometric impact', ordinary: 'placement has crisp contact and cut confirmation', mastery: 'perfect and Focus success receive the strongest geometric emphasis', failure: 'insufficient overlap is visually obvious before reset', priority: 1, highSpeed: false },
  { id: 'reaction', title: 'Reaction', identity: 'cognitive signal clarity', ordinary: 'valid response confirms instantly without masking the next cue', mastery: 'inhibition/overtime success is distinct from a basic reaction', failure: 'false start, wrong cue and timeout remain visually distinguishable', priority: 1, highSpeed: false },
  { id: 'dodge', title: 'Dodge', identity: 'readable evasive pressure', ordinary: 'movement and pickup acknowledgement stay local to the player', mastery: 'Phase Cut chains feel offensive without hiding hazards', failure: 'the colliding hazard is emphasized at impact', priority: 2, highSpeed: true },
  { id: 'pulse', title: 'Pulse', identity: 'rhythmic synchronization', ordinary: 'GOOD/GREAT/PERFECT form a clear ascending hierarchy', mastery: 'Fever and Sync Wager success feel musical rather than interruptive', failure: 'miss/wager failure are clear without disrupting beat reading', priority: 1, highSpeed: false },
  { id: 'merge', title: 'Merge', identity: 'deliberate puzzle clarity', ordinary: 'drop/merge/cascade steps read in sequence', mastery: 'contract/tool/cascade milestones rise above ordinary merges', failure: 'blocked or weak placement state remains understandable', priority: 3, highSpeed: false },
  { id: 'typerush', title: 'Type Rush', identity: 'typing urgency', ordinary: 'target lock and completed word react immediately', mastery: 'urgent/special high-value clears stand above routine words', failure: 'danger-line loss identifies the escaped word/lane', priority: 3, highSpeed: false },
  { id: 'oneline', title: 'One Line', identity: 'tactile drawn physics', ordinary: 'drawing, ink use, contacts and stars each read distinctly', mastery: 'portal and Master Route completion produce a clean physical payoff', failure: 'trajectory failure communicates where momentum/path broke down', priority: 1, highSpeed: false },
  { id: 'breakout', title: 'Breakout Mini', identity: 'kinetic brick impact', ordinary: 'brick hit, armor break and paddle contact remain distinct', mastery: 'contract/power/multiball moments clearly outrank normal hits', failure: 'drain is unambiguous without obscuring restart flow', priority: 3, highSpeed: false },
  { id: 'perfectstop', title: 'Perfect Stop', identity: 'precision anticipation', ordinary: 'stop input is acknowledged on the exact interaction', mastery: 'near/perfect/Encore results communicate closeness and tier', failure: 'poor stop clearly shows positional error', priority: 1, highSpeed: false },
  { id: 'chain', title: 'Chain', identity: 'tactical energy', ordinary: 'tool cast and resulting chain resolve in readable stages', mastery: 'Resonance and large cascade events outrank routine detonations', failure: 'spent charge and unmet wave target remain understandable', priority: 2, highSpeed: false },
  { id: 'gravity', title: 'Gravity', identity: 'smooth orbital motion', ordinary: 'star, boost and polarity changes remain individually readable', mastery: 'Flight Contract completion and sector clear have stronger hierarchy', failure: 'recall/collision/failed route cause is evident', priority: 1, highSpeed: false },
  { id: 'blade', title: 'Laser Blade', identity: 'slicing momentum', ordinary: 'slice path, hit and target break stay tightly coupled', mastery: 'center-cut Razor streaks and rush milestones are unmistakable', failure: 'bomb/miss state is distinct from a successful cut', priority: 3, highSpeed: false },
  { id: 'pinball', title: 'Neon Pinball', identity: 'physical mechanical table', ordinary: 'flipper, bumper and target hits each retain physical weight', mastery: 'multiball/drop-target completion dominates ordinary impacts', failure: 'drain and ball-save states are immediately legible', priority: 4, highSpeed: false },
  { id: 'chrono', title: 'Chrono Wave', identity: 'time-pressure navigation', ordinary: 'safe gap pass and EMP state read locally', mastery: 'Focus success and stage transitions have elevated temporal emphasis', failure: 'wall collision exposes the missed opening', priority: 3, highSpeed: false },
  { id: 'matrix', title: 'Memory Matrix', identity: 'cognitive sequence energy', ordinary: 'playback and player input are visually distinct', mastery: 'Overclock activation/success feels dangerous and special', failure: 'wrong node/life loss is clear without contaminating playback', priority: 1, highSpeed: false },
  { id: 'drift', title: 'Cyber Drift', identity: 'speed and road flow', ordinary: 'steer/drift/nitro acknowledgements remain attached to the car', mastery: 'Style Route completion and positive events have stronger hierarchy', failure: 'collision source remains visible through speed effects', priority: 3, highSpeed: true },
  { id: 'vanguard', title: 'Galaxy Vanguard', identity: 'explosive authored combat', ordinary: 'shot, hit, pickup and enemy destruction retain separate weights', mastery: 'boss/Nova/major wave events clearly exceed normal kills', failure: 'damage and lethal threat remain readable under heavy combat', priority: 4, highSpeed: true },
  { id: 'slingshot', title: 'Orbital Slingshot', identity: 'gravitational motion', ordinary: 'release, acceleration and capture communicate energy transfer', mastery: 'perfect capture/mission/warp create escalating orbital payoff', failure: 'overshoot, collision and failed capture are diagnosable', priority: 1, highSpeed: false },
  { id: 'snake', title: 'Cyber Serpent', identity: 'grid-state traversal', ordinary: 'growth, portal and firewall interactions stay visually separated', mastery: 'Ghost Phase Thread milestones stand above routine pickups', failure: 'wall/self/firewall death states remain distinguishable', priority: 2, highSpeed: false },
  { id: 'rhythm', title: 'Neon Rhythm Tapper', identity: 'musical precision', ordinary: 'lane hit hierarchy reinforces timing windows', mastery: 'hold clear, high combo and Overdrive feel musical and earned', failure: 'MISS/HOLD BREAK identify the affected lane/note cleanly', priority: 4, highSpeed: false },
  { id: 'tower', title: 'Gravity Tower Jumper', identity: 'vertical kinetic ascent', ordinary: 'bounce, landing and pickup feedback follow the avatar', mastery: 'precision landing/Apex state has stronger vertical punch', failure: 'laser versus missed-platform death is clear', priority: 3, highSpeed: true },
  { id: 'pacmaze', title: 'Cyber Pac-Runner', identity: 'maze chase readability', ordinary: 'pellet, turn and frightened states remain clean', mastery: 'Hunt Rush ghost captures clearly exceed normal collection', failure: 'ghost collision and frightened-state expiry are readable', priority: 3, highSpeed: false },
  { id: 'flappyaero', title: 'Aero Pulse', identity: 'aerial flow', ordinary: 'flap, gate clear and star/graze feedback stay lightweight', mastery: 'Flow Boost and graze streak milestones lift above normal flight', failure: 'gate collision identifies contact without visual clutter', priority: 3, highSpeed: true },
  { id: 'roadcross', title: 'Cyber Crosser', identity: 'lane-risk readability', ordinary: 'step/checkpoint feedback stays anchored to the player', mastery: 'district/checkpoint achievements outrank ordinary row progress', failure: 'vehicle/train/water cause is immediately apparent', priority: 2, highSpeed: true },
  { id: 'bubblebuster', title: 'Orb Cannon', identity: 'chamber planning and cascade', ordinary: 'shot, snap, match and drop resolve in clear order', mastery: 'Burst and large cascade events have stronger board-wide payoff', failure: 'ceiling pressure and terminal placement remain obvious', priority: 3, highSpeed: false },
  { id: 'astroblaster', title: 'Astro Blaster 360', identity: 'Newtonian combat impact', ordinary: 'thrust, fire and asteroid splits preserve physical direction', mastery: 'UFO/special-wave/high-value combat events dominate routine hits', failure: 'ship impact remains visible through effects', priority: 4, highSpeed: true },
  { id: 'laserrope', title: 'Laser Rope Reflex', identity: 'beam rhythm and body movement', ordinary: 'jump/slide acknowledgement never hides beam phase', mastery: 'Redline and clean evasion streaks are visually elevated', failure: 'beam contact and active mode remain clear at impact', priority: 2, highSpeed: true },
  { id: 'blockdrop', title: 'Cyber Block Drop', identity: 'planning with decisive clears', ordinary: 'placement/drop/hold remain crisp and restrained', mastery: 'Tetris, B2B and clear-chain milestones clearly exceed singles', failure: 'lockout/game over remains legible without board obstruction', priority: 1, highSpeed: false },
  { id: 'knifetarget', title: 'Knife Target', identity: 'precision throw cadence', ordinary: 'throw, embed and safe-hit contact remain immediate', mastery: 'Razor Mark chains and rushes are visibly premium', failure: 'blade collision/missed safety state is clear', priority: 3, highSpeed: false },
  { id: 'airhockey', title: 'Neon Puck Smash', identity: 'bounded physical duel', ordinary: 'mallet/puck/goal contact stays physical and readable', mastery: 'Power Play goal/streak feedback rises above routine contacts', failure: 'conceded goal is distinct from neutral collision', priority: 3, highSpeed: false },
  { id: 'neonrail', title: 'Neon Rail Shift', identity: 'rail phrase legibility', ordinary: 'lane shift/core pickup remain attached to the route', mastery: 'Phase/Surge/mastery streak moments are clear but compact', failure: 'blocked route collision remains readable at late speed', priority: 2, highSpeed: true },
]);

export const P17_GAME_TITLE_TO_ID = Object.freeze(
  Object.fromEntries(P17_GAME_FEEL_PROFILES.map((profile) => [profile.title.toUpperCase(), profile.id])) as Record<string, string>,
);

export const P17_HIGH_SPEED_GAME_IDS = Object.freeze(
  P17_GAME_FEEL_PROFILES.filter((profile) => profile.highSpeed).map((profile) => profile.id),
);
