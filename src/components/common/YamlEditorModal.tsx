import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, AlertCircle, CheckCircle2, Loader2, Pencil, Lock } from 'lucide-react';
import { api } from '../../api/tauriClient';
import { DryRunResult } from '../../types/cluster';

export interface EditableResourceRef {
  kind: string;
  name: string;
  namespace?: string;
}

interface YamlEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: EditableResourceRef | null;
  isReadOnly: boolean;
  onApplied?: () => void;
}

/**
 * Real view/edit/apply for any resource kind — Pods included.
 *
 * Before this, "View YAML" on the pod table opened the scale dry-run modal
 * (wrong handler entirely) and the generic table's "Edit YAML" was a
 * `console.log`. Both are wired to the same real backend the dry-run/apply
 * flow already uses (`get_resource_yaml`, `dry_run_apply`, `apply_manifest`),
 * generic across every discovered kind — not just the ones with dedicated UI.
 */
export const YamlEditorModal: React.FC<YamlEditorModalProps> = ({
  isOpen,
  onClose,
  resource,
  isReadOnly,
  onApplied,
}) => {
  const [step, setStep] = useState<'edit' | 'diff'>('edit');
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (!isOpen || !resource) return;
    setStep('edit');
    setError(null);
    setDryRun(null);
    setLoading(true);
    api
      .getResourceYaml(resource.kind, resource.name, resource.namespace)
      .then(setYaml)
      .catch((e: any) => setError(e?.message || String(e)))
      .finally(() => setLoading(false));
  }, [isOpen, resource]);

  if (!isOpen || !resource) return null;

  const handleReview = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await api.dryRunApply(yaml, resource.namespace);
      setDryRun(result);
      setStep('diff');
    } catch (e: any) {
      // The API server's own validation message — a schema error, an
      // immutable-field change, an admission webhook denial — belongs to the
      // user verbatim; a generic "dry run failed" would hide the actual fix.
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setIsApplying(true);
    setError(null);
    try {
      await api.applyManifest(yaml, resource.namespace);
      onApplied?.();
      onClose();
    } catch (e: any) {
      setError(e?.message || String(e));
      setStep('edit');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-100">
      <div className="bg-surface-elevated border border-border rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-surface flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400">
              {step === 'edit' ? <Pencil className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>{step === 'edit' ? 'Edit YAML' : 'Dry-Run Diff Confirmation'}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated font-mono font-normal text-indigo-300">
                  {resource.kind}/{resource.name}
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                {step === 'edit'
                  ? isReadOnly
                    ? 'Read-only mode — unlock write access to apply changes.'
                    : 'Edit, then review a server-side dry-run diff before applying.'
                  : 'Review the server-side dry-run diff against live cluster state.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-surface-hover transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="px-6 py-2.5 bg-red-950/80 border-b border-red-600 flex items-start space-x-2 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="whitespace-pre-wrap font-mono">{error}</span>
          </div>
        )}

        {step === 'diff' && dryRun && (
          <div className="px-6 py-2.5 bg-emerald-950/40 border-b border-emerald-800/60 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-emerald-300 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Server-Side Dry-Run Validation Passed</span>
            </div>
            {dryRun.validation_warnings.length > 0 && (
              <span className="text-[11px] font-mono text-amber-400/80">{dryRun.validation_warnings.length} warning(s)</span>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto p-6 bg-background">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-xs space-x-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{step === 'edit' ? 'Loading resource…' : 'Running server-side dry-run…'}</span>
            </div>
          ) : step === 'edit' ? (
            <textarea
              value={yaml}
              onChange={(e) => setYaml(e.target.value)}
              readOnly={isReadOnly}
              spellCheck={false}
              className="w-full h-full min-h-[400px] bg-surface/80 border border-border rounded-lg p-4 font-mono text-xs text-gray-200 focus:outline-none focus:border-indigo-500 resize-none disabled:opacity-60"
            />
          ) : (
            <div className="rounded-lg border border-border bg-surface/80 p-4 font-mono text-xs overflow-x-auto text-gray-200">
              <pre className="whitespace-pre">
                {(dryRun?.diff || '').split('\n').map((line, idx) => {
                  let colorClass = 'text-gray-300';
                  if (line.startsWith('+')) colorClass = 'text-emerald-400 bg-emerald-950/30';
                  if (line.startsWith('-')) colorClass = 'text-red-400 bg-red-950/30';
                  if (line.startsWith('---') || line.startsWith('+++')) colorClass = 'text-indigo-400 font-bold';
                  return (
                    <div key={idx} className={`px-2 py-0.5 rounded ${colorClass}`}>
                      {line || ' '}
                    </div>
                  );
                })}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            {isReadOnly ? (
              <>
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Read-only mode is active.</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>Applying will update the live resource on cluster immediately.</span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {step === 'diff' ? (
              <button
                onClick={() => setStep('edit')}
                disabled={isApplying}
                className="px-4 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-surface-hover border border-border transition-colors"
              >
                Back to Edit
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-surface-hover border border-border transition-colors"
              >
                Cancel
              </button>
            )}
            {step === 'edit' ? (
              <button
                onClick={handleReview}
                disabled={loading || isReadOnly}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-950 flex items-center space-x-2 disabled:opacity-50 transition-all"
              >
                <span>Review Changes (Dry Run)</span>
              </button>
            ) : (
              <button
                onClick={handleApply}
                disabled={isApplying || isReadOnly}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-950 flex items-center space-x-2 disabled:opacity-50 transition-all"
              >
                {isApplying ? <span>Applying to Cluster…</span> : <span>Approve & Apply</span>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
