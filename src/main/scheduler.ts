import type { BrowserWindow } from 'electron'
import { getConfig, updateConfig } from './store'
import { insertEvents, getUnreadCount, getExistingEventIds } from './db'
import { updateTrayBadge, updateRunningTasks } from './tray'
import { dispatchNotification } from './notifications'
import { notifyEventsUpdated, notifyPollingState } from './ipc'
import { getIntegration, getAllIntegrations } from './integrations/registry'
import type { EventSource, IntegrationConfig } from '../shared/types'
import { hasCredential } from './auth'

interface SchedulerHandle {
  start: () => void
  stop: () => void
  pollNow: (source?: EventSource) => Promise<void>
}

/**
 * Ensure any connected source that has credentials but is missing from
 * config.integrations gets added automatically (handles upgrades / edge cases).
 */
function syncConnectedSources(): void {
  const config = getConfig()
  const configuredTypes = new Set(config.integrations.map((i) => i.type))
  const allSources: EventSource[] = ['github', 'jira', 'octopus']
  let changed = false

  for (const source of allSources) {
    if (configuredTypes.has(source)) continue
    if (!hasCredential(`${source}:token`) && !hasCredential(`${source}:api-key`)) continue

    const entry: IntegrationConfig = {
      id: source,
      type: source,
      enabled: true,
      pollIntervalMs: config.general.globalPollIntervalMs,
      severityThreshold: 'info'
    }
    config.integrations.push(entry)
    changed = true
    console.log(`[DevPulse] Auto-registered ${source} integration from existing credentials`)
  }

  if (changed) {
    updateConfig({ integrations: config.integrations })
  }
}

export function createScheduler(getMainWindow: () => BrowserWindow | null): SchedulerHandle {
  const timers = new Map<string, ReturnType<typeof setInterval>>()

  function start(): void {
    stop()
    syncConnectedSources()
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

let activePollCount = 0

async function pollSource(
  source: EventSource,
  getMainWindow: () => BrowserWindow | null
): Promise<void> {
  try {
    const integration = getIntegration(source)
    if (!integration) return

    activePollCount++
    if (activePollCount === 1) {
      notifyPollingState(getMainWindow(), true)
    }

    console.log(`[DevPulse] Polling ${source}...`)
    const events = await integration.poll()
    console.log(`[DevPulse] ${source} returned ${events.length} events`)
    if (events.length > 0) {
      const existingIds = getExistingEventIds(events.map((e) => e.id))
      const newCount = insertEvents(events)
      if (newCount > 0) {
        const newEvents = events.filter((e) => !existingIds.has(e.id))
        dispatchNotification(newEvents)
        updateTrayBadge(getUnreadCount())
        notifyEventsUpdated(getMainWindow())
      }
    }

    // Check all integrations for running tasks and update tray
    await refreshRunningTasks()
  } catch (err) {
    console.error(`[DevPulse] Poll failed for ${source}:`, err)
  } finally {
    activePollCount = Math.max(0, activePollCount - 1)
    if (activePollCount === 0) {
      notifyPollingState(getMainWindow(), false)
    }
  }
}

async function refreshRunningTasks(): Promise<void> {
  try {
    const integrations = getAllIntegrations()
    const allRunning = await Promise.all(
      integrations.map((i) => i.getRunningTasks().catch(() => []))
    )
    updateRunningTasks(allRunning.flat())
  } catch (err) {
    console.error('[DevPulse] Running tasks check failed:', err)
  }
}
