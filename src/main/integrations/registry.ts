import type { EventSource } from '../../shared/types'
import type { Integration } from './base'
import { GitHubIntegration } from './github'
import { JiraIntegration } from './jira'
import { OctopusIntegration } from './octopus'

const integrations = new Map<EventSource, Integration>()

function ensureInitialized(): void {
  if (integrations.size > 0) return
  integrations.set('github', new GitHubIntegration())
  integrations.set('jira', new JiraIntegration())
  integrations.set('octopus', new OctopusIntegration())
}

export function getIntegration(source: EventSource): Integration | undefined {
  ensureInitialized()
  return integrations.get(source)
}

export function getAllIntegrations(): Integration[] {
  ensureInitialized()
  return Array.from(integrations.values())
}
