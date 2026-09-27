# Phase 3 — Visual Combat Experience

## Epic Goal

Transform the functional Phase 2 combat prototype into a visually rich,
readable, high-quality illustrated 2D Game of Thrones-inspired fighting
experience while preserving the validated combat foundation and maintaining
browser performance across desktop and mobile web.

Phase 1 and Phase 2 are complete. Phase 2 has been reviewed, manually validated,
merged into `main`, and deployed successfully. This document defines future
work; it does not authorize implementation before the relevant approvals.

## Product and Visual Direction

Thrones of Combat uses **high-quality illustrated 2D graphics**: detailed,
cinematic, atmospheric, readable, house/character driven, and suitable for
browser deployment. It is not pixel art, retro 8-bit/16-bit, voxel art, generic
medieval fantasy, or a 3D game.

Visual ambition comes from strong character artwork, animation, layered
environments, lighting, particles, atmospheric effects, VFX, and polished
HUD/UI—not 3D rendering. Readability takes priority over decoration.

The medieval direction exists specifically because the game is inspired by
Game of Thrones. Its identity should reflect recognizable characters,
houses/factions, weapons/equipment, sigils and heraldry, locations, atmosphere,
and environmental storytelling. House identity must involve more than color
changes: Stark, Targaryen, Lannister, and future relevant houses/factions must
have distinguishable visual languages.

## Original Asset Principle

This is a fan-inspired learning project. Prefer original artwork created
specifically for Thrones of Combat and a coherent visual interpretation of its
own. Do not plan around scraped TV screenshots, extracted commercial game
assets, copied promotional artwork, stolen fan artwork, or third-party sprite
sheets without appropriate rights. Audio must also be original, appropriately
licensed, or otherwise safe to use; do not extract Game of Thrones audio.

## Technology and Ownership

Keep React, TypeScript, Vite, and Phaser 4. No technology migration is proposed.
React owns the surrounding application. Phaser remains authoritative for
fighters, real-time combat, combat animations, gameplay rendering, combat HUD,
gameplay VFX, and scene lifecycle. Visual systems adapt to the validated combat
foundation whenever reasonable; animation and effects must not become combat
authority.

## Responsive and Mobile Direction

Use the same web application/deployment for desktop, tablet, and mobile browser.
There is no separate native mobile application in Phase 3. Mobile combat
prioritizes **landscape orientation**.

Design must account for responsive canvas scaling, safe areas, HUD and fighter
readability, touch targets, mobile controls, browser performance, and different
aspect ratios. Desktop keyboard controls remain supported. Early visual stories
consider mobile composition and constraints; touch controls arrive later in
US-25, not during those early stories.

## Workflow and Design Gate

**Planner → Designer → Developer → Reviewer → User Validation**

For significant visual decisions:

1. Planner defines story scope.
2. Designer creates the design specification.
3. User / Planner approves the design.
4. Developer implements the approved design.
5. Reviewer validates implementation.
6. User performs final validation.

The Developer must not invent major visual decisions when a Design Gate is
required. US-17 through US-23 require the gate. US-24 requires partial,
audio-direction approval. US-25 uses the approved visual system without new
major art direction. Later details may evolve after gates, but scope or order
changes require Planner approval.

## Phase 2 Regression Protection

Every Phase 3 story must preserve:

- P1 A/D movement and P2 Left/Right Arrow movement.
- Fighter facing and crossing.
- P1 J and P2 L attacks with independent state.
- Startup / active / recovery timing: 180 / 220 / 300 ms.
- Directional hit detection and at most one hit per attack.
- Misses deal 0 damage; valid basic hits deal 10 damage.
- Both fighters start at 100 HP; health clamps at zero.
- Two-way victory/defeat and post-match movement/attack/hit/damage lock.
- Phaser-owned health, HUD, match state, and restart.
- Completed-match R restart, active-match R no-op, and repeated clean matches.

Review and user validation must cover this baseline whenever the story touches
its presentation or input. No React duplicate gameplay state or browser reload
may be introduced.

## Dependency Order

Phase 2 complete → US-17 → US-18 → US-19 → US-20 → US-21 → US-22 → US-23 →
US-24 → US-25.

Some later implementation details may evolve after Design Gates. Do not reorder
or expand scope without Planner approval.

## Phase 3 Out of Scope

- 3D conversion; native iOS/Android application.
- Large character roster; character selection screen; multiple arenas.
- Unique special abilities; combos; blocking; jumping.
- Rounds / best-of system; scoring; AI opponent; story mode.
- Progression; inventory; backend; accounts; persistence; online multiplayer.

These may belong to future phases. Phase 3 is visual experience and integration,
not expansion of combat mechanics.

## US-17 — Visual Art Direction & Asset Foundation

### User Story

As the development team, we want a shared visual and asset foundation so that
all future fighters, arenas, HUD elements, and effects belong to the same
coherent game.

### Objective

Establish the minimum visual bible and technical asset rules before replacing
gameplay placeholders.

### Dependencies

Completed and validated Phase 2.

### Design Gate

Required: Designer specification and User / Planner approval before downstream
visual implementation.

### Scope

Define and approve:

- Illustrated 2D style, fighter proportions, gameplay-scale readability,
  consistency rules, and house/faction visual language.
- Asset types, sprite/texture strategy, transparency requirements, sizing
  guidelines, naming conventions, and animation asset expectations.
- Arena layering strategy, responsive visuals, mobile safe areas, and
  Phaser/browser performance constraints.

### Acceptance Criteria

- [ ] Visual direction is documented.
- [ ] Illustrated 2D is explicit; pixel art and 3D are excluded.
- [ ] House identity and fighter readability rules exist.
- [ ] Asset pipeline expectations are documented.
- [ ] Phaser/browser constraints are considered.
- [ ] Desktop/mobile visual requirements are considered.
- [ ] No Phase 2 behavior changes; no fighter implementation is required yet.

### Out of Scope

Fighter integration, production animations, arena/HUD redesign, VFX, audio,
touch implementation, and all Phase 3 global exclusions. This story defines the
foundation, not production features.

## US-18 — First Fighter Visual Integration

### User Story

As a player, I want to see the first recognizable Game of Thrones-inspired
fighter instead of a placeholder so that the game begins to establish its real
visual identity.

### Objective

Prove the complete pipeline from approved character design to Phaser rendering
using one fighter.

### Dependencies

US-17 — Visual Art Direction & Asset Foundation.

### Design Gate

Required: Planner/User selects the fighter; Designer specifies appearance/era,
house/faction, silhouette, and equipment/weapon for User / Planner approval.

### Scope

- Create/prepare the required original or appropriately authorized 2D asset.
- Replace only the selected fighter's placeholder visual.
- Preserve gameplay body, hit behavior, and facing; support appropriate
  horizontal orientation/flipping.
- Verify gameplay-scale readability. The second fighter may remain placeholder.

### Acceptance Criteria

- [ ] One fighter uses an approved illustrated visual asset.
- [ ] Character is recognizable at gameplay scale.
- [ ] House/faction identity is visible.
- [ ] Facing works visually; movement remains correct.
- [ ] Attacks, hit detection, and damage remain correct.
- [ ] Combat timing is unchanged.
- [ ] Second fighter may remain placeholder.
- [ ] Browser performance remains acceptable.

### Out of Scope

Second-fighter visual integration, final animation foundation, altered combat
geometry/timing, character selection, and all Phase 3 global exclusions.

## US-19 — Fighter Animation Foundation

### User Story

As a player, I want the visual fighter to animate during movement and combat
states so that the character feels alive and readable.

### Objective

Introduce a reusable visual animation foundation mapped to existing fighter
state without changing combat authority.

### Dependencies

US-18 — First Fighter Visual Integration.

### Design Gate

Required: approve animation specification and asset expectations before coding.

### Scope

Idle, movement/walk, and basic attack animation. Map visual states to existing
fighter state and startup 180 ms / active 220 ms / recovery 300 ms phases.

### Acceptance Criteria

- [ ] Idle, movement, and attack animations work.
- [ ] Facing remains correct.
- [ ] Attack visuals correspond meaningfully to existing timing.
- [ ] Animation does not control combat authority.
- [ ] Combat logic remains Phaser/game-state authoritative.
- [ ] Repeated attacks do not corrupt animation state.
- [ ] Restart restores clean visual state.

### Out of Scope

New combat states/mechanics, animation-driven damage or timing, later hit/KO
feedback implementation, and all Phase 3 global exclusions.

## US-20 — Attack, Hit & KO Visual Feedback

### User Story

As a player, I want clear visual feedback when attacks connect and fighters are
defeated so that combat outcomes are immediately understandable.

### Objective

Make validated hit, damage, and match outcomes visually legible.

### Dependencies

US-19 — Fighter Animation Foundation.

### Design Gate

Required: approve focused, readable feedback and defeat presentation.

### Scope

Successful-hit feedback, receiving-damage reaction, defeat/KO, and winner/loser
visual state. Use existing valid-hit and winner outcomes as authority.

### Acceptance Criteria

- [ ] Successful hits have visible feedback; misses do not show hit feedback.
- [ ] Damaged fighter visibly reacts.
- [ ] KO/defeat is visually distinct.
- [ ] Feedback does not create extra damage events.
- [ ] Match lock remains correct; winner determination is unchanged.
- [ ] Restart clears all temporary visual states.

### Out of Scope

Gameplay hit stun, knockback, attack cancellation, new winner rules, broad VFX
systems reserved for US-23, and all Phase 3 global exclusions.

## US-21 — Game of Thrones Arena Foundation

### User Story

As a player, I want to fight in a recognizable Game of Thrones-inspired location
so that the combat feels grounded in the world of Thrones of Combat.

### Objective

Implement one polished arena as the Phase 3 environment foundation.

### Dependencies

US-20 — Attack, Hit & KO Visual Feedback.

### Design Gate

Required: Planner/User selects one location and approves Designer composition.
Candidates include Winterfell, King's Landing, The Wall, Dragonstone,
Casterly Rock, and Highgarden; none is preselected by this plan.

### Scope

Layered 2D background, fighting plane, optional foreground, and atmospheric
layers where appropriate. Possible techniques include parallax, atmospheric
perspective, snow, fog, smoke, fire, and embers. These are design options, not
requirements to implement every effect. No 3D rendering is required.

### Acceptance Criteria

- [ ] One approved arena replaces the prototype environment.
- [ ] Location identity is recognizable.
- [ ] Fighters remain readable; the combat plane remains clear.
- [ ] Environment does not affect hit detection.
- [ ] Environment scales appropriately.
- [ ] Browser performance remains acceptable.
- [ ] Mobile landscape considerations are respected.

### Out of Scope

Multiple arenas, arena selection, environmental combat hazards, 3D, and all
Phase 3 global exclusions. US-23 owns the later controlled VFX pass.

## US-22 — Combat HUD Redesign

### User Story

As a player, I want a polished Game of Thrones-inspired combat HUD so that
health and fighter identity are clear while matching the game's visual
direction.

### Objective

Apply the approved illustrated/heraldic visual language to readable combat UI.

### Dependencies

US-21 — Game of Thrones Arena Foundation.

### Design Gate

Required: approve layout, visual language, and any portraits/sigils.

### Scope

P1/P2 health presentation, fighter names, house/faction identity, victory
presentation, and portraits/sigils only if approved. Possible materials include
steel, stone, heraldic details, restrained gold, and house accents. Readability
takes priority over decoration.

### Acceptance Criteria

- [ ] Both health values are immediately readable.
- [ ] Fighter identities and house/faction identity are represented.
- [ ] HUD does not obscure fighters.
- [ ] HUD scales for supported aspect ratios and mobile landscape.
- [ ] Health remains Phaser/game-state driven.
- [ ] Winner presentation remains correct.
- [ ] Restart restores clean HUD.

### Out of Scope

New health state, React combat HUD authority, rematch menus, scoring, and all
Phase 3 global exclusions.

## US-23 — Combat VFX & Atmosphere

### User Story

As a player, I want restrained combat and environmental effects so that attacks
feel impactful and the arena feels alive.

### Objective

Introduce a controlled first VFX layer that communicates gameplay before
decoration.

### Dependencies

US-22 — Combat HUD Redesign.

### Design Gate

Required: approve effect selection, readability, and performance constraints.

### Scope

Possible effects include weapon trails, hit sparks, impact flashes, dust, snow,
smoke, embers, and subtle environmental movement. Select a restrained set using
the approved visual system, not every listed effect. Coordinate existing US-20
feedback and US-21 atmosphere rather than duplicate them.

### Acceptance Criteria

- [ ] Hit VFX occurs only on valid hits where appropriate.
- [ ] Effects do not trigger damage themselves.
- [ ] Effects clean up correctly; restart leaves no stale effects.
- [ ] Fighter readability remains strong.
- [ ] Effect counts are performance-conscious.
- [ ] Mobile/browser performance remains acceptable.

### Out of Scope

Effect-driven gameplay, new damage events, combat mechanics, and all Phase 3
global exclusions.

## US-24 — Combat Audio Foundation

### User Story

As a player, I want combat audio feedback so that movement, attacks, hits, and
victory have stronger impact.

### Objective

Establish a minimal, browser-safe audio foundation for existing combat events.

### Dependencies

US-23 — Combat VFX & Atmosphere.

### Design Gate

Partial: audio-direction approval required before asset selection/integration.

### Scope

Basic attack, successful hit, victory/defeat, and optional restrained arena
ambience. Use original, appropriately licensed, or otherwise safe audio; do not
extract Game of Thrones audio. The user story expresses experience goals, not
a requirement to add separate movement sounds in this minimal scope.

### Acceptance Criteria

- [ ] Attack audio plays reliably.
- [ ] Hit audio corresponds to valid hit feedback.
- [ ] Victory audio occurs once.
- [ ] Restart does not duplicate audio.
- [ ] Repeated matches do not accumulate playback/listeners.
- [ ] Audio does not control gameplay state.
- [ ] Browser autoplay restrictions are respected.

### Out of Scope

Extracted TV audio, full soundtrack/voice systems, audio-driven combat, and all
Phase 3 global exclusions.

## US-25 — Responsive, Touch & Performance Pass

### User Story

As a player, I want Thrones of Combat to remain playable and readable across
desktop and mobile browsers so that the same deployed game can be enjoyed on
different devices.

### Objective

Complete Phase 3 integration with responsive behavior, touch input, and a
focused performance pass.

### Dependencies

US-24 — Combat Audio Foundation; use the approved US-17–US-24 visual system.

### Design Gate

No major new art direction. Use the approved Phase 3 visual system; Planner
approval is required for any scope expansion.

### Scope

- Desktop: preserve keyboard controls.
- Mobile/tablet: touch movement/attack controls, landscape combat, clear touch
  areas, gameplay visibility, safe areas, and no HUD/control overlap.
- Responsive: appropriate canvas scaling, readable fighters/HUD, preserved
  arena composition, and reasonable aspect-ratio variation.
- Performance: inspect asset sizes, texture usage, animation load,
  particle/effect counts, and audio loading where relevant.

### Acceptance Criteria

- [ ] Desktop keyboard gameplay remains functional.
- [ ] Mobile touch movement and attack work.
- [ ] Controls do not obscure critical combat information.
- [ ] Mobile landscape is playable; HUD and fighters remain readable.
- [ ] Combat logic remains unchanged.
- [ ] Restart works with supported inputs.
- [ ] No duplicate touch handlers accumulate after restart.
- [ ] Deployed production build remains functional.
- [ ] No obvious severe performance regression occurs.

### Out of Scope

New art direction, native application, technology migration, new combat
mechanics, and all Phase 3 global exclusions.

## Phase 3 Definition of Done

The approved illustrated style, one fighter, animation foundation, hit/KO
feedback, one arena, HUD, restrained VFX, audio, and responsive/touch integration
are functional within their gates and scopes. Phase 2 regression checks pass;
restart cleans visual/audio/input state; production build and supported
desktop/mobile browser validation pass without severe performance regression.
Reviewer approval and User validation remain required.

## GitHub Issue Preparation

`scripts/create-phase-3-github-issues.sh` prepares exactly US-17 through US-25
using these story sections as issue bodies and appending global scope exclusions
and Phase 2 regression protection. It follows the Phase 2 exact-title duplicate
checks across open and closed issues and safe label reuse/creation. Pull requests are excluded from
duplicate checks. It never edits or closes existing issues.

The generator must receive Reviewer approval before live execution. Preparing
this document/script does not create issues or authorize Phase 3 implementation.
