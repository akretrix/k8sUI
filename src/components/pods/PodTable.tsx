import React, { useMemo, useState } from 'react';
import { PodSummary } from '../../types/cluster';
import { NamespaceMultiSelect } from '../common/NamespaceMultiSelect';
import { ColumnDefinition, ColumnVisibilityDropdown } from '../common/ColumnVisibilityDropdown';
import {
  Layers,
  Terminal,
  ArrowUpDown,
  Filter,
  FileCode,
  Scale,
  Network,
  RefreshCw,
  Trash2,
  FileText,
  Info,
  Loader2,
  AlertTriangle,
  WifiOff,
  KeyRound,
  ExternalLink,
} from 'lucide-react';

interface PodTableProps {
  pods: PodSummary[];
  selectedNamespaces: string[];
  namespaces: string[];
  isReadOnly: boolean;
  isAdvancedMode: boolean;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  onSelectNamespaces: (namespaces: string[]) => void;
  onScalePod: (pod: PodSummary) => void;
  onViewYaml: (pod: PodSummary) => void;
  onExecPod: (pod: PodSummary) => void;
  onPortForwardPod: (pod: PodSummary) => void;
  onDescribePod?: (pod: PodSummary) => void;
  onLogsPod?: (pod: PodSummary) => void;
  onDeletePod?: (pod: PodSummary) => void;
  onRefresh: () => void;
  onReconnect?: () => void;
  onSsoLogin?: () => void;
}

const DEFAULT_POD_COLUMNS: ColumnDefinition[] = [
  { id: 'name', label: 'Name', visible: true, locked: true },
  { id: 'namespace', label: 'Namespace', visible: true },
  { id: 'ready', label: 'Ready / Containers', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'restarts', label: 'Restarts', visible: true },
  { id: 'age', label: 'Age', visible: true },
  { id: 'cpu', label: 'CPU', visible: true },
  { id: 'memory', label: 'Memory', visible: true },
  { id: 'node', label: 'Node', visible: true },
  { id: 'actions', label: 'Actions', visible: true },
];

export const PodTable: React.FC<PodTableProps> = ({
  pods,
  selectedNamespaces,
  namespaces,
  isReadOnly,
  isAdvancedMode: _isAdvancedMode,
  isLoading = false,
  isError = false,
  errorMessage,
  searchTerm: externalSearchTerm,
  onSearchChange,
  onSelectNamespaces,
  onScalePod,
  onViewYaml,
  onExecPod,
  onPortForwardPod,
  onDescribePod,
  onLogsPod,
  onDeletePod,
  onRefresh,
  onReconnect,
  onSsoLogin,
}) => {
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;
  const setSearchTerm = onSearchChange || setInternalSearchTerm;
  const [sortField, setSortField] = useState<keyof PodSummary>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Column Visibility state initialized with localStorage
  const [columns, setColumns] = useState<ColumnDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('pod_table_columns_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return DEFAULT_POD_COLUMNS.map((col) => ({
          ...col,
          visible: parsed[col.id] !== undefined ? parsed[col.id] : col.visible,
        }));
      }
    } catch {
      // fallback
    }
    return DEFAULT_POD_COLUMNS;
  });

  const isColVisible = useMemo(() => {
    const map: Record<string, boolean> = {};
    columns.forEach((c) => {
      map[c.id] = c.visible;
    });
    return map;
  }, [columns]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Running':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800">
            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Running
          </span>
        );
      case 'Pending':
      case 'ContainerCreating':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800">
            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-amber-400" />
            {status}
          </span>
        );
      case 'CrashLoopBackOff':
      case 'Error':
      case 'OOMKilled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-950/80 text-red-300 border border-red-800">
            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-red-400" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-800 text-gray-300 border border-gray-700">
            {status}
          </span>
        );
    }
  };

  const renderContainerDots = (pod: PodSummary) => {
    if (pod.containers && pod.containers.length > 0) {
      return (
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5">
            {pod.containers.map((c, i) => {
              const isReady = c.ready;
              const state = (c.state || '').toLowerCase();
              let colorClass = 'bg-emerald-400 border-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.6)]';
              let titleText = `${c.name}: Running (Ready)`;

              if (state.includes('wait') || state.includes('crash') || state.includes('backoff') || state.includes('image') || state.includes('creating') || !isReady) {
                colorClass = 'bg-amber-400 border-amber-500 shadow-[0_0_6px_rgba(251,191,36,0.6)]';
                titleText = `${c.name}: ${c.reason || c.state} (Not Ready)`;
              }
              if (state.includes('error') || state.includes('fail') || state.includes('kill') || state.includes('oom')) {
                colorClass = 'bg-rose-500 border-rose-600 shadow-[0_0_6px_rgba(244,63,94,0.6)]';
                titleText = `${c.name}: ${c.reason || c.state} (Failed)`;
              }
              if (state.includes('terminat') || state.includes('complet') || state.includes('succeed')) {
                colorClass = 'bg-gray-400 border-gray-500';
                titleText = `${c.name}: ${c.reason || 'Completed'}`;
              }

              return (
                <span
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full border ${colorClass} transition-transform hover:scale-125 cursor-help shrink-0`}
                  title={titleText}
                />
              );
            })}
          </div>
          <span className="font-mono text-gray-300 font-semibold">{pod.ready_containers}</span>
        </div>
      );
    }

    // Fallback if detailed containers array not provided
    const [readyStr, totalStr] = (pod.ready_containers || '1/1').split('/');
    const ready = parseInt(readyStr, 10) || 0;
    const total = parseInt(totalStr, 10) || 1;
    const dots = [];
    for (let i = 0; i < total; i++) {
      const isReady = i < ready;
      dots.push(
        <span
          key={i}
          className={`w-2.5 h-2.5 rounded-full border shrink-0 ${
            isReady
              ? 'bg-emerald-400 border-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
              : 'bg-amber-400 border-amber-500'
          }`}
          title={`Container ${i + 1}/${total}: ${isReady ? 'Ready' : 'Not Ready'}`}
        />
      );
    }
    return (
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1.5">{dots}</div>
        <span className="font-mono text-gray-300 font-semibold">{pod.ready_containers}</span>
      </div>
    );
  };

  const filteredPods = (pods || [])
    .filter((pod) => {
      if (!pod) return false;
      const podNs = pod.namespace || 'default';
      const matchNs =
        selectedNamespaces.length === 0 ||
        selectedNamespaces.some((s) => s.toLowerCase() === podNs.toLowerCase());
      const nameStr = pod.name || '';
      const nsStr = pod.namespace || '';
      const nodeStr = pod.node || '';
      const matchSearch =
        nameStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        nsStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        nodeStr.toLowerCase().includes(searchTerm.toLowerCase());
      return matchNs && matchSearch;
    })
    .sort((a, b) => {
      const valA = (a && a[sortField]) || '';
      const valB = (b && b[sortField]) || '';
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  const toggleSort = (field: keyof PodSummary) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Controls Bar: Namespace filter + Search + Columns + Refresh */}
      <div className="h-12 border-b border-border bg-surface/50 px-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs text-gray-400 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Namespace:</span>
          </div>
          <NamespaceMultiSelect
            namespaces={namespaces}
            selected={selectedNamespaces}
            onChange={onSelectNamespaces}
          />
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="text"
            placeholder="Filter pods..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-surface-elevated border border-border rounded-md px-3 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-48 lg:w-64 font-mono"
          />

          {/* Column Visibility Picker */}
          <ColumnVisibilityDropdown
            columns={columns}
            onChange={setColumns}
            storageKey="pod_table_columns_v1"
          />

          <button
            onClick={onRefresh}
            className="p-1.5 rounded-md border border-border text-gray-400 hover:text-gray-200 hover:bg-surface-elevated transition-colors"
            title="Refresh stream"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Pod List Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-surface/80 text-gray-400 sticky top-0 z-10 border-b border-border font-mono uppercase text-[11px]">
            <tr>
              {isColVisible.name && (
                <th
                  onClick={() => toggleSort('name')}
                  className="py-2.5 px-4 font-medium cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
              )}
              {isColVisible.namespace && (
                <th
                  onClick={() => toggleSort('namespace')}
                  className="py-2.5 px-3 font-medium cursor-pointer hover:text-white"
                >
                  Namespace
                </th>
              )}
              {isColVisible.ready && (
                <th className="py-2.5 px-3 font-medium">Ready</th>
              )}
              {isColVisible.status && (
                <th
                  onClick={() => toggleSort('status')}
                  className="py-2.5 px-3 font-medium cursor-pointer hover:text-white"
                >
                  Status
                </th>
              )}
              {isColVisible.restarts && (
                <th className="py-2.5 px-3 font-medium">Restarts</th>
              )}
              {isColVisible.age && (
                <th className="py-2.5 px-3 font-medium">Age</th>
              )}
              {isColVisible.cpu && (
                <th className="py-2.5 px-3 font-medium hidden md:table-cell">CPU</th>
              )}
              {isColVisible.memory && (
                <th className="py-2.5 px-3 font-medium hidden md:table-cell">Memory</th>
              )}
              {isColVisible.node && (
                <th className="py-2.5 px-3 font-medium hidden lg:table-cell">Node</th>
              )}
              {isColVisible.actions && (
                <th className="py-2.5 px-4 font-medium text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 font-mono">
            {isLoading && filteredPods.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-16 text-center text-sm text-gray-400 font-sans">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                    <span className="font-mono text-xs text-gray-400">Loading pods from cluster…</span>
                  </div>
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={10} className="py-16 text-center text-sm font-sans">
                  {(() => {
                    const errMessage = errorMessage || 'Cluster communication error';
                    const lowerErr = errMessage.toLowerCase();
                    const isAuthError =
                      lowerErr.includes('401') ||
                      lowerErr.includes('unauthorized') ||
                      lowerErr.includes('token') ||
                      lowerErr.includes('expired') ||
                      lowerErr.includes('sso') ||
                      lowerErr.includes('unrecognizedclientexception');
                    const isTimeout =
                      lowerErr.includes('time') ||
                      lowerErr.includes('vpn') ||
                      lowerErr.includes('timed out') ||
                      lowerErr.includes('unreachable') ||
                      lowerErr.includes('connection refused') ||
                      lowerErr.includes('connection');

                    return (
                      <div className="max-w-md mx-auto flex flex-col items-center space-y-3 bg-surface-elevated/40 border border-border/80 rounded-xl p-6 shadow-lg">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center border ${
                            isAuthError
                              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                              : isTimeout
                              ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                              : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                          }`}
                        >
                          {isAuthError ? (
                            <KeyRound className="w-6 h-6" />
                          ) : isTimeout ? (
                            <WifiOff className="w-6 h-6" />
                          ) : (
                            <AlertTriangle className="w-6 h-6" />
                          )}
                        </div>

                        <div className="text-sm font-semibold text-gray-200">
                          {isAuthError
                            ? 'Authentication Token Expired'
                            : isTimeout
                            ? 'Cluster Connection Unreachable'
                            : 'Failed to load pods'}
                        </div>

                        <p className="text-xs text-gray-400 font-mono text-center max-w-sm">
                          {isAuthError
                            ? 'Your credentials or AWS SSO session has expired. Please refresh your session or re-authenticate.'
                            : isTimeout
                            ? 'Unable to communicate with the Kubernetes API server. Check if your VPN is connected.'
                            : errMessage}
                        </p>

                        <div className="flex items-center space-x-2.5 pt-2">
                          {isAuthError && onSsoLogin && (
                            <button
                              onClick={onSsoLogin}
                              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-xs flex items-center space-x-1.5 shadow transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Login via AWS SSO</span>
                            </button>
                          )}
                          {onReconnect && (
                            <button
                              onClick={onReconnect}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-xs flex items-center space-x-1.5 shadow transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Reconnect Cluster</span>
                            </button>
                          )}
                          <button
                            onClick={onRefresh}
                            className="px-3.5 py-1.5 bg-surface-elevated hover:bg-surface border border-border rounded-lg text-xs text-gray-200 font-medium transition-colors"
                          >
                            Retry
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </td>
              </tr>
            ) : filteredPods.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-gray-500 font-sans">
                  No pods found matching query in current namespace.
                </td>
              </tr>
            ) : (
              filteredPods.map((pod) => (
                <tr
                  key={`${pod.namespace}-${pod.name}`}
                  onClick={() => onDescribePod ? onDescribePod(pod) : onViewYaml(pod)}
                  className="hover:bg-surface-elevated/50 transition-colors group cursor-pointer"
                >
                  {isColVisible.name && (
                    <td className="py-2.5 px-4 font-semibold text-gray-100 flex items-center space-x-2">
                      <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate max-w-xs">{pod.name}</span>
                    </td>
                  )}
                  {isColVisible.namespace && (
                    <td className="py-2.5 px-3 text-gray-400">{pod.namespace}</td>
                  )}
                  {isColVisible.ready && (
                    <td className="py-2.5 px-3 text-gray-300">
                      {renderContainerDots(pod)}
                    </td>
                  )}
                  {isColVisible.status && (
                    <td className="py-2.5 px-3">{getStatusBadge(pod.status)}</td>
                  )}
                  {isColVisible.restarts && (
                    <td className="py-2.5 px-3 text-gray-400">
                      <span className={pod.restarts > 0 ? 'text-amber-400 font-bold' : ''}>
                        {pod.restarts}
                      </span>
                    </td>
                  )}
                  {isColVisible.age && (
                    <td className="py-2.5 px-3 text-gray-300">
                      <div
                        className="flex flex-col cursor-help"
                        title={pod.created_at ? `Created: ${new Date(pod.created_at).toLocaleString()}` : undefined}
                      >
                        <span className="font-mono text-xs text-gray-300">{pod.age}</span>
                        {pod.created_at && (
                          <span className="text-[10px] text-gray-500 font-mono truncate max-w-[120px]">
                            {new Date(pod.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </td>
                  )}
                  {isColVisible.cpu && (
                    <td className="py-2.5 px-3 text-gray-400 hidden md:table-cell">
                      {pod.cpu || '-'}
                    </td>
                  )}
                  {isColVisible.memory && (
                    <td className="py-2.5 px-3 text-gray-400 hidden md:table-cell">
                      {pod.memory || '-'}
                    </td>
                  )}
                  {isColVisible.node && (
                    <td className="py-2.5 px-3 text-gray-500 hidden lg:table-cell truncate max-w-xs">
                      {pod.node || '-'}
                    </td>
                  )}
                  {isColVisible.actions && (
                    <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-1">
                        {/* Logs Action */}
                        {onLogsPod && (
                          <button
                            onClick={() => onLogsPod(pod)}
                            className="p-1 rounded text-gray-400 hover:text-emerald-300 hover:bg-surface-hover transition-colors"
                            title="View Live Logs"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Describe Action */}
                        {onDescribePod && (
                          <button
                            onClick={() => onDescribePod(pod)}
                            className="p-1 rounded text-gray-400 hover:text-indigo-300 hover:bg-surface-hover transition-colors"
                            title="Describe Pod"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* YAML Action */}
                        <button
                          onClick={() => onViewYaml(pod)}
                          className="p-1 rounded text-gray-400 hover:text-blue-300 hover:bg-surface-hover transition-colors"
                          title="View / Edit Raw YAML"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                        </button>

                        {/* Exec Terminal */}
                        <button
                          onClick={() => onExecPod(pod)}
                          className="p-1 rounded text-gray-400 hover:text-green-400 hover:bg-surface-hover transition-colors"
                          title="Interactive Exec Shell (bash / sh)"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>

                        {/* Port Forward */}
                        <button
                          onClick={() => onPortForwardPod(pod)}
                          className="p-1 rounded text-gray-400 hover:text-cyan-300 hover:bg-surface-hover transition-colors"
                          title="Open Port-Forward Tunnel"
                        >
                          <Network className="w-3.5 h-3.5" />
                        </button>

                        {/* Scale Action */}
                        <button
                          onClick={() => onScalePod(pod)}
                          disabled={isReadOnly}
                          className={`p-1 rounded text-gray-400 hover:text-amber-300 transition-colors ${
                            isReadOnly ? 'opacity-30 cursor-not-allowed' : 'hover:bg-surface-hover'
                          }`}
                          title={isReadOnly ? 'Read-Only Mode: Unlock to scale' : 'Scale Deployment Replicas'}
                        >
                          <Scale className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Action */}
                        {onDeletePod && (
                          <button
                            onClick={() => onDeletePod(pod)}
                            disabled={isReadOnly}
                            className={`p-1 rounded text-gray-400 hover:text-red-400 transition-colors ${
                              isReadOnly ? 'opacity-30 cursor-not-allowed' : 'hover:bg-surface-hover'
                            }`}
                            title={isReadOnly ? 'Read-Only Mode: Unlock to delete' : 'Delete Pod'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

