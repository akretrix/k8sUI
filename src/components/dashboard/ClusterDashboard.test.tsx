import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClusterDashboard } from './ClusterDashboard';
import { ClusterContextSummary } from '../../types/cluster';

describe('ClusterDashboard', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const mockCluster: ClusterContextSummary = {
    id: 'c1',
    name: 'test-cluster',
    server_url: 'https://test.com',
    provider: 'eks',
    org_id: 'org1',
    environment: 'Production',
    is_active: true,
    current_namespace: 'default',
  };

  const renderDashboard = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ClusterDashboard activeCluster={mockCluster} />
      </QueryClientProvider>
    );

  it('renders the cluster overview header correctly', async () => {
    renderDashboard();
    expect(screen.getByText('Cluster Overview')).toBeInTheDocument();
    expect(screen.getByText(/test-cluster/)).toBeInTheDocument();
    expect(screen.getByText('Control Plane Ready')).toBeInTheDocument();
  });

  it('renders resource telemetry rings and workload health', async () => {
    renderDashboard();
    expect(await screen.findByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByText('Pods')).toBeInTheDocument();
    expect(screen.getByText('Nodes')).toBeInTheDocument();
    expect(screen.getByText('Workload Health')).toBeInTheDocument();
    expect(screen.getByText('Node Topology & Infrastructure')).toBeInTheDocument();
  });

  it('renders warning events table', async () => {
    renderDashboard();
    expect(await screen.findByText(/Warnings:/i)).toBeInTheDocument();
  });
});
