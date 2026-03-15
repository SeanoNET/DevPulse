import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import type { DevEvent, EventFilter } from '../shared/types'

let db: Database.Database

export function initDb(): void {
  const dbPath = join(app.getPath('userData'), 'devpulse.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      url TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      read INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
    CREATE INDEX IF NOT EXISTS idx_events_read ON events(read);
  `)
}

export function insertEvents(events: DevEvent[]): number {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO events (id, source, severity, title, subtitle, timestamp, url, metadata, read)
    VALUES (@id, @source, @severity, @title, @subtitle, @timestamp, @url, @metadata, @read)
  `)

  const insertMany = db.transaction((items: DevEvent[]) => {
    let inserted = 0
    for (const event of items) {
      const result = stmt.run({
        ...event,
        metadata: JSON.stringify(event.metadata),
        read: event.read ? 1 : 0
      })
      if (result.changes > 0) inserted++
    }
    return inserted
  })

  return insertMany(events)
}

export function getEvents(filter?: EventFilter): DevEvent[] {
  const conditions: string[] = []
  const params: Record<string, unknown> = {}

  if (filter?.source) {
    conditions.push('source = @source')
    params.source = filter.source
  }
  if (filter?.severity) {
    conditions.push('severity = @severity')
    params.severity = filter.severity
  }
  if (filter?.read !== undefined) {
    conditions.push('read = @read')
    params.read = filter.read ? 1 : 0
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filter?.limit ?? 100
  const offset = filter?.offset ?? 0

  const rows = db.prepare(`
    SELECT * FROM events ${where} ORDER BY timestamp DESC LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset }) as Array<Record<string, unknown>>

  return rows.map(rowToEvent)
}

export function markRead(ids: string[]): void {
  const stmt = db.prepare('UPDATE events SET read = 1 WHERE id = ?')
  const markMany = db.transaction((items: string[]) => {
    for (const id of items) stmt.run(id)
  })
  markMany(ids)
}

export function markAllRead(): void {
  db.prepare('UPDATE events SET read = 1 WHERE read = 0').run()
}

export function getUnreadCount(): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM events WHERE read = 0').get() as { count: number }
  return row.count
}

export function pruneOldEvents(maxAgeDays: number = 30): void {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
  db.prepare('DELETE FROM events WHERE timestamp < ?').run(cutoff)
}

function rowToEvent(row: Record<string, unknown>): DevEvent {
  return {
    id: row.id as string,
    source: row.source as DevEvent['source'],
    severity: row.severity as DevEvent['severity'],
    title: row.title as string,
    subtitle: row.subtitle as string,
    timestamp: row.timestamp as number,
    url: row.url as string,
    metadata: JSON.parse(row.metadata as string),
    read: row.read === 1
  }
}

export function getExistingEventIds(ids: string[]): Set<string> {
  if (ids.length === 0) return new Set()
  const placeholders = ids.map(() => '?').join(',')
  const rows = db.prepare(`SELECT id FROM events WHERE id IN (${placeholders})`).all(...ids) as { id: string }[]
  return new Set(rows.map((r) => r.id))
}

export function deleteEventsBySource(source: string): number {
  const result = db.prepare('DELETE FROM events WHERE source = ?').run(source)
  return result.changes
}

export function deleteAllEvents(): number {
  const result = db.prepare('DELETE FROM events').run()
  return result.changes
}

export function closeDb(): void {
  db?.close()
}
