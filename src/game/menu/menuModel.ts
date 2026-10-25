import type { GameMode } from '../controls/combatInput'

export const MENU_OPTIONS: ReadonlyArray<{ label: string; mode: GameMode }> = [
  { label: 'FIGHT CPU', mode: 'single-player' },
  { label: 'LOCAL VERSUS', mode: 'local-versus' },
]

/** Selection is committed only after every participating input is released. */
export class MenuSelection {
  selected = 0
  pressed = false
  private keys = new Set<string>()
  private pointers = new Set<number>()
  private owner: number | null = null
  private activationKey: string | null = null
  private pending: GameMode | null = null
  private completed = false

  get released(): boolean { return this.keys.size === 0 && this.pointers.size === 0 }

  keyDown(key: string, repeat: boolean, shift = false): void {
    this.keys.add(key)
    if (repeat || this.pending || this.completed || this.owner !== null || this.activationKey) return
    if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Tab'].includes(key)) {
      const backwards = key === 'ArrowUp' || key === 'ArrowLeft' || (key === 'Tab' && shift)
      this.selected = (this.selected + (backwards ? -1 : 1) + MENU_OPTIONS.length) % MENU_OPTIONS.length
    } else if (key === 'Enter' || key === ' ') {
      this.activationKey = key
      this.pressed = true
    }
  }

  keyUp(key: string): void {
    this.keys.delete(key)
    if (key !== this.activationKey) return
    this.activationKey = null
    this.pressed = false
    if (!this.completed) this.pending = MENU_OPTIONS[this.selected].mode
  }

  pointerDown(id: number, option: number | null): void {
    this.pointers.add(id)
    if (option === null || this.owner !== null || this.activationKey || this.pending || this.completed) return
    this.owner = id
    this.selected = option
    this.pressed = true
  }

  pointerUp(id: number, option: number | null): void {
    this.pointers.delete(id)
    if (this.owner !== id) return
    this.owner = null
    this.pressed = false
    if (option === this.selected && !this.completed) this.pending = MENU_OPTIONS[this.selected].mode
  }

  hover(option: number | null): void {
    if (option !== null && !this.pressed && !this.pending && !this.completed) this.selected = option
  }

  cancel(): void {
    this.keys.clear()
    this.pointers.clear()
    this.owner = null
    this.activationKey = null
    this.pending = null
    this.pressed = false
  }

  consume(): GameMode | null {
    if (!this.pending || this.keys.size || this.pointers.size || this.completed) return null
    const mode = this.pending
    this.pending = null
    this.completed = true
    return mode
  }
}

export interface MenuInsets { left: number; right: number; top: number; bottom: number }

export function menuLayout(width: number, height: number, cssScale: number, safe: MenuInsets) {
  const scale = Math.max(0.01, cssScale)
  const usableWidth = width - safe.left - safe.right
  const usableHeight = height - safe.top - safe.bottom
  const mobile = height * scale <= 450
  // Reference artwork bounds, not texture bounds: desktop 376/1280;
  // landscape mobile 490/1844. The shared atlas body is 480x96 in a 512x128 frame.
  const visibleWidth = usableWidth * (mobile ? 490 / 1844 : 376 / 1280)
  const visibleHeight = visibleWidth / 5
  const frameWidth = visibleWidth * 512 / 480
  const hitHeight = Math.max(visibleHeight, 52 / scale)
  const x = safe.left + usableWidth * (mobile ? 410 / 1844 : 300 / 1280)
  const firstY = safe.top + usableHeight * (mobile ? 439 / 853 : 401.6 / 720)
  // Expand invisible targets, not artwork. Only increase spacing when needed
  // to keep those targets disjoint on the shortest supported landscapes.
  const secondY = firstY + Math.max(usableHeight * (mobile ? 118 / 853 : 94 / 720), hitHeight + 4 / scale)
  const noticeSize = Math.max(20, 12 / scale)
  const noticeY = Math.max(
    safe.top + usableHeight * (mobile ? 685 / 853 : 570 / 720),
    secondY + hitHeight / 2 + noticeSize * (mobile ? 1.5 : 1),
  )
  return {
    x, width: frameWidth, height: frameWidth / 4, visibleWidth, visibleHeight,
    hitWidth: Math.max(visibleWidth, 44 / scale), hitHeight,
    ys: [firstY, secondY], noticeY, mobile,
    fontSize: Math.max(26, 18 / scale), noticeSize,
  }
}
