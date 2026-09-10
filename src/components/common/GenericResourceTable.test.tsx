import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GenericResourceTable } from './GenericResourceTable';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../api/tauriClient';

vi.mock('../../api/tauriClient', () => ({
  api: {
    listResources: vi.fn(),
  },
}));

describe('GenericResourceTable Functional Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchInterval: false,
          refetchOnWindowFocus: false,
          gcTime: 0,
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('renders error state with retry button when query fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (api.listResources as any).mockRejectedValueOnce(new Error('Cluster connection timeout'));

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <GenericResourceTable
          kind="services"
          selectedNamespaces={[]}
          namespaces={['default']}
          onSelectNamespaces={vi.fn()}
          onDescribe={vi.fn()}
          onViewYaml={vi.fn()}
          onDelete={vi.fn()}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Cluster Connection Unreachable|Failed to load services/i)).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    unmount();
    consoleSpy.mockRestore();
  });

  it('renders loading spinner while fetching information', async () => {
    let resolvePromise: any;
    (api.listResources as any).mockImplementation(
      () => new Promise((res) => {
        resolvePromise = res;
      })
    );

    render(
      <QueryClientProvider client={queryClient}>
        <GenericResourceTable
          kind="mutatingwebhooks"
          selectedNamespaces={[]}
          namespaces={['default']}
          onSelectNamespaces={vi.fn()}
          onDescribe={vi.fn()}
          onViewYaml={vi.fn()}
          onDelete={vi.fn()}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Loading mutatingwebhooks from cluster…/i)).toBeInTheDocument();
    resolvePromise([]);
  });

  it('renders cluster-scoped resources like mutatingwebhooks and nodes safely without crashing', async () => {
    (api.listResources as any).mockResolvedValue([
      {
        name: 'vpc-resource-mutating-webhook',
        creationTimestamp: '2026-08-28T00:00:00Z',
        age: '10h',
      },
      {
        name: 'aws-load-balancer-webhook',
        status: 'Active',
        age: '2d',
      },
    ]);

    const handleDescribe = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <GenericResourceTable
          kind="mutatingwebhooks"
          selectedNamespaces={['default', 'kube-system']}
          namespaces={['default', 'kube-system']}
          onSelectNamespaces={vi.fn()}
          onDescribe={handleDescribe}
          onViewYaml={vi.fn()}
          onDelete={vi.fn()}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('vpc-resource-mutating-webhook')).toBeInTheDocument();
      expect(screen.getByText('aws-load-balancer-webhook')).toBeInTheDocument();
    });

    // Verify row click triggers describe
    fireEvent.click(screen.getByText('vpc-resource-mutating-webhook'));
    expect(handleDescribe).toHaveBeenCalled();
  });

  it('renders scale button for deployments and triggers onScale', async () => {
    (api.listResources as any).mockResolvedValue([
      {
        name: 'api-service',
        namespace: 'production',
        ready: '3/3',
        upToDate: '3',
        available: '3',
        status: 'Ready',
        age: '5d',
      },
    ]);

    const handleScale = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <GenericResourceTable
          kind="deployments"
          selectedNamespaces={[]}
          namespaces={['default', 'production']}
          onSelectNamespaces={vi.fn()}
          onDescribe={vi.fn()}
          onViewYaml={vi.fn()}
          onDelete={vi.fn()}
          onScale={handleScale}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('api-service')).toBeInTheDocument();
    });

    const scaleBtn = screen.getByTitle('Scale Replicas');
    expect(scaleBtn).toBeInTheDocument();
    fireEvent.click(scaleBtn);
    expect(handleScale).toHaveBeenCalled();
  });

  it('renders validatingwebhooks with dedicated Webhooks, Failure Policy, Side Effects, and Timeout columns', async () => {
    (api.listResources as any).mockResolvedValue([
      {
        name: 'cert-manager-webhook',
        webhooksCount: 2,
        webhookNames: 'webhook.cert-manager.io, check.cert-manager.io',
        failurePolicy: 'Fail',
        sideEffects: 'None',
        timeoutSeconds: '10s',
        status: 'Active',
        age: '12d',
      },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <GenericResourceTable
          kind="validatingwebhooks"
          selectedNamespaces={[]}
          namespaces={['default']}
          onSelectNamespaces={vi.fn()}
          onDescribe={vi.fn()}
          onViewYaml={vi.fn()}
          onDelete={vi.fn()}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('cert-manager-webhook')).toBeInTheDocument();
      expect(screen.getByText('2 hooks')).toBeInTheDocument();
      expect(screen.getByText('Fail')).toBeInTheDocument();
      expect(screen.getByText('None')).toBeInTheDocument();
      expect(screen.getByText('10s')).toBeInTheDocument();
    });
  });

  it('renders custom resource instances with dynamic fields like ready and secret', async () => {
    (api.listResources as any).mockResolvedValue([
      {
        name: 'my-production-tls',
        namespace: 'production',
        ready: 'True',
        secretName: 'my-tls-secret',
        issuer: 'letsencrypt-prod',
        status: 'Ready',
        age: '30d',
      },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <GenericResourceTable
          kind="certificates"
          selectedNamespaces={['production']}
          namespaces={['default', 'production']}
          onSelectNamespaces={vi.fn()}
          onDescribe={vi.fn()}
          onViewYaml={vi.fn()}
          onDelete={vi.fn()}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('my-production-tls')).toBeInTheDocument();
      expect(screen.getByText('my-tls-secret')).toBeInTheDocument();
      expect(screen.getByText('letsencrypt-prod')).toBeInTheDocument();
    });
  });

  it('renders CronJobs table with schedule, active, last schedule and triggers batch action buttons', async () => {
    const onTriggerCronJob = vi.fn();
    const onSuspendCronJob = vi.fn();
    const onViewChildJobs = vi.fn();

    (api.listResources as any).mockResolvedValue([
      {
        name: 'nightly-data-sync',
        namespace: 'datalab',
        schedule: '0 3 * * *',
        suspend: false,
        active: 1,
        lastScheduleTime: '15m ago',
        status: 'Active',
        age: '120d',
      },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <GenericResourceTable
          kind="cronjobs"
          selectedNamespaces={['datalab']}
          namespaces={['default', 'datalab']}
          onSelectNamespaces={vi.fn()}
          onDescribe={vi.fn()}
          onViewYaml={vi.fn()}
          onDelete={vi.fn()}
          onTriggerCronJob={onTriggerCronJob}
          onSuspendCronJob={onSuspendCronJob}
          onViewChildJobs={onViewChildJobs}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('nightly-data-sync')).toBeInTheDocument();
      expect(screen.getByText('0 3 * * *')).toBeInTheDocument();
      expect(screen.getByText('15m ago')).toBeInTheDocument();
    });

    // Test Run Now button
    const runBtn = screen.getByTitle('Run Now (Trigger Manual Job)');
    fireEvent.click(runBtn);
    expect(onTriggerCronJob).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'nightly-data-sync' })
    );

    // Test Suspend/Resume toggle button
    const suspendBtn = screen.getByTitle('Suspend CronJob Schedule');
    fireEvent.click(suspendBtn);
    expect(onSuspendCronJob).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'nightly-data-sync' }),
      true // toggling from false -> true
    );

    // Test View Child Jobs button
    const viewJobsBtn = screen.getByTitle('View Child Jobs');
    fireEvent.click(viewJobsBtn);
    expect(onViewChildJobs).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'nightly-data-sync' })
    );
  });

  it('renders Jobs table with completions, duration, and fires rerun and view pods actions', async () => {
    const onRerunJob = vi.fn();
    const onViewChildPods = vi.fn();

    (api.listResources as any).mockResolvedValue([
      {
        name: 'db-migration-v2',
        namespace: 'production',
        completions: '1/1',
        duration: '2m 15s',
        status: 'Complete',
        age: '1h',
      },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <GenericResourceTable
          kind="jobs"
          selectedNamespaces={['production']}
          namespaces={['default', 'production']}
          onSelectNamespaces={vi.fn()}
          onDescribe={vi.fn()}
          onViewYaml={vi.fn()}
          onDelete={vi.fn()}
          onRerunJob={onRerunJob}
          onViewChildPods={onViewChildPods}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('db-migration-v2')).toBeInTheDocument();
      expect(screen.getByText('1/1')).toBeInTheDocument();
      expect(screen.getByText('2m 15s')).toBeInTheDocument();
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    // Test Rerun Job button
    const rerunBtn = screen.getByTitle('Rerun Job');
    fireEvent.click(rerunBtn);
    expect(onRerunJob).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'db-migration-v2' })
    );

    // Test View Associated Pods button
    const viewPodsBtn = screen.getByTitle('View Associated Pods');
    fireEvent.click(viewPodsBtn);
    expect(onViewChildPods).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'db-migration-v2' })
    );
  });

});
