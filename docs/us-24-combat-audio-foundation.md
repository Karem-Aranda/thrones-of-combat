# US-24 — Combat Audio Foundation

The four cues are original, procedurally synthesized for this project by scripts/generate-combat-audio.mjs. They use no third-party samples, licensed soundtrack, dialogue, or recognizable commercial effects. The script outputs temporary WAV files; only the selected assets are loaded by Phaser.

| Cue | Format | Duration | Size | Volume |
| --- | --- | ---: | ---: | ---: |
| Longclaw swing | mono WAV, 22,050 Hz / 16-bit | 0.19 s | 8,424 B | 0.27 |
| Confirmed hit | mono WAV, 22,050 Hz / 16-bit | 0.16 s | 7,100 B | 0.55 |
| KO impact | mono WAV, 22,050 Hz / 16-bit | 0.37 s | 16,362 B | 0.60 |
| Northward Gate ambience | mono WAV, 11,025 Hz / 8-bit | 24 s | 264,644 B | 0.10 |

Total payload: 296,530 bytes (about 290 KiB). The local converter could not encode MP3 or OGG, so lightweight PCM WAV is used. The ambience waveform is periodic at the loop boundary.

Audio observes existing combat state: Jon's swing plays once when startup crosses 140 ms, whether the attack hits or misses. A valid nonlethal hit plays a shared cue for either fighter; a lethal hit plays only the KO cue, once per match. A locked sound manager discards combat cues rather than queuing them. Phaser unlocks audio through normal user interaction, including keyboard input; the scene then starts one subtle ambience loop.

The scene owns one swing sound, two reusable hit sounds, and one KO sound. These are stopped and removed on shutdown/restart. The game-wide Sound Manager keeps one ambience sound for reuse across scene restarts, without duplicate loops or increasing volume. No extra unlock listener or audio timer is added. Gameplay, VFX, HUD, and arena authority remain unchanged.

## Validation and deferred debt

Run Node 24 build and git diff --check. In a browser, check locked startup, unlock, idle ambience, Jon and Player 2 hits/misses, lethal-hit replacement, repeated restarts, and console output.

High-resolution fighter animation textures make initial visual readiness/loading noticeably slower. Measurement and optimization belong to US-25, not this story.

Future audio work may add movement-synchronized footsteps and revisit the ambience mix if music is introduced. In any future music mix, combat-critical cues must remain perceptible without becoming harsh or fatiguing.
