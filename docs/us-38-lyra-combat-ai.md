# US-38 — Lyra Combat AI (#75)

## Local test entry

Run `nvm use 24` and `npm run dev`.

- `/` or `/?mode=local-versus`: existing two-player keyboard mode (default).
- `/?mode=single-player`: P1 human input; P2 exclusively controlled by Lyra AI.

The query selector is development-only. Production still defaults to Local
Versus until US-39 supplies the menu. Its future integration seam is
`scene.start('CombatScene', { mode: 'single-player' })` (or `local-versus`).
Restart explicitly preserves the selected mode. There is no mid-match mode switch.

## Authority and decisions

`LyraController` has no Phaser dependency. It receives scalar read-only fighter
observations and the existing fighter width, world width and attack definitions.
It returns the same `FighterInput` held intentions/fresh edges as human input.
It cannot change fighters, health, collision geometry, attack phases or winners.

The five policy states are approach, attack, defend, retreat and recovery:

- Approach follows world positions and an interior range margin.
- Attack issues one fresh edge, alternating Light and Heavy deterministically.
- Defend reacts to an observable in-range startup/active phase, not pending keys.
- Retreat follows an attack or guard and remains bounded by the world edges.
- Recovery emits neutral intentions until legal eligibility and timers allow action.

Named policy values: 200 ms reaction delay, 1100 ms minimum attack cooldown,
320 ms maximum continuous guard, 260 ms retreat, 16 px range hysteresis margin.
No random source, wall clock, browser timer or external service is used.

AI input is selected before guard/movement processing. Local Versus does not
instantiate AI. Single Player drains but ignores P2 keyboard/touch intentions.
P1 keyboard and floating joystick/action buttons remain unchanged.

All consequences use the existing combat path: grounded eligibility, Light/Heavy
definitions, Block/blockstun, hitstun/knockback, one-hit consumption, combo rules,
US-35 active-window collision, P1-first resolution, KO, HUD and presentation.

## Lifecycle

KO clears AI policy state; the ended-match branch never advances its decisions.
Restart creates a fresh controller and clears P2 keys/edges. Scene pause/sleep,
blur/hidden-document and portrait states discard pending decisions. Resumption
starts a fresh reaction delay and ignores the first resumed frame's elapsed time
for AI decisions, avoiding historical catch-up. Focus and visibility locks compose.
Shutdown removes the added lifecycle/focus listeners and releases the controller.
Existing attacks/reactions remain engine-owned throughout suspension/resumption.

## Validation and acceptance checklist

Run `node --test scripts/test-*.mjs`, `npm run build` and `git diff --check` on Node 24.
The focused runner is `node scripts/test-us-38-ai.mjs`; it also imports the existing
45-test attack harness. Existing regression assertions are not weakened.

Product Owner checks:

1. Default mode: P1 A/D/W/J/K/S and P2 Left/Right/Up/L/semicolon/Down still work.
2. Single Player: wait for approach, then observe Light/Heavy, delayed guard and retreat.
3. Press P2 keyboard controls: they must not move, jump, guard or attack for Lyra.
4. Fight with P1: check misses, Light 10 / Heavy 18 damage, Block and reactions.
5. Win and lose separate matches; check KO, input lock and R restart in the same mode.
6. Blur/switch tabs and return; verify fresh reaction delay and no stale attack burst.
7. On mobile landscape, combine P1 joystick with Jump/Block/Light/Heavy and restart.
8. Repeat matches and orientation changes; watch for stuck inputs or duplicate cues.

## Deliberate limitations

This basic opponent has no jump policy, automatic combo policy, difficulty tiers,
learning or prediction. Human combo/jump mechanics remain supported. Its fixed
attack sequence is intentionally predictable. Defensive delay does not guarantee
that a fast Light can be blocked, and movement during startup can produce misses.
Game-mode menu/presentation belongs to US-39. Physical-device acceptance and
subjective difficulty tuning still require Product Owner validation.
