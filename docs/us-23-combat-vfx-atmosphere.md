# US-23 — Combat VFX & Atmosphere

US-23 adds three presentation-only Phaser effects to `CombatScene`. No textures, timers, listeners, or gameplay systems were added.

## Effects

- **Longclaw trail:** One reused Graphics object draws a broken, tapered pale-steel streak about 64 px long and up to 6 px wide. The scene observes Jon entering the existing active attack phase, then displays the trail for 90 ms at up to 40% opacity. Its position follows Jon's sword side and mirrors with facing. A miss still produces the trail. The attack's 180 / 220 / 300 ms timing is unchanged.
- **Confirmed-hit contact:** The former circular cue is replaced by one reused directional Graphics slash, about 36 × 20 px, with a narrow steel edge. It appears at the existing defender-side contact position, stays fixed in world space, starts at 75% opacity, and fades within 80 ms. Only the existing confirmed-hit damage path calls it. Each confirmed hit also activates up to three 4 px flecks at up to 60% opacity for at most 140 ms. Misses produce neither contact slash nor flecks.
- **Northward Gate snow:** Exactly 12 background flakes render between the distance and architecture layers, and six near flakes render ahead of the courtyard but behind fighters and HUD. Small Phaser circles drift downward at 12–30 px/s in the background and 26–34 px/s nearby, with a slight leftward wind. Flakes wrap or respawn at design-space edges. There is no density increase for smaller screens.

The maximum live snow count is 18. A six-object fleck pool permits at most six simultaneous hit flecks, so the maximum particle-like count is 24. Trail and contact graphics are separate reused objects. No effect allocates a new display object per frame or per hit.

`create()` clears VFX state and creates one snow layer, one trail, one contact graphic, and the six-fleck pool. Phaser's scene restart discards the prior display list. No VFX timer or event listener is registered, so repeated `R` restarts cannot accumulate duplicate VFX systems.

Fighter health, 10-point damage, movement, facing, attack/hurt geometry, hit confirmation, KO, winner logic, restart, arena geometry, and Bastion Panels HUD remain authoritative and unchanged. VFX only observes the existing attack phase and confirmed-hit path.

## Deferred performance concern (US-25)

The Product Owner noticed slower initial visual loading/render readiness as high-resolution fighter animation textures accumulate. US-25 — Responsive, Touch & Performance Pass owns measurement and optimization. US-23 does not resize, compress, re-encode, or restructure asset preloading.

## Validation

- Run `nvm use 24`, `npm run build`, and `git diff --check`.
- In a browser, check idle two-depth snowfall; Jon attack misses (trail only); Jon and Player 2 confirmed hits (contact plus at most three flecks); both KO paths; and repeated restart without doubled snow or lingering effects.
- Confirm fighter/HUD/gate readability, no console errors, unchanged movement and controls, and 10 damage per valid hit. Mobile landscape composition is a useful follow-up check; final responsive optimization belongs to US-25.
