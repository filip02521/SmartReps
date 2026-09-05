import { format } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import type { Program } from '@/data/plans/types'
import { pl } from '@/i18n/pl'

/**
 * Draw a rounded rectangle — polyfill for older browsers that don't support
 * CanvasRenderingContext2D.roundRect() (Safari < 16, Firefox < 112).
 */
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r)
    return
  }
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
}

export type ShareCardCustomInput = {
  planName: string
  dayNumber: number
  exerciseCount: number
  totalSets: number
  passed: boolean
  date?: Date
  prCount?: number
  streak?: number
  volumeKg?: number
  bestSetReps?: number
}

export type ShareCardInput = {
  program: Program
  dayNumber: number
  totalReps: number
  passed: boolean
  date?: Date
  prCount?: number
  streak?: number
  bestSetReps?: number
}

const W = 600
const H = 380

function renderShareCanvas(
  ctx: CanvasRenderingContext2D,
  opts: {
    subtitle: string
    headline: string
    statLine: string
    badges: string[]
    passed: boolean
    date?: Date
  },
) {
  const dateLabel = format(opts.date ?? new Date(), 'd MMM yyyy', { locale: plLocale })
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#1e1b4b')
  grad.addColorStop(1, '#09090b')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = opts.passed ? '#6366f1' : '#ef4444'
  ctx.fillRect(0, 0, W, 6)
  ctx.fillStyle = '#fafafa'
  ctx.font = '700 28px "Plus Jakarta Sans", system-ui, sans-serif'
  ctx.fillText('SmartReps', 32, 56)
  ctx.fillStyle = '#a1a1aa'
  ctx.font = '500 16px "Plus Jakarta Sans", system-ui, sans-serif'
  ctx.fillText(opts.subtitle, 32, 88)
  ctx.fillStyle = '#fafafa'
  ctx.font = '700 36px "Plus Jakarta Sans", system-ui, sans-serif'
  ctx.fillText(opts.headline, 32, 148)
  ctx.fillStyle = '#d4d4d8'
  ctx.font = '600 22px "Plus Jakarta Sans", system-ui, sans-serif'
  ctx.fillText(opts.statLine, 32, 196)

  // Badges row — PR count, streak, best set, volume
  let badgeX = 32
  const badgeY = 230
  const badgeGap = 12
  ctx.font = '600 13px "Plus Jakarta Sans", system-ui, sans-serif'
  for (const badge of opts.badges) {
    const metrics = ctx.measureText(badge)
    const badgeW = Math.ceil(metrics.width) + 20
    // Badge background
    ctx.fillStyle = 'rgba(99, 102, 241, 0.15)'
    ctx.beginPath()
    drawRoundRect(ctx, badgeX, badgeY, badgeW, 28, 14)
    ctx.fill()
    // Badge text
    ctx.fillStyle = '#a5b4fc'
    ctx.fillText(badge, badgeX + 10, badgeY + 19)
    badgeX += badgeW + badgeGap
    if (badgeX > W - 100) break // wrap protection
  }

  ctx.fillStyle = '#71717a'
  ctx.font = '500 14px "Plus Jakarta Sans", system-ui, sans-serif'
  ctx.fillText(dateLabel, 32, H - 32)
}

function buildBadges(input: {
  prCount?: number
  streak?: number
  bestSetReps?: number
  volumeKg?: number
}): string[] {
  const badges: string[] = []
  if (input.prCount && input.prCount > 0) badges.push(pl.shareCardPrCount(input.prCount))
  if (input.streak && input.streak > 0) badges.push(pl.shareCardStreak(input.streak))
  if (input.bestSetReps != null && input.bestSetReps > 0) badges.push(pl.shareCardBestSet(input.bestSetReps))
  if (input.volumeKg != null && input.volumeKg > 0) badges.push(pl.shareCardVolume(input.volumeKg))
  return badges
}

export async function renderShareCardPng(input: ShareCardInput): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas_unavailable')

  const programLabel = input.program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram
  const headline = input.passed
    ? pl.dayComplete(input.dayNumber)
    : pl.dayFailed
  renderShareCanvas(ctx, {
    subtitle: programLabel,
    headline,
    statLine: `${pl.totalReps}: ${input.totalReps}`,
    badges: buildBadges(input),
    passed: input.passed,
    date: input.date,
  })

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('blob_failed'))),
      'image/png',
    )
  })
}

export async function renderCustomShareCardPng(input: ShareCardCustomInput): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas_unavailable')

  renderShareCanvas(ctx, {
    subtitle: input.planName,
    headline: `${pl.dayLabel(input.dayNumber)}`,
    statLine: pl.customShareStatLine(input.exerciseCount, input.totalSets),
    badges: buildBadges(input),
    passed: input.passed,
    date: input.date,
  })

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('blob_failed'))),
      'image/png',
    )
  })
}

export async function shareSessionCard(input: ShareCardInput): Promise<'shared' | 'downloaded'> {
  const blob = await renderShareCardPng(input)
  const file = new File([blob], 'smartreps-session.png', { type: 'image/png' })
  const programLabel = input.program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: 'SmartReps',
      text: `${programLabel} · ${pl.dayComplete(input.dayNumber)} · ${input.totalReps} ${pl.totalReps.toLowerCase()}`,
      files: [file],
    })
    return 'shared'
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `smartreps-${input.program}-day${input.dayNumber}.png`
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}

export async function shareCustomSessionCard(
  input: ShareCardCustomInput,
): Promise<'shared' | 'downloaded'> {
  const blob = await renderCustomShareCardPng(input)
  const file = new File([blob], 'smartreps-custom-session.png', { type: 'image/png' })

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: 'SmartReps',
      text: `${input.planName} · ${pl.dayLabel(input.dayNumber)}`,
      files: [file],
    })
    return 'shared'
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `smartreps-custom-day${input.dayNumber}.png`
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
