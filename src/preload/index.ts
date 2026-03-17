import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from '../shared/types'

const api: IpcApi = {
  getEvents: (filter) => ipcRenderer.invoke('events:get', filter),
  markRead: (ids) => ipcRenderer.invoke('events:mark-read', ids),
  markAllRead: () => ipcRenderer.invoke('events:mark-all-read'),
  clearEvents: (source) => ipcRenderer.invoke('events:clear', source),
  getConfig: () => ipcRenderer.invoke('config:get'),
  updateConfig: (config) => ipcRenderer.invoke('config:update', config),
  getUnreadCount: () => ipcRenderer.invoke('events:unread-count'),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),

  onEventsUpdated: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('events:updated', handler)
    return () => ipcRenderer.removeListener('events:updated', handler)
  },

  onUnreadCountChanged: (callback) => {
    const handler = (_: unknown, count: number) => callback(count)
    ipcRenderer.on('events:unread-count-changed', handler)
    return () => ipcRenderer.removeListener('events:unread-count-changed', handler)
  },

  onPollingStateChanged: (callback) => {
    const handler = (_: unknown, polling: boolean) => callback(polling)
    ipcRenderer.on('polling:state-changed', handler)
    return () => ipcRenderer.removeListener('polling:state-changed', handler)
  },

  startOAuth: (source) => ipcRenderer.invoke('auth:start-oauth', source),
  saveApiKey: (source, key) => ipcRenderer.invoke('auth:save-api-key', source, key),
  testConnection: (source) => ipcRenderer.invoke('auth:test-connection', source),
  removeIntegration: (source) => ipcRenderer.invoke('auth:remove-integration', source),
  getConnectedSources: () => ipcRenderer.invoke('auth:connected-sources'),
  listJiraProjects: () => ipcRenderer.invoke('jira:list-projects'),

  getVersion: () => ipcRenderer.invoke('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('app:install-update'),
  onUpdateDownloaded: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('app:update-downloaded', handler)
    return () => ipcRenderer.removeListener('app:update-downloaded', handler)
  },

  hideWindow: () => ipcRenderer.invoke('window:hide'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize')
}

contextBridge.exposeInMainWorld('api', api)
