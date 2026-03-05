import type { Severity } from './types'

const SEVERITY_ORDER: Record<Severity, number> = {
  error: 3,
  warning: 2,
  info: 1,
  success: 0
}

export function severityAtOrAbove(event: Severity, threshold: Severity): boolean {
  return SEVERITY_ORDER[event] >= SEVERITY_ORDER[threshold]
}

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_ORDER[b] - SEVERITY_ORDER[a]
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  success: '#22c55e'
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
  success: 'Success'
}
