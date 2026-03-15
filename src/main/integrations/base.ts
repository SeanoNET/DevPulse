import type { DevEvent, EventSource } from '../../shared/types'

export interface QuickLink {
  label: string
  url: string
}

export interface RunningTask {
  id: string
  title: string
  subtitle: string
  url: string
  source: EventSource
}

export abstract class Integration {
  abstract readonly source: EventSource

  protected lastPollTimestamp: number = 0

  abstract authenticate(): Promise<void>
  abstract testConnection(): Promise<void>
  abstract poll(): Promise<DevEvent[]>
  abstract getQuickLinks(): QuickLink[]

  /** Override to report currently running tasks (shown in tray) */
  async getRunningTasks(): Promise<RunningTask[]> {
    return []
  }

  protected generateEventId(source: EventSource, externalId: string): string {
    return `${source}:${externalId}`
  }
}
