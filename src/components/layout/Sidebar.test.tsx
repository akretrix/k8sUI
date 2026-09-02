import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Sidebar } from './Sidebar';

describe('Sidebar Component', () => {
  it('renders all navigation groups with counts', () => {
    render(<Sidebar activeResource="pods" onSelectResource={vi.fn()} />);

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Cluster')).toBeInTheDocument();
    expect(screen.getByText('Workloads')).toBeInTheDocument();
    expect(screen.getByText('Config')).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByText('Access Control')).toBeInTheDocument();
    expect(screen.getByText('Custom Resources')).toBeInTheDocument();
    expect(screen.getByText('Helm')).toBeInTheDocument();
  });

  it('renders items and highlights active resource', () => {
    render(<Sidebar activeResource="pods" onSelectResource={vi.fn()} />);

    const podsItem = screen.getByText('Pods').closest('button');
    expect(podsItem).toBeInTheDocument();
    expect(podsItem?.className).toContain('text-brand-300'); // active brand highlight
  });

  it('toggles collapse/expand on individual category click', () => {
    render(<Sidebar activeResource="pods" onSelectResource={vi.fn()} />);

    // Click Workloads category header to collapse
    const workloadsHeader = screen.getByText('Workloads').closest('button')!;
    expect(screen.getByText('Deployments')).toBeInTheDocument();

    fireEvent.click(workloadsHeader);
    expect(screen.queryByText('Deployments')).not.toBeInTheDocument();

    // Click again to expand
    fireEvent.click(workloadsHeader);
    expect(screen.getByText('Deployments')).toBeInTheDocument();
  });

  it('supports general Collapse All and Expand All for entire sidebar', () => {
    render(<Sidebar activeResource="pods" onSelectResource={vi.fn()} />);

    // Initially expanded
    expect(screen.getByText('Deployments')).toBeInTheDocument();
    expect(screen.getByText('ConfigMaps')).toBeInTheDocument();

    // Click Collapse All
    const collapseAllBtn = screen.getByText('Collapse All');
    fireEvent.click(collapseAllBtn);

    expect(screen.queryByText('Deployments')).not.toBeInTheDocument();
    expect(screen.queryByText('ConfigMaps')).not.toBeInTheDocument();

    // Click Expand All
    const expandAllBtn = screen.getByText('Expand All');
    fireEvent.click(expandAllBtn);

    expect(screen.getByText('Deployments')).toBeInTheDocument();
    expect(screen.getByText('ConfigMaps')).toBeInTheDocument();
  });

  it('filters sidebar items dynamically using search input', () => {
    render(<Sidebar activeResource="pods" onSelectResource={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText('Quick search menu...');
    fireEvent.change(searchInput, { target: { value: 'secret' } });

    expect(screen.getByText('Secrets')).toBeInTheDocument();
    expect(screen.queryByText('Deployments')).not.toBeInTheDocument();
  });

  it('calls onSelectResource when an item is clicked', () => {
    const handleSelect = vi.fn();
    render(<Sidebar activeResource="pods" onSelectResource={handleSelect} />);

    fireEvent.click(screen.getByText('Deployments'));
    expect(handleSelect).toHaveBeenCalledWith('deployments');
  });

  it('navigates to each and every resource option across all categories', () => {
    const handleSelect = vi.fn();
    render(<Sidebar activeResource="pods" onSelectResource={handleSelect} />);

    const testNavItems = [
      { label: 'Cluster Metrics', expectedId: 'dashboard' },
      { label: 'Nodes', expectedId: 'nodes' },
      { label: 'Events', expectedId: 'events' },
      { label: 'Namespaces', expectedId: 'namespaces' },
      { label: 'Mutating Webhooks', expectedId: 'mutatingwebhooks' },
      { label: 'Validating Webhooks', expectedId: 'validatingwebhooks' },
      { label: 'Pods', expectedId: 'pods' },
      { label: 'Deployments', expectedId: 'deployments' },
      { label: 'DaemonSets', expectedId: 'daemonsets' },
      { label: 'StatefulSets', expectedId: 'statefulsets' },
      { label: 'ReplicaSets', expectedId: 'replicasets' },
      { label: 'Jobs', expectedId: 'jobs' },
      { label: 'CronJobs', expectedId: 'cronjobs' },
      { label: 'ConfigMaps', expectedId: 'configmaps' },
      { label: 'Secrets', expectedId: 'secrets' },
      { label: 'Resource Quotas', expectedId: 'resourcequotas' },
      { label: 'Limit Ranges', expectedId: 'limitranges' },
      { label: 'HPAs', expectedId: 'hpas' },
      { label: 'PDBs', expectedId: 'pdbs' },
      { label: 'Priority Classes', expectedId: 'priorityclasses' },
      { label: 'Services', expectedId: 'services' },
      { label: 'Endpoints', expectedId: 'endpoints' },
      { label: 'Ingresses', expectedId: 'ingresses' },
      { label: 'Ingress Classes', expectedId: 'ingressclasses' },
      { label: 'Network Policies', expectedId: 'networkpolicies' },
      { label: 'Persistent Volume Claims', expectedId: 'pvcs' },
      { label: 'Persistent Volumes', expectedId: 'pvs' },
      { label: 'Storage Classes', expectedId: 'storageclasses' },
      { label: 'Service Accounts', expectedId: 'serviceaccounts' },
      { label: 'Cluster Roles', expectedId: 'clusterroles' },
      { label: 'Cluster Role Bindings', expectedId: 'clusterrolebindings' },
      { label: 'Roles', expectedId: 'roles' },
      { label: 'Role Bindings', expectedId: 'rolebindings' },
      { label: 'Definitions', expectedId: 'crds' },
      { label: 'Releases', expectedId: 'helm-releases' },
    ];

    for (const item of testNavItems) {
      const el = screen.getByText(item.label);
      expect(el).toBeInTheDocument();
      fireEvent.click(el);
      expect(handleSelect).toHaveBeenCalledWith(item.expectedId);
    }
  });

  it('renders custom resource definitions and navigates to CRD instances', () => {
    const handleSelect = vi.fn();
    const mockCrds = [
      {
        group: 'cert-manager.io',
        kind: 'Certificate',
        plural: 'certificates',
        scope: 'Namespaced',
        version: 'v1',
        established: true,
      },
      {
        group: 'elbv2.k8s.aws',
        kind: 'TargetGroupBinding',
        plural: 'targetgroupbindings',
        scope: 'Namespaced',
        version: 'v1beta1',
        established: true,
      },
    ];

    render(
      <Sidebar
        activeResource="pods"
        onSelectResource={handleSelect}
        customResourceTypes={mockCrds}
      />
    );

    // API group headers are visible and expanded by default
    expect(screen.getByText('cert-manager.io')).toBeInTheDocument();
    expect(screen.getByText('elbv2.k8s.aws')).toBeInTheDocument();

    // Click CRD item
    const crdItem = screen.getByText('Certificate');
    expect(crdItem).toBeInTheDocument();
    fireEvent.click(crdItem);
    expect(handleSelect).toHaveBeenCalledWith('certificates');

    const tgItem = screen.getByText('TargetGroupBinding');
    expect(tgItem).toBeInTheDocument();
    fireEvent.click(tgItem);
    expect(handleSelect).toHaveBeenCalledWith('targetgroupbindings');
  });

  it('filters CRD items dynamically using sidebar search input', () => {
    const mockCrds = [
      {
        group: 'cert-manager.io',
        kind: 'Certificate',
        plural: 'certificates',
        scope: 'Namespaced',
        version: 'v1',
        established: true,
      },
      {
        group: 'elbv2.k8s.aws',
        kind: 'TargetGroupBinding',
        plural: 'targetgroupbindings',
        scope: 'Namespaced',
        version: 'v1beta1',
        established: true,
      },
    ];

    render(
      <Sidebar
        activeResource="pods"
        onSelectResource={vi.fn()}
        customResourceTypes={mockCrds}
      />
    );

    const searchInput = screen.getByPlaceholderText('Quick search menu...');
    fireEvent.change(searchInput, { target: { value: 'targetgroup' } });

    expect(screen.getByText('TargetGroupBinding')).toBeInTheDocument();
    expect(screen.queryByText('Certificate')).not.toBeInTheDocument();
  });
});
