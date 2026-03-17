import { app, ipcMain, shell, BrowserWindow } from 'electron'
import { getEvents, markRead, markAllRead, getUnreadCount, deleteEventsBySource, deleteAllEvents } from './db'
import { getConfig, updateConfig } from './store'
import { saveCredential, deleteCredential, hasCredential } from './auth'
import { getIntegration } from './integrations/registry'
import { setAutostart } from './autostart'
import type { AppConfig, EventSource, IntegrationConfig } from '../shared/types'

const VALID_SOURCES = new Set(['github', 'jira', 'octopus'])

function isValidSource(source: unknown): source is EventSource {
  return typeof source === 'string' && VALID_SOURCES.has(source)
}

let onIntegrationChanged: (() => void) | null = null

export function setIntegrationChangedCallback(cb: () => void): void {
  onIntegrationChanged = cb
}

function ensureIntegrationInConfig(source: EventSource): void {
  const config = getConfig()
  const exists = config.integrations.some((i) => i.type === source)
  if (!exists) {
    const entry: IntegrationConfig = {
      id: source,
      type: source,
      enabled: true,
      pollIntervalMs: config.general.globalPollIntervalMs,
      severityThreshold: 'info'
    }
    updateConfig({ integrations: [...config.integrations, entry] })
    onIntegrationChanged?.()
  }
}

function removeIntegrationFromConfig(source: EventSource): void {
  const config = getConfig()
  const filtered = config.integrations.filter((i) => i.type !== source)
  if (filtered.length !== config.integrations.length) {
    updateConfig({ integrations: filtered })
    onIntegrationChanged?.()
  }
}

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('app:version', () => {
    return app.getVersion()
  })

  ipcMain.handle('app:check-for-updates', async () => {
    try {
      const { checkForUpdates } = await import('./updater')
      return await checkForUpdates()
    } catch (err) {
      return { status: 'error' as const, error: String(err) }
    }
  })

  ipcMain.handle('app:install-update', async () => {
    const { installUpdate } = await import('./updater')
    installUpdate()
  })

  ipcMain.handle('window:hide', () => {
    getMainWindow()?.hide()
  })

  ipcMain.handle('window:minimize', () => {
    getMainWindow()?.minimize()
  })

  ipcMain.handle('events:get', (_event, filter) => {
    return getEvents(filter)
  })

  ipcMain.handle('events:mark-read', (_event, ids: string[]) => {
    markRead(ids)
    notifyUnreadChanged(getMainWindow())
  })

  ipcMain.handle('events:mark-all-read', () => {
    markAllRead()
    notifyUnreadChanged(getMainWindow())
  })

  ipcMain.handle('events:unread-count', () => {
    return getUnreadCount()
  })

  ipcMain.handle('events:clear', (_event, source?: EventSource) => {
    if (source) {
      if (!isValidSource(source)) return
      deleteEventsBySource(source)
    } else {
      deleteAllEvents()
    }
    notifyEventsUpdated(getMainWindow())
  })

  ipcMain.handle('config:get', () => {
    return getConfig()
  })

  ipcMain.handle('config:update', (_event, config: Partial<AppConfig>) => {
    if (config.general?.autostart !== undefined) {
      setAutostart(config.general.autostart)
    }
    updateConfig(config)
    if (config.general?.globalPollIntervalMs !== undefined) {
      onIntegrationChanged?.()
    }
  })

  ipcMain.handle('shell:open-external', (_event, url: string) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        console.warn('[DevPulse] Blocked non-HTTP URL:', parsed.protocol)
        return
      }
    } catch {
      console.warn('[DevPulse] Blocked invalid URL')
      return
    }
    return shell.openExternal(url)
  })

  ipcMain.handle('auth:save-api-key', (_event, source: EventSource, key: string) => {
    if (!isValidSource(source) || typeof key !== 'string' || !key.trim()) return
    if (key.startsWith('http')) {
      saveCredential(`${source}:url`, key)
    } else if (key.includes('@')) {
      saveCredential(`${source}:email`, key)
    } else if (source === 'octopus') {
      saveCredential('octopus:api-key', key)
    } else {
      saveCredential(`${source}:token`, key)
    }
  })

  ipcMain.handle('auth:test-connection', async (_event, source: EventSource) => {
    if (!isValidSource(source)) return { ok: false, error: 'Invalid source' }
    try {
      const integration = getIntegration(source)
      if (!integration) return { ok: false, error: 'Integration not found' }
      await integration.testConnection()
      ensureIntegrationInConfig(source)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('auth:remove-integration', (_event, source: EventSource) => {
    if (!isValidSource(source)) return
    deleteCredential(`${source}:token`)
    deleteCredential(`${source}:api-key`)
    deleteCredential(`${source}:url`)
    deleteCredential(`${source}:email`)
    removeIntegrationFromConfig(source)
  })

  ipcMain.handle('auth:connected-sources', () => {
    const sources: EventSource[] = []
    for (const s of ['github', 'jira', 'octopus'] as EventSource[]) {
      if (hasCredential(`${s}:token`) || hasCredential(`${s}:api-key`)) {
        sources.push(s)
      }
    }
    return sources
  })

  ipcMain.handle('auth:start-oauth', async (_event, source: EventSource) => {
    if (!isValidSource(source)) throw new Error('Invalid source')
    const integration = getIntegration(source)
    if (!integration) throw new Error(`Unknown integration: ${source}`)
    await integration.authenticate()
  })

  ipcMain.handle('jira:list-projects', async () => {
    const integration = getIntegration('jira')
    if (!integration) return []
    return (integration as any).listProjects()
  })
}

export function notifyEventsUpdated(win: BrowserWindow | null): void {
  win?.webContents.send('events:updated')
  notifyUnreadChanged(win)
}

export function notifyPollingState(win: BrowserWindow | null, polling: boolean): void {
  win?.webContents.send('polling:state-changed', polling)
}

function notifyUnreadChanged(win: BrowserWindow | null): void {
  const count = getUnreadCount()
  win?.webContents.send('events:unread-count-changed', count)
}
