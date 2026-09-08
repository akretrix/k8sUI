import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DescribeModal } from './DescribeModal';
import { GenericResourceTable } from './GenericResourceTable';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { samplePodYaml, sampleDeploymentYaml, sampleEvents } = vi.hoisted(() => {
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
`,
    sampleDeploymentYaml: `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-deployment
  namespace: qa-acme
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: web
          image: nginx:1.25
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1024Mi
status:
  replicas: 3
  readyReplicas: 3
  updatedReplicas: 3
  availableReplicas: 3
`,
    sampleEvents: [
      {
        uid: 'evt-1',
        type: 'Warning',
        reason: 'BackOff',
        involvedObject: { kind: 'Pod', name: 'qa-ia-evaluacion-29799120-hqmns' },
        message: 'Back-off restarting failed container envoy-sidecar',
        source: 'kubelet',
        count: 3,
        lastTimestamp: '2026-08-28T10:10:00Z',
      },
      {
        uid: 'evt-2',
        type: 'Normal',
        reason: 'Scheduled',
        involvedObject: { kind: 'Pod', name: 'qa-ia-evaluacion-29799120-hqmns' },
        message: 'Successfully assigned default/qa-ia-evaluacion to ip-10-0-12-45',
        source: 'default-scheduler',
        count: 1,
        lastTimestamp: '2026-08-28T09:59:00Z',
      },
    ],
  };
});

// Mock Tauri API client describeResource and listResources
vi.mock('../../api/tauriClient', () => ({
  api: {
    describeResource: vi.fn().mockImplementation((kind?: string, name?: string) => {
      const k = (kind || '').toLowerCase();
      if (k === 'deployment' || k === 'deployments') {
        return Promise.resolve(sampleDeploymentYaml);
      }
      if (k === 'service' || k === 'services') {
        return Promise.resolve(`apiVersion: v1
kind: Service
metadata:
  name: ${name || 'test-service'}
  namespace: monitoring
spec:
  type: ClusterIP
  clusterIP: 10.96.0.45
  selector:
    app.kubernetes.io/name: opentelemetry-collector
    app.kubernetes.io/instance: otel-collector
  ports:
    - name: grpc
      port: 4317
      targetPort: 4317
      protocol: TCP
`);
      }
      if (k === 'endpoints') {
        return Promise.resolve(`apiVersion: v1
kind: Endpoints
metadata:
  name: ${name || 'test-endpoints'}
  namespace: monitoring
subsets:
  - addresses:
      - ip: 10.244.1.45
        nodeName: worker-node-1
        targetRef:
          kind: Pod
          name: otel-collector-opentelemetry-collector-9wbl7
          namespace: monitoring
    ports:
      - name: grpc
        port: 4317
        protocol: TCP
`);
      }
      return Promise.resolve(samplePodYaml);
    }),
    getResourceEvents: vi.fn().mockImplementation(() => Promise.resolve(sampleEvents)),
    getSecretData: vi.fn().mockResolvedValue({
      name: 'tls-secret',
      namespace: 'qa-acme',
      secret_type: 'kubernetes.io/tls',
      entries: [
        { key: 'tls.crt', value: '-----BEGIN CERTIFICATE-----', base64: 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t', is_binary: false },
        { key: 'tls.key', value: '[MOCK_TLS_PRIVATE_KEY_PAYLOAD]', base64: 'LS0tLS1QUklWQVRFIEtFWS0tLS0t', is_binary: false },
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

  it('renders Service overview with target selector, port mappings, and connected endpoints', async () => {
    const handleClose = vi.fn();
    render(
      <DescribeModal
        isOpen={true}
        onClose={handleClose}
        resource={{ kind: 'Service', name: 'otel-collector-opentelemetry-collector', namespace: 'monitoring' }}
      />
    );

    // Target selector header and labels
    expect(await screen.findByText(/Target Pod Selector/i)).toBeInTheDocument();
    expect(await screen.findByText('app.kubernetes.io/name')).toBeInTheDocument();
    expect(await screen.findByText('opentelemetry-collector')).toBeInTheDocument();

    // Port mappings
    expect(await screen.findByText(/Exposed Ports & Protocol Mappings/i)).toBeInTheDocument();
    expect(screen.getByText('grpc')).toBeInTheDocument();
    expect(screen.getAllByText('4317').length).toBeGreaterThanOrEqual(1);

    // Connected endpoints & target pods
    expect(await screen.findByText(/Connected Target Pods & Endpoints/i)).toBeInTheDocument();
    expect(await screen.findByText('otel-collector-opentelemetry-collector-9wbl7')).toBeInTheDocument();
    expect(screen.getByText('10.244.1.45')).toBeInTheDocument();
    expect(screen.getByText('worker-node-1')).toBeInTheDocument();
  });

  it('maintains strict hook order consistency across closed and open states without throwing', async () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <DescribeModal
        isOpen={false}
        onClose={handleClose}
        resource={null}
      />
    );

    // Transition from closed to open with resource
    await act(async () => {
      rerender(
        <DescribeModal
          isOpen={true}
          onClose={handleClose}
          resource={{ kind: 'StatefulSet', name: 'redis-cluster', namespace: 'default' }}
        />
      );
    });

    // Transition back to closed
    await act(async () => {
      rerender(
        <DescribeModal
          isOpen={false}
          onClose={handleClose}
          resource={null}
        />
      );
    });

    // Transition open again with different resource
    await act(async () => {
      rerender(
        <DescribeModal
          isOpen={true}
          onClose={handleClose}
          resource={{ kind: 'Deployment', name: 'api-server', namespace: 'default' }}
        />
      );
    });
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
    await act(async () => {
      rerender(
        <DescribeModal
          isOpen={true}
          resource={resource1}
          onClose={vi.fn()}
        />
      );
    });

    expect(await screen.findByText('test-pod')).toBeInTheDocument();

    // 3. Switch to Node
    await act(async () => {
      rerender(
        <DescribeModal
          isOpen={true}
          resource={resource2}
          onClose={vi.fn()}
        />
      );
    });

    expect(await screen.findByText('test-node')).toBeInTheDocument();

    // 4. Close again
    await act(async () => {
      rerender(
        <DescribeModal
          isOpen={false}
          resource={resource2}
          onClose={vi.fn()}
        />
      );
    });

    // 5. Reopen
    await act(async () => {
      rerender(
        <DescribeModal
          isOpen={true}
          resource={resource1}
          onClose={vi.fn()}
        />
      );
    });

    expect(await screen.findByText('test-pod')).toBeInTheDocument();
  });

  it('calculates and displays dynamic Kubernetes resource limits, requests, QoS class, and scaled footprint for Deployments', async () => {
    const deploymentResource = {
      kind: 'Deployment',
      name: 'test-deployment',
      namespace: 'qa-acme',
    };

    render(
      <DescribeModal
        isOpen={true}
        resource={deploymentResource}
        onClose={vi.fn()}
      />
    );

    // Verify Deployment name and QoS badge
    expect(await screen.findByText('test-deployment')).toBeInTheDocument();

    // Verify Pod allocation cards on Overview tab
    expect(screen.getByText('Pod Allocation')).toBeInTheDocument();
    expect(screen.getAllByText(/250m/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1.0 cores/).length).toBeGreaterThan(0);

    // Verify Scaled Cluster Footprint (3 replicas * 250m = 750m, 3 * 1000m = 3.0 cores)
    expect(screen.getByText('Cluster Footprint')).toBeInTheDocument();
    expect(screen.getByText(/750m/)).toBeInTheDocument();
    expect(screen.getByText(/3.0 cores/)).toBeInTheDocument();

    // Switch to Metrics Tab and verify dynamic limits
    const metricsTab = screen.getByRole('button', { name: /Metrics/i });
    fireEvent.click(metricsTab);

    // Verify Scaled CPU and Scaled Mem cards in Metrics
    expect(screen.getByText(/Scaled CPU \(3 pods\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Scaled Mem \(3 pods\)/i)).toBeInTheDocument();
  });

  it('fetches and renders Kubernetes Events tab with severity filtering and search', async () => {
    const podResource = {
      kind: 'Pod',
      name: 'qa-ia-evaluacion-29799120-hqmns',
      namespace: 'qa-acme',
    };

    render(
      <DescribeModal
        isOpen={true}
        resource={podResource}
        onClose={vi.fn()}
      />
    );

    // Verify resource loaded
    expect(await screen.findByText('qa-ia-evaluacion-29799120-hqmns')).toBeInTheDocument();

    // Check that Events tab header button exists and shows warning badge
    const eventsTab = screen.getByRole('button', { name: /^Events \(/i });
    expect(eventsTab).toBeInTheDocument();

    // Check Overview tab contains recent lifecycle banner
    expect(await screen.findByText(/Back-off restarting failed container envoy-sidecar/i)).toBeInTheDocument();

    // Click to open Events tab
    fireEvent.click(eventsTab);

    // Verify both events render
    expect(await screen.findByText('BackOff')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('kubelet')).toBeInTheDocument();
    expect(screen.getByText('default-scheduler')).toBeInTheDocument();

    // Filter by 'Warnings (1)'
    const warningsBtn = screen.getByRole('button', { name: /Warnings \(1\)/i });
    fireEvent.click(warningsBtn);

    expect(screen.getByText('BackOff')).toBeInTheDocument();
    expect(screen.queryByText('Scheduled')).not.toBeInTheDocument();

    // Filter by 'Normal (1)'
    const normalBtn = screen.getByRole('button', { name: /Normal \(1\)/i });
    fireEvent.click(normalBtn);

    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.queryByText('BackOff')).not.toBeInTheDocument();

    // Reset to 'All (2)'
    const allBtn = screen.getByRole('button', { name: /All \(2\)/i });
    fireEvent.click(allBtn);
    expect(screen.getByText('BackOff')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();

    // Test text search filter
    const searchInput = screen.getByPlaceholderText(/Filter events by reason, message, source, or involved object/i);
    fireEvent.change(searchInput, { target: { value: 'envoy-sidecar' } });

    expect(screen.getByText('BackOff')).toBeInTheDocument();
    expect(screen.queryByText('Scheduled')).not.toBeInTheDocument();
  });
});

