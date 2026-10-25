import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { MENU_OPTIONS, MenuSelection, menuLayout } from '../src/game/menu/menuModel.ts'
import * as model from '../src/game/menu/menuModel.ts'
import * as world from '../src/game/world/combatWorld.ts'
import * as motionModule from '../src/game/menu/menuMotion.ts'
import { makeScene } from './test-us-30-attacks.mjs'

const require = createRequire(import.meta.url)
const EventEmitter = require('eventemitter3')
const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const atlas = JSON.parse(read('src/assets/menu/buttons-atlas.json'))
const target = () => {
  const emitter = new EventEmitter()
  emitter.addEventListener = emitter.on.bind(emitter)
  emitter.removeEventListener = emitter.off.bind(emitter)
  return emitter
}
const windowMock = Object.assign(target(), { matchMedia: () => ({ matches: false }) })
const documentMock = Object.assign(target(), { hidden: false, hasFocus: () => true })
const phaser = { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown' } }, Scale: { Events: { RESIZE: 'resize' } } }
const load = path => {
  const exports = {}
  // Vite expands asset URL globs at build time; the scene-flow harness needs no textures.
  const source = read(path).replace(/import\.meta\.glob<string>\([\s\S]*?\n\)/g, '({})')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  runInNewContext(code, {
    exports, require: name => {
      if (name === 'phaser') return phaser
      if (name.endsWith('menuModel')) return model
      if (name.endsWith('menuMotion')) return motionModule
      if (name.endsWith('combatWorld')) return world
      if (name.endsWith('.json')) return atlas
      if (/\.(webp|png|wav)$/.test(name)) return name
      throw Error(`Unexpected dependency ${name}`)
    }, window: windowMock, document: documentMock,
  })
  return exports
}
const { MainMenuScene } = load('src/game/scenes/MainMenuScene.ts')
const { BootScene } = load('src/game/scenes/BootScene.ts')

function display() {
  const item = { texture: { getSourceImage: () => ({ width: 1672, height: 941 }) } }
  for (const key of ['setOrigin', 'setFillStyle', 'setStrokeStyle', 'setPosition', 'setFontSize', 'setSize', 'setDisplaySize', 'setWordWrapWidth', 'setScale', 'setText', 'setAlpha']) {
    item[key] = (...values) => { item[key + 'Values'] = values; return item }
  }
  item.setFrame = frame => { item.frame = frame; return item }
  item.setVisible = visible => { item.visible = visible; return item }
  return item
}
function menu(reduced = true) {
  const scene = new MainMenuScene()
  scene.add = { image: display, polygon: display, text: display }
  scene.input = Object.assign(target(), { keyboard: Object.assign(target(), { resetKeys() {} }) })
  scene.events = target()
  scene.scale = Object.assign(target(), { width: 1280, height: 720, parentSize: { width: 1280, height: 720 } })
  scene.cameras = { main: { setBackgroundColor() {} } }
  scene.game = { canvas: { parentElement: null, closest: () => null, getBoundingClientRect: () => ({ width: 1280, height: 720 }) } }
  scene.starts = []
  scene.scene = { start: (key, data) => scene.starts.push({ key, data }) }
  windowMock.matchMedia = query => ({ matches: query === '(prefers-reduced-motion: reduce)' && reduced })
  scene.create()
  windowMock.matchMedia = () => ({ matches: false })
  return scene
}
const key = (name, repeat = false) => ({ key: name, repeat, preventDefault() {} })
const close = scene => scene.events.emit('shutdown')

test('Boot enters registered MainMenuScene without development-only mode routing', () => {
  const boot = new BootScene()
  let destination
  boot.scene = { start: value => { destination = value } }
  boot.create()
  assert.equal(destination, 'MainMenuScene')
  assert.match(read('src/game/config/gameConfig.ts'), /scene: \[BootScene, MainMenuScene, CombatScene\]/)
  assert.doesNotMatch(read('src/game/scenes/MainMenuScene.ts'), /import\.meta\.env\.DEV|URLSearchParams/)
})

for (let option = 0; option < 2; option++) {
  test(`${MENU_OPTIONS[option].label} propagates its typed mode into actual combat ownership`, () => {
    const scene = menu()
    if (option) scene.input.keyboard.emit('keydown', key('ArrowDown'))
    scene.input.keyboard.emit('keydown', key('Enter'))
    scene.input.keyboard.emit('keyup', key('Enter'))
    scene.update()
    assert.equal(scene.starts.length, option ? 0 : 1, 'held navigation must delay handoff')
    if (option) { scene.input.keyboard.emit('keyup', key('ArrowDown')); scene.update() }
    assert.equal(scene.starts[0].key, 'CombatScene')
    assert.equal(scene.starts[0].data.mode, MENU_OPTIONS[option].mode)
    const combat = makeScene(scene.starts[0].data.mode)
    assert.equal(Boolean(combat.lyraAI), option === 0)
    assert.equal(combat.mode, MENU_OPTIONS[option].mode)
    combat.events.emit('shutdown')
    scene.update()
    assert.equal(scene.starts.length, 1)
    close(scene)
  })
}

for (const activation of ['Enter', ' ']) {
  test(`${activation} activates only on fresh press and release, preserving focus while pressed`, () => {
    const scene = menu()
    scene.input.keyboard.emit('keydown', key(activation, true))
    scene.input.keyboard.emit('keyup', key(activation))
    scene.update()
    assert.equal(scene.starts.length, 0)
    scene.input.keyboard.emit('keydown', key(activation))
    assert.equal(scene.buttons[0].image.frame, 'pressed')
    assert.equal(scene.buttons[0].focus.visible, true)
    scene.input.keyboard.emit('keydown', key(activation, true))
    scene.update()
    assert.equal(scene.starts.length, 0)
    scene.input.keyboard.emit('keyup', key(activation))
    scene.update()
    assert.equal(scene.starts.length, 1)
    close(scene)
  })
}

test('Tab/shift-Tab and arrows navigate the two options', () => {
  const selection = new MenuSelection()
  selection.keyDown('Tab', false)
  assert.equal(selection.selected, 1)
  selection.keyUp('Tab')
  selection.keyDown('Tab', false, true)
  assert.equal(selection.selected, 0)
  selection.keyUp('Tab')
  selection.keyDown('ArrowUp', false)
  assert.equal(selection.selected, 1)
})

for (let option = 0; option < 2; option++) {
  test(`valid pointer release activates ${MENU_OPTIONS[option].label} exactly once`, () => {
    const scene = menu()
    const pointer = { id: 1, x: scene.layout.x, y: scene.layout.ys[option], wasCanceled: false }
    scene.input.emit('pointerdown', pointer)
    scene.update()
    assert.equal(scene.starts.length, 0)
    scene.input.emit('pointerup', pointer)
    scene.update()
    scene.input.emit('pointerup', pointer)
    scene.update()
    assert.equal(scene.starts.length, 1)
    assert.equal(scene.starts[0].data.mode, MENU_OPTIONS[option].mode)
    close(scene)
  })

  test(`Phaser canceled pointerup rejects ${MENU_OPTIONS[option].label}, clears state and permits a fresh press`, () => {
    const scene = menu()
    const pointer = { id: 1, x: scene.layout.x, y: scene.layout.ys[option] }
    scene.input.emit('pointerdown', pointer)
    scene.input.emit('pointerup', { ...pointer, wasCanceled: true })
    scene.update()
    assert.equal(scene.starts.length, 0)
    assert.equal(scene.selection.pressed, false)
    assert.equal(scene.selection.owner, null)
    assert.equal(scene.selection.pending, null)
    assert.equal(scene.selection.pointers.size, 0)
    assert.equal(scene.buttons[option].focus.visible, true)
    // A later normal-looking release cannot resurrect the canceled press.
    scene.input.emit('pointerup', { ...pointer, wasCanceled: false })
    scene.update()
    assert.equal(scene.starts.length, 0)
    scene.input.emit('pointerdown', pointer)
    scene.input.emit('pointerup', { ...pointer, wasCanceled: false })
    scene.update()
    assert.equal(scene.starts.length, 1)
    assert.equal(scene.starts[0].data.mode, MENU_OPTIONS[option].mode)
    close(scene)
  })
}

for (const canceledId of [1, 2]) {
  test(`cancellation of pointer ${canceledId} invalidates the multi-pointer gesture without transferring ownership`, () => {
    const scene = menu()
    const owner = { id: 1, x: scene.layout.x, y: scene.layout.ys[0] }
    const other = { id: 2, x: scene.layout.x, y: scene.layout.ys[1] }
    scene.input.emit('pointerdown', owner)
    scene.input.emit('pointerdown', other)
    scene.input.emit('pointerup', { ...(canceledId === 1 ? owner : other), wasCanceled: true })
    scene.update()
    assert.equal(scene.starts.length, 0)
    assert.equal(scene.selection.owner, null)
    assert.equal(scene.selection.pressed, false)
    assert.equal(scene.selection.selected, 0)
    scene.input.emit('pointerup', canceledId === 1 ? other : owner)
    scene.update()
    assert.equal(scene.starts.length, 0)
    // A new, independent gesture still selects the intended mode.
    scene.input.emit('pointerdown', other)
    scene.input.emit('pointerup', other)
    scene.update()
    assert.equal(scene.starts[0].data.mode, 'local-versus')
    close(scene)
  })
}

test('canceled secondary release discards a selection already waiting for all pointers to release', () => {
  const scene = menu()
  const owner = { id: 1, x: scene.layout.x, y: scene.layout.ys[0] }
  const other = { id: 2, x: scene.layout.x, y: scene.layout.ys[1] }
  scene.input.emit('pointerdown', owner)
  scene.input.emit('pointerdown', other)
  scene.input.emit('pointerup', owner)
  scene.update()
  assert.equal(scene.starts.length, 0)
  assert.equal(scene.selection.pending, 'single-player')
  scene.input.emit('pointerup', { ...other, wasCanceled: true })
  scene.update()
  assert.equal(scene.starts.length, 0)
  assert.equal(scene.selection.pending, null)
  close(scene)
})

test('pointer owner cannot be hijacked; all touches release before combat', () => {
  const scene = menu()
  const l = scene.layout
  scene.input.emit('pointerdown', { id: 1, x: l.x, y: l.ys[0] })
  scene.input.emit('pointerdown', { id: 2, x: l.x, y: l.ys[1] })
  scene.input.emit('pointerup', { id: 1, x: l.x, y: l.ys[0] })
  scene.update()
  assert.equal(scene.starts.length, 0)
  scene.input.emit('pointerup', { id: 2, x: l.x, y: l.ys[1] })
  scene.update()
  assert.equal(scene.starts[0].data.mode, 'single-player')
  close(scene)
})

for (const event of ['pointercancel', 'pointerupoutside']) {
  test(`${event} cancels activation without changing keyboard selection`, () => {
    const scene = menu()
    scene.input.emit('pointerdown', { id: 1, x: scene.layout.x, y: scene.layout.ys[1] })
    scene.input.emit(event, { id: 1 })
    scene.update()
    assert.equal(scene.starts.length, 0)
    assert.equal(scene.buttons[1].focus.visible, true)
    close(scene)
  })
}

test('release outside button and hover do not activate', () => {
  const scene = menu()
  scene.input.emit('pointermove', { x: scene.layout.x, y: scene.layout.ys[1] })
  assert.equal(scene.selection.selected, 1)
  scene.input.emit('pointerdown', { id: 1, x: scene.layout.x, y: scene.layout.ys[1] })
  scene.input.emit('pointerup', { id: 1, x: 1200, y: 0 })
  scene.update()
  assert.equal(scene.starts.length, 0)
  close(scene)
})

test('focus loss discards pending activation; shutdown removes scene-owned listeners', () => {
  const scene = menu()
  scene.input.keyboard.emit('keydown', key('Enter'))
  windowMock.emit('blur')
  scene.input.keyboard.emit('keyup', key('Enter'))
  windowMock.emit('focus')
  scene.update()
  assert.equal(scene.starts.length, 0)
  close(scene)
  for (const name of ['blur', 'focus']) assert.equal(windowMock.listenerCount(name), 0)
  assert.equal(documentMock.listenerCount('visibilitychange'), 0)
  for (const name of ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'pointerupoutside']) assert.equal(scene.input.listenerCount(name), 0)
  assert.equal(scene.input.keyboard.listenerCount('keydown'), 0)
  assert.equal(scene.input.keyboard.listenerCount('keyup'), 0)
  assert.equal(scene.scale.listenerCount('resize'), 0)
})

test('preload selects just one background and a single shared atlas; cached textures are reused', () => {
  for (const mobile of [false, true]) {
    const scene = new MainMenuScene()
    const images = [], atlases = []
    scene.textures = { exists: () => false }
    scene.load = { image: (...args) => images.push(args), atlas: (...args) => atlases.push(args) }
    windowMock.matchMedia = () => ({ matches: mobile })
    scene.preload()
    assert.equal(images.length, 1)
    assert.match(images[0][1], mobile ? /corridor-mobile.webp$/ : /corridor-desktop.webp$/)
    assert.equal(atlases.length, 1)
    scene.textures.exists = () => true
    scene.preload()
    assert.equal(images.length, 1)
    assert.equal(atlases.length, 1)
  }
  windowMock.matchMedia = () => ({ matches: false })
})

for (const [width, height] of [[667, 375], [844, 390], [896, 430], [1280, 720], [1920, 1080]]) {
  test(`${width}x${height}: touch body >=52x44 CSS pixels, stable frames and safe layout`, () => {
    const w = world.getAdaptiveViewportWidth(width, height)
    const scale = Math.min(width / w, height / 720)
    const safe = { left: 30 / scale, right: 30 / scale, top: 0, bottom: 10 / scale }
    const l = menuLayout(w, 720, scale, safe)
    assert.ok(l.hitHeight * scale >= 52 - 1e-8)
    assert.ok(l.hitWidth * scale >= 44)
    assert.equal(l.width / l.height, 4)
    assert.ok(l.x - l.hitWidth / 2 >= safe.left)
    assert.ok(l.x + l.hitWidth / 2 <= w - safe.right)
    assert.ok(l.ys[0] - l.hitHeight / 2 >= safe.top)
    assert.ok(l.ys[0] + l.hitHeight / 2 < l.ys[1] - l.hitHeight / 2)
    assert.ok(l.ys[1] + l.hitHeight / 2 < l.noticeY)
    assert.ok(l.noticeY + l.noticeSize * (l.mobile ? 1.2 : 0.6) <= 720 - safe.bottom)
    assert.ok(Math.abs(l.visibleWidth / l.visibleHeight - 5) < 1e-8)
    assert.ok(Math.abs(l.width * 480 / 512 - l.visibleWidth) < 1e-8)
  })
}

test('desktop artwork matches reference composition independently of invisible frame padding', () => {
  const l = menuLayout(1280, 720, 1, { left: 0, right: 0, top: 0, bottom: 0 })
  assert.equal(l.visibleWidth, 376)
  assert.equal(l.visibleHeight, 75.2)
  assert.equal(l.x - l.visibleWidth / 2, 112)
  assert.equal(l.ys[0] - l.visibleHeight / 2, 364)
  assert.equal(l.ys[1] - l.visibleHeight / 2, 458)
  assert.equal(l.noticeY, 570)
})

test('mobile artwork follows the approved reference without growing to match touch hit areas', () => {
  const width = world.getAdaptiveViewportWidth(844, 390)
  const scale = Math.min(844 / width, 390 / 720)
  const l = menuLayout(width, 720, scale, { left: 0, right: 0, top: 0, bottom: 0 })
  assert.equal(l.mobile, true)
  assert.ok(l.visibleHeight * scale < 52)
  assert.ok(l.hitHeight * scale >= 52)
  assert.ok(Math.abs((l.x - l.visibleWidth / 2) * scale - 75.5) < 2)
  assert.ok(Math.abs(l.visibleWidth * scale - 224) < 2)
  assert.ok(Math.abs((l.ys[0] - l.visibleHeight / 2) * scale - 178) < 3)
  assert.ok(Math.abs((l.ys[1] - l.visibleHeight / 2) * scale - 234) < 3)
})

test('neutral, focused and pressed retain identical artwork, labels and chamfered focus geometry', () => {
  const scene = menu()
  const button = scene.buttons[0]
  const dimensions = () => JSON.stringify({
    artwork: [button.image.setDisplaySizeValues, button.image.setPositionValues],
    label: button.label.setPositionValues, focus: [button.focus.setPositionValues, button.focus.setScaleValues],
    hit: [scene.layout.hitWidth, scene.layout.hitHeight],
  })
  const expected = dimensions()
  scene.selection.hover(1)
  scene.renderSelection()
  assert.equal(button.image.frame, 'neutral')
  assert.equal(dimensions(), expected)
  scene.selection.hover(0)
  scene.renderSelection()
  assert.equal(button.image.frame, 'focused')
  assert.equal(button.focus.visible, true)
  assert.equal(dimensions(), expected)
  scene.input.keyboard.emit('keydown', key('Enter'))
  assert.equal(button.image.frame, 'pressed')
  assert.equal(button.focus.visible, true)
  assert.equal(dimensions(), expected)
  assert.doesNotMatch(read('src/game/scenes/MainMenuScene.ts'), /this\.add\.rectangle/)
  close(scene)
})

test('runtime exports match Sansa provenance hashes and atlas registration', () => {
  const manifest = JSON.parse(read('src/assets/menu/SOURCE-MANIFEST.json'))
  for (const name of ['corridor-desktop.webp', 'corridor-mobile.webp', 'buttons-atlas.webp']) {
    const record = manifest.files.find(entry => entry.file.endsWith('/' + name))
    const data = readFileSync(new URL('src/assets/menu/' + name, root))
    assert.equal(data.length, record.bytes)
    assert.equal(createHash('sha256').update(data).digest('hex'), record.sha256)
  }
  for (const [index, name] of ['neutral', 'focused', 'pressed'].entries()) {
    assert.deepEqual(atlas.frames[name].frame, { x: 0, y: 128 * index, w: 512, h: 128 })
    assert.equal(atlas.frames[name].trimmed, false)
    assert.equal(atlas.frames[name].rotated, false)
  }
  assert.doesNotMatch(read('src/game/scenes/MainMenuScene.ts'), /load\.(image|atlas)\([^\n]*(?:logo|title)/i)
})

const { MenuMotion, MENU_MOTION } = motionModule
const selectCPU = scene => {
  scene.input.keyboard.emit('keydown', key('Enter'))
  scene.input.keyboard.emit('keyup', key('Enter'))
  scene.update(0, 0)
}

test('entrance reaches full controls at 160 ms and stationary corridor at 250 ms', () => {
  const scene = menu(false)
  const position = JSON.stringify(scene.background.setPositionValues)
  assert.equal(scene.motion.backgroundAlpha, 0)
  scene.update(0, 80)
  assert.equal(scene.motion.controlsAlpha, 0.5)
  scene.update(0, 80)
  assert.equal(scene.motion.controlsAlpha, 1)
  assert.ok(scene.motion.backgroundAlpha < 1)
  scene.update(0, 90)
  assert.equal(scene.motion.phase, 'ready')
  assert.equal(scene.motion.backgroundAlpha, 1)
  assert.equal(JSON.stringify(scene.background.setPositionValues), position)
  close(scene)
})

for (const mode of ['single-player', 'local-versus']) {
  test(`${mode} selection supersedes entrance, holds feedback 40 ms and exits at exactly 140 ms`, () => {
    const scene = menu(false)
    scene.update(0, 20)
    if (mode === 'local-versus') {
      scene.input.keyboard.emit('keydown', key('ArrowDown'))
      scene.input.keyboard.emit('keyup', key('ArrowDown'))
    }
    selectCPU(scene)
    assert.equal(scene.motion.phase, 'outgoing')
    assert.equal(scene.buttons[scene.selection.selected].image.frame, 'pressed')
    assert.equal(scene.buttons[scene.selection.selected].focus.visible, true)
    scene.update(0, 40)
    assert.equal(scene.motion.controlsAlpha, 1)
    scene.update(0, 99)
    assert.equal(scene.starts.length, 0)
    scene.update(0, 1)
    assert.equal(scene.starts.length, 1)
    assert.equal(scene.starts[0].data.mode, mode)
    assert.equal(scene.starts[0].data.menuReveal, true)
    assert.equal(scene.motion.backgroundAlpha, 0)
    scene.update(0, 10000)
    assert.equal(scene.starts.length, 1)
    close(scene)
  })
}

test('repeat activation cannot reset the outgoing fade or start duplicate transitions', () => {
  const scene = menu(false)
  selectCPU(scene)
  scene.update(0, 80)
  const alpha = scene.motion.controlsAlpha
  scene.input.keyboard.emit('keydown', key('Enter', true))
  assert.equal(scene.motion.controlsAlpha, alpha)
  scene.update(0, 60)
  assert.equal(scene.starts.length, 0, 'a newly held key must release before handoff')
  scene.input.keyboard.emit('keyup', key('Enter'))
  scene.update()
  scene.update(0, 1000)
  assert.equal(scene.starts.length, 1)
  close(scene)
})

test('touch selection at the start of entrance is immediate and does not inherit prior frame time', () => {
  for (let option = 0; option < 2; option++) {
    const scene = menu(false)
    const pointer = { id: 1, x: scene.layout.x, y: scene.layout.ys[option] }
    assert.equal(scene.motion.controlsAlpha, 0)
    scene.input.emit('pointerdown', pointer)
    assert.equal(scene.motion.controlsAlpha, 1)
    assert.equal(scene.buttons[option].image.frame, 'pressed')
    scene.input.emit('pointerup', pointer)
    scene.update(0, 500)
    assert.equal(scene.motion.phase, 'outgoing')
    assert.equal(scene.starts.length, 0)
    scene.update(0, 140)
    assert.equal(scene.starts[0].data.mode, MENU_OPTIONS[option].mode)
    close(scene)
  }
})

for (const phase of ['entrance', 'outgoing']) {
  test(`native canceled release during ${phase} cannot leave a stale delayed transition`, () => {
    const scene = menu(false)
    if (phase === 'outgoing') selectCPU(scene)
    const pointer = { id: 9, x: scene.layout.x, y: scene.layout.ys[0] }
    scene.input.emit('pointerdown', pointer)
    scene.input.emit('pointerup', { ...pointer, wasCanceled: true })
    scene.update(0, 1000)
    assert.equal(scene.starts.length, 0)
    assert.equal(scene.pendingMode, null)
    assert.equal(scene.selection.pressed, false)
    selectCPU(scene)
    scene.update(0, 140)
    assert.equal(scene.starts.length, 1)
    close(scene)
  })
}

test('multi-pointer cancellation during entrance is preserved with motion enabled', () => {
  const scene = menu(false)
  const owner = { id: 1, x: scene.layout.x, y: scene.layout.ys[0] }
  const second = { id: 2, x: scene.layout.x, y: scene.layout.ys[1] }
  scene.input.emit('pointerdown', owner)
  scene.input.emit('pointerdown', second)
  scene.input.emit('pointerup', owner)
  scene.input.emit('pointerup', { ...second, wasCanceled: true })
  scene.update(0, 1000)
  assert.equal(scene.starts.length, 0)
  close(scene)
})

test('reduced motion removes all presentation delays, including combat reveal', () => {
  const scene = menu(true)
  assert.equal(scene.motion.phase, 'ready')
  assert.equal(scene.motion.backgroundAlpha, 1)
  scene.input.keyboard.emit('keydown', key('ArrowDown'))
  assert.equal(scene.buttons[1].fadeMs, 100)
  scene.input.keyboard.emit('keyup', key('ArrowDown'))
  selectCPU(scene)
  assert.equal(scene.starts.length, 1)
  assert.equal(scene.starts[0].data.menuReveal, false)
  close(scene)
})

test('live reduced-motion change settles motion without replaying entrance', () => {
  const scene = menu(false)
  scene.update(0, 60)
  scene.motionPreference.matches = true
  scene.update()
  assert.equal(scene.motion.phase, 'ready')
  assert.equal(scene.motion.controlsAlpha, 1)
  scene.motionPreference.matches = false
  scene.update()
  assert.equal(scene.motion.phase, 'ready')
  close(scene)
})

test('reduced motion enabled during exit completes immediately with no combat fade', () => {
  const scene = menu(false)
  selectCPU(scene)
  scene.update(0, 50)
  scene.motionPreference.matches = true
  scene.update()
  assert.equal(scene.starts.length, 1)
  assert.equal(scene.starts[0].data.menuReveal, false)
  close(scene)
})

test('rotation pauses entrance and resumes elapsed time without replay or catch-up', () => {
  const scene = menu(false)
  scene.update(0, 80)
  windowMock.matchMedia = query => ({ matches: query === '(any-pointer: coarse)' || query === '(orientation: portrait)' })
  scene.update(0, 10000)
  assert.equal(scene.motion.backgroundAlpha, 80 / 250)
  windowMock.matchMedia = () => ({ matches: false })
  scene.update(0, 10000)
  assert.equal(scene.motion.backgroundAlpha, 80 / 250)
  scene.update(0, 170)
  assert.equal(scene.motion.phase, 'ready')
  close(scene)
})

test('focus blending lasts 100 ms, while pressed state and focus indication are immediate', () => {
  const scene = menu(false)
  scene.update(0, 250)
  const dimensions = JSON.stringify(scene.buttons[1].image.setDisplaySizeValues)
  scene.input.keyboard.emit('keydown', key('ArrowDown'))
  const button = scene.buttons[1]
  assert.equal(button.fadeMs, 0)
  assert.equal(button.focus.visible, true)
  scene.update(0, 99)
  assert.ok(button.previous.setAlphaValues[0] > 0)
  scene.update(0, 1)
  assert.equal(button.previous.setAlphaValues[0], 0)
  scene.input.keyboard.emit('keydown', key('Enter'))
  assert.equal(button.image.frame, 'pressed')
  assert.equal(button.previous.visible, false)
  assert.equal(button.focus.visible, true)
  assert.equal(JSON.stringify(button.image.setDisplaySizeValues), dimensions)
  close(scene)
})

test('hidden page pauses entrance, discards hidden elapsed time and does not replay on resize', () => {
  const scene = menu(false)
  scene.update(0, 50)
  documentMock.hidden = true
  documentMock.emit('visibilitychange')
  scene.update(0, 10000)
  assert.equal(scene.motion.backgroundAlpha, 0.2)
  documentMock.hidden = false
  documentMock.emit('visibilitychange')
  scene.update(0, 10000)
  assert.equal(scene.motion.backgroundAlpha, 0.2)
  scene.update(0, 200)
  scene.resize()
  assert.equal(scene.motion.phase, 'ready')
  close(scene)
})

test('shutdown disposes unfinished entrance/exit with no delayed scene start', () => {
  for (const outgoing of [false, true]) {
    const scene = menu(false)
    if (outgoing) selectCPU(scene)
    close(scene)
    scene.update(0, 10000)
    assert.equal(scene.motion.phase, 'disposed')
    assert.equal(scene.starts.length, 0)
  }
})

test('combat fade is presentation-only and requested only on menu entry, not restart', () => {
  const scene = makeScene('single-player', { menuReveal: true })
  assert.equal(scene.cameras.main.fades.length, 1)
  assert.deepEqual(scene.cameras.main.fades[0], [MENU_MOTION.combatRevealMs, ...MENU_MOTION.midnight])
  assert.equal(scene.playerOne.health, 100)
  assert.equal(scene.playerTwo.health, 100)
  assert.ok(scene.lyraAI)
  scene.scene.restart({ mode: 'single-player' })
  assert.equal(scene.cameras.main.fades.length, 1)
  scene.events.emit('shutdown')
})

test('motion clocks ignore invalid deltas and disposed clocks cannot transition', () => {
  const motion = new MenuMotion(false)
  for (const delta of [-1, NaN, Infinity]) motion.advance(delta)
  assert.equal(motion.backgroundAlpha, 0)
  motion.dispose()
  motion.advance(10000)
  assert.equal(motion.phase, 'disposed')
})
