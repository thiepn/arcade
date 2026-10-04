# Changelog

## Leaderboard v3 — release candidate

- Rebuilt immutable run storage, precise AP and bounded rating with shared ranks.
- Added current-mode personal records, additive v2 migration and v1 history archive.
- Added server screening, owner/mode-bound sessions and atomic idempotent receipts.
- Added durable retry queue, recovery codes, mode filters, pagination and mobile explanations.
- Fixed mid-match Hockey mode changes and legacy raw-record recovery.
- Added real PostgreSQL 17 and browser failure-path release gates.
- Deployment and threat-model details: `docs/leaderboard/RELEASE.md`.


## Scoring v2 — 2026-09-09

- Calibrated Arcade Points across all 32 cabinets and all 36 selectable configurations.
- Corrected the Score/AP presentation contract: every game now keeps its native raw **Score** in the HUD and results, while **AP** is displayed separately and used for cross-game ranking. Raw-score and AP personal bests are stored independently, and per-game leaderboard rows can show raw Score as secondary context.
- Bounded Chain, Drift, Pulse, Matrix and Rhythm reward inflation.
- Unified local/global/weekly best-per-game rating with a 10,000 AP per-game contribution cap; per-game records remain uncapped.
- Versioned, mode-bound, server-computed points and non-destructive legacy conversion.
- Permanent formula, migration, protocol, storage and browser-boundary regression tests.
- See [the complete audit and calibration limits](docs/SCORING_V2_AUDIT.md).

## Unreleased

### P33 offline-key recovery / encrypted-backup restore / long-term DR assurance — 2026-10-04
- Bind the signed `privateKeyPublicSha256` evidence to the committed recovery certificate's actual SPKI SHA-256 during GitHub verification, rejecting attestations that claim any different public key.
- Add a local offline-key ceremony that verifies the retained P31 ciphertext, proves the private key matches the committed recovery certificate, decrypts locally, runs the P31 verifier, restores into a disposable P32-compatible PostgreSQL target, and removes plaintext on exit.
- Produce a non-sensitive RSA-SHA256 signed attestation containing only source/restored hashes, row counts, safety booleans, certificate/public-key evidence and measured decrypt/restore timings.
- Add a manual GitHub attestation workflow that accepts only Base64 attestation/signature data, verifies the offline signature, downloads the exact retained P31 artifact itself, binds hashes/counts/run metadata, and persists a signed evidence ledger without receiving the private key or plaintext backup.
- Add daily long-term assurance requiring P31 backup freshness <=30h, P32 full-stack cold-recovery freshness <=8d, signed P33 offline ceremony freshness <=90d, and >=180d recovery-certificate validity.
- Report PENDING_OFFLINE_CEREMONY until the first real production recovery key ceremony is accepted; do not substitute a CI key for that operational proof.
- Add an ephemeral CI-only RSA/CMS integration covering real P31 export format, AES-256-GCM CMS decrypt, certificate/private-key matching, brand-new PostgreSQL restore, exact schema/payload fingerprints, offline signing and retained-ciphertext binding.
- Recommend real offline-key ceremonies every 60–75 days to retain margin beneath the hard 90-day assurance ceiling.

### P32 full-stack disaster recovery / cold restore / failover certification — 2026-10-04
- Sequence the recovered-stack browser drill through the real modal lifecycle: certify the leaderboard modal, close it via Escape, then mount Orbit, preventing the modal overlay from invalidating the gameplay-shell check.
- Reconcile the repository fresh-install Arcade schema with already-deployed Supabase constraints/indexes after the first live P32 drill correctly detected a protected-schema fingerprint mismatch; production tables remain unchanged.
- Add a weekly and on-change isolated full-stack recovery exercise that certifies production health before/after while never switching production traffic.
- Verify the latest retained P31 encrypted artifact and its ciphertext SHA-256, while preserving the offline recovery-private-key boundary instead of copying the key into GitHub.
- Extend the P31 export Edge Function with a second exact GitHub OIDC policy for the named P32 workflow and dedicated `arcade-p32-recovery` audience; no reusable Supabase credential is added.
- Restore a fresh verified P31 logical payload into a brand-new local PostgreSQL 17 database, apply every repository migration, and require exact protected-schema hash, payload hash, row counts, relationships and transient-state exclusions.
- Start the repository's exact `createLeaderboardHandler` against the recovered PostgreSQL target in read-only failover mode rather than implementing a parallel test API.
- Build the real frontend against that cold API and certify browser-origin health, overall/weekly leaderboards, CORS, real leaderboard UI network routing and a mounted Orbit game shell.
- Measure ordered production-precheck, artifact-reference, export, restore, API-ready, frontend-build, browser-certification and production-postcheck durations; report observed cold-restore-to-API, cold-restore-to-browser and full-exercise times without claiming a contractual RTO/RPO.
- Add one deduplicated P32 recovery-readiness issue and retain only non-sensitive P32 evidence for 90 days; plaintext recovery payloads are shredded and never uploaded.
- Add a second real PostgreSQL CI exercise that creates a brand-new database and executes the exact P32 cold-restore script before P32 can merge.
- Keep P32 non-destructive and non-promoting: no Pages write, content write, deployment write, automatic production restore, paid Supabase branch, PITR action or real traffic cutover.

### P31 backend data resilience / backup verification / restore readiness — 2026-10-03
- Add private verified Arcade recovery snapshots for durable identity, score history, moderation evidence, scoring profiles/policy, and only the historical session rows required by preserved evidence.
- Deliberately exclude rate-limit buckets and unused one-time play/leaderboard sessions from disaster recovery so stale tokens and throttling state are not resurrected.
- Fingerprint the protected schema and snapshot payload with SHA-256, record exact table counts, verify parent/child relationships, and retain daily/monthly/offsite recovery layers with bounded retention.
- Add a transaction-scoped restore drill that reconstructs every protected table into temporary Postgres tables using current live types and proves production rows are not overwritten.
- Add an exact GitHub-OIDC-gated Supabase Edge Function for backup export; no database password or service-role key is stored in GitHub.
- Encrypt off-site backup JSON with AES-256-GCM CMS to the existing offline THIEPN recovery certificate, shred plaintext, and retain only ciphertext plus a non-sensitive manifest for 90 days.
- Add one deduplicated P31 backup-readiness issue for export/verification/encryption failures.
- Add a real PostgreSQL 17 integration test covering the migration, snapshot verification, session scoping, restore reconstruction, browser-role denial, and off-site RPC contract.
- Keep production restoration operator-controlled: P31 adds no automatic destructive database restore endpoint and does not claim paid Supabase PITR/daily-backup guarantees on the Free plan.

### P30 disaster recovery / rollback certification / continuity drills — 2026-10-03
- Add a non-destructive continuity drill that identifies the previous distinct successful production SHA, verifies successful main CI provenance, rebuilds it separately, and certifies scoring, leaderboard, P26, MA3 and MA4 without Pages write permission.
- Add a manual-only guarded rollback workflow requiring the exact 40-character target SHA to be entered twice before any production write can occur.
- Reject rollback targets that are currently deployed, were never successfully deployed, lack successful main push CI evidence, or cannot satisfy the current P26/P27-era production certification contract.
- Rebuild and re-certify the historical target before deployment, then verify the rolled-back live site with quick P3/P26 browser smoke plus three P27 production samples.
- Track the actual deployed rollback target via the workflow run name so P28/P29 deployment correlation does not confuse the rollback workflow's main head SHA with the artifact that is live.
- Trigger P29 after guarded rollbacks and merge normal/rollback deployment history into P28/P29 operational evidence.
- Add dedicated disaster-recovery readiness issue automation for failed non-destructive drills while keeping production reliability incidents under P29.
- Preserve backend/player data structurally: rollback automation contains no Supabase mutation, data reset, scoring-policy rewrite, credential rotation, automatic rollback or chained auto-remediation.
- Retain continuity/rollback evidence for 90 days and add deterministic selection/authorization tests plus permanent CI/release32 enforcement.

### P29 incident runbooks / diagnostics / recovery verification — 2026-10-03
- Add deterministic failure classification for Pages/artifact, CORS, backend health, leaderboard read-path, stale control-plane and unknown production-contract incidents.
- Add dedicated operational runbooks with explicit first-response, non-destructive boundaries and recovery proof for every P29 classification.
- Add an independent three-sample production verification after P28 controls and production deployments, plus a weekly readiness backstop.
- Record recent P27, P28, production deployment and CI timelines, SLO/error-budget state, control-plane freshness and deployment-adjacent correlation without claiming causation.
- Deduplicate diagnostic issue comments by state fingerprint and provide a P29 backstop if a hard condition exists without the expected P28 incident surface.
- Move final automated incident closure from P28 to P29; closure requires a healthy warning-free three-sample probe, two green scheduled P27 checkpoints, no rolling SLO breach, green P28 and deployment state, and fresh monitoring evidence.
- Keep all P29 behavior synthetic and non-remediating: no player/session telemetry, redeploys, credential rotation, Supabase mutation, leaderboard repair, scoring changes or rollback commits.
- Retain P29 operational evidence for 90 days and add permanent CI/release32 contracts plus deterministic diagnostic-core tests.

### P28 production SLOs / alerting / incident automation — 2026-10-02
- Add a 30-day, 99% synthetic scheduled-checkpoint SLO over P27 burn-in history with an explicit error budget and a 12-checkpoint warm-up floor.
- Run a fresh P27 production contract sample before every P28 evaluation and keep GitHub-runner latency diagnostic rather than misrepresenting it as player latency.
- Correlate reliability state with the latest successful production workflow SHA and run.
- Add one deduplicated GitHub incident issue for fresh hard production failures or established rolling-SLO breaches; update it in place instead of creating repeated alerts.
- Require a healthy fresh probe plus two successful scheduled P27 checkpoints before automated incident closure.
- Retain P28 reliability evidence for 90 days while keeping the P27 six-hour sentinel and its read-only permissions unchanged.
- Keep incident automation limited to evidence and issue lifecycle: no automatic redeploys, credential rotation, scoring changes, Supabase mutation, leaderboard repair or player telemetry.
- Add permanent P28 CI/release32 contracts for permissions, SLO policy, recovery gating, deployment correlation and no-player-telemetry boundaries.
### P27 post-release burn-in / production telemetry / operational reliability — 2026-10-02
- Add synthetic-only production probes for the live shell, 32-game asset manifest, versioned service worker, PWA manifest, leaderboard CORS, health, overall ranking and weekly ranking surfaces.
- Record per-probe HTTP status, retry recovery and latency into machine-readable JSON plus a GitHub Actions summary without collecting player/session telemetry.
- Classify runs as healthy/degraded/unhealthy; contract and availability failures are hard failures while GitHub-runner latency excursions remain observational by default.
- Run a read-only scheduled production burn-in every six hours with three samples per checkpoint and 30-day evidence retention.
- Define the initial 72-hour qualification as 12 clean scheduled checkpoints while keeping the same workflow as a continuing low-frequency production sentinel.
- Add P27 to the post-deploy Pages certification chain so every newly deployed release proves the exact live artifact and leaderboard contracts.
- Add a permanent CI contract that forbids browser/session tracking primitives in the P27 probe and preserves P26 gameplay, scoring, policy and compatibility boundaries.

### P26 real-device readiness / long-run balance / production certification — 2026-10-01
- Make certification production-resolved: the `gravity` slot ships Vector Golf and the `astroblaster` slot ships Hex Capture; retired Gravity/Astro sources remain historical regression material rather than being mistaken for shipped engines.
- Replace Vector Golf's hidden historical FLIGHT CONTRACT test marker with a real semantic Aim Guide control and release interrupted drag ownership on blur/backgrounding.
- Expose Hex Capture directional held state/shortcuts, repeat-safe capture semantics and pause/focus cleanup.
- Bound Vector Golf's six-hole native maximum at 32,820, below the deployed gravity-slot 33,000 hard ceiling, without changing AP anchors or policy id.
- Replace Hex Capture's closure-farming economy with bounded per-new-cell chain scoring; conservative whole-board maximum is 64,016, below the reused 65,000 mastery anchor.
- Update P20/P24 browser evidence and P24 static incumbent evidence to exercise the actual production replacement engines.
- Make P25's 32 live paths production-resolved while retaining retired Gravity/Astro envelopes only as historical provenance checks.
- Add P26 long-horizon balance/policy certification, high-DPR landscape/portrait/tablet browser profiles, replacement lifecycle stress, and exact built-artifact provenance checks.
- Certify root and Pages build artifacts before deployment and run a P26 quick smoke against the deployed Pages URL after successful CI.
- Keep physical handset/tablet signoff as an explicit manual boundary rather than mislabeling browser emulation as real hardware evidence.
- Make Vector Golf's Aim Guide and Hex Capture's Capture action retain a 48px physical CSS height even under the legacy ≥640px game-button min-size reset.
- Stabilize the preferred gameplay focus owner for four animation frames after modal close: Type Rush regains its hidden text-entry input while non-text games regain the gameplay stage, avoiding P18/P19 inert-release races without breaking keyboard typing.
- Isolate both the P3–P24 legacy browser regression chain and the P26 high-DPR matrix from the build job so mandatory browser evidence no longer consumes the Pages/artifact job's timeout budget.
- Parallelize P3, P17, P18, P19, P20, P21, P22, P23 and P24 into independent mandatory CI matrix jobs after the combined legacy job proved structurally larger than its timeout budget; preserve every phase's full browser scope.
- Repair historical browser evidence exposed by the parallel matrix: P3 resumes through the modal instead of inert toolbar chrome, P17 handles natural result screens and timer jitter, P18 checks inherited inertness, P21 waits for the authoritative Air Hockey mode remount, and P24 recognizes the matrix CI shape.
- Finish the matrix-discovered control/test repairs: Air Hockey excludes embedded buttons from arena pointer capture so difficulty changes actually fire; P18 waits for live gameplay before treating input as a valid first-run-hint dismissal; P17 pauses live simulation while measuring synthetic overlapping-feedback timers.
- Make the P17 timer-probe cleanup tolerate a legitimately committed Flappy Aero game-over callback: Resume is used while pause still owns the surface, otherwise Play Again restores a clean active session before the remaining feedback checks.
- Preserve compatibility ids, score version, AP anchors, policy id and historical P15-P24 ledgers.

### P25 deep game polish / all-game balance hardening — 2026-10-01
- Preserve the original P25 balance envelopes and the P24 32 S / 0 A / 0 B score ledger; no raw scoring formula is changed.
- Replace the marker-oriented P25 audit with broad progression-domain checks plus 32 explicit live integration paths.
- Tie Laser Blade spawn cadence to authored wave count instead of raw score so precision/combo/multi-cut bonuses cannot secretly accelerate difficulty; retain the bounded 65→50 frame cadence.
- Align Gravity's explicit catch-up cap with the real 50 ms / 60 Hz integrator bound: 3 steps instead of an unreachable nominal 6.
- Certify Type Rush using its real four wave multipliers, all five Vanguard enemy speed caps, all Crosser district traffic bands, repeated Knife/Pac progression cycles, full Final Chaos parameters and coupled Neon Rail pressure.
- Prove Reaction's third identical choice cue is broken across the RNG range and Merge preserves the complete 2/2/4/4/8/16 bag on repeated refills.
- Permanently forbid key pre-P25 formulas such as score-driven Snake speed, uncapped Vanguard boss HP, old Crosser traffic RNG and old Type Rush linear speed.
- Make P25 documentation and the shared balance module permanent release32 requirements, while preserving all hardened P20–P24 contracts.

### P24 definitive 32/32 S-rank certification hardening — 2026-10-01
- Keep the definitive P24 composition ledger frozen at 32 S / 0 A / 0 B; no new rating points are awarded.
- Harden the five original P15 S incumbents, the only provenance group without a later promotion-specific hardening pass.
- Clear Pinball held flippers on focus loss and expose semantic flipper state/shortcuts.
- Prevent Vanguard held-key Nova repeats, clear held keyboard movement on blur and expose Nova bomb/shortcut state.
- Prevent Astro keyboard state mutation while paused/dead, reject repeated Hyperspace activation, clear keyboard/touch ownership on interruption and expose mobile shortcut parity.
- Make Block Drop read live Sound state for keyboard/game-loop actions and expose keyboard shortcuts on touch controls.
- Expose Rhythm lane pressed state and keyboard shortcut parity while preserving its existing blur cleanup.
- Add a 15-session P24 P15-incumbent browser sentinel on top of the canonical 96-session all-roster P19 rerun.
- Require the hardened P20–P23 evidence baselines and current 32-game non-scoring deep-polish continuity in the definitive P24 source gate.
- Preserve immutable P15 history, exact P20–P23 final scorecards, the 55/60 S threshold and all no-replay/no-metagame boundaries.

### P23 B-rank transformation / full S-rank roster hardening — 2026-10-01
- Keep all seven original P23 transformation scorecards frozen; strengthen current behavioral evidence rather than inflating ratings.
- Prevent Type Rush held-letter repeat, modifier shortcuts and IME composition from counting as typing progress.
- Make Perfect Stop Space/Enter discrete so a held key cannot stop a sector and immediately auto-advance its result.
- Harden Reaction circuit input and expose SPEED/CONTROL as actual semantic result-screen controls.
- Reject held-key retriggers for Pulse Groove Path/Sync Wager and Stack Focus/placement decisions.
- Make Laser Rope, Aero Pulse and Stack keyboard-owned actions follow the live Sound preference rather than mount-time state.
- Expose Pulse path/Wager, Laser Redline/Jump/Slide, Aero Flow and Stack Focus through explicit shortcut and active-state semantics.
- Strengthen P23 browser certification around repeat rejection, real transformation-state changes and P18 Resume focus restoration.
- Preserve P16–P22 fairness, timing and identity contracts and the original post-P23 32 S / 0 A / 0 B score state.

### P22 mid-A promotion / identity-preserving depth hardening — 2026-10-01
- Keep all eight P22 S-promotion scorecards frozen; harden the underlying state/input evidence instead of inflating ratings.
- Replace Cyber Crosser's inferred global key/click/pointer route tracking with authoritative direction events emitted only after a move is actually committed.
- Make Crosser's move-acceptance helper pure so rejected/no-op moves cannot mutate P22 District Route state.
- Fix live Sound ownership in Orbit, Neon Rail Shift, Orb Cannon, Knife Target and Cyber Crosser where mount-time listeners could otherwise use stale audio state.
- Reject key-repeat/modifier retriggers for discrete Rail, Slingshot, Matrix, Knife and Crosser actions.
- Expose Serpent steering, Rail Phase/Surge, Slingshot launch, Orb Swap/Burst, Matrix Overclock/Replay, Knife playfield and Crosser directional shortcuts through explicit control semantics.
- Strengthen P22 browser certification around real control state, repeated Matrix O input, rejected/repeated Crosser input and P18 Resume focus restoration.
- Preserve all P16–P21 contracts, P22 balance/resource envelopes, score-only mastery boundaries and individual game identities.

### P21 strong-A promotion / distinctive-depth hardening — 2026-09-30
- Keep the original six P21 promotion scorecards frozen; strengthen current behavior/evidence instead of inflating ratings.
- Clear interrupted held input in Breakout, Tower and Chrono on focus/pointer ownership loss, preventing movement from leaking across Pause/alt-tab/cancel paths.
- Fix Neon Puck Smash keyboard Power Play so it follows the live Sound setting rather than its mount-time closure.
- Cancel One Line interrupted strokes atomically on blur/touch cancellation instead of allowing stale partial geometry to survive into the next interaction.
- Expose Puck difficulty/Power Play, Tower Apex, Pac Hunt Rush, One Line Master Route and Chrono Focus/EMP/rotation through explicit semantic mastery state.
- Strengthen the P21 browser matrix around real Puck difficulty state, One Line blur-cancel behavior, Chrono held-rotation recovery and P18 Resume focus restoration.
- Preserve P16 balance/fairness envelopes, P17 feedback hierarchy, P18 teaching/accessibility, P19 cohesion, P20 flagship contracts and all game-specific identities.

### P20 near-S promotion / flagship-quality hardening — 2026-09-30
- Keep the original six P20 S-promotion scorecards frozen; improve current evidence instead of inflating ratings.
- Fix Dodge keyboard Dash so it follows the live Sound setting rather than the listener's mount-time `soundEnabled` value, and clear held directional input on window blur.
- Clear Cyber Drift held steering on window blur so focus loss cannot leave persistent steering input.
- Expose Gravity polarity/slow-mo/Recall/Boost, Chain tool selection, Drift steering/Nitro, Dodge Dash charges, and Laser Blade phrase state through explicit semantic control state.
- Strengthen the permanent P20 browser gate to exercise real mastery-state transitions, held-input blur recovery, Dodge keyboard Dash charge consumption, and P18 gameplay-focus restoration after Resume.
- Preserve all P16 balance envelopes, P17 feel hierarchy, P18 teaching/accessibility contracts, P19 cohesion, scoring, and game-specific identities.

### P19 arcade cohesion / cross-game UX hardening — 2026-09-30
- Implement the home-screen **M** shortcut that the Sound control already advertised, and expose `aria-keyshortcuts="M"` so home and in-game sound controls share one action contract.
- Make **BACK TO ARCADE** the authored Pause copy instead of rewriting **EXIT TO ARCADE** after render.
- Derive shell sound wording from semantic `aria-pressed` state rather than Lucide SVG classes, keeping the cohesion layer independent of icon implementation details.
- Make stacked app-modal suppression ownership-tracked and reversible so P19 restores pre-existing `aria-hidden`/`inert` state instead of blindly deleting it, including when a connected surface stops being modal.
- Harmonize P18/P19 control names so shortcut metadata lives in `aria-keyshortcuts`, while accessible names stay identical across home/game surfaces.
- Update P19's P18 dependency contract for the high-score-safe Play Again result detector and extend browser certification around exact sound semantics, Resume focus continuity, and modal-stack restoration.

### P18 clarity / teaching / accessibility hardening — 2026-09-30
- Make pause/result dialogs genuinely modal by reversibly inerting toolbar and gameplay sibling subtrees, and redirect programmatic focus escape back into the active dialog.
- Restore focus to the gameplay region after Resume/Play Again so keyboard games do not accidentally re-activate the Pause toolbar control on their next Space/Enter input.
- Add native stateful ARIA semantics for Pause, Sound, Haptics, Fullscreen, Restart, and Back controls; keep Escape shortcut ownership aligned with the actual pause/result state.
- Refresh fullscreen accessible names on native/browser fullscreen changes instead of leaving stale labels on an already-decorated shell.
- Anchor result discovery to the stable Play Again action so new-high-score badges with nested AP-PB text cannot skip P18 dialog semantics or result coaching.
- Restrict first-run hint dismissal to genuine active gameplay input, excluding paused/result controls, editable targets, modifiers, repeats, and IME composition.
- Extend the permanent P18 browser/source gates to certify modal background isolation, forced focus containment, gameplay focus restoration, stateful control semantics, fullscreen-label refresh, and cleanup.

### P17 game-feel runtime hardening — 2026-09-30
- Stop P17's semantic MutationObserver from treating text inside interactive controls as gameplay mastery/warning/failure feedback, preventing static HOLD/BURST-style labels from generating false effects.
- Add an explicit GameShell active-play marker and restrict generic pointer/keyboard feedback to engine-ready, unpaused, unobscured live play; editable text input is ignored.
- Keep gameplay buttons responsive through bounded control acknowledgement without also emitting a generic playfield burst.
- Replace stale timers when pooled burst nodes or semantic/control classes are retriggered, keeping rapid typing/tapping feedback bounded beyond the existing eight-node DOM pool.
- Remove the shared cross-kind sequence token from semantic/stage class cleanup; each feedback class now owns its own timer so overlapping strong/mastery/warning/failure effects cannot leave stale classes behind.
- Scope the P17 static-control browser probe to the synthetic control's own semantic class instead of any global mastery burst, avoiding false failures when a live game such as Orbital Slingshot legitimately emits mastery during the probe window.
- Extend the P17 browser matrix to certify keyboard acknowledgement, editable-input isolation, control/playfield separation and static-control semantic isolation on desktop/full-motion and touch-mobile/reduced-motion profiles.

### P16 difficulty/balance hardening — 2026-09-30
- Guard Laser Rope random direction reversals with the same speed-aware geometric warning floor used for mode changes, preventing an immediate reverse crossing after the beam has just passed the player.
- Make Orb Cannon current/next chamber colors board-aware and reconcile them after every resolved shot, so eliminated colors cannot consume shots against the ceiling-drop clock.
- Replace stale P16 literal checks with executable current-envelope assertions for Stack, Aero, Dodge, Laser Rope, Pulse, Tower, Cyber Crosser and Orb Cannon; later P25 safety tightening remains valid as long as it stays inside the original P16 envelope.
- Add a P16 hardening addendum documenting the current safer Aero envelope and the two corrected fairness gaps.
- Correct the strengthened P16 audit to use its local boolean assertion helper for array comparisons; no gameplay or envelope value changed.

### P15 historical-audit hardening — 2026-09-30
- Keep the original P15 roster document immutable instead of rescoring it after later gameplay hardening; P20–P24 depend on P15 as historical provenance.
- Strengthen `quality:gameplay-p15` with the exact post-P14 baseline SHA and an exact 32-row historical score signature, so scores/grades/ranks cannot be silently rewritten while still satisfying arithmetic checks.
- Certify non-increasing rank totals, the exact 5 S / 20 A / 7 B distribution, canonical top-five/bottom-five summaries, and the original P16 balance handoff/exit decision.
- No gameplay, current P24 score ledger, or historical P15 rating is changed.

### P14 flagship-depth hardening — 2026-09-30
- Make Rhythm's 90 ms hold-release grace measure from the actual release moment instead of the note head, so brief mid-hold keyboard/touch jitter is genuinely forgiven.
- Clear Rhythm lane ownership on window blur, reject suspended/modifier lane presses, and handle pointer cancellation so phantom held lanes cannot auto-complete hold notes.
- Keep Block Drop movement/soft-drop repeat behavior, but make rotate, hard drop, and Hold edge-triggered so held keys cannot act on freshly spawned pieces; soft drop no longer bypasses the 550 ms lock-delay window.
- Make Laser Blade's multi-cut reward truly stroke-bounded: a physical swipe can earn it once, continuous holding cannot manufacture fresh swipe windows, and pause/pointer-cancel ends the stroke.
- Expand `quality:gameplay-p14` plus the Block Drop dedicated gate around release grace, input ownership, lock delay, and one-stroke reward integrity.

### P13 flight-focus-style hardening — 2026-09-30
- Remap Gravity Recall from `R/Escape` to `Q` so the advertised Flight Contract recall action no longer collides with GameShell's global Restart/Pause shortcuts; update in-game and registry teaching accordingly.
- Cancel Gravity aim/steer pointer mutation while suspended and prevent pointer release from launching a queued slingshot behind the pause/game-over overlay; keep A/D repeat steering while making boost/flip/recall/slow-mo discrete.
- Freeze Chrono steering/direct-aim input—including its on-screen steering paddles—while paused/dead and reject repeat/modifier key events so Focus/EMP cannot auto-retrigger from a held key.
- Make Cyber Drift's Nitro keyboard action edge-triggered and modifier-safe while preserving held steering from the initial keydown.
- Extend `quality:gameplay-p13` and the dedicated Drift gate to certify shell-shortcut ownership, suspended pointer state, and discrete mastery actions.
- Align the P18 Gravity clarity profile with the new `Q` Recall binding so first-run/help teaching and registry controls stay identical.

### P12 next-mastery-trio hardening — 2026-09-29
- Stop Gravity Tower from farming Apex mastery on repeated or alternating rebounds across already visited platforms: precision streaks, bonuses, charges, and the later Apex Route now advance only on each platform's first landing.
- Release Laser Rope and Gravity Tower keyboard ownership while paused/dead and ignore repeat/modifier events so held keys cannot auto-spend double jumps, Redline, Apex Drive, or wall-jump/micro-burst actions.
- Guard Chain touch capture and tactical tool selection before suspended/finished-state mutation, keeping pause and between-wave state genuinely frozen.
- Extend `quality:gameplay-p12` to certify unique-platform Apex progression and the trio's input-ownership boundaries.
- Update the dedicated Tower refresh-rate gate to require the stronger pause/game-over/repeat/modifier keyboard guard instead of its obsolete pause-only source marker.

### P11 classic-loop hardening — 2026-09-29
- Make Orbit threat-formation resolution geometry-aware: the certified 1.7-second window remains the minimum, but wide-screen formations now wait for their actual comet travel time plus clearance before awarding the safe-lane mastery bonus, and random hazards stay suppressed through that dynamic window.
- Extend formation cooldown only when geometry makes a formation outlast the original cadence, preserving post-formation breathing room without slowing ordinary compact-screen runs.
- Release Orbit, Pac Runner, and Cyber Serpent keyboard/touch ownership while paused or after game over; ignore repeat/modifier key events so discrete mastery/navigation actions cannot auto-fire or consume shared shell shortcuts.
- Freeze Pac and Snake swipe routing while suspended so queued movement cannot silently change behind pause/game-over overlays.
- Extend `quality:gameplay-p11` to certify viewport-safe Orbit timing and classic-loop input ownership.

### P10 current-bottom-three hardening — 2026-09-29
- Separate Dodge's intentional dash from shield-granted invulnerability so free shield i-frames cannot earn Phase Cuts, recharge dash economy, or preserve a mastery chain; make dash activation edge-triggered instead of key-repeat-driven.
- Release Aero's keyboard ownership while paused/dead and ignore repeated/modifier key events so holding Space cannot auto-flap and post-run shell controls remain available.
- Freeze Orb Cannon aim/keyboard input while suspended, prevent held keys from auto-firing, and make Burst/Swap buttons reflect shot-in-flight availability instead of appearing actionable when the mastery guard will reject them.
- Extend `quality:gameplay-p10` to certify intentional-dash eligibility, discrete action input, suspended aim ownership, and honest Orb agency UI.

### P9 next-bottom-three hardening — 2026-09-29
- Release Stack, Pulse, and Neon Puck Smash keyboard ownership while paused or after game over so their Space/Enter/mastery listeners cannot suppress GameShell post-run actions.
- Preserve the shared Alt+Enter fullscreen shortcut in Stack and Pulse by ignoring modifier-based shell shortcuts before game-specific input handling.
- Freeze Stack/Pulse pointer actions and Air Hockey keyboard/pointer target updates while gameplay is suspended, preventing hidden actions or a stored mallet movement jump on resume.
- Extend `quality:gameplay-p9` to permanently certify those input-ownership boundaries.

### P8 rebalanced-bottom-three hardening — 2026-09-29
- Attribute Breakout power drops to the round that spawned them so a carry-over drop from the previous board cannot satisfy the next round's Power Bank contract; powerups themselves still carry over and remain usable.
- Release Orbital Slingshot's Space/Enter/ArrowUp keyboard ownership after game over so GameShell post-run restart actions are no longer suppressed.
- Extend `quality:gameplay-p8` to certify late-round marked-brick supply, round-scoped Breakout power catches, and Slingshot post-run input ownership.
- Update the dedicated Slingshot determinism gate to require the stronger pause + game-over input guard rather than its obsolete pause-only source marker.

### P7 mastery-trio hardening — 2026-09-29
- Keep Memory Matrix manual/error/timeout replays at the current round's real playback cadence, including Overclock speed, instead of falling back to a fixed 320 ms retry; make the Matrix R replay shortcut consume the event so it cannot also trigger the global shell restart.
- Harden Knife Target Razor Mark placement with dense safety sampling and a deterministic best-clearance fallback, and stop its keyboard listener from consuming post-run Space/Enter shell actions.
- Stop Neon Rail's keyboard listener from consuming post-run shell actions and teach the desktop Shift: Surge control in-game.
- Extend `quality:gameplay-p7` to certify replay cadence, Razor target safety, shortcut isolation, post-run input ownership, and Surge teaching.

### P6 new-bottom-three hardening — 2026-09-29
- Fix Cyber Crosser district difficulty generation: pre-generated road and river lanes now derive movement speed from their own row instead of the player's current max row, so later authored districts no longer inherit opening-area traffic speeds.
- Align the traffic-speed tier changes to authored district starts (rows 4/12/20/28) rather than raw eight-row multiples, preventing mid-district difficulty jumps.
- Extend `quality:gameplay-p6` with representative district-speed escalation checks and a source contract that prevents pre-generation from flattening progression.

### P5 bottom-three hardening — 2026-09-29
- Make Orbit's route HUD follow the player's next consecutive collectible step rather than the number of crystals already spawned, so the named route cannot advance ahead of actual route progress.
- Stop Type Rush's global letter listener from consuming shared shell shortcuts while paused or after game over, and freeze direct word-target selection while gameplay is suspended.
- Extend `quality:gameplay-p5` to permanently certify both interaction contracts.

### P4 experiential gameplay hardening — 2026-09-29
- Restore Chain's tool-role integrity: Tesla arcs are now stopped by nullifiers and strip shield HP instead of directly detonating defensive targets, preserving Plasma as the taught defense-breaking tool.
- Restore One Line's advertised ten-layout variety by giving archetypes 7, 8, and 9 separate authored obstacle/star arrangements instead of sharing one fallback layout.
- Reset One Line's three-attempt budget whenever a fresh procedural stage is generated so failures cannot leak into the next stage or a random reroll.
- Freeze in-progress One Line drawing during pause and prevent pointer release from launching physics behind the pause overlay; extend `quality:gameplay-p4` to guard all three contracts.

### P3 browser/runtime hardening — 2026-09-29
- Make the all-game P3 browser gate require a genuinely mounted lazy game engine rather than merely a visible shared shell, and verify the loading fallback has cleared.
- Require the expected canvas on all 27 canvas-based cabinets, verify restart produces a fresh ready engine session, and verify exiting a game releases the global `game-active` page lock.

### P2 replay-depth hardening — 2026-09-29
- Preserve Memory Matrix playback timing across pause/resume: pending pattern flashes now retain their remaining active-time delay instead of expiring behind the pause overlay and collapsing together after resume.
- Move Type Rush spawn cadence onto active game time so a pause does not consume the hidden wait until the next word or inject an artificial spawn immediately after resume.
- Correct Pac-Runner ghost pathing so ghosts still avoid gratuitous 180° turns at intersections but reverse out of genuine dead ends instead of walking through maze walls.
- Extend the permanent `quality:gameplay-p2` gate to reject the old pause-polling scheduler and require active-time timer preservation.

### Release-candidate reliability pass — 2026-09-08
- Preserve local records when storage is corrupt or temporarily unavailable, validate cached rankings, and report storage/submission state accurately.
- Bound API requests, harden JSON parsing and asynchronous error handling, reject concurrent session replays deterministically, and stabilize tied ranks.
- Isolate modal keyboard actions from game listeners and release canceled gamepad drags and late wake locks.
- Version complete offline caches by build and scope; reject partial downloads and preserve active tabs during updates.
- Fix overlapping phone/tablet header controls and keep Favorites/Recent navigation available on small screens.
- Fix Reaction pause fairness so pre-cue and decoy countdowns freeze while paused and suspended time after a live cue is excluded from measured reaction time; keep both behaviors covered by the permanent P1 gameplay-depth gate.
- Deploy the dedicated Worker/D1 service, configure its Pages build endpoint, and add reproducible failure-path and real service-worker regression tests.

### Added
- Added P19 Arcade Cohesion: one product-level cohesion contract for the arcade home, 32 game cards, shared GameShell toolbar/stage, pause/results, app modals, loading, empty and recovery states without changing any game simulation.
- Added permanent `quality:gameplay-p19` and `quality:browser-p19` certification, including 96 game/profile browser sessions plus home-card, navigation-stress, sound-setting persistence, modal, small-mobile and orientation-recovery checks.
- Added `docs/P19_ARCADE_COHESION_CERTIFICATION.md` with the shared component inventory, product-vs-game identity contract, explicit no-replay/no-retention boundary, manual visual-cohesion protocol and 32-game certification matrix.
- Added P18 Clarity, Teaching & Accessibility Excellence: one explicit clarity profile for every shipped game with a concise objective, essential/secondary controls, canonical mastery terminology, danger/benefit/failure guidance, next-attempt coaching, and non-color visual-redundancy evidence.
- Added structured pause teaching (Objective / Essential / Secondary / Mastery / Watch For), concise result guidance, and selective one-time micro-hints for the 12 games whose core interactions benefit from immediate context without interrupting instant play.
- Added accessible shell control names and shortcuts, modal pause/result semantics with focus containment/restoration, visible keyboard focus treatment, responsive touch-target floors, and a permanent mastery terminology registry.
- Added `quality:gameplay-p18` plus a 96-session `quality:browser-p18` matrix covering all 32 games at desktop, 390px reduced-motion mobile, and 320px reduced-motion small-mobile layouts.
- Added P17 Game Feel & Feedback Excellence: one explicit feel profile for every shipped game, a bounded shared feedback runtime with an eight-node pool, game-specific semantic success/mastery/failure hierarchy, and a permanent `quality:gameplay-p17` certification.
- Added a dedicated P17 browser certification that exercises all 32 games in full-motion desktop and reduced-motion touch-mobile contexts, including input acknowledgement, mastery/failure hierarchy, restart stability, overflow prevention, and exit cleanup.

### Changed
- Normalized shared product geometry, focus rings, touch-target sizing, modal overlays/panels, action hierarchy, card weight and shell chrome while preserving per-game canvas art, palette, HUD, particles, sound and mastery identity.
- Replaced the clickable generic home-brand element with a named native button, normalized pause exit terminology to **Back to Arcade**, and added defensive modal-stack protection so only the top app-level modal remains interactive if overlapping surfaces are ever rendered.
- Preserved all existing favorites, recent-games, statistics, achievements, profile and leaderboard features without expanding them into replay, challenge, currency, unlock, run-history or new retention systems.
- Upgraded pause and result surfaces into compact learning/recovery surfaces while keeping all active gameplay free of persistent tutorial cards; high-speed games receive no new playfield-obscuring teaching UI.
- Added text/shape/position redundancy for P18 teaching so the clarity layer remains understandable with reduced motion, muted audio, or haptics disabled, without claiming full screen-reader playability or WCAG conformance for realtime canvas mechanics.
- Added reduced-motion-safe presentation feedback that preserves state information through contrast and outlines rather than motion-heavy effects, with smaller global feedback for high-speed games so hazards remain readable.
- Preserved all P0–P18 gameplay, scoring, timing, balance, fairness, game-feel, clarity and roster-grade contracts; P19 changes product cohesion only and does not promote letter grades or add gameplay systems.

## 1.1.1 — 2026-08-29

### Added
- Added repository governance and release-hardening files: CODEOWNERS, pull-request validation template, Dependabot maintenance, security disclosure policy, contribution workflow, production release checklist, and the permanent `quality:hardening` audit.

### Changed
- Hardened GitHub Actions with read-only checkout credentials, full-SHA action pinning, stale-CI cancellation, job timeouts, and a Pages deployment chain that builds and deploys the exact `main` commit only after its CI run succeeds.
- Upgraded the GitHub Pages Actions stack to Node-24-generation releases: checkout 7.0.1, configure-pages 6.0.0, upload-pages-artifact 5.0.0, and deploy-pages 5.0.0, each pinned to an immutable commit SHA.
- Regenerated and certified the Bun dependency lock while upgrading `@types/node` to 26.3, `lucide-react` to 1.34, and `motion` to 13.1.
- Upgraded the build toolchain as one compatibility unit to Vite 8.2.2 and `@vitejs/plugin-react` 6.1, with frozen-install, TypeScript, Worker, root build, Pages build, MA3/MA4, and all 32-game regression gates passing before and after merge.
- Kept the 32-game roster, scoring rules, gameplay behavior, Worker runtime behavior, and leaderboard semantics unchanged during the maintenance release.

## 1.1.0 — 2026-08-29

### Added
- Added Neon Rail Shift as the 32nd game: a responsive three-rail reflex runner with certified reachable barrier sequences, safe-lane core guidance, streak scoring, progressive speed, touch/keyboard lane switching, and a cooldown-based Phase shield.
- Added the permanent `quality:release32` gate to enforce exact parity between 32 game modules, 32 lazy registry entries, 32 Worker rules, current release metadata, permanent regression audits, and repository cleanup constraints.

### Changed
- Added a shared `ResizeObserver`-driven canvas coordinate layer and migrated Air Hockey, Astro Blaster, Breakout, Chain, Dodge, Laser Blade, Neon Pinball, Stack, and Gravity Tower to remap live game state across desktop resizing, fullscreen changes, and device orientation changes.
- Replaced Laser Blade's fixed launch velocity with a certified height-aware parabola that places every target apex in the upper 12–32% of mobile and desktop arenas.
- Rebuilt Neon Pinball around fixed 120 Hz substeps, collision separation and cooldowns, finite one-use outlane kickbacks, a five-second one-use ball saver, a genuinely open center drain, exact three-life accounting, multiball-aware drains, and a one-shot game-over callback.
- Replaced Chrono Wave's independent random single-sector gaps with a reachability planner: every wall now has a two-sector opening, consecutive openings move by at most one sector, impact times remain ordered, stage color changes clear old walls and provide a protected transition window, and the first new opening is forced around the player's current position.
- Normalized Chrono Wave movement, spawning, wall contraction, collision crossing, particles, and UI effects to a 60 Hz simulation baseline so high-refresh displays cannot accelerate the game into unavoidable sequences.
- Removed the global plain-`F` fullscreen shortcut so Neon Rhythm Tapper owns all D/F/J/K lane keys; fullscreen remains available from the toolbar and through `Alt+Enter`.
- Rebuilt Cyber Pac-Runner movement around captured WASD/arrow input, immediate mid-corridor reversals, retained direction buffering, a forgiving intersection turn window, tile-center collision stepping, and deterministic tunnel wrapping.
- Added a cross-game mobile runtime layer that tracks the visual viewport, avoids zero-size canvas initialization, caps backing-canvas memory, polyfills rounded canvas rectangles for older mobile browsers, and replaces silent animation-loop crashes with a visible recovery panel.
- Repaired Cyber Drift on mobile with responsive road geometry, live resize remapping, shrink-safe layout, compact touch controls, and pointer-captured steering.
- Upgraded Laser Rope Reflex across Phases A–C with a layered neon arena, multi-layer beams, reactor/player redesign, upgraded HUD, incoming-pattern telegraphs, near-miss/combo/collision feedback, screen effects, dedicated start/pause/game-over presentation, Reflex Grades, and responsive labeled controls while preserving its certified core mechanics.
- Enlarged Cyber Block Drop on desktop with responsive cell sizing and added a standard one-hold-per-piece Hold/Swap system with Hold and Next previews, C/Shift keyboard bindings, and a dedicated mobile Hold control.
- Repaired Knife Target aiming so pointer/touch input captures an exact world-space impact point, the flying knife follows that line, rotating-core collision checks use the same local-angle coordinate system as rendered knives/crystals/shields, and embedded knives appear exactly where the shot lands.
- Reworked Neon Puck Smash around a bounded portrait table instead of stretching the arena to the full canvas: desktop width is capped, tall and short mobile layouts stay inside the rendered stage, HUD/difficulty controls get reserved clearance, game state remaps relative to the table on resize, AI/puck motion scales with arena size, touch dragging uses pointer capture, and puck drag is frame-rate normalized.

## 1.0.0 — 2026-08-28

### Added
- Installable, fully offline-capable PWA shell.
- Persistent Cloudflare guest identity, permanent global rankings, weekly overall ranking, and player profiles.
- Unified gamepad controls and mobile safe-area/wake-lock behavior.
- Root and per-game runtime recovery boundaries.
- Skip navigation, visible keyboard focus, accessible game-card actions, and modal focus trapping.

### Changed
- All 31 game implementations and heavy secondary surfaces are lazy-loaded.
- Vite emits a build manifest and stable vendor chunks.
- The service worker precaches all production chunks, including lazy game modules.
- GitHub Pages deploys the certified Vite `/arcade/` artifact.

### Removed
- Simulated leaderboard competitors and obsolete AI Studio/server scaffolding.
