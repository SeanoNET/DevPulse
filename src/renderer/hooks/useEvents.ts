import { useState, useEffect, useCallback } from 'react'
import type { DevEvent, EventFilter, EventSource, Severity } from '@shared/types'

export function useEvents() {
  const [events, setEvents] = useState<DevEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const [filter, setFilter] = useState<EventFilter>({})
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const data = await window.api.getEvents(filter)
      setEvents(data)
    } catch (err) {
      console.error('Failed to fetch events:', err)
    } finally {
      setLoading(false)
    }
  }, [filter])

  const refreshUnread = useCallback(async () => {
    try {
      const count = await window.api.getUnreadCount()
      setUnreadCount(count)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    refresh()
    refreshUnread()
  }, [refresh, refreshUnread])

  useEffect(() => {
    const unsub = window.api.onEventsUpdated(() => {
      refresh()
      refreshUnread()
    })
    return unsub
  }, [refresh, refreshUnread])

  useEffect(() => {
    const unsub = window.api.onUnreadCountChanged((count) => {
      setUnreadCount(count)
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = window.api.onPollingStateChanged((state) => {
      setPolling(state)
    })
    return unsub
  }, [])

  const markRead = useCallback(async (ids: string[]) => {
    await window.api.markRead(ids)
    setEvents((prev) => prev.map((e) => (ids.includes(e.id) ? { ...e, read: true } : e)))
    refreshUnread()
  }, [refreshUnread])

  const markAllRead = useCallback(async () => {
    await window.api.markAllRead()
    setEvents((prev) => prev.map((e) => ({ ...e, read: true })))
    setUnreadCount(0)
  }, [])

  const filterBySource = useCallback((source?: EventSource) => {
    setFilter((prev) => ({ ...prev, source, offset: 0 }))
  }, [])

  const filterBySeverity = useCallback((severity?: Severity) => {
    setFilter((prev) => ({ ...prev, severity, offset: 0 }))
  }, [])

  const loadMore = useCallback(async () => {
    const offset = events.length
    try {
      const more = await window.api.getEvents({ ...filter, offset })
      if (more.length > 0) {
        setEvents((prev) => [...prev, ...more])
      }
    } catch {
      // ignore
    }
  }, [events.length, filter])

  return {
    events,
    loading,
    polling,
    unreadCount,
    filter,
    markRead,
    markAllRead,
    filterBySource,
    filterBySeverity,
    loadMore,
    refresh
  }
}
