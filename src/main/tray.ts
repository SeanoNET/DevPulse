import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'path'

let tray: Tray | null = null
let onToggle: (() => void) | null = null

type TrayState = 'normal' | 'error' | 'paused'

const iconFiles: Record<TrayState, string> = {
  normal: 'tray-icon.png',
  error: 'tray-icon-error.png',
  paused: 'tray-icon-paused.png'
}

function getIconPath(state: TrayState): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, iconFiles[state])
  }
  return join(app.getAppPath(), 'resources', iconFiles[state])
}

export function createTray(toggleCallback: () => void): void {
  onToggle = toggleCallback
  const icon = nativeImage.createFromPath(getIconPath('normal'))
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('DevPulse')

  tray.on('click', () => {
    onToggle?.()
  })

  updateContextMenu(0)
}

function updateContextMenu(unreadCount: number): void {
  if (!tray) return

  const menu = Menu.buildFromTemplate([
    {
      label: `DevPulse${unreadCount > 0 ? ` (${unreadCount})` : ''}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Show/Hide',
      click: () => onToggle?.()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(menu)
}

export function updateTrayBadge(count: number): void {
  updateContextMenu(count)
  setTrayState(count > 0 ? 'normal' : 'normal')
}

export function getTrayBounds(): Electron.Rectangle | null {
  return tray?.getBounds() ?? null
}

export function setTrayState(state: TrayState): void {
  if (!tray) return
  const icon = nativeImage.createFromPath(getIconPath(state))
  tray.setImage(icon.resize({ width: 16, height: 16 }))
}
