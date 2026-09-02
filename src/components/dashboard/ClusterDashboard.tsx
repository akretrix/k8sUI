import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/tauriClient';
import { ClusterContextSummary, ClusterOverviewData } from '../../types/cluster';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

interface ClusterDashboardProps {
  activeCluster: ClusterContextSummary | null;
}

export const ClusterDashboard: React.FC<ClusterDashboardProps> = ({ activeCluster }) => {
  const { data: overview, isLoading, isError, refetch } = useQuery<ClusterOverviewData>({
    queryKey: ['clusterOverview', activeCluster?.id],
    queryFn: () => api.getClusterOverview(),
    enabled: !!activeCluster,
    refetchInterval: 5000,
  });

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-100 flex items-center space-x-2">
              <span>Cluster Overview</span>
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Real-time resource allocations, workload health, and telemetry for{' '}
              <span className="font-semibold text-emerald-400">{activeCluster?.name || 'cluster'}</span>
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded-md bg-surface border border-border text-gray-400 hover:text-white hover:bg-surface-hover transition-colors text-xs flex items-center space-x-1.5"
              title="Refresh Telemetry"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <div className="px-3 py-1.5 rounded-md bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-semibold flex items-center space-x-2 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Control Plane Ready</span>
            </div>
          </div>
        </div>

        {isLoading && !overview ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-surface rounded-xl border border-border" />
            ))}
          </div>
        ) : isError || !overview ? (
          <div className="p-8 rounded-xl bg-surface border border-border text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
            <div className="text-sm font-semibold text-gray-200">Unable to load cluster overview metrics</div>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              Please ensure the cluster is connected and your credentials have permission to list nodes, pods, and events.
            </p>
          </div>
        ) : (
          <>
            {/* Top Row: CPU, Memory, Pods, Nodes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* CPU Card */}
              <ResourceRingCard
                title="CPU"
                ringValues={[
                  {
                    value: overview.cpu.limits,
                    max: Math.max(overview.cpu.capacity, overview.cpu.limits),
                    color: '#06b6d4', // Cyan (Limits)
                    radius: 44,
                  },
                  {
                    value: overview.cpu.requests,
                    max: Math.max(overview.cpu.capacity, overview.cpu.limits),
                    color: '#22c55e', // Green (Requests)
                    radius: 34,
                  },
                  {
                    value: overview.cpu.usage,
                    max: Math.max(overview.cpu.capacity, overview.cpu.limits),
                    color: '#ec4899', // Pink (Usage)
                    radius: 24,
                  },
                ]}
                legendItems={[
                  { label: 'Usage', value: `${overview.cpu.usage.toFixed(2)} cores`, color: 'bg-pink-500' },
                  { label: 'Requests', value: `${overview.cpu.requests.toFixed(2)} cores`, color: 'bg-green-500' },
                  { label: 'Limits', value: `${overview.cpu.limits.toFixed(2)} cores`, color: 'bg-cyan-500' },
                  { label: 'Allocatable', value: `${overview.cpu.allocatable.toFixed(2)} cores`, color: 'bg-blue-500' },
                  { label: 'Capacity', value: `${overview.cpu.capacity.toFixed(2)} cores`, color: 'bg-gray-500' },
                ]}
                warningText={
                  overview.cpu.limits_exceed_capacity
                    ? 'Specified limits are higher than node capacity.'
                    : undefined
                }
              />

              {/* Memory Card */}
              <ResourceRingCard
                title="Memory"
                ringValues={[
                  {
                    value: overview.memory.limits,
                    max: Math.max(overview.memory.capacity, overview.memory.limits),
                    color: '#06b6d4', // Cyan (Limits)
                    radius: 44,
                  },
                  {
                    value: overview.memory.requests,
                    max: Math.max(overview.memory.capacity, overview.memory.limits),
                    color: '#22c55e', // Green (Requests)
                    radius: 34,
                  },
                  {
                    value: overview.memory.usage,
                    max: Math.max(overview.memory.capacity, overview.memory.limits),
                    color: '#ec4899', // Pink (Usage)
                    radius: 24,
                  },
                ]}
                legendItems={[
                  { label: 'Usage', value: `${overview.memory.usage.toFixed(1)} GiB`, color: 'bg-pink-500' },
                  { label: 'Requests', value: `${overview.memory.requests.toFixed(1)} GiB`, color: 'bg-green-500' },
                  { label: 'Limits', value: `${overview.memory.limits.toFixed(1)} GiB`, color: 'bg-cyan-500' },
                  { label: 'Allocatable', value: `${overview.memory.allocatable.toFixed(1)} GiB`, color: 'bg-blue-500' },
                  { label: 'Capacity', value: `${overview.memory.capacity.toFixed(1)} GiB`, color: 'bg-gray-500' },
                ]}
                warningText={
                  overview.memory.limits_exceed_capacity
                    ? 'Specified limits are higher than node capacity.'
                    : undefined
                }
              />

              {/* Pods Card */}
              <ResourceRingCard
                title="Pods"
                ringValues={[
                  {
                    value: overview.pods.scheduled,
                    max: overview.pods.capacity || 100,
                    color: '#22c55e', // Green
                    radius: 40,
                  },
                ]}
                legendItems={[
                  { label: 'Running', value: `${overview.pods.running}`, color: 'bg-green-500' },
                  { label: 'Scheduled', value: `${overview.pods.scheduled}`, color: 'bg-emerald-600' },
                  { label: 'Capacity', value: `${overview.pods.capacity}`, color: 'bg-gray-500' },
                ]}
              />

              {/* Nodes Card */}
              <div className="bg-surface border border-border rounded-xl p-5 flex flex-col justify-between">
                <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider text-center">
                  Nodes
                </div>
                
                <div className="flex flex-col items-center justify-center my-auto py-4">
                  <div className="text-4xl font-bold text-gray-100 flex items-baseline">
                    <span>{overview.nodes.ready}</span>
                    <span className="text-lg text-gray-500 font-normal ml-1">/ {overview.nodes.total}</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs border-t border-border pt-4 text-gray-400">
                  <div className="flex justify-between">
                    <span>Ready:</span>
                    <span className="text-gray-200 font-mono font-medium">{overview.nodes.ready}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Workers:</span>
                    <span className="text-gray-200 font-mono font-medium">{overview.nodes.workers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Control plane:</span>
                    <span className="text-gray-200 font-mono font-medium">{overview.nodes.control_plane}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Second Row: Workload Health & Node Topology */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Workload Health */}
              <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                  Workload Health
                </h2>
                
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-gray-400">Deployments</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {overview.workload_health.deployments_ready}/{overview.workload_health.deployments_total} Ready
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-gray-400">StatefulSets</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {overview.workload_health.statefulsets_ready}/{overview.workload_health.statefulsets_total} Ready
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-gray-400">DaemonSets</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {overview.workload_health.daemonsets_ready}/{overview.workload_health.daemonsets_total} Ready
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-gray-400">CronJobs</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {overview.workload_health.cronjobs_active}/{overview.workload_health.cronjobs_total} Active
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-gray-400">Jobs (active/succ/fail)</span>
                    <span className="font-mono text-gray-300">
                      {overview.workload_health.jobs_active} run · {overview.workload_health.jobs_succeeded} ok · {overview.workload_health.jobs_failed} err
                    </span>
                  </div>
                </div>
              </div>

              {/* Node Topology & Infrastructure */}
              <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                  Node Topology & Infrastructure
                </h2>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5">
                      Zones
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {overview.topology.zones.length > 0 ? (
                        overview.topology.zones.map((z) => (
                          <span
                            key={z.name}
                            className="px-2 py-0.5 rounded bg-surface-elevated border border-border text-gray-200 font-mono text-[11px]"
                          >
                            {z.name}: <strong className="text-indigo-300">{z.count}</strong>
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500 italic">None reported</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5">
                      Capacity (Spot / On-Demand)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {overview.topology.capacity_types.length > 0 ? (
                        overview.topology.capacity_types.map((c) => (
                          <span
                            key={c.name}
                            className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 font-mono text-[11px]"
                          >
                            {c.name}: <strong>{c.count}</strong>
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500 italic">None reported</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5">
                      Architecture & Types
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {overview.topology.architectures.map((a) => (
                        <span
                          key={a.name}
                          className="px-2 py-0.5 rounded bg-surface-elevated border border-border text-gray-300 font-mono text-[11px]"
                        >
                          {a.name}: <strong className="text-blue-300">{a.count}</strong>
                        </span>
                      ))}
                      {overview.topology.instance_types.map((it) => (
                        <span
                          key={it.name}
                          className="px-2 py-0.5 rounded bg-surface-elevated border border-border text-gray-300 font-mono text-[11px]"
                        >
                          {it.name}: <strong className="text-amber-300">{it.count}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Third Row: Warnings Table */}
            <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Warnings: {overview.warnings.length}</span>
                </h2>
              </div>

              {overview.warnings.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500">
                  No active warning events detected in the cluster.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="text-[10px] text-gray-500 uppercase border-b border-border">
                      <tr>
                        <th className="pb-2 font-semibold">Message</th>
                        <th className="pb-2 font-semibold">Object</th>
                        <th className="pb-2 font-semibold">Kind</th>
                        <th className="pb-2 font-semibold text-right">Count</th>
                        <th className="pb-2 font-semibold text-right">Age</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 text-gray-300">
                      {overview.warnings.map((w, idx) => (
                        <tr key={idx} className="hover:bg-surface-hover transition-colors">
                          <td className="py-2.5 pr-4 text-gray-200 font-sans text-xs max-w-md truncate" title={w.message}>
                            {w.message}
                          </td>
                          <td className="py-2.5 pr-4 text-indigo-300 truncate max-w-[200px]" title={`${w.namespace}/${w.object_name}`}>
                            {w.object_name}
                          </td>
                          <td className="py-2.5 pr-4 text-gray-400">{w.kind}</td>
                          <td className="py-2.5 pr-4 text-right text-amber-400 font-bold">{w.count}</td>
                          <td className="py-2.5 text-right text-gray-500">{w.age}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Concentric Multi-Ring Card Component
interface RingValue {
  value: number;
  max: number;
  color: string;
  radius: number;
}

interface LegendItem {
  label: string;
  value: string;
  color: string;
}

interface ResourceRingCardProps {
  title: string;
  ringValues: RingValue[];
  legendItems: LegendItem[];
  warningText?: string;
}

const ResourceRingCard: React.FC<ResourceRingCardProps> = ({
  title,
  ringValues,
  legendItems,
  warningText,
}) => {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col justify-between">
      <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider text-center mb-3">
        {title}
      </div>

      {/* Rings SVG */}
      <div className="flex justify-center my-2">
        <svg viewBox="0 0 120 120" className="w-28 h-28 transform -rotate-90">
          {ringValues.map((ring, idx) => {
            const circumference = 2 * Math.PI * ring.radius;
            const pct = Math.min(1, Math.max(0, ring.max > 0 ? ring.value / ring.max : 0));
            const strokeDashoffset = circumference * (1 - pct);

            return (
              <g key={idx}>
                {/* Background Track */}
                <circle
                  cx="60"
                  cy="60"
                  r={ring.radius}
                  fill="transparent"
                  stroke="#1e293b"
                  strokeWidth="5"
                />
                {/* Active Arc */}
                <circle
                  cx="60"
                  cy="60"
                  r={ring.radius}
                  fill="transparent"
                  stroke={ring.color}
                  strokeWidth="5"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="space-y-1.5 text-xs font-mono mt-3">
        {legendItems.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center text-gray-300">
            <div className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${item.color}`} />
              <span className="text-gray-400 font-sans text-xs">{item.label}:</span>
            </div>
            <span className="font-semibold text-gray-200">{item.value}</span>
          </div>
        ))}
      </div>

      {/* Warning Box */}
      {warningText && (
        <div className="mt-3 p-2 rounded bg-amber-950/30 border border-amber-800/50 text-[11px] text-amber-300 leading-snug">
          {warningText}
        </div>
      )}
    </div>
  );
};

