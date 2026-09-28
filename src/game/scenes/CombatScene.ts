import Phaser from 'phaser'

const ARENA_WIDTH = 1280
const ARENA_HEIGHT = 720
const GROUND_Y = 600
const GROUND_HEIGHT = 80
const FIGHTER_WIDTH = 72
const FIGHTER_HEIGHT = 140
// Static asset landmarks (source pixels), not gameplay dimensions.
const JON_SNOW_TEXTURE_HEIGHT = 1374
const JON_SNOW_HEAD_Y = 128
const JON_SNOW_FOOT_Y = 1329
const JON_IMAGE_SCALE = FIGHTER_HEIGHT / (JON_SNOW_FOOT_Y - JON_SNOW_HEAD_Y)
const JON_IDLE_FRAMES = [
  'jon-snow-guard', 'jon-idle-2', 'jon-idle-3', 'jon-idle-2',
  'jon-snow-guard', 'jon-idle-4', 'jon-snow-guard',
]
const JON_MOVE_FRAMES = [
  'jon-move-1', 'jon-move-2', 'jon-move-3',
  'jon-move-4', 'jon-move-5', 'jon-move-6',
]
const JON_IDLE_FRAME_MS = 300 // Seven poses over 2.1 seconds.
const JON_MOVE_FRAME_MS = 100 // Six combat steps over 0.6 seconds.
// Measured source-pixel sole lines. Each texture uses the same scale and world baseline.
const JON_FRAME_SOLE_Y: Record<string, number> = {
  'jon-snow-guard': 1329,
  'jon-idle-2': 1330,
  'jon-idle-3': 1330,
  'jon-idle-4': 1330,
  'jon-move-1': 1316,
  'jon-move-2': 1322,
  'jon-move-3': 1322,
  'jon-move-4': 1324,
  'jon-move-5': 1316,
  'jon-move-6': 1324,
  'jon-attack-s-1': 1324,
  'jon-attack-s-2': 1328,
  'jon-attack-a-1': 1256,
  'jon-attack-a-2': 1285,
  'jon-attack-a-3': 1262,
  'jon-attack-r-1': 1280,
  'jon-attack-r-2': 1322,
  'jon-attack-r-3': 1329,
}
const FACING_MARKER_SIZE = 12
const PLAYER_MOVE_SPEED = 300
const ATTACK_STARTUP_MS = 180
const ATTACK_ACTIVE_MS = 220
const ATTACK_RECOVERY_MS = 300
const ATTACK_AREA_WIDTH = 100
const ATTACK_AREA_HEIGHT = 70
const PLAYER_MAX_HEALTH = 100
const BASIC_ATTACK_DAMAGE = 10
const HUD_BAR_WIDTH = 400
const HUD_BAR_HEIGHT = 28
const HUD_BAR_MARGIN = 80
const HUD_BAR_Y = 110
const HUD_BAR_INSET = 4

type AttackState = 'idle' | 'startup' | 'active' | 'recovery'
type Facing = 'left' | 'right'
type Winner = 'PLAYER 1' | 'PLAYER 2'
type JonVisualMode = 'idle' | 'move-forward' | 'move-retreat' | 'attack'

interface Fighter {
  container: Phaser.GameObjects.Container
  visual?: Phaser.GameObjects.Image
  attackArea: Phaser.GameObjects.Rectangle
  facingMarker: Phaser.GameObjects.Rectangle
  facing: Facing
  health: number
  attackState: AttackState
  attackPhaseElapsed: number
  attackHasHit: boolean
}

interface MovementKeys {
  left: Phaser.Input.Keyboard.Key
  right: Phaser.Input.Keyboard.Key
}

export class CombatScene extends Phaser.Scene {
  private playerOne!: Fighter
  private playerTwo!: Fighter
  private attackKeys!: {
    playerOne: Phaser.Input.Keyboard.Key
    playerTwo: Phaser.Input.Keyboard.Key
  }
  private restartKey!: Phaser.Input.Keyboard.Key
  private playerOneHealthFill!: Phaser.GameObjects.Rectangle
  private playerTwoHealthFill!: Phaser.GameObjects.Rectangle
  private winner: Winner | null = null
  private jonVisualMode: JonVisualMode = 'idle'
  private jonVisualElapsed = 0
  private movementKeys!: {
    playerOne: MovementKeys
    playerTwo: MovementKeys
  }

  constructor() {
    super('CombatScene')
  }

  create(): void {
    // Scene restarts reuse this class instance; new fighters reset their own state.
    this.winner = null
    this.jonVisualMode = 'idle'
    this.jonVisualElapsed = 0

    this.add
      .rectangle(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, ARENA_WIDTH, ARENA_HEIGHT, 0x14213d)
      .setDepth(-2)

    this.add
      .rectangle(ARENA_WIDTH / 2, GROUND_Y, ARENA_WIDTH, GROUND_HEIGHT, 0x3d405b)
      .setStrokeStyle(4, 0xf2cc8f)

    this.add
      .text(ARENA_WIDTH / 2, 72, 'FIGHTING ARENA', {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: '#f2cc8f',
      })
      .setOrigin(0.5)

    this.playerOne = this.addFighter(260, 0x4cc9f0, 'PLAYER 1', 'jon-snow-guard')
    this.playerTwo = this.addFighter(1020, 0xf72585, 'PLAYER 2')
    this.updateFacing()

    this.playerOneHealthFill = this.addHealthBar(HUD_BAR_MARGIN, 'P1', 0, 0x4cc9f0)
    this.playerTwoHealthFill = this.addHealthBar(ARENA_WIDTH - HUD_BAR_MARGIN, 'P2', 1, 0xf72585)
    this.updateHealthBars()

    const keyboard = this.input.keyboard
    if (!keyboard) {
      throw new Error('Keyboard input is unavailable')
    }

    this.movementKeys = {
      playerOne: {
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      },
      playerTwo: {
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      },
    }
    this.attackKeys = {
      playerOne: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J),
      playerTwo: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L),
    }
    this.restartKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R)
  }

  update(_time: number, delta: number): void {
    const restartPressed = Phaser.Input.Keyboard.JustDown(this.restartKey)
    if (this.winner) {
      if (restartPressed) this.scene.restart()
      return
    }

    const previousPlayerOneX = this.playerOne.container.x
    this.moveFighter(this.playerOne, this.movementKeys.playerOne, delta)
    this.moveFighter(this.playerTwo, this.movementKeys.playerTwo, delta)
    this.updateFacing()

    this.tryStartAttack(this.playerOne, this.attackKeys.playerOne)
    this.tryStartAttack(this.playerTwo, this.attackKeys.playerTwo)
    this.advanceAttack(this.playerOne, this.playerTwo, delta)
    this.advanceAttack(this.playerTwo, this.playerOne, delta)
    this.updateJonVisual(delta, this.playerOne.container.x - previousPlayerOneX)
  }

  private updateJonVisual(delta: number, movedX: number): void {
    const visual = this.playerOne.visual
    if (!visual) return

    let mode: JonVisualMode
    let frameKey: string
    if (this.playerOne.attackState !== 'idle') {
      mode = 'attack'
      frameKey = this.getJonAttackFrame(this.playerOne)
    } else {
      mode = 'idle'
      if (movedX !== 0) {
        const movingForward = movedX * (this.playerOne.facing === 'right' ? 1 : -1) > 0
        mode = movingForward ? 'move-forward' : 'move-retreat'
      }

      // Gameplay displacement, not key state, selects locomotion at boundaries.
      this.jonVisualElapsed = mode === this.jonVisualMode ? this.jonVisualElapsed + delta : 0
      if (mode === 'idle') {
        const loopElapsed = this.jonVisualElapsed % (JON_IDLE_FRAMES.length * JON_IDLE_FRAME_MS)
        const index = Math.floor(loopElapsed / JON_IDLE_FRAME_MS)
        frameKey = JON_IDLE_FRAMES[index]
      } else {
        const loopElapsed = this.jonVisualElapsed % (JON_MOVE_FRAMES.length * JON_MOVE_FRAME_MS)
        const index = Math.floor(loopElapsed / JON_MOVE_FRAME_MS)
        frameKey = JON_MOVE_FRAMES[mode === 'move-retreat' ? JON_MOVE_FRAMES.length - 1 - index : index]
      }
    }

    if (visual.texture.key !== frameKey) {
      const soleY = JON_FRAME_SOLE_Y[frameKey]
      if (soleY === undefined) throw new Error(`Missing Jon Snow frame baseline: ${frameKey}`)
      visual.setTexture(frameKey)
      visual.setOrigin(0.5, soleY / visual.height)
    }
    this.jonVisualMode = mode
  }

  private getJonAttackFrame(fighter: Fighter): string {
    const elapsed = fighter.attackPhaseElapsed
    if (fighter.attackState === 'startup') {
      return elapsed < 90 ? 'jon-attack-s-1' : 'jon-attack-s-2'
    }
    if (fighter.attackState === 'active') {
      return elapsed < 60 ? 'jon-attack-a-1' : elapsed < 160 ? 'jon-attack-a-2' : 'jon-attack-a-3'
    }
    return elapsed < 100 ? 'jon-attack-r-1' : elapsed < 200 ? 'jon-attack-r-2' : 'jon-attack-r-3'
  }

  private moveFighter(fighter: Fighter, keys: MovementKeys, delta: number): void {
    let direction = 0

    if (keys.left.isDown) {
      direction -= 1
    }

    if (keys.right.isDown) {
      direction += 1
    }

    if (direction !== 0) {
      const halfFighterWidth = FIGHTER_WIDTH / 2
      const distance = direction * PLAYER_MOVE_SPEED * (delta / 1000)

      fighter.container.x = Phaser.Math.Clamp(
        fighter.container.x + distance,
        halfFighterWidth,
        ARENA_WIDTH - halfFighterWidth,
      )
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
    fighter.attackArea.x = (facing === 'right' ? 1 : -1) * (FIGHTER_WIDTH / 2 + ATTACK_AREA_WIDTH / 2)
  }

  private tryStartAttack(fighter: Fighter, key: Phaser.Input.Keyboard.Key): void {
    // Consume each key press even during an attack, so inputs are not queued.
    if (Phaser.Input.Keyboard.JustDown(key) && fighter.attackState === 'idle') {
      fighter.attackState = 'startup'
      fighter.attackPhaseElapsed = 0
      fighter.attackHasHit = false
    }
  }

  private advanceAttack(fighter: Fighter, defender: Fighter, delta: number): void {
    if (this.winner || fighter.attackState === 'idle') return

    fighter.attackPhaseElapsed += delta

    // Carry excess time into the next phase when a frame spans a boundary.
    while (fighter.attackState !== 'idle') {
      if (fighter.attackState === 'startup') {
        if (fighter.attackPhaseElapsed < ATTACK_STARTUP_MS) return
        fighter.attackPhaseElapsed -= ATTACK_STARTUP_MS
        fighter.attackState = 'active'
        fighter.attackArea.setVisible(true)
      } else if (fighter.attackState === 'active') {
        const hit = this.checkAttackHit(fighter, defender)
        if (hit) this.applyDamage(defender)
        if (this.winner) return
        if (fighter.attackPhaseElapsed < ATTACK_ACTIVE_MS) return
        fighter.attackPhaseElapsed -= ATTACK_ACTIVE_MS
        fighter.attackState = 'recovery'
        fighter.attackArea.setVisible(false)
      } else {
        if (fighter.attackPhaseElapsed < ATTACK_RECOVERY_MS) return
        fighter.attackPhaseElapsed = 0
        fighter.attackState = 'idle'
      }
    }
  }

  private checkAttackHit(attacker: Fighter, defender: Fighter): boolean {
    if (this.winner || attacker.attackState !== 'active' || attacker.attackHasHit) return false

    // Use the facing-positioned visualization for identical world-space geometry.
    const attackBox = new Phaser.Geom.Rectangle(
      attacker.container.x + attacker.attackArea.x - ATTACK_AREA_WIDTH / 2,
      attacker.container.y + attacker.attackArea.y - ATTACK_AREA_HEIGHT / 2,
      ATTACK_AREA_WIDTH,
      ATTACK_AREA_HEIGHT,
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

  private applyDamage(defender: Fighter): void {
    if (this.winner) return

    defender.health = Math.max(0, defender.health - BASIC_ATTACK_DAMAGE)
    this.updateHealthBars()
    const playerLabel = defender === this.playerOne ? 'Player 1' : 'Player 2'
    console.log(`Hit! ${playerLabel} HP: ${defender.health}`)
    if (defender.health === 0) {
      this.endMatch(defender === this.playerOne ? 'PLAYER 2' : 'PLAYER 1')
    }
  }

  private endMatch(winner: Winner): void {
    if (this.winner) return

    this.winner = winner
    this.playerOne.attackArea.setVisible(false)
    this.playerTwo.attackArea.setVisible(false)
    this.add
      .text(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, `${this.winner} WINS`, {
        fontFamily: 'Arial',
        fontSize: '56px',
        color: '#ffffff',
        backgroundColor: '#111827',
        padding: { x: 24, y: 16 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
  }

  private addHealthBar(
    x: number,
    label: string,
    originX: number,
    color: number,
  ): Phaser.GameObjects.Rectangle {
    this.add
      .rectangle(x, HUD_BAR_Y, HUD_BAR_WIDTH, HUD_BAR_HEIGHT, 0x303443)
      .setOrigin(originX, 0.5)
      .setStrokeStyle(2, 0xffffff)
      .setScrollFactor(0)

    const fillX = x + (originX === 0 ? HUD_BAR_INSET : -HUD_BAR_INSET)
    const fill = this.add
      .rectangle(
        fillX,
        HUD_BAR_Y,
        HUD_BAR_WIDTH - HUD_BAR_INSET * 2,
        HUD_BAR_HEIGHT - HUD_BAR_INSET * 2,
        color,
      )
      .setOrigin(originX, 0.5)
      .setScrollFactor(0)

    this.add
      .text(x, HUD_BAR_Y - 36, label, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(originX, 0.5)
      .setScrollFactor(0)

    return fill
  }

  private updateHealthBars(): void {
    this.playerOneHealthFill.scaleX = Phaser.Math.Clamp(this.playerOne.health / PLAYER_MAX_HEALTH, 0, 1)
    this.playerTwoHealthFill.scaleX = Phaser.Math.Clamp(this.playerTwo.health / PLAYER_MAX_HEALTH, 0, 1)
  }

  private addFighter(x: number, color: number, label: string, textureKey?: string): Fighter {
    const groundTop = GROUND_Y - GROUND_HEIGHT / 2
    const fighterY = groundTop - FIGHTER_HEIGHT / 2

    // Match the illustrated head-to-foot height to the existing fighter height.
    // Only the image flips: container position and collision geometry stay unchanged.
    const visual = textureKey
      ? this.add
          .image(0, FIGHTER_HEIGHT / 2, textureKey)
          .setOrigin(0.5, JON_SNOW_FOOT_Y / JON_SNOW_TEXTURE_HEIGHT)
          .setScale(JON_IMAGE_SCALE)
      : undefined
    const body = visual ??
      this.add
        .rectangle(0, 0, FIGHTER_WIDTH, FIGHTER_HEIGHT, color)
        .setStrokeStyle(4, 0xffffff)

    const name = this.add
      .text(0, -FIGHTER_HEIGHT / 2 - 24, label, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

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
        FIGHTER_WIDTH / 2 + ATTACK_AREA_WIDTH / 2,
        0,
        ATTACK_AREA_WIDTH,
        ATTACK_AREA_HEIGHT,
        0xffd166,
        0.65,
      )
      .setStrokeStyle(3, 0xffffff)
      .setVisible(false)

    return {
      container: this.add.container(x, fighterY, [body, name, facingMarker, attackArea]),
      visual,
      attackArea,
      facingMarker,
      facing: 'right',
      health: PLAYER_MAX_HEALTH,
      attackState: 'idle',
      attackPhaseElapsed: 0,
      attackHasHit: false,
    }
  }
}
