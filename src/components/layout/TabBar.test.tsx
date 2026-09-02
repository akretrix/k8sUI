import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TabBar } from './TabBar';
import { AppTab } from '../../types/tabs';

describe('TabBar', () => {
  const sampleTabs: AppTab[] = [
    { id: 'tab-1', clusterId: 'c-1', clusterName: 'qa-acme', resource: 'pods', title: 'Pods', namespaces: [], filterQuery: '' },
    { id: 'tab-2', clusterId: 'c-2', clusterName: 'pdn-axonic', resource: 'deployments', title: 'Deployments', namespaces: ['cert-manager'], filterQuery: 'nginx' },
  ];

  it('renders tab titles, cluster badges, and namespace badges', () => {
    render(
      <TabBar
        tabs={sampleTabs}
        activeTabId="tab-1"
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onCloseAllTabs={vi.fn()}
        onCloseOtherTabs={vi.fn()}
        onNewTab={vi.fn()}
      />
    );

    expect(screen.getByText('Pods')).toBeInTheDocument();
    expect(screen.getByText('Deployments')).toBeInTheDocument();
    expect(screen.getByText('qa-acme')).toBeInTheDocument();
    expect(screen.getByText('pdn-axonic')).toBeInTheDocument();
    expect(screen.getByText('cert-manager')).toBeInTheDocument();
    expect(screen.getByText('"nginx"')).toBeInTheDocument();
  });

  it('triggers onSelectTab when clicking a tab', () => {
    const onSelectTab = vi.fn();
    render(
      <TabBar
        tabs={sampleTabs}
        activeTabId="tab-1"
        onSelectTab={onSelectTab}
        onCloseTab={vi.fn()}
        onCloseAllTabs={vi.fn()}
        onCloseOtherTabs={vi.fn()}
        onNewTab={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Deployments'));
    expect(onSelectTab).toHaveBeenCalledWith('tab-2');
  });

  it('triggers onCloseTab when clicking tab close button', () => {
    const onCloseTab = vi.fn();
    render(
      <TabBar
        tabs={sampleTabs}
        activeTabId="tab-1"
        onSelectTab={vi.fn()}
        onCloseTab={onCloseTab}
        onCloseAllTabs={vi.fn()}
        onCloseOtherTabs={vi.fn()}
        onNewTab={vi.fn()}
      />
    );

    const closeButtons = screen.getAllByTitle('Close Tab');
    fireEvent.click(closeButtons[0]);
    expect(onCloseTab).toHaveBeenCalledWith('tab-1', expect.anything());
  });

  it('triggers onNewTab when clicking + button', () => {
    const onNewTab = vi.fn();
    render(
      <TabBar
        tabs={sampleTabs}
        activeTabId="tab-1"
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onCloseAllTabs={vi.fn()}
        onCloseOtherTabs={vi.fn()}
        onNewTab={onNewTab}
      />
    );

    fireEvent.click(screen.getByTitle(/Open New Tab/i));
    expect(onNewTab).toHaveBeenCalledTimes(1);
  });

  it('allows closing all tabs from menu', () => {
    const onCloseAllTabs = vi.fn();
    render(
      <TabBar
        tabs={sampleTabs}
        activeTabId="tab-1"
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onCloseAllTabs={onCloseAllTabs}
        onCloseOtherTabs={vi.fn()}
        onNewTab={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('Tab Options'));
    fireEvent.click(screen.getByText('Close All Tabs'));
    expect(onCloseAllTabs).toHaveBeenCalledTimes(1);
  });
});
