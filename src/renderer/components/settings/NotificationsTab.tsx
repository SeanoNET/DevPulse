import type { AppConfig, Severity } from '@shared/types'
import { Toggle } from '../Toggle'

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

const STYLE_OPTIONS: { label: string; value: AppConfig['notifications']['style'] }[] = [
  { label: 'Custom panels', value: 'custom' },
  { label: 'System native', value: 'native' }
]

const DURATION_OPTIONS: { label: string; value: number }[] = [
  { label: '5 seconds', value: 5_000 },
  { label: '10 seconds', value: 10_000 },
  { label: '15 seconds', value: 15_000 },
  { label: '30 seconds', value: 30_000 }
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

  const updateDuration = (durationMs: number) => {
    onUpdate({
      notifications: {
        ...config.notifications,
        notificationDurationMs: durationMs
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

      <div className="flex items-center justify-between">
        <span className="text-xs">Desktop notifications</span>
        <Toggle checked={config.notifications.enabled} onChange={toggleEnabled} />
      </div>

      <label className="flex items-center justify-between">
        <span className="text-xs">Notification style</span>
        <select
          value={config.notifications.style || 'custom'}
          onChange={(e) => onUpdate({
            notifications: { ...config.notifications, style: e.target.value as AppConfig['notifications']['style'] }
          })}
          className="text-[11px] px-2 py-1 rounded border border-input bg-background"
        >
          {STYLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center justify-between">
        <span className="text-xs">Notification duration</span>
        <select
          value={config.notifications.notificationDurationMs || 10_000}
          onChange={(e) => updateDuration(Number(e.target.value))}
          className="text-[11px] px-2 py-1 rounded border border-input bg-background"
        >
          {DURATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

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
