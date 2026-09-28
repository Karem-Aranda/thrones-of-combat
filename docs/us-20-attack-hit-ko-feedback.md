# US-20 — Attack, Hit & KO Visual Feedback

## Scope and artwork

Jon Snow (P1) gains presentation-only hit and KO poses. Player 2 remains the
Phase 2 rectangle; confirmed hits on P2 receive the same small contact cue but
no illustrated reaction. No fighter mechanics, hitboxes, damage, controls,
attack timing, winner determination, or restart rules change.

The four new original transparent PNGs were generated with the built-in
imagegen editor, using the approved US-18 Jon guard and the preceding generated
pose as references. They retain the game's northern/Stark-inspired painterly
interpretation, not an actor likeness or copied screen/game/fan artwork. The
existing guard, idle, movement, and attack textures were not replaced. All four
files are 1145 × 1374 RGBA images in `src/assets/fighters/jon-snow-frames/`:

| File | Pose | Size | Source-pixel ground anchor |
| --- | --- | ---: | ---: |
| `hit-contact.png` | restrained first flinch | 1,182,982 bytes | 1348 |
| `hit-recoil.png` | strongest nonlethal recoil; reused for lethal impact | 1,228,507 bytes | 1348 |
| `ko-collapse.png` | buckling, sword lowered | 1,130,393 bytes | 1326 |
| `ko-hold.png` | low one-knee-down final hold, sword retained | 1,087,951 bytes | 1336 (boot sole) |

Total new disk weight is 4,629,833 bytes (about 4.42 MiB). Decoded RGBA pixel
storage is about 25.2 MB before renderer overhead. The existing US-19 asset
weight is unchanged; broader texture optimization is reserved for US-25.
Alpha bounds were inspected for all four assets, and their transparent corners
and full sword/boots were checked visually. The same-size canvases are loaded
by the existing `BootScene` filename glob, so no new loader or animation object
is needed.

## Rendering and presentation timing

The existing P1 Phaser Image swaps textures at the original uniform scale
`140 / (1329 - 128)`. The image remains at local `y = 70` in the fighter
container. The source-pixel anchors above are applied as per-texture origins,
placing each pose's boots on the existing ground surface `y = 560` without
moving its container or collision geometry. `ko-hold.png` anchors to its boot
sole at source `y = 1336`; its low sword tip extends roughly one displayed
pixel below that sole line. No gameplay anchor/offset was changed. The existing
`setFlipX` on the Image handles left-facing poses, including reaction and KO.

The existing confirmed-hit damage path alone starts presentation. On every
confirmed hit, a single reusable Phaser circle appears briefly near the
defender's torso and fades over 80 ms. It does not appear on misses or cause
damage. On a nonlethal hit to Jon, texture priority is contact for about 30 ms,
recoil for about 60 ms, then current gameplay-selected animation for the
remaining 90 ms of the 180 ms reaction window. While the temporary frame is
shown, attack phase and visual selection continue advancing. A hit during
Jon's own attack therefore does not cancel, pause, or restart the attack; the
return pose is selected from the **current** attack state and elapsed time.

At 0 HP, the existing winner/health/match lock happen immediately. Jon's KO
presentation independently uses the recoil image for about 70 ms, collapse
until about 330 ms, then the low defeated frame through 400 ms and holds that
frame until restart. The KO counter caps instead of looping. The winner's Jon
presentation settles into the existing guard; P2's rectangle remains a
functional placeholder. During match lock, only these visual timers and the
cue update; movement, attacks, damage, and winner handling remain frozen.

`create()` clears hit/KO/cue counters and creates one cue object. Phaser's scene
restart destroys the previous scene display objects and calls `create()` again.
No new input listener, delayed callback, or timer event is registered, so
repeated restarts cannot accumulate them.

## Validation and remaining manual checks

- `npm run build` passes TypeScript and Vite. The default shell Node 20.11.1
  produces Vite's pre-existing minimum-version warning. The existing large
  JS-chunk warning is also non-blocking. Local dev-server smoke testing uses
  the available Node 24 runtime.
- `git diff --check` passes. Source inspection confirms unchanged authoritative
  movement, hit geometry, damage (10), 180/220/300 ms attack windows, winner
  ordering, and completed-only R restart.
- Browser smoke check: the game and both fighters render with no console
  errors/warnings at initial load. At 844 × 390, DOM measurement reports the
  inherited 796 × 447.75 canvas and vertical overflow; responsive behavior is
  otherwise functional at initial load.
- A read-only temporary Node harness exercised the scene's real transpiled
  methods with Phaser geometry/input stubs. It passed a miss (no damage/cue),
  a confirmed P1 hit during P1's active attack (10 HP, one hit, contact →
  recoil → current attack frame, unchanged position), cue expiry, both lethal
  winner paths, KO progression through match lock and final hold, and the
  completed-match restart gate. This is a logic check, not a substitute for
  real-browser sustained-input or visual testing.
- Actual sustained input and full visual sequence checks still require
  Reviewer/User manual validation.
- Manual checks still required: confirmed Jon hit while stationary, moving,
  retreating, facing each way, and attacking; miss with no cue/reaction;
  repeated nonlethal hits; both lethal outcomes; winner guard; KO progression
  through final hold; R during an active match versus after either victory;
  repeated victory/restart cycles; ground contact, texture edges, and size at
  desktop and mobile-landscape resolution.

Generated poses may show minor face/fur/cloth inconsistencies between frames.
The temporary contact circle is intentionally simple, not a US-23 VFX system.
P2 has no new reaction art by design. Full-resolution texture weight and the
pre-existing mobile-height overflow remain deferred to US-25.

## Generation prompt set

All requests asked for one transparent full-body sprite, same character and
source canvas, facing right, preserved grey-brown fur mantle, charcoal leather
layers, short cloak, boots, straight weathered sword and wolf pommel, painterly
style, clean alpha, complete silhouette, no actor likeness, blood, attacker,
ground, scenery, text, or extra weapons. Pose-specific directions were:

- Contact: restrained shoulder/chin flinch, both hands retain the sword.
- Recoil: stronger backward torso/head snap and bent-knee defensive stance.
- Collapse: knees buckle, torso/head sag, sword lowers but remains held.
- Hold: low one-knee-down defeated pose, bracing hand, bowed head, sword still
  visible, with transparent space above the shortened silhouette.
