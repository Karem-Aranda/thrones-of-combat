# US-21 — The Northward Gate arena foundation

## Scope and asset provenance

The prototype background, ground rectangle, and `FIGHTING ARENA` label are
replaced by four static, original Northern gate arena layers. The approved
design-study image was **not** used as a runtime texture. These production
layers were generated with the built-in imagegen tool for this story, then
resized from 1672 × 941 to the game's 1280 × 720 design space. The gate and
distance layers received focused painterly/alpha-edge revisions. They use
original northern stone, mountains, pines, snow, and overcast sky; no
Stark/HBO heraldry or approved-until-later banner mark appears.

| Back-to-front layer | Asset | Format / size |
| --- | --- | ---: |
| Sky | `src/assets/arena/northward-sky.png` | RGB PNG, 1,046,888 bytes |
| Mountains, valley, pines, static haze | `src/assets/arena/northward-distance.png` | RGBA PNG, 718,277 bytes |
| Gate, walls, keep roofs | `src/assets/arena/northward-architecture.png` | RGBA PNG, 925,404 bytes |
| Level snowy stone courtyard | `src/assets/arena/northward-courtyard.png` | RGBA PNG, 544,230 bytes |

All four runtime textures are 1280 × 720; total disk weight is 3,234,799
bytes (about 3.09 MiB). Resized PNG was selected to retain clean transparency
at the gate opening, roofs, mountain ridge, and courtyard edge without adding
a new WebP encoding dependency or asset-pipeline refactor. This is a scoped
runtime-size preparation, not the US-25 optimization pass. The existing fighter
assets remain unchanged.

The generation prompt set requested separate wide 2D painterly layers:

- Sky: only muted blue-grey overcast clouds and diffuse cold daylight.
- Distance: only snowy mountains, a central valley, pine line, and baked haze,
  with transparent sky and lower edge.
- Architecture: a monumental centered *open* stone arch with transparent
  passage, flanking defensive walls/towers, mid-value masonry and no banners.
- Courtyard: a level, straight-topped snow-dusted stone fighting surface with
  no stairs, props, or snowbanks rising above the fighter baseline.

The revisions specifically lightened/simplified the gate masonry and reduced
bright cyan alpha fringes on the distant ridge. Fine edge details still need
inspection in the running game at actual display scale.

## Phaser placement and gameplay authority

`BootScene` preloads exactly these four images. `CombatScene` draws them once
at fixed depths −4 through −1, behind the unchanged fighters and HUD. There
is no parallax, animated door, runtime lighting, snow particle, or listener.
Sky and distance use origin `(0, 0)` at `(0, 0)`. The architecture's measured
bottom wall line is source `y=579`, so it is offset by `560 − 579 = −19` pixels.
The courtyard's solid top surface begins at source `y=536`, so it is offset
by `560 − 536 = +24` pixels. Both meet the existing gameplay ground top
`GROUND_Y − GROUND_HEIGHT / 2 = 560`. No foreground artwork draws over the
fighters' feet or KO pose.

The only change to fighter positioning code is reusing that same computed
ground-top constant. Gameplay world positions, full traversable width, fighter
scale, collision boxes, movement, controls, facing, 180/220/300 ms attack
phases, one-hit rule, 10 damage, health, victory ordering, match lock,
hit/KO presentation, and completed-only restart remain authoritative and
unchanged. P2 is still the placeholder.

The central arch remains visible in the 1280 × 720 composition; side walls may
crop on mobile landscape under the existing Phaser FIT scaling. US-21 does not
change that scaling or the known short-viewport height overflow (US-25).

## Validation and Reviewer/User manual checks

- `npm run build` passes TypeScript and Vite. The shell's Node 20.11.1 version
  warning and the pre-existing large JavaScript chunk warning are non-blocking.
- `git diff --check` passes. Source diff inspection confirms no changes to
  combat methods, timings, hit geometry, or restart logic.
- Asset metadata inspection confirms four 1280 × 720 textures, transparent
  upper corners on the three RGBA layers, an open gate with the valley visible
  behind it, and the measured court/wall alignment.
- The local dev server starts using the available Node 24 runtime. Browser
  inspection could not be performed during implementation because the Mac was
  locked and no browser surface was available; no console-error claim or User
  manual-validation claim is made here.

Manual validation is still needed for the complete arena composite, gate and
valley visibility, Jon/Longclaw and P2 readability across the full width
(especially over gateposts versus the bright opening), standing/moving/attack/
hit/KO grounding, both victory paths, repeated restart, and mobile-landscape
composition. The courtyard and architecture have painterly/generated-detail
differences, and a small amount of edge fringing may remain visible at some
scales; these should be judged in the actual browser. No US-22+ work is included.
