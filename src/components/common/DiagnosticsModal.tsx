import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Activity,
  Terminal,
  FileText,
  Copy,
  Check,
  RefreshCw,
  FolderOpen,
  Bug,
  CheckCircle2,
  XCircle,
  Search,
  ChevronDown,
  ChevronRight,
  Server,
  Cpu,
} from 'lucide-react';
import { api, IpcLogEntry, isTauri, ClusterHealthInfo } from '../../api/tauriClient';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCluster?: any;
  healthInfo?: ClusterHealthInfo | null;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  activeCluster,
  healthInfo,
}) => {
  const [activeTab, setActiveTab] = useState<'ipc' | 'logs' | 'health'>('ipc');
  const [ipcLogs, setIpcLogs] = useState<IpcLogEntry[]>([]);
  const [backendLogs, setBackendLogs] = useState<string[]>([]);
  const [loadingBackendLogs, setLoadingBackendLogs] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'slow' | 'errors' | 'pending'>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Synchronize IPC logs via subscription
  useEffect(() => {
    if (!isOpen) return;
    setIpcLogs(api.getIpcHistory());

    const unsubscribe = api.subscribeToIpcLogs((_entry, history) => {
      setIpcLogs([...history]);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  // Load backend logs when opening or switching to logs tab
  const fetchBackendLogs = async () => {
    setLoadingBackendLogs(true);
    try {
      const lines = await api.getBackendLogs(250);
      setBackendLogs(lines || []);
    } catch (e) {
      setBackendLogs([`Failed to load backend logs: ${e}`]);
    } finally {
      setLoadingBackendLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'logs') {
      fetchBackendLogs();
    }
  }, [isOpen, activeTab]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered IPC Logs
  const filteredIpcLogs = useMemo(() => {
    return ipcLogs.filter((log) => {
      if (filterStatus === 'errors' && log.status !== 'error') return false;
      if (filterStatus === 'pending' && log.status !== 'pending') return false;
      if (filterStatus === 'slow' && (!log.durationMs || log.durationMs < 1500)) return false;

      if (!filterQuery) return true;
      const q = filterQuery.toLowerCase();
      const matchesCmd = log.cmd.toLowerCase().includes(q);
      const matchesErr = log.error?.toLowerCase().includes(q) || false;
      const matchesArgs = JSON.stringify(log.args).toLowerCase().includes(q);
      return matchesCmd || matchesErr || matchesArgs;
    });
  }, [ipcLogs, filterQuery, filterStatus]);

  const handleCopyDiagnostics = async () => {
    try {
      const bundle = await api.getDiagnosticsBundle();
      await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy diagnostics:', err);
    }
  };

  const handleOpenLogFile = async () => {
    try {
      await api.openLogFile();
    } catch (err) {
      console.error('Failed to open log file:', err);
    }
  };

  const handleOpenLogsDir = async () => {
    try {
      await api.openLogsDir();
    } catch (err) {
      console.error('Failed to open logs directory:', err);
    }
  };

  const handleToggleDevTools = async () => {
    try {
      await api.toggleDevtools();
    } catch (err) {
      console.error('Failed to toggle devtools:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-[1100px] max-w-[96vw] h-[85vh] bg-[#0D1117] border border-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden cursor-default text-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-16 px-6 border-b border-border/70 bg-[#0B0F17] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-base font-bold text-gray-100 font-mono tracking-tight">Diagnostics & Observability</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  v0.1.2
                </span>
                {healthInfo?.latency_ms !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border flex items-center space-x-1 ${
                      healthInfo.latency_ms > 1000
                        ? 'bg-amber-950/40 text-amber-300 border-amber-800/80'
                        : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/80'
                    }`}
                  >
                    <span>Ping: {healthInfo.latency_ms}ms</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Live query tracing, network latency, and persistent macOS logs for troubleshooting.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleToggleDevTools}
              className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-medium text-gray-300 hover:text-white transition-colors flex items-center space-x-1.5"
              title="Toggle Web Inspector (Cmd+Option+I)"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>DevTools</span>
            </button>

            <button
              onClick={handleOpenLogFile}
              className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-medium text-gray-300 hover:text-white transition-colors flex items-center space-x-1.5"
              title="Open k8sui.log in Console.app / Default Viewer"
            >
              <FileText className="w-3.5 h-3.5 text-brand-400" />
              <span>Log File</span>
            </button>

            <button
              onClick={handleCopyDiagnostics}
              className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors flex items-center space-x-1.5 shadow-sm"
              title="Copy Complete Diagnostic Bundle to Clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Bundle!' : 'Copy Diagnostics'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-elevated text-gray-400 hover:text-gray-100 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="h-11 px-6 border-b border-border/70 bg-surface/40 flex items-center justify-between shrink-0">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('ipc')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-2 ${
                activeTab === 'ipc'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface-elevated'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Live IPC Calls ({ipcLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-2 ${
                activeTab === 'logs'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface-elevated'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Backend Logs (k8sui.log)</span>
            </button>

            <button
              onClick={() => setActiveTab('health')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-2 ${
                activeTab === 'health'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface-elevated'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Cluster & System</span>
            </button>
          </div>

          {activeTab === 'ipc' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => api.clearIpcHistory()}
                className="text-xs text-gray-400 hover:text-gray-200 hover:underline"
              >
                Clear
              </button>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleOpenLogsDir}
                className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border text-[11px] text-gray-300 flex items-center space-x-1"
                title="Reveal ~/Library/Logs/k8sUI in Finder"
              >
                <FolderOpen className="w-3 h-3 text-amber-400" />
                <span>Show in Finder</span>
              </button>
              <button
                onClick={fetchBackendLogs}
                disabled={loadingBackendLogs}
                className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border text-[11px] text-gray-300 flex items-center space-x-1"
              >
                <RefreshCw className={`w-3 h-3 ${loadingBackendLogs ? 'animate-spin text-brand-400' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-auto p-6">
          {activeTab === 'ipc' && (
            <div className="flex flex-col h-full space-y-3">
              {/* Controls Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center space-x-2 flex-1 max-w-md">
                  <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Filter command, args, or error..."
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      className="w-full bg-surface-elevated/80 border border-border/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 bg-surface-elevated/60 p-1 rounded-lg border border-border/60 text-xs">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      filterStatus === 'all' ? 'bg-indigo-600 text-white font-medium' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    All ({ipcLogs.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('slow')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      filterStatus === 'slow' ? 'bg-amber-600 text-white font-medium' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Slow &gt;1.5s
                  </button>
                  <button
                    onClick={() => setFilterStatus('errors')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      filterStatus === 'errors' ? 'bg-rose-600 text-white font-medium' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Errors
                  </button>
                  <button
                    onClick={() => setFilterStatus('pending')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      filterStatus === 'pending' ? 'bg-cyan-600 text-white font-medium' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Pending
                  </button>
                </div>
              </div>

              {/* Table / List */}
              <div className="flex-1 overflow-auto border border-border/70 rounded-xl bg-surface/30">
                {filteredIpcLogs.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-gray-400 text-xs space-y-1">
                    <Activity className="w-6 h-6 text-gray-600 mb-1" />
                    <span>No matching IPC calls recorded yet.</span>
                    <span className="text-[11px] text-gray-500">Perform actions in the app to trace live API requests.</span>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#0B0F17] text-gray-400 sticky top-0 z-10 border-b border-border/80">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold w-24">Status</th>
                        <th className="py-2.5 px-4 font-semibold">Tauri Command</th>
                        <th className="py-2.5 px-4 font-semibold w-28">Latency</th>
                        <th className="py-2.5 px-4 font-semibold w-32">Time</th>
                        <th className="py-2.5 px-4 font-semibold w-16 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {filteredIpcLogs.map((log) => {
                        const isExpanded = expandedRow === log.id;
                        const isSlow = log.durationMs !== undefined && log.durationMs > 1500;
                        return (
                          <React.Fragment key={log.id}>
                            <tr
                              onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                              className={`hover:bg-surface-elevated/40 cursor-pointer transition-colors ${
                                log.status === 'error' ? 'bg-rose-950/15' : isSlow ? 'bg-amber-950/10' : ''
                              }`}
                            >
                              <td className="py-2.5 px-4">
                                {log.status === 'pending' && (
                                  <span className="inline-flex items-center space-x-1 text-cyan-400 text-[11px]">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>PENDING</span>
                                  </span>
                                )}
                                {log.status === 'success' && (
                                  <span className="inline-flex items-center space-x-1 text-emerald-400 text-[11px]">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>OK</span>
                                  </span>
                                )}
                                {log.status === 'error' && (
                                  <span className="inline-flex items-center space-x-1 text-rose-400 text-[11px] font-bold">
                                    <XCircle className="w-3 h-3" />
                                    <span>ERROR</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 font-bold text-gray-200">
                                <span className="font-sans font-medium text-indigo-300">{log.cmd}</span>
                                {log.args && Object.keys(log.args).length > 0 && (
                                  <span className="text-[11px] text-gray-500 ml-2 font-normal truncate max-w-xs inline-block align-bottom">
                                    {JSON.stringify(log.args)}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4">
                                {log.durationMs !== undefined ? (
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                      log.durationMs > 3000
                                        ? 'bg-rose-950/60 text-rose-300 border border-rose-800/80'
                                        : log.durationMs > 1000
                                        ? 'bg-amber-950/60 text-amber-300 border border-amber-800/80'
                                        : 'text-gray-400'
                                    }`}
                                  >
                                    {log.durationMs}ms
                                  </span>
                                ) : (
                                  <span className="text-gray-500 text-[11px]">running...</span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-gray-400 text-[11px]">
                                {new Date(log.startTime).toLocaleTimeString()}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 inline" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 inline" />
                                )}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-[#0B0F17]/80">
                                <td colSpan={5} className="py-3 px-6 space-y-2 border-b border-border/80">
                                  <div className="text-[11px] font-mono space-y-2">
                                    <div>
                                      <span className="text-gray-500 font-sans font-semibold">Invocation Arguments:</span>
                                      <pre className="mt-1 p-2 rounded bg-black/50 border border-border/50 text-indigo-200 overflow-x-auto text-[11px]">
                                        {JSON.stringify(log.args, null, 2)}
                                      </pre>
                                    </div>
                                    {log.error && (
                                      <div>
                                        <span className="text-rose-400 font-sans font-semibold">Error Message:</span>
                                        <pre className="mt-1 p-2 rounded bg-rose-950/30 border border-rose-800/60 text-rose-200 overflow-x-auto text-[11px]">
                                          {log.error}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="flex flex-col h-full space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-400 shrink-0">
                <span className="font-mono text-[11px]">
                  Showing last {backendLogs.length} entries from <code className="text-indigo-300">~/Library/Logs/k8sUI/k8sui.log</code>
                </span>
                <span className="text-gray-500 text-[11px]">Auto-appends all backend tracing events</span>
              </div>

              <div className="flex-1 overflow-auto border border-border/70 rounded-xl bg-black/60 p-4 font-mono text-[11px] text-gray-300 space-y-1 select-text">
                {backendLogs.length === 0 ? (
                  <div className="text-gray-500 text-center py-10">No log entries found.</div>
                ) : (
                  backendLogs.map((line, idx) => {
                    const isErr = line.includes('ERROR') || line.includes('error');
                    const isWarn = line.includes('WARN');
                    const isDebug = line.includes('DEBUG');
                    return (
                      <div
                        key={idx}
                        className={`leading-relaxed whitespace-pre-wrap break-all ${
                          isErr
                            ? 'text-rose-400 bg-rose-950/20 px-1 rounded'
                            : isWarn
                            ? 'text-amber-300'
                            : isDebug
                            ? 'text-gray-500'
                            : 'text-gray-300'
                        }`}
                      >
                        {line}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'health' && (
            <div className="space-y-6">
              {/* Cluster Health Card */}
              <div className="p-5 rounded-xl border border-border/80 bg-surface/50 space-y-4">
                <h3 className="text-sm font-bold text-gray-100 flex items-center space-x-2">
                  <Server className="w-4 h-4 text-indigo-400" />
                  <span>Active Cluster Connection</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="p-3 rounded-lg bg-surface-elevated/60 border border-border/60">
                    <span className="text-gray-500 block text-[11px]">Cluster Name</span>
                    <span className="font-bold text-gray-100 text-sm mt-0.5 block">{activeCluster?.name || 'None'}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-surface-elevated/60 border border-border/60">
                    <span className="text-gray-500 block text-[11px]">Provider / Env</span>
                    <span className="font-bold text-indigo-300 text-sm mt-0.5 block">
                      {(activeCluster?.provider || 'local').toUpperCase()} · {activeCluster?.environment || 'Default'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-surface-elevated/60 border border-border/60">
                    <span className="text-gray-500 block text-[11px]">Network Latency</span>
                    <span
                      className={`font-bold text-sm mt-0.5 block ${
                        (healthInfo?.latency_ms || 0) > 1000 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {healthInfo?.latency_ms !== undefined ? `${healthInfo.latency_ms} ms` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-gray-400 font-sans">API Server URL:</span>
                    <span className="font-mono text-gray-200">{activeCluster?.server_url || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-gray-400 font-sans">Kubernetes Version:</span>
                    <span className="font-mono text-gray-200">{activeCluster?.k8s_version || 'v1.30+'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-gray-400 font-sans">SSO Auth Status:</span>
                    <span className="font-mono text-indigo-300">{healthInfo?.is_sso ? 'AWS IAM Identity Center (SSO)' : 'Certificate / Token'}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-400 font-sans">Last Health Check:</span>
                    <span className="font-mono text-gray-400">{healthInfo?.last_checked || 'Just now'}</span>
                  </div>
                </div>
              </div>

              {/* Host Machine & Runtime Card */}
              <div className="p-5 rounded-xl border border-border/80 bg-surface/50 space-y-4">
                <h3 className="text-sm font-bold text-gray-100 flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>Desktop App Runtime & OS Environment</span>
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-gray-400 font-sans">Shell Architecture:</span>
                    <span className="font-mono text-cyan-300">{isTauri ? 'Tauri Native Desktop (WebKit/Wry + Tokio Rust)' : 'Web Browser Preview'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-gray-400 font-sans">Application Version:</span>
                    <span className="font-mono text-gray-200">k8sUI v0.1.2</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-gray-400 font-sans">User Agent:</span>
                    <span className="font-mono text-gray-400 truncate max-w-md">{typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-400 font-sans">Log Directory:</span>
                    <span className="font-mono text-gray-300">~/Library/Logs/k8sUI/k8sui.log</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-12 px-6 border-t border-border/70 bg-[#0B0F17] flex items-center justify-between text-xs text-gray-400 shrink-0">
          <div className="flex items-center space-x-4">
            <span>Tip: Press <code className="font-mono bg-surface-elevated px-1.5 py-0.5 rounded text-gray-200">Cmd+Shift+D</code> anywhere to open this screen</span>
            <span>·</span>
            <span>Press <code className="font-mono bg-surface-elevated px-1.5 py-0.5 rounded text-gray-200">Cmd+Option+I</code> for Web Inspector</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border text-xs text-gray-200 font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
