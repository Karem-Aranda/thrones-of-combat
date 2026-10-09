import Phaser from 'phaser'
import { findAttackContact, type ContactMotion, type AttackContact } from '../combat/attackContact'
import { JON_VISUALS, LYRA_VISUALS, createVisualRuntime, phaseFrame, type FighterVisualConfig, type FighterVisualRuntime } from '../presentation/fighterVisuals'
import { createBlockReaction, guardEligible, guardFacesContact } from '../combat/blockDefinitions'
import { COMBO_CONTINUATIONS, createComboRuntime, canContinue, type ComboRuntime } from '../combat/comboDefinitions'
import { createNeutralReaction, createHitReaction, advanceHitReaction, type HitReaction } from '../combat/hitReaction'
import { TouchControls, type PlayerId, type ScreenInsets } from '../controls/TouchControls'
import {
  ATTACK_DEFINITIONS, createAttackRuntime, selectAttack, getAttackPresentationElapsed,
  type AttackId, type AttackRuntime,
} from '../combat/attackDefinitions'
import {
  VIEWPORT_WIDTH, VIEWPORT_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT,
  getFighterWorldSpawns, getAdaptiveViewportWidth, moveFightersWithinWorld,
  getCombatCameraTarget, getCombatCameraScroll,
  GROUND_TOP, GRAVITY, createVerticalMovement, advanceVerticalMovement, type VerticalMovement,
} from '../world/combatWorld'

// The approved cropped courtyard has a 20-pixel transparent strip above the paving.
const NORTHWARD_COURTYARD_TOP_INSET = 20
const NORTHWARD_DISTANCE_Y = 170
const FIGHTER_WIDTH = 72
const FIGHTER_HEIGHT = 140
const IDLE_FRAME_MS = 300
const MOVE_FRAME_MS = 100
const JON_KO_IMPACT_MS = 70
const JON_KO_COLLAPSE_MS = 330
const JON_KO_TOTAL_MS = 400
const IMPACT_CUE_MS = 80
const IMPACT_CUE_OPACITY = 0.75
const JON_TRAIL_MS = 90
const JON_TRAIL_OPACITY = 0.4
const HIT_FLECK_MS = 140
const HIT_FLECK_OPACITY = 0.6
const BACKGROUND_SNOW_COUNT = 12
const NEAR_SNOW_COUNT = 6
const HIT_FLECK_POOL_SIZE = 6
const FACING_MARKER_SIZE = 12
const PLAYER_MOVE_SPEED = 300
const PLAYER_MAX_HEALTH = 100
const HUD_PANEL_WIDTH = 430
const HUD_PANEL_HEIGHT = 100
const HUD_PANEL_Y = 36
const HUD_PANEL_MARGIN = 40
const HUD_FRAME_X_OFFSET = 22
const HUD_FRAME_Y = 82
const HUD_FRAME_WIDTH = 386
const HUD_FRAME_HEIGHT = 34
const HUD_FRAME_INSET = 4
const HUD_FILL_WIDTH = HUD_FRAME_WIDTH - HUD_FRAME_INSET * 2
const HUD_FILL_HEIGHT = HUD_FRAME_HEIGHT - HUD_FRAME_INSET * 2

type Facing = 'left' | 'right'
type Winner = 'PLAYER 1' | 'PLAYER 2'

interface Fighter extends AttackRuntime {
  visualConfig: FighterVisualConfig
  presentation: FighterVisualRuntime
  guardEligible: boolean
  guardIndicator: Phaser.GameObjects.Rectangle
  guardCueMs: number
  combo: ComboRuntime
  reaction: HitReaction
  container: Phaser.GameObjects.Container
  vertical: VerticalMovement
  visual?: Phaser.GameObjects.Image
  attackArea: Phaser.GameObjects.Rectangle
  facingMarker: Phaser.GameObjects.Rectangle
  facing: Facing
  health: number
}

interface MovementKeys {
  left: Phaser.Input.Keyboard.Key
  right: Phaser.Input.Keyboard.Key
  jump: Phaser.Input.Keyboard.Key
}

interface FighterInput {
  blockHeld: boolean
  leftHeld: boolean
  rightHeld: boolean
  jumpPressed: boolean
  lightPressed: boolean
  heavyPressed: boolean
}

interface HealthBarDisplay {
  panel: Phaser.GameObjects.Image
  frame: Phaser.GameObjects.Rectangle
  trough: Phaser.GameObjects.Rectangle
  fill: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
  mirrored: boolean
}

interface Snowflake {
  shape: Phaser.GameObjects.Arc
  speedX: number
  speedY: number
  respawns: number
}

interface HitFleck {
  shape: Phaser.GameObjects.Arc
  speedX: number
  speedY: number
  elapsed: number
}

export class CombatScene extends Phaser.Scene {
  private blockKeys?: Record<PlayerId, Phaser.Input.Keyboard.Key>
  private playerOne!: Fighter
  private playerTwo!: Fighter
  private attackKeys!: {
    playerOne: Record<AttackId, Phaser.Input.Keyboard.Key>
    playerTwo: Record<AttackId, Phaser.Input.Keyboard.Key>
  }
  private restartKey!: Phaser.Input.Keyboard.Key
  private playerOneHealthBar!: HealthBarDisplay
  private playerTwoHealthBar!: HealthBarDisplay
  private winnerText?: Phaser.GameObjects.Text
  private shortLandscapeHud = false
  private skyLayer!: Phaser.GameObjects.Image
  private distanceLayer!: Phaser.GameObjects.Image
  private viewportWidth = VIEWPORT_WIDTH
  private viewportHeight = VIEWPORT_HEIGHT
  private safeInsets: ScreenInsets = { top: 0, right: 0, bottom: 0, left: 0 }
  private parentResizeObserver?: ResizeObserver
  private touchControls!: TouchControls
  private winner: Winner | null = null
  private impactCue!: Phaser.GameObjects.Graphics
  private impactCueElapsed = IMPACT_CUE_MS
  private jonTrail!: Phaser.GameObjects.Graphics
  private jonTrailElapsed = JON_TRAIL_MS
  private snowflakes: Snowflake[] = []
  private hitFlecks: HitFleck[] = []
  private swingSound!: Phaser.Sound.BaseSound
  private hitSounds: Phaser.Sound.BaseSound[] = []
  private koSound!: Phaser.Sound.BaseSound
  private ambience!: Phaser.Sound.BaseSound
  private jonSwingPlayed = false
  private koSoundPlayed = false
  private ambienceStartAttempted = false
  private movementKeys!: {
    playerOne: MovementKeys
    playerTwo: MovementKeys
  }
  private pendingKeyboardJump: Record<PlayerId, boolean> = { playerOne: false, playerTwo: false }
  private pendingKeyboardAttacks: Record<PlayerId, Record<AttackId, boolean>> = {
    playerOne: { light: false, heavy: false }, playerTwo: { light: false, heavy: false },
  }

  constructor() {
    super('CombatScene')
  }

  create(): void {
    // Scene restarts reuse this class instance; new fighters reset their own state.
    this.winner = null
    this.impactCueElapsed = IMPACT_CUE_MS
    this.jonTrailElapsed = JON_TRAIL_MS
    this.snowflakes = []
    this.hitFlecks = []
    this.jonSwingPlayed = false
    this.koSoundPlayed = false
    this.ambienceStartAttempted = false
    this.winnerText = undefined
    this.viewportWidth = this.scale.width
    this.viewportHeight = this.scale.height

    this.addArena()
    this.addSnowfall()

    const [playerOneSpawnX, playerTwoSpawnX] = getFighterWorldSpawns()
    this.playerOne = this.addFighter(playerOneSpawnX, JON_VISUALS)
    this.playerTwo = this.addFighter(playerTwoSpawnX, LYRA_VISUALS)
    this.updateFacing()
    this.cameras.main
      .setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
      .setZoom(1)
      .setScroll(getCombatCameraTarget(
        this.playerOne.container.x, this.playerTwo.container.x, this.scale.width,
      ), 0)

    this.jonTrail = this.add.graphics().setDepth(1).setVisible(false)
    this.jonTrail.fillStyle(0xcbd3d6)
    this.jonTrail.fillTriangle(-32, 6, 18, -5, 9, 3)
    this.jonTrail.fillTriangle(23, -3, 32, -5, 20, 1)

    this.impactCue = this.add.graphics().setDepth(2).setVisible(false)
    this.impactCue.fillStyle(0xcbd3d6)
    this.impactCue.fillTriangle(-18, 10, 18, -10, 9, 0)
    this.impactCue.lineStyle(2, 0xdde4e7)
    this.impactCue.lineBetween(-18, 10, 18, -10)

    for (let i = 0; i < HIT_FLECK_POOL_SIZE; i += 1) {
      this.hitFlecks.push({
        shape: this.add.circle(0, 0, 2, 0xcbd3d6, HIT_FLECK_OPACITY).setDepth(2).setVisible(false),
        speedX: 0,
        speedY: 0,
        elapsed: HIT_FLECK_MS,
      })
    }

    this.playerOneHealthBar = this.addHealthBar(HUD_PANEL_MARGIN, this.playerOne.visualConfig.name, false)
    this.playerTwoHealthBar = this.addHealthBar(
      this.scale.width - HUD_PANEL_MARGIN - HUD_PANEL_WIDTH,
      this.playerTwo.visualConfig.name,
      true,
    )
    this.shortLandscapeHud = false
    this.updateResponsiveHud()
    this.updateHealthBars()

    this.swingSound = this.sound.add('longclaw-swing', { volume: 0.27 })
    this.hitSounds = [
      this.sound.add('confirmed-hit', { volume: 0.55 }),
      this.sound.add('confirmed-hit', { volume: 0.55 }),
    ]
    this.koSound = this.sound.add('ko-impact', { volume: 0.6 })
    // Sound Manager survives scene.restart(); keep one ambience instance.
    this.ambience = this.sound.get('northward-ambience') ??
      this.sound.add('northward-ambience', { loop: true, volume: 0.1 })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupTransientAudio, this)
    this.startAmbienceIfUnlocked()

    const keyboard = this.input.keyboard
    if (!keyboard) {
      throw new Error('Keyboard input is unavailable')
    }

    this.movementKeys = {
      playerOne: {
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        jump: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      },
      playerTwo: {
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        jump: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      },
    }
    this.attackKeys = {
      playerOne: {
        light: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J),
        heavy: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K),
      },
      playerTwo: {
        light: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L),
        heavy: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SEMICOLON),
      },
    }
    this.blockKeys = {
      playerOne: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      playerTwo: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
    }
    this.clearKeyboardPresses()
    for (const keys of Object.values(this.movementKeys)) keys.jump.on('down', this.recordJumpPress)
    for (const keys of Object.values(this.attackKeys)) {
      for (const key of Object.values(keys)) key.on('down', this.recordAttackPress)
    }
    // Punctuation keyCode varies by browser/layout; keep the requested character binding.
    keyboard.on('keydown', this.recordSemicolonPress)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupKeyboardInput, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.clearCombatState, this)
    window.addEventListener('blur', this.clearKeyboardPresses)
    document.addEventListener('visibilitychange', this.clearKeyboardPresses)
    this.restartKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R)
    this.touchControls = new TouchControls(this)
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleScaleResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupResponsiveLayout, this)
    // Dynamic browser chrome can resize the CSS parent without a window resize.
    const parent = this.game.canvas.parentElement
    if (parent) {
      this.parentResizeObserver = new ResizeObserver(() => {
        const bounds = parent.getBoundingClientRect()
        if (bounds.width > 0 && bounds.height > 0 &&
            (bounds.width !== this.scale.parentSize.width || bounds.height !== this.scale.parentSize.height)) {
          this.scale.setParentSize(bounds.width, bounds.height)
        }
      })
      this.parentResizeObserver.observe(parent)
    }
    this.handleScaleResize()
  }

  update(_time: number, delta: number): void {
    this.startAmbienceIfUnlocked()
    this.updateResponsiveHud()
    const touchCapable = window.matchMedia('(any-pointer: coarse)').matches
    const portrait = touchCapable && window.matchMedia('(orientation: portrait)').matches
    this.touchControls.setPresentation(touchCapable, portrait, this.winner !== null)
    const keyboardRestart = Phaser.Input.Keyboard.JustDown(this.restartKey)
    const touchRestart = this.touchControls.consumeRestart()
    const restartPressed = keyboardRestart || touchRestart
    const playerOneInput = this.readFighterInput('playerOne', this.movementKeys.playerOne)
    const playerTwoInput = this.readFighterInput('playerTwo', this.movementKeys.playerTwo)
    if (portrait) {
      this.clearBlockInput()
      return
    }
    if (this.winner) {
      if (restartPressed) {
        this.scene.restart()
        return
      }
      // Gameplay stays locked; existing airborne trajectories still settle naturally.
      this.settleFightersVertically(delta)
      this.updateFighterVisual(this.playerOne, delta, 0)
      this.updateFighterVisual(this.playerTwo, delta, 0)
      this.updateVfx(delta)
      return
    }

    const previousPlayerOneX = this.playerOne.container.x
    const previousPlayerTwoX = this.playerTwo.container.x
    // Snapshot BEFORE reaction expiry; only held blockstun permits re-guard.
    for (const [fighter, input] of [[this.playerOne, playerOneInput], [this.playerTwo, playerTwoInput]] as const) {
      fighter.guardCueMs = Math.max(0, fighter.guardCueMs - delta)
      fighter.guardEligible = guardEligible(input.blockHeld, !this.winner,
        fighter.vertical.movementState === 'grounded', fighter.attackState === 'idle', fighter.reaction.reactionState)
    }
    // Eligibility is sampled before timers advance: presses in the recovery frame are discarded.
    const playerOneStunned = this.playerOne.reaction.reactionState !== 'neutral'
    const playerTwoStunned = this.playerTwo.reaction.reactionState !== 'neutral'
    // An airborne press is discarded even if this same update resolves landing.
    const playerOneAttack = !playerOneStunned && !this.playerOne.guardEligible && this.playerOne.vertical.movementState === 'grounded'
      ? selectAttack(playerOneInput.lightPressed, playerOneInput.heavyPressed) : null
    const playerTwoAttack = !playerTwoStunned && !this.playerTwo.guardEligible && this.playerTwo.vertical.movementState === 'grounded'
      ? selectAttack(playerTwoInput.lightPressed, playerTwoInput.heavyPressed) : null
    const movement = new Map<Fighter, ContactMotion>([
      [this.playerOne, this.contactMotion(this.playerOne, playerOneInput)],
      [this.playerTwo, this.contactMotion(this.playerTwo, playerTwoInput)],
    ])
    this.moveFighters(playerOneInput, playerTwoInput, delta)
    this.cameras.main.setScroll(getCombatCameraScroll(
      this.cameras.main.scrollX, this.playerOne.container.x, this.playerTwo.container.x,
      delta, this.scale.width,
    ), 0)
    this.updateFacing()

    const jonWasActive = this.playerOne.attackState === 'active'
    this.tryStartAttack(this.playerOne, playerOneAttack)
    this.tryStartAttack(this.playerTwo, playerTwoAttack)
    this.bufferContinuation(this.playerOne, playerOneAttack)
    this.bufferContinuation(this.playerTwo, playerTwoAttack)
    this.advanceAttack(this.playerOne, this.playerTwo, delta, movement)
    this.advanceAttack(this.playerTwo, this.playerOne, delta, movement)
    if (!jonWasActive && this.playerOne.attackState === 'active') this.jonTrailElapsed = 0
    // Launch after both resolutions: none of this update's elapsed time belongs
    // to a new continuation, and a P1 hit can retire P2's unresolved buffer.
    this.launchContinuation(this.playerOne)
    this.launchContinuation(this.playerTwo)
    this.updateGuardPresentation(0)
    this.updateFighterVisual(this.playerOne, delta, playerOneStunned ? 0 : this.playerOne.container.x - previousPlayerOneX)
    this.updateFighterVisual(this.playerTwo, delta, playerTwoStunned ? 0 : this.playerTwo.container.x - previousPlayerTwoX)
    this.updateVfx(delta)
  }

  private readFighterInput(
    player: PlayerId, keys: MovementKeys,
  ): FighterInput {
    const keyboardLight = this.pendingKeyboardAttacks[player].light
    const keyboardHeavy = this.pendingKeyboardAttacks[player].heavy
    this.pendingKeyboardAttacks[player].light = false
    this.pendingKeyboardAttacks[player].heavy = false
    // Read both before combining; short-circuiting must not leave a pending touch edge.
    const touchLight = this.touchControls.consumeAttack(player, 'light')
    const touchHeavy = this.touchControls.consumeAttack(player, 'heavy')
    const keyboardJump = this.pendingKeyboardJump[player]
    this.pendingKeyboardJump[player] = false
    const touchJump = this.touchControls.consumeJump(player)
    return {
      blockHeld: Boolean(this.blockKeys?.[player].isDown || this.touchControls.isHeld(player, 'block')),
      leftHeld: keys.left.isDown || this.touchControls.isHeld(player, 'left'),
      rightHeld: keys.right.isDown || this.touchControls.isHeld(player, 'right'),
      jumpPressed: keyboardJump || touchJump,
      lightPressed: keyboardLight || touchLight,
      heavyPressed: keyboardHeavy || touchHeavy,
    }
  }

  private recordJumpPress = (key: Phaser.Input.Keyboard.Key, event: KeyboardEvent): void => {
    if (event.repeat) return
    const player = key === this.movementKeys.playerOne.jump ? 'playerOne' : 'playerTwo'
    this.pendingKeyboardJump[player] = true
  }

  private recordAttackPress = (key: Phaser.Input.Keyboard.Key, event: KeyboardEvent): void => {
    if (event.repeat) return
    for (const player of ['playerOne', 'playerTwo'] as const) {
      for (const attack of ['light', 'heavy'] as const) {
        if (key === this.attackKeys[player][attack]) this.pendingKeyboardAttacks[player][attack] = true
      }
    }
  }

  private recordSemicolonPress = (event: KeyboardEvent): void => {
    if (event.key === ';' && !event.repeat && !event.isComposing) {
      this.pendingKeyboardAttacks.playerTwo.heavy = true
    }
  }

  private clearKeyboardPresses = (): void => {
    this.clearBlockInput()
    this.pendingKeyboardJump.playerOne = false
    this.pendingKeyboardJump.playerTwo = false
    for (const pending of Object.values(this.pendingKeyboardAttacks)) {
      pending.light = false
      pending.heavy = false
    }
  }

  private clearBlockInput(): void {
    for (const key of Object.values(this.blockKeys ?? {})) key.reset()
    for (const fighter of [this.playerOne, this.playerTwo]) {
      if (!fighter) continue
      fighter.guardEligible = false
      fighter.guardCueMs = 0
      fighter.guardIndicator.setVisible(false)
    }
  }

  private updateGuardPresentation(delta: number): void {
    for (const fighter of [this.playerOne, this.playerTwo]) {
      fighter.guardCueMs = Math.max(0, fighter.guardCueMs - delta)
      fighter.guardIndicator.x = (fighter.facing === 'right' ? 1 : -1) * (FIGHTER_WIDTH / 2 + 6)
      fighter.guardIndicator.setVisible(!this.winner && (fighter.guardEligible || fighter.guardCueMs > 0))
        .setAlpha(fighter.guardCueMs > 0 ? 1 : 0.55)
    }
  }

  private cleanupKeyboardInput(): void {
    for (const keys of Object.values(this.movementKeys)) keys.jump.off('down', this.recordJumpPress)
    for (const keys of Object.values(this.attackKeys)) {
      for (const key of Object.values(keys)) key.off('down', this.recordAttackPress)
    }
    this.input.keyboard?.off('keydown', this.recordSemicolonPress)
    window.removeEventListener('blur', this.clearKeyboardPresses)
    document.removeEventListener('visibilitychange', this.clearKeyboardPresses)
    this.clearKeyboardPresses()
  }

  private startAmbienceIfUnlocked(): void {
    if (this.sound.locked || this.ambience.isPlaying || this.ambience.isPaused || this.ambienceStartAttempted) {
      return
    }
    this.ambienceStartAttempted = true
    this.ambience.play()
  }

  private cleanupTransientAudio(): void {
    for (const sound of [this.swingSound, ...this.hitSounds, this.koSound]) {
      sound.stop()
      this.sound.remove(sound)
    }
  }

  private playConfirmedHitAudio(health: number): void {
    if (health === 0) {
      if (this.koSoundPlayed) return
      this.koSoundPlayed = true
      if (!this.sound.locked) this.koSound.play()
      return
    }
    if (this.sound.locked) return
    for (const sound of this.hitSounds) {
      if (!sound.isPlaying) {
        sound.play()
        return
      }
    }
  }

  private updateFighterVisual(fighter: Fighter, delta: number, movedX: number): void {
    const visual = fighter.visual
    if (!visual) return
    const config = fighter.visualConfig
    const runtime = fighter.presentation
    // Newly-created Lyra feedback gets a first frame; no historical frame time.
    // Jon retains his approved existing contact-update playback behavior.
    const reactionDelta = runtime.freshReaction && !config.consumeContactDelta ? 0 : delta
    runtime.freshReaction = false

    if (runtime.koElapsed !== null) {
      runtime.koElapsed = Math.min(runtime.koElapsed + reactionDelta, JON_KO_TOTAL_MS)
      const frameKey = runtime.koElapsed < JON_KO_IMPACT_MS
        ? config.ko[0]
        : runtime.koElapsed < JON_KO_COLLAPSE_MS ? config.ko[1] : config.ko[2]
      this.setFighterFrame(fighter, frameKey)
      return
    }

    if (this.winner) {
      this.setFighterFrame(fighter, config.guard)
      return
    }

    let mode: FighterVisualRuntime['mode']
    let frameKey: string
    if (fighter.attackState !== 'idle') {
      mode = 'attack'
      frameKey = this.getAttackFrame(fighter)
    } else if (fighter.guardEligible || fighter.reaction.reactionState !== 'neutral' || fighter.vertical.movementState !== 'grounded') {
      // Hold guard while airborne/stunned; knockback must not select walking frames.
      mode = 'idle'
      frameKey = fighter.vertical.movementState === 'rising' ? config.rising
        : fighter.vertical.movementState === 'falling' ? config.falling : config.guard
      runtime.elapsed = 0
    } else {
      mode = 'idle'
      if (movedX !== 0) {
        const movingForward = movedX * (fighter.facing === 'right' ? 1 : -1) > 0
        mode = movingForward ? 'move-forward' : 'move-retreat'
      }

      // Gameplay displacement, not key state, selects locomotion at boundaries.
      runtime.elapsed = mode === runtime.mode ? runtime.elapsed + delta : 0
      if (mode === 'idle') {
        const index = Math.floor((runtime.elapsed % (config.idle.length * IDLE_FRAME_MS)) / IDLE_FRAME_MS)
        frameKey = config.idle[index]
      } else {
        const index = Math.floor((runtime.elapsed % (config.movement.length * MOVE_FRAME_MS)) / MOVE_FRAME_MS)
        frameKey = config.movement[mode === 'move-retreat' ? config.movement.length - 1 - index : index]
      }
    }

    if (runtime.hitElapsed !== null) {
      runtime.hitElapsed += reactionDelta
      const duration = config.fixedHitDurationMs ?? runtime.hitDurationMs
      const contactEnd = duration * config.hitWeights[0]
      const recoilEnd = contactEnd + duration * config.hitWeights[1]
      if (runtime.hitElapsed < contactEnd) {
        frameKey = config.hit[0]
      } else if (runtime.hitElapsed < recoilEnd) {
        frameKey = config.hit[1]
      } else if (runtime.hitElapsed >= duration) {
        runtime.hitElapsed = null
      }
      // Return to the *current* gameplay-selected pose; attacks are never rewound.
    }
    this.setFighterFrame(fighter, frameKey)
    runtime.mode = mode
  }

  private setFighterFrame(fighter: Fighter, frameKey: string): void {
    const visual = fighter.visual
    if (!visual) return
    if (visual.texture.key === frameKey) return

    const originY = fighter.visualConfig.origins[frameKey]
    if (originY === undefined) throw new Error(`Missing fighter frame baseline: ${frameKey}`)
    visual.setTexture(frameKey)
    visual.setOrigin(0.5, originY)
  }

  private addArena(): void {
    const viewportWidth = this.scale.width
    const centerOffset = (WORLD_WIDTH - viewportWidth) / 2
    const distanceScrollFactor = 0.25
    // Native-size sky/distance cover the adaptive camera range without tiling.
    // Center the parallax layer at the initial midpoint camera position.
    this.skyLayer = this.add.image(viewportWidth / 2, 0, 'northward-sky-wide')
      .setOrigin(0.5, 0).setDepth(-4).setScrollFactor(0)
    this.distanceLayer = this.add.image(viewportWidth / 2 + centerOffset * distanceScrollFactor,
      NORTHWARD_DISTANCE_Y, 'northward-distance-wide')
      .setOrigin(0.5, 0).setDepth(-3).setScrollFactor(distanceScrollFactor, 1)
    this.add.image(0, GROUND_TOP, 'northward-architecture-wide')
      .setOrigin(0, 1).setDepth(-2)
    this.add.image(0, GROUND_TOP - NORTHWARD_COURTYARD_TOP_INSET, 'northward-courtyard-wide')
      .setOrigin(0).setDepth(-1)
  }

  private addSnowfall(): void {
    for (let i = 0; i < BACKGROUND_SNOW_COUNT + NEAR_SNOW_COUNT; i += 1) {
      const near = i >= BACKGROUND_SNOW_COUNT
      const radius = near ? 1 + (i % 3) * 0.25 : 0.5 + (i % 3) * 0.25
      const opacity = near ? 0.12 + (i % 3) * 0.05 : 0.18 + (i % 3) * 0.06
      const shape = this.add
        .circle((i * 337 + 149) % this.scale.width, (i * 251 + 71) % this.scale.height, radius, 0xe4e9eb, opacity)
        .setDepth(near ? -0.5 : -2.5)
        .setScrollFactor(0)
      this.snowflakes.push({
        shape,
        speedX: near ? -8 : -5,
        speedY: near ? 26 + (i % 3) * 4 : 12 + (i % 4) * 6,
        respawns: 0,
      })
    }
  }

  private updateVfx(delta: number): void {
    const seconds = delta / 1000
    for (let i = 0; i < this.snowflakes.length; i += 1) {
      const flake = this.snowflakes[i]
      flake.shape.x += flake.speedX * seconds
      flake.shape.y += flake.speedY * seconds
      if (flake.shape.y > this.viewportHeight + flake.shape.radius) {
        flake.respawns += 1
        flake.shape.x = (i * 337 + flake.respawns * 191 + 149) % this.scale.width
        flake.shape.y = -flake.shape.radius
      } else if (flake.shape.x < -flake.shape.radius) {
        flake.shape.x = this.scale.width + flake.shape.radius
      }
    }

    this.updateJonTrail(delta)
    this.updateImpactCue(delta)
    for (let i = 0; i < this.hitFlecks.length; i += 1) {
      const fleck = this.hitFlecks[i]
      if (!fleck.shape.visible) continue
      fleck.elapsed += delta
      if (fleck.elapsed >= HIT_FLECK_MS) {
        fleck.shape.setVisible(false)
        continue
      }
      fleck.shape.x += fleck.speedX * seconds
      fleck.shape.y += fleck.speedY * seconds
      fleck.shape.setAlpha(HIT_FLECK_OPACITY * (1 - fleck.elapsed / HIT_FLECK_MS))
    }
  }

  private updateJonTrail(delta: number): void {
    if (this.jonTrailElapsed >= JON_TRAIL_MS) {
      this.jonTrail.setVisible(false)
      return
    }

    const direction = this.playerOne.facing === 'right' ? 1 : -1
    this.jonTrail
      .setPosition(this.playerOne.container.x + direction * 45, this.playerOne.container.y - 35)
      .setScale(direction, 1)
      .setAlpha(JON_TRAIL_OPACITY * (1 - this.jonTrailElapsed / JON_TRAIL_MS))
      .setVisible(true)
    this.jonTrailElapsed += delta
  }

  private updateImpactCue(delta: number): void {
    if (!this.impactCue.visible) return

    if (this.impactCueElapsed >= IMPACT_CUE_MS) {
      this.impactCue.setVisible(false)
      return
    }

    const progress = this.impactCueElapsed / IMPACT_CUE_MS
    this.impactCue.setAlpha(IMPACT_CUE_OPACITY * (1 - progress))
    this.impactCueElapsed += delta
  }

  private showImpactCue(defender: Fighter): void {
    const front = defender.facing === 'right' ? 1 : -1
    const x = defender.container.x + front * FIGHTER_WIDTH / 4
    const y = defender.container.y - FIGHTER_HEIGHT / 6
    this.impactCueElapsed = 0
    this.impactCue
      .setPosition(x, y)
      .setAlpha(IMPACT_CUE_OPACITY)
      .setScale(front, 1)
      .setVisible(true)

    let spawned = 0
    for (const fleck of this.hitFlecks) {
      if (fleck.shape.visible) continue
      const spread = spawned - 1
      fleck.shape.setPosition(x + spread * 4, y + spread * 2).setAlpha(HIT_FLECK_OPACITY).setVisible(true)
      fleck.speedX = -front * (24 + spawned * 6) + spread * 5
      fleck.speedY = -22 - spawned * 8
      fleck.elapsed = 0
      spawned += 1
      if (spawned === 3) break
    }
  }

  private getAttackFrame(fighter: Fighter): string {
    const config = fighter.visualConfig
    if (!fighter.currentAttack || fighter.attackState === 'idle') return config.guard
    const elapsed = getAttackPresentationElapsed(
      ATTACK_DEFINITIONS[fighter.currentAttack], fighter.attackState,
      fighter.attackState === 'startup'
        ? fighter.attackPhaseElapsed * ATTACK_DEFINITIONS[fighter.currentAttack].startupMs / this.attackStartup(fighter)
        : fighter.attackPhaseElapsed,
    )
    if (fighter.attackState === 'startup') {
      return phaseFrame(config.startup, elapsed / ATTACK_DEFINITIONS.light.startupMs)
    }
    if (fighter.attackState === 'active') {
      return phaseFrame(config.active, elapsed / ATTACK_DEFINITIONS.light.activeMs, config.activeWeights)
    }
    return phaseFrame(config.recovery, elapsed / ATTACK_DEFINITIONS.light.recoveryMs)
  }

  private settleFightersVertically(delta: number): void {
    for (const fighter of [this.playerOne, this.playerTwo]) {
      fighter.vertical = advanceVerticalMovement(fighter.vertical, false, delta)
      fighter.container.y = fighter.vertical.footY - FIGHTER_HEIGHT / 2
    }
  }

  private moveFighters(playerOneInput: FighterInput, playerTwoInput: FighterInput, delta: number): void {
    const distance = (input: FighterInput): number =>
      (Number(input.rightHeld) - Number(input.leftHeld)) * PLAYER_MOVE_SPEED * delta / 1000
    const oneStunned = this.playerOne.reaction.reactionState !== 'neutral'
    const twoStunned = this.playerTwo.reaction.reactionState !== 'neutral'
    const oneReaction = advanceHitReaction(this.playerOne.reaction, delta)
    const twoReaction = advanceHitReaction(this.playerTwo.reaction, delta)
    const [playerOneX, playerTwoX] = moveFightersWithinWorld(
      this.playerOne.container.x, this.playerTwo.container.x,
      oneStunned ? oneReaction.displacement : this.playerOne.guardEligible ? 0 : distance(playerOneInput),
      twoStunned ? twoReaction.displacement : this.playerTwo.guardEligible ? 0 : distance(playerTwoInput), FIGHTER_WIDTH / 2,
    )
    this.playerOne.container.x = playerOneX
    this.playerTwo.container.x = playerTwoX
    for (const [fighter, input] of [[this.playerOne, playerOneInput], [this.playerTwo, playerTwoInput]] as const) {
      // Finish grounded attacks before allowing jump; never carry an attack into the air.
      fighter.vertical = advanceVerticalMovement(
        fighter.vertical, input.jumpPressed && !fighter.guardEligible && fighter.attackState === 'idle' && fighter.reaction.reactionState === 'neutral', delta,
      )
      fighter.container.y = fighter.vertical.footY - FIGHTER_HEIGHT / 2
    }
    this.playerOne.reaction = oneReaction.reaction
    this.playerTwo.reaction = twoReaction.reaction
  }

  private contactMotion(fighter: Fighter, input: FighterInput): ContactMotion {
    const stunned = fighter.reaction.reactionState !== 'neutral'
    const vertical = advanceVerticalMovement(fighter.vertical,
      input.jumpPressed && !fighter.guardEligible && fighter.attackState === 'idle' && !stunned, 0)
    return {
      x: fighter.container.x,
      y: vertical.footY - FIGHTER_HEIGHT / 2,
      velocityX: stunned ? fighter.reaction.knockbackVelocity : fighter.guardEligible ? 0
        : (Number(input.rightHeld) - Number(input.leftHeld)) * PLAYER_MOVE_SPEED,
      horizontalMs: stunned ? fighter.reaction.remainingMs : Infinity,
      velocityY: vertical.velocityY,
      airborne: vertical.movementState !== 'grounded',
    }
  }

  private updateFacing(): void {
    const playerOneX = this.playerOne.container.x
    const playerTwoX = this.playerTwo.container.x

    if (playerOneX < playerTwoX) {
      this.setFacing(this.playerOne, 'right')
      this.setFacing(this.playerTwo, 'left')
    } else if (playerOneX > playerTwoX) {
      this.setFacing(this.playerOne, 'left')
      this.setFacing(this.playerTwo, 'right')
    }
    // At equal X positions, keep the previous facing for both fighters.
  }

  private setFacing(fighter: Fighter, facing: Facing): void {
    fighter.facing = facing
    fighter.visual?.setFlipX(facing === 'left')
    fighter.facingMarker.x = (facing === 'right' ? 1 : -1) * (FIGHTER_WIDTH / 2 - FACING_MARKER_SIZE)
    this.positionAttackArea(fighter)
  }

  private positionAttackArea(fighter: Fighter): void {
    const definition = ATTACK_DEFINITIONS[fighter.currentAttack ?? 'light']
    if (fighter.attackArea.width !== definition.reach || fighter.attackArea.height !== definition.height) {
      fighter.attackArea.setSize(definition.reach, definition.height)
    }
    fighter.attackArea.x = (fighter.facing === 'right' ? 1 : -1) * (FIGHTER_WIDTH / 2 + definition.reach / 2)
  }

  private tryStartAttack(fighter: Fighter, attack: AttackId | null): void {
    // Consume each press even during an attack, so inputs are not queued.
    if (!this.winner && !fighter.guardEligible && attack && fighter.reaction.reactionState === 'neutral' && fighter.attackState === 'idle' && fighter.vertical.movementState === 'grounded') {
      fighter.currentAttack = attack
      fighter.attackState = 'startup'
      fighter.attackPhaseElapsed = 0
      fighter.attackHasHit = false
      fighter.combo = { step: 1, bufferedAttack: null, damageConfirmed: false }
      this.positionAttackArea(fighter)
      if (fighter === this.playerOne) this.jonSwingPlayed = false
    }
  }

  private attackStartup(fighter: Fighter): number {
    const id = fighter.currentAttack ?? 'light'
    return fighter.combo.step === 2 ? COMBO_CONTINUATIONS[id] : ATTACK_DEFINITIONS[id].startupMs
  }

  private bufferContinuation(fighter: Fighter, attack: AttackId | null): void {
    if (this.winner || fighter.reaction.reactionState !== 'neutral' || fighter.vertical.movementState !== 'grounded') {
      fighter.combo = createComboRuntime()
      return
    }
    if (attack && canContinue(fighter, fighter.combo) && fighter.combo.bufferedAttack === null) {
      fighter.combo.bufferedAttack = attack
    }
  }

  private launchContinuation(fighter: Fighter): void {
    const attack = fighter.combo.bufferedAttack
    if (!attack) return
    if (this.winner || fighter.reaction.reactionState !== 'neutral' ||
        fighter.vertical.movementState !== 'grounded' || !canContinue(fighter, fighter.combo)) {
      fighter.combo = createComboRuntime()
      return
    }
    this.cancelAttack(fighter)
    this.tryStartAttack(fighter, attack)
    fighter.combo.step = 2
  }

  private cancelAttack(fighter: Fighter): void {
    Object.assign(fighter, createAttackRuntime())
    fighter.combo = createComboRuntime()
    fighter.attackArea.setVisible(false)
    this.positionAttackArea(fighter)
    if (fighter === this.playerOne) {
      this.jonSwingPlayed = true // Retire this attack's cue; only a new attack makes it eligible again.
      this.jonTrailElapsed = JON_TRAIL_MS
      this.jonTrail.setVisible(false)
    }
    fighter.presentation.mode = 'idle'
    fighter.presentation.elapsed = 0
  }

  private clearCombatState(): void {
    this.clearBlockInput()
    for (const fighter of [this.playerOne, this.playerTwo]) {
      this.cancelAttack(fighter)
      fighter.reaction = createNeutralReaction()
    }
  }

  private advanceAttack(
    fighter: Fighter, defender: Fighter, delta: number,
    movement?: ReadonlyMap<Fighter, ContactMotion>,
  ): void {
    if (this.winner || fighter.reaction.reactionState !== 'neutral' || fighter.attackState === 'idle' || !fighter.currentAttack) return
    const definition = ATTACK_DEFINITIONS[fighter.currentAttack]
    const startupMs = this.attackStartup(fighter)

    // Active entry is inclusive; expiry is exclusive. Clip the movement path
    // BEFORE carrying elapsed time, rather than testing the frame's final pose.
    const activeStart = fighter.attackState === 'startup' ? startupMs - fighter.attackPhaseElapsed : 0
    const activeEnd = fighter.attackState === 'startup'
      ? activeStart + definition.activeMs : definition.activeMs - fighter.attackPhaseElapsed
    const canContact = !fighter.attackHasHit && fighter.attackState !== 'recovery' && activeStart <= delta && activeEnd > 0
    const contact = canContact && movement
      ? findAttackContact(movement.get(fighter)!, movement.get(defender)!, activeStart,
        Math.min(delta, activeEnd), delta < activeEnd,
        { fighterWidth: FIGHTER_WIDTH, fighterHeight: FIGHTER_HEIGHT,
          reach: definition.reach, attackHeight: definition.height,
          worldWidth: WORLD_WIDTH, groundTop: GROUND_TOP, gravity: GRAVITY })
      : null

    fighter.attackPhaseElapsed += delta
    // A shortened continuation can reach active before its unchanged swing cue.
    const swingElapsed = fighter.attackState === 'active'
      ? startupMs + fighter.attackPhaseElapsed : fighter.attackPhaseElapsed
    if (fighter === this.playerOne &&
        (fighter.attackState === 'startup' || (fighter.combo.step === 2 && fighter.attackState === 'active')) &&
        !this.jonSwingPlayed &&
        swingElapsed >= definition.swingCueMs) {
      this.jonSwingPlayed = true
      // A locked cue is discarded, never queued for later playback.
      if (!this.sound.locked && !this.swingSound.isPlaying) this.swingSound.play()
    }

    // Carry excess time into the next phase when a frame spans a boundary.
    while (fighter.attackState !== 'idle') {
      if (fighter.attackState === 'startup') {
        if (fighter.attackPhaseElapsed < startupMs) return
        fighter.attackPhaseElapsed -= startupMs
        fighter.attackState = 'active'
        fighter.attackArea.setVisible(true)
      } else if (fighter.attackState === 'active') {
        const hit = canContact && this.checkAttackHit(fighter, defender, movement ? contact : undefined)
        if (hit) {
          const attackerX = contact?.attackerX ?? fighter.container.x
          const defenderX = contact?.defenderX ?? defender.container.x
          const attackerFacing = !contact || attackerX === defenderX ? fighter.facing : attackerX < defenderX ? 'right' : 'left'
          const defenderFacing = !contact || attackerX === defenderX ? defender.facing : attackerX < defenderX ? 'left' : 'right'
          const defenderGrounded = contact ? contact.defenderY === GROUND_TOP - FIGHTER_HEIGHT / 2
            : defender.vertical.movementState === 'grounded'
          if (defender.guardEligible && defenderGrounded &&
              defender.attackState === 'idle' && defender.reaction.reactionState !== 'hitstun' &&
              guardFacesContact(attackerX, defenderX, attackerFacing, defenderFacing)) {
            const direction = attackerX === defenderX
              ? (attackerFacing === 'right' ? 1 : -1) : defenderX > attackerX ? 1 : -1
            defender.reaction = createBlockReaction(fighter.currentAttack!, direction)
            defender.guardCueMs = 90
            fighter.combo.damageConfirmed = false
            fighter.combo.bufferedAttack = null
          } else {
            this.applyDamage(defender, definition.damage, definition.hitstunMs)
            if (!this.winner) {
              fighter.combo.damageConfirmed = true
              this.cancelAttack(defender)
              defender.guardEligible = false
              // Capture away-from-attacker direction once; equal centers use attack facing.
              const direction = defenderX === attackerX
                ? (attackerFacing === 'right' ? 1 : -1)
                : (defenderX > attackerX ? 1 : -1)
              defender.reaction = createHitReaction(definition, direction)
            }
          }
        }
        if (this.winner) return
        if (fighter.attackPhaseElapsed < definition.activeMs) return
        fighter.attackPhaseElapsed -= definition.activeMs
        fighter.attackState = 'recovery'
        fighter.combo.bufferedAttack = null
        fighter.attackArea.setVisible(false)
      } else {
        if (fighter.attackPhaseElapsed < definition.recoveryMs) return
        fighter.attackPhaseElapsed = 0
        fighter.attackState = 'idle'
        fighter.currentAttack = null
        fighter.combo = createComboRuntime()
        this.positionAttackArea(fighter)
      }
    }
  }

  private checkAttackHit(attacker: Fighter, defender: Fighter, contact?: AttackContact | null): boolean {
    if (this.winner || attacker.reaction.reactionState !== 'neutral' || attacker.attackState !== 'active' || attacker.attackHasHit || !attacker.currentAttack) return false
    if (contact === null) return false
    if (contact) {
      attacker.attackHasHit = true
      return true
    }
    const definition = ATTACK_DEFINITIONS[attacker.currentAttack]

    // Use the facing-positioned visualization for identical world-space geometry.
    const attackBox = new Phaser.Geom.Rectangle(
      attacker.container.x + attacker.attackArea.x - definition.reach / 2,
      attacker.container.y + attacker.attackArea.y - definition.height / 2,
      definition.reach,
      definition.height,
    )
    const hurtBox = new Phaser.Geom.Rectangle(
      defender.container.x - FIGHTER_WIDTH / 2,
      defender.container.y - FIGHTER_HEIGHT / 2,
      FIGHTER_WIDTH,
      FIGHTER_HEIGHT,
    )

    if (!Phaser.Geom.Intersects.RectangleToRectangle(attackBox, hurtBox)) return false

    attacker.attackHasHit = true
    return true
  }

  private applyDamage(defender: Fighter, damage: number, hitstunMs = ATTACK_DEFINITIONS.light.hitstunMs): void {
    if (this.winner) return

    defender.health = Math.max(0, defender.health - damage)
    this.updateHealthBars()
    this.playConfirmedHitAudio(defender.health)
    this.showImpactCue(defender)
    defender.presentation.freshReaction = true
    if (defender.health === 0) {
      defender.presentation.hitElapsed = null
      defender.presentation.koElapsed = 0
    } else {
      defender.presentation.hitElapsed = 0
      defender.presentation.hitDurationMs = hitstunMs
    }
    const playerLabel = defender === this.playerOne ? 'Player 1' : 'Player 2'
    console.log(`Hit! ${playerLabel} HP: ${defender.health}`)
    if (defender.health === 0) {
      this.endMatch(defender === this.playerOne ? 'PLAYER 2' : 'PLAYER 1')
    }
  }

  private endMatch(winner: Winner): void {
    if (this.winner) return

    this.winner = winner
    this.touchControls.setPresentation(
      window.matchMedia('(any-pointer: coarse)').matches,
      false,
      true,
    )
    const winningFighter = winner === 'PLAYER 1' ? this.playerOne : this.playerTwo
    winningFighter.presentation.hitElapsed = null
    this.clearCombatState()
    this.winnerText = this.add
      .text(VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2, `${winningFighter.visualConfig.name} WINS`, {
        fontFamily: 'Arial',
        fontSize: '56px',
        color: '#ffffff',
        backgroundColor: '#111827',
        padding: { x: 24, y: 16 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
    this.positionWinnerText()
  }

  private addHealthBar(panelX: number, label: string, mirrored: boolean): HealthBarDisplay {
    const panel = this.add
      .image(panelX, HUD_PANEL_Y, 'hud-bastion-panel')
      .setOrigin(0)
      .setDisplaySize(HUD_PANEL_WIDTH, HUD_PANEL_HEIGHT)
      .setFlipX(mirrored)
      .setScrollFactor(0)

    const frameX = panelX + HUD_FRAME_X_OFFSET
    const frame = this.add
      .rectangle(frameX, HUD_FRAME_Y, HUD_FRAME_WIDTH, HUD_FRAME_HEIGHT, 0x17191b)
      .setOrigin(0)
      .setStrokeStyle(2, 0x717579)
      .setScrollFactor(0)

    const troughX = frameX + HUD_FRAME_INSET
    const fillX = mirrored ? troughX + HUD_FILL_WIDTH : troughX
    const trough = this.add
      .rectangle(troughX, HUD_FRAME_Y + HUD_FRAME_INSET, HUD_FILL_WIDTH, HUD_FILL_HEIGHT, 0x252629)
      .setOrigin(0)
      .setScrollFactor(0)

    const fill = this.add
      .rectangle(fillX, HUD_FRAME_Y + HUD_FRAME_INSET, HUD_FILL_WIDTH, HUD_FILL_HEIGHT, 0xbe9d77)
      .setOrigin(mirrored ? 1 : 0, 0)
      .setScrollFactor(0)

    const name = this.add
      .text(mirrored ? panelX + HUD_PANEL_WIDTH - HUD_FRAME_X_OFFSET : frameX, 62, label, {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        color: '#eee7da',
      })
      .setOrigin(mirrored ? 1 : 0, 0.5)
      .setShadow(1, 2, '#101112', 2)
      .setScrollFactor(0)

    return { panel, frame, trough, fill, label: name, mirrored }
  }

  private updateResponsiveHud(): void {
    const shortLandscape = window.innerWidth > window.innerHeight && window.innerHeight <= 450
    if (shortLandscape !== this.shortLandscapeHud) {
      this.shortLandscapeHud = shortLandscape
      for (const bar of [this.playerOneHealthBar, this.playerTwoHealthBar]) {
        bar.label.setFontSize(shortLandscape ? 32 : 24)
        bar.frame.setSize(HUD_FRAME_WIDTH, shortLandscape ? 38 : HUD_FRAME_HEIGHT)
        bar.trough.setSize(HUD_FILL_WIDTH, shortLandscape ? 30 : HUD_FILL_HEIGHT)
        bar.fill.setSize(HUD_FILL_WIDTH, shortLandscape ? 30 : HUD_FILL_HEIGHT)
      }
      this.updateHealthBars()
    }
  }

  private handleScaleResize(): void {
    // FIT scales into the actual parent, not the potentially larger window.
    const desiredWidth = getAdaptiveViewportWidth(this.scale.parentSize.width, this.scale.parentSize.height)
    if (this.scale.width !== desiredWidth || this.scale.height !== VIEWPORT_HEIGHT) {
      this.scale.setGameSize(desiredWidth, VIEWPORT_HEIGHT)
      return // setGameSize emits RESIZE; apply layout with the refreshed FIT bounds.
    }

    const width = this.scale.width
    const height = this.scale.height
    const previousWidth = this.viewportWidth
    if (previousWidth !== width) {
      for (const flake of this.snowflakes) flake.shape.x *= width / previousWidth
    }
    this.viewportWidth = width
    this.viewportHeight = height
    this.safeInsets = this.readSafeInsets()

    this.skyLayer.setX(width / 2)
    this.distanceLayer.setX(width / 2 + ((WORLD_WIDTH - width) / 2) * 0.25)
    this.playerOneHealthBar && this.positionHealthBar(
      this.playerOneHealthBar, Math.max(HUD_PANEL_MARGIN, this.safeInsets.left),
    )
    this.playerTwoHealthBar && this.positionHealthBar(
      this.playerTwoHealthBar, width - Math.max(HUD_PANEL_MARGIN, this.safeInsets.right) - HUD_PANEL_WIDTH,
    )
    this.positionWinnerText()
    this.touchControls?.setViewport(width, height, this.safeInsets)
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
    this.cameras.main.setScroll(
      getCombatCameraTarget(this.playerOne.container.x, this.playerTwo.container.x, width), 0,
    )
  }

  private positionHealthBar(bar: HealthBarDisplay, panelX: number): void {
    const panelY = Math.max(HUD_PANEL_Y, this.safeInsets.top)
    const offsetY = panelY - HUD_PANEL_Y
    bar.panel.setPosition(panelX, panelY)
    const frameX = panelX + HUD_FRAME_X_OFFSET
    const troughX = frameX + HUD_FRAME_INSET
    bar.frame.setPosition(frameX, HUD_FRAME_Y + offsetY)
    bar.trough.setPosition(troughX, HUD_FRAME_Y + HUD_FRAME_INSET + offsetY)
    bar.fill.setPosition(bar.mirrored ? troughX + HUD_FILL_WIDTH : troughX, HUD_FRAME_Y + HUD_FRAME_INSET + offsetY)
    bar.label.setPosition(bar.mirrored ? panelX + HUD_PANEL_WIDTH - HUD_FRAME_X_OFFSET : frameX, 62 + offsetY)
  }

  private readSafeInsets(): ScreenInsets {
    const canvas = this.game.canvas.getBoundingClientRect()
    const app = this.game.canvas.closest('.app')
    if (!app || canvas.width <= 0 || canvas.height <= 0) return { top: 0, right: 0, bottom: 0, left: 0 }
    const bounds = app.getBoundingClientRect()
    const style = getComputedStyle(app)
    const inset = (edge: string): number => parseFloat(style.getPropertyValue(`--combat-safe-${edge}`)) || 0
    // Letterboxing may already provide some/all of a physical safe inset.
    return {
      left: Math.max(0, inset('left') - (canvas.left - bounds.left)) * this.scale.width / canvas.width,
      right: Math.max(0, inset('right') - (bounds.right - canvas.right)) * this.scale.width / canvas.width,
      top: Math.max(0, inset('top') - (canvas.top - bounds.top)) * this.scale.height / canvas.height,
      bottom: Math.max(0, inset('bottom') - (bounds.bottom - canvas.bottom)) * this.scale.height / canvas.height,
    }
  }

  private positionWinnerText(): void {
    this.winnerText?.setPosition(
      (this.viewportWidth + this.safeInsets.left - this.safeInsets.right) / 2,
      (this.viewportHeight + this.safeInsets.top - this.safeInsets.bottom) / 2,
    )
  }

  private cleanupResponsiveLayout(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleScaleResize, this)
    this.parentResizeObserver?.disconnect()
    this.parentResizeObserver = undefined
  }

  private updateHealthBars(): void {
    this.updateHealthFill(this.playerOneHealthBar.fill, this.playerOne.health)
    this.updateHealthFill(this.playerTwoHealthBar.fill, this.playerTwo.health)
  }

  private updateHealthFill(fill: Phaser.GameObjects.Rectangle, health: number): void {
    const fraction = Phaser.Math.Clamp(health / PLAYER_MAX_HEALTH, 0, 1)
    fill.scaleX = fraction
    fill.setVisible(fraction > 0)
    fill.setFillStyle(health <= 20 ? 0xa36f5b : health <= 50 ? 0xad8969 : 0xbe9d77)
  }

  private addFighter(x: number, config: FighterVisualConfig): Fighter {
    const vertical = createVerticalMovement()
    const fighterY = vertical.footY - FIGHTER_HEIGHT / 2

    // Scale the illustration independently; its sole origin stays at the gameplay foot.
    // Only the image flips: container position and collision geometry stay unchanged.
    const visual = this.add.image(0, FIGHTER_HEIGHT / 2, config.guard)
      .setOrigin(0.5, config.origins[config.guard]).setScale(config.scale)

    // Temporary marker makes the fighter's gameplay-facing state visible.
    const facingMarker = this.add
      .rectangle(
        FIGHTER_WIDTH / 2 - FACING_MARKER_SIZE,
        -FIGHTER_HEIGHT / 4,
        FACING_MARKER_SIZE,
        FACING_MARKER_SIZE,
        0xffd166,
      )
      .setVisible(!visual)

    // setFacing positions this temporary area on the fighter's facing side.
    const attackArea = this.add
      .rectangle(
        FIGHTER_WIDTH / 2 + ATTACK_DEFINITIONS.light.reach / 2,
        0,
        ATTACK_DEFINITIONS.light.reach,
        ATTACK_DEFINITIONS.light.height,
        0xffd166,
        0.65,
      )
      .setStrokeStyle(3, 0xffffff)
      .setVisible(false)

    const guardIndicator = this.add.rectangle(FIGHTER_WIDTH / 2 + 6, 0, 6, 58, 0xcbdce4).setVisible(false)
    return {
      container: this.add.container(x, fighterY, [visual, facingMarker, attackArea, guardIndicator]),
      visualConfig: config,
      presentation: createVisualRuntime(),
      guardEligible: false,
      guardIndicator,
      guardCueMs: 0,
      vertical,
      reaction: createNeutralReaction(),
      combo: createComboRuntime(),
      visual,
      attackArea,
      facingMarker,
      facing: 'right',
      health: PLAYER_MAX_HEALTH,
      ...createAttackRuntime(),
    }
  }
}
