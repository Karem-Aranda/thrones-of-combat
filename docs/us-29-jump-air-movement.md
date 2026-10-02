# US-29 — Jump & Air Movement Foundation

Issue: #55. Implementation branch: `feature/us-29-jump-air-movement`.
Base: `2d85736`, synchronized main containing merged US-26 and US-27.

## Authoritative movement

Each existing Phaser-owned Fighter now owns a small `VerticalMovement` record:
`footY`, `velocityY`, and `movementState` (`grounded`, `rising`, `falling`). This is
separate from the existing idle/startup/active/recovery attack state. Pure helpers
in `combatWorld.ts` create/reset the record and integrate its vertical motion.

The floor remains `600 - 80 / 2 = 560`. The fighter container's center is always
`footY - FIGHTER_HEIGHT / 2`, retaining the existing 140 px body and artwork anchor.
Artwork, placeholder body, facing marker, and attack-area display children move
with the container. Existing world-space hurtbox/attack calculations already
read container X/Y and are unchanged.

Initial tuning:

- Gravity: **1800 logical px/s²**.
- Jump launch velocity: **−650 logical px/s**.
- Approximate apex height: **117.36 px** above the floor.
- Approximate full flight: **722.22 ms**.

Constant gravity is integrated with `y += v * dt + gravity * dt² / 2`, followed by
`v += gravity * dt`, using elapsed seconds. No tween, launch timer, physics engine,
or frame-count-based movement is added. Descending floor contact clamps the feet
exactly to 560, clears velocity, and returns to grounded. Invalid/negative delta
does not advance motion; long frames can safely complete a jump and land.

Both fighters retain the existing 300 px/s horizontal intentions, world bounds,
1080 maximum separation, crossing, and X-derived facing while airborne. Camera
tracking stays horizontal, vertically fixed, midpoint-based, bounded, and zoom 1.
The US-27 adaptive parent-driven viewport and screen-space UI remain unchanged.

## Eligibility and input

- P1: A/D movement, **W jump**, J attack.
- P2: Left/Right movement, **Up jump**, L attack.
- A jump launches only from grounded while the current attack state is idle.
- Rising/falling jump presses and presses during an attack are consumed and
  rejected, not saved for landing or attack completion.
- Basic attacks may start only while grounded. If jump and attack are pressed
  together while idle, jump takes precedence; no airborne attack starts.
- A grounded attack can still hit a low airborne opponent if the unchanged
  world-space attack rectangle overlaps its current hurtbox.

Jump keyboard down edges survive short taps until the next input read, then are
consumed once. Browser key-repeat events are ignored. Jump listeners are removed
on scene shutdown; pending edges clear on blur, visibility change, and create/
restart. This is an input edge latch, not combat buffering or a held-to-repeat jump.

Two temporary up-chevron jump buttons occupy the existing touch row's unused
inner space: P1 at baseline X=520, P2 at X=760. The original six controls retain
their original positions, sizes, and behavior. Existing safe-area cluster
translation, multi-pointer handling, presentation switching, and cleanup are
reused. Touch jump down edges enter the same `jumpPressed` intention as keyboard;
pending touch jumps clear with the existing control reset lifecycle. No joystick
or US-34 layout redesign is introduced.

## Restart and presentation limitations

Scene restart constructs independent grounded records for both fighters, with
velocity 0 and feet at 560. World spawns remain 820 / 1580 at all viewport widths.
Pending keyboard and touch jump input is cleared rather than carried into the
new match.

No new jump assets/animations are included. Jon uses his existing static guard
in air (existing hit/KO presentation can still override it); P2 remains the
placeholder. Initial jump values are discovery tuning, not final balance.
Gameplay input locks when the match completes: no horizontal steering, new jump,
attack, or damage is permitted. Both fighters' existing airborne trajectories
continue passive vertical integration through the same authoritative helper,
with jump intention forced off. Rising transitions to falling and settles
naturally at feet 560 / grounded / velocity 0, with container Y synchronized.
Winner state, facing and horizontal positions remain locked. Existing post-match
KO/VFX presentation and restart remain available.

## Validation

Node 24 commands:

```bash
node scripts/test-us-26-world.mjs
node scripts/test-us-29-jump.mjs
npm run build
git diff --check
```

- Existing world suite: **10/10 PASS**.
- New pure movement suite: **15/15 PASS**, covering launch, states, apex, exact
  landing, rising/falling re-press rejection, 100 repeated jumps, frame-rate
  independence at 30/60/120 fps, air steering, bounds, separation, crossing,
  default/restart records, fixed spawns, and long/invalid frames.
- Completed-match scene-path regressions: **7/7 PASS**; combined US-29 suite:
  **22/22 PASS**. These execute production `CombatScene.update()` and passive
  settling with renderer/presentation stubs, not duplicated physics arithmetic.
  Both fighters settle as winner or loser; keyboard/touch steering, jump and
  attack remain locked; final winner/health remain authoritative; keyboard/touch
  restart remains available. The Reviewer's 504 / rising / -470 reproduction
  reaches exactly 560 / grounded / 0 after two seconds of completed-match updates.
  This targeted fix has automated scene-path validation only; no new browser or
  real-device post-match landing validation is claimed.
- Additional source-method probes passed: jump input consumption/reset/repeat
  filtering, shared touch intentions, scene Y synchronization, attack eligibility,
  grounded hits versus elevated hurtboxes, and airborne facing.
- Touch layout calculations passed for all eight buttons at widths 1280/1558/1600
  with zero and representative notched insets: no overlap or safe-area overflow.
- Build/TypeScript and diff checks passed. Existing Vite large-chunk warning remains.

Browser-assisted checks observed both W/Up jumps, landing, repeated jump taps,
and 1280×720 / 844×390 / 390×844 → landscape rendering. No console errors were
captured. These are desktop-browser checks, not real-mobile validation. The
available automation cannot sustain held keys or emulate real multi-touch/
notch behavior, so full air steering, crossing, boundaries, combat victory,
restart, and touch playthroughs remain Product Owner manual checks.

No air attacks, double jump, vertical camera, dynamic zoom, new artwork, audio
changes, or US-28/US-30+ mechanics are included. Mobile ambience remains separate
future audio work. Implementation must remain uncommitted for Reviewer inspection.
