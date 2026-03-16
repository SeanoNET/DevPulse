export type EventSource = 'github' | 'jira' | 'octopus'
export type Severity = 'error' | 'warning' | 'info' | 'success'

export interface DevEvent {
  id: string
  source: EventSource
  severity: Severity
  title: string
  subtitle: string
  timestamp: number
  url: string
  metadata: Record<string, string>
  read: boolean
}

export interface IntegrationConfig {
  id: string
  type: EventSource
  enabled: boolean
  pollIntervalMs: number
  severityThreshold: Severity
  settings?: {
    jiraProjects?: string[]
  }
}

export interface AppConfig {
  integrations: IntegrationConfig[]
  general: {
    autostart: boolean
    theme: 'system' | 'dark' | 'light'
    notificationSound: boolean
    globalPollIntervalMs: number
    fastPollIntervalMs: number
  }
  notifications: {
    enabled: boolean
    groupingWindowMs: number
    notificationDurationMs: number
    style: 'native' | 'custom'
  }
}

export interface IpcApi {
  getEvents: (filter?: EventFilter) => Promise<DevEvent[]>
  markRead: (ids: string[]) => Promise<void>
  markAllRead: () => Promise<void>
  clearEvents: (source?: EventSource) => Promise<void>
  getConfig: () => Promise<AppConfig>
  updateConfig: (config: Partial<AppConfig>) => Promise<void>
  getUnreadCount: () => Promise<number>
  openExternal: (url: string) => Promise<void>
  onEventsUpdated: (callback: () => void) => () => void
  onUnreadCountChanged: (callback: (count: number) => void) => () => void
  onPollingStateChanged: (callback: (polling: boolean) => void) => () => void

  // Auth
  startOAuth: (source: EventSource) => Promise<void>
  saveApiKey: (source: EventSource, key: string) => Promise<void>
  testConnection: (source: EventSource) => Promise<{ ok: boolean; error?: string }>
  removeIntegration: (source: EventSource) => Promise<void>
  getConnectedSources: () => Promise<EventSource[]>
  listJiraProjects: () => Promise<{ key: string; name: string }[]>

  // App info
  getVersion: () => Promise<string>
  checkForUpdates: () => Promise<{ status: 'up-to-date' | 'available' | 'error'; version?: string; error?: string }>

  // Window controls
  hideWindow: () => Promise<void>
  minimizeWindow: () => Promise<void>
}

export interface EventFilter {
  source?: EventSource
  severity?: Severity
  read?: boolean
  limit?: number
  offset?: number
}
