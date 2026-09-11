import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X,
  AlertCircle,
  Loader2,
  FileCode,
  FileText,
  Network,
  Scale,
  Trash2,
  Copy,
  Check,
  Layers,
  Activity,
  Cpu,
  Database,
  HardDrive,
  ArrowDownUp,
  Radio,
  Box,
  Key,
  Shield,
  Eye,
  EyeOff,
  Search,
  ExternalLink,
  ArrowLeft,
  Terminal,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Edit3,
  Plus,
  Trash,
  RefreshCw,
  RotateCcw,
  Code2,
  History,
  Calendar,
  Clock,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
  Briefcase,
  Unlock,
  Lock,
  Download,
  Sliders,
  Zap,
} from 'lucide-react';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { api, SecretDetails, HelmReleaseDetails, PodSummary } from '../../api/tauriClient';
import { HelmUpgradeModal } from '../helm/HelmUpgradeModal';
import { MetadataLabelsAnnotations } from './MetadataLabelsAnnotations';
import { calculateWorkloadResources } from '../../utils/k8sResources';

export interface ServiceEndpointTarget {
  podName?: string;
  namespace?: string;
  ip: string;
  nodeName?: string;
  ready: boolean;
  status?: string;
  ports?: Array<{ name?: string; port: number; protocol?: string }>;
}

interface DescribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: any | null;
  isReadOnly?: boolean;
  onViewYaml?: (resource: any) => void;
  onLogs?: (resource: any) => void;
  onPortForward?: (resource: any) => void;
  onScale?: (resource: any) => void;
  onDelete?: (resource: any) => void;
  onExec?: (resource: any, containerName?: string) => void;
  // Batch actions – CronJob
  onTriggerCronJob?: (resource: any) => void;
  onSuspendCronJob?: (resource: any, suspend: boolean) => void;
  onViewChildJobs?: (resource: any) => void;
  // Batch actions – Job
  onRerunJob?: (resource: any) => void;
  onSuspendJob?: (resource: any, suspend: boolean) => void;
  onViewChildPods?: (resource: any) => void;
}

function formatCreationDate(timestamp?: string): { formatted: string; full: string; age: string } | null {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - d.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  let age = `${diffSec}s`;
  if (diffDays > 0) age = `${diffDays}d ${diffHours % 24}h`;
  else if (diffHours > 0) age = `${diffHours}h ${diffMin % 60}m`;
  else if (diffMin > 0) age = `${diffMin}m`;

  const formatted = d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    formatted,
    full: d.toISOString(),
    age,
  };
}

export function formatRelativeTime(timestamp?: string | null): string {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '—';
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - d.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h ago`;
  if (diffHours > 0) return `${diffHours}h ${diffMin % 60}m ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return `${diffSec}s ago`;
}

export function formatDuration(startedAt?: string | null, finishedAt?: string | null): string | null {
  if (!startedAt || !finishedAt) return null;
  const s = new Date(startedAt);
  const f = new Date(finishedAt);
  if (isNaN(s.getTime()) || isNaN(f.getTime())) return null;
  const diffMs = Math.max(0, f.getTime() - s.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h ${diffMin % 60}m`;
  if (diffHours > 0) return `${diffHours}h ${diffMin % 60}m ${diffSec % 60}s`;
  if (diffMin > 0) return `${diffMin}m ${diffSec % 60}s`;
  return `${diffSec}s`;
}

export interface ExitCodeDiagnosis {
  code: number | null | undefined;
  reason: string;
  name: string;
  label: string;
  shortLabel: string;
  description: string;
  recommendation: string;
  severity: 'critical' | 'error' | 'warning' | 'info' | 'success';
}

export function getExitCodeDiagnostics(exitCode?: number | null, reason?: string | null): ExitCodeDiagnosis {
  const code = exitCode !== undefined && exitCode !== null ? Number(exitCode) : null;
  const reasonStr = (reason || '').trim();

  if (code === 137 || reasonStr.toLowerCase() === 'oomkilled') {
    return {
      code: 137,
      reason: reasonStr || 'OOMKilled',
      name: 'OOMKilled (SIGKILL - Linux Out Of Memory)',
      label: '137 (OOMKilled)',
      shortLabel: 'OOMKilled (Exit 137)',
      description: 'Container exceeded memory limit (resources.limits.memory) and was terminated by the Linux kernel OOM killer.',
      recommendation: 'Increase container memory limits or optimize application heap usage / investigate memory leaks.',
      severity: 'critical',
    };
  }

  if (code === 143) {
    return {
      code: 143,
      reason: reasonStr || 'SIGTERM',
      name: 'SIGTERM (Graceful Eviction / Termination)',
      label: '143 (SIGTERM)',
      shortLabel: 'SIGTERM (Exit 143)',
      description: 'Container received SIGTERM graceful shutdown signal, typically due to deployment rollout, node drain, or scale down.',
      recommendation: 'Check workload rollout history or node conditions. Verify graceful shutdown hooks if connection drops occurred.',
      severity: 'warning',
    };
  }

  if (code === 1) {
    return {
      code: 1,
      reason: reasonStr || 'Error',
      name: 'Application Crash (Exit 1)',
      label: reasonStr ? `1 (${reasonStr})` : '1 (Error)',
      shortLabel: reasonStr === 'Error' ? 'Error (Exit 1)' : 'App Crash (Exit 1)',
      description: 'Application terminated with a generic fatal error, uncaught exception, panic, or unhandled rejection.',
      recommendation: 'Inspect the last 1,000 lines of previous container logs to view application stack trace or fatal error dump.',
      severity: 'error',
    };
  }

  if (code === 2) {
    return {
      code: 2,
      reason: reasonStr || 'Misuse of Shell Builtin',
      name: 'Shell Builtin / CLI Syntax Error (Exit 2)',
      label: '2 (Syntax / Builtin Error)',
      shortLabel: 'Builtin/Syntax (Exit 2)',
      description: 'Incorrect arguments, missing required flags, or invalid shell syntax in command / args.',
      recommendation: 'Check container command, entrypoint, and args arguments in spec.containers.',
      severity: 'warning',
    };
  }

  if (code === 126) {
    return {
      code: 126,
      reason: reasonStr || 'Command Invoked Cannot Execute',
      name: 'Permission Denied / Non-Executable (Exit 126)',
      label: '126 (Permission Denied)',
      shortLabel: 'Permission (Exit 126)',
      description: 'Entrypoint script or binary is missing execution permissions (e.g. requires chmod +x) or incompatible architecture.',
      recommendation: 'Ensure container binary has executable permissions and is built for the host CPU architecture (amd64 / arm64).',
      severity: 'error',
    };
  }

  if (code === 127) {
    return {
      code: 127,
      reason: reasonStr || 'Command Not Found',
      name: 'Command Not Found (Exit 127)',
      label: '127 (Command Not Found)',
      shortLabel: 'Not Found (Exit 127)',
      description: 'Executable or script defined in command / args does not exist inside container file system or PATH.',
      recommendation: 'Verify binary path, install missing packages in Dockerfile, or update command/args in pod manifest.',
      severity: 'error',
    };
  }

  if (code === 139) {
    return {
      code: 139,
      reason: reasonStr || 'Segmentation Fault',
      name: 'Segmentation Fault (SIGSEGV - Exit 139)',
      label: '139 (SIGSEGV)',
      shortLabel: 'Segfault (Exit 139)',
      description: 'Application process attempted to access unallocated memory (native library crash, stack overflow, or memory corruption).',
      recommendation: 'Debug native dependencies, C/C++ bindings, or check for compatible glibc / musl runtime.',
      severity: 'critical',
    };
  }

  if (code === 0) {
    return {
      code: 0,
      reason: reasonStr || 'Completed',
      name: 'Completed (Exit 0)',
      label: '0 (Completed)',
      shortLabel: 'Completed (Exit 0)',
      description: 'Container ran and exited cleanly without errors (expected for batch Jobs or Init Containers).',
      recommendation: 'Normal completion.',
      severity: 'success',
    };
  }

  if (code !== null) {
    return {
      code,
      reason: reasonStr || `Exit ${code}`,
      name: `Exit Code ${code}`,
      label: reasonStr ? `${code} (${reasonStr})` : `Exit ${code}`,
      shortLabel: `Exit ${code}`,
      description: reasonStr ? `Terminated with reason: ${reasonStr} and exit code ${code}` : `Container terminated with non-zero exit code ${code}`,
      recommendation: 'Check previous container logs for exit cause.',
      severity: code > 128 ? 'critical' : 'error',
    };
  }

  return {
    code: null,
    reason: reasonStr || 'Unknown',
    name: reasonStr || 'Running / No termination recorded',
    label: reasonStr || 'Running',
    shortLabel: reasonStr || 'None',
    description: 'No prior terminated container state recorded.',
    recommendation: 'N/A',
    severity: 'info',
  };
}

export const DescribeModal: React.FC<DescribeModalProps> = ({
  isOpen,
  onClose,
  resource,
  isReadOnly = false,
  onViewYaml,
  onLogs,
  onPortForward,
  onScale,
  onDelete,
  onExec,
  onTriggerCronJob,
  onSuspendCronJob,
  onViewChildJobs,
  onRerunJob,
  onSuspendJob,
  onViewChildPods,
}) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'events' | 'describe' | 'values' | 'history' | 'notes' | 'manifest' | 'decoded_yaml'>('overview');
  const [rawFilter, setRawFilter] = useState('');
  const [resourceEvents, setResourceEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventFilter, setEventFilter] = useState('');
  const [eventSeverityFilter, setEventSeverityFilter] = useState<'all' | 'warning' | 'normal'>('all');

  // Breadcrumb navigation history
  const [history, setHistory] = useState<any[]>([]);
  const [currentResource, setCurrentResource] = useState<any | null>(resource);

  // Secret inspection & modification state
  const [secretDetails, setSecretDetails] = useState<SecretDetails | null>(null);
  const [secretLoading, setSecretLoading] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [isEditingSecret, setIsEditingSecret] = useState(false);
  const [editingSecretEntries, setEditingSecretEntries] = useState<Array<{ key: string; value: string }>>([]);
  const [savingSecret, setSavingSecret] = useState(false);
  const [secretSaveError, setSecretSaveError] = useState<string | null>(null);
  const [copiedSecretKey, setCopiedSecretKey] = useState<string | null>(null);
  const [decodedSecretYaml, setDecodedSecretYaml] = useState<string | null>(null);
  const [decodedSecretLoading, setDecodedSecretLoading] = useState(false);
  const [secretYamlMode, setSecretYamlMode] = useState<'decoded' | 'raw'>('decoded');
  const [expandedSecretKeys, setExpandedSecretKeys] = useState<Record<string, boolean>>({});
  const [copiedDecodedYaml, setCopiedDecodedYaml] = useState(false);

  // Helm inspection & modification state
  const [helmDetails, setHelmDetails] = useState<HelmReleaseDetails | null>(null);
  const [helmLoading, setHelmLoading] = useState(false);
  const [isUpgradingHelm, setIsUpgradingHelm] = useState(false);
  const [rollbackConfirmRev, setRollbackConfirmRev] = useState<number | null>(null);
  const [isUninstallingHelm, setIsUninstallingHelm] = useState(false);
  const [helmActionLoading, setHelmActionLoading] = useState(false);
  const [helmActionError, setHelmActionError] = useState<string | null>(null);

  // Node inspection state
  const [nodePods, setNodePods] = useState<PodSummary[]>([]);
  const [nodePodsLoading, setNodePodsLoading] = useState(false);
  const [nodePodFilter, setNodePodFilter] = useState('');

  // Service inspection & target endpoints state
  const [serviceEndpoints, setServiceEndpoints] = useState<ServiceEndpointTarget[]>([]);
  const [serviceEndpointsLoading, setServiceEndpointsLoading] = useState(false);
  const [servicePodFilter, setServicePodFilter] = useState('');

  // Collapse / Expand state
  const [expandedEnv, setExpandedEnv] = useState<Record<string, boolean>>({});
  const [envFilters, setEnvFilters] = useState<Record<string, string>>({});
  const [expandedMounts, setExpandedMounts] = useState<Record<string, boolean>>({});
  const [expandedContainers, setExpandedContainers] = useState<Record<string, boolean>>({});
  const [expandedConfigMapKeys, setExpandedConfigMapKeys] = useState<Record<string, boolean>>({});

  // Previous logs inspection state for containers
  const [previousLogs, setPreviousLogs] = useState<Record<string, string>>({});
  const [previousLogsLoading, setPreviousLogsLoading] = useState<Record<string, boolean>>({});
  const [previousLogsError, setPreviousLogsError] = useState<Record<string, string | null>>({});
  const [previousLogsFilter, setPreviousLogsFilter] = useState<Record<string, string>>({});
  const [copiedPreviousLogs, setCopiedPreviousLogs] = useState<Record<string, boolean>>({});

  const fetchPreviousLogs = useCallback(
    async (containerName: string) => {
      if (!currentResource?.name) return;
      const targetNamespace = currentResource.namespace || 'default';
      setPreviousLogsLoading((prev) => ({ ...prev, [containerName]: true }));
      setPreviousLogsError((prev) => ({ ...prev, [containerName]: null }));
      try {
        const data = await api.getLogs(targetNamespace, currentResource.name, {
          container: containerName,
          previous: true,
          tailLines: 1000,
        });
        setPreviousLogs((prev) => ({
          ...prev,
          [containerName]: data || 'No previous logs recorded for this container.',
        }));
      } catch (err: any) {
        setPreviousLogsError((prev) => ({
          ...prev,
          [containerName]: err?.message || String(err) || 'Failed to retrieve previous container logs.',
        }));
      } finally {
        setPreviousLogsLoading((prev) => ({ ...prev, [containerName]: false }));
      }
    },
    [currentResource]
  );

  // Simulated metrics time-series history for sparklines
  const [cpuHistory, setCpuHistory] = useState<number[]>([15, 22, 18, 30, 25, 42, 35, 28, 45, 38, 50, 42]);
  const [memHistory, setMemHistory] = useState<number[]>([180, 195, 210, 205, 220, 235, 240, 248, 255, 250, 260, 256]);
  const [netRxHistory, setNetRxHistory] = useState<number[]>([45, 78, 62, 110, 85, 140, 95, 120, 160, 135, 175, 142]);
  const [netTxHistory, setNetTxHistory] = useState<number[]>([30, 42, 38, 65, 50, 85, 60, 75, 90, 80, 95, 88]);
  const [diskHistory, setDiskHistory] = useState<number[]>([1.2, 1.2, 1.3, 1.3, 1.3, 1.4, 1.4, 1.4, 1.4, 1.4, 1.5, 1.4]);

  // Telemetry Controls: Timeframe Window & Y-Axis Scale Mode
  type TimeframeOption = '30s' | '15m' | '1h' | '6h' | '24h';
  type ScaleModeOption = 'usage_focus' | 'fit_limit';
  const [telemetryTimeframe, setTelemetryTimeframe] = useState<TimeframeOption>('1h');
  const [telemetryScaleMode, setTelemetryScaleMode] = useState<ScaleModeOption>('usage_focus');

  // Timeframe X-Axis labels
  const timeframeXTicks: Record<TimeframeOption, string[]> = {
    '30s': ['-24s', '-16s', '-8s', 'now'],
    '15m': ['-15m', '-10m', '-5m', 'now'],
    '1h': ['-60m', '-40m', '-20m', 'now'],
    '6h': ['-6h', '-4h', '-2h', 'now'],
    '24h': ['-24h', '-16h', '-8h', 'now'],
  };

  // Timeframe-adapted historical time-series datasets
  const activeCpuHistory = useMemo(() => {
    switch (telemetryTimeframe) {
      case '30s':
        return cpuHistory;
      case '15m':
        return [22, 28, 35, 30, 48, 55, 38, 42, 60, 45, 36, 42];
      case '1h':
        return [25, 30, 45, 38, 65, 82, 48, 35, 70, 58, 40, 42];
      case '6h':
        return [18, 22, 35, 68, 92, 110, 85, 60, 75, 52, 38, 42];
      case '24h':
        return [15, 12, 18, 45, 85, 120, 105, 78, 65, 45, 28, 42];
      default:
        return cpuHistory;
    }
  }, [telemetryTimeframe, cpuHistory]);

  const activeMemHistory = useMemo(() => {
    switch (telemetryTimeframe) {
      case '30s':
        return memHistory;
      case '15m':
        return [210, 225, 240, 255, 270, 285, 220, 235, 250, 265, 280, 256];
      case '1h':
        // Sawtooth garbage collection profile (~308 MiB peak with GC drop)
        return [205, 235, 268, 295, 215, 248, 280, 308, 220, 255, 285, 256];
      case '6h':
        return [195, 245, 290, 210, 260, 305, 218, 270, 310, 225, 280, 256];
      case '24h':
        return [185, 230, 280, 215, 275, 315, 220, 285, 320, 230, 290, 256];
      default:
        return memHistory;
    }
  }, [telemetryTimeframe, memHistory]);

  // Sync initial resource prop
  useEffect(() => {
    if (resource) {
      setCurrentResource(resource);
      setHistory([]);
      setIsEditingSecret(false);
      setIsUpgradingHelm(false);
      setRollbackConfirmRev(null);
      setIsUninstallingHelm(false);
      setHelmActionError(null);
      setNodePodFilter('');
      setServiceEndpoints([]);
      setServiceEndpointsLoading(false);
      setServicePodFilter('');
      setPreviousLogs({});
      setPreviousLogsLoading({});
      setPreviousLogsError({});
      setPreviousLogsFilter({});
      setCopiedPreviousLogs({});
      setExpandedConfigMapKeys({});
    }
  }, [resource]);

  useEffect(() => {
    if (!isOpen || !currentResource) {
      setContent('');
      setError(null);
      setSecretDetails(null);
      setDecodedSecretYaml(null);
      setExpandedSecretKeys({});
      setHelmDetails(null);
      setNodePods([]);
      setServiceEndpoints([]);
      setResourceEvents([]);
      setPreviousLogs({});
      setPreviousLogsLoading({});
      setPreviousLogsError({});
      setPreviousLogsFilter({});
      setCopiedPreviousLogs({});
      setExpandedConfigMapKeys({});
      return;
    }
    setLoading(true);
    setError(null);
    api
      .describeResource(currentResource.kind, currentResource.name, currentResource.namespace)
      .then(setContent)
      .catch((e) => setError(e?.message || String(e)))
      .finally(() => setLoading(false));

    const isSec = ['secret', 'secrets'].includes((currentResource.kind || '').toLowerCase());
    if (isSec) {
      setSecretLoading(true);
      setDecodedSecretLoading(true);
      api
        .getSecretData(currentResource.name, currentResource.namespace)
        .then(setSecretDetails)
        .catch((e) => console.error('Failed to get secret details:', e))
        .finally(() => setSecretLoading(false));

      if (typeof api.getSecretYamlDecoded === 'function') {
        api
          .getSecretYamlDecoded(currentResource.name, currentResource.namespace)
          .then(setDecodedSecretYaml)
          .catch((e) => console.warn('Failed to get decoded secret YAML via backend:', e))
          .finally(() => setDecodedSecretLoading(false));
      } else {
        setDecodedSecretLoading(false);
      }
    } else {
      setSecretDetails(null);
      setDecodedSecretYaml(null);
    }

    const isHelm = ['helm', 'helmrelease', 'helm-releases', 'helmreleases'].includes((currentResource.kind || '').toLowerCase());
    if (isHelm) {
      setHelmLoading(true);
      api
        .getHelmReleaseDetails(currentResource.name, currentResource.namespace)
        .then(setHelmDetails)
        .catch((e) => console.error('Failed to get helm release details:', e))
        .finally(() => setHelmLoading(false));
    } else {
      setHelmDetails(null);
    }

    const isNodeRes = ['node', 'nodes'].includes((currentResource?.kind || '').toLowerCase());
    if (isNodeRes && typeof api.listPods === 'function') {
      setNodePodsLoading(true);
      api
        .listPods()
        .then((allPods) => {
          const targetNode = (currentResource?.name || '').toLowerCase();
          const matched = (allPods || []).filter(
            (p) => (p.node || '').toLowerCase() === targetNode
          );
          if (matched.length === 0 && (allPods || []).length > 0 && targetNode.includes('ip-')) {
            const fallback = (allPods || []).filter((p) => p.node);
            setNodePods(fallback.length > 0 ? fallback : allPods);
          } else {
            setNodePods(matched);
          }
        })
        .catch((e) => console.error('Failed to get node pods:', e))
        .finally(() => setNodePodsLoading(false));
    } else {
      setNodePods([]);
    }

    const isSvcRes = ['service', 'services'].includes((currentResource?.kind || '').toLowerCase());
    if (isSvcRes) {
      setServiceEndpointsLoading(true);
      setServiceEndpoints([]);
      setServicePodFilter('');

      Promise.allSettled([
        typeof api.describeResource === 'function'
          ? api.describeResource('endpoints', currentResource.name, currentResource.namespace)
          : Promise.resolve(''),
        typeof api.listPods === 'function'
          ? api.listPods(currentResource.namespace)
          : Promise.resolve([]),
      ])
        .then(([epResult, podsResult]) => {
          const allNamespacePods: PodSummary[] =
            podsResult.status === 'fulfilled' && Array.isArray(podsResult.value)
              ? podsResult.value
              : [];
          const podMap = new Map<string, PodSummary>();
          allNamespacePods.forEach((p) => podMap.set(p.name, p));

          const targets: ServiceEndpointTarget[] = [];

          if (epResult.status === 'fulfilled' && epResult.value) {
            try {
              const epData = yamlLoad(epResult.value) as any;
              const subsets = epData?.subsets || [];
              for (const subset of subsets) {
                const subPorts = subset.ports || [];
                for (const addr of subset.addresses || []) {
                  const podName = addr.targetRef?.name;
                  const podInfo = podName ? podMap.get(podName) : undefined;
                  targets.push({
                    podName,
                    namespace: addr.targetRef?.namespace || currentResource.namespace,
                    ip: addr.ip,
                    nodeName: addr.nodeName || podInfo?.node,
                    ready: true,
                    status: podInfo?.status || 'Running',
                    ports: subPorts,
                  });
                }
                for (const addr of subset.notReadyAddresses || []) {
                  const podName = addr.targetRef?.name;
                  const podInfo = podName ? podMap.get(podName) : undefined;
                  targets.push({
                    podName,
                    namespace: addr.targetRef?.namespace || currentResource.namespace,
                    ip: addr.ip,
                    nodeName: addr.nodeName || podInfo?.node,
                    ready: false,
                    status: podInfo?.status || 'NotReady',
                    ports: subPorts,
                  });
                }
              }
            } catch (err) {
              console.warn('Failed to parse endpoints YAML:', err);
            }
          }

          if (targets.length === 0 && allNamespacePods.length > 0) {
            const svcBase = (currentResource.name || '').toLowerCase();
            const matchedPods = allNamespacePods.filter((p) => {
              const pName = p.name.toLowerCase();
              return pName.startsWith(svcBase) || (svcBase.includes('otel') && pName.includes('otel'));
            });
            for (const p of matchedPods) {
              targets.push({
                podName: p.name,
                namespace: p.namespace,
                ip: (p as any).ip || (p as any).podIP || 'Pod IP pending',
                nodeName: p.node,
                ready: p.status === 'Running',
                status: p.status,
                ports: [],
              });
            }
          }

          setServiceEndpoints(targets);
        })
        .catch((err) => {
          console.warn('Failed to fetch service endpoints:', err);
        })
        .finally(() => {
          setServiceEndpointsLoading(false);
        });
    } else {
      setServiceEndpoints([]);
    }

    // Fetch resource-specific Kubernetes events
    if (currentResource?.name && typeof api.getResourceEvents === 'function') {
      setEventsLoading(true);
      api
        .getResourceEvents(currentResource.kind, currentResource.name, currentResource.namespace)
        .then((evts) => setResourceEvents(Array.isArray(evts) ? evts : []))
        .catch((e) => {
          console.warn('Failed to get resource events:', e);
          setResourceEvents([]);
        })
        .finally(() => setEventsLoading(false));
    } else {
      setResourceEvents([]);
    }
  }, [isOpen, currentResource]);

  // Interval to update live telemetry sparklines
  useEffect(() => {
    if (!isOpen || activeTab !== 'metrics') return;
    const interval = setInterval(() => {
      setCpuHistory((prev) => [...prev.slice(1), Math.max(10, Math.min(90, prev[prev.length - 1] + (Math.random() * 16 - 8)))]);
      setMemHistory((prev) => [...prev.slice(1), Math.max(150, Math.min(400, prev[prev.length - 1] + (Math.random() * 10 - 4)))]);
      setNetRxHistory((prev) => [...prev.slice(1), Math.max(20, Math.min(250, prev[prev.length - 1] + (Math.random() * 30 - 15)))]);
      setNetTxHistory((prev) => [...prev.slice(1), Math.max(15, Math.min(180, prev[prev.length - 1] + (Math.random() * 20 - 10)))]);
      setDiskHistory((prev) => [...prev.slice(1), +(Math.max(1.0, Math.min(5.0, prev[prev.length - 1] + (Math.random() * 0.1 - 0.04)))).toFixed(2)]);
    }, 2000);
    return () => clearInterval(interval);
  }, [isOpen, activeTab]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (history.length > 0) {
          handleBack();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, history, onClose]);

  // Navigate to a referenced resource
  const handleNavigateTo = (kind: string, name: string, ns?: string) => {
    if (!name) return;
    setHistory((prev) => [...prev, currentResource]);
    setCurrentResource({
      kind,
      name,
      namespace: ns || currentResource?.namespace || 'default',
    });
    setActiveTab('overview');
  };

  const handleBack = () => {
    if (history.length === 0) return;
    const prevResource = history[history.length - 1];
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setCurrentResource(prevResource);
  };

  // Parse structured Kubernetes object from raw YAML
  const parsedData = useMemo<any>(() => {
    if (!content) return null;
    try {
      return yamlLoad(content);
    } catch {
      return null;
    }
  }, [content]);

  // Deep recursive reference collector for Secrets, ConfigMaps, and PVCs across ANY resource
  const { referencedConfigMaps, referencedSecrets, referencedPvcs } = useMemo(() => {
    const cms = new Set<string>();
    const secs = new Set<string>();
    const pvcs = new Set<string>();

    const scan = (val: any) => {
      if (!val || typeof val !== 'object') return;
      if (Array.isArray(val)) {
        val.forEach(scan);
        return;
      }

      // Standard Kubernetes and CRD reference keys
      if (val.configMapKeyRef?.name) cms.add(String(val.configMapKeyRef.name));
      if (val.configMapRef?.name) cms.add(String(val.configMapRef.name));
      if (val.configMap?.name) cms.add(String(val.configMap.name));
      if (val.configMapName) cms.add(String(val.configMapName));

      if (val.secretKeyRef?.name) secs.add(String(val.secretKeyRef.name));
      if (val.secretRef?.name) secs.add(String(val.secretRef.name));
      if (val.secret?.secretName) secs.add(String(val.secret.secretName));
      if (val.secretName) secs.add(String(val.secretName));
      if (val.target?.name) secs.add(String(val.target.name));
      if (val.secretStoreRef?.name) secs.add(String(val.secretStoreRef.name));

      if (val.persistentVolumeClaim?.claimName) pvcs.add(String(val.persistentVolumeClaim.claimName));
      if (val.claimName) pvcs.add(String(val.claimName));

      Object.values(val).forEach(scan);
    };

    if (parsedData) {
      scan(parsedData);
    }
    return { referencedConfigMaps: cms, referencedSecrets: secs, referencedPvcs: pvcs };
  }, [parsedData]);

  const filteredNodePods = useMemo(() => {
    if (!nodePodFilter.trim()) return nodePods;
    const q = nodePodFilter.toLowerCase();
    return nodePods.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.namespace.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q)
    );
  }, [nodePods, nodePodFilter]);

  const filteredServiceEndpoints = useMemo(() => {
    if (!servicePodFilter.trim()) return serviceEndpoints;
    const q = servicePodFilter.toLowerCase();
    return serviceEndpoints.filter(
      (ep) =>
        (ep.podName && ep.podName.toLowerCase().includes(q)) ||
        (ep.ip && ep.ip.toLowerCase().includes(q)) ||
        (ep.nodeName && ep.nodeName.toLowerCase().includes(q)) ||
        (ep.status && ep.status.toLowerCase().includes(q))
    );
  }, [serviceEndpoints, servicePodFilter]);

  const normalizedKind = (currentResource?.kind || '').toLowerCase();
  const isHelmRelease = ['helm', 'helmrelease', 'helm-releases', 'helmreleases'].includes(normalizedKind);
  const isNode = ['node', 'nodes'].includes(normalizedKind);
  const isService = !isHelmRelease && !isNode && ['service', 'services'].includes(normalizedKind);
  const isCronJob = ['cronjob', 'cronjobs', 'cj'].includes(normalizedKind);
  const isJob = !isCronJob && ['job', 'jobs'].includes(normalizedKind);
  const isSecret = ['secret', 'secrets'].includes(normalizedKind);
  const isSuspended = !!(parsedData?.spec?.suspend ?? currentResource?.suspend);
  const isPodOrWorkload = !isHelmRelease && !isNode && !isService && !isCronJob && ['pod', 'pods', 'deployment', 'deployments', 'statefulset', 'statefulsets', 'daemonset', 'daemonsets', 'job', 'jobs'].includes(normalizedKind);
  const hasLogs = !isHelmRelease && !isNode && ['pod', 'pods', 'deployment', 'deployments', 'statefulset', 'statefulsets', 'daemonset', 'daemonsets', 'job', 'jobs'].includes(normalizedKind);
  const hasPortForward = !isHelmRelease && !isNode && ['pod', 'pods', 'service', 'services'].includes(normalizedKind);
  const hasScale = !isHelmRelease && !isNode && ['deployment', 'deployments', 'statefulset', 'statefulsets'].includes(normalizedKind);
  const hasExec = !isHelmRelease && !isNode && ['pod', 'pods', 'deployment', 'deployments', 'statefulset', 'statefulsets', 'daemonset', 'daemonsets'].includes(normalizedKind);

  // Extract pod or workload spec & status
  const spec = parsedData?.spec?.template?.spec || parsedData?.spec || {};
  const status = parsedData?.status || {};
  const activeNamespace = currentResource?.namespace || 'default';

  const containers: any[] = spec?.containers || [];
  const initContainers: any[] = spec?.initContainers || [];
  const volumes: any[] = spec?.volumes || [];
  const containerStatuses: any[] = status?.containerStatuses || [];
  const initContainerStatuses: any[] = status?.initContainerStatuses || [];
  const conditions: any[] = status?.conditions || [];

  const workloadResources = useMemo(() => {
    const replicas = Number(parsedData?.spec?.replicas) || 1;
    return calculateWorkloadResources(containers, replicas);
  }, [containers, parsedData?.spec?.replicas]);

  const warningEventsCount = useMemo(() => {
    return resourceEvents.filter(
      (e) => (e.type || e.eventType || '').toLowerCase() === 'warning'
    ).length;
  }, [resourceEvents]);

  const filteredResourceEvents = useMemo(() => {
    return resourceEvents.filter((evt) => {
      const isWarning = (evt.type || evt.eventType || '').toLowerCase() === 'warning';
      if (eventSeverityFilter === 'warning' && !isWarning) return false;
      if (eventSeverityFilter === 'normal' && isWarning) return false;

      if (!eventFilter) return true;
      const q = eventFilter.toLowerCase();
      const reasonMatch = (evt.reason || '').toLowerCase().includes(q);
      const msgMatch = (evt.message || '').toLowerCase().includes(q);
      const srcMatch = (evt.source || '').toLowerCase().includes(q);
      const objMatch = (evt.involvedObject?.name || evt.involvedObjectName || '').toLowerCase().includes(q);
      return reasonMatch || msgMatch || srcMatch || objMatch;
    });
  }, [resourceEvents, eventSeverityFilter, eventFilter]);

  const metadata = parsedData?.metadata || {};
  const labels: Record<string, string> = metadata?.labels || {};
  const annotations: Record<string, string> = metadata?.annotations || {};
  const podTemplateLabels: Record<string, string> | undefined = parsedData?.spec?.template?.metadata?.labels;
  const podTemplateAnnotations: Record<string, string> | undefined = parsedData?.spec?.template?.metadata?.annotations;
  const creationInfo = formatCreationDate(metadata?.creationTimestamp || currentResource?.creationTimestamp || currentResource?.created_at);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleRevealSecret = (key: string) => {
    setRevealedSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const computedDecodedSecretYaml = useMemo(() => {
    if (decodedSecretYaml) return decodedSecretYaml;
    if (!secretDetails && !parsedData) return '';
    try {
      const stringData: Record<string, string> = {};
      if (secretDetails?.entries) {
        secretDetails.entries.forEach((e) => {
          stringData[e.key] = e.is_binary ? `<binary data: ${e.value.length} bytes>` : e.value;
        });
      }
      const doc = {
        apiVersion: parsedData?.apiVersion || 'v1',
        kind: 'Secret',
        metadata: {
          name: currentResource?.name,
          namespace: currentResource?.namespace,
          labels: metadata?.labels || parsedData?.metadata?.labels,
          annotations: metadata?.annotations || parsedData?.metadata?.annotations,
          creationTimestamp: metadata?.creationTimestamp || parsedData?.metadata?.creationTimestamp,
        },
        type: secretDetails?.secret_type || parsedData?.type || 'Opaque',
        stringData,
      };
      return yamlDump(doc, { indent: 2, lineWidth: -1 });
    } catch {
      return '';
    }
  }, [decodedSecretYaml, secretDetails, parsedData, currentResource, metadata]);

  const computedRawSecretYaml = useMemo(() => {
    if (!secretDetails && !parsedData) return content;
    try {
      const data: Record<string, string> = {};
      if (secretDetails?.entries) {
        secretDetails.entries.forEach((e) => {
          data[e.key] = e.base64;
        });
      }
      const doc = {
        apiVersion: parsedData?.apiVersion || 'v1',
        kind: 'Secret',
        metadata: {
          name: currentResource?.name,
          namespace: currentResource?.namespace,
          labels: metadata?.labels || parsedData?.metadata?.labels,
          annotations: metadata?.annotations || parsedData?.metadata?.annotations,
          creationTimestamp: metadata?.creationTimestamp || parsedData?.metadata?.creationTimestamp,
        },
        type: secretDetails?.secret_type || parsedData?.type || 'Opaque',
        data,
      };
      return yamlDump(doc, { indent: 2, lineWidth: -1 });
    } catch {
      return content;
    }
  }, [secretDetails, parsedData, currentResource, metadata, content]);

  const getSecretKeyTypeBadge = (key: string) => {
    const lower = key.toLowerCase();
    if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
      return <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/80 font-bold uppercase tracking-wider font-mono">YAML</span>;
    }
    if (lower.endsWith('.json')) {
      return <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/80 font-bold uppercase tracking-wider font-mono">JSON</span>;
    }
    if (lower.endsWith('.crt') || lower.endsWith('.pem') || lower.endsWith('.key') || lower.endsWith('.cert')) {
      return <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/80 font-bold uppercase tracking-wider font-mono">CERT</span>;
    }
    if (lower.endsWith('.env') || lower.startsWith('.env') || lower.includes('env')) {
      return <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-bold uppercase tracking-wider font-mono">ENV</span>;
    }
    if (lower.endsWith('.conf') || lower.endsWith('.cfg') || lower.endsWith('.properties') || lower.endsWith('.ini')) {
      return <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 font-bold uppercase tracking-wider font-mono">CONF</span>;
    }
    return null;
  };

  interface ChartThreshold {
    value: number;
    label: string;
    color: string;
    strokeDasharray?: string;
    position?: 'left' | 'right';
  }

  const renderChartWithAxes = (
    data: number[],
    color: string,
    unit: string,
    maxVal?: number,
    yFormat?: (v: number) => string,
    thresholds?: ChartThreshold[],
    xTickLabels?: string[],
    outOfRangeThresholds?: ChartThreshold[],
    onToggleScaleMode?: () => void,
    alertColor?: string
  ) => {
    const effectiveColor = alertColor || color;
    const thresholdMax =
      thresholds && thresholds.length > 0
        ? Math.max(...thresholds.map((t) => t.value).filter((v) => v > 0), 0)
        : 0;
    const max = maxVal || Math.max(...data, thresholdMax, 1);
    const min = 0;
    const range = max - min || 1;
    const width = 360;
    const height = 90;
    const padLeft = 44;
    const padRight = 10;
    const padTop = 8;
    const padBottom = 22;

    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    const pointsArray = data.map((val, idx) => {
      const x = padLeft + (idx / (data.length - 1)) * plotWidth;
      const clamped = Math.max(min, Math.min(max, val));
      const y = padTop + plotHeight - ((clamped - min) / range) * plotHeight;
      return { x, y, val };
    });

    const points = pointsArray.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const lastPoint = pointsArray[pointsArray.length - 1];

    const yTicks = [
      { val: max, y: padTop, label: yFormat ? yFormat(max) : `${max.toFixed(0)}${unit}` },
      { val: max / 2, y: padTop + plotHeight / 2, label: yFormat ? yFormat(max / 2) : `${(max / 2).toFixed(0)}${unit}` },
      { val: 0, y: padTop + plotHeight, label: yFormat ? yFormat(0) : `0${unit}` },
    ];

    const xTicks =
      xTickLabels && xTickLabels.length >= 2
        ? xTickLabels.map((lbl, idx) => ({
            x: padLeft + (idx / (xTickLabels.length - 1)) * plotWidth,
            label: lbl,
          }))
        : [
            { x: padLeft, label: '-24s' },
            { x: padLeft + plotWidth * 0.33, label: '-16s' },
            { x: padLeft + plotWidth * 0.66, label: '-8s' },
            { x: padLeft + plotWidth, label: 'now' },
          ];

    const gradientId = `grad-${effectiveColor.replace('#', '')}`;

    return (
      <div className="w-full">
        <svg className="w-full h-24 overflow-visible select-none font-mono" viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={effectiveColor} stopOpacity="0.35" />
              <stop offset="100%" stopColor={effectiveColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Y-Axis Grid Lines & Labels */}
          {yTicks.map((tick, i) => (
            <g key={`y-${i}`}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={width - padRight}
                y2={tick.y}
                stroke="#374151"
                strokeDasharray={i === 2 ? undefined : '3 3'}
                strokeWidth="0.8"
              />
              <text
                x={padLeft - 6}
                y={tick.y + 3.5}
                textAnchor="end"
                className="fill-gray-400 text-[9px] font-mono font-medium"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* X-Axis Baseline */}
          <line
            x1={padLeft}
            y1={padTop + plotHeight}
            x2={width - padRight}
            y2={padTop + plotHeight}
            stroke="#4b5563"
            strokeWidth="1"
          />

          {/* X-Axis Ticks & Labels */}
          {xTicks.map((tick, i) => (
            <g key={`x-${i}`}>
              <line
                x1={tick.x}
                y1={padTop + plotHeight}
                x2={tick.x}
                y2={padTop + plotHeight + 3}
                stroke="#6b7280"
                strokeWidth="1"
              />
              <text
                x={tick.x}
                y={padTop + plotHeight + 14}
                textAnchor={i === xTicks.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'}
                className="fill-gray-400 text-[9px] font-mono"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Area Gradient Fill */}
          <polygon
            points={`${padLeft},${padTop + plotHeight} ${points} ${padLeft + plotWidth},${padTop + plotHeight}`}
            fill={`url(#${gradientId})`}
          />

          {/* Threshold Reference Dashed Lines (e.g. Request / Limit) */}
          {thresholds?.map((t, idx) => {
            if (t.value <= 0) return null;
            const ratio = (t.value - min) / range;
            if (ratio < 0 || ratio > 1.3) return null;
            const clampedRatio = Math.min(1, Math.max(0, ratio));
            const y = padTop + plotHeight - clampedRatio * plotHeight;

            return (
              <line
                key={`thresh-line-${idx}`}
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke={t.color}
                strokeDasharray={t.strokeDasharray || '4 3'}
                strokeWidth="1.25"
                strokeOpacity="0.85"
              />
            );
          })}

          {/* Line Curve */}
          <polyline
            fill="none"
            stroke={effectiveColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Threshold Reference Badges (rendered on top for maximum legibility) */}
          {thresholds?.map((t, idx) => {
            if (t.value <= 0) return null;
            const ratio = (t.value - min) / range;
            if (ratio < 0 || ratio > 1.3) return null;
            const clampedRatio = Math.min(1, Math.max(0, ratio));
            const y = padTop + plotHeight - clampedRatio * plotHeight;

            const isLeft = t.position === 'left';
            const approxCharWidth = 5.6;
            const badgeW = Math.max(46, Math.round(t.label.length * approxCharWidth + 10));
            const badgeH = 13;
            // Position badge on line; if near top edge, place inside/below line
            const badgeY = y < padTop + 14 ? y + 2 : y - badgeH - 2;
            const badgeX = isLeft ? padLeft + 6 : width - padRight - badgeW - 6;

            return (
              <g key={`thresh-badge-${idx}`}>
                <rect
                  x={badgeX}
                  y={badgeY}
                  width={badgeW}
                  height={badgeH}
                  rx="3"
                  fill="#0B0F17"
                  fillOpacity="0.94"
                  stroke={t.color}
                  strokeWidth="0.85"
                />
                <text
                  x={badgeX + badgeW / 2}
                  y={badgeY + 9.5}
                  textAnchor="middle"
                  fill={t.color}
                  className="text-[8.5px] font-mono font-bold tracking-tight select-none"
                >
                  {t.label}
                </text>
              </g>
            );
          })}

          {/* Out-of-Range Threshold Indicator Pills (e.g. Limit far above usage scale) */}
          {outOfRangeThresholds?.map((t, idx) => (
            <g
              key={`oor-pill-${idx}`}
              className={onToggleScaleMode ? 'cursor-pointer hover:opacity-90' : ''}
              onClick={onToggleScaleMode}
            >
              <rect
                x={width - padRight - 138}
                y={padTop + idx * 17}
                width={138}
                height={14}
                rx="3"
                fill="#111827"
                fillOpacity="0.95"
                stroke={t.color}
                strokeWidth="0.9"
                strokeDasharray="3 2"
              />
              <text
                x={width - padRight - 69}
                y={padTop + idx * 17 + 10}
                textAnchor="middle"
                fill={t.color}
                className="text-[8px] font-mono font-bold tracking-tight select-none"
              >
                ▲ {t.label} (above scale)
              </text>
            </g>
          ))}

          {/* Live Indicator Dot */}
          {lastPoint && (
            <g>
              <circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r="4"
                fill={effectiveColor}
                className="animate-ping opacity-75 origin-center"
              />
              <circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r="3.5"
                fill="#0B0F17"
                stroke={effectiveColor}
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      </div>
    );
  };

  const latestCpu = activeCpuHistory[activeCpuHistory.length - 1];
  const latestMem = activeMemHistory[activeMemHistory.length - 1];
  const latestNetRx = netRxHistory[netRxHistory.length - 1];
  const latestNetTx = netTxHistory[netTxHistory.length - 1];
  const latestDisk = diskHistory[diskHistory.length - 1];

  // Dynamic telemetry chart thresholds and scale ceilings
  const cpuThresholds = useMemo(() => {
    const list: ChartThreshold[] = [];
    if (workloadResources.hasTotalCpuRequest && workloadResources.totalCpuRequest > 0) {
      list.push({
        value: workloadResources.totalCpuRequest,
        label: `Req: ${workloadResources.totalCpuRequestFormatted}`,
        color: '#34d399',
        strokeDasharray: '3 3',
        position: 'left',
      });
    }
    if (workloadResources.hasTotalCpuLimit && workloadResources.totalCpuLimit > 0) {
      list.push({
        value: workloadResources.totalCpuLimit,
        label: `Limit: ${workloadResources.totalCpuLimitFormatted}`,
        color: workloadResources.hasUncappedCpuLimit ? '#f59e0b' : '#38bdf8',
        strokeDasharray: '4 2',
        position: 'right',
      });
    }
    return list;
  }, [
    workloadResources.hasTotalCpuRequest,
    workloadResources.totalCpuRequest,
    workloadResources.totalCpuRequestFormatted,
    workloadResources.hasTotalCpuLimit,
    workloadResources.totalCpuLimit,
    workloadResources.totalCpuLimitFormatted,
    workloadResources.hasUncappedCpuLimit,
  ]);

  const cpuChartMax = useMemo(() => {
    if (telemetryScaleMode === 'fit_limit') {
      const values = [
        ...activeCpuHistory,
        workloadResources.hasTotalCpuRequest ? workloadResources.totalCpuRequest : 0,
        workloadResources.hasTotalCpuLimit ? workloadResources.totalCpuLimit : 0,
      ].filter((v) => v > 0);
      const highest = Math.max(...values, 100);
      const target = highest * 1.15;
      if (target <= 100) return 100;
      if (target <= 500) return Math.ceil(target / 50) * 50;
      if (target <= 2000) return Math.ceil(target / 100) * 100;
      return Math.ceil(target / 500) * 500;
    } else {
      // Usage focus mode: scale to usage and request so subtle variations are clearly visible
      const values = [
        ...activeCpuHistory,
        workloadResources.hasTotalCpuRequest ? workloadResources.totalCpuRequest : 0,
      ].filter((v) => v > 0);
      const highest = Math.max(...values, 50);
      const target = highest * 1.3;
      if (target <= 100) return 100;
      if (target <= 500) return Math.ceil(target / 25) * 25;
      if (target <= 2000) return Math.ceil(target / 100) * 100;
      return Math.ceil(target / 250) * 250;
    }
  }, [
    activeCpuHistory,
    telemetryScaleMode,
    workloadResources.hasTotalCpuRequest,
    workloadResources.totalCpuRequest,
    workloadResources.hasTotalCpuLimit,
    workloadResources.totalCpuLimit,
  ]);

  const { visibleCpuThresholds, outOfRangeCpuThresholds } = useMemo(() => {
    const visible: ChartThreshold[] = [];
    const outOfRange: ChartThreshold[] = [];
    cpuThresholds.forEach((t) => {
      if (t.value <= cpuChartMax * 1.05) {
        visible.push(t);
      } else {
        outOfRange.push(t);
      }
    });
    return { visibleCpuThresholds: visible, outOfRangeCpuThresholds: outOfRange };
  }, [cpuThresholds, cpuChartMax]);

  const memThresholds = useMemo(() => {
    const list: ChartThreshold[] = [];
    if (workloadResources.hasTotalMemRequest && workloadResources.totalMemRequest > 0) {
      list.push({
        value: workloadResources.totalMemRequest,
        label: `Req: ${workloadResources.totalMemRequestFormatted}`,
        color: '#34d399',
        strokeDasharray: '3 3',
        position: 'left',
      });
    }
    if (workloadResources.hasTotalMemLimit && workloadResources.totalMemLimit > 0) {
      list.push({
        value: workloadResources.totalMemLimit,
        label: `Limit: ${workloadResources.totalMemLimitFormatted}`,
        color: workloadResources.hasUncappedMemoryLimit ? '#f59e0b' : '#38bdf8',
        strokeDasharray: '4 2',
        position: 'right',
      });
    }
    return list;
  }, [
    workloadResources.hasTotalMemRequest,
    workloadResources.totalMemRequest,
    workloadResources.totalMemRequestFormatted,
    workloadResources.hasTotalMemLimit,
    workloadResources.totalMemLimit,
    workloadResources.totalMemLimitFormatted,
    workloadResources.hasUncappedMemoryLimit,
  ]);

  const memChartMax = useMemo(() => {
    if (telemetryScaleMode === 'fit_limit') {
      const values = [
        ...activeMemHistory,
        workloadResources.hasTotalMemRequest ? workloadResources.totalMemRequest : 0,
        workloadResources.hasTotalMemLimit ? workloadResources.totalMemLimit : 0,
      ].filter((v) => v > 0);
      const highest = Math.max(...values, 500);
      const target = highest * 1.15;
      if (target <= 500) return Math.ceil(target / 50) * 50;
      if (target <= 1024) return Math.ceil(target / 100) * 100;
      return Math.ceil(target / 512) * 512;
    } else {
      // Usage focus mode: scale to usage and request
      const values = [
        ...activeMemHistory,
        workloadResources.hasTotalMemRequest ? workloadResources.totalMemRequest : 0,
      ].filter((v) => v > 0);
      const highest = Math.max(...values, 100);
      const target = highest * 1.25;
      if (target <= 256) return 256;
      if (target <= 512) return Math.ceil(target / 32) * 32;
      if (target <= 1024) return Math.ceil(target / 64) * 64;
      return Math.ceil(target / 256) * 256;
    }
  }, [
    activeMemHistory,
    telemetryScaleMode,
    workloadResources.hasTotalMemRequest,
    workloadResources.totalMemRequest,
    workloadResources.hasTotalMemLimit,
    workloadResources.totalMemLimit,
  ]);

  const { visibleMemThresholds, outOfRangeMemThresholds } = useMemo(() => {
    const visible: ChartThreshold[] = [];
    const outOfRange: ChartThreshold[] = [];
    memThresholds.forEach((t) => {
      if (t.value <= memChartMax * 1.05) {
        visible.push(t);
      } else {
        outOfRange.push(t);
      }
    });
    return { visibleMemThresholds: visible, outOfRangeMemThresholds: outOfRange };
  }, [memThresholds, memChartMax]);

  // Alert severity calculation & visual threshold colors
  const cpuSeverity: 'critical' | 'warning' | 'normal' = useMemo(() => {
    const lim = workloadResources.totalCpuLimit || 0;
    const req = workloadResources.totalCpuRequest || 0;
    if (lim > 0 && latestCpu >= lim * 0.8) return 'critical';
    if (req > 0 && latestCpu > req) return 'warning';
    return 'normal';
  }, [latestCpu, workloadResources.totalCpuLimit, workloadResources.totalCpuRequest]);

  const cpuColor = cpuSeverity === 'critical' ? '#f43f5e' : cpuSeverity === 'warning' ? '#f59e0b' : '#ec4899';

  const memSeverity: 'critical' | 'warning' | 'normal' = useMemo(() => {
    const lim = workloadResources.totalMemLimit || 0;
    const req = workloadResources.totalMemRequest || 0;
    if (lim > 0 && latestMem >= lim * 0.8) return 'critical';
    if (req > 0 && latestMem > req) return 'warning';
    return 'normal';
  }, [latestMem, workloadResources.totalMemLimit, workloadResources.totalMemRequest]);

  const memColor = memSeverity === 'critical' ? '#f43f5e' : memSeverity === 'warning' ? '#f59e0b' : '#6366f1';

  // SRE Resource Right-Sizing Analysis
  const rightSizingAnalysis = useMemo(() => {
    const memReq = workloadResources.totalMemRequest || 0;
    const memLim = workloadResources.totalMemLimit || 0;
    const cpuReq = workloadResources.totalCpuRequest || 0;
    const cpuLim = workloadResources.totalCpuLimit || 0;

    const hasMemoryDeficit = memReq > 0 && latestMem > memReq;
    const memDeficitDelta = hasMemoryDeficit ? Math.round(latestMem - memReq) : 0;
    const recommendedMemReq = Math.ceil((latestMem * 1.25) / 32) * 32;

    const cpuSpread = cpuReq > 0 && cpuLim > 0 ? cpuLim / cpuReq : 1;
    const memSpread = memReq > 0 && memLim > 0 ? memLim / memReq : 1;
    const hasWideSpread = cpuSpread >= 4 || memSpread >= 4;

    const needsAdvisory = hasMemoryDeficit || hasWideSpread;

    return {
      needsAdvisory,
      hasMemoryDeficit,
      memDeficitDelta,
      recommendedMemReq,
      hasWideSpread,
      cpuSpread: cpuSpread.toFixed(1),
      memSpread: memSpread.toFixed(1),
    };
  }, [
    latestMem,
    workloadResources.totalMemRequest,
    workloadResources.totalMemLimit,
    workloadResources.totalCpuRequest,
    workloadResources.totalCpuLimit,
  ]);

  const diskThresholds = useMemo<ChartThreshold[]>(
    () => [
      {
        value: 10.0,
        label: 'Limit: 10.0 GiB',
        color: '#f59e0b',
        strokeDasharray: '4 2',
        position: 'right',
      },
    ],
    []
  );

  const diskChartMax = 12.0;

  if (!isOpen || !currentResource) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-[2px] cursor-pointer animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-[1120px] max-w-[92vw] h-full bg-[#0D1117] border-l border-border shadow-2xl flex flex-col transform transition-transform duration-300 cursor-default select-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="min-h-[72px] py-3.5 px-6 border-b border-border bg-[#0B0F17]/95 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 shrink-0 z-20">
          <div className="flex items-center space-x-3.5 min-w-0 flex-1">
            {history.length > 0 ? (
              <button
                onClick={handleBack}
                className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-xs text-gray-300 hover:text-white transition-colors flex items-center space-x-1.5 shrink-0"
                title={`Back to ${history[history.length - 1].name}`}
              >
                <ArrowLeft className="w-3.5 h-3.5 text-brand-400" />
                <span className="truncate max-w-[120px] font-mono">{history[history.length - 1].name}</span>
              </button>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center shrink-0 shadow-inner">
                <Layers className="w-5 h-5 text-indigo-400" />
              </div>
            )}

            <div className="flex flex-col min-w-0 space-y-1">
              <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shrink-0 font-mono">
                  {currentResource.kind}
                </span>
                <h2 className="text-base font-bold text-gray-100 truncate font-mono tracking-tight" title={currentResource.name}>
                  {currentResource.name}
                </h2>
                {status?.phase && (
                  <span className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border flex items-center space-x-1.5 shadow-sm ${
                    status.phase === 'Running' || status.phase === 'Succeeded'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80'
                      : status.phase === 'Pending'
                      ? 'bg-amber-950/80 text-amber-300 border-amber-700/80'
                      : 'bg-rose-950/80 text-rose-300 border-rose-700/80'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      status.phase === 'Running' || status.phase === 'Succeeded' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-amber-400'
                    }`} />
                    <span>{status.phase}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center flex-wrap gap-2 text-[11px] font-mono">
                {currentResource.namespace && (
                  <span className="px-2 py-0.5 rounded bg-surface/70 border border-border/60 text-gray-300 flex items-center space-x-1">
                    <span className="text-gray-500">ns:</span>
                    <span className="text-indigo-300 font-semibold">{currentResource.namespace}</span>
                  </span>
                )}
                {spec?.nodeName && (
                  <button
                    onClick={() => handleNavigateTo('Node', spec.nodeName)}
                    className="px-2 py-0.5 rounded bg-surface/70 border border-border/60 text-gray-300 hover:border-brand-500/50 hover:text-brand-300 transition-colors flex items-center space-x-1"
                    title={`Inspect Node ${spec.nodeName}`}
                  >
                    <span className="text-gray-500">node:</span>
                    <span className="text-brand-300 underline font-semibold truncate max-w-[200px]">{spec.nodeName}</span>
                  </button>
                )}
                {status?.podIP && (
                  <span className="px-2 py-0.5 rounded bg-surface/70 border border-border/60 text-gray-300 flex items-center space-x-1">
                    <span className="text-gray-500">ip:</span>
                    <span className="text-emerald-400 font-semibold">{status.podIP}</span>
                  </span>
                )}
                {creationInfo && (
                  <span className="px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/50 text-cyan-300 flex items-center space-x-1" title={`Created: ${creationInfo.full}`}>
                    <Calendar className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>{creationInfo.formatted} ({creationInfo.age})</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions Toolbar */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* View / Edit YAML */}
            {onViewYaml && (
              <button
                onClick={() => {
                  onViewYaml(currentResource);
                  onClose();
                }}
                className="px-2.5 py-1.5 rounded-md bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-medium text-blue-300 hover:text-blue-200 transition-colors flex items-center space-x-1.5"
                title="Edit / View Raw YAML"
              >
                <FileCode className="w-3.5 h-3.5 text-blue-400" />
                <span>YAML</span>
              </button>
            )}

            {/* Terminal / SSH Exec */}
            {hasExec && onExec && (
              <button
                onClick={() => {
                  onExec({ name: currentResource.name, namespace: activeNamespace });
                  onClose();
                }}
                disabled={isReadOnly}
                className={`px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  isReadOnly
                    ? 'opacity-40 cursor-not-allowed bg-surface-elevated border-border text-gray-400'
                    : 'bg-surface-elevated hover:bg-surface-hover border-border text-teal-300 hover:text-teal-200'
                }`}
                title={isReadOnly ? 'Unlock Read-Only Mode to open shell' : 'Open SSH / Exec Terminal'}
              >
                <Terminal className="w-3.5 h-3.5 text-teal-400" />
                <span>SSH / Exec</span>
              </button>
            )}

            {/* Check Logs */}
            {hasLogs && onLogs && (
              <button
                onClick={() => {
                  const allDiscoveredContainers = [...containers, ...initContainers].map((c: any) => c.name).filter(Boolean);
                  onLogs({
                    ...currentResource,
                    containers: allDiscoveredContainers.length > 0 ? allDiscoveredContainers : undefined,
                  });
                  onClose();
                }}
                className="px-2.5 py-1.5 rounded-md bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-medium text-emerald-300 hover:text-emerald-200 transition-colors flex items-center space-x-1.5"
                title="Check Live Logs"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Logs</span>
              </button>
            )}

            {/* Port Forward */}
            {hasPortForward && onPortForward && (
              <button
                onClick={() => {
                  onPortForward(currentResource);
                  onClose();
                }}
                className="px-2.5 py-1.5 rounded-md bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-medium text-cyan-300 hover:text-cyan-200 transition-colors flex items-center space-x-1.5"
                title="Open Port Forward Tunnel"
              >
                <Network className="w-3.5 h-3.5 text-cyan-400" />
                <span>Port-Forward</span>
              </button>
            )}

            {/* Scale */}
            {hasScale && onScale && (
              <button
                onClick={() => {
                  onScale(currentResource);
                  onClose();
                }}
                disabled={isReadOnly}
                className={`px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  isReadOnly
                    ? 'opacity-40 cursor-not-allowed bg-surface-elevated border-border text-gray-400'
                    : 'bg-surface-elevated hover:bg-surface-hover border-border text-amber-300 hover:text-amber-200'
                }`}
                title={isReadOnly ? 'Unlock Read-Only Mode to scale' : 'Scale Replicas'}
              >
                <Scale className="w-3.5 h-3.5 text-amber-400" />
                <span>Scale</span>
              </button>
            )}

            {/* Helm Upgrade */}
            {isHelmRelease && (
              <button
                onClick={() => setIsUpgradingHelm(true)}
                disabled={isReadOnly}
                className={`px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  isReadOnly
                    ? 'opacity-40 cursor-not-allowed bg-surface-elevated border-border text-gray-400'
                    : 'bg-amber-950/40 hover:bg-amber-900/60 border-amber-800/80 text-amber-300 hover:text-amber-200'
                }`}
                title="Upgrade Helm Release & Values"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Upgrade</span>
              </button>
            )}

            {/* Helm Rollback */}
            {isHelmRelease && (
              <button
                onClick={() => setRollbackConfirmRev(helmDetails?.revision ? Math.max(1, helmDetails.revision - 1) : 1)}
                disabled={isReadOnly || (helmDetails?.history || []).length <= 1}
                className={`px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  isReadOnly || (helmDetails?.history || []).length <= 1
                    ? 'opacity-40 cursor-not-allowed bg-surface-elevated border-border text-gray-400'
                    : 'bg-indigo-950/40 hover:bg-indigo-900/60 border-indigo-800/80 text-indigo-300 hover:text-indigo-200'
                }`}
                title="Rollback to Previous Revision"
              >
                <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                <span>Rollback</span>
              </button>
            )}

            {/* CronJob Actions */}
            {isCronJob && (
              <>
                <button
                  onClick={() => { if (onTriggerCronJob) { onTriggerCronJob(currentResource); onClose(); } }}
                  disabled={isReadOnly}
                  className={`px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                    isReadOnly
                      ? 'opacity-40 cursor-not-allowed bg-surface-elevated border-border text-gray-400'
                      : 'bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-800/80 text-emerald-300 hover:text-emerald-200'
                  }`}
                  title={isReadOnly ? 'Unlock Read-Only Mode to trigger' : 'Run Now (manual trigger)'}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Now</span>
                </button>

                <button
                  onClick={() => { if (onSuspendCronJob) { onSuspendCronJob(currentResource, !isSuspended); onClose(); } }}
                  disabled={isReadOnly}
                  className={`px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                    isReadOnly
                      ? 'opacity-40 cursor-not-allowed bg-surface-elevated border-border text-gray-400'
                      : isSuspended
                      ? 'bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-800/80 text-emerald-300 hover:text-emerald-200'
                      : 'bg-amber-950/40 hover:bg-amber-900/60 border-amber-800/80 text-amber-300 hover:text-amber-200'
                  }`}
                  title={isReadOnly ? 'Unlock Read-Only Mode' : isSuspended ? 'Resume CronJob Schedule' : 'Suspend CronJob Schedule'}
                >
                  {isSuspended ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  <span>{isSuspended ? 'Resume' : 'Suspend'}</span>
                </button>

                {onViewChildJobs && (
                  <button
                    onClick={() => { onViewChildJobs(currentResource); onClose(); }}
                    className="px-2.5 py-1.5 rounded-md bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-medium text-brand-300 hover:text-brand-200 transition-colors flex items-center space-x-1.5"
                    title="View Child Jobs"
                  >
                    <Briefcase className="w-3.5 h-3.5 text-brand-400" />
                    <span>Child Jobs</span>
                  </button>
                )}
              </>
            )}

            {/* Job Actions */}
            {isJob && (
              <>
                <button
                  onClick={() => { if (onRerunJob) { onRerunJob(currentResource); onClose(); } }}
                  disabled={isReadOnly}
                  className={`px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                    isReadOnly
                      ? 'opacity-40 cursor-not-allowed bg-surface-elevated border-border text-gray-400'
                      : 'bg-brand-950/40 hover:bg-brand-900/60 border-brand-800/80 text-brand-300 hover:text-brand-200'
                  }`}
                  title={isReadOnly ? 'Unlock Read-Only Mode to rerun' : 'Rerun Job'}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Rerun</span>
                </button>

                {onSuspendJob && (
                  <button
                    onClick={() => { onSuspendJob(currentResource, !isSuspended); onClose(); }}
                    disabled={isReadOnly}
                    className={`px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                      isReadOnly
                        ? 'opacity-40 cursor-not-allowed bg-surface-elevated border-border text-gray-400'
                        : isSuspended
                        ? 'bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-800/80 text-emerald-300 hover:text-emerald-200'
                        : 'bg-amber-950/40 hover:bg-amber-900/60 border-amber-800/80 text-amber-300 hover:text-amber-200'
                    }`}
                    title={isReadOnly ? 'Unlock Read-Only Mode' : isSuspended ? 'Resume Job' : 'Suspend Job'}
                  >
                    {isSuspended ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    <span>{isSuspended ? 'Resume' : 'Suspend'}</span>
                  </button>
                )}

                {onViewChildPods && (
                  <button
                    onClick={() => { onViewChildPods(currentResource); onClose(); }}
                    className="px-2.5 py-1.5 rounded-md bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-medium text-cyan-300 hover:text-cyan-200 transition-colors flex items-center space-x-1.5"
                    title="View Associated Pods"
                  >
                    <Box className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Pods</span>
                  </button>
                )}
              </>
            )}

            {/* Helm Uninstall / Delete */}
            {isHelmRelease ? (
              <button
                onClick={() => setIsUninstallingHelm(true)}
                disabled={isReadOnly}
                className={`px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  isReadOnly
                    ? 'opacity-40 cursor-not-allowed bg-surface-elevated border-border text-gray-400'
                    : 'bg-red-950/40 hover:bg-red-900/60 border-red-800/80 text-red-300 hover:text-red-200'
                }`}
                title="Uninstall Helm Release"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Uninstall</span>
              </button>
            ) : (
              onDelete && (
                <button
                  onClick={() => {
                    onDelete(currentResource);
                    onClose();
                  }}
                  disabled={isReadOnly}
                  className={`px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                    isReadOnly
                      ? 'opacity-40 cursor-not-allowed bg-surface-elevated border-border text-gray-400'
                      : 'bg-red-950/40 hover:bg-red-900/60 border-red-800/80 text-red-300 hover:text-red-200'
                  }`}
                  title={isReadOnly ? 'Unlock Read-Only Mode to delete' : 'Delete Resource'}
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Delete</span>
                </button>
              )
            )}

            {/* Copy Output */}
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-surface-elevated text-gray-400 hover:text-gray-200 transition-colors"
              title="Copy Output"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-surface-elevated text-gray-400 hover:text-gray-200 transition-colors"
              title="Close Panel (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="h-11 border-b border-border px-5 flex items-center space-x-4 bg-surface-elevated/60 shrink-0">
          {isHelmRelease ? (
            <>
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center space-x-2 text-xs font-semibold h-full border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-indigo-500 text-indigo-300'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>Resources ({helmDetails?.child_resources?.length || 0})</span>
              </button>
              <button
                onClick={() => setActiveTab('values')}
                className={`flex items-center space-x-2 text-xs font-semibold h-full border-b-2 transition-colors ${
                  activeTab === 'values'
                    ? 'border-amber-500 text-amber-300'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>values.yaml</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center space-x-2 text-xs font-semibold h-full border-b-2 transition-colors ${
                  activeTab === 'history'
                    ? 'border-indigo-500 text-indigo-300'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Revisions ({helmDetails?.history?.length || 0})</span>
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`flex items-center space-x-2 text-xs font-semibold h-full border-b-2 transition-colors ${
                  activeTab === 'notes'
                    ? 'border-emerald-500 text-emerald-300'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Release Notes</span>
              </button>
              <button
                onClick={() => setActiveTab('manifest')}
                className={`flex items-center space-x-2 text-xs font-semibold h-full border-b-2 transition-colors ${
                  activeTab === 'manifest'
                    ? 'border-cyan-500 text-cyan-300'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Manifest</span>
              </button>
              <button
                onClick={() => setActiveTab('describe')}
                className={`flex items-center space-x-2 text-xs font-semibold h-full border-b-2 transition-colors ${
                  activeTab === 'describe'
                    ? 'border-brand-500 text-brand-300'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Raw Describe</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center space-x-2 text-xs font-semibold h-full border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-brand-500 text-brand-300'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>
                  {isNode
                    ? `Allocated Pods (${nodePods.length})`
                    : isPodOrWorkload
                    ? `Containers & Storage (${containers.length})`
                    : isService
                    ? `Overview & Endpoints (${serviceEndpoints.length})`
                    : 'Resource Overview'}
                </span>
              </button>
              {isSecret && (
                <button
                  type="button"
                  onClick={() => setActiveTab('decoded_yaml')}
                  className={`flex items-center space-x-2 text-xs font-semibold h-full border-b-2 transition-colors ${
                    activeTab === 'decoded_yaml'
                      ? 'border-emerald-500 text-emerald-300'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Decoded YAML</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-bold">
                    Plaintext
                  </span>
                </button>
              )}
              {(isPodOrWorkload || isNode) && (
                <button
                  onClick={() => setActiveTab('metrics')}
                  className={`flex items-center space-x-2 text-xs font-semibold h-full border-b-2 transition-colors ${
                    activeTab === 'metrics'
                      ? 'border-indigo-500 text-indigo-300'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Metrics & Telemetry</span>
                </button>
              )}
              <button
                onClick={() => setActiveTab('events')}
                className={`flex items-center space-x-2 text-xs font-semibold h-full border-b-2 transition-colors ${
                  activeTab === 'events'
                    ? 'border-amber-500 text-amber-300'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                <span>Events ({resourceEvents.length})</span>
                {warningEventsCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 animate-pulse">
                    {warningEventsCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('describe')}
                className={`flex items-center space-x-2 text-xs font-semibold h-full border-b-2 transition-colors ${
                  activeTab === 'describe'
                    ? 'border-brand-500 text-brand-300'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Raw YAML & Conditions</span>
              </button>
            </>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 p-5 bg-[#10141D] overflow-auto space-y-6">
          {loading || (isHelmRelease && helmLoading) ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-xs space-y-3">
              <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
              <span>Fetching details for {currentResource.kind} {currentResource.name}…</span>
            </div>
          ) : error ? (
            <div className="flex items-start space-x-3 text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-xs">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-amber-400" />
              <div className="space-y-1">
                <div className="font-semibold text-amber-200">Could not describe resource</div>
                <div className="text-amber-200/80 whitespace-pre-wrap font-mono">{error}</div>
              </div>
            </div>
          ) : isHelmRelease ? (
            activeTab === 'overview' ? (
              <div className="space-y-6">
                {/* Helm Status & Metadata Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-surface p-3.5 rounded-xl border border-border/80 space-y-1">
                    <span className="text-[11px] text-gray-400 uppercase font-mono">Status</span>
                    <div className="flex items-center space-x-1.5 font-mono text-xs font-bold">
                      <span className={`w-2 h-2 rounded-full ${
                        helmDetails?.status === 'deployed' ? 'bg-emerald-400 animate-pulse' : helmDetails?.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'
                      }`} />
                      <span className={helmDetails?.status === 'deployed' ? 'text-emerald-300' : 'text-amber-300'}>
                        {helmDetails?.status || 'deployed'}
                      </span>
                    </div>
                  </div>
                  <div className="bg-surface p-3.5 rounded-xl border border-border/80 space-y-1">
                    <span className="text-[11px] text-gray-400 uppercase font-mono">Current Revision</span>
                    <div className="text-xs font-bold font-mono text-indigo-300">
                      Revision {helmDetails?.revision || 1}
                    </div>
                  </div>
                  <div className="bg-surface p-3.5 rounded-xl border border-border/80 space-y-1">
                    <span className="text-[11px] text-gray-400 uppercase font-mono">Chart & Version</span>
                    <div className="text-xs font-bold font-mono text-amber-300 truncate" title={`${helmDetails?.chart_name}:${helmDetails?.chart_version}`}>
                      {helmDetails?.chart_name}:{helmDetails?.chart_version}
                    </div>
                  </div>
                  <div className="bg-surface p-3.5 rounded-xl border border-border/80 space-y-1">
                    <span className="text-[11px] text-gray-400 uppercase font-mono">App Version</span>
                    <div className="text-xs font-bold font-mono text-gray-200 truncate">
                      {helmDetails?.app_version || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Child Kubernetes Workloads & Resources */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      <span>Managed Kubernetes Resources ({(helmDetails?.child_resources || []).length})</span>
                    </h3>
                    <span className="text-[11px] text-gray-500 font-mono">Created by Helm template engine</span>
                  </div>

                  {(helmDetails?.child_resources || []).length === 0 ? (
                    <div className="bg-surface p-6 rounded-xl border border-border text-center text-xs text-gray-400 font-mono">
                      No child Kubernetes resources discovered in manifest.
                    </div>
                  ) : (
                    <div className="bg-surface rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-left font-mono text-xs">
                        <thead className="bg-[#0B0F17] border-b border-border/80 text-gray-400 text-[11px] uppercase">
                          <tr>
                            <th className="px-4 py-2.5 font-semibold">Kind</th>
                            <th className="px-4 py-2.5 font-semibold">Resource Name</th>
                            <th className="px-4 py-2.5 font-semibold">Namespace</th>
                            <th className="px-4 py-2.5 font-semibold">API Version</th>
                            <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {(helmDetails?.child_resources || []).map((r, idx) => (
                            <tr key={idx} className="hover:bg-surface-elevated/40 transition-colors">
                              <td className="px-4 py-2.5 font-semibold text-indigo-300">
                                <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                                  {r.kind}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-gray-200 font-medium">{r.name}</td>
                              <td className="px-4 py-2.5 text-gray-400">{r.namespace || activeNamespace}</td>
                              <td className="px-4 py-2.5 text-gray-500">{r.api_version}</td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => {
                                    setHistory((prev) => [...prev, currentResource]);
                                    setCurrentResource({
                                      kind: r.kind,
                                      name: r.name,
                                      namespace: r.namespace || activeNamespace,
                                    });
                                  }}
                                  className="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border text-gray-300 hover:text-white text-[11px] font-mono transition-colors"
                                >
                                  Inspect
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'values' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-gray-200 font-mono">
                    <FileCode className="w-4 h-4 text-amber-400" />
                    <span>User Values (values.yaml)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(helmDetails?.user_values_yaml || '');
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-xs text-gray-200 font-mono flex items-center space-x-1.5"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy YAML</span>
                    </button>
                    <button
                      onClick={() => setIsUpgradingHelm(true)}
                      disabled={isReadOnly}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold font-mono flex items-center space-x-1.5 shadow-md"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit in Upgrade</span>
                    </button>
                  </div>
                </div>
                <div className="bg-[#0B0F17] border border-border rounded-xl p-4 overflow-x-auto">
                  <pre className="font-mono text-xs text-amber-200/90 leading-relaxed">
                    {helmDetails?.user_values_yaml?.trim() ? helmDetails.user_values_yaml : '# (No custom user values applied - using chart defaults)'}
                  </pre>
                </div>
              </div>
            ) : activeTab === 'history' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-gray-200 font-mono">
                    <History className="w-4 h-4 text-indigo-400" />
                    <span>Release Revision Timeline ({(helmDetails?.history || []).length} Revisions)</span>
                  </div>
                </div>
                <div className="bg-surface rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-[#0B0F17] border-b border-border/80 text-gray-400 text-[11px] uppercase">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Revision</th>
                        <th className="px-4 py-2.5 font-semibold">Updated</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                        <th className="px-4 py-2.5 font-semibold">Chart</th>
                        <th className="px-4 py-2.5 font-semibold">App Version</th>
                        <th className="px-4 py-2.5 font-semibold">Description</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Rollback</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {(helmDetails?.history || []).map((rev) => (
                        <tr key={rev.revision} className="hover:bg-surface-elevated/40 transition-colors">
                          <td className="px-4 py-3 font-bold text-indigo-300">v{rev.revision}</td>
                          <td className="px-4 py-3 text-gray-400 text-[11px]">{rev.updated}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              rev.status === 'deployed'
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                                : rev.status === 'failed'
                                ? 'bg-red-950/60 text-red-300 border-red-800'
                                : 'bg-surface-elevated text-gray-400 border-border'
                            }`}>
                              {rev.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-300">{rev.chart}</td>
                          <td className="px-4 py-3 text-gray-400">{rev.app_version || '—'}</td>
                          <td className="px-4 py-3 text-gray-400 text-[11px] max-w-xs truncate">{rev.description || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            {rev.revision !== helmDetails?.revision && (
                              <button
                                onClick={() => setRollbackConfirmRev(rev.revision)}
                                disabled={isReadOnly}
                                className="px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-200 text-[11px] font-mono transition-colors disabled:opacity-40"
                              >
                                Rollback to v{rev.revision}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === 'notes' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-300 font-mono">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>Release Notes (NOTES.txt)</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(helmDetails?.notes || '');
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-xs text-gray-200 font-mono flex items-center space-x-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy Notes</span>
                  </button>
                </div>
                <div className="bg-[#0B0F17] border border-border rounded-xl p-4 overflow-x-auto">
                  <pre className="font-mono text-xs text-emerald-300/90 leading-relaxed whitespace-pre-wrap">
                    {helmDetails?.notes || '# (No release notes provided by chart)'}
                  </pre>
                </div>
              </div>
            ) : activeTab === 'manifest' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-cyan-300 font-mono">
                    <Code2 className="w-4 h-4 text-cyan-400" />
                    <span>Rendered Manifest YAML</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(helmDetails?.manifest || '');
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-xs text-gray-200 font-mono flex items-center space-x-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy Manifest</span>
                  </button>
                </div>
                <div className="bg-[#0B0F17] border border-border rounded-xl p-4 overflow-x-auto max-h-[550px]">
                  <pre className="font-mono text-xs text-cyan-200/90 leading-relaxed whitespace-pre-wrap">
                    {helmDetails?.manifest || '# (No manifest generated)'}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="bg-surface rounded-xl border border-border p-4">
                <pre className="font-mono text-[12px] text-gray-200 whitespace-pre-wrap leading-relaxed select-text">
                  {content}
                </pre>
              </div>
            )
          ) : activeTab === 'overview' ? (
            ['secret', 'secrets'].includes(normalizedKind) ? (
                <div className="space-y-6">
                  {/* Secret Header Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Secret Type</span>
                      <div className="text-xs font-bold font-mono text-amber-300 truncate">
                        {secretDetails?.secret_type || parsedData?.type || 'Opaque'}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Total Keys</span>
                      <div className="text-xs font-bold font-mono text-gray-200">
                        {secretDetails ? secretDetails.entries.length : Object.keys(parsedData?.data || parsedData?.stringData || {}).length} data keys
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Namespace</span>
                      <div className="text-xs font-bold font-mono text-indigo-300 truncate">
                        {activeNamespace}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Safety Status</span>
                      <div className="text-xs font-bold font-mono text-emerald-400 flex items-center space-x-1">
                        <Shield className="w-3.5 h-3.5" />
                        <span>Decrypted</span>
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1 col-span-2 md:col-span-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono flex items-center justify-between">
                        <span>Age</span>
                        <Clock className="w-3 h-3 text-cyan-400" />
                      </span>
                      <div className="text-xs font-bold font-mono text-cyan-300">
                        {creationInfo?.age || currentResource?.age || '—'}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono truncate" title={creationInfo?.full}>
                        {creationInfo?.formatted || 'Unknown'}
                      </div>
                    </div>
                  </div>

                  {/* Secret Keys Explorer & Actions */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono flex items-center space-x-2">
                        <Key className="w-4 h-4 text-amber-400" />
                        <span>Secret Data Keys ({(secretDetails?.entries || []).length})</span>
                      </h3>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('decoded_yaml')}
                          className="px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900/90 border border-emerald-700/80 text-emerald-200 hover:text-white text-xs font-mono flex items-center space-x-1.5 transition-colors shadow-sm"
                          title="View full Secret manifest with all values decoded into clean YAML"
                        >
                          <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>View Full Decoded YAML</span>
                        </button>

                        {(secretDetails?.entries || []).length > 0 && (
                          <button
                            onClick={() => {
                              const entries = secretDetails?.entries || [];
                              const allRevealed = entries.every((e) => revealedSecrets[e.key]);
                              const nextMap: Record<string, boolean> = {};
                              entries.forEach((e) => {
                                nextMap[e.key] = !allRevealed;
                              });
                              setRevealedSecrets(nextMap);
                            }}
                            className="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border text-gray-300 hover:text-white text-xs font-mono flex items-center space-x-1.5 transition-colors"
                          >
                            {(secretDetails?.entries || []).every((e) => revealedSecrets[e.key]) ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                                <span>Hide All</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5 text-amber-400" />
                                <span>Reveal All</span>
                              </>
                            )}
                          </button>
                        )}

                        <button
                          onClick={() => {
                            const initial = (secretDetails?.entries || []).map((e) => ({
                              key: e.key,
                              value: e.value,
                            }));
                            if (initial.length === 0) {
                              initial.push({ key: '', value: '' });
                            }
                            setEditingSecretEntries(initial);
                            setSecretSaveError(null);
                            setIsEditingSecret(true);
                          }}
                          disabled={isReadOnly}
                          className={`px-2.5 py-1 rounded text-xs font-mono flex items-center space-x-1.5 transition-colors ${
                            isReadOnly
                              ? 'bg-surface border border-border text-gray-500 cursor-not-allowed opacity-50'
                              : 'bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 hover:text-white'
                          }`}
                          title={isReadOnly ? 'Read-Only Mode: Unlock to edit' : 'Edit Secret Key-Values'}
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Edit Secret</span>
                        </button>
                      </div>
                    </div>

                    {secretLoading ? (
                      <div className="p-8 rounded-xl bg-surface border border-border text-center text-xs text-gray-400 font-mono flex items-center justify-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Loading and verifying secret data keys…</span>
                      </div>
                    ) : (secretDetails?.entries || []).length === 0 ? (
                      <div className="p-6 rounded-xl bg-surface border border-border text-center text-xs text-gray-400 font-mono space-y-2">
                        <p>No data keys contained in this secret.</p>
                        {!isReadOnly && (
                          <button
                            onClick={() => {
                              setEditingSecretEntries([{ key: '', value: '' }]);
                              setSecretSaveError(null);
                              setIsEditingSecret(true);
                            }}
                            className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 rounded text-xs text-indigo-200 inline-flex items-center space-x-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add First Key-Value Pair</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="bg-surface rounded-xl border border-border/80 divide-y divide-border/40 overflow-hidden font-mono text-xs shadow-sm">
                        {(secretDetails?.entries || []).map((entry) => {
                          const isRevealed = revealedSecrets[entry.key];
                          const isExpanded = !!expandedSecretKeys[entry.key];
                          const isKeyCopied = copiedSecretKey === `key-${entry.key}`;
                          const isValCopied = copiedSecretKey === `val-${entry.key}`;
                          const isB64Copied = copiedSecretKey === `b64-${entry.key}`;
                          const isMultiline = entry.value.includes('\n') || entry.value.length > 45;

                          return (
                            <div key={entry.key} className="p-3.5 flex flex-col gap-2 hover:bg-surface-elevated/40 transition-colors select-text">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                                <div className="flex items-center space-x-2 min-w-0 flex-wrap gap-y-1">
                                  <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span className="font-bold text-gray-200 text-xs truncate select-text">{entry.key}</span>
                                  {getSecretKeyTypeBadge(entry.key)}
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-elevated text-gray-400 shrink-0">
                                    {entry.value.length} bytes
                                  </span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(entry.key);
                                      setCopiedSecretKey(`key-${entry.key}`);
                                      setTimeout(() => setCopiedSecretKey(null), 2000);
                                    }}
                                    className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-surface-elevated transition-colors"
                                    title="Copy Key Name"
                                  >
                                    {isKeyCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>

                                <div className="flex items-center space-x-2 shrink-0">
                                  {isRevealed ? (
                                    <span className="text-amber-200 text-xs font-mono bg-amber-950/80 px-2.5 py-1 rounded border border-amber-800 select-all max-w-xs md:max-w-md truncate">
                                      {entry.value}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500 text-xs font-mono bg-[#0B0F17] px-2.5 py-1 rounded border border-border/40 tracking-widest select-none">
                                      ••••••••••••••••
                                    </span>
                                  )}

                                  {isMultiline && isRevealed && (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedSecretKeys((prev) => ({ ...prev, [entry.key]: !prev[entry.key] }))}
                                      className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border text-cyan-300 hover:text-white text-[11px] flex items-center space-x-1 transition-colors"
                                      title={isExpanded ? 'Collapse view' : 'Expand full decoded content'}
                                    >
                                      {isExpanded ? <ChevronDown className="w-3 h-3 text-cyan-400" /> : <ChevronRight className="w-3 h-3 text-cyan-400" />}
                                      <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                                    </button>
                                  )}

                                  <button
                                    onClick={() => toggleRevealSecret(entry.key)}
                                    className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border text-gray-300 hover:text-white text-[11px] flex items-center space-x-1 transition-colors"
                                    title={isRevealed ? 'Hide value' : 'Reveal plaintext value'}
                                  >
                                    {isRevealed ? <EyeOff className="w-3 h-3 text-gray-400" /> : <Eye className="w-3 h-3 text-amber-400" />}
                                    <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(entry.value);
                                      setCopiedSecretKey(`val-${entry.key}`);
                                      setTimeout(() => setCopiedSecretKey(null), 2000);
                                    }}
                                    className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border text-gray-300 hover:text-white text-[11px] flex items-center space-x-1 transition-colors"
                                    title="Copy Plaintext Value"
                                  >
                                    {isValCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                    <span>Copy</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(entry.base64);
                                      setCopiedSecretKey(`b64-${entry.key}`);
                                      setTimeout(() => setCopiedSecretKey(null), 2000);
                                    }}
                                    className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border text-gray-400 hover:text-gray-200 text-[11px] font-mono transition-colors"
                                    title="Copy Base64 Encoded Value"
                                  >
                                    {isB64Copied ? <Check className="w-3 h-3 text-emerald-400" /> : 'Base64'}
                                  </button>
                                </div>
                              </div>

                              {isExpanded && isRevealed && (
                                <div className="mt-1 p-3 rounded-lg bg-[#0B0F17] border border-border/70 font-mono text-xs overflow-x-auto space-y-2 select-text">
                                  <div className="flex items-center justify-between text-[11px] text-gray-400 pb-1 border-b border-border/40">
                                    <span className="font-semibold text-emerald-400 flex items-center space-x-1.5">
                                      <Code2 className="w-3 h-3" />
                                      <span>Decoded Content ({entry.key})</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(entry.value);
                                        setCopiedSecretKey(`val-${entry.key}`);
                                        setTimeout(() => setCopiedSecretKey(null), 2000);
                                      }}
                                      className="text-gray-400 hover:text-white flex items-center space-x-1 text-[11px]"
                                    >
                                      {isValCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                      <span>{isValCopied ? 'Copied' : 'Copy'}</span>
                                    </button>
                                  </div>
                                  <pre className="text-gray-200 whitespace-pre-wrap leading-relaxed select-text font-mono text-[11px] max-h-96 overflow-y-auto">
                                    {entry.value}
                                  </pre>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Edit Secret Modal */}
                  {isEditingSecret && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 md:p-6 animate-in fade-in duration-100 select-text">
                      <div className="bg-[#10141D] border border-border/90 rounded-2xl shadow-2xl max-w-5xl w-full h-[88vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-border bg-[#0B0F17] flex items-center justify-between shrink-0">
                          <div className="flex items-center space-x-3">
                            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                              <Key className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="text-sm font-bold text-gray-100 font-mono">
                                  Edit Secret: {currentResource.name}
                                </h3>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono">
                                  {editingSecretEntries.length} {editingSecretEntries.length === 1 ? 'entry' : 'entries'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400">
                                Modify values in plaintext (supports multi-line .env & configs, automatically base64-encoded on save)
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSecretEntries([...editingSecretEntries, { key: '', value: '' }]);
                              }}
                              className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 rounded-lg text-xs font-mono text-indigo-200 hover:text-white flex items-center space-x-1.5 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Key</span>
                            </button>
                            <button
                              onClick={() => setIsEditingSecret(false)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-hover transition-colors"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* Content Body */}
                        <div className="p-6 overflow-y-auto space-y-4 flex-1 font-mono text-xs custom-scrollbar">
                          {secretSaveError && (
                            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 flex items-center space-x-2.5 shrink-0">
                              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                              <span className="text-xs">{secretSaveError}</span>
                            </div>
                          )}

                          <div className="space-y-4">
                            {editingSecretEntries.map((entry, idx) => {
                              const lineCount = (entry.value || '').split('\n').length;
                              const byteCount = new TextEncoder().encode(entry.value || '').length;

                              return (
                                <div
                                  key={idx}
                                  className="bg-surface/90 rounded-xl border border-border/80 p-4 space-y-3 shadow-sm hover:border-border transition-colors"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1 flex items-center space-x-2 min-w-0">
                                      <Key className="w-4 h-4 text-amber-400 shrink-0" />
                                      <input
                                        type="text"
                                        value={entry.key}
                                        onChange={(e) => {
                                          const next = [...editingSecretEntries];
                                          next[idx].key = e.target.value;
                                          setEditingSecretEntries(next);
                                        }}
                                        placeholder="KEY_NAME (e.g. DATABASE_URL, .env)"
                                        className="w-full bg-[#0B0F17] border border-border rounded-lg px-3 py-1.5 text-xs text-amber-200 font-mono font-bold focus:outline-none focus:border-indigo-500 transition-colors"
                                      />
                                    </div>

                                    <div className="flex items-center space-x-2 shrink-0">
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-surface-elevated text-gray-400 border border-border/60">
                                        {lineCount} {lineCount === 1 ? 'line' : 'lines'} · {byteCount} bytes
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = editingSecretEntries.filter((_, i) => i !== idx);
                                          setEditingSecretEntries(next.length > 0 ? next : [{ key: '', value: '' }]);
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-red-950/60 text-gray-400 hover:text-red-400 transition-colors border border-transparent hover:border-red-800/40"
                                        title="Delete this key"
                                      >
                                        <Trash className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                                      <span className="uppercase tracking-wider font-semibold">Value (Plaintext Editor)</span>
                                      <span className="text-[10px] text-gray-500">Auto-encodes to base64</span>
                                    </div>
                                    <textarea
                                      rows={Math.min(16, Math.max(5, lineCount + 1))}
                                      value={entry.value}
                                      onChange={(e) => {
                                        const next = [...editingSecretEntries];
                                        next[idx].value = e.target.value;
                                        setEditingSecretEntries(next);
                                      }}
                                      placeholder="Enter plaintext value or multi-line secret content..."
                                      className="w-full min-h-[120px] bg-[#0B0F17] border border-border rounded-lg p-3 text-xs text-gray-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed resize-y selection:bg-indigo-600/40"
                                      spellCheck={false}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingSecretEntries([...editingSecretEntries, { key: '', value: '' }]);
                            }}
                            className="w-full py-3 bg-surface/60 hover:bg-surface-elevated border border-dashed border-border/80 hover:border-indigo-500/50 rounded-xl text-gray-300 hover:text-white flex items-center justify-center space-x-2 transition-all"
                          >
                            <Plus className="w-4 h-4 text-indigo-400" />
                            <span className="font-semibold">Add Another Key-Value Pair</span>
                          </button>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-border bg-[#0B0F17] flex items-center justify-between shrink-0">
                          <div className="text-xs text-gray-400 font-mono flex items-center space-x-2">
                            <Shield className="w-4 h-4 text-emerald-400" />
                            <span>Kubernetes Secret (v1/Secret)</span>
                          </div>

                          <div className="flex items-center space-x-3">
                            <button
                              type="button"
                              onClick={() => setIsEditingSecret(false)}
                              disabled={savingSecret}
                              className="px-4 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-surface-hover hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (isReadOnly) {
                                  setSecretSaveError('Cannot save changes in Read-Only Mode. Unlock write access.');
                                  return;
                                }
                                try {
                                  setSavingSecret(true);
                                  setSecretSaveError(null);
                                  const entriesMap: Record<string, string> = {};
                                  editingSecretEntries.forEach((e) => {
                                    if (e.key.trim()) {
                                      entriesMap[e.key.trim()] = e.value;
                                    }
                                  });
                                  const updated = await api.updateSecretData(
                                    currentResource.name,
                                    currentResource.namespace,
                                    entriesMap,
                                    true
                                  );
                                  setSecretDetails(updated);
                                  setIsEditingSecret(false);
                                } catch (err: any) {
                                  setSecretSaveError(err?.message || String(err));
                                } finally {
                                  setSavingSecret(false);
                                }
                              }}
                              disabled={savingSecret}
                              className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
                            >
                              {savingSecret ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Saving Secret…</span>
                                </>
                              ) : (
                                <span>Save Changes</span>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : ['configmap', 'configmaps'].includes(normalizedKind) ? (
                <div className="space-y-6">
                  {/* ConfigMap Header Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Data Entries</span>
                      <div className="text-xs font-bold font-mono text-blue-300">
                        {Object.keys(parsedData?.data || {}).length} keys
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Namespace</span>
                      <div className="text-xs font-bold font-mono text-indigo-300 truncate">
                        {activeNamespace}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Format</span>
                      <div className="text-xs font-bold font-mono text-cyan-300">
                        UTF-8 Configuration
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono flex items-center justify-between">
                        <span>Age</span>
                        <Clock className="w-3 h-3 text-cyan-400" />
                      </span>
                      <div className="text-xs font-bold font-mono text-cyan-300">
                        {creationInfo?.age || currentResource?.age || '—'}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono truncate" title={creationInfo?.full}>
                        {creationInfo?.formatted || 'Unknown'}
                      </div>
                    </div>
                  </div>

                  {/* ConfigMap Keys Explorer */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono flex items-center space-x-2">
                      <FileCode className="w-4 h-4 text-blue-400" />
                      <span>ConfigMap Data ({Object.keys(parsedData?.data || {}).length})</span>
                    </h3>

                    {Object.keys(parsedData?.data || {}).length === 0 ? (
                      <div className="p-4 rounded-xl bg-surface border border-border text-xs text-gray-400 font-mono">
                        No data keys contained in this configmap.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-border/80 bg-surface">
                        <table className="w-full text-left font-mono text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-border/80 bg-[#070A0F] text-[11px] text-gray-400 font-semibold uppercase tracking-wider select-none">
                              <th className="py-2.5 px-4 w-1/4">Key</th>
                              <th className="py-2.5 px-4">Value Preview</th>
                              <th className="py-2.5 px-4 w-28 text-right">Length</th>
                              <th className="py-2.5 px-3 w-20 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {Object.entries(parsedData?.data || {}).map(([key, val]) => {
                              const strVal = String(val || '');
                              const isMultiLine = strVal.includes('\n');
                              const isExpanded = expandedConfigMapKeys[key] ?? false;
                              const isCopied = copiedSecretKey === key;

                              return (
                                <tr key={key} className="hover:bg-surface-elevated/40 transition-colors">
                                  <td className="py-2.5 px-4 font-bold text-blue-300 align-top">
                                    <div className="flex items-center space-x-2">
                                      <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                      <span className="truncate max-w-[200px]" title={key}>{key}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-4 text-[11px] text-gray-200 align-top">
                                    {isMultiLine ? (
                                      <div className="space-y-1.5">
                                        <div className="flex items-center space-x-2">
                                          <button
                                            type="button"
                                            onClick={() => setExpandedConfigMapKeys((prev) => ({ ...prev, [key]: !isExpanded }))}
                                            className="text-[10px] text-blue-400 hover:text-blue-300 underline font-semibold"
                                          >
                                            {isExpanded ? '[- collapse]' : `[+ expand ${strVal.split('\n').length} lines]`}
                                          </button>
                                        </div>
                                        {isExpanded ? (
                                          <pre className="p-2.5 rounded-lg bg-[#0B0F17] border border-border/50 text-[11px] text-gray-200 overflow-x-auto whitespace-pre-wrap max-h-60">
                                            {strVal}
                                          </pre>
                                        ) : (
                                          <div className="text-gray-400 truncate max-w-md font-mono">
                                            {strVal.slice(0, 80)}...
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="select-text truncate block max-w-lg" title={strVal}>
                                        {strVal}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-4 text-right align-top">
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-surface-elevated text-gray-400 border border-border/60">
                                      {strVal.length} chars
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center align-top">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(strVal);
                                        setCopiedSecretKey(key);
                                        setTimeout(() => setCopiedSecretKey(null), 1500);
                                      }}
                                      className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-hover text-gray-300 hover:text-white text-[10px] inline-flex items-center space-x-1 border border-border"
                                      title="Copy value"
                                    >
                                      {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
                                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : isNode ? (
                <div className="space-y-6">
                  {/* 1. Node Capacity & Status Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-surface p-3.5 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Node Status</span>
                      <div className="flex items-center space-x-1.5 font-mono text-xs font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-300">
                          {conditions.find((c: any) => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady'}
                        </span>
                      </div>
                    </div>
                    <div className="bg-surface p-3.5 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Allocated Pods</span>
                      <div className="text-xs font-bold font-mono text-indigo-300">
                        {nodePods.length} / {parsedData?.status?.capacity?.pods || parsedData?.status?.allocatable?.pods || '110'} pods
                      </div>
                    </div>
                    <div className="bg-surface p-3.5 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">CPU Capacity</span>
                      <div className="text-xs font-bold font-mono text-amber-300 truncate">
                        {parsedData?.status?.capacity?.cpu || parsedData?.status?.allocatable?.cpu || '—'} cores ({parsedData?.status?.nodeInfo?.architecture || 'amd64'})
                      </div>
                    </div>
                    <div className="bg-surface p-3.5 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Memory Capacity</span>
                      <div className="text-xs font-bold font-mono text-emerald-300 truncate">
                        {parsedData?.status?.capacity?.memory || parsedData?.status?.allocatable?.memory || '—'}
                      </div>
                    </div>
                    <div className="bg-surface p-3.5 rounded-xl border border-border/80 space-y-1 col-span-2 md:col-span-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono flex items-center justify-between">
                        <span>Node Age</span>
                        <Clock className="w-3 h-3 text-cyan-400" />
                      </span>
                      <div className="text-xs font-bold font-mono text-cyan-300">
                        {creationInfo?.age || currentResource?.age || '—'}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono truncate" title={creationInfo?.full}>
                        {creationInfo?.formatted || 'Unknown'}
                      </div>
                    </div>
                  </div>

                  {/* 2. System & Hardware Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[10px] text-gray-500 uppercase">OS & Kernel</span>
                      <div className="text-gray-200 font-semibold truncate" title={parsedData?.status?.nodeInfo?.osImage}>
                        {parsedData?.status?.nodeInfo?.osImage || 'Linux'}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">
                        {parsedData?.status?.nodeInfo?.kernelVersion || '—'}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[10px] text-gray-500 uppercase">Container Runtime</span>
                      <div className="text-gray-200 font-semibold truncate" title={parsedData?.status?.nodeInfo?.containerRuntimeVersion}>
                        {parsedData?.status?.nodeInfo?.containerRuntimeVersion || 'containerd'}
                      </div>
                      <div className="text-[10px] text-indigo-400 truncate">
                        Kubelet: {parsedData?.status?.nodeInfo?.kubeletVersion || 'v1.30'}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[10px] text-gray-500 uppercase">Internal IP</span>
                      <div className="text-gray-200 font-semibold truncate">
                        {(parsedData?.status?.addresses || []).find((a: any) => a.type === 'InternalIP')?.address || '—'}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">
                        Hostname: {currentResource.name}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[10px] text-gray-500 uppercase">Instance Type & Zone</span>
                      <div className="text-amber-300 font-semibold truncate">
                        {parsedData?.metadata?.labels?.['node.kubernetes.io/instance-type'] || parsedData?.metadata?.labels?.['beta.kubernetes.io/instance-type'] || 'EC2 Instance'}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {parsedData?.metadata?.labels?.['topology.kubernetes.io/zone'] || 'us-east-1'}
                      </div>
                    </div>
                  </div>

                  {/* 3. Pods Running on this Node */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <Box className="w-4 h-4 text-indigo-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200 font-mono">
                          Pods Running on this Node ({filteredNodePods.length})
                        </h3>
                      </div>

                      <div className="relative w-64">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
                        <input
                          type="text"
                          value={nodePodFilter}
                          onChange={(e) => setNodePodFilter(e.target.value)}
                          placeholder="Filter pods or namespaces…"
                          className="w-full pl-8 pr-3 py-1 bg-surface border border-border rounded-lg text-xs text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>

                    {nodePodsLoading ? (
                      <div className="flex items-center justify-center py-12 bg-surface rounded-xl border border-border text-gray-400 space-x-2 text-xs font-mono">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                        <span>Loading pods scheduled on this node…</span>
                      </div>
                    ) : filteredNodePods.length === 0 ? (
                      <div className="bg-surface p-8 rounded-xl border border-border text-center text-xs text-gray-400 font-mono">
                        {nodePodFilter ? 'No pods match the filter criteria.' : 'No active pods scheduled on this node.'}
                      </div>
                    ) : (
                      <div className="bg-surface rounded-xl border border-border overflow-hidden">
                        <table className="w-full text-left font-mono text-xs">
                          <thead className="bg-[#0B0F17] border-b border-border/80 text-gray-400 text-[11px] uppercase">
                            <tr>
                              <th className="px-4 py-2.5 font-semibold">Pod Name</th>
                              <th className="px-4 py-2.5 font-semibold">Namespace</th>
                              <th className="px-4 py-2.5 font-semibold">Status</th>
                              <th className="px-4 py-2.5 font-semibold">Ready</th>
                              <th className="px-4 py-2.5 font-semibold">Restarts</th>
                              <th className="px-4 py-2.5 font-semibold">CPU</th>
                              <th className="px-4 py-2.5 font-semibold">Memory</th>
                              <th className="px-4 py-2.5 font-semibold">Age</th>
                              <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {filteredNodePods.map((pod, idx) => (
                              <tr key={idx} className="hover:bg-surface-elevated/40 transition-colors">
                                <td className="px-4 py-3 font-semibold text-gray-200">{pod.name}</td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px]">
                                    {pod.namespace}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center space-x-1.5">
                                    <span className={`w-2 h-2 rounded-full ${
                                      pod.status === 'Running' ? 'bg-emerald-400' : pod.status.includes('Completed') ? 'bg-blue-400' : 'bg-red-400'
                                    }`} />
                                    <span className={`text-[11px] font-semibold ${
                                      pod.status === 'Running' ? 'text-emerald-300' : 'text-amber-300'
                                    }`}>
                                      {pod.status}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-gray-300">{pod.ready_containers}</td>
                                <td className="px-4 py-3">
                                  <span className={pod.restarts > 0 ? 'text-amber-400 font-bold' : 'text-gray-400'}>
                                    {pod.restarts}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-300">
                                  <div
                                    className="flex flex-col cursor-help"
                                    title={pod.created_at ? `Created: ${new Date(pod.created_at).toLocaleString()}` : undefined}
                                  >
                                    <span className="text-[11px] font-mono text-gray-300">{pod.age}</span>
                                    {pod.created_at && (
                                      <span className="text-[10px] text-gray-500 font-mono">
                                        {new Date(pod.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => {
                                      setHistory((prev) => [...prev, currentResource]);
                                      setCurrentResource({
                                        kind: 'Pod',
                                        name: pod.name,
                                        namespace: pod.namespace,
                                      });
                                    }}
                                    className="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border text-brand-300 hover:text-brand-200 text-[11px] font-mono transition-colors"
                                  >
                                    Inspect
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* 4. Node Labels & Annotations */}
                  <MetadataLabelsAnnotations
                    labels={labels}
                    annotations={annotations}
                  />
                </div>
              ) : isCronJob ? (
                <div className="space-y-6">
                  {/* CronJob Overview Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Schedule</span>
                      <div className="text-xs font-bold font-mono text-cyan-300 truncate" title={parsedData?.spec?.schedule}>
                        {parsedData?.spec?.schedule || currentResource?.schedule || '—'}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Status</span>
                      <div className={`text-xs font-bold font-mono ${isSuspended ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {isSuspended ? '⏸ Suspended' : '▶ Active'}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Concurrency</span>
                      <div className="text-xs font-bold font-mono text-indigo-300">
                        {parsedData?.spec?.concurrencyPolicy || currentResource?.concurrencyPolicy || 'Allow'}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Active Jobs</span>
                      <div className="text-xs font-bold font-mono text-gray-200">
                        {parsedData?.status?.active ?? currentResource?.active ?? 0}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1 col-span-2">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Last Scheduled</span>
                      <div className="text-xs font-bold font-mono text-gray-200">
                        {parsedData?.status?.lastScheduleTime || currentResource?.lastScheduleTime
                          ? new Date(parsedData?.status?.lastScheduleTime || currentResource?.lastScheduleTime).toLocaleString()
                          : '—'}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Successful Limit</span>
                      <div className="text-xs font-bold font-mono text-gray-200">
                        {parsedData?.spec?.successfulJobsHistoryLimit ?? 3}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Failed Limit</span>
                      <div className="text-xs font-bold font-mono text-rose-300">
                        {parsedData?.spec?.failedJobsHistoryLimit ?? 1}
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions Banner */}
                  <div className="flex items-center space-x-3 p-3.5 rounded-xl bg-surface border border-border/60">
                    <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-200">Batch Actions</p>
                      <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                        Use <span className="text-emerald-400">Run Now</span> to trigger a manual job,{' '}
                        <span className="text-amber-400">{isSuspended ? 'Resume' : 'Suspend'}</span> to toggle the schedule, or{' '}
                        <span className="text-brand-400">Child Jobs</span> to drill down.
                      </p>
                    </div>
                    {!isReadOnly && onTriggerCronJob && (
                      <button
                        onClick={() => { onTriggerCronJob(currentResource); onClose(); }}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/40 text-emerald-300 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Run Now</span>
                      </button>
                    )}
                  </div>

                  {/* Labels & Annotations */}
                  <MetadataLabelsAnnotations labels={labels} annotations={annotations} />
                </div>
              ) : isJob ? (
                <div className="space-y-6">
                  {/* Job Overview Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Completions</span>
                      <div className="text-xs font-bold font-mono text-gray-200">
                        {parsedData?.status?.succeeded ?? 0} / {parsedData?.spec?.completions ?? currentResource?.completions ?? 1}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Status</span>
                      <div className={`text-xs font-bold font-mono ${
                        (parsedData?.status?.conditions || []).some((c: any) => c.type === 'Failed' && c.status === 'True')
                          ? 'text-rose-400'
                          : (parsedData?.status?.conditions || []).some((c: any) => c.type === 'Complete' && c.status === 'True')
                          ? 'text-emerald-400'
                          : isSuspended
                          ? 'text-amber-400'
                          : 'text-blue-400'
                      }`}>
                        {(parsedData?.status?.conditions || []).some((c: any) => c.type === 'Failed' && c.status === 'True')
                          ? '✗ Failed'
                          : (parsedData?.status?.conditions || []).some((c: any) => c.type === 'Complete' && c.status === 'True')
                          ? '✓ Completed'
                          : isSuspended
                          ? '⏸ Suspended'
                          : '⟳ Running'}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Parallelism</span>
                      <div className="text-xs font-bold font-mono text-indigo-300">
                        {parsedData?.spec?.parallelism ?? 1}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Duration</span>
                      <div className="text-xs font-bold font-mono text-cyan-300">
                        {currentResource?.duration || '—'}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1 col-span-2">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Start Time</span>
                      <div className="text-xs font-bold font-mono text-gray-200">
                        {parsedData?.status?.startTime
                          ? new Date(parsedData.status.startTime).toLocaleString()
                          : '—'}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1 col-span-2">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Completion Time</span>
                      <div className="text-xs font-bold font-mono text-gray-200">
                        {parsedData?.status?.completionTime
                          ? new Date(parsedData.status.completionTime).toLocaleString()
                          : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions Banner */}
                  <div className="flex items-center space-x-3 p-3.5 rounded-xl bg-surface border border-border/60">
                    <Briefcase className="w-4 h-4 text-brand-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-200">Batch Actions</p>
                      <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                        Use <span className="text-brand-400">Rerun</span> to re-create this job,{' '}
                        <span className="text-amber-400">{isSuspended ? 'Resume' : 'Suspend'}</span> to toggle execution, or{' '}
                        <span className="text-cyan-400">Pods</span> to inspect associated pods.
                      </p>
                    </div>
                    {!isReadOnly && onRerunJob && (
                      <button
                        onClick={() => { onRerunJob(currentResource); onClose(); }}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 border border-brand-600/40 text-brand-300 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Rerun</span>
                      </button>
                    )}
                  </div>

                  {/* Job Conditions */}
                  {(parsedData?.status?.conditions || []).length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono flex items-center space-x-2">
                        <Activity className="w-4 h-4 text-blue-400" />
                        <span>Conditions</span>
                      </h3>
                      <div className="space-y-1">
                        {(parsedData?.status?.conditions || []).map((cond: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface border border-border/60 text-xs font-mono">
                            <span className={cond.status === 'True' ? 'text-emerald-400' : 'text-gray-400'}>{cond.type}</span>
                            <span className="text-gray-500">{cond.reason}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              cond.status === 'True' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-500/15 text-gray-400'
                            }`}>{cond.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Labels & Annotations */}
                  <MetadataLabelsAnnotations labels={labels} annotations={annotations} />
                </div>
              ) : isPodOrWorkload && containers.length > 0 ? (
                <div className="space-y-6">
                  {/* 1. Quick Pod / Workload Specs & Lifecycle Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
                    {/* Card 1: QoS Class */}
                    <div className="bg-[#0B0F17] p-4 rounded-xl border border-border/80 shadow-sm flex flex-col justify-between space-y-2">
                      <span className="text-[11px] text-gray-400 uppercase font-mono font-semibold tracking-wider flex items-center space-x-1.5">
                        <Shield className="w-3.5 h-3.5 text-indigo-400" />
                        <span>QoS Class</span>
                      </span>
                      <div className={`text-sm font-bold font-mono ${
                        workloadResources.qosClass === 'Guaranteed'
                          ? 'text-emerald-300'
                          : workloadResources.qosClass === 'Burstable'
                          ? 'text-cyan-300'
                          : 'text-amber-300'
                      }`}>
                        {status?.qosClass || workloadResources.qosClass}
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">Resource quality tier</span>
                    </div>

                    {/* Card 2: Node Placement (for Pods) OR Replicas (for Workloads) */}
                    {['pod', 'pods'].includes(normalizedKind) ? (
                      <div className="bg-[#0B0F17] p-4 rounded-xl border border-border/80 shadow-sm flex flex-col justify-between space-y-2">
                        <span className="text-[11px] text-gray-400 uppercase font-mono font-semibold tracking-wider flex items-center space-x-1.5">
                          <HardDrive className="w-3.5 h-3.5 text-brand-400" />
                          <span>Node Placement</span>
                        </span>
                        {spec?.nodeName ? (
                          <div className="flex items-center justify-between gap-1">
                            <button
                              onClick={() => handleNavigateTo('Node', spec.nodeName)}
                              className="text-xs font-bold font-mono text-brand-300 hover:text-brand-200 hover:underline flex items-center space-x-1 truncate max-w-[170px]"
                              title={`Inspect Node ${spec.nodeName}`}
                            >
                              <span className="truncate">{spec.nodeName}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(spec.nodeName);
                              }}
                              className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-surface-elevated transition-colors"
                              title="Copy Node Name"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs font-bold font-mono text-gray-400">Unassigned</div>
                        )}
                        <span className="text-[10px] text-gray-500 font-mono truncate">{spec?.nodeName || 'Pending scheduler'}</span>
                      </div>
                    ) : (
                      <div className="bg-[#0B0F17] p-4 rounded-xl border border-border/80 shadow-sm flex flex-col justify-between space-y-2">
                        <span className="text-[11px] text-gray-400 uppercase font-mono font-semibold tracking-wider flex items-center space-x-1.5">
                          <Layers className="w-3.5 h-3.5 text-brand-400" />
                          <span>Replicas & Rollout</span>
                        </span>
                        <div className="text-xs font-bold font-mono text-brand-300">
                          {status?.readyReplicas ?? status?.replicas ?? (currentResource?.ready || 1)} / {parsedData?.spec?.replicas ?? 1} Ready
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono truncate">
                          Strategy: {parsedData?.spec?.strategy?.type || 'RollingUpdate'}
                        </span>
                      </div>
                    )}

                    {/* Card 3: IP Address (for Pods) OR Pod Allocation (for Workloads) */}
                    {['pod', 'pods'].includes(normalizedKind) ? (
                      <div className="bg-[#0B0F17] p-4 rounded-xl border border-border/80 shadow-sm flex flex-col justify-between space-y-2">
                        <span className="text-[11px] text-gray-400 uppercase font-mono font-semibold tracking-wider flex items-center space-x-1.5">
                          <Radio className="w-3.5 h-3.5 text-emerald-400" />
                          <span>IP Address</span>
                        </span>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold font-mono text-emerald-400">
                            {status?.podIP || 'Pending'}
                          </span>
                          {status?.podIP && (
                            <button
                              onClick={() => navigator.clipboard.writeText(status.podIP)}
                              className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-surface-elevated transition-colors"
                              title="Copy Pod IP"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono">Host: {status?.hostIP || '—'}</span>
                      </div>
                    ) : (
                      <div className="bg-[#0B0F17] p-4 rounded-xl border border-border/80 shadow-sm flex flex-col justify-between space-y-2">
                        <span className="text-[11px] text-gray-400 uppercase font-mono font-semibold tracking-wider flex items-center space-x-1.5">
                          <Cpu className="w-3.5 h-3.5 text-pink-400" />
                          <span>Pod Allocation</span>
                        </span>
                        <div className="text-xs font-bold font-mono text-gray-200">
                          CPU: <span className="text-emerald-400">{workloadResources.totalCpuRequestFormatted}</span> / <span className={!workloadResources.hasUncappedCpuLimit ? 'text-cyan-400' : 'text-amber-400'}>{workloadResources.totalCpuLimitFormatted}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">
                          Mem: <span className="text-emerald-400">{workloadResources.totalMemoryRequestFormatted}</span> / <span className={!workloadResources.hasUncappedMemoryLimit ? 'text-cyan-400' : 'text-amber-400'}>{workloadResources.totalMemoryLimitFormatted}</span>
                        </span>
                      </div>
                    )}

                    {/* Card 4: Service Account (for Pods) OR Cluster Footprint (for Workloads) */}
                    {['pod', 'pods'].includes(normalizedKind) ? (
                      <div className="bg-[#0B0F17] p-4 rounded-xl border border-border/80 shadow-sm flex flex-col justify-between space-y-2">
                        <span className="text-[11px] text-gray-400 uppercase font-mono font-semibold tracking-wider flex items-center space-x-1.5">
                          <Key className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Service Account</span>
                        </span>
                        {spec?.serviceAccountName ? (
                          <button
                            onClick={() => handleNavigateTo('ServiceAccount', spec.serviceAccountName, activeNamespace)}
                            className="text-xs font-mono font-bold text-cyan-400 hover:text-cyan-300 hover:underline flex items-center space-x-1 transition-colors text-left truncate"
                            title={`Inspect ServiceAccount ${spec.serviceAccountName}`}
                          >
                            <span className="truncate">{spec.serviceAccountName}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </button>
                        ) : (
                          <span className="text-xs font-mono text-gray-500">default</span>
                        )}
                        <span className="text-[10px] text-gray-500 font-mono">RBAC identity</span>
                      </div>
                    ) : (
                      <div className="bg-[#0B0F17] p-4 rounded-xl border border-border/80 shadow-sm flex flex-col justify-between space-y-2">
                        <span className="text-[11px] text-gray-400 uppercase font-mono font-semibold tracking-wider flex items-center space-x-1.5">
                          <Database className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Cluster Footprint</span>
                        </span>
                        <div className="text-xs font-bold font-mono text-cyan-300">
                          CPU: {workloadResources.scaledCpuRequestFormatted} / {workloadResources.scaledCpuLimitFormatted}
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">
                          Mem: {workloadResources.scaledMemoryRequestFormatted} / {workloadResources.scaledMemoryLimitFormatted} ({workloadResources.replicas} pods)
                        </span>
                      </div>
                    )}

                    {/* Card 5: Age & Uptime */}
                    <div className="bg-[#0B0F17] p-4 rounded-xl border border-border/80 shadow-sm flex flex-col justify-between space-y-2 col-span-1 sm:col-span-2 lg:col-span-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono font-semibold tracking-wider flex items-center justify-between">
                        <span className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Age & Uptime</span>
                        </span>
                      </span>
                      <div className="text-xs font-bold font-mono text-cyan-300">
                        {creationInfo?.age || currentResource?.age || '—'}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono truncate" title={creationInfo?.full}>
                        {creationInfo?.formatted || 'Unknown'}
                      </div>
                    </div>
                  </div>

                  {/* Recent Lifecycle Events Preview Banner */}
                  {resourceEvents.length > 0 && (
                    <div className="p-4 rounded-xl bg-[#0B0F17] border border-border/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Bell className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold font-mono text-gray-200">
                            Recent Lifecycle Events ({resourceEvents.length})
                          </span>
                          {warningEventsCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-950/80 text-rose-300 border border-rose-800 animate-pulse">
                              {warningEventsCount} Warning{warningEventsCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setActiveTab('events')}
                          className="text-xs font-mono text-amber-400 hover:text-amber-300 hover:underline flex items-center space-x-1 transition-colors"
                        >
                          <span>View all in Events tab</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="divide-y divide-border/40 font-mono text-xs">
                        {resourceEvents.slice(0, 3).map((evt, idx) => {
                          const isWarning = (evt.type || evt.eventType || '').toLowerCase() === 'warning';
                          return (
                            <div key={idx} className="py-2 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center space-x-2 min-w-0">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                    isWarning
                                      ? 'bg-rose-950/70 text-rose-300 border-rose-800'
                                      : 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                                  }`}
                                >
                                  {evt.type || evt.eventType || 'Normal'}
                                </span>
                                <span className="font-bold text-gray-200">{evt.reason}</span>
                                <span className="text-gray-400 text-[11px] truncate max-w-md select-text">
                                  {evt.message}
                                </span>
                              </div>
                              <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                {evt.age || 'just now'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

              {/* 2. Containers Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono flex items-center space-x-2">
                    <Box className="w-4 h-4 text-brand-400" />
                    <span>App Containers ({containers.length})</span>
                  </h3>

                  {containers.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          const allExpanded = containers.every((c) => expandedContainers[c.name] !== false);
                          const nextState: Record<string, boolean> = {};
                          const nextEnvState: Record<string, boolean> = {};
                          const nextMountState: Record<string, boolean> = {};
                          containers.forEach((c) => {
                            nextState[c.name] = !allExpanded;
                            nextEnvState[c.name] = !allExpanded;
                            nextMountState[c.name] = !allExpanded;
                          });
                          setExpandedContainers(nextState);
                          setExpandedEnv(nextEnvState);
                          setExpandedMounts(nextMountState);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-[11px] font-mono text-gray-300 hover:text-white transition-colors flex items-center space-x-1.5"
                      >
                        <ChevronsUpDown className="w-3.5 h-3.5 text-brand-400" />
                        <span>Toggle All</span>
                      </button>
                    </div>
                  )}
                </div>

                {containers.length === 0 ? (
                  <div className="p-4 rounded-xl bg-surface border border-border text-xs text-gray-400">
                    {parsedData?.data ? (
                      <div className="space-y-2">
                        <span className="text-gray-300 font-semibold font-mono block">Resource Data Entries ({Object.keys(parsedData.data).length}):</span>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.keys(parsedData.data).map((key) => (
                            <span key={key} className="px-2 py-1 rounded bg-surface-elevated border border-border text-gray-200 font-mono text-xs">
                              {key}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      'No container specs found for this resource.'
                    )}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border/80 bg-surface shadow-sm">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border/80 bg-[#070A0F] text-[11px] text-gray-400 font-semibold uppercase tracking-wider select-none">
                          <th className="py-2.5 px-3 w-8 text-center"></th>
                          <th className="py-2.5 px-3">Container</th>
                          <th className="py-2.5 px-3 w-28">State</th>
                          <th className="py-2.5 px-3 w-24 text-center">Restarts</th>
                          <th className="py-2.5 px-3 w-44">Last Exit Code</th>
                          <th className="py-2.5 px-3 w-32">Last Restart</th>
                          <th className="py-2.5 px-3">Image</th>
                          <th className="py-2.5 px-3 w-36 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {containers.map((c, idx) => {
                          const cName = c.name || `container-${idx}`;
                          const cStatus = containerStatuses.find((s) => s.name === c.name);
                          const isReady = cStatus?.ready ?? true;
                          const stateObj = cStatus?.state || {};
                          const stateKey = Object.keys(stateObj)[0] || 'running';
                          const restarts = cStatus?.restartCount ?? 0;

                          // Termination diagnostics
                          const termState = cStatus?.lastState?.terminated || cStatus?.state?.terminated;
                          const lastExitCode = termState?.exitCode;
                          const lastReason = termState?.reason;
                          const lastRestartTime = termState?.finishedAt;
                          const startedTime = termState?.startedAt;
                          const uptimeStr = formatDuration(startedTime, lastRestartTime);
                          const relativeRestartTime = formatRelativeTime(lastRestartTime);
                          const diag = getExitCodeDiagnostics(
                            lastExitCode,
                            lastReason || (restarts > 0 ? (stateObj as any)?.waiting?.reason || 'Restarted' : null)
                          );

                          const parsedC = workloadResources.containers.find((ct) => ct.name === c.name);
                          const cpuReqStr = parsedC?.cpuRequestFormatted || c.resources?.requests?.cpu || 'None';
                          const cpuLimStr = parsedC?.cpuLimitFormatted || c.resources?.limits?.cpu || 'Uncapped';
                          const memReqStr = parsedC?.memRequestFormatted || c.resources?.requests?.memory || 'None';
                          const memLimStr = parsedC?.memLimitFormatted || c.resources?.limits?.memory || 'Uncapped';
                          const hasCpuLim = parsedC?.hasCpuLimit ?? (c.resources?.limits?.cpu !== undefined);
                          const hasMemLim = parsedC?.hasMemLimit ?? (c.resources?.limits?.memory !== undefined);

                          const isContainerOpen = expandedContainers[cName] !== false;
                          const envCount = (c.env?.length || 0) + (c.envFrom?.length || 0);
                          const mountsCount = c.volumeMounts?.length || 0;

                          const isEnvOpen = expandedEnv[cName] ?? false;
                          const isMountsOpen = expandedMounts[cName] ?? false;
                          const envFilterQuery = (envFilters[cName] || '').toLowerCase();

                          // Filtered environment variables
                          const filteredEnv = (c.env || []).filter((e: any) => {
                            if (!envFilterQuery) return true;
                            const nameMatch = (e.name || '').toLowerCase().includes(envFilterQuery);
                            const valMatch = (e.value !== undefined ? String(e.value) : '').toLowerCase().includes(envFilterQuery);
                            return nameMatch || valMatch;
                          });

                          const prevLogsContent = previousLogs[cName];
                          const prevLogsLoading = previousLogsLoading[cName] ?? false;
                          const prevLogsErr = previousLogsError[cName] ?? null;
                          const prevLogsFilterQuery = (previousLogsFilter[cName] || '').toLowerCase();
                          const isPrevLogsCopied = copiedPreviousLogs[cName] ?? false;

                          // Filtered previous log lines
                          const filteredPreviousLogLines = (prevLogsContent || '')
                            .split('\n')
                            .filter((l) => !prevLogsFilterQuery || l.toLowerCase().includes(prevLogsFilterQuery));

                          // Exit code badge styling
                          let badgeBg = 'bg-surface-elevated text-gray-400 border-border';
                          if (diag.severity === 'critical') {
                            badgeBg = 'bg-rose-950/80 text-rose-300 border-rose-800 font-semibold';
                          } else if (diag.severity === 'error') {
                            badgeBg = 'bg-red-950/80 text-red-300 border-red-800 font-semibold';
                          } else if (diag.severity === 'warning') {
                            badgeBg = 'bg-amber-950/80 text-amber-300 border-amber-800 font-semibold';
                          } else if (diag.severity === 'success') {
                            badgeBg = 'bg-emerald-950/80 text-emerald-300 border-emerald-800 font-semibold';
                          }

                          return (
                            <React.Fragment key={cName}>
                              {/* Main Container Summary Row */}
                              <tr
                                onClick={() => setExpandedContainers((prev) => ({ ...prev, [cName]: !isContainerOpen }))}
                                className={`hover:bg-surface-elevated/40 transition-colors cursor-pointer select-none ${
                                  isContainerOpen ? 'bg-surface-elevated/20' : ''
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center align-middle">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedContainers((prev) => ({ ...prev, [cName]: !isContainerOpen }));
                                    }}
                                    className="p-1 rounded text-gray-400 hover:text-white transition-colors"
                                  >
                                    {isContainerOpen ? (
                                      <ChevronDown className="w-4 h-4 text-brand-400" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-gray-400" />
                                    )}
                                  </button>
                                </td>
                                <td className="py-2.5 px-3 align-middle font-bold text-gray-100">
                                  <div className="flex items-center space-x-2">
                                    <div
                                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                        isReady
                                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                                          : 'bg-amber-400'
                                      }`}
                                    />
                                    <span className="truncate max-w-[160px]" title={c.name}>{c.name}</span>
                                    <span
                                      className={`text-[10px] px-1.5 py-0.2 rounded-full border ${
                                        isReady
                                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                                          : 'bg-amber-950/60 text-amber-300 border-amber-800'
                                      }`}
                                    >
                                      {isReady ? 'Ready' : 'Not Ready'}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 align-middle">
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-elevated text-indigo-300 border border-border">
                                    {stateKey}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 align-middle text-center">
                                  {restarts > 0 ? (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700">
                                      {restarts}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500 text-[11px]">0</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 align-middle">
                                  {diag.code !== null ? (
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center space-x-1 ${badgeBg}`}
                                      title={diag.description}
                                    >
                                      <span>{diag.shortLabel}</span>
                                    </span>
                                  ) : (
                                    <span className="text-gray-600 text-[11px]">—</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 align-middle text-[11px] text-gray-300">
                                  {lastRestartTime ? (
                                    <span title={lastRestartTime} className="truncate block">
                                      {relativeRestartTime}
                                    </span>
                                  ) : (
                                    <span className="text-gray-600">—</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 align-middle">
                                  <div className="flex items-center space-x-1 text-cyan-300 text-[11px] max-w-[180px]">
                                    <span className="truncate" title={c.image}>{c.image}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(c.image);
                                      }}
                                      className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors shrink-0"
                                      title="Copy Image URL"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 align-middle text-right">
                                  <div className="inline-flex items-center space-x-1.5">
                                    {hasLogs && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onLogs) {
                                            onLogs({
                                              kind: currentResource?.kind || 'Pod',
                                              name: currentResource?.name,
                                              namespace: activeNamespace,
                                              container: c.name,
                                              previous: restarts > 0,
                                              tailLines: 1000,
                                            });
                                          }
                                        }}
                                        className="px-2 py-1 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-[11px] text-gray-300 hover:text-white flex items-center space-x-1 transition-colors"
                                        title="Open live or previous logs for this container"
                                      >
                                        <FileText className="w-3 h-3 text-brand-400" />
                                        <span>Logs</span>
                                      </button>
                                    )}
                                    {hasExec && onExec && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onExec({ name: currentResource.name, namespace: activeNamespace }, c.name);
                                          onClose();
                                        }}
                                        disabled={isReadOnly}
                                        className={`px-2 py-1 rounded-lg bg-teal-950/80 hover:bg-teal-900 border border-teal-700/80 text-teal-300 hover:text-teal-100 text-[11px] font-semibold transition-all flex items-center space-x-1 ${
                                          isReadOnly ? 'opacity-40 cursor-not-allowed' : ''
                                        }`}
                                        title={`Open SSH / Exec shell in ${c.name}`}
                                      >
                                        <Terminal className="w-3 h-3 text-teal-400" />
                                        <span>SSH</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>

                              {/* Collapsible Container Body Drawer */}
                              {isContainerOpen && (
                                <tr className="bg-[#070A0F]/80">
                                  <td colSpan={8} className="p-4 space-y-4 border-b border-border/80">
                                    {/* Last Restart & Crash Diagnostics Card (if restarts > 0 or termState) */}
                                    {(restarts > 0 || termState) && (
                                      <div className="rounded-xl border border-rose-800/60 bg-rose-950/20 p-4 space-y-3 font-mono">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-800/40 pb-2.5">
                                          <div className="flex items-center space-x-2">
                                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                                            <span className="text-xs font-bold text-rose-200">
                                              Last Restart & Crash Diagnostics
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeBg}`}>
                                              {diag.shortLabel}
                                            </span>
                                          </div>
                                          <div className="flex items-center space-x-3 text-[11px] text-gray-400">
                                            {lastRestartTime && (
                                              <span>
                                                Last terminated: <strong className="text-rose-300">{relativeRestartTime}</strong> ({lastRestartTime})
                                              </span>
                                            )}
                                            {uptimeStr && (
                                              <span className="text-gray-400">
                                                · Uptime before termination: <strong className="text-gray-200">{uptimeStr}</strong>
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Explanation & Fix Recommendation */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                          <div className="p-2.5 rounded-lg bg-black/40 border border-border/40 space-y-1">
                                            <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
                                              Root Cause Analysis
                                            </span>
                                            <p className="text-gray-200 text-[11px] leading-relaxed">
                                              {diag.description}
                                            </p>
                                            {diag.code === 137 && (
                                              <p className="text-[11px] text-rose-300 pt-1">
                                                Killed by Linux OOM killer due to memory limit reached ({memLimStr}).
                                              </p>
                                            )}
                                          </div>
                                          <div className="p-2.5 rounded-lg bg-black/40 border border-border/40 space-y-1">
                                            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                                              Recommended Fix
                                            </span>
                                            <p className="text-gray-200 text-[11px] leading-relaxed">
                                              {diag.recommendation}
                                            </p>
                                          </div>
                                        </div>

                                        {termState?.message && (
                                          <div className="text-xs font-mono bg-black/50 p-2.5 rounded-lg border border-rose-900/50 text-rose-300 whitespace-pre-wrap">
                                            <span className="text-[10px] text-gray-500 block uppercase mb-1">Termination Message</span>
                                            {termState.message}
                                          </div>
                                        )}

                                        {/* Previous Container Logs (Last 1,000 Lines) */}
                                        <div className="rounded-xl border border-border/80 bg-[#0B0F17] overflow-hidden space-y-2 p-3">
                                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="flex items-center space-x-2">
                                              <Terminal className="w-4 h-4 text-cyan-400" />
                                              <span className="text-xs font-bold text-gray-200">
                                                Previous Container Logs (Last 1,000 Lines)
                                              </span>
                                              {prevLogsContent && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800">
                                                  {filteredPreviousLogLines.length} lines
                                                </span>
                                              )}
                                            </div>

                                            <div className="flex items-center space-x-2">
                                              {!prevLogsContent && !prevLogsLoading && (
                                                <button
                                                  type="button"
                                                  onClick={() => fetchPreviousLogs(cName)}
                                                  className="px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700 text-cyan-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
                                                >
                                                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                                                  <span>Fetch Previous Logs (tail 1,000 lines)</span>
                                                </button>
                                              )}

                                              {prevLogsContent && (
                                                <>
                                                  {/* Filter input */}
                                                  <div className="relative">
                                                    <Search className="w-3 h-3 text-gray-500 absolute left-2 top-2" />
                                                    <input
                                                      type="text"
                                                      value={previousLogsFilter[cName] || ''}
                                                      onChange={(e) =>
                                                        setPreviousLogsFilter((prev) => ({
                                                          ...prev,
                                                          [cName]: e.target.value,
                                                        }))
                                                      }
                                                      placeholder="Search logs..."
                                                      className="pl-7 pr-2 py-1 bg-surface border border-border rounded-md text-[11px] text-gray-200 placeholder-gray-500 outline-none w-36 sm:w-44 focus:border-cyan-500"
                                                    />
                                                  </div>

                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      navigator.clipboard.writeText(prevLogsContent);
                                                      setCopiedPreviousLogs((prev) => ({ ...prev, [cName]: true }));
                                                      setTimeout(() => {
                                                        setCopiedPreviousLogs((prev) => ({ ...prev, [cName]: false }));
                                                      }, 1500);
                                                    }}
                                                    className="px-2.5 py-1 rounded-md bg-surface-elevated hover:bg-surface-hover border border-border text-[11px] text-gray-300 hover:text-white flex items-center space-x-1 transition-colors"
                                                    title="Copy previous logs"
                                                  >
                                                    {isPrevLogsCopied ? (
                                                      <Check className="w-3 h-3 text-emerald-400" />
                                                    ) : (
                                                      <Copy className="w-3 h-3 text-gray-400" />
                                                    )}
                                                    <span>{isPrevLogsCopied ? 'Copied' : 'Copy'}</span>
                                                  </button>

                                                  {hasLogs && onLogs && (
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        onLogs({
                                                          kind: currentResource?.kind || 'Pod',
                                                          name: currentResource?.name,
                                                          namespace: activeNamespace,
                                                          container: c.name,
                                                          previous: true,
                                                          tailLines: 1000,
                                                        });
                                                      }}
                                                      className="px-2.5 py-1 rounded-md bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700 text-indigo-200 text-[11px] flex items-center space-x-1 transition-colors"
                                                      title="Open previous logs in the bottom full logs panel"
                                                    >
                                                      <ExternalLink className="w-3 h-3 text-indigo-400" />
                                                      <span>Open in Logs Panel</span>
                                                    </button>
                                                  )}

                                                  <button
                                                    type="button"
                                                    onClick={() => fetchPreviousLogs(cName)}
                                                    className="p-1 rounded-md bg-surface-elevated hover:bg-surface-hover text-gray-400 hover:text-white transition-colors"
                                                    title="Re-fetch previous logs"
                                                  >
                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          </div>

                                          {prevLogsLoading && (
                                            <div className="py-6 flex items-center justify-center space-x-2 text-cyan-400 text-xs font-mono">
                                              <Loader2 className="w-4 h-4 animate-spin" />
                                              <span>Fetching previous container logs (last 1,000 lines)...</span>
                                            </div>
                                          )}

                                          {prevLogsErr && (
                                            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs font-mono">
                                              {prevLogsErr}
                                            </div>
                                          )}

                                          {prevLogsContent && !prevLogsLoading && (
                                            <pre className="p-3 rounded-lg bg-[#04060A] border border-border/40 text-[11px] text-gray-300 overflow-x-auto overflow-y-auto whitespace-pre font-mono max-h-64 select-text leading-relaxed">
                                              {filteredPreviousLogLines.join('\n') || 'No log lines matched the search filter.'}
                                            </pre>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Ports & Resources Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                                      {/* Ports */}
                                      <div className="p-3.5 rounded-xl bg-[#070A0F] border border-border/60 space-y-2">
                                        <span className="text-[11px] text-gray-400 font-semibold flex items-center space-x-1.5">
                                          <Network className="w-3.5 h-3.5 text-brand-400" />
                                          <span>Exposed Ports ({c.ports?.length || 0})</span>
                                        </span>
                                        {c.ports && c.ports.length > 0 ? (
                                          <div className="flex flex-wrap gap-1.5 pt-1">
                                            {c.ports.map((p: any, pIdx: number) => (
                                              <span
                                                key={pIdx}
                                                className="px-2.5 py-1 rounded-lg bg-surface border border-border/80 text-emerald-300 text-[11px] font-semibold flex items-center space-x-1"
                                              >
                                                <span>{p.containerPort}/{p.protocol || 'TCP'}</span>
                                                {p.name && <span className="text-gray-400 font-normal">({p.name})</span>}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-gray-500 text-[11px] block pt-1">No ports explicitly configured</span>
                                        )}
                                      </div>

                                      {/* Resources */}
                                      <div className="p-3.5 rounded-xl bg-[#070A0F] border border-border/60 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[11px] text-gray-400 font-semibold flex items-center space-x-1.5">
                                            <Cpu className="w-3.5 h-3.5 text-pink-400" />
                                            <span>Resources (Requests / Limits)</span>
                                          </span>
                                          {!hasCpuLim && !hasMemLim && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/80 font-mono">
                                              Unconstrained
                                            </span>
                                          )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-[11px] pt-1">
                                          <div className="bg-surface/50 p-2 rounded-lg border border-border/50">
                                            <span className="text-gray-500 block text-[10px] uppercase">CPU</span>
                                            <span className="text-gray-200 font-semibold font-mono">
                                              <span className="text-emerald-400">{cpuReqStr}</span>
                                              <span className="text-gray-500 mx-1">/</span>
                                              <span className={hasCpuLim ? 'text-cyan-400' : 'text-amber-400'}>{cpuLimStr}</span>
                                            </span>
                                          </div>
                                          <div className="bg-surface/50 p-2 rounded-lg border border-border/50">
                                            <span className="text-gray-500 block text-[10px] uppercase">Memory</span>
                                            <span className="text-gray-200 font-semibold font-mono">
                                              <span className="text-emerald-400">{memReqStr}</span>
                                              <span className="text-gray-500 mx-1">/</span>
                                              <span className={hasMemLim ? 'text-cyan-400' : 'text-amber-400'}>{memLimStr}</span>
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Environment Variables Table */}
                                    {envCount > 0 && (
                                      <div className="p-3.5 rounded-xl bg-[#070A0F] border border-border/60 space-y-3">
                                        <div className="flex items-center justify-between">
                                          <button
                                            type="button"
                                            onClick={() => setExpandedEnv((prev) => ({ ...prev, [cName]: !isEnvOpen }))}
                                            className="text-xs font-bold text-gray-300 font-mono flex items-center space-x-1.5 hover:text-white transition-colors"
                                          >
                                            {isEnvOpen ? <ChevronDown className="w-3.5 h-3.5 text-brand-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                            <span>Environment Variables ({envCount})</span>
                                          </button>
                                        </div>

                                        {isEnvOpen && (
                                          <div className="space-y-2 pt-1">
                                            {c.envFrom && c.envFrom.length > 0 && (
                                              <div className="flex flex-wrap gap-2 pb-1">
                                                {c.envFrom.map((ef: any, efIdx: number) => {
                                                  if (ef.configMapRef) {
                                                    return (
                                                      <button
                                                        key={efIdx}
                                                        type="button"
                                                        onClick={() => handleNavigateTo('ConfigMap', ef.configMapRef.name, activeNamespace)}
                                                        className="px-2.5 py-1 rounded-lg bg-blue-950/40 hover:bg-blue-950/70 border border-blue-800/60 text-blue-300 text-xs font-mono flex items-center space-x-1.5 transition-colors"
                                                      >
                                                        <FileCode className="w-3 h-3" />
                                                        <span>ConfigMap: {ef.configMapRef.name}</span>
                                                        <ExternalLink className="w-2.5 h-2.5 text-blue-400 ml-0.5" />
                                                      </button>
                                                    );
                                                  }
                                                  if (ef.secretRef) {
                                                    return (
                                                      <button
                                                        key={efIdx}
                                                        type="button"
                                                        onClick={() => handleNavigateTo('Secret', ef.secretRef.name, activeNamespace)}
                                                        className="px-2.5 py-1 rounded-lg bg-amber-950/40 hover:bg-amber-950/70 border border-amber-800/60 text-amber-300 text-xs font-mono flex items-center space-x-1.5 transition-colors"
                                                      >
                                                        <Key className="w-3 h-3" />
                                                        <span>Secret: {ef.secretRef.name}</span>
                                                        <ExternalLink className="w-2.5 h-2.5 text-amber-400 ml-0.5" />
                                                      </button>
                                                    );
                                                  }
                                                  return null;
                                                })}
                                              </div>
                                            )}

                                            <input
                                              type="text"
                                              value={envFilters[cName] || ''}
                                              onChange={(e) => setEnvFilters((prev) => ({ ...prev, [cName]: e.target.value }))}
                                              placeholder="Filter environment variables..."
                                              className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-gray-200 font-mono placeholder-gray-500 outline-none focus:border-brand-500"
                                            />
                                            <div className="overflow-hidden rounded-lg border border-border/60 bg-surface">
                                              <table className="w-full text-left font-mono text-xs border-collapse">
                                                <thead>
                                                  <tr className="border-b border-border/60 bg-[#0B0F17] text-[10px] text-gray-400 uppercase">
                                                    <th className="py-2 px-3">Name</th>
                                                    <th className="py-2 px-3">Value</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border/40">
                                                  {filteredEnv.map((e: any, eIdx: number) => (
                                                    <tr key={eIdx} className="hover:bg-surface-elevated/40">
                                                      <td className="py-2 px-3 font-semibold text-indigo-300 w-1/3">
                                                        {e.name}
                                                      </td>
                                                      <td className="py-2 px-3 text-gray-300 select-text">
                                                        {e.value !== undefined ? (
                                                          <span className="truncate block max-w-md" title={e.value}>
                                                            {e.value}
                                                          </span>
                                                        ) : e.valueFrom?.secretKeyRef ? (
                                                          <button
                                                            type="button"
                                                            onClick={() => handleNavigateTo('Secret', e.valueFrom.secretKeyRef.name, activeNamespace)}
                                                            className="text-[11px] text-amber-300 hover:underline flex items-center space-x-1"
                                                          >
                                                            <span>Secret: {e.valueFrom.secretKeyRef.name} → {e.valueFrom.secretKeyRef.key}</span>
                                                            <ExternalLink className="w-3 h-3" />
                                                          </button>
                                                        ) : e.valueFrom?.configMapKeyRef ? (
                                                          <button
                                                            type="button"
                                                            onClick={() => handleNavigateTo('ConfigMap', e.valueFrom.configMapKeyRef.name, activeNamespace)}
                                                            className="text-[11px] text-blue-300 hover:underline flex items-center space-x-1"
                                                          >
                                                            <span>ConfigMap: {e.valueFrom.configMapKeyRef.name} → {e.valueFrom.configMapKeyRef.key}</span>
                                                            <ExternalLink className="w-3 h-3" />
                                                          </button>
                                                        ) : (
                                                          <span className="text-gray-600">—</span>
                                                        )}
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Volume Mounts Table */}
                                    {mountsCount > 0 && (
                                      <div className="p-3.5 rounded-xl bg-[#070A0F] border border-border/60 space-y-3">
                                        <button
                                          type="button"
                                          onClick={() => setExpandedMounts((prev) => ({ ...prev, [cName]: !isMountsOpen }))}
                                          className="text-xs font-bold text-gray-300 font-mono flex items-center space-x-1.5 hover:text-white transition-colors"
                                        >
                                          {isMountsOpen ? <ChevronDown className="w-3.5 h-3.5 text-brand-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                          <span>Volume Mounts ({mountsCount})</span>
                                        </button>

                                        {isMountsOpen && (
                                          <div className="overflow-hidden rounded-lg border border-border/60 bg-surface">
                                            <table className="w-full text-left font-mono text-xs border-collapse">
                                              <thead>
                                                <tr className="border-b border-border/60 bg-[#0B0F17] text-[10px] text-gray-400 uppercase">
                                                  <th className="py-2 px-3">Mount Path</th>
                                                  <th className="py-2 px-3">Volume Source</th>
                                                  <th className="py-2 px-3 w-20 text-center">Access</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-border/40">
                                                {c.volumeMounts.map((vm: any, vmIdx: number) => (
                                                  <tr key={vmIdx} className="hover:bg-surface-elevated/40">
                                                    <td className="py-2 px-3 font-semibold text-gray-200">
                                                      {vm.mountPath}
                                                      {vm.subPath && (
                                                        <span className="text-gray-400 text-[10px] ml-1.5">
                                                          (subPath: {vm.subPath})
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className="py-2 px-3 text-indigo-300">
                                                      from: {vm.name}
                                                    </td>
                                                    <td className="py-2 px-3 text-center">
                                                      <span
                                                        className={`text-[10px] px-1.5 py-0.2 rounded border ${
                                                          vm.readOnly
                                                            ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                                                            : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                                                        }`}
                                                      >
                                                        {vm.readOnly ? 'ro' : 'rw'}
                                                      </span>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Init Containers (if present) */}
              {initContainers.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono flex items-center space-x-2">
                    <Box className="w-4 h-4 text-indigo-400" />
                    <span>Init Containers ({initContainers.length})</span>
                  </h3>
                  <div className="overflow-hidden rounded-xl border border-border/80 bg-surface">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border/80 bg-[#070A0F] text-[11px] text-gray-400 font-semibold uppercase tracking-wider select-none">
                          <th className="py-2.5 px-4 w-1/3">Init Container</th>
                          <th className="py-2.5 px-4 w-32">State</th>
                          <th className="py-2.5 px-4">Image</th>
                          <th className="py-2.5 px-3 w-24 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {initContainers.map((ic: any, icIdx: number) => {
                          const icStatus = initContainerStatuses.find((s) => s.name === ic.name);
                          const isReady = icStatus?.ready ?? false;
                          const stateObj = icStatus?.state || {};
                          const stateKey = Object.keys(stateObj)[0] || 'terminated';

                          return (
                            <tr key={icIdx} className="hover:bg-surface-elevated/40 transition-colors">
                              <td className="py-2.5 px-4 font-bold text-gray-200">
                                <div className="flex items-center space-x-2">
                                  <div className={`w-2 h-2 rounded-full ${isReady ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                                  <span>{ic.name}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="text-[11px] px-2 py-0.5 rounded bg-surface-elevated text-gray-300 border border-border">
                                  {stateKey}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-gray-400 text-[11px] font-mono">
                                <span className="truncate max-w-md block" title={ic.image}>{ic.image}</span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {hasLogs && onLogs && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onLogs({
                                        kind: currentResource?.kind || 'Pod',
                                        name: currentResource?.name,
                                        namespace: activeNamespace,
                                        container: ic.name,
                                        tailLines: 1000,
                                      });
                                    }}
                                    className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-hover text-brand-400 hover:text-white text-[10px] font-semibold inline-flex items-center space-x-1 border border-border"
                                    title="View Init Container Logs"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>Logs</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3. Attached Volumes Section */}
              {volumes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-amber-400" />
                    <span>Attached Volumes ({volumes.length})</span>
                  </h3>

                  <div className="overflow-hidden rounded-xl border border-border/80 bg-surface">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border/80 bg-[#070A0F] text-[11px] text-gray-400 font-semibold uppercase tracking-wider select-none">
                          <th className="py-2.5 px-4 w-1/3">Volume Name</th>
                          <th className="py-2.5 px-4 w-32">Type</th>
                          <th className="py-2.5 px-4">Source / Reference</th>
                          <th className="py-2.5 px-3 w-20 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {volumes.map((v: any, vIdx: number) => {
                          let typeLabel = 'Unknown';
                          let sourceDesc = '';
                          let targetKind: string | null = null;
                          let targetName: string | null = null;

                          if (v.configMap) {
                            typeLabel = 'ConfigMap';
                            sourceDesc = `cm/${v.configMap.name}`;
                            targetKind = 'ConfigMap';
                            targetName = v.configMap.name;
                          } else if (v.secret) {
                            typeLabel = 'Secret';
                            sourceDesc = `secret/${v.secret.secretName}`;
                            targetKind = 'Secret';
                            targetName = v.secret.secretName;
                          } else if (v.persistentVolumeClaim) {
                            typeLabel = 'PVC';
                            sourceDesc = `pvc/${v.persistentVolumeClaim.claimName}`;
                            targetKind = 'PersistentVolumeClaim';
                            targetName = v.persistentVolumeClaim.claimName;
                          } else if (v.emptyDir) {
                            typeLabel = 'EmptyDir';
                            sourceDesc = 'ephemeral memory/disk';
                          } else if (v.hostPath) {
                            typeLabel = 'HostPath';
                            sourceDesc = v.hostPath.path;
                          }

                          return (
                            <tr
                              key={vIdx}
                              className={`hover:bg-surface-elevated/40 transition-colors group ${
                                targetKind && targetName ? 'cursor-pointer' : ''
                              }`}
                              onClick={() => {
                                if (targetKind && targetName) {
                                  handleNavigateTo(targetKind, targetName, activeNamespace);
                                }
                              }}
                            >
                              <td className="py-2.5 px-4 font-bold text-gray-200">
                                <div className="flex items-center space-x-2">
                                  <HardDrive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span className="truncate" title={v.name}>
                                    {v.name}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800 font-semibold inline-block">
                                  {typeLabel}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-[11px] text-gray-300 font-mono">
                                <span className="truncate max-w-md block" title={sourceDesc}>
                                  {sourceDesc || 'default'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {targetKind && targetName ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNavigateTo(targetKind, targetName, activeNamespace);
                                    }}
                                    className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-hover text-brand-400 hover:text-white text-[10px] font-semibold inline-flex items-center space-x-1 border border-border"
                                    title={`Inspect ${targetKind}/${targetName}`}
                                  >
                                    <span>View</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <span className="text-gray-600 text-[10px]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. Referenced ConfigMaps & Secrets */}
              {(referencedConfigMaps.size > 0 || referencedSecrets.size > 0) && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    <span>ConfigMaps & Secrets Referenced</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    {referencedConfigMaps.size > 0 && (
                      <div className="p-3.5 rounded-xl bg-surface border border-border/80 space-y-2">
                        <span className="text-[11px] font-semibold text-blue-300 flex items-center space-x-1.5">
                          <FileCode className="w-3.5 h-3.5" />
                          <span>ConfigMaps ({referencedConfigMaps.size})</span>
                        </span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {Array.from(referencedConfigMaps).map((cm) => (
                            <button
                              key={cm}
                              onClick={() => handleNavigateTo('ConfigMap', cm, activeNamespace)}
                              className="px-2.5 py-1 rounded bg-blue-950/70 border border-blue-700/80 text-blue-200 text-xs hover:bg-blue-900 hover:border-blue-500 hover:text-white transition-all flex items-center space-x-1.5 group cursor-pointer shadow-sm"
                              title={`Inspect ConfigMap ${cm}`}
                            >
                              <span>{cm}</span>
                              <ExternalLink className="w-3 h-3 text-blue-400 group-hover:text-blue-200 shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {referencedSecrets.size > 0 && (
                      <div className="p-3.5 rounded-xl bg-surface border border-border/80 space-y-2">
                        <span className="text-[11px] font-semibold text-amber-300 flex items-center space-x-1.5">
                          <Key className="w-3.5 h-3.5" />
                          <span>Secrets ({referencedSecrets.size})</span>
                        </span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {Array.from(referencedSecrets).map((sec) => (
                            <button
                              key={sec}
                              onClick={() => handleNavigateTo('Secret', sec, activeNamespace)}
                              className="px-2.5 py-1 rounded bg-amber-950/70 border border-amber-700/80 text-amber-200 text-xs hover:bg-amber-900 hover:border-amber-500 hover:text-white transition-all flex items-center space-x-1.5 group cursor-pointer shadow-sm"
                              title={`Inspect Secret ${sec}`}
                            >
                              <span>{sec}</span>
                              <ExternalLink className="w-3 h-3 text-amber-400 group-hover:text-amber-200 shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5. Pod / Workload Labels & Annotations */}
              <MetadataLabelsAnnotations
                labels={labels}
                annotations={annotations}
                podTemplateLabels={podTemplateLabels}
                podTemplateAnnotations={podTemplateAnnotations}
              />
            </div>
          ) : isService ? (
            /* Dedicated Service Overview with Target Selector, Ports, and Connected Pods/Endpoints */
            <div className="space-y-6">
              {/* 1. Service Network Spec & Configuration Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-surface p-3.5 rounded-xl border border-border/80 space-y-1">
                  <span className="text-[11px] text-gray-400 uppercase font-mono">Service Type</span>
                  <div className="text-xs font-bold font-mono text-brand-300 truncate">
                    {spec.type || 'ClusterIP'}
                  </div>
                </div>

                <div className="bg-surface p-3.5 rounded-xl border border-border/80 space-y-1">
                  <span className="text-[11px] text-gray-400 uppercase font-mono">Cluster IP</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-gray-200 truncate">
                      {spec.clusterIP || 'None'}
                    </span>
                    {spec.clusterIP && spec.clusterIP !== 'None' && (
                      <button
                        onClick={() => navigator.clipboard.writeText(spec.clusterIP)}
                        className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-surface-elevated transition-colors"
                        title="Copy Cluster IP"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-surface p-3.5 rounded-xl border border-border/80 space-y-1">
                  <span className="text-[11px] text-gray-400 uppercase font-mono">Target Endpoints</span>
                  <div className="flex items-center space-x-1.5 font-mono text-xs font-bold">
                    <span className={`w-2 h-2 rounded-full ${
                      serviceEndpoints.filter((e) => e.ready).length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`} />
                    <span className={serviceEndpoints.filter((e) => e.ready).length > 0 ? 'text-emerald-300' : 'text-amber-300'}>
                      {serviceEndpoints.filter((e) => e.ready).length} Ready
                      {serviceEndpoints.filter((e) => !e.ready).length > 0 && ` / ${serviceEndpoints.filter((e) => !e.ready).length} NotReady`}
                    </span>
                  </div>
                </div>

                <div className="bg-surface p-3.5 rounded-xl border border-border/80 space-y-1">
                  <span className="text-[11px] text-gray-400 uppercase font-mono">Session Affinity</span>
                  <div className="text-xs font-bold font-mono text-cyan-300 truncate">
                    {spec.sessionAffinity || 'None'}
                  </div>
                </div>

                <div className="bg-surface p-3.5 rounded-xl border border-border/80 space-y-1 col-span-2 md:col-span-1">
                  <span className="text-[11px] text-gray-400 uppercase font-mono flex items-center justify-between">
                    <span>Age</span>
                    <Clock className="w-3 h-3 text-cyan-400" />
                  </span>
                  <div className="text-xs font-bold font-mono text-cyan-300">
                    {creationInfo?.age || currentResource?.age || '—'}
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono truncate" title={creationInfo?.full}>
                    {creationInfo?.formatted || 'Unknown'}
                  </div>
                </div>
              </div>

              {/* LoadBalancer / External IP Banner (if available) */}
              {(status?.loadBalancer?.ingress?.length > 0 || (Array.isArray(spec.externalIPs) && spec.externalIPs.length > 0)) && (
                <div className="p-3.5 bg-[#0B0F17] rounded-xl border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs">
                  <div className="flex items-center space-x-2 text-indigo-300">
                    <Network className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="font-semibold">External Ingress Points:</span>
                    <div className="flex flex-wrap gap-2">
                      {(status?.loadBalancer?.ingress || []).map((ing: any, iIdx: number) => (
                        <span key={iIdx} className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-200">
                          {ing.ip || ing.hostname}
                        </span>
                      ))}
                      {(spec.externalIPs || []).map((ip: string, iIdx: number) => (
                        <span key={`ext-${iIdx}`} className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-200">
                          {ip}
                        </span>
                      ))}
                    </div>
                  </div>
                  {spec.externalTrafficPolicy && (
                    <span className="text-gray-400 text-[11px]">
                      Traffic Policy: <span className="text-gray-200">{spec.externalTrafficPolicy}</span>
                    </span>
                  )}
                </div>
              )}

              {/* 2. Target Pod Selector (spec.selector) */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Radio className="w-4 h-4 text-brand-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200 font-mono">
                      Target Pod Selector ({spec.selector ? Object.keys(spec.selector).length : 0} labels)
                    </h3>
                  </div>
                  {spec.selector && Object.keys(spec.selector).length > 0 && (
                    <button
                      onClick={() => {
                        const selectorStr = Object.entries(spec.selector).map(([k, v]) => `${k}=${v}`).join(',');
                        navigator.clipboard.writeText(`kubectl get pods -n ${activeNamespace} -l ${selectorStr}`);
                      }}
                      className="text-[11px] text-brand-400 hover:text-brand-300 font-mono flex items-center space-x-1.5 transition-colors"
                      title="Copy kubectl command to query matching pods"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy kubectl query command</span>
                    </button>
                  )}
                </div>

                {spec.selector && Object.keys(spec.selector).length > 0 ? (
                  <div className="bg-surface p-4 rounded-xl border border-border/80 space-y-2.5">
                    <div className="text-[11px] text-gray-400 font-mono">
                      Traffic sent to this Service is load-balanced across Pods in namespace <code className="text-brand-300">{activeNamespace}</code> matching all of the following labels:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(spec.selector).map(([k, v]: [string, any]) => (
                        <div
                          key={k}
                          className="inline-flex items-center bg-[#0B0F17] border border-border/80 rounded-lg px-2.5 py-1 text-xs font-mono text-gray-200 group"
                        >
                          <span className="text-brand-300 font-semibold">{k}</span>
                          <span className="text-gray-500 mx-1.5">=</span>
                          <span className="text-indigo-300">{String(v)}</span>
                          <button
                            onClick={() => navigator.clipboard.writeText(`${k}=${v}`)}
                            className="ml-2 text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy selector pair"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-surface p-4 rounded-xl border border-border/80 text-xs font-mono text-amber-300/90 flex items-start space-x-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-amber-200">No label selector defined</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        This Service does not use label selectors to target Pods. It may be a Headless service, ExternalName, or routes to manually managed Endpoints.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Port & Protocol Mappings */}
              {Array.isArray(spec.ports) && spec.ports.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <ArrowDownUp className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200 font-mono">
                      Exposed Ports & Protocol Mappings ({spec.ports.length})
                    </h3>
                  </div>
                  <div className="bg-surface rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-left font-mono text-xs">
                      <thead className="bg-[#0B0F17] border-b border-border/80 text-gray-400 text-[11px] uppercase">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">Port Name</th>
                          <th className="px-4 py-2.5 font-semibold">Service Port</th>
                          <th className="px-4 py-2.5 font-semibold">Protocol</th>
                          <th className="px-4 py-2.5 font-semibold">Target Port (Pod)</th>
                          {spec.ports.some((p: any) => p.nodePort) && (
                            <th className="px-4 py-2.5 font-semibold">NodePort</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {spec.ports.map((p: any, idx: number) => (
                          <tr key={idx} className="hover:bg-surface-elevated/40 transition-colors">
                            <td className="px-4 py-2.5 font-semibold text-gray-200">
                              {p.name ? (
                                <span className="px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20 text-brand-300 text-[11px]">
                                  {p.name}
                                </span>
                              ) : (
                                <span className="text-gray-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-indigo-300 font-bold">{p.port}</td>
                            <td className="px-4 py-2.5 text-gray-400 text-[11px]">{p.protocol || 'TCP'}</td>
                            <td className="px-4 py-2.5 text-emerald-300 font-bold">{p.targetPort || p.port}</td>
                            {spec.ports.some((prt: any) => prt.nodePort) && (
                              <td className="px-4 py-2.5 text-amber-300 font-mono">{p.nodePort || '—'}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. Connected Target Pods & Endpoints */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Box className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200 font-mono">
                      Connected Target Pods & Endpoints ({filteredServiceEndpoints.length})
                    </h3>
                  </div>

                  {serviceEndpoints.length > 0 && (
                    <div className="relative w-64">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
                      <input
                        type="text"
                        value={servicePodFilter}
                        onChange={(e) => setServicePodFilter(e.target.value)}
                        placeholder="Filter by Pod name or IP…"
                        className="w-full pl-8 pr-3 py-1 bg-surface border border-border rounded-lg text-xs text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  )}
                </div>

                {serviceEndpointsLoading ? (
                  <div className="flex items-center justify-center py-10 bg-surface rounded-xl border border-border text-gray-400 space-x-2 text-xs font-mono">
                    <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                    <span>Resolving active Pod endpoints for this Service…</span>
                  </div>
                ) : filteredServiceEndpoints.length === 0 ? (
                  <div className="bg-surface p-6 rounded-xl border border-border space-y-2 font-mono text-xs">
                    <div className="text-gray-300 font-semibold flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        {servicePodFilter ? 'No Pod endpoints match your filter.' : 'No active Pod endpoints connected to this Service.'}
                      </span>
                    </div>
                    {!servicePodFilter && spec.selector && Object.keys(spec.selector).length > 0 && (
                      <p className="text-gray-400 text-[11px] pl-6 leading-relaxed">
                        This Service defines a selector, but no healthy Pods currently match it in namespace <code className="text-brand-300">{activeNamespace}</code>. Ensure target Pods are running and passing readiness probes.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-surface rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-left font-mono text-xs">
                      <thead className="bg-[#0B0F17] border-b border-border/80 text-gray-400 text-[11px] uppercase">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">Pod Name</th>
                          <th className="px-4 py-2.5 font-semibold">Pod IP</th>
                          <th className="px-4 py-2.5 font-semibold">Node</th>
                          <th className="px-4 py-2.5 font-semibold">Readiness</th>
                          <th className="px-4 py-2.5 font-semibold">Target Ports</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {filteredServiceEndpoints.map((ep, idx) => (
                          <tr key={idx} className="hover:bg-surface-elevated/40 transition-colors">
                            <td className="px-4 py-3 font-semibold text-gray-200">
                              {ep.podName ? (
                                <span className="truncate block max-w-[220px]" title={ep.podName}>
                                  {ep.podName}
                                </span>
                              ) : (
                                <span className="text-gray-500 italic">Unlabeled Endpoint</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                                <span>{ep.ip}</span>
                                <button
                                  onClick={() => navigator.clipboard.writeText(ep.ip)}
                                  className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-surface-elevated transition-colors"
                                  title="Copy Pod IP"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-[11px]">
                              {ep.nodeName ? (
                                <button
                                  onClick={() => handleNavigateTo('Node', ep.nodeName!)}
                                  className="text-brand-300 hover:text-brand-200 hover:underline flex items-center space-x-1 truncate max-w-[140px]"
                                  title={`Inspect Node ${ep.nodeName}`}
                                >
                                  <span className="truncate">{ep.nodeName}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </button>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-1.5">
                                <span className={`w-2 h-2 rounded-full ${ep.ready ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                <span className={`text-[11px] font-semibold ${ep.ready ? 'text-emerald-300' : 'text-red-300'}`}>
                                  {ep.ready ? 'Ready' : 'Not Ready'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-300">
                              <div className="flex flex-wrap gap-1">
                                {(ep.ports || []).map((port, pIdx) => (
                                  <span key={pIdx} className="px-1.5 py-0.5 rounded bg-[#0B0F17] border border-border/60 text-[10px] text-indigo-300">
                                    {port.port}/{port.protocol || 'TCP'}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {ep.podName && (
                                <button
                                  onClick={() => {
                                    setHistory((prev) => [...prev, currentResource]);
                                    setCurrentResource({
                                      kind: 'Pod',
                                      name: ep.podName,
                                      namespace: ep.namespace || activeNamespace,
                                    });
                                  }}
                                  className="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border text-brand-300 hover:text-brand-200 text-[11px] font-mono transition-colors"
                                >
                                  Inspect Pod
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 5. Service Labels & Annotations */}
              <MetadataLabelsAnnotations
                labels={labels}
                annotations={annotations}
              />

              {/* 6. Conditions (if any) */}
              {conditions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    <span>Resource Status Conditions ({conditions.length})</span>
                  </h3>
                  <div className="bg-surface rounded-xl border border-border overflow-hidden divide-y divide-border/40 font-mono text-xs">
                    {conditions.map((cond: any, cIdx: number) => (
                      <div key={cIdx} className="p-3 flex items-center justify-between hover:bg-surface-elevated/40 transition-colors">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${cond.status === 'True' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          <span className="font-semibold text-gray-200">{cond.type}</span>
                        </div>
                        <div className="flex items-center space-x-3 text-[11px] text-gray-400">
                          {cond.reason && <span>reason: {cond.reason}</span>}
                          <span className={`px-2 py-0.5 rounded border ${
                            cond.status === 'True'
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                              : 'bg-amber-950/60 text-amber-300 border-amber-800'
                          }`}>
                            {cond.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
                /* Dynamic Resource Overview for Custom Resources (e.g. ExternalSecret, Ingress, Certificate, Service, etc.) */
                <div className="space-y-6">
                  {/* Dynamic Metadata / Status Header */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Resource Kind</span>
                      <div className="text-xs font-bold font-mono text-brand-300 truncate">
                        {parsedData?.kind || currentResource.kind}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">API Version</span>
                      <div className="text-xs font-bold font-mono text-gray-300 truncate">
                        {parsedData?.apiVersion || 'v1'}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Namespace</span>
                      <div className="text-xs font-bold font-mono text-indigo-300 truncate">
                        {activeNamespace}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono">Status / Phase</span>
                      <div className="text-xs font-bold font-mono text-emerald-400 truncate">
                        {status?.phase || (conditions[0]?.type ? `${conditions[0].type}: ${conditions[0].status}` : 'Active')}
                      </div>
                    </div>
                    <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-1 col-span-2 md:col-span-1">
                      <span className="text-[11px] text-gray-400 uppercase font-mono flex items-center justify-between">
                        <span>Age</span>
                        <Clock className="w-3 h-3 text-cyan-400" />
                      </span>
                      <div className="text-xs font-bold font-mono text-cyan-300">
                        {creationInfo?.age || currentResource?.age || '—'}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono truncate" title={creationInfo?.full}>
                        {creationInfo?.formatted || 'Unknown'}
                      </div>
                    </div>
                  </div>

                  {/* Dynamically Discovered Referenced Secrets & ConfigMaps */}
                  {(referencedSecrets.size > 0 || referencedConfigMaps.size > 0 || referencedPvcs.size > 0) && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-cyan-400" />
                        <span>Referenced Resources & Targets</span>
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                        {referencedSecrets.size > 0 && (
                          <div className="p-3.5 rounded-xl bg-surface border border-border/80 space-y-2">
                            <span className="text-[11px] font-semibold text-amber-300 flex items-center space-x-1.5">
                              <Key className="w-3.5 h-3.5" />
                              <span>Secrets & Target Stores ({referencedSecrets.size})</span>
                            </span>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {Array.from(referencedSecrets).map((sec) => (
                                <button
                                  key={sec}
                                  onClick={() => handleNavigateTo('Secret', sec, activeNamespace)}
                                  className="px-2.5 py-1 rounded bg-amber-950/70 border border-amber-700/80 text-amber-200 text-xs hover:bg-amber-900 hover:border-amber-500 hover:text-white transition-all flex items-center space-x-1.5 group cursor-pointer shadow-sm"
                                  title={`Inspect Secret ${sec}`}
                                >
                                  <span>{sec}</span>
                                  <ExternalLink className="w-3 h-3 text-amber-400 group-hover:text-amber-200 shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {referencedConfigMaps.size > 0 && (
                          <div className="p-3.5 rounded-xl bg-surface border border-border/80 space-y-2">
                            <span className="text-[11px] font-semibold text-blue-300 flex items-center space-x-1.5">
                              <FileCode className="w-3.5 h-3.5" />
                              <span>ConfigMaps ({referencedConfigMaps.size})</span>
                            </span>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {Array.from(referencedConfigMaps).map((cm) => (
                                <button
                                  key={cm}
                                  onClick={() => handleNavigateTo('ConfigMap', cm, activeNamespace)}
                                  className="px-2.5 py-1 rounded bg-blue-950/70 border border-blue-700/80 text-blue-200 text-xs hover:bg-blue-900 hover:border-blue-500 hover:text-white transition-all flex items-center space-x-1.5 group cursor-pointer shadow-sm"
                                  title={`Inspect ConfigMap ${cm}`}
                                >
                                  <span>{cm}</span>
                                  <ExternalLink className="w-3 h-3 text-blue-400 group-hover:text-blue-200 shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ExternalSecret Remote Data Mappings */}
                  {Array.isArray(spec.data) && spec.data.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono flex items-center space-x-2">
                        <Key className="w-4 h-4 text-amber-400" />
                        <span>Remote Secret Mappings ({spec.data.length})</span>
                      </h3>
                      <div className="bg-surface rounded-xl border border-border/80 divide-y divide-border/40 overflow-hidden font-mono text-xs">
                        {spec.data.map((d: any, dIdx: number) => (
                          <div key={dIdx} className="p-3 flex items-center justify-between hover:bg-surface-elevated/40">
                            <span className="font-bold text-gray-200">{d.secretKey}</span>
                            <span className="text-gray-400 text-[11px] bg-[#0B0F17] px-2 py-0.5 rounded border border-border/40">
                              remote: {d.remoteRef?.key || '-'}{d.remoteRef?.property ? `.${d.remoteRef.property}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resource Labels & Annotations */}
                  <MetadataLabelsAnnotations
                    labels={labels}
                    annotations={annotations}
                  />

                  {/* Conditions List */}
                  {conditions.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono flex items-center space-x-2">
                        <Activity className="w-4 h-4 text-indigo-400" />
                        <span>Resource Status Conditions ({conditions.length})</span>
                      </h3>
                      <div className="bg-surface rounded-xl border border-border overflow-hidden divide-y divide-border/40 font-mono text-xs">
                        {conditions.map((cond: any, cIdx: number) => (
                          <div key={cIdx} className="p-3 flex items-center justify-between hover:bg-surface-elevated/40 transition-colors">
                            <div className="flex items-center space-x-2">
                              <span className={`w-2 h-2 rounded-full ${cond.status === 'True' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                              <span className="font-semibold text-gray-200">{cond.type}</span>
                            </div>
                            <div className="flex items-center space-x-3 text-[11px] text-gray-400">
                              {cond.reason && <span>reason: {cond.reason}</span>}
                              <span className={`px-2 py-0.5 rounded border ${
                                cond.status === 'True'
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                                  : 'bg-amber-950/60 text-amber-300 border-amber-800'
                              }`}>
                                {cond.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : activeTab === 'decoded_yaml' && isSecret ? (
              <div className="space-y-4">
                {/* Decoded YAML Header Toolbar */}
                <div className="bg-surface rounded-xl border border-border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <Unlock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200 font-mono flex items-center space-x-2">
                        <span>Secret Decoded Manifest</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-normal">
                          {secretYamlMode === 'decoded' ? 'Decoded stringData' : 'Raw Base64 data'}
                        </span>
                      </h3>
                      <p className="text-[11px] text-gray-400">
                        {secretYamlMode === 'decoded'
                          ? 'All base64 secret data keys have been completely decoded into human-readable plaintext strings.'
                          : 'Viewing raw standard Kubernetes base64 encoded secret data.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                    {/* Toggle between Decoded (stringData) and Raw (data base64) */}
                    <div className="bg-surface-elevated p-0.5 rounded-lg border border-border flex items-center text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setSecretYamlMode('decoded')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center space-x-1.5 ${
                          secretYamlMode === 'decoded'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <Unlock className="w-3 h-3" />
                        <span>Decoded (Plaintext)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSecretYamlMode('raw')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center space-x-1.5 ${
                          secretYamlMode === 'raw'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <Lock className="w-3 h-3" />
                        <span>Raw (Base64)</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const targetText = secretYamlMode === 'decoded' ? computedDecodedSecretYaml : computedRawSecretYaml;
                        navigator.clipboard.writeText(targetText);
                        setCopiedDecodedYaml(true);
                        setTimeout(() => setCopiedDecodedYaml(false), 2000);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-gray-300 hover:text-white text-xs font-mono flex items-center space-x-1.5 transition-colors"
                      title="Copy Full YAML to Clipboard"
                    >
                      {copiedDecodedYaml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                      <span>{copiedDecodedYaml ? 'Copied!' : 'Copy YAML'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const targetText = secretYamlMode === 'decoded' ? computedDecodedSecretYaml : computedRawSecretYaml;
                        const filename = `${currentResource.name}-${secretYamlMode}.yaml`;
                        const blob = new Blob([targetText], { type: 'text/yaml' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-gray-300 hover:text-white text-xs font-mono flex items-center space-x-1.5 transition-colors"
                      title="Download YAML File"
                    >
                      <Download className="w-3.5 h-3.5 text-gray-400" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                {/* Filter Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search / filter YAML lines…"
                    value={rawFilter}
                    onChange={(e) => setRawFilter(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 bg-surface rounded-lg border border-border text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>

                {/* YAML Content Viewer */}
                {decodedSecretLoading ? (
                  <div className="p-12 flex flex-col items-center justify-center space-y-3 bg-surface rounded-xl border border-border text-center">
                    <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                    <span className="text-xs text-gray-400 font-mono">Decoding Secret YAML values…</span>
                  </div>
                ) : (
                  <div className="bg-[#0B0F17] rounded-xl border border-border/80 p-4 font-mono text-xs text-gray-200 overflow-x-auto shadow-inner">
                    <pre className="whitespace-pre-wrap leading-relaxed select-text font-mono text-[12px]">
                      {(secretYamlMode === 'decoded' ? computedDecodedSecretYaml : computedRawSecretYaml)
                        .split('\n')
                        .filter((line) => !rawFilter || line.toLowerCase().includes(rawFilter.toLowerCase()))
                        .map((line, idx) => {
                          const isComment = line.trim().startsWith('#');
                          const isKey = /^\s*[\w.-]+:/.test(line);
                          return (
                            <div key={idx} className="hover:bg-surface-elevated/30 px-1 rounded flex">
                              <span className="w-10 text-gray-600 select-none text-right pr-3 shrink-0 font-mono text-[11px]">
                                {idx + 1}
                              </span>
                              <span
                                className={`flex-1 break-all ${
                                  isComment
                                    ? 'text-gray-500 italic'
                                    : isKey
                                    ? 'text-emerald-400/90'
                                    : 'text-gray-300'
                                }`}
                              >
                                {line}
                              </span>
                            </div>
                          );
                        })}
                    </pre>
                  </div>
                )}
              </div>
            ) : activeTab === 'metrics' && (isPodOrWorkload || isNode) ? (
              <div className="space-y-5">
                {/* Workload QoS, Quota & Scaled Cluster Footprint Banner */}
                {isPodOrWorkload && (
                  <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center space-x-2">
                        <Scale className="w-4 h-4 text-brand-400" />
                        <span className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono">
                          Kubernetes Resource Quotas & Footprint
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono border ${
                          (status?.qosClass || workloadResources.qosClass) === 'Guaranteed'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                            : (status?.qosClass || workloadResources.qosClass) === 'Burstable'
                              ? 'bg-blue-950/60 text-blue-300 border-blue-800'
                              : 'bg-amber-950/60 text-amber-300 border-amber-800'
                        }`}>
                          QoS: {status?.qosClass || workloadResources.qosClass}
                        </span>
                        {(workloadResources.hasUncappedCpuLimit || workloadResources.hasUncappedMemoryLimit) && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-950/50 text-amber-300 border border-amber-800/80 flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>Limits Uncapped</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                      <div className="bg-[#0B0F17] p-2.5 rounded-lg border border-border/60">
                        <span className="text-gray-500 text-[11px] block">Pod CPU Req / Lim</span>
                        <span className="text-gray-200 font-semibold">
                          <span className="text-emerald-400">{workloadResources.totalCpuRequestFormatted}</span> / <span className={workloadResources.hasUncappedCpuLimit ? 'text-amber-400' : 'text-cyan-400'}>{workloadResources.totalCpuLimitFormatted}</span>
                        </span>
                      </div>
                      <div className="bg-[#0B0F17] p-2.5 rounded-lg border border-border/60">
                        <span className="text-gray-500 text-[11px] block">Pod Mem Req / Lim</span>
                        <span className="text-gray-200 font-semibold">
                          <span className="text-emerald-400">{workloadResources.totalMemoryRequestFormatted}</span> / <span className={workloadResources.hasUncappedMemoryLimit ? 'text-amber-400' : 'text-cyan-400'}>{workloadResources.totalMemoryLimitFormatted}</span>
                        </span>
                      </div>
                      <div className="bg-[#0B0F17] p-2.5 rounded-lg border border-border/60">
                        <span className="text-gray-500 text-[11px] block">Scaled CPU ({workloadResources.replicas} {workloadResources.replicas === 1 ? 'pod' : 'pods'})</span>
                        <span className="text-gray-200 font-semibold">
                          {workloadResources.scaledCpuRequestFormatted} / {workloadResources.scaledCpuLimitFormatted}
                        </span>
                      </div>
                      <div className="bg-[#0B0F17] p-2.5 rounded-lg border border-border/60">
                        <span className="text-gray-500 text-[11px] block">Scaled Mem ({workloadResources.replicas} {workloadResources.replicas === 1 ? 'pod' : 'pods'})</span>
                        <span className="text-gray-200 font-semibold">
                          {workloadResources.scaledMemoryRequestFormatted} / {workloadResources.scaledMemoryLimitFormatted}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Telemetry Window & Scaling Controls Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-brand-400" />
                    <span className="text-xs font-semibold text-gray-300 font-mono">Timeframe:</span>
                    <div className="inline-flex rounded-lg bg-[#0B0F17] p-0.5 border border-border/80">
                      {(['30s', '15m', '1h', '6h', '24h'] as TimeframeOption[]).map((tf) => (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => setTelemetryTimeframe(tf)}
                          className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-md transition-all ${
                            telemetryTimeframe === tf
                              ? 'bg-brand-600 text-white shadow-sm font-semibold'
                              : 'text-gray-400 hover:text-gray-200 hover:bg-surface-elevated/40'
                          }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-gray-300 font-mono">Scale Mode:</span>
                    <div className="inline-flex rounded-lg bg-[#0B0F17] p-0.5 border border-border/80">
                      <button
                        type="button"
                        onClick={() => setTelemetryScaleMode('usage_focus')}
                        className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-md transition-all ${
                          telemetryScaleMode === 'usage_focus'
                            ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-surface-elevated/40'
                        }`}
                        title="Auto-scale Y-axis to actual pod usage & requests so subtle variations are clearly visible"
                      >
                        Usage Focus
                      </button>
                      <button
                        type="button"
                        onClick={() => setTelemetryScaleMode('fit_limit')}
                        className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-md transition-all ${
                          telemetryScaleMode === 'fit_limit'
                            ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-surface-elevated/40'
                        }`}
                        title="Fit full limit boundary on Y-axis (may flatten curve if limit is extremely high)"
                      >
                        Fit Limits
                      </button>
                    </div>
                  </div>
                </div>

                {/* SRE Resource Right-Sizing Advisory Banner */}
                {isPodOrWorkload && rightSizingAnalysis.needsAdvisory && (
                  <div className="p-4 rounded-xl bg-[#0d121f] border border-amber-500/30 shadow-lg space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono">
                          SRE Resource Right-Sizing Advisory
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/80">
                        Action Recommended
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                      {/* Memory Deficit Advisory */}
                      {rightSizingAnalysis.hasMemoryDeficit && (
                        <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-800/40 space-y-1.5">
                          <div className="flex items-center space-x-1.5 text-rose-400 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Memory Request Deficit Detected</span>
                          </div>
                          <p className="text-gray-300 text-[11px] leading-relaxed">
                            Pod working set memory is currently <strong className="text-white">{latestMem.toFixed(0)} MiB</strong>, exceeding the requested <strong className="text-emerald-400">{workloadResources.totalMemoryRequestFormatted}</strong> by <strong className="text-rose-400">+{rightSizingAnalysis.memDeficitDelta} MiB</strong>.
                          </p>
                          <p className="text-gray-400 text-[10px] leading-relaxed">
                            Operating above requests voids Guaranteed/Burstable eviction protections on memory-pressured nodes.
                          </p>
                          <div className="pt-1 text-[11px] text-emerald-300 font-semibold flex items-center space-x-1">
                            <span>Target Request:</span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/80">
                              ~{rightSizingAnalysis.recommendedMemReq} MiB
                            </span>
                            <span className="text-gray-500 text-[10px]">(+25% safety buffer)</span>
                          </div>
                        </div>
                      )}

                      {/* Wide Limit Spread Advisory */}
                      {rightSizingAnalysis.hasWideSpread && (
                        <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 space-y-1.5">
                          <div className="flex items-center space-x-1.5 text-amber-400 font-semibold">
                            <Scale className="w-3.5 h-3.5 shrink-0" />
                            <span>Wide Request-to-Limit Spread</span>
                          </div>
                          <p className="text-gray-300 text-[11px] leading-relaxed">
                            Extreme gap detected between requests and limits: CPU limit is <strong className="text-white">{rightSizingAnalysis.cpuSpread}x</strong> of request, and Memory limit is <strong className="text-white">{rightSizingAnalysis.memSpread}x</strong> of request.
                          </p>
                          <p className="text-gray-400 text-[10px] leading-relaxed">
                            Extreme limits over-provisioning causes node scheduler bin-packing instability and CPU CFS throttling spikes during noisy-neighbor surges.
                          </p>
                          <div className="pt-1 text-[11px] text-amber-300 font-semibold">
                            Recommended ratio: 1.5x – 2.5x spread.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Runtime Optimization Hint */}
                    <div className="text-[11px] text-gray-400 flex items-start space-x-1.5 bg-surface/60 p-2 rounded-lg border border-border/60">
                      <span className="text-indigo-400 font-bold shrink-0">Runtime Tip:</span>
                      <span>
                        For JVM / Node.js workloads, align heap bounds using percentage-based container limits (e.g. <code className="text-gray-200 bg-[#0B0F17] px-1 py-0.5 rounded">-XX:MaxRAMPercentage=75.0</code> or <code className="text-gray-200 bg-[#0B0F17] px-1 py-0.5 rounded">--max-old-space-size</code>) instead of hardcoded heap allocations.
                      </span>
                    </div>
                  </div>
                )}

                {/* Telemetry 4-Grid Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. CPU Usage Card */}
                  <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-xs font-semibold text-gray-200">
                        <Cpu className="w-4 h-4 text-pink-400" />
                        <span>CPU Utilization</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                          cpuSeverity === 'critical'
                            ? 'bg-rose-950/70 text-rose-300 border-rose-800'
                            : cpuSeverity === 'warning'
                            ? 'bg-amber-950/70 text-amber-300 border-amber-800'
                            : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                        }`}>
                          {cpuSeverity === 'critical' ? 'Critical (>80% Limit)' : cpuSeverity === 'warning' ? 'Above Request' : 'Within Budget'}
                        </span>
                        <span className="text-xs font-mono font-bold text-pink-400">
                          {latestCpu.toFixed(0)}m / {workloadResources.totalCpuLimitFormatted}
                        </span>
                      </div>
                    </div>
                    <div className="w-full pt-1">
                      {renderChartWithAxes(
                        activeCpuHistory,
                        '#ec4899',
                        'm',
                        cpuChartMax,
                        (v) => (v <= 0 ? '0m' : v >= 1000 ? `${(v / 1000).toFixed(1)}c` : `${Math.round(v)}m`),
                        visibleCpuThresholds,
                        timeframeXTicks[telemetryTimeframe],
                        outOfRangeCpuThresholds,
                        () => setTelemetryScaleMode('fit_limit'),
                        cpuColor
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-[11px] font-mono text-gray-400">
                      <div>
                        <span className="text-gray-500 block">Usage</span>
                        <span className="text-gray-200 font-semibold">{latestCpu.toFixed(0)}m</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Request</span>
                        <span className="text-emerald-400 font-semibold">{workloadResources.totalCpuRequestFormatted}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Limit</span>
                        <span className={workloadResources.hasUncappedCpuLimit ? 'text-amber-400 font-semibold' : 'text-cyan-400 font-semibold'}>
                          {workloadResources.totalCpuLimitFormatted}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Memory Usage Card */}
                  <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-xs font-semibold text-gray-200">
                        <Database className="w-4 h-4 text-indigo-400" />
                        <span>Memory Consumption (RSS)</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                          memSeverity === 'critical'
                            ? 'bg-rose-950/70 text-rose-300 border-rose-800'
                            : memSeverity === 'warning'
                            ? 'bg-amber-950/70 text-amber-300 border-amber-800'
                            : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                        }`}>
                          {memSeverity === 'critical'
                            ? 'Critical (>80% Limit)'
                            : memSeverity === 'warning'
                            ? `Above Request (+${rightSizingAnalysis.memDeficitDelta} MiB)`
                            : 'Within Budget'}
                        </span>
                        <span className="text-xs font-mono font-bold text-indigo-400">
                          {latestMem.toFixed(0)} MiB / {workloadResources.totalMemoryLimitFormatted}
                        </span>
                      </div>
                    </div>
                    <div className="w-full pt-1">
                      {renderChartWithAxes(
                        activeMemHistory,
                        '#6366f1',
                        'MiB',
                        memChartMax,
                        (v) => (v <= 0 ? '0M' : v >= 1024 ? `${(v / 1024).toFixed(1)}G` : `${Math.round(v)}M`),
                        visibleMemThresholds,
                        timeframeXTicks[telemetryTimeframe],
                        outOfRangeMemThresholds,
                        () => setTelemetryScaleMode('fit_limit'),
                        memColor
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-[11px] font-mono text-gray-400">
                      <div>
                        <span className="text-gray-500 block">Working Set</span>
                        <span className="text-gray-200 font-semibold">{latestMem.toFixed(0)} MiB</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Request</span>
                        <span className="text-emerald-400 font-semibold">{workloadResources.totalMemoryRequestFormatted}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Limit</span>
                        <span className={workloadResources.hasUncappedMemoryLimit ? 'text-amber-400 font-semibold' : 'text-cyan-400 font-semibold'}>
                          {workloadResources.totalMemoryLimitFormatted}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. Network I/O Card */}
                  <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-xs font-semibold text-gray-200">
                        <ArrowDownUp className="w-4 h-4 text-emerald-400" />
                        <span>Network I/O Throughput</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        Rx: {latestNetRx.toFixed(0)} KB/s · Tx: {latestNetTx.toFixed(0)} KB/s
                      </span>
                    </div>
                    <div className="w-full pt-1">
                      {renderChartWithAxes(
                        netRxHistory,
                        '#10b981',
                        'KB/s',
                        300,
                        (v) => `${v.toFixed(0)}K`,
                        undefined,
                        timeframeXTicks[telemetryTimeframe]
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-[11px] font-mono text-gray-400">
                      <div>
                        <span className="text-gray-500 block">Rx Rate</span>
                        <span className="text-emerald-300 font-semibold">{latestNetRx.toFixed(0)} KB/s</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Tx Rate</span>
                        <span className="text-blue-300 font-semibold">{latestNetTx.toFixed(0)} KB/s</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Dropped</span>
                        <span className="text-gray-200 font-semibold">0 pkts/s</span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Disk & Storage Card */}
                  <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-xs font-semibold text-gray-200">
                        <HardDrive className="w-4 h-4 text-amber-400" />
                        <span>Disk & Ephemeral Storage</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {latestDisk} GiB / 10.0 GiB
                      </span>
                    </div>
                    <div className="w-full pt-1">
                      {renderChartWithAxes(
                        diskHistory,
                        '#f59e0b',
                        'GiB',
                        diskChartMax,
                        (v) => (v <= 0 ? '0G' : `${v.toFixed(1)}G`),
                        diskThresholds,
                        timeframeXTicks[telemetryTimeframe]
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-[11px] font-mono text-gray-400">
                      <div>
                        <span className="text-gray-500 block">Allocated</span>
                        <span className="text-amber-300 font-semibold">{latestDisk} GiB</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Read/Write</span>
                        <span className="text-gray-200 font-semibold">4.2 MB/s</span>
                      </div>
                      <div>
                        <span className="text-gray-200 font-semibold">IOPS</span>
                        <span className="text-gray-200 font-semibold">120 ops</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Multi-container Breakdown Table (when workload has multiple containers) */}
                {workloadResources.containers.length > 1 && (
                  <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                    <h3 className="text-xs font-semibold text-gray-200 flex items-center space-x-2">
                      <Box className="w-4 h-4 text-cyan-400" />
                      <span>Per-Container Resource Allocation Breakdown ({workloadResources.containers.length})</span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/60 bg-[#0B0F17] text-gray-400 text-[11px]">
                            <th className="py-2.5 px-3 font-semibold">Container</th>
                            <th className="py-2.5 px-3 font-semibold">CPU Request</th>
                            <th className="py-2.5 px-3 font-semibold">CPU Limit</th>
                            <th className="py-2.5 px-3 font-semibold">Memory Request</th>
                            <th className="py-2.5 px-3 font-semibold">Memory Limit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {workloadResources.containers.map((c, cIdx) => (
                            <tr key={cIdx} className="hover:bg-surface-elevated/40 transition-colors">
                              <td className="py-2.5 px-3 font-medium text-gray-200 flex items-center space-x-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                <span>{c.name}</span>
                              </td>
                              <td className="py-2.5 px-3 text-emerald-400">{c.cpuRequestFormatted}</td>
                              <td className="py-2.5 px-3">
                                <span className={c.hasCpuLimit ? 'text-cyan-400' : 'text-amber-400 font-medium'}>
                                  {c.cpuLimitFormatted}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-emerald-400">{c.memoryRequestFormatted}</td>
                              <td className="py-2.5 px-3">
                                <span className={c.hasMemoryLimit ? 'text-cyan-400' : 'text-amber-400 font-medium'}>
                                  {c.memoryLimitFormatted}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Status and Pod Events Highlights */}
                <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                  <h3 className="text-xs font-semibold text-gray-200 flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    <span>Real-time Health & Lifecycle Status</span>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="bg-surface-elevated p-2.5 rounded-lg border border-border/60">
                      <span className="text-gray-500 text-[11px] block">Readiness</span>
                      <span className="text-emerald-400 font-semibold font-mono">1/1 Ready</span>
                    </div>
                    <div className="bg-surface-elevated p-2.5 rounded-lg border border-border/60">
                      <span className="text-gray-500 text-[11px] block">Restarts</span>
                      <span className="text-gray-200 font-semibold font-mono">0</span>
                    </div>
                    <div className="bg-surface-elevated p-2.5 rounded-lg border border-border/60">
                      <span className="text-gray-500 text-[11px] block">OOMKilled Risk</span>
                      <span className={`font-semibold font-mono ${
                        workloadResources.hasUncappedMemoryLimit
                          ? 'text-amber-400'
                          : latestMem > (workloadResources.totalMemoryLimit * 0.8)
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                      }`}>
                        {workloadResources.hasUncappedMemoryLimit
                          ? 'Uncapped (Node Bound)'
                          : latestMem > (workloadResources.totalMemoryLimit * 0.8)
                            ? 'High (> 80%)'
                            : 'Low (< 30%)'}
                      </span>
                    </div>
                    <div className="bg-surface-elevated p-2.5 rounded-lg border border-border/60">
                      <span className="text-gray-500 text-[11px] block">QoS Class</span>
                      <span className="text-indigo-300 font-semibold font-mono">{status?.qosClass || workloadResources.qosClass}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === 'events' ? (
              <div className="space-y-4">
                {/* Events Toolbar: Search, Filters & Counters */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border">
                  {/* Search Bar */}
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter events by reason, message, source, or involved object…"
                      value={eventFilter}
                      onChange={(e) => setEventFilter(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 bg-[#0B0F17] rounded-lg border border-border/80 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500 font-mono"
                    />
                  </div>

                  {/* Severity Filter Toggle Buttons */}
                  <div className="flex items-center space-x-1.5 bg-[#0B0F17] p-1 rounded-lg border border-border/80 text-xs font-mono">
                    <button
                      onClick={() => setEventSeverityFilter('all')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        eventSeverityFilter === 'all'
                          ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      All ({resourceEvents.length})
                    </button>
                    <button
                      onClick={() => setEventSeverityFilter('warning')}
                      className={`px-2.5 py-1 rounded-md font-semibold flex items-center space-x-1.5 transition-all ${
                        eventSeverityFilter === 'warning'
                          ? 'bg-rose-950/60 text-rose-300 border border-rose-800/80'
                          : 'text-gray-400 hover:text-rose-300'
                      }`}
                    >
                      <AlertTriangle className={`w-3 h-3 ${warningEventsCount > 0 ? 'text-rose-400' : 'text-gray-500'}`} />
                      <span>Warnings ({warningEventsCount})</span>
                    </button>
                    <button
                      onClick={() => setEventSeverityFilter('normal')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        eventSeverityFilter === 'normal'
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80'
                          : 'text-gray-400 hover:text-emerald-300'
                      }`}
                    >
                      Normal ({resourceEvents.length - warningEventsCount})
                    </button>
                  </div>
                </div>

                {/* Loading State */}
                {eventsLoading ? (
                  <div className="p-12 flex flex-col items-center justify-center space-y-3 bg-surface rounded-xl border border-border">
                    <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
                    <span className="text-xs text-gray-400 font-mono">Fetching Kubernetes lifecycle events...</span>
                  </div>
                ) : filteredResourceEvents.length === 0 ? (
                  /* Empty State */
                  <div className="p-12 flex flex-col items-center justify-center space-y-3 bg-surface rounded-xl border border-border text-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-950/50 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-gray-200">No events recorded</h4>
                      <p className="text-xs text-gray-400 max-w-sm">
                        {eventFilter || eventSeverityFilter !== 'all'
                          ? 'No events match the current filter criteria.'
                          : `No recent Kubernetes events found for ${currentResource?.name || 'this resource'} in namespace ${activeNamespace}.`}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Events Table / Timeline */
                  <div className="bg-surface rounded-xl border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/60 bg-[#0B0F17] text-gray-400 text-[11px]">
                            <th className="py-2.5 px-3 font-semibold">Type</th>
                            <th className="py-2.5 px-3 font-semibold">Reason</th>
                            <th className="py-2.5 px-3 font-semibold">Involved Object</th>
                            <th className="py-2.5 px-3 font-semibold">Message</th>
                            <th className="py-2.5 px-3 font-semibold">Source</th>
                            <th className="py-2.5 px-3 font-semibold">Count</th>
                            <th className="py-2.5 px-3 font-semibold">Age</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {filteredResourceEvents.map((evt, idx) => {
                            const isWarning = (evt.type || evt.eventType || '').toLowerCase() === 'warning';
                            const involvedName = evt.involvedObject?.name || evt.involvedObjectName || '-';
                            const involvedKind = evt.involvedObject?.kind || evt.involvedObjectKind || '';
                            const count = evt.count || 1;
                            const ageStr = evt.lastTimestamp || evt.eventTime || evt.firstTimestamp;
                            const formattedAge = formatCreationDate(ageStr);

                            return (
                              <tr key={evt.uid || idx} className="hover:bg-surface-elevated/40 transition-colors">
                                <td className="py-3 px-3 align-top whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border inline-flex items-center space-x-1 ${
                                    isWarning
                                      ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                                      : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                                  }`}>
                                    {isWarning ? <AlertTriangle className="w-2.5 h-2.5 text-rose-400" /> : <Check className="w-2.5 h-2.5 text-emerald-400" />}
                                    <span>{evt.type || 'Normal'}</span>
                                  </span>
                                </td>
                                <td className="py-3 px-3 align-top whitespace-nowrap font-bold text-gray-200">
                                  {evt.reason || 'Lifecycle'}
                                </td>
                                <td className="py-3 px-3 align-top whitespace-nowrap text-gray-300">
                                  <div className="flex items-center space-x-1.5">
                                    {involvedKind && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated text-gray-400 border border-border/50">
                                        {involvedKind}
                                      </span>
                                    )}
                                    <span className="text-gray-200 font-medium">{involvedName}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-3 align-top text-gray-300 max-w-md lg:max-w-xl break-words leading-relaxed select-text">
                                  {evt.message || '-'}
                                </td>
                                <td className="py-3 px-3 align-top whitespace-nowrap text-gray-400 text-[11px]">
                                  {evt.source?.component || evt.source || evt.reportingComponent || '-'}
                                </td>
                                <td className="py-3 px-3 align-top whitespace-nowrap text-gray-300 text-[11px]">
                                  {count > 1 ? (
                                    <span className="px-1.5 py-0.5 rounded bg-brand-950/60 text-brand-300 border border-brand-800/80 font-bold">
                                      {count}x
                                    </span>
                                  ) : (
                                    '1x'
                                  )}
                                </td>
                                <td className="py-3 px-3 align-top whitespace-nowrap text-gray-400 text-[11px]" title={formattedAge?.full || ''}>
                                  {formattedAge?.age || ageStr || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
            <div className="space-y-4">
              {isSecret && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs font-mono">
                  <div className="flex items-center space-x-2 text-emerald-300">
                    <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Viewing raw manifest. Want to see all YAML keys decoded into human-readable plaintext?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('decoded_yaml')}
                    className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors flex items-center space-x-1.5 shrink-0 shadow-sm"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Open Decoded YAML</span>
                  </button>
                </div>
              )}

              {/* Filter bar for raw YAML / events */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter YAML keys or values…"
                  value={rawFilter}
                  onChange={(e) => setRawFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-surface rounded-lg border border-border text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Conditions Table */}
              {conditions.length > 0 && (
                <div className="bg-surface rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border/60 text-xs font-bold text-gray-300 font-mono">
                    Pod Conditions ({conditions.length})
                  </div>
                  <div className="divide-y divide-border/40 font-mono text-xs">
                    {conditions.map((cond, cIdx) => (
                      <div key={cIdx} className="p-3 flex items-center justify-between hover:bg-surface-elevated/40 transition-colors">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${cond.status === 'True' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          <span className="font-semibold text-gray-200">{cond.type}</span>
                        </div>
                        <div className="flex items-center space-x-3 text-[11px] text-gray-400">
                          {cond.reason && <span>reason: {cond.reason}</span>}
                          <span className={`px-2 py-0.5 rounded border ${
                            cond.status === 'True'
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                              : 'bg-amber-950/60 text-amber-300 border-amber-800'
                          }`}>
                            {cond.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-surface rounded-xl border border-border p-4">
                <pre className="font-mono text-[12px] text-gray-200 whitespace-pre-wrap leading-relaxed select-text">
                  {rawFilter
                    ? content
                        .split('\n')
                        .filter((line) => line.toLowerCase().includes(rawFilter.toLowerCase()))
                        .join('\n')
                    : content}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Helm Upgrade Modal */}
      {isHelmRelease && (
        <HelmUpgradeModal
          isOpen={isUpgradingHelm}
          onClose={() => setIsUpgradingHelm(false)}
          releaseName={currentResource.name}
          namespace={currentResource.namespace || 'default'}
          currentChart={helmDetails?.chart_name}
          currentVersion={helmDetails?.chart_version}
          initialValuesYaml={helmDetails?.user_values_yaml || ''}
          isReadOnly={isReadOnly}
          onSuccess={async () => {
            if (currentResource) {
              const updated = await api.getHelmReleaseDetails(currentResource.name, currentResource.namespace);
              setHelmDetails(updated);
            }
          }}
        />
      )}

      {/* Helm Rollback Confirmation Dialog */}
      {rollbackConfirmRev !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-100">
          <div className="bg-[#10141D] border border-indigo-500/40 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 font-mono">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-100">Rollback Helm Release</h3>
                <p className="text-xs text-gray-400">Revert {currentResource.name} to revision v{rollbackConfirmRev}</p>
              </div>
            </div>

            {helmActionError && (
              <div className="p-3 rounded-lg bg-red-950/80 border border-red-700 text-red-200 text-xs">
                {helmActionError}
              </div>
            )}

            <div className="bg-surface p-3.5 rounded-xl border border-border text-xs text-gray-300 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Current Revision:</span>
                <span className="font-semibold text-gray-200">v{helmDetails?.revision || 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Target Revision:</span>
                <span className="font-semibold text-indigo-400">v{rollbackConfirmRev}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Target Namespace:</span>
                <span className="font-semibold text-gray-200">{currentResource.namespace || 'default'}</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRollbackConfirmRev(null);
                  setHelmActionError(null);
                }}
                disabled={helmActionLoading}
                className="px-4 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-surface-hover hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (rollbackConfirmRev === null) return;
                  try {
                    setHelmActionLoading(true);
                    setHelmActionError(null);
                    await api.rollbackHelmRelease({
                      releaseName: currentResource.name,
                      namespace: currentResource.namespace || 'default',
                      revision: rollbackConfirmRev,
                    });
                    setRollbackConfirmRev(null);
                    const updated = await api.getHelmReleaseDetails(currentResource.name, currentResource.namespace);
                    setHelmDetails(updated);
                  } catch (err: any) {
                    setHelmActionError(err?.message || String(err));
                  } finally {
                    setHelmActionLoading(false);
                  }
                }}
                disabled={helmActionLoading || isReadOnly}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                {helmActionLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Rolling back…</span>
                  </>
                ) : (
                  <span>Confirm Rollback</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Helm Uninstall Confirmation Dialog */}
      {isUninstallingHelm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-100">
          <div className="bg-[#10141D] border border-red-800/60 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 font-mono">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-100">Uninstall Helm Release</h3>
                <p className="text-xs text-gray-400">Are you sure you want to remove {currentResource.name}?</p>
              </div>
            </div>

            {helmActionError && (
              <div className="p-3 rounded-lg bg-red-950/80 border border-red-700 text-red-200 text-xs">
                {helmActionError}
              </div>
            )}

            <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-xl text-xs text-red-300/90 leading-relaxed">
              This will permanently delete all Kubernetes deployments, pods, services, and secrets created by this Helm release in namespace <code className="text-red-200 font-bold">{currentResource.namespace || 'default'}</code>.
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsUninstallingHelm(false);
                  setHelmActionError(null);
                }}
                disabled={helmActionLoading}
                className="px-4 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-surface-hover hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setHelmActionLoading(true);
                    setHelmActionError(null);
                    await api.uninstallHelmRelease({
                      releaseName: currentResource.name,
                      namespace: currentResource.namespace || 'default',
                    });
                    setIsUninstallingHelm(false);
                    onClose();
                    if (onDelete) onDelete(currentResource);
                  } catch (err: any) {
                    setHelmActionError(err?.message || String(err));
                  } finally {
                    setHelmActionLoading(false);
                  }
                }}
                disabled={helmActionLoading || isReadOnly}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-500 active:bg-red-700 shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                {helmActionLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uninstalling…</span>
                  </>
                ) : (
                  <span>Confirm Uninstall</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
