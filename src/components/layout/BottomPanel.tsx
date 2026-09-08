import React, { useState, useRef, useEffect, ReactNode } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  ArrowRight,
  Trash2,
  Layers,
} from 'lucide-react';

export interface PanelTab {
  id: string;
  title: string;
  icon?: ReactNode;
  content: ReactNode;
  onClose?: () => void;
}

interface BottomPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: PanelTab[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  onCloseTab?: (id: string) => void;
  onCloseAllTabs?: () => void;
  onCloseOtherTabs?: (id: string) => void;
  onCloseTabsToRight?: (id: string) => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  isOpen,
  onClose,
  tabs,
  activeTabId,
  onTabChange,
  onCloseTab,
  onCloseAllTabs,
  onCloseOtherTabs,
  onCloseTabsToRight,
}) => {
  const [height, setHeight] = useState(350);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close context menus on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setShowMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle Drag Resizing
  useEffect(() => {
    if (!isDragging || isMinimized) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = window.innerHeight - e.clientY;
      if (newHeight > 200 && newHeight < window.innerHeight * 0.8) {
        setHeight(newHeight);
        if (isMaximized) setIsMaximized(false);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isMaximized, isMinimized]);

  if (!isOpen || tabs.length === 0) return null;

  const handleCloseSingleTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const targetTab = tabs.find((t) => t.id === tabId);
    if (onCloseTab) {
      onCloseTab(tabId);
    } else if (targetTab?.onClose) {
      targetTab.onClose();
    }
  };

  const handleCloseOthers = (tabId: string) => {
    if (onCloseOtherTabs) {
      onCloseOtherTabs(tabId);
    } else {
      tabs.filter((t) => t.id !== tabId).forEach((t) => t.onClose?.());
    }
  };

  const handleCloseToRight = (tabId: string) => {
    if (onCloseTabsToRight) {
      onCloseTabsToRight(tabId);
    } else {
      const idx = tabs.findIndex((t) => t.id === tabId);
      if (idx !== -1) {
        tabs.slice(idx + 1).forEach((t) => t.onClose?.());
      }
    }
  };

  const handleCloseAll = () => {
    if (onCloseAllTabs) {
      onCloseAllTabs();
    } else if (onClose) {
      onClose();
    } else {
      tabs.forEach((t) => t.onClose?.());
    }
  };

  return (
    <div
      ref={panelRef}
      className={`bg-[#090D16] border-t border-border z-40 flex flex-col transition-all duration-200 ease-in-out shadow-[0_-10px_30px_rgba(0,0,0,0.5)] shrink-0 w-full relative ${
        isMaximized && !isMinimized ? 'absolute inset-0' : ''
      }`}
      style={{ height: isMinimized ? '36px' : isMaximized ? '100%' : `${height}px` }}
    >
      {!isMaximized && !isMinimized && (
        <div
          className="absolute top-0 left-0 right-0 h-1.5 cursor-row-resize hover:bg-emerald-500/50 z-50 transition-colors"
          onMouseDown={() => setIsDragging(true)}
        />
      )}

      <div className="flex items-center justify-between bg-surface-elevated border-b border-border pr-2 select-none overflow-x-auto shrink-0">
        <div className="flex items-center h-9">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ tabId: tab.id, x: e.clientX, y: e.clientY });
              }}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  // Middle-click closes tab
                  e.preventDefault();
                  handleCloseSingleTab(tab.id, e);
                }
              }}
              className={`flex items-center space-x-2 px-4 h-full border-r border-border border-b-2 cursor-pointer transition-colors max-w-[220px] group ${
                activeTabId === tab.id
                  ? 'border-b-emerald-400 bg-surface text-emerald-300'
                  : 'border-b-transparent text-gray-400 hover:text-gray-200 hover:bg-surface-hover'
              }`}
              title={`${tab.title} (Right-click for options, middle-click to close)`}
            >
              <div className="flex items-center truncate text-xs font-medium space-x-1.5">
                {tab.icon}
                <span className="truncate">{tab.title}</span>
              </div>
              <button
                onClick={(e) => handleCloseSingleTab(tab.id, e)}
                className={`p-0.5 rounded-md hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity ${
                  activeTabId === tab.id ? 'opacity-100' : ''
                }`}
                title="Close Tab"
                aria-label="Close Tab"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center space-x-1 shrink-0 pl-2">
          {/* Multi-Tab Options Dropdown */}
          {tabs.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center space-x-1"
                title="Tab Management Options"
                aria-label="Tab Management Options"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-50" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-52 rounded-xl bg-[#0E131F] border border-gray-800 shadow-2xl z-50 py-1.5 text-xs font-mono">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        handleCloseOthers(activeTabId);
                      }}
                      className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center space-x-2"
                    >
                      <Layers className="w-3.5 h-3.5 text-gray-400" />
                      <span>Close Other Tabs</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        handleCloseToRight(activeTabId);
                      }}
                      disabled={tabs.findIndex((t) => t.id === activeTabId) === tabs.length - 1}
                      className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                      <span>Close Tabs to the Right</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        handleCloseAll();
                      }}
                      className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-red-950/40 hover:text-red-300 flex items-center space-x-2 border-t border-gray-800/80 mt-1 pt-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Close All Tabs ({tabs.length})</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {!isMinimized && (
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              title={isMaximized ? 'Restore Down' : 'Maximize Panel'}
              aria-label={isMaximized ? 'Restore Down' : 'Maximize Panel'}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            title={isMinimized ? 'Expand Panel' : 'Minimize Panel'}
            aria-label={isMinimized ? 'Expand Panel' : 'Minimize Panel'}
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={handleCloseAll}
            className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title={tabs.length > 1 ? `Close All ${tabs.length} Tabs` : 'Close Panel'}
            aria-label={tabs.length > 1 ? `Close All ${tabs.length} Tabs` : 'Close Panel'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Right-Click Tab Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} />
          <div
            className="fixed rounded-xl bg-[#0E131F] border border-gray-800 shadow-2xl z-50 py-1.5 text-xs font-mono w-52"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 220),
              top: Math.min(contextMenu.y, window.innerHeight - 180),
            }}
          >
            <button
              onClick={() => {
                const targetId = contextMenu.tabId;
                setContextMenu(null);
                handleCloseSingleTab(targetId);
              }}
              className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-gray-800 hover:text-white flex items-center space-x-2"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
              <span>Close Tab</span>
            </button>
            <button
              onClick={() => {
                const targetId = contextMenu.tabId;
                setContextMenu(null);
                handleCloseOthers(targetId);
              }}
              disabled={tabs.length <= 1}
              className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Layers className="w-3.5 h-3.5 text-gray-400" />
              <span>Close Other Tabs</span>
            </button>
            <button
              onClick={() => {
                const targetId = contextMenu.tabId;
                setContextMenu(null);
                handleCloseToRight(targetId);
              }}
              disabled={tabs.findIndex((t) => t.id === contextMenu.tabId) === tabs.length - 1}
              className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
              <span>Close Tabs to the Right</span>
            </button>
            <button
              onClick={() => {
                setContextMenu(null);
                handleCloseAll();
              }}
              className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-red-950/40 hover:text-red-300 flex items-center space-x-2 border-t border-gray-800/80 mt-1 pt-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Close All Tabs</span>
            </button>
          </div>
        </>
      )}

      {!isMinimized && (
        <div className="flex-1 overflow-hidden relative">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`absolute inset-0 bg-[#090D16] ${activeTabId === tab.id ? 'block' : 'hidden'}`}
            >
              {tab.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
