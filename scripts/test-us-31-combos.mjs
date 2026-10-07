import assert from 'node:assert/strict'
import test from 'node:test'
import { makeScene } from './test-us-30-attacks.mjs'
import { ATTACK_DEFINITIONS as definitions } from '../src/game/combat/attackDefinitions.ts'
import { createComboRuntime, canContinue, COMBO_CONTINUATIONS } from '../src/game/combat/comboDefinitions.ts'
import { createHitReaction } from '../src/game/combat/hitReaction.ts'

// The shared production-scene harness also registers its 45 unchanged tests.
const tap = key => { key.onDown({ repeat: false, timeStamp: 0 }); key.onUp({ timeStamp: 1 }) }
const press = (s, player, id) => tap(s.attackKeys[player][id])
const opponent = player => player === 'playerOne' ? 'playerTwo' : 'playerOne'
const confirmed = (player = 'playerOne', separation = 100) => {
  const s = makeScene()
  s.playerTwo.container.x = s.playerOne.container.x + separation
  s.updateFacing()
  press(s, player, 'light')
  s.update(0, 180)
  assert.equal(s[opponent(player)].health, 90)
  assert.equal(canContinue(s[player], s[player].combo), true)
  return s
}

test('US-31 explicit two-link overrides do not mutate normal definitions', () => {
  assert.deepEqual(COMBO_CONTINUATIONS, { light: 120, heavy: 160 })
  assert.equal(Object.isFrozen(COMBO_CONTINUATIONS), true)
  assert.equal(definitions.light.startupMs, 180)
  assert.equal(definitions.heavy.startupMs, 300)
  assert.equal(definitions.light.hitstunMs, 180)
  assert.equal(definitions.light.knockbackDistance, 45)
  assert.notEqual(createComboRuntime(), createComboRuntime())
})

for (const player of ['playerOne', 'playerTwo']) {
  for (const id of ['light', 'heavy']) {
    test(`US-31 ${player} Light → ${id}: clean launch uses override and ends at depth two`, () => {
      const s = confirmed(player)
      press(s, player, id)
      s.update(0, 10)
      const a = s[player]
      assert.equal(a.combo.step, 2)
      assert.equal(a.combo.bufferedAttack, null)
      assert.equal(a.currentAttack, id)
      assert.equal(a.attackState, 'startup')
      assert.equal(a.attackPhaseElapsed, 0, 'pre-launch delta must not advance continuation')
      s.advanceAttack(a, s[opponent(player)], COMBO_CONTINUATIONS[id] - 1)
      assert.equal(a.attackState, 'startup')
      s.advanceAttack(a, s[opponent(player)], 1)
      assert.equal(a.attackState, 'active')
      assert.equal(s[opponent(player)].health, 90 - definitions[id].damage)
      press(s, player, 'light')
      s.update(0, 1)
      assert.equal(a.combo.step, 2)
      assert.equal(a.currentAttack, id)
      assert.equal(a.combo.bufferedAttack, null)
      s.update(0, 2000)
      assert.deepEqual(a.combo, createComboRuntime())
      assert.equal(a.currentAttack, null)
    })
    for (const fps of [30, 60, 120]) {
      test(`US-31 ${player} Light → ${id} at ${fps} FPS: no defender control update between hits`, () => {
        const s = confirmed(player)
        const a = s[player], d = s[opponent(player)], dt = 1000 / fps
        const other = opponent(player)
        press(s, player, id)
        let frames = 0
        while (d.health === 90 && frames++ < 30) {
          assert.equal(d.reaction.reactionState, 'hitstun', 'defender must be locked at every update start')
          s.movementKeys[other].left.isDown = true
          tap(s.movementKeys[other].jump)
          press(s, other, 'light')
          press(s, other, 'heavy')
          const beforeX = d.container.x
          const requested = d.reaction.knockbackVelocity * Math.min(dt, d.reaction.remainingMs) / 1000
          s.update(0, dt)
          assert.ok(Math.abs(d.container.x - beforeX - requested) < 1e-8, 'no voluntary movement')
          assert.equal(d.vertical.movementState, 'grounded', 'jump discarded')
          assert.equal(d.currentAttack, null, 'attacks discarded')
        }
        assert.equal(d.health, 90 - definitions[id].damage)
        assert.equal(a.combo.step, 2)
      })
    }
  }
  test(`US-31 ${player}: one slot does not overwrite and Light wins simultaneous intentions`, () => {
    const s = confirmed(player), a = s[player]
    s.bufferContinuation(a, 'heavy')
    s.bufferContinuation(a, 'light')
    assert.equal(a.combo.bufferedAttack, 'heavy')
    s.launchContinuation(a)
    assert.equal(a.currentAttack, 'heavy')
    const t = confirmed(player)
    press(t, player, 'heavy'); press(t, player, 'light')
    t.update(0, 0)
    assert.equal(t[player].currentAttack, 'light')
    assert.equal(t[player].combo.step, 2)
  })
  test(`US-31 ${player}: pre-confirm press cannot qualify retroactively`, () => {
    const s = makeScene()
    s.playerTwo.container.x = s.playerOne.container.x + 100; s.updateFacing()
    s.tryStartAttack(s[player], 'light')
    press(s, player, 'heavy')
    s.update(0, 180)
    assert.equal(s[player].combo.step, 1)
    assert.equal(s[player].combo.bufferedAttack, null)
    s.update(0, 0)
    assert.equal(s[player].currentAttack, 'light')
  })
  test(`US-31 ${player}: held key/repeats never populate a continuation`, () => {
    const s = makeScene()
    s.playerTwo.container.x = s.playerOne.container.x + 100; s.updateFacing()
    const key = s.attackKeys[player].light
    key.onDown({ repeat: false, timeStamp: 0 })
    s.update(0, 180)
    key.emit('down', key, { repeat: true })
    s.update(0, 1000)
    assert.equal(s[player].currentAttack, null)
    assert.deepEqual(s[player].combo, createComboRuntime())
  })
  test(`US-31 ${player}: Heavy root and unconfirmed active never unlock`, () => {
    for (const id of ['light', 'heavy']) {
      const s = makeScene(), a = s[player]
      s.tryStartAttack(a, id); s.advanceAttack(a, s[opponent(player)], definitions[id].startupMs)
      assert.equal(canContinue(a, a.combo), false)
      s.bufferContinuation(a, 'heavy')
      assert.equal(a.combo.bufferedAttack, null)
    }
    const s = confirmed(player), a = s[player]
    s.cancelAttack(a); s.tryStartAttack(a, 'heavy')
    s.advanceAttack(a, s[opponent(player)], 300)
    assert.equal(a.attackHasHit, true)
    assert.equal(canContinue(a, a.combo), false)
  })
  test(`US-31 ${player}: active-window expiry discards buffer; recovery cannot accept`, () => {
    const s = confirmed(player), a = s[player]
    s.bufferContinuation(a, 'heavy')
    s.advanceAttack(a, s[opponent(player)], 220)
    assert.equal(a.attackState, 'recovery')
    assert.equal(a.combo.bufferedAttack, null)
    s.bufferContinuation(a, 'light'); s.launchContinuation(a)
    assert.equal(a.combo.step, 1)
    assert.equal(a.currentAttack, 'light')
    s.update(0, 300)
    assert.deepEqual(a.combo, createComboRuntime())
  })
  test(`US-31 ${player}: large delta expires a queued input without duplicating elapsed time`, () => {
    const s = confirmed(player)
    press(s, player, 'heavy'); s.update(0, 1500)
    assert.equal(s[player].currentAttack, null)
    assert.deepEqual(s[player].combo, createComboRuntime())
    assert.equal(s[opponent(player)].health, 90)
  })
  test(`US-31 ${player}: jump plus continuation stays grounded, airborne eligibility is discarded`, () => {
    const s = confirmed(player), a = s[player]
    tap(s.movementKeys[player].jump); press(s, player, 'heavy'); s.update(0, 0)
    assert.equal(a.vertical.movementState, 'grounded', 'existing active attack prevents jumping')
    assert.equal(a.combo.step, 2)
    const t = confirmed(player), b = t[player]
    t.bufferContinuation(b, 'light')
    b.vertical.movementState = 'rising'
    t.launchContinuation(b)
    assert.deepEqual(b.combo, createComboRuntime())
    assert.equal(b.currentAttack, 'light', 'no second attack launched')
  })
  test(`US-31 ${player}: second attack may whiff naturally without homing or reach changes`, () => {
    const s = confirmed(player, 170), a = s[player], d = s[opponent(player)]
    const x = a.container.x
    press(s, player, 'light'); s.update(0, 10)
    s.update(0, 120)
    s.update(0, 1000)
    assert.equal(d.health, 90)
    assert.equal(a.container.x, x)
    assert.equal(a.attackArea.width, 100)
    assert.deepEqual(a.combo, createComboRuntime())
  })
  test(`US-31 ${player}: interruption clears eligibility and buffer, including launched attack`, () => {
    for (const launched of [false, true]) {
      const s = confirmed(player), a = s[player], d = s[opponent(player)]
      s.bufferContinuation(a, 'heavy')
      if (launched) s.launchContinuation(a)
      d.reaction.reactionState = 'neutral'; d.reaction.remainingMs = 0
      s.tryStartAttack(d, 'light'); s.advanceAttack(d, a, 180)
      assert.deepEqual(a.combo, createComboRuntime())
      assert.equal(a.currentAttack, null)
      s.update(0, 2000)
      assert.equal(a.currentAttack, null)
    }
  })
  for (const hit of ['first', 'second']) {
    test(`US-31 ${player}: ${hit} lethal hit clears both combo records`, () => {
      const s = makeScene()
      s.playerTwo.container.x = s.playerOne.container.x + 100; s.updateFacing()
      s[opponent(player)].health = hit === 'first' ? 10 : 20
      press(s, player, 'light'); s.update(0, 180)
      if (hit === 'second') { press(s, player, 'light'); s.update(0, 0); s.update(0, 120) }
      assert.equal(s.winner, player === 'playerOne' ? 'PLAYER 1' : 'PLAYER 2')
      for (const a of [s.playerOne, s.playerTwo]) assert.deepEqual(a.combo, createComboRuntime())
    })
  }
}

test('US-31 P1 confirmed hit clears an unresolved P2 continuation buffer before launch', () => {
  const s = confirmed('playerTwo')
  s.bufferContinuation(s.playerTwo, 'heavy')
  s.playerOne.reaction.reactionState = 'neutral'
  s.tryStartAttack(s.playerOne, 'light')
  s.update(0, 180)
  assert.equal(s.playerTwo.health, 90)
  assert.deepEqual(s.playerTwo.combo, createComboRuntime())
  assert.equal(s.playerTwo.currentAttack, null)
})
test('US-31 P1 miss leaves P2 buffered continuation eligible', () => {
  const s = confirmed('playerTwo')
  s.playerOne.reaction.reactionState = 'neutral'
  s.playerOne.container.x = 100; s.playerTwo.container.x = 900; s.updateFacing()
  s.tryStartAttack(s.playerOne, 'light')
  press(s, 'playerTwo', 'heavy'); s.update(0, 180)
  assert.equal(s.playerTwo.currentAttack, 'heavy')
  assert.equal(s.playerTwo.combo.step, 2)
})
test('US-31 stun/eligibility loss discards slot immediately', () => {
  const s = confirmed(), a = s.playerOne
  s.bufferContinuation(a, 'heavy')
  a.reaction = createHitReaction(definitions.light, -1)
  s.bufferContinuation(a, null)
  assert.deepEqual(a.combo, createComboRuntime())
})
test('US-31 semicolon fallback and keyboard/touch coalescence feed the same continuation', () => {
  const s = confirmed('playerTwo')
  s.input.keyboard.emit('keydown', { key: ';', repeat: false, isComposing: false })
  s.touchControls.pendingAttack.playerTwo.heavy = true
  s.update(0, 0)
  assert.equal(s.playerTwo.currentAttack, 'heavy')
  assert.equal(s.playerTwo.combo.step, 2)
  s.update(0, 2000)
  assert.equal(s.playerTwo.currentAttack, null)
})
for (const player of ['playerOne', 'playerTwo']) {
  test(`US-31 ${player}: touch fresh intentions support both links without redesign`, () => {
    for (const id of ['light', 'heavy']) {
      const s = confirmed(player)
      s.touchControls.pendingAttack[player][id] = true
      s.update(0, 0)
      assert.equal(s[player].currentAttack, id)
      assert.equal(s[player].combo.step, 2)
      assert.equal(s.touchControls.pendingAttack[player][id], false)
    }
  })
}
test('US-31 continuation presentation maps startup fractions and keeps scale/feet', () => {
  for (const id of ['light', 'heavy']) {
    const s = confirmed(), a = s.playerOne
    s.bufferContinuation(a, id); s.launchContinuation(a)
    assert.equal(s.jonTrail.visible, false)
    assert.equal(s.jonSwingPlayed, false)
    assert.equal(s.getJonAttackFrame(a), 'jon-attack-s-1')
    a.attackPhaseElapsed = COMBO_CONTINUATIONS[id] / 2
    assert.equal(s.getJonAttackFrame(a), 'jon-attack-s-2')
    s.swingSound.isPlaying = false
    s.advanceAttack(a, s.playerTwo, definitions[id].swingCueMs - a.attackPhaseElapsed - 1)
    assert.equal(s.jonSwingPlayed, false)
    s.advanceAttack(a, s.playerTwo, 1)
    assert.equal(s.jonSwingPlayed, true)
    assert.equal(a.visual.scaleY, 720 / 1201)
    assert.equal(a.visual.y, 70)
  }
})
test('US-31 continuation can hit an airborne defender without changing vertical physics', () => {
  const s = confirmed()
  press(s, 'playerOne', 'heavy'); s.update(0, 0)
  const d = s.playerTwo
  d.vertical = { movementState: 'falling', footY: 500, velocityY: 50 }
  d.container.y = 430
  s.advanceAttack(s.playerOne, d, 160)
  assert.equal(d.health, 72)
  assert.equal(d.vertical.velocityY, 50)
  assert.equal(d.vertical.footY, 500)
  assert.equal(d.reaction.remainingMs, 320)
})
test('US-31 restart/shutdown repeatedly clear records and preserve one semicolon listener', () => {
  const s = confirmed()
  for (let i = 0; i < 3; i++) {
    s.playerOne.combo = { step: 1, bufferedAttack: 'heavy' }
    const old = s.playerOne
    s.scene.restart()
    assert.deepEqual(old.combo, createComboRuntime())
    assert.deepEqual(s.playerOne.combo, createComboRuntime())
    assert.equal(s.input.keyboard.listenerCount('keydown'), 1)
    assert.equal(s.playerOne.container.x, 820)
    assert.equal(s.playerTwo.container.x, 1580)
  }
  s.playerTwo.combo = { step: 1, bufferedAttack: 'light' }
  s.events.emit('shutdown')
  assert.deepEqual(s.playerTwo.combo, createComboRuntime())
})
