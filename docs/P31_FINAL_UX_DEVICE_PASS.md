# P31 — Final Product UX, Motion, Audio & Real-Device Pass

Date: 2026-10-06.

## Goal

P31 is a defect/polish pass over the complete P28–P30 product loop. It does not redesign Arcade, add another progression system, or change scoring.

The pass targets visible inconsistencies that remain when the product is used as a phone/tablet/desktop PWA:

- motion accessibility;
- interaction feedback consistency;
- mobile Web Audio and vibration lifecycle behavior;
- home-screen safe areas;
- loading/error recovery;
- touch-target consistency on the new progression surfaces;
- phone/tablet/desktop browser acceptance.

## Product changes

### Motion

The P28 daily challenge, P29 progression home, game-card library transitions and home empty-state now read the platform reduced-motion preference through Motion's runtime API.

When reduced motion is enabled:

- card entrance/layout/hover choreography is disabled;
- daily/progression entrance motion is disabled;
- progress bars update without animated travel;
- the library empty-state does not slide;
- Browse All uses an instant scroll rather than a forced smooth scroll.

The existing global CSS reduced-motion rule remains as a second layer for CSS animations/transitions.

### Audio and haptics

P28–P30 actions now match the established Arcade feedback language:

- Daily Challenge launch uses a success cue;
- progression/game recommendations use click feedback;
- achievement navigation uses the lighter pop cue;
- result-screen Play next uses click feedback.

The Web Audio engine now safely recreates a closed context and catches rejected resume attempts, which avoids unhandled playback failures on mobile browsers that suspend/interruption-gate AudioContext.

Disabling haptics actively cancels an in-progress vibration pattern when the platform supports it.

### Real-device shell details

The home/PWA shell now reserves display-cutout safe areas, not only the in-game shell:

- left/right/bottom inset protection on the home surface;
- top inset protection on the sticky header;
- right/bottom inset protection for PWA status prompts.

The new progression controls also maintain at least the existing 40–44px touch floor.

### Recovery/loading

Runtime error recovery now moves focus to the recovery heading and exposes explicit labelled alert relationships, so keyboard/screen-reader users do not remain focused inside the crashed subtree.

Existing lazy-loading status surfaces remain aria-live and reduced-motion-safe.

## Device-class acceptance

P31 adds a browser acceptance matrix covering:

- desktop 1440×900;
- phone portrait 390×844 at 3× DPR with touch;
- phone landscape 844×390 at 3× DPR with touch;
- tablet portrait 820×1180 at 2× DPR with touch.

Reduced-motion is enabled for the touch profiles. The gate verifies:

- no horizontal overflow;
- P28/P29/P31 motion mode agreement;
- touch-target floors on new progression surfaces;
- sound-toggle interaction without runtime errors;
- game launch/back flow and viewport containment;
- P30 result panel containment/touch safety through the controlled scoring harness.

This is automated device-class/browser qualification. It does not claim access to physical hardware sensors or vendor-specific native vibration hardware.

## Non-goals

P31 does not add:

- new games;
- new scoring/reward systems;
- another UI redesign;
- additional backend services;
- arbitrary animations;
- new audio assets;
- phase-driven infrastructure.

## Exit criteria

P31 is complete when:

- structural P31 audit passes;
- device-class browser acceptance passes;
- TypeScript and existing P17–P30 regression gates pass;
- root and Pages builds pass;
- release32 owns the new permanent P31 files/gates.
