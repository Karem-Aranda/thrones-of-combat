export const MENU_MOTION = Object.freeze({
  entranceMs: 250, controlsMs: 160, focusMs: 100,
  exitMs: 140, pressedHoldMs: 40, combatRevealMs: 120,
  midnight: [8, 15, 28] as const,
})

/** Presentation time only. No timers/callbacks can outlive the scene. */
export class MenuMotion {
  phase: 'entrance' | 'ready' | 'outgoing' | 'complete' | 'disposed'
  backgroundAlpha: number
  controlsAlpha: number
  private elapsed = 0
  private exitBackground = 1
  private exitControls = 1
  reduced: boolean

  constructor(reduced: boolean) {
    this.reduced = reduced
    this.phase = reduced ? 'ready' : 'entrance'
    this.backgroundAlpha = this.controlsAlpha = reduced ? 1 : 0
  }

  showControls(): void {
    if (this.phase === 'entrance' || this.phase === 'ready') this.controlsAlpha = 1
  }

  select(): void {
    if (this.phase !== 'entrance' && this.phase !== 'ready') return
    this.elapsed = 0
    this.controlsAlpha = 1
    this.exitBackground = this.backgroundAlpha
    this.exitControls = this.controlsAlpha
    this.phase = this.reduced ? 'complete' : 'outgoing'
    if (this.reduced) this.backgroundAlpha = this.controlsAlpha = 0
  }

  advance(delta: number): void {
    if (!Number.isFinite(delta) || delta < 0) return
    this.elapsed += delta
    if (this.phase === 'entrance') {
      this.backgroundAlpha = Math.min(1, this.elapsed / MENU_MOTION.entranceMs)
      this.controlsAlpha = Math.max(this.controlsAlpha, Math.min(1, this.elapsed / MENU_MOTION.controlsMs))
      if (this.elapsed >= MENU_MOTION.entranceMs) this.phase = 'ready'
    } else if (this.phase === 'outgoing') {
      const progress = Math.min(1, Math.max(0, this.elapsed - MENU_MOTION.pressedHoldMs) /
        (MENU_MOTION.exitMs - MENU_MOTION.pressedHoldMs))
      this.backgroundAlpha = this.exitBackground * (1 - progress)
      this.controlsAlpha = this.exitControls * (1 - progress)
      if (this.elapsed >= MENU_MOTION.exitMs) this.phase = 'complete'
    }
  }

  cancelExit(): void {
    if (this.phase !== 'outgoing' && this.phase !== 'complete') return
    this.phase = 'ready'
    this.backgroundAlpha = this.controlsAlpha = 1
    this.elapsed = 0
  }

  setReduced(reduced: boolean): void {
    this.reduced = reduced
    if (!reduced) return // Never replay entrance when preferences change.
    if (this.phase === 'entrance') {
      this.phase = 'ready'
      this.backgroundAlpha = this.controlsAlpha = 1
    } else if (this.phase === 'outgoing') {
      this.phase = 'complete'
      this.backgroundAlpha = this.controlsAlpha = 0
    }
  }

  dispose(): void { this.phase = 'disposed' }
}
