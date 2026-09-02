import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DescribeModal } from './DescribeModal';
import { GenericResourceTable } from './GenericResourceTable';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { samplePodYaml } = vi.hoisted(() => {
  return {
    samplePodYaml: `
apiVersion: v1
kind: Pod
metadata:
  name: qa-ia-evaluacion-29799120-hqmns
  namespace: qa-acme
  labels:
    app: qa-evaluacion
spec:
  nodeName: ip-10-0-12-45.ec2.internal
  serviceAccountName: app-sa
  initContainers:
    - name: init-db-wait
      image: busybox:1.36
      command: ['sh', '-c', 'echo waiting']
  containers:
    - name: app-backend
      image: ghcr.io/org/backend:v2.4.1
      ports:
        - containerPort: 8080
          protocol: TCP
          name: http
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          cpu: 500m
          memory: 1024Mi
      env:
        - name: NODE_ENV
          value: production
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        - name: APP_CONFIG_URL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: api_url
      envFrom:
        - configMapRef:
            name: common-env
      volumeMounts:
        - name: app-config-vol
          mountPath: /etc/config
          readOnly: true
        - name: data-storage
          mountPath: /var/data
    - name: envoy-sidecar
      image: envoyproxy/envoy:v1.28.0
      ports:
        - containerPort: 9901
          protocol: TCP
          name: admin
      volumeMounts:
        - name: tls-certs
          mountPath: /etc/ssl/certs
          readOnly: true
  volumes:
    - name: app-config-vol
      configMap:
        name: app-config
    - name: tls-certs
      secret:
        secretName: tls-secret
    - name: data-storage
      persistentVolumeClaim:
        claimName: backend-pvc
    - name: temp-cache
      emptyDir:
        medium: Memory
status:
  phase: Running
  podIP: 10.244.3.18
  qosClass: Burstable
  containerStatuses:
    - name: app-backend
      ready: true
      restartCount: 0
      state:
        running:
          startedAt: "2026-08-28T10:00:00Z"
    - name: envoy-sidecar
      ready: true
      restartCount: 1
      state:
        running:
          startedAt: "2026-08-28T10:05:00Z"
  conditions:
    - type: Ready
      status: "True"
    - type: ContainersReady
      status: "True"
`
  };
});

// Mock Tauri API client describeResource and listResources
vi.mock('../../api/tauriClient', () => ({
  api: {
    describeResource: vi.fn().mockResolvedValue(samplePodYaml),
    getSecretData: vi.fn().mockResolvedValue({
      name: 'tls-secret',
      namespace: 'qa-acme',
      secret_type: 'kubernetes.io/tls',
      entries: [
        { key: 'tls.crt', value: '-----BEGIN CERTIFICATE-----', base64: 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t', is_binary: false },
        { key: 'tls.key', value: '-----BEGIN PRIVATE KEY-----', base64: 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t', is_binary: false },
      ],
    }),
    updateSecretData: vi.fn().mockResolvedValue({
      name: 'tls-secret',
      namespace: 'qa-acme',
      secret_type: 'kubernetes.io/tls',
      entries: [],
    }),
    listPods: vi.fn().mockResolvedValue([
      { name: 'pod-1', namespace: 'default', status: 'Running', node: 'test-node', ready: '1/1', restarts: 0, age: '1d' },
    ]),
    listResources: vi.fn().mockImplementation((kind: string) => {
      return Promise.resolve([
        {
          name: `${kind}-sample-0`,
          namespace: 'default',
          kind: kind,
          ready: '3/3',
          status: 'Active',
          age: '2d',
          rulesCount: 5,
          secretsCount: 2,
          roleRef: 'ClusterRole/admin',
          subjectsCount: 3,
          ingressClass: 'nginx',
          capacity: '10Gi',
          storageClass: 'gp3',
          provisioner: 'ebs.csi.aws.com',
          reclaimPolicy: 'Delete',
          completions: '1/1',
          schedule: '0 * * * *',
          suspend: false,
          dataCount: 4,
          secretType: 'Opaque',
        },
      ]);
    }),
  },
}));

describe('Comprehensive Functional Navigation & Describe Inspector Suite', () => {
  it('renders DescribeModal with full container breakdown, volumes, configmaps, and secrets', async () => {
    const handleClose = vi.fn();
    render(
      <DescribeModal
        isOpen={true}
        onClose={handleClose}
        resource={{ kind: 'Pod', name: 'qa-ia-evaluacion-29799120-hqmns', namespace: 'qa-acme' }}
      />
    );

    // Wait for YAML to load and parse
    expect(await screen.findByText('qa-ia-evaluacion-29799120-hqmns')).toBeInTheDocument();
    expect(screen.getAllByText(/qa-acme/i).length).toBeGreaterThan(0);

    // Verify Tab 1: Containers & Storage
    expect(screen.getByText(/Containers & Storage \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText('app-backend')).toBeInTheDocument();
    expect(screen.getByText('envoy-sidecar')).toBeInTheDocument();

    // Verify Ports
    expect(screen.getByText(/8080\/TCP/i)).toBeInTheDocument();
    expect(screen.getByText(/9901\/TCP/i)).toBeInTheDocument();

    // Verify Environment Variables & References
    const envButtons = screen.getAllByText(/Environment Variables/i);
    if (envButtons.length > 0) {
      fireEvent.click(envButtons[0]);
    }
    expect(screen.getByText('NODE_ENV')).toBeInTheDocument();
    expect(screen.getByText('DB_PASSWORD')).toBeInTheDocument();
    expect(screen.getByText('Secret: db-credentials → password')).toBeInTheDocument();
    expect(screen.getByText('ConfigMap: app-config → api_url')).toBeInTheDocument();
    expect(screen.getByText('ConfigMap: common-env')).toBeInTheDocument();

    // Verify Volume Mounts
    const volButtons = screen.getAllByText(/Volume Mounts/i);
    if (volButtons.length > 0) {
      fireEvent.click(volButtons[0]);
    }
    expect(screen.getByText('/etc/config')).toBeInTheDocument();
    expect(screen.getByText('from: app-config-vol')).toBeInTheDocument();
    expect(screen.getByText('/var/data')).toBeInTheDocument();

    // Verify Attached Volumes Catalog
    expect(screen.getByText(/Attached Volumes \(4\)/i)).toBeInTheDocument();
    expect(screen.getByText('app-config-vol')).toBeInTheDocument();
    expect(screen.getByText('tls-certs')).toBeInTheDocument();
    expect(screen.getByText('data-storage')).toBeInTheDocument();
    expect(screen.getByText('temp-cache')).toBeInTheDocument();

    // Verify Discovered ConfigMaps & Secrets Summary
    expect(screen.getByText(/ConfigMaps \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Secrets \(2\)/i)).toBeInTheDocument();
  });

  it('switches between Containers, Metrics, and Raw YAML tabs in DescribeModal', async () => {
    render(
      <DescribeModal
        isOpen={true}
        onClose={vi.fn()}
        resource={{ kind: 'Pod', name: 'qa-ia-evaluacion-29799120-hqmns', namespace: 'qa-acme' }}
      />
    );

    expect(await screen.findByText('qa-ia-evaluacion-29799120-hqmns')).toBeInTheDocument();

    // Switch to Metrics & Telemetry tab
    fireEvent.click(screen.getByText(/Metrics & Telemetry/i));
    expect(screen.getByText('CPU Utilization')).toBeInTheDocument();
    expect(screen.getByText('Memory Consumption (RSS)')).toBeInTheDocument();
    expect(screen.getByText('Network I/O Throughput')).toBeInTheDocument();
    expect(screen.getByText('Disk & Ephemeral Storage')).toBeInTheDocument();

    // Switch to Raw YAML & Conditions tab
    fireEvent.click(screen.getByText(/Raw YAML & Conditions/i));
    expect(screen.getByText(/Pod Conditions \(2\)/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Filter YAML keys or values…/i)).toBeInTheDocument();
  });

  it('navigates to referenced Secret or ConfigMap when clicking chip and supports Back button', async () => {
    render(
      <DescribeModal
        isOpen={true}
        onClose={vi.fn()}
        resource={{ kind: 'Pod', name: 'qa-ia-evaluacion-29799120-hqmns', namespace: 'qa-acme' }}
      />
    );

    expect(await screen.findByText('qa-ia-evaluacion-29799120-hqmns')).toBeInTheDocument();

    // Click on the Secret chip
    const secretChip = screen.getByTitle('Inspect Secret tls-secret');
    fireEvent.click(secretChip);

    // Verify it pushed history and updated to the secret view with Back breadcrumb
    expect(await screen.findByText('tls-secret')).toBeInTheDocument();
    expect(screen.getByText('qa-ia-evaluacion-29799120-hqmns')).toBeInTheDocument();

    // Click Back to return to Pod
    const backBtn = screen.getByTitle(/Back to qa-ia-evaluacion-29799120-hqmns/i);
    fireEvent.click(backBtn);

    // Verify back on Pod
    expect(await screen.findByText('qa-ia-evaluacion-29799120-hqmns')).toBeInTheDocument();
  });

  it('renders LimitRange in DescribeModal and displays manifest without errors', async () => {
    const handleClose = vi.fn();
    render(
      <DescribeModal
        isOpen={true}
        onClose={handleClose}
        resource={{ kind: 'LimitRange', name: 'core-resource-limits', namespace: 'default' }}
      />
    );

    expect(await screen.findByText('core-resource-limits')).toBeInTheDocument();
  });

  it('renders PodDisruptionBudget in DescribeModal and displays manifest without errors', async () => {
    const handleClose = vi.fn();
    render(
      <DescribeModal
        isOpen={true}
        onClose={handleClose}
        resource={{ kind: 'PodDisruptionBudget', name: 'frontend-pdb', namespace: 'default' }}
      />
    );

    expect(await screen.findByText('frontend-pdb')).toBeInTheDocument();
  });

  it('dynamically renders ExternalSecret overview with referenced target secrets and mappings', async () => {
    const handleClose = vi.fn();
    render(
      <DescribeModal
        isOpen={true}
        onClose={handleClose}
        resource={{ kind: 'ExternalSecret', name: 'backend-secret-sync', namespace: 'qa-acme' }}
      />
    );

    expect(await screen.findByText('backend-secret-sync')).toBeInTheDocument();
    // Verify it renders dynamic resource overview without pod placeholders
    expect(screen.queryByText('App Containers (0)')).not.toBeInTheDocument();
    expect(screen.queryByText('Attached Volumes (0)')).not.toBeInTheDocument();
  });

  it('maintains strict hook order consistency across closed and open states without throwing', () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <DescribeModal
        isOpen={false}
        onClose={handleClose}
        resource={null}
      />
    );

    // Transition from closed to open with resource
    rerender(
      <DescribeModal
        isOpen={true}
        onClose={handleClose}
        resource={{ kind: 'StatefulSet', name: 'redis-cluster', namespace: 'default' }}
      />
    );

    // Transition back to closed
    rerender(
      <DescribeModal
        isOpen={false}
        onClose={handleClose}
        resource={null}
      />
    );

    // Transition open again with different resource
    rerender(
      <DescribeModal
        isOpen={true}
        onClose={handleClose}
        resource={{ kind: 'Deployment', name: 'api-server', namespace: 'default' }}
      />
    );
  });

  const ALL_RESOURCE_KINDS = [
    'pods',
    'deployments',
    'daemonsets',
    'statefulsets',
    'replicasets',
    'jobs',
    'cronjobs',
    'configmaps',
    'secrets',
    'resourcequotas',
    'limitranges',
    'hpas',
    'pdbs',
    'priorityclasses',
    'services',
    'endpoints',
    'ingresses',
    'ingressclasses',
    'networkpolicies',
    'pvcs',
    'pvs',
    'storageclasses',
    'serviceaccounts',
    'clusterroles',
    'clusterrolebindings',
    'roles',
    'rolebindings',
    'crds',
    'helm-releases',
    'nodes',
    'events',
    'namespaces',
    'mutatingwebhooks',
    'validatingwebhooks',
  ];

  it.each(ALL_RESOURCE_KINDS)('renders GenericResourceTable smoothly for "%s" with 0 errors', async (kind) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const handleDescribe = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <GenericResourceTable
          kind={kind}
          selectedNamespaces={['default']}
          namespaces={['default', 'kube-system']}
          onSelectNamespaces={vi.fn()}
          onDescribe={handleDescribe}
          onViewYaml={vi.fn()}
          onDelete={vi.fn()}
        />
      </QueryClientProvider>
    );

    // Verify row rendered
    expect(await screen.findByText(`${kind}-sample-0`)).toBeInTheDocument();

    // Verify row click triggers describe without freezing
    fireEvent.click(screen.getByText(`${kind}-sample-0`));
    expect(handleDescribe).toHaveBeenCalled();
  });

  it('safely transitions DescribeModal between isOpen false, true, and across resource switches without hooks mismatch', async () => {
    const resource1 = { kind: 'Pod', name: 'test-pod', namespace: 'default' };
    const resource2 = { kind: 'Node', name: 'test-node' };

    // 1. Initial render closed
    const { rerender } = render(
      <DescribeModal
        isOpen={false}
        resource={null}
        onClose={vi.fn()}
      />
    );

    // 2. Open with Pod
    rerender(
      <DescribeModal
        isOpen={true}
        resource={resource1}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('test-pod')).toBeInTheDocument();

    // 3. Switch to Node
    rerender(
      <DescribeModal
        isOpen={true}
        resource={resource2}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('test-node')).toBeInTheDocument();

    // 4. Close again
    rerender(
      <DescribeModal
        isOpen={false}
        resource={resource2}
        onClose={vi.fn()}
      />
    );

    // 5. Reopen
    rerender(
      <DescribeModal
        isOpen={true}
        resource={resource1}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('test-pod')).toBeInTheDocument();
  });
});

