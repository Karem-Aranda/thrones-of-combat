# US-18 — First Fighter Visual Integration

## Asset and provenance

`src/assets/fighters/jon-snow-guard.png` is a single AI-generated static RGBA
image prepared with the built-in imagegen tool from the approved written
direction. No TV screenshot, actor photo, commercial sprite sheet, or scraped
artwork was used. The referenced Designer mockups/specification were not present
in this repository; this integration uses the direction supplied in the task.
Reviewer/User still need to judge visual fidelity to those references.

Jon Snow represents the Standard / Medium category. The asset depicts a
right-facing raised guard, northern fur, charcoal layered clothing, leather,
weathered steel, a restrained cloak, and Longclaw with a wolf-style pommel.
It is one static pose, not an animation sheet. P2 remains the placeholder.

Source dimensions: 1145 × 1374 pixels, 1,191,588 bytes. Alpha ranges from 0 to
255 with transparent surrounding padding. A targeted imagegen cleanup pass
addressed pale outline debris. Preserve this PNG's alpha when preparing later
derivatives. Asset size optimization is not implemented here; decoded RGBA
texture memory is approximately 6 MiB.

## Loading and rendering

BootScene imports the asset through Vite and loads it as `jon-snow-guard` before
entering CombatScene. Vite includes the PNG as a hashed production asset.

P1 receives a Phaser Image inside its existing container. P2 retains its
rectangle. The image is purely presentation: combat still uses the unchanged
72 × 140 body geometry, movement, attack areas, and timing. No gameplay state
was moved to React. The temporary P1 facing marker is hidden because the art
makes orientation visible; both existing active-phase attack areas remain.

## Anchor, scale, and facing

The source head landmark is y=128; the sole baseline is y=1329. These measured
asset coordinates are separate from gameplay dimensions. Uniform scale is
`140 / (1329 - 128)`. Origin is `(0.5, 1329 / 1374)` and local image y is
`FIGHTER_HEIGHT / 2`, keeping the sole baseline at the existing ground top,
world y=560. Neither container position nor vertical gameplay anchor changes.

`setFlipX` changes only P1's image. Its horizontal origin is centered, so flipping
does not move the image bounds or ground anchor. Phaser's installed Canvas and
WebGL image transform implementations support this flip. The container, name,
hurtbox geometry, and attack area are not flipped. Existing `setFacing` continues
to position directional attack geometry independently.

Illustrated sword/cloak/feet are not collision geometry. Their silhouette can
extend beyond the logical body, including near arena edges. The static raised
blade is not a depiction of the authoritative active hit area. US-19 owns
animation and timing-correlated poses.

## Validation and remaining manual checks

- TypeScript/Vite build and whitespace checks pass; existing chunk warning remains.
- Ten authoritative gameplay methods match `main` exactly.
- Focused tests use real Phaser keyboard/collision/flip components with mocked
  rendering. Both controls, timing, misses, exact 10 damage, both wins/locks,
  and six alternating restart cycles pass. Anchor mathematics also passes.
- Browser smoke checks show Jon loaded, grounded, and transparent without console
  warnings/errors at desktop and landscape viewport sizes.
- Width-based FIT scaling is unchanged. At 844 × 390, the existing layout's
  canvas is 796 × 447.75: it exceeds viewport height. Height-fit/safe-area work
  remains US-25; this story does not change CSS or scaling configuration.

Still manually verify held-key movement, crossing/left-right art fidelity,
visual overhang at both boundaries, J/L gameplay, range/misses, both victories,
and repeated R cycles in the real browser. Inspect edges and material readability
on actual mobile-landscape devices; tiny pommel/facial details are naturally
less readable at that scale. Repeated render-object cleanup is supported by
Phaser lifecycle inspection and mocked tests, not a full browser-cycle test.

## Imagegen prompts

Initial generation (transparent background):

> Use case: stylized-concept. Asset type: ONE transparent static fighter PNG for Phaser browser fighting game, not a mockup or spritesheet. Primary request: Jon Snow, Standard/Medium fighter, original grounded painterly illustrated 2D interpretation recognizable through northern/Stark clothing and Longclaw rather than duplicating any actor. Full body, facing screen RIGHT in a raised combat guard, feet planted at same baseline, side/three-quarter fighting-game view. Compact fur mantle; charcoal layered combat clothing; worn leather; weathered steel; short restrained cloak; dark shoulder-length hair. Hold Longclaw raised in guard, readable straight blade with simplified wolf-pommel treatment. Compact silhouette, no sweeping cape, no other props. Entire figure and sword fully contained in canvas with transparent padding. Neutral soft top/front lighting with restrained edge highlights so dark clothes read against dark blue arena. High-quality painterly illustrated 2D, clear readable large shapes at 140px character height, no pixel art, no 3D, no photo/actor likeness. Transparent background with clean antialiased alpha edges, NO ground plane, NO shadow on background, NO snow, NO text, NO labels, NO frame, NO UI. One static image only. Center the grounded body with both soles on a shared baseline; sword should not extend far beyond the compact guard silhouette. This is the US-18 static asset pipeline proof only, no animation.

Final targeted edit (transparent background; generated image as edit target):

> Edit target: attached Jon Snow static guard game asset. Change ONLY alpha-edge cleanliness: remove stray detached pale pixels, white halos and white ragged fringe around the sword and character outline. Preserve the same character, original illustrative face (not actor duplication), exact raised sword guard, charcoal northern/Stark clothing, fur, leather, cloak, wolf pommel, full-body proportions, colors, details and facing RIGHT. Genuinely transparent background, no background shadow, no checkerboard painted into image. Clean tight antialiased silhouette, no white matte residue; fine fur/hair edges should retain their own dark/gray material colors. Both boots firmly on one shared horizontal baseline. Full figure and sword not cropped. One static transparent PNG, no animation or additional design.
