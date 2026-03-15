import type { Severity } from '@shared/types'

const colorClasses: Record<Severity, string> = {
  error: 'bg-[var(--color-severity-error)]',
  warning: 'bg-[var(--color-severity-warning)]',
  info: 'bg-[var(--color-severity-info)]',
  success: 'bg-[var(--color-severity-success)]'
}

const ringClasses: Record<Severity, string> = {
  error: 'bg-[var(--color-severity-error)]',
  warning: 'bg-[var(--color-severity-warning)]',
  info: 'bg-[var(--color-severity-info)]',
  success: 'bg-[var(--color-severity-success)]'
}

export function SeverityDot({ severity, pulse = false }: { severity: Severity; pulse?: boolean }) {
  if (pulse) {
    return (
      <span className="relative inline-flex w-2 h-2 shrink-0">
        <span
          className={`absolute inset-[-3px] rounded-full opacity-50 animate-pulse-ring ${ringClasses[severity]}`}
        />
        <span
          className={`relative w-2 h-2 rounded-full ${colorClasses[severity]}`}
          title={severity}
        />
      </span>
    )
  }

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${colorClasses[severity]}`}
      title={severity}
    />
  )
}
