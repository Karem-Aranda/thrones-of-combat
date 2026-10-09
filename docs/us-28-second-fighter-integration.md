# US-28 — Lyra second fighter integration

Implementation for local review and Product Owner testing. No delivery authorization,
commit, push, PR or merge is included. Jon remains P1; Lyra replaces P2's
magenta placeholder. Lyra's future Arya-inspired identity revision is out of scope.

## Approved package and provenance

Source: `US-28-Lyra-24-Textures-Final-QA-2026-10-08.zip` from the approved
`us28-lyra-final-qa-cleaned-2026-10-08` delivery. The package manifest,
technical contract, inventory and final QA report were read before integration.
The complete extracted package passed its SHA-256 checks. The 24 runtime PNGs
are byte-identical to the final cleaned delivery; no repainting, regeneration,
compression, resizing, alpha thresholding, trimming or registration changes occurred.

`src/assets/fighters/lyra-frames/metadata/` retains the source manifest, contract,
inventory, QA report and whole-package checksum list. The checksum list describes
the original package paths (including previews not imported here); the focused
test verifies its `textures/` entries against the runtime PNGs. These metadata
files are audit evidence, not runtime textures. Their historical pending-approval
wording is superseded by the current explicit implementation authorization.

## Small presentation-only integration

- BootScene uses the existing Vite URL/glob pattern. Each filename stem is its
  exact documented Phaser key: `lyra-guard`, three additional idle poses, six
  movement poses, eight attack poses, Rising, Falling, two hit poses and two KO poses.
- `fighterVisuals.ts` holds character-specific texture sequences, origins, scales
  and reaction presentation preferences. It contains no gameplay dimensions or rules.
- The existing scene image-selection loop now operates on either fighter's
  independent presentation state. There is no roster, selection system, new
  animation manager, physics body, input listener or React-owned gameplay state.
- Jon retains his original sequences, 240-logical-pixel scale, measured per-frame
  sole origins, idle/movement clocks, 30/60/90 ms hit presentation and 400 ms KO timeline.
- Lyra uses **190 logical pixels** in the standing Guard reference, uniformly
  scaled by `190 / 259 = 0.7335907335907336`. All 24 canvases remain 512×512.
  Root `(256,448)` becomes origin `(0.5,0.875)`. The image sits at local `(0,70)`
  inside the unchanged fighter-center container; its root follows authoritative
  `footY` (560 when grounded). No review-sheet airborne lift is added.
- Facing flips only the image around its centered X origin. Neither container
  scale, position, hurtbox nor attack area is mirrored/scaled by artwork.
- Lyra idle follows Guard/2/3/4/3/2, at the existing 300 ms pose interval.
  Movement uses 1–6 at 100 ms per pose, reversed for retreat. Actual displacement,
  not a held key at a boundary or knockback, determines locomotion playback.
- Light/Heavy and combo continuations share the approved attack artwork.
  Startup uses two equal portions; active/recovery use three equal portions of
  their existing authoritative phase clocks. Jon's existing active weights remain intact.
- Rising/Falling are held from existing physics state. Block uses Guard.
  Confirmed nonlethal hits use Contact/Recoil in equal halves of the existing
  attack's hitstun (180 ms Light / 320 ms Heavy). The first contact frame does not
  consume the preceding update's elapsed time. No hit picture is selected on a miss/block.
- Lyra KO uses Collapse followed by Hold within the existing 400 ms presentation
  timeline (Hold from 330 ms), and continues after the match input lock. Both
  fighters get fresh presentation records through the existing scene restart.
- Current display identities (US-36) are **ALARIC DUSKBANE** for P1 and
  **LYRA THORNVALE** for P2, with **ALARIC DUSKBANE WINS** and
  **LYRA THORNVALE WINS** results. Historical Jon/Lyra artwork identifiers and
  provenance remain unchanged. HUD layout, mirrored health mapping and internal
  `playerOne`/`playerTwo`/winner identifiers remain unchanged.

## Gameplay invariants

No changes to the world, attack, combo, hit-reaction, block, touch-control, camera,
React or CSS modules. Both hurtboxes remain **72×140**. World 2400×720, spawns
820/1580, maximum separation 1080, movement 300 px/s, ground 560, gravity 1800,
jump velocity −650 and existing adaptive camera/viewport remain authoritative.

Light remains 180/220/300 ms, 10 damage, 100 reach; Heavy remains 300/240/420 ms,
18 damage, 125 reach. Grounded eligibility, single-hit consumption, phase carry,
confirmed two-step combo buffering, interruption, directional contact, Block,
blockstun, hitstun/knockback, deterministic P1-first resolution, winner lock,
passive post-match landing and restart are unchanged. Jon-only swing/trail,
shared hit/KO audio and VFX, ambience lifecycle, Northward Gate and Bastion Panels
are unchanged. Presentation reads state; it never decides hits or damage.

## Validation

Use Node 24, then:

```sh
npm run build
node --test scripts/test-us-26-world.mjs scripts/test-us-29-jump.mjs \
  scripts/test-us-30-attacks.mjs scripts/test-fighter-visual-scale.mjs \
  scripts/test-us-32-reactions.mjs scripts/test-us-31-combos.mjs \
  scripts/test-us-33-block.mjs scripts/test-us-28-visuals.mjs
git diff --check
```

The focused asset/build test checks `dist/assets`, so build first on a fresh checkout.
Existing test harnesses now load the presentation metadata and address per-fighter
visual fields, without weakening combat assertions. The former P2-placeholder
scale assertions now check Lyra's independent origin/scale and real unchanged
collision limits. Focused US-28 coverage adds 21 checks; its harness import also
runs the 45 attack regressions.

Final local results with Node 24.13.0: **506/506 test executions passed** across
all eight suites (including imported shared attack tests), production TypeScript
and Vite build passed, and `git diff --check` passed. No blocking source errors.

Browser smoke checks actually performed in the Codex browser: desktop 1280×800,
both identities/images and ground roots, P2 movement/retreat, Rising/Falling,
crossing/flipping, Light damage of 10 in both directions, Heavy damage of 18 in
both directions (including semicolon), Guard blocking without damage, out-of-range
miss, both victories, Lyra KO hold, completed-match restart, camera scrolling,
left world edge, and 844×390 / 896×430 landscape FIT. No captured console warning/error.
These are browser smoke checks, not Product Owner approval or physical-device QA.

## Payload and performance

Lyra adds **1,400,834 B** compressed PNGs (1.336 MiB) and **24 MiB** decoded RGBA8.
The loaded 51 PNGs (22 Jon + 24 Lyra + 4 arena + 1 HUD) total **9,797,293 B**
compressed and approximately **53.54 MiB** decoded RGBA8. These are file/dimension
estimates, not measured GPU allocation: they exclude copies, driver overhead,
mipmaps and other runtime resources. No previews, atlas or spritesheets are loaded.
One Phaser Image per fighter changes textures; no per-frame display objects are created.
The existing Vite >500 kB JavaScript chunk warning remains non-blocking.

## Accepted asset warnings and remaining review

- Painted frame-to-frame hair/cloth/face variation and the movement 6→1 seam can
  shimmer. Recovery 2→3 raises the crown about 32.3 logical pixels, followed by
  about 6.6 pixels into Guard. No automatic repaint or timing adjustment is made.
- The fine sword point depends on background contrast, filtering and device pixel
  ratio. Cleaned QA intentionally preserves 815 faint edge-adjacent fragments;
  it does not claim zero detached pixels. No obvious halo was seen in desktop
  smoke checks, but physical-device filtering needs Product Owner inspection.
- The unchanged Light endpoint is +136 and Heavy +161 from fighter root.
  Active2/3 artwork reaches about +148.92: ~12.92 beyond Light / ~12.08 short of
  Heavy. Active1 reaches ~138.65. Do not alter combat reach to match the artwork.
- Lyra's visible body is 190 pixels high while her authoritative hurtbox remains
  140 high. Jon's existing larger-body and 50–58 px blade/attack-band mismatch
  remains unchanged. These are presentation/balance review risks, not hidden fixes.
- At the extreme left bound, parts of Lyra's wide stance/art extend past the
  viewport and clip, although the full authoritative hurtbox remains in-world.
  This was observed in the browser; do not change world bounds for artwork here.
- KO handguard may extend eight source pixels below the registered body ground
  line. It remains untrimmed, as approved. No new landing/victory art is invented.
- Physical mobile multi-touch, safe-area/portrait transitions, DPR-specific blade
  readability and extended sessions still require user testing. No US-34 work.

## Product Owner manual steps

1. Start Vite (`npm run dev`), click the canvas, inspect both identities, size
   hierarchy (Jon 240 / Lyra 190), transparency, foot contact and idle loops.
2. P1 A/D and P2 Left/Right: walk/retreat, cross both ways, stop at world edges,
   and reach maximum separation. Judge clipping and the movement-loop seam.
3. W / Up: steer in air, inspect Rising→Falling around apex, landing and HUD
   clearance. Confirm grounded-only attacks and no additional jump lift.
4. J/K and L/semicolon: inspect all attack phases on both sides, fine sword tips,
   equal Light/Heavy artwork and abrupt recovery. Confirm 10/18 damage on actual
   contact and zero on misses; do not judge damage by illustrated sword reach.
5. Hold S / Down facing the attacker: verify Guard, zero damage, existing
   blockstun/push. Turn away and repeat to confirm normal directional damage.
6. Confirm Light→Light/Heavy combos, buffering limits and interruption on hits.
   Watch Lyra Contact/Recoil and resynchronization to current state after stun.
7. Win once with each fighter; inspect defeated holds, locked input and passive
   airborne landing. Press R only after completion; check full health, spawns,
   facing and repeated cycles with no duplicated sound/listeners.
8. On physical mobile landscape, use both players' simultaneous touch actions,
   jump/attack/Block and touch restart. Rotate portrait/back, test safe areas and
   device-specific texture filtering. Verify unchanged HUD/camera/arena/VFX/audio.

Awaiting Aemon's read-only review and Product Owner testing. No Git delivery.
