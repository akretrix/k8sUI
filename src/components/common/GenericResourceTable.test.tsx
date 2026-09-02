import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
        },
      },
    });
    vi.clearAllMocks();
  });

  it('renders loading spinner while fetching information', async () => {
    (api.listResources as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 500))
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

  it('renders error state with retry button when query fails', async () => {
    (api.listResources as any).mockRejectedValue(new Error('Cluster connection timeout'));

    render(
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
      expect(screen.getByText(/Failed to load services/i)).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });
});
