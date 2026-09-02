import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Download,
  Play,
  Pause,
  AlertTriangle,
  Layers,
  Box,
  Search,
  Filter,
  WrapText,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../api/tauriClient';
import { PodSummary } from '../../types/cluster';

interface LogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: any | null;
}

export const LogsModal: React.FC<LogsModalProps> = ({ isOpen, onClose, resource }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isFollowing, setIsFollowing] = useState(true);
  const [matchingPods, setMatchingPods] = useState<PodSummary[]>([]);
  const [selectedPodName, setSelectedPodName] = useState<string>('all');
  const [containers, setContainers] = useState<string[]>([]);
  const [container, setContainer] = useState<string>('all');
  const [previous, setPrevious] = useState(false);
  const [timestamps, setTimestamps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wrapLines, setWrapLines] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOnlyMatches, setFilterOnlyMatches] = useState(false);
  const [logLevel, setLogLevel] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [isRegex, setIsRegex] = useState(false);

  const namespace = resource?.namespace || 'default';
  const resourceName = resource?.name;
  const kind = (resource?.kind || 'pod').toLowerCase();
  const isWorkload = ['deployment', 'deployments', 'statefulset', 'statefulsets', 'daemonset', 'daemonsets', 'job', 'jobs'].includes(kind);

  // 1. Discover pods for deployment / workload or set single pod
  useEffect(() => {
    if (!isOpen || !resourceName) return;
    let cancelled = false;

    if (isWorkload) {
      api.listPods(namespace).then((allPods) => {
        if (cancelled) return;
        const matched = allPods.filter((p) =>
          p.name.startsWith(resourceName) || (p.name.includes(resourceName) && p.namespace === namespace)
        );
        setMatchingPods(matched);
        if (matched.length > 0) {
          setSelectedPodName('all');
        } else {
          setSelectedPodName(resourceName);
        }
      }).catch(() => {
        if (!cancelled) setMatchingPods([]);
      });
    } else {
      setSelectedPodName(resourceName);
      setMatchingPods([]);
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, namespace, resourceName, isWorkload]);

  // 2. Discover containers for the target pod
  useEffect(() => {
    if (!isOpen || !resourceName) return;
    let cancelled = false;

    const targetPod = selectedPodName === 'all' && matchingPods.length > 0 ? matchingPods[0].name : (selectedPodName || resourceName);
    if (!targetPod) return;

    api
      .listContainers(namespace, targetPod)
      .then((names) => {
        if (cancelled) return;
        setContainers(names);
        if (names.length === 1) {
          setContainer(names[0]);
        }
      })
      .catch(() => setContainers([]));

    return () => {
      cancelled = true;
    };
  }, [isOpen, namespace, selectedPodName, matchingPods, resourceName]);

  // 3. Fetch logs based on pod and container selection
  const fetchLogs = useCallback(async () => {
    if (!resourceName) return;
    try {
      if (isWorkload && selectedPodName === 'all' && matchingPods.length > 0) {
        // Multi-pod aggregated logs
        const results = await Promise.all(
          matchingPods.slice(0, 5).map(async (pod) => {
            try {
              const text = await api.getLogs(namespace, pod.name, {
                container: container !== 'all' ? container : undefined,
                previous,
                timestamps,
                tailLines: 200,
              });
              return text
                .split('\n')
                .filter(Boolean)
                .map((line) => `[${pod.name}] ${line}`);
            } catch {
              return [];
            }
          })
        );
        const merged = results.flat();
        setLogs(merged.length ? merged : ['(no output from workload pods)']);
        setError(null);
      } else {
        // Single pod log fetch
        const targetPod = selectedPodName !== 'all' ? selectedPodName : (matchingPods[0]?.name || resourceName);
        const text = await api.getLogs(namespace, targetPod, {
          container: container !== 'all' ? container : undefined,
          previous,
          timestamps,
        });
        setLogs(text.length ? text.split('\n') : ['(no output)']);
        setError(null);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }, [namespace, resourceName, isWorkload, selectedPodName, matchingPods, container, previous, timestamps]);

  useEffect(() => {
    if (!isOpen || !resource) {
      setLogs([]);
      setError(null);
      return;
    }
    fetchLogs();
    if (!isFollowing) return;
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [isOpen, resource, isFollowing, fetchLogs]);

  useEffect(() => {
    if (isFollowing && !filterOnlyMatches && !searchQuery && bottomRef.current?.scrollIntoView) {
      bottomRef.current.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
  }, [logs, isFollowing, filterOnlyMatches, searchQuery]);

  const download = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resourceName}${container !== 'all' ? `-${container}` : ''}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered logs computation
  const filteredLogs = useMemo(() => {
    let result = logs;

    // Filter by Log Level if selected
    if (logLevel !== 'all') {
      result = result.filter((line) => {
        const lower = line.toLowerCase();
        if (logLevel === 'error') return lower.includes('error') || lower.includes('err') || lower.includes('fatal') || lower.includes('panic');
        if (logLevel === 'warn') return lower.includes('warn') || lower.includes('warning');
        if (logLevel === 'info') return lower.includes('info') || lower.includes('notice');
        return true;
      });
    }

    // Filter by search query if in "filter only" mode
    if (searchQuery.trim()) {
      try {
        const regex = isRegex
          ? new RegExp(searchQuery, caseSensitive ? 'g' : 'gi')
          : null;

        if (filterOnlyMatches) {
          result = result.filter((line) => {
            if (regex) return regex.test(line);
            if (caseSensitive) return line.includes(searchQuery);
            return line.toLowerCase().includes(searchQuery.toLowerCase());
          });
        }
      } catch {
        // invalid regex, keep results
      }
    }

    return result;
  }, [logs, logLevel, searchQuery, filterOnlyMatches, isRegex, caseSensitive]);

  // Total matching count in the active log view
  const matchCount = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    try {
      const regex = isRegex
        ? new RegExp(searchQuery, caseSensitive ? 'g' : 'gi')
        : new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');

      let count = 0;
      for (const line of filteredLogs) {
        const matches = line.match(regex);
        if (matches) count += matches.length;
      }
      return count;
    } catch {
      return 0;
    }
  }, [filteredLogs, searchQuery, isRegex, caseSensitive]);

  // Highlight matches helper
  const renderLogLine = (line: string) => {
    if (!searchQuery.trim()) return line;
    try {
      const regex = isRegex
        ? new RegExp(`(${searchQuery})`, caseSensitive ? 'g' : 'gi')
        : new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, caseSensitive ? 'g' : 'gi');

      const parts = line.split(regex);
      return parts.map((part, i) => {
        const isMatch = isRegex
          ? new RegExp(`^${searchQuery}$`, caseSensitive ? '' : 'i').test(part)
          : caseSensitive
          ? part === searchQuery
          : part.toLowerCase() === searchQuery.toLowerCase();

        return isMatch ? (
          <mark key={i} className="bg-amber-400/30 text-amber-200 px-0.5 rounded font-bold border-b border-amber-400">
            {part}
          </mark>
        ) : (
          part
        );
      });
    } catch {
      return line;
    }
  };

  if (!isOpen || !resource) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end pointer-events-none">
      <div className="w-[1020px] max-w-[85vw] h-full bg-surface-elevated border-l border-border shadow-2xl flex flex-col transform transition-transform duration-300 pointer-events-auto">
        {/* Header */}
        <div className="h-14 border-b border-border px-4 flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 shrink-0 font-mono">
                {resource.kind || 'Pod'} Logs
              </span>
              <h2 className="text-sm font-bold text-gray-100 truncate font-mono">
                {resource.name}
              </h2>
              <span className="text-xs text-gray-400 font-mono">({namespace})</span>
            </div>
          </div>

          {/* Quick Actions & Controls */}
          <div className="flex items-center space-x-2">
            {/* Pod Selector for Workloads */}
            {isWorkload && matchingPods.length > 0 && (
              <div className="flex items-center space-x-1 bg-surface-elevated border border-border rounded-md px-2 py-1">
                <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <select
                  value={selectedPodName}
                  onChange={(e) => setSelectedPodName(e.target.value)}
                  className="bg-transparent text-xs text-gray-200 outline-none cursor-pointer max-w-[140px] truncate font-mono"
                  title="Select Pod Instance"
                >
                  <option value="all" className="bg-surface-elevated text-gray-200">
                    All Pods ({matchingPods.length})
                  </option>
                  {matchingPods.map((p) => (
                    <option key={p.name} value={p.name} className="bg-surface-elevated text-gray-200 font-mono">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Container Selector */}
            {containers.length > 0 && (
              <div className="flex items-center space-x-1 bg-surface-elevated border border-border rounded-md px-2 py-1">
                <Box className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <select
                  value={container}
                  onChange={(e) => setContainer(e.target.value)}
                  className="bg-transparent text-xs text-gray-200 outline-none cursor-pointer max-w-[130px] truncate font-mono"
                  title="Select Container"
                >
                  <option value="all" className="bg-surface-elevated text-gray-200">
                    All Containers
                  </option>
                  {containers.map((c) => (
                    <option key={c} value={c} className="bg-surface-elevated text-gray-200 font-mono">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Live Streaming Toggle */}
            <button
              onClick={() => setIsFollowing(!isFollowing)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                isFollowing
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                  : 'bg-surface-elevated text-gray-400 hover:text-gray-200 border border-border'
              }`}
              title={isFollowing ? 'Live stream active' : 'Stream paused'}
            >
              {isFollowing ? <Pause className="w-3 h-3 text-emerald-400" /> : <Play className="w-3 h-3 text-gray-400" />}
              <span>{isFollowing ? 'Live' : 'Paused'}</span>
            </button>

            {/* Timestamps */}
            <button
              onClick={() => setTimestamps(!timestamps)}
              className={`p-1.5 rounded-md text-xs font-medium border transition-colors ${
                timestamps ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700' : 'bg-surface-elevated text-gray-400 hover:text-gray-200 border-border'
              }`}
              title="Toggle Timestamps"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>

            {/* Wrap Lines */}
            <button
              onClick={() => setWrapLines(!wrapLines)}
              className={`p-1.5 rounded-md text-xs font-medium border transition-colors ${
                wrapLines ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700' : 'bg-surface-elevated text-gray-400 hover:text-gray-200 border-border'
              }`}
              title="Toggle Line Wrap"
            >
              <WrapText className="w-3.5 h-3.5" />
            </button>

            {/* Previous Container Crashes */}
            <button
              onClick={() => setPrevious(!previous)}
              className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
                previous ? 'bg-amber-950/80 text-amber-300 border-amber-800' : 'bg-surface-elevated text-gray-400 hover:text-gray-200 border-border'
              }`}
              title="Show terminated container crash logs"
            >
              <RotateCcw className="w-3 h-3 inline mr-1" />
              <span>Crash/Prev</span>
            </button>

            {/* Download */}
            <button
              onClick={download}
              className="p-1.5 rounded-md hover:bg-surface-elevated text-gray-400 hover:text-gray-200 transition-colors border border-border"
              title="Download Logs as File"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-4 bg-border mx-0.5" />

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-surface-elevated text-gray-400 hover:text-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="px-4 py-2 border-b border-border/80 bg-surface/70 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center space-x-2 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search log lines, regex, error traces..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1 bg-[#0A0A0C] border border-border rounded-lg text-xs font-mono text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Match Counter Badge */}
            {searchQuery && (
              <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
                matchCount > 0
                  ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                  : 'bg-surface-elevated text-gray-400 border-border'
              }`}>
                {matchCount} match{matchCount === 1 ? '' : 'es'}
              </span>
            )}

            {/* Filter Lines Mode Toggle */}
            <button
              onClick={() => setFilterOnlyMatches(!filterOnlyMatches)}
              className={`px-2 py-1 rounded text-xs font-medium border transition-colors flex items-center space-x-1 ${
                filterOnlyMatches
                  ? 'bg-brand-950/80 text-brand-300 border-brand-700'
                  : 'bg-surface-elevated text-gray-400 hover:text-gray-200 border-border'
              }`}
              title="Show only matching lines"
            >
              <Filter className="w-3 h-3" />
              <span>Filter Lines</span>
            </button>

            {/* Case Sensitive Toggle */}
            <button
              onClick={() => setCaseSensitive(!caseSensitive)}
              className={`px-1.5 py-1 rounded font-mono text-[11px] font-bold border transition-colors ${
                caseSensitive
                  ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700'
                  : 'bg-surface-elevated text-gray-500 hover:text-gray-300 border-border'
              }`}
              title="Toggle Match Case (Case Sensitive)"
            >
              Aa
            </button>

            {/* Regex Toggle */}
            <button
              onClick={() => setIsRegex(!isRegex)}
              className={`px-1.5 py-1 rounded font-mono text-[11px] font-bold border transition-colors ${
                isRegex
                  ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700'
                  : 'bg-surface-elevated text-gray-500 hover:text-gray-300 border-border'
              }`}
              title="Toggle Regular Expression (Regex)"
            >
              .*
            </button>
          </div>

          {/* Log Level Quick Filter Badges */}
          <div className="flex items-center space-x-1">
            <span className="text-[11px] text-gray-500 mr-1 font-mono uppercase">Level:</span>
            {(['all', 'error', 'warn', 'info'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLogLevel(lvl)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium font-mono uppercase border transition-colors ${
                  logLevel === lvl
                    ? lvl === 'error'
                      ? 'bg-red-950 text-red-300 border-red-700 font-bold'
                      : lvl === 'warn'
                      ? 'bg-amber-950 text-amber-300 border-amber-700 font-bold'
                      : lvl === 'info'
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-700 font-bold'
                      : 'bg-brand-950 text-brand-300 border-brand-700 font-bold'
                    : 'bg-surface-elevated text-gray-400 hover:text-gray-200 border-border/70'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Terminal / Log Output Area */}
        <div className="flex-1 p-4 bg-[#07090E] overflow-auto font-mono text-[12px] leading-relaxed text-gray-300 select-text">
          {error ? (
            <div className="flex items-start space-x-2 text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold mb-1">Could not read logs</div>
                <div className="text-amber-200/80 whitespace-pre-wrap font-mono text-xs">{error}</div>
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-xs text-gray-500 font-mono">
              {searchQuery ? `No log lines matching "${searchQuery}"` : 'No log lines output yet.'}
            </div>
          ) : (
            filteredLogs.map((log, i) => {
              const isErr = log.toLowerCase().includes('error') || log.toLowerCase().includes('fatal') || log.toLowerCase().includes('panic');
              const isWrn = log.toLowerCase().includes('warn') || log.toLowerCase().includes('warning');

              return (
                <div
                  key={i}
                  className={`hover:bg-white/5 px-2 -mx-2 rounded transition-colors ${
                    wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto'
                  } ${
                    isErr ? 'text-rose-300/90' : isWrn ? 'text-amber-300/90' : 'text-gray-300'
                  }`}
                >
                  {renderLogLine(log)}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
};
