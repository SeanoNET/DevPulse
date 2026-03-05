import { ipcMain, shell, BrowserWindow } from 'electron'
import { getEvents, markRead, markAllRead, getUnreadCount } from './db'
import { getConfig, updateConfig } from './store'
import { saveCredential, deleteCredential, hasCredential } from './auth'
import { getIntegration } from './integrations/registry'
import { setAutostart } from './autostart'
import type { AppConfig, EventSource, IntegrationConfig } from '../shared/types'

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

  ipcMain.handle('config:get', () => {
    return getConfig()
  })

  ipcMain.handle('config:update', (_event, config: Partial<AppConfig>) => {
    if (config.general?.autostart !== undefined) {
      setAutostart(config.general.autostart)
    }
    updateConfig(config)
  })

  ipcMain.handle('shell:open-external', (_event, url: string) => {
    console.log('[DevPulse] Opening URL:', url)
    return shell.openExternal(url)
  })

  ipcMain.handle('auth:save-api-key', (_event, source: EventSource, key: string) => {
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
    const integration = getIntegration(source)
    if (!integration) throw new Error(`Unknown integration: ${source}`)
    await integration.authenticate()
  })
}

export function notifyEventsUpdated(win: BrowserWindow | null): void {
  win?.webContents.send('events:updated')
  notifyUnreadChanged(win)
}

function notifyUnreadChanged(win: BrowserWindow | null): void {
  const count = getUnreadCount()
  win?.webContents.send('events:unread-count-changed', count)
}
