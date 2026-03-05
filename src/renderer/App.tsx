import { useState } from 'react'
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

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border">
        <h1 className="text-sm font-semibold">DevPulse</h1>
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
      </header>
      <main className="flex-1 overflow-hidden">
        {view === 'feed' ? <EventFeed /> : <Settings />}
      </main>
    </div>
  )
}
