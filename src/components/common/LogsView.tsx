import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Download,
  WrapText,
  Clock,
} from 'lucide-react';
import { api, isTauri } from '../../api/tauriClient';
import { PodSummary } from '../../types/cluster';
import { save } from '@tauri-apps/plugin-dialog';

interface LogsViewProps {
  isActive: boolean;
  onClose: () => void;
  resource: {
    kind: string;
    name: string;
    namespace: string;
  } | null;
}

export const LogsView: React.FC<LogsViewProps> = ({
  isActive,
  onClose,
  resource,
}) => {
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
  const logsEndRef = useRef<HTMLDivElement>(null);

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
    if (!isActive || !resourceName) return;
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
  }, [isActive, namespace, resourceName, isWorkload]);

  // 2. Discover containers for the target pod
  useEffect(() => {
    if (!isActive || !resourceName) return;
    let cancelled = false;

    const targetPod = selectedPodName === 'all' && matchingPods.length > 0 ? matchingPods[0].name : (selectedPodName || resourceName);
    if (!targetPod) return;

    api
      .listContainers(namespace, targetPod)
      .then((names) => {
        if (cancelled) return;
        setContainers(names);
        if (names.length > 0) {
          if (container === 'all' || !names.includes(container)) {
            setContainer(names[0]);
          }
        }
      })
      .catch(() => setContainers([]));

    return () => {
      cancelled = true;
    };
  }, [isActive, namespace, selectedPodName, matchingPods, resourceName, container]);

  // Reset core state when the target resource changes
  useEffect(() => {
    setLogs([]);
    setError(null);
    setSearchQuery('');
    setContainer('all');
    setPrevious(false);
    setTimestamps(false);
    setIsFollowing(true);
    setFilterOnlyMatches(false);
    setLogLevel('all');
  }, [resource?.name]);

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
    if (!isActive || !resource) {
      setLogs([]);
      setError(null);
      return;
    }
    fetchLogs();
    if (!isFollowing) return;
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [isActive, resource, isFollowing, fetchLogs]);

  useEffect(() => {
    if (isFollowing && logsEndRef.current && isActive) {
      logsEndRef.current.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
    }
  }, [logs, isFollowing, filterOnlyMatches, searchQuery, isActive]);

  const download = async () => {
    const defaultName = `${resourceName}${container !== 'all' ? `-${container}` : ''}.log`;
    
    if (isTauri) {
      try {
        const filePath = await save({
          defaultPath: defaultName,
          filters: [{ name: 'Log File', extensions: ['log', 'txt'] }]
        });
        if (filePath) {
          await api.saveFile(filePath, logs.join('\n'));
        }
      } catch (err) {
        console.error('Failed to save file in Tauri:', err);
      }
    } else {
      const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Filtered logs computation
  const filteredLogs = useMemo(() => {
    let result = logs;

    if (logLevel !== 'all') {
      result = result.filter((line) => {
        const lower = line.toLowerCase();
        if (logLevel === 'error') return lower.includes('error') || lower.includes('err') || lower.includes('fatal') || lower.includes('panic');
        if (logLevel === 'warn') return lower.includes('warn') || lower.includes('warning');
        if (logLevel === 'info') return lower.includes('info') || lower.includes('notice');
        return true;
      });
    }

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

  if (!isActive || !resource) return null;

  return (
    <div className="flex flex-col h-full w-full bg-[#090D16]">
      {/* Top Toolbar */}
      <div className="shrink-0 px-4 py-2 border-b border-border flex items-center justify-between gap-4 overflow-x-auto">
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

        <div className="flex items-center space-x-2 shrink-0">
          {isWorkload && matchingPods.length > 0 && (
            <select
              value={selectedPodName}
              onChange={(e) => setSelectedPodName(e.target.value)}
              className="bg-surface-elevated border border-border text-xs text-gray-200 rounded-md px-2 py-1 outline-none cursor-pointer"
            >
              <option value="all">All Pods ({matchingPods.length})</option>
              {matchingPods.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          )}

          {containers.length > 0 && (
            <select
              value={container}
              onChange={(e) => setContainer(e.target.value)}
              className="bg-surface-elevated border border-border text-xs text-gray-200 rounded-md px-2 py-1 outline-none cursor-pointer"
            >
              {containers.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => setIsFollowing(!isFollowing)}
            className={`px-2 py-1 rounded text-xs border ${isFollowing ? 'bg-emerald-900 text-emerald-200' : 'bg-surface-elevated text-gray-400'}`}
          >
            {isFollowing ? 'Live' : 'Paused'}
          </button>
          
          <button onClick={() => setTimestamps(!timestamps)} className="p-1.5 border border-border rounded text-gray-400">
            <Clock className="w-3.5 h-3.5" />
          </button>
          
          <button onClick={() => setWrapLines(!wrapLines)} className="p-1.5 border border-border rounded text-gray-400">
            <WrapText className="w-3.5 h-3.5" />
          </button>
          
          <button onClick={download} className="p-1.5 border border-border rounded text-gray-400">
            <Download className="w-3.5 h-3.5" />
          </button>

          <button onClick={onClose} className="p-1.5 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="px-4 py-2 border-b border-border/80 bg-surface/70 flex items-center justify-between gap-2 shrink-0 text-xs">
        <div className="flex items-center space-x-2 flex-1">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 max-w-sm px-3 py-1 bg-[#0A0A0C] border border-border rounded-lg text-xs font-mono text-gray-100"
          />
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            className={`px-1.5 py-0.5 rounded text-[11px] font-mono border ${caseSensitive ? 'bg-indigo-900/60 border-indigo-500 text-indigo-200' : 'bg-surface-elevated border-border text-gray-400'}`}
            title="Match Case"
          >
            Aa
          </button>
          <button
            onClick={() => setIsRegex(!isRegex)}
            className={`px-1.5 py-0.5 rounded text-[11px] font-mono border ${isRegex ? 'bg-indigo-900/60 border-indigo-500 text-indigo-200' : 'bg-surface-elevated border-border text-gray-400'}`}
            title="Use Regular Expression"
          >
            .*
          </button>
          <button
            onClick={() => setFilterOnlyMatches(!filterOnlyMatches)}
            className={`px-2 py-1 rounded border ${filterOnlyMatches ? 'bg-brand-900 text-brand-200' : 'bg-surface-elevated text-gray-400'}`}
          >
            Filter
          </button>
          {searchQuery && (
            <span className="text-gray-400 font-mono text-[11px] px-1.5 py-0.5 bg-surface-elevated border border-border rounded">
              {matchCount} {matchCount === 1 ? 'match' : 'matches'}
            </span>
          )}
        </div>
      </div>

      {/* Terminal Area */}
      <div className="flex-1 p-4 bg-[#07090E] overflow-auto font-mono text-[12px] text-gray-300">
        {error ? (
          <div className="text-rose-400 p-2 bg-rose-950/20 border border-rose-900/50 rounded">{error}</div>
        ) : (
          filteredLogs.map((log, i) => (
            <div
              key={i}
              className={`hover:bg-white/5 ${wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}
            >
              {renderLogLine(log)}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
