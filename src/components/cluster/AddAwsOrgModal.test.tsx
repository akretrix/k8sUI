import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AddAwsOrgModal } from './AddAwsOrgModal';
import { AwsSsoOrg, ClusterContextSummary } from '../../types/cluster';

const mockOrgs: AwsSsoOrg[] = [
  {
    id: 'orgdemo',
    alias: 'Demo AWS Organization',
    start_url: 'https://orgdemo.awsapps.com/start',
    sso_region: 'us-east-1',
    status: 'authenticated',
    accounts_count: 2,
    clusters_count: 2,
    assigned_role: 'AdministratorAccess/devops@demo-org.com',
  },
];

const mockClusters: ClusterContextSummary[] = [
  {
    id: 'eks:111122223333:us-east-1:pdn-acme',
    name: 'pdn-acme',
    provider: 'eks',
    environment: 'Production',
    server_url: 'https://B78A1239DF55A2C.gr7.us-east-1.eks.amazonaws.com',
    current_namespace: 'pdn-acme-backend',
    is_active: false,
    org_id: 'orgdemo',
    account_id: '111122223333',
    account_name: 'acme-production',
    role: 'AdministratorAccess/devops@demo-org.com',
    k8s_version: '1.34',
    region: 'us-east-1',
  },
];

describe('AddAwsOrgModal Component (Functional Tests)', () => {
  it('renders modal with registered orgs and discovered clusters list', () => {
    render(
      <AddAwsOrgModal
        isOpen={true}
        onClose={vi.fn()}
        orgs={mockOrgs}
        clusters={mockClusters}
        activeCluster={null}
        onSelectCluster={vi.fn()}
        onRegisterOrg={vi.fn()}
        onRefreshOrg={vi.fn()}
      />
    );

    expect(screen.getByText('AWS IAM Identity Center (SSO) & EKS Discovery')).toBeInTheDocument();
    expect(screen.getByText('Demo AWS Organization')).toBeInTheDocument();
    expect(screen.getByText('pdn-acme')).toBeInTheDocument();
    expect(screen.getByText(/acme-production/i)).toBeInTheDocument();
    expect(screen.getByText('Connect & Inspect')).toBeInTheDocument();
  });

  it('connects to discovered cluster and closes modal on click', () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    render(
      <AddAwsOrgModal
        isOpen={true}
        onClose={handleClose}
        orgs={mockOrgs}
        clusters={mockClusters}
        activeCluster={null}
        onSelectCluster={handleSelect}
        onRegisterOrg={vi.fn()}
        onRefreshOrg={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Connect & Inspect'));
    expect(handleSelect).toHaveBeenCalledWith('eks:111122223333:us-east-1:pdn-acme');
    expect(handleClose).toHaveBeenCalled();
  });

  it('switches to troubleshooting tab and displays IAM/EKS diagnostics guide', () => {
    render(
      <AddAwsOrgModal
        isOpen={true}
        onClose={vi.fn()}
        orgs={mockOrgs}
        clusters={mockClusters}
        activeCluster={null}
        onSelectCluster={vi.fn()}
        onRegisterOrg={vi.fn()}
        onRefreshOrg={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Why Account/Cluster is Missing?'));
    expect(screen.getByText(/Why is your AWS Account or EKS Cluster not appearing/i)).toBeInTheDocument();
    expect(screen.getByText(/IAM Identity Center: Account & Permission Set Assignment/i)).toBeInTheDocument();
    expect(screen.getByText(/aws sso login --sso-session my-org/i)).toBeInTheDocument();
  });

  it('submits registration form with sanitized URL', async () => {
    const handleRegister = vi.fn().mockResolvedValue(undefined);
    render(
      <AddAwsOrgModal
        isOpen={true}
        onClose={vi.fn()}
        orgs={mockOrgs}
        clusters={mockClusters}
        activeCluster={null}
        onSelectCluster={vi.fn()}
        onRegisterOrg={handleRegister}
        onRefreshOrg={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('https://your-org.awsapps.com/start');
    fireEvent.change(input, { target: { value: 'https://client-corp.awsapps.com' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Connect & Auto-Discover EKS Clusters'));
    });

    expect(handleRegister).toHaveBeenCalledWith(
      'client-corp',
      'https://client-corp.awsapps.com/start',
      'us-east-1'
    );
  });
});
