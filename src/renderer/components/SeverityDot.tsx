import type { Severity } from '@shared/types'

const colorClasses: Record<Severity, string> = {
  error: 'bg-[var(--color-severity-error)]',
  warning: 'bg-[var(--color-severity-warning)]',
  info: 'bg-[var(--color-severity-info)]',
  success: 'bg-[var(--color-severity-success)]'
}

export function SeverityDot({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${colorClasses[severity]}`}
      title={severity}
    />
  )
}
