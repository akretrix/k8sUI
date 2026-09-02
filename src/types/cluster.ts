export type EnvironmentTier = 'Production' | 'Staging' | 'Development' | 'Local';

export interface ClusterContextSummary {
  id: string;
  name: string;
  provider: 'local' | 'eks' | 'aks';
  environment: EnvironmentTier;
  server_url: string;
  current_namespace: string;
  is_active: boolean;
  org_id?: string;
  account_id?: string;
  account_name?: string;
  role?: string;
  region?: string;
  k8s_version?: string;
}

export interface AwsSsoOrg {
  id: string;
  alias: string;
  start_url: string;
  sso_region: string;
  status: 'authenticated' | 'expired' | 'unauthenticated';
  last_synced?: string;
  accounts_count: number;
  clusters_count: number;
  assigned_role?: string;
}

export interface ContainerStatusSummary {
  name: string;
  ready: boolean;
  state: string;
  reason?: string;
}

export interface PodSummary {
  name: string;
  namespace: string;
  ready_containers: string;
  status: 'Running' | 'CrashLoopBackOff' | 'Pending' | 'Completed' | 'Error' | 'ContainerCreating' | string;
  restarts: number;
  age: string;
  cpu?: string;
  memory?: string;
  node?: string;
  containers?: ContainerStatusSummary[];
  created_at?: string;
  creationTimestamp?: string;
}

export interface DryRunResult {
  kind: string;
  name: string;
  namespace?: string;
  original_yaml: string;
  proposed_yaml: string;
  diff: string;
  server_validation_passed: boolean;
  validation_warnings: string[];
}

export interface ApplyResult {
  kind: string;
  name: string;
  namespace?: string;
  action: string;
}

export interface ScaleResult {
  kind: string;
  name: string;
  namespace: string;
  previous_replicas: number;
  new_replicas: number;
}

export interface ActivePortForward {
  session_id: string;
  namespace: string;
  pod_name: string;
  container_port: number;
  local_port: number;
  status: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  cluster_id: string;
  environment: string;
  action: string;
  target_resource: string;
  origin: 'manual' | 'ai_copilot';
  diff_summary?: string;
  status: string;
}

export interface PendingAiProposal {
  proposal_id: string;
  tool_call: {
    tool: string;
    params: Record<string, any>;
  };
  dry_run_diff: string;
  explanation: string;
  target_cluster: string;
  created_at: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  pending_proposal?: PendingAiProposal;
}

export interface ResourceMetricRing {
  usage: number;
  requests: number;
  limits: number;
  allocatable: number;
  capacity: number;
  unit: string;
  limits_exceed_capacity: boolean;
}

export interface PodsMetricRing {
  running: number;
  scheduled: number;
  pending: number;
  failed: number;
  capacity: number;
}

export interface NodesMetricSummary {
  ready: number;
  total: number;
  workers: number;
  control_plane: number;
}

export interface WorkloadHealthSummary {
  deployments_ready: number;
  deployments_total: number;
  statefulsets_ready: number;
  statefulsets_total: number;
  daemonsets_ready: number;
  daemonsets_total: number;
  cronjobs_active: number;
  cronjobs_total: number;
  jobs_active: number;
  jobs_succeeded: number;
  jobs_failed: number;
}

export interface TopologyBadge {
  name: string;
  count: number;
}

export interface NodeTopologySummary {
  zones: TopologyBadge[];
  capacity_types: TopologyBadge[];
  architectures: TopologyBadge[];
  instance_types: TopologyBadge[];
}

export interface ClusterWarningEvent {
  message: string;
  object_name: string;
  kind: string;
  namespace: string;
  count: number;
  age: string;
  reason: string;
}

export interface ClusterOverviewData {
  cpu: ResourceMetricRing;
  memory: ResourceMetricRing;
  pods: PodsMetricRing;
  nodes: NodesMetricSummary;
  workload_health: WorkloadHealthSummary;
  topology: NodeTopologySummary;
  warnings: ClusterWarningEvent[];
}

export type ClusterConnectionState = 'connected' | 'auth_expired' | 'unreachable' | 'disconnected' | 'checking';

export interface ClusterHealthInfo {
  status: ClusterConnectionState;
  message?: string;
  latency_ms?: number;
  k8s_version?: string;
  detected_profile?: string;
  is_sso: boolean;
  last_checked: string;
}

export interface SsoSessionEntry {
  session_name: string;
  start_url: string;
  sso_region: string;
  matching_profiles: string[];
  is_current_match: boolean;
}

