# US-30 — Expanded Attack System

Issue: #56. Branch: `feature/us-30-expanded-attack-system`.
Base: `c921d2c`, synchronized main containing the merged US-29 PR #64.

## Definitions and runtime

`src/game/combat/attackDefinitions.ts` owns a small readonly definition table,
attack IDs, the existing four attack phases, clean per-fighter defaults, fresh
input arbitration, and phase-relative presentation mapping. CombatScene retains
one shared lifecycle for both fighters and both attacks. Attack identity
(`currentAttack`) is separate from `attackState`; idle has no selected identity.

| Value | Light | Heavy |
| --- | ---: | ---: |
| Startup | 180 ms | 300 ms |
| Active | 220 ms | 240 ms |
| Recovery | 300 ms | 420 ms |
| Damage | 10 | 18 |
| Outward attack-area width/reach | 100 px | 125 px |
| Attack-area height | 70 px | 70 px |
| Jon swing cue, relative to startup entry | 140 ms | 240 ms |

Light exactly retains its original definition. Heavy is conservative initial
tuning, not final balance. Reach measures outward extension from the unchanged
72 px body edge: the area begins 36 px from the fighter center and extends to
136 px for Light or 161 px for Heavy. Heavy's area is 25% wider; hurtboxes remain
72×140. Visualization and collision share the selected definition dimensions
and facing-positioned local offset. They follow current container world X/Y.

Both attacks retain startup → active → recovery → idle, carrying excess frame
time across phase boundaries. Each can hit at most once; misses preserve hit
eligibility. Damage comes from the selected definition and health clamps at zero.
P1 attack progression remains first, preserving simultaneous-lethal ordering.
Adding a simple grounded attack requires data/input/presentation mapping, not a
copied state machine. No generalized combat engine was introduced.

## Input and eligibility

- P1: A/D movement, W jump, **J Light**, **K Heavy**.
- P2: Left/Right movement, Up jump, **L Light**, **semicolon Heavy**.
- Light wins if both fresh attack intentions arrive in the same update; Heavy
  is consumed and discarded.
- Either attack requires an active match, grounded fighter, and idle attack phase.
- Presses during startup/active/recovery are discarded; they cannot replace,
  restart, cancel, chain, or queue an attack.
- Airborne presses are discarded, including a press on the update that lands.
  No landing buffer or air attacks. Simultaneous jump/attack takes jump priority.
- Jump cannot launch while an attack is in progress.

Phaser key down edges are latched until the next input read so short taps survive
keyup. Repeat events are ignored. Both keyboard and touch edges are consumed
before combining them, preventing a keyboard press from leaving historical
touch input pending. Pending attacks clear on blur, visibility change, shutdown,
and create/restart. Keyboard listeners are removed on shutdown and rebound once.

P2 Heavy retains Phaser's numeric SEMICOLON binding (186) and additionally
listens to the scene keyboard plugin's native `keydown` event for `key === ';'`.
This character fallback supports layouts/browsers that report another numeric
code, such as Shift+Comma (188) or 59. It latches the same pending Heavy boolean,
ignores repeats/composition, and is removed on shutdown. The two routes coalesce
into one intention; neither queues attacks nor creates another Heavy lifecycle.

## Minimal temporary touch affordance

The original eight combat buttons retain their positions and sizes. Existing
attack buttons become labelled LIGHT; two labelled HEAVY buttons sit above them.
No joystick or cluster redesign is included.

Baseline 1280×720 logical coordinates:

| Player | Action | Center X/Y | Size |
| --- | --- | --- | --- |
| P1 | Left | 100 / 630 | 100×100 |
| P1 | Right | 218 / 630 | 100×100 |
| P1 | Light | 368 / 630 | 112×112 |
| P1 | Heavy | 368 / 500 | 112×112 |
| P1 | Jump | 520 / 630 | 100×100 |
| P2 | Jump | 760 / 630 | 100×100 |
| P2 | Light | 912 / 630 | 112×112 |
| P2 | Heavy | 912 / 500 | 112×112 |
| P2 | Left | 1062 / 630 | 100×100 |
| P2 | Right | 1180 / 630 | 100×100 |

Heavy/Light have an 18 px vertical gap. Existing right-cluster viewport anchoring
and safe-area cluster/bottom translation are reused for both rows. Pointer up,
outside release, blur/visibility cleanup, portrait hiding, and completed-match
restart presentation use the existing lifecycle. Automated production layout
checks cover all ten controls at widths 1280/1558/1600 with zero and representative
82 px side / 39 px bottom safe insets. Real-device usability still needs approval.

## Presentation, audio and VFX

Heavy reuses Jon's existing attack artwork. Phase progress maps to the existing
Light pose boundaries, so Heavy follows its own gameplay duration without new
textures or asset distortion. Light presentation boundaries stay unchanged.

Existing Jon swing audio is reused: Light stays at 140 ms; Heavy's definition
uses 240 ms in its longer startup. Locked due cues are consumed, never queued;
unlock before the due threshold permits the current cue. Gameplay never waits
for audio. The existing trail follows entry to the selected active phase rather
than a fixed Light time. Hit/KO sounds and VFX are unchanged; no new system added.

## Victory, landing and restart

Winner state locks steering, new Light/Heavy, jumps and damage. Existing airborne
fighters still settle through US-29 passive vertical integration. KO presentation
can finish; restart stays available. Scene create rebuilds clean attack identity,
phase, elapsed time and hit guard for each fighter; pending Light/Heavy intentions
are cleared. No stale Heavy press or duplicate listener survives restart.

Preserved contracts: world 2400×720; floor 560; spawns 820/1580; separation 1080;
speed 300; gravity 1800; jump -650; 100 HP; horizontal fixed-Y/zoom-1 camera;
US-27 parent-driven 1280–1600×720 viewport and responsive/safe-area behavior.
Arena, HUD, existing KO, VFX and audio assets/mix are unchanged.

## Validation and limitations

Use Node 24:

```bash
node scripts/test-us-26-world.mjs
node scripts/test-us-29-jump.mjs
node scripts/test-us-30-attacks.mjs
npm run build
git diff --check
```

Final results with Node 24.13.0: world suite **10/10 PASS**, US-29 suite
**22/22 PASS**, US-30 suite **45/45 PASS**, production build/TypeScript **PASS**,
and `git diff --check` **PASS**. The existing Vite chunk warning is non-blocking.

US-29 test doubles were adapted to the split Light/Heavy intention fields; its
22 existing assertions remain. The US-30 suite exercises production scene
create/update/shutdown/restart, actual Phaser key behavior and rectangular
intersection, with browser/renderer/audio services doubled. It covers definitions,
timing, one-hit guards, damage, directional reach, airborne/landing-frame rejection,
priority, repeats/short taps, no buffering, simultaneous-lethal ordering, passive
landing, restart, presentation cues, touch cleanup/layout and portrait recovery.

Browser checks observed J/K attacks for Jon and L/semicolon attacks for P2,
including the wider Heavy active-area presentation, misses with unchanged bars,
and landscape/portrait/landscape sizing without overflow or console errors.
These are desktop-browser observations, not real-device touch or listening tests.
Product Owner still needs held-input play, both damage/range comparisons, air/
crossing/edge play, full victory/airborne-KO/restart cycles and real touch checks.

Known limitations: reused Heavy art/sound rather than final Heavy assets; temporary
touch controls overlay the arena; initial Heavy tuning; existing Vite chunk-size
warning and separate mobile ambience concern. No combos, buffering, cancels,
hitstun, knockback, block, AI, air attacks, US-28 artwork or US-34 redesign.

Keep this implementation uncommitted for Reviewer inspection.

## Product Owner validation correction

The source-confirmed defect was a numeric-keyCode assumption: Phaser's registered
Key routing looks up `event.keyCode`, so binding only 186 misses a semicolon
produced with another code. Earlier tests directly called the already-selected
Key object and bypassed this lookup. The updated harness runs the real Phaser
KeyboardPlugin queue through production scene input/update. Before the correction,
the original 38 tests passed while the two new 188/59 routing regressions failed.
After the correction, these pass alongside repeat/release, route coalescing,
non-semicolon/composition rejection, and restart/shutdown cleanup checks.
The Product Owner's exact browser/layout event has not yet been captured; 188/59
are verified reproductions of the portability defect, not a claimed recording
of that device.

No attack values or presentation tuning changed. Light lasts 700 ms; Heavy lasts
960 ms. Heavy's startup/recovery are each 120 ms longer, its active phase is only
20 ms longer, its damage is 18 versus 10, and its reach is 125 versus 100 px.
Phase-relative artwork normalization stretches the existing poses to Heavy's
actual phases; it does not shorten Heavy to Light's duration. A production
timeline regression checks phases and pose selection at 180/300/400/540/700/960 ms.
Existing cue regressions confirm swings at 140/240 ms and trails at active entry
(180/300 ms). Reused eight-frame art, swing sound, trail and hit feedback constrain
visual differentiation. Broader combat feel remains later-story work; no retuning
was authorized or performed.

Correction validation: Node 24.13.0, world **10/10**, jump **22/22**, attacks
**45/45**, production build/TypeScript and diff check pass. Desktop in-app browser
observed J Light, K Heavy, L Light and semicolon Heavy, including narrower/wider
active areas, with no captured console warnings/errors. Layout-specific inputs
and held-key behavior were exercised through Phaser's real queue in automated
tests, not through the Product Owner's physical keyboard. Product Owner must
retest semicolon on the original device/layout (tap, hold, release/repress, restart)
and judge Light/Heavy differentiation in normal play. This does not claim Product
Owner approval.
