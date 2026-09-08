import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DiagnosticsModal } from './DiagnosticsModal';

describe('DiagnosticsModal', () => {
  it('renders modal when open with tabs and system information', () => {
    const onClose = vi.fn();
    render(
      <DiagnosticsModal
        isOpen={true}
        onClose={onClose}
        activeCluster={{
          name: 'qa-mock-cluster',
          provider: 'eks',
          environment: 'Development',
          server_url: 'https://127.0.0.1:6443',
          k8s_version: '1.30',
        }}
        healthInfo={{
          status: 'connected',
          latency_ms: 1162,
          last_checked: '2026-09-08T20:30:00Z',
          is_sso: true,
        }}
      />
    );

    expect(screen.getByText('Diagnostics & Observability')).toBeInTheDocument();
    expect(screen.getByText('Ping: 1162ms')).toBeInTheDocument();
    expect(screen.getByText(/Live IPC Calls/i)).toBeInTheDocument();
    expect(screen.getByText(/Backend Logs/i)).toBeInTheDocument();
    expect(screen.getByText(/Cluster & System/i)).toBeInTheDocument();
  });

  it('switches between IPC, backend logs, and health tabs', async () => {
    const onClose = vi.fn();
    render(
      <DiagnosticsModal
        isOpen={true}
        onClose={onClose}
        activeCluster={{
          name: 'qa-mock-cluster',
          provider: 'eks',
          environment: 'Development',
        }}
        healthInfo={{
          status: 'connected',
          latency_ms: 1162,
          last_checked: '2026-09-08T20:30:00Z',
          is_sso: true,
        }}
      />
    );

    // Switch to Backend Logs
    const logsTab = screen.getByRole('button', { name: /Backend Logs/i });
    fireEvent.click(logsTab);
    expect(screen.getByText(/Showing last/i)).toBeInTheDocument();

    // Switch to Cluster & System
    const healthTab = screen.getByRole('button', { name: /Cluster & System/i });
    fireEvent.click(healthTab);
    expect(screen.getByText('Active Cluster Connection')).toBeInTheDocument();
    expect(screen.getByText('qa-mock-cluster')).toBeInTheDocument();
  });

  it('copies diagnostics bundle when copy button is clicked', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy,
      },
    });

    render(<DiagnosticsModal isOpen={true} onClose={vi.fn()} />);

    const copyBtn = screen.getByRole('button', { name: /Copy Diagnostics/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalled();
    });
  });

  it('calls onClose when Done or Close button is clicked or Esc is pressed', () => {
    const onClose = vi.fn();
    render(<DiagnosticsModal isOpen={true} onClose={onClose} />);

    const doneBtn = screen.getByRole('button', { name: 'Done' });
    fireEvent.click(doneBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
