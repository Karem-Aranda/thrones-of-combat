# US-32 — Hitstun, Knockback & Combat Feel

Tracking issue: #58. Implementation branch: `feature/us-32-hitstun-knockback`.
Base: synchronized main at `2642d0ad14d008259575c282214fde220bde8af0`.

## Authoritative reaction contract

Each fighter owns an independent reaction record: `neutral | hitstun`, remaining
milliseconds and signed horizontal knockback velocity. The pure `hitReaction.ts`
helper initializes and advances it; Phaser's update cycle owns application.
There are no authoritative reaction tweens or delayed callbacks.

| Attack | Hitstun | Unobstructed distance | Constant velocity |
| --- | --- | --- | --- |
| Light | 180 ms | 45 px | 250 px/s |
| Heavy | 320 ms | 90 px | 281.25 px/s |

On a confirmed nonlethal hit, existing damage/feedback runs, the defender's
attack is canceled, and a full-duration reaction starts. Elapsed time from before
hit confirmation is not deducted. Direction is captured away from the attacker
once; equal centers use the connecting attack's facing. Displacement is velocity
times `min(delta, remainingMs)` in seconds. Partial final frames cannot overshoot.

The existing joint movement resolver receives voluntary or reaction displacement
for each fighter. Center bounds remain 36–2364 and maximum separation remains
1080. Crossing is allowed. Blocked distance is discarded, not saved; timers still
expire in full. Stationary opponents are not pushed automatically. Simultaneous
outward motion retains the existing proportional sharing policy. Camera/facing
updates use the resulting authoritative world positions.

## Input, interruption and priority

Input continues to be read and consumed, including touch intentions and the P2
semicolon fallback. A fighter stunned at update start cannot voluntarily move,
jump or attack that update, including the expiry frame. Held movement can resume
on the next eligible update. Jump/Light/Heavy presses during stun are discarded;
a fresh eligible press is required. The touch cluster is not disabled/reset.

One cancellation path resets attack identity, phase, elapsed time and hit guard,
hides the active area, retires Jon's unplayed swing cue/trail and resets canceled
attack presentation. Interrupted idle/startup/active/recovery cannot resume or
emit delayed cues. Damage already applied is not reversed.

Sequential P1-first authority is intentional: P1's confirmed nonlethal hit
immediately cancels P2's unresolved attack in that update. P1 missing allows P2
to resolve normally. Existing lethal priority is preserved; no trades/draws.

## Airborne, KO and lifecycle

Grounded-only attack eligibility is unchanged. An airborne defender can be hit
when existing rectangles overlap. Horizontal steering/input is locked, while
vertical velocity, gravity and exact landing continue unchanged. Landing can
leave a fighter grounded but still stunned. No vertical launch is added.

Lethality is handled before normal reaction initialization. Match completion
clears both fighters' reactions and attacks and preserves KO, HUD/results and
passive airborne landing. Restart/shutdown retire reaction velocity, interrupted
attacks, trail and cue eligibility. New fighters initialize neutral.

## Presentation and preserved baseline

Jon's existing contact/recoil/return presentation remains approximately
30/60/90 ms. After it finishes, remaining hitstun uses guard, not walking.
Knockback moves the fighter container, not a local image offset. Approved
approximately 240 px presentation, scale 0.5995004163, frame-specific sole origins
and local foot offset 70 are unchanged.

Light remains 180/220/300 ms, 10 damage, 100 px reach, 140 ms swing cue.
Heavy remains 300/240/420 ms, 18 damage, 125 px reach, 240 ms swing cue.
Hurtboxes remain 72×140 and attack height remains 70. Movement remains 300 px/s,
gravity 1800 px/s², jump velocity -650 px/s and ground footY 560. World 2400×720,
spawns 820/1580, adaptive viewport 1280–1600×720, horizontal camera/zoom 1,
arena, HUD, controls, assets, VFX and audio mix are unchanged.

Deferred combat/art alignment: the approved enlarged blade is approximately
50–58 px vertically above the existing attack rectangle; horizontal collision
reach also extends beyond the measured blade tip. US-32 does not rebalance either.
No combos, buffering, cancel windows, block, new animations/assets or camera work.

## Validation

Node 24.13.0:

- World: 10/10 passed.
- Jump: 22/22 passed.
- Attacks: 45/45 passed; complete definition assertions extended, not weakened.
- Visual scale: 49/49 passed.
- US-32: 62 new tests passed. Its reused attack harness also runs the existing
  45 attack tests, producing 107/107 total.
- Production build passed; existing Vite large-chunk warning remains non-blocking.
- `git diff --check` passed.

Focused tests cover full-duration starts, partial expiry, 30/60/120 FPS,
both directions, interruption of every phase, fresh/held input, semicolon/touch
intentions, edge/separation constraints, proportional sharing, crossing,
airborne reactions/landing, P1 priority/misses, KO, restart/shutdown and Jon's
presentation/anchors. Test harnesses execute the actual CombatScene with doubles;
they do not substitute for real-device gameplay or visual-feel approval.

Browser smoke inspection: desktop 1328×768 and landscape 844×390 render arena,
fighters and HUD; Jon jump and attack presentation is visible. Landscape canvas
is 1600×720 logical / 760×342 CSS. No captured console warnings/errors.
The browser reports a fine pointer, so this is viewport validation, not a real
touch-device test. Available tap-only input did not support closing the spawn
gap reliably. The subsequent Product Owner manual validation approved US-32
with an overall result of 10/10.

### Product Owner validation checklist

1. P1 Light → P2.
2. P1 Heavy → P2.
3. P2 Light → P1.
4. P2 Heavy → P1.
5. Interrupt startup.
6. Interrupt active.
7. Interrupt recovery.
8. Knockback near both world edges.
9. Knockback near maximum separation.
10. Hit an airborne opponent.
11. Land while stunned.
12. Victory/KO, including passive landing.
13. Restart after either winner; no stale attack/reaction/audio cue.
14. Desktop camera tracking during knockback.
15. Real mobile-landscape touch gameplay during reactions.

### Final approval

Reviewer: APPROVED. Product Owner manual feel/tuning validation: APPROVED — 10/10.
Light's 180 ms / 45 px hitstun/knockback tuning is approved. Heavy's 320 ms / 90 px
tuning is approved and feels materially distinct from Light. Interruption and
recovery behavior were manually accepted. No retuning was requested or performed.
The known attack-art/collision mismatch remains explicitly deferred as described
above; this approval does not change combat geometry.
