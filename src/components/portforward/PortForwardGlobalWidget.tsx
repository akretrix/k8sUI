import React, { useState, useRef, useEffect } from 'react';
import { ActivePortForward } from '../../types/cluster';
import {
  Network,
  ExternalLink,
  Copy,
  Check,
  Square,
  X,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../api/tauriClient';

interface PortForwardGlobalWidgetProps {
  tunnels: ActivePortForward[];
  onStopTunnel: (sessionId: string) => void;
  onRefresh?: () => void;
  className?: string;
}

export const PortForwardGlobalWidget: React.FC<PortForwardGlobalWidgetProps> = ({
  tunnels,
  onStopTunnel,
  onRefresh,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or ESC key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleCopyUrl = (port: number, sessionId: string) => {
    navigator.clipboard.writeText(`http://127.0.0.1:${port}`);
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStop = async (sessionId: string) => {
    setStoppingId(sessionId);
    try {
      await onStopTunnel(sessionId);
      if (onRefresh) onRefresh();
    } finally {
      setStoppingId(null);
    }
  };

  const hasTunnels = tunnels.length > 0;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      {hasTunnels ? (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all select-none shadow-sm ${
            isOpen
              ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200'
              : 'bg-emerald-950/40 border-emerald-700/60 hover:border-emerald-500/80 text-emerald-300'
          }`}
          title="Active Port Forward Tunnels"
        >
          <div className="relative flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute opacity-75" />
            <span className="w-2 h-2 rounded-full bg-emerald-400 relative" />
          </div>
          <span className="font-bold">
            {tunnels.length === 1 ? `:${tunnels[0].local_port}` : `${tunnels.length} Tunnels`}
          </span>
          <span className="text-emerald-500 text-[10px] hidden sm:inline">Active</span>
          <ChevronDown
            className={`w-3 h-3 text-emerald-400/80 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-md border border-border text-gray-400 hover:text-white hover:bg-surface-elevated transition-colors"
          title="Port-Forward Manager (0 Active Tunnels)"
        >
          <Network className="w-4 h-4" />
        </button>
      )}

      {/* Popover / Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-surface-elevated border border-border shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-surface border-b border-border flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Network className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-bold text-white font-mono">Port-Forward Tunnels</h4>
                  <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                    {tunnels.length} Active
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 font-sans">
                  Native TCP tunnels streaming in the background
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-surface-hover transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tunnels List */}
          <div className="p-3 max-h-80 overflow-y-auto space-y-2.5">
            {tunnels.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-gray-500 font-sans border border-dashed border-border/80 rounded-xl space-y-1">
                <p className="font-semibold text-gray-400">No active tunnels</p>
                <p className="text-[11px] text-gray-500">
                  Select any Pod from the Pods table or Resource Inspector to launch a port-forward tunnel.
                </p>
              </div>
            ) : (
              tunnels.map((tunnel) => {
                const url = `http://127.0.0.1:${tunnel.local_port}`;
                const isCopied = copiedId === tunnel.session_id;
                const isStopping = stoppingId === tunnel.session_id;

                return (
                  <div
                    key={tunnel.session_id}
                    className="p-3 rounded-xl bg-[#10141D] border border-border/80 space-y-2 font-mono hover:border-border transition-colors group"
                  >
                    {/* Tunnel Endpoints */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                          <span className="text-xs font-bold text-cyan-300 tracking-wide truncate">
                            127.0.0.1:{tunnel.local_port}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400 flex items-center space-x-1.5 pl-4 truncate">
                          <ArrowRight className="w-3 h-3 text-gray-600 shrink-0" />
                          <span className="text-gray-300 truncate" title={`${tunnel.namespace}/${tunnel.pod_name}`}>
                            {tunnel.namespace}/{tunnel.pod_name}
                          </span>
                          <span className="text-indigo-400 font-semibold shrink-0">
                            :{tunnel.container_port}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800 shrink-0 font-semibold">
                        Streaming
                      </span>
                    </div>

                    {/* Action Bar */}
                    <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => api.openExternalUrl(url)}
                          className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border text-[11px] text-gray-200 hover:text-white flex items-center space-x-1 transition-colors"
                          title="Open local URL in default browser"
                        >
                          <ExternalLink className="w-3 h-3 text-cyan-400" />
                          <span>Open</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyUrl(tunnel.local_port, tunnel.session_id)}
                          className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border text-[11px] text-gray-300 hover:text-white flex items-center space-x-1 transition-colors"
                          title="Copy local URL"
                        >
                          {isCopied ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-400" />
                          )}
                          <span>{isCopied ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStop(tunnel.session_id)}
                        disabled={isStopping}
                        className="px-2 py-1 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-800/80 text-[11px] text-red-300 hover:text-red-100 flex items-center space-x-1 transition-colors disabled:opacity-50"
                        title="Stop port forward session"
                      >
                        <Square className="w-3 h-3 fill-current" />
                        <span>{isStopping ? 'Stopping…' : 'Stop'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          {hasTunnels && (
            <div className="px-4 py-2.5 bg-surface border-t border-border/80 flex items-center justify-between text-[11px] font-sans text-gray-400">
              <span className="truncate">Tunnels stay running across all tabs</span>
              <button
                type="button"
                onClick={async () => {
                  for (const t of tunnels) {
                    await onStopTunnel(t.session_id);
                  }
                  if (onRefresh) onRefresh();
                }}
                className="text-red-400 hover:text-red-300 text-[11px] font-mono hover:underline shrink-0 ml-2"
              >
                Stop All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
