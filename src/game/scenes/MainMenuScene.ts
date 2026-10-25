import Phaser from 'phaser'
import desktopUrl from '../../assets/menu/corridor-desktop.webp'
import mobileUrl from '../../assets/menu/corridor-mobile.webp'
import atlasUrl from '../../assets/menu/buttons-atlas.webp'
import atlasData from '../../assets/menu/buttons-atlas.json'
import { MENU_OPTIONS, MenuSelection, menuLayout } from '../menu/menuModel'
import { MENU_MOTION, MenuMotion } from '../menu/menuMotion'
import type { GameMode } from '../controls/combatInput'
import { getAdaptiveViewportWidth, VIEWPORT_HEIGHT } from '../world/combatWorld'

export class MainMenuScene extends Phaser.Scene {
  private selection = new MenuSelection()
  private background!: Phaser.GameObjects.Image
  private buttons: Array<{
    image: Phaser.GameObjects.Image; previous: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Text; focus: Phaser.GameObjects.Polygon;
    frame: string; fadeMs: number;
  }> = []
  private motion = new MenuMotion(true)
  private motionPreference?: MediaQueryList
  private pendingMode: GameMode | null = null
  private transitionStarted = false
  private motionResumePending = false
  private notice!: Phaser.GameObjects.Text
  private layout?: ReturnType<typeof menuLayout>
  private observer?: ResizeObserver
  private blocked = false
  private portrait = false

  constructor() { super('MainMenuScene') }

  preload(): void {
    // One variant per game instance, shared by all future visits to this scene.
    if (!this.textures.exists('us39.corridor')) {
      this.load.image('us39.corridor', window.matchMedia('(any-pointer: coarse)').matches ? mobileUrl : desktopUrl)
    }
    if (!this.textures.exists('us39.buttons')) this.load.atlas('us39.buttons', atlasUrl, atlasData)
  }

  create(): void {
    this.selection = new MenuSelection()
    this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.motion = new MenuMotion(this.motionPreference.matches)
    this.pendingMode = null
    this.transitionStarted = false
    this.motionResumePending = false
    this.input.enabled = true
    this.blocked = document.hidden || !document.hasFocus()
    this.portrait = window.matchMedia('(any-pointer: coarse)').matches && window.matchMedia('(orientation: portrait)').matches
    this.buttons = []
    this.background = this.add.image(0, 0, 'us39.corridor').setOrigin(0)
    this.cameras.main.setBackgroundColor('#080f1c')
    for (const option of MENU_OPTIONS) {
      const image = this.add.image(0, 0, 'us39.buttons', 'neutral')
      const previous = this.add.image(0, 0, 'us39.buttons', 'neutral').setVisible(false)
      // Follow the atlas body's chamfered rim; retain this outline over pressed.
      const focus = this.add.polygon(0, 0, [
        12, 0, 468, 0, 480, 12, 480, 84,
        468, 96, 12, 96, 0, 84, 0, 12,
      ], 0, 0).setStrokeStyle(2, 0xf3d49a)
      const label = this.add.text(0, 0, option.label, {
        fontFamily: 'Georgia, serif', color: '#f4e6cb', align: 'center',
      }).setOrigin(0.5)
      this.buttons.push({ image, previous, label, focus, frame: 'neutral', fadeMs: MENU_MOTION.focusMs })
    }
    // No title asset/text: this upper layout area is reserved for the approved logo.
    this.notice = this.add.text(0, 0, 'PLAYER 2 REQUIRES A KEYBOARD', {
      fontFamily: 'Georgia, serif', color: '#f4e6cb', align: 'center',
    }).setOrigin(0.5)
    this.input.keyboard?.on('keydown', this.keyDown)
    this.input.keyboard?.on('keyup', this.keyUp)
    this.input.on('pointerdown', this.pointerDown)
    this.input.on('pointerup', this.pointerUp)
    this.input.on('pointermove', this.pointerMove)
    this.input.on('pointerupoutside', this.cancel)
    this.input.on('pointercancel', this.cancel)
    window.addEventListener('blur', this.blur)
    window.addEventListener('focus', this.focus)
    document.addEventListener('visibilitychange', this.visibility)
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resize, this)
    const parent = this.game.canvas.parentElement
    if (parent) {
      this.observer = new ResizeObserver(() => {
        const bounds = parent.getBoundingClientRect()
        if (bounds.width > 0 && bounds.height > 0 &&
            (bounds.width !== this.scale.parentSize.width || bounds.height !== this.scale.parentSize.height)) {
          this.scale.setParentSize(bounds.width, bounds.height)
        }
      })
      this.observer.observe(parent)
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this)
    this.resize()
    this.applyMotion(0)
  }

  update(_time = 0, delta = 0): void {
    const portrait = window.matchMedia('(any-pointer: coarse)').matches && window.matchMedia('(orientation: portrait)').matches
    if (portrait !== this.portrait) { this.portrait = portrait; this.motionResumePending = true; this.cancel() }
    if (this.blocked || this.portrait) return
    if (this.motionResumePending) { delta = 0; this.motionResumePending = false }
    this.motion.setReduced(this.motionPreference?.matches ?? false)
    if (!this.pendingMode) {
      const mode = this.selection.consume()
      if (mode) {
        this.pendingMode = mode
        this.motion.select()
        // None of this update's elapsed time belongs to the newly selected exit.
        delta = 0
      }
    }
    this.motion.advance(delta)
    this.renderSelection()
    this.applyMotion(delta)
    if (this.pendingMode && this.motion.phase === 'complete' && this.selection.released && !this.transitionStarted) {
      this.transitionStarted = true
      this.input.enabled = false
      this.input.keyboard?.resetKeys()
      this.scene.start('CombatScene', { mode: this.pendingMode, menuReveal: !this.motion.reduced })
    }
  }

  private optionAt(x: number, y: number): number | null {
    if (!this.layout) return null
    const l = this.layout
    const index = l.ys.findIndex(buttonY => Math.abs(x - l.x) <= l.hitWidth / 2 && Math.abs(y - buttonY) <= l.hitHeight / 2)
    return index < 0 ? null : index
  }

  private keyDown = (event: KeyboardEvent): void => {
    if (this.blocked || this.portrait) return
    if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key)) event.preventDefault()
    this.selection.keyDown(event.key, event.repeat, event.shiftKey)
    this.motion.showControls()
    this.renderSelection()
  }
  private keyUp = (event: KeyboardEvent): void => { this.selection.keyUp(event.key); this.renderSelection() }
  private pointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!this.blocked && !this.portrait) this.selection.pointerDown(pointer.id, this.optionAt(pointer.x, pointer.y))
    this.motion.showControls()
    this.renderSelection()
  }
  private pointerUp = (pointer: Phaser.Input.Pointer): void => {
    // Native touchcancel arrives as pointerup in Phaser. Invalidate the whole
    // pending gesture so another finger's release cannot complete its selection.
    if (pointer.wasCanceled === true) {
      this.cancel()
      return
    }
    this.selection.pointerUp(pointer.id, this.optionAt(pointer.x, pointer.y))
    this.renderSelection()
  }
  private pointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.blocked && !this.portrait) this.selection.hover(this.optionAt(pointer.x, pointer.y))
    this.renderSelection()
  }
  private cancel = (): void => {
    if (this.pendingMode && !this.transitionStarted) {
      const selected = this.selection.selected
      this.selection = new MenuSelection()
      this.selection.selected = selected
      this.pendingMode = null
      this.motion.cancelExit()
    }
    this.selection.cancel()
    this.renderSelection()
  }
  private blur = (): void => { this.blocked = true; this.motionResumePending = true; this.cancel() }
  private focus = (): void => { this.blocked = document.hidden; this.motionResumePending = true; this.cancel() }
  private visibility = (): void => { this.blocked = document.hidden || !document.hasFocus(); this.motionResumePending = true; this.cancel() }

  private renderSelection(): void {
    this.buttons.forEach((button, i) => {
      const focused = this.selection.selected === i
      const pressed = focused && (this.selection.pressed || this.pendingMode !== null)
      const frame = focused ? pressed ? 'pressed' : 'focused' : 'neutral'
      if (frame !== button.frame) {
        button.previous.setFrame(button.frame)
        button.fadeMs = pressed || this.motion.reduced ? MENU_MOTION.focusMs : 0
        button.frame = frame
        button.image.setFrame(frame)
      }
      // Press/reduced-motion feedback never waits for an opacity transition.
      if (pressed || this.motion.reduced) button.fadeMs = MENU_MOTION.focusMs
      button.previous.setVisible(button.fadeMs < MENU_MOTION.focusMs)
      button.focus.setVisible(focused)
    })
    this.applyMotion(0)
  }

  private applyMotion(delta: number): void {
    this.background?.setAlpha(this.motion.backgroundAlpha)
    this.notice?.setAlpha(this.motion.controlsAlpha)
    for (const button of this.buttons) {
      button.fadeMs = Math.min(MENU_MOTION.focusMs, button.fadeMs + Math.max(0, Number.isFinite(delta) ? delta : 0))
      const alpha = this.motion.controlsAlpha
      button.image.setAlpha(alpha)
      button.previous.setAlpha(alpha * (1 - button.fadeMs / MENU_MOTION.focusMs))
      button.label.setAlpha(alpha)
      button.focus.setAlpha(alpha)
    }
  }

  private resize(): void {
    const parent = this.scale.parentSize
    const width = getAdaptiveViewportWidth(parent.width, parent.height)
    if (this.scale.width !== width || this.scale.height !== VIEWPORT_HEIGHT) {
      this.scale.setGameSize(width, VIEWPORT_HEIGHT)
      return
    }
    this.cancel()
    const height = VIEWPORT_HEIGHT
    const cssScale = Math.min(parent.width / width, parent.height / height)
    const canvas = this.game.canvas.getBoundingClientRect()
    const app = this.game.canvas.closest('.app')
    const bounds = app?.getBoundingClientRect()
    const style = app ? getComputedStyle(app) : null
    const inset = (edge: string) => parseFloat(style?.getPropertyValue(`--combat-safe-${edge}`) ?? '') || 0
    const safe = bounds && canvas.width > 0 ? {
      left: Math.max(0, inset('left') - (canvas.left - bounds.left)) * width / canvas.width,
      right: Math.max(0, inset('right') - (bounds.right - canvas.right)) * width / canvas.width,
      top: Math.max(0, inset('top') - (canvas.top - bounds.top)) * height / canvas.height,
      bottom: Math.max(0, inset('bottom') - (bounds.bottom - canvas.bottom)) * height / canvas.height,
    } : { left: 0, right: 0, top: 0, bottom: 0 }
    this.layout = menuLayout(width, height, cssScale, safe)
    const source = this.background.texture.getSourceImage() as HTMLImageElement
    const cover = Math.max(width / source.width, height / source.height)
    this.background.setDisplaySize(source.width * cover, source.height * cover)
      .setPosition((width - source.width * cover) / 2, (height - source.height * cover) / 2)
    const l = this.layout
    this.buttons.forEach((button, i) => {
      button.image.setPosition(l.x, l.ys[i]).setDisplaySize(l.width, l.height)
      button.previous.setPosition(l.x, l.ys[i]).setDisplaySize(l.width, l.height)
      button.label.setPosition(l.x, l.ys[i]).setFontSize(l.fontSize)
      const artScale = l.width / 512
      button.focus.setPosition(l.x, l.ys[i]).setScale(artScale)
        .setStrokeStyle(2 / Math.max(0.01, cssScale) / artScale, 0xf3d49a)
    })
    this.notice.setText(l.mobile ? 'PLAYER 2 REQUIRES\nA KEYBOARD' : 'PLAYER 2 REQUIRES A KEYBOARD')
    this.notice.setPosition(l.x, l.noticeY).setFontSize(l.noticeSize)
      .setWordWrapWidth(l.hitWidth, true)
  }

  private cleanup(): void {
    this.motion.dispose()
    this.pendingMode = null
    this.transitionStarted = true
    this.selection.cancel()
    this.input.off('pointerdown', this.pointerDown)
    this.input.off('pointerup', this.pointerUp)
    this.input.off('pointermove', this.pointerMove)
    this.input.off('pointerupoutside', this.cancel)
    this.input.off('pointercancel', this.cancel)
    this.input.keyboard?.off('keydown', this.keyDown)
    this.input.keyboard?.off('keyup', this.keyUp)
    window.removeEventListener('blur', this.blur)
    window.removeEventListener('focus', this.focus)
    document.removeEventListener('visibilitychange', this.visibility)
    this.scale.off(Phaser.Scale.Events.RESIZE, this.resize, this)
    this.observer?.disconnect()
    this.observer = undefined
  }
}
