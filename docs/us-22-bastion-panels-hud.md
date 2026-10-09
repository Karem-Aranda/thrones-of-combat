# US-22 — Bastion Panels combat HUD

The combat HUD uses one original, transparent `hud-bastion-panel.png` asset for both fighters. The source is 860 × 200 pixels (about 281 KB) and each Phaser image displays at 430 × 100 design pixels. The right panel mirrors the same image. Its iron, steel, and worn-leather surface contains no baked-in names, bars, portraits, or heraldry. The asset was generated for this implementation using the Northward Gate architecture only as a material/style reference, then cropped and resized for the approved HUD footprint; it is not the design-study mockup.

Phaser owns all HUD objects. `BootScene` loads the panel; `CombatScene` places it above the existing arena and draws live text, frame, dark trough, and health fill. The left panel starts at (40, 36), the right at (810, 36), leaving the middle of the 1280 × 720 playfield open. Their frames are at (62, 82) and (832, 82), each 386 × 34. Their fills begin at (66, 86) and (836, 86), each 378 × 26 at full health. Current names (US-36) are live Georgia text: `ALARIC DUSKBANE` and `LYRA THORNVALE`.

Each fill reads its existing `Fighter.health`; there is no separate HUD health state. Its horizontal scale is clamped `health / 100`. The left fill is anchored to its left edge, so its right edge recedes as Jon loses health. The right fill is anchored to its right edge, so its left edge advances as Player 2 loses health. Both therefore empty away from the center. At zero, the fill is hidden and the trough remains visible. Health colors change immediately: 51–100 `#BE9D77`, 21–50 `#AD8969`, and 1–20 `#A36F5B`. Restart creates fresh HUD objects and restores their full width from the fighters' reset health.

This is presentation only. Combat timing (180 ms startup, 220 ms active, 300 ms recovery), movement, controls, geometry, 10-point damage, match resolution, KO presentation, restart, arena art, and Phaser scaling are unchanged. No React HUD or DOM overlay is introduced.

## Validation checklist

- Build and whitespace checks: `npm run build`, `git diff --check`.
- Browser: confirm initial full bars and exact names; test damage in both directions and the corresponding outward depletion; inspect roughly 50%, 20%, and empty tracks; win as either fighter, restart with `R`, and confirm full bars return.
- Check panel transparency and alignment against the Northward Gate, console errors, desktop composition, and mobile-landscape readability.

User manual validation remains pending Reviewer inspection.
