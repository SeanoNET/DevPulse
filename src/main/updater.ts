import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'
import { showAppNotification } from './notifications'

let updateDownloaded = false

export function isUpdateDownloaded(): boolean {
  return updateDownloaded
}

export function initAutoUpdater(): void {
  autoUpdater.logger = {
    info: (...args: unknown[]) => console.log('[updater]', ...args),
    warn: (...args: unknown[]) => console.warn('[updater]', ...args),
    error: (...args: unknown[]) => console.error('[updater]', ...args),
    debug: (...args: unknown[]) => console.log('[updater:debug]', ...args)
  }
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    showAppNotification(
      'DevPulse Update Available',
      `Version ${info.version} is available. Click to download.`,
      'info'
    )
    // Auto-start download since custom panels don't support click-to-action
    autoUpdater.downloadUpdate()
  })

  autoUpdater.on('update-downloaded', () => {
    updateDownloaded = true
    showAppNotification(
      'DevPulse Update Ready',
      'Restart to apply the update.',
      'success'
    )
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('app:update-downloaded')
    }
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err)
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('app:update-error', String(err))
    }
  })

  // Check on launch and every 4 hours
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[updater] startup check failed:', err)
  })
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[updater] periodic check failed:', err)
    })
  }, 4 * 60 * 60 * 1000)
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall()
}

export async function checkForUpdates(): Promise<{
  status: 'up-to-date' | 'available' | 'downloaded' | 'error'
  version?: string
  error?: string
}> {
  try {
    const result = await autoUpdater.checkForUpdates()
    if (result && result.updateInfo) {
      const current = autoUpdater.currentVersion.toString()
      if (result.updateInfo.version !== current) {
        if (updateDownloaded) {
          return { status: 'downloaded', version: result.updateInfo.version }
        }
        return { status: 'available', version: result.updateInfo.version }
      }
    }
    return { status: 'up-to-date' }
  } catch (err) {
    return { status: 'error', error: String(err) }
  }
}
