import { useState, useEffect } from 'react'
import type { IpcApi } from '@shared/types'
import { EventFeed } from './components/EventFeed'
import { Settings } from './components/Settings'

declare global {
  interface Window {
    api: IpcApi
  }
}

type View = 'feed' | 'settings'

export function App() {
  const [view, setView] = useState<View>('feed')
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    window.api.getUnreadCount().then(setUnreadCount).catch(() => {})
    const unsub = window.api.onUnreadCountChanged((count) => setUnreadCount(count))
    return unsub
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border titlebar">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold">DevPulse</h1>
          {unreadCount > 0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 no-drag">
          <button
            onClick={() => setView(view === 'feed' ? 'settings' : 'feed')}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            aria-label={view === 'feed' ? 'Open settings' : 'Back to feed'}
          >
            {view === 'feed' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            )}
          </button>
          <button
            onClick={() => window.api.minimizeWindow()}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            aria-label="Minimize"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
            </svg>
          </button>
          <button
            onClick={() => window.api.hideWindow()}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {view === 'feed' ? <EventFeed /> : <Settings />}
      </main>
    </div>
  )
}
