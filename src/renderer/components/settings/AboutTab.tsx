import { useEffect, useState } from 'react'

type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloaded' | 'error'

export function AboutTab() {
  const [version, setVersion] = useState<string>('')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateVersion, setUpdateVersion] = useState<string>('')
  const [updateError, setUpdateError] = useState<string>('')

  useEffect(() => {
    window.api.getVersion().then(setVersion)
    return window.api.onUpdateDownloaded(() => {
      setUpdateStatus('downloaded')
    })
  }, [])

  const handleCheckForUpdates = async () => {
    setUpdateStatus('checking')
    setUpdateError('')
    const result = await window.api.checkForUpdates()
    if (result.status === 'available' || result.status === 'downloaded') {
      setUpdateVersion(result.version ?? '')
    } else if (result.status === 'error') {
      setUpdateError(result.error ?? 'Unknown error')
    }
    setUpdateStatus(result.status)
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold">About</h2>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#6366f1] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1,16 7,16 9,13 11,16 13,16 15,4 17,28 19,14 21,16 24,14 27,16 31,16" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium">DevPulse</p>
            {version && <p className="text-[11px] text-muted-foreground">v{version}</p>}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Unified CI/CD event timeline for developers. Aggregates events from
          GitHub, Jira, and Octopus Deploy into a single notification feed.
        </p>
      </div>

      <div className="pt-2 border-t border-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs">Updates</span>
          <button
            onClick={handleCheckForUpdates}
            disabled={updateStatus === 'checking'}
            className="text-[11px] px-3 py-1 rounded border border-input bg-background hover:bg-muted transition-colors disabled:opacity-50"
          >
            {updateStatus === 'checking' ? 'Checking...' : 'Check for updates'}
          </button>
        </div>

        {updateStatus === 'up-to-date' && (
          <p className="text-[11px] text-muted-foreground">You're on the latest version.</p>
        )}

        {updateStatus === 'available' && (
          <p className="text-[11px] text-[var(--color-severity-info)]">
            v{updateVersion} is available — downloading in the background.
          </p>
        )}

        {updateStatus === 'downloaded' && (
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-[var(--color-severity-success)]">
              v{updateVersion} is ready to install.
            </p>
            <button
              onClick={() => window.api.installUpdate()}
              className="text-[11px] px-3 py-1 rounded border border-green-600 bg-green-600/10 text-green-400 hover:bg-green-600/20 transition-colors"
            >
              Restart now
            </button>
          </div>
        )}

        {updateStatus === 'error' && (
          <p className="text-[11px] text-[var(--color-severity-error)]">
            {updateError}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <button
          onClick={() => window.api.openExternal('https://github.com/seanonet/devpulse')}
          className="text-[11px] text-[var(--color-source-jira)] hover:underline block"
        >
          View on GitHub
        </button>
        <button
          onClick={() => window.api.openExternal('https://github.com/seanonet/devpulse/issues')}
          className="text-[11px] text-[var(--color-source-jira)] hover:underline block"
        >
          Report an issue
        </button>
      </div>
    </div>
  )
}
