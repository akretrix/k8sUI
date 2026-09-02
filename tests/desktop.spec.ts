import { test, expect } from '@playwright/test';

test.describe('K8sUI Desktop Functional E2E', () => {
  test('should load the dashboard and verify cluster metrics', async ({ page }) => {
    // Navigate to the local dev server
    await page.goto('http://localhost:5173/');

    // Ensure the sidebar is present
    await expect(page.locator('text=Cluster Metrics')).toBeVisible();

    // Click on Cluster Metrics to go to Dashboard
    await page.click('text=Cluster Metrics');

    // Verify dashboard renders
    await expect(page.locator('h1', { hasText: 'Cluster Overview' })).toBeVisible();
    await expect(page.locator('text=Nodes')).toBeVisible();
    await expect(page.locator('text=CPU Utilization')).toBeVisible();
    await expect(page.locator('text=Memory Utilization')).toBeVisible();
  });

  test('should load the Nodes table and verify progress bars', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Click on Nodes
    await page.click('text=Nodes');

    // Verify GenericResourceTable loaded nodes (mock node-1 should exist)
    await expect(page.locator('text=node-1')).toBeVisible();

    // Verify CPU/Memory headers exist
    await expect(page.locator('th:has-text("CPU")')).toBeVisible();
    await expect(page.locator('th:has-text("Memory")')).toBeVisible();
  });

  test('should render action buttons on workload resources', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Click on Deployments
    await page.click('text=Deployments');

    // Verify Deployments loaded
    await expect(page.locator('text=deployments-1')).toBeVisible();

    // Look for the "Rollout Restart" icon or button (has title="Rollout Restart")
    await expect(page.locator('button[title="Rollout Restart"]').first()).toBeVisible();
    await expect(page.locator('button[title="View Logs"]').first()).toBeVisible();
    await expect(page.locator('button[title="Describe Resource"]').first()).toBeVisible();
  });
});
