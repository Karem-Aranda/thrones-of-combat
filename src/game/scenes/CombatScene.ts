import Phaser from 'phaser'

const ARENA_WIDTH = 1280
const ARENA_HEIGHT = 720
const GROUND_Y = 600
const GROUND_HEIGHT = 80
const FIGHTER_HEIGHT = 140

export class CombatScene extends Phaser.Scene {
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

    this.addFighter(260, 0x4cc9f0, 'PLAYER 1')
    this.addFighter(1020, 0xf72585, 'PLAYER 2')
  }

  private addFighter(x: number, color: number, label: string): void {
    const groundTop = GROUND_Y - GROUND_HEIGHT / 2
    const fighterY = groundTop - FIGHTER_HEIGHT / 2

    this.add
      .rectangle(x, fighterY, 72, FIGHTER_HEIGHT, color)
      .setStrokeStyle(4, 0xffffff)

    this.add
      .text(x, fighterY - FIGHTER_HEIGHT / 2 - 24, label, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
  }
}
