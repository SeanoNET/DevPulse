import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { createTray, updateTrayBadge, getTrayBounds } from './tray'
import { initDb, closeDb, getUnreadCount } from './db'
import { registerIpcHandlers, setIntegrationChangedCallback } from './ipc'
import { createScheduler } from './scheduler'
import { initStore } from './store'

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 400,
    height: 600,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    transparent: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
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
    positionWindowNearTray()
    mainWindow.show()
    mainWindow.focus()
  }
}

function positionWindowNearTray() {
  if (!mainWindow) return
  const [winW, winH] = mainWindow.getSize()
  const trayBounds = getTrayBounds()
  const display = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH } = display.workAreaSize
  const workArea = display.workArea

  if (trayBounds && trayBounds.y < screenH / 2) {
    // Tray is on top — position window below tray icon
    const x = Math.max(0, Math.min(
      Math.round(trayBounds.x + trayBounds.width / 2 - winW / 2),
      screenW - winW
    ))
    const y = workArea.y + 8
    mainWindow.setPosition(x, y)
  } else if (trayBounds) {
    // Tray is on bottom — position window above tray icon
    const x = Math.max(0, Math.min(
      Math.round(trayBounds.x + trayBounds.width / 2 - winW / 2),
      screenW - winW
    ))
    const y = workArea.y + workArea.height - winH - 8
    mainWindow.setPosition(x, y)
  } else {
    // Fallback: top-right
    mainWindow.setPosition(screenW - winW - 8, workArea.y + 8)
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

  // Hide on blur, but with a delay to avoid Linux WM false-blur issues
  let blurTimeout: ReturnType<typeof setTimeout> | null = null
  mainWindow.on('blur', () => {
    blurTimeout = setTimeout(() => {
      if (mainWindow && !mainWindow.isFocused()) {
        mainWindow.hide()
      }
    }, 150)
  })
  mainWindow.on('focus', () => {
    if (blurTimeout) {
      clearTimeout(blurTimeout)
      blurTimeout = null
    }
  })
})

app.on('window-all-closed', () => {
  // Don't quit - this is a tray app
})

app.on('before-quit', () => {
  closeDb()
})

export { mainWindow, toggleWindow }
