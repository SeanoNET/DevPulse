import { useRef, useCallback, useState } from 'react'
import type { EventSource, Severity } from '@shared/types'
import { EventCard } from './EventCard'
import { SourceIcon } from './SourceIcon'
import { useEvents } from '../hooks/useEvents'

const SOURCE_FILTERS: { label: string; value?: EventSource }[] = [
  { label: 'All' },
  { label: 'GitHub', value: 'github' },
  { label: 'Jira', value: 'jira' },
  { label: 'Octopus', value: 'octopus' }
]

const SEVERITY_OPTIONS: { label: string; value?: Severity }[] = [
  { label: 'All severities', value: undefined },
  { label: 'Errors only', value: 'error' },
  { label: 'Warnings & errors', value: 'warning' }
]

export function EventFeed() {
  const {
    events,
    loading,
    polling,
    unreadCount,
    filter,
    markRead,
    markAllRead,
    filterBySource,
    filterBySeverity,
    loadMore
  } = useEvents()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [severityOpen, setSeverityOpen] = useState(false)

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

  const currentSeverityLabel = SEVERITY_OPTIONS.find((o) => o.value === filter.severity)?.label ?? 'All severities'
  const hasActiveFilter = filter.source !== undefined || filter.severity !== undefined

  return (
    <div className="flex flex-col h-full">
      {/* Polling progress bar */}
      {polling && (
        <div className="h-0.5 bg-muted overflow-hidden shrink-0">
          <div className="h-full bg-primary/60 animate-progress-indeterminate" />
        </div>
      )}

      {/* Filter bar */}
      <div className="px-3 py-1.5 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          {/* Source icon toggles */}
          {SOURCE_FILTERS.map((f) => {
            const isActive = filter.source === f.value
            return (
              <button
                key={f.label}
                onClick={() => filterBySource(f.value)}
                className={`
                  flex items-center justify-center rounded-md transition-colors
                  ${f.value
                    ? 'w-7 h-7'
                    : 'h-7 px-2 text-[11px] font-medium'
                  }
                  ${isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }
                `}
                title={f.label}
              >
                {f.value ? (
                  <SourceIcon source={f.value} size={14} overrideColor={isActive ? 'currentColor' : undefined} />
                ) : (
                  'All'
                )}
              </button>
            )
          })}

          <span className="w-px h-4 bg-border mx-1" />

          {/* Severity dropdown */}
          <div className="relative">
            <button
              onClick={() => setSeverityOpen(!severityOpen)}
              onBlur={() => setTimeout(() => setSeverityOpen(false), 150)}
              className={`
                flex items-center gap-1 h-7 px-2 text-[11px] rounded-md transition-colors
                ${filter.severity
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }
              `}
            >
              {filter.severity === 'error' && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-severity-error)]" />}
              {filter.severity === 'warning' && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-severity-warning)]" />}
              <span>{currentSeverityLabel}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {severityOpen && (
              <div className="absolute top-full left-0 mt-1 py-1 bg-popover border border-border rounded-lg shadow-lg z-10 min-w-[140px]">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => {
                      filterBySeverity(opt.value)
                      setSeverityOpen(false)
                    }}
                    className={`
                      w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 transition-colors
                      ${filter.severity === opt.value
                        ? 'text-foreground bg-accent'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }
                    `}
                  >
                    {opt.value === 'error' && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-severity-error)]" />}
                    {opt.value === 'warning' && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-severity-warning)]" />}
                    {!opt.value && <span className="w-1.5 h-1.5" />}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="flex-1" />

          {/* Active filter indicator */}
          {hasActiveFilter && (
            <button
              onClick={() => { filterBySource(undefined); filterBySeverity(undefined) }}
              className="text-[10px] text-muted-foreground hover:text-foreground"
              title="Clear all filters"
            >
              Clear
            </button>
          )}

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[10px] text-muted-foreground hover:text-foreground whitespace-nowrap"
            >
              Mark all read
            </button>
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
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
              <path d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[11px]">Loading events...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            {hasActiveFilter ? (
              <>
                <span className="text-xs">No matching events</span>
                <button
                  onClick={() => { filterBySource(undefined); filterBySeverity(undefined) }}
                  className="text-[11px] text-primary hover:underline"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <span className="text-xs font-medium">No events yet</span>
                <span className="text-[11px]">Connect an integration in Settings to get started</span>
              </>
            )}
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
