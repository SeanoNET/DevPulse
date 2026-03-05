import type { BrowserWindow } from 'electron'
import { getConfig } from './store'
import { insertEvents, getUnreadCount } from './db'
import { updateTrayBadge } from './tray'
import { dispatchNotification } from './notifications'
import { notifyEventsUpdated } from './ipc'
import { getIntegration } from './integrations/registry'
import type { EventSource } from '../shared/types'

interface SchedulerHandle {
  start: () => void
  stop: () => void
  pollNow: (source?: EventSource) => Promise<void>
}

export function createScheduler(getMainWindow: () => BrowserWindow | null): SchedulerHandle {
  const timers = new Map<string, ReturnType<typeof setInterval>>()

  function start(): void {
    stop()
    const config = getConfig()

    for (const integration of config.integrations) {
      if (!integration.enabled) continue

      const interval = integration.pollIntervalMs || config.general.globalPollIntervalMs
      pollSource(integration.type, getMainWindow)

      const timer = setInterval(() => {
        pollSource(integration.type, getMainWindow)
      }, interval)

      timers.set(integration.type, timer)
    }
  }

  function stop(): void {
    for (const timer of timers.values()) {
      clearInterval(timer)
    }
    timers.clear()
  }

  async function pollNow(source?: EventSource): Promise<void> {
    if (source) {
      await pollSource(source, getMainWindow)
    } else {
      const config = getConfig()
      for (const integration of config.integrations) {
        if (integration.enabled) {
          await pollSource(integration.type, getMainWindow)
        }
      }
    }
  }

  return { start, stop, pollNow }
}

async function pollSource(
  source: EventSource,
  getMainWindow: () => BrowserWindow | null
): Promise<void> {
  try {
    const integration = getIntegration(source)
    if (!integration) return

    const events = await integration.poll()
    if (events.length === 0) return

    const newCount = insertEvents(events)
    if (newCount > 0) {
      const newEvents = events.slice(0, newCount)
      dispatchNotification(newEvents)
      updateTrayBadge(getUnreadCount())
      notifyEventsUpdated(getMainWindow())
    }
  } catch (err) {
    console.error(`[DevPulse] Poll failed for ${source}:`, err)
  }
}
