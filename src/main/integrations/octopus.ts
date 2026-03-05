import { Integration, type QuickLink } from './base'
import { getCredential } from '../auth'
import type { DevEvent, EventSource } from '../../shared/types'

interface OctopusDeployment {
  Id: string
  ProjectId: string
  EnvironmentId: string
  ReleaseId: string
  TaskId: string
  Name: string
  Created: string
  State: string
  HasWarningsOrErrors: boolean
  Links: { Web: string }
}

interface OctopusRelease {
  Id: string
  ProjectId: string
  Version: string
  Assembled: string
  ReleaseNotes: string
  Links: { Web: string }
}

interface OctopusProject {
  Id: string
  Name: string
}

export class OctopusIntegration extends Integration {
  readonly source: EventSource = 'octopus'
  private projectCache = new Map<string, string>()

  private getBaseUrl(): string {
    const url = getCredential('octopus:url')
    if (!url) throw new Error('Octopus Deploy URL not configured')
    return url.replace(/\/$/, '')
  }

  private getHeaders(): Record<string, string> {
    const apiKey = getCredential('octopus:api-key')
    if (!apiKey) throw new Error('Octopus Deploy not authenticated')
    return { 'X-Octopus-ApiKey': apiKey }
  }

  async authenticate(): Promise<void> {
    // Octopus uses API key auth - handled via settings UI
    throw new Error('Use saveApiKey for Octopus Deploy authentication')
  }

  async testConnection(): Promise<void> {
    const response = await fetch(`${this.getBaseUrl()}/api`, {
      headers: this.getHeaders()
    })
    if (!response.ok) throw new Error(`Octopus API returned ${response.status}`)
  }

  async poll(): Promise<DevEvent[]> {
    const baseUrl = this.getBaseUrl()
    const headers = this.getHeaders()
    const events: DevEvent[] = []

    // Poll deployments
    try {
      const response = await fetch(`${baseUrl}/api/deployments?take=10&skip=0`, { headers })
      const data = (await response.json()) as { Items: OctopusDeployment[] }

      for (const dep of data.Items ?? []) {
        const created = new Date(dep.Created).getTime()
        if (created <= this.lastPollTimestamp && this.lastPollTimestamp > 0) continue

        const projectName = await this.resolveProjectName(dep.ProjectId, baseUrl, headers)
        const severity = this.mapDeploymentSeverity(dep.State)

        events.push({
          id: this.generateEventId('octopus', `dep-${dep.Id}`),
          source: 'octopus',
          severity,
          title: `Deployment ${dep.State.toLowerCase()}`,
          subtitle: `${projectName} → ${dep.Name}`,
          timestamp: created,
          url: dep.Links?.Web ? `${baseUrl}${dep.Links.Web}` : baseUrl,
          metadata: {
            project: projectName,
            environment: dep.Name,
            state: dep.State
          },
          read: false
        })
      }
    } catch {
      // Silently skip
    }

    // Poll releases
    try {
      const response = await fetch(`${baseUrl}/api/releases?take=10&skip=0`, { headers })
      const data = (await response.json()) as { Items: OctopusRelease[] }

      for (const release of data.Items ?? []) {
        const assembled = new Date(release.Assembled).getTime()
        if (assembled <= this.lastPollTimestamp && this.lastPollTimestamp > 0) continue

        const projectName = await this.resolveProjectName(release.ProjectId, baseUrl, headers)

        events.push({
          id: this.generateEventId('octopus', `rel-${release.Id}`),
          source: 'octopus',
          severity: 'info',
          title: `New release ${release.Version}`,
          subtitle: projectName,
          timestamp: assembled,
          url: release.Links?.Web ? `${baseUrl}${release.Links.Web}` : baseUrl,
          metadata: {
            project: projectName,
            version: release.Version
          },
          read: false
        })
      }
    } catch {
      // Silently skip
    }

    this.lastPollTimestamp = Date.now()
    return events
  }

  private mapDeploymentSeverity(state: string): DevEvent['severity'] {
    switch (state.toLowerCase()) {
      case 'failed':
      case 'timedout':
        return 'error'
      case 'executing':
      case 'queued':
        return 'warning'
      case 'success':
        return 'success'
      default:
        return 'info'
    }
  }

  private async resolveProjectName(
    projectId: string,
    baseUrl: string,
    headers: Record<string, string>
  ): Promise<string> {
    const cached = this.projectCache.get(projectId)
    if (cached) return cached

    try {
      const response = await fetch(`${baseUrl}/api/projects/${projectId}`, { headers })
      const project = (await response.json()) as OctopusProject
      this.projectCache.set(projectId, project.Name)
      return project.Name
    } catch {
      return projectId
    }
  }

  getQuickLinks(): QuickLink[] {
    try {
      const baseUrl = this.getBaseUrl()
      return [
        { label: 'Octopus Dashboard', url: baseUrl },
        { label: 'Deployments', url: `${baseUrl}/app#/deployments` }
      ]
    } catch {
      return []
    }
  }
}
