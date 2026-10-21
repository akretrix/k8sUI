import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClusterRail, OpenClusterWorkspace } from './ClusterRail';

describe('ClusterRail', () => {
  const sampleClusters: OpenClusterWorkspace[] = [
    {
      id: 'cluster-prod',
      name: 'prod-workloads-cluster',
      environment: 'Production',
      tabCount: 3,
    },
    {
      id: 'cluster-dev',
      name: 'dev-frontend-app',
      environment: 'Development',
      tabCount: 1,
    },
  ];

  it('renders 4-letter monograms and environment labels for each open cluster', () => {
    render(
      <ClusterRail
        openClusters={sampleClusters}
        activeClusterId="cluster-prod"
        onSelectCluster={vi.fn()}
        onCloseCluster={vi.fn()}
        onAddCluster={vi.fn()}
      />
    );

    // Monograms
    expect(screen.getByText('PWRK')).toBeInTheDocument();
    expect(screen.getByText('DFRN')).toBeInTheDocument();

    // Environment labels
    expect(screen.getByText('PROD')).toBeInTheDocument();
    expect(screen.getByText('DEV')).toBeInTheDocument();

    // Tab count badge on multi-tab cluster
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('triggers onSelectCluster when clicking a cluster monogram', () => {
    const onSelectCluster = vi.fn();
    render(
      <ClusterRail
        openClusters={sampleClusters}
        activeClusterId="cluster-prod"
        onSelectCluster={onSelectCluster}
        onCloseCluster={vi.fn()}
        onAddCluster={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('DFRN'));
    expect(onSelectCluster).toHaveBeenCalledWith('cluster-dev');
  });

  it('triggers onAddCluster when clicking the + button', () => {
    const onAddCluster = vi.fn();
    render(
      <ClusterRail
        openClusters={sampleClusters}
        activeClusterId="cluster-prod"
        onSelectCluster={vi.fn()}
        onCloseCluster={vi.fn()}
        onAddCluster={onAddCluster}
      />
    );

    const addBtn = screen.getByTitle('Open / Connect Another Cluster in a New Tab');
    fireEvent.click(addBtn);
    expect(onAddCluster).toHaveBeenCalled();
  });

  it('renders hover card with full clean cluster name and close option', () => {
    const onCloseCluster = vi.fn();
    render(
      <ClusterRail
        openClusters={sampleClusters}
        activeClusterId="cluster-prod"
        onSelectCluster={vi.fn()}
        onCloseCluster={onCloseCluster}
        onAddCluster={vi.fn()}
      />
    );

    const clusterBtn = screen.getByTitle('prod-workloads-cluster (PROD)');
    fireEvent.mouseEnter(clusterBtn.parentElement!);

    expect(screen.getByText('prod-workloads-cluster')).toBeInTheDocument();
    expect(screen.getByText('Close Workspace')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close Workspace'));
    expect(onCloseCluster).toHaveBeenCalledWith('cluster-prod');
  });
});
