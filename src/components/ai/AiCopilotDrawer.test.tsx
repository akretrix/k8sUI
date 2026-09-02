import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AiCopilotDrawer } from './AiCopilotDrawer';

describe('AiCopilotDrawer Component (Safety & Functional Tests)', () => {
  it('renders drawer with model provider selector and compliance badges when open', () => {
    render(
      <AiCopilotDrawer
        isOpen={true}
        onClose={vi.fn()}
        onApproveProposal={vi.fn()}
        onRejectProposal={vi.fn()}
      />
    );

    expect(screen.getByText('k8sUI Copilot')).toBeInTheDocument();
    expect(screen.getByText('Whitelist Only')).toBeInTheDocument();
    expect(screen.getByText(/Cluster data framed as untrusted/i)).toBeInTheDocument();
  });

  it('allows switching to Local Ollama model provider for air-gapped safety', () => {
    render(
      <AiCopilotDrawer
        isOpen={true}
        onClose={vi.fn()}
        onApproveProposal={vi.fn()}
        onRejectProposal={vi.fn()}
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'local_ollama' } });
    expect(screen.getByText('Ollama (Local Air-Gapped)')).toBeInTheDocument();
  });

  it('submits a prompt and renders dry-run proposal cards with human approval action', async () => {
    const handleApprove = vi.fn();
    const handleReject = vi.fn();

    render(
      <AiCopilotDrawer
        isOpen={true}
        onClose={vi.fn()}
        onApproveProposal={handleApprove}
        onRejectProposal={handleReject}
      />
    );

    // Type query to trigger mock proposal
    const input = screen.getByPlaceholderText('Ask AI to troubleshoot or scale...');
    fireEvent.change(input, { target: { value: 'scale auth-service to 3' } });

    await act(async () => {
      fireEvent.submit(input.closest('form')!);
      // wait 600ms for simulated AI reasoning delay
      await new Promise((r) => setTimeout(r, 700));
    });

    expect(screen.getByText('Action Requires Confirmation')).toBeInTheDocument();
    expect(screen.getByText('Approve & Apply')).toBeInTheDocument();

    // Click Approve
    fireEvent.click(screen.getByText('Approve & Apply'));
    expect(handleApprove).toHaveBeenCalled();
  });
});
