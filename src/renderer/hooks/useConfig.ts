import { useState, useEffect, useCallback } from 'react'
import type { AppConfig, EventSource } from '@shared/types'

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [connectedSources, setConnectedSources] = useState<EventSource[]>([])

  const refresh = useCallback(async () => {
    const [cfg, sources] = await Promise.all([
      window.api.getConfig(),
      window.api.getConnectedSources()
    ])
    setConfig(cfg)
    setConnectedSources(sources)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const update = useCallback(async (partial: Partial<AppConfig>) => {
    await window.api.updateConfig(partial)
    await refresh()
  }, [refresh])

  return { config, connectedSources, update, refresh }
}
