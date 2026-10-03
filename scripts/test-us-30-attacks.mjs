import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as attacks from '../src/game/combat/attackDefinitions.ts'
import * as world from '../src/game/world/combatWorld.ts'

const { ATTACK_DEFINITIONS: definitions, createAttackRuntime, selectAttack } = attacks
const require = createRequire(import.meta.url)
const phaserModule = path => require(fileURLToPath(new URL(`../node_modules/phaser/src/${path}.js`, import.meta.url)))
const KeyboardPlugin = phaserModule('input/keyboard/KeyboardPlugin')
const JustDown = phaserModule('input/keyboard/keys/JustDown')
const KeyCodes = phaserModule('input/keyboard/keys/KeyCodes')
const EventEmitter = require('eventemitter3')
const browserTarget = () => ({ addEventListener() {}, removeEventListener() {} })
let coarse = false
let portrait = false
const windowStub = {
  ...browserTarget(), innerWidth: 1280, innerHeight: 720,
  matchMedia: query => ({ matches: query.includes('coarse') ? coarse : portrait }),
}
const phaser = {
  Scene: class {},
  Input: { Keyboard: { JustDown, KeyCodes } },
  Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  Scale: { Events: { RESIZE: 'resize' } },
  Math: { Clamp: (value, min, max) => Math.min(max, Math.max(min, value)) },
  Geom: {
    Rectangle: phaserModule('geom/rectangle/Rectangle'),
    Intersects: { RectangleToRectangle: phaserModule('geom/intersects/RectangleToRectangle') },
  },
}

// Execute complete production classes, including create/update/shutdown/restart,
// with renderer/browser/audio services doubled. Real Phaser keys and rectangular
// intersections are used; no parallel attack state machine or collision math.
const loadClass = (path, dependencies) => {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const exports = {}
  runInNewContext(compiled, {
    exports, require: name => {
      if (name === 'phaser') return phaser
      if (name in dependencies) return dependencies[name]
      throw new Error(`Unexpected production dependency: ${name}`)
    },
    window: windowStub, document: { ...browserTarget(), hidden: false },
    console: { log() {} },
  })
  return exports
}
const touchModule = loadClass('../src/game/controls/TouchControls.ts', { '../world/combatWorld': world })
const { CombatScene } = loadClass('../src/game/scenes/CombatScene.ts', {
  '../world/combatWorld': world, '../combat/attackDefinitions': attacks,
  '../controls/TouchControls': touchModule,
})

const display = (x = 0, y = 0, width = 0, height = 0) => {
  const object = new EventEmitter()
  Object.assign(object, { x, y, width, height, visible: true, texture: { key: '' }, input: {} })
  for (const method of [
    'setOrigin', 'setScale', 'setStrokeStyle', 'setFillStyle', 'setDepth', 'setScrollFactor',
    'setShadow', 'setFontSize', 'setAlpha', 'fillStyle', 'lineStyle', 'fillTriangle', 'lineBetween',
    'clear', 'fillRoundedRect', 'strokeRoundedRect', 'beginPath', 'moveTo', 'lineTo', 'closePath',
    'fillPath', 'strokePath', 'setFlipX', 'setInteractive',
  ]) object[method] = () => object
  object.setPosition = (a, b) => { object.x = a; object.y = b; return object }
  object.setX = a => { object.x = a; return object }
  object.setSize = (a, b) => { object.width = a; object.height = b; return object }
  object.setDisplaySize = object.setSize
  object.setVisible = visible => { object.visible = visible; return object }
  object.setTexture = key => { object.texture.key = key; return object }
  object.setScale = (x, y = x) => { object.scaleX = x; object.scaleY = y; return object }
  object.setOrigin = (x, y = x) => { object.originX = x; object.originY = y; return object }
  return object
}

export const makeScene = () => {
  coarse = false
  portrait = false
  const scene = new CombatScene()
  const sounds = new Map()
  const sound = () => ({
    isPlaying: false, isPaused: false, plays: 0,
    play() { this.plays++; this.isPlaying = true }, stop() { this.isPlaying = false },
  })
  scene.add = {
    graphics: () => display(), zone: display, rectangle: display,
    image: (x, y, key) => display(x, y).setTexture(key),
    circle: (x, y, radius) => Object.assign(display(x, y), { radius }),
    text: (x, y, text) => Object.assign(display(x, y), { text }),
    container: (x, y, children) => Object.assign(display(x, y), { children }),
  }
  scene.events = new EventEmitter()
  scene.input = new EventEmitter()
  scene.sys = { settings: {}, canInput: () => true }
  scene.input.scene = scene
  scene.input.systems = { game: {} }
  scene.input.pluginEvents = new EventEmitter()
  scene.input.manager = { keyboard: { queue: [], addCapture() {} } }
  scene.input.keyboard = new KeyboardPlugin(scene.input)
  scene.sound = {
    locked: false, add: name => { const instance = sound(); sounds.set(name, instance); return instance },
    get: name => sounds.get(name), remove: () => {},
  }
  scene.scale = Object.assign(new EventEmitter(), { width: 1280, height: 720 })
  const camera = { scrollX: 0, scrollY: 0, zoom: 1 }
  camera.setBounds = () => camera
  camera.setZoom = zoom => { camera.zoom = zoom; return camera }
  camera.setScroll = (x, y) => { camera.scrollX = x; camera.scrollY = y; return camera }
  scene.cameras = { main: camera }
  scene.game = { canvas: { parentElement: null } }
  scene.handleScaleResize = () => {}
  scene.restarts = 0
  scene.scene = { restart: () => {
    scene.events.emit('shutdown')
    scene.restarts++
    scene.create()
  } }
  scene.create()
  return scene
}
const tap = key => {
  key.onDown({ repeat: false, timeStamp: 0 })
  key.onUp({ timeStamp: 1 })
}
const press = (scene, player, attack) => tap(scene.attackKeys[player][attack])
let keyboardTime = 0
const dispatchKeyboard = (scene, representation, type = 'keydown') => {
  const keyboard = scene.input.keyboard
  keyboard.manager.queue = [{
    repeat: false, shiftKey: false, ...representation, type, timeStamp: ++keyboardTime,
  }]
  keyboard.update()
  keyboard.manager.queue = []
}
const input = (scene, player = 'playerOne') => scene.readFighterInput(player, scene.movementKeys[player])
const closeFighters = scene => {
  scene.playerTwo.container.x = scene.playerOne.container.x + 100
  scene.updateFacing()
}
const start = (scene, id, fighter = scene.playerOne) => scene.tryStartAttack(fighter, id)
const phases = (scene, id, fighter = scene.playerOne, defender = scene.playerTwo) => {
  const definition = definitions[id]
  scene.advanceAttack(fighter, defender, definition.startupMs)
  scene.advanceAttack(fighter, defender, definition.activeMs)
  scene.advanceAttack(fighter, defender, definition.recoveryMs)
}

test('Light preserves the complete timing, damage and geometry baseline', () => {
  assert.deepEqual(definitions.light, {
    id: 'light', startupMs: 180, activeMs: 220, recoveryMs: 300,
    damage: 10, reach: 100, height: 70, swingCueMs: 140,
  })
})
test('Heavy is defined, slower, stronger and 25% longer-reaching without enlarging hurtboxes', () => {
  assert.deepEqual(definitions.heavy, {
    id: 'heavy', startupMs: 300, activeMs: 240, recoveryMs: 420,
    damage: 18, reach: 125, height: 70, swingCueMs: 240,
  })
  assert.ok(definitions.heavy.startupMs > definitions.light.startupMs)
  assert.equal(definitions.heavy.reach / definitions.light.reach, 1.25)
  assert.equal(Object.isFrozen(definitions.heavy), true)
})

for (const id of ['light', 'heavy']) {
  test(`${id}: production lifecycle follows definition timings and cleans identity at idle`, () => {
    const scene = makeScene()
    const fighter = scene.playerOne
    const definition = definitions[id]
    start(scene, id)
    assert.equal(fighter.currentAttack, id)
    assert.equal(fighter.attackState, 'startup')
    scene.advanceAttack(fighter, scene.playerTwo, definition.startupMs - 1)
    assert.equal(fighter.attackState, 'startup')
    scene.advanceAttack(fighter, scene.playerTwo, 1)
    assert.equal(fighter.attackState, 'active')
    assert.equal(fighter.attackArea.visible, true)
    scene.advanceAttack(fighter, scene.playerTwo, definition.activeMs)
    assert.equal(fighter.attackState, 'recovery')
    assert.equal(fighter.attackArea.visible, false)
    scene.advanceAttack(fighter, scene.playerTwo, definition.recoveryMs - 1)
    assert.equal(fighter.attackState, 'recovery')
    scene.advanceAttack(fighter, scene.playerTwo, 1)
    assert.equal(fighter.attackState, 'idle')
    assert.equal(fighter.currentAttack, null)
    assert.equal(fighter.attackPhaseElapsed, 0)
  })
  test(`${id}: each fighter hits at most once and applies definition damage`, () => {
    for (const player of ['playerOne', 'playerTwo']) {
      const scene = makeScene()
      closeFighters(scene)
      const attacker = scene[player]
      const defender = scene[player === 'playerOne' ? 'playerTwo' : 'playerOne']
      start(scene, id, attacker)
      scene.advanceAttack(attacker, defender, definitions[id].startupMs)
      assert.equal(defender.health, 100 - definitions[id].damage)
      scene.advanceAttack(attacker, defender, 1)
      scene.advanceAttack(attacker, defender, 1)
      assert.equal(defender.health, 100 - definitions[id].damage)
      assert.equal(attacker.attackHasHit, true)
      scene.advanceAttack(attacker, defender, definitions[id].activeMs + definitions[id].recoveryMs)
      start(scene, id, attacker)
      scene.advanceAttack(attacker, defender, definitions[id].startupMs)
      assert.equal(defender.health, 100 - definitions[id].damage * 2)
    }
  })
  test(`${id}: a miss preserves eligibility and deals no damage`, () => {
    const scene = makeScene()
    start(scene, id)
    scene.advanceAttack(scene.playerOne, scene.playerTwo, definitions[id].startupMs)
    assert.equal(scene.playerOne.attackHasHit, false)
    assert.equal(scene.playerTwo.health, 100)
    closeFighters(scene)
    scene.advanceAttack(scene.playerOne, scene.playerTwo, 1)
    assert.equal(scene.playerTwo.health, 100 - definitions[id].damage)
  })
  test(`${id}: airborne presses are rejected without a landing buffer`, () => {
    const scene = makeScene()
    scene.playerOne.vertical = world.advanceVerticalMovement(world.createVerticalMovement(), true, 100)
    press(scene, 'playerOne', id)
    scene.update(0, 0)
    assert.equal(scene.playerOne.currentAttack, null)
    scene.update(0, 1000)
    assert.equal(scene.playerOne.vertical.movementState, 'grounded')
    assert.equal(scene.playerOne.attackState, 'idle')
  })
  test(`${id}: an airborne press on the landing update is still discarded`, () => {
    const scene = makeScene()
    scene.playerOne.vertical = { footY: world.GROUND_TOP - 1, velocityY: 300, movementState: 'falling' }
    press(scene, 'playerOne', id)
    scene.update(0, 16)
    assert.equal(scene.playerOne.vertical.movementState, 'grounded')
    assert.equal(scene.playerOne.currentAttack, null)
    scene.update(0, 16)
    assert.equal(scene.playerOne.currentAttack, null)
  })
  test(`${id}: post-match keyboard/touch attack is discarded while airborne fighters land`, () => {
    const scene = makeScene()
    scene.winner = 'PLAYER 2'
    scene.playerOne.vertical = world.advanceVerticalMovement(world.createVerticalMovement(), true, 100)
    press(scene, 'playerOne', id)
    scene.touchControls.pendingAttack.playerTwo[id] = true
    scene.update(0, 2000)
    assert.equal(scene.playerOne.attackState, 'idle')
    assert.equal(scene.playerTwo.attackState, 'idle')
    assert.equal(scene.playerOne.vertical.footY, world.GROUND_TOP)
    assert.equal(scene.winner, 'PLAYER 2')
    assert.equal(scene.playerOne.health, 100)
    assert.equal(scene.playerTwo.health, 100)
    start(scene, id)
    assert.equal(scene.playerOne.currentAttack, null)
  })
  test(`${id}: authoritative attack prevents jump, then permits fresh jump after recovery`, () => {
    const scene = makeScene()
    start(scene, id)
    tap(scene.movementKeys.playerOne.jump)
    scene.update(0, 16)
    assert.equal(scene.playerOne.vertical.movementState, 'grounded')
    scene.update(0, definitions[id].startupMs + definitions[id].activeMs + definitions[id].recoveryMs)
    scene.update(0, 16)
    assert.equal(scene.playerOne.vertical.movementState, 'grounded')
    tap(scene.movementKeys.playerOne.jump)
    scene.update(0, 16)
    assert.equal(scene.playerOne.vertical.movementState, 'rising')
  })
  test(`${id}: held key and browser repeats do not auto-chain attacks`, () => {
    const scene = makeScene()
    const key = scene.attackKeys.playerOne[id]
    key.setEmitOnRepeat(true)
    key.onDown({ repeat: false, timeStamp: 0 })
    scene.update(0, 0)
    key.onDown({ repeat: true, timeStamp: 10 })
    phases(scene, id)
    scene.update(0, 16)
    assert.equal(scene.playerOne.attackState, 'idle')
    assert.equal(scene.playerOne.currentAttack, null)
  })
  test(`${id}: short key tap survives keyup and is consumed exactly once`, () => {
    const scene = makeScene()
    press(scene, 'playerOne', id)
    const intentions = input(scene)
    assert.equal(intentions[`${id}Pressed`], true)
    assert.equal(input(scene)[`${id}Pressed`], false)
  })
  test(`${id}: reused presentation follows phase fractions and consumes sound only when due`, () => {
    const scene = makeScene()
    start(scene, id)
    const fighter = scene.playerOne
    assert.equal(scene.getJonAttackFrame(fighter), 'jon-attack-s-1')
    fighter.attackPhaseElapsed = definitions[id].startupMs / 2
    assert.equal(scene.getJonAttackFrame(fighter), 'jon-attack-s-2')
    fighter.attackPhaseElapsed = 0
    scene.sound.locked = true
    scene.advanceAttack(fighter, scene.playerTwo, definitions[id].swingCueMs - 1)
    assert.equal(scene.jonSwingPlayed, false)
    scene.sound.locked = false
    scene.advanceAttack(fighter, scene.playerTwo, 1)
    assert.equal(scene.swingSound.plays, 1)
    scene.advanceAttack(fighter, scene.playerTwo, 1)
    assert.equal(scene.swingSound.plays, 1)
  })
}

for (const facing of ['right', 'left']) {
  test(`Heavy geometry faces ${facing}, extends beyond Light and follows world Y`, () => {
    const scene = makeScene()
    const direction = facing === 'right' ? 1 : -1
    scene.playerTwo.container.x = scene.playerOne.container.x + direction * 184
    scene.updateFacing()
    start(scene, 'light')
    scene.advanceAttack(scene.playerOne, scene.playerTwo, definitions.light.startupMs)
    assert.equal(scene.playerTwo.health, 100, 'outside Light reach')
    phases(scene, 'light')
    start(scene, 'heavy')
    assert.equal(scene.playerOne.attackArea.width, definitions.heavy.reach)
    assert.equal(scene.playerOne.attackArea.x, direction * (36 + definitions.heavy.reach / 2))
    scene.playerTwo.container.y -= 200
    scene.advanceAttack(scene.playerOne, scene.playerTwo, definitions.heavy.startupMs)
    assert.equal(scene.playerTwo.health, 100, 'elevated hurtbox must miss')
    scene.playerTwo.container.y += 200
    scene.advanceAttack(scene.playerOne, scene.playerTwo, 1)
    assert.equal(scene.playerTwo.health, 82)
    scene.playerTwo.container.x = scene.playerOne.container.x - direction * 100
    scene.updateFacing()
    assert.equal(scene.playerOne.facing, facing === 'right' ? 'left' : 'right')
    assert.equal(Math.sign(scene.playerOne.attackArea.x), -direction)
  })
}

test('same-frame Light + Heavy chooses Light and discards Heavy for both fighters', () => {
  const scene = makeScene()
  for (const player of ['playerOne', 'playerTwo']) {
    press(scene, player, 'light')
    press(scene, player, 'heavy')
  }
  scene.update(0, 0)
  assert.equal(scene.playerOne.currentAttack, 'light')
  assert.equal(scene.playerTwo.currentAttack, 'light')
  assert.equal(selectAttack(false, true), 'heavy')
  scene.update(0, 1000)
  scene.update(0, 16)
  assert.equal(scene.playerOne.currentAttack, null)
  assert.equal(scene.playerTwo.currentAttack, null)
})

test('presses during startup/active/recovery cannot replace, restart, cancel or queue either attack', () => {
  for (const current of ['light', 'heavy']) {
    for (const state of ['startup', 'active', 'recovery']) {
      const scene = makeScene()
      start(scene, current)
      scene.playerOne.attackState = state
      scene.playerOne.attackPhaseElapsed = 1
      for (const pressId of ['light', 'heavy']) press(scene, 'playerOne', pressId)
      scene.update(0, 0)
      assert.equal(scene.playerOne.currentAttack, current)
      assert.equal(scene.playerOne.attackState, state)
      assert.equal(scene.playerOne.attackPhaseElapsed, 1)
      scene.update(0, 2000)
      scene.update(0, 16)
      assert.equal(scene.playerOne.attackState, 'idle')
    }
  }
})

test('simultaneous jump and attack takes jump precedence without an air attack', () => {
  const scene = makeScene()
  tap(scene.movementKeys.playerOne.jump)
  press(scene, 'playerOne', 'heavy')
  scene.update(0, 16)
  assert.equal(scene.playerOne.vertical.movementState, 'rising')
  assert.equal(scene.playerOne.currentAttack, null)
})

test('simultaneous lethal attacks preserve deterministic P1-first victory ordering', () => {
  for (const id of ['light', 'heavy']) {
    const scene = makeScene()
    closeFighters(scene)
    scene.playerOne.health = definitions[id].damage
    scene.playerTwo.health = definitions[id].damage
    press(scene, 'playerOne', id)
    press(scene, 'playerTwo', id)
    scene.update(0, definitions[id].startupMs)
    assert.equal(scene.winner, 'PLAYER 1')
    assert.equal(scene.playerTwo.health, 0)
    assert.equal(scene.playerOne.health, definitions[id].damage)
    assert.equal(scene.winnerText.text, 'JON SNOW WINS')
  }
})

test('Heavy lethal hit clamps health, preserves P2 victory, KO replacement and HUD', () => {
  const scene = makeScene()
  closeFighters(scene)
  scene.playerOne.health = 10
  start(scene, 'heavy', scene.playerTwo)
  scene.advanceAttack(scene.playerTwo, scene.playerOne, definitions.heavy.startupMs)
  assert.equal(scene.playerOne.health, 0)
  assert.equal(scene.playerOneHealthBar.fill.visible, false)
  assert.equal(scene.winnerText.text, 'PLAYER 2 WINS')
  assert.equal(scene.koSound.plays, 1)
  assert.equal(scene.hitSounds.reduce((sum, sound) => sum + sound.plays, 0), 0)
})

test('actual scene restart resets both identities/phases/timers/guards/pending inputs and listeners', () => {
  const scene = makeScene()
  const ambience = scene.ambience
  start(scene, 'heavy')
  scene.playerOne.attackHasHit = true
  scene.playerOne.attackPhaseElapsed = 100
  scene.playerTwo.health = 0
  scene.winner = 'PLAYER 1'
  for (const player of ['playerOne', 'playerTwo']) {
    for (const id of ['light', 'heavy']) {
      press(scene, player, id)
      scene.touchControls.pendingAttack[player][id] = true
    }
  }
  scene.restartKey._justDown = true
  scene.update(0, 16)
  assert.equal(scene.restarts, 1)
  assert.equal(scene.winner, null)
  assert.equal(scene.ambience, ambience)
  for (const player of ['playerOne', 'playerTwo']) {
    for (const [key, value] of Object.entries(createAttackRuntime())) assert.equal(scene[player][key], value)
    assert.equal(scene[player].health, 100)
    assert.deepEqual(scene[player].vertical, world.createVerticalMovement())
    for (const id of ['light', 'heavy']) {
      assert.equal(scene.pendingKeyboardAttacks[player][id], false)
      assert.equal(scene.touchControls.pendingAttack[player][id], false)
      assert.equal(scene.attackKeys[player][id].listenerCount('down'), 1)
    }
  }
  scene.update(0, 16)
  assert.equal(scene.playerOne.attackState, 'idle')
  assert.equal(scene.playerTwo.attackState, 'idle')
  assert.deepEqual([scene.playerOne.container.x, scene.playerTwo.container.x], world.getFighterWorldSpawns())
})

test('default attack records are clean and independent', () => {
  const one = createAttackRuntime()
  const two = createAttackRuntime()
  assert.deepEqual(one, { currentAttack: null, attackState: 'idle', attackPhaseElapsed: 0, attackHasHit: false })
  assert.notEqual(one, two)
})

test('actual touch zones converge with keyboard input and clear pointer/pending state', () => {
  const scene = makeScene()
  scene.touchControls.setPresentation(true, false, false)
  for (const player of ['playerOne', 'playerTwo']) {
    for (const id of ['light', 'heavy']) {
      const button = scene.touchControls.buttons.find(button => button.player === player && button.action === id)
      button.zone.emit('pointerdown', { id: 7 })
      press(scene, player, id)
      assert.equal(input(scene, player)[`${id}Pressed`], true)
      assert.equal(input(scene, player)[`${id}Pressed`], false)
      scene.input.emit('pointerupoutside', { id: 7 })
      assert.equal(button.pointers.size, 0)
    }
  }
  scene.touchControls.setPresentation(true, true, false)
  assert.equal(scene.touchControls.buttons.every(button => !button.active), true)
  scene.touchControls.setPresentation(true, false, false)
  assert.equal(scene.touchControls.buttons.every(button => button.active), true)
})

test('ten temporary touch controls are non-overlapping and safe at supported widths/insets', () => {
  const scene = makeScene()
  for (const width of [1280, 1558, 1600]) {
    for (const insets of [
      { left: 0, right: 0, top: 0, bottom: 0 },
      { left: 82, right: 82, top: 0, bottom: 39 },
    ]) {
      scene.touchControls.setViewport(width, 720, insets)
      const buttons = scene.touchControls.buttons
      assert.equal(buttons.length, 10)
      for (const button of buttons) {
        assert.ok(button.zone.x - button.width / 2 >= insets.left)
        assert.ok(button.zone.x + button.width / 2 <= width - insets.right)
        assert.ok(button.zone.y + button.height / 2 <= 720 - insets.bottom)
        assert.equal(button.graphic.x, button.zone.x)
        assert.equal(button.graphic.y, button.zone.y)
        for (const other of buttons) {
          if (button === other) continue
          assert.ok(Math.abs(button.zone.x - other.zone.x) >= (button.width + other.width) / 2 ||
            Math.abs(button.zone.y - other.zone.y) >= (button.height + other.height) / 2)
        }
      }
    }
  }
})

test('portrait locks attacks, consumes intentions and permits clean landscape recovery', () => {
  const scene = makeScene()
  coarse = true
  portrait = true
  press(scene, 'playerOne', 'heavy')
  scene.update(0, 16)
  assert.equal(scene.playerOne.currentAttack, null)
  portrait = false
  scene.update(0, 16)
  assert.equal(scene.playerOne.currentAttack, null)
  press(scene, 'playerOne', 'heavy')
  scene.update(0, 16)
  assert.equal(scene.playerOne.currentAttack, 'heavy')
})

test('locked due swing is discarded and never replays after later audio unlock', () => {
  const scene = makeScene()
  scene.sound.locked = true
  start(scene, 'heavy')
  scene.advanceAttack(scene.playerOne, scene.playerTwo, definitions.heavy.swingCueMs)
  scene.sound.locked = false
  scene.advanceAttack(scene.playerOne, scene.playerTwo, 1)
  assert.equal(scene.jonSwingPlayed, true)
  assert.equal(scene.swingSound.plays, 0)
})

test('existing trail enters with the selected active phase, never at Light timing for Heavy', () => {
  const scene = makeScene()
  press(scene, 'playerOne', 'heavy')
  scene.update(0, definitions.light.startupMs)
  assert.equal(scene.playerOne.attackState, 'startup')
  assert.equal(scene.jonTrail.visible, false)
  scene.update(0, definitions.heavy.startupMs - definitions.light.startupMs)
  assert.equal(scene.playerOne.attackState, 'active')
  assert.equal(scene.jonTrail.visible, true)
})

test('Heavy active/recovery poses scale to definition durations while Light pose boundaries remain exact', () => {
  const scene = makeScene()
  const fighter = scene.playerOne
  for (const id of ['light', 'heavy']) {
    fighter.currentAttack = id
    for (const [phase, boundary, frame] of [
      ['active', 60, 'jon-attack-a-2'], ['active', 160, 'jon-attack-a-3'],
      ['recovery', 100, 'jon-attack-r-2'], ['recovery', 200, 'jon-attack-r-3'],
    ]) {
      const duration = phase === 'active' ? 'activeMs' : 'recoveryMs'
      fighter.attackState = phase
      fighter.attackPhaseElapsed = boundary * definitions[id][duration] / definitions.light[duration]
      assert.equal(scene.getJonAttackFrame(fighter), frame)
    }
  }
})

test('shutdown removes all attack listeners and clears unconsumed keyboard/touch intentions', () => {
  const scene = makeScene()
  scene.touchControls.setPresentation(true, false, false)
  const button = scene.touchControls.buttons.find(button => button.action === 'heavy')
  button.zone.emit('pointerdown', { id: 3 })
  for (const player of ['playerOne', 'playerTwo']) {
    press(scene, player, 'light')
    press(scene, player, 'heavy')
  }
  scene.events.emit('shutdown')
  for (const player of ['playerOne', 'playerTwo']) {
    for (const id of ['light', 'heavy']) {
      assert.equal(scene.pendingKeyboardAttacks[player][id], false)
      assert.equal(scene.touchControls.pendingAttack[player][id], false)
      assert.equal(scene.attackKeys[player][id].listenerCount('down'), 0)
    }
  }
  assert.equal(button.pointers.size, 0)
})

test('production presentation preserves distinct Light/Heavy timelines instead of normalizing total duration', () => {
  const light = makeScene()
  const heavy = makeScene()
  dispatchKeyboard(light, { key: 'j', code: 'KeyJ', keyCode: 74 })
  dispatchKeyboard(heavy, { key: 'k', code: 'KeyK', keyCode: 75 })
  light.update(0, 0)
  heavy.update(0, 0)
  let previous = 0
  for (const [elapsed, lightState, heavyState, lightFrame, heavyFrame] of [
    [180, 'active', 'startup', 'jon-attack-a-1', 'jon-attack-s-2'],
    [300, 'active', 'active', 'jon-attack-a-2', 'jon-attack-a-1'],
    [400, 'recovery', 'active', 'jon-attack-r-1', 'jon-attack-a-2'],
    [540, 'recovery', 'recovery', 'jon-attack-r-2', 'jon-attack-r-1'],
    [700, 'idle', 'recovery', 'jon-snow-guard', 'jon-attack-r-2'],
    [960, 'idle', 'idle', 'jon-snow-guard', 'jon-snow-guard'],
  ]) {
    for (const scene of [light, heavy]) scene.update(0, elapsed - previous)
    assert.equal(light.playerOne.attackState, lightState)
    assert.equal(heavy.playerOne.attackState, heavyState)
    assert.equal(light.getJonAttackFrame(light.playerOne), lightFrame)
    assert.equal(heavy.getJonAttackFrame(heavy.playerOne), heavyFrame)
    previous = elapsed
  }
})

test('Phaser native queue accepts a layout-produced semicolon on Shift+Comma (keyCode 188)', () => {
  const scene = makeScene()
  const representation = { key: ';', code: 'Comma', keyCode: 188, shiftKey: true }
  dispatchKeyboard(scene, representation)
  dispatchKeyboard(scene, representation, 'keyup')
  scene.update(0, 0)
  assert.equal(scene.playerTwo.currentAttack, 'heavy')
  assert.equal(scene.playerTwo.attackState, 'startup')
})

test('Phaser native queue accepts Firefox-style semicolon keyCode 59', () => {
  const scene = makeScene()
  dispatchKeyboard(scene, { key: ';', code: 'Semicolon', keyCode: 59 })
  scene.update(0, 0)
  assert.equal(scene.playerTwo.currentAttack, 'heavy')
})

test('layout semicolon produces one fresh Heavy, ignores hold repeats and accepts a new press after release', () => {
  const scene = makeScene()
  const representation = { key: ';', code: 'Comma', keyCode: 188, shiftKey: true }
  dispatchKeyboard(scene, representation)
  scene.update(0, 0)
  for (let frame = 0; frame < 70; frame++) {
    dispatchKeyboard(scene, { ...representation, repeat: true })
    scene.update(0, 16)
  }
  assert.equal(scene.playerTwo.currentAttack, null)
  assert.equal(scene.playerTwo.attackState, 'idle')
  dispatchKeyboard(scene, { ...representation, key: ',', shiftKey: false }, 'keyup')
  dispatchKeyboard(scene, representation)
  scene.update(0, 0)
  assert.equal(scene.playerTwo.currentAttack, 'heavy')
})

test('numeric 186 and character routes coalesce into one Heavy press, not a queued second attack', () => {
  const scene = makeScene()
  dispatchKeyboard(scene, { key: ';', code: 'Semicolon', keyCode: 186 })
  dispatchKeyboard(scene, { key: ';', code: 'Semicolon', keyCode: 186 }, 'keyup')
  scene.update(0, 0)
  assert.equal(scene.playerTwo.currentAttack, 'heavy')
  scene.update(0, 1000)
  scene.update(0, 16)
  assert.equal(scene.playerTwo.currentAttack, null)
})

test('layout comma and composing semicolon do not accidentally trigger Heavy', () => {
  const scene = makeScene()
  dispatchKeyboard(scene, { key: ',', code: 'Comma', keyCode: 188 })
  dispatchKeyboard(scene, { key: ',', code: 'Comma', keyCode: 188 }, 'keyup')
  dispatchKeyboard(scene, { key: ';', code: 'Comma', keyCode: 188, isComposing: true })
  scene.update(0, 0)
  assert.equal(scene.playerTwo.currentAttack, null)
})

test('semicolon listener is cleaned up and rebound once through restart with no stale Heavy', () => {
  const scene = makeScene()
  assert.equal(scene.input.keyboard.listenerCount('keydown'), 1)
  dispatchKeyboard(scene, { key: ';', code: 'Comma', keyCode: 188 })
  scene.winner = 'PLAYER 1'
  scene.restartKey._justDown = true
  scene.update(0, 16)
  assert.equal(scene.input.keyboard.listenerCount('keydown'), 1)
  scene.update(0, 16)
  assert.equal(scene.playerTwo.currentAttack, null)
  scene.events.emit('shutdown')
  assert.equal(scene.input.keyboard.listenerCount('keydown'), 0)
})
