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
import { stripAnsi, renderAnsiLine } from '../../utils/ansiRenderer';

interface LogsViewProps {
  isActive: boolean;
  onClose: () => void;
  resource: {
    kind: string;
    name: string;
    namespace: string;
  } | null;
}

interface LogLineItemProps {
  log: string;
  searchQuery: string;
  caseSensitive: boolean;
  isRegex: boolean;
  wrapLines: boolean;
}

/**
 * High-performance memoized line renderer.
 * Prevents re-parsing ANSI escape sequences for lines that have not changed.
 */
const LogLineItem = React.memo<LogLineItemProps>(
  ({ log, searchQuery, caseSensitive, isRegex, wrapLines }) => {
    return (
      <div
        className={`hover:bg-white/5 ${
          wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
        }`}
      >
        {renderAnsiLine(log, searchQuery, caseSensitive, isRegex)}
      </div>
    );
  }
);
LogLineItem.displayName = 'LogLineItem';

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

  const terminalRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);

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
        setMatchingPods((prev) => {
          if (prev.length === matched.length && prev.every((p, idx) => p.name === matched[idx]?.name)) {
            return prev;
          }
          return matched;
        });
        setSelectedPodName((prev) => (prev === 'all' || !matched.some((m) => m.name === prev) ? 'all' : prev));
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
        setContainers((prev) => {
          if (prev.length === names.length && prev.every((n, i) => n === names[i])) {
            return prev;
          }
          return names;
        });
        if (names.length > 0) {
          setContainer((prev) => (prev !== 'all' && names.includes(prev) ? prev : names[0]));
        }
      })
      .catch(() => setContainers([]));

    return () => {
      cancelled = true;
    };
  }, [isActive, namespace, selectedPodName, matchingPods, resourceName]);

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
    if (!resourceName || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      if (isWorkload && selectedPodName === 'all' && matchingPods.length > 0) {
        // Multi-pod aggregated logs
        const results = await Promise.all(
          matchingPods.slice(0, 3).map(async (pod) => {
            try {
              const text = await api.getLogs(namespace, pod.name, {
                container: container !== 'all' ? container : undefined,
                previous,
                timestamps,
                tailLines: 150,
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
        const newLogs = merged.length ? merged : ['(no output from workload pods)'];
        setLogs((prev) => {
          if (
            prev.length === newLogs.length &&
            (newLogs.length === 0 || prev[prev.length - 1] === newLogs[newLogs.length - 1])
          ) {
            return prev;
          }
          return newLogs;
        });
        setError(null);
      } else {
        // Single pod log fetch
        const targetPod = selectedPodName !== 'all' ? selectedPodName : (matchingPods[0]?.name || resourceName);
        const text = await api.getLogs(namespace, targetPod, {
          container: container !== 'all' ? container : undefined,
          previous,
          timestamps,
          tailLines: 300,
        });
        const newLogs = text.length ? text.split('\n') : ['(no output)'];
        setLogs((prev) => {
          if (
            prev.length === newLogs.length &&
            (newLogs.length === 0 || prev[prev.length - 1] === newLogs[newLogs.length - 1])
          ) {
            return prev;
          }
          return newLogs;
        });
        setError(null);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      isFetchingRef.current = false;
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
    const interval = setInterval(fetchLogs, 4000);
    return () => clearInterval(interval);
  }, [isActive, resource, isFollowing, fetchLogs]);

  // Instant, non-blocking auto-scroll to bottom if following
  useEffect(() => {
    if (isFollowing && terminalRef.current && isActive) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, isFollowing, isActive]);

  // Handle user scrolling: pause auto-follow when scrolled up, resume when at bottom
  const handleScroll = useCallback(() => {
    if (!terminalRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 60;
    if (atBottom !== isFollowing) {
      setIsFollowing(atBottom);
    }
  }, [isFollowing]);

  const download = async () => {
    const defaultName = `${resourceName}${container !== 'all' ? `-${container}` : ''}.log`;
    const cleanLogContent = logs.map((l) => stripAnsi(l)).join('\n');
    
    if (isTauri) {
      try {
        const filePath = await save({
          defaultPath: defaultName,
          filters: [{ name: 'Log File', extensions: ['log', 'txt'] }]
        });
        if (filePath) {
          await api.saveFile(filePath, cleanLogContent);
        }
      } catch (err) {
        console.error('Failed to save file in Tauri:', err);
      }
    } else {
      const blob = new Blob([cleanLogContent], { type: 'text/plain' });
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
        const clean = stripAnsi(line).toLowerCase();
        if (logLevel === 'error') return clean.includes('error') || clean.includes('err') || clean.includes('fatal') || clean.includes('panic');
        if (logLevel === 'warn') return clean.includes('warn') || clean.includes('warning');
        if (logLevel === 'info') return clean.includes('info') || clean.includes('notice');
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
            const clean = stripAnsi(line);
            if (regex) return regex.test(clean);
            if (caseSensitive) return clean.includes(searchQuery);
            return clean.toLowerCase().includes(searchQuery.toLowerCase());
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
        const clean = stripAnsi(line);
        const matches = clean.match(regex);
        if (matches) count += matches.length;
      }
      return count;
    } catch {
      return 0;
    }
  }, [filteredLogs, searchQuery, isRegex, caseSensitive]);

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
              title="Filter logs by pod"
              aria-label="Filter logs by pod"
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
              title="Filter logs by container"
              aria-label="Filter logs by container"
            >
              {containers.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => setIsFollowing(!isFollowing)}
            className={`px-2 py-1 rounded text-xs border ${isFollowing ? 'bg-emerald-900 text-emerald-200' : 'bg-surface-elevated text-gray-400'}`}
            title={isFollowing ? 'Pause Live Logs' : 'Resume Live Streaming'}
            aria-label={isFollowing ? 'Pause Live Logs' : 'Resume Live Streaming'}
          >
            {isFollowing ? 'Live' : 'Paused'}
          </button>
          
          <button
            onClick={() => setTimestamps(!timestamps)}
            className="p-1.5 border border-border rounded text-gray-400 hover:text-gray-200 hover:bg-surface-hover transition-colors"
            title={timestamps ? 'Hide Timestamps' : 'Show Timestamps'}
            aria-label={timestamps ? 'Hide Timestamps' : 'Show Timestamps'}
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          
          <button
            onClick={() => setWrapLines(!wrapLines)}
            className="p-1.5 border border-border rounded text-gray-400 hover:text-gray-200 hover:bg-surface-hover transition-colors"
            title={wrapLines ? 'Disable Line Wrap (Horizontal Scroll)' : 'Enable Line Wrap'}
            aria-label={wrapLines ? 'Disable Line Wrap' : 'Enable Line Wrap'}
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>
          
          <button
            onClick={download}
            className="p-1.5 border border-border rounded text-gray-400 hover:text-gray-200 hover:bg-surface-hover transition-colors"
            title="Download Logs as File"
            aria-label="Download Logs as File"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
            title="Close Logs View"
            aria-label="Close Logs View"
          >
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
            title="Search within log stream"
            aria-label="Search within log stream"
          />
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            className={`px-1.5 py-0.5 rounded text-[11px] font-mono border ${caseSensitive ? 'bg-indigo-900/60 border-indigo-500 text-indigo-200' : 'bg-surface-elevated border-border text-gray-400'}`}
            title="Match Case (Case Sensitive)"
            aria-label="Match Case (Case Sensitive)"
          >
            Aa
          </button>
          <button
            onClick={() => setIsRegex(!isRegex)}
            className={`px-1.5 py-0.5 rounded text-[11px] font-mono border ${isRegex ? 'bg-indigo-900/60 border-indigo-500 text-indigo-200' : 'bg-surface-elevated border-border text-gray-400'}`}
            title="Use Regular Expression (Regex)"
            aria-label="Use Regular Expression (Regex)"
          >
            .*
          </button>
          <button
            onClick={() => setFilterOnlyMatches(!filterOnlyMatches)}
            className={`px-2 py-1 rounded border ${filterOnlyMatches ? 'bg-brand-900 text-brand-200' : 'bg-surface-elevated text-gray-400'}`}
            title={filterOnlyMatches ? 'Show All Lines (Clear Filter)' : 'Filter: Show Only Matching Lines'}
            aria-label={filterOnlyMatches ? 'Show All Lines (Clear Filter)' : 'Filter: Show Only Matching Lines'}
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
      <div
        ref={terminalRef}
        onScroll={handleScroll}
        className="flex-1 p-4 bg-[#07090E] overflow-auto font-mono text-[12px] text-gray-300"
      >
        {error ? (
          <div className="text-rose-400 p-2 bg-rose-950/20 border border-rose-900/50 rounded">{error}</div>
        ) : (
          filteredLogs.map((log, i) => (
            <LogLineItem
              key={`${i}-${log.length}`}
              log={log}
              searchQuery={searchQuery}
              caseSensitive={caseSensitive}
              isRegex={isRegex}
              wrapLines={wrapLines}
            />
          ))
        )}
      </div>
    </div>
  );
};
