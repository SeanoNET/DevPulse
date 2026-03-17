import { useState, useEffect } from 'react'
import type { AppConfig, EventSource } from '@shared/types'
import { SourceIcon } from '../SourceIcon'

interface ConnectionsTabProps {
  connectedSources: EventSource[]
  onRefresh: () => void
  config: AppConfig
  onUpdate: (partial: Partial<AppConfig>) => void
}

const INTEGRATIONS: {
  source: EventSource
  label: string
  tokenLabel: string
  tokenPlaceholder: string
  helpUrl: string
  showUrl?: boolean
  showEmail?: boolean
}[] = [
  {
    source: 'github',
    label: 'GitHub',
    tokenLabel: 'Personal Access Token',
    tokenPlaceholder: 'ghp_...',
    helpUrl: 'https://github.com/settings/tokens/new?scopes=repo,notifications'
  },
  {
    source: 'jira',
    label: 'Jira',
    tokenLabel: 'API Token',
    tokenPlaceholder: 'Atlassian API token',
    helpUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    showUrl: true,
    showEmail: true
  },
  {
    source: 'octopus',
    label: 'Octopus Deploy',
    tokenLabel: 'API Key',
    tokenPlaceholder: 'API-...',
    helpUrl: '',
    showUrl: true
  }
]

const EVENT_TYPE_OPTIONS: { value: 'assigned' | 'reported' | 'watching'; label: string }[] = [
  { value: 'assigned', label: 'Assigned to me' },
  { value: 'reported', label: 'Reported by me' },
  { value: 'watching', label: 'Watching' }
]

function JiraEventSettings({ config, onUpdate }: { config: AppConfig; onUpdate: (partial: Partial<AppConfig>) => void }) {
  const [projects, setProjects] = useState<{ key: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)

  const jiraConfig = config.integrations.find((i) => i.type === 'jira')
  const selectedProjects: string[] = jiraConfig?.settings?.jiraProjects ?? []
  const selectedEventTypes: ('assigned' | 'reported' | 'watching')[] = jiraConfig?.settings?.jiraEventTypes ?? ['assigned', 'reported', 'watching']

  useEffect(() => {
    if (projects.length === 0) {
      setLoading(true)
      window.api.listJiraProjects()
        .then(setProjects)
        .finally(() => setLoading(false))
    }
  }, [])

  const updateSettings = (settings: Partial<{ jiraProjects: string[]; jiraEventTypes: ('assigned' | 'reported' | 'watching')[] }>) => {
    const updatedIntegrations = config.integrations.map((i) =>
      i.type === 'jira' ? { ...i, settings: { ...i.settings, ...settings } } : i
    )
    onUpdate({ integrations: updatedIntegrations })
  }

  const toggleProject = (key: string) => {
    const updated = selectedProjects.includes(key)
      ? selectedProjects.filter((k) => k !== key)
      : [...selectedProjects, key]
    updateSettings({ jiraProjects: updated })
  }

  const toggleEventType = (type: 'assigned' | 'reported' | 'watching') => {
    const updated = selectedEventTypes.includes(type)
      ? selectedEventTypes.filter((t) => t !== type)
      : [...selectedEventTypes, type]
    updateSettings({ jiraEventTypes: updated.length > 0 ? updated : ['assigned'] })
  }

  return (
    <div className="space-y-3 pt-2 border-t border-border mt-2">
      <p className="text-xs font-medium text-foreground">Filter Jira Events</p>

      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">Event types:</p>
        {EVENT_TYPE_OPTIONS.map(({ value, label }) => (
          <label key={value} className="flex items-center gap-2 text-[11px] cursor-pointer pl-1">
            <input
              type="checkbox"
              checked={selectedEventTypes.includes(value)}
              onChange={() => toggleEventType(value)}
              className="rounded border-input"
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">Projects: <span className="text-[10px]">(none = all)</span></p>
        <div className="space-y-1 pl-1 max-h-32 overflow-y-auto">
          {loading && <p className="text-[10px] text-muted-foreground">Loading projects...</p>}
          {!loading && projects.length === 0 && <p className="text-[10px] text-muted-foreground">No projects found</p>}
          {projects.map((p) => (
            <label key={p.key} className="flex items-center gap-2 text-[11px] cursor-pointer">
              <input
                type="checkbox"
                checked={selectedProjects.includes(p.key)}
                onChange={() => toggleProject(p.key)}
                className="rounded border-input"
              />
              <span>{p.key}</span>
              <span className="text-muted-foreground">— {p.name}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ConnectionsTab({ connectedSources, onRefresh, config, onUpdate }: ConnectionsTabProps) {
  const [tokenInputs, setTokenInputs] = useState<Record<string, string>>({})
  const [urlInputs, setUrlInputs] = useState<Record<string, string>>({})
  const [emailInputs, setEmailInputs] = useState<Record<string, string>>({})
  const [connecting, setConnecting] = useState<EventSource | null>(null)
  const [testing, setTesting] = useState<EventSource | null>(null)
  const [feedback, setFeedback] = useState<{ source: EventSource; ok: boolean; message: string } | null>(null)

  const handleConnect = async (source: EventSource) => {
    const token = tokenInputs[source]?.trim()
    if (!token) return

    setConnecting(source)
    setFeedback(null)
    try {
      const url = urlInputs[source]?.trim()
      if (url) {
        await window.api.saveApiKey(source, url)
      }
      const email = emailInputs[source]?.trim()
      if (email) {
        await window.api.saveApiKey(source, email)
      }
      await window.api.saveApiKey(source, token)

      // Test the connection
      const result = await window.api.testConnection(source)
      if (result.ok) {
        setFeedback({ source, ok: true, message: 'Connected successfully' })
        setTokenInputs((prev) => ({ ...prev, [source]: '' }))
        setUrlInputs((prev) => ({ ...prev, [source]: '' }))
        setEmailInputs((prev) => ({ ...prev, [source]: '' }))
        onRefresh()
      } else {
        // Remove bad credentials
        await window.api.removeIntegration(source)
        setFeedback({ source, ok: false, message: result.error ?? 'Connection failed' })
      }
    } catch (err) {
      setFeedback({ source, ok: false, message: String(err) })
    } finally {
      setConnecting(null)
    }
  }

  const handleDisconnect = async (source: EventSource) => {
    await window.api.removeIntegration(source)
    setFeedback(null)
    onRefresh()
  }

  const handleTest = async (source: EventSource) => {
    setTesting(source)
    setFeedback(null)
    try {
      const result = await window.api.testConnection(source)
      setFeedback({
        source,
        ok: result.ok,
        message: result.ok ? 'Connection successful' : result.error ?? 'Failed'
      })
    } catch (err) {
      setFeedback({ source, ok: false, message: String(err) })
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold">Connections</h2>
      {INTEGRATIONS.map(({ source, label, tokenLabel, tokenPlaceholder, helpUrl, showUrl, showEmail }) => {
        const connected = connectedSources.includes(source)
        return (
          <div key={source} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SourceIcon source={source} size={18} />
                <span className="text-sm font-medium">{label}</span>
                {connected && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-severity-success)]/20 text-[var(--color-severity-success)]">
                    Connected
                  </span>
                )}
              </div>
              {connected && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(source)}
                    disabled={testing === source}
                    className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {testing === source ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    onClick={() => handleDisconnect(source)}
                    className="text-[11px] text-destructive hover:underline"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>

            {!connected && (
              <div className="space-y-2">
                {showUrl && (
                  <input
                    type="text"
                    placeholder={source === 'jira' ? 'Site URL (e.g. https://yoursite.atlassian.net)' : 'Server URL (e.g. https://octopus.example.com)'}
                    value={urlInputs[source] ?? ''}
                    onChange={(e) => setUrlInputs((prev) => ({ ...prev, [source]: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs rounded border border-input bg-background"
                  />
                )}
                {showEmail && (
                  <input
                    type="email"
                    placeholder="Email (e.g. you@company.com)"
                    value={emailInputs[source] ?? ''}
                    onChange={(e) => setEmailInputs((prev) => ({ ...prev, [source]: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs rounded border border-input bg-background"
                  />
                )}
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder={tokenPlaceholder}
                    value={tokenInputs[source] ?? ''}
                    onChange={(e) => setTokenInputs((prev) => ({ ...prev, [source]: e.target.value }))}
                    className="flex-1 px-2 py-1.5 text-xs rounded border border-input bg-background"
                  />
                  <button
                    onClick={() => handleConnect(source)}
                    disabled={connecting === source || !tokenInputs[source]?.trim()}
                    className="text-[11px] px-3 py-1 rounded bg-foreground text-background hover:opacity-90 disabled:opacity-50"
                  >
                    {connecting === source ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
                {helpUrl && (
                  <button
                    onClick={() => window.api.openExternal(helpUrl)}
                    className="text-[10px] text-[var(--color-source-jira)] hover:underline"
                  >
                    Get a {tokenLabel} →
                  </button>
                )}
              </div>
            )}

            {feedback?.source === source && (
              <p className={`text-[11px] ${feedback.ok ? 'text-[var(--color-severity-success)]' : 'text-destructive'}`}>
                {feedback.message}
              </p>
            )}

            {source === 'jira' && connected && (
              <JiraEventSettings config={config} onUpdate={onUpdate} />
            )}
          </div>
        )
      })}
    </div>
  )
}
