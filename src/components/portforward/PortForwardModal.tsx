import React, { useEffect, useState } from 'react';
import { ActivePortForward, PodSummary } from '../../types/cluster';
import { Network, Play, Square, X, ExternalLink, AlertCircle, Loader2, Info } from 'lucide-react';
import { api } from '../../api/tauriClient';
import { useQueryClient } from '@tanstack/react-query';

interface PortForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  pod: PodSummary | null;
}

export const PortForwardModal: React.FC<PortForwardModalProps> = ({
  isOpen,
  onClose,
  pod,
}) => {
  const queryClient = useQueryClient();
  const [localPort, setLocalPort] = useState('8080');
  const [containerPort, setContainerPort] = useState('80');
  const [activeTunnels, setActiveTunnels] = useState<ActivePortForward[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Port-forwards are cluster-wide state in the backend (a session can outlive
  // this modal), so on open we ask what's actually running rather than trusting
  // local component state — otherwise reopening the modal would show nothing
  // for a tunnel that is still live.
  useEffect(() => {
    if (!isOpen) return;
    api.listPortForwards().then(setActiveTunnels).catch(() => {});
  }, [isOpen]);

  if (!isOpen || !pod) return null;

  const handleStartTunnel = async () => {
    setError(null);
    setIsStarting(true);
    try {
      const forward = await api.startPortForward(
        pod.namespace,
        pod.name,
        parseInt(containerPort, 10),
        parseInt(localPort, 10)
      );
      setActiveTunnels((prev) => [...prev.filter((t) => t.session_id !== forward.session_id), forward]);
      queryClient.invalidateQueries({ queryKey: ['port-forwards'] });
    } catch (e: any) {
      // A bind failure ("address already in use") or an RBAC denial on the
      // pod's portforward subresource both surface here — worth showing
      // verbatim rather than a generic "failed to start" message.
      setError(e?.message || String(e));
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopTunnel = async (id: string) => {
    setActiveTunnels((prev) => prev.filter((t) => t.session_id !== id));
    try {
      await api.stopPortForward(id);
      queryClient.invalidateQueries({ queryKey: ['port-forwards'] });
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-100">
      <div className="bg-surface-elevated border border-border rounded-xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border bg-surface flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Port-Forward Manager</h3>
              <p className="text-xs text-gray-400">
                Native streaming tunnel to {pod.namespace}/{pod.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="px-5 py-2.5 bg-red-950/80 border-b border-red-600 flex items-start space-x-2 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="whitespace-pre-wrap">{error}</span>
          </div>
        )}

        {/* Port configuration input */}
        <div className="p-5 border-b border-border bg-surface/30 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono font-medium text-gray-300 mb-1">
                Local Port (on your machine)
              </label>
              <input
                type="number"
                value={localPort}
                onChange={(e) => setLocalPort(e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono font-medium text-gray-300 mb-1">
                Container Target Port
              </label>
              <input
                type="number"
                value={containerPort}
                onChange={(e) => setContainerPort(e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleStartTunnel}
              disabled={isStarting}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-md shadow-blue-950 flex items-center space-x-2 transition-all"
            >
              {isStarting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>{isStarting ? 'Starting…' : 'Start Native Tunnel'}</span>
            </button>
          </div>
        </div>

        {/* Active tunnels list */}
        <div className="p-5">
          <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">
            Active Tunnels ({activeTunnels.length})
          </h4>
          {activeTunnels.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-500 font-sans border border-dashed border-border rounded-lg">
              No active port-forward sessions running.
            </div>
          ) : (
            <div className="space-y-2">
              {activeTunnels.map((tunnel) => (
                <div
                  key={tunnel.session_id}
                  className="px-4 py-3 rounded-lg border border-border bg-surface flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <div className="font-mono text-xs text-gray-200">
                      <span className="text-blue-400 font-bold">127.0.0.1:{tunnel.local_port}</span>
                      <span className="text-gray-500 mx-2">➔</span>
                      <span className="text-gray-400">
                        {tunnel.namespace}/{tunnel.pod_name}:{tunnel.container_port}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => api.openExternalUrl(`http://127.0.0.1:${tunnel.local_port}`)}
                      className="p-1.5 rounded-md border border-border text-gray-300 hover:text-white hover:bg-surface-hover text-xs flex items-center space-x-1"
                      title="Open in browser"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleStopTunnel(tunnel.session_id)}
                      className="p-1.5 rounded-md border border-red-800 bg-red-950/40 text-red-300 hover:bg-red-900/50 text-xs flex items-center space-x-1"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-surface border-t border-border flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[11px] text-gray-400">
            <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Tunnels remain active in the background when you close this window.</span>
          </div>

          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-medium text-gray-200 hover:text-white transition-colors"
          >
            Close & Continue Working
          </button>
        </div>
      </div>
    </div>
  );
};
