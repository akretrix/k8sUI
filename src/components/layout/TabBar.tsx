import React from 'react';
import { AppTab } from '../../types/tabs';
import { X, Plus, MoreHorizontal, Layers, Trash2, Copy } from 'lucide-react';

interface TabBarProps {
  tabs: AppTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string, e?: React.MouseEvent) => void;
  onCloseAllTabs: () => void;
  onCloseOtherTabs: (tabId: string) => void;
  onDuplicateTab?: (tabId: string) => void;
  onNewTab: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCloseAllTabs,
  onCloseOtherTabs,
  onDuplicateTab,
  onNewTab,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const [contextMenuTabId, setContextMenuTabId] = React.useState<string | null>(null);

  const getEnvBadge = (env?: string) => {
    const lower = env?.toLowerCase() || '';
    if (lower.includes('prod')) {
      return {
        label: 'PROD',
        pillClass: 'bg-red-950/80 text-red-300 border-red-800/70',
        activeBorder: 'border-red-500/50 bg-red-950/20',
      };
    }
    if (lower.includes('stage') || lower.includes('qa')) {
      return {
        label: 'QA',
        pillClass: 'bg-amber-950/80 text-amber-300 border-amber-800/70',
        activeBorder: 'border-amber-500/50 bg-amber-950/20',
      };
    }
    return {
      label: 'DEV',
      pillClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/70',
      activeBorder: 'border-emerald-500/50 bg-emerald-950/20',
    };
  };

  return (
    <div className="h-9 border-b border-border bg-[#0B0F17]/90 backdrop-blur flex items-center justify-between px-2 select-none shrink-0 z-20">
      {/* Scrollable Tabs List */}
      <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar flex-1 py-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const envInfo = getEnvBadge(tab.environment);

          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenuTabId(tab.id);
              }}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  // Middle click closes tab
                  e.preventDefault();
                  onCloseTab(tab.id, e);
                }
              }}
              className={`group flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all border shrink-0 ${
                isActive
                  ? `${envInfo.activeBorder} text-white shadow-sm shadow-black/40`
                  : 'bg-gray-900/40 text-gray-400 border-gray-800/80 hover:border-gray-700 hover:bg-gray-800/40 hover:text-gray-200'
              }`}
              title={`${tab.title} on ${tab.clusterName || 'Cluster'} (${
                tab.namespaces.length > 0 ? `ns: ${tab.namespaces.join(', ')}` : 'all namespaces'
              })`}
            >
              {/* Cluster Tag with Environment Badge */}
              {tab.clusterName && (
                <div className="flex items-center space-x-1">
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-mono font-semibold border ${envInfo.pillClass}`}
                  >
                    {envInfo.label}
                  </span>
                  <span className="text-[11px] font-mono text-gray-300 truncate max-w-[100px]">
                    {tab.clusterName}
                  </span>
                  <span className="text-gray-600 text-xs">/</span>
                </div>
              )}

              {/* Resource Title */}
              <div className="flex items-center space-x-1">
                <Layers
                  className={`w-3 h-3 ${isActive ? 'text-cyan-400' : 'text-gray-500'}`}
                />
                <span className="font-semibold text-xs text-white truncate max-w-[110px]">
                  {tab.title}
                </span>
              </div>

              {/* Namespace pill */}
              {tab.namespaces.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-800/80 border border-gray-700/60 text-gray-300 font-mono truncate max-w-[80px]">
                  {tab.namespaces.length === 1 ? tab.namespaces[0] : `${tab.namespaces.length} ns`}
                </span>
              )}

              {/* Filter query pill */}
              {tab.filterQuery && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 font-mono truncate max-w-[70px]">
                  "{tab.filterQuery}"
                </span>
              )}

              {/* Close Button */}
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id, e);
                  }}
                  className="p-0.5 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-300 transition-colors ml-1"
                  title="Close Tab"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* New Tab Button */}
        <button
          onClick={onNewTab}
          className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-300 hover:bg-gray-800/60 transition-colors border border-dashed border-gray-800 hover:border-cyan-500/40 ml-1"
          title="Open New Tab (Cmd+T)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab Menu Options */}
      <div className="relative ml-2">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 transition-colors"
          title="Tab Options"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 mt-1 w-48 rounded-xl bg-[#0E131F] border border-gray-800 shadow-2xl z-40 py-1.5 text-xs">
              {onDuplicateTab && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDuplicateTab(activeTabId);
                  }}
                  className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center space-x-2"
                >
                  <Copy className="w-3.5 h-3.5 text-gray-400" />
                  <span>Duplicate Tab</span>
                </button>
              )}
              <button
                onClick={() => {
                  setShowMenu(false);
                  onCloseOtherTabs(activeTabId);
                }}
                disabled={tabs.length <= 1}
                className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <span>Close Other Tabs</span>
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onCloseAllTabs();
                }}
                className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-red-950/40 hover:text-red-300 flex items-center space-x-2 border-t border-gray-800/80 mt-1 pt-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Close All Tabs</span>
              </button>
            </div>
          </>
        )}

        {/* Tab Context Menu */}
        {contextMenuTabId && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setContextMenuTabId(null)} />
            <div className="absolute right-0 mt-1 w-48 rounded-xl bg-[#0E131F] border border-gray-800 shadow-2xl z-40 py-1.5 text-xs">
              {onDuplicateTab && (
                <button
                  onClick={() => {
                    onDuplicateTab(contextMenuTabId);
                    setContextMenuTabId(null);
                  }}
                  className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center space-x-2"
                >
                  <Copy className="w-3.5 h-3.5 text-gray-400" />
                  <span>Duplicate Tab</span>
                </button>
              )}
              <button
                onClick={() => {
                  onCloseOtherTabs(contextMenuTabId);
                  setContextMenuTabId(null);
                }}
                disabled={tabs.length <= 1}
                className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <span>Close Other Tabs</span>
              </button>
              <button
                onClick={(e) => {
                  onCloseTab(contextMenuTabId, e);
                  setContextMenuTabId(null);
                }}
                disabled={tabs.length <= 1}
                className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-red-950/40 hover:text-red-300 flex items-center space-x-2 border-t border-gray-800/80 mt-1 pt-1.5 disabled:opacity-40"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close This Tab</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
