import { Integration, type QuickLink } from './base'
import { getCredential } from '../auth'
import { getConfig } from '../store'
import type { DevEvent, EventSource } from '../../shared/types'

interface JiraComment {
  author?: { displayName: string }
  body?: unknown
  created: string
}

interface JiraChangelogEntry {
  created: string
  author?: { displayName: string }
  items: { field: string; fromString?: string; toString?: string }[]
}

interface JiraIssue {
  id: string
  key: string
  fields: {
    summary: string
    status: { name: string }
    priority?: { name: string }
    updated: string
    assignee?: { displayName: string }
    comment?: { comments: JiraComment[] }
  }
  changelog?: { histories: JiraChangelogEntry[] }
}

export class JiraIntegration extends Integration {
  readonly source: EventSource = 'jira'

  private getSiteUrl(): string {
    const url = getCredential('jira:url')
    if (!url) throw new Error('Jira site URL not configured')
    const cleaned = url.replace(/\/$/, '')
    try {
      const parsed = new URL(cleaned)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error('Jira URL must use HTTPS')
      }
    } catch (e) {
      if (e instanceof TypeError) throw new Error('Invalid Jira URL')
      throw e
    }
    return cleaned
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

  async listProjects(): Promise<{ key: string; name: string }[]> {
    const siteUrl = this.getSiteUrl()
    const headers = this.getHeaders()
    try {
      const response = await fetch(`${siteUrl}/rest/api/3/project`, { headers })
      if (!response.ok) {
        console.error(`[DevPulse] Jira projects fetch returned ${response.status}`)
        return []
      }
      const data = (await response.json()) as { key: string; name: string }[]
      return data.map((p) => ({ key: p.key, name: p.name }))
    } catch (err) {
      console.error('[DevPulse] Failed to fetch Jira projects:', err)
      return []
    }
  }

  async poll(): Promise<DevEvent[]> {
    const siteUrl = this.getSiteUrl()
    const events: DevEvent[] = []

    const sinceMs = this.lastPollTimestamp
      ? this.lastPollTimestamp - 60_000
      : Date.now() - 86_400_000
    const d = new Date(sinceMs)
    const sinceDate = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

    const jiraConfig = getConfig().integrations.find((i) => i.type === 'jira')
    const projects = (jiraConfig?.settings?.jiraProjects ?? [])
      .filter((k) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(k))

    const eventTypes = jiraConfig?.settings?.jiraEventTypes ?? ['assigned', 'reported', 'watching']
    const userClauses: string[] = []
    if (eventTypes.includes('assigned')) userClauses.push('assignee = currentUser()')
    if (eventTypes.includes('reported')) userClauses.push('reporter = currentUser()')
    if (eventTypes.includes('watching')) userClauses.push('watcher = currentUser()')
    if (userClauses.length === 0) userClauses.push('assignee = currentUser()')

    const projectFilter = projects.length > 0
      ? `project IN (${projects.map((k) => `"${k}"`).join(',')}) AND `
      : ''

    // Try with all selected clauses first; if watcher causes a permission error, retry without it
    const jqlCandidates = [
      `${projectFilter}(${userClauses.join(' OR ')}) AND updated >= "${sinceDate}" ORDER BY updated DESC`
    ]
    if (userClauses.length > 1 && eventTypes.includes('watching')) {
      const withoutWatcher = userClauses.filter((c) => !c.includes('watcher'))
      if (withoutWatcher.length > 0) {
        jqlCandidates.push(
          `${projectFilter}(${withoutWatcher.join(' OR ')}) AND updated >= "${sinceDate}" ORDER BY updated DESC`
        )
      }
    }

    let lastError = ''
    for (const jql of jqlCandidates) {
      console.log(`[DevPulse] Jira JQL: ${jql}`)
      try {
        const response = await fetch(
          `${siteUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,status,priority,updated,assignee,comment&expand=changelog`,
          { headers: this.getHeaders() }
        )

        if (!response.ok) {
          const text = await response.text()
          lastError = `Jira API returned ${response.status}: ${text.slice(0, 200)}`
          console.error(`[DevPulse] ${lastError}`)
          // If this was a 400 (bad JQL) and we have a fallback, try next candidate
          if (response.status === 400 && jqlCandidates.indexOf(jql) < jqlCandidates.length - 1) {
            console.log('[DevPulse] Retrying Jira query without watcher clause...')
            continue
          }
          break
        }

        const data = (await response.json()) as { issues: JiraIssue[] }
        console.log(`[DevPulse] Jira search returned ${data.issues?.length ?? 0} issues`)
        for (const issue of data.issues ?? []) {
          const severity = this.mapSeverity(issue)
          const subtitle = this.buildSubtitle(issue, sinceMs)

          events.push({
            id: this.generateEventId('jira', `${issue.key}-${issue.fields.updated}`),
            source: 'jira',
            severity,
            title: `${issue.key}: ${issue.fields.summary}`,
            subtitle,
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
        lastError = ''
        break // Success — don't try fallback
      } catch (err) {
        lastError = `Jira poll failed: ${err}`
        console.error(`[DevPulse] ${lastError}`)
      }
    }

    // Surface persistent errors as a visible event so the user knows something is wrong
    if (lastError) {
      events.push({
        id: this.generateEventId('jira', `poll-error-${Date.now()}`),
        source: 'jira',
        severity: 'error',
        title: 'Jira polling error',
        subtitle: lastError,
        timestamp: Date.now(),
        url: `${siteUrl}`,
        metadata: {},
        read: false
      })
    }

    this.lastPollTimestamp = Date.now()
    return events
  }

  private buildSubtitle(issue: JiraIssue, sinceMs: number): string {
    // Check for recent comments
    const comments = issue.fields.comment?.comments ?? []
    const recentComment = comments.length > 0
      ? comments[comments.length - 1]
      : undefined
    if (recentComment && new Date(recentComment.created).getTime() >= sinceMs) {
      const author = recentComment.author?.displayName ?? 'Someone'
      const preview = this.extractText(recentComment.body)
      return preview
        ? `${author}: ${preview}`
        : `${author} commented`
    }

    // Check changelog for the most recent change since last poll
    const histories = issue.changelog?.histories ?? []
    for (let i = histories.length - 1; i >= 0; i--) {
      const entry = histories[i]
      if (new Date(entry.created).getTime() < sinceMs) break
      const author = entry.author?.displayName ?? 'Someone'
      for (const item of entry.items) {
        if (item.field === 'status') {
          return `${author} changed status: ${item.fromString ?? '?'} → ${item.toString ?? '?'}`
        }
        if (item.field === 'assignee') {
          return `Assigned to ${item.toString ?? 'Unassigned'}`
        }
        if (item.field === 'priority') {
          return `Priority changed to ${item.toString ?? '?'}`
        }
      }
      // Generic change — show field names and a preview of the new value if short
      const fields = entry.items.map((i) => i.field).join(', ')
      const firstValue = entry.items[0]?.toString
      if (firstValue && firstValue.length <= 60) {
        return `${author} updated ${fields}: ${firstValue}`
      }
      return `${author} updated ${fields}`
    }

    return `Status: ${issue.fields.status.name}`
  }

  /** Extract plain text from an ADF (Atlassian Document Format) body node */
  private extractText(body: unknown, maxLen = 80): string {
    if (!body || typeof body !== 'object') return ''
    const node = body as { type?: string; text?: string; content?: unknown[] }
    if (node.text) return node.text.slice(0, maxLen)
    if (!Array.isArray(node.content)) return ''
    let result = ''
    for (const child of node.content) {
      result += this.extractText(child, maxLen - result.length)
      if (result.length >= maxLen) break
    }
    return result.length > maxLen ? result.slice(0, maxLen - 1) + '…' : result
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
