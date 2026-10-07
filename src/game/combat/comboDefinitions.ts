import type { AttackId, AttackRuntime } from './attackDefinitions'

export const COMBO_CONTINUATIONS: Readonly<Record<AttackId, number>> = Object.freeze({
  light: 120,
  heavy: 160,
})
export interface ComboRuntime {
  step: 0 | 1 | 2
  bufferedAttack: AttackId | null
}
export function createComboRuntime(): ComboRuntime {
  return { step: 0, bufferedAttack: null }
}
/** Only the confirmed first Light has outgoing links; either second attack ends. */
export function canContinue(attack: AttackRuntime, combo: ComboRuntime): boolean {
  return combo.step === 1 && attack.currentAttack === 'light' &&
    attack.attackState === 'active' && attack.attackHasHit
}
