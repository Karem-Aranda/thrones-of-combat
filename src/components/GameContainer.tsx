import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'
import { createGame } from '../game/createGame'

export default function GameContainer() {
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = createGame()
    }

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  return (
    <>
      <div id="game-container" />
      <div className="rotate-hint" role="status">
        <div className="rotate-hint__frame">Rotate your device to landscape to fight.</div>
      </div>
    </>
  )
}
