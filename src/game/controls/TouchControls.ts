import Phaser from 'phaser'

export type PlayerId = 'playerOne' | 'playerTwo'
type Action = 'left' | 'right' | 'attack' | 'restart'

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
}

const COMBAT_BUTTONS: Array<{ player: PlayerId; action: Action; x: number; width: number }> = [
  { player: 'playerOne', action: 'left', x: 100, width: 100 },
  { player: 'playerOne', action: 'right', x: 218, width: 100 },
  { player: 'playerOne', action: 'attack', x: 368, width: 112 },
  { player: 'playerTwo', action: 'attack', x: 912, width: 112 },
  { player: 'playerTwo', action: 'left', x: 1062, width: 100 },
  { player: 'playerTwo', action: 'right', x: 1180, width: 100 },
]

export class TouchControls {
  private readonly buttons: TouchButton[]
  private readonly restartButton: TouchButton
  private readonly pendingAttack: Record<PlayerId, boolean> = { playerOne: false, playerTwo: false }
  private pendingRestart = false
  private presentation = ''

  constructor(private readonly scene: Phaser.Scene) {
    this.buttons = COMBAT_BUTTONS.map(({ player, action, x, width }) =>
      this.addButton(x, 630, width, action === 'attack' ? 112 : 100, action, player),
    )
    this.restartButton = this.addButton(640, 470, 260, 100, 'restart')
    this.scene.input.on('pointerup', this.releasePointer)
    this.scene.input.on('pointerupoutside', this.releasePointer)
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
    for (const button of this.buttons) this.setActive(button, next === 'combat')
    this.setActive(this.restartButton, next === 'restart')
  }

  isHeld(player: PlayerId, action: 'left' | 'right'): boolean {
    return this.buttons.some(button =>
      button.player === player && button.action === action && button.pointers.size > 0,
    )
  }

  consumeAttack(player: PlayerId): boolean {
    const pressed = this.pendingAttack[player]
    this.pendingAttack[player] = false
    return pressed
  }

  consumeRestart(): boolean {
    const pressed = this.pendingRestart
    this.pendingRestart = false
    return pressed
  }

  clear = (): void => {
    this.pendingAttack.playerOne = false
    this.pendingAttack.playerTwo = false
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
    for (const button of [...this.buttons, this.restartButton]) {
      if (!button.pointers.delete(pointer.id)) continue
      this.drawButton(button)
    }
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
    const caption = action === 'restart'
      ? this.scene.add.text(x, y, 'RESTART', {
          fontFamily: 'Georgia, serif', fontSize: '30px', color: '#e7ddc9',
        }).setOrigin(0.5).setDepth(10).setScrollFactor(0)
      : undefined
    const button: TouchButton = {
      player, action, graphic, zone, caption, pointers: new Set(), active: false, width, height,
    }
    this.drawButton(button)
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!button.active || button.pointers.has(pointer.id)) return
      button.pointers.add(pointer.id)
      if (action === 'attack' && player) this.pendingAttack[player] = true
      if (action === 'restart') this.pendingRestart = true
      this.drawButton(button)
    })
    zone.on('pointerout', (pointer: Phaser.Input.Pointer) => {
      if (button.pointers.delete(pointer.id)) this.drawButton(button)
    })
    return button
  }

  private drawButton(button: TouchButton): void {
    const pressed = button.pointers.size > 0
    const { graphic, width, height, action } = button
    graphic.clear()
    graphic.fillStyle(0x191d20, pressed ? 0.8 : 0.45)
    graphic.lineStyle(pressed ? 3 : 2, 0x9a7851, pressed ? 0.95 : 0.65)
    if (action === 'attack') {
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
    } else {
      graphic.lineBetween(-20, 22, 19, -20)
      graphic.lineBetween(-21, 12, -10, 23)
    }
  }

  private destroy(): void {
    this.clear()
    this.scene.input.off('pointerup', this.releasePointer)
    this.scene.input.off('pointerupoutside', this.releasePointer)
    this.scene.input.off('gameout', this.clear)
    window.removeEventListener('blur', this.clear)
    document.removeEventListener('visibilitychange', this.clearWhenHidden)
  }
}
