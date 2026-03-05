import type { AppConfig } from '../shared/types'

const defaults: AppConfig = {
  integrations: [],
  general: {
    autostart: false,
    theme: 'system',
    notificationSound: true,
    globalPollIntervalMs: 60_000
  },
  notifications: {
    enabled: true,
    groupingWindowMs: 5_000
  }
}

// electron-store v10+ is ESM-only; we need dynamic import for CJS main process
let storeInstance: any = null

async function getStore(): Promise<any> {
  if (storeInstance) return storeInstance
  const mod = await import('electron-store')
  const Store = mod.default
  storeInstance = new Store({ defaults })
  return storeInstance
}

// Synchronous access after initialization
let syncStore: any = null

export async function initStore(): Promise<void> {
  syncStore = await getStore()
}

export function getConfig(): AppConfig {
  if (!syncStore) throw new Error('Store not initialized. Call initStore() first.')
  return {
    integrations: syncStore.get('integrations'),
    general: syncStore.get('general'),
    notifications: syncStore.get('notifications')
  }
}

export function updateConfig(partial: Partial<AppConfig>): void {
  if (!syncStore) throw new Error('Store not initialized. Call initStore() first.')
  if (partial.integrations !== undefined) syncStore.set('integrations', partial.integrations)
  if (partial.general !== undefined) syncStore.set('general', partial.general)
  if (partial.notifications !== undefined) syncStore.set('notifications', partial.notifications)
}

export function getRawStore(): any {
  return syncStore
}
