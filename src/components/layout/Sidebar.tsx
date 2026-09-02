import React, { useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import {
  ChevronRight,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Server,
  Box,
  Settings,
  Network,
  Database,
  ShieldCheck,
  Ship,
  Puzzle,
  Activity,
  CheckCircle2,
  AlertCircle,
  X,
  Coffee,
} from 'lucide-react';

export interface CustomResourceType {
  group: string;
  kind: string;
  plural: string;
  scope: string;
  version: string;
  established: boolean;
}

interface SidebarProps {
  activeResource: string;
  onSelectResource: (resource: string, inNewTab?: boolean) => void;
  customResourceTypes?: CustomResourceType[];
}

type NavGroup = {
  name: string;
  icon: React.ElementType;
  items: { id: string; label: string }[];
};

const navGroups: NavGroup[] = [
  {
    name: 'Overview',
    icon: Activity,
    items: [
      { id: 'dashboard', label: 'Cluster Metrics' },
    ],
  },
  {
    name: 'Cluster',
    icon: Server,
    items: [
      { id: 'nodes', label: 'Nodes' },
      { id: 'events', label: 'Events' },
      { id: 'namespaces', label: 'Namespaces' },
      { id: 'mutatingwebhooks', label: 'Mutating Webhooks' },
      { id: 'validatingwebhooks', label: 'Validating Webhooks' },
    ],
  },
  {
    name: 'Workloads',
    icon: Box,
    items: [
      { id: 'pods', label: 'Pods' },
      { id: 'deployments', label: 'Deployments' },
      { id: 'daemonsets', label: 'DaemonSets' },
      { id: 'statefulsets', label: 'StatefulSets' },
      { id: 'replicasets', label: 'ReplicaSets' },
      { id: 'jobs', label: 'Jobs' },
      { id: 'cronjobs', label: 'CronJobs' },
    ],
  },
  {
    name: 'Config',
    icon: Settings,
    items: [
      { id: 'configmaps', label: 'ConfigMaps' },
      { id: 'secrets', label: 'Secrets' },
      { id: 'resourcequotas', label: 'Resource Quotas' },
      { id: 'limitranges', label: 'Limit Ranges' },
      { id: 'hpas', label: 'HPAs' },
      { id: 'pdbs', label: 'PDBs' },
      { id: 'priorityclasses', label: 'Priority Classes' },
    ],
  },
  {
    name: 'Network',
    icon: Network,
    items: [
      { id: 'services', label: 'Services' },
      { id: 'endpoints', label: 'Endpoints' },
      { id: 'ingresses', label: 'Ingresses' },
      { id: 'ingressclasses', label: 'Ingress Classes' },
      { id: 'networkpolicies', label: 'Network Policies' },
    ],
  },
  {
    name: 'Storage',
    icon: Database,
    items: [
      { id: 'pvcs', label: 'Persistent Volume Claims' },
      { id: 'pvs', label: 'Persistent Volumes' },
      { id: 'storageclasses', label: 'Storage Classes' },
    ],
  },
  {
    name: 'Access Control',
    icon: ShieldCheck,
    items: [
      { id: 'serviceaccounts', label: 'Service Accounts' },
      { id: 'clusterroles', label: 'Cluster Roles' },
      { id: 'clusterrolebindings', label: 'Cluster Role Bindings' },
      { id: 'roles', label: 'Roles' },
      { id: 'rolebindings', label: 'Role Bindings' },
    ],
  },
  {
    name: 'Custom Resources',
    icon: Puzzle,
    items: [
      { id: 'crds', label: 'Definitions' },
    ],
  },
  {
    name: 'Helm',
    icon: Ship,
    items: [
      { id: 'helm-releases', label: 'Releases' },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeResource,
  onSelectResource,
  customResourceTypes = [],
}) => {
  // Sidebar full collapse to mini icon rail
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);

  // Quick filter term inside the sidebar
  const [sidebarFilter, setSidebarFilter] = useState('');

  // Individual category group expand/collapse state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      initial[g.name] = true;
    });
    return initial;
  });

  // Individual CRD API groups expand/collapse state
  const [expandedApiGroups, setExpandedApiGroups] = useState<Record<string, boolean>>({});

  const crdGroups = useMemo(() => {
    const byGroup = new Map<string, CustomResourceType[]>();
    for (const t of customResourceTypes) {
      if (!t) continue;
      const key = t.group || '(core)';
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(t);
    }
    return Array.from(byGroup.entries())
      .map(([group, types]) => ({
        group,
        types: types.sort((a, b) => (a.kind || '').localeCompare(b.kind || '')),
      }))
      .sort((a, b) => a.group.localeCompare(b.group));
  }, [customResourceTypes]);

  // Check if all groups are currently expanded
  const areAllExpanded = useMemo(() => {
    return navGroups.every((g) => expandedGroups[g.name]);
  }, [expandedGroups]);

  // Expand / Collapse all groups at once
  const toggleAllGroups = () => {
    const nextState = !areAllExpanded;
    const updated: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      updated[g.name] = nextState;
    });
    setExpandedGroups(updated);

    const updatedApi: Record<string, boolean> = {};
    crdGroups.forEach((cg) => {
      updatedApi[cg.group] = nextState;
    });
    setExpandedApiGroups(updatedApi);
  };

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const toggleApiGroup = (name: string) => {
    setExpandedApiGroups((prev) => ({
      ...prev,
      [name]: prev[name] === undefined ? false : !prev[name],
    }));
  };

  // Filtered CRD groups based on sidebar search input
  const filteredCrdGroups = useMemo(() => {
    if (!sidebarFilter.trim()) return crdGroups;
    const term = sidebarFilter.toLowerCase();
    return crdGroups
      .map((cg) => {
        const matchesGroup = cg.group.toLowerCase().includes(term);
        const matchingTypes = cg.types.filter(
          (t) =>
            t.kind.toLowerCase().includes(term) ||
            t.plural.toLowerCase().includes(term) ||
            t.group.toLowerCase().includes(term)
        );
        if (matchesGroup) return cg;
        if (matchingTypes.length > 0) return { ...cg, types: matchingTypes };
        return null;
      })
      .filter((cg): cg is { group: string; types: CustomResourceType[] } => cg !== null);
  }, [crdGroups, sidebarFilter]);

  // Filtered nav groups based on sidebar search input
  const filteredNavGroups = useMemo(() => {
    if (!sidebarFilter.trim()) return navGroups;
    const term = sidebarFilter.toLowerCase();
    return navGroups
      .map((g) => {
        const matchesGroup = g.name.toLowerCase().includes(term);
        const matchingItems = g.items.filter(
          (i) => i.label.toLowerCase().includes(term) || i.id.toLowerCase().includes(term)
        );
        const hasMatchingCrds = g.name === 'Custom Resources' && filteredCrdGroups.length > 0;

        if (matchesGroup || hasMatchingCrds) return g;
        if (matchingItems.length > 0) return { ...g, items: matchingItems };
        return null;
      })
      .filter((g): g is NavGroup => g !== null);
  }, [sidebarFilter, filteredCrdGroups]);

  // Mini rail mode (collapsed width)
  if (isRailCollapsed) {
    return (
      <aside className="w-14 border-r border-border bg-surface-elevated/95 flex flex-col items-center py-3 select-none shrink-0 transition-all z-20">
        <button
          onClick={() => setIsRailCollapsed(false)}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-surface mb-4 transition-colors"
          title="Expand Sidebar (Full Navigation)"
        >
          <PanelLeftOpen className="w-5 h-5 text-brand-400" />
        </button>

        <div className="w-full flex-1 overflow-y-auto space-y-3 px-2 flex flex-col items-center">
          {navGroups.map((group) => {
            const Icon = group.icon;
            const hasActive = group.items.some((i) => i.id === activeResource);
            return (
              <button
                key={group.name}
                onClick={() => {
                  setIsRailCollapsed(false);
                  toggleGroup(group.name);
                }}
                className={`p-2.5 rounded-xl transition-all group relative ${
                  hasActive
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-surface'
                }`}
                title={`${group.name} (${group.items.length} items)`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
        
        {/* Collapsed Sponsor Footer */}
        <div className="mt-auto pt-4 pb-2 w-full flex justify-center">
          <button
            onClick={() => open('https://ko-fi.com/akretrix')}
            className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-all border border-amber-500/20 group cursor-pointer"
            title="Support AkreTrix on Ko-fi"
          >
            <Coffee className="w-5 h-5 fill-amber-500/20 group-hover:fill-amber-500/50" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 border-r border-border bg-surface-elevated overflow-y-auto flex-shrink-0 select-none flex flex-col transition-all">
      {/* Top Sidebar Toolbar with Collapse All / Expand All & Filter */}
      <div className="p-3 border-b border-border/80 bg-surface/50 space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 font-mono">
            Navigation
          </span>
          <div className="flex items-center space-x-1">
            {/* General Expand / Collapse All */}
            <button
              onClick={toggleAllGroups}
              className="px-2 py-1 rounded bg-surface border border-border text-[10px] font-medium text-gray-300 hover:text-white hover:border-brand-500/40 flex items-center space-x-1 transition-all"
              title={areAllExpanded ? 'Collapse All Categories' : 'Expand All Categories'}
            >
              {areAllExpanded ? (
                <>
                  <ChevronsDownUp className="w-3 h-3 text-brand-400" />
                  <span>Collapse All</span>
                </>
              ) : (
                <>
                  <ChevronsUpDown className="w-3 h-3 text-brand-400" />
                  <span>Expand All</span>
                </>
              )}
            </button>

            {/* Sidebar Rail Toggle */}
            <button
              onClick={() => setIsRailCollapsed(true)}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-surface transition-colors"
              title="Collapse Sidebar to Mini Rail"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Search inside Sidebar */}
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2.5 top-2 text-gray-500" />
          <input
            type="text"
            placeholder="Quick search menu..."
            value={sidebarFilter}
            onChange={(e) => setSidebarFilter(e.target.value)}
            className="w-full bg-surface border border-border rounded-md pl-7 pr-6 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
          />
          {sidebarFilter && (
            <button
              onClick={() => setSidebarFilter('')}
              className="absolute right-2 top-1.5 text-gray-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Nav Categories List */}
      <div className="py-2 flex-1 overflow-y-auto">
        {filteredNavGroups.map((group) => {
          const isExpanded = sidebarFilter ? true : !!expandedGroups[group.name];
          const Icon = group.icon;
          const isCustomResources = group.name === 'Custom Resources';
          const totalCount = isCustomResources && customResourceTypes.length > 0
            ? customResourceTypes.length
            : group.items.length;

          return (
            <div key={group.name} className="mb-1">
              {/* Category Accordion Header */}
              <button
                onClick={() => toggleGroup(group.name)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-100 hover:bg-surface/40 transition-colors rounded-lg mx-auto"
              >
                <div className="flex items-center space-x-2">
                  <Icon className="w-3.5 h-3.5 text-brand-400" />
                  <span className="uppercase tracking-wider text-[11px] font-sans">
                    {group.name}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 bg-surface px-1.5 py-0.2 rounded-full border border-border/40">
                    {totalCount}
                  </span>
                </div>
                <div className="flex items-center text-gray-500">
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>

              {/* Items List */}
              {isExpanded && (
                <div className="mt-0.5 space-y-0.5 px-2">
                  {group.items.map((item) => {
                    const isActive = activeResource === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey) {
                            onSelectResource(item.id, true);
                          } else {
                            onSelectResource(item.id);
                          }
                        }}
                        onAuxClick={(e) => {
                          if (e.button === 1) {
                            e.preventDefault();
                            onSelectResource(item.id, true);
                          }
                        }}
                        className={`w-full text-left pl-7 pr-3 py-1.5 rounded-md text-xs transition-all flex items-center justify-between ${
                          isActive
                            ? 'bg-brand-500/20 text-brand-300 font-semibold border-l-2 border-brand-500'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-surface/50'
                        }`}
                        title={`${item.label} (Cmd+Click to open in new tab)`}
                      >
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}

                  {/* CRD Dynamic Groups */}
                  {isCustomResources &&
                    filteredCrdGroups.map(({ group: apiGroup, types }) => {
                      const groupIsExpanded =
                        sidebarFilter
                          ? true
                          : (expandedApiGroups[apiGroup] ?? true);
                      return (
                        <div key={apiGroup} className="mt-1">
                          <button
                            onClick={() => toggleApiGroup(apiGroup)}
                            className="w-full flex items-center justify-between pl-7 pr-3 py-1 rounded-md text-[11px] font-mono text-gray-300 hover:text-white hover:bg-surface/60 transition-colors"
                            title={apiGroup}
                          >
                            <span className="truncate font-medium">{apiGroup}</span>
                            <span className="flex items-center space-x-1 shrink-0">
                              <span className="text-[9px] text-gray-400 bg-surface px-1.5 py-0.5 rounded border border-border/50 font-mono">
                                {types.length}
                              </span>
                              {groupIsExpanded ? (
                                <ChevronDown className="w-3 h-3 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-gray-400" />
                              )}
                            </span>
                          </button>
                          {groupIsExpanded && (
                            <div className="space-y-0.5 mt-0.5">
                              {types.map((t) => {
                                const isActive = activeResource === t.plural;
                                return (
                                  <button
                                    key={t.plural}
                                    onClick={(e) => {
                                      if (e.metaKey || e.ctrlKey) {
                                        onSelectResource(t.plural, true);
                                      } else {
                                        onSelectResource(t.plural);
                                      }
                                    }}
                                    onAuxClick={(e) => {
                                      if (e.button === 1) {
                                        e.preventDefault();
                                        onSelectResource(t.plural, true);
                                      }
                                    }}
                                    className={`w-full flex items-center justify-between text-left pl-10 pr-3 py-1 rounded-md text-xs transition-colors ${
                                      isActive
                                        ? 'bg-brand-500/20 text-brand-300 font-medium'
                                        : 'text-gray-400 hover:text-gray-200 hover:bg-surface/50'
                                    }`}
                                    title={
                                      t.established
                                        ? `${t.kind} — Established (Cmd+Click to open in new tab)`
                                        : `${t.kind} — not Established`
                                    }
                                  >
                                    <span className="truncate">{t.kind}</span>
                                    {t.established ? (
                                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                    ) : (
                                      <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded Sponsor Footer */}
      <div className="p-4 border-t border-border bg-surface-elevated flex items-center justify-center shrink-0">
        <button 
          onClick={() => open('https://ko-fi.com/akretrix')}
          className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:text-amber-400 rounded-md border border-amber-500/20 transition-all font-medium text-sm group cursor-pointer"
        >
          <Coffee className="w-4 h-4 fill-amber-500/20 group-hover:fill-amber-500/50 transition-colors" />
          <span>Support AkreTrix</span>
        </button>
      </div>
    </aside>
  );
};
