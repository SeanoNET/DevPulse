export function AboutTab() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold">About</h2>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#6366f1] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <polygon points="18,6 10,17 15,17 13,26 22,15 17,15" />
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
          onClick={() => window.api.openExternal('https://github.com/seano/devpulse')}
          className="text-[11px] text-[var(--color-source-jira)] hover:underline block"
        >
          View on GitHub
        </button>
        <button
          onClick={() => window.api.openExternal('https://github.com/seano/devpulse/issues')}
          className="text-[11px] text-[var(--color-source-jira)] hover:underline block"
        >
          Report an issue
        </button>
      </div>
    </div>
  )
}
