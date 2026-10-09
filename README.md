# Thrones of Combat

**Thrones of Combat** is a browser-based 2D fighting-game project built with
React, TypeScript, Vite, and Phaser 4. Alaric Duskbane and Lyra Thornvale are
illustrated fighters battling in the layered Northward Gate arena.

## Current status

**Phase 4 — Core Fighting Experience, QA in progress (US-35).** The playable
game supports two independently controlled fighters, automatic facing,
horizontal movement, grounded jumps with air steering, Light/Heavy attacks,
confirmed-hit two-link combos, Block/blockstun, hitstun and knockback.
Both fighters have 100 HP; Light deals 10 damage and Heavy deals 18.
Either fighter can win. Gameplay locks at KO while airborne fighters settle;
restart restores the match. Health bars, combat VFX and procedural audio are
presentation systems driven by Phaser-owned gameplay state.

Historical: Phase 1 was the placeholder MVP; Phase 2 established shared,
bilateral combat; Phase 3 added presentation and initial mobile support.

## Controls

| Action | P1 — Alaric Duskbane | P2 — Lyra Thornvale |
|---|---|---|
| Move | `A` / `D` | Left / Right Arrow |
| Jump | `W` | Up Arrow |
| Hold Block | `S` | Down Arrow |
| Light attack | `J` | `L` |
| Heavy attack | `K` | `;` (semicolon) |
| Completed-match restart | `R` | `R` |

Jumps require a fresh grounded press; attacks are grounded-only. A confirmed
first Light can link into one Light or Heavy continuation. There is no general
input queue or free cancel system.

On landscape touch devices, P1 uses a floating joystick placed by touching the
left half, with Jump, Block, Light and Heavy buttons on the right. Joystick and
actions support simultaneous touches. P2 remains keyboard-only in this mobile
MVP. A touch restart is available after match completion; portrait play requests
device rotation. Desktop keyboard controls remain available for both fighters.

## Run locally

```bash
nvm use 24
npm install
npm run dev
```

Validate the production build with:

```bash
npm run build
node --test scripts/test-*.mjs
git diff --check
```

## Architecture

React owns the application shell and the Phaser container/lifecycle. Phaser owns
the scenes, rendering, input, movement, combat, health, HUD, match state, and
restart. Gameplay state stays inside Phaser.

## Development status

The [Phase 2 epic](docs/phase-2-epic.md) is historical planning, not the current
implementation status. See individual story documents in `docs/` for later work.

## Known limitations

- Illustrated weapons/body sizes do not exactly match the authoritative
  gameplay rectangles; artwork can clip at extreme world edges.
- Minor painted-frame variation and brisk recovery transitions remain.
- P1-first resolution is the intentional simultaneous-hit authority.
- Physical-device multitouch, safe areas and filtering require device QA;
  Node tests double browser, renderer and audio services.
- Existing Vite large-chunk warning and further loading/performance profiling
  remain technical debt. Footsteps and future music/mix work are deferred.
- Build before running the full tests: visual asset checks inspect `dist/`.
