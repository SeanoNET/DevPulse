import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { createTray, updateTrayBadge, setQuittingCallback } from './tray'
import { cleanupIcons } from './tray-icons'
import { initDb, closeDb, getUnreadCount, pruneOldEvents } from './db'
import { registerIpcHandlers, setIntegrationChangedCallback } from './ipc'
import { createScheduler } from './scheduler'
import { initStore } from './store'

let mainWindow: BrowserWindow | null = null
let isQuitting = false

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 480,
    height: 700,
    show: false,
    frame: false,
    resizable: true,
    skipTaskbar: false,
    minWidth: 380,
    minHeight: 400,
    title: 'DevPulse',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function toggleWindow() {
  if (!mainWindow) return
  if (mainWindow.isVisible()) {
    mainWindow.hide()
  } else {
    mainWindow.show()
    mainWindow.focus()
  }
}

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

app.whenReady().then(async () => {
  await initStore()
  initDb()

  mainWindow = createWindow()

  registerIpcHandlers(() => mainWindow)

  setQuittingCallback(() => { isQuitting = true })
  createTray(toggleWindow)
  updateTrayBadge(getUnreadCount())

  const scheduler = createScheduler(() => mainWindow)
  scheduler.start()

  setIntegrationChangedCallback(() => {
    scheduler.start() // stop + restart with new config
  })

  if (app.isPackaged) {
    import('./updater').then(({ initAutoUpdater }) => initAutoUpdater())
  }

  pruneOldEvents()

  // Close button hides to tray instead of quitting
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })
})

app.on('window-all-closed', () => {
  // Don't quit - tray keeps the app alive
})

app.on('before-quit', () => {
  isQuitting = true
  cleanupIcons()
  closeDb()
})

export { mainWindow, toggleWindow }
