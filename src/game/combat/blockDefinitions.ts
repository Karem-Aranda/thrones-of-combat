import type { AttackId } from './attackDefinitions'
import type { HitReaction } from './hitReaction'

export const BLOCK_DEFINITIONS = Object.freeze({
  light: Object.freeze({ blockstunMs: 120, pushback: 12, velocity: 100 }),
  heavy: Object.freeze({ blockstunMs: 200, pushback: 24, velocity: 120 }),
})

export function createBlockReaction(id: AttackId, direction: -1 | 1): HitReaction {
  const definition = BLOCK_DEFINITIONS[id]
  return {
    reactionState: 'blockstun', remainingMs: definition.blockstunMs,
    knockbackVelocity: direction * definition.velocity,
  }
}

export function guardEligible(
  held: boolean, matchActive: boolean, grounded: boolean, idle: boolean,
  reaction: 'neutral' | 'hitstun' | 'blockstun',
): boolean {
  return held && matchActive && grounded && idle && reaction !== 'hitstun'
}

export function guardFacesContact(
  attackerX: number, defenderX: number, attackerFacing: 'left' | 'right', defenderFacing: 'left' | 'right',
): boolean {
  return attackerX === defenderX ? attackerFacing !== defenderFacing
    : defenderFacing === (attackerX < defenderX ? 'left' : 'right')
}
