import { useState } from 'react'
import { useConfig } from '../hooks/useConfig'
import { ConnectionsTab } from './settings/ConnectionsTab'
import { NotificationsTab } from './settings/NotificationsTab'
import { GeneralTab } from './settings/GeneralTab'
import { AboutTab } from './settings/AboutTab'

type Tab = 'connections' | 'notifications' | 'general' | 'about'

const TABS: { id: Tab; label: string }[] = [
  { id: 'connections', label: 'Connections' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'general', label: 'General' },
  { id: 'about', label: 'About' }
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
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 px-2 py-2 text-[11px] font-medium transition-colors
              ${activeTab === tab.id
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'connections' && (
          <ConnectionsTab connectedSources={connectedSources} onRefresh={refresh} />
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
