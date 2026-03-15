import { autoUpdater } from 'electron-updater'
import { Notification } from 'electron'

export function initAutoUpdater(): void {
  autoUpdater.logger = null
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    const notification = new Notification({
      title: 'DevPulse Update Available',
      body: `Version ${info.version} is available. Click to download.`
    })
    notification.on('click', () => {
      autoUpdater.downloadUpdate()
    })
    notification.show()
  })

  autoUpdater.on('update-downloaded', () => {
    const notification = new Notification({
      title: 'DevPulse Update Ready',
      body: 'Restart to apply the update.'
    })
    notification.on('click', () => {
      autoUpdater.quitAndInstall()
    })
    notification.show()
  })

  // Check on launch and every 4 hours
  autoUpdater.checkForUpdates().catch(() => {})
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 4 * 60 * 60 * 1000)
}

export function checkForUpdates(): Promise<void> {
  return autoUpdater.checkForUpdates().then(() => {})
}
