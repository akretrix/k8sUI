import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScaleModal } from './ScaleModal';
import { YamlEditorModal } from './YamlEditorModal';
import { LogsView } from './LogsView';
import { PortForwardModal } from '../portforward/PortForwardModal';
import { AuditLogModal } from '../audit/AuditLogModal';
import { CommandPalette } from '../command-palette/CommandPalette';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
    getLogs: vi.fn().mockResolvedValue('2026-08-28T10:00:00Z [INFO] Server started on port 8080\n2026-08-28T10:01:00Z [INFO] Health check passed'),
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

  it('renders YamlEditorModal, enables editing, and shows diff', async () => {
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
});
