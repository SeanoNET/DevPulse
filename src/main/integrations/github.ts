import { Octokit } from '@octokit/rest'
import { Integration, type QuickLink } from './base'
import { getCredential } from '../auth'
import type { DevEvent, EventSource } from '../../shared/types'

export class GitHubIntegration extends Integration {
  readonly source: EventSource = 'github'
  private octokit: Octokit | null = null
  /** Track last-seen run states to detect re-runs and state transitions */
  private runStates = new Map<number, string>()

  private getOctokit(): Octokit {
    if (this.octokit) return this.octokit

    const token = getCredential('github:token')
    if (!token) throw new Error('GitHub not authenticated. Add a Personal Access Token in Settings.')

    this.octokit = new Octokit({ auth: token })
    return this.octokit
  }

  async authenticate(): Promise<void> {
    // PAT-based auth — token is saved via the Settings UI
    throw new Error('Add your GitHub Personal Access Token in the Connections settings.')
  }

  async testConnection(): Promise<void> {
    this.octokit = null
    const octokit = this.getOctokit()
    await octokit.rest.users.getAuthenticated()
  }

  async poll(): Promise<DevEvent[]> {
    const octokit = this.getOctokit()
    const events: DevEvent[] = []

    try {
      const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
        sort: 'pushed',
        per_page: 10
      })

      const sinceTs = this.lastPollTimestamp || Date.now() - 3600_000

      for (const repo of repos) {
        try {
          const { data: runs } = await octokit.rest.actions.listWorkflowRunsForRepo({
            owner: repo.owner.login,
            repo: repo.name,
            per_page: 5
          })

          for (const run of runs.workflow_runs) {
            if (new Date(run.updated_at).getTime() < sinceTs) continue

            const attempt = run.run_attempt ?? 1
            const stateKey = `${run.conclusion ?? run.status}-${attempt}`
            const previousState = this.runStates.get(run.id)
            this.runStates.set(run.id, stateKey)

            // Skip if we've already seen this exact state + attempt
            if (previousState === stateKey) continue

            const severity = run.conclusion === 'failure'
              ? 'error' as const
              : run.conclusion === 'success'
                ? 'success' as const
                : run.status === 'in_progress' || run.status === 'queued'
                  ? 'warning' as const
                  : 'info' as const

            const displayTitle = (run as any).display_title || run.head_commit?.message || run.name || 'Workflow'
            const branch = run.head_branch ?? ''
            const branchLabel = branch ? ` (${branch})` : ''
            const status = run.conclusion ?? run.status ?? 'unknown'

            events.push({
              id: this.generateEventId('github', `run-${run.id}-${attempt}-${status}`),
              source: 'github',
              severity,
              title: displayTitle,
              subtitle: `${repo.full_name} #${run.run_number}${branchLabel} · ${status}`,
              timestamp: new Date(run.updated_at).getTime(),
              url: run.html_url,
              metadata: {
                repo: repo.full_name,
                branch,
                workflow: run.name ?? '',
                status
              },
              read: false
            })
          }
        } catch (err) {
          console.error(`[DevPulse] Failed to poll actions for ${repo.full_name}:`, err)
        }
      }
    } catch (err) {
      console.error('[DevPulse] Failed to list repos:', err)
    }

    try {
      const since = this.lastPollTimestamp
        ? new Date(this.lastPollTimestamp).toISOString()
        : undefined

      const { data: notifications } = await octokit.rest.activity.listNotificationsForAuthenticatedUser({
        since,
        per_page: 20
      })

      for (const notif of notifications) {
        events.push({
          id: this.generateEventId('github', `notif-${notif.id}`),
          source: 'github',
          severity: notif.reason === 'assign' || notif.reason === 'mention' ? 'warning' : 'info',
          title: notif.subject.title,
          subtitle: `${notif.repository.full_name} - ${notif.reason}`,
          timestamp: new Date(notif.updated_at).getTime(),
          url: `https://github.com/${notif.repository.full_name}`,
          metadata: {
            repo: notif.repository.full_name,
            reason: notif.reason,
            type: notif.subject.type
          },
          read: false
        })
      }
    } catch (err) {
      console.error('[DevPulse] Failed to poll notifications:', err)
    }

    this.lastPollTimestamp = Date.now()
    return events
  }

  getQuickLinks(): QuickLink[] {
    return [
      { label: 'GitHub Dashboard', url: 'https://github.com' },
      { label: 'Actions', url: 'https://github.com/notifications' },
      { label: 'Pull Requests', url: 'https://github.com/pulls' }
    ]
  }
}
