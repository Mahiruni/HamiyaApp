import { test, expect } from '@playwright/test';

for (const width of [320, 390, 768, 1280])
  test(`HAMIYA website presents all divisions and Android download at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/marketing.html');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Food. Coffee.');
    await expect(page.locator('.site-division')).toHaveCount(3);
    const downloads = page.locator('a.site-button');
    await expect(downloads).toHaveCount(2);
    for (const link of await downloads.all())
      await expect(link).toHaveAttribute(
        'href',
        'https://github.com/Mahiruni/HamiyaApp/releases/latest/download/Hamiya.apk',
      );
    await expect
      .poll(() =>
        page
          .locator('.site-hero-images img')
          .evaluateAll((images) =>
            images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
          ),
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 390 || width === 1280)
      await page.screenshot({
        path: `test-results/hamiya-website-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
  });

test('website download yields the APK and language carries into the customer portal', async ({
  page,
}) => {
  await page.route(
    'https://github.com/Mahiruni/HamiyaApp/releases/latest/download/Hamiya.apk',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/vnd.android.package-archive',
        headers: { 'Content-Disposition': 'attachment; filename="Hamiya.apk"' },
        body: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      }),
  );
  await page.goto('/marketing.html');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download for Android', exact: true }).first().click();
  expect((await downloaded).suggestedFilename()).toBe('Hamiya.apk');
  for (const language of ['am', 'om']) {
    await page.locator('.site-language select').selectOption(language);
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await page.reload();
    await expect(page.locator('.site-language select')).toHaveValue(language);
  }
  await page.goto('/app#settings');
  await expect(page.locator('html')).toHaveAttribute('lang', 'om');
});

test('existing customer deep links are preserved by the marketing entry', async ({ page }) => {
  await page.goto('/marketing.html#catalog/coffee');
  await expect(page).toHaveURL(/\/app#catalog\/coffee$/);
  await expect(page.locator('.account-auth')).toBeVisible();
});
