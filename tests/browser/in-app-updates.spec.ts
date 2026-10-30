import { test, expect, type Page } from '@playwright/test';
import { setup } from './fixtures';

async function nativeUpdater(page: Page, checkFails = false) {
  await setup(page, { signedIn: false });
  await page.addInitScript(
    ({ checkFails }) => {
      const host = window as unknown as {
        androidBridge: unknown;
        Capacitor: unknown;
        updateCalls: string[];
        emitUpdate: (event: unknown) => void;
        finishUpdate: (code?: string) => void;
        failUpdateCheck: boolean;
      };
      host.updateCalls = [];
      host.failUpdateCheck = checkFails;
      host.androidBridge = { postMessage() {} };
      host.Capacitor = {
        PluginHeaders: [
          {
            name: 'HamiyaAppUpdate',
            methods: [
              { name: 'check', rtype: 'promise' },
              { name: 'install', rtype: 'promise' },
              { name: 'cancel', rtype: 'promise' },
              { name: 'addListener', rtype: 'callback' },
              { name: 'removeListener', rtype: 'promise' },
            ],
          },
        ],
        nativeCallback: (
          _plugin: string,
          method: string,
          _options: unknown,
          callback: (event: unknown) => void,
        ) => {
          if (method === 'addListener') host.emitUpdate = callback;
          return 'test-listener';
        },
        nativePromise: async (_plugin: string, method: string) => {
          host.updateCalls.push(method);
          if (method === 'check') {
            if (host.failUpdateCheck) throw { code: 'UPDATE_CHECK_FAILED' };
            return {
              installedVersion: '1.2.4',
              installedVersionCode: 10019,
              latestVersion: '1.2.5',
              latestVersionCode: 10020,
              available: true,
              bytes: 10000000,
              releasedAt: '2026-10-29T00:00:00Z',
            };
          }
          if (method === 'install')
            return new Promise((resolve, reject) => {
              host.finishUpdate = (code) =>
                code ? reject({ code }) : resolve({ installed: true });
            });
          if (method === 'cancel') host.finishUpdate('UPDATE_CANCELLED');
          return {};
        },
      };
    },
    { checkFails },
  );
}

test('Android updates download, verify and reach system approval without navigation or duplicate installs', async ({
  page,
}) => {
  await nativeUpdater(page);
  const external: string[] = [];
  page.on('popup', (popup) => external.push(popup.url()));
  page.on('download', () => external.push('download'));
  const updateRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/updates/') || request.url().includes('/api/android'))
      updateRequests.push(request.url());
  });
  await page.goto('/app#settings');
  const button = page.locator('[aria-labelledby="android-updates-title"]').getByRole('button', { name: 'Update app', exact: true });
  await expect(button).toBeVisible();
  await expect(page.getByRole('link', { name: 'HAMIYA website', exact: true })).toHaveCount(0);
  const address = page.url();
  await button.dblclick();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { updateCalls: string[] }).updateCalls.filter(
            (method) => method === 'install',
          ).length,
      ),
    )
    .toBe(1);
  await page.evaluate(() =>
    (window as unknown as { emitUpdate(event: unknown): void }).emitUpdate({
      percent: 46,
      bytes: 4600000,
      total: 10000000,
      phase: 'downloading',
    }),
  );
  await expect(page.locator('progress')).toHaveAttribute('value', '46');
  await page.evaluate(() =>
    (window as unknown as { emitUpdate(event: unknown): void }).emitUpdate({
      percent: 100,
      bytes: 10000000,
      total: 10000000,
      phase: 'verifying',
    }),
  );
  await expect(
    page.getByRole('heading', { name: 'Verifying your update…', exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { emitUpdate(event: unknown): void }).emitUpdate({
      percent: 100,
      bytes: 10000000,
      total: 10000000,
      phase: 'installing',
    }),
  );
  await expect(
    page.getByRole('heading', { name: 'Approve the Android update', exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { finishUpdate(code: string): void }).finishUpdate('INSTALL_CANCELLED'),
  );
  await expect(button).toBeEnabled();
  await expect(page.locator('[aria-labelledby="android-updates-title"] .update-footnote')).toContainText([
    'Update cancelled',
    'Your account',
  ]);
  expect(page.url()).toBe(address);
  expect(external).toEqual([]);
  expect(updateRequests).toEqual([]);
});

test('update checks recover and Android permission denial offers a retry inside Settings', async ({
  page,
}) => {
  await nativeUpdater(page, true);
  await page.goto('/app#settings');
  await expect(
    page.locator('[aria-labelledby="android-updates-title"]').getByRole('heading', { name: 'Could not check for updates', exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { failUpdateCheck: boolean }).failUpdateCheck = false;
  });
  await page.locator('[aria-labelledby="android-updates-title"]').getByRole('button', { name: 'Check for updates', exact: true }).click();
  const update = page.locator('[aria-labelledby="android-updates-title"]').getByRole('button', { name: 'Update app', exact: true });
  await expect(update).toBeEnabled();
  await update.click();
  await page.evaluate(() =>
    (window as unknown as { finishUpdate(code: string): void }).finishUpdate(
      'INSTALL_PERMISSION_REQUIRED',
    ),
  );
  await expect(page.locator('[aria-labelledby="android-updates-title"] .update-status')).toContainText('Android needs your permission');
  await expect(update).toBeEnabled();
});

for (const language of ['am', 'om'])
  test(`in-app update actions translate and fit at 320px in ${language}`, async ({ page }) => {
    await nativeUpdater(page);
    await page.addInitScript(
      (language) => localStorage.setItem('hamiya-language', JSON.stringify(language)),
      language,
    );
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('/app#settings');
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.locator('[aria-labelledby="android-updates-title"] .update-actions button')).toHaveCount(2);
    await expect(
      page.locator('[aria-labelledby="android-updates-title"]').getByRole('button', {
        name: language === 'am' ? 'መተግበሪያውን አዘምን' : 'Appii haaromsi',
        exact: true,
      }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
