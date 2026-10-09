/** A frame's intended path, before contact creates a new reaction. Times are ms. */
export interface ContactMotion {
  x: number
  y: number
  velocityX: number
  horizontalMs: number
  velocityY: number
  airborne: boolean
}

export interface AttackContact {
  attackerX: number
  defenderX: number
  defenderY: number
  timeMs: number
}

interface ContactGeometry {
  fighterWidth: number
  fighterHeight: number
  reach: number
  attackHeight: number
  worldWidth: number
  groundTop: number
  gravity: number
}

const roots = (a: number, b: number, c: number): number[] => {
  if (a === 0) return b === 0 ? [] : [-c / b]
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return []
  const root = Math.sqrt(discriminant)
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)]
}

const landingTime = (motion: ContactMotion, geometry: ContactGeometry): number =>
  motion.airborne
    ? Math.max(...roots(geometry.gravity / 2e6, motion.velocityY / 1000,
      motion.y + geometry.fighterHeight / 2 - geometry.groundTop))
    : 0

function position(motion: ContactMotion, timeMs: number, geometry: ContactGeometry) {
  const halfWidth = geometry.fighterWidth / 2, halfHeight = geometry.fighterHeight / 2
  const x = Math.max(halfWidth, Math.min(geometry.worldWidth - halfWidth,
    motion.x + motion.velocityX * Math.min(timeMs, motion.horizontalMs) / 1000))
  const y = !motion.airborne || timeMs >= landingTime(motion, geometry)
    ? motion.y + (motion.airborne ? geometry.groundTop - halfHeight - motion.y : 0)
    : motion.y + motion.velocityY * timeMs / 1000 + geometry.gravity * timeMs * timeMs / 2e6
  return { x, y }
}

/**
 * Find rectangle contact in [startMs, endMs], excluding endMs at expiry.
 * Piecewise-linear horizontal and ballistic vertical paths are split at their
 * roots, so fast crossings, landing and world clamps do not require substeps.
 * Automatic facing makes horizontal overlap |dx| <= fighterWidth + reach.
 * Max-separation correction is irrelevant inside this short contact range:
 * the world resolver only constrains pairs more than 1080 px apart.
 */
export function findAttackContact(
  attacker: ContactMotion, defender: ContactMotion,
  startMs: number, endMs: number, includeEnd: boolean,
  geometry: ContactGeometry,
): AttackContact | null {
  if (startMs > endMs || (startMs === endMs && !includeEnd)) return null
  const halfWidth = geometry.fighterWidth / 2
  const events = [startMs, endMs]
  for (const motion of [attacker, defender]) {
    events.push(motion.horizontalMs, landingTime(motion, geometry))
    if (motion.velocityX !== 0) {
      for (const edge of [halfWidth, geometry.worldWidth - halfWidth]) {
        events.push((edge - motion.x) / motion.velocityX * 1000)
      }
    }
  }
  const boundaries = [...new Set(events.filter(t => Number.isFinite(t) && t >= startMs && t <= endMs))].sort((a, b) => a - b)
  const at = (t: number) => {
    const a = position(attacker, t, geometry)
    const d = position(defender, t, geometry)
    return { dx: d.x - a.x, dy: d.y - a.y, attackerX: a.x, defenderX: d.x, defenderY: d.y, timeMs: t }
  }
  const horizontalReach = geometry.fighterWidth + geometry.reach
  const verticalReach = (geometry.fighterHeight + geometry.attackHeight) / 2
  const overlaps = (t: number) => {
    const p = at(t)
    return Math.abs(p.dx) <= horizontalReach && Math.abs(p.dy) <= verticalReach
  }
  for (let i = 0; i < boundaries.length; i++) {
    const begin = boundaries[i], end = boundaries[i + 1]
    if ((begin < endMs || includeEnd) && overlaps(begin)) return at(begin)
    if (end === undefined || end === begin) continue
    const duration = end - begin
    const first = at(begin), last = at(end), middle = at((begin + end) / 2)
    // Coefficients relative to this segment's start, avoiding large-time cancellation.
    const xSlope = (last.dx - first.dx) / duration
    const yQuadratic = 2 * (last.dy + first.dy - 2 * middle.dy) / (duration * duration)
    const ySlope = (last.dy - first.dy - yQuadratic * duration * duration) / duration
    const crossings = [0, duration]
    for (const edge of [-horizontalReach, horizontalReach]) crossings.push(...roots(0, xSlope, first.dx - edge))
    for (const edge of [-verticalReach, verticalReach]) crossings.push(...roots(yQuadratic, ySlope, first.dy - edge))
    const samples = [...new Set(crossings.filter(t => t >= 0 && t <= duration))].sort((a, b) => a - b)
    for (let j = 0; j < samples.length; j++) {
      const time = begin + samples[j]
      if ((time < endMs || includeEnd) && overlaps(time)) return at(time)
      const next = samples[j + 1]
      // Midpoint also covers floating-point rounding at a geometric root.
      if (next !== undefined && overlaps(begin + (samples[j] + next) / 2)) {
        return at(begin + (samples[j] + next) / 2)
      }
    }
  }
  return null
}
