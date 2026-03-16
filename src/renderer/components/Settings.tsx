import { useState } from 'react'
import { useConfig } from '../hooks/useConfig'
import { ConnectionsTab } from './settings/ConnectionsTab'
import { NotificationsTab } from './settings/NotificationsTab'
import { GeneralTab } from './settings/GeneralTab'
import { AboutTab } from './settings/AboutTab'

type Tab = 'connections' | 'notifications' | 'general' | 'about'

const TABS: { id: Tab; label: string; shortLabel: string }[] = [
  { id: 'connections', label: 'Connections', shortLabel: 'Connect' },
  { id: 'notifications', label: 'Notifications', shortLabel: 'Alerts' },
  { id: 'general', label: 'General', shortLabel: 'General' },
  { id: 'about', label: 'About', shortLabel: 'About' }
]

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('connections')
  const { config, connectedSources, update, refresh } = useConfig()

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        Loading settings...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border px-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 px-1 py-2.5 text-[11px] font-medium transition-colors relative
              ${activeTab === tab.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
              }
            `}
          >
            <span className="hidden min-[420px]:inline">{tab.label}</span>
            <span className="min-[420px]:hidden">{tab.shortLabel}</span>
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'connections' && (
          <ConnectionsTab connectedSources={connectedSources} onRefresh={refresh} config={config} onUpdate={update} />
        )}
        {activeTab === 'notifications' && (
          <NotificationsTab config={config} onUpdate={update} />
        )}
        {activeTab === 'general' && (
          <GeneralTab config={config} onUpdate={update} />
        )}
        {activeTab === 'about' && <AboutTab />}
      </div>
    </div>
  )
}
