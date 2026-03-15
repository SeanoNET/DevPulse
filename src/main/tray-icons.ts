import { nativeImage, app, type NativeImage } from 'electron'
import { deflateSync } from 'zlib'
import { join } from 'path'
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs'

const SIZE = 32

// --- Minimal PNG encoder ---

const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  }
  crcTable[n] = c >>> 0
}

function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const payload = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(payload), 0)
  return Buffer.concat([len, payload, crcBuf])
}

function encodePng(rgba: Buffer, w: number, h: number): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6

  const raw = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) {
    const rowStart = y * (1 + w * 4)
    raw[rowStart] = 0
    rgba.copy(raw, rowStart + 1, y * w * 4, (y + 1) * w * 4)
  }

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

// --- Pixel buffer with drawing primitives ---

interface RGBA {
  r: number; g: number; b: number; a: number
}

class PixelBuffer {
  readonly data: Buffer
  constructor(readonly w: number, readonly h: number) {
    this.data = Buffer.alloc(w * h * 4)
  }

  setPixel(x: number, y: number, c: RGBA, opacity = 1): void {
    const ix = Math.round(x)
    const iy = Math.round(y)
    if (ix < 0 || ix >= this.w || iy < 0 || iy >= this.h) return
    const i = (iy * this.w + ix) * 4
    const a = Math.round(c.a * Math.min(1, Math.max(0, opacity)))
    if (a === 0) return

    const sa = a / 255
    const da = this.data[i + 3] / 255
    const oa = sa + da * (1 - sa)
    if (oa === 0) return

    this.data[i]     = Math.round((c.r * sa + this.data[i]     * da * (1 - sa)) / oa)
    this.data[i + 1] = Math.round((c.g * sa + this.data[i + 1] * da * (1 - sa)) / oa)
    this.data[i + 2] = Math.round((c.b * sa + this.data[i + 2] * da * (1 - sa)) / oa)
    this.data[i + 3] = Math.round(oa * 255)
  }

  drawLine(x0: number, y0: number, x1: number, y1: number, c: RGBA, thickness = 2): void {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    let err = dx - dy, cx = x0, cy = y0
    const r = (thickness - 1) / 2

    for (;;) {
      const ri = Math.ceil(r)
      for (let ox = -ri; ox <= ri; ox++) {
        for (let oy = -ri; oy <= ri; oy++) {
          const d = Math.sqrt(ox * ox + oy * oy)
          if (d <= r + 0.5) {
            const op = d <= r ? 1 : Math.max(0, 1 - (d - r) * 2)
            this.setPixel(cx + ox, cy + oy, c, op)
          }
        }
      }
      if (cx === x1 && cy === y1) break
      const e2 = 2 * err
      if (e2 > -dy) { err -= dy; cx += sx }
      if (e2 < dx) { err += dx; cy += sy }
    }
  }

  drawPolyline(pts: [number, number][], c: RGBA, thickness = 2): void {
    for (let i = 0; i < pts.length - 1; i++) {
      this.drawLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, thickness)
    }
  }

  toPng(): Buffer {
    return encodePng(this.data, this.w, this.h)
  }
}

// --- Heartbeat waveform geometry ---

const COLORS: Record<string, RGBA> = {
  normal:  { r: 220, g: 220, b: 220, a: 255 },
  error:   { r: 239, g: 68,  b: 68,  a: 255 },
  running: { r: 34,  g: 197, b: 94,  a: 255 },
  paused:  { r: 115, g: 115, b: 115, a: 200 }
}

function heartbeatPoints(peakScale = 1.0): [number, number][] {
  const mid = SIZE / 2
  const rPeak   = mid - Math.round(12 * peakScale)
  const sValley = mid + Math.round(10 * peakScale)

  return [
    [1,  mid],
    [7,  mid],
    [9,  mid - 3],
    [11, mid],
    [13, mid],
    [15, rPeak],
    [17, sValley],
    [19, mid - 2],
    [21, mid],
    [24, mid - 2],
    [27, mid],
    [31, mid]
  ]
}

function flatlinePoints(): [number, number][] {
  const mid = SIZE / 2
  return [
    [1,  mid],
    [11, mid],
    [13, mid - 2],
    [15, mid + 1],
    [17, mid],
    [31, mid]
  ]
}

// --- File-based icon cache (required for Linux tray updates) ---

let iconDir: string | null = null
let fileCounter = 0

function getIconDir(): string {
  if (!iconDir) {
    iconDir = join(app.getPath('temp'), 'devpulse-tray-icons')
    if (!existsSync(iconDir)) {
      mkdirSync(iconDir, { recursive: true })
    }
  }
  return iconDir
}

/** Write PNG to a unique temp file and return a NativeImage from that path.
 *  Linux AppIndicator/SNI requires file-based icons to detect changes. */
function pngToNativeImage(png: Buffer): NativeImage {
  const dir = getIconDir()
  const filePath = join(dir, `icon-${fileCounter++}.png`)
  writeFileSync(filePath, png)
  return nativeImage.createFromPath(filePath)
}

// --- Public API ---

export type TrayIconState = 'normal' | 'error' | 'running' | 'paused'

function renderIcon(state: TrayIconState, frame = 0): Buffer {
  const buf = new PixelBuffer(SIZE, SIZE)
  const color = COLORS[state]

  let pts: [number, number][]

  if (state === 'error') {
    pts = flatlinePoints()
  } else if (state === 'running') {
    const scales = [0.65, 0.8, 1.0, 0.8]
    pts = heartbeatPoints(scales[frame % scales.length])
  } else {
    pts = heartbeatPoints(state === 'paused' ? 0.5 : 0.85)
  }

  buf.drawPolyline(pts, color, 2)
  return buf.toPng()
}

export function generateIcon(state: TrayIconState, frame = 0): NativeImage {
  const png = renderIcon(state, frame)
  return pngToNativeImage(png)
}

/** Pre-render all animation frames for the running state. */
export function generateRunningFrames(): NativeImage[] {
  return [0, 1, 2, 3].map((f) => generateIcon('running', f))
}

/** Clean up temp icon files on quit. */
export function cleanupIcons(): void {
  if (iconDir && existsSync(iconDir)) {
    try {
      rmSync(iconDir, { recursive: true, force: true })
    } catch {
      // best-effort cleanup
    }
  }
}
