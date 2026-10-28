import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
import { validFoodQuantity, purchasable } from '../src/quantity.ts';
import { nearestSheetSnap, usableSheetHeight } from '../src/sheet-geometry.ts';
import { withTimeout } from '../src/async.ts';
import { verifyReleaseSignature } from '../src/update-signature.ts';
import { releaseSigningPayload } from '../src/update-policy.ts';
import { productionCopy } from '../src/production-translations.ts';
import { hasTranslation } from '../src/i18n.ts';

test('food quantities enforce the 20-carton minimum, safe integers and actual stock', () => {
  for (const value of ['20', '200', '2000']) assert.ok(validFoodQuantity(value, 2000));
  for (const value of ['', '0', '19', '20.5', '-20', '1e3', '2001', '9007199254740993'])
    assert.equal(validFoodQuantity(value, 2000), false, value);
  assert.equal(validFoodQuantity('20', 19), false);
  const product = {
    category: 'food',
    published: true,
    confirmed: true,
    price_cents: 71500,
    sales_unit: 'carton',
    available_quantity: 200,
    status: 'available',
  };
  assert.ok(purchasable(product));
  for (const patch of [
    { published: false },
    { confirmed: false },
    { price_cents: null },
    { price_cents: 0 },
    { sales_unit: '' },
    { available_quantity: 19 },
    { status: 'out_of_stock' },
  ])
    assert.equal(purchasable({ ...product, ...patch }), false, JSON.stringify(patch));
});
test('sheet geometry reserves real system insets and dock space on phones and tablets', () => {
  for (const [viewport, top, bottom] of [
    [640, 24, 92],
    [844, 48, 110],
    [1280, 34, 98],
    [400, 0, 80],
  ]) {
    const usable = usableSheetHeight(viewport, top, bottom);
    assert.equal(usable, viewport - top - bottom - 12);
    assert.ok(viewport - bottom - usable * 0.75 > top);
    assert.equal(nearestSheetSnap(usable * 0.6, usable), 60);
    assert.equal(nearestSheetSnap(usable, usable), 75);
    assert.equal(nearestSheetSnap(0, usable), 45);
  }
  assert.equal(usableSheetHeight(20, 30, 40), 0);
});
test('startup work times out and preserves successful values and original failures', async () => {
  assert.equal(await withTimeout(Promise.resolve('ready'), 50), 'ready');
  await assert.rejects(withTimeout(new Promise(() => {}), 5), /timed out/);
  await assert.rejects(withTimeout(Promise.reject(new Error('offline')), 50), /offline/);
});
test('release signatures reject unsigned manifests, tampered content, and a different signing key', async () => {
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKey = keys.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  const release = {
    schema: 1,
    appId: 'com.hamiyainvestmentgroup.customer',
    version: '1.2.0-test',
    commit: 'a'.repeat(40),
    nativeVersion: '1.2.0',
    minimumNativeVersion: '1.2.0',
    url: 'https://hamiyainvestmentgroup.vercel.app/updates/test.zip',
    checksum: 'b'.repeat(64),
    bytes: 1024,
    releasedAt: '2026-10-28T00:00:00Z',
  };
  assert.equal(await verifyReleaseSignature(release, publicKey), false);
  release.signature = sign('sha256', Buffer.from(releaseSigningPayload(release)), {
    key: keys.privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64');
  assert.equal(await verifyReleaseSignature(release, publicKey), true);
  assert.equal(
    await verifyReleaseSignature({ ...release, checksum: 'c'.repeat(64) }, publicKey),
    false,
  );
  assert.equal(await verifyReleaseSignature(release, ''), false);
  const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  assert.equal(
    await verifyReleaseSignature(
      release,
      other.publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    ),
    false,
  );
});
test('every production label exists in English, Amharic, and Afaan Oromo', () => {
  for (const language of ['en', 'am', 'om'])
    for (const key of Object.keys(productionCopy.en))
      assert.ok(hasTranslation(language, key), language + ':' + key);
});
