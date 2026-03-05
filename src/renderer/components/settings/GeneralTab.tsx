import type { AppConfig } from '@shared/types'

interface GeneralTabProps {
  config: AppConfig
  onUpdate: (partial: Partial<AppConfig>) => void
}

const POLL_OPTIONS = [
  { label: '30 seconds', value: 30_000 },
  { label: '1 minute', value: 60_000 },
  { label: '2 minutes', value: 120_000 },
  { label: '5 minutes', value: 300_000 },
  { label: '10 minutes', value: 600_000 }
]

const THEME_OPTIONS: { label: string; value: AppConfig['general']['theme'] }[] = [
  { label: 'System', value: 'system' },
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' }
]

export function GeneralTab({ config, onUpdate }: GeneralTabProps) {
  const updateGeneral = (patch: Partial<AppConfig['general']>) => {
    onUpdate({ general: { ...config.general, ...patch } })
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold">General</h2>

      <label className="flex items-center justify-between">
        <span className="text-xs">Poll interval</span>
        <select
          value={config.general.globalPollIntervalMs}
          onChange={(e) => updateGeneral({ globalPollIntervalMs: Number(e.target.value) })}
          className="text-[11px] px-2 py-1 rounded border border-input bg-background"
        >
          {POLL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center justify-between">
        <span className="text-xs">Theme</span>
        <select
          value={config.general.theme}
          onChange={(e) => updateGeneral({ theme: e.target.value as AppConfig['general']['theme'] })}
          className="text-[11px] px-2 py-1 rounded border border-input bg-background"
        >
          {THEME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center justify-between">
        <span className="text-xs">Launch at startup</span>
        <button
          onClick={() => updateGeneral({ autostart: !config.general.autostart })}
          className={`
            relative w-8 h-4.5 rounded-full transition-colors
            ${config.general.autostart ? 'bg-[var(--color-severity-success)]' : 'bg-muted'}
          `}
        >
          <span
            className={`
              absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform
              ${config.general.autostart ? 'translate-x-4' : 'translate-x-0.5'}
            `}
          />
        </button>
      </label>

      <label className="flex items-center justify-between">
        <span className="text-xs">Notification sound</span>
        <button
          onClick={() => updateGeneral({ notificationSound: !config.general.notificationSound })}
          className={`
            relative w-8 h-4.5 rounded-full transition-colors
            ${config.general.notificationSound ? 'bg-[var(--color-severity-success)]' : 'bg-muted'}
          `}
        >
          <span
            className={`
              absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform
              ${config.general.notificationSound ? 'translate-x-4' : 'translate-x-0.5'}
            `}
          />
        </button>
      </label>
    </div>
  )
}
