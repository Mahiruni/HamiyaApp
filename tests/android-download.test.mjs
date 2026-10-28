import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { androidDownload } from '../server/android-download.mjs';

const archive = Buffer.alloc(5_000_000, 7);
archive.set([0x50, 0x4b, 0x03, 0x04]);
const asset = {
  name: 'Hamiya.apk',
  state: 'uploaded',
  size: archive.length,
  digest: 'sha256:' + createHash('sha256').update(archive).digest('hex'),
  browser_download_url:
    'https://github.com/Mahiruni/HamiyaApp/releases/download/android-build-12/Hamiya.apk',
};
const release = { tag_name: 'android-build-12', assets: [asset] };
function upstream(options = {}) {
  const calls = [];
  return {
    calls,
    fetcher: async (url, init) => {
      calls.push({ url, init });
      if (url.includes('api.github.com'))
        return Response.json({ ...release, ...options.release }, { status: options.status || 200 });
      if (url === asset.browser_download_url)
        return new Response(null, {
          status: 302,
          headers: {
            Location: options.redirect || 'https://release-assets.githubusercontent.com/asset.apk',
          },
        });
      return new Response(options.archive || archive);
    },
  };
}
const request = (method = 'GET') =>
  new Request('https://hamiyainvestmentgroup.vercel.app/api/android', { method });

test('Android download streams the verified APK above 4.5 MB with an attachment filename', async () => {
  const remote = upstream();
  const result = await androidDownload(request(), remote);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('content-type'), 'application/vnd.android.package-archive');
  assert.equal(result.headers.get('content-disposition'), 'attachment; filename="Hamiya.apk"');
  assert.equal(result.headers.get('content-length'), String(archive.length));
  assert.equal(result.headers.get('x-hamiya-release'), 'android-build-12');
  const reader = result.body.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    assert.ok(value.byteLength <= 65536);
    chunks.push(value);
  }
  assert.deepEqual(Buffer.concat(chunks), archive);
  assert.equal(remote.calls.length, 3);
  assert.equal(remote.calls[1].init.redirect, 'manual');
  assert.equal(remote.calls[1].init.credentials, 'omit');
});

test('Android download HEAD checks the release without downloading an APK', async () => {
  const remote = upstream();
  const result = await androidDownload(request('HEAD'), remote);
  assert.equal(result.status, 200);
  assert.equal(result.body, null);
  assert.equal(remote.calls.length, 1);
});

test('Android download refuses changed binaries, untrusted redirects and unpublished releases', async () => {
  for (const patch of [
    { archive: Buffer.from('<html>Not an APK</html>') },
    { archive: Buffer.concat([archive, Buffer.from('extra')]) },
    { archive: Buffer.from(archive).fill(8, 4, 5) },
    { redirect: 'https://evil.test/update.apk' },
    { redirect: 'http://release-assets.githubusercontent.com/update.apk' },
    { redirect: 'https://token@release-assets.githubusercontent.com/update.apk' },
    { status: 403 },
    { release: { draft: true } },
    { release: { prerelease: true } },
    { release: { assets: [] } },
    { release: { assets: [{ ...asset, size: 50_000_001 }] } },
    { release: { assets: [{ ...asset, digest: null }] } },
    { release: { assets: [{ ...asset, browser_download_url: 'https://evil.test/update.apk' }] } },
  ]) {
    const result = await androidDownload(request(), upstream(patch));
    assert.equal(result.status, 503, JSON.stringify(patch).slice(0, 160));
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.ok((await result.text()).includes('retry'));
  }
});

test('Android download handles interrupted requests and unsupported methods', async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await androidDownload(new Request(request(), { signal: controller.signal }), {
    fetcher: (_url, { signal }) => Promise.reject(signal.reason),
  });
  assert.equal(result.status, 503);
  const rejected = await androidDownload(request('POST'));
  assert.equal(rejected.status, 405);
  assert.equal(rejected.headers.get('allow'), 'GET, HEAD');
});
