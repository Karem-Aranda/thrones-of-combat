# US-34 — Floating joystick and P1 mobile actions

## Approved layout

This mobile MVP controls P1 only. P2 retains its keyboard controls; its existing
touch definitions are preserved but hidden, non-interactive, and unable to issue
intentions. Both fighters' desktop keyboard controls remain unchanged.

P1 has a floating horizontal joystick in the available left half of the gameplay
canvas, and Jump / Block / Light / Heavy in a bottom-right two-by-two cluster.
Joystick dragging does not jump: Jump is a separate action button.

All dimensions below are logical screen pixels, scaled by the existing viewport:

- Joystick base radius: 76.8 (previously 64); thumb radius: 28.8 (previously 24).
  Both visual circles are 20% larger; horizontal neutral dead zone remains 14.
- Action targets: 144 × 144, with 28-pixel gaps and 36-pixel edge margins.
- Right/bottom anchoring respects the existing screen-safe-area insets.

The joystick input origin is the initial canvas-local touch position, not a fixed
button or world coordinate. One pointer owns it until release/cancellation.
Other fingers can operate actions without replacing the owner. Thumb artwork is
radius-limited; direction input follows the owning pointer across the canvas.
Near edges, only the visual center is moved inward, reserving base/thumb travel
and respecting safe areas. Both circles remain inside the left half during full
thumb travel. Input still measures displacement from the original touch, so
edge placement does not change the dead zone, direction, speed or ownership.

Release, cancellation, canvas exit, focus loss, document hiding, portrait mode,
viewport/inset changes, KO and scene shutdown clear touch state. Restart creates
fresh scene-owned controls and does not duplicate joystick listeners.

## Scope and gameplay authority

Only `TouchControls.ts` changes production behavior. It emits existing held or
fresh-press intentions into Phaser's existing keyboard/touch merger. Movement,
jump physics, attack definitions/timing/geometry, combo confirmation/buffering,
Block/blockstun, hitstun/knockback, health/damage, victory, KO, restart, camera,
HUD, artwork and arena are unchanged. Existing canvas `touch-action: none` and
the six-pointer input budget are reused.

## Validation

Using Node 24:

```bash
node --test scripts/test-us-26-world.mjs scripts/test-us-29-jump.mjs \
  scripts/test-us-30-attacks.mjs scripts/test-fighter-visual-scale.mjs \
  scripts/test-us-32-reactions.mjs scripts/test-us-31-combos.mjs \
  scripts/test-us-33-block.mjs scripts/test-us-28-visuals.mjs \
  scripts/test-us-36-display-names.mjs scripts/test-us-34-joystick.mjs
npm run build
git diff --check
```

649/649 test executions passed, including 44 focused US-34 checks. The count
includes shared test executions imported by several existing suites. Production
TypeScript/Vite build passed with the existing non-blocking large-chunk warning.

The in-app browser was checked at 667×375, 844×390 and 896×430 using the dev-only
`/scripts/us-34-touch-preview.html` entry point. It loads the real React/Phaser
application, overrides only the coarse-pointer capability and reproduces its
landscape padding. It is not a production entry point or a touch-device emulator.

Observed through real browser mouse/keyboard routing:

- Four spaced P1 action buttons fit; P2 touch controls stay hidden.
- Joystick drags move P1 both ways, including near an edge; release hides it.
- Jump works; Light and Heavy cause the existing 10 and 18 damage.
- Holding touch Block while P2 attacks with its keyboard preserves P1 health.
- Both keyboard jump controls and independent keyboard movement work.
- Victory replaces action controls with Restart; touch Restart restores health
  and the action cluster without a visible joystick left over.
- Canvas gesture prevention remains `touch-action: none`; no captured console
  warnings/errors occurred during this browser check.

## Product Owner physical-device checks

Real-finger multitouch, native touch cancellation, device safe-area behavior,
browser chrome/OS edge gestures and DPR-specific appearance remain unverified.
The automated tests cover multiple pointer IDs and lifecycle interruptions, but
do not replace these hardware checks:

1. On each requested landscape size, start at several left-half locations,
   including corners; drag both ways, return to neutral, release and cancel.
2. Hold joystick movement while a second finger presses each action. Hold Block
   with a third finger if available. Verify actions never steal joystick ownership
   and lifting one finger does not cancel another.
3. Verify P2 keyboard movement, jump, Block, Light and Heavy while P1 uses touch;
   verify P1 keyboard controls also coexist.
4. Rotate, background/refocus the browser, interrupt a gesture and leave/re-enter
   the canvas; movement must remain stopped until a fresh touch.
5. Finish a match while holding controls, then touch Restart; verify cleared
   ownership, restored health and usable fresh controls over repeated cycles.
6. Check comfortable spacing and reachability with browser bars/notches visible,
   especially near edges. Confirm no page scroll/zoom interrupts normal combat.

Further visual styling and physical-device comfort refinements are not claimed
as validated by the desktop coarse-pointer fixture.
