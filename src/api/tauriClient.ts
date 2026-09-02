import {
  ActivePortForward,
  ApplyResult,
  AuditEntry,
  ClusterContextSummary,
  ClusterHealthInfo,
  ClusterOverviewData,
  DryRunResult,
  PodSummary,
  SsoSessionEntry,
} from '../types/cluster';

export type { PodSummary, ClusterHealthInfo };

// Helper to check if running inside Tauri desktop shell
export const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI_IPC__' in window || '__TAURI__' in window || navigator.userAgent.includes('Tauri'));

async function invokeTauri<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    const res = await invoke<{ success: boolean; data?: T; error?: string }>(cmd, args);
    if (!res.success) {
      throw new Error(res.error || `Command ${cmd} failed`);
    }
    return res.data as T;
  }
  return mockClient(cmd, args);
}

// Resilient Mock Layer for browser preview mode
let mockClusters: ClusterContextSummary[] = [
  {
    id: 'eks:111122223333:us-east-1:pdn-acme',
    name: 'pdn-acme',
    provider: 'eks',
    environment: 'Production',
    server_url: 'https://B78A1239DF55A2C.gr7.us-east-1.eks.amazonaws.com',
    current_namespace: 'pdn-acme-backend',
    is_active: true,
    org_id: 'orgdemo',
    account_id: '111122223333',
    account_name: 'acme-production',
    role: 'AdministratorAccess/devops@demo-org.com',
    region: 'us-east-1',
    k8s_version: '1.34',
  },
  {
    id: 'eks:444455556666:us-east-1:qa-acme',
    name: 'qa-acme',
    provider: 'eks',
    environment: 'Development',
    server_url: 'https://A94B3C58DF12A1B.gr7.us-east-1.eks.amazonaws.com',
    current_namespace: 'qa-acme-backend',
    is_active: false,
    org_id: 'orgdemo',
    account_id: '444455556666',
    account_name: 'acme-staging',
    role: 'AdministratorAccess/devops@demo-org.com',
    region: 'us-east-1',
    k8s_version: '1.34',
  },
  {
    id: 'local:kind-k9s-dev',
    name: 'kind-k9s-dev',
    provider: 'local',
    environment: 'Local',
    server_url: 'https://127.0.0.1:54321',
    current_namespace: 'default',
    is_active: false,
  },
  {
    id: 'aks:rg-staging:staging-aks-cluster',
    name: 'staging-aks-cluster',
    provider: 'aks',
    environment: 'Staging',
    server_url: 'https://staging-aks-dns-01.hcp.eastus.azmk8s.io:443',
    current_namespace: 'frontend',
    is_active: false,
  },
];

let isReadOnlyState = true;

let mockPods: Record<string, PodSummary[]> = {
  'eks:111122223333:us-east-1:pdn-acme': [
    {
      name: 'backend-api-production-78fb-99plk',
      namespace: 'pdn-acme-backend',
      ready_containers: '3/3',
      status: 'Running',
      restarts: 0,
      age: '45d',
      cpu: '140m',
      memory: '420Mi',
      node: 'ip-10-0-64-12.us-east-1.compute.internal',
    },
    {
      name: 'auth-service-production-69cdb-x12w9',
      namespace: 'pdn-acme-backend',
      ready_containers: '2/2',
      status: 'Running',
      restarts: 0,
      age: '45d',
      cpu: '65m',
      memory: '210Mi',
      node: 'ip-10-0-64-13.us-east-1.compute.internal',
    },
    {
      name: 'payment-gateway-6cd9b-44p9q',
      namespace: 'pdn-acme-backend',
      ready_containers: '2/2',
      status: 'Running',
      restarts: 0,
      age: '30d',
      cpu: '85m',
      memory: '380Mi',
      node: 'ip-10-0-64-13.us-east-1.compute.internal',
    },
    {
      name: 'postgres-cluster-primary-0',
      namespace: 'pdn-acme-backend',
      ready_containers: '1/1',
      status: 'Running',
      restarts: 0,
      age: '90d',
      cpu: '250m',
      memory: '1024Mi',
      node: 'ip-10-0-64-14.us-east-1.compute.internal',
    },
    {
      name: 'frontend-production-55bb-pl01a',
      namespace: 'pdn-acme-frontend',
      ready_containers: '3/3',
      status: 'Running',
      restarts: 0,
      age: '45d',
      cpu: '35m',
      memory: '110Mi',
      node: 'ip-10-0-64-12.us-east-1.compute.internal',
    },
    {
      name: 'checkout-web-99aa-z29',
      namespace: 'pdn-acme-frontend',
      ready_containers: '2/2',
      status: 'Running',
      restarts: 0,
      age: '45d',
      cpu: '30m',
      memory: '95Mi',
      node: 'ip-10-0-64-13.us-east-1.compute.internal',
    },
    {
      name: 'ingress-nginx-controller-prod-88ab',
      namespace: 'ingress-nginx',
      ready_containers: '2/2',
      status: 'Running',
      restarts: 0,
      age: '90d',
      cpu: '90m',
      memory: '320Mi',
      node: 'ip-10-0-64-12.us-east-1.compute.internal',
    },
    {
      name: 'aws-node-prod-78bf1',
      namespace: 'kube-system',
      ready_containers: '1/1',
      status: 'Running',
      restarts: 0,
      age: '90d',
      cpu: '15m',
      memory: '55Mi',
      node: 'ip-10-0-64-12.us-east-1.compute.internal',
    },
    {
      name: 'coredns-prod-88f9c-xx21a',
      namespace: 'kube-system',
      ready_containers: '2/2',
      status: 'Running',
      restarts: 0,
      age: '90d',
      cpu: '20m',
      memory: '45Mi',
      node: 'ip-10-0-64-12.us-east-1.compute.internal',
    },
    {
      name: 'datadog-agent-55x9a',
      namespace: 'monitoring',
      ready_containers: '1/1',
      status: 'Running',
      restarts: 0,
      age: '90d',
      cpu: '110m',
      memory: '450Mi',
      node: 'ip-10-0-64-12.us-east-1.compute.internal',
    },
    {
      name: 'prometheus-k8s-0',
      namespace: 'monitoring',
      ready_containers: '2/2',
      status: 'Running',
      restarts: 0,
      age: '90d',
      cpu: '350m',
      memory: '1536Mi',
      node: 'ip-10-0-64-14.us-east-1.compute.internal',
    },
  ],
  'eks:444455556666:us-east-1:qa-acme': [
    {
      name: 'backend-api-78f99-kx8w2',
      namespace: 'qa-acme-backend',
      ready_containers: '1/1',
      status: 'Running',
      restarts: 0,
      age: '5d',
      cpu: '45m',
      memory: '180Mi',
      node: 'ip-10-0-12-88.us-east-1.compute.internal',
    },
    {
      name: 'auth-service-67dd-11za',
      namespace: 'qa-acme-backend',
      ready_containers: '1/1',
      status: 'Running',
      restarts: 0,
      age: '5d',
      cpu: '20m',
      memory: '95Mi',
      node: 'ip-10-0-12-88.us-east-1.compute.internal',
    },
    {
      name: 'postgres-operator-0',
      namespace: 'qa-acme-backend',
      ready_containers: '1/1',
      status: 'Running',
      restarts: 0,
      age: '14d',
      cpu: '30m',
      memory: '250Mi',
      node: 'ip-10-0-12-89.us-east-1.compute.internal',
    },
    {
      name: 'frontend-app-55bb-pl01a',
      namespace: 'qa-acme-frontend',
      ready_containers: '2/2',
      status: 'Running',
      restarts: 0,
      age: '5d',
      cpu: '15m',
      memory: '65Mi',
      node: 'ip-10-0-12-89.us-east-1.compute.internal',
    },
    {
      name: 'catalog-ui-99aa-z29',
      namespace: 'qa-acme-frontend',
      ready_containers: '1/1',
      status: 'Running',
      restarts: 0,
      age: '5d',
      cpu: '12m',
      memory: '55Mi',
      node: 'ip-10-0-12-89.us-east-1.compute.internal',
    },
    {
      name: 'ingress-nginx-controller-6d9b-xx1',
      namespace: 'ingress-nginx',
      ready_containers: '1/1',
      status: 'Running',
      restarts: 0,
      age: '22d',
      cpu: '50m',
      memory: '160Mi',
      node: 'ip-10-0-12-88.us-east-1.compute.internal',
    },
    {
      name: 'aws-node-99ab1',
      namespace: 'kube-system',
      ready_containers: '1/1',
      status: 'Running',
      restarts: 0,
      age: '45d',
      cpu: '10m',
      memory: '48Mi',
      node: 'ip-10-0-12-88.us-east-1.compute.internal',
    },
    {
      name: 'coredns-55c9b-11',
      namespace: 'kube-system',
      ready_containers: '1/1',
      status: 'Running',
      restarts: 0,
      age: '45d',
      cpu: '12m',
      memory: '32Mi',
      node: 'ip-10-0-12-88.us-east-1.compute.internal',
    },
    {
      name: 'kube-proxy-88df',
      namespace: 'kube-system',
      ready_containers: '1/1',
      status: 'Running',
      restarts: 0,
      age: '45d',
      cpu: '5m',
      memory: '28Mi',
      node: 'ip-10-0-12-89.us-east-1.compute.internal',
    },
    {
      name: 'prometheus-server-0',
      namespace: 'monitoring',
      ready_containers: '2/2',
      status: 'Running',
      restarts: 0,
      age: '30d',
      cpu: '150m',
      memory: '512Mi',
      node: 'ip-10-0-12-88.us-east-1.compute.internal',
    },
  ],
  'local:kind-k9s-dev': [
    {
      name: 'auth-service-78dfb9f97-kx4w9',
      namespace: 'default',
      ready_containers: '1/1',
      status: 'Running',
      restarts: 0,
      age: '3d',
      cpu: '15m',
      memory: '42Mi',
      node: 'kind-control-plane',
    },
  ],
  'aks:rg-staging:staging-aks-cluster': [
    {
      name: 'web-frontend-5df447849d-c78p9',
      namespace: 'frontend',
      ready_containers: '1/1',
      status: 'Running',
      restarts: 0,
      age: '4h',
      cpu: '25m',
      memory: '80Mi',
      node: 'aks-agentpool-102938-vmss000001',
    },
  ],
};

let mockAuditLogs: AuditEntry[] = [
  {
    id: 'audit-001',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    cluster_id: 'eks:111122223333:us-east-1:pdn-acme',
    environment: 'Production',
    action: 'connect_cluster',
    target_resource: 'pdn-acme (acme-production - 111122223333)',
    origin: 'manual',
    status: 'connected_read_only',
  },
];

async function mockClient(cmd: string, args: Record<string, any>): Promise<any> {
  await new Promise((r) => setTimeout(r, 50)); // simulate slight async delay

  switch (cmd) {
    case 'get_available_clusters':
      return mockClusters;

    case 'connect_cluster': {
      mockClusters = mockClusters.map((c) => ({
        ...c,
        is_active: c.id === args.clusterId || c.id === args.cluster_id,
      }));
      isReadOnlyState = true;
      const active = mockClusters.find((c) => c.is_active) || mockClusters[0];
      mockAuditLogs.unshift({
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        cluster_id: active.id,
        environment: active.environment,
        action: 'connect_cluster',
        target_resource: `${active.name} (${active.account_name || active.provider})`,
        origin: 'manual',
        status: 'connected_read_only',
      });
      return active;
    }

    case 'get_active_cluster':
      return mockClusters.find((c) => c.is_active) || mockClusters[0];

    case 'get_read_only_status':
      return isReadOnlyState;

    case 'set_write_mode': {
      isReadOnlyState = !args.unlocked;
      const active = mockClusters.find((c) => c.is_active);
      if (active) {
        mockAuditLogs.unshift({
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          cluster_id: active.id,
          environment: active.environment,
          action: 'set_write_mode',
          target_resource: args.unlocked ? 'write_mode_unlocked' : 'read_only_locked',
          origin: 'manual',
          status: 'success',
        });
      }
      return args.unlocked;
    }

    case 'list_namespaces': {
      const active = mockClusters.find((c) => c.is_active) || mockClusters[0];
      if (active.name === 'pdn-acme') {
        return [
          'default',
          'pdn-acme-backend',
          'pdn-acme-frontend',
          'ingress-nginx',
          'kube-system',
          'monitoring',
          'cert-manager',
          'kube-public',
          'kube-node-lease',
        ];
      }
      if (active.name === 'qa-acme') {
        return [
          'default',
          'qa-acme-backend',
          'qa-acme-frontend',
          'ingress-nginx',
          'kube-system',
          'monitoring',
          'cert-manager',
          'kube-public',
          'kube-node-lease',
        ];
      }
      const pods = mockPods[active.id] || [];
      const nsSet = new Set(['default', 'kube-system', 'kube-public', ...pods.map((p) => p.namespace)]);
      return Array.from(nsSet);
    }

    case 'list_pods': {
      const active = mockClusters.find((c) => c.is_active) || mockClusters[0];
      const pods = mockPods[active.id] || mockPods['eks:111122223333:us-east-1:pdn-acme'] || [];
      if (args.namespace && args.namespace !== 'all') {
        return pods.filter((p) => p.namespace === args.namespace);
      }
      return pods;
    }

    case 'list_resources': {
      // Generate generic mock data based on resource kind
      const kind = args.kind;
      const clusterScoped = [
        'nodes',
        'crds',
        'customresourcedefinitions',
        'namespaces',
        'storageclasses',
        'clusterroles',
        'clusterrolebindings',
        'pvs',
        'persistentvolumes',
        'priorityclasses',
        'ingressclasses',
        'mutatingwebhooks',
        'mutatingwebhookconfigurations',
        'validatingwebhooks',
        'validatingwebhookconfigurations',
      ];
      const count = kind === 'nodes' ? 3 : kind === 'events' ? 15 : 5;
      const results = [];
      const effectiveNs = clusterScoped.includes(kind)
        ? ''
        : args.namespace && args.namespace !== 'all'
        ? args.namespace
        : 'pdn-acme-backend';

      for (let i = 1; i <= count; i++) {
        const base = {
          name: `${kind}-${i}`,
          namespace: effectiveNs,
          status: kind === 'events' ? (i % 4 === 0 ? 'Warning' : 'Normal') : 'Active',
          age: `${i * 2}d`,
          kind: kind,
        };

        let extra: Record<string, any> = {};
        if (kind === 'nodes') {
          extra = { roles: i === 1 ? 'control-plane' : '<none>', cpu: `${10 + i * 5}%`, memory: `${30 + i * 10}%`, version: 'v1.34.0' };
        } else if (kind === 'deployments') {
          extra = { ready: `${i}/${i}`, upToDate: `${i}`, available: `${i}`, status: 'Ready' };
        } else if (kind === 'daemonsets') {
          extra = { ready: '3/3', desired: 3, current: 3, status: 'Ready' };
        } else if (kind === 'statefulsets') {
          extra = { ready: '3/3', replicas: 3, status: 'Ready' };
        } else if (kind === 'replicasets') {
          extra = { ready: '3/3', desired: 3, status: 'Ready' };
        } else if (kind === 'jobs') {
          extra = { completions: '1/1', status: 'Completed' };
        } else if (kind === 'cronjobs') {
          extra = { schedule: '0 * * * *', suspend: false, status: 'Active' };
        } else if (kind === 'services') {
          extra = { type: i === 1 ? 'LoadBalancer' : 'ClusterIP', clusterIP: `10.96.1.${i}`, externalIP: i === 1 ? '203.0.113.5' : '<none>', ports: '80/TCP' };
        } else if (kind === 'configmaps') {
          extra = { dataCount: 4, status: 'Active' };
        } else if (kind === 'secrets') {
          extra = { secretType: i === 1 ? 'kubernetes.io/tls' : 'Opaque', dataCount: 2, status: 'Active' };
        } else if (kind === 'persistentvolumeclaims' || kind === 'pvcs') {
          extra = { capacity: `${10 * i}Gi`, storageClass: 'gp3', status: 'Bound' };
        } else if (kind === 'events') {
          extra = { eventType: i % 4 === 0 ? 'Warning' : 'Normal', reason: i % 4 === 0 ? 'BackOff' : 'Started', message: i % 4 === 0 ? 'Back-off restarting failed container' : 'Started container successfully' };
        } else if (kind === 'helm-releases' || kind === 'helm') {
          extra = { revision: 1, status: 'deployed' };
        } else if (['mutatingwebhooks', 'mutatingwebhookconfigurations', 'validatingwebhooks', 'validatingwebhookconfigurations'].includes(kind.toLowerCase())) {
          extra = {
            webhooksCount: i === 1 ? 3 : 1,
            webhookNames: i === 1 ? 'validate.cert-manager.io, webhook.aws-load-balancer.k8s.aws' : 'vpc-resource-validating-webhook.amazonaws.com',
            failurePolicy: i === 1 ? 'Fail' : 'Ignore',
            sideEffects: 'None',
            timeoutSeconds: '10s',
            status: 'Active',
          };
        } else if (kind === 'certificates' || kind === 'certificate') {
          extra = { ready: 'True', secretName: `tls-cert-secret-${i}`, issuer: 'letsencrypt-prod', status: 'Ready' };
        } else if (kind === 'issuers' || kind === 'issuer' || kind === 'clusterissuers') {
          extra = { ready: 'True', server: 'https://acme-v02.api.letsencrypt.org/directory', status: 'Ready' };
        } else if (kind === 'targetgroupbindings' || kind === 'targetgroupbinding') {
          extra = { targetGroupARN: `arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/k8s-tg-${i}/abc123`, serviceName: 'backend-api', servicePort: 80, status: 'Active' };
        } else if (kind === 'scaledobjects' || kind === 'scaledobject') {
          extra = { ready: 'True', minReplicas: 1, maxReplicas: 10, triggers: 'aws-sqs-queue', status: 'Ready' };
        }

        results.push({ ...base, ...extra });
      }
      return results;
    }

    case 'dry_run_apply':
      return {
        kind: 'Deployment',
        name: 'backend-api-production',
        namespace: args.namespace || 'pdn-acme-backend',
        original_yaml: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: backend-api-production\nspec:\n  replicas: 3\n',
        proposed_yaml: args.manifest_yaml,
        diff: '--- Live Cluster State\n+++ Proposed Dry-Run Changes\n@@ -4,1 +4,1 @@\n-  replicas: 3\n+  replicas: 5\n',
        server_validation_passed: true,
        validation_warnings: [],
      };

    case 'apply_manifest':
      if (isReadOnlyState) throw new Error('Cannot apply manifest in Read-Only Mode. Unlock write access.');
      return {
        kind: 'Deployment',
        name: 'backend-api-production',
        namespace: args.namespace || 'pdn-acme-backend',
        action: 'configured',
      };

    case 'scale_resource': {
      if (isReadOnlyState) throw new Error('Cannot scale in Read-Only Mode. Unlock write access.');
      const active = mockClusters.find((c) => c.is_active)!;
      mockAuditLogs.unshift({
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        cluster_id: active.id,
        environment: active.environment,
        action: 'scale_resource',
        target_resource: `${args.namespace}/${args.name}`,
        origin: 'manual',
        diff_summary: `Scaled replicas to ${args.replicas}`,
        status: 'scaled',
      });
      return {
        kind: args.kind,
        name: args.name,
        namespace: args.namespace,
        previous_replicas: 3,
        new_replicas: args.replicas,
      };
    }

    case 'get_audit_logs':
      return mockAuditLogs;

    case 'list_aws_sso_orgs':
      return mockAwsOrgs;

    case 'register_aws_sso_org': {
      const startUrl = args.startUrl || args.start_url || 'https://orgdemo.awsapps.com/start';
      const ssoRegion = args.ssoRegion || args.sso_region || 'us-east-1';
      const id = startUrl.replace('https://', '').split('.')[0] || 'aws-org';
      const newOrg = {
        id,
        alias: args.alias || 'Demo AWS Organization',
        start_url: startUrl,
        sso_region: ssoRegion,
        status: 'authenticated',
        last_synced: 'Just now',
        accounts_count: 2,
        clusters_count: 2,
        assigned_role: 'AdministratorAccess/devops@demo-org.com',
      };
      mockAwsOrgs = mockAwsOrgs.filter((o) => o.id !== id);
      mockAwsOrgs.push(newOrg);

      const prodEks: ClusterContextSummary = {
        id: `eks:111122223333:${ssoRegion}:pdn-acme`,
        name: 'pdn-acme',
        provider: 'eks',
        environment: 'Production',
        server_url: `https://B78A1239DF55A2C.gr7.${ssoRegion}.eks.amazonaws.com`,
        current_namespace: 'pdn-acme-backend',
        is_active: true,
        org_id: id,
        account_id: '111122223333',
        account_name: 'acme-production',
        role: 'AdministratorAccess/devops@demo-org.com',
        region: ssoRegion,
        k8s_version: '1.34',
      };

      const qaEks: ClusterContextSummary = {
        id: `eks:444455556666:${ssoRegion}:qa-acme`,
        name: 'qa-acme',
        provider: 'eks',
        environment: 'Development',
        server_url: `https://A94B3C58DF12A1B.gr7.${ssoRegion}.eks.amazonaws.com`,
        current_namespace: 'qa-acme-backend',
        is_active: false,
        org_id: id,
        account_id: '444455556666',
        account_name: 'acme-staging',
        role: 'AdministratorAccess/devops@demo-org.com',
        region: ssoRegion,
        k8s_version: '1.34',
      };

      if (!mockClusters.some((c) => c.id === prodEks.id)) mockClusters.push(prodEks);
      if (!mockClusters.some((c) => c.id === qaEks.id)) mockClusters.push(qaEks);

      mockAuditLogs.unshift({
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        cluster_id: id,
        environment: 'AWS SSO',
        action: 'register_aws_sso_org',
        target_resource: args.start_url,
        origin: 'manual',
        diff_summary: `Discovered pdn-acme (acme-production) & qa-acme (acme-staging) via role AdministratorAccess`,
        status: 'registered_and_discovered',
      });

      return newOrg;
    }

    case 'discover_aws_sso_clusters': {
      return mockClusters.filter((c) => c.provider === 'eks' && (c.org_id === args.org_id || c.id.includes(args.org_id)));
    }

    case 'list_custom_resource_types': {
      return [
        {
          group: 'acme.cert-manager.io',
          version: 'v1',
          kind: 'Challenge',
          plural: 'challenges',
          scope: 'Namespaced',
          established: true,
        },
        {
          group: 'acme.cert-manager.io',
          version: 'v1',
          kind: 'Order',
          plural: 'orders',
          scope: 'Namespaced',
          established: true,
        },
        {
          group: 'aga.k8s.aws',
          version: 'v1alpha1',
          kind: 'GlobalAccelerator',
          plural: 'globalaccelerators',
          scope: 'Cluster',
          established: true,
        },
        {
          group: 'cert-manager.io',
          version: 'v1',
          kind: 'Certificate',
          plural: 'certificates',
          scope: 'Namespaced',
          established: true,
        },
        {
          group: 'cert-manager.io',
          version: 'v1',
          kind: 'CertificateRequest',
          plural: 'certificaterequests',
          scope: 'Namespaced',
          established: true,
        },
        {
          group: 'cert-manager.io',
          version: 'v1',
          kind: 'ClusterIssuer',
          plural: 'clusterissuers',
          scope: 'Cluster',
          established: true,
        },
        {
          group: 'cert-manager.io',
          version: 'v1',
          kind: 'Issuer',
          plural: 'issuers',
          scope: 'Namespaced',
          established: true,
        },
        {
          group: 'crd.k8s.amazonaws.com',
          version: 'v1alpha1',
          kind: 'ENIConfig',
          plural: 'eniconfigs',
          scope: 'Cluster',
          established: true,
        },
        {
          group: 'elbv2.k8s.aws',
          version: 'v1beta1',
          kind: 'ALBTargetControlConfig',
          plural: 'albtargetcontrolconfigs',
          scope: 'Namespaced',
          established: true,
        },
        {
          group: 'elbv2.k8s.aws',
          version: 'v1beta1',
          kind: 'IngressClassParams',
          plural: 'ingressclassparams',
          scope: 'Cluster',
          established: true,
        },
        {
          group: 'elbv2.k8s.aws',
          version: 'v1beta1',
          kind: 'TargetGroupBinding',
          plural: 'targetgroupbindings',
          scope: 'Namespaced',
          established: true,
        },
        {
          group: 'eventing.keda.sh',
          version: 'v1alpha1',
          kind: 'CloudEventSource',
          plural: 'cloudeventsources',
          scope: 'Namespaced',
          established: true,
        },
        {
          group: 'eventing.keda.sh',
          version: 'v1alpha1',
          kind: 'ClusterCloudEventSource',
          plural: 'clustercloudeventsources',
          scope: 'Cluster',
          established: true,
        },
        {
          group: 'keda.sh',
          version: 'v1alpha1',
          kind: 'ScaledObject',
          plural: 'scaledobjects',
          scope: 'Namespaced',
          established: true,
        },
        {
          group: 'keda.sh',
          version: 'v1alpha1',
          kind: 'TriggerAuthentication',
          plural: 'triggerauthentications',
          scope: 'Namespaced',
          established: true,
        },
      ];
    }

    case 'start_terminal': {
      return `term-mock-${Date.now()}`;
    }

    case 'restart_resource':
    case 'delete_resource': {
      return true;
    }

    case 'get_cluster_overview': {
      return {
        cpu: {
          usage: 0.21,
          requests: 3.74,
          limits: 12.7,
          allocatable: 7.72,
          capacity: 8.0,
          unit: 'cores',
          limits_exceed_capacity: true,
        },
        memory: {
          usage: 5.1,
          requests: 5.9,
          limits: 27.7,
          allocatable: 16.5,
          capacity: 18.9,
          unit: 'GiB',
          limits_exceed_capacity: true,
        },
        pods: {
          running: 46,
          scheduled: 46,
          pending: 0,
          failed: 0,
          capacity: 86,
        },
        nodes: {
          ready: 4,
          total: 4,
          workers: 4,
          control_plane: 0,
        },
        workload_health: {
          deployments_ready: 26,
          deployments_total: 26,
          statefulsets_ready: 0,
          statefulsets_total: 0,
          daemonsets_ready: 5,
          daemonsets_total: 5,
          cronjobs_active: 1,
          cronjobs_total: 1,
          jobs_active: 0,
          jobs_succeeded: 3,
          jobs_failed: 0,
        },
        topology: {
          zones: [{ name: 'us-east-1a', count: 4 }],
          capacity_types: [{ name: 'On-Demand', count: 4 }],
          architectures: [{ name: 'arm64', count: 4 }],
          instance_types: [
            { name: 't4g.medium', count: 3 },
            { name: 't4g.large', count: 1 },
          ],
        },
        warnings: [
          {
            message: 'error parsing cpu metadata: strconv.ParseInt: parsing "60"": invalid syntax',
            object_name: 'acme-backend-scaledobject',
            kind: 'ScaledObject',
            namespace: 'qa-acme-backend',
            count: 5487,
            age: '2m',
            reason: 'KEDAScalerFailed',
          },
          {
            message: 'MountVolume.SetUp failed for volume "data": volume not attached',
            object_name: 'redis-cache-0',
            kind: 'Pod',
            namespace: 'qa-acme-backend',
            count: 24,
            age: '15m',
            reason: 'FailedMount',
          },
        ],
      };
    }

    case 'terminal_input':
    case 'close_terminal': {
      return undefined;
    }

    case 'get_secret_data':
      return {
        name: args.name,
        namespace: args.namespace || 'default',
        secret_type: 'Opaque',
        entries: [
          { key: 'DATABASE_URL', value: 'postgresql://postgres:secretpassword@10.0.0.1:5432/acme', base64: 'cG9zdGdyZXNxbDovL3Bvc3RncmVzOnNlY3JldHBhc3N3b3JkQDEwLjAuMC4xOjU0MzIvem9uYWZyYW5jYQ==', is_binary: false },
          { key: 'JWT_SECRET', value: 'super-secure-jwt-signing-key-production-2026', base64: 'c3VwZXItc2VjdXJlLWp3dC1zaWduaW5nLWtleS1wcm9kdWN0aW9uLTIwMjY=', is_binary: false },
          { key: 'AWS_ACCESS_KEY_ID', value: 'AKIAIOSFODNN7EXAMPLE', base64: 'QUtJQUlPU0ZPRE5ON0VYQU1QTEU=', is_binary: false },
          { key: 'AWS_SECRET_ACCESS_KEY', value: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', base64: 'd0phbHJYVXRuRkVNSS9LN01ERU5HL2JQeFJmaUNZRVhBTVBMRUtFWQ==', is_binary: false },
        ],
      };

    case 'update_secret_data':
      return {
        name: args.name,
        namespace: args.namespace || 'default',
        secret_type: 'Opaque',
        entries: Object.entries(args.entries || {}).map(([k, v]) => ({
          key: k,
          value: String(v),
          base64: btoa(String(v)),
          is_binary: false,
        })),
      };

    case 'list_aws_sso_sessions':
      // Browser-preview mock: return empty — the real Rust backend reads ~/.aws/config.
      // Never hardcode org-specific SSO URLs, regions, or profile names here.
      return [];

    case 'aws_sso_login':
      return `Successfully authenticated AWS SSO for '${args.session_name || args.profile || 'default'}'`;

    case 'get_helm_release_details':
      return {
        name: args.name,
        namespace: args.namespace || 'default',
        revision: 3,
        status: 'deployed',
        chart_name: 'ingress-nginx',
        chart_version: '4.10.1',
        app_version: '1.10.1',
        updated: new Date().toISOString(),
        user_values_yaml: 'controller:\n  replicaCount: 3\n  service:\n    type: LoadBalancer\n  metrics:\n    enabled: true\n',
        computed_values_yaml: 'controller:\n  replicaCount: 3\n  service:\n    type: LoadBalancer\n  metrics:\n    enabled: true\n',
        manifest: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ingress-nginx-controller\n  namespace: default\nspec:\n  replicas: 3\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: ingress-nginx-controller\n  namespace: default\nspec:\n  type: LoadBalancer\n',
        notes: 'The ingress-nginx controller has been installed.\nGet the application URL by running these commands:\n  kubectl --namespace default get services -o wide -w ingress-nginx-controller\n',
        history: [
          { revision: 3, updated: '2026-08-30T14:20:00Z', status: 'deployed', chart: 'ingress-nginx-4.10.1', app_version: '1.10.1', description: 'Upgrade complete' },
          { revision: 2, updated: '2026-08-25T11:15:00Z', status: 'superseded', chart: 'ingress-nginx-4.9.0', app_version: '1.9.5', description: 'Upgrade complete' },
          { revision: 1, updated: '2026-08-20T09:00:00Z', status: 'superseded', chart: 'ingress-nginx-4.8.0', app_version: '1.9.0', description: 'Install complete' },
        ],
        child_resources: [
          { kind: 'Deployment', name: 'ingress-nginx-controller', namespace: args.namespace || 'default', api_version: 'apps/v1' },
          { kind: 'Service', name: 'ingress-nginx-controller', namespace: args.namespace || 'default', api_version: 'v1' },
          { kind: 'ConfigMap', name: 'ingress-nginx-controller', namespace: args.namespace || 'default', api_version: 'v1' },
        ],
      };

    case 'install_helm_release':
      return `Release "${args.releaseName}" has been installed.`;

    case 'upgrade_helm_release':
      return `Release "${args.releaseName}" has been upgraded. Happy Helming!`;

    case 'rollback_helm_release':
      return `Rollback to revision ${args.revision} was a success! Happy Helming!`;

    case 'uninstall_helm_release':
      return `release "${args.releaseName}" uninstalled`;

    case 'list_helm_repositories':
      return [
        { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' },
        { name: 'ingress-nginx', url: 'https://kubernetes.github.io/ingress-nginx' },
        { name: 'prometheus-community', url: 'https://prometheus-community.github.io/helm-charts' },
        { name: 'jetstack', url: 'https://charts.jetstack.io' },
      ];

    case 'add_helm_repository':
      return `"${args.name}" has been added to your repositories`;

    case 'check_cluster_health': {
      const active = mockClusters.find((c) => c.is_active) || mockClusters[0];
      if (!active) {
        return {
          status: 'disconnected',
          message: 'No active cluster selected',
          is_sso: false,
          last_checked: new Date().toISOString(),
        };
      }
      return {
        status: 'connected',
        latency_ms: 28,
        k8s_version: active.k8s_version || '1.34',
        detected_profile: active.provider === 'eks' ? 'devops-admin' : undefined,
        is_sso: active.provider === 'eks',
        last_checked: new Date().toISOString(),
      };
    }

    case 'reconnect_cluster': {
      const targetId = args.clusterId || args.cluster_id || mockClusters.find((c) => c.is_active)?.id || mockClusters[0].id;
      mockClusters = mockClusters.map((c) => ({
        ...c,
        is_active: c.id === targetId,
      }));
      const active = mockClusters.find((c) => c.is_active) || mockClusters[0];
      return {
        status: 'connected',
        latency_ms: 32,
        k8s_version: active.k8s_version || '1.34',
        detected_profile: active.provider === 'eks' ? 'devops-admin' : undefined,
        is_sso: active.provider === 'eks',
        last_checked: new Date().toISOString(),
      };
    }

    default:
      throw new Error(`Mock for command ${cmd} not implemented`);
  }
}

let mockAwsOrgs = [
  {
    id: 'orgdemo',
    alias: 'Demo AWS Organization',
    start_url: 'https://orgdemo.awsapps.com/start',
    sso_region: 'us-east-1',
    status: 'authenticated',
    last_synced: 'Just now',
    accounts_count: 2,
    clusters_count: 2,
    assigned_role: 'AdministratorAccess/devops@demo-org.com',
  },
];

export interface SecretEntry {
  key: string;
  value: string;
  base64: string;
  is_binary: boolean;
}

export interface SecretDetails {
  name: string;
  namespace: string;
  secret_type: string;
  entries: SecretEntry[];
}

export interface HelmRevisionInfo {
  revision: number;
  updated: string;
  status: string;
  chart: string;
  app_version: string;
  description: string;
}

export interface HelmChildResource {
  kind: string;
  name: string;
  namespace?: string;
  api_version: string;
}

export interface HelmReleaseDetails {
  name: string;
  namespace: string;
  revision: number;
  status: string;
  chart_name: string;
  chart_version: string;
  app_version: string;
  updated: string;
  user_values_yaml: string;
  computed_values_yaml: string;
  manifest: string;
  notes: string;
  history: HelmRevisionInfo[];
  child_resources: HelmChildResource[];
}

export const api = {
  getClusters: () => invokeTauri<ClusterContextSummary[]>('get_available_clusters'),
  connectCluster: (clusterId: string) => invokeTauri<ClusterContextSummary>('connect_cluster', { clusterId }),
  reconnectCluster: (clusterId?: string) => invokeTauri<ClusterHealthInfo>('reconnect_cluster', { clusterId }),
  checkClusterHealth: () => invokeTauri<ClusterHealthInfo>('check_cluster_health'),
  getActiveCluster: () => invokeTauri<ClusterContextSummary | null>('get_active_cluster'),
  getReadOnlyStatus: () => invokeTauri<boolean>('get_read_only_status'),
  setWriteMode: (unlocked: boolean) => invokeTauri<boolean>('set_write_mode', { unlocked }),
  getNamespaces: () => invokeTauri<string[]>('list_namespaces'),
  listPods: (namespace?: string) => invokeTauri<PodSummary[]>('list_pods', { namespace }),
  listResources: (kind: string, namespace?: string) => invokeTauri<any[]>('list_resources', { kind, namespace }),
  dryRunApply: (manifestYaml: string, namespace?: string) =>
    invokeTauri<DryRunResult>('dry_run_apply', { manifestYaml, namespace }),
  applyManifest: (manifestYaml: string, namespace?: string) =>
    invokeTauri<ApplyResult>('apply_manifest', { manifestYaml, namespace }),
  scaleResource: (kind: string, name: string, namespace: string, replicas: number) => invokeTauri<any>('scale_resource', { kind, name, namespace, replicas }),
  restartResource: (kind: string, name: string, namespace: string) => invokeTauri<boolean>('restart_resource', { kind, name, namespace }),
  deleteResource: (kind: string, name: string, namespace?: string) => invokeTauri<boolean>('delete_resource', { kind, name, namespace }),
  describeResource: (kind: string, name: string, namespace?: string) => invokeTauri<string>('describe_resource', { kind, name, namespace }),
  getResourceYaml: (kind: string, name: string, namespace?: string) => invokeTauri<string>('get_resource_yaml', { kind, name, namespace }),
  getAuditLogs: () => invokeTauri<AuditEntry[]>('get_audit_logs'),
  listAwsSsoOrgs: () => invokeTauri<any[]>('list_aws_sso_orgs'),
  registerAwsSsoOrg: (alias: string, start_url: string, sso_region: string) =>
    invokeTauri<any>('register_aws_sso_org', { alias, startUrl: start_url, ssoRegion: sso_region }),
  discoverAwsSsoClusters: (org_id: string) =>
    invokeTauri<ClusterContextSummary[]>('discover_aws_sso_clusters', { orgId: org_id }),
  getLogs: (
    namespace: string,
    podName: string,
    opts: { container?: string; tailLines?: number; previous?: boolean; timestamps?: boolean } = {}
  ) =>
    invokeTauri<string>('get_logs', {
      namespace,
      podName,
      container: opts.container,
      tailLines: opts.tailLines ?? 1000,
      previous: opts.previous ?? false,
      timestamps: opts.timestamps ?? false,
    }),
  listContainers: (namespace: string, podName: string) =>
    invokeTauri<string[]>('list_containers', { namespace, podName }),
  listCustomResourceTypes: () =>
    invokeTauri<any[]>('list_custom_resource_types'),
  startTerminal: (namespace: string, podName: string, container?: string, cols?: number, rows?: number) =>
    invokeTauri<string>('start_terminal', { namespace, podName, container, cols, rows }),
  terminalInput: (sessionId: string, data: string) =>
    invokeTauri<void>('terminal_input', { sessionId, data }),
  resizeTerminal: (sessionId: string, cols: number, rows: number) =>
    invokeTauri<void>('terminal_resize', { sessionId, cols, rows }),
  saveFile: (path: string, contents: string) =>
    invokeTauri<void>('save_file', { path, contents }),
  closeTerminal: (sessionId: string) =>
    invokeTauri<void>('close_terminal', { sessionId }),
  startPortForward: (namespace: string, podName: string, containerPort: number, localPort: number) =>
    invokeTauri<ActivePortForward>('start_port_forward', { namespace, podName, containerPort, localPort }),
  stopPortForward: (sessionId: string) =>
    invokeTauri<void>('stop_port_forward', { sessionId }),
  listPortForwards: () =>
    invokeTauri<ActivePortForward[]>('list_port_forwards'),
  getClusterOverview: () =>
    invokeTauri<ClusterOverviewData>('get_cluster_overview'),
  getSecretData: (name: string, namespace?: string) =>
    invokeTauri<SecretDetails>('get_secret_data', { name, namespace }),
  updateSecretData: (
    name: string,
    namespace: string | undefined,
    entries: Record<string, string>,
    is_plaintext: boolean
  ) =>
    invokeTauri<SecretDetails>('update_secret_data', {
      name,
      namespace,
      entries,
      isPlaintext: is_plaintext,
    }),
  listAwsSsoSessions: () =>
    invokeTauri<SsoSessionEntry[]>('list_aws_sso_sessions'),
  awsSsoLogin: (params?: { profile?: string; sessionName?: string }) =>
    invokeTauri<string>('aws_sso_login', {
      profile: params?.profile,
      sessionName: params?.sessionName,
      session_name: params?.sessionName,
    }),
  openTerminalSsoLogin: (profile?: string) =>
    invokeTauri<string>('open_terminal_sso_login', { profile }),
  getSsoLoginCommand: (profile?: string) =>
    invokeTauri<string>('get_sso_login_command', { profile }),
  getHelmReleaseDetails: (name: string, namespace?: string) =>
    invokeTauri<HelmReleaseDetails>('get_helm_release_details', { name, namespace }),
  installHelmRelease: (params: {
    releaseName: string;
    namespace: string;
    chart: string;
    version?: string;
    valuesYaml?: string;
    createNamespace?: boolean;
  }) =>
    invokeTauri<string>('install_helm_release', params),
  upgradeHelmRelease: (params: {
    releaseName: string;
    namespace: string;
    chart?: string;
    version?: string;
    valuesYaml?: string;
    resetValues?: boolean;
  }) =>
    invokeTauri<string>('upgrade_helm_release', params),
  rollbackHelmRelease: (params: {
    releaseName: string;
    namespace: string;
    revision: number;
  }) =>
    invokeTauri<string>('rollback_helm_release', params),
  uninstallHelmRelease: (params: {
    releaseName: string;
    namespace: string;
    keepHistory?: boolean;
  }) =>
    invokeTauri<string>('uninstall_helm_release', params),
  listHelmRepositories: () =>
    invokeTauri<any[]>('list_helm_repositories'),
  addHelmRepository: (name: string, url: string) =>
    invokeTauri<string>('add_helm_repository', { name, url }),
  openExternalUrl: (url: string) => {
    if (isTauri) {
      return invokeTauri<void>('open_external_url', { url }).catch(() => {
        window.open(url, '_blank');
      });
    }
    window.open(url, '_blank');
    return Promise.resolve();
  },
};
