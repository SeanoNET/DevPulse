import { BrowserWindow, screen, shell } from 'electron'
import { execFile } from 'child_process'
import type { DevEvent } from '../shared/types'
import { getConfig } from './store'

const WINDOW_WIDTH = 360
const WINDOW_HEIGHT = 120
const WINDOW_GAP = 8
const SCREEN_MARGIN = 12

/** Track active notification windows for stacking */
const activeWindows: BrowserWindow[] = []

let notifCounter = 0

interface NotificationData {
  title: string
  body: string
  source: string
  severity: string
  url: string
}

// SVG paths for source icons (same as SourceIcon.tsx)
const SOURCE_PATHS: Record<string, string> = {
  github: 'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z',
  jira: 'M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.97 4.35 4.35 4.35V2.84A.84.84 0 0021.17 2H11.53zm-4.47 4.47c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.97 4.35 4.35 4.35V7.31a.84.84 0 00-.84-.84H7.06zm-4.47 4.47c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.97 4.35 4.35 4.35v-9.56a.84.84 0 00-.84-.84H2.59z',
  octopus: 'M2.18 18.212c1.805-1.162 3.928-3.162 3.122-5.51-.437-1.282-1.046-2.379-1.127-3.762a8.478 8.478 0 0 1 .515-3.46C6.31 1.14 11.126-.917 15.481.389c4.03 1.216 6.808 5.893 5.119 9.973-.965 2.356-1.395 4.173.755 6.006.582.496 2 1.24 1.992 2.123 0 1.163-2.27-.244-2.522-.445.286.503 3.138 3.487 1.325 3.688-1.67.194-3.147-2.139-4.15-3.142-1.686-1.682-1.395 2.042-1.403 2.81 0 1.212-.868 3.676-2.41 2.072-1.27-1.321-.775-3.433-1.674-4.905-.968-1.612-2.58 1.612-2.983 2.2-.45.66-2.713 3.844-3.596 2.147-.725-1.38.434-3.538 1.007-4.785-.209.453-1.685 1.123-2.115 1.34a5.738 5.738 0 0 1-3.057.706c-2.267-.163-.527-1.368.387-1.96l.023-.005z'
}

const SEVERITY_COLORS: Record<string, string> = {
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  success: '#22c55e'
}

const SOURCE_COLORS: Record<string, string> = {
  github: '#8b949e',
  jira: '#2684ff',
  octopus: '#2f93e0'
}

/** Detect which Wayland compositor is running (if any) */
function getCompositor(): 'sway' | 'hyprland' | null {
  if (process.env.SWAYSOCK) return 'sway'
  if (process.env.HYPRLAND_INSTANCE_SIGNATURE) return 'hyprland'
  return null
}

/** Move a window via compositor IPC (Sway/Hyprland) */
function compositorMove(windowTitle: string, x: number, y: number): void {
  const compositor = getCompositor()
  if (!compositor) return

  if (compositor === 'sway') {
    execFile('swaymsg', [
      `[title="^${windowTitle}$"]`,
      'move', 'position', `${x}`, `${y}`
    ], (err) => {
      if (err) console.error('[DevPulse] swaymsg move failed:', err.message)
    })
  } else if (compositor === 'hyprland') {
    // Find window by title and move it
    execFile('hyprctl', [
      'dispatch', 'movewindowpixel',
      `exact ${x} ${y}`,
      `title:^${windowTitle}$`
    ], (err) => {
      if (err) console.error('[DevPulse] hyprctl move failed:', err.message)
    })
  }
}

function buildNotificationHtml(data: NotificationData): string {
  const severityColor = SEVERITY_COLORS[data.severity] || SEVERITY_COLORS.info
  const sourceColor = SOURCE_COLORS[data.source] || '#8b949e'
  const iconPath = SOURCE_PATHS[data.source] || ''

  // Escape text content for safe HTML embedding
  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const title = escapeHtml(data.title)
  const body = escapeHtml(data.body)

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html{background:transparent}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:transparent;color:#cdd6f4;overflow:hidden;cursor:default;user-select:none;padding:4px}
.n{display:flex;height:calc(100% - 8px);min-height:80px;animation:s .2s ease-out;background:#1e1e2e;border-radius:10px;border:1px solid rgba(255,255,255,0.1);box-shadow:0 4px 20px rgba(0,0,0,0.5)}
.sb{width:4px;flex-shrink:0;border-radius:10px 0 0 10px;background:${severityColor}}
.ia{display:flex;align-items:center;justify-content:center;width:44px;flex-shrink:0;opacity:.8;color:${sourceColor}}
.ia svg{width:20px;height:20px}
.c{flex:1;padding:10px 8px 10px 0;display:flex;flex-direction:column;justify-content:center;min-width:0}
.t{font-size:12px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.b{font-size:11px;color:#a6adc8;line-height:1.3;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.x{position:absolute;top:6px;right:8px;width:18px;height:18px;border:none;background:none;color:#6c7086;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:4px;line-height:1}
.x:hover{color:#cdd6f4;background:rgba(255,255,255,0.1)}
.n:hover{background:rgba(255,255,255,0.03)}
@keyframes s{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
</style></head><body>
<div class="n" id="n">
  <div class="sb"></div>
  <div class="ia"><svg viewBox="0 0 24 24" fill="currentColor"><path d="${iconPath}"/></svg></div>
  <div class="c"><div class="t">${title}</div><div class="b">${body}</div></div>
  <button class="x" id="x">&times;</button>
</div>
<script>
document.getElementById('x').addEventListener('click',function(e){e.stopPropagation();window.close()});
document.getElementById('n').addEventListener('click',function(){console.log('notification:click')});
</script></body></html>`
}

function getWindowPosition(index: number): { x: number; y: number } {
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.workAreaSize
  const { x: workX, y: workY } = display.workArea

  // On Wayland, workArea may not account for panels like waybar.
  const BOTTOM_MARGIN = getCompositor() ? 48 : 0
  const gap = getCompositor() ? WINDOW_GAP : 4

  return {
    x: workX + width - WINDOW_WIDTH - SCREEN_MARGIN,
    y: workY + height - (WINDOW_HEIGHT + gap) * (index + 1) - BOTTOM_MARGIN
  }
}

function repositionWindow(win: BrowserWindow, pos: { x: number; y: number }): void {
  if (win.isDestroyed()) return

  if (getCompositor()) {
    compositorMove(win.getTitle(), pos.x, pos.y)
  } else {
    win.setPosition(pos.x, pos.y, false)
  }
}

function removeFromStack(win: BrowserWindow): void {
  const idx = activeWindows.indexOf(win)
  if (idx !== -1) {
    activeWindows.splice(idx, 1)
    for (let i = idx; i < activeWindows.length; i++) {
      const pos = getWindowPosition(i)
      repositionWindow(activeWindows[i], pos)
    }
  }
}

export function showNotificationWindow(data: NotificationData): void {
  const config = getConfig()
  const durationMs = config.notifications.notificationDurationMs || 10_000

  const pos = getWindowPosition(activeWindows.length)
  const windowTitle = `devpulse-notif-${notifCounter++}`

  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: pos.x,
    y: pos.y,
    title: windowTitle,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    transparent: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  activeWindows.push(win)

  const html = buildNotificationHtml(data)
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  win.once('ready-to-show', () => {
    win.showInactive()
    // On Wayland, compositors ignore Electron's x/y positioning.
    // Use compositor IPC (swaymsg/hyprctl) to move the window.
    if (getCompositor()) {
      setTimeout(() => compositorMove(windowTitle, pos.x, pos.y), 50)
    }
  })

  win.webContents.on('will-navigate', (e) => {
    e.preventDefault()
  })

  // Handle click via console message (sandboxed window with no preload)
  win.webContents.on('console-message', (event) => {
    const message = event.message
    if (message === 'notification:click' && data.url) {
      try {
        const parsed = new URL(data.url)
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          shell.openExternal(data.url)
        }
      } catch { /* invalid URL, ignore */ }
      closeNotificationWindow(win)
    }
  })

  const dismissTimer = setTimeout(() => {
    closeNotificationWindow(win)
  }, durationMs)

  win.on('closed', () => {
    clearTimeout(dismissTimer)
    removeFromStack(win)
  })
}

function closeNotificationWindow(win: BrowserWindow): void {
  if (!win.isDestroyed()) {
    win.close()
  }
}

export function showSingleNotification(event: DevEvent): void {
  showNotificationWindow({
    title: `${sourceLabel(event.source)}: ${event.title}`,
    body: event.subtitle,
    source: event.source,
    severity: event.severity,
    url: event.url
  })
}

export function showGroupedNotification(source: string, events: DevEvent[]): void {
  const errorCount = events.filter((e) => e.severity === 'error').length
  const body = errorCount > 0
    ? `${events.length} events (${errorCount} errors)`
    : `${events.length} new events`

  showNotificationWindow({
    title: `${sourceLabel(source)} Updates`,
    body,
    source,
    severity: errorCount > 0 ? 'error' : 'info',
    url: events.length > 0 ? events[0].url : ''
  })
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    github: 'GitHub',
    jira: 'Jira',
    octopus: 'Octopus'
  }
  return labels[source] ?? source
}
