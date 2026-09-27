import Phaser from 'phaser'
import jonSnowGuardUrl from '../../assets/fighters/jon-snow-guard.png'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  preload(): void {
    this.load.image('jon-snow-guard', jonSnowGuardUrl)
  }

  create(): void {
    this.scene.start('CombatScene')
  }
}
