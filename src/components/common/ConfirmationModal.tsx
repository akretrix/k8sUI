import React, { useState } from 'react';
import { AlertTriangle, RefreshCcw, Trash2, X, Copy, Check, Play, Pause, RefreshCw } from 'lucide-react';

export type ConfirmationActionType =
  | 'delete'
  | 'restart'
  | 'trigger_job'
  | 'suspend_cronjob'
  | 'resume_cronjob'
  | 'suspend_job'
  | 'resume_job'
  | 'rerun_job';

export interface BatchTargetItem {
  name: string;
  namespace?: string;
  kind?: string;
}

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  actionType: ConfirmationActionType;
  resourceKind: string;
  resourceName: string;
  namespace?: string;
  clusterName?: string;
  isReadOnly?: boolean;
  batchItems?: BatchTargetItem[];
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  actionType,
  resourceKind,
  resourceName,
  namespace,
  clusterName,
  isReadOnly = false,
  batchItems,
}) => {
  const [typedName, setTypedName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isBatch = Boolean(batchItems && batchItems.length > 0);
  const isDelete = actionType === 'delete';
  const isTrigger = actionType === 'trigger_job';
  const isRerun = actionType === 'rerun_job';
  const isSuspend = actionType === 'suspend_cronjob' || actionType === 'suspend_job';
  const isResume = actionType === 'resume_cronjob' || actionType === 'resume_job';
  const requiresTypeToConfirm = isDelete; // Require typing name only on destructive delete
  const expectedConfirmationText = isBatch && isDelete ? 'delete' : resourceName;

  const getActionTitle = () => {
    const count = isBatch ? batchItems!.length : 1;
    const kindLabel = isBatch ? `${count} ${resourceKind}` : resourceKind;
    switch (actionType) {
      case 'delete':
        return `Delete ${kindLabel}`;
      case 'restart':
        return `Restart ${kindLabel}`;
      case 'trigger_job':
        return `Trigger Run: ${resourceKind}`;
      case 'rerun_job':
        return `Rerun ${resourceKind}`;
      case 'suspend_cronjob':
      case 'suspend_job':
        return `Suspend ${resourceKind}`;
      case 'resume_cronjob':
      case 'resume_job':
        return `Resume ${resourceKind}`;
      default:
        return `Confirm Action`;
    }
  };

  const getActionIcon = () => {
    if (isDelete) return <Trash2 className="w-5 h-5" />;
    if (isTrigger || isResume) return <Play className="w-5 h-5 fill-current" />;
    if (isSuspend) return <Pause className="w-5 h-5" />;
    if (isRerun) return <RefreshCw className="w-5 h-5" />;
    return <RefreshCcw className="w-5 h-5" />;
  };

  const getHeaderBadgeClass = () => {
    if (isDelete) return 'bg-red-500/10 text-red-400';
    if (isTrigger || isResume) return 'bg-emerald-500/10 text-emerald-400';
    if (isSuspend) return 'bg-amber-500/10 text-amber-400';
    if (isRerun) return 'bg-indigo-500/10 text-indigo-400';
    return 'bg-amber-500/10 text-amber-400';
  };

  const getBannerClass = () => {
    if (isDelete) return 'bg-red-950/40 border-red-800/60 text-red-200';
    if (isTrigger || isResume) return 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200';
    if (isSuspend) return 'bg-amber-950/40 border-amber-800/60 text-amber-200';
    if (isRerun) return 'bg-indigo-950/40 border-indigo-800/60 text-indigo-200';
    return 'bg-amber-950/40 border-amber-800/60 text-amber-200';
  };

  const getActionDescription = () => {
    if (isDelete) {
      if (isBatch) {
        return (
          <span>
            Are you sure you want to permanently delete <b className="select-text">{batchItems!.length} {resourceKind}</b>? This action cannot be undone and will permanently terminate all selected resources.
          </span>
        );
      }
      return (
        <span>
          Are you sure you want to delete <b className="select-text">{resourceKind}/{resourceName}</b>? This action cannot be undone and will terminate all underlying pods.
        </span>
      );
    }
    if (isTrigger) {
      return (
        <span>
          Are you sure you want to trigger an on-demand run for <b className="select-text">{resourceKind}/{resourceName}</b>? This will instantiate a new one-off Job immediately.
        </span>
      );
    }
    if (isRerun) {
      return (
        <span>
          Are you sure you want to rerun <b className="select-text">{resourceKind}/{resourceName}</b>? A new Job will be created cloning the spec of this job.
        </span>
      );
    }
    if (isSuspend) {
      return (
        <span>
          Are you sure you want to suspend <b className="select-text">{resourceKind}/{resourceName}</b>? Future scheduled runs will be paused until resumed.
        </span>
      );
    }
    if (isResume) {
      return (
        <span>
          Are you sure you want to resume <b className="select-text">{resourceKind}/{resourceName}</b>? Scheduled executions will resume according to its schedule.
        </span>
      );
    }
    if (isBatch) {
      return (
        <span>
          Are you sure you want to perform a rolling rollout restart on <b className="select-text">{batchItems!.length} {resourceKind}</b>? This will trigger a recreation of all active pods for each selected workload.
        </span>
      );
    }
    return (
      <span>
        Are you sure you want to perform a rolling rollout restart on <b className="select-text">{resourceKind}/{resourceName}</b>? This will trigger a graceful recreation of all active pods.
      </span>
    );
  };

  const handleCopyName = () => {
    navigator.clipboard.writeText(resourceName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAutoFill = () => {
    setTypedName(expectedConfirmationText);
    navigator.clipboard.writeText(expectedConfirmationText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = async () => {
    if (isReadOnly) {
      setError('Cannot execute mutations in Read-Only mode. Please unlock write mode first.');
      return;
    }
    if (requiresTypeToConfirm && typedName.trim().toLowerCase() !== expectedConfirmationText.toLowerCase()) {
      setError(`Please type "${expectedConfirmationText}" to confirm.`);
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-100 select-text">
      <div className="bg-surface-elevated border border-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden select-text">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border bg-surface flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${getHeaderBadgeClass()}`}>
              {getActionIcon()}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-100">
                {getActionTitle()}
              </h3>
              <p className="text-xs text-gray-400">Confirmation required</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 select-text">
          <div className={`p-3 rounded-lg border text-xs flex items-start space-x-2.5 select-text ${getBannerClass()}`}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="select-text">
              {getActionDescription()}
            </div>
          </div>

          {isBatch ? (
            <div className="bg-surface rounded-lg p-3 border border-border text-xs space-y-2 select-text">
              <div className="flex items-center justify-between text-gray-400 font-mono">
                <span className="font-semibold text-gray-300">Selected Items ({batchItems!.length}):</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      batchItems!.map((b) => (b.namespace ? `${b.namespace}/${b.name}` : b.name)).join('\n')
                    );
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-1 rounded hover:bg-surface-elevated text-gray-400 hover:text-white transition-colors flex items-center space-x-1 text-[11px]"
                  title="Copy list to clipboard"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy All'}</span>
                </button>
              </div>
              <div className="max-h-36 overflow-y-auto divide-y divide-border/40 font-mono text-xs border border-border/50 rounded bg-background/50 p-1.5 space-y-0.5">
                {batchItems!.map((item, idx) => (
                  <div
                    key={`${item.namespace || 'all'}-${item.name}-${idx}`}
                    className="py-1 px-1.5 flex items-center justify-between hover:bg-surface-elevated/40 rounded"
                  >
                    <span className="text-gray-200 truncate font-medium">{item.name}</span>
                    {item.namespace && (
                      <span className="text-gray-500 text-[11px] ml-2 shrink-0">{item.namespace}</span>
                    )}
                  </div>
                ))}
              </div>
              {clusterName && (
                <div className="flex justify-between text-gray-400 font-mono pt-1">
                  <span>Target Cluster:</span>
                  <span className="text-gray-200 select-text">{clusterName}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-surface rounded-lg p-3 border border-border text-xs space-y-1.5 font-mono select-text">
              <div className="flex items-center justify-between text-gray-400">
                <span>Resource:</span>
                <div className="flex items-center space-x-1.5 min-w-0">
                  <span className="text-gray-200 font-semibold truncate select-text">{resourceKind}/{resourceName}</span>
                  <button
                    type="button"
                    onClick={handleCopyName}
                    className="p-1 rounded hover:bg-surface-elevated text-gray-400 hover:text-white transition-colors"
                    title="Copy resource name to clipboard"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              {namespace && (
                <div className="flex justify-between text-gray-400">
                  <span>Namespace:</span>
                  <span className="text-gray-200 select-text">{namespace}</span>
                </div>
              )}
              {clusterName && (
                <div className="flex justify-between text-gray-400">
                  <span>Target Cluster:</span>
                  <span className="text-gray-200 select-text">{clusterName}</span>
                </div>
              )}
            </div>
          )}

          {requiresTypeToConfirm && (
            <div className="space-y-2 select-text">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="confirm-name" className="text-gray-300 font-medium select-text">
                  Type <span className="font-mono text-red-400 font-bold select-all">{expectedConfirmationText}</span> to confirm:
                </label>
                <button
                  type="button"
                  onClick={handleAutoFill}
                  className="text-[11px] text-brand-400 hover:text-brand-300 hover:underline flex items-center space-x-1"
                >
                  <span>Auto-fill</span>
                </button>
              </div>
              <input
                id="confirm-name"
                type="text"
                autoFocus
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={expectedConfirmationText}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-xs font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors select-text"
              />
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-surface flex items-center justify-end space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium text-gray-300 hover:bg-surface-hover hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={
              isSubmitting ||
              (requiresTypeToConfirm &&
                typedName.trim().toLowerCase() !== expectedConfirmationText.toLowerCase())
            }
            className={`px-4 py-1.5 rounded-md text-xs font-medium text-white shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
              isDelete
                ? 'bg-red-600 hover:bg-red-500 active:bg-red-700'
                : isTrigger || isResume
                ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700'
                : isRerun
                ? 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700'
                : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700'
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Executing...</span>
              </>
            ) : (
              <span>
                {isDelete
                  ? isBatch
                    ? `Confirm Delete (${batchItems!.length})`
                    : 'Confirm Delete'
                  : isTrigger
                  ? 'Run Job Now'
                  : isRerun
                  ? 'Confirm Rerun'
                  : isSuspend
                  ? 'Confirm Suspend'
                  : isResume
                  ? 'Confirm Resume'
                  : isBatch
                  ? `Confirm Restart (${batchItems!.length})`
                  : 'Confirm Restart'}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
