import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
import { validFoodQuantity, purchasable, stepFoodQuantity } from '../src/quantity.ts';
import {
  nearestSheetSnap,
  usableSheetHeight,
  sheetViewportGeometry,
} from '../src/sheet-geometry.ts';
import { availableForCustomer, foodAvailability, matchesProduct } from '../src/catalog.ts';
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
test('sheet remains above a keyboard when the layout viewport does not resize or is panned', () => {
  for (const visualTop of [0, 80]) {
    const geometry = sheetViewportGeometry({
      layoutHeight: 844,
      visualHeight: 360,
      visualTop,
      safeTop: 44,
    });
    const bottom = 844 - geometry.bottom;
    assert.ok(bottom <= visualTop + 360 - 12);
    assert.ok(bottom - geometry.usable * 0.75 >= Math.max(44, visualTop));
    assert.ok(geometry.bottom > 400 - visualTop);
  }
  const docked = sheetViewportGeometry({
    layoutHeight: 844,
    visualHeight: 844,
    safeTop: 44,
    safeBottom: 24,
    dockTop: 744,
  });
  assert.equal(docked.bottom, 112);
  assert.equal(docked.usable, 676);
});
test('quantity stepping recovers from empty input and respects the stock and transaction maximum', () => {
  assert.equal(stepFoodQuantity('', 1, 200), 21);
  assert.equal(stepFoodQuantity('20', -1, 200), 20);
  assert.equal(stepFoodQuantity('200', 1, 200), 200);
  assert.equal(stepFoodQuantity('10000', 1, 12000), 10000);
  assert.equal(stepFoodQuantity('200', -1, 19), 20);
  assert.equal(stepFoodQuantity('1e3', 1, 200), 21);
});
test('stock and search use actual records and all translated product names and variants', () => {
  const product = {
    category: 'food',
    published: true,
    confirmed: true,
    status: 'available',
    stock: 25,
    reserved: 10,
    available_quantity: 15,
    sales_unit: 'carton',
    price_cents: 71500,
    name: 'Banana',
    variant: 'Hard',
    translations: { am: { name: 'ሙዝ' }, om: { name: 'Muuzii' } },
  };
  assert.equal(foodAvailability(product), 'low_stock');
  assert.equal(availableForCustomer(product), false);
  assert.equal(foodAvailability({ ...product, reserved: 25 }), 'out_of_stock');
  assert.equal(foodAvailability({ ...product, status: 'coming_soon' }), 'coming_soon');
  assert.equal(
    foodAvailability({ ...product, status: 'out_of_stock', stock: 200 }),
    'out_of_stock',
  );
  for (const query of [' banana ', 'ሙዝ', 'MUUZII', 'ጠንካራ'])
    assert.ok(
      matchesProduct(product, query, (key) => (key === 'variantHard' ? 'ጠንካራ' : key)),
      query,
    );
  assert.equal(
    matchesProduct(product, 'not in catalog', (key) => key),
    false,
  );
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
