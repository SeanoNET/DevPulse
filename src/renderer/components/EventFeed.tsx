import { useRef, useCallback } from 'react'
import type { EventSource, Severity } from '@shared/types'
import { EventCard } from './EventCard'
import { useEvents } from '../hooks/useEvents'

const SOURCE_FILTERS: { label: string; value?: EventSource }[] = [
  { label: 'All' },
  { label: 'GitHub', value: 'github' },
  { label: 'Jira', value: 'jira' },
  { label: 'Octopus', value: 'octopus' }
]

const SEVERITY_FILTERS: { label: string; value?: Severity }[] = [
  { label: 'All' },
  { label: 'Errors', value: 'error' },
  { label: 'Warnings', value: 'warning' }
]

export function EventFeed() {
  const {
    events,
    loading,
    unreadCount,
    filter,
    markRead,
    markAllRead,
    filterBySource,
    filterBySeverity,
    loadMore
  } = useEvents()

  const scrollRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
      loadMore()
    }
  }, [loadMore])

  const handleOpenUrl = useCallback((url: string) => {
    window.api.openExternal(url)
  }, [])

  const handleMarkRead = useCallback((id: string) => {
    markRead([id])
  }, [markRead])

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1 flex-wrap">
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => filterBySource(f.value)}
              className={`
                px-2 py-0.5 text-[11px] rounded-full whitespace-nowrap transition-colors
                ${filter.source === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }
              `}
            >
              {f.label}
            </button>
          ))}
          <span className="w-px h-3 bg-border mx-0.5" />
          {SEVERITY_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => filterBySeverity(f.value)}
              className={`
                px-2 py-0.5 text-[11px] rounded-full whitespace-nowrap transition-colors
                ${filter.severity === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }
              `}
            >
              {f.label}
            </button>
          ))}
          {unreadCount > 0 && (
            <>
              <span className="flex-1" />
              <button
                onClick={markAllRead}
                className="text-[10px] text-muted-foreground hover:text-foreground whitespace-nowrap"
              >
                Mark all read
              </button>
            </>
          )}
        </div>
      </div>

      {/* Event list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-xs">
            Loading...
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-1 text-muted-foreground">
            <span className="text-2xl">-</span>
            <span className="text-xs">No events yet</span>
            <span className="text-[10px]">Connect an integration in Settings</span>
          </div>
        ) : (
          events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onMarkRead={handleMarkRead}
              onOpenUrl={handleOpenUrl}
            />
          ))
        )}
      </div>
    </div>
  )
}
