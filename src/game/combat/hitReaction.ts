import type { AttackDefinition } from './attackDefinitions'

export interface HitReaction {
  reactionState: 'neutral' | 'hitstun'
  remainingMs: number
  knockbackVelocity: number
}

export function createNeutralReaction(): HitReaction {
  return { reactionState: 'neutral', remainingMs: 0, knockbackVelocity: 0 }
}

export function createHitReaction(
  definition: AttackDefinition, direction: -1 | 1,
): HitReaction {
  return {
    reactionState: 'hitstun',
    remainingMs: definition.hitstunMs,
    knockbackVelocity: direction * definition.knockbackDistance / (definition.hitstunMs / 1000),
  }
}

/** Request only this frame's displacement. World-blocked distance is never stored. */
export function advanceHitReaction(
  reaction: HitReaction, delta: number,
): { reaction: HitReaction; displacement: number } {
  if (reaction.reactionState === 'neutral') return { reaction, displacement: 0 }
  const elapsed = Math.min(reaction.remainingMs, Number.isFinite(delta) ? Math.max(0, delta) : 0)
  if (elapsed === 0) return { reaction, displacement: 0 }
  const remainingMs = reaction.remainingMs - elapsed
  return {
    reaction: remainingMs > 0 ? { ...reaction, remainingMs } : createNeutralReaction(),
    displacement: reaction.knockbackVelocity * elapsed / 1000,
  }
}
