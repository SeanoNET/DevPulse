import { Integration, type QuickLink } from './base'
import { getCredential } from '../auth'
import type { DevEvent, EventSource } from '../../shared/types'

interface JiraIssue {
  id: string
  key: string
  fields: {
    summary: string
    status: { name: string }
    priority?: { name: string }
    updated: string
    assignee?: { displayName: string }
  }
}

export class JiraIntegration extends Integration {
  readonly source: EventSource = 'jira'

  private getSiteUrl(): string {
    const url = getCredential('jira:url')
    if (!url) throw new Error('Jira site URL not configured')
    return url.replace(/\/$/, '')
  }

  private getHeaders(): Record<string, string> {
    const token = getCredential('jira:token')
    const email = getCredential('jira:email')
    if (!token) throw new Error('Jira not authenticated. Add an API token in Settings.')

    // Jira Cloud uses Basic auth with email:api-token
    if (email) {
      const encoded = Buffer.from(`${email}:${token}`).toString('base64')
      return {
        Authorization: `Basic ${encoded}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    }

    // Fallback to Bearer
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  }

  async authenticate(): Promise<void> {
    throw new Error('Add your Jira API token in the Connections settings.')
  }

  async testConnection(): Promise<void> {
    const siteUrl = this.getSiteUrl()
    const response = await fetch(`${siteUrl}/rest/api/3/myself`, {
      headers: this.getHeaders()
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Jira API returned ${response.status}: ${text.slice(0, 200)}`)
    }
  }

  async poll(): Promise<DevEvent[]> {
    const siteUrl = this.getSiteUrl()
    const events: DevEvent[] = []

    const sinceMs = this.lastPollTimestamp || Date.now() - 3600_000
    const sinceDate = new Date(sinceMs).toISOString().split('.')[0].replace('T', ' ')

    const jql = `assignee = currentUser() AND updated >= "${sinceDate}" ORDER BY updated DESC`

    try {
      const response = await fetch(
        `${siteUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=20`,
        { headers: this.getHeaders() }
      )

      const data = (await response.json()) as { issues: JiraIssue[] }

      for (const issue of data.issues ?? []) {
        const severity = this.mapSeverity(issue)

        events.push({
          id: this.generateEventId('jira', `${issue.key}-${issue.fields.updated}`),
          source: 'jira',
          severity,
          title: `${issue.key}: ${issue.fields.summary}`,
          subtitle: `Status: ${issue.fields.status.name}`,
          timestamp: new Date(issue.fields.updated).getTime(),
          url: `${siteUrl}/browse/${issue.key}`,
          metadata: {
            key: issue.key,
            status: issue.fields.status.name,
            priority: issue.fields.priority?.name ?? 'None'
          },
          read: false
        })
      }
    } catch {
      // Skip on poll failure
    }

    this.lastPollTimestamp = Date.now()
    return events
  }

  private mapSeverity(issue: JiraIssue): DevEvent['severity'] {
    const status = issue.fields.status.name.toLowerCase()
    const priority = issue.fields.priority?.name?.toLowerCase() ?? ''

    if (status === 'blocked' || priority === 'critical' || priority === 'blocker') return 'error'
    if (status === 'done' || status === 'resolved' || status === 'closed') return 'success'
    if (priority === 'high' || priority === 'major') return 'warning'
    return 'info'
  }

  getQuickLinks(): QuickLink[] {
    try {
      const base = this.getSiteUrl()
      return [
        { label: 'Jira Board', url: base },
        { label: 'My Issues', url: `${base}/issues/?filter=-1` }
      ]
    } catch {
      return []
    }
  }
}
