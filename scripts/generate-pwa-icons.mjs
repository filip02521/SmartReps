import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const brand = join(root, 'public/brand')
mkdirSync(brand, { recursive: true })

const markSvg = readFileSync(join(brand, 'app-icon-mark.svg'))
const fullSvg = readFileSync(join(brand, 'app-icon.svg'))
const maskableSvg = readFileSync(join(brand, 'app-icon-maskable.svg'))
const faviconSvg = readFileSync(join(brand, 'favicon.svg'))

async function fromSvg(svg, size, name) {
  await sharp(svg).resize(size, size).png().toFile(join(brand, name))
  console.log(`Generated ${name}`)
}

/** White-bars silhouette on transparent — Android tints notification icons. */
async function notificationMark(size, name) {
  const markSize = Math.round(size * 0.62)
  const mark = await sharp(markSvg).resize(markSize, markSize).png().toBuffer()
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(join(brand, name))
  console.log(`Generated ${name}`)
}

// Home screen / PWA — the brand tile itself (gradient + white bars),
// same mark as favicon.svg, LogoMark, and the splash screen.
await fromSvg(fullSvg, 512, 'icon-512.png')
await fromSvg(fullSvg, 192, 'icon-192.png')

// Maskable — full-bleed gradient, bars centered in the 80% safe zone.
await fromSvg(maskableSvg, 512, 'icon-512-maskable.png')

// Apple touch — full-bleed; iOS applies its own squircle mask.
await fromSvg(maskableSvg, 180, 'apple-touch-icon.png')

// Favicons — match favicon.svg (gradient tile + white bars) for browser tabs.
await fromSvg(faviconSvg, 48, 'favicon-48.png')
await fromSvg(faviconSvg, 32, 'favicon-32.png')

// Web Push badge — white bars silhouette on transparent.
await notificationMark(192, 'notification-icon.png')
