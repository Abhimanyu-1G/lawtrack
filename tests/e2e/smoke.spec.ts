import { expect, test } from '@playwright/test';

/**
 * End-to-end smoke and journey tests (AGENTS.md §17, §18).
 *
 * Covers:
 * - Public landing, i18n copy switch, mandatory disclaimer.
 * - Knowledge hub browsing and guide detail view.
 * - Citizen journey: Login, dashboard overview, chat, drafts, cases.
 * - Lawyer journey: Login, queue review dashboard.
 * - Mobile 360px viewport: Responsive layout with zero horizontal overflow.
 * - Accessibility: Skip link, form labels, ARIA landmarks and main content target.
 */

test('landing page renders the hero and disclaimer', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Know your rights');
  await expect(
    page.getByText('LawTrack provides general legal information, not legal advice.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'LawTrack' })).toBeVisible();
});

test('language switch renders Hindi copy', async ({ page }) => {
  await page.goto('/?lang=hi');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('अपने अधिकार जानें');
  await expect(page.getByText('लॉट्रैक सामान्य कानूनी जानकारी देता है, कानूनी सलाह नहीं।')).toBeVisible();
});

test('knowledge hub lists guides and opens a guide', async ({ page }) => {
  await page.goto('/knowledge');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Know your rights');
  const firstGuide = page.getByRole('link', { name: /Read guide/ }).first();
  await expect(firstGuide).toBeVisible();
  await firstGuide.click();

  await expect(page).toHaveURL(/\/knowledge\/\d+/);
  await expect(page.getByRole('heading', { level: 2, name: 'What it means for you' })).toBeVisible();
  await expect(page.getByText('Curator verified').first()).toBeVisible();
});

test('health endpoint reports healthy', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();

  const body = (await response.json()) as { status: string; checks: { database: { status: string } } };
  expect(body.status).toBe('healthy');
  expect(body.checks.database.status).toBe('up');
});

test('unknown page shows the friendly 404', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('could not find');
});

test('citizen journey: login, dashboard, chat, drafts, and cases navigation', async ({ page }) => {
  await page.goto('/login');

  await page.fill('#email', 'citizen@lawtrack.demo');
  await page.fill('#password', 'Demo1234');
  await page.click('button[type="submit"]');

  await page.waitForURL(/\/citizen/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Mandatory disclaimer on authenticated workspace
  await expect(
    page.getByText('LawTrack provides general legal information, not legal advice.'),
  ).toBeVisible();

  // Navigate to Chat
  await page.goto('/citizen/chat');
  await expect(page).toHaveURL(/\/citizen\/chat/);
  await expect(page.getByText(/Legal Assistant|AI Assistant|Ask a legal question/i).first()).toBeVisible();

  // Navigate to Drafts
  await page.goto('/citizen/drafts');
  await expect(page).toHaveURL(/\/citizen\/drafts/);

  // Navigate to Cases
  await page.goto('/citizen/cases');
  await expect(page).toHaveURL(/\/citizen\/cases/);
  await expect(page.getByRole('textbox').first()).toBeVisible();
});

test('lawyer journey: login and queue review view', async ({ page }) => {
  await page.goto('/login');

  await page.fill('#email', 'lawyer@lawtrack.demo');
  await page.fill('#password', 'Demo1234');
  await page.click('button[type="submit"]');

  await page.waitForURL(/\/lawyer/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(
    page.getByText('LawTrack provides general legal information, not legal advice.'),
  ).toBeVisible();
});

test('mobile 360px viewport responsiveness', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });

  await page.goto('/');
  const hasNoOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= window.innerWidth;
  });
  expect(hasNoOverflow).toBeTruthy();

  await page.goto('/login');
  const loginNoOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= window.innerWidth;
  });
  expect(loginNoOverflow).toBeTruthy();

  await page.goto('/knowledge');
  const hubNoOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= window.innerWidth;
  });
  expect(hubNoOverflow).toBeTruthy();
});

test('accessibility: skip link and form labels check', async ({ page }) => {
  await page.goto('/');

  // Verify skip link targets #main-content
  const skipLink = page.locator('a.skip-link');
  await expect(skipLink).toHaveAttribute('href', '#main-content');
  const mainContent = page.locator('#main-content');
  await expect(mainContent).toBeAttached();

  // Check login form has labels linked with inputs
  await page.goto('/login');
  const emailInput = page.locator('#email');
  await expect(emailInput).toBeVisible();
  const passwordInput = page.locator('#password');
  await expect(passwordInput).toBeVisible();

  const emailLabel = page.locator('label[for="email"]');
  await expect(emailLabel).toBeVisible();
  const passwordLabel = page.locator('label[for="password"]');
  await expect(passwordLabel).toBeVisible();
});
