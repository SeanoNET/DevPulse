import type { AppConfig, Severity } from '@shared/types'

interface NotificationsTabProps {
  config: AppConfig
  onUpdate: (partial: Partial<AppConfig>) => void
}

const SEVERITY_OPTIONS: { label: string; value: Severity }[] = [
  { label: 'All events', value: 'success' },
  { label: 'Info and above', value: 'info' },
  { label: 'Warnings and errors', value: 'warning' },
  { label: 'Errors only', value: 'error' }
]

export function NotificationsTab({ config, onUpdate }: NotificationsTabProps) {
  const toggleEnabled = () => {
    onUpdate({
      notifications: {
        ...config.notifications,
        enabled: !config.notifications.enabled
      }
    })
  }

  const updateThreshold = (integrationId: string, threshold: Severity) => {
    const updated = config.integrations.map((i) =>
      i.id === integrationId ? { ...i, severityThreshold: threshold } : i
    )
    onUpdate({ integrations: updated })
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold">Notifications</h2>

      <label className="flex items-center justify-between">
        <span className="text-xs">Desktop notifications</span>
        <button
          onClick={toggleEnabled}
          className={`
            relative w-8 h-4.5 rounded-full transition-colors
            ${config.notifications.enabled ? 'bg-[var(--color-severity-success)]' : 'bg-muted'}
          `}
        >
          <span
            className={`
              absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform
              ${config.notifications.enabled ? 'translate-x-4' : 'translate-x-0.5'}
            `}
          />
        </button>
      </label>

      {config.integrations.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Set minimum severity for notifications per integration:
          </p>
          {config.integrations.map((integration) => (
            <div key={integration.id} className="flex items-center justify-between">
              <span className="text-xs capitalize">{integration.type}</span>
              <select
                value={integration.severityThreshold}
                onChange={(e) => updateThreshold(integration.id, e.target.value as Severity)}
                className="text-[11px] px-2 py-1 rounded border border-input bg-background"
              >
                {SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {config.integrations.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Connect an integration to configure notification thresholds.
        </p>
      )}
    </div>
  )
}
