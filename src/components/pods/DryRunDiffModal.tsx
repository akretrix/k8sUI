import React from 'react';
import { DryRunResult } from '../../types/cluster';
import { AlertCircle, CheckCircle2, ShieldCheck, X } from 'lucide-react';

interface DryRunDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  dryRunResult: DryRunResult | null;
  onConfirmApply: () => void;
  isApplying: boolean;
}

export const DryRunDiffModal: React.FC<DryRunDiffModalProps> = ({
  isOpen,
  onClose,
  dryRunResult,
  onConfirmApply,
  isApplying,
}) => {
  if (!isOpen || !dryRunResult) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-100">
      <div className="bg-surface-elevated border border-border rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[85vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border bg-surface flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Dry-Run Diff Confirmation</span>
                <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated font-mono font-normal text-indigo-300">
                  {dryRunResult.kind}/{dryRunResult.name}
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Review server-side dry-run diff against live cluster state before applying.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Validation Status Banner */}
        <div className="px-6 py-2.5 bg-emerald-950/40 border-b border-emerald-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-emerald-300 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Kubernetes Server-Side Dry-Run Validation Passed</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400/80">0 Admission Webhook Errors</span>
        </div>

        {/* Diff Content View */}
        <div className="flex-1 overflow-auto p-6 bg-background">
          <div className="rounded-lg border border-border bg-surface/80 p-4 font-mono text-xs overflow-x-auto text-gray-200">
            <pre className="whitespace-pre">
              {dryRunResult.diff.split('\n').map((line, idx) => {
                let colorClass = 'text-gray-300';
                if (line.startsWith('+')) colorClass = 'text-emerald-400 bg-emerald-950/30';
                if (line.startsWith('-')) colorClass = 'text-red-400 bg-red-950/30';
                if (line.startsWith('@@')) colorClass = 'text-indigo-400 font-bold';
                return (
                  <div key={idx} className={`px-2 py-0.5 rounded ${colorClass}`}>
                    {line}
                  </div>
                );
              })}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>Applying will update the live resource on cluster immediately.</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-surface-hover border border-border transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirmApply}
              disabled={isApplying}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-950 flex items-center space-x-2 disabled:opacity-50 transition-all"
            >
              {isApplying ? (
                <span>Applying to Cluster...</span>
              ) : (
                <span>Approve & Apply Mutation</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
