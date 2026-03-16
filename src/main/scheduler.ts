import type { BrowserWindow } from 'electron'
import { getConfig, updateConfig } from './store'
import { insertEvents, getUnreadCount, getExistingEventIds, supersedePriorStates } from './db'
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

/** Track which integrations are in fast-poll mode */
const activePolling = new Map<EventSource, boolean>()

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

  function scheduleSource(source: EventSource, intervalMs: number): void {
    const existing = timers.get(source)
    if (existing) clearInterval(existing)

    const timer = setInterval(() => {
      pollSource(source, getMainWindow)
    }, intervalMs)
    timers.set(source, timer)
  }

  function start(): void {
    stop()
    syncConnectedSources()
    const config = getConfig()

    for (const integration of config.integrations) {
      if (!integration.enabled) continue

      const interval = integration.pollIntervalMs || config.general.globalPollIntervalMs
      pollSource(integration.type, getMainWindow)
      scheduleSource(integration.type, interval)
    }
  }

  function stop(): void {
    for (const timer of timers.values()) {
      clearInterval(timer)
    }
    timers.clear()
    activePolling.clear()
  }

  function reschedule(source: EventSource, intervalMs: number): void {
    scheduleSource(source, intervalMs)
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

  // Expose reschedule for adaptive polling
  schedulerReschedule = reschedule

  return { start, stop, pollNow }
}

let schedulerReschedule: ((source: EventSource, intervalMs: number) => void) | null = null

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
        supersedePriorStates(newEvents)
        dispatchNotification(newEvents)
        updateTrayBadge(getUnreadCount())
        notifyEventsUpdated(getMainWindow())
      }
    }

    // Check all integrations for running tasks and update tray
    await refreshRunningTasks()

    // Adaptive polling: speed up when there are active items (skip Jira)
    if (source !== 'jira' && schedulerReschedule) {
      const config = getConfig()
      const hasActive = integration.hasActiveItems()
      const wasActive = activePolling.get(source) ?? false

      if (hasActive && !wasActive) {
        const fastInterval = config.general.fastPollIntervalMs || 15_000
        schedulerReschedule(source, fastInterval)
        activePolling.set(source, true)
        console.log(`[DevPulse] ${source} has active items — fast polling at ${fastInterval}ms`)
      } else if (!hasActive && wasActive) {
        const normalInterval = config.general.globalPollIntervalMs || 60_000
        schedulerReschedule(source, normalInterval)
        activePolling.set(source, false)
        console.log(`[DevPulse] ${source} no active items — normal polling at ${normalInterval}ms`)
      }
    }
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
