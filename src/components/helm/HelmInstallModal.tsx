import React, { useState } from 'react';
import {
  X,
  Layers,
  AlertCircle,
  Loader2,
  CheckCircle2,
  FileCode,
  Globe,
  Tag,
} from 'lucide-react';
import { api } from '../../api/tauriClient';

interface HelmInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  namespaces: string[];
  activeNamespace: string;
  isReadOnly: boolean;
  onSuccess: (releaseName: string) => void;
}

const COMMON_CHARTS = [
  { name: 'ingress-nginx/ingress-nginx', label: 'Ingress NGINX', defaultValues: 'controller:\n  replicaCount: 2\n  service:\n    type: LoadBalancer\n' },
  { name: 'bitnami/redis', label: 'Redis (Bitnami)', defaultValues: 'architecture: standalone\nauth:\n  enabled: true\n  password: "changeMe123!"\n' },
  { name: 'bitnami/postgresql', label: 'PostgreSQL (Bitnami)', defaultValues: 'auth:\n  postgresPassword: "supersecretpassword"\n  database: "app_db"\n' },
  { name: 'prometheus-community/kube-prometheus-stack', label: 'Kube Prometheus Stack', defaultValues: 'grafana:\n  enabled: true\n  adminPassword: "admin"\n' },
  { name: 'jetstack/cert-manager', label: 'Cert Manager', defaultValues: 'installCRDs: true\n' },
];

export const HelmInstallModal: React.FC<HelmInstallModalProps> = ({
  isOpen,
  onClose,
  namespaces,
  activeNamespace,
  isReadOnly,
  onSuccess,
}) => {
  const [releaseName, setReleaseName] = useState('');
  const [namespace, setNamespace] = useState(
    activeNamespace && activeNamespace !== 'all' ? activeNamespace : 'default'
  );
  const [chart, setChart] = useState('');
  const [version, setVersion] = useState('');
  const [createNamespace, setCreateNamespace] = useState(false);
  const [valuesYaml, setValuesYaml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectTemplate = (templateChart: string, templateValues: string) => {
    setChart(templateChart);
    if (!valuesYaml.trim() || valuesYaml === '') {
      setValuesYaml(templateValues);
    }
  };

  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releaseName.trim()) {
      setError('Please provide a release name.');
      return;
    }
    if (!chart.trim()) {
      setError('Please specify a chart name or repository URL (e.g. bitnami/redis).');
      return;
    }
    if (isReadOnly) {
      setError('Cannot install Helm release in Read-Only Mode. Please unlock write access.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.installHelmRelease({
        releaseName: releaseName.trim(),
        namespace: namespace.trim(),
        chart: chart.trim(),
        version: version.trim() || undefined,
        valuesYaml: valuesYaml.trim() || undefined,
        createNamespace,
      });
      onSuccess(releaseName.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 md:p-6 animate-in fade-in duration-100 select-text">
      <div className="bg-[#10141D] border border-border/90 rounded-2xl shadow-2xl max-w-4xl w-full h-[88vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-[#0B0F17] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-100 font-mono flex items-center space-x-2">
                <span>Install Helm Chart</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">Helm v3</span>
              </h3>
              <p className="text-xs text-gray-400">Deploy a new Helm release with customized values</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleInstall} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-5 flex-1 font-mono text-xs custom-scrollbar">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 flex items-center space-x-2.5 shrink-0">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <span className="text-xs">{error}</span>
              </div>
            )}

            {/* Quick Templates */}
            <div className="space-y-2">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                Popular Chart Presets
              </span>
              <div className="flex flex-wrap gap-2">
                {COMMON_CHARTS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => handleSelectTemplate(c.name, c.defaultValues)}
                    className={`px-2.5 py-1 rounded-lg border text-xs transition-colors flex items-center space-x-1.5 ${
                      chart === c.name
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                        : 'bg-surface hover:bg-surface-elevated border-border text-gray-300'
                    }`}
                  >
                    <Globe className="w-3 h-3 text-indigo-400" />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Release Name, Namespace, Chart, Version */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-300 uppercase font-semibold">
                  Release Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={releaseName}
                  onChange={(e) => setReleaseName(e.target.value)}
                  placeholder="e.g. production-redis"
                  className="w-full bg-[#0B0F17] border border-border rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-300 uppercase font-semibold">
                  Target Namespace <span className="text-red-400">*</span>
                </label>
                <div className="flex items-center space-x-2">
                  <select
                    value={namespace}
                    onChange={(e) => setNamespace(e.target.value)}
                    className="flex-1 bg-[#0B0F17] border border-border rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {namespaces
                      .filter((n) => n !== 'all')
                      .map((ns) => (
                        <option key={ns} value={ns}>
                          {ns}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-300 uppercase font-semibold">
                  Chart Name or URL <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={chart}
                    onChange={(e) => setChart(e.target.value)}
                    placeholder="e.g. bitnami/redis or oci://..."
                    className="w-full bg-[#0B0F17] border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-indigo-500 transition-colors"
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
                    placeholder="e.g. 17.0.1 (defaults to latest)"
                    className="w-full bg-[#0B0F17] border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="create-ns-check"
                checked={createNamespace}
                onChange={(e) => setCreateNamespace(e.target.checked)}
                className="w-4 h-4 rounded bg-[#0B0F17] border-border text-indigo-600 focus:ring-0 focus:outline-none"
              />
              <label htmlFor="create-ns-check" className="text-xs text-gray-300 cursor-pointer">
                Create namespace if it does not exist (<code className="text-indigo-300">--create-namespace</code>)
              </label>
            </div>

            {/* Values.yaml Editor */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-gray-300 font-semibold uppercase">
                  <FileCode className="w-4 h-4 text-amber-400" />
                  <span>Custom Values (values.yaml)</span>
                </div>
                <span className="text-[10px] text-gray-500">YAML format · Overrides default chart values</span>
              </div>
              <textarea
                rows={12}
                value={valuesYaml}
                onChange={(e) => setValuesYaml(e.target.value)}
                placeholder={"# Add custom Helm values overrides in YAML format\nreplicaCount: 2\nresources:\n  limits:\n    cpu: 500m\n    memory: 512Mi\n"}
                className="w-full min-h-[220px] bg-[#0B0F17] border border-border rounded-xl p-4 text-xs text-gray-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed resize-y selection:bg-indigo-600/40"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border bg-[#0B0F17] flex items-center justify-between shrink-0">
            <div className="text-xs text-gray-400 font-mono flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              <span>Helm CLI Engine ready</span>
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
                className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Installing Release…</span>
                  </>
                ) : (
                  <span>Install Release</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
