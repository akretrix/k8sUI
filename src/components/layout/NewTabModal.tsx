import React, { useState, useMemo } from 'react';
import { ClusterContextSummary } from '../../types/cluster';
import { AppTab, RESOURCE_TITLES } from '../../types/tabs';
import {
  X,
  Plus,
  Search,
  Server,
  Layers,
  Activity,
  Box,
  Cpu,
  Key,
  FileText,
  Radio,
  Tag,
  Shield,
  Clock,
  Compass,
  HardDrive,
} from 'lucide-react';

interface NewTabModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusters: ClusterContextSummary[];
  activeCluster: ClusterContextSummary | null;
  onAddTab: (newTab: AppTab) => void;
}

interface ResourceCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string;
}

const COMMON_RESOURCES: ResourceCategory[] = [
  { id: 'pods', name: 'Pods', icon: Box, description: 'Container instances & logs' },
  { id: 'deployments', name: 'Deployments', icon: Layers, description: 'Stateless application rollouts' },
  { id: 'events', name: 'Events', icon: Activity, description: 'Cluster warning & lifecycle events', badge: 'Realtime' },
  { id: 'namespaces', name: 'Namespaces', icon: Tag, description: 'Cluster isolation boundaries' },
  { id: 'services', name: 'Services', icon: Radio, description: 'Networking & load balancers' },
  { id: 'ingresses', name: 'Ingresses', icon: Compass, description: 'HTTP/HTTPS external routing' },
  { id: 'configmaps', name: 'ConfigMaps', icon: FileText, description: 'Application configuration' },
  { id: 'secrets', name: 'Secrets', icon: Key, description: 'Encrypted tokens & credentials' },
  { id: 'nodes', name: 'Nodes', icon: Server, description: 'Physical / EC2 compute workers' },
  { id: 'dashboard', name: 'Cluster Metrics', icon: Cpu, description: 'CPU, RAM & allocation gauges' },
  { id: 'statefulsets', name: 'StatefulSets', icon: HardDrive, description: 'Persistent stateful workloads' },
  { id: 'daemonsets', name: 'DaemonSets', icon: Shield, description: 'Node-level agent workloads' },
  { id: 'cronjobs', name: 'CronJobs', icon: Clock, description: 'Scheduled tasks & jobs' },
  { id: 'helm-releases', name: 'Helm Releases', icon: Box, description: 'Chart application lifecycle' },
];

export const NewTabModal: React.FC<NewTabModalProps> = ({
  isOpen,
  onClose,
  clusters,
  activeCluster,
  onAddTab,
}) => {
  const [selectedClusterId, setSelectedClusterId] = useState<string>(activeCluster?.id || '');
  const [selectedResource, setSelectedResource] = useState<string>('pods');
  const [clusterSearch, setClusterSearch] = useState<string>('');
  const [resourceSearch, setResourceSearch] = useState<string>('');

  // Synchronize when opening
  React.useEffect(() => {
    if (isOpen && activeCluster?.id && !selectedClusterId) {
      setSelectedClusterId(activeCluster.id);
    }
  }, [isOpen, activeCluster, selectedClusterId]);

  const filteredClusters = useMemo(() => {
    if (!clusterSearch.trim()) return clusters;
    const q = clusterSearch.toLowerCase();
    return clusters.filter(
      (c) => c.name.toLowerCase().includes(q) || c.environment?.toLowerCase().includes(q)
    );
  }, [clusters, clusterSearch]);

  const filteredResources = useMemo(() => {
    if (!resourceSearch.trim()) return COMMON_RESOURCES;
    const q = resourceSearch.toLowerCase();
    return COMMON_RESOURCES.filter(
      (r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    );
  }, [resourceSearch]);

  if (!isOpen) return null;

  const currentSelectedCluster =
    clusters.find((c) => c.id === selectedClusterId) || activeCluster || clusters[0];

  const handleCreate = () => {
    const cluster = currentSelectedCluster;
    const resourceTitle = RESOURCE_TITLES[selectedResource] || selectedResource;
    const newTab: AppTab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      clusterId: cluster?.id,
      clusterName: cluster?.name,
      environment: cluster?.environment,
      resource: selectedResource,
      title: resourceTitle,
      namespaces: [],
      filterQuery: '',
    };
    onAddTab(newTab);
    onClose();
  };

  const getEnvBadge = (env?: string) => {
    const lower = env?.toLowerCase() || '';
    if (lower.includes('prod')) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-red-950/80 text-red-300 border border-red-800/80">PROD</span>;
    }
    if (lower.includes('stage') || lower.includes('qa')) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/80">QA</span>;
    }
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">DEV</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0B0F17] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/80 bg-[#101624]/60 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Open New Cluster Tab</h3>
              <p className="text-xs text-gray-400">
                Inspect resources across any connected cluster simultaneously
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Step 1: Select Cluster */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center space-x-2">
                <span>1. Select Target Cluster</span>
                {currentSelectedCluster && (
                  <span className="text-cyan-400 font-mono text-[11px] normal-case">
                    ({currentSelectedCluster.name})
                  </span>
                )}
              </label>
            </div>

            {clusters.length > 4 && (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Filter clusters…"
                  value={clusterSearch}
                  onChange={(e) => setClusterSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-gray-900/80 border border-gray-800 rounded-lg text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
              {filteredClusters.map((c) => {
                const isSelected = c.id === (currentSelectedCluster?.id || selectedClusterId);
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedClusterId(c.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/60 ring-1 ring-cyan-500/40'
                        : 'bg-gray-900/40 border-gray-800/80 hover:border-gray-700 hover:bg-gray-800/30'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <Server
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-cyan-400' : 'text-gray-500'
                        }`}
                      />
                      <span className="text-xs font-medium text-white truncate">{c.name}</span>
                    </div>
                    <div className="shrink-0 ml-1.5">{getEnvBadge(c.environment)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Select Resource Type */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                2. Select Resource Kind
              </label>
              <div className="w-48 relative">
                <Search className="absolute left-2.5 top-2 w-3 h-3 text-gray-500" />
                <input
                  type="text"
                  placeholder="Filter resources…"
                  value={resourceSearch}
                  onChange={(e) => setResourceSearch(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 bg-gray-900/80 border border-gray-800 rounded-lg text-[11px] text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
              {filteredResources.map((res) => {
                const isSelected = res.id === selectedResource;
                const IconComponent = res.icon;
                return (
                  <div
                    key={res.id}
                    onClick={() => setSelectedResource(res.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-1.5 ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/60 ring-1 ring-cyan-500/40 shadow-sm shadow-cyan-950'
                        : 'bg-gray-900/40 border-gray-800/80 hover:border-gray-700 hover:bg-gray-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div
                          className={`p-1.5 rounded-lg ${
                            isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-gray-800/60 text-gray-400'
                          }`}
                        >
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-semibold text-white">{res.name}</span>
                      </div>
                      {res.badge && (
                        <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[9px] font-mono">
                          {res.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 leading-snug line-clamp-1">
                      {res.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800/80 bg-[#101624]/60 shrink-0">
          <div className="text-xs text-gray-400 font-mono">
            Opening <span className="text-cyan-300 font-semibold">{RESOURCE_TITLES[selectedResource] || selectedResource}</span> on <span className="text-white font-semibold">{currentSelectedCluster?.name || 'Selected Cluster'}</span>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-300 hover:text-white rounded-xl hover:bg-gray-800/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-black font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center space-x-1.5 transition-all"
            >
              <Plus className="w-4 h-4 text-black" />
              <span>Create Tab</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
