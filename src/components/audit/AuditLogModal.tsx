import React, { useState } from 'react';
import { AuditEntry } from '../../types/cluster';
import { Shield, Download, X, Search, Bot, User } from 'lucide-react';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: AuditEntry[];
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({
  isOpen,
  onClose,
  entries,
}) => {
  const [filter, setFilter] = useState('');

  if (!isOpen) return null;

  const filteredEntries = entries.filter(
    (e) =>
      e.action.toLowerCase().includes(filter.toLowerCase()) ||
      e.cluster_id.toLowerCase().includes(filter.toLowerCase()) ||
      e.target_resource.toLowerCase().includes(filter.toLowerCase()) ||
      e.origin.toLowerCase().includes(filter.toLowerCase())
  );

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(entries, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `k8sui-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-100">
      <div className="bg-surface-elevated border border-border rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-surface flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Privileged Action Audit Trail</h3>
              <p className="text-xs text-gray-400">
                Local, tamper-evident record of all cluster mutations and privilege changes.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-gray-300 hover:text-white hover:bg-surface-hover flex items-center space-x-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-surface-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Input */}
        <div className="px-6 py-2.5 border-b border-border bg-surface/50 flex items-center space-x-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter audit logs by action, cluster, or resource..."
            className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
          />
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead className="text-gray-400 border-b border-border text-[11px] uppercase">
              <tr>
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">Cluster</th>
                <th className="py-2 px-3">Origin</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">Target</th>
                <th className="py-2 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 font-sans">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="py-2.5 px-3 text-gray-400 text-[11px]">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-gray-200">
                      {entry.cluster_id}
                    </td>
                    <td className="py-2.5 px-3">
                      {entry.origin === 'ai_copilot' ? (
                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px]">
                          <Bot className="w-3 h-3" />
                          <span>AI</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700 text-[10px]">
                          <User className="w-3 h-3" />
                          <span>Manual</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-indigo-300 font-bold">{entry.action}</td>
                    <td className="py-2.5 px-3 text-gray-300 truncate max-w-xs">
                      {entry.target_resource}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          entry.status.includes('success') || entry.status.includes('connected') || entry.status.includes('scaled')
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
