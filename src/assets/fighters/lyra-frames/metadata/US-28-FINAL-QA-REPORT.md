# US-28 — Final Sprite QA and Alpha Cleanup

Date: 2026-10-08. Result: technical asset checks pass; existing visual/runtime warnings remain for Planner review. Developer integration is NOT authorized.

## Before / after

| Check | Before | Cleaned delivery |
|---|---:|---:|
| Individual RGBA8 textures | 24 | 24 |
| Canvas, every texture | 512×512 | 512×512, unchanged |
| Detached nonzero-alpha pixels | 1,169 | 815 conservatively preserved near edges |
| Confirmed isolated background pixels | 354 | 0 |
| Alpha changed on the connected character/weapon | — | 0 pixels |
| RGB changed anywhere, including transparent pixels | — | 0 values |
| Compressed PNG bytes | 1,403,172 | 1,400,834 (1.336 MiB) |
| Decoded RGBA8 texture memory | 24 MiB | 24 MiB |
| Rebuilt preview versus original decoded RGB | — | Identical, all 30 displayed frames |

The 354 removed pixels had alpha 1–4/255 and belonged to detached components at least four source pixels from the complete connected silhouette. All four alpha-location sheets were inspected before removal. Only their alpha was set to zero. There was no repainting, generation, resizing, trimming, re-registration, feathering, erosion, global alpha threshold or color correction.

The 815 retained pixels are detached fragments only two or three source pixels from the silhouette, including hair/face, clothing, soles and fine blade edges. They are preserved conservatively because they can be part of antialiasing or resampling fringe. This is intentionally NOT a claim of zero detached alpha pixels. Removing every faint fragment would exceed a safe isolated-background cleanup. No obvious bright halo or clipped edge was found in the complete dark-background and light-checkerboard inspections; device-specific filtering is still untested.

Original production PNGs and all four approved canonical masters remain byte-identical to their pre-cleanup files. Cleaned delivery copies have new hashes because of the explicitly authorized alpha edits. The connected approved artwork and all other pixel values are unchanged. Source lineage is documented separately from final cleaned hashes.

## Inventory, manifest and registration

All 24 exact case-sensitive filenames and keys are verified in `asset-inventory.csv`; each key equals its PNG filename stem. Manifest coverage is 24/24, with no missing or additional texture. Counts remain: Guard 1, additional idle 3, movement 6, attack startup 2, active 3, recovery 3, Rising 1, Falling 1, hit reaction 2, KO 2. Block reuses Guard; Light/Heavy share the same attack artwork. No landing/victory textures were added.

The CSV, animation manifest, preview-sequence definition and technical contract are copied unchanged. Frame order, weights, holds and illustrative preview delays are unchanged. All PNGs are 512×512, color type 6, 8-bit RGBA, with transparent exterior and unique file hashes. Nonzero-alpha content retains at least 46 source pixels of canvas margin after removal of remote specks; no clipping or alpha trimming.

Root remains `(256,448)`, normalized origin `(0.5,0.875)`, right-facing artwork. Shared scale remains `190/259 = 0.7335907335907336`, rounded `0.733591`; Guard body reference is 190 logical pixels, Jon 240, on the same baseline. Thresholded character/weapon bounds at alpha 8, 32, 64, 128 and 255 are unchanged in every frame. No dynamic pose was forced to occupy 190 pixels vertically.

Grounded sole/root conventions and virtual airborne root are unchanged. Review-only 36-logical-pixel airborne lift remains confined to previews. KO's intentional foreground handguard extends below the body ground line; it was not cropped. The unchanged Jon/Lyra comparison is included under `previews/`.

## Six existing animation previews reviewed

Every original WebP frame was decoded and examined in sequence, including loop endpoints; filmstrips are in `qa-evidence/existing-*-filmstrip.png`. This is offline frame-by-frame visual QA, not a claim of real-time Phaser playback. All six cleaned WebPs preserve dimensions, frame counts, ordering, delays and looping. Their decoded RGB frames are exactly identical to the old previews, demonstrating that cleanup introduces no visible flicker or motion/alignment change at this review scale/background.

| Preview | Frames | Continuity / remaining warning |
|---|---:|---|
| Idle | 6 | Stable planted silhouette and identity. Small existing head, hand, cloth and blade-rendering differences may shimmer when cycling; no added blink or registration shift. |
| Movement | 6 | Alternating support/contact poses remain recognizable. Existing painted head/cloth variation and the high-knee frame 6→contact frame 1 seam warrant moving-world playback review. Crown variation from frame 5→6 is 11 source pixels (about 8.1 logical pixels), consistent with bobbing but not a pixel-locked rig. |
| Attack return | 10 | Readable coil→thrust→withdrawal, consistent narrow sword. Existing recovery 2→3 rises briskly (about 32.3 logical pixels at crown); recovery 3→Guard has a further 6.6-logical-pixel crown change. Active1→2 endpoint and point contrast vary. Planner should accept these transitions explicitly; no timing or painted pose was changed. |
| Hit return | 4 | Grounded recoil and original identity remain readable. Return to Guard is an intentional snap; fine brushwork changes need runtime sampling review. |
| Airborne state change | 2 | Approved descending Falling remains intact, sword visible, virtual root consistent. This is a held Rising/Falling demonstration, not a complete jump cycle or validated apex transition. Repeated loop reset is review-only. |
| KO settle | 2 | Compact grounded settle, face exposed and weapon clear. Hold has no internal animation flicker. Replay from Hold→Collapse is a review-loop reset, not proposed gameplay resurrection. |

The review delays are illustrative, not proposed gameplay durations. No automatic repaint or continuity “fix” was performed: those would require separate approval.

## Memory and remaining warnings

Decoded memory: `24 × 512 × 512 × 4 = 25,165,824 bytes = 24 MiB`. With all mip levels down to 1×1: `33,554,400 bytes`, approximately 32 MiB. These totals exclude driver overhead, atlas padding, duplicate CPU/GPU copies, previews and native masters. Alpha cleanup/compressed-file reduction does not reduce decoded memory.

1. **Preserved edge fringe:** 815 faint edge-adjacent pixels intentionally remain. Their removal is not automatically safe. Connected antialiasing is unchanged.
2. **Painted continuity:** minor brushwork/landmark variation and the movement/attack transitions noted above remain. Real-time flicker, foot sliding, cancellation, mirrored presentation and mobile/device-pixel-ratio filtering were not tested.
3. **Fine weapon point:** at 190-pixel presentation its apparent endpoint depends on scene contrast and filtering; validate in Phaser only after authorization.
4. **Existing collision presentation mismatch:** readable Active2/3 tip remains about +148.92 logical pixels from root, versus unchanged Light +136 and Heavy +161 endpoints: approximately 12.92 past Light and 12.08 short of Heavy. Active1 is about +138.65. The 72×140 authoritative hurtbox also remains unchanged. These are Planner decisions, not permission to change reach, weapon scale, damage, movement or timing.

## Final package / handoff

Use only the 24 PNGs under `textures/` as integration candidates. `previews/` and `qa-evidence/` are non-runtime review artifacts. `final-qa-audit.json`, per-texture cleanup CSV, removed-pixel coordinate list and SHA-256 checksums make the cleanup auditable. Source provenance is not a second animation/transform contract; never apply historical native resampling factors again.

Final asset folder: `/Users/karemara/.codex/visualizations/2026/09/27/01a0e0e7-fe92-7862-9b01-febc8ad03ec8/us28-lyra-final-qa-cleaned-2026-10-08/`

Package: `US-28-Lyra-24-Textures-Final-QA-2026-10-08.zip`. Original production package and canonical masters were not overwritten. No game repository files, mechanics, Git branches, commits, pushes or PRs were changed or created.

Awaiting Planner authorization before Developer integration.
