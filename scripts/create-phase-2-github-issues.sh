#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."

if ! command -v gh >/dev/null 2>&1; then
  printf 'Error: GitHub CLI (gh) is required.\n' >&2
  exit 1
fi

printf 'Checking GitHub authentication...\n'
if ! gh auth status >/dev/null 2>&1; then
  printf 'Error: GitHub CLI is not authenticated. Run gh auth login.\n' >&2
  exit 1
fi

if ! repo="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')" || [[ -z "$repo" ]]; then
  printf 'Error: Cannot determine the current GitHub repository.\n' >&2
  exit 1
fi

# GitHub's issue API includes pull requests; exclude those when checking titles.
existing_titles="$(gh api --paginate "repos/$repo/issues?state=all&per_page=100" \
  --jq '.[] | select(.pull_request == null) | .title')"
existing_labels="$(gh api --paginate "repos/$repo/labels?per_page=100" --jq '.[].name')"

contains_line() {
  local needle="$1" lines="$2" line

  while IFS= read -r line; do
    if [[ "$line" == "$needle" ]]; then
      return 0
    fi
  done <<< "$lines"

  return 1
}

ensure_label() {
  local name="$1" color="$2" description="$3"

  if contains_line "$name" "$existing_labels"; then
    printf 'LABEL  %s (already exists)\n' "$name"
    return
  fi

  printf 'LABEL  %s (creating)\n' "$name"
  gh label create "$name" --repo "$repo" --color "$color" --description "$description"
  existing_labels+=$'\n'"$name"
}

create_issue() {
  local title="$1" labels="$2" body label
  local -a label_args=() requested_labels=()

  if contains_line "$title" "$existing_titles"; then
    printf 'SKIP   %s (already exists)\n' "$title"
    return
  fi

  body="$(cat)"
  IFS=',' read -r -a requested_labels <<< "$labels"
  for label in "${requested_labels[@]}"; do
    label_args+=(--label "$label")
  done

  printf 'CREATE %s\n' "$title"
  gh issue create --repo "$repo" --title "$title" --body "$body" "${label_args[@]}"
  existing_titles+=$'\n'"$title"
}

printf 'Ensuring labels...\n'
ensure_label 'phase-2' '0E8A16' 'Phase 2 fighter and movement foundation'
ensure_label 'gameplay' '1D76DB' 'Core gameplay functionality'
ensure_label 'combat' 'D93F0B' 'Combat system functionality'
ensure_label 'priority:high' 'B60205' 'High-priority work'

create_issue '[US-09] Shared Fighter Foundation' 'phase-2,gameplay,combat,priority:high' <<'BODY'
## User Story

As a developer, I want both combatants to use the same fighter representation so that future combat behavior can be implemented consistently for either fighter.

## Acceptance Criteria

- [ ] Both fighters use the same small typed fighter representation.
- [ ] Fighter data groups the state that genuinely belongs to a fighter.
- [ ] Existing MVP behavior remains unchanged.
- [ ] Player 1 remains the only controllable fighter.
- [ ] Player 2 remains stationary and cannot attack.
- [ ] Health and existing HUD behavior remain correct.
- [ ] Victory and restart remain correct.
- [ ] Phaser remains authoritative for gameplay state.
- [ ] No generalized combat engine is introduced.

## Dependencies

Depends on: completed MVP / US-08.

## Out of Scope

Player 2 movement or attacks, a generalized combat engine, and final visual presentation.
BODY

create_issue '[US-10] Player 2 Movement' 'phase-2,gameplay,priority:high' <<'BODY'
## User Story

As Player 2, I want independent movement controls so that both fighters can position themselves in the arena.

## Acceptance Criteria

- [ ] Player 1 retains A/D movement.
- [ ] Player 2 uses Left Arrow / Right Arrow.
- [ ] Both fighters use consistent delta-based movement and remain inside arena boundaries.
- [ ] Inputs are independent.
- [ ] Existing attack/damage behavior remains intact.
- [ ] No Player 2 attack is introduced yet.

## Dependencies

Depends on: US-09 — Shared Fighter Foundation.

## Out of Scope

Player 2 attacks, jumping, and final visual presentation.
BODY

create_issue '[US-11] Fighter Facing' 'phase-2,gameplay,combat,priority:high' <<'BODY'
## User Story

As a player, I want each fighter to face their opponent so that movement and future attacks use the correct direction.

## Acceptance Criteria

- [ ] Each fighter has explicit left/right facing state.
- [ ] When P1 is left of P2, P1 faces right and P2 faces left.
- [ ] If their horizontal ordering changes, facing updates correctly.
- [ ] Facing belongs to fighter/gameplay state.
- [ ] Behavior can be verified without final character sprites.
- [ ] Existing movement remains functional.
- [ ] No final animation system is required.

## Dependencies

Depends on: US-10 — Player 2 Movement.

## Out of Scope

Final sprites, polished animation, and directional hit detection.
BODY

create_issue '[US-12] Two-Way Basic Attack' 'phase-2,gameplay,combat,priority:high' <<'BODY'
## User Story

As either player, I want to perform a basic attack so that both fighters can participate in combat.

## Acceptance Criteria

- [ ] P1 retains J as basic attack; P2 uses L as basic attack.
- [ ] Both fighters use the same attack-state model and follow startup → active → recovery.
- [ ] Fresh presses start attacks; holding an attack key does not restart attacks every frame.
- [ ] Each fighter has independent attack state.
- [ ] Attack behavior is not implemented through duplicated P1/P2 state machines.
- [ ] No damage-system expansion beyond what is necessary for this story.

## Dependencies

Depends on: US-11 — Fighter Facing.

## Out of Scope

Directional hit detection, two-way damage, combos, and special attacks.
BODY

create_issue '[US-13] Directional Hit Detection' 'phase-2,combat,priority:high' <<'BODY'
## User Story

As a player, I want my attack to hit only when its active area overlaps my opponent in the direction I am facing.

## Acceptance Criteria

- [ ] Either fighter can act as attacker or defender.
- [ ] Right-facing attacks place their active area to the right; left-facing attacks place it to the left.
- [ ] Collision is evaluated only during the active phase.
- [ ] Misses do not register hits.
- [ ] One attack cannot register repeatedly every active frame.
- [ ] Hit geometry comes from fighter/facing state rather than P1-specific hard-coding.
- [ ] No knockback, hit stun, blocking, combo, or special-attack behavior is introduced.

## Dependencies

Depends on: US-12 — Two-Way Basic Attack.

## Out of Scope

Knockback, hit stun, blocking, combos, special attacks, and two-way damage.
BODY

create_issue '[US-14] Two-Way Damage' 'phase-2,combat,priority:high' <<'BODY'
## User Story

As either player, I want successful attacks to reduce my opponent's health so that both fighters participate in the same damage system.

## Acceptance Criteria

- [ ] Both fighters begin with 100 HP; a valid basic attack deals 10 damage.
- [ ] P1 can damage P2 and P2 can damage P1.
- [ ] Misses deal no damage; health cannot fall below zero.
- [ ] The existing HUD represents both fighters' actual health.
- [ ] No duplicate UI health state is introduced.
- [ ] Damage logic is shared rather than separately hard-coded for each player.

## Dependencies

Depends on: US-13 — Directional Hit Detection.

## Out of Scope

Winner-state changes, knockback, hit stun, and HUD visual redesign.
BODY

create_issue '[US-15] Two-Way Victory / Defeat' 'phase-2,combat,priority:high' <<'BODY'
## User Story

As a player, I want the match to end when either fighter reaches zero health so that the correct winner is declared.

## Acceptance Criteria

- [ ] P2 reaching zero declares Player 1 the winner; P1 reaching zero declares Player 2 the winner.
- [ ] Winner presentation identifies the correct player.
- [ ] Match completion occurs once.
- [ ] Movement stops after match end.
- [ ] Neither player can begin new attacks, and further damage cannot occur after match end.
- [ ] Final HUD state remains visible.
- [ ] No rounds, scoring, rematch menu, or best-of system is introduced.

## Dependencies

Depends on: US-14 — Two-Way Damage.

## Out of Scope

Rounds, scoring, rematch menu, best-of system, and two-fighter restart.
BODY

create_issue '[US-16] Two-Fighter Restart' 'phase-2,gameplay,priority:high' <<'BODY'
## User Story

As a player, I want to restart a completed two-player match so that both fighters return to a clean initial state.

## Acceptance Criteria

After match completion, R:

- [ ] Restarts the match without reloading the browser.
- [ ] Resets both fighters to 100 HP and both HUD bars to full.
- [ ] Restores both starting positions and correct initial facing.
- [ ] Resets both attack states, attack timing, and per-attack hit eligibility.
- [ ] Removes the previous winner presentation and resets winner state.
- [ ] Restores movement and attacks for both players.

Additionally:

- [ ] R does not restart an active match.
- [ ] Repeated match/restart cycles do not accumulate stale objects or input handlers.
- [ ] Restart remains Phaser-owned; no React gameplay/reset state is introduced.

## Dependencies

Depends on: US-15 — Two-Way Victory / Defeat.

## Out of Scope

Browser reloads, React-owned reset state, rounds, and rematch menus.
BODY

printf 'Done.\n'
