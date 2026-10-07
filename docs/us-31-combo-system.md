# US-31 — Combo System

Issue #57. Branch `feature/us-31-combo-system`.
Base: clean synchronized main `5adb6d7827618fc8c7361d6ad5edbafcfa4b7ae2`.

## Contract

Only a confirmed nonlethal first Light has outgoing links:

- Light → Light, continuation startup 120 ms.
- Light → Heavy, continuation startup 160 ms.

Maximum depth is two attacks total. Heavy roots and either second attack have no
outgoing links. Global normal definitions are not mutated or duplicated: Light
remains 180/220/300 ms, 10 damage, 100 reach, 180 ms hitstun/45 px knockback;
Heavy remains 300/240/420 ms, 18 damage, 125 reach, 320 ms hitstun/90 px knockback.

`comboDefinitions.ts` contains two typed startup overrides, a small per-fighter
record (`step`, one `bufferedAttack`) and a confirmed-first-Light predicate.
Attack identity/phase/elapsed/hit confirmation remain in the existing attack
runtime. There is no history, generic graph traversal, queue or second lifecycle.

## Input and launch boundaries

Existing keyboard/touch fresh intentions are consumed normally. Light wins
simultaneous Light/Heavy. The P2 semicolon fallback remains unchanged.

The one-slot buffer accepts only after a prior update confirmed the first Light,
while it is still active, grounded and neutral. It never overwrites. Startup,
unconfirmed active and recovery presses are discarded. A press read before hit
confirmation cannot retroactively qualify. Held keys/browser repeats do not
generate fresh edges.

Both attacks resolve in existing P1-first order. At the end of that update an
eligible buffer cancels its first Light and launches the second attack at elapsed
zero. No current-update delta is applied to the new attack. If the first attack
crossed into recovery during the update, the window expires and the slot is
discarded rather than carried later. Large delta never duplicates elapsed time.

Existing active attacks prevent jump. A simultaneous jump/continuation press
therefore remains grounded; an actually airborne attacker cannot continue.
Any hitstun/grounded eligibility loss clears the combo record immediately.

## True combo and range

Prompt in-range continuations can connect before the defender receives an
eligible control update. Production-scene tests at 30/60/120 FPS assert hitstun
at every intervening update start, attempt movement/jump/Light/Heavy throughout,
and check that only knockback moves the defender, with no jump or attack.
The existing US-32 expiry update remains input-locked; it is not shortened or
extended. After a second hit, the existing reaction starts in full.

This is not a guarantee for every press in the remaining active window. Late
inputs can launch after defender recovery or leave enough time for escape.
Such a sequence is an attempted confirmed chain, not necessarily a true combo.
The nominal margins from first-hit confirmation are 60 ms for a Light follow-up
and 20 ms for Heavy, before update-boundary/input delays. Heavy is intentionally
tight; Product Owner timing/feel approval is recorded below. Do not retune.

Existing collision remains authoritative. Light/Heavy grounded maximum center
reach is 172/197 px. The first Light still requests 45 px knockback. At long
initial separation the second attack can miss, even with valid timing. No range
expansion, homing, automatic approach, knockback retuning or opponent pushing.
An already-started second attack finishes normally if it misses. An airborne
defender remains subject to the existing rectangular overlap and vertical physics.

## Cancellation, KO and presentation

US-32 centralized cancellation clears the combo record as well as existing
attack/cue/trail state. P1 connecting before P2 resolution retires P2's attack
and buffer; P1 missing permits P2 normally. No trade/draw redesign.
First-hit KO never unlocks continuation. Any KO, restart or shutdown clears both
records. Ordinary completion resets depth; canceled chains cannot resume.

Jon reuses existing frames. Startup presentation fractions map to the effective
120/160 ms startup. Swing cues retain their definition values (140/240 ms from
launch), so a continuation cue can occur during active rather than startup.
Normal attack cue timings are unchanged. Continuations retire the old trail and
begin with fresh identity, phase and cue eligibility. No new audio/visual assets.
The ~240 px scale, sole anchors, 72×140 hurtbox, attack geometry, world/camera,
movement/jump physics, HUD, arena and US-32 hit/recoil/KO behavior remain intact.
The documented 50–58 px blade/attack-box mismatch remains deferred.

## Validation and review status

Focused runner reuses the production-scene harness: 48 new US-31 cases plus
45 unchanged attack cases, 93 total. Coverage includes both fighters/links,
depth, confirmation, lethal hits, one slot, pre-confirm/held inputs, expiry,
zero-elapsed launch, actual defender control opportunities at three frame rates,
natural misses, interruption, P1 priority, touch/semicolon, presentation and
repeated restart/shutdown cleanup.

Final Node 24.13.0 results: World 10/10, Jump 22/22, Attacks 45/45, Scale 49/49,
US-32 107/107 and US-31 93/93 passed. Production build and `git diff --check`
passed. Existing Vite chunk-size warning is non-blocking. Existing tests have not
been weakened.

Browser smoke checks: desktop and 844×390 landscape render correctly; existing
Jon attack presentation is visible; no captured console warnings/errors after
final reload. Landscape canvas renders at 760×342 CSS px. Fine-pointer browser
testing does not certify real touch-device behavior. Tap-only control automation
did not support closing the spawn gap and exercising live hit-confirm sequences.

Reviewer: APPROVED. Product Owner manual validation: APPROVED.
The Product Owner accepts Light→Light and Light→Heavy feel and timing for the
current scope. Continuation startup is frozen at 120 ms for Light and 160 ms for
Heavy; maximum depth remains two attacks total. Late legal chains may still be
escapable, and natural follow-up whiffs remain possible. The known
artwork/collision mismatch remains deferred. No gameplay retuning or redesign
was performed for final delivery.

No block, air attack, new assets, damage scaling, counter UI, camera/HUD redesign,
mobile-control redesign or later-story mechanics.
