import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  AlertCircle,
  Loader2,
  CheckCircle2,
  FileCode,
  Globe,
  Tag,
  GitCompare,
  Code2,
} from 'lucide-react';
import { api } from '../../api/tauriClient';

interface HelmUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  releaseName: string;
  namespace: string;
  currentChart?: string;
  currentVersion?: string;
  initialValuesYaml?: string;
  isReadOnly: boolean;
  onSuccess: (releaseName: string) => void;
}

export const HelmUpgradeModal: React.FC<HelmUpgradeModalProps> = ({
  isOpen,
  onClose,
  releaseName,
  namespace,
  currentChart = '',
  currentVersion = '',
  initialValuesYaml = '',
  isReadOnly,
  onSuccess,
}) => {
  const [chart, setChart] = useState(currentChart);
  const [version, setVersion] = useState(currentVersion);
  const [resetValues, setResetValues] = useState(false);
  const [valuesYaml, setValuesYaml] = useState(initialValuesYaml);
  const [activeTab, setActiveTab] = useState<'edit' | 'diff'>('edit');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setChart(currentChart);
    setVersion(currentVersion);
    setValuesYaml(initialValuesYaml);
    setError(null);
  }, [currentChart, currentVersion, initialValuesYaml, isOpen]);

  if (!isOpen) return null;

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      setError('Cannot upgrade Helm release in Read-Only Mode. Please unlock write access.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.upgradeHelmRelease({
        releaseName,
        namespace,
        chart: chart.trim() || undefined,
        version: version.trim() || undefined,
        valuesYaml: valuesYaml.trim() || undefined,
        resetValues,
      });
      onSuccess(releaseName);
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const renderSimpleDiff = () => {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-[11px] text-gray-400 uppercase font-semibold">Current Deployed Values</span>
            <pre className="bg-[#0B0F17] border border-border p-3 rounded-lg text-xs font-mono text-gray-400 overflow-x-auto max-h-[400px]">
              {initialValuesYaml || '# (No previous custom values)'}
            </pre>
          </div>
          <div className="space-y-1.5">
            <span className="text-[11px] text-indigo-400 uppercase font-semibold">Proposed Upgraded Values</span>
            <pre className="bg-[#0B0F17] border border-indigo-500/30 p-3 rounded-lg text-xs font-mono text-indigo-200 overflow-x-auto max-h-[400px]">
              {valuesYaml || '# (Empty values)'}
            </pre>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 md:p-6 animate-in fade-in duration-100 select-text">
      <div className="bg-[#10141D] border border-border/90 rounded-2xl shadow-2xl max-w-4xl w-full h-[88vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-[#0B0F17] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-100 font-mono flex items-center space-x-2">
                <span>Upgrade Helm Release</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  {releaseName}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-surface border border-border text-gray-400">
                  ns: {namespace}
                </span>
              </h3>
              <p className="text-xs text-gray-400">Update chart version or customize configuration values</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex bg-[#0B0F17] border border-border rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`px-3 py-1 text-xs rounded-md font-mono transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'edit'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Editor</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('diff')}
                className={`px-3 py-1 text-xs rounded-md font-mono transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'diff'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Diff Preview</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Form */}
        <form onSubmit={handleUpgrade} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-5 flex-1 font-mono text-xs custom-scrollbar">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 flex items-center space-x-2.5 shrink-0">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <span className="text-xs">{error}</span>
              </div>
            )}

            {/* Chart & Version options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-300 uppercase font-semibold">
                  Chart Name or URL <span className="text-gray-500 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={chart}
                    onChange={(e) => setChart(e.target.value)}
                    placeholder={currentChart || 'Leave empty to keep existing chart'}
                    className="w-full bg-[#0B0F17] border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-300 uppercase font-semibold">
                  Chart Version <span className="text-gray-500 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Tag className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder={currentVersion || 'Leave empty for latest/current'}
                    className="w-full bg-[#0B0F17] border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="reset-vals-check"
                checked={resetValues}
                onChange={(e) => setResetValues(e.target.checked)}
                className="w-4 h-4 rounded bg-[#0B0F17] border-border text-amber-500 focus:ring-0 focus:outline-none"
              />
              <label htmlFor="reset-vals-check" className="text-xs text-gray-300 cursor-pointer">
                Reset to chart default values (<code className="text-amber-300">--reset-values</code>)
              </label>
            </div>

            {/* Tab Body */}
            {activeTab === 'edit' ? (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs text-gray-300 font-semibold uppercase">
                    <FileCode className="w-4 h-4 text-amber-400" />
                    <span>Values Overrides (values.yaml)</span>
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {valuesYaml.split('\n').length} lines · {new Blob([valuesYaml]).size} bytes
                  </span>
                </div>
                <textarea
                  rows={14}
                  value={valuesYaml}
                  onChange={(e) => setValuesYaml(e.target.value)}
                  placeholder={"# Enter values.yaml overrides\n"}
                  className="w-full min-h-[260px] bg-[#0B0F17] border border-border rounded-xl p-4 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-500 leading-relaxed resize-y selection:bg-amber-600/40"
                  spellCheck={false}
                />
              </div>
            ) : (
              <div className="pt-2">
                {renderSimpleDiff()}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border bg-[#0B0F17] flex items-center justify-between shrink-0">
            <div className="text-xs text-gray-400 font-mono flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Will increment revision upon upgrade</span>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-surface-hover hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || isReadOnly}
                className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 active:bg-amber-700 shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Upgrading Release…</span>
                  </>
                ) : (
                  <span>Apply Upgrade</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
