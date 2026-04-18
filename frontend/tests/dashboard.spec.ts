import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const EMAIL = 'testuser@test.com';
const PASSWORD = 'testpass123';

test.describe('Dashboard page', () => {
  test('loads without 500 errors after login', async ({ page }) => {
    // Capture any failed API responses
    const failedRequests: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 500) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard or home
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 5000 });

    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Assert no 500s
    expect(failedRequests, `500 errors: ${failedRequests.join(', ')}`).toHaveLength(0);

    // Assert page rendered (not blank)
    const body = await page.textContent('body');
    expect(body).toBeTruthy();

    console.log('Dashboard loaded successfully');
    console.log('Page title:', await page.title());
  });

  test('stats/questions endpoint returns valid shape', async ({ request }) => {
    // Login via API
    const loginRes = await request.post('http://localhost:8000/api/v1/auth/login', {
      data: { email: EMAIL, password: PASSWORD },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { access_token } = await loginRes.json();

    // Hit stats endpoint
    const statsRes = await request.get('http://localhost:8000/api/v1/stats/questions', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    expect(statsRes.status()).toBe(200);

    const data = await statsRes.json();
    expect(data).toHaveProperty('by_difficulty');
    expect(data).toHaveProperty('by_topic');
    expect(typeof data.by_difficulty).toBe('object');
    expect(Array.isArray(data.by_topic)).toBe(true);

    console.log('stats/questions response:', JSON.stringify(data));
  });
});
