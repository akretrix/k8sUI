import { describe, it, expect } from 'vitest';
import { api } from './tauriClient';

describe('tauriClient API Layer (Unit & Functional Tests)', () => {
  it('should fetch available clusters and have pdn-acme in acme-production as active initially', async () => {
    const clusters = await api.getClusters();
    expect(clusters.length).toBeGreaterThanOrEqual(3);
    const active = await api.getActiveCluster();
    expect(active).toBeDefined();
    expect(active?.name).toBe('pdn-acme');
  });

  it('should enforce Read-Only Mode by default', async () => {
    const isReadOnly = await api.getReadOnlyStatus();
    expect(isReadOnly).toBe(true);
  });

  it('should reject manifest mutations while in Read-Only Mode', async () => {
    await api.setWriteMode(false); // ensure locked
    await expect(
      api.applyManifest('apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: auth-service')
    ).rejects.toThrow(/Cannot apply manifest in Read-Only Mode/);
  });

  it('should reject scaling workloads while in Read-Only Mode', async () => {
    await api.setWriteMode(false);
    await expect(
      api.scaleResource('Deployment', 'auth-service', 'default', 3)
    ).rejects.toThrow(/Cannot scale in Read-Only Mode/);
  });

  it('should allow scaling after unlocking Write Mode', async () => {
    await api.setWriteMode(true);
    const res = await api.scaleResource('Deployment', 'auth-service', 'default', 3);
    expect(res.new_replicas).toBe(3);
    expect(res.name).toBe('auth-service');
  });

  it('should generate server-side dry-run diff without applying changes', async () => {
    const dryRun = await api.dryRunApply(
      'apiVersion: apps/v1\nkind: Deployment\nspec:\n  replicas: 3',
      'default'
    );
    expect(dryRun.server_validation_passed).toBe(true);
    expect(dryRun.diff).toContain('Proposed Dry-Run Changes');
  });

  it('should register AWS IAM Identity Center organization and auto-discover EKS clusters', async () => {
    const newOrg = await api.registerAwsSsoOrg(
      'Demo AWS Organization',
      'https://your-org.awsapps.com/start',
      'us-east-1'
    );
    expect(newOrg.id).toBe('your-org');
    expect(newOrg.status).toBe('authenticated');

    const clusters = await api.getClusters();
    // The mock derives org_id from the start URL hostname segment, then pushes new EKS clusters.
    // Verify at least 2 EKS clusters were registered and one is Production.
    const discoveredEks = clusters.filter((c) => c.provider === 'eks');
    expect(discoveredEks.length).toBeGreaterThanOrEqual(2);
    expect(discoveredEks.some((c) => c.environment === 'Production')).toBe(true);
  });

  it('should list all cluster namespaces including system and empty namespaces', async () => {
    const namespaces = await api.getNamespaces();
    expect(namespaces).toContain('default');
    expect(namespaces).toContain('pdn-acme-backend');
    expect(namespaces).toContain('kube-system');
    expect(namespaces).toContain('cert-manager');
  });

  it('should record audit trail entries for privileged actions', async () => {
    const logs = await api.getAuditLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].status).toBeDefined();
  });
});
