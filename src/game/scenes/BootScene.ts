import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  create(): void {
    const { width, height } = this.scale

    this.add
      .text(width / 2, height / 2, 'THRONES OF COMBAT', {
        fontFamily: 'Arial',
        fontSize: '48px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height / 2 + 70, 'Combat Prototype', {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5)
  }
}
