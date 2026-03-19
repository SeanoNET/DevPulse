import type { DevEvent } from '@shared/types'
import { SeverityDot } from './SeverityDot'
import { SourceIcon } from './SourceIcon'
import { relativeTime } from '../lib/time'

interface EventCardProps {
  event: DevEvent
  onMarkRead: (id: string) => void
  onOpenUrl: (url: string) => void
}

const TAG_PATTERN = /^v?\d+\.\d+\.\d+/
const VERSION_IN_TEXT = /\bv?\d+\.\d+\.\d+[^\s]*/

function formatSubtitle(subtitle: string) {
  // Match the ref in parentheses like (main) or (v0.5.7)
  const match = subtitle.match(/\(([^)]+)\)/)
  if (!match) return <>{subtitle}</>

  const ref = match[1]
  const isTag = TAG_PATTERN.test(ref)
  if (!isTag) return <>{subtitle}</>

  const before = subtitle.slice(0, match.index!)
  const after = subtitle.slice(match.index! + match[0].length)

  return (
    <>
      {before}
      <span className="text-[var(--color-severity-success)] font-medium">({ref})</span>
      {after}
    </>
  )
}

function formatTitle(title: string) {
  const match = title.match(VERSION_IN_TEXT)
  if (!match) return <>{title}</>

  const before = title.slice(0, match.index!)
  const after = title.slice(match.index! + match[0].length)

  return (
    <>
      {before}
      <span className="text-[var(--color-severity-success)] font-medium">{match[0]}</span>
      {after}
    </>
  )
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

  const isInProgress = event.metadata?.status === 'in_progress' || event.metadata?.status === 'queued'

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
              <SeverityDot severity={event.severity} pulse={isInProgress} />
            </button>
          ) : (
            <span className="w-2 h-2 shrink-0" />
          )}
          <SourceIcon source={event.source} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium truncate leading-tight" title={event.title}>
              {formatTitle(event.title)}
            </p>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
              {relativeTime(event.timestamp)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={event.subtitle}>
            {formatSubtitle(event.subtitle)}
          </p>
        </div>
      </div>
    </button>
  )
}
