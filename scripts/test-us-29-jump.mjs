import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as combatWorld from '../src/game/world/combatWorld.ts'
import {
  GROUND_TOP, GRAVITY, JUMP_VELOCITY, WORLD_WIDTH, MAX_FIGHTER_SEPARATION,
  createVerticalMovement, advanceVerticalMovement, getFighterWorldSpawns,
  moveFightersWithinWorld, getCombatCameraTarget,
} from '../src/game/world/combatWorld.ts'

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`)
const halfWidth = 36 // Existing 72 px fighter body; bounds must contain the full body.
const launch = () => advanceVerticalMovement(createVerticalMovement(), true, 0)
const land = (movement, delta = 1000 / 60) => {
  for (let frame = 0; frame < 240; frame++) {
    movement = advanceVerticalMovement(movement, false, delta)
    if (movement.movementState === 'grounded') return movement
  }
  assert.fail('jump did not land')
}

test('default/restart vertical state is grounded at the exact floor with zero velocity', () => {
  assert.deepEqual(createVerticalMovement(), {
    footY: GROUND_TOP, velocityY: 0, movementState: 'grounded',
  })
  assert.equal(GROUND_TOP, 560)
})

test('a grounded fresh jump launches upward into rising without mutating the previous state', () => {
  const grounded = createVerticalMovement()
  const movement = advanceVerticalMovement(grounded, true, 0)
  assert.equal(movement.movementState, 'rising')
  assert.equal(movement.velocityY, JUMP_VELOCITY)
  assert.equal(grounded.movementState, 'grounded')
  assert.equal(grounded.velocityY, 0)
  assert.ok(advanceVerticalMovement(movement, false, 16).footY < GROUND_TOP)
})

test('no fresh jump intention leaves the grounded fighter on the floor', () => {
  assert.deepEqual(advanceVerticalMovement(createVerticalMovement(), false, 1000), createVerticalMovement())
  const landed = land(launch())
  assert.deepEqual(advanceVerticalMovement(landed, false, 16), landed)
})

test('gravity transitions rising to falling at the analytical apex', () => {
  const apexSeconds = -JUMP_VELOCITY / GRAVITY
  const before = advanceVerticalMovement(launch(), false, (apexSeconds - 0.01) * 1000)
  const after = advanceVerticalMovement(launch(), false, (apexSeconds + 0.01) * 1000)
  assert.equal(before.movementState, 'rising')
  assert.equal(after.movementState, 'falling')
  assert.ok(before.velocityY < 0 && after.velocityY > 0)
  const apex = advanceVerticalMovement(launch(), false, apexSeconds * 1000)
  near(apex.footY, GROUND_TOP - JUMP_VELOCITY ** 2 / (2 * GRAVITY))
})

test('landing clamps exactly to the floor and clears velocity and airborne state', () => {
  assert.deepEqual(land(launch()), createVerticalMovement())
})

test('jump presses while rising do not relaunch or reset velocity', () => {
  const rising = advanceVerticalMovement(launch(), false, 100)
  assert.equal(rising.movementState, 'rising')
  assert.deepEqual(advanceVerticalMovement(rising, true, 16), advanceVerticalMovement(rising, false, 16))
})

test('jump presses while falling are discarded, including a press on the landing frame', () => {
  const falling = advanceVerticalMovement(launch(), false, 450)
  assert.equal(falling.movementState, 'falling')
  assert.deepEqual(advanceVerticalMovement(falling, true, 16), advanceVerticalMovement(falling, false, 16))
  assert.deepEqual(advanceVerticalMovement(falling, true, 1000), createVerticalMovement())
})

test('one hundred repeated fresh jumps never drift above or below the landing baseline', () => {
  let movement = createVerticalMovement()
  for (let cycle = 0; cycle < 100; cycle++) {
    movement = land(advanceVerticalMovement(movement, true, 0), 1000 / [30, 60, 120][cycle % 3])
    assert.deepEqual(movement, createVerticalMovement())
  }
})

test('vertical position and velocity are frame-rate independent at 30, 60 and 120 fps', () => {
  const results = [30, 60, 120].map(fps => {
    let movement = launch()
    for (let frame = 0; frame < fps / 2; frame++) {
      movement = advanceVerticalMovement(movement, false, 1000 / fps)
    }
    return movement
  })
  for (const result of results) {
    near(result.footY, GROUND_TOP + JUMP_VELOCITY * 0.5 + GRAVITY * 0.5 ** 2 / 2)
    near(result.velocityY, JUMP_VELOCITY + GRAVITY * 0.5)
    assert.equal(result.movementState, 'falling')
  }
})

test('both airborne fighters retain existing horizontal steering and can reverse direction', () => {
  const airborne = advanceVerticalMovement(launch(), false, 100)
  assert.notEqual(airborne.movementState, 'grounded')
  const spawns = getFighterWorldSpawns()
  const forward = moveFightersWithinWorld(...spawns, 30, 30, halfWidth)
  assert.deepEqual(forward, spawns.map(x => x + 30))
  assert.deepEqual(moveFightersWithinWorld(...forward, -30, -30, halfWidth), spawns)
})

test('air steering retains world boundaries for the entire fighter width', () => {
  assert.equal(advanceVerticalMovement(launch(), false, 100).movementState, 'rising')
  assert.deepEqual(moveFightersWithinWorld(100, 500, -1000, -1000, halfWidth), [halfWidth, halfWidth])
  assert.deepEqual(moveFightersWithinWorld(1900, 2300, 1000, 1000, halfWidth), [
    WORLD_WIDTH - halfWidth, WORLD_WIDTH - halfWidth,
  ])
})

test('air steering still enforces separation without displacing a stationary opponent', () => {
  const spawns = getFighterWorldSpawns()
  const positions = [spawns[0], spawns[0] + MAX_FIGHTER_SEPARATION]
  assert.deepEqual(moveFightersWithinWorld(...positions, -30, 0, halfWidth), positions)
  const both = moveFightersWithinWorld(...positions, -30, 30, halfWidth)
  near(both[1] - both[0], MAX_FIGHTER_SEPARATION)
})

test('airborne crossing is allowed and X-based facing/camera framing remains independent of height', () => {
  const [one, two] = moveFightersWithinWorld(600, 602, 5, -5, halfWidth)
  assert.ok(one > two)
  for (const width of [1280, 1558, 1600]) {
    const initial = getCombatCameraTarget(...getFighterWorldSpawns(), width)
    assert.equal(advanceVerticalMovement(launch(), false, 100).movementState, 'rising')
    assert.equal(getCombatCameraTarget(...getFighterWorldSpawns(), width), initial)
  }
})

test('restart/default states are independent and retain fixed world spawns at every viewport width', () => {
  const previous = advanceVerticalMovement(launch(), false, 450)
  for (const width of [1280, 1558, 1600]) {
    assert.deepEqual(getFighterWorldSpawns(), [820, 1580], `restart at width ${width}`)
    const one = createVerticalMovement()
    const two = createVerticalMovement()
    assert.deepEqual(one, { footY: GROUND_TOP, velocityY: 0, movementState: 'grounded' })
    assert.deepEqual(two, one)
    assert.notEqual(one, two)
    assert.equal(previous.movementState, 'falling')
  }
})

test('long frames land safely and invalid/negative elapsed time cannot move the fighter', () => {
  assert.deepEqual(advanceVerticalMovement(launch(), false, 10000), createVerticalMovement())
  for (const delta of [0, -1, NaN, Infinity]) {
    assert.deepEqual(advanceVerticalMovement(launch(), false, delta), launch())
  }
})

// Load the production scene without browser/renderer startup. Only Phaser's base
// class and presentation services are stubbed; update(), input consumption and
// passive settling execute their real implementation, using the real world helper.
const require = createRequire(import.meta.url)
const JustDown = require(fileURLToPath(new URL(
  '../node_modules/phaser/src/input/keyboard/keys/JustDown.js', import.meta.url,
)))
const sceneSource = readFileSync(new URL('../src/game/scenes/CombatScene.ts', import.meta.url), 'utf8')
const compiledScene = ts.transpileModule(sceneSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText
const sceneExports = {}
runInNewContext(compiledScene, {
  exports: sceneExports,
  require: name => {
    if (name === 'phaser') return { Scene: class {}, Input: { Keyboard: { JustDown } } }
    if (name === '../controls/TouchControls') return {}
    if (name === '../world/combatWorld') return combatWorld
    throw new Error(`Unexpected scene dependency: ${name}`)
  },
  window: { matchMedia: () => ({ matches: false }) },
  console,
})

const makeCompletedScene = (winner = 'PLAYER 1') => {
  const scene = new sceneExports.CombatScene()
  const [oneX, twoX] = getFighterWorldSpawns()
  const fighter = (x, facing) => ({
    container: { x, y: GROUND_TOP - 70 }, // Existing 140 px body center.
    vertical: createVerticalMovement(), facing, health: 100,
    attackState: 'idle', attackPhaseElapsed: 0, attackHasHit: false,
  })
  scene.playerOne = fighter(oneX, 'right')
  scene.playerTwo = fighter(twoX, 'left')
  scene.winner = winner
  scene[winner === 'PLAYER 1' ? 'playerTwo' : 'playerOne'].health = 0
  scene.movementKeys = {
    playerOne: { left: { isDown: true }, right: { isDown: false } },
    playerTwo: { left: { isDown: false }, right: { isDown: true } },
  }
  scene.pendingKeyboardJump = { playerOne: true, playerTwo: true }
  scene.attackKeys = { playerOne: { _justDown: true }, playerTwo: { _justDown: true } }
  scene.restartKey = { _justDown: false }
  const touchJumps = { playerOne: true, playerTwo: true }
  const touchAttacks = { playerOne: true, playerTwo: true }
  scene.touchControls = {
    setPresentation() {}, consumeRestart: () => false,
    isHeld: (_player, action) => action === 'right',
    consumeJump: player => { const pressed = touchJumps[player]; touchJumps[player] = false; return pressed },
    consumeAttack: player => { const pressed = touchAttacks[player]; touchAttacks[player] = false; return pressed },
  }
  const presentation = { frames: 0, restarts: 0 }
  scene.scene = { restart: () => { presentation.restarts += 1 } }
  scene.startAmbienceIfUnlocked = () => {}
  scene.updateResponsiveHud = () => {}
  scene.updateJonVisual = () => { presentation.frames += 1 }
  scene.updateVfx = () => {}
  for (const method of ['moveFighters', 'updateFacing', 'tryStartAttack', 'advanceAttack', 'applyDamage']) {
    scene[method] = () => assert.fail(`Completed match must not call ${method}`)
  }
  return { scene, presentation, touchJumps, touchAttacks }
}

const runCompletedFrames = (scene, frames = 120) => {
  for (let frame = 0; frame < frames; frame++) scene.update(frame * 1000 / 60, 1000 / 60)
}

for (const player of ['playerOne', 'playerTwo']) {
  test(`completed scene path passively lands airborne ${player}, whether winner or loser`, () => {
    for (const winner of ['PLAYER 1', 'PLAYER 2']) {
      const { scene, presentation } = makeCompletedScene(winner)
      const fighter = scene[player]
      // The Reviewer's exact rising reproduction; also test an already-falling fighter.
      for (const velocityY of [-470, 200]) {
        fighter.vertical = { footY: 504, velocityY, movementState: velocityY < 0 ? 'rising' : 'falling' }
        fighter.container.y = 434
        scene.update(0, 1000 / 60)
        assert.notEqual(fighter.vertical.footY, 504, 'early return must not freeze physics')
        near(fighter.container.y, fighter.vertical.footY - 70)
        runCompletedFrames(scene, 119) // Exactly two seconds including the first update.
        assert.deepEqual(fighter.vertical, createVerticalMovement())
        assert.equal(fighter.container.y, GROUND_TOP - 70)
        assert.equal(scene.winner, winner)
        assert.ok(presentation.frames > 0, 'post-match presentation still advances')
      }
    }
  })
}

test('completed scene locks both X positions and facing despite keyboard/touch steering', () => {
  const { scene } = makeCompletedScene()
  scene.playerOne.vertical = launch()
  scene.playerTwo.vertical = launch()
  runCompletedFrames(scene)
  assert.deepEqual([scene.playerOne.container.x, scene.playerTwo.container.x], getFighterWorldSpawns())
  assert.equal(scene.playerOne.facing, 'right')
  assert.equal(scene.playerTwo.facing, 'left')
})

test('completed scene consumes keyboard/touch jump presses without launching or bouncing', () => {
  const { scene, touchJumps } = makeCompletedScene()
  runCompletedFrames(scene)
  for (const player of ['playerOne', 'playerTwo']) {
    assert.deepEqual(scene[player].vertical, createVerticalMovement())
    assert.equal(scene.pendingKeyboardJump[player], false)
    assert.equal(touchJumps[player], false)
  }
})

test('completed scene consumes keyboard/touch attack presses without starting attacks', () => {
  const { scene, touchAttacks } = makeCompletedScene()
  runCompletedFrames(scene)
  for (const player of ['playerOne', 'playerTwo']) {
    assert.equal(scene[player].attackState, 'idle')
    assert.equal(scene[player].attackPhaseElapsed, 0)
    assert.equal(scene.attackKeys[player]._justDown, false)
    assert.equal(touchAttacks[player], false)
  }
})

test('completed scene preserves winner and final health while both airborne fighters settle', () => {
  for (const winner of ['PLAYER 1', 'PLAYER 2']) {
    const { scene } = makeCompletedScene(winner)
    const health = [scene.playerOne.health, scene.playerTwo.health]
    scene.playerOne.vertical = launch()
    scene.playerTwo.vertical = advanceVerticalMovement(launch(), false, 450)
    runCompletedFrames(scene)
    assert.equal(scene.winner, winner)
    assert.deepEqual([scene.playerOne.health, scene.playerTwo.health], health)
    assert.deepEqual(scene.playerOne.vertical, createVerticalMovement())
    assert.deepEqual(scene.playerTwo.vertical, createVerticalMovement())
  }
})

test('completed scene still accepts keyboard or touch restart before passive settling', () => {
  for (const input of ['keyboard', 'touch']) {
    const { scene, presentation } = makeCompletedScene()
    scene.playerOne.vertical = launch()
    if (input === 'keyboard') scene.restartKey._justDown = true
    else scene.touchControls.consumeRestart = () => true
    scene.update(0, 16)
    assert.equal(presentation.restarts, 1)
    assert.equal(presentation.frames, 0)
    assert.equal(scene.playerOne.vertical.velocityY, JUMP_VELOCITY)
  }
})
