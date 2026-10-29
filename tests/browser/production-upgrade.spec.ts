import { expect, test } from '@playwright/test';
import { setup, products } from './fixtures';

test('a live bundle confirms native readiness only after the sign-in chunk renders', async ({
  page,
}) => {
  await setup(page, { signedIn: false });
  await page.addInitScript(() => {
    const calls: string[] = [];
    const host = window as unknown as {
      androidBridge: { postMessage(): void };
      Capacitor: unknown;
      nativeCalls: string[];
    };
    host.nativeCalls = calls;
    host.androidBridge = { postMessage() {} };
    host.Capacitor = {
      PluginHeaders: [
        {
          name: 'SystemBars',
          methods: [
            { name: 'show', rtype: 'promise' },
            { name: 'setStyle', rtype: 'promise' },
          ],
        },
        { name: 'HamiyaSystemUi', methods: [{ name: 'setSurface', rtype: 'promise' }] },
        { name: 'CapacitorUpdater', methods: [{ name: 'notifyAppReady', rtype: 'promise' }] },
      ],
      nativePromise: async (plugin: string, method: string) => {
        calls.push(plugin + '.' + method);
        return {};
      },
    };
  });
  await page.clock.install();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    /\/(?:src\/Account\.tsx[^/]*|assets\/Account-[^/]+\.js)(?:\?.*)?$/,
    async (route) => {
      await gate;
      await route.continue();
    },
  );
  await page.goto('/app', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.entry-screen .startup-splash')).toBeVisible();
  await page.clock.fastForward(1000);
  expect(
    await page.evaluate(() => (window as unknown as { nativeCalls: string[] }).nativeCalls),
  ).not.toContain('CapacitorUpdater.notifyAppReady');
  release();
  await expect(page.locator('.account-auth')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { nativeCalls: string[] }).nativeCalls))
    .toContain('CapacitorUpdater.notifyAppReady');
});

test('a stalled sign-in screen offers recovery while preserving the branded startup surface', async ({
  page,
}) => {
  await setup(page, { signedIn: false });
  await page.clock.install();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    /\/(?:src\/Account\.tsx[^/]*|assets\/Account-[^/]+\.js)(?:\?.*)?$/,
    async (route) => {
      await gate;
      await route.continue();
    },
  );
  await page.goto('/app', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.startup-splash')).toBeVisible();
  await page.clock.fastForward(21000);
  await expect(page.locator('.startup-recovery')).toContainText('taking too long');
  await expect(page.locator('.startup-progress')).toHaveCount(0);
  await expect(page.locator('.startup-recovery button')).toBeEnabled();
  release();
  await expect(page.locator('.account-auth')).toBeVisible();
});

test('a stalled customer screen offers retry with the dock still accessible', async ({ page }) => {
  await setup(page);
  await page.clock.install();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    /\/(?:src\/Commerce\.tsx[^/]*|assets\/Commerce-[^/]+\.js)(?:\?.*)?$/,
    async (route) => {
      await gate;
      await route.continue();
    },
  );
  await page.goto('/app#catalog', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.loading-state')).toBeVisible();
  await page.clock.fastForward(21000);
  await expect(page.locator('.loading-recovery')).toContainText('taking too long');
  await expect(page.locator('.mobile-nav')).toBeVisible();
  release();
  await expect(page.locator('.product-card')).toHaveCount(2);
});

test('keyboard visual resizing and changing native insets keep the sheet bounded', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/app#catalog');
  await page.getByRole('button', { name: 'Product details: Banana', exact: true }).click();
  const sheet = page.locator('.product-sheet');
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-area-inset-top', '52px');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', '24px');
  });
  await expect
    .poll(() =>
      sheet.evaluate((element) =>
        parseFloat(getComputedStyle(element).getPropertyValue('--sheet-top')),
      ),
    )
    .toBe(52);
  await expect(page.locator('.app-body')).toHaveAttribute('inert', '');
  await expect(page.locator('.mobile-nav')).not.toHaveAttribute('inert', '');
  await sheet.locator('input[type=number]').focus();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, 'height', { configurable: true, get: () => 400 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('html')).toHaveClass(/keyboard-open/);
  await expect
    .poll(() => sheet.evaluate((element) => element.getBoundingClientRect().bottom))
    .toBeLessThanOrEqual(400);
  await expect
    .poll(() => sheet.evaluate((element) => element.getBoundingClientRect().top))
    .toBeGreaterThanOrEqual(52);
  await sheet
    .locator('.product-sheet-footer')
    .evaluate((element) => element.scrollTo(0, element.scrollHeight));
  const action = sheet.getByRole('button', { name: 'Add to cart', exact: true });
  const bounds = await action.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(400);
  await page.evaluate(() => {
    delete (window.visualViewport as unknown as { height?: number }).height;
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await sheet.locator('input[type=number]').blur();
  await expect(page.locator('.mobile-nav')).toBeVisible();
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.app-body')).not.toHaveAttribute('inert', '');
});

test('available filter excludes stock below the minimum and search accepts translated names', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/rest/v1/hamiya_products?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        products.map((product) => ({
          ...product,
          stock: product.id === 'apple' ? 19 : product.stock,
          translations: { am: { name: product.id === 'banana' ? 'ሙዝ' : 'ፖም' } },
        })),
      ),
    }),
  );
  await page.goto('/app#catalog');
  await page.getByRole('textbox', { name: 'Search products', exact: true }).fill('ሙዝ');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.locator('.available-filter input').check();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-card')).toContainText('Banana');
});

test('cart follows the selected language and signing out clears the previous customer cart', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/rest/v1/hamiya_products?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        products.map((product) => ({
          ...product,
          translations: { am: { name: product.id === 'banana' ? 'ሙዝ' : 'ፖም' } },
        })),
      ),
    }),
  );
  await page.goto('/app#catalog');
  await page.getByRole('button', { name: 'Product details: Banana', exact: true }).click();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.locator('.topbar select').selectOption('am');
  await page.locator('.cart-button').click();
  await expect(page.locator('.cart-item')).toContainText('ሙዝ');
  await expect(page.locator('.cart-item')).toContainText('ካርቶን');
  await page.keyboard.press('Escape');
  await page.locator('.topbar select').selectOption('en');
  await page.locator('.mobile-nav button').last().click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.locator('.account-auth')).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('hamiya-cart-v1') || '[]')),
  ).toEqual([]);
});

test('the status-area surface follows real insets without adding clearance twice', async ({
  page,
}) => {
  await setup(page);
  await page.addInitScript(() =>
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.setProperty('--safe-area-inset-top', '44px');
    }),
  );
  await page.goto('/app#home');
  await expect(page.locator('.division-card')).toHaveCount(3);
  expect(await page.evaluate(() => getComputedStyle(document.body, '::before').height)).toBe(
    '44px',
  );
  expect((await page.locator('.app-menu-button').boundingBox())!.y).toBe(52);
  await page.mouse.wheel(0, 650);
  expect(
    await page.evaluate(() => getComputedStyle(document.body, '::before').backgroundColor),
  ).toBe('rgb(246, 248, 250)');
  await page.evaluate(() =>
    document.documentElement.style.setProperty('--safe-area-inset-top', '0px'),
  );
  expect((await page.locator('.app-menu-button').boundingBox())!.y).toBe(8);
  expect(await page.evaluate(() => getComputedStyle(document.body, '::before').height)).toBe('0px');
});
