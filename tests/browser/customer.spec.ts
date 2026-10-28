import { test, expect } from '@playwright/test';
import { products, setup } from './fixtures';

test('Android download gives a real file and recovers from a failed preflight', async ({
  page,
}) => {
  await setup(page, { signedIn: false });
  let unavailable = true;
  await page.route('https://hamiyainvestmentgroup.vercel.app/api/android**', (route) => {
    if (unavailable) return route.fulfill({ status: 503, body: 'Unavailable' });
    return route.fulfill({
      status: 200,
      contentType: 'application/vnd.android.package-archive',
      headers: { 'Content-Disposition': 'attachment; filename="Hamiya.apk"' },
      body: route.request().method() === 'HEAD' ? '' : Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    });
  });
  await page.goto('/#settings');
  const download = page.getByRole('button', { name: 'Download Android app', exact: true });
  await expect(download).toBeVisible();
  await download.click();
  await expect(page.getByRole('alert')).toContainText('Could not start the download');
  unavailable = false;
  const downloaded = page.waitForEvent('download');
  await download.click();
  expect((await downloaded).suggestedFilename()).toBe('Hamiya.apk');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

for (const width of [320, 390, 768, 1280]) {
  test(`catalog and bounded sheet at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    await page.goto('/#catalog');
    await page.getByRole('button', { name: 'Product details: Banana', exact: true }).click();
    const sheet = page.locator('.product-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { name: 'Banana', exact: true })).toHaveCount(1);
    const metrics = () =>
      sheet.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const dock = document.querySelector('.mobile-nav')!;
        const dockVisible = getComputedStyle(dock).display !== 'none';
        const dockTop = dockVisible ? dock.getBoundingClientRect().top : innerHeight;
        const top =
          parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) ||
          0;
        const bottom = parseFloat(getComputedStyle(element).getPropertyValue('--sheet-bottom'));
        return {
          height: rect.height,
          top: rect.top,
          bottom: rect.bottom,
          dockTop,
          usable: innerHeight - top - bottom - 12,
        };
      });
    await expect
      .poll(async () => (await metrics()).height / (await metrics()).usable)
      .toBeCloseTo(0.6, 1);
    if (width === 390)
      await page.screenshot({
        path: 'test-results/review-product-sheet.png',
        animations: 'disabled',
      });
    const initial = await metrics();
    expect(initial.top).toBeGreaterThan(0);
    expect(initial.bottom).toBeLessThan(initial.dockTop);
    const grip = sheet.getByRole('slider');
    await grip.press('End');
    await expect
      .poll(async () => (await metrics()).height / (await metrics()).usable)
      .toBeCloseTo(0.75, 1);
    await grip.press('Home');
    await expect
      .poll(async () => (await metrics()).height / (await metrics()).usable)
      .toBeCloseTo(0.45, 1);
    if (width < 1024) {
      await expect(page.locator('.mobile-nav')).toBeVisible();
      await page.locator('.mobile-nav').getByRole('button', { name: 'Home', exact: true }).click();
      await expect(sheet).toHaveCount(0);
      await expect(page.locator('.division-card')).toHaveCount(3);
      if (width === 390) {
        await expect
          .poll(() =>
            page
              .locator('.division-card.vehicles img')
              .evaluate((element) => (element as HTMLImageElement).naturalWidth),
          )
          .toBeGreaterThan(0);
        await page.screenshot({ path: 'test-results/review-home.png', animations: 'disabled' });
      }
    } else {
      await sheet.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(sheet).toHaveCount(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('quantity 200, cart editing, duplicate submission protection and order history', async ({
  page,
}) => {
  const { submitted } = await setup(page);
  await page.goto('/#catalog');
  await page.getByRole('button', { name: 'Product details: Banana', exact: true }).click();
  await page.locator('.product-sheet input[type=number]').fill('200');
  await expect(page.locator('.sheet-total')).toContainText('143,000');
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.getByRole('button', { name: 'Your cart', exact: true }).click();
  const cart = page.locator('dialog');
  const quantity = cart.locator('input[type=number]');
  await expect(quantity).toHaveValue('200');
  await quantity.fill('');
  await quantity.fill('250');
  await expect(quantity).toHaveValue('250');
  await quantity.fill('200');
  await cart.getByRole('button', { name: /Submit order/i }).dblclick();
  await expect.poll(() => submitted.length).toBe(1);
  expect((submitted[0].items as { quantity: number }[])[0].quantity).toBe(200);
  await expect(page.locator('.order-card')).toHaveCount(1);
});

test('out-of-stock products cannot be purchased; search and category filters work', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/#catalog');
  await page.getByRole('button', { name: 'Product details: Apple', exact: true }).click();
  await expect(page.locator('.product-sheet-footer .button')).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('textbox', { name: 'Search products', exact: true }).fill('Banana');
  await expect(page.locator('.product-grid .product-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Coffee export', exact: true }).click();
  await expect(page.locator('.product-grid .product-card')).toHaveCount(0);
});

for (const language of ['en', 'am', 'om']) {
  test(`language ${language} persists and keeps controls in the safe area`, async ({ page }) => {
    await setup(page);
    await page.addInitScript((language) => {
      localStorage.setItem('hamiya-language', JSON.stringify(language));
      document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.setProperty('--safe-area-inset-top', '44px');
        document.documentElement.style.setProperty('--safe-area-inset-bottom', '24px');
      });
    }, language);
    await page.goto('/#home');
    await expect(page.locator('.division-card')).toHaveCount(3);
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    const controlTop = await page
      .locator('.topbar .app-menu-button')
      .evaluate((element) => element.getBoundingClientRect().top);
    expect(controlTop).toBeGreaterThanOrEqual(44);
    const safeDock = await page
      .locator('.mobile-nav')
      .evaluate((element) => innerHeight - element.getBoundingClientRect().bottom);
    expect(safeDock).toBeGreaterThanOrEqual(24);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('startup failure offers retry and a healthy retry reaches the dashboard', async ({ page }) => {
  await setup(page, { authFailure: true });
  await page.goto('/');
  await expect(page.locator('.startup-recovery')).toBeVisible({ timeout: 18000 });
  await expect(page.locator('.startup-recovery button')).toBeEnabled();
  await page.route('**/auth/v1/user', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-4000-8000-000000000002',
        aud: 'authenticated',
        email: 'qa@example.test',
      }),
    }),
  );
  await page.locator('.startup-recovery button').click();
  await expect(page.locator('.division-card')).toHaveCount(3);
});

test('administrator navigation remains separate from the customer dock', async ({ page }) => {
  await setup(page, { role: 'admin' });
  await page.goto('/#admin');
  await expect(page.locator('.admin-app-shell')).toBeVisible();
  await expect(page.locator('.mobile-nav')).toHaveCount(0);
  await expect(page.locator('.admin-page')).toBeVisible();
});

test('logout returns to standalone sign-in; guest dashboard links stay protected', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/#account');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.locator('.account-auth')).toBeVisible();
  await expect(page.locator('.mobile-nav')).toHaveCount(0);
  await page.goto('/#catalog');
  await expect(page.locator('.account-auth')).toBeVisible();
});

test('dragging, internal scrolling, Back dismissal and reduced motion keep the dock usable', async ({
  page,
}) => {
  await setup(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#catalog');
  await page.getByRole('button', { name: 'Product details: Banana', exact: true }).click();
  const grip = page.locator('.product-sheet-grip');
  const bounds = await grip.boundingBox();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + 20);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y - 80, { steps: 8 });
  await page.mouse.up();
  await expect(grip).toHaveAttribute('aria-valuenow', '75');
  await page
    .locator('.product-sheet-scroll')
    .evaluate((element) => element.scrollTo(0, element.scrollHeight));
  await expect(grip).toHaveAttribute('aria-valuenow', '75');
  await expect(page.locator('.mobile-nav')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.product-sheet')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Product details: Banana', exact: true }),
  ).toBeFocused();
});

test('a stalled authentication request leaves loading and offers recovery', async ({ page }) => {
  await setup(page);
  await page.route('**/auth/v1/user', () => new Promise(() => {}));
  await page.goto('/');
  await expect(page.locator('.startup-recovery')).toBeVisible({ timeout: 16000 });
  await expect(page.locator('.startup-progress')).toHaveCount(0);
});

test('registration validates required fields outside the dashboard', async ({ page }) => {
  await setup(page, { signedIn: false });
  await page.goto('/#register');
  await expect(page.locator('.account-auth')).toBeVisible();
  await expect(page.locator('.mobile-nav')).toHaveCount(0);
  await expect(page.locator('input[required]')).not.toHaveCount(0);
  expect(
    await page.locator('form').evaluate((element) => (element as HTMLFormElement).checkValidity()),
  ).toBe(false);
});

test('catalog request failures show recovery and retry replaces the empty state with live results', async ({
  page,
}) => {
  const options = { catalogFailure: true };
  await setup(page, options);
  await page.goto('/#catalog');
  await expect(
    page.locator('.catalog-page').getByRole('button', { name: 'Try again', exact: true }),
  ).toBeVisible();
  await page.route('**/rest/v1/hamiya_products?**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(products) }),
  );
  await page
    .locator('.catalog-page')
    .getByRole('button', { name: 'Try again', exact: true })
    .click();
  await expect(page.locator('.product-grid .product-card')).toHaveCount(2);
});

test('sign-in chunk loading retains the branded splash until the entry screen is ready', async ({
  page,
}) => {
  await setup(page, { signedIn: false });
  let releaseChunk: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    releaseChunk = resolve;
  });
  await page.route(
    /\/(?:src\/Account\.tsx[^/]*|assets\/Account-[^/]+\.js)(?:\?.*)?$/,
    async (route) => {
      await gate;
      await route.continue();
    },
  );
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.startup-splash')).toBeVisible();
  await expect(page.locator('.loading-state')).toHaveCount(0);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#193b4d');
  releaseChunk!();
  await expect(page.locator('.account-auth')).toBeVisible();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f6f8fa');
});
