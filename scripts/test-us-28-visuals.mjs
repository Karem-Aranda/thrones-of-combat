import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { makeScene } from './test-us-30-attacks.mjs'
import { JON_VISUALS, LYRA_VISUALS, phaseFrame } from '../src/game/presentation/fighterVisuals.ts'
import { ATTACK_DEFINITIONS as attacks } from '../src/game/combat/attackDefinitions.ts'
import { advanceVerticalMovement, createVerticalMovement } from '../src/game/world/combatWorld.ts'

const assetRoot = new URL('../src/assets/fighters/lyra-frames/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('metadata/animation-frame-manifest.json', assetRoot)))
const keys = Object.keys(LYRA_VISUALS.origins)
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)
const frame = fighter => fighter.visual.texture.key

test('US-28 exact cleaned package: 24 unique RGBA8 512×512 PNGs match approved hashes', () => {
  const sums = readFileSync(new URL('metadata/SHA256SUMS.txt', assetRoot), 'utf8')
  const expected = new Map(sums.trim().split('\n').map(line => line.split(/\s+/)).filter(([, path]) => path.startsWith('textures/')))
  assert.equal(expected.size, 24)
  assert.equal(keys.length, 24)
  assert.equal(new Set(keys).size, 24)
  assert.deepEqual(readdirSync(assetRoot).filter(name => name.endsWith('.png')).sort(), keys.map(key => `${key}.png`).sort())
  let disk = 0
  for (const key of keys) {
    const png = readFileSync(new URL(`${key}.png`, assetRoot))
    assert.equal(png.subarray(1, 4).toString(), 'PNG')
    assert.equal(png.readUInt32BE(16), 512)
    assert.equal(png.readUInt32BE(20), 512)
    assert.equal(png[24], 8)
    assert.equal(png[25], 6)
    assert.equal(expected.get(createHash('sha256').update(png).digest('hex')), `textures/${key}.png`)
    disk += png.length
  }
  assert.equal(disk, 1_400_834)
  assert.equal(keys.length * 512 * 512 * 4 / 1024 ** 2, 24)
})

test('US-28 mapping matches the approved manifest and every texture is used', () => {
  for (const [property, animation] of Object.entries({
    idle: 'idle', movement: 'movement', startup: 'attackStartup', active: 'attackActive', recovery: 'attackRecovery', hit: 'hit',
  })) assert.deepEqual(LYRA_VISUALS[property], manifest.animations[animation].frames)
  assert.deepEqual(LYRA_VISUALS.activeWeights, manifest.animations.attackActive.phaseWeights)
  assert.deepEqual(LYRA_VISUALS.hitWeights, manifest.animations.hit.phaseWeights)
  assert.equal(LYRA_VISUALS.guard, manifest.animations.block.frames[0])
  assert.equal(LYRA_VISUALS.rising, manifest.animations.rising.frames[0])
  assert.equal(LYRA_VISUALS.falling, manifest.animations.falling.frames[0])
  assert.deepEqual([...new Set(LYRA_VISUALS.ko)], manifest.animations.ko.frames)
  assert.deepEqual([...new Set([
    LYRA_VISUALS.guard, ...LYRA_VISUALS.idle, ...LYRA_VISUALS.movement,
    ...LYRA_VISUALS.startup, ...LYRA_VISUALS.active, ...LYRA_VISUALS.recovery,
    LYRA_VISUALS.rising, LYRA_VISUALS.falling, ...LYRA_VISUALS.hit, ...LYRA_VISUALS.ko,
  ])].sort(), [...keys].sort())
})

test('US-28 BootScene preloads exact filename keys and build contains all 24 assets', () => {
  const boot = readFileSync(new URL('../src/game/scenes/BootScene.ts', import.meta.url), 'utf8')
  assert.match(boot, /lyra-frames\/\*\.png/)
  assert.match(boot, /Object\.entries\(lyraTextureUrls\)/)
  assert.match(boot, /this\.load\.image\(key, url\)/)
  const built = readdirSync(new URL('../dist/assets/', import.meta.url))
  for (const key of keys) assert.equal(built.filter(name => name.startsWith(`${key}-`) && name.endsWith('.png')).length, 1)
})

test('US-28 Lyra registration is fixed for every pose and independent from Jon', () => {
  const s = makeScene(), f = s.playerTwo
  assert.equal(f.visualConfig, LYRA_VISUALS)
  assert.equal(s.playerOne.visualConfig, JON_VISUALS)
  assert.equal(s.playerOne.visual.scaleY, 720 / 1201)
  assert.notEqual(f.presentation, s.playerOne.presentation)
  near(f.visual.scaleY * (448 - 189), 190)
  for (const key of keys) {
    s.setFighterFrame(f, key)
    assert.equal(frame(f), key)
    assert.equal(f.visual.scaleX, 190 / 259)
    assert.equal(f.visual.scaleY, 190 / 259)
    assert.equal(f.visual.originX, 0.5)
    assert.equal(f.visual.originY, 0.875)
    assert.equal(f.visual.x, 0)
    assert.equal(f.visual.y, 70)
    near(f.container.y + f.visual.y + (448 - f.visual.originY * 512) * f.visual.scaleY, f.vertical.footY)
  }
})

test('US-28 all Lyra poses keep the real 72×140 hurtbox and Light/Heavy contact limits', () => {
  const s = makeScene(), a = s.playerOne, f = s.playerTwo
  for (const id of ['light', 'heavy']) {
    s.cancelAttack(a)
    s.tryStartAttack(a, id)
    a.attackState = 'active'
    for (const key of keys) {
      s.setFighterFrame(f, key)
      f.container.y = a.container.y
      f.container.x = a.container.x + attacks[id].reach + 72 + 0.001
      a.attackHasHit = false
      assert.equal(s.checkAttackHit(a, f), false, 'outside 36 px half-width')
      f.container.x -= 0.001
      assert.equal(s.checkAttackHit(a, f), true, 'Phaser includes edge contact')
      f.container.x = a.container.x + 100
      f.container.y = a.container.y + 35 + 70 + 0.001
      a.attackHasHit = false
      assert.equal(s.checkAttackHit(a, f), false, 'outside 70 px half-height')
      f.container.y -= 0.001
      assert.equal(s.checkAttackHit(a, f), true)
    }
  }
})

test('US-28 independent idle loops retain the approved Jon sequence and Lyra sequence', () => {
  const s = makeScene()
  for (let i = 0; i < 14; i++) {
    for (const f of [s.playerOne, s.playerTwo]) {
      s.updateFighterVisual(f, i === 0 ? 0 : 300, 0)
      assert.equal(frame(f), f.visualConfig.idle[i % f.visualConfig.idle.length])
    }
  }
})

for (const facing of ['left', 'right']) {
  test(`US-28 Lyra ${facing}: forward/retreat playback follows displacement, not held intentions`, () => {
    const s = makeScene(), f = s.playerTwo
    s.setFacing(f, facing)
    const forward = facing === 'right' ? 1 : -1
    s.updateFighterVisual(f, 16, forward)
    assert.equal(frame(f), 'lyra-move-1')
    s.updateFighterVisual(f, 100, forward)
    assert.equal(frame(f), 'lyra-move-2')
    s.updateFighterVisual(f, 16, -forward)
    assert.equal(frame(f), 'lyra-move-6')
    s.updateFighterVisual(f, 100, -forward)
    assert.equal(frame(f), 'lyra-move-5')
    s.updateFighterVisual(f, 16, 0)
    assert.equal(frame(f), 'lyra-guard')
    assert.equal(f.visual.flipX, facing === 'left')
  })
}

for (const id of ['light', 'heavy']) {
  for (const step of [1, 2]) {
    test(`US-28 ${id} step ${step}: artwork uses authoritative phase fractions without changing attack clocks`, () => {
      const s = makeScene(), f = s.playerTwo
      s.tryStartAttack(f, id)
      f.combo.step = step
      for (const phase of ['startup', 'active', 'recovery']) {
        f.attackState = phase
        const duration = phase === 'startup' ? s.attackStartup(f) : attacks[id][`${phase}Ms`]
        const frames = LYRA_VISUALS[phase]
        for (let i = 0; i < frames.length; i++) {
          f.attackPhaseElapsed = duration * (i + 0.1) / frames.length
          const elapsed = f.attackPhaseElapsed
          s.updateFighterVisual(f, 16, 0)
          assert.equal(frame(f), frames[i])
          assert.equal(f.attackPhaseElapsed, elapsed)
          assert.equal(f.attackState, phase)
          assert.equal(f.attackArea.width, attacks[id].reach)
        }
      }
    })
  }
}

test('US-28 Lyra shares real jump physics, holds Rising/Falling, and lands at root 560', () => {
  const s = makeScene(), f = s.playerTwo
  f.vertical = advanceVerticalMovement(createVerticalMovement(), true, 100)
  s.settleFightersVertically(0)
  s.updateFighterVisual(f, 16, 0)
  assert.equal(frame(f), 'lyra-rising')
  near(f.container.y + f.visual.y, f.vertical.footY)
  s.settleFightersVertically(350)
  s.updateFighterVisual(f, 16, 0)
  assert.equal(frame(f), 'lyra-falling')
  near(f.container.y + f.visual.y, f.vertical.footY)
  s.settleFightersVertically(1000)
  s.updateFighterVisual(f, 16, 0)
  assert.equal(frame(f), 'lyra-guard')
  assert.equal(f.container.y + f.visual.y, 560)
})

for (const id of ['light', 'heavy']) {
  test(`US-28 ${id}: real confirmed hit displays Lyra contact/recoil over existing hitstun; miss stays silent`, () => {
    const s = makeScene(), f = s.playerTwo, a = s.playerOne
    s.tryStartAttack(a, id)
    s.advanceAttack(a, f, attacks[id].startupMs)
    assert.equal(f.presentation.hitElapsed, null)
    assert.equal(f.health, 100)
    f.container.x = a.container.x + 100
    s.updateFacing()
    s.tryStartAttack(f, 'light')
    s.advanceAttack(a, f, 1)
    assert.equal(f.health, 100 - attacks[id].damage)
    assert.equal(f.attackState, 'idle', 'gameplay interruption remains authoritative')
    assert.equal(f.reaction.reactionState, 'hitstun')
    s.updateFighterVisual(f, 16, 0)
    assert.equal(frame(f), 'lyra-hit-contact')
    assert.equal(f.presentation.hitElapsed, 0, 'contact frame does not consume pre-hit delta')
    s.updateFighterVisual(f, attacks[id].hitstunMs / 2, 0)
    assert.equal(frame(f), 'lyra-hit-recoil')
    s.updateFighterVisual(f, attacks[id].hitstunMs / 2, 0)
    assert.equal(f.presentation.hitElapsed, null)
    assert.equal(frame(f), 'lyra-guard')
  })
}

test('US-28 Block reuses Guard and creates no hit/KO playback or duplicate damage', () => {
  const s = makeScene(), f = s.playerTwo, a = s.playerOne
  f.container.x = a.container.x + 100
  s.updateFacing()
  f.guardEligible = true
  s.tryStartAttack(a, 'heavy')
  s.advanceAttack(a, f, 300)
  s.updateFighterVisual(f, 16, 0)
  assert.equal(frame(f), 'lyra-guard')
  assert.equal(f.health, 100)
  assert.equal(f.reaction.reactionState, 'blockstun')
  assert.equal(f.presentation.hitElapsed, null)
  assert.equal(f.presentation.koElapsed, null)
})

test('US-28 facing/crossing flips only the illustration and equal X retains facing', () => {
  const s = makeScene(), f = s.playerTwo
  assert.equal(f.visual.flipX, true)
  f.container.x = s.playerOne.container.x - 100
  s.updateFacing()
  assert.equal(f.facing, 'right')
  assert.equal(f.visual.flipX, false)
  assert.equal(s.playerOne.visual.flipX, true)
  assert.equal(f.attackArea.x, 86)
  f.container.x = s.playerOne.container.x
  s.updateFacing()
  assert.equal(f.facing, 'right')
  assert.equal(f.visual.scaleX, 190 / 259)
  assert.equal(f.visual.x, 0)
})

for (const player of ['playerOne', 'playerTwo']) {
  test(`US-28 ${player}: KO settles after match lock; winner identity and restart remain correct`, () => {
    const s = makeScene(), loser = s[player]
    const winnerName = player === 'playerOne' ? 'LYRA' : 'JON SNOW'
    s.applyDamage(loser, 100)
    assert.equal(s.winnerText.text, `${winnerName} WINS`)
    s.update(0, 16)
    s.update(16, 330)
    assert.equal(frame(loser), loser.visualConfig.ko[2])
    s.update(346, 5000)
    assert.equal(frame(loser), loser.visualConfig.ko[2])
    assert.equal(loser.presentation.koElapsed, 400)
    const oldRuntime = loser.presentation
    const listeners = s.input.keyboard.listenerCount('keydown')
    s.restartKey._justDown = true // Same explicit key-edge driver as the existing restart suite.
    s.update(0, 0)
    assert.equal(s.restarts, 1)
    assert.equal(s.winner, null)
    assert.notEqual(s[player].presentation, oldRuntime)
    assert.equal(s.input.keyboard.listenerCount('keydown'), listeners)
    for (const f of [s.playerOne, s.playerTwo]) {
      assert.equal(f.health, 100)
      assert.equal(f.presentation.hitElapsed, null)
      assert.equal(f.presentation.koElapsed, null)
      assert.equal(frame(f), f.visualConfig.guard)
      assert.equal(f.vertical.footY, 560)
    }
    assert.equal(s.playerOne.container.x, 820)
    assert.equal(s.playerTwo.container.x, 1580)
    assert.equal(s.playerTwo.visual.flipX, true)
    assert.equal(s.playerTwoHealthBar.fill.width, 378)
  })
}

test('US-28 animation update clocks are independent of frame rate', () => {
  for (const fps of [30, 60, 120]) {
    const s = makeScene(), f = s.playerTwo
    s.updateFighterVisual(f, 0, -1)
    for (let i = 0; i < fps / 2; i++) s.updateFighterVisual(f, 1000 / fps, -1)
    near(f.presentation.elapsed, 500)
    // Avoid floating-point exact-boundary ambiguity when comparing artwork.
    s.updateFighterVisual(f, 1, -1)
    assert.equal(frame(f), 'lyra-move-6')
  }
  assert.equal(phaseFrame(LYRA_VISUALS.active, 1 / 3), 'lyra-attack-a-2')
  assert.equal(phaseFrame(LYRA_VISUALS.active, 2 / 3), 'lyra-attack-a-3')
})

test('US-28 texture memory remains bounded; metadata is not runtime artwork', () => {
  const runtimeFiles = [
    new URL('../src/assets/fighters/jon-snow-guard.png', import.meta.url),
    ...readdirSync(new URL('../src/assets/fighters/jon-snow-frames/', import.meta.url)).filter(n => n.endsWith('.png')).map(n => new URL(`../src/assets/fighters/jon-snow-frames/${n}`, import.meta.url)),
    ...keys.map(key => new URL(`${key}.png`, assetRoot)),
    ...['sky', 'distance', 'architecture', 'courtyard'].map(layer => new URL(`../src/assets/arena/northward-${layer}-wide.png`, import.meta.url)),
    new URL('../src/assets/hud/hud-bastion-panel.png', import.meta.url),
  ]
  let decoded = 0, compressed = 0
  for (const path of runtimeFiles) {
    const png = readFileSync(path)
    decoded += png.readUInt32BE(16) * png.readUInt32BE(20) * 4
    compressed += statSync(path).size
  }
  assert.equal(runtimeFiles.length, 51)
  assert.ok(decoded / 1024 ** 2 < 54)
  console.log(`US-28 loaded PNG estimate: ${compressed} B compressed; ${(decoded / 1024 ** 2).toFixed(2)} MiB RGBA8 (excludes copies/driver overhead)`)
})
