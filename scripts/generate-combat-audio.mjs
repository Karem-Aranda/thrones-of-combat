// Offline source for the four original US-24 sounds. No external samples.
// Usage: node scripts/generate-combat-audio.mjs /path/to/temporary/wav-directory
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const outputDir = process.argv[2]
if (!outputDir) throw new Error('Provide an output directory for temporary WAV files')
mkdirSync(outputDir, { recursive: true })

const sampleRate = 22050
let seed = 0x24242024
const noise = () => {
  seed ^= seed << 13
  seed ^= seed >>> 17
  seed ^= seed << 5
  return (seed >>> 0) / 0x80000000 - 1
}
const fade = (time, duration, attack = 0.005, release = 0.025) =>
  Math.min(1, time / attack, (duration - time) / release)

function writeWav(name, duration, synth, targetPeak = 0.72, rate = sampleRate, bits = 16) {
  const frameCount = Math.round(duration * rate)
  const bytesPerSample = bits / 8
  const samples = new Float32Array(frameCount)
  let peak = 0
  for (let i = 0; i < frameCount; i += 1) {
    const value = synth(i / rate, duration)
    samples[i] = value
    peak = Math.max(peak, Math.abs(value))
  }
  const gain = peak ? targetPeak / peak : 0
  const wav = Buffer.alloc(44 + frameCount * bytesPerSample)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24)
  wav.writeUInt32LE(rate * bytesPerSample, 28)
  wav.writeUInt16LE(bytesPerSample, 32)
  wav.writeUInt16LE(bits, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(frameCount * bytesPerSample, 40)
  for (let i = 0; i < frameCount; i += 1) {
    if (bits === 8) {
      wav.writeUInt8(Math.round(128 + samples[i] * gain * 127), 44 + i)
    } else {
      wav.writeInt16LE(Math.round(samples[i] * gain * 32767), 44 + i * 2)
    }
  }
  writeFileSync(join(outputDir, name + '.wav'), wav)
}

let swingAir = 0
writeWav('longclaw-swing', 0.19, (t, duration) => {
  swingAir += (noise() - swingAir) * 0.06
  const sweep = Math.sin(Math.PI * t / duration) ** 1.4
  const steel = Math.sin(2 * Math.PI * (540 * t - 260 * t * t)) * Math.exp(-22 * t)
  return fade(t, duration, 0.012, 0.04) * sweep * (0.85 * swingAir + 0.045 * steel)
}, 0.62)

// Preserve the original noise stream for the unchanged hit, KO, and ambience assets.
seed = 0xe34345d1
let hitAir = 0
writeWav('confirmed-hit', 0.16, (t, duration) => {
  hitAir += (noise() - hitAir) * 0.28
  const thud = Math.sin(2 * Math.PI * (145 * t - 210 * t * t)) * Math.exp(-24 * t)
  const steel = Math.sin(2 * Math.PI * (890 * t - 400 * t * t)) * Math.exp(-37 * t)
  return fade(t, duration, 0.002, 0.02) * (0.65 * thud + 0.19 * steel + 0.42 * hitAir * Math.exp(-44 * t))
})

let koAir = 0
writeWav('ko-impact', 0.37, (t, duration) => {
  koAir += (noise() - koAir) * 0.18
  const weight = Math.sin(2 * Math.PI * (87 * t - 75 * t * t)) * Math.exp(-11 * t)
  const rattle = (t > 0.05 ? Math.exp(-38 * (t - 0.05)) : 0) +
    (t > 0.12 ? 0.55 * Math.exp(-45 * (t - 0.12)) : 0)
  const steel = Math.sin(2 * Math.PI * (470 * t - 130 * t * t)) * rattle
  return fade(t, duration, 0.003, 0.04) * (0.75 * weight + 0.24 * steel + 0.25 * koAir * rattle)
})

function makeKnots(count) {
  return Float32Array.from({ length: count }, () => noise())
}
const wind = makeKnots(96)
const air = makeKnots(2400)
function periodicNoise(knots, time, duration) {
  const position = time / duration * knots.length
  const index = Math.floor(position)
  const fraction = position - index
  const smooth = fraction * fraction * (3 - 2 * fraction)
  return knots[index] * (1 - smooth) + knots[(index + 1) % knots.length] * smooth
}
writeWav('northward-ambience', 24, (t, duration) => {
  const gust = periodicNoise(wind, t, duration)
  const texture = periodicNoise(air, t, duration)
  return 0.72 * gust + 0.19 * texture
}, 0.42, 11025, 8)
