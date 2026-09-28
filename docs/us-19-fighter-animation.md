# US-19 — Fighter Animation Foundation

## Scope and asset provenance

Jon Snow (P1) now has presentation-only idle, movement, and basic-attack poses.
P2 remains the Phase 2 rectangle. The artwork is generated with the built-in
imagegen tool from the original, approved US-18 Jon illustration
(`src/assets/fighters/jon-snow-guard.png`). It is an original northern/Stark
interpretation, not an actor likeness or copied TV/game/fan artwork. Draft
contact sheets were rejected because sword/feet crossed cell boundaries; the
runtime uses individual transparent PNGs instead. No original US-18 asset was
replaced.

The 17 new files are under `src/assets/fighters/jon-snow-frames/`:

| State | Files | Unique frames |
| --- | --- | ---: |
| Idle | `idle-2.png` through `idle-4.png`, plus the US-18 guard | 4 |
| Movement | `move-1.png` through `move-6.png` | 6 |
| Basic attack | `attack-s-1/2.png`, `attack-a-1/2/3.png`, `attack-r-1/2/3.png` | 8 |

New asset size is 19,856,433 bytes in total (about 19 MiB), with individual
PNGs between 1,062,100 and 1,231,590 bytes. Together with the existing
1,191,588-byte guard, all 18 source textures are about 21.0 MB on disk. All
are RGBA with transparent corners. Most canvases are 1145 × 1374 pixels;
`move-3.png` is 1146 × 1373. Uncompressed source-pixel data for the 18 images
is roughly 113 MB before browser/renderer overhead; this deserves attention
in the later performance pass, particularly on mobile. No asset resizing was
added to this foundation.

## Rendering and authority

`BootScene` preloads the 17 frames through Vite URL imports alongside the
existing guard. `CombatScene` keeps one P1 Phaser Image in the existing fighter
container and swaps its texture only when the selected visual frame changes.
No separate Phaser animation clock, render object per frame, or new event
listener is created. The Phaser gameplay state always selects the visual;
artwork never controls movement, hit detection, damage, timing, winner, or
restart. P2's presentation and both fighters' authoritative combat behavior
are unchanged.

All frames use the US-18 uniform scale `140 / (1329 - 128)`; no pose is
individually resized. The image remains at local `y = FIGHTER_HEIGHT / 2` in
the existing container. Its origin is the measured boot-sole line divided by
that frame's source height, so that the sole line always resolves to ground
top `y = 560`. Measured source-pixel sole lines are recorded beside the frame
keys in `CombatScene`. The image's horizontal origin stays centered. This is
one semantic foot anchor across all frames, with per-texture source coordinates
only to compensate for generated transparent padding. Gameplay container
positions, 72 × 140 body dimensions, and attack rectangles are unchanged.

## Playback

Priority is attack, then actual horizontal displacement, then idle. State
changes select the new pose in that update, without waiting for a loop. Idle
plays `I1 → I2 → I3 → I2 → I1 → I4 → I1` at 300 ms per pose (2.1 s cycle).
Movement plays `M1 → M6` at 100 ms per pose (0.6 s cycle). Retreat currently
reverses that sequence; forward/retreat is relative to the fighter's current
facing, not the pressed key. When clamped at an arena edge, zero actual
displacement selects idle. The visual frame contributes no world movement.

Attack images are selected from the *existing* `attackState` and
`attackPhaseElapsed`, with these presentation-only boundaries:

| Gameplay phase | Absolute time | Visual frame |
| --- | ---: | --- |
| Startup | 0–90 ms | S1, modest draw-back |
| Startup | 90–180 ms | S2, load completes |
| Active | 180–240 ms | A1, already extended forward |
| Active | 240–340 ms | A2, strongest forward silhouette |
| Active | 340–400 ms | A3, short follow-through |
| Recovery | 400–500 ms | R1, withdraw |
| Recovery | 500–600 ms | R2, raise toward guard |
| Recovery | 600–700 ms | R3, settle |

The 180/220/300 ms gameplay phases and collision windows are untouched.
Elapsed time carried across a phase boundary immediately selects the current
phase's pose, even if a frame skips a visual boundary. The existing facing
logic still flips *only* the Image horizontally. `setTexture` preserves the
absolute `flipX` flag, so crossing during an attack changes presentation
without resetting attack time or flipping gameplay geometry.

On scene restart, new fighter objects are created and the local idle/movement
visual timer resets to zero. No stale visual state is retained. At match end,
the current pose freezes with the existing match lock; no KO or victory art is
introduced.

## Known visual limitations

- AI-generated poses have small frame-to-frame illustration differences;
  fine face, fur, hand, and sword details may shimmer. Reviewer/User should
  judge this at actual desktop and mobile-landscape game scale.
- The movement cycle is a restrained step candidate, not root-motion capture.
  Reversed retreat playback and the M6 → M1 join need real held-key review.
- The existing game permits movement during attacks. The attack poses have
  locally planted feet, so visible foot sliding can occur. Gameplay movement
  was intentionally not locked or slowed to conceal it.
- The illustrated blade can extend beyond the logical 72-pixel fighter body
  and existing attack box. Art remains non-authoritative, including at arena
  boundaries and during a facing reversal.
- The pre-existing width-FIT layout yields a 796 × 447.75 canvas in an
  844 × 390 viewport, so it overflows vertically. CSS/scaling remains for
  US-25; US-19 did not change it.
- The 18 full-resolution textures increase load and decoded memory. No
  definitive low-memory/mobile performance measurement has been made.

## Validation and remaining manual work

- `npm run build` passes TypeScript and Vite. The shell's Node 20.11.1 is
  below Vite's supported version; build succeeds with a warning, but `npm run
  dev` fails at `crypto.hash`. Launching the same Vite CLI with the available
  Node 24 runtime succeeds without changing project dependencies.
- Browser smoke check: game and P1 render, boots meet the ground, idle image
  changes over time, J attack was visible, and console had no errors/warnings.
  At 844 × 390, rendering is functional with the inherited height overflow.
- Source inspection confirms the existing movement, facing, attack timing,
  hitbox, damage, winner, and restart methods are not altered by this story.
- No User manual gameplay validation is claimed for US-19. A Reviewer/User
  still needs to test sustained A/D and arrow movement, J/L at range and on
  misses, crossing in both directions (including mid-attack), retreat,
  repeated attacks, both lethal outcomes, completed-only R restart, and
  repeated victory/restart cycles. Inspect every pose and edge at desktop
  and actual mobile-landscape scale for material/weapon continuity, foot
  contact, and any noticeable foot sliding.

## Generation prompt set

All final images were generated using the original US-18 guard as the sole
edit/reference image. Shared prompt constraints were: “One transparent
full-body 2D fighting-game frame, not a sheet; preserve the original
northern fighter's identity, hair, compact fur mantle, charcoal layered
leather, short cloak, boots, two-handed weathered straight Longclaw with wolf
pommel, painterly proportions and palette; no actor likeness; face screen
right; keep the same source canvas, body scale and center, sole ground line,
and complete sword inside the frame; no root displacement, backdrop, shadow,
text, extra limbs or weapons.” The pose-specific requests were:

- I2/I3/I4: subtle breath rise / crest / settling with fixed feet and guard.
- M1–M6: alternating front contact, weight transfer, trailing foot pass,
  opposite contact, opposite transfer, return pass; restrained upper guard.
- S1/S2: modest draw-back and completed load, not yet a forward threat.
- A1/A2/A3: already-forward torso-height strike, strongest extension, small
  follow-through while still threatening.
- R1/R2/R3: withdraw, raise blade, settle into neutral guard, not a second
  attack.

After review, A3 and R1 were regenerated as targeted edits of A2: A3 must
keep the sword extended forward through the end of active time; R1 must pull
the sword back and slightly upward without resembling a new backswing. The
final frame files contain those corrected versions, not the rejected drafts.
