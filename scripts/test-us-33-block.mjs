import assert from 'node:assert/strict'
import test from 'node:test'
import { makeScene, setInputEnvironment } from './test-us-30-attacks.mjs'
import { BLOCK_DEFINITIONS, createBlockReaction, guardEligible, guardFacesContact } from '../src/game/combat/blockDefinitions.ts'
import { ATTACK_DEFINITIONS as attacks } from '../src/game/combat/attackDefinitions.ts'
import { createHitReaction, advanceHitReaction } from '../src/game/combat/hitReaction.ts'
import { canContinue } from '../src/game/combat/comboDefinitions.ts'
import { advanceVerticalMovement } from '../src/game/world/combatWorld.ts'

// Complete production scene, real Phaser keys/intersections; renderer/audio doubled.
// Importing the shared harness also registers the existing 45 attack regressions.
const other = p => p === 'playerOne' ? 'playerTwo' : 'playerOne'
const tap = key => { key.onDown({ repeat: false, timeStamp: 0 }); key.onUp({ timeStamp: 1 }) }
const press = (s, p, id) => tap(s.attackKeys[p][id])
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)
const close = s => { s.playerTwo.container.x = s.playerOne.container.x + 100; s.updateFacing() }
const blocked = (p, id, hp = 100) => {
  const s = makeScene(); close(s)
  s[p].health = hp
  s.blockKeys[p].onDown({ repeat: false, timeStamp: 0 })
  press(s, other(p), id)
  const x = s[p].container.x
  s.update(0, attacks[id].startupMs)
  assert.equal(s[p].health, hp)
  assert.equal(s[p].container.x, x, 'new reaction does not consume pre-contact delta')
  assert.equal(s[p].reaction.reactionState, 'blockstun')
  return s
}

test('US-33 immutable block tuning and independent full-duration reactions', () => {
  assert.deepEqual(BLOCK_DEFINITIONS, {
    light: { blockstunMs: 120, pushback: 12, velocity: 100 },
    heavy: { blockstunMs: 200, pushback: 24, velocity: 120 },
  })
  for (const id of ['light', 'heavy']) {
    assert.ok(Object.isFrozen(BLOCK_DEFINITIONS[id]))
    assert.notEqual(createBlockReaction(id, 1), createBlockReaction(id, 1))
    for (const sign of [-1, 1]) {
      const r = createBlockReaction(id, sign)
      assert.equal(r.remainingMs, BLOCK_DEFINITIONS[id].blockstunMs)
      assert.equal(r.knockbackVelocity, sign * BLOCK_DEFINITIONS[id].velocity)
      near(advanceHitReaction(r, 1000).displacement, sign * BLOCK_DEFINITIONS[id].pushback)
    }
  }
})

test('US-33 direction predicate covers front, rear and deterministic equal-X', () => {
  assert.ok(guardFacesContact(100, 200, 'right', 'left'))
  assert.ok(!guardFacesContact(100, 200, 'right', 'right'))
  assert.ok(guardFacesContact(200, 100, 'left', 'right'))
  assert.ok(!guardFacesContact(200, 100, 'left', 'left'))
  for (const facing of ['left', 'right']) {
    assert.ok(!guardFacesContact(100, 100, facing, facing))
    assert.ok(guardFacesContact(100, 100, facing, facing === 'left' ? 'right' : 'left'))
  }
})

for (const p of ['playerOne', 'playerTwo']) {
  for (const id of ['light', 'heavy']) {
    test(`US-33 ${p} blocks ${id}: contact consumed, no damage/KO/combo/recoil/hit audio`, () => {
      const s = blocked(p, id, 1), a = s[other(p)], d = s[p]
      assert.equal(d.health, 1); assert.equal(s.winner, null)
      assert.equal(d.reaction.remainingMs, BLOCK_DEFINITIONS[id].blockstunMs)
      assert.equal(a.attackHasHit, true)
      assert.equal(a.combo.damageConfirmed, false)
      assert.equal(canContinue(a, a.combo), false)
      assert.equal(a.reaction.reactionState, 'neutral')
      assert.equal(a.attackState, 'active')
      assert.equal(d.guardIndicator.visible, true)
      assert.equal(s.playerOne.presentation.hitElapsed, null); assert.equal(s.playerOne.presentation.koElapsed, null)
      assert.equal(s.hitSounds.reduce((n, v) => n + v.plays, 0), 0)
      assert.equal(s.koSound.plays, 0)
      assert.equal(s.impactCue.visible, false, 'no ordinary confirmed-hit treatment')
      s.blockKeys[p].onUp({ timeStamp: 1 })
      s.update(0, 1)
      assert.equal(d.health, 1, 'consumed contact cannot damage after guard release')
      s.update(0, attacks[id].activeMs + attacks[id].recoveryMs)
      assert.equal(a.attackState, 'idle', 'attacker recovery is unchanged')
    })
    for (const fps of [30, 60, 120]) {
      test(`US-33 ${p} ${id}: exact pushback at ${fps} FPS and no vertical displacement`, () => {
        const s = blocked(p, id), d = s[p], x = d.container.x, y = d.container.y
        s.blockKeys[p].isDown = false
        for (let n = 0; n < 50 && d.reaction.reactionState !== 'neutral'; n++) s.update(0, 1000 / fps)
        near(d.container.x - x, (p === 'playerOne' ? -1 : 1) * BLOCK_DEFINITIONS[id].pushback)
        assert.equal(d.container.y, y)
        assert.equal(d.reaction.reactionState, 'neutral')
        s.update(0, 1000); near(d.container.x - x, (p === 'playerOne' ? -1 : 1) * BLOCK_DEFINITIONS[id].pushback)
      })
    }
    test(`US-33 ${p} ${id}: release retains full lock through expiry; inputs never buffer`, () => {
      const s = blocked(p, id), d = s[p], x = d.container.x
      s.blockKeys[p].isDown = false
      s.movementKeys[p].right.isDown = true
      tap(s.movementKeys[p].jump); press(s, p, 'light'); press(s, p, 'heavy')
      s.update(0, BLOCK_DEFINITIONS[id].blockstunMs + 10)
      near(d.container.x - x, (p === 'playerOne' ? -1 : 1) * BLOCK_DEFINITIONS[id].pushback)
      assert.equal(d.attackState, 'idle'); assert.equal(d.vertical.movementState, 'grounded')
      assert.equal(d.guardEligible, false)
      const end = d.container.x
      s.update(0, 10); near(d.container.x - end, 3)
      assert.equal(d.attackState, 'idle'); assert.equal(d.vertical.movementState, 'grounded')
    })
    test(`US-33 ${p} ${id}: held re-guard refreshes full timer; release permits replacing hitstun`, () => {
      const s = blocked(p, id), a = s[other(p)], d = s[p]
      s.cancelAttack(a)
      close(s)
      s.tryStartAttack(a, id)
      s.update(0, 0)
      s.advanceAttack(a, d, attacks[id].startupMs)
      assert.equal(d.health, 100)
      assert.equal(d.reaction.remainingMs, BLOCK_DEFINITIONS[id].blockstunMs)
      s.cancelAttack(a); s.blockKeys[p].isDown = false
      s.update(0, 0); s.tryStartAttack(a, id)
      s.advanceAttack(a, d, attacks[id].startupMs)
      assert.equal(d.health, 100 - attacks[id].damage)
      assert.equal(d.reaction.reactionState, 'hitstun')
      assert.equal(d.reaction.remainingMs, attacks[id].hitstunMs)
    })
  }

  test(`US-33 ${p}: guard roots movement and discards jump/Light/Heavy with no release buffer`, () => {
    const s = makeScene(), d = s[p], x = d.container.x
    s.blockKeys[p].isDown = true; s.movementKeys[p].right.isDown = true
    tap(s.movementKeys[p].jump); press(s, p, 'light'); press(s, p, 'heavy')
    s.update(0, 16)
    assert.equal(d.container.x, x); assert.equal(d.attackState, 'idle')
    assert.equal(d.vertical.movementState, 'grounded'); assert.equal(d.guardEligible, true)
    s.blockKeys[p].isDown = false; s.update(0, 16)
    near(d.container.x - x, 4.8); assert.equal(d.attackState, 'idle')
    assert.equal(d.vertical.movementState, 'grounded')
  })
  for (const state of ['startup', 'active', 'recovery']) {
    test(`US-33 ${p}: held Block during own ${state} cannot cancel or protect`, () => {
      const s = makeScene(), a = s[p]
      s.tryStartAttack(a, 'heavy'); a.attackState = state
      s.blockKeys[p].isDown = true; s.update(0, 0)
      assert.equal(a.guardEligible, false); assert.equal(a.attackState, state)
      assert.equal(a.currentAttack, 'heavy')
    })
  }
  test(`US-33 ${p}: airborne/landing and hitstun expiry cannot newly gain guard`, () => {
    const s = makeScene(), d = s[p]
    s.blockKeys[p].isDown = true
    d.vertical = advanceVerticalMovement(d.vertical, true, 100)
    s.update(0, 0); assert.equal(d.guardEligible, false)
    s.update(0, 1000); assert.equal(d.guardEligible, false)
    s.update(0, 0); assert.equal(d.guardEligible, true)
    close(s)
    d.reaction = { ...createHitReaction(attacks.light, 1), remainingMs: 1 }
    s.tryStartAttack(s[other(p)], 'light')
    s[other(p)].attackPhaseElapsed = 179
    s.update(0, 1)
    assert.equal(d.guardEligible, false)
    assert.equal(d.health, 90, 'no newly gained guard on hitstun expiry update')
  })
  test(`US-33 ${p}: invalid attack/airborne guard takes normal damage and can KO`, () => {
    for (const state of ['startup', 'active', 'recovery', 'airborne']) {
      const s = makeScene(), d = s[p], a = s[other(p)]
      s.blockKeys[p].isDown = true
      if (state === 'airborne') d.vertical = advanceVerticalMovement(d.vertical, true, 1)
      else { s.tryStartAttack(d, 'heavy'); d.attackState = state }
      s.update(0, 0); assert.equal(d.guardEligible, false)
      close(s); d.health = 1
      s.tryStartAttack(a, 'light'); s.advanceAttack(a, d, 180)
      assert.equal(d.health, 0)
      assert.equal(s.winner, p === 'playerOne' ? 'PLAYER 2' : 'PLAYER 1')
    }
  })
  for (const follow of ['light', 'heavy']) {
    test(`US-33 ${p}: blocked root Light never unlocks ${follow}`, () => {
      const s = blocked(other(p), 'light'), a = s[p]
      press(s, p, follow); s.update(0, 0)
      assert.equal(a.combo.step, 1); assert.equal(a.currentAttack, 'light')
      assert.equal(a.combo.bufferedAttack, null)
    })
    for (const fps of [30, 60, 120]) {
      test(`US-33 ${p} ${follow} true combo at ${fps} FPS defeats new held guard`, () => {
        const s = makeScene(); close(s); press(s, p, 'light'); s.update(0, 180)
        const d = s[other(p)]
        s.blockKeys[other(p)].isDown = true; press(s, p, follow)
        let n = 0
        while (d.health === 90 && n++ < 30) {
          assert.equal(d.reaction.reactionState, 'hitstun')
          s.update(0, 1000 / fps)
        }
        assert.equal(d.health, 90 - attacks[follow].damage)
      })
    }
    test(`US-33 ${p}: late ${follow} continuation can be blocked and ends at depth two`, () => {
      const s = makeScene(); close(s); press(s, p, 'light'); s.update(0, 180)
      const a = s[p], d = s[other(p)]
      s.blockKeys[other(p)].isDown = true
      s.update(0, 180); s.update(0, 0)
      assert.equal(d.guardEligible, true)
      press(s, p, follow); s.update(0, 0)
      assert.equal(a.combo.step, 2)
      s.update(0, follow === 'light' ? 120 : 160)
      assert.equal(d.health, 90); assert.equal(d.reaction.reactionState, 'blockstun')
      assert.equal(a.combo.step, 2); assert.equal(a.combo.damageConfirmed, false)
      press(s, p, 'heavy'); s.update(0, 2000)
      assert.equal(a.attackState, 'idle'); assert.equal(a.combo.step, 0)
    })
  }
}

for (const id of ['light', 'heavy']) {
  test(`US-33 ${id}: held re-guard protects on blockstun expiry update`, () => {
    const s = blocked('playerTwo', id), a = s.playerOne, d = s.playerTwo
    s.cancelAttack(a); s.tryStartAttack(a, id)
    a.attackPhaseElapsed = attacks[id].startupMs - BLOCK_DEFINITIONS[id].blockstunMs
    s.update(0, BLOCK_DEFINITIONS[id].blockstunMs)
    assert.equal(d.health, 100); assert.equal(d.reaction.remainingMs, BLOCK_DEFINITIONS[id].blockstunMs)
  })
}

test('US-33 direction is evaluated at contact, including crossing and equal-X', () => {
  for (const equal of [false, true]) for (const valid of [false, true]) {
    const s = makeScene(); close(s)
    const a = s.playerOne, d = s.playerTwo
    s.blockKeys.playerTwo.isDown = true; s.update(0, 0)
    if (equal) d.container.x = a.container.x
    // Deliberately expose rear-facing predicate without altering production auto-facing.
    d.facing = valid ? 'left' : 'right'
    s.tryStartAttack(a, 'light'); s.advanceAttack(a, d, 180)
    assert.equal(d.health, valid ? 100 : 90)
  }
  const s = makeScene(); close(s)
  s.blockKeys.playerOne.isDown = true
  const x = s.playerOne.container.x
  s.playerOne.container.x = s.playerTwo.container.x; s.playerTwo.container.x = x
  press(s, 'playerTwo', 'light'); s.update(0, 180)
  assert.equal(s.playerOne.facing, 'left'); assert.equal(s.playerOne.health, 100)
  assert.equal(s.playerOne.reaction.knockbackVelocity, 100)
})

test('US-33 world edges and max separation discard blocked distance without accumulating it', () => {
  for (const edge of ['left', 'right', 'separation']) {
    const s = blocked('playerTwo', 'heavy'), d = s.playerTwo, a = s.playerOne
    if (edge === 'left') { d.container.x = 36; a.container.x = 136; d.reaction.knockbackVelocity = -120 }
    if (edge === 'right') { d.container.x = 2364; a.container.x = 2264 }
    if (edge === 'separation') { a.container.x = 820; d.container.x = 1900 }
    const x = d.container.x
    s.update(0, 200); assert.equal(d.container.x, x)
    a.container.x = d.container.x - 100; s.update(0, 100)
    assert.equal(d.container.x, x); assert.equal(d.reaction.reactionState, 'neutral')
  }
})

test('US-33 proportional max-separation sharing remains unchanged', () => {
  const s = blocked('playerTwo', 'heavy')
  s.playerOne.container.x = 820; s.playerTwo.container.x = 1890
  s.movementKeys.playerOne.left.isDown = true
  s.update(0, 100)
  near(s.playerOne.container.x, 820 - 30 * 10 / 42)
  near(s.playerTwo.container.x, 1890 + 12 * 10 / 42)
  near(s.playerTwo.container.x - s.playerOne.container.x, 1080)
})

test('US-33 keyboard bindings, Down capture and both update-start guard snapshots', () => {
  const s = makeScene(); close(s)
  assert.equal(s.blockKeys.playerOne.keyCode, 83); assert.equal(s.blockKeys.playerTwo.keyCode, 40)
  assert.ok(s.input.keyboard.manager.captures.includes(40))
  s.blockKeys.playerTwo.isDown = true; press(s, 'playerOne', 'light'); s.update(0, 180)
  assert.equal(s.playerTwo.health, 100)
  const t = makeScene(); close(t)
  t.blockKeys.playerOne.isDown = true; press(t, 'playerTwo', 'light'); t.update(0, 180)
  assert.equal(t.playerOne.health, 100)
})

test('US-33 simultaneous attacks preserve P1-first damage/interruption', () => {
  const s = makeScene(); close(s)
  press(s, 'playerOne', 'light'); press(s, 'playerTwo', 'light'); s.update(0, 180)
  assert.equal(s.playerOne.health, 100); assert.equal(s.playerTwo.health, 90)
  assert.equal(s.playerTwo.attackState, 'idle')
})

test('US-33 P1 touch Block clears on release/cancel/out/portrait independently of P2 keyboard Block', () => {
  for (const event of ['pointerup', 'pointerupoutside', 'pointercancel', 'gameout', 'portrait', 'pointerout']) {
    const s = makeScene(); setInputEnvironment(true); s.update(0, 0)
    const buttons = s.touchControls.buttons.filter(b => b.action === 'block')
    assert.equal(buttons[0].active, true)
    assert.equal(buttons[1].active, false)
    buttons[0].zone.emit('pointerdown', { id: 1 }); buttons[1].zone.emit('pointerdown', { id: 2 })
    assert.equal(s.touchControls.isHeld('playerTwo', 'block'), false)
    s.blockKeys.playerTwo.isDown = true
    s.update(0, 0)
    assert.equal(s.playerOne.guardEligible, true); assert.equal(s.playerTwo.guardEligible, true)
    if (event === 'portrait') { setInputEnvironment(true, true); s.update(0, 0) }
    else if (event === 'pointerout') buttons[0].zone.emit(event, { id: 1 })
    else s.input.emit(event, { id: 1 })
    assert.equal(s.touchControls.isHeld('playerOne', 'block'), false)
    assert.equal(s.touchControls.isHeld('playerTwo', 'block'), false)
    assert.equal(s.blockKeys.playerTwo.isDown, event !== 'portrait')
  }
})

test('US-33 guard pose/indicator has no doubled displacement or scale/anchor change', () => {
  const s = blocked('playerOne', 'light'), d = s.playerOne
  const scale = d.visual.scaleX, y = d.visual.y, x = d.container.x
  s.update(0, 20)
  near(d.container.x - x, -2)
  assert.equal(d.visual.texture.key, 'jon-snow-guard')
  assert.equal(d.visual.x, 0); assert.equal(d.visual.y, y); assert.equal(d.visual.scaleX, scale)
  assert.equal(d.guardIndicator.x, 42)
})

test('US-33 focus reset, KO, restart and shutdown clear held guard/reactions/listeners', () => {
  const s = blocked('playerOne', 'heavy')
  s.clearKeyboardPresses(); s.touchControls.clear(); s.update(0, 0)
  assert.equal(s.blockKeys.playerOne.isDown, false); assert.equal(s.playerOne.guardEligible, false)
  assert.equal(s.playerOne.reaction.reactionState, 'blockstun', 'input reset cannot cancel stun')
  s.playerOne.health = 1; s.applyDamage(s.playerOne, 10)
  assert.equal(s.winner, 'PLAYER 2'); assert.equal(s.playerOne.guardIndicator.visible, false)
  assert.equal(s.playerOne.reaction.reactionState, 'neutral')
  s.blockKeys.playerOne.isDown = true; s.update(0, 0)
  assert.equal(s.playerOne.guardEligible, false)
  for (let n = 0; n < 4; n++) {
    s.scene.restart()
    assert.equal(s.blockKeys.playerOne.isDown, false)
    for (const p of ['playerOne', 'playerTwo']) {
      assert.equal(s[p].reaction.reactionState, 'neutral'); assert.equal(s[p].guardEligible, false)
      assert.equal(s[p].guardIndicator.visible, false); assert.equal(s[p].health, 100)
    }
    assert.equal(s.input.listenerCount('pointercancel'), 1)
    assert.equal(s.input.keyboard.listenerCount('keydown'), 1)
  }
  s.blockKeys.playerTwo.isDown = true; s.events.emit('shutdown')
  assert.equal(s.blockKeys.playerTwo.isDown, false)
  assert.equal(s.input.listenerCount('pointercancel'), 0)
  assert.equal(s.input.keyboard.listenerCount('keydown'), 0)
})

test('US-33 guard eligibility explicitly excludes missing hold/inactive/airborne/attack/hitstun', () => {
  assert.ok(guardEligible(true, true, true, true, 'neutral'))
  assert.ok(guardEligible(true, true, true, true, 'blockstun'))
  for (const args of [[false,true,true,true,'neutral'], [true,false,true,true,'neutral'],
    [true,true,false,true,'neutral'], [true,true,true,false,'neutral'], [true,true,true,true,'hitstun']]) {
    assert.equal(guardEligible(...args), false)
  }
})
