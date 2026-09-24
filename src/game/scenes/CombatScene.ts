import Phaser from 'phaser'

const ARENA_WIDTH = 1280
const ARENA_HEIGHT = 720
const GROUND_Y = 600
const GROUND_HEIGHT = 80
const FIGHTER_WIDTH = 72
const FIGHTER_HEIGHT = 140
const PLAYER_MOVE_SPEED = 300

export class CombatScene extends Phaser.Scene {
  private playerOne!: Phaser.GameObjects.Container
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

    const keyboard = this.input.keyboard
    if (!keyboard) {
      throw new Error('Keyboard input is unavailable')
    }

    this.movementKeys = {
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }
  }

  update(_time: number, delta: number): void {
    let direction = 0

    if (this.movementKeys.left.isDown) {
      direction -= 1
    }

    if (this.movementKeys.right.isDown) {
      direction += 1
    }

    if (direction === 0) {
      return
    }

    const halfFighterWidth = FIGHTER_WIDTH / 2
    const distance = direction * PLAYER_MOVE_SPEED * (delta / 1000)

    this.playerOne.x = Phaser.Math.Clamp(
      this.playerOne.x + distance,
      halfFighterWidth,
      ARENA_WIDTH - halfFighterWidth,
    )
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
