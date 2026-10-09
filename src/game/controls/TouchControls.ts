import Phaser from 'phaser'
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from '../world/combatWorld'
import { type AttackId } from '../combat/attackDefinitions'

export type PlayerId = 'playerOne' | 'playerTwo'
export interface ScreenInsets {
  top: number
  right: number
  bottom: number
  left: number
}
type Action = 'left' | 'right' | 'jump' | 'block' | AttackId | 'restart'

const JOYSTICK_RADIUS = 76.8
const JOYSTICK_THUMB_RADIUS = 28.8
// Reserve full thumb travel plus its radius and the base's 1px half-stroke.
const JOYSTICK_EDGE_MARGIN = JOYSTICK_RADIUS + JOYSTICK_THUMB_RADIUS + 1
const JOYSTICK_DEAD_ZONE = 14
const ACTION_BUTTON_SIZE = 144
const ACTION_BUTTON_GAP = 28
const ACTION_MARGIN = 36
const ACTION_STEP = ACTION_BUTTON_SIZE + ACTION_BUTTON_GAP
const ACTION_RIGHT_X = VIEWPORT_WIDTH - ACTION_MARGIN - ACTION_BUTTON_SIZE / 2
const ACTION_BOTTOM_Y = VIEWPORT_HEIGHT - ACTION_MARGIN - ACTION_BUTTON_SIZE / 2

interface TouchButton {
  player?: PlayerId
  action: Action
  graphic: Phaser.GameObjects.Graphics
  zone: Phaser.GameObjects.Zone
  caption?: Phaser.GameObjects.Text
  pointers: Set<number>
  active: boolean
  width: number
  height: number
  baseX: number
  baseY: number
}

const COMBAT_BUTTONS: Array<{ player: PlayerId; action: Action; x: number; width: number; y?: number }> = [
  { player: 'playerOne', action: 'jump', x: ACTION_RIGHT_X - ACTION_STEP, width: ACTION_BUTTON_SIZE, y: ACTION_BOTTOM_Y - ACTION_STEP },
  { player: 'playerOne', action: 'block', x: ACTION_RIGHT_X, width: ACTION_BUTTON_SIZE, y: ACTION_BOTTOM_Y - ACTION_STEP },
  { player: 'playerOne', action: 'light', x: ACTION_RIGHT_X - ACTION_STEP, width: ACTION_BUTTON_SIZE, y: ACTION_BOTTOM_Y },
  { player: 'playerOne', action: 'heavy', x: ACTION_RIGHT_X, width: ACTION_BUTTON_SIZE, y: ACTION_BOTTOM_Y },
  // Retain P2's input definitions for future use; this mobile MVP never enables them.
  { player: 'playerTwo', action: 'jump', x: 760, width: 100 },
  { player: 'playerTwo', action: 'block', x: 760, width: 100, y: 500 },
  { player: 'playerTwo', action: 'light', x: 912, width: 112 },
  { player: 'playerTwo', action: 'heavy', x: 912, width: 112, y: 500 },
  { player: 'playerTwo', action: 'left', x: 1062, width: 100 },
  { player: 'playerTwo', action: 'right', x: 1180, width: 100 },
]

export class TouchControls {
  private readonly buttons: TouchButton[]
  private readonly restartButton: TouchButton
  private readonly pendingAttack: Record<PlayerId, Record<AttackId, boolean>> = {
    playerOne: { light: false, heavy: false }, playerTwo: { light: false, heavy: false },
  }
  private readonly pendingJump: Record<PlayerId, boolean> = { playerOne: false, playerTwo: false }
  private pendingRestart = false
  private presentation = ''
  private viewportWidth = VIEWPORT_WIDTH
  private viewportHeight = VIEWPORT_HEIGHT
  private safeInsets: ScreenInsets = { top: 0, right: 0, bottom: 0, left: 0 }
  private readonly joystickBase: Phaser.GameObjects.Arc
  private readonly joystickThumb: Phaser.GameObjects.Arc
  private joystickPointerId: number | null = null
  private joystickOrigin = { x: 0, y: 0 }
  private joystickDirection: -1 | 0 | 1 = 0

  constructor(private readonly scene: Phaser.Scene) {
    this.buttons = COMBAT_BUTTONS.map(({ player, action, x, width, y = 630 }) =>
      this.addButton(x, y, width, player === 'playerOne' ? ACTION_BUTTON_SIZE :
        action === 'light' || action === 'heavy' ? 112 : 100, action, player),
    )
    this.restartButton = this.addButton(640, 470, 260, 100, 'restart')
    this.joystickBase = this.scene.add.circle(0, 0, JOYSTICK_RADIUS, 0x191d20, 0.45)
      .setStrokeStyle(2, 0x9a7851, 0.65).setDepth(10).setScrollFactor(0).setVisible(false)
    this.joystickThumb = this.scene.add.circle(0, 0, JOYSTICK_THUMB_RADIUS, 0xd7d1c5, 0.75)
      .setDepth(11).setScrollFactor(0).setVisible(false)
    this.scene.input.on('pointerdown', this.startJoystick)
    this.scene.input.on('pointermove', this.moveJoystick)
    this.scene.input.on('pointerup', this.releasePointer)
    this.scene.input.on('pointerupoutside', this.releasePointer)
    this.scene.input.on('pointercancel', this.releasePointer)
    this.scene.input.on('gameout', this.clear)
    window.addEventListener('blur', this.clear)
    document.addEventListener('visibilitychange', this.clearWhenHidden)
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this)
    this.setPresentation(false, false, false)
  }

  setPresentation(touchCapable: boolean, portrait: boolean, matchEnded: boolean): void {
    const next = !touchCapable || portrait ? 'hidden' : matchEnded ? 'restart' : 'combat'
    if (next === this.presentation) return
    this.clear()
    this.presentation = next
    for (const button of this.buttons) this.setActive(button, next === 'combat' && button.player === 'playerOne')
    this.setActive(this.restartButton, next === 'restart')
  }

  setViewport(width: number, height: number, safeInsets: ScreenInsets): void {
    if (width !== this.viewportWidth || height !== this.viewportHeight ||
        Object.keys(safeInsets).some(edge =>
          safeInsets[edge as keyof ScreenInsets] !== this.safeInsets[edge as keyof ScreenInsets])) {
      this.clear()
    }
    this.viewportWidth = width
    this.viewportHeight = height
    this.safeInsets = safeInsets
    for (const button of [...this.buttons, this.restartButton]) this.positionButton(button)
  }

  isHeld(player: PlayerId, action: 'left' | 'right' | 'block'): boolean {
    if (player === 'playerOne' && action !== 'block') {
      return this.joystickDirection === (action === 'left' ? -1 : 1)
    }
    return this.buttons.some(button =>
      button.player === player && button.action === action && button.pointers.size > 0,
    )
  }

  consumeAttack(player: PlayerId, attack: AttackId): boolean {
    const pressed = this.pendingAttack[player][attack]
    this.pendingAttack[player][attack] = false
    return pressed
  }

  consumeJump(player: PlayerId): boolean {
    const pressed = this.pendingJump[player]
    this.pendingJump[player] = false
    return pressed
  }

  consumeRestart(): boolean {
    const pressed = this.pendingRestart
    this.pendingRestart = false
    return pressed
  }

  clear = (): void => {
    this.releaseJoystick()
    for (const pending of Object.values(this.pendingAttack)) {
      pending.light = false
      pending.heavy = false
    }
    this.pendingJump.playerOne = false
    this.pendingJump.playerTwo = false
    this.pendingRestart = false
    for (const button of [...this.buttons, this.restartButton]) {
      if (button.pointers.size === 0) continue
      button.pointers.clear()
      this.drawButton(button)
    }
  }

  private clearWhenHidden = (): void => {
    if (document.hidden) this.clear()
  }

  private releasePointer = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.id === this.joystickPointerId) this.releaseJoystick()
    for (const button of [...this.buttons, this.restartButton]) {
      if (!button.pointers.delete(pointer.id)) continue
      this.drawButton(button)
    }
  }

  private startJoystick = (pointer: Phaser.Input.Pointer): void => {
    // pointer.x/y are canvas-local screen coordinates, not scrolling worldX/Y.
    const { x, y } = pointer
    if (this.presentation !== 'combat' || this.joystickPointerId !== null ||
        !Number.isFinite(x) || !Number.isFinite(y) ||
        x < 0 || x >= this.viewportWidth / 2 || y < 0 || y > this.viewportHeight) return
    if (this.buttons.some(button => button.active && (
      button.pointers.has(pointer.id) ||
      (Math.abs(x - button.zone.x) <= button.width / 2 && Math.abs(y - button.zone.y) <= button.height / 2)
    ))) return

    this.joystickPointerId = pointer.id
    this.joystickOrigin = { x, y }
    this.joystickDirection = 0
    // Clamp only presentation near edges; input keeps the original touch origin.
    const visualX = Phaser.Math.Clamp(x, this.safeInsets.left + JOYSTICK_EDGE_MARGIN,
      this.viewportWidth / 2 - JOYSTICK_EDGE_MARGIN)
    const visualY = Phaser.Math.Clamp(y, this.safeInsets.top + JOYSTICK_EDGE_MARGIN,
      this.viewportHeight - this.safeInsets.bottom - JOYSTICK_EDGE_MARGIN)
    this.joystickBase.setPosition(visualX, visualY).setVisible(true)
    this.joystickThumb.setPosition(visualX, visualY).setVisible(true)
  }

  private moveJoystick = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.id !== this.joystickPointerId || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return
    const dx = pointer.x - this.joystickOrigin.x
    const dy = pointer.y - this.joystickOrigin.y
    this.joystickDirection = Math.abs(dx) <= JOYSTICK_DEAD_ZONE ? 0 : dx < 0 ? -1 : 1
    const distance = Math.hypot(dx, dy)
    const fraction = distance > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / distance : 1
    // Only the artwork is radius-limited, relative to the edge-safe visual base.
    // Input follows the original owner/origin anywhere on the canvas.
    this.joystickThumb.setPosition(
      this.joystickBase.x + dx * fraction,
      this.joystickBase.y + dy * fraction,
    )
  }

  private releaseJoystick(): void {
    this.joystickPointerId = null
    this.joystickDirection = 0
    this.joystickBase?.setVisible(false)
    this.joystickThumb?.setVisible(false)
  }

  private setActive(button: TouchButton, active: boolean): void {
    button.active = active
    button.graphic.setVisible(active)
    button.zone.setVisible(active)
    if (button.zone.input) button.zone.input.enabled = active
    button.caption?.setVisible(active)
  }

  private addButton(
    x: number, y: number, width: number, height: number, action: Action, player?: PlayerId,
  ): TouchButton {
    const graphic = this.scene.add.graphics().setPosition(x, y).setDepth(10).setScrollFactor(0)
    const zone = this.scene.add.zone(x, y, width, height).setDepth(11).setScrollFactor(0).setInteractive()
    const caption = player === 'playerOne' || action === 'restart' || action === 'light' || action === 'heavy' || action === 'block'
      ? this.scene.add.text(x, y, action.toUpperCase(), {
          fontFamily: 'Georgia, serif', fontSize: action === 'restart' ? '30px' : player === 'playerOne' ? '24px' : '18px', color: '#e7ddc9',
        }).setOrigin(0.5).setDepth(10).setScrollFactor(0)
      : undefined
    const button: TouchButton = {
      player, action, graphic, zone, caption, pointers: new Set(), active: false, width, height,
      baseX: x, baseY: y,
    }
    this.positionButton(button)
    this.drawButton(button)
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!button.active || button.pointers.has(pointer.id) || pointer.id === this.joystickPointerId) return
      button.pointers.add(pointer.id)
      if ((action === 'light' || action === 'heavy') && player) this.pendingAttack[player][action] = true
      if (action === 'jump' && player) this.pendingJump[player] = true
      if (action === 'restart') this.pendingRestart = true
      this.drawButton(button)
    })
    zone.on('pointerout', (pointer: Phaser.Input.Pointer) => {
      if (button.pointers.delete(pointer.id)) this.drawButton(button)
    })
    return button
  }

  private positionButton(button: TouchButton): void {
    // P1's two-by-two action cluster stays bottom/right anchored, inside safe areas.
    const sideMargin = button.player === 'playerOne' ? ACTION_MARGIN : 50
    const bottomMargin = button.player === 'playerOne' ? ACTION_MARGIN : VIEWPORT_HEIGHT - 630 - 112 / 2
    const x = button.action === 'restart'
      ? (this.viewportWidth + this.safeInsets.left - this.safeInsets.right) / 2
      : this.viewportWidth - (VIEWPORT_WIDTH - button.baseX) - Math.max(0, this.safeInsets.right - sideMargin)
    const y = this.viewportHeight - (VIEWPORT_HEIGHT - button.baseY) -
      Math.max(0, this.safeInsets.bottom - bottomMargin)
    button.graphic.setPosition(x, y)
    button.zone.setPosition(x, y)
    button.caption?.setPosition(x, button.action === 'restart' ? y : y + button.height / 2 - 14)
  }

  private drawButton(button: TouchButton): void {
    const pressed = button.pointers.size > 0
    const { graphic, width, height, action } = button
    graphic.clear()
    graphic.fillStyle(0x191d20, pressed ? 0.8 : 0.45)
    graphic.lineStyle(pressed ? 3 : 2, 0x9a7851, pressed ? 0.95 : 0.65)
    if (action === 'light' || action === 'heavy') {
      const inset = 18
      graphic.beginPath()
      graphic.moveTo(-width / 2 + inset, -height / 2)
      graphic.lineTo(width / 2 - inset, -height / 2)
      graphic.lineTo(width / 2, -height / 2 + inset)
      graphic.lineTo(width / 2, height / 2 - inset)
      graphic.lineTo(width / 2 - inset, height / 2)
      graphic.lineTo(-width / 2 + inset, height / 2)
      graphic.lineTo(-width / 2, height / 2 - inset)
      graphic.lineTo(-width / 2, -height / 2 + inset)
      graphic.closePath()
      graphic.fillPath()
      graphic.strokePath()
    } else {
      graphic.fillRoundedRect(-width / 2, -height / 2, width, height, 14)
      graphic.strokeRoundedRect(-width / 2, -height / 2, width, height, 14)
    }
    if (action === 'restart') return
    graphic.lineStyle(pressed ? 7 : 6, pressed ? 0xf3e7d1 : 0xd7d1c5, pressed ? 1 : 0.88)
    if (action === 'left') {
      graphic.lineBetween(12, -20, -12, 0)
      graphic.lineBetween(-12, 0, 12, 20)
    } else if (action === 'right') {
      graphic.lineBetween(-12, -20, 12, 0)
      graphic.lineBetween(12, 0, -12, 20)
    } else if (action === 'jump') {
      graphic.lineBetween(-20, 12, 0, -12)
      graphic.lineBetween(0, -12, 20, 12)
    } else {
      graphic.lineBetween(-20, 22, 19, -20)
      graphic.lineBetween(-21, 12, -10, 23)
      if (action === 'heavy') graphic.lineBetween(-8, 22, 28, -16)
    }
  }

  private destroy(): void {
    this.clear()
    this.scene.input.off('pointerdown', this.startJoystick)
    this.scene.input.off('pointermove', this.moveJoystick)
    this.scene.input.off('pointerup', this.releasePointer)
    this.scene.input.off('pointerupoutside', this.releasePointer)
    this.scene.input.off('pointercancel', this.releasePointer)
    this.scene.input.off('gameout', this.clear)
    window.removeEventListener('blur', this.clear)
    document.removeEventListener('visibilitychange', this.clearWhenHidden)
  }
}
