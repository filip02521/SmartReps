import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const brand = join(root, 'public/brand')
mkdirSync(brand, { recursive: true })

const markSvg = readFileSync(join(brand, 'app-icon-mark.svg'))
const fullSvg = readFileSync(join(brand, 'app-icon.svg'))

/** Matches PWA manifest background_color */
const APP_BG = { r: 9, g: 9, b: 11, alpha: 1 }

async function compositeMark(size, markScale, bg = APP_BG) {
  const markSize = Math.round(size * markScale)
  const mark = await sharp(markSvg).resize(markSize, markSize).png().toBuffer()
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg,
    },
  }).composite([{ input: mark, gravity: 'center' }])
}

async function fromFullSvg(size, name) {
  await sharp(fullSvg).resize(size, size).png().toFile(join(brand, name))
  console.log(`Generated ${name}`)
}

async function fromMark(size, name, markScale) {
  const pipeline = await compositeMark(size, markScale)
  await pipeline.png().toFile(join(brand, name))
  console.log(`Generated ${name}`)
}

// Home screen / PWA — dark canvas, mark ~58% for legibility at 48px+
await fromMark(512, 'icon-512.png', 0.58)
await fromMark(192, 'icon-192.png', 0.58)

// Maskable — mark ~50% fits Android/iOS safe zone (central 80%)
await fromMark(512, 'icon-512-maskable.png', 0.5)

// Apple touch + favicons — full SVG with rounded rect at larger sizes
await fromFullSvg(180, 'apple-touch-icon.png')
await fromFullSvg(48, 'favicon-48.png')
await fromFullSvg(32, 'favicon-32.png')

// Web Push badge — simplified mark on dark (monochrome-ish for small badge)
await fromMark(192, 'notification-icon.png', 0.62)
