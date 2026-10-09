import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { makeScene, setInputEnvironment, dispatchWindowEvent, setDocumentHidden } from './test-us-30-attacks.mjs'
import { getAdaptiveViewportWidth } from '../src/game/world/combatWorld.ts'

const mobile = () => {
  const scene = makeScene()
  setInputEnvironment(true)
  scene.update(0, 0)
  return scene
}
const down = (scene, id = 1, x = 300, y = 300) => scene.input.emit('pointerdown', { id, x, y })
const move = (scene, id = 1, x = 330, y = 300) => scene.input.emit('pointermove', { id, x, y })
const neutral = controls => {
  assert.equal(controls.isHeld('playerOne', 'left'), false)
  assert.equal(controls.isHeld('playerOne', 'right'), false)
}
const hidden = controls => {
  neutral(controls)
  assert.equal(controls.joystickPointerId, null)
  assert.equal(controls.joystickBase.visible, false)
  assert.equal(controls.joystickThumb.visible, false)
}

for (const [x, y] of [[1, 1], [100, 200], [400, 300], [639, 200], [2, 719]]) {
  test(`US-34 joystick starts at arbitrary available left-half position ${x},${y}`, () => {
    const scene = mobile(), controls = scene.touchControls
    hidden(controls)
    down(scene, 1, x, y)
    assert.equal(controls.joystickPointerId, 1)
    assert.deepEqual({ ...controls.joystickOrigin }, { x, y })
    assert.equal(controls.joystickBase.x, Math.min(640 - 106.6, Math.max(106.6, x)))
    assert.equal(controls.joystickBase.y, Math.min(720 - 106.6, Math.max(106.6, y)))
    assert.equal(controls.joystickBase.visible, true)
    assert.equal(controls.joystickThumb.x, controls.joystickBase.x)
    assert.equal(controls.joystickThumb.y, controls.joystickBase.y)
    neutral(controls)
  })
}

test('US-34 no joystick starts in the right half, outside the canvas, or from invalid coordinates', () => {
  const scene = mobile(), controls = scene.touchControls
  for (const [x, y] of [[640, 200], [1000, 200], [-1, 200], [100, -1], [100, 721], [NaN, 200]]) {
    down(scene, 1, x, y)
    hidden(controls)
  }
})

test('US-34 screen-space origin ignores camera-scrolled world coordinates', () => {
  const scene = mobile(), controls = scene.touchControls
  scene.cameras.main.scrollX = 700
  scene.input.emit('pointerdown', { id: 1, x: 300, y: 300, worldX: 1000, worldY: 300 })
  assert.equal(controls.joystickBase.x, 300)
  move(scene, 1, 320, 300)
  assert.equal(controls.isHeld('playerOne', 'right'), true)
})

test('US-34 horizontal dead zone is neutral through 14 pixels and does not trigger jump', () => {
  const scene = mobile(), controls = scene.touchControls
  down(scene)
  for (const dx of [0, 7, -7, 14, -14]) {
    move(scene, 1, 300 + dx, 600)
    neutral(controls)
    assert.equal(controls.consumeJump('playerOne'), false)
  }
  move(scene, 1, 285)
  assert.equal(controls.isHeld('playerOne', 'left'), true)
  move(scene, 1, 315)
  assert.equal(controls.isHeld('playerOne', 'right'), true)
  assert.equal(controls.isHeld('playerOne', 'left'), false)
  move(scene, 1, 300)
  neutral(controls)
})

test('US-34 thumb shows dragging but stays radius-bounded without limiting input range', () => {
  const scene = mobile(), controls = scene.touchControls
  down(scene)
  move(scene, 1, 800, 600)
  assert.equal(controls.isHeld('playerOne', 'right'), true)
  assert.ok(Math.abs(Math.hypot(controls.joystickThumb.x - 300, controls.joystickThumb.y - 300) - 76.8) < 1e-8)
  assert.equal(controls.joystickBase.x, 300)
  assert.equal(controls.joystickBase.y, 300)
  move(scene, 1, 0, 300)
  assert.equal(controls.isHeld('playerOne', 'left'), true)
})

test('US-34 second pointers cannot reset, move, or release the owner', () => {
  const scene = mobile(), controls = scene.touchControls
  down(scene)
  move(scene)
  down(scene, 2, 100, 100)
  move(scene, 2, 0, 100)
  scene.input.emit('pointercancel', { id: 2 })
  assert.equal(controls.joystickPointerId, 1)
  assert.equal(controls.joystickBase.x, 300)
  assert.equal(controls.isHeld('playerOne', 'right'), true)
  scene.input.emit('pointerup', { id: 1 })
  hidden(controls)
  move(scene, 2, 200, 100)
  hidden(controls)
  down(scene, 2, 100, 100)
  assert.equal(controls.joystickPointerId, 2)
})

for (const event of ['pointerup', 'pointerupoutside', 'pointercancel']) {
  test(`US-34 ${event} stops movement and hides both joystick parts`, () => {
    const scene = mobile(), controls = scene.touchControls
    down(scene)
    move(scene)
    scene.update(0, 100)
    const x = scene.playerOne.container.x
    scene.input.emit(event, { id: 1 })
    hidden(controls)
    scene.update(0, 100)
    assert.equal(scene.playerOne.container.x, x)
  })
}

for (const action of ['light', 'heavy', 'jump', 'block']) {
  test(`US-34 joystick and independent ${action} finger coexist without ownership changes`, () => {
    const scene = mobile(), controls = scene.touchControls
    down(scene)
    move(scene)
    const button = controls.buttons.find(b => b.player === 'playerOne' && b.action === action)
    const pointer = { id: 2, x: button.zone.x, y: button.zone.y }
    button.zone.emit('pointerdown', pointer)
    scene.input.emit('pointerdown', pointer)
    assert.equal(controls.joystickPointerId, 1)
    assert.equal(controls.isHeld('playerOne', 'right'), true)
    if (action === 'block') assert.equal(controls.isHeld('playerOne', 'block'), true)
    else {
      assert.equal(action === 'jump' ? controls.consumeJump('playerOne') : controls.consumeAttack('playerOne', action), true)
      assert.equal(action === 'jump' ? controls.consumeJump('playerOne') : controls.consumeAttack('playerOne', action), false)
    }
    scene.input.emit('pointerup', { id: 2 })
    assert.equal(controls.isHeld('playerOne', 'right'), true)
    assert.equal(controls.joystickPointerId, 1)
  })
}

test('US-34 action-button down cannot become a joystick even when no joystick is active', () => {
  const scene = mobile(), controls = scene.touchControls
  for (const button of controls.buttons) {
    const pointer = { id: 3, x: button.zone.x, y: button.zone.y }
    button.zone.emit('pointerdown', pointer)
    scene.input.emit('pointerdown', pointer)
    hidden(controls)
    scene.input.emit('pointerup', pointer)
  }
})

test('US-34 joystick ownership cannot activate a button by dragging onto it', () => {
  const scene = mobile(), controls = scene.touchControls
  down(scene)
  const button = controls.buttons.find(b => b.player === 'playerOne' && b.action === 'heavy')
  const pointer = { id: 1, x: button.zone.x, y: button.zone.y }
  scene.input.emit('pointermove', pointer)
  button.zone.emit('pointerdown', pointer)
  assert.equal(controls.consumeAttack('playerOne', 'heavy'), false)
  assert.equal(controls.joystickPointerId, 1)
})

test('US-34 actual scene movement uses unchanged speed and neutral/release stops it', () => {
  const scene = mobile()
  down(scene)
  move(scene, 1, 330)
  scene.update(0, 100)
  assert.equal(scene.playerOne.container.x, 850)
  assert.equal(scene.playerTwo.container.x, 1580)
  move(scene, 1, 270)
  scene.update(0, 100)
  assert.equal(scene.playerOne.container.x, 820)
  move(scene, 1, 300)
  scene.update(0, 100)
  assert.equal(scene.playerOne.container.x, 820)
})

test('US-34 keyboard coexists with joystick and remains active after touch release', () => {
  const scene = mobile(), controls = scene.touchControls
  scene.movementKeys.playerOne.right.isDown = true
  scene.movementKeys.playerTwo.left.isDown = true
  down(scene)
  move(scene, 1, 270)
  const input = scene.readFighterInput('playerOne', scene.movementKeys.playerOne)
  assert.equal(input.leftHeld, true)
  assert.equal(input.rightHeld, true)
  scene.input.emit('pointerup', { id: 1 })
  hidden(controls)
  scene.update(0, 100)
  assert.equal(scene.playerOne.container.x, 850)
  assert.equal(scene.playerTwo.container.x, 1550)
})

for (const reset of ['blur', 'visibility', 'gameout', 'portrait', 'resize', 'safe-area', 'KO', 'shutdown']) {
  test(`US-34 ${reset} clears owner, movement and visuals without late-pointer resurrection`, () => {
    const scene = mobile(), controls = scene.touchControls
    down(scene)
    move(scene)
    if (reset === 'blur') dispatchWindowEvent('blur')
    if (reset === 'visibility') { setDocumentHidden(true); setDocumentHidden(false) }
    if (reset === 'gameout') scene.input.emit('gameout')
    if (reset === 'portrait') { setInputEnvironment(true, true); scene.update(0, 0) }
    if (reset === 'resize') controls.setViewport(1600, 720, { top: 0, right: 0, bottom: 0, left: 0 })
    if (reset === 'safe-area') controls.setViewport(1280, 720, { top: 0, right: 82, bottom: 0, left: 0 })
    if (reset === 'KO') scene.applyDamage(scene.playerOne, 100)
    if (reset === 'shutdown') scene.events.emit('shutdown')
    hidden(controls)
    move(scene)
    hidden(controls)
  })
}

test('US-34 repeated shutdown/restart does not duplicate joystick listeners or retain an owner', () => {
  const scene = mobile()
  for (let cycle = 0; cycle < 5; cycle++) {
    down(scene)
    move(scene)
    const old = scene.touchControls
    scene.scene.restart()
    setInputEnvironment(true)
    scene.update(0, 0)
    hidden(old)
    hidden(scene.touchControls)
    assert.equal(scene.input.listenerCount('pointerdown'), 1)
    assert.equal(scene.input.listenerCount('pointermove'), 1)
    assert.equal(scene.input.listenerCount('pointerup'), 1)
    assert.equal(scene.input.listenerCount('pointercancel'), 1)
  }
  scene.events.emit('shutdown')
  assert.equal(scene.input.listenerCount('pointerdown'), 0)
  assert.equal(scene.input.listenerCount('pointermove'), 0)
})

test('US-34 existing canvas gesture prevention and multi-pointer budget remain present', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
  const config = readFileSync(new URL('../src/game/config/gameConfig.ts', import.meta.url), 'utf8')
  assert.match(css, /canvas\s*\{[^}]*touch-action:\s*none/)
  assert.match(config, /activePointers:\s*6/)
})

test('US-34 only four labeled P1 action buttons are enabled; fixed P1 directions are removed', () => {
  const controls = mobile().touchControls
  const active = controls.buttons.filter(button => button.active)
  assert.deepEqual(Array.from(active, button => button.action), ['jump', 'block', 'light', 'heavy'])
  assert.ok(active.every(button => button.player === 'playerOne' && button.zone.input.enabled))
  assert.ok(active.every(button => button.caption.text === button.action.toUpperCase()))
  assert.equal(controls.buttons.some(button => button.player === 'playerOne' && ['left', 'right'].includes(button.action)), false)
})

test('US-34 retained P2 touch definitions stay invisible, disabled, and cannot issue intentions', () => {
  const scene = mobile(), controls = scene.touchControls
  const buttons = controls.buttons.filter(button => button.player === 'playerTwo')
  assert.equal(buttons.length, 6)
  for (const button of buttons) {
    assert.equal(button.active, false)
    assert.equal(button.zone.input.enabled, false)
    assert.equal(button.zone.visible, false)
    assert.equal(button.graphic.visible, false)
    if (button.caption) assert.equal(button.caption.visible, false)
    button.zone.emit('pointerdown', { id: 2, x: button.zone.x, y: button.zone.y })
    assert.equal(button.pointers.size, 0)
  }
  assert.equal(controls.isHeld('playerTwo', 'left'), false)
  assert.equal(controls.isHeld('playerTwo', 'right'), false)
  assert.equal(controls.isHeld('playerTwo', 'block'), false)
  assert.equal(controls.consumeJump('playerTwo'), false)
  assert.equal(controls.consumeAttack('playerTwo', 'light'), false)
  assert.equal(controls.consumeAttack('playerTwo', 'heavy'), false)
})

for (const [width, height] of [[667, 375], [844, 390], [896, 430]]) {
  test(`US-34 ${width}x${height}: actions fit safely in the right half with comfortable spacing`, () => {
    const controls = mobile().touchControls
    const logicalWidth = getAdaptiveViewportWidth(width, height)
    const scale = Math.min(width / logicalWidth, height / 720)
    for (const insets of [
      { left: 0, right: 0, top: 0, bottom: 0 },
      { left: 82, right: 82, top: 20, bottom: 39 },
    ]) {
      controls.setViewport(logicalWidth, 720, insets)
      const buttons = controls.buttons.filter(button => button.active)
      for (const button of buttons) {
        assert.ok(button.zone.x - button.width / 2 >= logicalWidth / 2)
        assert.ok(button.zone.x + button.width / 2 <= logicalWidth - insets.right)
        assert.ok(button.zone.y - button.height / 2 >= insets.top)
        assert.ok(button.zone.y + button.height / 2 <= 720 - insets.bottom)
        assert.ok(button.width * scale >= 60, 'touch target remains at least 60 CSS px')
        for (const other of buttons) {
          if (other === button) continue
          const gapX = Math.abs(button.zone.x - other.zone.x) - (button.width + other.width) / 2
          const gapY = Math.abs(button.zone.y - other.zone.y) - (button.height + other.height) / 2
          assert.ok(gapX * scale >= 12 || gapY * scale >= 12, 'separate fingers have a 12+ CSS px gap')
        }
      }
      assert.ok(controls.buttons.filter(button => button.player === 'playerTwo').every(button => !button.active))
    }
  })
}

test('US-34 former fixed-button positions are now available joystick activation points', () => {
  const scene = mobile(), controls = scene.touchControls
  for (const [x, y] of [[100, 630], [218, 630], [368, 500], [520, 630], [638, 718]]) {
    down(scene, 1, x, y)
    assert.equal(controls.joystickPointerId, 1)
    assert.deepEqual({ ...controls.joystickOrigin }, { x, y })
    move(scene, 1, x - 15, y)
    assert.equal(controls.isHeld('playerOne', 'left'), true)
    scene.input.emit('pointerup', { id: 1 })
  }
})

test('US-34 base and thumb are each exactly 20% larger without scaling the dead zone', () => {
  const scene = mobile(), controls = scene.touchControls
  assert.ok(Math.abs(controls.joystickBase.radius - 64 * 1.2) < 1e-8)
  assert.ok(Math.abs(controls.joystickThumb.radius - 24 * 1.2) < 1e-8)
  down(scene, 1, 1, 1)
  move(scene, 1, 15, 1)
  neutral(controls)
  move(scene, 1, 16, 1)
  assert.equal(controls.isHeld('playerOne', 'right'), true)
  move(scene, 1, -14, 1)
  assert.equal(controls.isHeld('playerOne', 'left'), true)
})

for (const [width, height] of [[667, 375], [844, 390], [896, 430]]) {
  test(`US-34 ${width}x${height}: enlarged joystick and thumb travel stay inside safe edges`, () => {
    const scene = mobile(), controls = scene.touchControls
    const logicalWidth = getAdaptiveViewportWidth(width, height)
    for (const insets of [
      { left: 0, right: 0, top: 0, bottom: 0 },
      { left: 82, right: 82, top: 20, bottom: 39 },
    ]) {
      controls.setViewport(logicalWidth, 720, insets)
      for (const [x, y] of [[1, 1], [1, 719], [logicalWidth / 2 - 1, 1], [logicalWidth / 2 - 1, 719]]) {
        down(scene, 1, x, y)
        assert.deepEqual({ ...controls.joystickOrigin }, { x, y })
        neutral(controls)
        for (const [dx, dy] of [[0, 0], [-1000, 0], [1000, 0], [0, -1000], [0, 1000], [-1000, -1000], [1000, 1000]]) {
          move(scene, 1, x + dx, y + dy)
          for (const [object, stroke] of [[controls.joystickBase, 1], [controls.joystickThumb, 0]]) {
            const extent = object.radius + stroke
            assert.ok(object.x - extent >= insets.left)
            assert.ok(object.x + extent <= logicalWidth / 2)
            assert.ok(object.y - extent >= insets.top)
            assert.ok(object.y + extent <= 720 - insets.bottom)
          }
          assert.equal(controls.isHeld('playerOne', 'left'), dx < -14)
          assert.equal(controls.isHeld('playerOne', 'right'), dx > 14)
        }
        scene.input.emit('pointerup', { id: 1 })
        hidden(controls)
      }
    }
  })
}

test('US-34 actual joystick plus Jump supports air steering without extra jump intentions', () => {
  const scene = mobile(), controls = scene.touchControls
  down(scene)
  move(scene)
  const jump = controls.buttons.find(button => button.player === 'playerOne' && button.action === 'jump')
  jump.zone.emit('pointerdown', { id: 2 })
  scene.update(0, 16)
  assert.equal(scene.playerOne.vertical.movementState, 'rising')
  assert.ok(scene.playerOne.vertical.footY < 560)
  assert.equal(scene.playerOne.container.x, 824.8)
  assert.equal(controls.consumeJump('playerOne'), false)
  scene.input.emit('pointerup', { id: 2 })
  assert.equal(controls.joystickPointerId, 1)
  scene.update(16, 16)
  assert.ok(scene.playerOne.container.x > 824.8)
})

for (const player of ['playerOne', 'playerTwo']) {
  test(`US-34 ${player} keyboard movement, Jump, Block, Light and Heavy remain independent of mobile layout`, () => {
    const scene = mobile()
    scene.movementKeys[player].left.isDown = true
    scene.blockKeys[player].isDown = true
    for (const key of [scene.movementKeys[player].jump, ...Object.values(scene.attackKeys[player])]) {
      key.onDown({ repeat: false, timeStamp: 0 })
      key.onUp({ timeStamp: 1 })
    }
    const input = scene.readFighterInput(player, scene.movementKeys[player])
    assert.equal(input.leftHeld, true)
    assert.equal(input.rightHeld, false)
    assert.equal(input.blockHeld, true)
    assert.equal(input.jumpPressed, true)
    assert.equal(input.lightPressed, true)
    assert.equal(input.heavyPressed, true)
    const second = scene.readFighterInput(player, scene.movementKeys[player])
    assert.equal(second.leftHeld, true)
    assert.equal(second.blockHeld, true)
    assert.equal(second.jumpPressed, false)
    assert.equal(second.lightPressed, false)
    assert.equal(second.heavyPressed, false)
  })
}
