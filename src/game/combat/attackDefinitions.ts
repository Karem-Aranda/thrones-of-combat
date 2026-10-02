export type AttackId = 'light' | 'heavy'
export type AttackState = 'idle' | 'startup' | 'active' | 'recovery'

export interface AttackDefinition {
  readonly id: AttackId
  readonly startupMs: number
  readonly activeMs: number
  readonly recoveryMs: number
  readonly damage: number
  /** Width extending outward from the unchanged fighter body edge. */
  readonly reach: number
  readonly height: number
  readonly swingCueMs: number
}

export const ATTACK_DEFINITIONS: Readonly<Record<AttackId, AttackDefinition>> = Object.freeze({
  light: Object.freeze({
    id: 'light', startupMs: 180, activeMs: 220, recoveryMs: 300,
    damage: 10, reach: 100, height: 70, swingCueMs: 140,
  }),
  heavy: Object.freeze({
    id: 'heavy', startupMs: 300, activeMs: 240, recoveryMs: 420,
    damage: 18, reach: 125, height: 70, swingCueMs: 240,
  }),
})

export interface AttackRuntime {
  currentAttack: AttackId | null
  attackState: AttackState
  attackPhaseElapsed: number
  attackHasHit: boolean
}

export function createAttackRuntime(): AttackRuntime {
  return { currentAttack: null, attackState: 'idle', attackPhaseElapsed: 0, attackHasHit: false }
}

/** Fresh intentions are consumed upstream, so the unselected Heavy is discarded. */
export function selectAttack(lightPressed: boolean, heavyPressed: boolean): AttackId | null {
  return lightPressed ? 'light' : heavyPressed ? 'heavy' : null
}

/** Reuse Light artwork pose boundaries without letting presentation dictate timing. */
export function getAttackPresentationElapsed(
  definition: AttackDefinition, phase: Exclude<AttackState, 'idle'>, elapsed: number,
): number {
  const duration = phase === 'startup' ? 'startupMs' : phase === 'active' ? 'activeMs' : 'recoveryMs'
  return elapsed * ATTACK_DEFINITIONS.light[duration] / definition[duration]
}
