import Phaser from 'phaser'
import jonSnowGuardUrl from '../../assets/fighters/jon-snow-guard.png'

const jonSnowAnimationUrls = import.meta.glob<string>(
  '../../assets/fighters/jon-snow-frames/*.png',
  { eager: true, query: '?url', import: 'default' },
)

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  preload(): void {
    this.load.image('jon-snow-guard', jonSnowGuardUrl)
    for (const [path, url] of Object.entries(jonSnowAnimationUrls)) {
      const frameName = path.split('/').pop()?.replace(/\.png$/, '')
      if (!frameName) throw new Error(`Invalid Jon Snow frame path: ${path}`)
      this.load.image(`jon-${frameName}`, url)
    }
  }

  create(): void {
    this.scene.start('CombatScene')
  }
}
