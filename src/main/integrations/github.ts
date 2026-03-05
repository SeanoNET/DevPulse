import { Octokit } from '@octokit/rest'
import { Integration, type QuickLink } from './base'
import { getCredential } from '../auth'
import type { DevEvent, EventSource } from '../../shared/types'

export class GitHubIntegration extends Integration {
  readonly source: EventSource = 'github'
  private octokit: Octokit | null = null

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

      for (const repo of repos) {
        const { data: runs } = await octokit.rest.actions.listWorkflowRunsForRepo({
          owner: repo.owner.login,
          repo: repo.name,
          per_page: 5,
          created: `>${new Date(this.lastPollTimestamp || Date.now() - 3600_000).toISOString()}`
        })

        for (const run of runs.workflow_runs) {
          const severity = run.conclusion === 'failure'
            ? 'error' as const
            : run.conclusion === 'success'
              ? 'success' as const
              : 'info' as const

          events.push({
            id: this.generateEventId('github', `run-${run.id}`),
            source: 'github',
            severity,
            title: `${run.name ?? 'Workflow'} ${run.conclusion ?? run.status}`,
            subtitle: `${repo.full_name} #${run.run_number}`,
            timestamp: new Date(run.updated_at).getTime(),
            url: run.html_url,
            metadata: {
              repo: repo.full_name,
              branch: run.head_branch ?? '',
              workflow: run.name ?? ''
            },
            read: false
          })
        }
      }
    } catch {
      // Skip if workflow polling fails
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
    } catch {
      // Skip if notification polling fails
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
