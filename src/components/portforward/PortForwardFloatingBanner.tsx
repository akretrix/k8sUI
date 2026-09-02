import React, { useState } from 'react';
import { ActivePortForward } from '../../types/cluster';
import {
  ExternalLink,
  Copy,
  Check,
  Square,
  ChevronUp,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../api/tauriClient';

interface PortForwardFloatingBannerProps {
  tunnels: ActivePortForward[];
  onStopTunnel: (sessionId: string) => void;
}

export const PortForwardFloatingBanner: React.FC<PortForwardFloatingBannerProps> = ({
  tunnels,
  onStopTunnel,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (tunnels.length === 0) return null;

  const handleCopyUrl = (port: number, sessionId: string) => {
    navigator.clipboard.writeText(`http://127.0.0.1:${port}`);
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <aside aria-label="Active port-forward sessions" className="fixed bottom-4 right-4 z-40 max-w-md w-full shadow-2xl animate-in slide-in-from-bottom-5 duration-200">
      <div className="bg-[#0B0F17]/95 backdrop-blur-md border border-emerald-500/50 rounded-xl overflow-hidden shadow-2xl ring-1 ring-emerald-500/20">
        {/* Header Bar */}
        <div className="px-3.5 py-2.5 bg-[#10141D] border-b border-border/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="relative flex items-center justify-center shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute opacity-75" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 relative" />
            </div>
            <div className="flex items-center space-x-1.5 truncate">
              <span className="text-xs font-bold text-white font-mono">
                Port-Forward Active
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                {tunnels.length} {tunnels.length === 1 ? 'tunnel' : 'tunnels'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-surface-elevated transition-colors"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Content Body (when not minimized) */}
        {!isMinimized && (
          <div className="p-3 space-y-2 max-h-56 overflow-y-auto">
            {tunnels.map((tunnel) => {
              const url = `http://127.0.0.1:${tunnel.local_port}`;
              const isCopied = copiedId === tunnel.session_id;

              return (
                <div
                  key={tunnel.session_id}
                  className="p-2.5 rounded-lg bg-[#141A26] border border-border/70 font-mono text-xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-cyan-300 font-bold text-xs">
                          127.0.0.1:{tunnel.local_port}
                        </span>
                        <ArrowRight className="w-3 h-3 text-gray-500 shrink-0" />
                        <span className="text-gray-300 text-[11px] truncate max-w-[140px]" title={tunnel.pod_name}>
                          {tunnel.pod_name}
                        </span>
                        <span className="text-indigo-400 font-semibold text-[11px] shrink-0">
                          :{tunnel.container_port}
                        </span>
                      </div>
                    </div>

                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 shrink-0">
                      Running
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/40">
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => api.openExternalUrl(url)}
                        className="px-2 py-0.8 rounded bg-surface-elevated hover:bg-surface-hover border border-border text-[10px] text-gray-200 hover:text-white flex items-center space-x-1 transition-colors"
                        title="Open local URL in default browser"
                      >
                        <ExternalLink className="w-2.5 h-2.5 text-cyan-400" />
                        <span>Open</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyUrl(tunnel.local_port, tunnel.session_id)}
                        className="px-2 py-0.8 rounded bg-surface-elevated hover:bg-surface-hover border border-border text-[10px] text-gray-300 hover:text-white flex items-center space-x-1 transition-colors"
                      >
                        {isCopied ? (
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-2.5 h-2.5 text-gray-400" />
                        )}
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onStopTunnel(tunnel.session_id)}
                      className="px-2 py-0.8 rounded bg-red-950/50 hover:bg-red-900/70 border border-red-800 text-[10px] text-red-300 hover:text-red-100 flex items-center space-x-1 transition-colors"
                    >
                      <Square className="w-2.5 h-2.5 fill-current" />
                      <span>Stop</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
