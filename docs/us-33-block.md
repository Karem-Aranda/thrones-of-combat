# US-33 — Defensive Mechanics: Block

Tracking: GitHub #59. Branch: `feature/us-33-block`.
Base: `9d6ed0c` (US-31 merged; US-32 present).
Reviewer Aemon: **APPROVED**.
Product Owner manual gameplay validation: **APPROVED**.
The Product Owner confirmed Block works correctly in gameplay; its current feel
is accepted and frozen for delivery.

Accepted tuning: Light 120 ms / 12 px / 100 px/s; Heavy 200 ms / 24 px /
120 px/s. Zero chip damage, grounded-only eligibility and held Block behavior
are accepted. The automatic-facing rear-hit limitation remains accepted.
Distinct Block audio remains deferred to Game Feel & Audio Polish; final
mobile control redesign remains deferred to US-34.

## Contract

Block is a held intention, not a toggle, buffered action, or persistent
generalized defensive state. Phaser remains authoritative.

| Input | Player 1 | Player 2 |
| --- | --- | --- |
| Held Block | S | Down Arrow |
| Temporary touch center | (520, 500) | (760, 500) |

Phaser captures Down Arrow to prevent browser scrolling. Existing movement,
jump, Light/Heavy bindings and the semicolon fallback are unchanged. Touch
Block uses existing per-pointer ownership, release and reset conventions.

Both fighters' guard eligibility is derived at update start, before movement,
reaction expiry or P1-first contact resolution. It requires a live match,
grounded movement, idle attack, held Block and no hitstun. Held blockstun has
the explicit re-guard exception described below. The cached boolean is only
this update's eligibility snapshot, not an action state.

Eligible Block roots voluntary movement and consumes/discards jump and attack
presses. Releasing it does not fire old presses. Holding it during an existing
attack does not cancel that attack or its legitimate combo progression.
Airborne, attacking, hitstunned and defeated fighters cannot newly guard.
Hitstun expiry does not grant guard during that same update.

## Contact, reactions and combos

Direction is evaluated at contact using current world positions and facing:
an attacker on the left requires left-facing guard; one on the right requires
right-facing guard. Equal centers require opposite attacker/defender facing.
Existing automatic facing and crossing behavior are not modified.

| Blocked attack | Damage | Blockstun | Pushback | Velocity |
| --- | --- | --- | --- | --- |
| Light | 0 | 120 ms | 12 px | 100 px/s |
| Heavy | 0 | 200 ms | 24 px | 120 px/s |

`blockDefinitions.ts` owns these frozen values and the guard helpers. Blockstun
uses the existing independent reaction model and delta-driven reaction
advancement, with direction captured away from the attacker at contact.
The new reaction starts with its full timer, without consuming prior frame
time. Movement/jump/attacks stay locked throughout the expiry update.

Releasing Block ends protection immediately but does not cancel blockstun.
Continuing to hold permits frontal re-guard, including the blockstun expiry
update. Another valid block starts a full reaction. A damaging contact while
exposed replaces blockstun with normal hitstun.

World bounds (fighter centers 36–2364), maximum separation 1080 and proportional
movement resolution remain unchanged. Reaction displacement clips to remaining
time; world/separation-blocked distance is discarded, never accumulated.
There is no vertical pushback or attacker recoil/stun/recovery modification.

The existing `attackHasHit` consumes any contact. Separate per-attack
`combo.damageConfirmed` records only damaging nonlethal confirmation. A blocked
root Light cannot unlock a continuation; the same attack cannot subsequently
damage after guard release. True combos still beat newly held Block during
hitstun. A legitimately late continuation can be blocked, retains its second
attack timing, and ends the sequence normally. Both guard snapshots precede
sequential P1-first attacks; no trade or draw redesign is included.

Blocked contacts bypass damage entirely: no chip damage (including at 1 HP),
ordinary hit VFX, Jon recoil, normal hit sound or KO sound. Invalid guard uses
unchanged damage/KO handling. Swing cues and audio unlock rules are unchanged.

## Presentation and lifecycle

Jon reuses the existing guard pose. Both fighters have a small front-edge
6×58 px Phaser indicator, normally alpha 0.55, emphasized at alpha 1 for 90 ms
after blocked contact. It follows current facing and the fighter container.
No secondary visual pushback is added; reaction motion cannot select walking.
Approved ~240 px presentation and foot anchors remain unchanged.

Keyboard release, touch release/out/cancel, focus/visibility input reset,
portrait lock, KO, restart and shutdown clear guard intention/presentation as
appropriate. Phaser routes native touch cancellation through pointer-up/out;
those existing handlers and the explicit cancel handler release pointer
ownership. Input resets do not cancel a live reaction timer. KO/restart/shutdown
reset reactions. Existing scene lifecycle owns cleanup and rebinding.

## Validation and approval

Node 24 commands:

```sh
node scripts/test-us-26-world.mjs
node scripts/test-us-29-jump.mjs
node scripts/test-us-30-attacks.mjs
node scripts/test-fighter-visual-scale.mjs
node scripts/test-us-32-reactions.mjs
node scripts/test-us-31-combos.mjs
node scripts/test-us-33-block.mjs
npm run build
git diff --check
```

Production-path Block tests use the complete scene and real Phaser keys and
rectangle intersections, with renderer/browser/audio services doubled. They
cover both fighters/attacks, 1 HP, direction/equal centers/crossing, eligibility,
input priority, reaction expiry, re-guard/release, pushback at 30/60/120 FPS,
world/separation constraints, combo interaction, P1-first ordering, touch reset,
presentation suppression and repeated restart/shutdown cleanup. Existing suite
assertions remain intact; the touch layout count increases from 10 to 12 with
the same bounds and non-overlap checks.

Final Node v24.13.0 results: World 10/10, Jump 22/22, Attacks 45/45,
Scale 49/49, Reactions 107/107, Combos 93/93, Block 114/114 (69 new Block
cases plus 45 shared attack regressions). Production build (TypeScript + Vite)
and `git diff --check` passed. No assertions were removed or relaxed.

Browser smoke: arena/HUD rendering, Jon jump and attack presentation, and
844×390 landscape canvas fit; no captured browser warnings/errors. This is not
real-device multi-touch or sustained two-player Block validation.

Product Owner manual gameplay validation is APPROVED and confirms that Block
works correctly in gameplay. The current Block feel is accepted; no additional
gameplay or presentation tuning is part of final delivery. Reviewer Aemon has
approved the implementation. The browser smoke observations above remain
distinct from the Product Owner's manual gameplay approval.

Automatic facing makes natural rear hits uncommon; this is accepted for US-33.
No parry, chip, guard meter/break, guard cancel, new assets/animations, Block
audio, AI, new combo routes or camera/HUD/mobile-control redesign is included.
Distinct Block audio is deferred to Game Feel & Audio Polish; final mobile
control design remains US-34 work. Existing Vite large-chunk warning remains
non-blocking and outside this story.
