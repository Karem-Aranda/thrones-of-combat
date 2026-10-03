import assert from 'node:assert/strict'
import test from 'node:test'
import { makeScene } from './test-us-30-attacks.mjs'
import { ATTACK_DEFINITIONS as definitions, createAttackRuntime } from '../src/game/combat/attackDefinitions.ts'
import { createNeutralReaction, createHitReaction, advanceHitReaction } from '../src/game/combat/hitReaction.ts'
import { advanceVerticalMovement, GROUND_TOP, getCombatCameraScroll } from '../src/game/world/combatWorld.ts'

// Importing the existing scene harness also runs its 45 unchanged combat tests.
// US-32 cases below exercise production reactions and the complete production scene.
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`)
const otherPlayer = player => player === 'playerOne' ? 'playerTwo' : 'playerOne'
const tap = key => {
  key.onDown({ repeat: false, timeStamp: 0 })
  key.onUp({ timeStamp: 1 })
}
const press = (scene, player, id) => tap(scene.attackKeys[player][id])
const confirm = (scene, id, player = 'playerTwo', direction = 1) => {
  const attacker = scene[otherPlayer(player)]
  const defender = scene[player]
  attacker.container.x = 1200
  defender.container.x = 1200 + direction * 100
  scene.updateFacing()
  scene.tryStartAttack(attacker, id)
  scene.advanceAttack(attacker, defender, definitions[id].startupMs)
  assert.equal(defender.health, 100 - definitions[id].damage)
  assert.equal(defender.reaction.remainingMs, definitions[id].hitstunMs)
  return defender
}
const finishReaction = scene => {
  for (let i = 0; i < 100 && [scene.playerOne, scene.playerTwo].some(f => f.reaction.reactionState === 'hitstun'); i++) {
    scene.update(0, 16)
  }
  assert.equal(scene.playerOne.reaction.reactionState, 'neutral')
  assert.equal(scene.playerTwo.reaction.reactionState, 'neutral')
}

test('US-32 neutral defaults are independent and have no displacement', () => {
  const one = createNeutralReaction()
  const two = createNeutralReaction()
  assert.notEqual(one, two)
  assert.deepEqual(one, { reactionState: 'neutral', remainingMs: 0, knockbackVelocity: 0 })
  assert.deepEqual(advanceHitReaction(one, 100), { reaction: one, displacement: 0 })
})

for (const [id, duration, distance, speed] of [['light', 180, 45, 250], ['heavy', 320, 90, 281.25]]) {
  test(`US-32 ${id}: definition owns exact reaction tuning and signed velocity`, () => {
    assert.equal(definitions[id].hitstunMs, duration)
    assert.equal(definitions[id].knockbackDistance, distance)
    for (const direction of [-1, 1]) {
      const reaction = createHitReaction(definitions[id], direction)
      assert.equal(reaction.reactionState, 'hitstun')
      assert.equal(reaction.remainingMs, duration)
      assert.equal(reaction.knockbackVelocity, direction * speed)
    }
  })
  test(`US-32 ${id}: partial final frame expires exactly without overshoot or mutation`, () => {
    const initial = createHitReaction(definitions[id], 1)
    const first = advanceHitReaction(initial, duration - 7)
    assert.equal(initial.remainingMs, duration)
    assert.equal(first.reaction.remainingMs, 7)
    const last = advanceHitReaction(first.reaction, 1000)
    near(first.displacement + last.displacement, distance)
    assert.deepEqual(last.reaction, createNeutralReaction())
    assert.equal(advanceHitReaction(last.reaction, 1000).displacement, 0)
  })
  test(`US-32 ${id}: invalid or negative delta cannot advance reaction`, () => {
    const initial = createHitReaction(definitions[id], -1)
    for (const delta of [-10, NaN, Infinity, -Infinity, 0]) {
      const result = advanceHitReaction(initial, delta)
      assert.deepEqual(result.reaction, initial)
      assert.equal(result.displacement, 0)
    }
  })
  test(`US-32 ${id}: confirmation starts full duration and no instant teleport`, () => {
    const scene = makeScene()
    scene.playerTwo.container.x = scene.playerOne.container.x + 100
    scene.updateFacing()
    const before = scene.playerTwo.container.x
    press(scene, 'playerOne', id)
    scene.update(0, definitions[id].startupMs)
    assert.equal(scene.playerTwo.reaction.remainingMs, duration)
    assert.equal(scene.playerTwo.container.x, before)
    scene.update(0, 20)
    assert.equal(scene.playerTwo.reaction.remainingMs, duration - 20)
    near(scene.playerTwo.container.x - before, speed * 0.02)
  })
  test(`US-32 ${id}: one hit cannot restart the reaction or repeat damage`, () => {
    const scene = makeScene()
    confirm(scene, id)
    scene.update(0, 40)
    assert.equal(scene.playerTwo.reaction.remainingMs, duration - 40)
    scene.advanceAttack(scene.playerOne, scene.playerTwo, 1)
    assert.equal(scene.playerTwo.reaction.remainingMs, duration - 40)
    assert.equal(scene.playerTwo.health, 100 - definitions[id].damage)
    assert.equal(scene.playerOne.attackHasHit, true)
  })
  for (const direction of [-1, 1]) {
    for (const fps of [30, 60, 120]) {
      test(`US-32 ${id}: scene delivers ${direction * distance}px at ${fps} FPS with exact expiry`, () => {
        const scene = makeScene()
        const defender = confirm(scene, id, 'playerTwo', direction)
        const initialX = defender.container.x
        for (let i = 0; i < 100 && defender.reaction.reactionState === 'hitstun'; i++) scene.update(0, 1000 / fps)
        near(defender.container.x - initialX, direction * distance)
        assert.deepEqual(defender.reaction, createNeutralReaction())
        assert.equal(defender.vertical.footY, 560)
        scene.update(0, 16)
        near(defender.container.x - initialX, direction * distance)
      })
    }
  }
}

for (const player of ['playerOne', 'playerTwo']) {
  test(`US-32 ${player}: movement/jump/both attacks are discarded even on the expiry update`, () => {
    const scene = makeScene()
    const defender = confirm(scene, 'light', player)
    const initialX = defender.container.x
    scene.movementKeys[player].left.isDown = true
    tap(scene.movementKeys[player].jump)
    press(scene, player, 'light')
    press(scene, player, 'heavy')
    scene.update(0, 180)
    near(defender.container.x - initialX, 45)
    assert.equal(defender.vertical.movementState, 'grounded')
    assert.equal(defender.currentAttack, null)
    assert.deepEqual(defender.reaction, createNeutralReaction())
    scene.update(0, 16)
    near(defender.container.x - initialX, 45 - 4.8)
    assert.equal(defender.vertical.movementState, 'grounded')
    assert.equal(defender.currentAttack, null)
    press(scene, player, 'light')
    scene.update(0, 0)
    assert.equal(defender.currentAttack, 'light', 'fresh attack after recovery is accepted')
  })
  test(`US-32 ${player}: held jump cannot buffer, but a new jump after release works`, () => {
    const scene = makeScene()
    const defender = confirm(scene, 'light', player)
    const key = scene.movementKeys[player].jump
    key.onDown({ repeat: false, timeStamp: 0 })
    scene.update(0, 180)
    scene.update(0, 16)
    assert.equal(defender.vertical.movementState, 'grounded')
    key.onUp({ timeStamp: 1 })
    tap(key)
    scene.update(0, 0)
    assert.equal(defender.vertical.movementState, 'rising')
    assert.equal(defender.vertical.velocityY, -650)
  })
  for (const id of ['light', 'heavy']) {
    test(`US-32 ${player} ${id}: held attack never fires later; fresh press is eligible`, () => {
      const scene = makeScene()
      const defender = confirm(scene, 'light', player)
      const key = scene.attackKeys[player][id]
      key.onDown({ repeat: false, timeStamp: 0 })
      scene.update(0, 180)
      key.emit('down', key, { repeat: true })
      scene.update(0, 16)
      assert.equal(defender.currentAttack, null)
      key.onUp({ timeStamp: 1 })
      tap(key)
      scene.update(0, 0)
      assert.equal(defender.currentAttack, id)
    })
  }
  test(`US-32 ${player}: touch holds survive stun while touch jump/attack edges are consumed`, () => {
    const scene = makeScene()
    const defender = confirm(scene, 'light', player)
    scene.touchControls.setPresentation(true, false, false)
    const buttons = ['left', 'jump', 'light', 'heavy'].map(action =>
      scene.touchControls.buttons.find(button => button.player === player && button.action === action))
    for (let i = 0; i < buttons.length; i++) buttons[i].zone.emit('pointerdown', { id: i + 1 })
    const before = defender.container.x
    // readFighterInput is the production keyboard/touch merger; keep the simulated
    // touch presentation stable while testing its intents through production movement.
    const first = scene.readFighterInput(player, scene.movementKeys[player])
    const empty = { leftHeld: false, rightHeld: false, jumpPressed: false, lightPressed: false, heavyPressed: false }
    scene.moveFighters(player === 'playerOne' ? first : empty, player === 'playerTwo' ? first : empty, 180)
    assert.equal(defender.currentAttack, null)
    assert.equal(defender.vertical.movementState, 'grounded')
    near(defender.container.x - before, 45)
    const recovered = scene.readFighterInput(player, scene.movementKeys[player])
    assert.equal(recovered.leftHeld, true)
    assert.equal(recovered.jumpPressed, false)
    assert.equal(recovered.lightPressed, false)
    assert.equal(recovered.heavyPressed, false)
    assert.equal(buttons[0].pointers.size, 1)
    scene.moveFighters(player === 'playerOne' ? recovered : empty, player === 'playerTwo' ? recovered : empty, 16)
    near(defender.container.x - before, 45 - 4.8)
  })
}

test('US-32 semicolon fallback is consumed during stun and works only on a new press after recovery', () => {
  const scene = makeScene()
  confirm(scene, 'light')
  scene.input.keyboard.emit('keydown', { key: ';', repeat: false, isComposing: false })
  scene.update(0, 180)
  scene.input.keyboard.emit('keydown', { key: ';', repeat: true, isComposing: false })
  scene.update(0, 16)
  assert.equal(scene.playerTwo.currentAttack, null)
  scene.input.keyboard.emit('keydown', { key: ';', repeat: false, isComposing: false })
  scene.update(0, 0)
  assert.equal(scene.playerTwo.currentAttack, 'heavy')
})

for (const player of ['playerOne', 'playerTwo']) {
  for (const phase of ['idle', 'startup', 'active', 'recovery']) {
    test(`US-32 ${player}: confirmed hit fully retires ${phase} without a delayed swing or resumed attack`, () => {
      const scene = makeScene()
      const defender = scene[player]
      if (phase !== 'idle') {
        scene.tryStartAttack(defender, 'heavy')
        defender.attackState = phase
        defender.attackPhaseElapsed = 10
        defender.attackHasHit = true
        defender.attackArea.setVisible(phase === 'active')
      }
      scene.jonTrailElapsed = 0
      scene.jonTrail.setVisible(true)
      confirm(scene, 'light', player)
      for (const [key, value] of Object.entries(createAttackRuntime())) assert.equal(defender[key], value)
      assert.equal(defender.attackArea.visible, false)
      if (player === 'playerOne') {
        assert.equal(scene.jonSwingPlayed, true)
        assert.equal(scene.jonTrail.visible, false)
        assert.equal(scene.jonTrailElapsed, 90)
      }
      const swings = scene.swingSound.plays
      finishReaction(scene)
      scene.advanceAttack(defender, scene[otherPlayer(player)], 2000)
      assert.equal(defender.currentAttack, null)
      assert.equal(defender.attackState, 'idle')
      assert.equal(defender.attackArea.visible, false)
      assert.equal(scene.swingSound.plays, swings)
    })
  }
}

for (const direction of [-1, 1]) {
  test(`US-32 world ${direction < 0 ? 'left' : 'right'} edge truncates motion but keeps full stun`, () => {
    const scene = makeScene()
    const defender = confirm(scene, 'heavy', 'playerTwo', direction)
    defender.container.x = direction < 0 ? 40 : 2360
    scene.playerOne.container.x = defender.container.x - direction * 100
    const attackerX = scene.playerOne.container.x
    scene.update(0, 100)
    assert.equal(defender.container.x, direction < 0 ? 36 : 2364)
    assert.equal(defender.reaction.remainingMs, 220)
    assert.equal(scene.playerOne.container.x, attackerX)
    scene.update(0, 220)
    assert.deepEqual(defender.reaction, createNeutralReaction())
    scene.playerOne.container.x -= direction * 100
    scene.update(0, 100)
    assert.equal(defender.container.x, direction < 0 ? 36 : 2364, 'blocked displacement is discarded')
  })
}

test('US-32 maximum separation blocks knockback without moving the stationary opponent or shortening stun', () => {
  const scene = makeScene()
  const defender = confirm(scene, 'light')
  scene.playerOne.container.x = 1000
  defender.container.x = 2080
  scene.update(0, 100)
  assert.equal(scene.playerOne.container.x, 1000)
  assert.equal(defender.container.x, 2080)
  assert.equal(defender.reaction.remainingMs, 80)
  scene.update(0, 80)
  scene.playerOne.container.x = 1500
  scene.update(0, 100)
  assert.equal(defender.container.x, 2080)
})

test('US-32 maximum separation retains proportional sharing between retreat and knockback', () => {
  const scene = makeScene()
  const defender = confirm(scene, 'light')
  scene.playerOne.container.x = 1000
  defender.container.x = 2070
  scene.movementKeys.playerOne.left.isDown = true
  scene.update(0, 100)
  near(1000 - scene.playerOne.container.x, 10 * 30 / 55)
  near(defender.container.x - 2070, 10 * 25 / 55)
  near(defender.container.x - scene.playerOne.container.x, 1080)
  assert.equal(defender.reaction.remainingMs, 80)
})

test('US-32 crossing updates facing but cannot reverse captured knockback direction', () => {
  const scene = makeScene()
  const defender = confirm(scene, 'light')
  scene.playerOne.container.x = 1400
  scene.update(0, 40)
  assert.equal(defender.facing, 'right')
  assert.equal(scene.playerOne.facing, 'left')
  assert.equal(defender.reaction.knockbackVelocity, 250)
  near(defender.container.x, 1310)
})

for (const width of [1280, 1558, 1600]) {
  test(`US-32 camera follows authoritative knockback at ${width}px without vertical scroll or zoom`, () => {
    const scene = makeScene()
    scene.scale.width = width
    confirm(scene, 'heavy')
    const scroll = scene.cameras.main.scrollX
    scene.update(0, 40)
    near(scene.cameras.main.scrollX, getCombatCameraScroll(scroll, scene.playerOne.container.x, scene.playerTwo.container.x, 40, width))
    assert.equal(scene.cameras.main.scrollY, 0)
    assert.equal(scene.cameras.main.zoom, 1)
  })
}

for (const [state, footY, velocityY] of [['rising', 470, -200], ['falling', 470, 200]]) {
  test(`US-32 ${state} defender retains vertical velocity/gravity while horizontal air steering is locked`, () => {
    const scene = makeScene()
    scene.playerTwo.vertical = { movementState: state, footY, velocityY }
    scene.playerTwo.container.y = footY - 70
    const defender = confirm(scene, 'heavy')
    assert.equal(defender.vertical.velocityY, velocityY, 'no vertical launch at confirmation')
    scene.movementKeys.playerTwo.left.isDown = true
    tap(scene.movementKeys.playerTwo.jump)
    press(scene, 'playerTwo', 'light')
    const before = defender.container.x
    const expected = advanceVerticalMovement(defender.vertical, false, 40)
    scene.update(0, 40)
    assert.deepEqual(defender.vertical, expected)
    near(defender.container.x - before, 281.25 * 0.04)
    assert.equal(defender.container.y, expected.footY - 70)
    assert.equal(defender.currentAttack, null)
  })
}

test('US-32 landing during Heavy hitstun remains locked until the reaction expires', () => {
  const scene = makeScene()
  scene.playerTwo.vertical = { movementState: 'falling', footY: 550, velocityY: 300 }
  scene.playerTwo.container.y = 480
  const defender = confirm(scene, 'heavy')
  scene.update(0, 40)
  assert.equal(defender.vertical.movementState, 'grounded')
  assert.equal(defender.vertical.footY, 560)
  assert.equal(defender.reaction.remainingMs, 280)
  press(scene, 'playerTwo', 'heavy')
  scene.update(0, 10)
  assert.equal(defender.currentAttack, null)
})

for (const id of ['light', 'heavy']) {
  test(`US-32 ${id}: P1 nonlethal hit immediately cancels unresolved P2 hit`, () => {
    const scene = makeScene()
    scene.playerTwo.container.x = scene.playerOne.container.x + 100
    scene.updateFacing()
    press(scene, 'playerOne', id)
    press(scene, 'playerTwo', id)
    scene.update(0, definitions[id].startupMs)
    assert.equal(scene.playerOne.health, 100)
    assert.equal(scene.playerTwo.health, 100 - definitions[id].damage)
    assert.equal(scene.playerTwo.currentAttack, null)
    assert.equal(scene.playerTwo.attackState, 'idle')
    assert.equal(scene.playerTwo.reaction.remainingMs, definitions[id].hitstunMs)
  })
}

test('US-32 P1 miss permits P2 Heavy hit and interruption in the same update', () => {
  const scene = makeScene()
  scene.playerTwo.container.x = scene.playerOne.container.x + 184
  scene.updateFacing()
  press(scene, 'playerOne', 'light')
  press(scene, 'playerTwo', 'heavy')
  scene.update(0, 300)
  assert.equal(scene.playerTwo.health, 100)
  assert.equal(scene.playerOne.health, 82)
  assert.equal(scene.playerOne.currentAttack, null)
  assert.equal(scene.playerOne.reaction.remainingMs, 320)
  assert.equal(scene.jonTrail.visible, false)
})

for (const player of ['playerOne', 'playerTwo']) {
  test(`US-32 lethal hit on ${player} clears both reactions/attacks and never starts normal hitstun`, () => {
    const scene = makeScene()
    const defender = scene[player]
    defender.health = 10
    defender.reaction = createHitReaction(definitions.light, -1)
    const attacker = scene[otherPlayer(player)]
    attacker.container.x = 1200
    defender.container.x = 1300
    scene.updateFacing()
    scene.tryStartAttack(attacker, 'heavy')
    scene.advanceAttack(attacker, defender, 300)
    assert.equal(scene.winner, player === 'playerOne' ? 'PLAYER 2' : 'PLAYER 1')
    assert.equal(defender.health, 0)
    for (const fighter of [scene.playerOne, scene.playerTwo]) {
      assert.deepEqual(fighter.reaction, createNeutralReaction())
      assert.equal(fighter.currentAttack, null)
      assert.equal(fighter.attackArea.visible, false)
    }
    const x = defender.container.x
    scene.movementKeys[player].right.isDown = true
    press(scene, player, 'light')
    scene.update(0, 2000)
    assert.equal(defender.container.x, x)
    assert.equal(defender.currentAttack, null)
    assert.deepEqual(defender.reaction, createNeutralReaction())
  })
}

test('US-32 KO retains passive airborne landing and Jon defeated hold', () => {
  const scene = makeScene()
  const jon = scene.playerOne
  jon.health = 10
  jon.vertical = { movementState: 'rising', footY: 470, velocityY: -100 }
  jon.container.y = 400
  scene.playerTwo.container.x = jon.container.x + 100
  scene.updateFacing()
  scene.tryStartAttack(scene.playerTwo, 'heavy')
  scene.advanceAttack(scene.playerTwo, jon, 300)
  assert.equal(jon.vertical.velocityY, -100)
  scene.update(0, 500)
  assert.equal(jon.vertical.footY, GROUND_TOP)
  assert.equal(jon.visual.texture.key, 'jon-ko-hold')
  assert.deepEqual(jon.reaction, createNeutralReaction())
})

test('US-32 Jon uses recoil then guard, never walking from knockback, with unchanged scale/anchors', () => {
  const scene = makeScene()
  const jon = confirm(scene, 'heavy', 'playerOne', -1)
  const scale = jon.visual.scaleY
  scene.update(0, 20)
  assert.equal(jon.visual.texture.key, 'jon-hit-contact')
  scene.update(0, 20)
  assert.equal(jon.visual.texture.key, 'jon-hit-recoil')
  scene.update(0, 140)
  assert.equal(scene.jonHitElapsed, null)
  assert.equal(jon.visual.texture.key, 'jon-snow-guard')
  assert.equal(jon.reaction.remainingMs, 140)
  scene.update(0, 140)
  assert.equal(scene.jonVisualMode, 'idle', 'final knockback frame is not locomotion')
  assert.equal(jon.visual.scaleY, scale)
  near(scale, 720 / 1201)
  assert.equal(jon.visual.scaleX, scale)
  assert.equal(jon.visual.y, 70)
  assert.equal(jon.container.y + jon.visual.y, 560)
  assert.equal(jon.visual.originY, 1329 / 1374)
})

test('US-32 restart clears reaction, velocity, interrupted attack, trail and pending input', () => {
  const scene = makeScene()
  confirm(scene, 'heavy', 'playerOne', -1)
  const oldJon = scene.playerOne
  scene.update(0, 50)
  scene.pendingKeyboardJump.playerOne = true
  scene.pendingKeyboardAttacks.playerOne.heavy = true
  scene.scene.restart()
  for (const fighter of [oldJon, scene.playerOne, scene.playerTwo]) {
    assert.deepEqual(fighter.reaction, createNeutralReaction())
    for (const [key, value] of Object.entries(createAttackRuntime())) assert.equal(fighter[key], value)
  }
  assert.equal(scene.jonTrail.visible, false)
  assert.equal(scene.jonSwingPlayed, false)
  assert.equal(scene.pendingKeyboardAttacks.playerOne.heavy, false)
  assert.equal(scene.pendingKeyboardJump.playerOne, false)
  assert.equal(scene.playerOne.container.x, 820)
  assert.equal(scene.playerTwo.container.x, 1580)
  assert.equal(scene.attackKeys.playerOne.heavy.listenerCount('down'), 1)
  scene.update(0, 100)
  assert.equal(scene.playerOne.container.x, 820)
  assert.equal(scene.playerOne.currentAttack, null)
  assert.equal(scene.swingSound.plays, 0)
})

test('US-32 shutdown retires reaction/attack/cue state with no delayed callbacks', () => {
  const scene = makeScene()
  confirm(scene, 'heavy', 'playerOne', -1)
  scene.events.emit('shutdown')
  for (const fighter of [scene.playerOne, scene.playerTwo]) {
    assert.deepEqual(fighter.reaction, createNeutralReaction())
    assert.equal(fighter.currentAttack, null)
    assert.equal(fighter.attackArea.visible, false)
  }
  assert.equal(scene.jonTrail.visible, false)
  assert.equal(scene.jonSwingPlayed, true)
})
