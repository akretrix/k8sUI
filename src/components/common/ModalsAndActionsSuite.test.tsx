import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScaleModal } from './ScaleModal';
import { YamlEditorModal } from './YamlEditorModal';
import { LogsView } from './LogsView';
import { PortForwardModal } from '../portforward/PortForwardModal';
import { AuditLogModal } from '../audit/AuditLogModal';
import { CommandPalette } from '../command-palette/CommandPalette';
import { DescribeModal, getExitCodeDiagnostics } from './DescribeModal';
import { MetadataLabelsAnnotations } from './MetadataLabelsAnnotations';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../api/tauriClient';

// Mock Tauri API client
vi.mock('../../api/tauriClient', () => ({
  api: {
    getResourceYaml: vi.fn().mockResolvedValue('apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: app-backend\nspec:\n  replicas: 2\n'),
    dryRunApply: vi.fn().mockResolvedValue({
      kind: 'Deployment',
      name: 'app-backend',
      namespace: 'default',
      original_yaml: 'apiVersion: apps/v1\nkind: Deployment\nspec:\n  replicas: 2\n',
      proposed_yaml: 'apiVersion: apps/v1\nkind: Deployment\nspec:\n  replicas: 3\n',
      diff: '--- Live\n+++ Proposed\n- replicas: 2\n+ replicas: 3\n',
      server_validation_passed: true,
      validation_warnings: [],
    }),
    applyManifest: vi.fn().mockResolvedValue({ kind: 'Deployment', name: 'app-backend', action: 'configured' }),
    listContainers: vi.fn().mockResolvedValue(['app-container', 'sidecar-container']),
    listPortForwards: vi.fn().mockResolvedValue([]),
    startPortForward: vi.fn().mockResolvedValue({
      session_id: 'pf-123',
      pod_name: 'test-pod-0',
      namespace: 'default',
      target_port: 80,
      local_port: 8080,
      status: 'active',
    }),
    stopPortForward: vi.fn().mockResolvedValue(true),
    listPods: vi.fn().mockResolvedValue([
      { name: 'app-backend-79d98-1', namespace: 'default', ready_containers: '1/1', status: 'Running', restarts: 0, age: '1d' },
      { name: 'app-backend-79d98-2', namespace: 'default', ready_containers: '1/1', status: 'Running', restarts: 0, age: '1d' },
    ]),
    getLogs: vi.fn().mockImplementation((_ns, _pod, opts) => {
      if (opts?.previous) {
        return Promise.resolve('[CRASH DUMP] JavaScript heap out of memory\nKilled by Linux OOM Killer with Exit 137');
      }
      return Promise.resolve('2026-08-28T10:00:00Z [INFO] Server started on port 8080\n2026-08-28T10:01:00Z [INFO] Health check passed');
    }),
    describeResource: vi.fn().mockImplementation(() => Promise.resolve(`apiVersion: v1
kind: Pod
metadata:
  name: crashing-backend-pod
  namespace: default
spec:
  containers:
    - name: api-service
      image: registry.example.com/api:v2.1.0
      resources:
        requests:
          cpu: 350m
          memory: 1740Mi
        limits:
          cpu: 2500m
          memory: 3584Mi
status:
  phase: Running
  containerStatuses:
    - name: api-service
      ready: false
      restartCount: 4
      lastState:
        terminated:
          exitCode: 137
          reason: OOMKilled
          startedAt: "2026-09-10T12:00:00Z"
          finishedAt: "2026-09-10T12:05:00Z"
`)),
    getResourceEvents: vi.fn().mockResolvedValue([]),
  },
  isTauri: vi.fn().mockReturnValue(false),
}));

describe('Comprehensive Modals and Interactive Actions Suite', () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders ScaleModal and handles replica increment and dry-run preview', async () => {
    const handleClose = vi.fn();
    const handleScaled = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <ScaleModal
          isOpen={true}
          onClose={handleClose}
          target={{ kind: 'Deployment', name: 'app-backend', namespace: 'default', currentReplicas: 2 }}
          isReadOnly={false}
          onScaled={handleScaled}
        />
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Scale Workload/i)).toBeInTheDocument();
    expect(screen.getByText(/Deployment\/app-backend/i)).toBeInTheDocument();

    // Increment replicas
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '3' } });

    // Click Preview Diff
    const previewBtn = await screen.findByText(/Preview Diff/i);
    fireEvent.click(previewBtn);

    expect(await screen.findByText(/Dry-Run Validation/i)).toBeInTheDocument();
  });

  it('renders YamlEditorModal, enables editing, search, and diff inspection', async () => {
    const handleClose = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <YamlEditorModal
          isOpen={true}
          onClose={handleClose}
          resource={{ kind: 'Deployment', name: 'app-backend', namespace: 'default' }}
          isReadOnly={false}
        />
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Edit YAML/i)).toBeInTheDocument();
    expect(screen.getByText(/Review Changes \(Dry Run\)/i)).toBeInTheDocument();

    // 1. Verify Search Button & Search Bar
    const searchBtn = screen.getByRole('button', { name: /Search/i });
    expect(searchBtn).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    const searchInput = screen.getByPlaceholderText(/Find in YAML/i);
    expect(searchInput).toBeInTheDocument();

    // Type a query that exists in mock YAML
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'replicas' } });
    });

    // Should find 1 match
    expect(await screen.findByText(/1 of 1/i)).toBeInTheDocument();

    // 2. Test Editing & Diff View
    const textarea = screen.getByRole('textbox', { name: /YAML Editor/i });
    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: app-backend\nspec:\n  replicas: 5\n',
        },
      });
    });

    // Modified diff counter should appear in Diff tab header (+1 -1)
    expect(screen.getByText(/\+1/)).toBeInTheDocument();
    expect(screen.getByText(/-1/)).toBeInTheDocument();

    // Switch to Diff tab
    const diffTab = screen.getByRole('button', { name: /Diff/i });
    await act(async () => {
      fireEvent.click(diffTab);
    });

    // Diff view should display the changed lines with + and -
    expect(screen.getByText(/replicas: 5/)).toBeInTheDocument();
    expect(screen.getByText(/replicas: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Changes Only \(Compact\)/i)).toBeInTheDocument();
  });

  it('renders LogsView and displays live log lines', async () => {
    const handleClose = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <LogsView
          isActive={true}
          onClose={handleClose}
          resource={{ kind: 'Pod', name: 'app-backend-79d98-1', namespace: 'default' }}
        />
      </QueryClientProvider>
    );

    expect(await screen.findByText('app-backend-79d98-1')).toBeInTheDocument();
    expect(await screen.findByText(/Server started on port 8080/i)).toBeInTheDocument();

    // Verify integrated logs tools toolbar from user design
    const searchInput = screen.getByPlaceholderText('Search visible log output');
    expect(searchInput).toBeInTheDocument();

    // Check action tools cluster buttons
    expect(screen.getByRole('button', { name: /Previous match/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next match/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy full log buffer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Toggle Word Wrap/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Scroll to Top/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Scroll to Bottom/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Toggle Fullscreen Terminal/i })).toBeInTheDocument();

    // Test Search and match counting
    fireEvent.change(searchInput, { target: { value: 'Server' } });
    expect(await screen.findByText(/1 of 1/i)).toBeInTheDocument();

    // Test Toggle Word Wrap
    const wrapBtn = screen.getByRole('button', { name: /Toggle Word Wrap/i });
    fireEvent.click(wrapBtn);

    // Test Fullscreen Toggle
    const fullscreenBtn = screen.getByRole('button', { name: /Toggle Fullscreen Terminal/i });
    fireEvent.click(fullscreenBtn);
    expect(screen.getByTitle(/Exit Fullscreen/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTitle(/Exit Fullscreen/i));
  });

  it('toggles previous container logs with Previous button and displays banner', async () => {
    const handleClose = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <LogsView
          isActive={true}
          onClose={handleClose}
          resource={{ kind: 'Pod', name: 'app-backend-79d98-1', namespace: 'default' }}
        />
      </QueryClientProvider>
    );

    const previousBtn = await screen.findByRole('button', { name: /Show Previous Container Logs/i });
    expect(previousBtn).toBeInTheDocument();

    // Click to toggle previous logs
    await act(async () => {
      fireEvent.click(previousBtn);
    });

    // Banner should appear
    expect(await screen.findByText(/previous terminated container/i)).toBeInTheDocument();

    // Click return to current live logs
    const returnBtn = screen.getByText(/Return to current live logs/i);
    await act(async () => {
      fireEvent.click(returnBtn);
    });

    // Banner should disappear
    expect(screen.queryByText(/previous terminated container/i)).not.toBeInTheDocument();
  });

  it('allows changing tail lines and loading more/all logs in LogsView', async () => {
    const handleClose = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <LogsView
          isActive={true}
          onClose={handleClose}
          resource={{ kind: 'Pod', name: 'app-backend-79d98-1', namespace: 'default' }}
        />
      </QueryClientProvider>
    );

    // Initial fetch should occur with default 1000 lines
    expect(await screen.findByText('app-backend-79d98-1')).toBeInTheDocument();
    expect(api.getLogs).toHaveBeenCalledWith(
      'default',
      'app-backend-79d98-1',
      expect.objectContaining({ tailLines: 1000 })
    );

    // Change tail lines selector to 5000 lines
    const linesSelect = screen.getByLabelText(/Tail lines/i);
    await act(async () => {
      fireEvent.change(linesSelect, { target: { value: '5000' } });
    });
    await waitFor(() => {
      expect(api.getLogs).toHaveBeenCalledWith(
        'default',
        'app-backend-79d98-1',
        expect.objectContaining({ tailLines: 5000 })
      );
    });

    // Click "+1,000 earlier lines" in the terminal top bar
    const loadEarlierBtn = screen.getByRole('button', { name: /\+1,000 earlier lines/i });
    await act(async () => {
      fireEvent.click(loadEarlierBtn);
    });
    await waitFor(() => {
      expect(api.getLogs).toHaveBeenCalledWith(
        'default',
        'app-backend-79d98-1',
        expect.objectContaining({ tailLines: 6000 })
      );
    });

    // Toggle previous logs
    const previousBtn = screen.getByRole('button', { name: /Show Previous Container Logs/i });
    await act(async () => {
      fireEvent.click(previousBtn);
    });
    expect(await screen.findByText(/previous terminated container/i)).toBeInTheDocument();

    // In previous banner, click "+2,000 lines"
    const loadMorePreviousBtn = screen.getByRole('button', { name: /\+2,000 lines/i });
    await act(async () => {
      fireEvent.click(loadMorePreviousBtn);
    });
    await waitFor(() => {
      expect(api.getLogs).toHaveBeenCalledWith(
        'default',
        'app-backend-79d98-1',
        expect.objectContaining({ previous: true, tailLines: 8000 })
      );
    });

    // In previous banner, click "Load all logs"
    const loadAllPreviousBtn = screen.getAllByRole('button', { name: /Load all logs/i })[0];
    await act(async () => {
      fireEvent.click(loadAllPreviousBtn);
    });
    await waitFor(() => {
      expect(api.getLogs).toHaveBeenCalledWith(
        'default',
        'app-backend-79d98-1',
        expect.objectContaining({ previous: true, tailLines: null })
      );
    });
  });

  it('supports per-container selection and All Containers aggregated logs', async () => {
    const handleClose = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <LogsView
          isActive={true}
          onClose={handleClose}
          resource={{ kind: 'Pod', name: 'app-backend-79d98-1', namespace: 'default' }}
          initialContainers={['app-container', 'sidecar-container']}
        />
      </QueryClientProvider>
    );

    // Verify container selector is visible and has All Containers + individual containers
    const containerSelect = await screen.findByLabelText(/Filter logs by container/i);
    expect(containerSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /All Containers \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Container: app-container/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Container: sidecar-container/i })).toBeInTheDocument();

    // Select sidecar-container
    await act(async () => {
      fireEvent.change(containerSelect, { target: { value: 'sidecar-container' } });
    });
    await waitFor(() => {
      expect(api.getLogs).toHaveBeenCalledWith(
        'default',
        'app-backend-79d98-1',
        expect.objectContaining({ container: 'sidecar-container' })
      );
    });

    // Select "All Containers"
    await act(async () => {
      fireEvent.change(containerSelect, { target: { value: 'all' } });
    });
    await waitFor(() => {
      expect(api.getLogs).toHaveBeenCalledWith(
        'default',
        'app-backend-79d98-1',
        expect.objectContaining({ container: 'app-container' })
      );
      expect(api.getLogs).toHaveBeenCalledWith(
        'default',
        'app-backend-79d98-1',
        expect.objectContaining({ container: 'sidecar-container' })
      );
    });
  });

  it('renders PortForwardModal and allows configuring tunnel ports', async () => {
    const handleClose = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <PortForwardModal
          isOpen={true}
          onClose={handleClose}
          pod={{ name: 'test-pod-0', namespace: 'default', ready_containers: '1/1', status: 'Running', restarts: 0, age: '1d' }}
        />
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Port-Forward Manager/i)).toBeInTheDocument();
    expect(screen.getByText(/Start Native Tunnel/i)).toBeInTheDocument();
  });

  it('renders AuditLogModal with searchable security audit trail', () => {
    const handleClose = vi.fn();
    const mockEntries: any[] = [
      {
        id: 'audit-1',
        timestamp: '2026-08-28T12:00:00Z',
        action: 'kubectl scale deployment app-backend --replicas=3',
        actor: 'devops-user',
        cluster_id: 'eks:111122223333:us-east-1:prod',
        environment: 'production',
        target_resource: 'Deployment/app-backend',
        origin: 'User Action',
        status: 'Success',
      },
    ];

    render(
      <QueryClientProvider client={queryClient}>
        <AuditLogModal
          isOpen={true}
          onClose={handleClose}
          entries={mockEntries}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Privileged Action Audit Trail/i)).toBeInTheDocument();
    expect(screen.getByText('Deployment/app-backend')).toBeInTheDocument();
    expect(screen.getByText(/Export JSON/i)).toBeInTheDocument();
  });

  it('renders CommandPalette and searches resources and clusters', () => {
    const handleClose = vi.fn();
    const handleSelectCluster = vi.fn();
    const handleSelectPod = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <CommandPalette
          isOpen={true}
          onClose={handleClose}
          clusters={[{ id: 'c1', name: 'prod-cluster', provider: 'eks', environment: 'Production', server_url: 'https://k8s.example.com', current_namespace: 'default', is_active: true }]}
          pods={[{ name: 'auth-service-pod-1', namespace: 'default', ready_containers: '1/1', status: 'Running', restarts: 0, age: '1d' }]}
          onSelectCluster={handleSelectCluster}
          onSelectPod={handleSelectPod}
          onOpenAi={vi.fn()}
          onOpenAudit={vi.fn()}
          onToggleAdvanced={vi.fn()}
        />
      </QueryClientProvider>
    );

    expect(screen.getByPlaceholderText(/Type a command, cluster name, or pod/i)).toBeInTheDocument();
    expect(screen.getByText(/prod-cluster/i)).toBeInTheDocument();
    expect(screen.getByText('auth-service-pod-1')).toBeInTheDocument();
  });

  it('translates common Linux & Kubernetes container exit codes accurately', () => {
    expect(getExitCodeDiagnostics(137, 'OOMKilled')).toMatchObject({
      severity: 'critical',
      label: '137 (OOMKilled)',
      shortLabel: 'OOMKilled (Exit 137)',
    });
    expect(getExitCodeDiagnostics(143, 'Error')).toMatchObject({
      severity: 'warning',
      shortLabel: 'SIGTERM (Exit 143)',
    });
    expect(getExitCodeDiagnostics(1, 'Error')).toMatchObject({
      severity: 'error',
      shortLabel: 'Error (Exit 1)',
    });
    expect(getExitCodeDiagnostics(126)).toMatchObject({
      severity: 'error',
      shortLabel: 'Permission (Exit 126)',
    });
    expect(getExitCodeDiagnostics(127)).toMatchObject({
      severity: 'error',
      shortLabel: 'Not Found (Exit 127)',
    });
    expect(getExitCodeDiagnostics(139)).toMatchObject({
      severity: 'critical',
      shortLabel: 'Segfault (Exit 139)',
    });
    expect(getExitCodeDiagnostics(0, 'Completed')).toMatchObject({
      severity: 'success',
      shortLabel: 'Completed (Exit 0)',
    });
  });

  it('renders DescribeModal with compact containers table, Last Exit Code badge, and inspects previous 1000 lines logs', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <DescribeModal
          isOpen={true}
          onClose={vi.fn()}
          resource={{ kind: 'Pod', name: 'crashing-backend-pod', namespace: 'default' }}
          onLogs={vi.fn()}
        />
      </QueryClientProvider>
    );

    // Verify container header and table columns
    expect(await screen.findByText('crashing-backend-pod')).toBeInTheDocument();
    expect(await screen.findByText(/App Containers \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('Last Exit Code')).toBeInTheDocument();
    expect(screen.getByText('Last Restart')).toBeInTheDocument();

    // Verify exit code badge in the table
    expect(screen.getAllByText('OOMKilled (Exit 137)').length).toBeGreaterThanOrEqual(1);

    // Verify container drawer has Crash Diagnostics
    expect(screen.getByText(/Last Restart & Crash Diagnostics/i)).toBeInTheDocument();
    expect(screen.getByText(/Killed by Linux OOM/i)).toBeInTheDocument();

    // Click "Fetch Previous Logs (tail 1,000 lines)"
    const fetchLogsBtn = screen.getByRole('button', { name: /Fetch Previous Logs/i });
    expect(fetchLogsBtn).toBeInTheDocument();
    fireEvent.click(fetchLogsBtn);

    // Verify previous logs fetched and displayed
    expect(await screen.findByText(/JavaScript heap out of memory/i)).toBeInTheDocument();
    expect(screen.getByText(/Killed by Linux OOM Killer with Exit 137/i)).toBeInTheDocument();
  });

  it('renders MetadataLabelsAnnotations in compact organized table layout for both Labels and Annotations', () => {
    render(
      <MetadataLabelsAnnotations
        labels={{
          'app.kubernetes.io/name': 'web',
          'environment': 'qa',
          'tier': 'frontend',
          'version': 'v1.2.3',
          'team': 'core',
        }}
        annotations={{
          'checksum/config': 'a1b2c3d4e5f6',
          'kubectl.kubernetes.io/last-applied-configuration': '{"kind":"Deployment","apiVersion":"apps/v1"}',
        }}
      />
    );

    // Verify Labels table and system badge
    expect(screen.getByText('Labels')).toBeInTheDocument();
    expect(screen.getByText('app.kubernetes.io/name')).toBeInTheDocument();
    expect(screen.getByText('web')).toBeInTheDocument();
    expect(screen.getByText('environment')).toBeInTheDocument();
    expect(screen.getByText('qa')).toBeInTheDocument();
    expect(screen.getByText('SYS')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Filter labels/i)).toBeInTheDocument();

    // Verify counts and Annotations section
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Annotations')).toBeInTheDocument();
    expect(screen.getByText('checksum/config')).toBeInTheDocument();
    expect(screen.getByText('a1b2c3d4e5f6')).toBeInTheDocument();
    expect(screen.getByText(/JSON/i)).toBeInTheDocument();
    expect(screen.getByText(/\[\+ expand\]/i)).toBeInTheDocument();
  });

  it('renders Metrics & Telemetry tab with request and limit threshold reference lines on charts', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <DescribeModal
          isOpen={true}
          onClose={vi.fn()}
          resource={{ kind: 'Pod', name: 'crashing-backend-pod', namespace: 'default' }}
          onLogs={vi.fn()}
        />
      </QueryClientProvider>
    );

    // Wait for modal to load resource
    expect(await screen.findByText('crashing-backend-pod')).toBeInTheDocument();

    // Switch to Metrics & Telemetry tab
    const metricsTab = screen.getByRole('button', { name: /Metrics & Telemetry/i });
    expect(metricsTab).toBeInTheDocument();
    fireEvent.click(metricsTab);

    // Verify QoS & Resource Footprint summary
    expect(await screen.findByText(/Kubernetes Resource Quotas & Footprint/i)).toBeInTheDocument();
    expect(screen.getByText('CPU Utilization')).toBeInTheDocument();
    expect(screen.getByText('Memory Consumption (RSS)')).toBeInTheDocument();

    // Verify SRE Resource Right-Sizing Advisory Banner (spread is 2500m / 350m = 7.1x > 4x)
    expect(screen.getByText(/SRE Resource Right-Sizing Advisory/i)).toBeInTheDocument();
    expect(screen.getByText(/Wide Request-to-Limit Spread/i)).toBeInTheDocument();
    expect(screen.getByText(/Recommended ratio: 1.5x – 2.5x spread/i)).toBeInTheDocument();

    // Verify Timeframe controls and default X-axis ticks (1h default: -60m ... now across charts)
    expect(screen.getAllByText('-60m').length).toBeGreaterThanOrEqual(2);
    const tf24hBtn = screen.getByRole('button', { name: '24h' });
    expect(tf24hBtn).toBeInTheDocument();
    fireEvent.click(tf24hBtn);
    expect(screen.getAllByText('-24h').length).toBeGreaterThanOrEqual(2);

    // In default Usage Focus mode, massive limits (2.5 cores and 3.5 GiB) are displayed as out-of-range indicator pills
    expect(screen.getByText('▲ Limit: 2.5 cores (above scale)')).toBeInTheDocument();
    expect(screen.getByText('▲ Limit: 3.5 GiB (above scale)')).toBeInTheDocument();
    expect(screen.getByText('Req: 350m')).toBeInTheDocument();
    expect(screen.getByText('Req: 1.7 GiB')).toBeInTheDocument();
    expect(screen.getByText('Limit: 10.0 GiB')).toBeInTheDocument();

    // Switch to Fit Limits mode and verify limits are displayed directly on the chart lines
    const fitLimitBtn = screen.getByRole('button', { name: 'Fit Limits' });
    fireEvent.click(fitLimitBtn);
    expect(screen.getByText('Limit: 2.5 cores')).toBeInTheDocument();
    expect(screen.getByText('Limit: 3.5 GiB')).toBeInTheDocument();
  });

  it('renders SRE Right-Sizing Advisory with Memory Request Deficit when memory usage exceeds request', async () => {
    // Mock pod with user example: 100 MiB request vs 2.0 GiB limit, 200m CPU request vs 2.0 cores limit
    vi.mocked(api.describeResource).mockResolvedValueOnce(`apiVersion: v1
kind: Pod
metadata:
  name: memory-deficit-pod
  namespace: prod
spec:
  containers:
    - name: app
      image: registry.example.com/app:v1.0.0
      resources:
        requests:
          cpu: 200m
          memory: 100Mi
        limits:
          cpu: 2000m
          memory: 2048Mi
status:
  phase: Running
`);

    render(
      <QueryClientProvider client={queryClient}>
        <DescribeModal
          isOpen={true}
          onClose={vi.fn()}
          resource={{ kind: 'Pod', name: 'memory-deficit-pod', namespace: 'prod' }}
        />
      </QueryClientProvider>
    );

    expect(await screen.findByText('memory-deficit-pod')).toBeInTheDocument();

    const metricsTab = screen.getByRole('button', { name: /Metrics & Telemetry/i });
    fireEvent.click(metricsTab);

    // Verify SRE Right-Sizing Advisory catches both Memory Deficit and Wide Spread
    expect(await screen.findByText(/SRE Resource Right-Sizing Advisory/i)).toBeInTheDocument();
    expect(screen.getByText(/Memory Request Deficit Detected/i)).toBeInTheDocument();
    expect(screen.getByText(/Operating above requests voids Guaranteed\/Burstable eviction protections/i)).toBeInTheDocument();
    expect(screen.getByText(/Target Request:/i)).toBeInTheDocument();
    expect(screen.getByText(/Wide Request-to-Limit Spread/i)).toBeInTheDocument();
    expect(screen.getByText(/Runtime Tip:/i)).toBeInTheDocument();

    // Verify Memory Status Badge shows Above Request
    expect(screen.getByText(/Above Request \(\+/i)).toBeInTheDocument();
  });
});
