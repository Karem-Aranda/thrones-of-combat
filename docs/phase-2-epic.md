# Phase 2 — Fighter & Movement Foundation

## Epic goal

Build a reusable two-fighter gameplay foundation where both fighters can move,
face each other, attack, receive damage, be defeated, and restart correctly
using the same combat model. The result should be a technically functional
two-player combat sandbox, focused on fighter behavior and bilateral combat.

## Visual direction and principle

The long-term target is a high-quality medieval-fantasy fighting-game
presentation consistent with the established Thrones of Combat mockups. Phase 2
does not target final visual quality; placeholder geometry may remain while
fighter behavior is developed and validated. Final character sprites,
polished animation, medieval arena presentation, HUD styling, VFX, and audio
belong to later visual-development work.

Continue following **simple → functional → tested → improved**. Keep
`CombatScene` as the gameplay orchestrator unless a concrete feature calls for
extraction. Do not build a generalized combat engine prematurely.

## User stories

### US-09 — Shared Fighter Foundation

As a developer, I want both combatants to use the same fighter representation
so that future combat behavior can be implemented consistently for either
fighter.

Acceptance criteria:

- Both fighters use the same small typed fighter representation.
- Fighter data groups the state that genuinely belongs to a fighter.
- Existing MVP behavior remains unchanged.
- Player 1 remains the only controllable fighter.
- Player 2 remains stationary and cannot attack.
- Health and existing HUD behavior remain correct.
- Victory and restart remain correct.
- Phaser remains authoritative for gameplay state.
- No generalized combat engine is introduced.

Depends on: completed MVP / US-08.

### US-10 — Player 2 Movement

As Player 2, I want independent movement controls so that both fighters can
position themselves in the arena.

Acceptance criteria:

- Player 1 retains A/D movement.
- Player 2 uses Left Arrow / Right Arrow.
- Both fighters use consistent delta-based movement and remain inside arena boundaries.
- Inputs are independent.
- Existing attack/damage behavior remains intact.
- No Player 2 attack is introduced yet.

Depends on: US-09.

### US-11 — Fighter Facing

As a player, I want each fighter to face their opponent so that movement and
future attacks use the correct direction.

Acceptance criteria:

- Each fighter has explicit left/right facing state.
- When P1 is left of P2, P1 faces right and P2 faces left.
- If their horizontal ordering changes, facing updates correctly.
- Facing belongs to fighter/gameplay state.
- Behavior can be verified without final character sprites.
- Existing movement remains functional.
- No final animation system is required.

Depends on: US-10.

### US-12 — Two-Way Basic Attack

As either player, I want to perform a basic attack so that both fighters can
participate in combat.

Acceptance criteria:

- P1 retains J as basic attack; P2 uses L as basic attack.
- Both fighters use the same attack-state model and follow startup → active → recovery.
- Fresh presses start attacks; holding an attack key does not restart attacks every frame.
- Each fighter has independent attack state.
- Attack behavior is not implemented through duplicated P1/P2 state machines.
- No damage-system expansion beyond what is necessary for this story.

Depends on: US-11.

### US-13 — Directional Hit Detection

As a player, I want my attack to hit only when its active area overlaps my
opponent in the direction I am facing.

Acceptance criteria:

- Either fighter can act as attacker or defender.
- Right-facing attacks place their active area to the right; left-facing attacks place it to the left.
- Collision is evaluated only during the active phase.
- Misses do not register hits.
- One attack cannot register repeatedly every active frame.
- Hit geometry comes from fighter/facing state rather than P1-specific hard-coding.
- No knockback, hit stun, blocking, combo, or special-attack behavior is introduced.

Depends on: US-12.

### US-14 — Two-Way Damage

As either player, I want successful attacks to reduce my opponent's health so
that both fighters participate in the same damage system.

Acceptance criteria:

- Both fighters begin with 100 HP; a valid basic attack deals 10 damage.
- P1 can damage P2 and P2 can damage P1.
- Misses deal no damage; health cannot fall below zero.
- The existing HUD represents both fighters' actual health.
- No duplicate UI health state is introduced.
- Damage logic is shared rather than separately hard-coded for each player.

Depends on: US-13.

### US-15 — Two-Way Victory / Defeat

As a player, I want the match to end when either fighter reaches zero health
so that the correct winner is declared.

Acceptance criteria:

- P2 reaching zero declares Player 1 the winner; P1 reaching zero declares Player 2 the winner.
- Winner presentation identifies the correct player.
- Match completion occurs once.
- Movement stops after match end.
- Neither player can begin new attacks, and further damage cannot occur after match end.
- Final HUD state remains visible.
- No rounds, scoring, rematch menu, or best-of system is introduced.

Depends on: US-14.

### US-16 — Two-Fighter Restart

As a player, I want to restart a completed two-player match so that both
fighters return to a clean initial state.

Acceptance criteria:

After match completion, R:

- Restarts the match without reloading the browser.
- Resets both fighters to 100 HP and both HUD bars to full.
- Restores both starting positions and correct initial facing.
- Resets both attack states, attack timing, and per-attack hit eligibility.
- Removes the previous winner presentation and resets winner state.
- Restores movement and attacks for both players.

Additionally:

- R does not restart an active match.
- Repeated match/restart cycles do not accumulate stale objects or input handlers.
- Restart remains Phaser-owned; no React gameplay/reset state is introduced.

Depends on: US-15.

## Dependency chain

```text
Completed MVP
↓
US-09 Shared Fighter Foundation
↓
US-10 Player 2 Movement
↓
US-11 Fighter Facing
↓
US-12 Two-Way Basic Attack
↓
US-13 Directional Hit Detection
↓
US-14 Two-Way Damage
↓
US-15 Two-Way Victory / Defeat
↓
US-16 Two-Fighter Restart
```

## Out of scope

Final character art, final Game of Thrones-inspired visual presentation,
polished sprite animation, final medieval arenas, polished HUD redesign, VFX,
audio/music, jumping, blocking, combos, special attacks, knockback, hit stun
(unless later proven strictly necessary), AI, character selection, a
multiple-character roster, multiple arenas, rounds, scoring, online
multiplayer, backend, and persistence belong to later phases unless planning
changes the roadmap.

## Technical guidance

- **Fighter structure:** The MVP uses player-specific combat fields. US-09
  should add only the smallest shared fighter representation needed for
  symmetrical combat, without a generalized combat engine.
- **CombatScene:** Keep it as the gameplay orchestrator. Extract behavior only
  when a Phase 2 feature creates a concrete reason.
- **Facing and hit geometry:** MVP attack geometry assumes a right-facing
  attacker. US-11 and US-13 should evolve this deliberately.
- **Arena dimensions:** Logical arena dimensions are duplicated between game
  configuration and gameplay. Centralize them when a feature needs shared
  dimensions or before resolution/arena-size behavior changes, not as an
  isolated cleanup.
- **Tests:** There is no automated gameplay test suite yet. Add focused tests
  when expanded or extracted combat logic makes them useful for regression
  protection; do not introduce a large testing architecture solely for this
  phase.

## Definition of done

Phase 2 is complete when both fighters share a fighter model, move
independently, face each other, perform basic attacks in either direction,
receive damage, and can each win. Completed matches restart cleanly; existing
MVP behavior has not regressed; the build passes; relevant runtime flows are
manually verified; and no Phase 3 visual systems have been introduced early.

## Future phase direction

A later visual-focused phase is expected to bring the functional combat
sandbox toward the medieval-fantasy mockup quality through character sprites,
animations, arena presentation, HUD styling, effects, and audio. Phase 3 user
stories are not defined here.
