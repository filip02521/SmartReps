import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const brand = join(root, 'public/brand')
mkdirSync(brand, { recursive: true })
const svg = readFileSync(join(brand, 'logo-mark.svg'))

async function png(size, name, opts = {}) {
  let pipeline = sharp(svg).resize(size, size)
  if (opts.maskablePad) {
    // Safe-zone maskable: draw mark in center 80% on solid brand background
    const inner = Math.round(size * 0.8)
    const mark = await sharp(svg).resize(inner, inner).png().toBuffer()
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 99, g: 102, b: 241, alpha: 1 },
      },
    })
      .composite([{ input: mark, gravity: 'center' }])
      .png()
      .toFile(join(brand, name))
  } else {
    await pipeline.png().toFile(join(brand, name))
  }
  console.log(`Generated ${name}`)
}

await png(192, 'icon-192.png')
await png(512, 'icon-512.png')
await png(512, 'icon-512-maskable.png', { maskablePad: true })
await png(180, 'apple-touch-icon.png')
await png(32, 'favicon-32.png')
await png(48, 'favicon-48.png')
await png(192, 'notification-icon.png')
