import { test, expect } from '@playwright/test';

const shouldRun = process.env.RUN_E2E === 'true';

test.describe('APRcut smoke flow', () => {
  test.skip(!shouldRun, 'Set RUN_E2E=true to enable smoke test');

  test('upload to saved item lifecycle', async ({ page }) => {
    await page.goto('/');

    await page.route('**/analyze', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            actions: [],
            warnings: [],
            audit: { engineVersion: 'v1.0.0', computeMs: 25 }
          })
        });
        return;
      }
      route.continue();
    });

    await page.route('**/items', (route, request) => {
      if (request.method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ item_id: 'item-123' })
        });
      } else if (request.method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                item_id: 'item-123',
                type: 'letter',
                template_id: 'dispute-style-a',
                payload_no_pii: {},
                engine_version: 'v1.0.0',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                stale: false
              }
            ]
          })
        });
      } else {
        route.continue();
      }
    });

    await expect(page.getByText(/Upload your credit report/i)).toBeVisible();
    await page.goto('/saved');
    await expect(page.getByText(/Saved items/)).toBeVisible();
  });
});
