import Phaser from 'phaser'

const ARENA_WIDTH = 1280
const ARENA_HEIGHT = 720
const GROUND_Y = 600
const GROUND_HEIGHT = 80
const FIGHTER_WIDTH = 72
const FIGHTER_HEIGHT = 140
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
type Winner = 'PLAYER 1' | 'PLAYER 2'

interface Fighter {
  container: Phaser.GameObjects.Container
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
  private attackKey!: Phaser.Input.Keyboard.Key
  private restartKey!: Phaser.Input.Keyboard.Key
  private attackArea!: Phaser.GameObjects.Rectangle
  private playerOneHealthFill!: Phaser.GameObjects.Rectangle
  private playerTwoHealthFill!: Phaser.GameObjects.Rectangle
  private winner: Winner | null = null
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

    this.playerOne = this.addFighter(260, 0x4cc9f0, 'PLAYER 1')
    this.playerTwo = this.addFighter(1020, 0xf72585, 'PLAYER 2')

    this.attackArea = this.add
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
    this.playerOne.container.add(this.attackArea)

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
    this.attackKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J)
    this.restartKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R)
  }

  update(_time: number, delta: number): void {
    const restartPressed = Phaser.Input.Keyboard.JustDown(this.restartKey)
    if (this.winner) {
      if (restartPressed) this.scene.restart()
      return
    }

    this.moveFighter(this.playerOne, this.movementKeys.playerOne, delta)
    this.moveFighter(this.playerTwo, this.movementKeys.playerTwo, delta)

    // Consume each key press even during an attack, so inputs are not queued.
    if (Phaser.Input.Keyboard.JustDown(this.attackKey) && this.playerOne.attackState === 'idle') {
      this.playerOne.attackState = 'startup'
      this.playerOne.attackPhaseElapsed = 0
      this.playerOne.attackHasHit = false
    }

    this.advanceAttack(delta)
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

  private advanceAttack(delta: number): void {
    if (this.playerOne.attackState === 'idle') return

    this.playerOne.attackPhaseElapsed += delta

    // Carry excess time into the next phase when a frame spans a boundary.
    while (this.playerOne.attackState !== 'idle') {
      if (this.playerOne.attackState === 'startup') {
        if (this.playerOne.attackPhaseElapsed < ATTACK_STARTUP_MS) return
        this.playerOne.attackPhaseElapsed -= ATTACK_STARTUP_MS
        this.playerOne.attackState = 'active'
        this.attackArea.setVisible(true)
      } else if (this.playerOne.attackState === 'active') {
        this.checkAttackHit()
        if (this.winner) return
        if (this.playerOne.attackPhaseElapsed < ATTACK_ACTIVE_MS) return
        this.playerOne.attackPhaseElapsed -= ATTACK_ACTIVE_MS
        this.playerOne.attackState = 'recovery'
        this.attackArea.setVisible(false)
      } else {
        if (this.playerOne.attackPhaseElapsed < ATTACK_RECOVERY_MS) return
        this.playerOne.attackPhaseElapsed = 0
        this.playerOne.attackState = 'idle'
      }
    }
  }

  private checkAttackHit(): void {
    if (this.winner || this.playerOne.attackHasHit) return

    // The attack area is local to Player 1; both rectangles need world coordinates.
    const attackBox = new Phaser.Geom.Rectangle(
      this.playerOne.container.x + this.attackArea.x - ATTACK_AREA_WIDTH / 2,
      this.playerOne.container.y + this.attackArea.y - ATTACK_AREA_HEIGHT / 2,
      ATTACK_AREA_WIDTH,
      ATTACK_AREA_HEIGHT,
    )
    const hurtBox = new Phaser.Geom.Rectangle(
      this.playerTwo.container.x - FIGHTER_WIDTH / 2,
      this.playerTwo.container.y - FIGHTER_HEIGHT / 2,
      FIGHTER_WIDTH,
      FIGHTER_HEIGHT,
    )

    if (Phaser.Geom.Intersects.RectangleToRectangle(attackBox, hurtBox)) {
      this.playerOne.attackHasHit = true
      this.playerTwo.health = Math.max(0, this.playerTwo.health - BASIC_ATTACK_DAMAGE)
      this.updateHealthBars()
      console.log(`Hit! Player 2 HP: ${this.playerTwo.health}`)
      if (this.playerTwo.health === 0) {
        this.endMatch('PLAYER 1')
      }
    }
  }

  private endMatch(winner: Winner): void {
    if (this.winner) return

    this.winner = winner
    this.attackArea.setVisible(false)
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

  private addFighter(x: number, color: number, label: string): Fighter {
    const groundTop = GROUND_Y - GROUND_HEIGHT / 2
    const fighterY = groundTop - FIGHTER_HEIGHT / 2

    const body = this.add
      .rectangle(0, 0, FIGHTER_WIDTH, FIGHTER_HEIGHT, color)
      .setStrokeStyle(4, 0xffffff)

    const name = this.add
      .text(0, -FIGHTER_HEIGHT / 2 - 24, label, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    return {
      container: this.add.container(x, fighterY, [body, name]),
      health: PLAYER_MAX_HEALTH,
      attackState: 'idle',
      attackPhaseElapsed: 0,
      attackHasHit: false,
    }
  }
}
