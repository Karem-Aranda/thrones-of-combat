import assert from 'node:assert/strict'
import test from 'node:test'
import { makeScene } from './test-us-30-attacks.mjs'
import { ATTACK_DEFINITIONS as definitions } from '../src/game/combat/attackDefinitions.ts'
import { findAttackContact } from '../src/game/combat/attackContact.ts'

// Importing the production harness also runs its 45 unchanged attack tests.
const other = player => player === 'playerOne' ? 'playerTwo' : 'playerOne'
const tap = key => { key.onDown({ repeat: false, timeStamp: 0 }); key.onUp({ timeStamp: 1 }) }
const setup = (player, id, excess = 3, remaining = 1) => {
  const s = makeScene(), a = s[player], d = s[other(player)]
  a.container.x = 820
  d.container.x = a.container.x + 72 + definitions[id].reach + excess
  s.updateFacing()
  s.tryStartAttack(a, id)
  a.attackState = 'active'
  a.attackPhaseElapsed = definitions[id].activeMs - remaining
  return { s, a, d }
}
const run = (scene, deltas) => { for (const delta of deltas) scene.update(0, delta) }

for (const player of ['playerOne', 'playerTwo']) for (const id of ['light', 'heavy']) {
  test(`US-35 ${player} ${id}: reported late contact agrees for 16 versus 8+8 ms`, () => {
    for (const deltas of [[16], [8, 8]]) {
      const { s, a, d } = setup(player, id)
      s.movementKeys[other(player)].left.isDown = true
      run(s, deltas)
      assert.equal(d.health, 100)
      assert.equal(a.attackHasHit, false)
      assert.equal(a.combo.damageConfirmed, false)
      assert.equal(d.reaction.reactionState, 'neutral')
      assert.equal(d.presentation.hitElapsed, null)
      assert.equal(s.hitSounds.reduce((n, sound) => n + sound.plays, 0), 0)
      assert.equal(s.impactCue.visible, false)
      assert.equal(a.attackState, 'recovery')
      assert.equal(a.attackPhaseElapsed, 15, 'excess frame time carries to recovery')
    }
  })
  test(`US-35 ${player} ${id}: late guard contact cannot consume hit or cause blockstun`, () => {
    for (const deltas of [[16], [8, 8]]) {
      const { s, a, d } = setup(player, id)
      s.movementKeys[player].right.isDown = true
      s.blockKeys[other(player)].isDown = true
      run(s, deltas)
      assert.equal(d.health, 100)
      assert.equal(d.reaction.reactionState, 'neutral')
      assert.equal(d.guardCueMs, 0)
      assert.equal(a.attackHasHit, false)
      assert.equal(a.combo.damageConfirmed, false)
    }
  })
  test(`US-35 ${player} ${id}: late contact does not interrupt a defender attack`, () => {
    const { s, a, d } = setup(player, id)
    s.tryStartAttack(d, 'heavy')
    s.movementKeys[other(player)].left.isDown = true
    s.update(0, 16)
    assert.equal(d.currentAttack, 'heavy')
    assert.equal(d.attackState, 'startup')
    assert.equal(d.attackPhaseElapsed, 16)
    assert.equal(d.health, 100)
    assert.equal(a.attackHasHit, false)
  })
  test(`US-35 ${player} ${id}: late lethal contact cannot cause KO or victory`, () => {
    const { s, d } = setup(player, id)
    d.health = definitions[id].damage
    s.movementKeys[other(player)].left.isDown = true
    s.update(0, 16)
    assert.equal(d.health, definitions[id].damage)
    assert.equal(s.winner, null)
    assert.equal(d.presentation.koElapsed, null)
    assert.equal(s.koSound.plays, 0)
  })
  test(`US-35 ${player} ${id}: contact in the last legal millisecond survives an expiry-crossing frame`, () => {
    for (const deltas of [[16], [8, 8]]) {
      const { s, a, d } = setup(player, id, 0.15)
      s.movementKeys[other(player)].left.isDown = true
      run(s, deltas)
      assert.equal(d.health, 100 - definitions[id].damage)
      assert.equal(a.attackHasHit, true)
      assert.equal(s.hitSounds.reduce((n, sound) => n + sound.plays, 0), 1)
    }
  })
  test(`US-35 ${player} ${id}: contact exactly at active expiry is excluded`, () => {
    for (const deltas of [[16], [8, 8], [10, 6]]) {
      const { s, a, d } = setup(player, id, 3, 10)
      s.movementKeys[other(player)].left.isDown = true
      run(s, deltas)
      assert.equal(d.health, 100)
      assert.equal(a.attackHasHit, false)
    }
  })
  test(`US-35 ${player} ${id}: startup entry is inclusive and entry movement is sampled legally`, () => {
    const { s, a, d } = setup(player, id, 0.3)
    a.attackState = 'startup'
    a.attackPhaseElapsed = definitions[id].startupMs - 1
    s.movementKeys[other(player)].left.isDown = true
    s.update(0, 1)
    assert.equal(a.attackState, 'active')
    assert.equal(a.attackPhaseElapsed, 0)
    assert.equal(d.health, 100 - definitions[id].damage)
  })
  test(`US-35 ${player} ${id}: contact before startup is not retroactively accepted`, () => {
    const { s, a, d } = setup(player, id, -50)
    a.attackState = 'startup'
    a.attackPhaseElapsed = 0
    s.movementKeys[other(player)].right.isDown = true
    s.update(0, definitions[id].startupMs + definitions[id].activeMs + 20)
    assert.equal(d.health, 100)
    assert.equal(a.attackHasHit, false)
    assert.equal(a.attackState, 'recovery')
    assert.equal(a.attackPhaseElapsed, 20)
  })
  test(`US-35 ${player} ${id}: transient legal contact is preserved across every phase boundary`, () => {
    const { s, a, d } = setup(player, id, 20)
    a.attackState = 'startup'
    a.attackPhaseElapsed = definitions[id].startupMs - 1
    s.movementKeys[other(player)].left.isDown = true
    s.update(0, 2000)
    assert.equal(d.health, 100 - definitions[id].damage)
    assert.equal(a.attackState, 'idle')
    assert.equal(a.currentAttack, null)
    assert.equal(s.hitSounds.reduce((n, sound) => n + sound.plays, 0), 1)
  })
  test(`US-35 ${player} ${id}: startup-to-recovery frame excludes contact after the entire active interval`, () => {
    const { s, a, d } = setup(player, id, 300 * (1 + definitions[id].activeMs + 5) / 1000)
    a.attackState = 'startup'
    a.attackPhaseElapsed = definitions[id].startupMs - 1
    s.movementKeys[other(player)].left.isDown = true
    s.update(0, definitions[id].activeMs + 32)
    assert.equal(d.health, 100)
    assert.equal(a.attackHasHit, false)
    assert.equal(a.combo.damageConfirmed, false)
    assert.equal(a.attackState, 'recovery')
    assert.equal(a.attackPhaseElapsed, 31)
  })
  test(`US-35 ${player} ${id}: already-expired active state cannot register stationary contact`, () => {
    const { s, a, d } = setup(player, id, -20, 0)
    s.update(0, 0)
    assert.equal(d.health, 100)
    assert.equal(a.attackState, 'recovery')
    assert.equal(a.attackHasHit, false)
  })
}

test('US-35 same-frame valid attacks retain P1-first interruption authority and single-hit effects', () => {
  const s = makeScene()
  s.playerTwo.container.x = s.playerOne.container.x + 100
  s.updateFacing()
  for (const a of [s.playerOne, s.playerTwo]) {
    s.tryStartAttack(a, 'light'); a.attackState = 'active'; a.attackPhaseElapsed = 219
  }
  s.update(0, 16)
  assert.equal(s.playerOne.health, 100)
  assert.equal(s.playerTwo.health, 90)
  assert.equal(s.playerTwo.currentAttack, null)
  s.update(0, 16)
  assert.equal(s.playerTwo.health, 90)
  assert.equal(s.hitSounds.reduce((n, sound) => n + sound.plays, 0), 1)
})

for (const player of ['playerOne', 'playerTwo']) for (const id of ['light', 'heavy']) {
  test(`US-35 ${player} continuation ${id}: buffer uses shortened startup with no pre-launch elapsed`, () => {
    const { s, a, d } = setup(player, 'light', -72, 220)
    s.update(0, 0)
    assert.equal(a.combo.damageConfirmed, true)
    tap(s.attackKeys[player][id])
    s.update(0, 10)
    assert.equal(a.combo.step, 2)
    assert.equal(a.attackPhaseElapsed, 0)
    assert.equal(a.attackState, 'startup')
    s.update(0, id === 'light' ? 120 : 160)
    assert.equal(d.health, 90 - definitions[id].damage)
    assert.equal(a.combo.step, 2)
    s.update(0, 2000)
    assert.equal(a.currentAttack, null)
  })
}

const geometry = { fighterWidth: 72, fighterHeight: 140, reach: 100, attackHeight: 70,
  worldWidth: 2400, groundTop: 560, gravity: 1800 }
const motion = (x, overrides = {}) => ({ x, y: 490, velocityX: 0, horizontalMs: Infinity,
  velocityY: 0, airborne: false, ...overrides })
test('US-35 contact paths account for world-edge clamping, not end-position interpolation', () => {
  const hit = findAttackContact(motion(36), motion(210, { velocityX: -300 }), 0, 10, false, geometry)
  assert.ok(hit && hit.timeMs < 10)
  assert.equal(findAttackContact(motion(36), motion(210, { velocityX: -300 }), 0, 5, false, geometry), null)
  assert.ok(findAttackContact(motion(36), motion(210, { velocityX: -300 }), 800, 900, false, geometry),
    'contact after the moving defender has reached the world edge remains valid')
})
test('US-35 vertical contact follows gravity and landing, not linear endpoint interpolation', () => {
  const jumping = motion(920, { airborne: true, velocityY: -650 })
  assert.equal(findAttackContact(motion(820), jumping, 300, 400, false, geometry), null)
  assert.ok(findAttackContact(motion(820), jumping, 600, 650, false, geometry))
})
test('US-35 a stopped reaction path cannot spend movement beyond its remaining duration', () => {
  assert.equal(findAttackContact(motion(820), motion(995, { velocityX: -300, horizontalMs: 5 }),
    0, 16, true, geometry), null)
})
