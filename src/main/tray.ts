import { Tray, Menu, app, shell } from 'electron'
import type { RunningTask } from './integrations/base'
import { generateIcon, cleanupIcons, type TrayIconState } from './tray-icons'

let tray: Tray | null = null
let onToggle: (() => void) | null = null
let currentRunningTasks: RunningTask[] = []
let setQuitting: (() => void) | null = null

// Animation state
let animTimer: ReturnType<typeof setInterval> | null = null
let animFrame = 0
let currentState: TrayIconState = 'normal'

export function setQuittingCallback(cb: () => void): void {
  setQuitting = cb
}

export function createTray(toggleCallback: () => void): void {
  onToggle = toggleCallback
  const icon = generateIcon('normal')
  tray = new Tray(icon)
  tray.setToolTip('DevPulse')

  tray.on('click', () => {
    if (currentRunningTasks.length === 1) {
      shell.openExternal(currentRunningTasks[0].url)
    } else {
      onToggle?.()
    }
  })

  updateContextMenu(0)
}

function updateContextMenu(unreadCount: number): void {
  if (!tray) return

  const menuItems: Electron.MenuItemConstructorOptions[] = [
    {
      label: `DevPulse${unreadCount > 0 ? ` (${unreadCount})` : ''}`,
      enabled: false
    },
    { type: 'separator' }
  ]

  if (currentRunningTasks.length > 0) {
    menuItems.push({
      label: `▶ ${currentRunningTasks.length} running`,
      enabled: false
    })
    for (const task of currentRunningTasks) {
      menuItems.push({
        label: `  ${task.title}`,
        sublabel: task.subtitle,
        click: () => shell.openExternal(task.url)
      })
    }
    menuItems.push({ type: 'separator' })
  }

  menuItems.push(
    {
      label: 'Show/Hide',
      click: () => onToggle?.()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        stopAnimation()
        cleanupIcons()
        setQuitting?.()
        app.quit()
      }
    }
  )

  tray.setContextMenu(Menu.buildFromTemplate(menuItems))
}

export function updateRunningTasks(tasks: RunningTask[]): void {
  const wasRunning = currentRunningTasks.length > 0
  const isRunning = tasks.length > 0
  currentRunningTasks = tasks

  if (isRunning) {
    setTrayState('running')
    const names = tasks.map((t) => t.title).join(', ')
    tray?.setToolTip(`DevPulse — Running: ${names}`)
  } else if (wasRunning) {
    setTrayState('normal')
    tray?.setToolTip('DevPulse')
  }
}

export function updateTrayBadge(count: number): void {
  updateContextMenu(count)
  if (currentRunningTasks.length === 0) {
    setTrayState('normal')
  }
}

function stopAnimation(): void {
  if (animTimer) {
    clearInterval(animTimer)
    animTimer = null
  }
}

export function setTrayState(state: TrayIconState): void {
  if (!tray || state === currentState) return
  currentState = state
  stopAnimation()

  if (state === 'running') {
    animFrame = 0
    tray.setImage(generateIcon('running', 0))

    // Each tick generates a fresh icon written to a unique temp file,
    // which is required on Linux (AppIndicator caches icons by path).
    animTimer = setInterval(() => {
      if (!tray) return
      animFrame = (animFrame + 1) % 4
      tray.setImage(generateIcon('running', animFrame))
    }, 350)
  } else {
    tray.setImage(generateIcon(state))
  }
}
