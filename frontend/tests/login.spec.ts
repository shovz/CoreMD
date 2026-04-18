import { test, expect } from '@playwright/test';

test('login with exact user credentials', async ({ page }) => {
  const apiResponses: { status: number; url: string; body: string }[] = [];

  page.on('response', async (res) => {
    if (res.url().includes('/auth/')) {
      let body = '';
      try { body = await res.text(); } catch {}
      apiResponses.push({ status: res.status(), url: res.url(), body });
    }
  });

  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'test@gmail.com');
  await page.fill('input[type="password"]', 'test1234');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  console.log('URL after submit:', page.url());
  console.log('API responses:', JSON.stringify(apiResponses, null, 2));
  console.log('Body text:', await page.textContent('body'));
});

test('register with exact user credentials', async ({ page }) => {
  const apiResponses: { status: number; url: string; body: string }[] = [];

  page.on('response', async (res) => {
    if (res.url().includes('/auth/')) {
      let body = '';
      try { body = await res.text(); } catch {}
      apiResponses.push({ status: res.status(), url: res.url(), body });
    }
  });

  await page.goto('http://localhost:5173/register');
  await page.fill('input[type="email"]', `fresh_${Date.now()}@gmail.com`);
  await page.fill('input[type="password"]', 'test1234');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  console.log('Register URL after submit:', page.url());
  console.log('Register API responses:', JSON.stringify(apiResponses, null, 2));
  console.log('Register body:', await page.textContent('body'));
});
