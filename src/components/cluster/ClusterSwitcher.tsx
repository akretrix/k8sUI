import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ClusterContextSummary, ClusterHealthInfo, EnvironmentTier } from '../../types/cluster';
import { ChevronDown, Server, Plus, Cloud, ShieldCheck, Search, X, RefreshCw } from 'lucide-react';

interface ClusterSwitcherProps {
  clusters: ClusterContextSummary[];
  activeCluster: ClusterContextSummary | null;
  healthInfo?: ClusterHealthInfo | null;
  isHealthChecking?: boolean;
  onSelectCluster: (clusterId: string) => void;
  onOpenClusterInNewTab?: (cluster: ClusterContextSummary) => void;
  onOpenAddAwsOrg: () => void;
  onReconnect?: () => void;
}

export const ClusterSwitcher: React.FC<ClusterSwitcherProps> = ({
  clusters,
  activeCluster,
  healthInfo,
  isHealthChecking,
  onSelectCluster,
  onOpenClusterInNewTab,
  onOpenAddAwsOrg,
  onReconnect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // A real kubeconfig can carry dozens of contexts across several AWS accounts —
  // scrolling a flat list to find one is the whole problem this filter solves,
  // so the input grabs focus the moment the dropdown opens.
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      // Wait a frame for the dropdown to mount before focusing it.
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [isOpen]);

  const filteredClusters = useMemo(() => {
    const raw = query.trim().toLowerCase();
    if (!raw) return clusters;
    const tokens = raw.split(/\s+/).filter(Boolean);

    return clusters.filter((c) => {
      // Meaningful metadata fields without generic cloud endpoint URLs (which contain 'amazonaws' and falsely match 'zona')
      const searchTarget = [
        c.name,
        c.account_name,
        c.account_id,
        c.region,
        c.environment,
        c.role,
        c.provider,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return tokens.every((token) => searchTarget.includes(token));
    });
  }, [clusters, query]);

  const getEnvBadgeClass = (env: EnvironmentTier) => {
    switch (env) {
      case 'Production':
        return 'bg-red-950 text-red-400 border-red-800 border';
      case 'Staging':
        return 'bg-amber-950 text-amber-400 border-amber-800 border';
      case 'Development':
        return 'bg-emerald-950 text-emerald-400 border-emerald-800 border';
      case 'Local':
        return 'bg-blue-950 text-blue-400 border-blue-800 border';
      default:
        return 'bg-gray-800 text-gray-300 border-gray-700 border';
    }
  };

  const getProviderLabel = (c: ClusterContextSummary) => {
    if (c.account_name) {
      return `${c.account_name} (${c.account_id})`;
    }
    switch (c.provider.toLowerCase()) {
      case 'eks':
        return 'AWS EKS';
      case 'aks':
        return 'Azure AKS';
      default:
        return 'Local Kube';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-3 px-3 py-1.5 rounded-md border text-sm font-medium transition-all ${
          activeCluster?.environment === 'Production'
            ? 'border-red-600 bg-red-950/40 text-red-200 hover:bg-red-900/50 shadow-sm shadow-red-950'
            : activeCluster?.environment === 'Staging'
            ? 'border-amber-600 bg-amber-950/30 text-amber-200 hover:bg-amber-900/40'
            : 'border-border bg-surface text-gray-200 hover:bg-surface-elevated'
        }`}
        aria-label="Cluster and context switcher"
      >
        <div className="relative">
          <Server className="w-4 h-4 text-gray-400" />
          {activeCluster && (
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-surface ${
                healthInfo?.status === 'connected'
                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                  : healthInfo?.status === 'auth_expired'
                  ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)] animate-pulse'
                  : healthInfo?.status === 'unreachable'
                  ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)] animate-pulse'
                  : isHealthChecking
                  ? 'bg-cyan-400 animate-ping'
                  : 'bg-gray-500'
              }`}
              title={
                healthInfo?.status === 'connected'
                  ? `Cluster Connected (${healthInfo.latency_ms ?? 0}ms)`
                  : healthInfo?.status === 'auth_expired'
                  ? 'Authentication Expired (SSO / Token)'
                  : healthInfo?.status === 'unreachable'
                  ? 'Cluster Unreachable (VPN Disconnected?)'
                  : 'Checking Connection…'
              }
            />
          )}
        </div>
        <div className="flex flex-col items-start text-left">
          <div className="flex items-center space-x-2">
            <span className="font-semibold">{activeCluster?.name || 'Select Cluster'}</span>
            {activeCluster && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider ${getEnvBadgeClass(
                  activeCluster.environment
                )}`}
              >
                {activeCluster.environment}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1.5 text-[11px]">
            <span className="text-gray-400 truncate max-w-[180px]">
              {activeCluster ? getProviderLabel(activeCluster) : 'Disconnected'}
            </span>
            {activeCluster && healthInfo && (
              <>
                <span className="text-gray-600">•</span>
                {healthInfo.status === 'connected' ? (
                  <span className="text-emerald-400 font-mono text-[10px]">
                    {healthInfo.latency_ms !== undefined ? `${healthInfo.latency_ms}ms` : 'online'}
                  </span>
                ) : healthInfo.status === 'auth_expired' ? (
                  <span className="text-amber-400 font-mono font-semibold text-[10px]">
                    Auth Expired
                  </span>
                ) : healthInfo.status === 'unreachable' ? (
                  <span className="text-rose-400 font-mono font-semibold text-[10px]">
                    Offline (VPN?)
                  </span>
                ) : null}
              </>
            )}
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 mt-2 w-96 rounded-lg bg-surface-elevated border border-border shadow-2xl z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-surface/50 text-[11px] font-semibold uppercase tracking-wider text-gray-400 flex items-center justify-between">
              <span>Discovered Cluster Contexts</span>
              <div className="flex items-center space-x-2">
                {onReconnect && activeCluster && healthInfo && healthInfo.status !== 'connected' && (
                  <button
                    onClick={() => {
                      onReconnect();
                    }}
                    className="flex items-center space-x-1 text-[10px] text-brand-400 hover:text-brand-300 font-mono"
                    title="Reconnect cluster"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reconnect</span>
                  </button>
                )}
                <span className="text-[10px] text-gray-500 font-mono">
                  {query ? `${filteredClusters.length} / ${clusters.length}` : `${clusters.length} total`}
                </span>
              </div>
            </div>

            <div className="relative px-2 py-2 border-b border-border bg-surface/30">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    if (query) setQuery('');
                    else setIsOpen(false);
                  }
                }}
                placeholder="Filter by name, account, region, role…"
                className="w-full bg-surface border border-border rounded-md pl-8 pr-7 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery('');
                    searchRef.current?.focus();
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200"
                  aria-label="Clear filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="py-1 max-h-80 overflow-y-auto divide-y divide-border/40">
              {filteredClusters.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-gray-500">
                  No clusters match "{query}"
                </div>
              )}
              {filteredClusters.map((cluster) => {
                const isActive = cluster.id === activeCluster?.id;
                return (
                  <button
                    key={cluster.id}
                    onClick={() => {
                      onSelectCluster(cluster.id);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 flex items-center justify-between text-left transition-colors text-xs ${
                      isActive
                        ? 'bg-indigo-600/20 text-indigo-200 border-l-2 border-indigo-500'
                        : 'text-gray-300 hover:bg-surface-hover hover:text-white'
                    }`}
                  >
                    <div className="flex flex-col pr-2 min-w-0">
                      <div className="font-semibold flex items-center space-x-1.5 truncate">
                        <Cloud className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{cluster.name}</span>
                        {cluster.k8s_version && (
                          <span className="text-[10px] text-gray-400 font-mono">
                            v{cluster.k8s_version}
                          </span>
                        )}
                      </div>
                      {cluster.account_name ? (
                        <div className="text-[10px] text-orange-300/90 font-mono truncate mt-0.5">
                          {cluster.account_name} ({cluster.account_id}) • {cluster.region}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-500 truncate font-mono mt-0.5">
                          {cluster.server_url}
                        </span>
                      )}
                      {cluster.role && (
                        <div className="text-[9px] text-gray-500 font-mono truncate flex items-center space-x-1">
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                          <span>{cluster.role}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase shrink-0 ${getEnvBadgeClass(
                          cluster.environment
                        )}`}
                      >
                        {cluster.environment}
                      </span>
                      {onOpenClusterInNewTab && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenClusterInNewTab(cluster);
                            setIsOpen(false);
                          }}
                          className="px-1.5 py-0.5 rounded bg-surface hover:bg-indigo-600/30 text-gray-400 hover:text-indigo-200 border border-border text-[10px] font-mono flex items-center space-x-1 transition-colors"
                          title="Open cluster in new tab"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Tab</span>
                        </button>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer action to add/manage AWS SSO Orgs */}
            <div className="p-2 border-t border-border bg-surface/90">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenAddAwsOrg();
                }}
                className="w-full px-3 py-2 rounded-md bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/40 text-orange-300 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add AWS IAM Identity Center (SSO) Org</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
