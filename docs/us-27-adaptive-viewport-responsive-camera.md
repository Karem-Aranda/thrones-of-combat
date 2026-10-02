# US-27 — Adaptive Viewport & Responsive Camera

The game keeps a 720 px logical height and adapts its visible logical width to
the actual game parent's landscape aspect ratio. The width is clamped to 1280–1600 px:
1280 preserves the existing combat framing and 1080 px fighter-separation
rule, while 1600 matches the native width of the stationary Northward Gate sky
and prevents stretching or uncovered background. Phaser FIT remains in place,
so the canvas keeps its aspect ratio and scales uniformly inside its React
container. Mobile landscape uses the dynamic browser viewport edge to edge;
safe insets are applied to critical screen-space UI rather than the whole arena.
Desktop retains its existing outer padding. An available 16:9 parent still gives
the 1280×720 logical baseline.

The CombatScene responds to Phaser ScaleManager resize events by updating the
game size, world-bounded camera framing, screen-space health panels/result text,
screen-pinned snowfall, and existing touch-control anchors. Player 2's touch
cluster stays attached to the right edge, Player 1's stays attached to the left,
and restart stays centered in the safe area. The scale listener and parent
ResizeObserver are removed on scene shutdown so restarts do not accumulate
resize callbacks. The Northward Gate's sky and
distance layers are recentered for the active view; its world-space architecture
and courtyard remain unchanged.

The portrait rotate-device presentation and touch semantics remain unchanged.
No movement, fighter
separation, attack, damage, victory, restart, arena asset, or HUD health logic
was changed.

## Validation

The US-26 world test suite now has ten tests, including viewport-independent
initial/restart world spawns (P1 820, P2 1580) at widths 1280, 1558, and 1600.
CombatScene uses the fixed-baseline world spawn helper on every create/restart;
only camera framing uses the current viewport width. The suite also exercises adaptive
width selection at the 1280×720 baseline, an 844×390 landscape viewport, a wide
desktop viewport, a narrow/short landscape viewport, and portrait clamping.

With the previous fixed 1280×720 FIT canvas, a wide parent retained the 16:9
composition and left horizontal space unused. The adaptive view materially
reduces that space on 844×390 mobile landscape and wider desktop ratios. Near
16:9 the existing FIT behavior remains appropriate. At ratios requiring
more than 1600 logical pixels, the cap deliberately returns to FIT-style
letterboxing instead of revealing sky beyond its authored edges. The canvas
still scales uniformly in every case.

## Product Owner device fix pass

Two source-confirmed causes of avoidable margins were found: the mobile
container deducted 8 px plus safe insets on every edge, while the logical view
was selected from window dimensions instead of the smaller available parent.
`100dvh` (with `100vh` fallback) already existed and is retained. The parent
now has no coarse-pointer landscape padding or intrinsic flex minimum; the
ResizeObserver synchronizes Phaser parent sizing when dynamic browser chrome
changes CSS height, including changes without a window resize event.

The arena can render beneath a notch, but the HUD, touch clusters, result, and
restart are positioned inside the usable safe region. CSS exposes the actual
`env(safe-area-inset-*)` values. CombatScene subtracts any existing FIT margins
and converts the remaining physical insets to logical pixels. Each touch cluster
shifts as a unit, retaining button spacing. HUD health, depletion direction,
input semantics, and gameplay geometry are not changed.

### Measured desktop-browser layouts

These are real browser CSS measurements, **not real-phone measurements**.
The available browser reports a fine pointer, so it uses desktop 24 px padding;
native device emulation was unavailable. Dimensions are rounded to 0.01 px.

| Browser viewport | Parent (before / after) | Canvas before | Canvas after | Logical view after |
| --- | --- | --- | --- | --- |
| 1280×720 | 1232×672 / 1232×672 | 1194.66×672 | 1232×672 | 1320×720 |
| 844×390 | 796×342 / 796×342 | 740.05×342 | 760×342 | 1600×720 |
| 640×280 | 592×232 / 592×232 | 515.55×232 | 515.55×232 | 1600×720 |
| 2560×1080 | 2512×1032 / 2512×1032 | 2293.33×1032 | 2293.33×1032 | 1600×720 |
| 390×844 | 342×796 / 342×796 | 342×192.38 | 342×192.38 | 1280×720 |

Portrait → 844×390 returned to 1600×720, CSS 760×342. All settled layouts
had one canvas, no page overflow, and no captured console warnings/errors.
The coarse-pointer portrait overlay and real notch geometry still require
Product Owner verification on hardware.

For comparison, **calculated, not device-measured** 844×390 mobile layout with
zero safe insets changes from parent 828×374 / canvas ≈809.29×374 to parent
844×390 / canvas ≈843.92×390. Real safe insets previously reduced the parent
further; now they protect UI without reducing arena coverage. At ratios above
1600/720, some FIT letterboxing remains intentional (for example, calculated
640×280 mobile canvas ≈622.22×280). Browser chrome outside the available dynamic
viewport is not canvas space and cannot be reclaimed without a separate browser
mode. No Fullscreen API is required.

### Audio investigation — no speculative changes

All four audio assets, their generator, sound configuration, mix, unlock/cue
code, and ambience lifecycle are unchanged from merged US-24. Twenty existing
input/combat/audio/KO/health methods were compared against HEAD and match exactly;
the audio setup/mix block also matches. Resize/orientation callbacks do not create
or play sounds. Ambience is reused from the game sound manager across restart;
transient sounds are removed on scene shutdown. Swing is capped at one instance,
confirmed hits at two reusable instances, and KO at one cue per match. Locked
historical cues remain discarded. Installed Phaser already resumes its context
on unlock/focus and includes its own iOS visibility workaround.

Read-only WAV analysis confirmed RIFF/WAVE PCM format 1, mono, with no clipped
source samples:

| Asset | Sample rate / depth | Duration | Absolute sample peak | Bytes |
| --- | --- | --- | --- | --- |
| Longclaw swing | 22050 Hz / 16-bit | 0.190 s | 0.620 | 8424 |
| Confirmed hit | 22050 Hz / 16-bit | 0.160 s | 0.720 | 7100 |
| KO impact | 22050 Hz / 16-bit | 0.370 s | 0.720 | 16362 |
| Ambience | 11025 Hz / 8-bit | 24.000 s | 0.414 | 264644 |

Volumes remain 0.27 / 0.55 / 0.60 / 0.10. Source peaks do **not** rule out summed
mix clipping: a conservative two-hit + swing + ambience peak bound is about 1.001,
though that assumes peak alignment and does not establish an actual clipped mix.
No real-device audio capture or listening reproduction was available. Therefore
there is no proven US-27 audio defect or justified low-risk audio patch. Device
decoding/resampling/output, visibility/resume, mix overlap, and indirect rendering
load remain investigation boundaries rather than established causes. No assets,
gain values, audio triggers, or audio architecture were changed.

### Validation and remaining device checks

Node 24: world tests **10/10**, production build/type check **PASS**, `git diff --check`
**PASS**. The existing Vite large-chunk warning remains non-blocking.

Product Owner should verify normal landscape browser occupancy with browser
chrome visible/hidden, safe HUD/touch edges, portrait → landscape, multi-touch,
both victory/restart paths, and first-input/background-resume audio. Record phone,
OS, browser version, and whether distortion affects ambience alone or only combat
overlap. The complete real-device audio and gameplay re-test remains outstanding.
No commit, staging, push, PR, issue closure, or later-story work is included.
