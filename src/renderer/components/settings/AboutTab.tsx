export function AboutTab() {
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
            <p className="text-[11px] text-muted-foreground">v0.1.0</p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Unified CI/CD event timeline for developers. Aggregates events from
          GitHub, Jira, and Octopus Deploy into a single notification feed.
        </p>
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
