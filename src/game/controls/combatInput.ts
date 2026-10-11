/** Held intentions and fresh press edges, shared by human and AI controllers. */
export interface FighterInput {
  blockHeld: boolean
  leftHeld: boolean
  rightHeld: boolean
  jumpPressed: boolean
  lightPressed: boolean
  heavyPressed: boolean
}

export type GameMode = 'local-versus' | 'single-player'
export interface CombatSceneData { mode?: GameMode }

export function resolveGameMode(mode: unknown): GameMode {
  return mode === 'single-player' ? mode : 'local-versus'
}

export function neutralFighterInput(): FighterInput {
  return {
    blockHeld: false, leftHeld: false, rightHeld: false,
    jumpPressed: false, lightPressed: false, heavyPressed: false,
  }
}
