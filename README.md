# Thrones of Combat

**Thrones of Combat** is a browser-based 2D fighting-game project built with
React, TypeScript, Vite, and Phaser 4. The current fighters and arena use
placeholder shapes; they are not the final visual presentation.

## Current status

**Phase 1 / MVP — Complete.** The game launches in a browser and includes a
fighting arena, Player 1 movement, a basic attack, hit detection, damage,
combat health bars, victory/defeat, and match restart. Player 2 is stationary
and cannot attack in the MVP.

## Controls

- `A` — move Player 1 left
- `D` — move Player 1 right
- `J` — Player 1 basic attack
- `R` — restart after the match ends

## Run locally

```bash
npm install
npm run dev
```

Validate the production build with:

```bash
npm run build
```

## Architecture

React owns the application shell and the Phaser container/lifecycle. Phaser owns
the scenes, rendering, input, movement, combat, health, HUD, match state, and
restart. Gameplay state stays inside Phaser.

## Development status

Phase 2 is planned but not yet implemented. See the
[Phase 2 — Fighter & Movement Foundation epic](docs/phase-2-epic.md) for its
scope, user stories, and dependencies.
