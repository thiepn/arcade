# Responsive UI repair — PR 76

## Reproduced defects and fixes

- Shared chrome inherited the page font shorthand over explicit UI typography; some enlarged icon hitboxes did not center their SVGs. Restore intended typography and use centered 44px toolbar controls.
- Short/narrow game chrome used competing flex minimums. Use width- and height-aware toolbar grids with a separate score row on portrait phones and a single row on short landscape screens.
- Instruction and P22 mastery layers obscured game HUDs. Dock them in a stable status strip outside the game arena, including fullscreen, without resizing a running game when a hint disappears.
- Merge used fixed cell dimensions. Size its six-row board inside the actual space remaining after the HUD, retaining square tiles and independently keyboard-accessible column controls.
- Matrix's square board and toolbar competed for height. Bound the board and separate HUD/board columns in short landscape layouts.
- Rhythm and One Line placed HUD controls over their arenas. Move these controls into layout flow and let the canvas resize to the remaining playfield.
- Air Hockey's old insets did not match real control sizes. Reserve portrait HUD/control space and put controls beside the centered table on short landscape viewports.
- Type Rush's edge lanes clipped long target cards and its HUD obscured falling words. Bound target positions and separate the HUD, playfield and keyboard prompt.
- Stats exposes its panel itself as the dialog, unlike the other modal wrappers. Decorate its actual panel/header and label/center its close control. Bound application and in-game dialogs to their available viewport and preserve internal scrolling.

## Permanent regression coverage

The geometry harness waits for real game content, not merely a mounted loading shell. It checks page overflow, toolbar overlap, icon centering, touch targets, game controls, board bounds, canvas backing-store aspect ratio, status-strip separation, dialog bounds, focus containment and close actions. Six DOM/control-heavy games are rotated during an existing paused run, then resumed without remounting.

Chrome matrix: 320x480, 320x568, 360x640, 390x844, 412x915, 480x600, 568x320, 667x375, 844x390, 768x1024, 1024x600, 1280x720, 1440x900 and 1920x1080. This is 448 game/viewport checks, 84 live rotations and 42 application-dialog checks.

Firefox and WebKit additionally exercise 320x480, 390x844, 568x320 and 1280x720, each with 128 game/viewport checks, 24 rotations and 12 application-dialog checks. Firefox uses its real viewport/touch implementation, not an unsupported mobile-emulation switch.

All checks run inside the existing read-only CI workflow; Pages remains gated on the success of the whole CI workflow. Existing gameplay, storage, Worker/D1 and PWA-update regressions remain enabled. Screenshots and JSON results are uploaded on success or failure.

## Evidence and limits

The local 14-viewport matrix passed 448/448 with 84 rotations and 42 dialogs. The local browser used an isolated document containing the compiled application and actual built CSS because navigation is restricted in that execution environment. That local test is not network, native storage or service-worker certification. GitHub Actions runs the real built site with normal navigation and separately executes the existing storage, offline/update and live leaderboard checks.

Remote CI and production status must be read from the exact PR/merge commit's workflow runs. Do not infer release success from this document, a loading screen, source-string audits, or the absence of a console exception. Desktop browser emulation is not physical iOS/Android hardware certification, and finite test coverage is not a claim that no undiscovered bugs exist.
