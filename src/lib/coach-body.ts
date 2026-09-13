/**
 * Parse a coach insight body into structured sections. AI-generated reports
 * mark strengths with "✓", improvements with "→" and the recommendation with
 * "💡" (see proactive-coach generateWeeklyReport + send-weekly-report edge
 * function). Local fallback bodies are plain sentences and land entirely
 * in `summary`.
 */
export function parseCoachBody(body: string): {
  summary: string
  strengths: string[]
  improvements: string[]
  recommendation: string | null
} {
  const summaryParts: string[] = []
  const strengths: string[] = []
  const improvements: string[] = []
  let recommendation: string | null = null
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // 💡 is a surrogate pair — strip markers code-point-aware, not slice(1).
    const content = trimmed.replace(/^[✓→💡]+\s*/u, '')
    if (trimmed.startsWith('✓')) {
      // Append, not assign — malformed output may repeat a marker across
      // lines and the first line's content must not be lost.
      strengths.push(...content.split(';').map((s) => s.trim()).filter(Boolean))
    } else if (trimmed.startsWith('→')) {
      improvements.push(...content.split(';').map((s) => s.trim()).filter(Boolean))
    } else if (trimmed.startsWith('💡')) {
      recommendation = content || null
    } else {
      summaryParts.push(trimmed)
    }
  }
  return { summary: summaryParts.join('\n'), strengths, improvements, recommendation }
}

/** True when the body carries any of the structured section markers. */
export function hasCoachSections(body: string): boolean {
  return /^[✓→💡]/mu.test(body)
}

/** First non-empty summary line — used as a collapsed-card preview. Falls
 *  back to a section item, never the raw body (it may start with ✓/→/💡). */
export function coachBodyPreview(body: string): string {
  const { summary, strengths, improvements, recommendation } = parseCoachBody(body)
  const first =
    summary.split('\n').find((l) => l.trim()) ??
    strengths[0] ??
    improvements[0] ??
    recommendation ??
    body.trim()
  return first.replace(/\s+/g, ' ').trim()
}
