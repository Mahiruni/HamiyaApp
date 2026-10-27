import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRelease, updateAction, compareVersions } from '../src/update-policy.ts';
import { appView } from '../src/navigation.ts';
const commit = 'a'.repeat(40);
const valid = {
  schema: 1,
  appId: 'com.hamiyainvestmentgroup.customer',
  version: '1.1.0-raaaaaaaaaaaa',
  commit,
  minimumNativeVersion: '1.1.0',
  nativeVersion: '1.1.0',
  url: `https://hamiyainvestmentgroup.vercel.app/updates/hamiya-${commit}.zip`,
  checksum: 'b'.repeat(64),
  bytes: 1024,
  releasedAt: '2026-10-27T12:00:00Z',
};
test('release validation requires the app identity, a checksum and the trusted HTTPS bundle', () => {
  assert.deepEqual(validateRelease(valid), valid);
  for (const patch of [
    { schema: 2 },
    { appId: 'another.app' },
    { checksum: '' },
    { checksum: 'c'.repeat(40) },
    { bytes: 0 },
    { bytes: 50_000_001 },
    { url: `http://hamiyainvestmentgroup.vercel.app/updates/hamiya-${commit}.zip` },
    { url: 'https://evil.test/update.zip' },
    { url: valid.url + '?redirect=evil' },
    { url: valid.url + '#fragment' },
    { url: valid.url.replace('https://', 'https://user:password@') },
    { version: '1.0.0' },
    { commit: 'not-a-commit' },
    { minimumNativeVersion: 'broken' },
    { minimumNativeVersion: '2.0.0' },
    { releasedAt: 'invalid' },
  ])
    assert.throws(() => validateRelease({ ...valid, ...patch }), JSON.stringify(patch));
});
test('native updates are required before incompatible live updates, while unchanged versions do not reload', () => {
  assert.equal(updateAction(valid, commit, '1.1.0'), 'current');
  assert.equal(updateAction(valid, 'c'.repeat(40), '1.1.0'), 'live');
  assert.equal(updateAction(valid, commit, '1.0.0'), 'apk');
  assert.equal(updateAction(valid, 'c'.repeat(40), null), 'live');
  assert.equal(compareVersions('1.10.0', '1.2.9'), 1);
  assert.equal(compareVersions('2.0.0', '1.99.99'), 1);
});
test('app settings and updates remain accessible before sign-in and during onboarding', () => {
  const state = { authLoading: false, signedIn: false, recovery: false, route: 'settings' };
  assert.equal(appView(state), 'information');
  assert.equal(appView({ ...state, signedIn: true, needsProfile: true }), 'information');
  assert.equal(appView({ ...state, signedIn: true }), 'dashboard');
  assert.equal(appView({ ...state, route: 'orders' }), 'auth');
});
