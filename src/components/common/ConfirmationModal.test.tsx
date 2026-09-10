import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmationModal } from './ConfirmationModal';

describe('ConfirmationModal', () => {
  it('renders delete modal and requires typing resource name to confirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ConfirmationModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        actionType="delete"
        resourceKind="Deployment"
        resourceName="frontend-service"
        namespace="production"
        clusterName="pdn-axonic"
        isReadOnly={false}
      />
    );

    expect(screen.getByText('Delete Deployment')).toBeInTheDocument();
    expect(screen.getAllByText('Deployment/frontend-service').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('production')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /Confirm Delete/i });
    expect(confirmButton).toBeDisabled();

    // Type the wrong name
    const input = screen.getByPlaceholderText('frontend-service');
    fireEvent.change(input, { target: { value: 'wrong-name' } });
    expect(confirmButton).toBeDisabled();

    // Type the exact name
    fireEvent.change(input, { target: { value: 'frontend-service' } });
    expect(confirmButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(confirmButton);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders restart modal without requiring typing name', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ConfirmationModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        actionType="restart"
        resourceKind="StatefulSet"
        resourceName="redis-cluster"
        namespace="database"
        isReadOnly={false}
      />
    );

    expect(screen.getByText('Restart StatefulSet')).toBeInTheDocument();
    expect(screen.getAllByText('StatefulSet/redis-cluster').length).toBeGreaterThanOrEqual(1);

    const confirmButton = screen.getByRole('button', { name: /Confirm Restart/i });
    expect(confirmButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(confirmButton);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('blocks confirmation when in Read-Only mode', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmationModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        actionType="restart"
        resourceKind="Deployment"
        resourceName="cert-manager"
        namespace="cert-manager"
        isReadOnly={true}
      />
    );

    const confirmButton = screen.getByRole('button', { name: /Confirm Restart/i });
    fireEvent.click(confirmButton);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Cannot execute mutations in Read-Only mode/i)
    ).toBeInTheDocument();
  });

  it('renders trigger_job modal and allows executing Run Now without typing name', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ConfirmationModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        actionType="trigger_job"
        resourceKind="CronJob"
        resourceName="nightly-backup"
        namespace="ops"
        isReadOnly={false}
      />
    );

    expect(screen.getByText('Trigger Run: CronJob')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to trigger an on-demand run/i)).toBeInTheDocument();

    const runButton = screen.getByRole('button', { name: /Run Job Now/i });
    expect(runButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(runButton);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders suspend_cronjob modal and allows executing Suspend without typing name', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ConfirmationModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        actionType="suspend_cronjob"
        resourceKind="CronJob"
        resourceName="nightly-backup"
        namespace="ops"
        isReadOnly={false}
      />
    );

    expect(screen.getByText('Suspend CronJob')).toBeInTheDocument();
    expect(screen.getByText(/Future scheduled runs will be paused until resumed/i)).toBeInTheDocument();

    const suspendButton = screen.getByRole('button', { name: /Confirm Suspend/i });
    expect(suspendButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(suspendButton);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders batch delete modal and requires typing "delete" to confirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ConfirmationModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        actionType="delete"
        resourceKind="Secrets"
        resourceName="3 Secrets"
        batchItems={[
          { name: 'secret-a', namespace: 'default' },
          { name: 'secret-b', namespace: 'default' },
          { name: 'secret-c', namespace: 'production' },
        ]}
        isReadOnly={false}
      />
    );

    expect(screen.getByText('Delete 3 Secrets')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to permanently delete/i)).toBeInTheDocument();
    expect(screen.getByText('secret-a')).toBeInTheDocument();
    expect(screen.getByText('secret-b')).toBeInTheDocument();
    expect(screen.getByText('secret-c')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm Delete \(3\)/i });
    expect(confirmBtn).toBeDisabled();

    // Type delete
    const input = screen.getByPlaceholderText('delete');
    fireEvent.change(input, { target: { value: 'delete' } });
    expect(confirmBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(confirmBtn);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders batch restart modal without requiring typing name', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ConfirmationModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        actionType="restart"
        resourceKind="Deployments"
        resourceName="2 Deployments"
        batchItems={[
          { name: 'dep-frontend', namespace: 'default' },
          { name: 'dep-backend', namespace: 'default' },
        ]}
        isReadOnly={false}
      />
    );

    expect(screen.getByText('Restart 2 Deployments')).toBeInTheDocument();
    expect(screen.getByText(/rolling rollout restart on/i)).toBeInTheDocument();
    expect(screen.getByText('dep-frontend')).toBeInTheDocument();
    expect(screen.getByText('dep-backend')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm Restart \(2\)/i });
    expect(confirmBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(confirmBtn);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
