import Phaser from 'phaser'

const ARENA_WIDTH = 1280
const ARENA_HEIGHT = 720
const GROUND_Y = 600
const GROUND_HEIGHT = 80
const GROUND_TOP = GROUND_Y - GROUND_HEIGHT / 2
// Measured source-pixel landmarks in the 1280×720 arena layers.
const NORTHWARD_WALL_BASE_Y = 579
const NORTHWARD_COURTYARD_SURFACE_Y = 536
const FIGHTER_WIDTH = 72
const FIGHTER_HEIGHT = 140
// Static asset landmarks (source pixels), not gameplay dimensions.
const JON_SNOW_TEXTURE_HEIGHT = 1374
const JON_SNOW_HEAD_Y = 128
const JON_SNOW_FOOT_Y = 1329
const JON_IMAGE_SCALE = FIGHTER_HEIGHT / (JON_SNOW_FOOT_Y - JON_SNOW_HEAD_Y)
const JON_IDLE_FRAMES = [
  'jon-snow-guard', 'jon-idle-2', 'jon-idle-3', 'jon-idle-2',
  'jon-snow-guard', 'jon-idle-4', 'jon-snow-guard',
]
const JON_MOVE_FRAMES = [
  'jon-move-1', 'jon-move-2', 'jon-move-3',
  'jon-move-4', 'jon-move-5', 'jon-move-6',
]
const JON_IDLE_FRAME_MS = 300 // Seven poses over 2.1 seconds.
const JON_MOVE_FRAME_MS = 100 // Six combat steps over 0.6 seconds.
const JON_HIT_CONTACT_MS = 30
const JON_HIT_RECOIL_MS = 60
const JON_HIT_RETURN_MS = 90
const JON_KO_IMPACT_MS = 70
const JON_KO_COLLAPSE_MS = 330
const JON_KO_TOTAL_MS = 400
const IMPACT_CUE_MS = 80
const IMPACT_CUE_OPACITY = 0.75
const JON_TRAIL_MS = 90
const JON_TRAIL_OPACITY = 0.4
const HIT_FLECK_MS = 140
const HIT_FLECK_OPACITY = 0.6
const BACKGROUND_SNOW_COUNT = 12
const NEAR_SNOW_COUNT = 6
const HIT_FLECK_POOL_SIZE = 6
// Measured source-pixel sole lines. Each texture uses the same scale and world baseline.
const JON_FRAME_SOLE_Y: Record<string, number> = {
  'jon-snow-guard': 1329,
  'jon-idle-2': 1330,
  'jon-idle-3': 1330,
  'jon-idle-4': 1330,
  'jon-move-1': 1316,
  'jon-move-2': 1322,
  'jon-move-3': 1322,
  'jon-move-4': 1324,
  'jon-move-5': 1316,
  'jon-move-6': 1324,
  'jon-attack-s-1': 1324,
  'jon-attack-s-2': 1328,
  'jon-attack-a-1': 1256,
  'jon-attack-a-2': 1285,
  'jon-attack-a-3': 1262,
  'jon-attack-r-1': 1280,
  'jon-attack-r-2': 1322,
  'jon-attack-r-3': 1329,
  'jon-hit-contact': 1348,
  'jon-hit-recoil': 1348,
  'jon-ko-collapse': 1326,
  'jon-ko-hold': 1336,
}
const FACING_MARKER_SIZE = 12
const PLAYER_MOVE_SPEED = 300
const ATTACK_STARTUP_MS = 180
const ATTACK_ACTIVE_MS = 220
const ATTACK_RECOVERY_MS = 300
const ATTACK_AREA_WIDTH = 100
const ATTACK_AREA_HEIGHT = 70
const PLAYER_MAX_HEALTH = 100
const BASIC_ATTACK_DAMAGE = 10
const HUD_PANEL_WIDTH = 430
const HUD_PANEL_HEIGHT = 100
const HUD_PANEL_Y = 36
const HUD_PANEL_MARGIN = 40
const HUD_FRAME_X_OFFSET = 22
const HUD_FRAME_Y = 82
const HUD_FRAME_WIDTH = 386
const HUD_FRAME_HEIGHT = 34
const HUD_FRAME_INSET = 4
const HUD_FILL_WIDTH = HUD_FRAME_WIDTH - HUD_FRAME_INSET * 2
const HUD_FILL_HEIGHT = HUD_FRAME_HEIGHT - HUD_FRAME_INSET * 2

type AttackState = 'idle' | 'startup' | 'active' | 'recovery'
type Facing = 'left' | 'right'
type Winner = 'PLAYER 1' | 'PLAYER 2'
type JonVisualMode = 'idle' | 'move-forward' | 'move-retreat' | 'attack'

interface Fighter {
  container: Phaser.GameObjects.Container
  visual?: Phaser.GameObjects.Image
  attackArea: Phaser.GameObjects.Rectangle
  facingMarker: Phaser.GameObjects.Rectangle
  facing: Facing
  health: number
  attackState: AttackState
  attackPhaseElapsed: number
  attackHasHit: boolean
}

interface MovementKeys {
  left: Phaser.Input.Keyboard.Key
  right: Phaser.Input.Keyboard.Key
}

interface Snowflake {
  shape: Phaser.GameObjects.Arc
  speedX: number
  speedY: number
  respawns: number
}

interface HitFleck {
  shape: Phaser.GameObjects.Arc
  speedX: number
  speedY: number
  elapsed: number
}

export class CombatScene extends Phaser.Scene {
  private playerOne!: Fighter
  private playerTwo!: Fighter
  private attackKeys!: {
    playerOne: Phaser.Input.Keyboard.Key
    playerTwo: Phaser.Input.Keyboard.Key
  }
  private restartKey!: Phaser.Input.Keyboard.Key
  private playerOneHealthFill!: Phaser.GameObjects.Rectangle
  private playerTwoHealthFill!: Phaser.GameObjects.Rectangle
  private winner: Winner | null = null
  private jonVisualMode: JonVisualMode = 'idle'
  private jonVisualElapsed = 0
  private jonHitElapsed: number | null = null
  private jonKoElapsed: number | null = null
  private impactCue!: Phaser.GameObjects.Graphics
  private impactCueElapsed = IMPACT_CUE_MS
  private jonTrail!: Phaser.GameObjects.Graphics
  private jonTrailElapsed = JON_TRAIL_MS
  private snowflakes: Snowflake[] = []
  private hitFlecks: HitFleck[] = []
  private movementKeys!: {
    playerOne: MovementKeys
    playerTwo: MovementKeys
  }

  constructor() {
    super('CombatScene')
  }

  create(): void {
    // Scene restarts reuse this class instance; new fighters reset their own state.
    this.winner = null
    this.jonVisualMode = 'idle'
    this.jonVisualElapsed = 0
    this.jonHitElapsed = null
    this.jonKoElapsed = null
    this.impactCueElapsed = IMPACT_CUE_MS
    this.jonTrailElapsed = JON_TRAIL_MS
    this.snowflakes = []
    this.hitFlecks = []

    // Static arena artwork sits behind gameplay. Its measured art landmarks
    // meet the existing ground top; fighter positions and hit geometry do not move.
    this.add.image(0, 0, 'northward-sky').setOrigin(0).setDepth(-4)
    this.add.image(0, 0, 'northward-distance').setOrigin(0).setDepth(-3)
    this.add
      .image(0, GROUND_TOP - NORTHWARD_WALL_BASE_Y, 'northward-architecture')
      .setOrigin(0)
      .setDepth(-2)
    this.add
      .image(0, GROUND_TOP - NORTHWARD_COURTYARD_SURFACE_Y, 'northward-courtyard')
      .setOrigin(0)
      .setDepth(-1)
    this.addSnowfall()

    this.playerOne = this.addFighter(260, 0x4cc9f0, 'jon-snow-guard')
    this.playerTwo = this.addFighter(1020, 0xf72585)
    this.updateFacing()

    this.jonTrail = this.add.graphics().setDepth(1).setVisible(false)
    this.jonTrail.fillStyle(0xcbd3d6)
    this.jonTrail.fillTriangle(-32, 6, 18, -5, 9, 3)
    this.jonTrail.fillTriangle(23, -3, 32, -5, 20, 1)

    this.impactCue = this.add.graphics().setDepth(2).setVisible(false)
    this.impactCue.fillStyle(0xcbd3d6)
    this.impactCue.fillTriangle(-18, 10, 18, -10, 9, 0)
    this.impactCue.lineStyle(2, 0xdde4e7)
    this.impactCue.lineBetween(-18, 10, 18, -10)

    for (let i = 0; i < HIT_FLECK_POOL_SIZE; i += 1) {
      this.hitFlecks.push({
        shape: this.add.circle(0, 0, 2, 0xcbd3d6, HIT_FLECK_OPACITY).setDepth(2).setVisible(false),
        speedX: 0,
        speedY: 0,
        elapsed: HIT_FLECK_MS,
      })
    }

    this.playerOneHealthFill = this.addHealthBar(HUD_PANEL_MARGIN, 'JON SNOW', false)
    this.playerTwoHealthFill = this.addHealthBar(
      ARENA_WIDTH - HUD_PANEL_MARGIN - HUD_PANEL_WIDTH,
      'PLAYER 2',
      true,
    )
    this.updateHealthBars()

    const keyboard = this.input.keyboard
    if (!keyboard) {
      throw new Error('Keyboard input is unavailable')
    }

    this.movementKeys = {
      playerOne: {
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      },
      playerTwo: {
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      },
    }
    this.attackKeys = {
      playerOne: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J),
      playerTwo: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L),
    }
    this.restartKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R)
  }

  update(_time: number, delta: number): void {
    const restartPressed = Phaser.Input.Keyboard.JustDown(this.restartKey)
    if (this.winner) {
      if (restartPressed) {
        this.scene.restart()
        return
      }
      // Gameplay stays locked, but the brief KO/cue presentation can finish.
      this.updateJonVisual(delta, 0)
      this.updateVfx(delta)
      return
    }

    const previousPlayerOneX = this.playerOne.container.x
    this.moveFighter(this.playerOne, this.movementKeys.playerOne, delta)
    this.moveFighter(this.playerTwo, this.movementKeys.playerTwo, delta)
    this.updateFacing()

    const jonWasActive = this.playerOne.attackState === 'active'
    this.tryStartAttack(this.playerOne, this.attackKeys.playerOne)
    this.tryStartAttack(this.playerTwo, this.attackKeys.playerTwo)
    this.advanceAttack(this.playerOne, this.playerTwo, delta)
    this.advanceAttack(this.playerTwo, this.playerOne, delta)
    if (!jonWasActive && this.playerOne.attackState === 'active') this.jonTrailElapsed = 0
    this.updateJonVisual(delta, this.playerOne.container.x - previousPlayerOneX)
    this.updateVfx(delta)
  }

  private updateJonVisual(delta: number, movedX: number): void {
    const visual = this.playerOne.visual
    if (!visual) return

    if (this.jonKoElapsed !== null) {
      this.jonKoElapsed = Math.min(this.jonKoElapsed + delta, JON_KO_TOTAL_MS)
      const frameKey = this.jonKoElapsed < JON_KO_IMPACT_MS
        ? 'jon-hit-recoil'
        : this.jonKoElapsed < JON_KO_COLLAPSE_MS
          ? 'jon-ko-collapse'
          : 'jon-ko-hold'
      this.setJonFrame(visual, frameKey)
      return
    }

    if (this.winner) {
      this.setJonFrame(visual, 'jon-snow-guard')
      return
    }

    let mode: JonVisualMode
    let frameKey: string
    if (this.playerOne.attackState !== 'idle') {
      mode = 'attack'
      frameKey = this.getJonAttackFrame(this.playerOne)
    } else {
      mode = 'idle'
      if (movedX !== 0) {
        const movingForward = movedX * (this.playerOne.facing === 'right' ? 1 : -1) > 0
        mode = movingForward ? 'move-forward' : 'move-retreat'
      }

      // Gameplay displacement, not key state, selects locomotion at boundaries.
      this.jonVisualElapsed = mode === this.jonVisualMode ? this.jonVisualElapsed + delta : 0
      if (mode === 'idle') {
        const loopElapsed = this.jonVisualElapsed % (JON_IDLE_FRAMES.length * JON_IDLE_FRAME_MS)
        const index = Math.floor(loopElapsed / JON_IDLE_FRAME_MS)
        frameKey = JON_IDLE_FRAMES[index]
      } else {
        const loopElapsed = this.jonVisualElapsed % (JON_MOVE_FRAMES.length * JON_MOVE_FRAME_MS)
        const index = Math.floor(loopElapsed / JON_MOVE_FRAME_MS)
        frameKey = JON_MOVE_FRAMES[mode === 'move-retreat' ? JON_MOVE_FRAMES.length - 1 - index : index]
      }
    }

    if (this.jonHitElapsed !== null) {
      this.jonHitElapsed += delta
      if (this.jonHitElapsed < JON_HIT_CONTACT_MS) {
        frameKey = 'jon-hit-contact'
      } else if (this.jonHitElapsed < JON_HIT_CONTACT_MS + JON_HIT_RECOIL_MS) {
        frameKey = 'jon-hit-recoil'
      } else if (this.jonHitElapsed >= JON_HIT_CONTACT_MS + JON_HIT_RECOIL_MS + JON_HIT_RETURN_MS) {
        this.jonHitElapsed = null
      }
      // Return to the *current* gameplay-selected pose; attacks are never rewound.
    }
    this.setJonFrame(visual, frameKey)
    this.jonVisualMode = mode
  }

  private setJonFrame(visual: Phaser.GameObjects.Image, frameKey: string): void {
    if (visual.texture.key === frameKey) return

    const soleY = JON_FRAME_SOLE_Y[frameKey]
    if (soleY === undefined) throw new Error(`Missing Jon Snow frame baseline: ${frameKey}`)
    visual.setTexture(frameKey)
    visual.setOrigin(0.5, soleY / visual.height)
  }

  private addSnowfall(): void {
    for (let i = 0; i < BACKGROUND_SNOW_COUNT + NEAR_SNOW_COUNT; i += 1) {
      const near = i >= BACKGROUND_SNOW_COUNT
      const radius = near ? 1 + (i % 3) * 0.25 : 0.5 + (i % 3) * 0.25
      const opacity = near ? 0.12 + (i % 3) * 0.05 : 0.18 + (i % 3) * 0.06
      const shape = this.add
        .circle((i * 337 + 149) % ARENA_WIDTH, (i * 251 + 71) % ARENA_HEIGHT, radius, 0xe4e9eb, opacity)
        .setDepth(near ? -0.5 : -2.5)
        .setScrollFactor(0)
      this.snowflakes.push({
        shape,
        speedX: near ? -8 : -5,
        speedY: near ? 26 + (i % 3) * 4 : 12 + (i % 4) * 6,
        respawns: 0,
      })
    }
  }

  private updateVfx(delta: number): void {
    const seconds = delta / 1000
    for (let i = 0; i < this.snowflakes.length; i += 1) {
      const flake = this.snowflakes[i]
      flake.shape.x += flake.speedX * seconds
      flake.shape.y += flake.speedY * seconds
      if (flake.shape.y > ARENA_HEIGHT + flake.shape.radius) {
        flake.respawns += 1
        flake.shape.x = (i * 337 + flake.respawns * 191 + 149) % ARENA_WIDTH
        flake.shape.y = -flake.shape.radius
      } else if (flake.shape.x < -flake.shape.radius) {
        flake.shape.x = ARENA_WIDTH + flake.shape.radius
      }
    }

    this.updateJonTrail(delta)
    this.updateImpactCue(delta)
    for (let i = 0; i < this.hitFlecks.length; i += 1) {
      const fleck = this.hitFlecks[i]
      if (!fleck.shape.visible) continue
      fleck.elapsed += delta
      if (fleck.elapsed >= HIT_FLECK_MS) {
        fleck.shape.setVisible(false)
        continue
      }
      fleck.shape.x += fleck.speedX * seconds
      fleck.shape.y += fleck.speedY * seconds
      fleck.shape.setAlpha(HIT_FLECK_OPACITY * (1 - fleck.elapsed / HIT_FLECK_MS))
    }
  }

  private updateJonTrail(delta: number): void {
    if (this.jonTrailElapsed >= JON_TRAIL_MS) {
      this.jonTrail.setVisible(false)
      return
    }

    const direction = this.playerOne.facing === 'right' ? 1 : -1
    this.jonTrail
      .setPosition(this.playerOne.container.x + direction * 45, this.playerOne.container.y - 35)
      .setScale(direction, 1)
      .setAlpha(JON_TRAIL_OPACITY * (1 - this.jonTrailElapsed / JON_TRAIL_MS))
      .setVisible(true)
    this.jonTrailElapsed += delta
  }

  private updateImpactCue(delta: number): void {
    if (!this.impactCue.visible) return

    if (this.impactCueElapsed >= IMPACT_CUE_MS) {
      this.impactCue.setVisible(false)
      return
    }

    const progress = this.impactCueElapsed / IMPACT_CUE_MS
    this.impactCue.setAlpha(IMPACT_CUE_OPACITY * (1 - progress))
    this.impactCueElapsed += delta
  }

  private showImpactCue(defender: Fighter): void {
    const front = defender.facing === 'right' ? 1 : -1
    const x = defender.container.x + front * FIGHTER_WIDTH / 4
    const y = defender.container.y - FIGHTER_HEIGHT / 6
    this.impactCueElapsed = 0
    this.impactCue
      .setPosition(x, y)
      .setAlpha(IMPACT_CUE_OPACITY)
      .setScale(front, 1)
      .setVisible(true)

    let spawned = 0
    for (const fleck of this.hitFlecks) {
      if (fleck.shape.visible) continue
      const spread = spawned - 1
      fleck.shape.setPosition(x + spread * 4, y + spread * 2).setAlpha(HIT_FLECK_OPACITY).setVisible(true)
      fleck.speedX = -front * (24 + spawned * 6) + spread * 5
      fleck.speedY = -22 - spawned * 8
      fleck.elapsed = 0
      spawned += 1
      if (spawned === 3) break
    }
  }

  private getJonAttackFrame(fighter: Fighter): string {
    const elapsed = fighter.attackPhaseElapsed
    if (fighter.attackState === 'startup') {
      return elapsed < 90 ? 'jon-attack-s-1' : 'jon-attack-s-2'
    }
    if (fighter.attackState === 'active') {
      return elapsed < 60 ? 'jon-attack-a-1' : elapsed < 160 ? 'jon-attack-a-2' : 'jon-attack-a-3'
    }
    return elapsed < 100 ? 'jon-attack-r-1' : elapsed < 200 ? 'jon-attack-r-2' : 'jon-attack-r-3'
  }

  private moveFighter(fighter: Fighter, keys: MovementKeys, delta: number): void {
    let direction = 0

    if (keys.left.isDown) {
      direction -= 1
    }

    if (keys.right.isDown) {
      direction += 1
    }

    if (direction !== 0) {
      const halfFighterWidth = FIGHTER_WIDTH / 2
      const distance = direction * PLAYER_MOVE_SPEED * (delta / 1000)

      fighter.container.x = Phaser.Math.Clamp(
        fighter.container.x + distance,
        halfFighterWidth,
        ARENA_WIDTH - halfFighterWidth,
      )
    }
  }

  private updateFacing(): void {
    const playerOneX = this.playerOne.container.x
    const playerTwoX = this.playerTwo.container.x

    if (playerOneX < playerTwoX) {
      this.setFacing(this.playerOne, 'right')
      this.setFacing(this.playerTwo, 'left')
    } else if (playerOneX > playerTwoX) {
      this.setFacing(this.playerOne, 'left')
      this.setFacing(this.playerTwo, 'right')
    }
    // At equal X positions, keep the previous facing for both fighters.
  }

  private setFacing(fighter: Fighter, facing: Facing): void {
    fighter.facing = facing
    fighter.visual?.setFlipX(facing === 'left')
    fighter.facingMarker.x = (facing === 'right' ? 1 : -1) * (FIGHTER_WIDTH / 2 - FACING_MARKER_SIZE)
    fighter.attackArea.x = (facing === 'right' ? 1 : -1) * (FIGHTER_WIDTH / 2 + ATTACK_AREA_WIDTH / 2)
  }

  private tryStartAttack(fighter: Fighter, key: Phaser.Input.Keyboard.Key): void {
    // Consume each key press even during an attack, so inputs are not queued.
    if (Phaser.Input.Keyboard.JustDown(key) && fighter.attackState === 'idle') {
      fighter.attackState = 'startup'
      fighter.attackPhaseElapsed = 0
      fighter.attackHasHit = false
    }
  }

  private advanceAttack(fighter: Fighter, defender: Fighter, delta: number): void {
    if (this.winner || fighter.attackState === 'idle') return

    fighter.attackPhaseElapsed += delta

    // Carry excess time into the next phase when a frame spans a boundary.
    while (fighter.attackState !== 'idle') {
      if (fighter.attackState === 'startup') {
        if (fighter.attackPhaseElapsed < ATTACK_STARTUP_MS) return
        fighter.attackPhaseElapsed -= ATTACK_STARTUP_MS
        fighter.attackState = 'active'
        fighter.attackArea.setVisible(true)
      } else if (fighter.attackState === 'active') {
        const hit = this.checkAttackHit(fighter, defender)
        if (hit) this.applyDamage(defender)
        if (this.winner) return
        if (fighter.attackPhaseElapsed < ATTACK_ACTIVE_MS) return
        fighter.attackPhaseElapsed -= ATTACK_ACTIVE_MS
        fighter.attackState = 'recovery'
        fighter.attackArea.setVisible(false)
      } else {
        if (fighter.attackPhaseElapsed < ATTACK_RECOVERY_MS) return
        fighter.attackPhaseElapsed = 0
        fighter.attackState = 'idle'
      }
    }
  }

  private checkAttackHit(attacker: Fighter, defender: Fighter): boolean {
    if (this.winner || attacker.attackState !== 'active' || attacker.attackHasHit) return false

    // Use the facing-positioned visualization for identical world-space geometry.
    const attackBox = new Phaser.Geom.Rectangle(
      attacker.container.x + attacker.attackArea.x - ATTACK_AREA_WIDTH / 2,
      attacker.container.y + attacker.attackArea.y - ATTACK_AREA_HEIGHT / 2,
      ATTACK_AREA_WIDTH,
      ATTACK_AREA_HEIGHT,
    )
    const hurtBox = new Phaser.Geom.Rectangle(
      defender.container.x - FIGHTER_WIDTH / 2,
      defender.container.y - FIGHTER_HEIGHT / 2,
      FIGHTER_WIDTH,
      FIGHTER_HEIGHT,
    )

    if (!Phaser.Geom.Intersects.RectangleToRectangle(attackBox, hurtBox)) return false

    attacker.attackHasHit = true
    return true
  }

  private applyDamage(defender: Fighter): void {
    if (this.winner) return

    defender.health = Math.max(0, defender.health - BASIC_ATTACK_DAMAGE)
    this.updateHealthBars()
    this.showImpactCue(defender)
    if (defender === this.playerOne) {
      if (defender.health === 0) {
        this.jonHitElapsed = null
        this.jonKoElapsed = 0
      } else {
        this.jonHitElapsed = 0
      }
    }
    const playerLabel = defender === this.playerOne ? 'Player 1' : 'Player 2'
    console.log(`Hit! ${playerLabel} HP: ${defender.health}`)
    if (defender.health === 0) {
      this.endMatch(defender === this.playerOne ? 'PLAYER 2' : 'PLAYER 1')
    }
  }

  private endMatch(winner: Winner): void {
    if (this.winner) return

    this.winner = winner
    if (winner === 'PLAYER 1') this.jonHitElapsed = null
    this.playerOne.attackArea.setVisible(false)
    this.playerTwo.attackArea.setVisible(false)
    this.add
      .text(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, winner === 'PLAYER 1' ? 'JON SNOW WINS' : 'PLAYER 2 WINS', {
        fontFamily: 'Arial',
        fontSize: '56px',
        color: '#ffffff',
        backgroundColor: '#111827',
        padding: { x: 24, y: 16 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
  }

  private addHealthBar(panelX: number, label: string, mirrored: boolean): Phaser.GameObjects.Rectangle {
    this.add
      .image(panelX, HUD_PANEL_Y, 'hud-bastion-panel')
      .setOrigin(0)
      .setDisplaySize(HUD_PANEL_WIDTH, HUD_PANEL_HEIGHT)
      .setFlipX(mirrored)
      .setScrollFactor(0)

    const frameX = panelX + HUD_FRAME_X_OFFSET
    this.add
      .rectangle(frameX, HUD_FRAME_Y, HUD_FRAME_WIDTH, HUD_FRAME_HEIGHT, 0x17191b)
      .setOrigin(0)
      .setStrokeStyle(2, 0x717579)
      .setScrollFactor(0)

    const troughX = frameX + HUD_FRAME_INSET
    const fillX = mirrored ? troughX + HUD_FILL_WIDTH : troughX
    this.add
      .rectangle(troughX, HUD_FRAME_Y + HUD_FRAME_INSET, HUD_FILL_WIDTH, HUD_FILL_HEIGHT, 0x252629)
      .setOrigin(0)
      .setScrollFactor(0)

    const fill = this.add
      .rectangle(fillX, HUD_FRAME_Y + HUD_FRAME_INSET, HUD_FILL_WIDTH, HUD_FILL_HEIGHT, 0xbe9d77)
      .setOrigin(mirrored ? 1 : 0, 0)
      .setScrollFactor(0)

    this.add
      .text(mirrored ? panelX + HUD_PANEL_WIDTH - HUD_FRAME_X_OFFSET : frameX, 62, label, {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        color: '#eee7da',
      })
      .setOrigin(mirrored ? 1 : 0, 0.5)
      .setShadow(1, 2, '#101112', 2)
      .setScrollFactor(0)

    return fill
  }

  private updateHealthBars(): void {
    this.updateHealthFill(this.playerOneHealthFill, this.playerOne.health)
    this.updateHealthFill(this.playerTwoHealthFill, this.playerTwo.health)
  }

  private updateHealthFill(fill: Phaser.GameObjects.Rectangle, health: number): void {
    const fraction = Phaser.Math.Clamp(health / PLAYER_MAX_HEALTH, 0, 1)
    fill.scaleX = fraction
    fill.setVisible(fraction > 0)
    fill.setFillStyle(health <= 20 ? 0xa36f5b : health <= 50 ? 0xad8969 : 0xbe9d77)
  }

  private addFighter(x: number, color: number, textureKey?: string): Fighter {
    const fighterY = GROUND_TOP - FIGHTER_HEIGHT / 2

    // Match the illustrated head-to-foot height to the existing fighter height.
    // Only the image flips: container position and collision geometry stay unchanged.
    const visual = textureKey
      ? this.add
          .image(0, FIGHTER_HEIGHT / 2, textureKey)
          .setOrigin(0.5, JON_SNOW_FOOT_Y / JON_SNOW_TEXTURE_HEIGHT)
          .setScale(JON_IMAGE_SCALE)
      : undefined
    const body = visual ??
      this.add
        .rectangle(0, 0, FIGHTER_WIDTH, FIGHTER_HEIGHT, color)
        .setStrokeStyle(4, 0xffffff)

    // Temporary marker makes the fighter's gameplay-facing state visible.
    const facingMarker = this.add
      .rectangle(
        FIGHTER_WIDTH / 2 - FACING_MARKER_SIZE,
        -FIGHTER_HEIGHT / 4,
        FACING_MARKER_SIZE,
        FACING_MARKER_SIZE,
        0xffd166,
      )
      .setVisible(!visual)

    // setFacing positions this temporary area on the fighter's facing side.
    const attackArea = this.add
      .rectangle(
        FIGHTER_WIDTH / 2 + ATTACK_AREA_WIDTH / 2,
        0,
        ATTACK_AREA_WIDTH,
        ATTACK_AREA_HEIGHT,
        0xffd166,
        0.65,
      )
      .setStrokeStyle(3, 0xffffff)
      .setVisible(false)

    return {
      container: this.add.container(x, fighterY, [body, facingMarker, attackArea]),
      visual,
      attackArea,
      facingMarker,
      facing: 'right',
      health: PLAYER_MAX_HEALTH,
      attackState: 'idle',
      attackPhaseElapsed: 0,
      attackHasHit: false,
    }
  }
}
