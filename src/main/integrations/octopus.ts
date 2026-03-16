import { Integration, type QuickLink, type RunningTask } from './base'
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

interface OctopusTask {
  Id: string
  Name: string
  Description: string
  State: string
  HasBeenPickedUpByProcessor: boolean
  Links: { Web: string }
}

export class OctopusIntegration extends Integration {
  readonly source: EventSource = 'octopus'
  private projectCache = new Map<string, string>()
  /** Track last-seen deployment states to detect transitions (e.g. Queued → Failed) */
  private deploymentStates = new Map<string, string>()
  /** Track in-progress deployments so we can check their completion even if they fall out of the top-N poll */
  private inProgressDeployments = new Map<string, void>()

  private getBaseUrl(): string {
    const url = getCredential('octopus:url')
    if (!url) throw new Error('Octopus Deploy URL not configured')
    const cleaned = url.replace(/\/$/, '')
    try {
      const parsed = new URL(cleaned)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error('Octopus URL must use HTTPS')
      }
    } catch (e) {
      if (e instanceof TypeError) throw new Error('Invalid Octopus Deploy URL')
      throw e
    }
    return cleaned
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
    const isFirstPoll = this.lastPollTimestamp === 0

    // Poll deployments — detect both new deployments and state transitions
    const seenDepIds = new Set<string>()
    try {
      const response = await fetch(`${baseUrl}/api/deployments?take=10&skip=0`, { headers })
      if (!response.ok) throw new Error(`Octopus deployments API returned ${response.status}`)
      const data = (await response.json()) as { Items: OctopusDeployment[] }

      for (const dep of data.Items ?? []) {
        seenDepIds.add(dep.Id)
        const created = new Date(dep.Created).getTime()
        const previousState = this.deploymentStates.get(dep.Id)
        const stateChanged = previousState != null && previousState !== dep.State
        const isNew = !isFirstPoll && created > this.lastPollTimestamp

        // Track current state for next poll
        this.deploymentStates.set(dep.Id, dep.State)

        // Track or untrack in-progress deployments
        const isActive = ['executing', 'queued'].includes(dep.State.toLowerCase())
        const isTerminalDep = ['success', 'failed', 'timedout', 'canceled'].includes(dep.State.toLowerCase())
        if (isActive) {
          this.inProgressDeployments.set(dep.Id, undefined)
        } else if (isTerminalDep) {
          this.inProgressDeployments.delete(dep.Id)
        }

        // On first poll, only report actively running/queued deployments (skip completed ones)
        if (isFirstPoll) {
          if (!isActive) continue
        } else if (!isNew && !stateChanged) {
          continue
        }

        const projectName = await this.resolveProjectName(dep.ProjectId, baseUrl, headers)
        const severity = this.mapDeploymentSeverity(dep.State)

        // Use state in event id so state transitions create new events
        events.push({
          id: this.generateEventId('octopus', `dep-${dep.Id}-${dep.State}`),
          source: 'octopus',
          severity,
          title: `${projectName} → ${dep.Name}`,
          subtitle: `Deployment ${dep.State.toLowerCase()}`,
          timestamp: stateChanged ? Date.now() : created,
          url: dep.Links?.Web ? `${baseUrl}${dep.Links.Web}` : baseUrl,
          metadata: {
            project: projectName,
            environment: dep.Name,
            state: dep.State
          },
          read: false
        })
      }
    } catch (err) {
      console.error('[DevPulse] Octopus deployment poll failed:', err)
    }

    // Check tracked in-progress deployments that weren't in this poll's results
    for (const [depId] of this.inProgressDeployments) {
      if (seenDepIds.has(depId)) continue
      try {
        const response = await fetch(`${baseUrl}/api/deployments/${depId}`, { headers })
        if (!response.ok) continue
        const dep = (await response.json()) as OctopusDeployment

        const previousState = this.deploymentStates.get(dep.Id)
        const stateChanged = previousState != null && previousState !== dep.State
        this.deploymentStates.set(dep.Id, dep.State)

        const isTerminalDep = ['success', 'failed', 'timedout', 'canceled'].includes(dep.State.toLowerCase())
        if (isTerminalDep) {
          this.inProgressDeployments.delete(depId)
        }

        if (!stateChanged) continue

        const projectName = await this.resolveProjectName(dep.ProjectId, baseUrl, headers)
        const severity = this.mapDeploymentSeverity(dep.State)

        events.push({
          id: this.generateEventId('octopus', `dep-${dep.Id}-${dep.State}`),
          source: 'octopus',
          severity,
          title: `${projectName} → ${dep.Name}`,
          subtitle: `Deployment ${dep.State.toLowerCase()}`,
          timestamp: Date.now(),
          url: dep.Links?.Web ? `${baseUrl}${dep.Links.Web}` : baseUrl,
          metadata: {
            project: projectName,
            environment: dep.Name,
            state: dep.State
          },
          read: false
        })
      } catch (err) {
        console.error(`[DevPulse] Failed to check tracked deployment ${depId}:`, err)
      }
    }

    // Poll releases
    try {
      const response = await fetch(`${baseUrl}/api/releases?take=10&skip=0`, { headers })
      if (!response.ok) throw new Error(`Octopus releases API returned ${response.status}`)
      const data = (await response.json()) as { Items: OctopusRelease[] }

      for (const release of data.Items ?? []) {
        const assembled = new Date(release.Assembled).getTime()
        if (assembled <= this.lastPollTimestamp) continue
        if (isFirstPoll) continue // Don't report old releases on startup

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
    } catch (err) {
      console.error('[DevPulse] Octopus poll failed:', err)
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

  async getRunningTasks(): Promise<RunningTask[]> {
    const baseUrl = this.getBaseUrl()
    const headers = this.getHeaders()
    const tasks: RunningTask[] = []

    try {
      const response = await fetch(
        `${baseUrl}/api/tasks?states=Queued,Executing&take=20`,
        { headers }
      )
      if (!response.ok) throw new Error(`Octopus tasks API returned ${response.status}`)
      const data = (await response.json()) as { Items: OctopusTask[] }

      for (const task of data.Items ?? []) {
        tasks.push({
          id: task.Id,
          title: task.Name,
          subtitle: task.Description,
          url: task.Links?.Web ? `${baseUrl}${task.Links.Web}` : baseUrl,
          source: 'octopus'
        })
      }
    } catch (err) {
      console.error('[DevPulse] Octopus running tasks check failed:', err)
    }

    return tasks
  }

  hasActiveItems(): boolean {
    return this.inProgressDeployments.size > 0
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
