# US-26 — World, Camera & Scrolling Arena Foundation

Tracking issue: #52. Implementation remains uncommitted for Reviewer inspection.

## World and camera

The logical viewport remains 1280×720 with the existing Phaser FIT scale mode.
The finite world is 2400×720. Fighter centers stay within x=36…2364, accounting
for the unchanged 72-pixel body width. Ground contact remains y=560.

Spawns are x=820 and x=1580, preserving the former on-screen positions of 260
and 1020 at the initial camera scrollX=560. Restart creates these positions and
explicitly reapplies camera bounds, zoom=1, and scrollY=0.

The camera targets the midpoint of both world-space fighter centers. Horizontal
scroll is bounded to 0…1120. An exponential response of 8 per second smooths
tracking using delta; a visibility clamp prevents smoothing lag from hiding a
fighter. The desired presentation margin is 80 pixels per fighter center, with
world-edge bounds taking precedence near either end.

The maximum center separation is 1080 pixels, a tuning value. Both intended
movement steps are calculated at the existing 300 px/s, clamped to world bounds,
then resolved together. Only movement that increases excessive separation is
reduced, proportionally when both players move outward. A stationary opponent
is not displaced. Crossing and inward movement remain allowed in either order.

## Coordinate ownership and regression protection

Fighters, attack/hurt geometry, the Longclaw trail, contact slash, flecks, and
physical arena layers use world coordinates. HUD, result text, touch buttons,
restart, and snowfall remain screen-pinned. React and CSS are unchanged.

Combat phase progression, hit detection, damage, winner determination, facing,
equal-x behavior, audio, presentation timing, and fighter construction remain
unchanged. Their source methods were compared against the base commit. Health
remains 100, damage remains 10, attack timing remains 180/220/300 ms, and the
existing update order still determines simultaneous lethal-hit ordering.
Existing scene shutdown/input/audio cleanup remains in place; no new listeners
or timers were added. Camera state is recomputed in create() on every restart.

## Approved expanded arena integration

The four approved final exports are imported verbatim into src/assets/arena.
Their SHA-256 hashes match the Designer's final export package. No PNG was
edited, stretched, tiled, duplicated, or re-encoded. The original Phase 3
arena files remain on disk, but BootScene loads only the four wide replacements.
The temporary outer-world rectangles and original arena loads are removed.

All images retain their native dimensions. Positions below are texture
top-left bounds, not the Phaser image anchor:

| Layer | Top-left x/y | Origin | Depth | Scroll factor x/y |
| --- | --- | --- | ---: | --- |
| Sky | -160 / 0 | 0.5 / 0 | -4 | 0 / 0 |
| Distance | -220 / 170 | 0.5 / 0 | -3 | 0.25 / 1 |
| Architecture | 0 / 40 | 0 / 1 | -2 | 1 / 1 |
| Courtyard | 0 / 540 | 0 / 0 | -1 | 1 / 1 |

Sky is centered in the viewport and remains stationary. Distance is centered
at the initial scrollX=560; its Phaser anchor is x=780. Architecture uses a
bottom origin at y=560, so its 520-pixel height places its top at y=40. The
courtyard's measured 20-pixel transparent inset puts the start of paving at
y=540+20=560; its lower edge reaches y=720. Architecture and paving share
world-rate scrolling. Gameplay grounding and fighter visual anchors are unchanged.

### Camera coverage

For a layer with left bound x, width w, and horizontal scroll factor f, its
screen interval is [x-f*scrollX, x+w-f*scrollX]. Required width is at least
1280+f*1120. The chosen sky/distance widths satisfy this without scaling.

| Camera scrollX | Sky screen interval | Distance screen interval | Architecture / courtyard interval |
| ---: | --- | --- | --- |
| 0 — left bound | -160…1440 | -220…1780 | 0…2400 |
| 280 — left region | -160…1440 | -290…1710 | -280…2120 |
| 560 — center | -160…1440 | -360…1640 | -560…1840 |
| 840 — right region | -160…1440 | -430…1570 | -840…1560 |
| 1120 — right bound | -160…1440 | -500…1500 | -1120…1280 |

Coverage was checked numerically at all 1121 integer camera offsets. Offline
native-layer composites at the five positions above were also inspected:
no uncovered viewport pixels, artificial repeats, missing paving, or black
gate opening. The gate moves naturally from partly right/outside frame to
center to partly left/outside frame; it is not screen-pinned.

### Transparency and readability

The gate opening and distance silhouette retain real alpha; the sky is opaque.
The courtyard's first 20 rows are fully transparent, with no fully transparent
pixels below them. Its supplied paving is slightly translucent; this was
preserved rather than changing approved artwork. The fully composed views are
opaque. Standard Phaser texture handling is used, without alpha workarounds.

No conspicuous halo, dark seam, or colored fringe was seen in the inspected
center browser view or downscaled regional composites. Native source roofline
edges retain subtle cool-colored pixels; fractional scrolling/filtering should
still be checked during Product Owner play. Static Jon guard overlays remained
legible in all five regional composites, including the darker side recesses.
Trail/contact readability during real scrolled combat remains a manual check.

## Texture measurements

US-25 fighter optimization is unchanged. Measurements are from the actual
repository PNGs, using width × height × 4 for RGBA-equivalent decoding.

| Final arena texture | Dimensions | Encoded bytes | Approx. decoded RGBA |
| --- | --- | ---: | ---: |
| northward-sky-wide.png | 1600×720 | 1,251,599 | 4.395 MiB |
| northward-distance-wide.png | 2000×450 | 1,178,329 | 3.433 MiB |
| northward-architecture-wide.png | 2400×520 | 1,577,891 | 4.761 MiB |
| northward-courtyard-wide.png | 2400×180 | 816,705 | 1.648 MiB |
| Total | — | 4,824,524 | 14.236 MiB |

This matches the approved production report. Jon's 22 optimized textures remain
14.646 MiB decoded; Jon plus the new arena totals approximately 28.883 MiB.
HUD, renderer/GPU copies, browser overhead, and mipmaps are excluded. The four
old textures are not imported/preloaded or emitted in the production bundle.
Readiness/FPS was not benchmarked; these are measurements, not memory guarantees.

## Validation

Using Node 24.13.0:

- node scripts/test-us-26-world.mjs — 9 tests passed.
- npm run build — passed; existing non-blocking Vite large-chunk warning.
- git diff --check — passed.

The focused tests cover full-width world bounds, stationary-opponent safety,
symmetry, crossing, long movement steps, 300 px/s at 30/60/120 fps, midpoint
initialization, exponential static-target response, and camera body visibility.
Source comparison confirmed 24 existing methods and 14 gameplay constants
were unchanged, normalizing ARENA_WIDTH/HEIGHT to VIEWPORT_WIDTH/HEIGHT for
screen-space methods. P1-then-P2 attack advancement ordering is unchanged.
The approved world helper and nine-test file were hash-checked before/after
asset integration and are unchanged by this pass. No extra listeners or timers
were introduced. Each create() makes exactly four scene-owned arena images;
the existing Phaser scene lifecycle removes them on restart.

Browser inspection covered the final rendered spawn state at scrollX=560,
desktop layout measurements at 1280×800, and short landscape 844×390. At
844×390 the canvas occupied 608×342 at (118,24); page dimensions remained
844×390 with no overflow. Arena, ground, both fighters, and both pinned HUD
identities rendered. Captured browser console errors/warnings were empty.
Native J/L key taps were exercised, but the available browser controls do not
support reliable sustained holds or coarse-pointer/multi-touch emulation.
Full scrolled combat, both victories, repeated match/restart cycles, and real
touch operation are not claimed as runtime-verified. Source/lifecycle inspection
is not a substitute for those checks. A final clean browser reload succeeded
after one temporary approval timeout; no console errors/warnings were captured.

Development preview: http://127.0.0.1:5174/ (Node 24 Vite server).

## Remaining Reviewer / Product Owner manual checks

1. Move both fighters through the left region and camera left bound.
2. Move both fighters through the center.
3. Move both fighters through the right region and camera right bound.
4. Test maximum separation, stationary-opponent behavior, and camera smoothness.
5. Cross fighters in both directions and confirm facing.
6. Attack in left/center/right regions; verify 10-point hits, misses, and one hit
   per attack.
7. Inspect attack trail, contact slash, and flecks while camera is scrolled.
8. Complete P1 victory and inspect pinned HUD/result.
9. Complete P2 victory, including Jon KO presentation.
10. Restart and repeat; verify camera, layers, positions, health, attacks, VFX,
    and input reset without duplicates.
11. Inspect desktop composition, transparency, edges, and ground while moving.
12. Inspect real mobile landscape/touch behavior, pinned buttons, restart,
    portrait handling, and page overflow.

US-27 responsive changes, jumping, second fighter art, expanded attacks,
combos, stun/knockback, block, and Mobile Controls 2.0 remain outside US-26.
