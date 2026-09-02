import React, { useState, useEffect } from 'react';
import { Search, Server, Layers, Bot, Shield, SlidersHorizontal, ArrowRight } from 'lucide-react';
import { ClusterContextSummary, PodSummary } from '../../types/cluster';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  clusters: ClusterContextSummary[];
  pods: PodSummary[];
  onSelectCluster: (id: string) => void;
  onSelectPod: (pod: PodSummary) => void;
  onOpenAi: () => void;
  onOpenAudit: () => void;
  onToggleAdvanced: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  clusters,
  pods,
  onSelectCluster,
  onSelectPod,
  onOpenAi,
  onOpenAudit,
  onToggleAdvanced,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onClose(); // toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredClusters = clusters.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );
  const filteredPods = pods.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.namespace.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-100">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />
      <div className="relative bg-surface-elevated border border-border rounded-xl shadow-2xl max-w-xl w-full overflow-hidden z-10">
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-border bg-surface/80">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, cluster name, or pod..."
            className="w-full bg-transparent px-3 py-3.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 rounded bg-surface border border-border text-[10px] font-mono text-gray-400">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-3">
          {/* Quick Actions */}
          <div>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Quick Actions
            </div>
            <div className="space-y-1">
              <button
                onClick={() => {
                  onOpenAi();
                  onClose();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs text-gray-200 hover:bg-surface-hover hover:text-white transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <Bot className="w-4 h-4 text-indigo-400" />
                  <span>Ask AI Copilot to analyze cluster workloads</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
              </button>

              <button
                onClick={() => {
                  onOpenAudit();
                  onClose();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs text-gray-200 hover:bg-surface-hover hover:text-white transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Open Audit Trail & Privilege Logs</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
              </button>

              <button
                onClick={() => {
                  onToggleAdvanced();
                  onClose();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs text-gray-200 hover:bg-surface-hover hover:text-white transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                  <span>Toggle Advanced Mode (YAML / Exec / Port-Forward)</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Clusters */}
          {filteredClusters.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Clusters
              </div>
              <div className="space-y-1">
                {filteredClusters.map((cluster) => (
                  <button
                    key={cluster.id}
                    onClick={() => {
                      onSelectCluster(cluster.id);
                      onClose();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs text-gray-200 hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Server className="w-4 h-4 text-blue-400" />
                      <span>Switch to <b>{cluster.name}</b></span>
                    </div>
                    <span className="text-[10px] font-mono uppercase text-gray-400">
                      {cluster.environment}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pods */}
          {filteredPods.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Pods in Current Context
              </div>
              <div className="space-y-1">
                {filteredPods.map((pod) => (
                  <button
                    key={pod.name}
                    onClick={() => {
                      onSelectPod(pod);
                      onClose();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs text-gray-200 hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      <span>{pod.name}</span>
                      <span className="text-[10px] text-gray-500">({pod.namespace})</span>
                    </div>
                    <span className={`text-[10px] font-semibold ${pod.status === 'Running' ? 'text-green-400' : 'text-red-400'}`}>
                      {pod.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
