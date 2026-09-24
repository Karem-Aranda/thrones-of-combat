import Phaser from 'phaser'
import { BootScene } from '../scenes/BootScene'
import { CombatScene } from '../scenes/CombatScene'

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: 'game-container',
  backgroundColor: '#111111',
  scene: [BootScene, CombatScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
}
