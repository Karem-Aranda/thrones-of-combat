import assert from 'node:assert/strict'
import test from 'node:test'
import { makeScene } from './test-us-30-attacks.mjs'
import { GROUND_TOP, GRAVITY, JUMP_VELOCITY, createVerticalMovement, advanceVerticalMovement } from '../src/game/world/combatWorld.ts'

// Reuse the existing production-scene harness. Importing it also runs its 45
// combat regressions; the four tests below cover presentation only.
test('desktop Jon renders at 240 px reference head-to-foot height without scaling the body or P2', () => {
  const scene = makeScene()
  const jon = scene.playerOne
  const visual = jon.visual
  assert.equal(visual.scaleX, visual.scaleY, 'uniform presentation scaling')
  assert.ok(Math.abs(visual.scaleY * (1329 - 128) / 3 - 240) < 1e-9)
  assert.equal(visual.y, 70, 'unchanged local gameplay foot offset')
  assert.equal(jon.container.y + visual.y, GROUND_TOP)
  assert.equal(jon.vertical.footY, 560)
  const placeholder = scene.playerTwo.container.children[0]
  assert.equal(placeholder.width, 72)
  assert.equal(placeholder.height, 140)
  assert.equal(scene.playerTwo.visual, undefined)
  assert.equal(jon.attackArea.width, 100)
  scene.tryStartAttack(jon, 'heavy')
  assert.equal(jon.attackArea.width, 125)
})

test('landscape FIT keeps Jon at one third of usable canvas height without changing gameplay scale', () => {
  const scene = makeScene()
  const logicalHeight = scene.playerOne.visual.scaleY * (1329 - 128) / 3
  // Representative FIT bounds, independent of browser/device identity.
  for (const height of [342, 382]) {
    const width = height * 1600 / 720
    const fitScale = Math.min(width / 1600, height / 720)
    const cssHeight = logicalHeight * fitScale
    assert.ok(cssHeight / height >= 0.30 && cssHeight / height <= 0.35)
    assert.ok(Math.abs(cssHeight - height / 3) < 1e-9)
    assert.ok(cssHeight > 180 * fitScale, 'mobile presence increases versus the 180 px experiment')
    assert.equal(scene.playerOne.visual.scaleY, 720 / 1201, 'FIT does not rescale the gameplay container')
    assert.equal(scene.playerOne.visual.y, 70)
    assert.equal(scene.playerTwo.container.children[0].height, 140)
  }
})

test('all 22 existing Jon poses retain one uniform scale and their measured sole anchors', () => {
  const scene = makeScene()
  const visual = scene.playerOne.visual
  const scale = visual.scaleY
  const soles = {
    'jon-snow-guard': 1329, 'jon-idle-2': 1330, 'jon-idle-3': 1330, 'jon-idle-4': 1330,
    'jon-move-1': 1316, 'jon-move-2': 1322, 'jon-move-3': 1322,
    'jon-move-4': 1324, 'jon-move-5': 1316, 'jon-move-6': 1324,
    'jon-attack-s-1': 1324, 'jon-attack-s-2': 1328,
    'jon-attack-a-1': 1256, 'jon-attack-a-2': 1285, 'jon-attack-a-3': 1262,
    'jon-attack-r-1': 1280, 'jon-attack-r-2': 1322, 'jon-attack-r-3': 1329,
    'jon-hit-contact': 1348, 'jon-hit-recoil': 1348,
    'jon-ko-collapse': 1326, 'jon-ko-hold': 1336,
  }
  for (const [key, sole] of Object.entries(soles)) {
    scene.setJonFrame(visual, key)
    const height = key === 'jon-move-3' ? 1373 : 1374
    assert.equal(visual.originX, 0.5)
    assert.equal(visual.originY, sole / height)
    assert.equal(visual.scaleX, scale)
    assert.equal(visual.scaleY, scale)
    const localSole = visual.y + (sole - visual.originY * height) / 3 * scale
    assert.ok(Math.abs(scene.playerOne.container.y + localSole - scene.playerOne.vertical.footY) < 1e-9)
  }
})

test('larger Jon follows unchanged rising/falling/landing and restart foot positions', () => {
  const scene = makeScene()
  const jon = scene.playerOne
  const scale = jon.visual.scaleY
  let vertical = advanceVerticalMovement(createVerticalMovement(), true, 0)
  for (let frame = 0; frame < 100; frame++) {
    vertical = advanceVerticalMovement(vertical, false, 16)
    jon.vertical = vertical
    scene.settleFightersVertically(0)
    assert.equal(jon.container.y + jon.visual.y, vertical.footY)
    assert.equal(jon.visual.scaleY, scale)
  }
  assert.equal(jon.vertical.movementState, 'grounded')
  assert.equal(jon.vertical.footY, 560)
  const apex = advanceVerticalMovement(createVerticalMovement(), true, -JUMP_VELOCITY / GRAVITY * 1000)
  assert.ok(apex.footY - 240 > 136, 'standing head clears the existing HUD bottom at jump apex')
  assert.equal(scene.cameras.main.zoom, 1)
  assert.equal(scene.cameras.main.scrollY, 0)
  scene.scene.restart()
  assert.equal(scene.playerOne.visual.scaleY, scale)
  assert.equal(scene.playerOne.container.y + scene.playerOne.visual.y, 560)
})
