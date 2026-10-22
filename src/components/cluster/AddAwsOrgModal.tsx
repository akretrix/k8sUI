import React, { useState, useEffect } from 'react';
import { AwsSsoOrg, ClusterContextSummary, EnvironmentTier } from '../../types/cluster';
import { api } from '../../api/tauriClient';
import {
  Server,
  ShieldCheck,
  Plus,
  RefreshCw,
  X,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  AlertTriangle,
  Sparkles,
  Layers,
  ArrowRight,
  Search,
  CheckSquare,
  Square,
  Globe,
  Copy,
  Check,
} from 'lucide-react';

interface AddAwsOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgs: AwsSsoOrg[];
  clusters: ClusterContextSummary[];
  activeCluster: ClusterContextSummary | null;
  onSelectCluster: (clusterId: string) => void;
  onRegisterOrg: (alias: string, startUrl: string, ssoRegion: string) => Promise<void>;
  onRefreshOrg: (orgId: string) => Promise<void>;
}

export const AddAwsOrgModal: React.FC<AddAwsOrgModalProps> = ({
  isOpen,
  onClose,
  orgs,
  clusters,
  activeCluster,
  onSelectCluster,
  onRegisterOrg,
  onRefreshOrg,
}) => {
  const [activeTab, setActiveTab] = useState<'sso' | 'troubleshoot'>('sso');
  const [alias, setAlias] = useState('');
  const [startUrl, setStartUrl] = useState('https://your-org.awsapps.com/start');
  const [ssoRegion, setSsoRegion] = useState('all'); // all regions or specific
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshingOrgId, setRefreshingOrgId] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [clusterSearch, setClusterSearch] = useState<string>('');
  const [checkedClusterIds, setCheckedClusterIds] = useState<Set<string>>(new Set());
  const [isAwsCliInstalled, setIsAwsCliInstalled] = useState<boolean | null>(null);
  const [copiedBrew, setCopiedBrew] = useState(false);
  const [autoConfiguringOrgId, setAutoConfiguringOrgId] = useState<string | null>(null);
  const [autoConfigStatus, setAutoConfigStatus] = useState<string | null>(null);
  const [autoConfigureOnRegister, setAutoConfigureOnRegister] = useState(true);
  const [copiedSsoCmdOrgId, setCopiedSsoCmdOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.checkAwsCliInstalled()
        .then(setIsAwsCliInstalled)
        .catch(() => setIsAwsCliInstalled(true));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getEnvBadgeClass = (env: EnvironmentTier) => {
    switch (env) {
      case 'Production':
        return 'bg-red-950 text-red-400 border-red-800 border';
      case 'Staging':
        return 'bg-amber-950 text-amber-400 border-amber-800 border';
      case 'Development':
        return 'bg-emerald-950 text-emerald-400 border-emerald-800 border';
      case 'Local':
        return 'bg-blue-950 text-blue-400 border-blue-800 border';
      default:
        return 'bg-gray-800 text-gray-300 border-gray-700 border';
    }
  };

  const handleSubmitSso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startUrl) return;

    let formattedUrl = startUrl.trim();
    if (!formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    if (!formattedUrl.endsWith('/start') && !formattedUrl.includes('/start/')) {
      formattedUrl = formattedUrl.replace(/\/$/, '') + '/start';
    }

    const orgAlias = alias.trim() || formattedUrl.replace('https://', '').split('.')[0];
    const targetRegion = ssoRegion === 'all' ? 'us-east-1' : ssoRegion;

    setIsSubmitting(true);
    try {
      await onRegisterOrg(orgAlias, formattedUrl, targetRegion);
      setAlias('');

      if (autoConfigureOnRegister) {
        setAutoConfigStatus('Launching AWS SSO browser authorization...');
        try {
          await api.autoConfigureAwsSso({
            alias: orgAlias,
            startUrl: formattedUrl,
            ssoRegion: targetRegion,
          });
          const newOrgId = formattedUrl.replace('https://', '').split('.')[0];
          await onRefreshOrg(newOrgId);
        } catch (ssoErr) {
          console.warn('Auto-configure SSO after register:', ssoErr);
        } finally {
          setAutoConfigStatus(null);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoConfigureOrg = async (org: AwsSsoOrg) => {
    setAutoConfiguringOrgId(org.id);
    setAutoConfigStatus('Opening browser for AWS SSO authorization...');
    try {
      setAutoConfigStatus('Waiting for browser approval & writing profiles to ~/.aws/config...');
      await api.autoConfigureAwsSso({
        alias: org.alias,
        startUrl: org.start_url,
        ssoRegion: org.sso_region,
      });
      setAutoConfigStatus('Configured profiles! Scanning EKS clusters...');
      await onRefreshOrg(org.id);
      setAutoConfigStatus(null);
    } catch (err: any) {
      alert(`Auto-configure failed: ${err?.message || err}`);
      setAutoConfigStatus(null);
    } finally {
      setAutoConfiguringOrgId(null);
    }
  };

  const handleCopySsoCmd = (orgAlias: string, orgId: string) => {
    const cmd = `aws sso login --sso-session ${orgAlias || '<session-name>'}`;
    navigator.clipboard.writeText(cmd);
    setCopiedSsoCmdOrgId(orgId);
    setTimeout(() => setCopiedSsoCmdOrgId(null), 2500);
  };

  const handleRefresh = async (orgId: string) => {
    setRefreshingOrgId(orgId);
    try {
      await onRefreshOrg(orgId);
    } finally {
      setRefreshingOrgId(null);
    }
  };

  const handleConnectAndClose = (clusterId: string) => {
    onSelectCluster(clusterId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-100">
      <div className="bg-surface-elevated border border-border rounded-xl shadow-2xl max-w-3xl w-full flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-surface flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>AWS IAM Identity Center (SSO) & EKS Discovery</span>
              </h3>
              <p className="text-xs text-gray-400">
                Authenticate with AWS SSO to auto-discover all accessible AWS accounts and EKS clusters.
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-border bg-surface/50 px-6 space-x-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('sso')}
            className={`py-3 border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'sso'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Discovery & Discovered Clusters</span>
          </button>

          <button
            onClick={() => setActiveTab('troubleshoot')}
            className={`py-3 border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'troubleshoot'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Why Account/Cluster is Missing?</span>
          </button>
        </div>

        {/* Security Notice */}
        <div className="px-6 py-2.5 bg-orange-950/30 border-b border-orange-900/40 text-[11px] text-orange-300 flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-orange-400 shrink-0" />
          <span>
            <b>Zero Static Keys</b>: Uses OIDC PKCE device authorization & short-lived STS tokens (15-min). No permanent IAM access keys stored.
          </span>
        </div>

        {/* Tab 1: Auto-Discovery Form & Discovered Clusters List */}
        {activeTab === 'sso' && (
          <div className="overflow-y-auto flex-1 p-6 space-y-6">
            {/* Missing AWS CLI Warning */}
            {isAwsCliInstalled === false && (
              <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-200 flex items-start space-x-3 text-xs">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-white">AWS CLI is not installed on this machine</div>
                  <div className="text-[11px] text-rose-300/90 mt-0.5">
                    AWS CLI (<code>aws</code>) is required for SSO authentication and EKS cluster communication. Please install it with Homebrew:
                  </div>
                  <div className="mt-2 flex items-center space-x-2">
                    <code className="bg-black/50 px-2.5 py-1 rounded font-mono text-[11px] text-white border border-rose-900/50">
                      brew install awscli
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('brew install awscli');
                        setCopiedBrew(true);
                        setTimeout(() => setCopiedBrew(false), 2000);
                      }}
                      className="px-2.5 py-1 rounded bg-rose-900/40 hover:bg-rose-900/80 border border-rose-700/60 text-[11px] text-rose-200 flex items-center space-x-1 transition-colors"
                    >
                      {copiedBrew ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedBrew ? 'Copied!' : 'Copy Command'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Active Registered AWS SSO Organizations & Their Discovered Clusters */}
            <div>
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
                Registered AWS SSO Organizations & Discovered EKS Clusters ({orgs.length})
              </h4>

              <div className="space-y-4">
                {orgs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-gray-500 font-sans border border-dashed border-border rounded-lg">
                    No AWS SSO organizations registered yet.
                  </div>
                ) : (
                  orgs.map((org) => {
                    // `c.provider === 'eks'` was in this filter and matched every EKS
                    // cluster regardless of which org discovered it — across 5 unrelated
                    // AWS accounts, every cluster got attributed to whichever org card
                    // rendered first. For a tool whose job is showing access boundaries
                    // correctly, that is a correctness bug, not a display nit.
                    const orgClusters = clusters.filter(
                      (c) => c.org_id === org.id
                    );

                    return (
                      <div
                        key={org.id}
                        className="rounded-xl border border-border bg-surface overflow-hidden shadow-lg"
                      >
                        {/* Org Header Card */}
                        <div className="px-4 py-3.5 border-b border-border/80 bg-surface-elevated/60 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-1.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white flex items-center space-x-2">
                                <span>{org.alias}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-orange-300">
                                  {org.sso_region}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-400 font-mono">
                                {org.start_url}
                              </div>
                              <div className="text-[10px] text-emerald-400 mt-0.5 font-medium flex items-center space-x-2">
                                <span>{org.accounts_count} Accounts Connected • {orgClusters.length} EKS Clusters Available</span>
                                {org.assigned_role && (
                                  <span className="text-orange-300 font-mono">
                                    • Role: {org.assigned_role}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleRefresh(org.id)}
                              disabled={refreshingOrgId === org.id}
                              className="px-2.5 py-1.5 rounded-md border border-border text-gray-300 hover:text-white hover:bg-surface text-xs flex items-center space-x-1.5 transition-colors"
                              title="Re-scan and refresh EKS clusters across accounts"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${
                                  refreshingOrgId === org.id ? 'animate-spin text-orange-400' : ''
                                }`}
                              />
                              <span className="hidden sm:inline">Sync Clusters</span>
                            </button>
                            <a
                              href={org.start_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-md border border-border text-gray-400 hover:text-white hover:bg-surface text-xs flex items-center"
                              title="Open AWS SSO Portal in browser"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>

                        {/* Discovered EKS Clusters Inside This Org */}
                        <div className="p-3 bg-surface/40 space-y-3">
                          {orgClusters.length === 0 ? (
                            <div className="text-xs text-gray-400 py-3.5 px-4 bg-surface-elevated/50 rounded-lg border border-border/80 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-gray-200 flex items-center space-x-1.5">
                                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                                    <span>No EKS clusters or configured AWS profiles found</span>
                                  </div>
                                  <div className="text-[11px] text-gray-400 mt-1">
                                    Authenticate via AWS IAM Identity Center to automatically generate your AWS CLI profiles and discover EKS clusters.
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAutoConfigureOrg(org)}
                                  disabled={autoConfiguringOrgId === org.id}
                                  className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs shadow-md shadow-orange-950 flex items-center space-x-2 shrink-0 transition-all disabled:opacity-50"
                                >
                                  {autoConfiguringOrgId === org.id ? (
                                    <>
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      <span>Authorizing...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-3.5 h-3.5" />
                                      <span>Auto-Configure via SSO</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              {autoConfiguringOrgId === org.id && autoConfigStatus && (
                                <div className="p-2.5 rounded bg-orange-950/40 border border-orange-800/60 text-[11px] text-orange-200 flex items-center space-x-2">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-400 shrink-0" />
                                  <span>{autoConfigStatus}</span>
                                </div>
                              )}

                              <div className="text-[11px] text-gray-500 pt-2 border-t border-border/40 flex items-center justify-between">
                                <span className="font-mono">Or manual terminal login:</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopySsoCmd(org.alias, org.id)}
                                  className="text-[10px] text-orange-400 hover:text-orange-300 font-mono flex items-center space-x-1"
                                >
                                  {copiedSsoCmdOrgId === org.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span className="text-emerald-400">Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy: aws sso login --sso-session {org.alias || '<session-name>'}</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          ) : (() => {
                            const availableRegions = Array.from(
                              new Set(orgClusters.map((c) => c.region).filter(Boolean) as string[])
                            ).sort();

                            const filteredClusters = orgClusters.filter((c) => {
                              if (selectedRegion !== 'all' && c.region !== selectedRegion) return false;
                              if (clusterSearch.trim()) {
                                const q = clusterSearch.toLowerCase();
                                const match =
                                  (c.alias && c.alias.toLowerCase().includes(q)) ||
                                  c.name.toLowerCase().includes(q) ||
                                  (c.region && c.region.toLowerCase().includes(q)) ||
                                  (c.account_name && c.account_name.toLowerCase().includes(q)) ||
                                  (c.account_id && c.account_id.toLowerCase().includes(q));
                                if (!match) return false;
                              }
                              return true;
                            });

                            const toggleCheck = (id: string, e: React.MouseEvent) => {
                              e.stopPropagation();
                              setCheckedClusterIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(id)) next.delete(id);
                                else next.add(id);
                                return next;
                              });
                            };

                            const toggleCheckAll = () => {
                              if (checkedClusterIds.size === filteredClusters.length && filteredClusters.length > 0) {
                                setCheckedClusterIds(new Set());
                              } else {
                                setCheckedClusterIds(new Set(filteredClusters.map((c) => c.id)));
                              }
                            };

                            return (
                              <div className="space-y-3">
                                {/* Search, Region Filter, and Check All Bar */}
                                <div className="space-y-2">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="relative flex-1">
                                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                                      <input
                                        type="text"
                                        value={clusterSearch}
                                        onChange={(e) => setClusterSearch(e.target.value)}
                                        placeholder="Filter by alias, cluster name, region, account…"
                                        className="w-full bg-surface border border-border rounded-lg pl-8 pr-7 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
                                      />
                                      {clusterSearch && (
                                        <button
                                          onClick={() => setClusterSearch('')}
                                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>

                                    {/* Check all & Selection info */}
                                    <div className="flex items-center space-x-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={toggleCheckAll}
                                        className="px-2.5 py-1 rounded-md bg-surface border border-border text-[11px] text-gray-300 hover:text-white hover:bg-surface-elevated flex items-center space-x-1.5 transition-colors"
                                        title="Check or uncheck all filtered clusters"
                                      >
                                        {checkedClusterIds.size === filteredClusters.length && filteredClusters.length > 0 ? (
                                          <CheckSquare className="w-3.5 h-3.5 text-orange-400" />
                                        ) : (
                                          <Square className="w-3.5 h-3.5 text-gray-500" />
                                        )}
                                        <span>
                                          {checkedClusterIds.size > 0
                                            ? `Checked (${checkedClusterIds.size}/${filteredClusters.length})`
                                            : 'Check All'}
                                        </span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Multi-Region Filter Pills */}
                                  {availableRegions.length > 0 && (
                                    <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-[11px]">
                                      <span className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold mr-1">
                                        Regions:
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedRegion('all')}
                                        className={`px-2 py-0.5 rounded-full border text-[11px] transition-colors ${
                                          selectedRegion === 'all'
                                            ? 'bg-orange-600/30 border-orange-500 text-orange-200 font-semibold shadow-sm'
                                            : 'bg-surface border-border text-gray-400 hover:text-gray-200'
                                        }`}
                                      >
                                        All Regions ({orgClusters.length})
                                      </button>
                                      {availableRegions.map((reg) => {
                                        const count = orgClusters.filter((c) => c.region === reg).length;
                                        return (
                                          <button
                                            key={reg}
                                            type="button"
                                            onClick={() => setSelectedRegion(reg)}
                                            className={`px-2 py-0.5 rounded-full border text-[11px] flex items-center space-x-1 transition-colors ${
                                              selectedRegion === reg
                                                ? 'bg-orange-600/30 border-orange-500 text-orange-200 font-semibold shadow-sm'
                                                : 'bg-surface border-border text-gray-400 hover:text-gray-200'
                                            }`}
                                          >
                                            <Globe className="w-2.5 h-2.5 opacity-70" />
                                            <span>{reg}</span>
                                            <span className="text-[10px] opacity-75 font-mono">({count})</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* Clusters List */}
                                <div className="grid grid-cols-1 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                                  {filteredClusters.length === 0 ? (
                                    <div className="py-6 text-center text-xs text-gray-500 border border-dashed border-border rounded-lg">
                                      No clusters match region "{selectedRegion}" or search "{clusterSearch}"
                                    </div>
                                  ) : (
                                    filteredClusters.map((cluster) => {
                                      const isActive = cluster.id === activeCluster?.id;
                                      const isChecked = checkedClusterIds.has(cluster.id);

                                      return (
                                        <div
                                          key={cluster.id}
                                          className={`p-3 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                                            isActive
                                              ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md'
                                              : isChecked
                                              ? 'bg-surface-elevated/90 border-orange-500/60 text-gray-200'
                                              : 'bg-surface-elevated/70 border-border hover:border-gray-600 text-gray-200'
                                          }`}
                                          onClick={(e) => toggleCheck(cluster.id, e)}
                                        >
                                          <div className="flex items-center space-x-3 min-w-0 pr-3">
                                            {/* Checkbox */}
                                            <div
                                              className="p-1 rounded text-gray-400 hover:text-white shrink-0"
                                              onClick={(e) => toggleCheck(cluster.id, e)}
                                            >
                                              {isChecked ? (
                                                <CheckSquare className="w-4 h-4 text-orange-400" />
                                              ) : (
                                                <Square className="w-4 h-4 text-gray-500 hover:text-gray-300" />
                                              )}
                                            </div>

                                            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 shrink-0">
                                              <Layers className="w-4 h-4" />
                                            </div>

                                            <div className="min-w-0">
                                              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                                {/* Cluster Alias as primary title */}
                                                <span className="font-bold text-xs truncate text-white">
                                                  {cluster.alias || cluster.name}
                                                </span>

                                                {/* If alias is different from real cluster name, show real cluster name badge */}
                                                {cluster.alias && cluster.alias !== cluster.name && (
                                                  <span className="text-[10px] text-gray-400 font-mono px-1.5 py-0.5 rounded bg-surface border border-border">
                                                    Cluster: {cluster.name}
                                                  </span>
                                                )}

                                                {/* Region badge */}
                                                {cluster.region && (
                                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-950/60 border border-orange-800/80 text-orange-300 font-semibold flex items-center space-x-1">
                                                    <Globe className="w-2.5 h-2.5" />
                                                    <span>{cluster.region}</span>
                                                  </span>
                                                )}

                                                {cluster.k8s_version && (
                                                  <span className="text-[10px] text-gray-400 font-mono">
                                                    v{cluster.k8s_version}
                                                  </span>
                                                )}

                                                <span
                                                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase ${getEnvBadgeClass(
                                                    cluster.environment
                                                  )}`}
                                                >
                                                  {cluster.environment}
                                                </span>

                                                {isActive && (
                                                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                                                    Active Cluster
                                                  </span>
                                                )}
                                              </div>

                                              {cluster.account_name && (
                                                <div className="text-[11px] text-orange-300 font-mono truncate mt-0.5">
                                                  Account: <b>{cluster.account_name}</b> ({cluster.account_id})
                                                </div>
                                              )}

                                              <div className="text-[10px] text-gray-400 font-mono truncate mt-0.5">
                                                {cluster.server_url}
                                              </div>

                                              {cluster.role && (
                                                <div className="text-[10px] text-gray-500 font-mono truncate mt-0.5">
                                                  Role: {cluster.role}
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleConnectAndClose(cluster.id);
                                            }}
                                            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shrink-0 ${
                                              isActive
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'bg-surface border border-border text-gray-200 hover:text-white hover:bg-surface-hover hover:border-indigo-500'
                                            }`}
                                          >
                                            <span>{isActive ? 'Currently Connected' : 'Connect & Inspect'}</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Register New AWS Org Form */}
            <form onSubmit={handleSubmitSso} className="space-y-4 bg-surface/40 p-5 rounded-lg border border-border">
              <div className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                Register Another AWS SSO Organization
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-mono font-medium text-gray-300 mb-1">
                    SSO Start URL <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={startUrl}
                    onChange={(e) => setStartUrl(e.target.value)}
                    placeholder="https://your-org.awsapps.com/start"
                    className="w-full bg-surface-elevated border border-border rounded-md px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-orange-500 placeholder-gray-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-medium text-gray-300 mb-1">
                    Organization Alias / Display Name
                  </label>
                  <input
                    type="text"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="e.g. Your Organization Name"
                    className="w-full bg-surface-elevated border border-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 placeholder-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-medium text-gray-300 mb-1">
                    EKS Cluster Discovery Scan Scope
                  </label>
                  <select
                    value={ssoRegion}
                    onChange={(e) => setSsoRegion(e.target.value)}
                    className="w-full bg-surface-elevated border border-border rounded-md px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-orange-500"
                  >
                    <option value="all">🌐 Scan All Standard Regions (us-east-1, us-west-2, eu-west-1, etc.)</option>
                    <option value="us-east-1">us-east-1 (N. Virginia)</option>
                    <option value="us-east-2">us-east-2 (Ohio)</option>
                    <option value="us-west-2">us-west-2 (Oregon)</option>
                    <option value="eu-west-1">eu-west-1 (Ireland)</option>
                    <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                    <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="autoConfigureOnRegister"
                  checked={autoConfigureOnRegister}
                  onChange={(e) => setAutoConfigureOnRegister(e.target.checked)}
                  className="rounded border-border bg-surface-elevated text-orange-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                />
                <label htmlFor="autoConfigureOnRegister" className="text-xs text-gray-300 cursor-pointer select-none">
                  Automatically authenticate in browser & configure profiles in <code className="text-orange-300 text-[10px]">~/.aws/config</code>
                </label>
              </div>

              {autoConfigStatus && isSubmitting && (
                <div className="p-2.5 rounded bg-orange-950/40 border border-orange-800/60 text-[11px] text-orange-200 flex items-center space-x-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-400 shrink-0" />
                  <span>{autoConfigStatus}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px] text-gray-400">
                  Will trigger browser login for MFA confirmation.
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-950 flex items-center space-x-2 disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Authorizing & Discovering Accounts...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Connect & Auto-Discover EKS Clusters</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Troubleshooting Guide & Requirements */}
        {activeTab === 'troubleshoot' && (
          <div className="overflow-y-auto flex-1 p-6 space-y-4 text-xs">
            <div className="p-4 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-200 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm">Why is your AWS Account or EKS Cluster not appearing?</div>
                <div className="text-[11px] text-amber-300/90 mt-1">
                  In AWS IAM Identity Center, accounts and clusters only appear if three specific AWS configurations are in place:
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-lg border border-border bg-surface/50">
                <div className="font-bold text-white flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-orange-600/30 text-orange-300 flex items-center justify-center font-mono text-[11px]">
                    1
                  </span>
                  <span>IAM Identity Center: Account & Permission Set Assignment</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5 pl-7">
                  Your SSO user must be explicitly assigned to the <b>AWS Account</b> with a <b>Permission Set</b> (e.g. <code>AdministratorAccess</code> or <code>EKSAdmin</code>). If no Permission Set is assigned to your user in that account, AWS returns 0 accounts.
                </p>
                <div className="mt-2 pl-7 text-[10px] text-gray-500 font-mono">
                  AWS Console ➔ IAM Identity Center ➔ AWS accounts ➔ Assign users or groups
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-border bg-surface/50">
                <div className="font-bold text-white flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-orange-600/30 text-orange-300 flex items-center justify-center font-mono text-[11px]">
                    2
                  </span>
                  <span>IAM Permission Set Policies (EKS Discovery)</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5 pl-7">
                  The assigned IAM Permission Set must have permission to list and describe clusters:
                </p>
                <div className="mt-2 pl-7">
                  <code className="block bg-surface-elevated p-2 rounded text-[10px] font-mono text-emerald-300 border border-border">
                    {`"Action": ["eks:ListClusters", "eks:DescribeCluster", "eks:AccessKubernetesApi"]`}
                  </code>
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-border bg-surface/50">
                <div className="font-bold text-white flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-orange-600/30 text-orange-300 flex items-center justify-center font-mono text-[11px]">
                    3
                  </span>
                  <span>EKS Cluster Access Entry (Kubernetes RBAC)</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5 pl-7">
                  Even if the IAM role exists, Amazon EKS requires the IAM Role to be registered in the cluster's <b>Access Entries</b> (or <code>aws-auth</code> ConfigMap):
                </p>
                <div className="mt-2 pl-7">
                  <code className="block bg-surface-elevated p-2 rounded text-[10px] font-mono text-cyan-300 border border-border">
                    aws eks create-access-entry --cluster-name &lt;cluster&gt; --principal-arn &lt;role-arn&gt; --type STANDARD
                  </code>
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-border bg-surface/50">
                <div className="font-bold text-white flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-orange-600/30 text-orange-300 flex items-center justify-center font-mono text-[11px]">
                    4
                  </span>
                  <span>Region Verification</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5 pl-7">
                  EKS clusters are strictly regional. If your cluster is in <code>us-west-2</code> (Oregon) and the search is set to <code>us-east-1</code> (Virginia), 0 clusters will be returned. Use the <b>"Scan All Standard Regions"</b> option in the Auto-Discovery form.
                </p>
              </div>
            </div>

            {/* CLI Verification Command */}
            <div className="p-4 rounded-lg bg-surface border border-border">
              <div className="font-bold text-white mb-1">Test with AWS CLI in Terminal:</div>
              <div className="text-[11px] text-gray-400 mb-2">
                Run this command on your machine to verify if your current AWS SSO session can see the clusters:
              </div>
              <pre className="bg-surface-elevated p-2.5 rounded font-mono text-[11px] text-orange-300 overflow-x-auto border border-border">
                aws sso login --sso-session my-org{"\n"}
                aws eks list-clusters --region us-east-1
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
