import Phaser from 'phaser'
import { BootScene } from '../scenes/BootScene'
import { CombatScene } from '../scenes/CombatScene'
import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT } from '../world/combatWorld'

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: VIEWPORT_WIDTH,
  height: VIEWPORT_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#111111',
  input: { activePointers: 6 },
  scene: [BootScene, CombatScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
}
