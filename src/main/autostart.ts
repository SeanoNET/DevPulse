import { app } from 'electron'

export function setAutostart(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    name: 'DevPulse'
  })
}

export function getAutostartEnabled(): boolean {
  return app.getLoginItemSettings().openAtLogin
}
