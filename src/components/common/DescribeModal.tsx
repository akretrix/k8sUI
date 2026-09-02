import React, { useEffect, useMemo, useState } from 'react';
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
  FolderTree,
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
  Tag,
  Calendar,
  Clock,
} from 'lucide-react';
import { load as yamlLoad } from 'js-yaml';
import { api, SecretDetails, HelmReleaseDetails, PodSummary } from '../../api/tauriClient';
import { HelmUpgradeModal } from '../helm/HelmUpgradeModal';
import { MetadataLabelsAnnotations } from './MetadataLabelsAnnotations';

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
}) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'metadata' | 'metrics' | 'describe' | 'values' | 'history' | 'notes' | 'manifest'>('overview');
  const [rawFilter, setRawFilter] = useState('');

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

  // Collapse / Expand state
  const [expandedEnv, setExpandedEnv] = useState<Record<string, boolean>>({});
  const [envFilters, setEnvFilters] = useState<Record<string, string>>({});
  const [expandedMounts, setExpandedMounts] = useState<Record<string, boolean>>({});
  const [expandedContainers, setExpandedContainers] = useState<Record<string, boolean>>({});

  // Simulated metrics time-series history for sparklines
  const [cpuHistory, setCpuHistory] = useState<number[]>([15, 22, 18, 30, 25, 42, 35, 28, 45, 38, 50, 42]);
  const [memHistory, setMemHistory] = useState<number[]>([180, 195, 210, 205, 220, 235, 240, 248, 255, 250, 260, 256]);
  const [netRxHistory, setNetRxHistory] = useState<number[]>([45, 78, 62, 110, 85, 140, 95, 120, 160, 135, 175, 142]);
  const [netTxHistory, setNetTxHistory] = useState<number[]>([30, 42, 38, 65, 50, 85, 60, 75, 90, 80, 95, 88]);
  const [diskHistory, setDiskHistory] = useState<number[]>([1.2, 1.2, 1.3, 1.3, 1.3, 1.4, 1.4, 1.4, 1.4, 1.4, 1.5, 1.4]);

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
    }
  }, [resource]);

  useEffect(() => {
    if (!isOpen || !currentResource) {
      setContent('');
      setError(null);
      setSecretDetails(null);
      setHelmDetails(null);
      setNodePods([]);
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
      api
        .getSecretData(currentResource.name, currentResource.namespace)
        .then(setSecretDetails)
        .catch((e) => console.error('Failed to get secret details:', e))
        .finally(() => setSecretLoading(false));
    } else {
      setSecretDetails(null);
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

  const normalizedKind = (currentResource?.kind || '').toLowerCase();
  const isHelmRelease = ['helm', 'helmrelease', 'helm-releases', 'helmreleases'].includes(normalizedKind);
  const isNode = ['node', 'nodes'].includes(normalizedKind);
  const isPodOrWorkload = !isHelmRelease && !isNode && ['pod', 'pods', 'deployment', 'deployments', 'statefulset', 'statefulsets', 'daemonset', 'daemonsets', 'job', 'jobs'].includes(normalizedKind);
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

  const metadata = parsedData?.metadata || {};
  const labels: Record<string, string> = metadata?.labels || {};
  const annotations: Record<string, string> = metadata?.annotations || {};
  const podTemplateLabels: Record<string, string> | undefined = parsedData?.spec?.template?.metadata?.labels;
  const podTemplateAnnotations: Record<string, string> | undefined = parsedData?.spec?.template?.metadata?.annotations;
  const totalMetadataCount = Object.keys(labels).length + Object.keys(annotations).length;
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

  const renderChartWithAxes = (
    data: number[],
    color: string,
    unit: string,
    maxVal?: number,
    yFormat?: (v: number) => string
  ) => {
    const max = maxVal || Math.max(...data, 1);
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

    const xTicks = [
      { x: padLeft, label: '-24s' },
      { x: padLeft + plotWidth * 0.33, label: '-16s' },
      { x: padLeft + plotWidth * 0.66, label: '-8s' },
      { x: padLeft + plotWidth, label: 'now' },
    ];

    const gradientId = `grad-${color.replace('#', '')}`;

    return (
      <div className="w-full">
        <svg className="w-full h-24 overflow-visible select-none font-mono" viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
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

          {/* Line Curve */}
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Live Indicator Dot */}
          {lastPoint && (
            <g>
              <circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r="4"
                fill={color}
                className="animate-ping opacity-75 origin-center"
              />
              <circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r="3.5"
                fill="#0B0F17"
                stroke={color}
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      </div>
    );
  };

  const latestCpu = cpuHistory[cpuHistory.length - 1];
  const latestMem = memHistory[memHistory.length - 1];
  const latestNetRx = netRxHistory[netRxHistory.length - 1];
  const latestNetTx = netTxHistory[netTxHistory.length - 1];
  const latestDisk = diskHistory[diskHistory.length - 1];

  if (!isOpen || !currentResource) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end pointer-events-none bg-black/40 backdrop-blur-[2px]">
      <div className="w-[1120px] max-w-[92vw] h-full bg-[#0D1117] border-l border-border shadow-2xl flex flex-col transform transition-transform duration-300 pointer-events-auto select-text">
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
                  onLogs(currentResource);
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
                    : 'Resource Overview'}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('metadata')}
                className={`flex items-center space-x-2 text-xs font-semibold h-full border-b-2 transition-colors ${
                  activeTab === 'metadata'
                    ? 'border-cyan-500 text-cyan-300'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Labels & Annotations ({totalMetadataCount})</span>
              </button>
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
                          const isKeyCopied = copiedSecretKey === `key-${entry.key}`;
                          const isValCopied = copiedSecretKey === `val-${entry.key}`;
                          const isB64Copied = copiedSecretKey === `b64-${entry.key}`;

                          return (
                            <div key={entry.key} className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 hover:bg-surface-elevated/40 transition-colors select-text">
                              <div className="flex items-center space-x-2 min-w-0">
                                <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="font-bold text-gray-200 text-xs truncate select-text">{entry.key}</span>
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
                      <div className="space-y-3">
                        {Object.entries(parsedData?.data || {}).map(([key, val]) => (
                          <div key={key} className="p-3.5 rounded-xl bg-surface border border-border/80 space-y-2 font-mono text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-blue-300">{key}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated text-gray-400">
                                {String(val || '').length} chars
                              </span>
                            </div>
                            <pre className="p-2.5 rounded-lg bg-[#0B0F17] border border-border/40 text-[11px] text-gray-200 overflow-x-auto whitespace-pre-wrap max-h-48">
                              {String(val || '')}
                            </pre>
                          </div>
                        ))}
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
              ) : isPodOrWorkload && containers.length > 0 ? (
                <div className="space-y-6">
                  {/* 1. Quick Pod Specs & Lifecycle Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
                    <div className="bg-[#0B0F17] p-4 rounded-xl border border-border/80 shadow-sm flex flex-col justify-between space-y-2">
                      <span className="text-[11px] text-gray-400 uppercase font-mono font-semibold tracking-wider flex items-center space-x-1.5">
                        <Shield className="w-3.5 h-3.5 text-indigo-400" />
                        <span>QoS Class</span>
                      </span>
                      <div className="text-sm font-bold font-mono text-indigo-300">
                        {status?.qosClass || 'Burstable'}
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">Resource quality tier</span>
                    </div>

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

                    <div className="bg-[#0B0F17] p-4 rounded-xl border border-border/80 shadow-sm flex flex-col justify-between space-y-2">
                      <span className="text-[11px] text-gray-400 uppercase font-mono font-semibold tracking-wider flex items-center space-x-1.5">
                        <Key className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Service Account</span>
                      </span>
                      {spec?.serviceAccountName ? (
                        <button
                          onClick={() => handleNavigateTo('ServiceAccount', spec.serviceAccountName, activeNamespace)}
                          className="text-xs font-bold font-mono text-cyan-300 hover:text-cyan-200 hover:underline flex items-center space-x-1 truncate max-w-[170px]"
                          title={`Inspect ServiceAccount ${spec.serviceAccountName}`}
                        >
                          <span className="truncate">{spec.serviceAccountName}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </button>
                      ) : (
                        <div className="text-xs font-bold font-mono text-cyan-300">default</div>
                      )}
                      <span className="text-[10px] text-gray-500 font-mono">RBAC identity</span>
                    </div>

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
                  <div className="space-y-4">
                    {containers.map((c, idx) => {
                      const cName = c.name || `container-${idx}`;
                      const cStatus = containerStatuses.find((s) => s.name === c.name);
                      const isReady = cStatus?.ready ?? true;
                      const stateObj = cStatus?.state || {};
                      const stateKey = Object.keys(stateObj)[0] || 'running';
                      const restarts = cStatus?.restartCount ?? 0;

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

                      return (
                        <div
                          key={cName}
                          className="rounded-xl bg-[#0B0F17] border border-border/70 shadow-sm overflow-hidden transition-all hover:border-border/90"
                        >
                          {/* Container Header */}
                          <div
                            onClick={() => setExpandedContainers((prev) => ({ ...prev, [cName]: !isContainerOpen }))}
                            className="p-4 flex flex-wrap items-center justify-between gap-3 bg-surface/80 hover:bg-surface-elevated/60 cursor-pointer border-b border-border/60 select-none transition-colors"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedContainers((prev) => ({ ...prev, [cName]: !isContainerOpen }));
                                }}
                                className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-surface-elevated transition-colors"
                              >
                                {isContainerOpen ? <ChevronDown className="w-4 h-4 text-brand-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                              </button>
                              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isReady ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]' : 'bg-amber-400'}`} />
                              <span className="font-mono font-bold text-sm text-gray-100">{c.name}</span>
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800 font-semibold">
                                {isReady ? 'Ready' : 'Not Ready'}
                              </span>
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface-elevated text-indigo-300 border border-border">
                                {stateKey}
                              </span>
                              {restarts > 0 && (
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700 font-semibold">
                                  {restarts} {restarts === 1 ? 'restart' : 'restarts'}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-2.5 shrink-0">
                              {/* Direct SSH / Exec button into this container */}
                              {hasExec && onExec && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onExec({ name: currentResource.name, namespace: activeNamespace }, c.name);
                                    onClose();
                                  }}
                                  disabled={isReadOnly}
                                  className={`px-3 py-1.5 rounded-lg bg-teal-950/80 hover:bg-teal-900 border border-teal-700/80 text-teal-300 hover:text-teal-100 text-xs font-mono font-semibold transition-all flex items-center space-x-1.5 shadow-sm ${
                                    isReadOnly ? 'opacity-40 cursor-not-allowed' : ''
                                  }`}
                                  title={`Open SSH / Exec shell in ${c.name}`}
                                >
                                  <Terminal className="w-3.5 h-3.5 text-teal-400" />
                                  <span>SSH / Shell</span>
                                </button>
                              )}

                              {/* Container Image */}
                              <div className="flex items-center space-x-1.5 text-xs font-mono bg-[#070A0F] px-3 py-1.5 rounded-lg border border-border/80 max-w-xs md:max-w-md">
                                <span className="text-gray-500 select-none">image:</span>
                                <span className="text-cyan-300 truncate font-semibold" title={c.image}>
                                  {c.image}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(c.image);
                                  }}
                                  className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors ml-1"
                                  title="Copy Image URL"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Collapsible Container Body */}
                          {isContainerOpen && (
                            <div className="p-5 space-y-4 bg-[#0B0F17]">
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
                                  <span className="text-[11px] text-gray-400 font-semibold flex items-center space-x-1.5">
                                    <Cpu className="w-3.5 h-3.5 text-pink-400" />
                                    <span>Resources (Requests / Limits)</span>
                                  </span>
                                  <div className="grid grid-cols-2 gap-3 text-[11px] pt-1">
                                    <div className="bg-surface/50 p-2 rounded-lg border border-border/50">
                                      <span className="text-gray-500 block text-[10px] uppercase">CPU</span>
                                      <span className="text-gray-200 font-semibold font-mono">
                                        {c.resources?.requests?.cpu || 'none'} <span className="text-gray-500">/</span> {c.resources?.limits?.cpu || 'none'}
                                      </span>
                                    </div>
                                    <div className="bg-surface/50 p-2 rounded-lg border border-border/50">
                                      <span className="text-gray-500 block text-[10px] uppercase">Memory</span>
                                      <span className="text-gray-200 font-semibold font-mono">
                                        {c.resources?.requests?.memory || 'none'} <span className="text-gray-500">/</span> {c.resources?.limits?.memory || 'none'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Collapsible Environment Variables */}
                              <div className="border border-border/70 rounded-xl overflow-hidden bg-[#070A0F]">
                                <div
                                  onClick={() => setExpandedEnv((prev) => ({ ...prev, [cName]: !isEnvOpen }))}
                                  className="p-3 bg-surface/50 hover:bg-surface-elevated/40 flex items-center justify-between cursor-pointer select-none transition-colors border-b border-border/40"
                                >
                                  <div className="flex items-center space-x-2">
                                    <Key className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="text-xs font-semibold text-gray-200 font-mono">
                                      Environment Variables ({envCount})
                                    </span>
                                  </div>

                                  <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                                    {isEnvOpen && envCount > 4 && (
                                      <div className="relative">
                                        <Search className="w-3 h-3 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                        <input
                                          type="text"
                                          placeholder={`Filter ${envCount} env vars...`}
                                          value={envFilters[cName] || ''}
                                          onChange={(e) => setEnvFilters((prev) => ({ ...prev, [cName]: e.target.value }))}
                                          className="pl-7 pr-6 py-1 bg-[#0B0F17] border border-border rounded-lg text-[11px] font-mono text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500 w-48"
                                        />
                                        {envFilters[cName] && (
                                          <button
                                            onClick={() => setEnvFilters((prev) => ({ ...prev, [cName]: '' }))}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                    <button
                                      onClick={() => setExpandedEnv((prev) => ({ ...prev, [cName]: !isEnvOpen }))}
                                      className="px-2 py-0.5 rounded text-[11px] font-mono text-gray-400 hover:text-white flex items-center space-x-1"
                                    >
                                      <span>{isEnvOpen ? 'Collapse' : 'Expand'}</span>
                                      {isEnvOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                </div>

                                {isEnvOpen && (
                                  <div>
                                    {envCount === 0 ? (
                                      <div className="text-[11px] font-mono text-gray-500 p-4">
                                        No environment variables defined in spec.
                                      </div>
                                    ) : (
                                      <div className="divide-y divide-border/40 font-mono text-xs max-h-72 overflow-y-auto">
                                        {/* envFrom sources */}
                                        {c.envFrom?.map((ef: any, efIdx: number) => (
                                          <div key={efIdx} className="p-3 flex items-center justify-between text-indigo-300 bg-indigo-950/20">
                                            <span className="text-gray-400 text-xs">Include all from:</span>
                                            {ef.configMapRef && (
                                              <button
                                                onClick={() => handleNavigateTo('ConfigMap', ef.configMapRef.name, activeNamespace)}
                                                className="px-2.5 py-1 rounded bg-blue-950 border border-blue-800 text-blue-300 hover:bg-blue-900 hover:text-white text-xs flex items-center space-x-1 transition-colors"
                                              >
                                                <span>ConfigMap: {ef.configMapRef.name}</span>
                                                <ExternalLink className="w-3 h-3" />
                                              </button>
                                            )}
                                            {ef.secretRef && (
                                              <button
                                                onClick={() => handleNavigateTo('Secret', ef.secretRef.name, activeNamespace)}
                                                className="px-2.5 py-1 rounded bg-amber-950 border border-amber-800 text-amber-300 hover:bg-amber-900 hover:text-white text-xs flex items-center space-x-1 transition-colors"
                                              >
                                                <span>Secret: {ef.secretRef.name}</span>
                                                <ExternalLink className="w-3 h-3" />
                                              </button>
                                            )}
                                          </div>
                                        ))}

                                        {/* Key-values */}
                                        {filteredEnv.length === 0 && envFilterQuery ? (
                                          <div className="p-4 text-center text-gray-500 text-xs">
                                            No env variables matching "{envFilters[cName]}"
                                          </div>
                                        ) : (
                                          filteredEnv.map((e: any, eIdx: number) => {
                                            const isSecretRef = !!e.valueFrom?.secretKeyRef;
                                            const isConfigMapRef = !!e.valueFrom?.configMapKeyRef;
                                            const isFieldRef = !!e.valueFrom?.fieldRef;
                                            const secretKeyId = `${cName}-${e.name}`;
                                            const isRevealed = revealedSecrets[secretKeyId];

                                            return (
                                              <div
                                                key={eIdx}
                                                className="p-3 flex items-center justify-between hover:bg-surface-elevated/40 transition-colors gap-3"
                                              >
                                                <span className="font-semibold text-gray-200 text-xs font-mono">{e.name}</span>
                                                <div className="flex items-center space-x-2">
                                                  {isSecretRef ? (
                                                    <div className="flex items-center space-x-1.5">
                                                      <button
                                                        onClick={() => handleNavigateTo('Secret', e.valueFrom.secretKeyRef.name, activeNamespace)}
                                                        className="text-[11px] px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-800/80 text-amber-300 hover:bg-amber-900 hover:text-white transition-colors flex items-center space-x-1 font-mono"
                                                        title={`Inspect Secret ${e.valueFrom.secretKeyRef.name}`}
                                                      >
                                                        <span>Secret: {e.valueFrom.secretKeyRef.name} → {e.valueFrom.secretKeyRef.key}</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                      </button>
                                                      <button
                                                        onClick={() => toggleRevealSecret(secretKeyId)}
                                                        className="p-1 rounded text-gray-400 hover:text-gray-200"
                                                        title={isRevealed ? 'Hide' : 'Reveal Value'}
                                                      >
                                                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-amber-400" />}
                                                      </button>
                                                    </div>
                                                  ) : isConfigMapRef ? (
                                                    <button
                                                      onClick={() => handleNavigateTo('ConfigMap', e.valueFrom.configMapKeyRef.name, activeNamespace)}
                                                      className="text-[11px] px-2.5 py-1 rounded-md bg-blue-950/60 border border-blue-800/80 text-blue-300 hover:bg-blue-900 hover:text-white transition-colors flex items-center space-x-1 font-mono"
                                                      title={`Inspect ConfigMap ${e.valueFrom.configMapKeyRef.name}`}
                                                    >
                                                      <span>ConfigMap: {e.valueFrom.configMapKeyRef.name} → {e.valueFrom.configMapKeyRef.key}</span>
                                                      <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                  ) : isFieldRef ? (
                                                    <span className="text-[11px] px-2.5 py-1 rounded-md bg-indigo-950/60 border border-indigo-800/80 text-indigo-300 font-mono">
                                                      Field: {e.valueFrom.fieldRef.fieldPath}
                                                    </span>
                                                  ) : (
                                                    <div className="flex items-center space-x-1.5">
                                                      <span className="text-gray-300 text-xs max-w-sm lg:max-w-md truncate font-mono bg-[#0B0F17] px-2.5 py-1 rounded border border-border/50">
                                                        {e.value !== undefined ? String(e.value) : '""'}
                                                      </span>
                                                      {e.value !== undefined && (
                                                        <button
                                                          onClick={() => navigator.clipboard.writeText(String(e.value))}
                                                          className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-surface-elevated transition-colors"
                                                          title="Copy Value"
                                                        >
                                                          <Copy className="w-3 h-3" />
                                                        </button>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Collapsible Volume Mounts */}
                              <div className="border border-border/70 rounded-xl overflow-hidden bg-[#070A0F]">
                                <div
                                  onClick={() => setExpandedMounts((prev) => ({ ...prev, [cName]: !isMountsOpen }))}
                                  className="p-3 bg-surface/50 hover:bg-surface-elevated/40 flex items-center justify-between cursor-pointer select-none transition-colors border-b border-border/40"
                                >
                                  <div className="flex items-center space-x-2">
                                    <FolderTree className="w-3.5 h-3.5 text-indigo-400" />
                                    <span className="text-xs font-semibold text-gray-200 font-mono">
                                      Volume Mounts ({mountsCount})
                                    </span>
                                  </div>

                                  <button
                                    onClick={() => setExpandedMounts((prev) => ({ ...prev, [cName]: !isMountsOpen }))}
                                    className="px-2 py-0.5 rounded text-[11px] font-mono text-gray-400 hover:text-white flex items-center space-x-1"
                                  >
                                    <span>{isMountsOpen ? 'Collapse' : 'Expand'}</span>
                                    {isMountsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                  </button>
                                </div>

                                {isMountsOpen && (
                                  <div>
                                    {mountsCount === 0 ? (
                                      <div className="text-[11px] font-mono text-gray-500 p-4">
                                        No custom volume mounts attached.
                                      </div>
                                    ) : (
                                      <div className="divide-y divide-border/40 font-mono text-xs max-h-56 overflow-y-auto">
                                        {c.volumeMounts.map((vm: any, vmIdx: number) => (
                                          <div
                                            key={vmIdx}
                                            className="p-3 flex items-center justify-between hover:bg-surface-elevated/40 transition-colors gap-3"
                                          >
                                            <div className="flex items-center space-x-2 min-w-0">
                                              <span className="font-semibold text-cyan-300 font-mono text-xs">{vm.mountPath}</span>
                                              {vm.readOnly && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-border/50 font-mono">
                                                  ro
                                                </span>
                                              )}
                                              {vm.subPath && (
                                                <span className="text-[11px] text-gray-400 font-mono">
                                                  (subPath: {vm.subPath})
                                                </span>
                                              )}
                                            </div>
                                            <span className="text-xs text-indigo-300 bg-indigo-950/60 px-2.5 py-1 rounded-md border border-indigo-800/60 font-mono shrink-0">
                                              from: {vm.name}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                  <div className="space-y-3">
                    {initContainers.map((ic: any, icIdx: number) => {
                      const icStatus = initContainerStatuses.find((s) => s.name === ic.name);
                      const isReady = icStatus?.ready ?? false;
                      const stateObj = icStatus?.state || {};
                      const stateKey = Object.keys(stateObj)[0] || 'terminated';

                      return (
                        <div key={icIdx} className="p-3.5 rounded-xl bg-surface border border-border/80 flex items-center justify-between text-xs font-mono">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${isReady ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                            <span className="font-bold text-gray-200">{ic.name}</span>
                            <span className="text-[11px] text-gray-400">({ic.image})</span>
                          </div>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-surface-elevated text-gray-300 border border-border">
                            {stateKey}
                          </span>
                        </div>
                      );
                    })}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                        <div
                          key={vIdx}
                          onClick={() => {
                            if (targetKind && targetName) {
                              handleNavigateTo(targetKind, targetName, activeNamespace);
                            }
                          }}
                          className={`p-3.5 rounded-xl bg-surface border border-border/80 space-y-2 font-mono text-xs transition-all ${
                            targetKind && targetName
                              ? 'hover:border-brand-500/70 hover:bg-surface-elevated cursor-pointer group shadow-sm'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-200 truncate max-w-[200px] flex items-center space-x-1.5" title={v.name}>
                              <span>{v.name}</span>
                              {targetKind && targetName && (
                                <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-brand-300 transition-colors shrink-0" />
                              )}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800">
                              {typeLabel}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 bg-[#0B0F17] p-2 rounded border border-border/40 truncate">
                            {sourceDesc || 'default'}
                          </div>
                        </div>
                      );
                    })}
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
            ) : activeTab === 'metadata' ? (
              <div className="space-y-6">
                <MetadataLabelsAnnotations
                  labels={labels}
                  annotations={annotations}
                  podTemplateLabels={podTemplateLabels}
                  podTemplateAnnotations={podTemplateAnnotations}
                />
              </div>
            ) : activeTab === 'metrics' && (isPodOrWorkload || isNode) ? (
          <div className="space-y-5">
            {/* Telemetry 4-Grid Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. CPU Usage Card */}
              <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-gray-200">
                      <Cpu className="w-4 h-4 text-pink-400" />
                      <span>CPU Utilization</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-pink-400">
                      {latestCpu.toFixed(0)}m / 0.50 cores
                    </span>
                  </div>
                  <div className="w-full pt-1">
                    {renderChartWithAxes(cpuHistory, '#ec4899', 'm', 100, (v) => `${v.toFixed(0)}m`)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-[11px] font-mono text-gray-400">
                    <div>
                      <span className="text-gray-500 block">Usage</span>
                      <span className="text-gray-200 font-semibold">{latestCpu.toFixed(0)}m</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Request</span>
                      <span className="text-emerald-400 font-semibold">100m</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Limit</span>
                      <span className="text-cyan-400 font-semibold">500m</span>
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
                    <span className="text-xs font-mono font-bold text-indigo-400">
                      {latestMem.toFixed(0)} MiB / 1024 MiB
                    </span>
                  </div>
                  <div className="w-full pt-1">
                    {renderChartWithAxes(memHistory, '#6366f1', 'MiB', 500, (v) => `${v.toFixed(0)}M`)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-[11px] font-mono text-gray-400">
                    <div>
                      <span className="text-gray-500 block">Working Set</span>
                      <span className="text-gray-200 font-semibold">{latestMem.toFixed(0)} MiB</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Request</span>
                      <span className="text-emerald-400 font-semibold">128 MiB</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Limit</span>
                      <span className="text-cyan-400 font-semibold">1024 MiB</span>
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
                    {renderChartWithAxes(netRxHistory, '#10b981', 'KB/s', 300, (v) => `${v.toFixed(0)}K`)}
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
                    {renderChartWithAxes(diskHistory, '#f59e0b', 'GiB', 5.0, (v) => `${v.toFixed(1)}G`)}
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
                    <span className="text-emerald-400 font-semibold font-mono">Low (&lt; 30%)</span>
                  </div>
                  <div className="bg-surface-elevated p-2.5 rounded-lg border border-border/60">
                    <span className="text-gray-500 text-[11px] block">QoS Class</span>
                    <span className="text-indigo-300 font-semibold font-mono">{status?.qosClass || 'Burstable'}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
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
