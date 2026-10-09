import assert from 'node:assert/strict'
import test from 'node:test'
import { JON_VISUALS, LYRA_VISUALS } from '../src/game/presentation/fighterVisuals.ts'
import { makeScene } from './test-us-30-attacks.mjs'

test('US-36 display names use the existing centralized visual configuration', () => {
  assert.equal(JON_VISUALS.name, 'ALARIC DUSKBANE')
  assert.equal(LYRA_VISUALS.name, 'LYRA THORNVALE')
})

test('US-36 both HUD labels show the complete approved uppercase names', () => {
  const scene = makeScene()
  assert.equal(scene.playerOneHealthBar.label.text, 'ALARIC DUSKBANE')
  assert.equal(scene.playerTwoHealthBar.label.text, 'LYRA THORNVALE')
})

for (const [loser, winner, result] of [
  ['playerTwo', 'PLAYER 1', 'ALARIC DUSKBANE WINS'],
  ['playerOne', 'PLAYER 2', 'LYRA THORNVALE WINS'],
]) {
  test(`US-36 ${winner} result uses the display name without renaming winner identity`, () => {
    const scene = makeScene()
    scene.applyDamage(scene[loser], 100)
    assert.equal(scene.winner, winner)
    assert.equal(scene.winnerText.text, result)
    assert.equal(scene[loser].health, 0)
  })

  test(`US-36 names survive repeated victory/restart cycles after ${winner} wins`, () => {
    const scene = makeScene()
    for (let cycle = 1; cycle <= 3; cycle++) {
      scene.applyDamage(scene[loser], 100)
      assert.equal(scene.winnerText.text, result)
      scene.restartKey._justDown = true
      scene.update(0, 0)
      assert.equal(scene.restarts, cycle)
      assert.equal(scene.winner, null)
      assert.equal(scene.playerOneHealthBar.label.text, 'ALARIC DUSKBANE')
      assert.equal(scene.playerTwoHealthBar.label.text, 'LYRA THORNVALE')
      assert.equal(scene.playerOne.health, 100)
      assert.equal(scene.playerTwo.health, 100)
    }
  })
}

// Check existing label anchoring across logical viewport widths. Pixel-level
// font fit is separately verified in the browser, not simulated by this harness.
for (const width of [1280, 1360, 1600]) {
  test(`US-36 full names retain mirrored HUD anchoring at ${width} logical pixels`, () => {
    const scene = makeScene()
    const left = scene.playerOneHealthBar
    const right = scene.playerTwoHealthBar
    scene.positionHealthBar(left, 40)
    scene.positionHealthBar(right, width - 40 - right.panel.width)
    assert.equal(left.label.text, 'ALARIC DUSKBANE')
    assert.equal(right.label.text, 'LYRA THORNVALE')
    assert.equal(left.label.originX, 0)
    assert.equal(right.label.originX, 1)
    assert.equal(left.label.x, left.frame.x)
    assert.equal(right.label.x, right.frame.x + right.frame.width)
    assert.ok(left.panel.x + left.panel.width < right.panel.x)
  })
}
