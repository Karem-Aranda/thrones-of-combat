import type { AttackDefinition, AttackId, AttackState } from '../combat/attackDefinitions'
import { neutralFighterInput, type FighterInput } from '../controls/combatInput'

export type LyraDecisionState = 'approach' | 'attack' | 'defend' | 'retreat' | 'recovery'

export interface AIFighterObservation {
  readonly x: number
  readonly grounded: boolean
  readonly attackState: AttackState
  readonly currentAttack: AttackId | null
  readonly reactionState: 'neutral' | 'hitstun' | 'blockstun'
}

export interface LyraSnapshot {
  readonly self: AIFighterObservation
  readonly opponent: AIFighterObservation
  readonly matchActive: boolean
}

export interface LyraGeometry {
  readonly fighterWidth: number
  readonly worldWidth: number
  readonly attacks: Readonly<Record<AttackId, AttackDefinition>>
}

export const LYRA_AI_TIMING = Object.freeze({
  reactionMs: 200,
  attackCooldownMs: 1100,
  guardMs: 320,
  retreatMs: 260,
  rangeMargin: 16,
})

/** Local deterministic policy only. The combat scene still owns every consequence. */
export class LyraController {
  private readonly geometry: LyraGeometry
  private clockMs = 0
  private decisionDueMs: number = LYRA_AI_TIMING.reactionMs
  private attackDueMs = 0
  private stateUntilMs = 0
  private threatDueMs: number | null = null
  private retreatAfterAttack = false
  private attackCount = 0
  private decisionState: LyraDecisionState = 'recovery'

  constructor(geometry: LyraGeometry) { this.geometry = geometry }

  get state(): LyraDecisionState { return this.decisionState }

  reset(): void {
    this.clockMs = 0
    this.decisionDueMs = LYRA_AI_TIMING.reactionMs
    this.attackDueMs = 0
    this.stateUntilMs = 0
    this.threatDueMs = null
    this.retreatAfterAttack = false
    this.attackCount = 0
    this.decisionState = 'recovery'
  }

  update(snapshot: LyraSnapshot, deltaMs: number): FighterInput {
    const input = neutralFighterInput()
    if (!snapshot.matchActive) {
      this.reset()
      return input
    }
    if (!Number.isFinite(deltaMs) || deltaMs < 0) return input
    this.clockMs += deltaMs
    const { self, opponent } = snapshot
    const distance = Math.abs(opponent.x - self.x)
    const toward = opponent.x < self.x ? -1 : 1

    if (!self.grounded || self.reactionState === 'hitstun') {
      this.recover()
      this.retreatAfterAttack = false
      return input
    }
    if (self.attackState !== 'idle') {
      this.decisionState = 'recovery'
      this.threatDueMs = null
      return input
    }

    // React to an observable attack, never a human's pending input edge.
    const threat = opponent.grounded && opponent.currentAttack !== null &&
      (opponent.attackState === 'startup' || opponent.attackState === 'active') &&
      distance <= this.geometry.fighterWidth + this.geometry.attacks[opponent.currentAttack].reach
    if (!threat) this.threatDueMs = null
    else this.threatDueMs ??= this.clockMs + LYRA_AI_TIMING.reactionMs

    if (this.decisionState === 'defend') {
      if (threat && this.clockMs < this.stateUntilMs) {
        input.blockHeld = true
        return input
      }
      // A continuing threat must earn another reaction delay, not permanent guard.
      this.threatDueMs = threat ? this.clockMs + LYRA_AI_TIMING.reactionMs : null
      this.startRetreat()
    }
    if (self.reactionState !== 'neutral') {
      this.recover()
      return input
    }
    if (this.threatDueMs !== null && this.clockMs >= this.threatDueMs &&
        this.clockMs >= this.decisionDueMs) {
      this.decisionState = 'defend'
      this.stateUntilMs = this.clockMs + LYRA_AI_TIMING.guardMs
      this.retreatAfterAttack = false
      input.blockHeld = true
      return input
    }
    // Do not turn a pending defensive observation into an instant counterattack.
    if (threat && this.threatDueMs !== null && this.clockMs < this.threatDueMs) return input
    if (this.clockMs < this.decisionDueMs) return input

    if (this.retreatAfterAttack) {
      this.retreatAfterAttack = false
      this.startRetreat()
    }
    if (this.decisionState === 'retreat') {
      if (this.clockMs < this.stateUntilMs && this.move(input, self.x, -toward)) return input
      this.recover()
      return input
    }

    const attack: AttackId = this.attackCount % 2 === 0 ? 'light' : 'heavy'
    const range = this.geometry.fighterWidth + this.geometry.attacks[attack].reach
    // Hysteresis: approach to an interior margin; do not jitter at exact reach.
    if (distance > range ||
        (this.decisionState === 'approach' && distance > range - LYRA_AI_TIMING.rangeMargin)) {
      this.decisionState = 'approach'
      this.move(input, self.x, toward)
      return input
    }
    if (!opponent.grounded || this.clockMs < this.attackDueMs) {
      this.decisionState = 'recovery'
      return input
    }

    this.decisionState = 'attack'
    input.lightPressed = attack === 'light'
    input.heavyPressed = attack === 'heavy'
    this.attackCount += 1
    this.attackDueMs = this.clockMs + LYRA_AI_TIMING.attackCooldownMs
    this.decisionDueMs = this.clockMs + LYRA_AI_TIMING.reactionMs
    this.retreatAfterAttack = true
    return input
  }

  private recover(): void {
    this.decisionState = 'recovery'
    this.decisionDueMs = this.clockMs + LYRA_AI_TIMING.reactionMs
    this.threatDueMs = null
  }

  private startRetreat(): void {
    this.decisionState = 'retreat'
    this.stateUntilMs = this.clockMs + LYRA_AI_TIMING.retreatMs
  }

  private move(input: FighterInput, x: number, direction: number): boolean {
    const half = this.geometry.fighterWidth / 2
    if ((direction < 0 && x <= half) || (direction > 0 && x >= this.geometry.worldWidth - half)) return false
    input.leftHeld = direction < 0
    input.rightHeld = direction > 0
    return true
  }
}
