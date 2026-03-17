import { app } from 'electron'
import { join } from 'path'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { mkdirSync } from 'fs'

function getLinuxDesktopPath(): string {
  const autostartDir = join(app.getPath('home'), '.config', 'autostart')
  return join(autostartDir, 'devpulse.desktop')
}

function getLinuxExecPath(): string {
  // APPIMAGE env var is set by AppImage runtime to the actual .AppImage path
  return process.env['APPIMAGE'] || process.execPath
}

function setAutostartLinux(enabled: boolean): void {
  const desktopPath = getLinuxDesktopPath()

  if (enabled) {
    const autostartDir = join(app.getPath('home'), '.config', 'autostart')
    mkdirSync(autostartDir, { recursive: true })

    const entry = [
      '[Desktop Entry]',
      'Type=Application',
      'Name=DevPulse',
      'Comment=CI/CD event aggregator',
      `Exec=${getLinuxExecPath()}`,
      'X-GNOME-Autostart-enabled=true',
      ''
    ].join('\n')

    writeFileSync(desktopPath, entry, 'utf-8')
  } else {
    if (existsSync(desktopPath)) {
      unlinkSync(desktopPath)
    }
  }
}

function getAutostartLinux(): boolean {
  return existsSync(getLinuxDesktopPath())
}

export function setAutostart(enabled: boolean): void {
  if (process.platform === 'linux') {
    setAutostartLinux(enabled)
  } else {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      name: 'DevPulse'
    })
  }
}

export function getAutostartEnabled(): boolean {
  if (process.platform === 'linux') {
    return getAutostartLinux()
  }
  return app.getLoginItemSettings().openAtLogin
}
