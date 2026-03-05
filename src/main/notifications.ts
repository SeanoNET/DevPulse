import { Notification, shell } from 'electron'
import type { DevEvent } from '../shared/types'
import { getConfig } from './store'
import { severityAtOrAbove } from '../shared/severity'

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
    showSingle(events[0])
  } else if (events.length <= 5) {
    for (const event of events) showSingle(event)
  } else {
    showGrouped(key, events)
  }
}

function showSingle(event: DevEvent): void {
  const notification = new Notification({
    title: `${sourceLabel(event.source)}: ${event.title}`,
    body: event.subtitle,
    silent: !getConfig().general.notificationSound
  })

  notification.on('click', () => {
    shell.openExternal(event.url)
  })

  notification.show()
}

function showGrouped(source: string, events: DevEvent[]): void {
  const errorCount = events.filter((e) => e.severity === 'error').length
  const body = errorCount > 0
    ? `${events.length} events (${errorCount} errors)`
    : `${events.length} new events`

  const notification = new Notification({
    title: `${sourceLabel(source)} Updates`,
    body,
    silent: !getConfig().general.notificationSound
  })

  notification.on('click', () => {
    if (events.length > 0) {
      shell.openExternal(events[0].url)
    }
  })

  notification.show()
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    github: 'GitHub',
    jira: 'Jira',
    octopus: 'Octopus'
  }
  return labels[source] ?? source
}
