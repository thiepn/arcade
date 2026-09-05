import { P18_GAME_CLARITY_BY_ID, type P18GameClarityProfile } from './gameClarityProfiles';
import { P22_TEACHING } from './p22PromotionStructures';
import type { P22GameId } from './p22GameplayEvents';

export interface P22ClarityExtension {
  id: P22GameId;
  masteryName: string;
  mastery: string;
  benefit: string;
  danger: string;
  nextTry: string;
}

export const P22_CLARITY_EXTENSIONS: readonly P22ClarityExtension[] = [
  { id: 'snake', masteryName: 'Phase Thread Chapter', mastery: 'Complete the visible chapter by threading enough unique firewall cells during Ghost Phase after the required firewall level is active.', benefit: 'Score-only chapter clears plus the existing growth, portal and Phase Thread rewards.', danger: 'Chapter pressure never makes firewall contact safe outside Ghost Phase and never extends Ghost Phase beyond its certified cap.', nextTry: 'Preserve turning room so the next Ghost Phase can cross several different firewall cells instead of repeating one opening.' },
  { id: 'orbit', masteryName: 'Constellation', mastery: 'Read the named crystal route and the paired threat formation as one objective: execute the route, then respect the advertised SAFE lane.', benefit: 'Route value, formation clears, grazes, and score-only constellation completion.', danger: 'A constellation never removes the formation safe lane or shortens its warning/grace timing.', nextTry: 'Finish the route with enough lane control left to reach the formation SAFE lane early.' },
  { id: 'neonrail', masteryName: 'Rail Sequence', mastery: 'Three existing phrase units now form one authored sequence; clean core pickups across the sequence prepare an extra payout at the next normal Route Mastery milestone.', benefit: 'Sequence recognition, cores, existing Phase choices, Surge charges, and score-only sequence completion.', danger: 'Do not chase the sequence bonus by entering blocked rails; Phase and Surge remain optional.', nextTry: 'Read the sequence as three connected phrases and shift early before high-speed corrections become necessary.' },
  { id: 'slingshot', masteryName: 'Mission Arc', mastery: 'Clear both visible navigation missions in their two-sector order to finish the current Mission Arc.', benefit: 'Existing mission rewards plus a score-only arc completion payoff.', danger: 'Mission Arcs never alter gravity, launch velocity, lives, or the legal warp route.', nextTry: 'Treat the first mission as preparation for the second sector instead of optimizing each sector in isolation.' },
  { id: 'bubblebuster', masteryName: 'Salvo Plan', mastery: 'Follow the visible short tactical sequence using the existing chamber, one-swap, cascade and earned Burst decisions.', benefit: 'Score-only plan clears layered onto matches, drops, combos and Burst rewards.', danger: 'Plans never grant favorable colors, free Burst charges, or slower ceiling pressure.', nextTry: 'Before shooting, decide whether the current chamber should be preserved, swapped, or converted through a drop/Burst opportunity.' },
  { id: 'matrix', masteryName: 'Protocol Suite', mastery: 'After the eight-round foundation, four-round suites compose the existing transforms; the HUD previews the next protocol so you can choose when to risk Overclock.', benefit: 'Correct recall, optional Overclock multipliers, suite completion, and score-only Overclock-chain payoff.', danger: 'Overclock still adds two nodes, speeds playback, and disables manual pattern replay for that active round.', nextTry: 'Use the next-protocol preview to reserve Overclock for transformations you can confidently visualize.' },
  { id: 'knifetarget', masteryName: 'Razor Route', mastery: 'The first Razor hit of each six-stage cycle commits the run to a Precision or Tempo trace inside the same safe Razor tolerance.', benefit: 'Existing Razor bonuses plus a score-only multi-stage route payoff ending at the Boss Core.', danger: 'Route marks never override shields, embedded blades, collision geometry, lives, or stage speed caps.', nextTry: 'Choose the opening Razor side deliberately, then preserve safe blade spacing for the later route stages.' },
  { id: 'roadcross', masteryName: 'District Route', mastery: 'Reach the visible three waypoint columns in order before the next district checkpoint using only normal hops.', benefit: 'Distance/checkpoint scoring plus an optional score-only district-route and bounded route-streak bonus.', danger: 'Routes never freeze traffic, slow trains, add immunity, or manipulate logs/vehicles to guarantee completion.', nextTry: 'Use safe rows to set up the next waypoint column before advancing into traffic, rail, or river pressure.' },
] as const;

export const P22_CLARITY_EXTENSION_BY_ID = Object.freeze(
  Object.fromEntries(P22_CLARITY_EXTENSIONS.map((extension) => [extension.id, extension])) as Record<P22GameId, P22ClarityExtension>,
);

export const getP22ExtendedClarityProfile = (id: P22GameId): P18GameClarityProfile => {
  const base = P18_GAME_CLARITY_BY_ID[id];
  const extension = P22_CLARITY_EXTENSION_BY_ID[id];
  if (!base) throw new Error(`Missing P18 clarity profile for P22 candidate ${id}`);
  return {
    ...base,
    masteryName: extension.masteryName,
    mastery: extension.mastery,
    benefit: extension.benefit,
    danger: extension.danger,
    nextTry: extension.nextTry,
    // P22 deliberately inherits sourceControls/essential/secondary unchanged.
  };
};

export const assertP22TeachingParity = (id: P22GameId) =>
  P22_TEACHING[id].title.toUpperCase().includes(P22_CLARITY_EXTENSION_BY_ID[id].masteryName.toUpperCase().split(' ')[0]);
