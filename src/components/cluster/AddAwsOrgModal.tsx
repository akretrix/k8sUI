import React, { useState } from 'react';
import { AwsSsoOrg, ClusterContextSummary, EnvironmentTier } from '../../types/cluster';
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

    setIsSubmitting(true);
    try {
      await onRegisterOrg(orgAlias, formattedUrl, ssoRegion === 'all' ? 'us-east-1' : ssoRegion);
      setAlias('');
    } finally {
      setIsSubmitting(false);
    }
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
                        <div className="p-3 bg-surface/40 space-y-2">
                          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1">
                            Discovered EKS Clusters (Click to Connect & Inspect Namespaces/Pods):
                          </div>

                          {orgClusters.length === 0 ? (
                            <div className="text-xs text-gray-500 py-3 px-2">
                              No clusters found in this organization. Check the Troubleshooting tab.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-2.5">
                              {orgClusters.map((cluster) => {
                                const isActive = cluster.id === activeCluster?.id;

                                return (
                                  <div
                                    key={cluster.id}
                                    className={`p-3 rounded-lg border flex items-center justify-between transition-all ${
                                      isActive
                                        ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md'
                                        : 'bg-surface-elevated/70 border-border hover:border-gray-600 text-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-3 min-w-0 pr-3">
                                      <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 shrink-0">
                                        <Layers className="w-4 h-4" />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center space-x-2">
                                          <span className="font-bold text-xs truncate">
                                            {cluster.name}
                                          </span>
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
                                            Account: <b>{cluster.account_name}</b> ({cluster.account_id}) • {cluster.region}
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
                                      onClick={() => handleConnectAndClose(cluster.id)}
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
                              })}
                            </div>
                          )}
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
