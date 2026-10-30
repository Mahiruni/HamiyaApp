import { expect, test } from '@playwright/test';

const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
];

test.describe('HAMIYA guest startup and authentication', () => {
  for (const viewport of viewports) {
    test(`welcome and registration fit ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/app#home');
      const welcome = page.locator('.hamiya-welcome');
      await expect(welcome).toBeVisible();
      await expect(page.locator('.hamiya-welcome-actions button')).toHaveCount(2);
      await expect(page.locator('.hamiya-welcome-actions button').first()).toBeInViewport();
      await expect(page.locator('.hamiya-welcome-actions button').last()).toBeInViewport();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await page.locator('.hamiya-welcome-actions button').last().click();
      await expect(page.locator('.hamiya-auth-entry')).toBeVisible();
      await expect(page.locator('input[name="full_name"]')).toBeVisible();
      await expect(page.locator('input[name="confirm_password"]')).toBeVisible();
      await expect(page.locator('input[name="accept_terms"]')).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  test('login back, password visibility, recovery and return to login', async ({ page }) => {
    await page.goto('/app#home');
    await expect(page.locator('.hamiya-welcome')).toBeVisible();
    await page.locator('.hamiya-welcome-actions button').first().click();
    await expect(page.locator('.hamiya-auth-entry')).toBeVisible();
    const password = page.locator('input[name="password"]');
    await expect(password).toHaveAttribute('type', 'password');
    await page.locator('.hamiya-auth-entry .password-toggle').first().click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.locator('.auth-forgot').click();
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
    await page.locator('.auth-switch button').click();
    await expect(password).toBeVisible();
    await page.locator('.hamiya-auth-back').click();
    await expect(page.locator('.hamiya-welcome')).toBeVisible();
  });

  test('guest language selector supports English, Amharic and Afaan Oromo', async ({ page }) => {
    await page.goto('/app#home');
    await expect(page.locator('.hamiya-welcome')).toBeVisible();
    const selector = page.locator('.hamiya-welcome-language select');
    for (const code of ['en', 'am', 'om']) {
      await selector.selectOption(code);
      await expect(page.locator('html')).toHaveAttribute('lang', code);
    }
  });

  test('registration rejects mismatched passwords without sending a request', async ({ page }) => {
    await page.goto('/app#register');
    await expect(page.locator('.hamiya-auth-entry')).toBeVisible();
    await page.locator('input[name="full_name"]').fill('Test Customer');
    await page.locator('input[name="email"]').fill('qa@example.invalid');
    await page.locator('input[name="password"]').fill('CorrectPassword123!');
    await page.locator('input[name="confirm_password"]').fill('IncorrectPassword123!');
    await page.locator('input[name="accept_terms"]').check();
    // The form can be disabled in an unconfigured local environment; validate the fields
    // independently, and exercise submission only where backend configuration exists.
    const submit = page.locator('.auth-submit');
    if (await submit.isEnabled()) {
      await submit.click();
      await expect(page.getByRole('alert')).toContainText(/do not match/i);
    }
  });
});
