import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, isTauri } from './api/tauriClient';
import { Header } from './components/layout/Header';
import { PodTable } from './components/pods/PodTable';
import { CommandPalette } from './components/command-palette/CommandPalette';
import { TerminalView } from './components/terminal/TerminalView';
import { PortForwardModal } from './components/portforward/PortForwardModal';
import { AiCopilotDrawer } from './components/ai/AiCopilotDrawer';
import { AuditLogModal } from './components/audit/AuditLogModal';
import { AddAwsOrgModal } from './components/cluster/AddAwsOrgModal';
import { Sidebar, CustomResourceType } from './components/layout/Sidebar';
import { GenericResourceTable } from './components/common/GenericResourceTable';
import { DescribeModal } from './components/common/DescribeModal';
import { YamlEditorModal, EditableResourceRef } from './components/common/YamlEditorModal';
import { LogsView } from './components/common/LogsView';
import { ClusterDashboard } from './components/dashboard/ClusterDashboard';
import { PortForwardFloatingBanner } from './components/portforward/PortForwardFloatingBanner';
import { PendingAiProposal, PodSummary, ClusterContextSummary, ActivePortForward } from './types/cluster';
import { AppTab, RESOURCE_TITLES } from './types/tabs';
import { TabBar } from './components/layout/TabBar';
import { NewTabModal } from './components/layout/NewTabModal';
import { ConfirmationModal } from './components/common/ConfirmationModal';
import { ScaleModal, ScaleTarget } from './components/common/ScaleModal';
import { DesignSystemShowcase } from './components/design-system/DesignSystemShowcase';
import { AwsSsoModal } from './components/cluster/AwsSsoModal';
import { BottomPanel, PanelTab } from './components/layout/BottomPanel';
import { ZoomHud } from './components/common/ZoomHud';
import { useZoom } from './hooks/useZoom';
import { checkForAppUpdates, UpdateInfo } from './utils/updateChecker';
import { UpdateModal } from './components/common/UpdateModal';
import { AlertTriangle, RefreshCw, WifiOff, KeyRound, ShieldCheck, Copy, Check } from 'lucide-react';
export const App: React.FC = () => {
  const queryClient = useQueryClient();
  const { zoomLevel, showIndicator: showZoomIndicator, resetZoom } = useZoom();

  // Tabs State
  const [tabs, setTabs] = useState<AppTab[]>([
    {
      id: 'tab-pods',
      resource: 'pods',
      title: 'Pods',
      namespaces: [],
      filterQuery: '',
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-pods');

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0] || {
    id: 'tab-pods',
    resource: 'pods',
    title: 'Pods',
    namespaces: [],
    filterQuery: '',
  };

  const activeResource = activeTab.resource;
  const selectedNamespaces = activeTab.namespaces;
  const filterQuery = activeTab.filterQuery;

  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isAddAwsOrgOpen, setIsAddAwsOrgOpen] = useState(false);
  const [isDesignSystemOpen, setIsDesignSystemOpen] = useState(false);
  const [isNewTabModalOpen, setIsNewTabModalOpen] = useState(false);

  // In-app Update Checker State
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

  const handleCheckForUpdates = async (force = false) => {
    setIsCheckingUpdates(true);
    try {
      const info = await checkForAppUpdates(force);
      if (info) {
        setUpdateInfo(info);
      }
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  // Run a cached update check once when the app launches
  useEffect(() => {
    handleCheckForUpdates(false);
  }, []);

  // Listen for native macOS app menu "Check for Updates..." trigger
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    if (isTauri) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen('trigger-check-updates', () => {
          setIsUpdateModalOpen(true);
          handleCheckForUpdates(true);
        }).then((fn) => {
          unlisten = fn;
        });
      });
    }
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Bottom Panel State
  const [panelTabs, setPanelTabs] = useState<PanelTab[]>([]);
  const [activePanelTabId, setActivePanelTabId] = useState<string>('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const handleClosePanelTab = (tabId: string) => {
    setPanelTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (newTabs.length === 0) {
        setIsPanelOpen(false);
      } else if (activePanelTabId === tabId) {
        setActivePanelTabId(newTabs[0].id);
      }
      return newTabs;
    });
  };

  // Selected modals target state
  const [selectedPodForPortForward, setSelectedPodForPortForward] = useState<PodSummary | null>(null);
  const [selectedResourceForDescribe, setSelectedResourceForDescribe] = useState<any | null>(null);
  const [selectedResourceForYaml, setSelectedResourceForYaml] = useState<EditableResourceRef | null>(null);

  const handleOpenLogsTab = (res: { kind?: string; name: string; namespace?: string }) => {
    const namespace = res.namespace || 'default';
    const tabId = `logs-${namespace}-${res.name}`;
    const existingTab = panelTabs.find(t => t.id === tabId);
    if (!existingTab) {
      setPanelTabs(prev => [...prev, {
        id: tabId,
        title: `Logs: ${res.name}`,
        content: (
          <LogsView
            isActive={true}
            onClose={() => handleClosePanelTab(tabId)}
            resource={{ kind: res.kind || 'Pod', name: res.name, namespace }}
          />
        ),
        onClose: () => handleClosePanelTab(tabId)
      }]);
    }
    setActivePanelTabId(tabId);
    setIsPanelOpen(true);
  };

  const handleOpenExecTab = (pod: PodSummary | { name: string; namespace?: string }) => {
    const namespace = pod.namespace || 'default';
    const tabId = `term-${namespace}-${pod.name}`;
    const existingTab = panelTabs.find(t => t.id === tabId);
    if (!existingTab) {
      const podObj: PodSummary = 'status' in pod ? (pod as PodSummary) : {
        name: pod.name,
        namespace,
        ready_containers: '1/1',
        status: 'Running',
        restarts: 0,
        age: '0s',
      };
      setPanelTabs(prev => [...prev, {
        id: tabId,
        title: `Exec: ${pod.name}`,
        content: (
          <TerminalView
            isActive={true}
            onClose={() => handleClosePanelTab(tabId)}
            pod={podObj}
          />
        ),
        onClose: () => handleClosePanelTab(tabId)
      }]);
    }
    setActivePanelTabId(tabId);
    setIsPanelOpen(true);
  };
  const [selectedScaleTarget, setSelectedScaleTarget] = useState<ScaleTarget | null>(null);
  const [confirmationTarget, setConfirmationTarget] = useState<{
    actionType: 'delete' | 'restart';
    resourceKind: string;
    resourceName: string;
    namespace?: string;
  } | null>(null);

  // Tab Handlers
  const handleSelectResource = (resourceId: string, inNewTab?: boolean) => {
    if (inNewTab) {
      const newTab: AppTab = {
        id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        clusterId: activeCluster?.id,
        clusterName: activeCluster?.name,
        environment: activeCluster?.environment,
        resource: resourceId,
        title: RESOURCE_TITLES[resourceId] || resourceId,
        namespaces: selectedNamespaces,
        filterQuery: '',
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      return;
    }

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              resource: resourceId,
              title: RESOURCE_TITLES[resourceId] || resourceId,
              filterQuery: '',
            }
          : t
      )
    );
  };

  const handleSelectTab = (tabId: string) => {
    setActiveTabId(tabId);
    const target = tabs.find((t) => t.id === tabId);
    if (target && target.clusterId && target.clusterId !== activeCluster?.id) {
      connectMutation.mutate(target.clusterId);
    }
  };

  const handleSelectCluster = (clusterId: string) => {
    const cluster = clusters.find((c) => c.id === clusterId);
    connectMutation.mutate(clusterId);
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              clusterId,
              clusterName: cluster?.name,
              environment: cluster?.environment,
            }
          : t
      )
    );
  };

  const handleOpenClusterInNewTab = (cluster: ClusterContextSummary) => {
    const newTab: AppTab = {
      id: `tab-${cluster.id}-${Date.now()}`,
      clusterId: cluster.id,
      clusterName: cluster.name,
      environment: cluster.environment,
      resource: 'pods',
      title: 'Pods',
      namespaces: [],
      filterQuery: '',
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    if (cluster.id !== activeCluster?.id) {
      connectMutation.mutate(cluster.id);
    }
  };

  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (tabs.length <= 1) {
      const defaultTab: AppTab = {
        id: 'tab-pods',
        clusterId: activeCluster?.id,
        clusterName: activeCluster?.name,
        environment: activeCluster?.environment,
        resource: 'pods',
        title: 'Pods',
        namespaces: [],
        filterQuery: '',
      };
      setTabs([defaultTab]);
      setActiveTabId('tab-pods');
      return;
    }

    const index = tabs.findIndex((t) => t.id === tabId);
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
      const nextTab = newTabs[Math.max(0, index - 1)];
      if (nextTab) {
        handleSelectTab(nextTab.id);
      }
    }
  };

  const handleCloseAllTabs = () => {
    const defaultTab: AppTab = {
      id: 'tab-pods',
      clusterId: activeCluster?.id,
      clusterName: activeCluster?.name,
      environment: activeCluster?.environment,
      resource: 'pods',
      title: 'Pods',
      namespaces: [],
      filterQuery: '',
    };
    setTabs([defaultTab]);
    setActiveTabId('tab-pods');
  };

  const handleCloseOtherTabs = (tabId: string) => {
    const target = tabs.find((t) => t.id === tabId);
    if (target) {
      setTabs([target]);
      handleSelectTab(target.id);
    }
  };

  const handleNewTab = () => {
    setIsNewTabModalOpen(true);
  };

  const handleAddTabFromModal = (newTab: AppTab) => {
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    if (newTab.clusterId && newTab.clusterId !== activeCluster?.id) {
      connectMutation.mutate(newTab.clusterId);
    }
  };

  const handleDuplicateTab = (tabId: string) => {
    const target = tabs.find((t) => t.id === tabId);
    if (target) {
      const duplicated: AppTab = {
        ...target,
        id: `tab-copy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: `${target.title} (Copy)`,
      };
      setTabs((prev) => [...prev, duplicated]);
      setActiveTabId(duplicated.id);
    }
  };

  const handleSetNamespaces = (namespaces: string[]) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTab.id ? { ...t, namespaces } : t))
    );
  };

  const handleSetFilterQuery = (query: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTab.id ? { ...t, filterQuery: query } : t))
    );
  };

  // Queries
  const { data: clusters = [] } = useQuery({
    queryKey: ['clusters'],
    queryFn: api.getClusters,
  });

  const { data: activeCluster = null } = useQuery({
    queryKey: ['activeCluster'],
    queryFn: api.getActiveCluster,
  });

  // Synchronize initial tab cluster information when activeCluster is first detected
  useEffect(() => {
    if (activeCluster && tabs.length > 0) {
      setTabs((prev) =>
        prev.map((t) => {
          if (!t.clusterId) {
            return {
              ...t,
              clusterId: activeCluster.id,
              clusterName: activeCluster.name,
              environment: activeCluster.environment,
            };
          }
          return t;
        })
      );
    }
  }, [activeCluster?.id]);

  const {
    data: healthInfo = null,
    isFetching: isHealthChecking,
  } = useQuery({
    queryKey: ['clusterHealth', activeCluster?.id],
    queryFn: () => api.checkClusterHealth(),
    enabled: !!activeCluster,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return (status === 'auth_expired' || status === 'unreachable') ? 4_000 : 20_000;
    },
    refetchOnWindowFocus: true,
  });

  const reconnectMutation = useMutation({
    mutationFn: (clusterId?: string) => api.reconnectCluster(clusterId || activeCluster?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusterHealth'] });
      queryClient.invalidateQueries({ queryKey: ['activeCluster'] });
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      queryClient.invalidateQueries({ queryKey: ['namespaces'] });
      queryClient.invalidateQueries({ queryKey: ['pods'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['customResourceTypes'] });
    },
  });

  const handleReconnect = async () => {
    try {
      await reconnectMutation.mutateAsync(activeCluster?.id);
    } catch (e) {
      console.error('Reconnect failed:', e);
    }
  };

  // Global Keyboard Shortcuts (Cmd+T, Cmd+W, Cmd+1..9)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea';

      // Cmd+T or Ctrl+T -> Open New Tab Modal
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't' && !e.shiftKey) {
        e.preventDefault();
        setIsNewTabModalOpen(true);
        return;
      }

      // Cmd+W or Ctrl+W -> Close active tab (if > 1 tab)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (tabs.length > 1) {
          handleCloseTab(activeTabId);
        }
        return;
      }

      // Cmd+1..9 -> Switch to tab by index
      if ((e.metaKey || e.ctrlKey) && !isInput && e.key >= '1' && e.key <= '9') {
        const tabIndex = parseInt(e.key, 10) - 1;
        if (tabs[tabIndex]) {
          e.preventDefault();
          handleSelectTab(tabs[tabIndex].id);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId]);

  const { data: isReadOnly = true } = useQuery({
    queryKey: ['isReadOnly'],
    queryFn: api.getReadOnlyStatus,
  });

  const autoConnectedClusterRef = useRef<string | null>(null);

  const {
    data: pods = [],
    isLoading: isPodsLoading,
    isError: isPodsError,
    error: podsError,
    refetch: refetchPods,
  } = useQuery({
    queryKey: ['pods', activeCluster?.id, selectedNamespaces],
    // A single selected namespace is scoped server-side (cheaper); zero or
    // several are fetched cluster-wide and filtered client-side in PodTable —
    // Kubernetes' list API has no "these N namespaces" query of its own.
    queryFn: () => api.listPods(selectedNamespaces.length === 1 ? selectedNamespaces[0] : undefined),
    enabled: !!activeCluster && activeResource === 'pods',
    refetchInterval: activeResource === 'pods' ? 5000 : false,
  });

  const { data: auditLogs = [], refetch: refetchAuditLogs } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: api.getAuditLogs,
    staleTime: 10_000,
  });

  const { data: awsOrgs = [] } = useQuery({
    queryKey: ['awsOrgs'],
    queryFn: api.listAwsSsoOrgs,
    staleTime: 60_000,
  });

  const { data: namespaces = ['default'] } = useQuery({
    queryKey: ['namespaces', activeCluster?.id],
    queryFn: api.getNamespaces,
    enabled: !!activeCluster,
    staleTime: 30_000,
  });

  const { data: customResourceTypes = [] } = useQuery<CustomResourceType[]>({
    queryKey: ['customResourceTypes', activeCluster?.id],
    queryFn: api.listCustomResourceTypes,
    enabled: !!activeCluster,
    staleTime: 60_000,
  });

  const { data: activePortForwards = [], refetch: refetchPortForwards } = useQuery({
    queryKey: ['port-forwards'],
    queryFn: api.listPortForwards,
    refetchInterval: 3000,
  });

  const handleStopPortForward = async (sessionId: string) => {
    try {
      await api.stopPortForward(sessionId);
      queryClient.setQueryData(['port-forwards'], (old: ActivePortForward[] = []) =>
        old.filter((t) => t.session_id !== sessionId)
      );
      refetchPortForwards();
    } catch (e) {
      console.error('Failed to stop port forward:', e);
    }
  };

  // Mutations
  const connectMutation = useMutation({
    mutationFn: (clusterId: string) => api.connectCluster(clusterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeCluster'] });
      queryClient.invalidateQueries({ queryKey: ['isReadOnly'] });
      queryClient.invalidateQueries({ queryKey: ['namespaces'] });
      queryClient.invalidateQueries({ queryKey: ['pods'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['customResourceTypes'] });
    },
  });

  // Auto-connect to active cluster on startup safely once without infinite loops
  useEffect(() => {
    if (!activeCluster && clusters.length > 0) {
      const defaultCluster = clusters.find((c) => c.is_active) || clusters[0];
      if (defaultCluster && autoConnectedClusterRef.current !== defaultCluster.id) {
        autoConnectedClusterRef.current = defaultCluster.id;
        connectMutation.mutate(defaultCluster.id);
      }
    }
  }, [clusters, activeCluster]);

  const writeModeMutation = useMutation({
    mutationFn: (unlocked: boolean) => api.setWriteMode(unlocked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['isReadOnly'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });

  const registerOrgMutation = useMutation({
    mutationFn: ({ alias, startUrl, ssoRegion }: { alias: string; startUrl: string; ssoRegion: string }) =>
      api.registerAwsSsoOrg(alias, startUrl, ssoRegion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['awsOrgs'] });
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });

  const refreshOrgMutation = useMutation({
    mutationFn: (orgId: string) => api.discoverAwsSsoClusters(orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      queryClient.invalidateQueries({ queryKey: ['awsOrgs'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });

  const scaleMutation = useMutation({
    mutationFn: ({ kind, name, namespace, replicas }: { kind: string; name: string; namespace: string; replicas: number }) =>
      api.scaleResource(kind, name, namespace, replicas),
    onSuccess: () => {
      setSelectedScaleTarget(null);
      queryClient.invalidateQueries({ queryKey: ['pods'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });

  const restartMutation = useMutation({
    mutationFn: ({ kind, name, namespace }: { kind: string; name: string; namespace: string }) =>
      api.restartResource(kind, name, namespace),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['pods'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      setConfirmationTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ kind, name, namespace }: { kind: string; name: string; namespace?: string }) =>
      api.deleteResource(kind, name, namespace),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['pods'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      setConfirmationTarget(null);
    },
  });

  const handleExecuteConfirmation = async () => {
    if (!confirmationTarget) return;
    if (confirmationTarget.actionType === 'restart') {
      await restartMutation.mutateAsync({
        kind: confirmationTarget.resourceKind,
        name: confirmationTarget.resourceName,
        namespace: confirmationTarget.namespace || 'default',
      });
    } else {
      await deleteMutation.mutateAsync({
        kind: confirmationTarget.resourceKind,
        name: confirmationTarget.resourceName,
        namespace: confirmationTarget.namespace,
      });
    }
  };

  // Action handlers
  const handleScalePod = (pod: PodSummary) => {
    let workloadName = pod.name;
    const parts = pod.name.split('-');
    if (parts.length >= 3) {
      workloadName = parts.slice(0, -2).join('-');
    }
    setSelectedScaleTarget({
      kind: 'Deployment',
      name: workloadName,
      namespace: pod.namespace,
    });
  };

  const handleApproveAiProposal = (proposal: PendingAiProposal) => {
    if (proposal.tool_call.tool === 'scale_deployment') {
      const p = proposal.tool_call.params;
      scaleMutation.mutate({
        kind: 'Deployment',
        name: p.name,
        namespace: p.namespace,
        replicas: p.replicas,
      });
    }
  };

  const handleRejectAiProposal = (_proposal: PendingAiProposal) => {
    refetchAuditLogs();
  };

  const connectErrorMessage = (connectMutation.error as Error)?.message || 'Failed to connect to cluster';
  const isSsoExpired =
    connectErrorMessage.toLowerCase().includes('token has expired') ||
    connectErrorMessage.toLowerCase().includes('token from sso') ||
    connectErrorMessage.toLowerCase().includes('unrecognizedclientexception') ||
    connectErrorMessage.toLowerCase().includes('auth exec command') ||
    connectErrorMessage.toLowerCase().includes('exit status: 255');

  const [isAwsSsoModalOpen, setIsAwsSsoModalOpen] = useState(false);
  const [copiedSsoCmd, setCopiedSsoCmd] = useState(false);

  const handleAwsSsoBrowserLogin = () => {
    setIsAwsSsoModalOpen(true);
  };

  const profileMatch = connectErrorMessage.match(/AWS_PROFILE=["']?([^"'\s]+)["']?/i);
  const detectedProfile = profileMatch ? profileMatch[1] : undefined;

  const handleCopySsoCommand = async () => {
    const targetProfile = healthInfo?.detected_profile || detectedProfile;
    try {
      const cmd = await api.getSsoLoginCommand(targetProfile);
      await navigator.clipboard.writeText(cmd);
      setCopiedSsoCmd(true);
      setTimeout(() => setCopiedSsoCmd(false), 2500);
    } catch {
      await navigator.clipboard.writeText(`aws sso login --profile ${targetProfile || 'default'}`);
      setCopiedSsoCmd(true);
      setTimeout(() => setCopiedSsoCmd(false), 2500);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-gray-100 font-sans overflow-hidden">
      {/* Read-Only Banner in Browser Mode */}
      {!isTauri && (
        <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center justify-between text-xs text-amber-200">
          <span>
            <b>Browser Mock Mode:</b> Running without desktop Tauri backend.
            Run <code className="font-mono bg-amber-500/20 px-1 py-0.5 rounded">pnpm run tauri dev</code> to use your kubeconfig.
          </span>
        </div>
      )}

      {/* Cluster Health / Auth Expired / Unreachable Notification Banner */}
      {healthInfo && (healthInfo.status === 'auth_expired' || healthInfo.status === 'unreachable') && !connectMutation.isError && (
        <div
          className={`shrink-0 border-b px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs z-50 animate-in fade-in duration-150 ${
            healthInfo.status === 'auth_expired'
              ? 'bg-amber-950/95 border-amber-600/60 text-amber-200'
              : 'bg-rose-950/95 border-rose-600/60 text-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            {healthInfo.status === 'auth_expired' ? (
              <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <div className="truncate">
              <b>{healthInfo.status === 'auth_expired' ? 'Authentication Expired:' : 'Cluster Unreachable:'}</b>{' '}
              <span className="font-mono text-xs opacity-90">
                {healthInfo.status === 'auth_expired'
                  ? `AWS SSO token or credentials for '${activeCluster?.name}' have expired.`
                  : `Cannot reach cluster API for '${activeCluster?.name}'. Check if your VPN connection is active.`}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            {healthInfo.status === 'auth_expired' && (
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setIsAwsSsoModalOpen(true)}
                  className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-black font-semibold rounded text-xs shadow flex items-center space-x-1.5 transition-colors"
                  title="Authenticate AWS SSO session via direct browser approval"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-black" />
                  <span>Login via AWS SSO</span>
                </button>
                <button
                  onClick={handleCopySsoCommand}
                  className="px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900 border border-amber-700/80 text-amber-200 hover:text-white rounded text-xs font-mono font-medium transition-colors flex items-center space-x-1"
                  title="Copy the exact AWS SSO login CLI command to clipboard"
                >
                  {copiedSsoCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-300" />}
                  <span>{copiedSsoCmd ? 'Copied!' : 'Copy Command'}</span>
                </button>
              </div>
            )}
            <button
              onClick={handleReconnect}
              disabled={reconnectMutation.isPending}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded text-xs shadow flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              title="Test connection and reload cluster context"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reconnectMutation.isPending ? 'animate-spin' : ''}`} />
              <span>Reconnect</span>
            </button>
          </div>
        </div>
      )}

      {connectMutation.isError && (
        <div className="shrink-0 bg-red-950/95 border-b border-red-600 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-red-200 z-50 animate-in fade-in duration-150">
          <div className="flex items-center space-x-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <div className="truncate">
              <b>Cluster Connection Error:</b>{' '}
              <span className="font-mono text-xs text-red-200/90">{connectErrorMessage}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            {isSsoExpired && (
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setIsAwsSsoModalOpen(true)}
                  className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-black font-semibold rounded text-xs shadow flex items-center space-x-1.5 transition-colors"
                  title="Authenticate AWS SSO session via direct browser approval"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-black" />
                  <span>Login via AWS SSO</span>
                </button>
                <button
                  onClick={handleCopySsoCommand}
                  className="px-2.5 py-1 bg-red-900/60 hover:bg-red-800 border border-red-700/80 text-red-200 hover:text-white rounded text-xs font-mono font-medium transition-colors flex items-center space-x-1"
                  title="Copy the exact AWS SSO login CLI command to clipboard"
                >
                  {copiedSsoCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-red-300" />}
                  <span>{copiedSsoCmd ? 'Copied!' : 'Copy Command'}</span>
                </button>
              </div>
            )}
            <button
              onClick={() => connectMutation.reset()}
              className="text-red-300 hover:text-white px-2.5 py-1 bg-red-900/60 hover:bg-red-800 rounded text-xs font-semibold transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Persistent Top Navigation Bar */}
      <Header
        clusters={clusters}
        activeCluster={activeCluster}
        healthInfo={healthInfo}
        isHealthChecking={isHealthChecking}
        isReadOnly={isReadOnly}
        isAdvancedMode={isAdvancedMode}
        isAiDrawerOpen={isAiDrawerOpen}
        activePortForwards={activePortForwards}
        onStopPortForward={handleStopPortForward}
        onRefreshPortForwards={refetchPortForwards}
        onSelectCluster={handleSelectCluster}
        onOpenClusterInNewTab={handleOpenClusterInNewTab}
        onToggleReadOnly={(unlocked) => writeModeMutation.mutate(unlocked)}
        onToggleAdvancedMode={() => setIsAdvancedMode(!isAdvancedMode)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenAuditLog={() => setIsAuditModalOpen(true)}
        onToggleAiDrawer={() => setIsAiDrawerOpen(!isAiDrawerOpen)}
        onOpenAddAwsOrg={() => setIsAddAwsOrgOpen(true)}
        onOpenDesignSystem={() => setIsDesignSystemOpen(true)}
        onReconnect={handleReconnect}
        updateInfo={updateInfo}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
      />

      {/* Main Workload View with Sidebar */}
      <div className="flex-1 flex min-h-0 relative">
        <Sidebar
          activeResource={activeResource}
          onSelectResource={handleSelectResource}
          customResourceTypes={customResourceTypes}
          updateInfo={updateInfo}
          onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
          isCheckingUpdates={isCheckingUpdates}
        />
        
        <main className="flex-1 flex min-h-0 relative flex-col overflow-hidden">
          {/* Top Multi-Tab Bar */}
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={handleSelectTab}
            onCloseTab={handleCloseTab}
            onCloseAllTabs={handleCloseAllTabs}
            onCloseOtherTabs={handleCloseOtherTabs}
            onDuplicateTab={handleDuplicateTab}
            onNewTab={handleNewTab}
          />

          <div className="flex-1 flex min-h-0 relative flex-col overflow-hidden">
            {activeResource === 'dashboard' ? (
              <ClusterDashboard key={`dashboard-${activeTabId}-${activeCluster?.id || 'cluster'}`} activeCluster={activeCluster} />
            ) : activeResource === 'pods' ? (
              <PodTable
                key={`pods-${activeTabId}-${activeCluster?.id || 'cluster'}`}
                pods={pods}
                selectedNamespaces={selectedNamespaces}
                namespaces={namespaces}
                isReadOnly={isReadOnly}
                isAdvancedMode={isAdvancedMode}
                isLoading={isPodsLoading}
                isError={isPodsError}
                errorMessage={podsError ? ((podsError as any)?.message || String(podsError)) : undefined}
                searchTerm={filterQuery}
                onSearchChange={handleSetFilterQuery}
                onSelectNamespaces={handleSetNamespaces}
                onScalePod={handleScalePod}
                onViewYaml={(pod) => setSelectedResourceForYaml({ kind: 'Pod', name: pod.name, namespace: pod.namespace })}
                onDescribePod={(pod) => setSelectedResourceForDescribe({ kind: 'Pod', name: pod.name, namespace: pod.namespace })}
                onLogsPod={handleOpenLogsTab}
                onExecPod={handleOpenExecTab}
                onPortForwardPod={setSelectedPodForPortForward}
                onDeletePod={(pod) =>
                  setConfirmationTarget({
                    actionType: 'delete',
                    resourceKind: 'Pod',
                    resourceName: pod.name,
                    namespace: pod.namespace,
                  })
                }
                onRefresh={() => refetchPods()}
                onReconnect={handleReconnect}
                onSsoLogin={handleAwsSsoBrowserLogin}
              />
            ) : (
              <GenericResourceTable
                key={`table-${activeTabId}-${activeResource}-${activeCluster?.id || 'cluster'}`}
                kind={activeResource}
                selectedNamespaces={selectedNamespaces}
                namespaces={namespaces}
                isReadOnly={isReadOnly}
                filterQuery={filterQuery}
                onFilterQueryChange={handleSetFilterQuery}
                onSelectNamespaces={handleSetNamespaces}
                onDescribe={(res) => setSelectedResourceForDescribe({ kind: res.kind || activeResource, name: res.name, namespace: res.namespace })}
                onLogs={handleOpenLogsTab}
                onScale={(res) => setSelectedScaleTarget({ kind: res.kind || activeResource, name: res.name, namespace: res.namespace || 'default' })}
                onRestart={(res) =>
                  setConfirmationTarget({
                    actionType: 'restart',
                    resourceKind: activeResource,
                    resourceName: res.name,
                    namespace: res.namespace || 'default',
                  })
                }
                onViewYaml={(res) => setSelectedResourceForYaml({ kind: activeResource, name: res.name, namespace: res.namespace })}
                onDelete={(res) =>
                  setConfirmationTarget({
                    actionType: 'delete',
                    resourceKind: activeResource,
                    resourceName: res.name,
                    namespace: res.namespace || 'default',
                  })
                }
                onReconnect={handleReconnect}
                onSsoLogin={handleAwsSsoBrowserLogin}
              />
            )}
          </div>

          <BottomPanel
            isOpen={isPanelOpen}
            onClose={() => setIsPanelOpen(false)}
            tabs={panelTabs}
            activeTabId={activePanelTabId}
            onTabChange={setActivePanelTabId}
          />
        </main>
      </div>

      {/* Modals & Dialogs */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        clusters={clusters}
        pods={pods}
        onSelectCluster={(id) => connectMutation.mutate(id)}
        onSelectPod={(pod) => {
          handleSelectResource('pods');
          handleSetFilterQuery(pod.name);
          handleOpenLogsTab({ kind: 'Pod', name: pod.name, namespace: pod.namespace });
        }}
        onOpenAi={() => setIsAiDrawerOpen(true)}
        onOpenAudit={() => setIsAuditModalOpen(true)}
        onToggleAdvanced={() => setIsAdvancedMode(!isAdvancedMode)}
      />

      <DescribeModal
        isOpen={!!selectedResourceForDescribe}
        onClose={() => setSelectedResourceForDescribe(null)}
        resource={selectedResourceForDescribe}
        isReadOnly={isReadOnly}
        onViewYaml={(res) => setSelectedResourceForYaml({ kind: res.kind || activeResource, name: res.name, namespace: res.namespace })}
        onLogs={handleOpenLogsTab}
        onPortForward={(res) => setSelectedPodForPortForward(res)}
        onExec={handleOpenExecTab}
        onScale={(res) => setSelectedScaleTarget({ kind: res.kind || activeResource, name: res.name, namespace: res.namespace || 'default' })}
        onDelete={(res) =>
          setConfirmationTarget({
            actionType: 'delete',
            resourceKind: res.kind || activeResource,
            resourceName: res.name,
            namespace: res.namespace || 'default',
          })
        }
      />

      <YamlEditorModal
        isOpen={!!selectedResourceForYaml}
        onClose={() => setSelectedResourceForYaml(null)}
        resource={selectedResourceForYaml}
        isReadOnly={isReadOnly}
        onApplied={() => {
          queryClient.invalidateQueries({ queryKey: ['pods'] });
          queryClient.invalidateQueries({ queryKey: ['resources'] });
          queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
        }}
      />

      <AddAwsOrgModal
        isOpen={isAddAwsOrgOpen}
        onClose={() => setIsAddAwsOrgOpen(false)}
        orgs={awsOrgs}
        clusters={clusters}
        activeCluster={activeCluster}
        onSelectCluster={(id) => connectMutation.mutate(id)}
        onRegisterOrg={async (alias, startUrl, ssoRegion) => {
          await registerOrgMutation.mutateAsync({ alias, startUrl, ssoRegion });
        }}
        onRefreshOrg={async (orgId) => {
          await refreshOrgMutation.mutateAsync(orgId);
        }}
      />

      <ScaleModal
        isOpen={!!selectedScaleTarget}
        onClose={() => setSelectedScaleTarget(null)}
        target={selectedScaleTarget}
        isReadOnly={isReadOnly}
        onScaled={() => {
          queryClient.invalidateQueries({ queryKey: ['pods'] });
          queryClient.invalidateQueries({ queryKey: ['resources'] });
          queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
        }}
      />


      <PortForwardModal
        isOpen={!!selectedPodForPortForward}
        onClose={() => setSelectedPodForPortForward(null)}
        pod={selectedPodForPortForward}
      />

      <AuditLogModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        entries={auditLogs}
      />

      <ConfirmationModal
        isOpen={!!confirmationTarget}
        onClose={() => setConfirmationTarget(null)}
        onConfirm={handleExecuteConfirmation}
        actionType={confirmationTarget?.actionType || 'delete'}
        resourceKind={confirmationTarget?.resourceKind || ''}
        resourceName={confirmationTarget?.resourceName || ''}
        namespace={confirmationTarget?.namespace}
        clusterName={activeCluster?.name}
        isReadOnly={isReadOnly}
      />

      <AwsSsoModal
        isOpen={isAwsSsoModalOpen}
        onClose={() => setIsAwsSsoModalOpen(false)}
        clusterName={activeCluster?.name}
        detectedProfile={healthInfo?.detected_profile || detectedProfile}
        onAuthSuccess={async () => {
          connectMutation.reset();
          await queryClient.invalidateQueries({ queryKey: ['clusterHealth'] });
          await queryClient.invalidateQueries({ queryKey: ['clusters'] });
          if (activeCluster) {
            await handleReconnect();
          }
        }}
      />

      <NewTabModal
        isOpen={isNewTabModalOpen}
        onClose={() => setIsNewTabModalOpen(false)}
        clusters={clusters}
        activeCluster={activeCluster}
        onAddTab={handleAddTabFromModal}
      />

      <DesignSystemShowcase
        isOpen={isDesignSystemOpen}
        onClose={() => setIsDesignSystemOpen(false)}
      />

      <PortForwardFloatingBanner
        tunnels={activePortForwards}
        onStopTunnel={handleStopPortForward}
      />



      <AiCopilotDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        onApproveProposal={handleApproveAiProposal}
        onRejectProposal={handleRejectAiProposal}
      />

      <ZoomHud
        zoomLevel={zoomLevel}
        showIndicator={showZoomIndicator}
        onReset={resetZoom}
      />

      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateInfo={updateInfo}
        isChecking={isCheckingUpdates}
        onCheckAgain={() => handleCheckForUpdates(true)}
      />
    </div>
  );
};
