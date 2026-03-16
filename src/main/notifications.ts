import type { DevEvent } from '../shared/types'
import { getConfig } from './store'
import { severityAtOrAbove } from '../shared/severity'
import { showSingleNotification, showGroupedNotification } from './notification-window'

interface PendingGroup {
  source: string
  events: DevEvent[]
  timer: ReturnType<typeof setTimeout>
}

const pendingGroups = new Map<string, PendingGroup>()

export function dispatchNotification(events: DevEvent[]): void {
  const config = getConfig()
  if (!config.notifications.enabled) return

  const filtered = events.filter((event) => {
    const integration = config.integrations.find((i) => i.type === event.source)
    if (!integration?.enabled) return false
    return severityAtOrAbove(event.severity, integration.severityThreshold)
  })

  if (filtered.length === 0) return

  for (const event of filtered) {
    addToGroup(event, config.notifications.groupingWindowMs)
  }
}

function addToGroup(event: DevEvent, windowMs: number): void {
  const key = event.source
  const existing = pendingGroups.get(key)

  if (existing) {
    existing.events.push(event)
    return
  }

  const group: PendingGroup = {
    source: key,
    events: [event],
    timer: setTimeout(() => flushGroup(key), windowMs)
  }
  pendingGroups.set(key, group)
}

function flushGroup(key: string): void {
  const group = pendingGroups.get(key)
  if (!group) return
  pendingGroups.delete(key)

  const { events } = group

  if (events.length === 1) {
    showSingleNotification(events[0])
  } else if (events.length <= 5) {
    for (const event of events) showSingleNotification(event)
  } else {
    showGroupedNotification(key, events)
  }
}
