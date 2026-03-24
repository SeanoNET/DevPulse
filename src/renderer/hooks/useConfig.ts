import { useState, useEffect, useCallback } from 'react'
import type { AppConfig, EventSource } from '@shared/types'
import { applyTheme } from '../lib/theme'

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [connectedSources, setConnectedSources] = useState<EventSource[]>([])

  const refresh = useCallback(async () => {
    try {
      const [cfg, sources] = await Promise.all([
        window.api.getConfig(),
        window.api.getConnectedSources()
      ])
      setConfig(cfg)
      setConnectedSources(sources)
      applyTheme(cfg.general.theme)
    } catch (err) {
      console.error('[DevPulse] Failed to load config:', err)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const update = useCallback(async (partial: Partial<AppConfig>) => {
    await window.api.updateConfig(partial)
    await refresh()
    if (partial.general?.theme) {
      applyTheme(partial.general.theme)
    }
  }, [refresh])

  return { config, connectedSources, update, refresh }
}
