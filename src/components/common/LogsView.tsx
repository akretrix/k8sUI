import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Download,
  WrapText,
  Clock,
  RotateCcw,
  Loader2,
  ChevronsDown,
  ChevronsUp,
  Search,
  ChevronUp,
  ChevronDown,
  FileText,
  ArrowUpToLine,
  ArrowDownToLine,
  Maximize2,
  Minimize2,
  Check,
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
    containers?: string[];
  } | null;
  initialContainer?: string;
  initialContainers?: string[];
  initialPrevious?: boolean;
  initialTailLines?: number | null;
}

interface LogLineItemProps {
  log: string;
  index: number;
  isCurrentMatch: boolean;
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
  ({ log, index, isCurrentMatch, searchQuery, caseSensitive, isRegex, wrapLines }) => {
    return (
      <div
        id={`log-line-${index}`}
        className={`hover:bg-white/5 transition-colors ${
          wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
        } ${isCurrentMatch ? 'bg-cyan-950/70 ring-1 ring-cyan-400 rounded px-1' : ''}`}
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
  initialContainer,
  initialContainers,
  initialPrevious,
  initialTailLines,
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isFollowing, setIsFollowing] = useState(true);
  const [matchingPods, setMatchingPods] = useState<PodSummary[]>([]);
  const namespace = resource?.namespace || 'default';
  const resourceName = resource?.name;
  const kind = (resource?.kind || 'pod').toLowerCase();
  const isWorkload = ['deployment', 'deployments', 'statefulset', 'statefulsets', 'daemonset', 'daemonsets', 'job', 'jobs'].includes(kind);

  const [selectedPodName, setSelectedPodName] = useState<string>(
    isWorkload ? 'all' : (resource?.name || '')
  );
  const [containers, setContainers] = useState<string[]>(
    initialContainers || resource?.containers || []
  );
  const [container, setContainer] = useState<string>(
    initialContainer || (initialContainers && initialContainers[0]) || ''
  );
  const [previous, setPrevious] = useState(initialPrevious ?? false);
  const [timestamps, setTimestamps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wrapLines, setWrapLines] = useState(true);
  const [tailLines, setTailLines] = useState<number | null>(initialTailLines ?? 1000);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Scroll position state for jump buttons
  const [isAtTop, setIsAtTop] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const terminalRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOnlyMatches, setFilterOnlyMatches] = useState(false);
  const [logLevel, setLogLevel] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [isRegex, setIsRegex] = useState(false);

  // Match Navigation, Raw Buffer Copy & Fullscreen States
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [copiedBuffer, setCopiedBuffer] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Keyboard Shortcuts: Alt+Z (toggle wrap), Esc (exit fullscreen)
  useEffect(() => {
    if (!isActive) return;
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        setWrapLines((prev) => !prev);
      }
      if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [isActive, isFullscreen]);

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

  // 2. Discover containers for the target pod with resilient multi-tier fallback
  useEffect(() => {
    if (!isActive || !resourceName) return;
    let cancelled = false;

    const targetPod =
      selectedPodName && selectedPodName !== 'all'
        ? selectedPodName
        : (matchingPods[0]?.name || resourceName);
    if (!targetPod) return;

    const discoverContainers = async () => {
      let names: string[] = [];

      // Primary source: Tauri API listContainers
      try {
        names = await api.listContainers(namespace, targetPod);
      } catch {
        names = [];
      }

      // Fallback 1: Query listPods and extract container status summaries
      if (!names || names.length === 0) {
        try {
          const allPods = await api.listPods(namespace);
          const found = allPods.find((p) => p.name === targetPod || p.name.startsWith(targetPod));
          if (found?.containers && found.containers.length > 0) {
            names = found.containers.map((c) => c.name);
          }
        } catch {
          // ignore fallback error
        }
      }

      // Fallback 2: Query describeResource to parse container names from YAML/JSON
      if (!names || names.length === 0) {
        try {
          const yamlContent = await api.describeResource('Pod', targetPod, namespace);
          const matches = Array.from(yamlContent.matchAll(/^\s*-\s+name:\s+([a-zA-Z0-9_.-]+)/gm)).map((m) => m[1]);
          if (matches.length > 0) {
            names = Array.from(new Set(matches));
          }
        } catch {
          // ignore fallback error
        }
      }

      if (cancelled) return;

      if (names && names.length > 0) {
        setContainers((prev) => {
          if (prev.length === names.length && prev.every((n, i) => n === names[i])) {
            return prev;
          }
          return names;
        });

        // Manage active container selection
        setContainer((prev) => {
          if (initialContainer && names.includes(initialContainer)) {
            return initialContainer;
          }
          if (prev && (prev === 'all' || names.includes(prev))) {
            return prev;
          }
          return names[0];
        });
      }
    };

    discoverContainers();

    return () => {
      cancelled = true;
    };
  }, [isActive, namespace, selectedPodName, matchingPods, resourceName, initialContainer]);

  // Reset core state when the target resource changes
  useEffect(() => {
    setLogs([]);
    setError(null);
    setSearchQuery('');
    setTailLines(initialTailLines ?? 1000);
    setPrevious(initialPrevious ?? false);
  }, [resourceName, namespace]);

  // 3. Fetch logs based on pod and container selection
  const fetchLogs = useCallback(async (customTail?: number | null, force = false, customPrevious?: boolean) => {
    if (!resourceName || (isFetchingRef.current && !force)) return;
    isFetchingRef.current = true;
    const effectiveTail = customTail !== undefined ? customTail : tailLines;
    const effectivePrevious = customPrevious !== undefined ? customPrevious : previous;
    try {
      if (isWorkload && selectedPodName === 'all' && matchingPods.length > 0) {
        // Multi-pod aggregated logs
        const perPodTail = effectiveTail === null ? null : Math.max(300, Math.floor(effectiveTail / 3));
        const results = await Promise.all(
          matchingPods.slice(0, 3).map(async (pod) => {
            try {
              const text = await api.getLogs(namespace, pod.name, {
                container: container !== 'all' ? container : undefined,
                previous: effectivePrevious,
                timestamps,
                tailLines: perPodTail,
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
        // Chronological sort if timestamps exist
        merged.sort((a, b) => {
          const timeA = a.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/)?.[0];
          const timeB = b.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/)?.[0];
          if (timeA && timeB) return timeA.localeCompare(timeB);
          return 0;
        });
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
        const targetPod = selectedPodName && selectedPodName !== 'all' ? selectedPodName : (matchingPods[0]?.name || resourceName);

        // Multi-container aggregated logs when container === 'all' and multiple containers exist
        if (container === 'all' && containers.length > 1) {
          const results = await Promise.all(
            containers.map(async (c) => {
              try {
                const text = await api.getLogs(namespace, targetPod, {
                  container: c,
                  previous: effectivePrevious,
                  timestamps,
                  tailLines: effectiveTail,
                });
                return text
                  .split('\n')
                  .filter(Boolean)
                  .map((line) => `[${c}] ${line}`);
              } catch (err: any) {
                return [`[${c}] (no output or error: ${err?.message || err})`];
              }
            })
          );
          const merged = results.flat();
          // Chronological sort if timestamps exist
          merged.sort((a, b) => {
            const timeA = a.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/)?.[0];
            const timeB = b.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/)?.[0];
            if (timeA && timeB) return timeA.localeCompare(timeB);
            return 0;
          });
          const newLogs = merged.length ? merged : ['(no output from containers)'];
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
          // Specific container or single container log fetch
          const targetContainer = container !== 'all' ? container : (containers[0] || undefined);
          const text = await api.getLogs(namespace, targetPod, {
            container: targetContainer,
            previous: effectivePrevious,
            timestamps,
            tailLines: effectiveTail,
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
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      isFetchingRef.current = false;
    }
  }, [namespace, resourceName, isWorkload, selectedPodName, matchingPods, container, containers, previous, timestamps, tailLines]);

  const handleLoadMore = async (increment: number) => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setIsFollowing(false);
    const prevScrollHeight = terminalRef.current?.scrollHeight || 0;
    const prevScrollTop = terminalRef.current?.scrollTop || 0;
    const newTail = (tailLines ?? 1000) + increment;
    setTailLines(newTail);
    try {
      await fetchLogs(newTail);
      requestAnimationFrame(() => {
        if (terminalRef.current) {
          const heightDiff = terminalRef.current.scrollHeight - prevScrollHeight;
          terminalRef.current.scrollTop = prevScrollTop + heightDiff;
        }
      });
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleLoadAll = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setIsFollowing(false);
    const prevScrollHeight = terminalRef.current?.scrollHeight || 0;
    const prevScrollTop = terminalRef.current?.scrollTop || 0;
    setTailLines(null);
    try {
      await fetchLogs(null);
      requestAnimationFrame(() => {
        if (terminalRef.current) {
          const heightDiff = terminalRef.current.scrollHeight - prevScrollHeight;
          terminalRef.current.scrollTop = prevScrollTop + heightDiff;
        }
      });
    } finally {
      setIsLoadingMore(false);
    }
  };

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
    const atTop = scrollTop < 60;
    if (atBottom !== isFollowing) {
      setIsFollowing(atBottom);
    }
    setIsAtBottom(atBottom);
    setIsAtTop(atTop);
  }, [isFollowing]);

  const scrollToBottom = useCallback(() => {
    setIsFollowing(true);
    if (terminalRef.current) {
      terminalRef.current.scrollTo({ top: terminalRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  const scrollToTop = useCallback(() => {
    setIsFollowing(false);
    if (terminalRef.current) {
      terminalRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const download = async () => {
    const defaultName = `${resourceName}${container !== 'all' ? `-${container}` : (containers.length > 1 ? '-all-containers' : '')}${previous ? '-previous' : ''}.log`;
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

  // Array of line indices within filteredLogs that contain search matches
  const matchingLineIndices = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const indices: number[] = [];
    try {
      const regex = isRegex
        ? new RegExp(searchQuery, caseSensitive ? '' : 'i')
        : null;
      const qLower = searchQuery.toLowerCase();
      filteredLogs.forEach((log, idx) => {
        const clean = stripAnsi(log);
        if (regex ? regex.test(clean) : caseSensitive ? clean.includes(searchQuery) : clean.toLowerCase().includes(qLower)) {
          indices.push(idx);
        }
      });
    } catch {
      return [];
    }
    return indices;
  }, [filteredLogs, searchQuery, isRegex, caseSensitive]);

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery, isRegex, caseSensitive, filterOnlyMatches]);

  const scrollToMatch = useCallback((matchIdx: number) => {
    if (matchingLineIndices.length === 0) return;
    const targetLineIdx = matchingLineIndices[matchIdx];
    const el = terminalRef.current?.querySelector(`#log-line-${targetLineIdx}`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [matchingLineIndices]);

  const handleNextMatch = useCallback(() => {
    if (matchingLineIndices.length === 0) return;
    const next = (currentMatchIndex + 1) % matchingLineIndices.length;
    setCurrentMatchIndex(next);
    scrollToMatch(next);
  }, [matchingLineIndices, currentMatchIndex, scrollToMatch]);

  const handlePrevMatch = useCallback(() => {
    if (matchingLineIndices.length === 0) return;
    const prev = (currentMatchIndex - 1 + matchingLineIndices.length) % matchingLineIndices.length;
    setCurrentMatchIndex(prev);
    scrollToMatch(prev);
  }, [matchingLineIndices, currentMatchIndex, scrollToMatch]);

  const handleCopyBuffer = useCallback(() => {
    if (logs.length === 0) return;
    const cleanLogContent = logs.map((l) => stripAnsi(l)).join('\n');
    navigator.clipboard.writeText(cleanLogContent);
    setCopiedBuffer(true);
    setTimeout(() => setCopiedBuffer(false), 2000);
  }, [logs]);

  if (!isActive || !resource) return null;

  return (
    <div
      className={`flex flex-col bg-[#090D16] transition-all duration-200 ${
        isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : 'h-full w-full'
      }`}
    >
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

          {containers.length > 0 ? (
            <select
              value={container}
              onChange={(e) => {
                const nextContainer = e.target.value;
                setContainer(nextContainer);
                setLogs([]);
              }}
              className="bg-surface-elevated border border-border text-xs text-gray-200 rounded-md px-2 py-1 outline-none cursor-pointer font-mono"
              title="Filter logs by container"
              aria-label="Filter logs by container"
            >
              {containers.length > 1 && (
                <option value="all">All Containers ({containers.length})</option>
              )}
              {containers.map((c) => (
                <option key={c} value={c}>
                  {containers.length > 1 ? `Container: ${c}` : c}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-[11px] text-gray-500 font-mono px-2 py-1 bg-surface-elevated/50 border border-border/40 rounded-md">
              Container: default
            </div>
          )}

          <button
            onClick={() => setIsFollowing(!isFollowing)}
            className={`px-2 py-1 rounded text-xs border ${isFollowing ? 'bg-emerald-900 text-emerald-200' : 'bg-surface-elevated text-gray-400'}`}
            title={isFollowing ? 'Pause Live Logs' : 'Resume Live Streaming'}
            aria-label={isFollowing ? 'Pause Live Logs' : 'Resume Live Streaming'}
          >
            {isFollowing ? 'Live' : 'Paused'}
          </button>

          {/* Tail Lines Selector */}
          <select
            value={tailLines === null ? 'all' : String(tailLines)}
            onChange={(e) => {
              const val = e.target.value === 'all' ? null : Number(e.target.value);
              setTailLines(val);
              if (val === null) {
                setIsFollowing(false);
              }
              fetchLogs(val, true);
            }}
            className="bg-surface-elevated border border-border text-xs text-gray-200 rounded-md px-2 py-1 outline-none cursor-pointer font-mono"
            title="Number of log lines to retrieve from tail"
            aria-label="Tail lines"
          >
            {tailLines !== null && ![500, 1000, 2500, 5000, 10000].includes(tailLines) && (
              <option value={String(tailLines)}>{tailLines.toLocaleString()} lines</option>
            )}
            <option value="500">500 lines</option>
            <option value="1000">1,000 lines</option>
            <option value="2500">2,500 lines</option>
            <option value="5000">5,000 lines</option>
            <option value="10000">10,000 lines</option>
            <option value="all">All logs (Full)</option>
          </select>

          <button
            onClick={() => {
              const next = !previous;
              setPrevious(next);
              setLogs([]);
              if (next) {
                setIsFollowing(false);
              } else {
                setIsFollowing(true);
              }
              fetchLogs(tailLines, true, next);
            }}
            className={`px-2 py-1 rounded text-xs border font-mono transition-colors flex items-center space-x-1.5 ${
              previous
                ? 'bg-amber-950/80 border-amber-600 text-amber-300 shadow-sm'
                : 'bg-surface-elevated border-border text-gray-400 hover:text-gray-200 hover:bg-surface-hover'
            }`}
            title={
              previous
                ? 'Showing Terminated/Previous Container Logs (Click to show Current live logs)'
                : 'Show Terminated/Previous Container Logs (--previous)'
            }
            aria-label={previous ? 'Showing Previous Container Logs' : 'Show Previous Container Logs'}
          >
            <RotateCcw className="w-3 h-3" />
            <span>Previous</span>
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

      {/* Previous Logs Notice Banner */}
      {previous && (
        <div className="px-4 py-1.5 bg-amber-950/40 border-b border-amber-800/60 flex items-center justify-between gap-3 text-xs font-mono text-amber-300 shrink-0">
          <div className="flex items-center space-x-2 min-w-0 truncate">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="truncate">
              Showing logs from <strong>previous terminated container</strong> (<code>--previous</code>)
              {tailLines !== null ? ` — Tail: ${tailLines.toLocaleString()} lines` : ' — Full container log'}.
            </span>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            {tailLines !== null && (
              <button
                onClick={() => handleLoadMore(2000)}
                disabled={isLoadingMore}
                className="px-2 py-0.5 rounded bg-amber-900/60 hover:bg-amber-800 border border-amber-700/80 text-amber-200 text-[11px] font-mono transition-colors cursor-pointer flex items-center space-x-1"
                title="Fetch 2,000 more earlier lines from terminated container"
              >
                {isLoadingMore && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                <span>+2,000 lines</span>
              </button>
            )}
            {tailLines !== null && (
              <button
                onClick={() => handleLoadAll()}
                disabled={isLoadingMore}
                className="px-2 py-0.5 rounded bg-amber-900/40 hover:bg-amber-800/60 border border-amber-700/60 text-amber-300 text-[11px] font-mono transition-colors cursor-pointer"
                title="Fetch all available logs from terminated container"
              >
                <span>Load all logs</span>
              </button>
            )}
            <button
              onClick={() => {
                setPrevious(false);
                setLogs([]);
                setIsFollowing(true);
              }}
              className="text-[11px] underline hover:text-amber-200 text-amber-400 cursor-pointer pl-1"
            >
              Return to current live logs
            </button>
          </div>
        </div>
      )}

      {/* Search & Action Tools Toolbar (Integrated IDE Look & Feel) */}
      <div className="px-4 py-2 border-b border-border/80 bg-surface/70 flex flex-wrap items-center justify-between gap-2.5 shrink-0 text-xs">
        {/* Left Side: Search Bar & Match Navigators */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {/* Integrated Search Input with Magnifying Glass */}
          <div className="flex items-center bg-[#07090E] border border-border/90 rounded-lg overflow-hidden focus-within:border-cyan-500/80 focus-within:ring-1 focus-within:ring-cyan-500/30 transition-all">
            <input
              type="text"
              placeholder="Search visible log output"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (e.shiftKey) {
                    handlePrevMatch();
                  } else {
                    handleNextMatch();
                  }
                }
              }}
              className="px-3 py-1.5 bg-transparent text-xs font-mono text-gray-100 placeholder-gray-500 focus:outline-none w-48 sm:w-64"
              title="Search visible log output (Press Enter for next, Shift+Enter for prev)"
              aria-label="Search visible log output"
            />
            <button
              onClick={handleNextMatch}
              className="px-2.5 py-1.5 text-gray-400 hover:text-cyan-300 border-l border-border/60 hover:bg-surface-elevated transition-colors cursor-pointer"
              title="Search / Next match (Enter)"
              aria-label="Search"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Previous Match button (^) */}
          <button
            onClick={handlePrevMatch}
            disabled={matchingLineIndices.length === 0}
            className="p-1.5 rounded-lg border border-border/80 bg-[#0B0F17] hover:bg-surface-elevated text-gray-400 hover:text-gray-100 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center"
            title="Previous match (Shift + Enter)"
            aria-label="Previous match"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {/* Next Match button (v) */}
          <button
            onClick={handleNextMatch}
            disabled={matchingLineIndices.length === 0}
            className="p-1.5 rounded-lg border border-border/80 bg-[#0B0F17] hover:bg-surface-elevated text-gray-400 hover:text-gray-100 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center"
            title="Next match (Enter)"
            aria-label="Next match"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Match counter badge */}
          {searchQuery && (
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                matchingLineIndices.length > 0
                  ? 'bg-cyan-950/70 text-cyan-300 border-cyan-800/60'
                  : 'bg-rose-950/70 text-rose-300 border-rose-800/60'
              }`}
            >
              {matchingLineIndices.length > 0
                ? `${currentMatchIndex + 1} of ${matchingLineIndices.length}`
                : '0 matches'}
            </span>
          )}

          {/* Search Modifiers: Aa (Case), .* (Regex), Filter Only */}
          <div className="flex items-center space-x-1 pl-1 border-l border-border/50">
            <button
              onClick={() => setCaseSensitive(!caseSensitive)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                caseSensitive
                  ? 'bg-indigo-900/60 border-indigo-500 text-indigo-200'
                  : 'bg-[#0B0F17] border-border/70 text-gray-400 hover:text-gray-200'
              }`}
              title="Match Case (Case Sensitive)"
              aria-label="Match Case (Case Sensitive)"
            >
              Aa
            </button>
            <button
              onClick={() => setIsRegex(!isRegex)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                isRegex
                  ? 'bg-indigo-900/60 border-indigo-500 text-indigo-200'
                  : 'bg-[#0B0F17] border-border/70 text-gray-400 hover:text-gray-200'
              }`}
              title="Use Regular Expression (Regex)"
              aria-label="Use Regular Expression (Regex)"
            >
              .*
            </button>
            <button
              onClick={() => setFilterOnlyMatches(!filterOnlyMatches)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                filterOnlyMatches
                  ? 'bg-brand-900 border-brand-500 text-brand-200'
                  : 'bg-[#0B0F17] border-border/70 text-gray-400 hover:text-gray-200'
              }`}
              title={filterOnlyMatches ? 'Show All Lines (Clear Filter)' : 'Filter: Show Only Matching Lines'}
              aria-label={filterOnlyMatches ? 'Show All Lines (Clear Filter)' : 'Filter: Show Only Matching Lines'}
            >
              Filter
            </button>
            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value as any)}
              className="bg-[#07090E] border border-border/80 rounded text-[11px] font-mono text-gray-300 px-1.5 py-0.5 outline-none cursor-pointer"
              title="Filter by Log Level"
              aria-label="Filter by Log Level"
            >
              <option value="all">Level: All</option>
              <option value="error">Level: Error</option>
              <option value="warn">Level: Warn</option>
              <option value="info">Level: Info</option>
            </select>
          </div>
        </div>

        {/* Right Side: Tools Cluster matching user screenshot */}
        <div className="flex items-center space-x-1.5">
          {/* 1. 📄 Raw / Copy Buffer */}
          <button
            onClick={handleCopyBuffer}
            className="p-1.5 rounded-lg border border-border/80 bg-[#0B0F17] hover:bg-surface-elevated text-gray-300 hover:text-white transition-all cursor-pointer flex items-center justify-center"
            title={copiedBuffer ? 'Copied full log buffer to clipboard!' : 'Copy full log buffer as raw text'}
            aria-label="Copy full log buffer as raw text"
          >
            {copiedBuffer ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
          </button>

          {/* 2. ↩ Toggle Line Wrap */}
          <button
            onClick={() => setWrapLines(!wrapLines)}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
              wrapLines
                ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-300'
                : 'bg-[#0B0F17] border-border/80 text-gray-400 hover:text-gray-200 hover:bg-surface-elevated'
            }`}
            title={wrapLines ? 'Disable Word Wrap (Horizontal Scroll) [Alt+Z]' : 'Enable Word Wrap [Alt+Z]'}
            aria-label="Toggle Word Wrap"
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>

          {/* 3. ↑· Scroll to Top */}
          <button
            onClick={scrollToTop}
            className="p-1.5 rounded-lg border border-border/80 bg-[#0B0F17] hover:bg-surface-elevated text-gray-400 hover:text-gray-200 transition-all cursor-pointer flex items-center justify-center"
            title="Scroll to Top"
            aria-label="Scroll to Top"
          >
            <ArrowUpToLine className="w-3.5 h-3.5" />
          </button>

          {/* 4. ↓· Scroll to Bottom / Follow Tail */}
          <button
            onClick={scrollToBottom}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
              isFollowing
                ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300 shadow-sm'
                : 'bg-[#0B0F17] border-border/80 text-gray-400 hover:text-gray-200 hover:bg-surface-elevated'
            }`}
            title={isFollowing ? 'Following Live Tail (Autoscroll Active)' : 'Scroll to Bottom / Follow Tail'}
            aria-label="Scroll to Bottom / Follow Tail"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
          </button>

          {/* 5. ⛶ Toggle Fullscreen */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
              isFullscreen
                ? 'bg-indigo-950/50 border-indigo-500/70 text-indigo-300'
                : 'bg-[#0B0F17] border-border/80 text-gray-400 hover:text-gray-200 hover:bg-surface-elevated'
            }`}
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Toggle Fullscreen Terminal'}
            aria-label="Toggle Fullscreen Terminal"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Terminal Area */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={terminalRef}
          onScroll={handleScroll}
          className="h-full p-4 bg-[#07090E] overflow-auto font-mono text-[12px] text-gray-300 select-text [&_::selection]:bg-blue-500/50 [&_::selection]:text-white"
        >
          {/* Terminal Area Top Notice / Expansion Controls */}
          {!error && logs.length > 0 && (
            <div className="mb-3">
              {tailLines !== null ? (
                <div className="p-2 rounded-md bg-surface-elevated/70 border border-border/80 flex items-center justify-between gap-3 text-xs text-gray-400 font-mono">
                  <div className="flex items-center space-x-2 text-gray-300">
                    <span className="text-gray-500">⬆</span>
                    <span>
                      Showing last <strong>{logs.length.toLocaleString()}</strong> lines (tail limit: {tailLines.toLocaleString()}).
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleLoadMore(1000)}
                      disabled={isLoadingMore}
                      className="px-2.5 py-1 rounded bg-brand-900/60 hover:bg-brand-800 border border-brand-700 text-brand-200 text-xs font-mono transition-colors cursor-pointer flex items-center space-x-1"
                      title="Fetch 1,000 more earlier lines"
                    >
                      {isLoadingMore && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>+1,000 earlier lines</span>
                    </button>
                    <button
                      onClick={() => handleLoadAll()}
                      disabled={isLoadingMore}
                      className="px-2.5 py-1 rounded bg-surface hover:bg-surface-hover border border-border text-gray-200 text-xs font-mono transition-colors cursor-pointer"
                      title="Fetch all available logs from container start"
                    >
                      <span>Load all logs</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-3 py-1.5 rounded-md bg-surface-elevated/40 border border-border/40 flex items-center justify-between text-xs text-gray-400 font-mono">
                  <span className="text-gray-400">
                    Showing <strong>all available logs</strong> ({logs.length.toLocaleString()} lines from container start).
                  </span>
                  <button
                    onClick={() => {
                      setTailLines(1000);
                    }}
                    className="text-[11px] text-gray-400 hover:text-gray-200 underline cursor-pointer"
                  >
                    Reset to 1,000 lines
                  </button>
                </div>
              )}
            </div>
          )}

          {error ? (
            <div className="p-3 bg-rose-950/30 border border-rose-900/60 rounded-lg flex items-start justify-between gap-3 text-xs font-mono">
              <div className="space-y-1">
                <div className="font-semibold text-rose-300">Unable to retrieve logs</div>
                <div className="text-rose-400 text-[11px] whitespace-pre-wrap">{error}</div>
              </div>
              {previous && (
                <button
                  onClick={() => {
                    setPrevious(false);
                    setLogs([]);
                    setIsFollowing(true);
                  }}
                  className="px-2.5 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 text-[11px] shrink-0 transition-colors cursor-pointer"
                >
                  Switch to Live Logs
                </button>
              )}
            </div>
          ) : (
            filteredLogs.map((log, i) => (
              <LogLineItem
                key={`${i}-${log.length}`}
                index={i}
                isCurrentMatch={matchingLineIndices[currentMatchIndex] === i}
                log={log}
                searchQuery={searchQuery}
                caseSensitive={caseSensitive}
                isRegex={isRegex}
                wrapLines={wrapLines}
              />
            ))
          )}
        </div>

        {/* Floating scroll-jump button */}
        {!isAtBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 z-10 flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#1a2235] hover:bg-[#243050] border border-blue-700/50 text-blue-300 hover:text-blue-200 text-xs font-mono shadow-lg shadow-black/40 transition-all duration-150 animate-in fade-in slide-in-from-bottom-2"
            title="Jump to bottom"
            aria-label="Scroll to bottom"
          >
            <ChevronsDown className="w-3.5 h-3.5" />
            <span>Jump to bottom</span>
          </button>
        )}
        {isAtBottom && !isAtTop && logs.length > 50 && (
          <button
            onClick={scrollToTop}
            className="absolute bottom-4 right-4 z-10 flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#1a2235] hover:bg-[#243050] border border-blue-700/50 text-blue-300 hover:text-blue-200 text-xs font-mono shadow-lg shadow-black/40 transition-all duration-150 animate-in fade-in slide-in-from-bottom-2"
            title="Jump to top"
            aria-label="Scroll to top"
          >
            <ChevronsUp className="w-3.5 h-3.5" />
            <span>Jump to top</span>
          </button>
        )}
      </div>
    </div>
  );
};
