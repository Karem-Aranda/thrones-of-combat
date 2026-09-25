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

type AttackState = 'idle' | 'startup' | 'active' | 'recovery'

export class CombatScene extends Phaser.Scene {
  private playerOne!: Phaser.GameObjects.Container
  private attackKey!: Phaser.Input.Keyboard.Key
  private attackArea!: Phaser.GameObjects.Rectangle
  private attackState: AttackState = 'idle'
  private attackPhaseElapsed = 0
  private movementKeys!: {
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
  }

  constructor() {
    super('CombatScene')
  }

  create(): void {
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
    this.addFighter(1020, 0xf72585, 'PLAYER 2')

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
    this.playerOne.add(this.attackArea)

    const keyboard = this.input.keyboard
    if (!keyboard) {
      throw new Error('Keyboard input is unavailable')
    }

    this.movementKeys = {
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }
    this.attackKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J)
  }

  update(_time: number, delta: number): void {
    let direction = 0

    if (this.movementKeys.left.isDown) {
      direction -= 1
    }

    if (this.movementKeys.right.isDown) {
      direction += 1
    }

    if (direction !== 0) {
      const halfFighterWidth = FIGHTER_WIDTH / 2
      const distance = direction * PLAYER_MOVE_SPEED * (delta / 1000)

      this.playerOne.x = Phaser.Math.Clamp(
        this.playerOne.x + distance,
        halfFighterWidth,
        ARENA_WIDTH - halfFighterWidth,
      )
    }

    // Consume each key press even during an attack, so inputs are not queued.
    if (Phaser.Input.Keyboard.JustDown(this.attackKey) && this.attackState === 'idle') {
      this.attackState = 'startup'
      this.attackPhaseElapsed = 0
    }

    this.advanceAttack(delta)
  }

  private advanceAttack(delta: number): void {
    if (this.attackState === 'idle') return

    this.attackPhaseElapsed += delta

    // Carry excess time into the next phase when a frame spans a boundary.
    while (this.attackState !== 'idle') {
      if (this.attackState === 'startup') {
        if (this.attackPhaseElapsed < ATTACK_STARTUP_MS) return
        this.attackPhaseElapsed -= ATTACK_STARTUP_MS
        this.attackState = 'active'
        this.attackArea.setVisible(true)
      } else if (this.attackState === 'active') {
        if (this.attackPhaseElapsed < ATTACK_ACTIVE_MS) return
        this.attackPhaseElapsed -= ATTACK_ACTIVE_MS
        this.attackState = 'recovery'
        this.attackArea.setVisible(false)
      } else {
        if (this.attackPhaseElapsed < ATTACK_RECOVERY_MS) return
        this.attackPhaseElapsed = 0
        this.attackState = 'idle'
      }
    }
  }

  private addFighter(x: number, color: number, label: string): Phaser.GameObjects.Container {
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

    return this.add.container(x, fighterY, [body, name])
  }
}
