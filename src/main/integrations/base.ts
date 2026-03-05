import type { DevEvent, EventSource } from '../../shared/types'

export interface QuickLink {
  label: string
  url: string
}

export abstract class Integration {
  abstract readonly source: EventSource

  protected lastPollTimestamp: number = 0

  abstract authenticate(): Promise<void>
  abstract testConnection(): Promise<void>
  abstract poll(): Promise<DevEvent[]>
  abstract getQuickLinks(): QuickLink[]

  protected generateEventId(source: EventSource, externalId: string): string {
    return `${source}:${externalId}`
  }
}
