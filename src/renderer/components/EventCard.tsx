import type { DevEvent } from '@shared/types'
import { SeverityDot } from './SeverityDot'
import { SourceIcon } from './SourceIcon'
import { relativeTime } from '../lib/time'

interface EventCardProps {
  event: DevEvent
  onMarkRead: (id: string) => void
  onOpenUrl: (url: string) => void
}

export function EventCard({ event, onMarkRead, onOpenUrl }: EventCardProps) {
  const handleClick = () => {
    if (!event.read) onMarkRead(event.id)
    onOpenUrl(event.url)
  }

  const handleMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation()
    onMarkRead(event.id)
  }

  return (
    <button
      onClick={handleClick}
      className={`
        group w-full text-left px-3 py-2.5 border-b border-border
        hover:bg-accent transition-colors cursor-pointer
        ${event.read ? 'opacity-50' : ''}
      `}
    >
      <div className="flex items-start gap-2">
        <div className="flex items-center gap-1.5 pt-0.5 shrink-0">
          {!event.read ? (
            <button
              onClick={handleMarkRead}
              className="group/dot"
              title="Mark as read"
            >
              <SeverityDot severity={event.severity} />
            </button>
          ) : (
            <span className="w-2 h-2 shrink-0" />
          )}
          <SourceIcon source={event.source} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium truncate leading-tight" title={event.title}>
              {event.title}
            </p>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
              {relativeTime(event.timestamp)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={event.subtitle}>
            {event.subtitle}
          </p>
        </div>
      </div>
    </button>
  )
}
