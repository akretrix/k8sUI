import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomPanel, PanelTab } from './BottomPanel';

describe('BottomPanel Multi-Tab Management Suite', () => {
  const sampleTabs: PanelTab[] = [
    { id: 'tab-1', title: 'Logs: tempo-0', content: <div>Logs tempo-0 content</div> },
    { id: 'tab-2', title: 'Logs: otel-collector', content: <div>Logs otel content</div> },
    { id: 'tab-3', title: 'Exec: tempo-0', content: <div>Exec terminal content</div> },
  ];

  it('renders multiple panel tabs and active tab content', () => {
    render(
      <BottomPanel
        isOpen={true}
        onClose={vi.fn()}
        tabs={sampleTabs}
        activeTabId="tab-1"
        onTabChange={vi.fn()}
      />
    );

    expect(screen.getByText('Logs: tempo-0')).toBeInTheDocument();
    expect(screen.getByText('Logs: otel-collector')).toBeInTheDocument();
    expect(screen.getByText('Exec: tempo-0')).toBeInTheDocument();
    expect(screen.getByText('Logs tempo-0 content')).toBeInTheDocument();
  });

  it('allows closing a single tab by clicking X button', () => {
    const onCloseTab = vi.fn();
    render(
      <BottomPanel
        isOpen={true}
        onClose={vi.fn()}
        tabs={sampleTabs}
        activeTabId="tab-1"
        onTabChange={vi.fn()}
        onCloseTab={onCloseTab}
      />
    );

    const closeButtons = screen.getAllByTitle('Close Tab');
    fireEvent.click(closeButtons[0]);
    expect(onCloseTab).toHaveBeenCalledWith('tab-1');
  });

  it('allows middle-click on tab to close it', () => {
    const onCloseTab = vi.fn();
    render(
      <BottomPanel
        isOpen={true}
        onClose={vi.fn()}
        tabs={sampleTabs}
        activeTabId="tab-1"
        onTabChange={vi.fn()}
        onCloseTab={onCloseTab}
      />
    );

    const tabEl = screen.getByText('Logs: otel-collector');
    fireEvent(tabEl, new MouseEvent('auxclick', { button: 1, bubbles: true }));
    expect(onCloseTab).toHaveBeenCalledWith('tab-2');
  });

  it('allows closing other tabs from context menu', () => {
    const onCloseOtherTabs = vi.fn();
    render(
      <BottomPanel
        isOpen={true}
        onClose={vi.fn()}
        tabs={sampleTabs}
        activeTabId="tab-2"
        onTabChange={vi.fn()}
        onCloseOtherTabs={onCloseOtherTabs}
      />
    );

    // Right click tab-2
    const tabEl = screen.getByText('Logs: otel-collector');
    fireEvent.contextMenu(tabEl, { clientX: 100, clientY: 100 });

    const closeOtherBtn = screen.getByText('Close Other Tabs');
    expect(closeOtherBtn).toBeInTheDocument();
    fireEvent.click(closeOtherBtn);

    expect(onCloseOtherTabs).toHaveBeenCalledWith('tab-2');
  });

  it('allows closing tabs to the right from context menu', () => {
    const onCloseTabsToRight = vi.fn();
    render(
      <BottomPanel
        isOpen={true}
        onClose={vi.fn()}
        tabs={sampleTabs}
        activeTabId="tab-1"
        onTabChange={vi.fn()}
        onCloseTabsToRight={onCloseTabsToRight}
      />
    );

    // Right click tab-1
    const tabEl = screen.getByText('Logs: tempo-0');
    fireEvent.contextMenu(tabEl, { clientX: 50, clientY: 50 });

    const closeToRightBtn = screen.getByText('Close Tabs to the Right');
    expect(closeToRightBtn).toBeInTheDocument();
    fireEvent.click(closeToRightBtn);

    expect(onCloseTabsToRight).toHaveBeenCalledWith('tab-1');
  });

  it('allows closing all tabs from header options menu', () => {
    const onCloseAllTabs = vi.fn();
    render(
      <BottomPanel
        isOpen={true}
        onClose={vi.fn()}
        tabs={sampleTabs}
        activeTabId="tab-1"
        onTabChange={vi.fn()}
        onCloseAllTabs={onCloseAllTabs}
      />
    );

    const optionsBtn = screen.getByTitle('Tab Management Options');
    fireEvent.click(optionsBtn);

    const closeAllBtn = screen.getByText(/Close All Tabs/i);
    expect(closeAllBtn).toBeInTheDocument();
    fireEvent.click(closeAllBtn);

    expect(onCloseAllTabs).toHaveBeenCalledTimes(1);
  });
});
