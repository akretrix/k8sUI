import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClusterSwitcher } from './ClusterSwitcher';
import { ClusterContextSummary } from '../../types/cluster';

const mockClusters: ClusterContextSummary[] = [
  {
    id: 'local:kind-dev',
    name: 'kind-k9s-dev',
    provider: 'local',
    environment: 'Local',
    server_url: 'https://127.0.0.1:54321',
    current_namespace: 'default',
    is_active: true,
  },
  {
    id: 'eks:us-west-2:prod-eks',
    name: 'prod-payment-cluster',
    provider: 'eks',
    environment: 'Production',
    server_url: 'https://EKS-PROD.us-west-2.eks.amazonaws.com',
    current_namespace: 'payments',
    is_active: false,
  },
];

describe('ClusterSwitcher Component (Functional Tests)', () => {
  it('renders the active cluster name and environment badge', () => {
    render(
      <ClusterSwitcher
        clusters={mockClusters}
        activeCluster={mockClusters[0]}
        onSelectCluster={vi.fn()}
        onOpenAddAwsOrg={vi.fn()}
      />
    );

    expect(screen.getByText('kind-k9s-dev')).toBeInTheDocument();
    expect(screen.getByText('Local')).toBeInTheDocument();
  });

  it('renders Production badge with crimson color styling for production cluster', () => {
    render(
      <ClusterSwitcher
        clusters={mockClusters}
        activeCluster={mockClusters[1]}
        onSelectCluster={vi.fn()}
        onOpenAddAwsOrg={vi.fn()}
      />
    );

    expect(screen.getByText('prod-payment-cluster')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('opens dropdown and allows selecting a cluster', () => {
    const handleSelect = vi.fn();
    render(
      <ClusterSwitcher
        clusters={mockClusters}
        activeCluster={mockClusters[0]}
        onSelectCluster={handleSelect}
        onOpenAddAwsOrg={vi.fn()}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /Cluster and context switcher/i }));
    expect(screen.getByText('Discovered Cluster Contexts')).toBeInTheDocument();

    // Click on production cluster
    fireEvent.click(screen.getByText('prod-payment-cluster'));
    expect(handleSelect).toHaveBeenCalledWith('eks:us-west-2:prod-eks');
  });

  it('filters the cluster list as characters are typed', () => {
    render(
      <ClusterSwitcher
        clusters={mockClusters}
        activeCluster={mockClusters[0]}
        onSelectCluster={vi.fn()}
        onOpenAddAwsOrg={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cluster and context switcher/i }));
    // 'kind-k9s-dev' is the active cluster, so it renders both in the trigger
    // button and in the list — two matches is the correct starting state.
    expect(screen.getAllByText('kind-k9s-dev')).toHaveLength(2);
    expect(screen.getByText('prod-payment-cluster')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Filter by name/i), {
      target: { value: 'prod' },
    });

    expect(screen.getByText('prod-payment-cluster')).toBeInTheDocument();
    // Only the trigger button's copy remains once the list is filtered down.
    expect(screen.getAllByText('kind-k9s-dev')).toHaveLength(1);
  });

  it('shows a no-match message when the filter matches nothing', () => {
    render(
      <ClusterSwitcher
        clusters={mockClusters}
        activeCluster={mockClusters[0]}
        onSelectCluster={vi.fn()}
        onOpenAddAwsOrg={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cluster and context switcher/i }));
    fireEvent.change(screen.getByPlaceholderText(/Filter by name/i), {
      target: { value: 'no-such-cluster' },
    });

    expect(screen.getByText(/No clusters match/i)).toBeInTheDocument();
  });

  it('does not falsely match other AWS clusters when searching for "acme"', () => {
    const extendedClusters: ClusterContextSummary[] = [
      ...mockClusters,
      {
        id: 'eks:pdn-acme',
        name: 'pdn-acme',
        provider: 'eks',
        environment: 'Production',
        server_url: 'https://PDN-ACME.us-east-1.eks.amazonaws.com',
        current_namespace: 'default',
        is_active: false,
      },
      {
        id: 'eks:qa-acme',
        name: 'qa-acme',
        provider: 'eks',
        environment: 'Staging',
        server_url: 'https://QA-ACME.us-east-1.eks.amazonaws.com',
        current_namespace: 'qa-acme',
        is_active: false,
      },
    ];

    render(
      <ClusterSwitcher
        activeCluster={null}
        clusters={extendedClusters}
        onSelectCluster={vi.fn()}
        onOpenAddAwsOrg={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button'));

    const searchInput = screen.getByPlaceholderText('Filter by name, account, region, role…');
    fireEvent.change(searchInput, { target: { value: 'acme' } });

    // Should find the AWS ones with 'acme' in the name
    expect(screen.getByText('pdn-acme')).toBeInTheDocument();
    expect(screen.getByText('qa-acme')).toBeInTheDocument();
  });
});
