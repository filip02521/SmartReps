import { format } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import type { Program } from '@/data/plans/types'
import { pl } from '@/i18n/pl'

export type ShareCardInput = {
  program: Program
  dayNumber: number
  totalReps: number
  passed: boolean
  date?: Date
}

const W = 600
const H = 340

function loadFont(): void {
  // Canvas uses system fonts; Plus Jakarta is optional for branded look.
}

export async function renderShareCardPng(input: ShareCardInput): Promise<Blob> {
  loadFont()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas_unavailable')

  const programLabel = input.program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram
  const dateLabel = format(input.date ?? new Date(), 'd MMM yyyy', { locale: plLocale })
  const headline = input.passed
    ? pl.dayComplete(input.dayNumber)
    : pl.dayFailed

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#1e1b4b')
  grad.addColorStop(1, '#09090b')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Accent bar
  ctx.fillStyle = input.passed ? '#6366f1' : '#ef4444'
  ctx.fillRect(0, 0, W, 6)

  ctx.fillStyle = '#fafafa'
  ctx.font = '700 28px "Plus Jakarta Sans", system-ui, sans-serif'
  ctx.fillText('SmartReps', 32, 56)

  ctx.fillStyle = '#a1a1aa'
  ctx.font = '500 16px "Plus Jakarta Sans", system-ui, sans-serif'
  ctx.fillText(programLabel, 32, 88)

  ctx.fillStyle = '#fafafa'
  ctx.font = '700 36px "Plus Jakarta Sans", system-ui, sans-serif'
  ctx.fillText(headline, 32, 148)

  ctx.fillStyle = '#d4d4d8'
  ctx.font = '600 22px "Plus Jakarta Sans", system-ui, sans-serif'
  ctx.fillText(`${pl.totalReps}: ${input.totalReps}`, 32, 196)

  ctx.fillStyle = '#71717a'
  ctx.font = '500 14px "Plus Jakarta Sans", system-ui, sans-serif'
  ctx.fillText(dateLabel, 32, H - 32)

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
