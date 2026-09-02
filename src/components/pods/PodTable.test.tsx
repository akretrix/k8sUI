import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PodTable } from './PodTable';
import { PodSummary } from '../../types/cluster';

const mockPods: PodSummary[] = [
  {
    name: 'auth-service-78dfb9f97-kx4w9',
    namespace: 'default',
    ready_containers: '1/1',
    status: 'Running',
    restarts: 0,
    age: '3d',
    cpu: '15m',
    memory: '42Mi',
    node: 'kind-control-plane',
  },
  {
    name: 'metrics-exporter-5c8c5c7bb7-zz9pk',
    namespace: 'kube-system',
    ready_containers: '0/1',
    status: 'CrashLoopBackOff',
    restarts: 14,
    age: '2h',
    cpu: '0m',
    memory: '12Mi',
    node: 'kind-control-plane',
  },
];

describe('PodTable Component (Functional Tests)', () => {
  it('renders pod rows with status badges and metrics', () => {
    render(
      <PodTable
        pods={mockPods}
        selectedNamespaces={[]}
        namespaces={['default', 'kube-system']}
        isReadOnly={true}
        isAdvancedMode={false}
        onSelectNamespaces={vi.fn()}
        onScalePod={vi.fn()}
        onViewYaml={vi.fn()}
        onExecPod={vi.fn()}
        onPortForwardPod={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText('auth-service-78dfb9f97-kx4w9')).toBeInTheDocument();
    expect(screen.getByText('metrics-exporter-5c8c5c7bb7-zz9pk')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('CrashLoopBackOff')).toBeInTheDocument();
  });

  it('filters pods when typing in the search box', () => {
    render(
      <PodTable
        pods={mockPods}
        selectedNamespaces={[]}
        namespaces={['default', 'kube-system']}
        isReadOnly={true}
        isAdvancedMode={false}
        onSelectNamespaces={vi.fn()}
        onScalePod={vi.fn()}
        onViewYaml={vi.fn()}
        onExecPod={vi.fn()}
        onPortForwardPod={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText('Filter pods...');
    fireEvent.change(searchInput, { target: { value: 'auth' } });

    expect(screen.getByText('auth-service-78dfb9f97-kx4w9')).toBeInTheDocument();
    expect(screen.queryByText('metrics-exporter-5c8c5c7bb7-zz9pk')).not.toBeInTheDocument();
  });

  it('disables scale button when isReadOnly is true', () => {
    render(
      <PodTable
        pods={mockPods}
        selectedNamespaces={[]}
        namespaces={['default', 'kube-system']}
        isReadOnly={true}
        isAdvancedMode={false}
        onSelectNamespaces={vi.fn()}
        onScalePod={vi.fn()}
        onViewYaml={vi.fn()}
        onExecPod={vi.fn()}
        onPortForwardPod={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    const scaleButtons = screen.getAllByTitle(/Read-Only Mode: Unlock to scale/i);
    expect(scaleButtons.length).toBeGreaterThan(0);
    expect(scaleButtons[0]).toBeDisabled();
  });

  it('renders direct actions (Logs, Describe, YAML, Exec Terminal, Port-Forward, Scale) on rows', () => {
    render(
      <PodTable
        pods={mockPods}
        selectedNamespaces={[]}
        namespaces={['default', 'kube-system']}
        isReadOnly={false}
        isAdvancedMode={true}
        onSelectNamespaces={vi.fn()}
        onScalePod={vi.fn()}
        onViewYaml={vi.fn()}
        onExecPod={vi.fn()}
        onPortForwardPod={vi.fn()}
        onDescribePod={vi.fn()}
        onLogsPod={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getAllByTitle(/Interactive Exec Shell/i).length).toBeGreaterThan(0);
    expect(screen.getAllByTitle(/Open Port-Forward Tunnel/i).length).toBeGreaterThan(0);
    expect(screen.getAllByTitle(/View \/ Edit Raw YAML/i).length).toBeGreaterThan(0);
    expect(screen.getAllByTitle(/View Live Logs/i).length).toBeGreaterThan(0);
    expect(screen.getAllByTitle(/Describe Pod/i).length).toBeGreaterThan(0);
  });
});
