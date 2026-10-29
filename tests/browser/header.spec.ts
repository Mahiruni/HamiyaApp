import { expect, test } from '@playwright/test';
import { setup } from './fixtures';

for (const { width, native } of [
  { width: 320, native: false },
  { width: 390, native: false },
  { width: 768, native: false },
  { width: 390, native: true },
  { width: 1280, native: true },
]) {
  test(`${native ? 'Android' : 'web'} floating header controls remain visible and usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    await page.addInitScript((native) => {
      if (native)
        (window as unknown as { androidBridge: { postMessage: () => void } }).androidBridge = {
          postMessage: () => {},
        };
      document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.setProperty('--safe-area-inset-top', '44px');
        document.documentElement.style.setProperty('--safe-area-inset-bottom', '24px');
      });
    }, native);
    await page.goto('/app#home');
    await expect(page.locator('.division-card')).toHaveCount(3);
    const header = page.locator('.topbar');
    await expect(header.locator('.mobile-wordmark')).toHaveCount(0);
    await expect(header).not.toContainText('HAMIYA');
    await expect(header.locator('button, select')).toHaveCount(3);
    if (native) await expect(page.locator('html')).toHaveClass(/hamiya-native/);
    await expect(header.getByRole('button', { name: 'HAMIYA', exact: true })).toHaveCount(0);
    const menu = header.locator('[aria-controls="app-drawer"]');
    const language = header.getByRole('combobox');
    const cart = header.locator('.cart-button');
    for (const control of [menu, language, cart]) {
      await expect(control).toBeVisible();
      const bounds = await control.boundingBox();
      expect(bounds!.y).toBeGreaterThanOrEqual(44);
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(
        await control.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const target = document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          );
          return target === element || element.contains(target);
        }),
      ).toBe(true);
    }
    await expect(menu.locator('svg')).toBeVisible();
    const originalTop = (await menu.boundingBox())!.y;
    await page.screenshot({
      path: `test-results/header-${native ? 'android' : 'web'}-${width}.png`,
    });
    await page.mouse.wheel(0, 600);
    await expect(menu).toBeInViewport();
    expect((await menu.boundingBox())!.y).toBe(originalTop);
    await menu.click();
    await expect(page.locator('#app-drawer')).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
    await page.keyboard.press('Escape');
    await expect(page.locator('#app-drawer')).not.toBeVisible();
    await cart.click();
    await expect(page.locator('dialog')).toBeVisible();
  });
}

test('administrator phone header keeps a usable menu without the HAMIYA wordmark', async ({
  page,
}) => {
  await setup(page, { role: 'admin' });
  await page.goto('/app#admin');
  const header = page.locator('.topbar');
  await expect(page.locator('.admin-page')).toBeVisible();
  await expect(header.locator('.mobile-wordmark')).toHaveCount(0);
  await expect(header.getByRole('button', { name: 'HAMIYA', exact: true })).toHaveCount(0);
  await header.locator('[aria-controls="app-drawer"]').click();
  await expect(page.locator('#app-drawer')).toBeVisible();
});
