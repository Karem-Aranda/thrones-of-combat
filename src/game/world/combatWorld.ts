export const VIEWPORT_WIDTH = 1280
export const VIEWPORT_HEIGHT = 720
export const WORLD_WIDTH = 2400
export const WORLD_HEIGHT = 720
export const MAX_FIGHTER_SEPARATION = 1080

const CAMERA_EDGE_MARGIN = 80
const CAMERA_RESPONSE_PER_SECOND = 8
const MAX_CAMERA_SCROLL = WORLD_WIDTH - VIEWPORT_WIDTH

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/** Resolve both intended movements together, without displacing a stationary opponent. */
export function moveFightersWithinWorld(
  playerOneX: number,
  playerTwoX: number,
  playerOneDistance: number,
  playerTwoDistance: number,
  halfFighterWidth: number,
): [number, number] {
  let nextOneX = clamp(playerOneX + playerOneDistance, halfFighterWidth, WORLD_WIDTH - halfFighterWidth)
  let nextTwoX = clamp(playerTwoX + playerTwoDistance, halfFighterWidth, WORLD_WIDTH - halfFighterWidth)
  const excess = Math.abs(nextTwoX - nextOneX) - MAX_FIGHTER_SEPARATION

  if (excess > 0) {
    // Use the proposed ordering so crossing remains allowed, including long frames.
    const direction = Math.sign(nextTwoX - nextOneX)
    const outwardOne = Math.max(0, -(nextOneX - playerOneX) * direction)
    const outwardTwo = Math.max(0, (nextTwoX - playerTwoX) * direction)
    const outwardTotal = outwardOne + outwardTwo
    if (outwardTotal > 0) {
      const blockedFraction = Math.min(1, excess / outwardTotal)
      nextOneX += direction * outwardOne * blockedFraction
      nextTwoX -= direction * outwardTwo * blockedFraction
    }
  }

  return [nextOneX, nextTwoX]
}

export function getCombatCameraTarget(playerOneX: number, playerTwoX: number): number {
  return clamp((playerOneX + playerTwoX) / 2 - VIEWPORT_WIDTH / 2, 0, MAX_CAMERA_SCROLL)
}

export function getCombatCameraScroll(
  currentScroll: number, playerOneX: number, playerTwoX: number, delta: number,
): number {
  const target = getCombatCameraTarget(playerOneX, playerTwoX)
  const response = 1 - Math.exp(-CAMERA_RESPONSE_PER_SECOND * delta / 1000)
  const smoothed = currentScroll + (target - currentScroll) * response

  // Smoothing must never let a fighter leave the view. Near a world edge, the
  // world bound takes precedence over the presentation margin.
  const minScroll = clamp(Math.max(playerOneX, playerTwoX) + CAMERA_EDGE_MARGIN - VIEWPORT_WIDTH, 0, MAX_CAMERA_SCROLL)
  const maxScroll = clamp(Math.min(playerOneX, playerTwoX) - CAMERA_EDGE_MARGIN, 0, MAX_CAMERA_SCROLL)
  return clamp(smoothed, minScroll, maxScroll)
}
