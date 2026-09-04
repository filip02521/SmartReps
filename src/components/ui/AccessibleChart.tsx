import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Wraps a Recharts chart with accessibility metadata.
 * - `role="img"` so screen readers announce it as an image.
 * - `aria-label` provides a human-readable summary of the chart.
 * - An optional `<details>` data table gives screen-reader users
 *   the actual data points (Recharts SVG is not accessible by default).
 *
 * Visual users see the chart; screen-reader users get the label + table.
 */
export function AccessibleChart({
  label,
  data,
  columns,
  className,
  children,
}: {
  /** Short human-readable summary, e.g. "Wykres najlepszej serii: 8 punktów, trend rosnący". */
  label: string
  /** Data rows for the fallback table. */
  data: Array<Record<string, string | number>>
  /** Column definitions: key → header label. */
  columns: Array<{ key: string; header: string }>
  /** Optional className for the chart wrapper. */
  className?: string
  children: ReactNode
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('relative', className)}
    >
      {children}
      {/* Screen-reader-only data table fallback */}
      <details className="sr-only">
        <summary>Dane wykresu</summary>
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col">{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key}>{row[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
