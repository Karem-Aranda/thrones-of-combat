import assert from 'node:assert/strict'
import test from 'node:test'
import { ATTACK_DEFINITIONS } from '../src/game/combat/attackDefinitions.ts'
import { WORLD_WIDTH } from '../src/game/world/combatWorld.ts'
import { neutralFighterInput, resolveGameMode } from '../src/game/controls/combatInput.ts'
import {
  aiModule, makeScene, setInputEnvironment, dispatchWindowEvent, setDocumentHidden,
} from './test-us-30-attacks.mjs'

const { LyraController, LYRA_AI_TIMING: timing } = aiModule
const geometry = { fighterWidth: 72, worldWidth: WORLD_WIDTH, attacks: ATTACK_DEFINITIONS }
const controller = () => new LyraController(geometry)
const snapshot = (self = {}, opponent = {}, matchActive = true) => Object.freeze({
  self: Object.freeze({ x: 1000, grounded: true, attackState: 'idle', currentAttack: null, reactionState: 'neutral', ...self }),
  opponent: Object.freeze({ x: 1100, grounded: true, attackState: 'idle', currentAttack: null, reactionState: 'neutral', ...opponent }),
  matchActive,
})
const neutral = input => assert.deepEqual(input, neutralFighterInput())
const tap = key => { key.onDown({ repeat: false, timeStamp: 0 }); key.onUp({ timeStamp: 1 }) }
const close = scene => {
  scene.playerOne.container.x = 1100
  scene.playerTwo.container.x = 1000
  scene.updateFacing()
}
const frames = (scene, count, delta = 16) => { for (let i = 0; i < count; i++) scene.update(i * delta, delta) }
const finish = scene => scene.events.emit('shutdown')

test('mode contract defaults safely to Local Versus', () => {
  for (const value of [undefined, null, '', 'invalid', 'local-versus']) assert.equal(resolveGameMode(value), 'local-versus')
  assert.equal(resolveGameMode('single-player'), 'single-player')
})

test('AI starts with a nonzero reaction delay, then emits one fresh attack edge', () => {
  const ai = controller()
  neutral(ai.update(snapshot(), timing.reactionMs - 1))
  assert.equal(ai.update(snapshot(), 1).lightPressed, true)
  assert.equal(ai.state, 'attack')
  neutral(ai.update(snapshot({ attackState: 'startup', currentAttack: 'light' }), 16))
  assert.equal(ai.state, 'recovery')
})

for (const [selfX, opponentX, direction] of [[1580, 820, 'leftHeld'], [820, 1580, 'rightHeld']]) {
  test(`approach chooses ${direction} from world positions`, () => {
    const ai = controller()
    const input = ai.update(snapshot({ x: selfX }, { x: opponentX }), timing.reactionMs)
    assert.equal(ai.state, 'approach')
    assert.equal(input[direction], true)
    assert.equal(input.lightPressed || input.heavyPressed || input.blockHeld, false)
  })
}

test('range uses gameplay width/reach, with hysteresis inside the Light boundary', () => {
  const ai = controller()
  const reach = geometry.fighterWidth + ATTACK_DEFINITIONS.light.reach
  assert.equal(ai.update(snapshot({}, { x: 1000 + reach + 1 }), 200).rightHeld, true)
  assert.equal(ai.update(snapshot({}, { x: 1000 + reach - 1 }), 16).rightHeld, true)
  assert.equal(ai.update(snapshot({}, { x: 1000 + reach - timing.rangeMargin }), 16).lightPressed, true)
})

test('geometry is injected rather than copied into the policy', () => {
  const ai = new LyraController({ ...geometry, fighterWidth: 90 })
  assert.equal(ai.update(snapshot({}, { x: 1185 }), 200).lightPressed, true)
})

test('crossing changes approach direction without changing fighter facing', () => {
  const ai = controller()
  assert.equal(ai.update(snapshot({}, { x: 1500 }), 200).rightHeld, true)
  assert.equal(ai.update(snapshot({}, { x: 500 }), 16).leftHeld, true)
})

test('cooldown bounds attack frequency and the fixed sequence includes Light and Heavy', () => {
  const ai = controller()
  const pulses = []
  for (let time = 20; time <= 10000; time += 20) {
    const input = ai.update(snapshot(), 20)
    assert.equal(input.leftHeld && input.rightHeld, false)
    assert.equal(input.lightPressed && input.heavyPressed, false)
    assert.equal(input.blockHeld && (input.lightPressed || input.heavyPressed || input.leftHeld || input.rightHeld), false)
    assert.equal(input.jumpPressed, false)
    if (input.lightPressed || input.heavyPressed) pulses.push({ time, attack: input.lightPressed ? 'light' : 'heavy' })
  }
  assert.ok(pulses.length > 2 && pulses.length < 11)
  assert.deepEqual(pulses.slice(0, 3).map(p => p.attack), ['light', 'heavy', 'light'])
  for (let i = 1; i < pulses.length; i++) assert.ok(pulses[i].time - pulses[i - 1].time >= timing.attackCooldownMs)
})

test('Heavy selection uses its longer authoritative reach', () => {
  const ai = controller()
  assert.equal(ai.update(snapshot(), 200).lightPressed, true)
  ai.update(snapshot({ attackState: 'recovery', currentAttack: 'light' }), 700)
  assert.equal(ai.update(snapshot(), 0).leftHeld, true)
  ai.update(snapshot(), timing.retreatMs)
  const input = ai.update(snapshot({}, { x: 1185 }), timing.reactionMs)
  assert.equal(input.heavyPressed, true)
})

for (const attack of ['light', 'heavy']) {
  test(`${attack} threat earns a reaction delay before guarding; guard is bounded`, () => {
    const ai = controller()
    const threat = snapshot({}, { attackState: 'startup', currentAttack: attack })
    neutral(ai.update(threat, 0))
    neutral(ai.update(threat, timing.reactionMs - 1))
    assert.equal(ai.update(threat, 1).blockHeld, true)
    assert.equal(ai.state, 'defend')
    assert.equal(ai.update(threat, timing.guardMs - 1).blockHeld, true)
    const released = ai.update(threat, 1)
    assert.equal(released.blockHeld, false)
    assert.equal(released.lightPressed || released.heavyPressed, false)
  })
}

test('disappearing and out-of-range threats cannot become historical guard cues', () => {
  const ai = controller()
  ai.update(snapshot({}, { attackState: 'startup', currentAttack: 'heavy' }), 0)
  assert.equal(ai.update(snapshot({}, { x: 1600, attackState: 'startup', currentAttack: 'heavy' }), 200).blockHeld, false)
  const fresh = controller()
  fresh.update(snapshot({}, { attackState: 'startup', currentAttack: 'heavy' }), 0)
  assert.equal(fresh.update(snapshot(), 200).blockHeld, false)
})

test('defend may hold through legal blockstun, but hitstun immediately clears intentions', () => {
  const ai = controller()
  const opponent = { attackState: 'active', currentAttack: 'heavy' }
  ai.update(snapshot({}, opponent), 0)
  assert.equal(ai.update(snapshot({}, opponent), 200).blockHeld, true)
  assert.equal(ai.update(snapshot({ reactionState: 'blockstun' }, opponent), 16).blockHeld, true)
  neutral(ai.update(snapshot({ reactionState: 'hitstun' }, opponent), 16))
})

for (const self of [
  { grounded: false }, { reactionState: 'hitstun' }, { reactionState: 'blockstun' },
  { attackState: 'startup', currentAttack: 'light' },
  { attackState: 'active', currentAttack: 'heavy' },
  { attackState: 'recovery', currentAttack: 'heavy' },
]) {
  test(`invalid attack state stays neutral: ${JSON.stringify(self)}`, () => neutral(controller().update(snapshot(self), 5000)))
}

test('airborne opponent is not attacked blindly', () => {
  neutral(controller().update(snapshot({}, { grounded: false }), 200))
})

test('completed attack leads to a short retreat, then recovery', () => {
  const ai = controller()
  ai.update(snapshot(), 200)
  ai.update(snapshot({ attackState: 'recovery', currentAttack: 'light' }), 700)
  assert.equal(ai.update(snapshot(), 0).leftHeld, true)
  assert.equal(ai.state, 'retreat')
  neutral(ai.update(snapshot(), timing.retreatMs))
  assert.equal(ai.state, 'recovery')
})

for (const [x, opponentX] of [[36, 136], [WORLD_WIDTH - 36, WORLD_WIDTH - 136]]) {
  test(`retreat cannot request movement through world edge ${x}`, () => {
    const ai = controller()
    ai.update(snapshot({ x }, { x: opponentX }), 200)
    ai.update(snapshot({ x, attackState: 'recovery', currentAttack: 'light' }, { x: opponentX }), 700)
    neutral(ai.update(snapshot({ x }, { x: opponentX }), 0))
  })
}

test('identical observation/time scripts are deterministic and never mutate observations', () => {
  const script = [snapshot({}, { x: 1600 }), snapshot(), snapshot({ attackState: 'active', currentAttack: 'light' }), snapshot()]
  const run = () => {
    const ai = controller()
    return script.map(s => ({ input: ai.update(s, 250), state: ai.state }))
  }
  assert.deepEqual(run(), run())
})

test('reaction deadline is equivalent for aligned 20 ms and 10 ms partitions', () => {
  const run = delta => {
    const ai = controller()
    for (let time = delta; time < 200; time += delta) neutral(ai.update(snapshot(), delta))
    return ai.update(snapshot(), delta)
  }
  assert.deepEqual(run(20), run(10))
  assert.equal(run(20).lightPressed, true)
})

test('invalid deltas do not advance deadlines or produce intentions', () => {
  const ai = controller()
  for (const delta of [-1, NaN, Infinity]) neutral(ai.update(snapshot(), delta))
  neutral(ai.update(snapshot(), 199))
  assert.equal(ai.update(snapshot(), 1).lightPressed, true)
})

test('KO and explicit reset erase pending threats, cooldowns and attack sequence', () => {
  const ai = controller()
  ai.update(snapshot(), 200)
  neutral(ai.update(snapshot({}, {}, false), 10000))
  neutral(ai.update(snapshot(), 199))
  assert.equal(ai.update(snapshot(), 1).lightPressed, true)
  ai.reset()
  neutral(ai.update(snapshot(), 199))
})

test('Local Versus leaves AI disabled and preserves P2 movement, jump and semicolon input', () => {
  const scene = makeScene()
  assert.equal(scene.lyraAI, undefined)
  const initial = scene.playerTwo.container.x
  scene.movementKeys.playerTwo.left.isDown = true
  scene.update(0, 16)
  assert.ok(scene.playerTwo.container.x < initial)
  scene.input.keyboard.emit('keydown', { key: ';', repeat: false, isComposing: false })
  scene.update(16, 0)
  assert.equal(scene.playerTwo.currentAttack, 'heavy')
  scene.cancelAttack(scene.playerTwo)
  tap(scene.movementKeys.playerTwo.jump)
  scene.update(16, 16)
  assert.equal(scene.playerTwo.vertical.movementState, 'rising')
  finish(scene)
})

test('Single Player ignores and drains all P2 human inputs; P1 keyboard still works', () => {
  const scene = makeScene('single-player')
  const initial = scene.playerTwo.container.x
  scene.movementKeys.playerTwo.right.isDown = true
  scene.blockKeys.playerTwo.isDown = true
  tap(scene.attackKeys.playerTwo.light)
  tap(scene.movementKeys.playerTwo.jump)
  scene.input.keyboard.emit('keydown', { key: ';', repeat: false, isComposing: false })
  scene.movementKeys.playerOne.right.isDown = true
  tap(scene.attackKeys.playerOne.light)
  scene.update(0, 16)
  assert.equal(scene.playerTwo.container.x, initial)
  assert.equal(scene.playerTwo.attackState, 'idle')
  assert.equal(scene.playerTwo.guardEligible, false)
  assert.equal(scene.playerTwo.vertical.movementState, 'grounded')
  assert.equal(scene.pendingKeyboardAttacks.playerTwo.light || scene.pendingKeyboardAttacks.playerTwo.heavy, false)
  assert.equal(scene.pendingKeyboardJump.playerTwo, false)
  assert.equal(scene.playerOne.currentAttack, 'light')
  assert.ok(scene.playerOne.container.x > 820)
  scene.update(16, 200)
  assert.ok(scene.playerTwo.container.x < initial, 'AI approaches left despite held P2 Right')
  finish(scene)
})

test('P1 floating joystick and action buttons coexist with AI ownership', () => {
  const scene = makeScene('single-player')
  setInputEnvironment(true)
  scene.update(0, 0)
  scene.input.emit('pointerdown', { id: 1, x: 200, y: 500 })
  scene.input.emit('pointermove', { id: 1, x: 240, y: 500 })
  const initial = scene.playerOne.container.x
  scene.update(0, 16)
  assert.ok(scene.playerOne.container.x > initial)
  const heavy = scene.touchControls.buttons.find(b => b.player === 'playerOne' && b.action === 'heavy')
  heavy.zone.emit('pointerdown', { id: 2 })
  scene.update(16, 16)
  assert.equal(scene.playerOne.currentAttack, 'heavy')
  assert.ok(scene.playerOne.container.x > initial)
  finish(scene)
})

test('actual AI Light deals existing damage through the authoritative combat path', () => {
  const scene = makeScene('single-player')
  close(scene)
  frames(scene, 40)
  assert.equal(scene.playerOne.health, 90)
  assert.equal(scene.playerTwo.health, 100)
  assert.equal(scene.playerTwo.combo.damageConfirmed, true)
  finish(scene)
})

test('actual AI miss does not deal damage or confirm a combo', () => {
  const scene = makeScene('single-player')
  scene.playerOne.container.x = 1155
  scene.playerTwo.container.x = 1000
  scene.update(0, 199)
  scene.update(199, 1)
  assert.equal(scene.playerTwo.currentAttack, 'light')
  scene.movementKeys.playerOne.right.isDown = true
  scene.update(200, 179)
  scene.update(379, 220)
  assert.equal(scene.playerOne.health, 100)
  assert.equal(scene.playerTwo.attackHasHit, false)
  assert.equal(scene.playerTwo.combo.damageConfirmed, false)
  finish(scene)
})

test('actual AI guards a telegraphed Heavy through existing Block rules', () => {
  const scene = makeScene('single-player')
  close(scene)
  tap(scene.attackKeys.playerOne.heavy)
  scene.update(0, 0)
  frames(scene, 25)
  assert.equal(scene.playerTwo.health, 100)
  assert.equal(scene.playerTwo.reaction.reactionState, 'blockstun')
  assert.equal(scene.playerOne.combo.damageConfirmed, false)
  finish(scene)
})

test('native P1 S key guards both AI attack types without changing health', () => {
  const scene = makeScene('single-player')
  close(scene)
  scene.input.keyboard.manager.queue = [{ type: 'keydown', key: 's', keyCode: 83, repeat: false, timeStamp: 1 }]
  scene.input.keyboard.update()
  scene.input.keyboard.manager.queue = []
  assert.equal(scene.blockKeys.playerOne.isDown, true)
  const observed = new Set()
  for (let i = 0; i < 500; i++) {
    scene.update(i * 16, 16)
    if (scene.playerTwo.currentAttack) observed.add(scene.playerTwo.currentAttack)
    assert.equal(scene.playerOne.health, 100)
  }
  assert.deepEqual([...observed].sort(), ['heavy', 'light'])
  finish(scene)
})

test('actual AI Heavy deals exactly 18 through the same shared damage path', () => {
  const scene = makeScene('single-player')
  close(scene)
  scene.blockKeys.playerOne.isDown = true
  frames(scene, 50)
  assert.equal(scene.playerOne.health, 100)
  assert.equal(scene.playerTwo.currentAttack, 'light')
  scene.blockKeys.playerOne.isDown = false
  for (let i = 0; i < 300 && scene.playerOne.health === 100; i++) scene.update(i * 16, 16)
  assert.equal(scene.playerOne.health, 82)
  assert.equal(scene.playerTwo.currentAttack, 'heavy')
  finish(scene)
})

test('simultaneous human/AI lethal Light attacks retain P1-first authority', () => {
  const scene = makeScene('single-player')
  close(scene)
  scene.playerOne.health = scene.playerTwo.health = 10
  neutral(scene.readAIInput(199))
  tap(scene.attackKeys.playerOne.light)
  scene.update(0, 1)
  assert.equal(scene.playerOne.attackState, 'startup')
  assert.equal(scene.playerTwo.attackState, 'startup')
  scene.update(1, 179)
  assert.equal(scene.winner, 'PLAYER 1')
  assert.equal(scene.playerOne.health, 10)
  assert.equal(scene.playerTwo.health, 0)
  finish(scene)
})

for (const winner of ['PLAYER 1', 'PLAYER 2']) {
  test(`${winner} can win in Single Player; KO stops AI and restart retains mode`, () => {
    const scene = makeScene('single-player')
    close(scene)
    if (winner === 'PLAYER 1') {
      scene.playerTwo.health = 10
      tap(scene.attackKeys.playerOne.light)
      scene.update(0, 180)
    } else {
      scene.playerOne.health = 10
      frames(scene, 40)
    }
    assert.equal(scene.winner, winner)
    const oldAI = scene.lyraAI
    assert.equal(oldAI.state, 'recovery')
    const health = [scene.playerOne.health, scene.playerTwo.health]
    frames(scene, 20)
    assert.deepEqual([scene.playerOne.health, scene.playerTwo.health], health)
    scene.restartKey.onDown({ repeat: false, timeStamp: 0 })
    scene.update(0, 16)
    scene.restartKey.onUp({ timeStamp: 1 })
    assert.equal(scene.restarts, 1)
    assert.equal(scene.mode, 'single-player')
    assert.notEqual(scene.lyraAI, oldAI)
    assert.equal(scene.playerOne.health, 100)
    assert.equal(scene.playerTwo.health, 100)
    assert.equal(scene.playerTwo.container.x, 1580)
    scene.update(0, 199)
    assert.equal(scene.playerTwo.container.x, 1580)
    finish(scene)
  })
}

for (const [suspend, resume] of [['pause', 'resume'], ['sleep', 'wake']]) {
  test(`${suspend}/${resume} discards pending decisions and suspended elapsed time`, () => {
    const scene = makeScene('single-player')
    close(scene)
    scene.update(0, 199)
    scene.events.emit(suspend)
    neutral(scene.readAIInput(10000))
    scene.events.emit(resume)
    neutral(scene.readAIInput(10000))
    neutral(scene.readAIInput(199))
    assert.equal(scene.readAIInput(1).lightPressed, true)
    finish(scene)
    for (const event of ['pause', 'resume', 'sleep', 'wake']) assert.equal(scene.events.listenerCount(event), 0)
    assert.equal(scene.lyraAI, undefined)
  })
}

test('blur and visibility locks compose; returning visibility alone does not release blur', () => {
  const scene = makeScene('single-player')
  close(scene)
  scene.update(0, 199)
  dispatchWindowEvent('blur')
  setDocumentHidden(true)
  setDocumentHidden(false)
  neutral(scene.readAIInput(10000))
  dispatchWindowEvent('focus')
  neutral(scene.readAIInput(10000))
  neutral(scene.readAIInput(199))
  assert.equal(scene.readAIInput(1).lightPressed, true)
  finish(scene)
})

test('portrait pause discards pending attack and resumes with a fresh delay', () => {
  const scene = makeScene('single-player')
  close(scene)
  scene.update(0, 199)
  setInputEnvironment(true, true)
  scene.update(0, 10000)
  assert.equal(scene.playerTwo.attackState, 'idle')
  setInputEnvironment(true, false)
  scene.update(0, 10000)
  assert.equal(scene.playerTwo.attackState, 'idle')
  scene.update(0, 199)
  assert.equal(scene.playerTwo.attackState, 'idle')
  scene.update(0, 1)
  assert.equal(scene.playerTwo.currentAttack, 'light')
  finish(scene)
})

test('restart/mode initialization do not retain P2 keys, pending edges or AI listeners', () => {
  const scene = makeScene('single-player')
  for (let i = 0; i < 5; i++) {
    scene.movementKeys.playerTwo.right.isDown = true
    tap(scene.attackKeys.playerTwo.heavy)
    scene.endMatch('PLAYER 1')
    scene.restartKey.onDown({ repeat: false, timeStamp: 0 })
    scene.update(0, 0)
    scene.restartKey.onUp({ timeStamp: 1 })
    assert.equal(scene.movementKeys.playerTwo.right.isDown, false)
    assert.equal(scene.pendingKeyboardAttacks.playerTwo.heavy, false)
    for (const event of ['pause', 'resume', 'sleep', 'wake']) assert.equal(scene.events.listenerCount(event), 1)
  }
  scene.events.emit('shutdown')
  scene.init({ mode: 'local-versus' })
  scene.create()
  assert.equal(scene.lyraAI, undefined)
  const initial = scene.playerTwo.container.x
  scene.update(0, 1000)
  assert.equal(scene.playerTwo.container.x, initial)
  finish(scene)
})
