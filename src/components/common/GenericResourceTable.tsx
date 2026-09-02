import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { api } from '../../api/tauriClient';
import { RefreshCcw, Loader2, AlertTriangle, Globe, XCircle, FileCode, Plus, WifiOff, KeyRound, RefreshCw, ExternalLink } from 'lucide-react';
import { NamespaceMultiSelect } from './NamespaceMultiSelect';
import { ColumnDefinition, ColumnVisibilityDropdown } from './ColumnVisibilityDropdown';
import { HelmInstallModal } from '../helm/HelmInstallModal';

interface GenericResourceTableProps {
  kind: string;
  selectedNamespaces: string[];
  namespaces: string[];
  isReadOnly?: boolean;
  filterQuery?: string;
  onFilterQueryChange?: (query: string) => void;
  onSelectNamespaces: (namespaces: string[]) => void;
  onDescribe: (resource: any) => void;
  onViewYaml: (resource: any) => void;
  onDelete: (resource: any) => void;
  onLogs?: (resource: any) => void;
  onRestart?: (resource: any) => void;
  onScale?: (resource: any) => void;
  onReconnect?: () => void;
  onSsoLogin?: () => void;
}

const columnHelper = createColumnHelper<any>();

export const GenericResourceTable: React.FC<GenericResourceTableProps> = ({
  kind,
  selectedNamespaces,
  namespaces,
  isReadOnly = false,
  filterQuery: externalGlobalFilter,
  onFilterQueryChange,
  onSelectNamespaces,
  onDescribe,
  onViewYaml,
  onDelete,
  onLogs,
  onRestart,
  onScale,
  onReconnect,
  onSsoLogin,
}) => {
  const [internalGlobalFilter, setInternalGlobalFilter] = useState('');
  const [isInstallingHelm, setIsInstallingHelm] = useState(false);
  const isHelm = ['helm', 'helmrelease', 'helm-releases', 'helmreleases'].includes(kind.toLowerCase());
  const globalFilter = externalGlobalFilter !== undefined ? externalGlobalFilter : internalGlobalFilter;
  const setGlobalFilter = onFilterQueryChange || setInternalGlobalFilter;

  // Column Visibility state initialized with localStorage
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`columns_visibility_${kind.toLowerCase()}`);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {};
  });

  const CLUSTER_SCOPED_KINDS = [
    'nodes',
    'crds',
    'customresourcedefinitions',
    'namespaces',
    'storageclasses',
    'clusterroles',
    'clusterrolebindings',
    'pvs',
    'persistentvolumes',
    'priorityclasses',
    'ingressclasses',
    'mutatingwebhooks',
    'mutatingwebhookconfigurations',
    'validatingwebhooks',
    'validatingwebhookconfigurations',
  ];

  const isClusterScoped = CLUSTER_SCOPED_KINDS.includes(kind.toLowerCase());

  const { data: rawResources = [], isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['resources', kind, isClusterScoped ? 'cluster' : selectedNamespaces],
    queryFn: () =>
      api.listResources(
        kind,
        !isClusterScoped && selectedNamespaces.length === 1 ? selectedNamespaces[0] : undefined
      ),
    retry: process.env.NODE_ENV === 'test' ? false : 2,
    refetchInterval: process.env.NODE_ENV === 'test' ? false : 5000,
  });

  const resources = useMemo(() => {
    const list = Array.isArray(rawResources) ? rawResources : [];
    if (isClusterScoped || selectedNamespaces.length <= 1) return list;
    return list.filter((r: any) => {
      const rNs = (r && r.namespace) || 'default';
      return selectedNamespaces.some((s) => s.toLowerCase() === rNs.toLowerCase());
    });
  }, [rawResources, selectedNamespaces, isClusterScoped]);

  const columns = useMemo(() => {
    const cols: any[] = [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (info) => (
          <span className="font-mono text-xs font-medium text-gray-100 group-hover:text-brand-300 transition-colors">
            {info.getValue() || '-'}
          </span>
        ),
      }),
    ];

    if (!isClusterScoped) {
      cols.push(
        columnHelper.accessor('namespace', {
          header: 'Namespace',
          cell: (info) => (
            <span className="text-gray-400 text-xs font-mono">
              {info.getValue() || 'default'}
            </span>
          ),
        })
      );
    }

    const k = (kind || '').toLowerCase();
    if (['nodes', 'node', 'no'].includes(k)) {
      cols.push(
        columnHelper.accessor('roles', {
          header: 'Roles',
          cell: (info) => <span className="text-gray-300 text-xs font-mono">{info.getValue() || '<none>'}</span>,
        }),
        columnHelper.accessor('instanceType', {
          header: 'Instance Type',
          cell: (info) => (
            <span className="text-xs font-mono text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/50">
              {info.getValue() || '-'}
            </span>
          ),
        }),
        columnHelper.accessor('zone', {
          header: 'Zone',
          cell: (info) => (
            <span className="text-xs font-mono text-indigo-300">
              {info.getValue() || '-'}
            </span>
          ),
        }),
        columnHelper.accessor('cpu', {
          header: 'CPU Usage / Alloc',
          cell: (info) => {
            const val = info.getValue() || '-';
            const num = parseInt(val, 10);
            const pct = isNaN(num) ? null : Math.min(100, Math.max(0, num));
            const sub = info.row.original.cpuCores;
            const color = pct !== null && pct > 80 ? 'bg-red-500' : pct !== null && pct > 60 ? 'bg-amber-500' : 'bg-brand-500';

            return (
              <div className="flex flex-col space-y-1 min-w-[110px]">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-semibold text-gray-200">{val}</span>
                  {sub && <span className="text-[10px] text-gray-400">{sub}</span>}
                </div>
                {pct !== null && (
                  <div className="w-full bg-surface-elevated h-1.5 rounded-full overflow-hidden border border-border/50">
                    <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          },
        }),
        columnHelper.accessor('memory', {
          header: 'Mem Usage / Alloc',
          cell: (info) => {
            const val = info.getValue() || '-';
            const num = parseInt(val, 10);
            const pct = isNaN(num) ? null : Math.min(100, Math.max(0, num));
            const sub = info.row.original.memoryFormatted;
            const color = pct !== null && pct > 80 ? 'bg-red-500' : pct !== null && pct > 60 ? 'bg-amber-500' : 'bg-emerald-500';

            return (
              <div className="flex flex-col space-y-1 min-w-[110px]">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-semibold text-gray-200">{val}</span>
                  {sub && <span className="text-[10px] text-gray-400">{sub}</span>}
                </div>
                {pct !== null && (
                  <div className="w-full bg-surface-elevated h-1.5 rounded-full overflow-hidden border border-border/50">
                    <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          },
        }),
        columnHelper.accessor('version', {
          header: 'Kubelet Version',
          cell: (info) => <span className="text-gray-300 text-xs font-mono">{info.getValue() || '-'}</span>,
        }),
        columnHelper.accessor('osImage', {
          header: 'OS Image',
          cell: (info) => <span className="text-gray-400 text-xs truncate max-w-[130px] block">{info.getValue() || '-'}</span>,
        })
      );
    } else if (['deployments', 'deployment', 'deploy', 'daemonsets', 'daemonset', 'ds', 'statefulsets', 'statefulset', 'statefullsets', 'statefullset', 'sts', 'replicasets', 'replicaset', 'rs'].includes(k)) {
      if (['daemonsets', 'daemonset', 'ds', 'replicasets', 'replicaset', 'rs'].includes(k)) {
        cols.push(
          columnHelper.accessor('desired', { header: 'Desired', cell: (info) => <span className="text-gray-400 text-xs font-mono">{info.getValue() || '-'}</span> }),
          columnHelper.accessor('current', { header: 'Current', cell: (info) => <span className="text-gray-400 text-xs font-mono">{info.getValue() || '-'}</span> })
        );
      }
      cols.push(
        columnHelper.accessor('ready', {
          header: 'Ready',
          cell: (info) => <span className="text-xs font-mono font-medium text-gray-200">{info.getValue() || '-'}</span>,
        })
      );
      if (['deployments', 'deployment', 'deploy', 'daemonsets', 'daemonset', 'ds'].includes(k)) {
        cols.push(
          columnHelper.accessor('upToDate', { header: 'Up-to-date', cell: (info) => <span className="text-gray-400 text-xs">{info.getValue() || '-'}</span> }),
          columnHelper.accessor('available', { header: 'Available', cell: (info) => <span className="text-gray-400 text-xs">{info.getValue() || '-'}</span> })
        );
      }
    } else if (['jobs', 'job'].includes(k)) {
      cols.push(
        columnHelper.accessor('completions', { header: 'Completions', cell: (info) => <span className="text-xs font-mono text-gray-200">{info.getValue() || '-'}</span> })
      );
    } else if (['cronjobs', 'cronjob', 'cj'].includes(k)) {
      cols.push(
        columnHelper.accessor('schedule', { header: 'Schedule', cell: (info) => <span className="text-xs font-mono text-brand-300">{info.getValue() || '-'}</span> }),
        columnHelper.accessor('suspend', {
          header: 'Suspend',
          cell: (info) => <span className="text-xs text-gray-400">{info.getValue() ? 'True' : 'False'}</span>,
        })
      );
    } else if (['services', 'service', 'svc'].includes(k)) {
      cols.push(
        columnHelper.accessor('type', { header: 'Type', cell: (info) => <span className="text-gray-400 text-xs font-mono">{info.getValue() || '-'}</span> }),
        columnHelper.accessor('clusterIP', { header: 'Cluster-IP', cell: (info) => <span className="text-gray-400 text-xs font-mono">{info.getValue() || '-'}</span> }),
        columnHelper.accessor('externalIP', { header: 'External-IP', cell: (info) => <span className="text-gray-400 text-xs font-mono">{info.getValue() || '-'}</span> }),
        columnHelper.accessor('ports', { header: 'Ports', cell: (info) => <span className="text-gray-400 text-xs font-mono">{info.getValue() || '-'}</span> })
      );
    } else if (['configmaps', 'configmap', 'cm'].includes(k)) {
      cols.push(
        columnHelper.accessor('dataCount', { header: 'Data Keys', cell: (info) => <span className="text-xs font-mono text-gray-300">{info.getValue() ?? '-'}</span> })
      );
    } else if (['secrets', 'secret', 'sec'].includes(k)) {
      cols.push(
        columnHelper.accessor('secretType', { header: 'Type', cell: (info) => <span className="text-xs font-mono text-gray-300">{info.getValue() || 'Opaque'}</span> }),
        columnHelper.accessor('dataCount', { header: 'Data Keys', cell: (info) => <span className="text-xs font-mono text-gray-300">{info.getValue() ?? '-'}</span> })
      );
    } else if (['pvcs', 'pvc', 'persistentvolumeclaims', 'persistentvolumeclaim'].includes(k)) {
      cols.push(
        columnHelper.accessor('capacity', { header: 'Capacity', cell: (info) => <span className="text-xs font-mono text-gray-300">{info.getValue() || '-'}</span> }),
        columnHelper.accessor('storageClass', { header: 'Storage Class', cell: (info) => <span className="text-xs font-mono text-gray-400">{info.getValue() || '-'}</span> })
      );
    } else if (['roles', 'role', 'ro', 'clusterroles', 'clusterrole', 'cr'].includes(k)) {
      cols.push(
        columnHelper.accessor('rulesCount', { header: 'Rules', cell: (info) => <span className="text-xs font-mono text-gray-300">{info.getValue() ?? 0} rules</span> })
      );
    } else if (['rolebindings', 'rolebinding', 'rb', 'clusterrolebindings', 'clusterrolebinding', 'crb'].includes(k)) {
      cols.push(
        columnHelper.accessor('roleRef', { header: 'Role Ref', cell: (info) => <span className="text-xs font-mono text-indigo-300">{info.getValue() || '-'}</span> }),
        columnHelper.accessor('subjectsCount', { header: 'Subjects', cell: (info) => <span className="text-xs font-mono text-gray-300">{info.getValue() ?? 0}</span> })
      );
    } else if (['serviceaccounts', 'serviceaccount', 'sa'].includes(k)) {
      cols.push(
        columnHelper.accessor('secretsCount', { header: 'Secrets', cell: (info) => <span className="text-xs font-mono text-gray-300">{info.getValue() ?? 0}</span> })
      );
    } else if (['ingresses', 'ingress', 'ing'].includes(k)) {
      cols.push(
        columnHelper.accessor('ingressClass', { header: 'Ingress Class', cell: (info) => <span className="text-xs font-mono text-cyan-300">{info.getValue() || '-'}</span> })
      );
    } else if (['pvs', 'pv', 'persistentvolumes', 'persistentvolume'].includes(k)) {
      cols.push(
        columnHelper.accessor('capacity', { header: 'Capacity', cell: (info) => <span className="text-xs font-mono text-gray-300">{info.getValue() || '-'}</span> }),
        columnHelper.accessor('storageClass', { header: 'Storage Class', cell: (info) => <span className="text-xs font-mono text-gray-400">{info.getValue() || '-'}</span> })
      );
    } else if (['storageclasses', 'storageclass', 'sc'].includes(k)) {
      cols.push(
        columnHelper.accessor('provisioner', { header: 'Provisioner', cell: (info) => <span className="text-xs font-mono text-gray-300">{info.getValue() || '-'}</span> }),
        columnHelper.accessor('reclaimPolicy', { header: 'Reclaim Policy', cell: (info) => <span className="text-xs font-mono text-gray-400">{info.getValue() || '-'}</span> })
      );
    } else if (['limitranges', 'limitrange', 'limits', 'limit'].includes(k)) {
      cols.push(
        columnHelper.accessor('limitType', { header: 'Type / Scope', cell: (info) => <span className="text-xs font-mono text-indigo-300">{info.getValue() || 'Container'}</span> })
      );
    } else if (['resourcequotas', 'resourcequota', 'quotas', 'quota'].includes(k)) {
      cols.push(
        columnHelper.accessor('hardCount', { header: 'Hard Limits', cell: (info) => <span className="text-xs font-mono text-gray-200">{info.getValue() ?? 0} items</span> }),
        columnHelper.accessor('usedCount', { header: 'Used Tracking', cell: (info) => <span className="text-xs font-mono text-emerald-400">{info.getValue() ?? 0} items</span> })
      );
    } else if (['pdbs', 'pdb', 'poddisruptionbudgets', 'poddisruptionbudget'].includes(k)) {
      cols.push(
        columnHelper.accessor('minAvailable', { header: 'Min Available', cell: (info) => <span className="text-xs font-mono text-amber-300">{info.getValue() || '1'}</span> }),
        columnHelper.accessor('disruptionsAllowed', { header: 'Allowed Disruptions', cell: (info) => <span className="text-xs font-mono text-emerald-400 font-semibold">{info.getValue() ?? 0}</span> }),
        columnHelper.accessor('healthyRatio', { header: 'Healthy Pods', cell: (info) => <span className="text-xs font-mono text-gray-300">{info.getValue() || '-'}</span> })
      );
    } else if (['hpas', 'hpa', 'horizontalpodautoscalers', 'horizontalpodautoscaler'].includes(k)) {
      cols.push(
        columnHelper.accessor('replicasRatio', { header: 'Min-Max (Current)', cell: (info) => <span className="text-xs font-mono text-cyan-300">{info.getValue() || '-'}</span> })
      );
    } else if (['priorityclasses', 'priorityclass', 'pc'].includes(k)) {
      cols.push(
        columnHelper.accessor('priorityValue', { header: 'Value', cell: (info) => <span className="text-xs font-mono font-bold text-amber-300">{info.getValue() ?? 0}</span> }),
        columnHelper.accessor('globalDefault', { header: 'Global Default', cell: (info) => <span className="text-xs font-mono text-gray-400">{info.getValue() ? 'true' : 'false'}</span> })
      );
    } else if (['mutatingwebhooks', 'mutatingwebhookconfigurations', 'validatingwebhooks', 'validatingwebhookconfigurations'].includes(k)) {
      cols.push(
        columnHelper.accessor('webhooksCount', {
          header: 'Webhooks',
          cell: (info) => {
            const count = info.getValue() ?? 0;
            const names = info.row.original.webhookNames || '';
            return (
              <div className="flex items-center space-x-1.5" title={names}>
                <span className="px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-700/50 text-indigo-300 font-mono text-xs font-semibold">
                  {count} {count === 1 ? 'hook' : 'hooks'}
                </span>
                {names && (
                  <span className="text-[11px] text-gray-400 font-mono truncate max-w-[200px]">
                    {names}
                  </span>
                )}
              </div>
            );
          },
        }),
        columnHelper.accessor('failurePolicy', {
          header: 'Failure Policy',
          cell: (info) => {
            const val = info.getValue() || 'Fail';
            const isFail = val.toLowerCase() === 'fail';
            return (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border ${
                  isFail
                    ? 'bg-rose-950/40 text-rose-300 border-rose-800/60'
                    : 'bg-amber-950/40 text-amber-300 border-amber-800/60'
                }`}
              >
                {val}
              </span>
            );
          },
        }),
        columnHelper.accessor('sideEffects', {
          header: 'Side Effects',
          cell: (info) => (
            <span className="text-gray-400 text-xs font-mono">{info.getValue() || 'None'}</span>
          ),
        }),
        columnHelper.accessor('timeoutSeconds', {
          header: 'Timeout',
          cell: (info) => (
            <span className="text-gray-300 text-xs font-mono">{info.getValue() || '10s'}</span>
          ),
        })
      );
    } else if (['events', 'event'].includes(k)) {
      cols.push(
        columnHelper.accessor('reason', { header: 'Reason', cell: (info) => <span className="text-xs font-semibold text-gray-200">{info.getValue() || '-'}</span> }),
        columnHelper.accessor('message', { header: 'Message', cell: (info) => <span className="text-xs text-gray-300 max-w-md truncate block">{info.getValue() || '-'}</span> })
      );
    } else {
      // Dynamic column detection for Custom Resources (e.g. certificates, targetgroupbindings, scaledobjects, etc.)
      const sample = Array.isArray(rawResources) && rawResources.length > 0 ? rawResources[0] : null;
      if (sample) {
        if ('ready' in sample && sample.ready !== undefined) {
          cols.push(
            columnHelper.accessor('ready', {
              header: 'Ready',
              cell: (info) => {
                const r = String(info.getValue() ?? '-');
                const isReady = r.toLowerCase() === 'true' || r.toLowerCase() === 'ready';
                return (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border ${
                      isReady
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {r}
                  </span>
                );
              },
            })
          );
        }
        if ('phase' in sample && sample.phase !== undefined) {
          cols.push(
            columnHelper.accessor('phase', {
              header: 'Phase',
              cell: (info) => <span className="text-xs font-mono text-cyan-300">{String(info.getValue() ?? '-')}</span>,
            })
          );
        }
        if ('replicas' in sample && sample.replicas !== undefined) {
          cols.push(
            columnHelper.accessor('replicas', {
              header: 'Replicas',
              cell: (info) => <span className="text-xs font-mono text-indigo-300">{String(info.getValue() ?? '-')}</span>,
            })
          );
        }
        if ('secretName' in sample && sample.secretName !== undefined) {
          cols.push(
            columnHelper.accessor('secretName', {
              header: 'Secret',
              cell: (info) => <span className="text-xs font-mono text-gray-300">{String(info.getValue() ?? '-')}</span>,
            })
          );
        }
        if ('issuer' in sample && sample.issuer !== undefined) {
          cols.push(
            columnHelper.accessor('issuer', {
              header: 'Issuer',
              cell: (info) => <span className="text-xs font-mono text-indigo-300">{String(info.getValue() ?? '-')}</span>,
            })
          );
        }
      }
    }

    cols.push(
      columnHelper.accessor('labels', {
        id: 'labels',
        header: 'Labels',
        cell: (info) => {
          const rawLabels = info.getValue();
          if (!rawLabels) return <span className="text-gray-600 font-mono text-[11px]">—</span>;
          const entries = typeof rawLabels === 'object' && rawLabels !== null ? Object.entries(rawLabels) : [];
          if (entries.length === 0) return <span className="text-gray-600 font-mono text-[11px]">—</span>;

          const displayEntries = entries.slice(0, 2);
          const remaining = entries.length - displayEntries.length;

          return (
            <div className="flex flex-wrap items-center gap-1 max-w-[240px]" title={entries.map(([k, v]) => `${k}=${v}`).join('\n')}>
              {displayEntries.map(([k, v]) => (
                <span
                  key={k}
                  className="px-1.5 py-0.5 rounded bg-surface-elevated/90 border border-border text-[10px] font-mono text-gray-300 truncate max-w-[120px]"
                >
                  <span className="text-gray-400">{k.split('/').pop()}=</span>
                  <span className="text-cyan-300 font-semibold">{String(v)}</span>
                </span>
              ))}
              {remaining > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-cyan-950/40 text-cyan-400 border border-cyan-800/40 text-[10px] font-mono font-semibold">
                  +{remaining}
                </span>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => {
          const rawVal = info.getValue();
          const val = rawVal !== undefined && rawVal !== null ? String(rawVal) : 'Active';
          const isHealthy =
            val.includes('Active') ||
            val.includes('Ready') ||
            val.includes('Normal') ||
            val.includes('Bound') ||
            val.includes('Completed') ||
            val.includes('deployed') ||
            val.includes('True') ||
            val === '-';
          const colorClass = isHealthy
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            : 'bg-amber-500/15 text-amber-400 border-amber-500/30';

          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
              {val}
            </span>
          );
        },
      }),
      columnHelper.accessor('age', {
        header: 'Age',
        cell: (info) => {
          const row = info.row.original;
          const age = info.getValue() || '-';
          const creationTimestamp = row.creationTimestamp;
          return (
            <div
              className="flex flex-col cursor-help"
              title={creationTimestamp ? `Created: ${new Date(creationTimestamp).toLocaleString()}` : undefined}
            >
              <span className="text-gray-300 text-xs font-mono">{age}</span>
              {creationTimestamp && (
                <span className="text-[10px] text-gray-500 font-mono truncate max-w-[120px]">
                  {new Date(creationTimestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor((row) => row, {
        id: 'actions',
        header: 'Actions',
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onDescribe(row)}
                className="p-1 rounded hover:bg-surface-elevated text-gray-400 hover:text-brand-300 transition-colors"
                title="Describe Resource"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>
              {['deployments', 'statefulsets'].includes(kind) && onScale && (
                <button
                  onClick={() => onScale(row)}
                  className="p-1 rounded hover:bg-surface-elevated text-gray-400 hover:text-blue-300 transition-colors"
                  title="Scale Replicas"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                </button>
              )}
              {['deployments', 'statefulsets', 'daemonsets'].includes(kind) && (
                <button
                  onClick={() => { if (onRestart) onRestart(row); }}
                  className="p-1 rounded hover:bg-surface-elevated text-gray-400 hover:text-amber-300 transition-colors"
                  title="Rollout Restart"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              )}
              {['pods', 'deployments', 'daemonsets', 'statefulsets', 'jobs'].includes(kind) && (
                <button
                  onClick={() => { if (onLogs) onLogs(row); }}
                  className="p-1 rounded hover:bg-surface-elevated text-gray-400 hover:text-emerald-300 transition-colors"
                  title="View Logs"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                </button>
              )}
              <button
                onClick={() => onViewYaml(row)}
                className="p-1 rounded hover:bg-surface-elevated text-gray-400 hover:text-brand-300 transition-colors"
                title="Edit YAML"
              >
                <FileCode className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(row)}
                className="p-1 rounded hover:bg-surface-elevated text-gray-400 hover:text-rose-400 transition-colors"
                title="Delete Resource"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          );
        },
      })
    );

    return cols;
  }, [kind, isClusterScoped, rawResources, onDescribe, onScale, onRestart, onLogs, onViewYaml, onDelete]);

  const handleColumnVisibilityChange = (updatedCols: ColumnDefinition[]) => {
    const nextMap: Record<string, boolean> = {};
    updatedCols.forEach((c) => {
      nextMap[c.id] = c.visible;
    });
    setColumnVisibility(nextMap);
  };

  const table = useReactTable({
    data: resources,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter,
      columnVisibility,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
  });

  const colDefs: ColumnDefinition[] = useMemo(() => {
    return table.getAllLeafColumns().map((col) => {
      const headerVal = col.columnDef.header;
      const label = typeof headerVal === 'string' ? headerVal : col.id;
      return {
        id: col.id,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        visible: col.getIsVisible(),
        locked: col.id === 'name',
      };
    });
  }, [table, columns, columnVisibility]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface">
      {/* Toolbar */}
      <div className="h-12 border-b border-border flex items-center px-4 justify-between shrink-0 bg-surface-elevated/50">
        <div className="flex items-center space-x-3 flex-1">
          {!isClusterScoped ? (
            <div className="relative">
              <NamespaceMultiSelect
                namespaces={namespaces}
                selected={selectedNamespaces}
                onChange={onSelectNamespaces}
              />
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-surface border border-border text-xs text-gray-400 font-mono">
              <Globe className="w-3.5 h-3.5 text-brand-400" />
              <span>Cluster-Wide Scoped</span>
            </div>
          )}

          <div className="h-4 w-px bg-border" />

          <input
            type="text"
            placeholder={`Filter ${kind}...`}
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-gray-200 w-64 focus:outline-none focus:border-brand-500 transition-colors font-mono"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Helm Install Release Action */}
          {isHelm && (
            <button
              onClick={() => setIsInstallingHelm(true)}
              disabled={isReadOnly}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center space-x-1.5 transition-colors shadow-sm ${
                isReadOnly
                  ? 'opacity-40 cursor-not-allowed bg-surface-elevated border border-border text-gray-400'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
              title={isReadOnly ? 'Unlock Read-Only Mode to install' : 'Install Helm Chart'}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Install Chart</span>
            </button>
          )}

          {/* Column Visibility Picker */}
          <ColumnVisibilityDropdown
            columns={colDefs}
            onChange={handleColumnVisibilityChange}
            storageKey={`columns_visibility_${kind.toLowerCase()}`}
          />

          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-md hover:bg-surface-elevated text-gray-400 hover:text-gray-200 transition-colors flex items-center justify-center group"
            title="Refresh"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-brand-400' : 'group-hover:text-brand-300'}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-border relative">
          <thead className="bg-surface sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider select-none cursor-pointer hover:text-gray-200 transition-colors"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border/50 bg-background">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onDescribe(row.original)}
                className="hover:bg-surface-elevated/40 transition-colors group cursor-pointer"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center text-sm text-gray-400">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
                    <span className="font-mono text-xs text-gray-400">
                      Loading {kind} from cluster…
                    </span>
                  </div>
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center text-sm">
                  {(() => {
                    const errMessage = (error as any)?.message || String(error);
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
                            : `Failed to load ${kind}`}
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
                            onClick={() => refetch()}
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
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center text-sm">
                  <div className="max-w-md mx-auto flex flex-col items-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center border border-border text-gray-400">
                      <XCircle className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-gray-300">
                      No {kind} found {selectedNamespaces.length > 0 && !isClusterScoped ? `in "${selectedNamespaces.join(', ')}"` : 'in this cluster'}.
                    </div>
                    <p className="text-[11px] text-gray-500">
                      {selectedNamespaces.length > 0 && !isClusterScoped
                        ? 'This resource might be deployed in other namespaces (such as kube-system, monitoring, or default).'
                        : `There are currently no active instances of ${kind} running.`}
                    </p>
                    <div className="flex items-center space-x-2 pt-2">
                      {selectedNamespaces.length > 0 && !isClusterScoped && (
                        <button
                          onClick={() => onSelectNamespaces([])}
                          className="px-3 py-1.5 rounded-lg bg-brand-500/20 text-brand-300 border border-brand-500/40 hover:bg-brand-500/30 text-xs font-medium transition-colors"
                        >
                          Switch to All Namespaces
                        </button>
                      )}
                      {globalFilter && (
                        <button
                          onClick={() => setGlobalFilter('')}
                          className="px-3 py-1.5 rounded-lg bg-surface-elevated text-gray-300 border border-border hover:bg-surface text-xs font-medium transition-colors"
                        >
                          Clear Filter
                        </button>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Helm Install Release Modal */}
      {isHelm && (
        <HelmInstallModal
          isOpen={isInstallingHelm}
          onClose={() => setIsInstallingHelm(false)}
          namespaces={namespaces}
          activeNamespace={selectedNamespaces.length === 1 ? selectedNamespaces[0] : 'default'}
          isReadOnly={isReadOnly}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
};
