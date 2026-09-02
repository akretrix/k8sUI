import React, { useEffect, useState } from 'react';
import { X, Scale, AlertCircle, CheckCircle2, Loader2, Lock, Plus, Minus } from 'lucide-react';
import { api } from '../../api/tauriClient';
import { DryRunResult } from '../../types/cluster';

export interface ScaleTarget {
  kind: string;
  name: string;
  namespace: string;
  currentReplicas?: number;
}

interface ScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: ScaleTarget | null;
  isReadOnly: boolean;
  onScaled?: () => void;
}

export const ScaleModal: React.FC<ScaleModalProps> = ({
  isOpen,
  onClose,
  target,
  isReadOnly,
  onScaled,
}) => {
  const [replicas, setReplicas] = useState<number>(1);
  const [currentReplicas, setCurrentReplicas] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);

  useEffect(() => {
    if (!isOpen || !target) return;
    setError(null);
    setDryRun(null);
    setLoading(true);

    // Fetch live yaml to determine current replicas
    api
      .getResourceYaml(target.kind, target.name, target.namespace)
      .then((yamlStr) => {
        let cur = target.currentReplicas ?? 1;
        const match = yamlStr.match(/replicas:\s*(\d+)/);
        if (match && match[1]) {
          cur = parseInt(match[1], 10);
        }
        setCurrentReplicas(cur);
        setReplicas(cur);
      })
      .catch((_e) => {
        const cur = target.currentReplicas ?? 1;
        setCurrentReplicas(cur);
        setReplicas(cur);
      })
      .finally(() => setLoading(false));
  }, [isOpen, target]);

  if (!isOpen || !target) return null;

  const handleDryRunPreview = async () => {
    setError(null);
    setLoading(true);
    try {
      const originalYaml = await api.getResourceYaml(target.kind, target.name, target.namespace);
      const proposedYaml = originalYaml.replace(/replicas:\s*\d+/, `replicas: ${replicas}`);
      const result = await api.dryRunApply(proposedYaml, target.namespace);
      setDryRun(result);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyScale = async () => {
    setError(null);
    setIsApplying(true);
    try {
      await api.scaleResource(target.kind, target.name, target.namespace, replicas);
      onScaled?.();
      onClose();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-100">
      <div className="bg-surface-elevated border border-border rounded-xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-surface flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Scale Workload</span>
                <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated font-mono font-normal text-indigo-300">
                  {target.kind}/{target.name}
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Adjust desired replica count for {target.namespace}
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

        {error && (
          <div className="px-6 py-2.5 bg-red-950/80 border-b border-red-600 flex items-start space-x-2 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="whitespace-pre-wrap font-mono">{error}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-6 bg-background">
          <div className="flex items-center justify-center space-x-6 py-4">
            <div className="text-center">
              <span className="text-[11px] uppercase tracking-wider text-gray-500 font-mono block mb-1">
                Current
              </span>
              <span className="text-2xl font-bold font-mono text-gray-400 bg-surface px-4 py-2 rounded-lg border border-border">
                {currentReplicas}
              </span>
            </div>

            <div className="text-gray-500 text-lg font-bold">➔</div>

            <div className="text-center">
              <span className="text-[11px] uppercase tracking-wider text-indigo-400 font-mono block mb-1">
                Desired
              </span>
              <div className="flex items-center space-x-2 bg-surface p-1 rounded-lg border border-indigo-500/50">
                <button
                  type="button"
                  onClick={() => setReplicas((r) => Math.max(0, r - 1))}
                  disabled={isReadOnly || replicas <= 0}
                  className="p-2 rounded hover:bg-surface-elevated text-gray-300 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={replicas}
                  onChange={(e) => setReplicas(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  readOnly={isReadOnly}
                  className="w-16 text-center text-2xl font-bold font-mono bg-transparent text-indigo-200 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setReplicas((r) => r + 1)}
                  disabled={isReadOnly}
                  className="p-2 rounded hover:bg-surface-elevated text-gray-300 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {dryRun && (
            <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/20 p-3 space-y-2">
              <div className="flex items-center space-x-2 text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Dry-Run Validation Succeeded</span>
              </div>
              <pre className="text-[11px] font-mono text-gray-300 whitespace-pre bg-surface/80 p-2 rounded border border-border">
                {dryRun.diff}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            {isReadOnly && (
              <>
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Read-Only Mode is active.</span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-surface-hover border border-border transition-colors"
            >
              Cancel
            </button>
            {!dryRun ? (
              <button
                onClick={handleDryRunPreview}
                disabled={loading || isReadOnly || replicas === currentReplicas}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-surface-elevated hover:bg-surface-hover border border-border text-gray-200 disabled:opacity-40 transition-colors"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Preview Diff'}
              </button>
            ) : null}
            <button
              onClick={handleApplyScale}
              disabled={isApplying || isReadOnly || replicas === currentReplicas}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-950 flex items-center space-x-2 disabled:opacity-50 transition-all"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Scaling…</span>
                </>
              ) : (
                <span>Apply Scale ({replicas})</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
