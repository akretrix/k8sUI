import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UpdateModal } from './UpdateModal';
import { UpdateInfo } from '../../utils/updateChecker';

describe('UpdateModal', () => {
  const mockUpdateInfo: UpdateInfo = {
    hasUpdate: true,
    currentVersion: '0.1.1',
    latestVersion: '0.1.2',
    releaseName: 'k8sUI v0.1.2 Release',
    releaseUrl: 'https://github.com/akretrix/k8sUI/releases/tag/v0.1.2',
    releaseNotes: 'Fixed bug in port-forwarding and added update notifications.',
    publishedAt: '2026-09-02T16:00:00Z',
    recommendedAsset: {
      name: 'k8s-ui_0.1.2_aarch64.dmg',
      size: 5120000,
      browser_download_url: 'https://github.com/akretrix/k8sUI/releases/download/v0.1.2/k8s-ui_0.1.2_aarch64.dmg',
    },
    allAssets: [],
    checkedAt: Date.now(),
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <UpdateModal
        isOpen={false}
        onClose={vi.fn()}
        updateInfo={mockUpdateInfo}
        isChecking={false}
        onCheckAgain={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders update details when update is available', () => {
    render(
      <UpdateModal
        isOpen={true}
        onClose={vi.fn()}
        updateInfo={mockUpdateInfo}
        isChecking={false}
        onCheckAgain={vi.fn()}
      />
    );

    expect(screen.getByText('k8sUI Update Available')).toBeInTheDocument();
    expect(screen.getByText('v0.1.1')).toBeInTheDocument();
    expect(screen.getByText('v0.1.2')).toBeInTheDocument();
    expect(screen.getByText(/Fixed bug in port-forwarding/)).toBeInTheDocument();
  });

  it('renders up-to-date state when hasUpdate is false', () => {
    render(
      <UpdateModal
        isOpen={true}
        onClose={vi.fn()}
        updateInfo={{ ...mockUpdateInfo, hasUpdate: false }}
        isChecking={false}
        onCheckAgain={vi.fn()}
      />
    );

    expect(screen.getByText("You're up to date!")).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <UpdateModal
        isOpen={true}
        onClose={onClose}
        updateInfo={mockUpdateInfo}
        isChecking={false}
        onCheckAgain={vi.fn()}
      />
    );

    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
