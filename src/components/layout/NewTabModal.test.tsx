import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NewTabModal } from './NewTabModal';
import { ClusterContextSummary } from '../../types/cluster';

describe('NewTabModal', () => {
  const mockClusters: ClusterContextSummary[] = [
    {
      id: 'cluster-prod',
      name: 'pdn-acme',
      provider: 'eks',
      environment: 'Production' as any,
      server_url: 'https://k8s.prod.local',
      current_namespace: 'default',
      is_active: true,
    },
    {
      id: 'cluster-qa',
      name: 'qa-acme',
      provider: 'eks',
      environment: 'Staging' as any,
      server_url: 'https://k8s.qa.local',
      current_namespace: 'default',
      is_active: false,
    },
  ];

  it('renders modal when open', () => {
    render(
      <NewTabModal
        isOpen={true}
        onClose={vi.fn()}
        clusters={mockClusters}
        activeCluster={mockClusters[0]}
        onAddTab={vi.fn()}
      />
    );

    expect(screen.getByText('Open New Cluster Tab')).toBeInTheDocument();
    expect(screen.getAllByText('pdn-acme').length).toBeGreaterThan(0);
    expect(screen.getAllByText('qa-acme').length).toBeGreaterThan(0);
  });

  it('allows selecting cluster, resource, and creating tab', () => {
    const onAddTab = vi.fn();
    const onClose = vi.fn();

    render(
      <NewTabModal
        isOpen={true}
        onClose={onClose}
        clusters={mockClusters}
        activeCluster={mockClusters[0]}
        onAddTab={onAddTab}
      />
    );

    // Select QA cluster
    fireEvent.click(screen.getByText('qa-acme'));

    // Select Events
    fireEvent.click(screen.getByText('Events'));

    // Click Create Tab
    fireEvent.click(screen.getByText('Create Tab'));

    expect(onAddTab).toHaveBeenCalledWith(
      expect.objectContaining({
        clusterId: 'cluster-qa',
        clusterName: 'qa-acme',
        resource: 'events',
        title: 'Events',
      })
    );
    expect(onClose).toHaveBeenCalled();
  });
});
