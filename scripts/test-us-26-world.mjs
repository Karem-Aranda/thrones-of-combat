import assert from 'node:assert/strict'
import test from 'node:test'
import {
  VIEWPORT_WIDTH, WORLD_WIDTH, MAX_FIGHTER_SEPARATION,
  moveFightersWithinWorld, getCombatCameraTarget, getCombatCameraScroll,
} from '../src/game/world/combatWorld.ts'

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`)
const halfWidth = 36

test('world limits account for the entire fighter width', () => {
  assert.deepEqual(moveFightersWithinWorld(100, 500, -1000, -1000, halfWidth), [36, 36])
  assert.deepEqual(moveFightersWithinWorld(1900, 2300, 1000, 1000, halfWidth), [2364, 2364])
})

test('separation blocks only outward movement, leaving the stationary opponent unchanged', () => {
  assert.deepEqual(moveFightersWithinWorld(300, 1380, -5, 0, halfWidth), [300, 1380])
  assert.deepEqual(moveFightersWithinWorld(1380, 300, 0, -5, halfWidth), [1380, 300])
  assert.deepEqual(moveFightersWithinWorld(300, 1380, 5, 5, halfWidth), [305, 1385])
  assert.deepEqual(moveFightersWithinWorld(300, 1380, 5, -5, halfWidth), [305, 1375])
})

test('both players share blocked outward movement without an update-order advantage', () => {
  const result = moveFightersWithinWorld(300, 1378, -5, 5, halfWidth)
  assert.deepEqual(result, [299, 1379])
  assert.deepEqual(moveFightersWithinWorld(1378, 300, 5, -5, halfWidth), [1379, 299])
})

test('crossing is allowed and the proposed order still respects separation on long frames', () => {
  assert.deepEqual(moveFightersWithinWorld(600, 602, 5, -5, halfWidth), [605, 597])
  const [one, two] = moveFightersWithinWorld(600, 602, 2000, -2000, halfWidth)
  assert.ok(one > two)
  near(one - two, MAX_FIGHTER_SEPARATION)
})

test('containment always preserves bounds and never moves a fighter farther than intended', () => {
  for (let one = 36; one <= 2364; one += 97) {
    for (let two = 36; two <= 2364; two += 97) {
      if (Math.abs(one - two) > MAX_FIGHTER_SEPARATION) continue
      for (const d1 of [-3000, -5, 0, 5, 3000]) {
        for (const d2 of [-3000, -5, 0, 5, 3000]) {
          const [a, b] = moveFightersWithinWorld(one, two, d1, d2, halfWidth)
          assert.ok(a >= 36 && a <= 2364 && b >= 36 && b <= 2364)
          assert.ok(Math.abs(a - b) <= MAX_FIGHTER_SEPARATION + 1e-8)
          assert.ok(a >= Math.min(one, one + d1) - 1e-8 && a <= Math.max(one, one + d1) + 1e-8)
          assert.ok(b >= Math.min(two, two + d2) - 1e-8 && b <= Math.max(two, two + d2) + 1e-8)
        }
      }
    }
  }
})

test('free movement stays at 300 px/s across 30, 60, and 120 fps', () => {
  for (const fps of [30, 60, 120]) {
    let positions = [820, 1580]
    for (let frame = 0; frame < fps; frame++) {
      positions = moveFightersWithinWorld(...positions, 300 / fps, 300 / fps, halfWidth)
    }
    near(positions[0], 1120)
    near(positions[1], 1880)
  }
})

test('camera initializes at the combat midpoint and respects both world edges', () => {
  assert.equal(getCombatCameraTarget(820, 1580), 560)
  assert.equal(getCombatCameraTarget(36, 500), 0)
  assert.equal(getCombatCameraTarget(1900, 2364), WORLD_WIDTH - VIEWPORT_WIDTH)
})

test('camera smoothing has the same static-target response at different frame rates', () => {
  const results = [30, 60, 120].map(fps => {
    let scroll = 560
    for (let i = 0; i < fps; i++) scroll = getCombatCameraScroll(scroll, 900, 1700, 1000 / fps)
    return scroll
  })
  near(results[0], results[1])
  near(results[1], results[2])
})

test('camera safety clamping keeps both fighter bodies visible even while smoothing lags', () => {
  for (let one = 36; one <= 2364; one += 97) {
    for (let two = 36; two <= 2364; two += 97) {
      if (Math.abs(one - two) > MAX_FIGHTER_SEPARATION) continue
      for (const previous of [0, 560, 1120]) {
        const scroll = getCombatCameraScroll(previous, one, two, 1000 / 60)
        assert.ok(scroll >= 0 && scroll <= WORLD_WIDTH - VIEWPORT_WIDTH)
        assert.ok(Math.min(one, two) - halfWidth >= scroll)
        assert.ok(Math.max(one, two) + halfWidth <= scroll + VIEWPORT_WIDTH)
      }
    }
  }
})
