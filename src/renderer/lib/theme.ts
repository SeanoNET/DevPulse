import type { AppConfig } from '@shared/types'

export function applyTheme(theme: AppConfig['general']['theme']): void {
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  if (theme === 'dark' || theme === 'light') {
    root.classList.add(theme)
  }
}
