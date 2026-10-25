# US-39 — Main Menu & Game Mode Selection (#76)

## Local implementation, not final visual acceptance

Baseline: main at 30f1eb3ca4228d72bd97f021be37a63139d3dc75.
Flow: React GameContainer → BootScene → MainMenuScene → CombatScene({ mode }).
FIGHT CPU supplies `single-player`; LOCAL VERSUS supplies `local-versus`.
These options work in production without query parameters. The old development
query shortcut is removed. Combat logic is unchanged; CombatScene includes an
opt-in presentation-only incoming fade. LyraController is unchanged.
Restart remains the existing same-mode restart; no return-to-menu/rematch flow
or additional menu options are introduced.

## Assets and provenance

Source: Sansa's `us39-production-finalization-2026-10-18` package under
`/Users/karemara/.codex/visualizations/2026/09/27/01a0e0e7-fe92-7862-9b01-febc8ad03ec8/`.
The source manifest and provenance/risk record are retained in `src/assets/menu`.
Only these three image exports are integrated, without re-encoding:

| Asset | Dimensions | Bytes |
| --- | --- | --- |
| Desktop corridor WebP | 1672×941 | 362766 |
| Mobile corridor WebP | 1280×592 | 168144 |
| Shared button atlas WebP | 512×384 | 20038 |

One corridor variant is selected on initial menu loading using coarse-pointer
capability. That variant is retained for the game instance, including resizes;
the image is uniformly cover-scaled with centered cropping, never stretched.
No JPEG/PNG fallback or individual button images are additionally loaded.
Both corridor URLs exist in the build but only the selected variant is requested
by Phaser. Background plus atlas estimated base RGBA8 memory is 6.752 MiB
desktop or 3.641 MiB mobile, excluding combat textures, buffers and text caches.

Atlas frames neutral/focused/pressed share 512×128 untrimmed, unrotated canvases,
with content at (16,16,480,96) and live labels centered at (256,64).
State changes do not change scale, origin, hit bounds or label position.
Live labels use the platform Georgia/serif stack; no external font is supplied
or claimed to reproduce the approved raster lettering exactly.

The selected Crown of Combat logo is deferred. No production-ready logo has been
approved. Rejected/recovered title candidates are NOT included. The upper left
title area remains empty: no substitute logo, reconstruction or temporary title
is rendered. Final visual, commercial and device acceptance remains pending.
Final visual acceptance is blocked on production logo approval. Commercial-use,
service/account terms, trademark and heraldry questions remain unresolved as
described in SOURCE-PROVENANCE.md. This implementation grants no legal clearance.

## Layout and interaction

The existing FIT and 1280–1600×720 adaptive dimensions are preserved. Menu layout
uses actual parent size and existing CSS safe-area values. Artwork sizing follows
the approved compositions independently of invisible hit areas. At a 1280×720
logical canvas without safe insets, both atlas bodies are 376×75.2, left x112,
with top edges y364/y458. This approximates the reference's unequal painted
button bounds using one common, undistorted atlas scale. Transparent frame size
is 401.07×100.27; it is not the visible body or the interactive target.
Short landscapes use the mobile reference ratios (1844×853 reference canvas),
about 224×45 CSS px of artwork at 844×390 without shell padding. Hit areas are
independently at least 52 CSS px high and 44 CSS px wide, with nonoverlapping
spacing; artwork is never enlarged to satisfy the target minimum.
Keyboard focus follows the chamfered atlas rim rather than a rectangular frame,
and remains visible over pressed artwork. State changes retain all geometry.
The existing keyboard notice sits beneath the compact button group; mobile uses
the approved two-line grouping, PLAYER 2 REQUIRES / A KEYBOARD. No new panel,
font or ornament is introduced. Existing Georgia/serif font settings are retained.
Exact font specifications, helper-text ornament/spacing specifications and final
pixel-level visual acceptance remain dependencies on Sansa/Product Owner review;
the raster proofs do not supply editable typography or a complete spacing spec.
P1 touch controls remain combat-only; no P2 mobile controls are enabled.
The existing portrait rotate-device overlay remains in effect.

Arrow keys or Tab/Shift-Tab select; Enter/Space activate on fresh release.
Mouse/touch press-release inside the same button activates it. One pointer owns
the press, other touches cannot change it. Selection is handed off only after
all observed keys and pointers release. A one-shot latch prevents queued scene
transition races. Focus stays visible even while the pressed texture is shown.
Blur, visibility changes, resize, portrait changes and pointer cancellation
discard pending selections. Shutdown removes scene-owned input/window/resize
listeners and disconnects its observer. No combat audio instances are created.

## Validation and Product Owner checklist

### Approved Motion Phase 1

Scene-owned delta-based presentation clocks reveal the stationary corridor from
midnight blue (#080f1c) over 250 ms. Buttons/helper fade in over 160 ms; interacting
with the menu immediately makes controls fully visible. No layout, camera position,
background or typography changes are part of motion. Focus changes crossfade the
existing atlas frames over 100 ms using one extra image per button (same texture,
no extra decoded asset). The chamfered focus indicator is immediate. Pressed
feedback changes immediately without crossfade.

A valid released selection supersedes entrance and holds selected pressed feedback
for 40 ms, then fades to midnight over 100 ms (140 ms total). Only then does the
scene start combat with the existing mode and an optional presentation-only
`menuReveal` flag. Combat applies a 120 ms camera fade-in, without locking or
altering gameplay. Existing same-mode restart does not request another reveal.

Exit completion waits for any newly held menu keys/pointers to release. Repeated
input cannot restart the exit or queue another scene. Native canceled pointerup,
synthetic cancellation, blur, visibility/portrait changes or resize invalidate an
unfinished selection/exit and restore a usable menu. Shutdown disposes the clock
and pending mode. No delayed timers, tweens or completion callbacks start scenes.
Hidden/portrait menus stop advancing; resumption discards the first frame's delta.
Rotation never replays entrance.

Reduced-motion preference is cached as a MediaQueryList and read during updates,
including live preference changes. Entrance, frame blends, exit and combat reveal
are omitted when reduced motion is requested. Navigation stays functional.

These are configured/deterministically tested durations measured from scene
creation or selection consumption, not cold-load or browser wall-clock benchmarks.
Actual presentation is quantized by rendered frames; focus/visibility interruptions
and held-input safety gates can extend elapsed wall time. Physical-device motion
quality and reduced-motion OS settings require Product Owner acceptance.

Use Node 24: `node --test scripts/test-*.mjs`, `npm run build`, `git diff --check`.
Focused menu suite: `node --test scripts/test-us-39-menu.mjs` (also imports the
existing 45-test combat harness). Asset hashes are checked against the manifest.
Mocked scene tests do not replace real-browser decoding, pointer or device QA.

1. Run `npm run dev`, or `npm run build` then `npm run preview`.
2. Open `/` without query parameters; expect corridor, two choices, keyboard note,
   and deliberately blank logo area.
3. Choose FIGHT CPU; wait for Lyra to approach/attack without P2 input.
4. Reload; select LOCAL VERSUS using arrows/Tab then Enter/Space. Verify P2
   Left/Right/Up/L/semicolon/Down and normal P1 keyboard controls.
5. Hold navigation keys while selecting; combat must not start until release.
   Try two fingers, release outside, cancellation and focus loss mid-press.
6. Check 667×375, 844×390 and 896×430 landscapes, notches and portrait rotation.
   Confirm live labels/note readability, touch targets and persistent focus.
7. Fight, Block, win/lose, and restart each mode. Check P1 joystick/actions,
   same-mode restart, audio unlock, no duplicate ambience and no stuck input.
8. Final logo fidelity, exact font treatment, mobile crop fidelity, physical-device
   multitouch and commercial clearance still require the appropriate approvals.
