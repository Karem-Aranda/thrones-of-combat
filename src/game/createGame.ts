import Phaser from 'phaser'
import { gameConfig } from './config/gameConfig'

export const createGame = (): Phaser.Game => {
  return new Phaser.Game(gameConfig)
}
