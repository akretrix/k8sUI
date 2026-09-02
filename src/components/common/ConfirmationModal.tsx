import React, { useState } from 'react';
import { AlertTriangle, RefreshCcw, Trash2, X, Copy, Check } from 'lucide-react';

export type ConfirmationActionType = 'delete' | 'restart';

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
}) => {
  const [typedName, setTypedName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isDelete = actionType === 'delete';
  const requiresTypeToConfirm = isDelete; // Require typing name on destructive delete

  const handleCopyName = () => {
    navigator.clipboard.writeText(resourceName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAutoFill = () => {
    setTypedName(resourceName);
    navigator.clipboard.writeText(resourceName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = async () => {
    if (isReadOnly) {
      setError('Cannot execute mutations in Read-Only mode. Please unlock write mode first.');
      return;
    }
    if (requiresTypeToConfirm && typedName !== resourceName) {
      setError(`Please type "${resourceName}" to confirm deletion.`);
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
            <div
              className={`p-2 rounded-lg ${
                isDelete ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
              }`}
            >
              {isDelete ? <Trash2 className="w-5 h-5" /> : <RefreshCcw className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-100">
                {isDelete ? `Delete ${resourceKind}` : `Restart ${resourceKind}`}
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
          <div
            className={`p-3 rounded-lg border text-xs flex items-start space-x-2.5 select-text ${
              isDelete
                ? 'bg-red-950/40 border-red-800/60 text-red-200'
                : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="select-text">
              {isDelete ? (
                <span>
                  Are you sure you want to delete <b className="select-text">{resourceKind}/{resourceName}</b>? This action cannot be undone and will terminate all underlying pods.
                </span>
              ) : (
                <span>
                  Are you sure you want to perform a rolling rollout restart on <b className="select-text">{resourceKind}/{resourceName}</b>? This will trigger a graceful recreation of all active pods.
                </span>
              )}
            </div>
          </div>

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
                <span>Cluster:</span>
                <span className="text-gray-200 select-text">{clusterName}</span>
              </div>
            )}
          </div>

          {requiresTypeToConfirm && (
            <div className="space-y-1.5 select-text">
              <div className="flex items-center justify-between text-xs">
                <label className="text-gray-400 select-text">
                  Type <span className="font-mono text-red-300 font-semibold select-text">{resourceName}</span> to confirm:
                </label>
                <button
                  type="button"
                  onClick={handleAutoFill}
                  className="text-[11px] font-mono text-red-300 hover:text-white bg-red-950/80 hover:bg-red-900 px-2 py-0.5 rounded border border-red-800 flex items-center space-x-1 transition-colors shrink-0"
                  title="Click to copy and auto-fill the confirmation name"
                >
                  <Copy className="w-2.5 h-2.5" />
                  <span>Auto-fill</span>
                </button>
              </div>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={resourceName}
                className="w-full bg-surface border border-border rounded-md px-3 py-2 text-xs text-gray-100 font-mono focus:outline-none focus:border-red-500 transition-colors select-text"
                autoFocus
              />
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded bg-red-950/80 border border-red-700 text-xs text-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-surface flex items-center justify-end space-x-2">
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
            disabled={isSubmitting || (requiresTypeToConfirm && typedName !== resourceName)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium text-white shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
              isDelete
                ? 'bg-red-600 hover:bg-red-500 active:bg-red-700'
                : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700'
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Executing...</span>
              </>
            ) : (
              <span>{isDelete ? 'Confirm Delete' : 'Confirm Restart'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
