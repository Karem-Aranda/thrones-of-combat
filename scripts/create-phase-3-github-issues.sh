#!/usr/bin/env bash

set -euo pipefail

# Review this generator and docs/phase-3-epic.md before authorizing live execution.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."
epic_file='docs/phase-3-epic.md'

contains_line() {
  local needle="$1" lines="$2" line

  while IFS= read -r line; do
    if [[ "$line" == "$needle" ]]; then
      return 0
    fi
  done <<< "$lines"

  return 1
}

# Read one exact level-two section; promote story subsections for GitHub bodies.
section_body() {
  awk -v heading="$1" '
    $0 == heading { found = 1; next }
    found && /^## / { exit }
    found { sub(/^### /, "## "); print }
  ' "$epic_file"
}

if [[ ! -f "$epic_file" ]]; then
  printf 'Error: Missing %s.\n' "$epic_file" >&2
  exit 1
fi

stories=(
  'US-17 — Visual Art Direction & Asset Foundation'
  'US-18 — First Fighter Visual Integration'
  'US-19 — Fighter Animation Foundation'
  'US-20 — Attack, Hit & KO Visual Feedback'
  'US-21 — Game of Thrones Arena Foundation'
  'US-22 — Combat HUD Redesign'
  'US-23 — Combat VFX & Atmosphere'
  'US-24 — Combat Audio Foundation'
  'US-25 — Responsive, Touch & Performance Pass'
)
titles=()
bodies=()
regression_body="$(section_body '## Phase 2 Regression Protection')"
exclusions_body="$(section_body '## Phase 3 Out of Scope')"
if [[ -z "$regression_body" || -z "$exclusions_body" ]]; then
  printf 'Error: Missing regression protection or global scope exclusions.\n' >&2
  exit 1
fi

# Validate every body before any GitHub mutation. The epic is the source of truth.
for story in "${stories[@]}"; do
  body="$(section_body "## $story")"
  for section in 'User Story' 'Objective' 'Dependencies' 'Design Gate' 'Scope' 'Acceptance Criteria' 'Out of Scope'; do
    if ! contains_line "## $section" "$body"; then
      printf 'Error: %s is missing %s.\n' "$story" "$section" >&2
      exit 1
    fi
  done
  titles+=("[${story/ — /] }")
  bodies+=("$body"$'\n\n## Phase 3 Global Exclusions\n\n'"$exclusions_body"$'\n\n## Phase 2 Regression Protection\n\n'"$regression_body")
done

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
if [[ "$repo" != 'Karem-Aranda/thrones-of-combat' ]]; then
  printf 'Error: Unexpected repository: %s.\n' "$repo" >&2
  exit 1
fi

# GitHub's issue API includes pull requests; exclude those from duplicate checks.
existing_titles="$(gh api --paginate "repos/$repo/issues?state=all&per_page=100" \
  --jq '.[] | select(.pull_request == null) | .title')"
existing_labels="$(gh api --paginate "repos/$repo/labels?per_page=100" --jq '.[].name')"

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

printf 'Ensuring labels...\n'
ensure_label 'phase-3' '5319E7' 'Phase 3 visual combat experience'
ensure_label 'priority:high' 'B60205' 'High-priority work'

for index in "${!titles[@]}"; do
  title="${titles[$index]}"
  if contains_line "$title" "$existing_titles"; then
    printf 'SKIP   %s (already exists)\n' "$title"
    continue
  fi

  printf 'CREATE %s\n' "$title"
  gh issue create --repo "$repo" --title "$title" --body "${bodies[$index]}" \
    --label 'phase-3' --label 'priority:high'
  existing_titles+=$'\n'"$title"
done

printf 'Done.\n'
