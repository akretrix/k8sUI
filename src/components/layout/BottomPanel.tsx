import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { X, Maximize2, Minimize2, ChevronDown, ChevronUp } from 'lucide-react';

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
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  isOpen,
  onClose,
  tabs,
  activeTabId,
  onTabChange,
}) => {
  const [height, setHeight] = useState(350);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
              className={`flex items-center space-x-2 px-4 h-full border-r border-border border-b-2 cursor-pointer transition-colors max-w-[200px] group ${
                activeTabId === tab.id
                  ? 'border-b-emerald-400 bg-surface text-emerald-300'
                  : 'border-b-transparent text-gray-400 hover:text-gray-200 hover:bg-surface-hover'
              }`}
            >
              <div className="flex items-center truncate text-xs font-medium space-x-1.5">
                {tab.icon}
                <span className="truncate">{tab.title}</span>
              </div>
              {tab.onClose && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    tab.onClose!();
                  }}
                  className={`p-0.5 rounded-md hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity ${
                    activeTabId === tab.id ? 'opacity-100' : ''
                  }`}
                  title="Close Tab"
                  aria-label="Close Tab"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center space-x-1 shrink-0 pl-2">
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
            onClick={onClose}
            className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Close All Panel Tabs"
            aria-label="Close All Panel Tabs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

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
