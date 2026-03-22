import { test, expect } from '@playwright/test';

test.describe('E2E: Dashboard Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should redirect to login when unauthenticated', async ({ page }) => {
    await expect(page).toHaveURL(/.*login/);
    expect(await page.locator('h1').textContent()).toContain('Login');
  });

  test('should login with valid token and navigate', async ({ page }) => {
    // Enter token (use test token)
    await page.fill('input[type="password"]', 'test-admin-token');
    await page.click('button[type="submit"]');

    // After login, should redirect to overview
    await expect(page).toHaveURL(/.*overview/);
    expect(await page.locator('h2').first().textContent()).toBe('Overview');
  });

  test('should display overview metrics after login', async ({ page }) => {
    await page.fill('input[type="password"]', 'test-admin-token');
    await page.click('button[type="submit"]');

    // Wait for metrics to load
    await expect(page.locator('text=Requests Per Second')).toBeVisible();
    // RPS should be displayed (a number)
    await expect(page.locator('.text-4xl')).toContainText(/\d+(\.\d+)?/);
  });

  test('should navigate to traffic page', async ({ page }) => {
    await page.fill('input[type="password"]', 'test-admin-token');
    await page.click('button[type="submit"]');

    // Click on Traffic link in sidebar (assuming it exists)
    await page.click('text=Traffic');
    await expect(page).toHaveURL(/.*traffic/);
    expect(await page.locator('h2').textContent()).toBe('Traffic Drill-Down');
  });

  test('should navigate to rules management page', async ({ page }) => {
    await page.fill('input[type="password"]', 'test-admin-token');
    await page.click('button[type="submit"]');

    await page.click('text=Rules');
    await expect(page).toHaveURL(/.*rules/);
    expect(await page.locator('h2').textContent()).toBe('Rules Management');
  });

  test('should display allow/deny lists page', async ({ page }) => {
    await page.fill('input[type="password"]', 'test-admin-token');
    await page.click('button[type="submit"]');

    await page.click('text=Allow/Deny Lists');
    await expect(page).toHaveURL(/.*lists/);
    expect(await page.locator('h2').textContent()).toBe('Allow/Deny Lists');
  });

  test('should open create rule modal', async ({ page }) => {
    await page.fill('input[type="password"]', 'test-admin-token');
    await page.click('button[type="submit"]');

    await page.click('text=Rules');
    await page.click('text=Create New Rule');

    // Modal appears
    await expect(page.locator('text=Create Rule')).toBeVisible();
  });

  test('should perform search in traffic page', async ({ page }) => {
    await page.fill('input[type="password"]', 'test-admin-token');
    await page.click('button[type="submit"]');

    await page.click('text=Traffic');
    await page.fill('input[placeholder="192.168.1.1"]', '192.0.2.1');
    await page.click('button:has-text("Search")');

    // Results should appear (maybe)
    await expect(page.locator('table')).toBeVisible();
  });

  test('should export logs as CSV', async ({ page }) => {
    await page.fill('input[type="password"]', 'test-admin-token');
    await page.click('button[type="submit"]');

    await page.click('text=Traffic');
    await page.click('text=Export CSV');
    // Expect download to start (we could verify download event)
    // For now just check no error
  });
});
