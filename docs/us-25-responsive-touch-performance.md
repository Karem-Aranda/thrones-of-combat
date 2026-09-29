# US-25 — Responsive, Touch & Performance Pass

The 22 Jon PNGs were resampled to a maximum dimension of 458 pixels with
macOS sips-316. The attack-active frame was checked first for alpha and sword
edges at source and gameplay display sizes; apparent scale and sole alignment
were checked against the existing source landmarks. In-game visual validation
remains required. No transparency trimming, atlas, or spritesheet was introduced.

The unmodified source images are in Git commit 40bffe4. To reproduce the
optimized images, start from those source files and run:

    for image in src/assets/fighters/jon-snow-guard.png src/assets/fighters/jon-snow-frames/*.png; do
      sips -Z 458 "$image"
    done

Do not rerun the command on already-optimized PNGs. The runtime keeps
the original-source sole landmarks as normalized origins and compensates for
the one-third image dimensions using visual scale only. Fighter and attack
collision geometry remains independent of image dimensions.

| Jon fighter PNGs | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Count | 22 | 22 | — |
| Disk bytes | 25,677,854 | 3,284,529 | 87.2% |
| Approximate decoded RGBA | 132.03 MiB | 14.65 MiB | 88.9% |

Decoded memory is pixel count × four bytes and does not include GPU copies,
browser decoding overhead, or mipmaps. Loading-time improvement must be
measured in a browser; these byte reductions are not a timing result.

Phaser retains its 1280×720 FIT canvas and combat coordinates. The surrounding
page now constrains the canvas by available viewport dimensions and safe-area
padding. Touch controls feed the same Phaser movement, attack, and restart
paths as keyboard input. Portrait touch viewports cover combat and suspend
combat input without restarting the match.
