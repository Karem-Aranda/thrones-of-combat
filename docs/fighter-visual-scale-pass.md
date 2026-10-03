# Fighter visual scale pass — approved Phase 4 visual baseline

Branch: `feature/fighter-visual-scale-pass`.
Base: clean synchronized `main` at `4012bcc` (US-30 merged).
This is presentation only, not an approved combat-geometry rebalance.

## Implementation

The Product Owner approved the desktop and mobile-landscape presentation, and the
Reviewer approved the final micro-review.

240 px standing presentation height is the approved Phase 4 visual baseline for illustrated fighters.

Presentation scale remains independent from authoritative gameplay geometry.
P2's current magenta placeholder is not the final fighter-size reference.

`CombatScene` uses one centralized presentation rule:
`JON_CANVAS_HEIGHT_FRACTION = 1 / 3`, with `JON_VISUAL_HEIGHT` derived from the
fixed 720 px logical canvas height. This gives 240 logical px on desktop and
33.3% of usable FIT canvas height on mobile, within the requested 30–35% range.
Actual mobile DOM bounds were checked before deciding that no extra mobile
multiplier, device detection, resize listener or camera change was needed.

Uniform image scale changes from `420 / 1201 = 0.3497085762` to
`720 / 1201 = 0.5995004163`, accounting for the existing one-third-size textures:
+71.43% versus the historical 140 px, or +33.33% versus the 180 px experiment.
The guard head-to-sole landmarks span approximately 240 logical px.
Other poses retain their own natural crouch/collapse height, not a forced 240 px
bounding box. No source assets were changed or generated. US-28 Second Fighter
Complete Integration should use this baseline for the second illustrated fighter,
allowing character-specific proportional adjustments.

The image remains at local y=70 in its unscaled gameplay container. Existing
per-frame sole origins and centered horizontal origin are unchanged. Every
frame has the same uniform scale. The image sole remains attached to the
authoritative foot position (560 grounded, existing rising/falling position
airborne). Facing flips only the image. KO/hit origins retain their measured
baselines and restart rebuilds the same presentation.

## Preserved authority

- Hurtbox: 72×140; P2 placeholder unchanged at 72×140.
- Light: 180/220/300 ms, 10 damage, 100 px reach, 140 ms swing cue.
- Heavy: 300/240/420 ms, 18 damage, 125 px reach, 240 ms swing cue.
- Controls, semicolon fallback, grounded-only/single-hit/no-buffer attacks unchanged.
- Movement: 300 px/s; gravity: 1800 px/s²; jump velocity: -650 px/s.
- World: 2400×720; floor: 560; spawns: 820/1580; maximum separation: 1080.
- Camera remains horizontal, fixed Y, zoom 1; adaptive viewport remains 1280–1600×720.
- Arena, HUD, touch layout, audio, VFX, victory, passive landing and restart unchanged.

## Visual mismatches for Product Owner / Planner review

Do not treat the larger silhouette as collision geometry. The strongest extended
attack frame (`attack-a-2.png`) has a far-right blade segment at texture rows
156–169 (opaque alpha >=128), with its existing sole at source y=1285. At the new
scale, that blade lies about 155.5–163.3 logical px above the foot; the authoritative
attack box starts 105 px above the foot. Thus the visible steel sits approximately
50–58 px above the top of the attack area. Its tip reaches about 111.2 px forward
of the body center, still short of the unchanged Light/Heavy outer edges at
136/161 px. No collision geometry or pose offset was changed to conceal this.

The illustrated body/cloak/feet can overhang the 72 px body and world-edge clamps.
The image canvas is approximately 228.4 px wide while the hurtbox is 72 px; real
edge/crossing play must judge clipping/visual contact. P2 remains only 140 px high,
so its comparison with 240 px Jon is now intentionally misleading as a final
fighter-size standard. US-28 owns final P2 presentation using the approved baseline.

## Validation

Use Node 24:

```bash
node scripts/test-us-26-world.mjs
node scripts/test-us-29-jump.mjs
node scripts/test-us-30-attacks.mjs
node scripts/test-fighter-visual-scale.mjs
npm run build
git diff --check
```

The focused scale script reuses the existing production-scene harness: its
45 attack regressions plus four scale/FIT/anchor/restart tests run (49 total).
The harness now records scale/origin calls; no gameplay implementation is copied.
Coverage verifies the 240 px desktop reference, mobile 30–35% canvas share,
P2/body/reach preservation, all
22 frame sole origins, airborne foot attachment, analytic apex head/HUD clearance,
unchanged camera zoom/Y, and restart presentation.

Node 24.13.0 results: world 10/10 PASS, jump 22/22 PASS, attacks 45/45 PASS;
focused scale runner 49/49 PASS (45 existing plus four presentation tests). Production
TypeScript/Vite build and `git diff --check` PASS.

Browser observations: idle, jump and return to ground, J Light and K Heavy
presentation, including the unchanged attack-area rectangles. No
console warnings/errors captured. Logical canvas sizes 1280/1558/1600×720 were
verified through DOM bounds (240 logical/CSS px at all three desktop sizes).
At 844×390, FIT produces a 760×342 canvas: the 240 px reference appears approximately
114 CSS px tall, up from 85.5 CSS px at 180 logical px. At 932×430, the canvas is
approximately 848.88×382 CSS px and Jon is approximately 127.33 CSS px tall.
Both layouts have no document overflow and keep the same 33.3% height share.
CSS fighter heights are calculated from the measured canvas FIT ratio and tested
head/sole landmarks, not an independent pixel-perfect silhouette measurement.
Desktop and short-landscape compositions show stronger Jon presence and
clear HUD separation at spawn. The sampled jump remains below the HUD. With
unchanged gravity/velocity, the analytic apex footY is about 442.64; a 240 px guard
head lies at y=202.64, leaving about 66.64 logical px below the HUD bottom at y=136.
That figure concerns the standing head reference, not all sword/fur extremities
or device-specific safe-area offsets. Product Owner manual inspection approved the
final presentation.

Browser tooling supports tap input but not sustained key holds or coarse-pointer
emulation. Long walking, retreat, crossing, both extreme world edges, maximum
separation, full victory/KO/restart cycles, actual touch overlays/restart controls,
P2 attack visual playback, and real-device portrait rotation were not verified by
the browser tooling. The attempted P2 tap was not visually confirmed in the sampled
frames; automated tests verify its attack behavior.
Touch capability remains false in this browser, so real touch-overlay clearance
is not verified. Source layout puts Heavy controls at y=500 (444–556), overlapping
the fighters' lower vertical band; at the 1600-wide spawn layout Jon's screen X
is 420 and the P1 Heavy button is at X=368. The enlarged silhouette may therefore
sit behind that control. This tooling limitation and composition risk remain
documented; Product Owner approval does not authorize changes to the touch layout
or gameplay in this pass. Automated
world/jump/combat tests and source inspection cover the unchanged behavior;
Product Owner manual inspection and Reviewer approval establish the final baseline.

Asset loading is unchanged (22 fighter PNGs, unchanged source dimensions and
bytes, no new textures). GPU texture memory is unchanged; more screen pixels are
drawn but no performance benchmark or zero-cost rendering claim is made.
The existing Vite chunk-size warning remains non-blocking. The known approximately
50–58 px vertical blade/attack-box mismatch remains documented for later
combat-alignment consideration; attack geometry remains unchanged.

No later Phase 4 mechanic is included.
