/** Presentation metadata only. No fighter mechanics or collision dimensions. */
export interface FighterVisualConfig {
  name: string
  scale: number
  guard: string
  idle: readonly string[]
  movement: readonly string[]
  startup: readonly string[]
  active: readonly string[]
  recovery: readonly string[]
  activeWeights: readonly number[]
  rising: string
  falling: string
  hit: readonly [string, string]
  ko: readonly [string, string, string]
  origins: Readonly<Record<string, number>>
  hitWeights: readonly [number, number]
  fixedHitDurationMs?: number
  consumeContactDelta: boolean
}

export interface FighterVisualRuntime {
  mode: 'idle' | 'move-forward' | 'move-retreat' | 'attack'
  elapsed: number
  hitElapsed: number | null
  hitDurationMs: number
  koElapsed: number | null
  freshReaction: boolean
}

export function createVisualRuntime(): FighterVisualRuntime {
  return { mode: 'idle', elapsed: 0, hitElapsed: null, hitDurationMs: 180, koElapsed: null, freshReaction: false }
}

const jonSoles: Record<string, number> = {
  'jon-snow-guard': 1329, 'jon-idle-2': 1330, 'jon-idle-3': 1330, 'jon-idle-4': 1330,
  'jon-move-1': 1316, 'jon-move-2': 1322, 'jon-move-3': 1322,
  'jon-move-4': 1324, 'jon-move-5': 1316, 'jon-move-6': 1324,
  'jon-attack-s-1': 1324, 'jon-attack-s-2': 1328,
  'jon-attack-a-1': 1256, 'jon-attack-a-2': 1285, 'jon-attack-a-3': 1262,
  'jon-attack-r-1': 1280, 'jon-attack-r-2': 1322, 'jon-attack-r-3': 1329,
  'jon-hit-contact': 1348, 'jon-hit-recoil': 1348, 'jon-ko-collapse': 1326, 'jon-ko-hold': 1336,
}

export const JON_VISUALS: FighterVisualConfig = {
  // Existing 1/3-resampled PNGs use original-source sole measurements below.
  // (1329 - 128) / 3 source pixels × (720 / 1201) = 240 logical pixels.
  name: 'ALARIC DUSKBANE', scale: 720 / 1201, guard: 'jon-snow-guard',
  idle: ['jon-snow-guard', 'jon-idle-2', 'jon-idle-3', 'jon-idle-2', 'jon-snow-guard', 'jon-idle-4', 'jon-snow-guard'],
  movement: Array.from({ length: 6 }, (_, i) => `jon-move-${i + 1}`),
  startup: ['jon-attack-s-1', 'jon-attack-s-2'],
  active: ['jon-attack-a-1', 'jon-attack-a-2', 'jon-attack-a-3'],
  recovery: ['jon-attack-r-1', 'jon-attack-r-2', 'jon-attack-r-3'],
  activeWeights: [60 / 220, 100 / 220, 60 / 220],
  rising: 'jon-snow-guard', falling: 'jon-snow-guard',
  hit: ['jon-hit-contact', 'jon-hit-recoil'],
  ko: ['jon-hit-recoil', 'jon-ko-collapse', 'jon-ko-hold'],
  origins: Object.fromEntries(Object.entries(jonSoles).map(([key, sole]) => [key, sole / (key === 'jon-move-3' ? 1373 : 1374)])),
  hitWeights: [30 / 180, 60 / 180], fixedHitDurationMs: 180, consumeContactDelta: true,
}

const lyraKeys = [
  'lyra-guard', 'lyra-idle-2', 'lyra-idle-3', 'lyra-idle-4',
  ...Array.from({ length: 6 }, (_, i) => `lyra-move-${i + 1}`),
  'lyra-attack-s-1', 'lyra-attack-s-2',
  'lyra-attack-a-1', 'lyra-attack-a-2', 'lyra-attack-a-3',
  'lyra-attack-r-1', 'lyra-attack-r-2', 'lyra-attack-r-3',
  'lyra-rising', 'lyra-falling', 'lyra-hit-contact', 'lyra-hit-recoil', 'lyra-ko-collapse', 'lyra-ko-hold',
]

export const LYRA_VISUALS: FighterVisualConfig = {
  // Approved 512×512 fixed registration: crown 189, sole 448, height 259.
  // Uniform scale and origin apply to every pose, never to collision geometry.
  name: 'LYRA THORNVALE', scale: 190 / 259, guard: 'lyra-guard',
  idle: ['lyra-guard', 'lyra-idle-2', 'lyra-idle-3', 'lyra-idle-4', 'lyra-idle-3', 'lyra-idle-2'],
  movement: Array.from({ length: 6 }, (_, i) => `lyra-move-${i + 1}`),
  startup: ['lyra-attack-s-1', 'lyra-attack-s-2'],
  active: ['lyra-attack-a-1', 'lyra-attack-a-2', 'lyra-attack-a-3'],
  recovery: ['lyra-attack-r-1', 'lyra-attack-r-2', 'lyra-attack-r-3'],
  activeWeights: [1 / 3, 1 / 3, 1 / 3],
  rising: 'lyra-rising', falling: 'lyra-falling',
  hit: ['lyra-hit-contact', 'lyra-hit-recoil'],
  ko: ['lyra-ko-collapse', 'lyra-ko-collapse', 'lyra-ko-hold'],
  origins: Object.fromEntries(lyraKeys.map(key => [key, 448 / 512])),
  hitWeights: [0.5, 0.5], consumeContactDelta: false,
}

export function phaseFrame(frames: readonly string[], fraction: number, weights?: readonly number[]): string {
  let end = 0
  for (let i = 0; i < frames.length - 1; i++) {
    end += weights?.[i] ?? 1 / frames.length
    if (fraction < end) return frames[i]
  }
  return frames[frames.length - 1]
}
