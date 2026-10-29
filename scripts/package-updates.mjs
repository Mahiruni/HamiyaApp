import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { zipSync } from 'fflate';
import { releaseSigningPayload } from '../src/update-policy.ts';
import { loadEnv } from 'vite';
const root = resolve('dist');
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const commit =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('A full release commit is required');
const files = {};
const walk = (path) => {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.name === 'updates') continue;
    const full = join(path, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile())
      files[relative(root, full).replaceAll('\\', '/')] = [
        readFileSync(full),
        { mtime: new Date('2026-01-01T00:00:00Z') },
      ];
  }
};
walk(root);
// Public index.html is the marketing site; native web bundles always boot the app.
if (!files['app.html']?.[0].includes('hamiya-startup'))
  throw new Error('Native application entry is missing');
files['index.html'] = files['app.html'];
delete files['app.html'];
// Capacitor serves native assets; a browser service worker must not pin an old live bundle.
files['sw.js'] = [
  Buffer.from(
    "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister()));",
  ),
  { mtime: new Date('2026-01-01T00:00:00Z') },
];
const archive = zipSync(files, { level: 6 });
const directory = join(root, 'updates');
mkdirSync(directory, { recursive: true });
writeFileSync(join(directory, `hamiya-${commit}.zip`), archive);
const release = {
  schema: 1,
  appId: 'com.hamiyainvestmentgroup.customer',
  version: `${version}-r${commit.slice(0, 12)}`,
  commit,
  minimumNativeVersion: '1.2.3',
  nativeVersion: version,
  url: `https://hamiyainvestmentgroup.vercel.app/updates/hamiya-${commit}.zip`,
  checksum: createHash('sha256').update(archive).digest('hex'),
  bytes: archive.length,
  releasedAt: new Date().toISOString(),
};
const privateKey = process.env.HAMIYA_UPDATE_PRIVATE_KEY;
const publicKey = loadEnv('production', process.cwd(), 'VITE_').VITE_HAMIYA_UPDATE_PUBLIC_KEY;
if (privateKey) {
  if (!publicKey) throw new Error('Update verification key must be pinned in the build');
  const signer = createPrivateKey(privateKey.replaceAll('\\n', '\n'));
  if (signer.asymmetricKeyDetails?.namedCurve !== 'prime256v1')
    throw new Error('Update signing requires ECDSA P-256');
  const verifier = createPublicKey({
    key: Buffer.from(publicKey, 'base64'),
    format: 'der',
    type: 'spki',
  });
  const data = Buffer.from(releaseSigningPayload(release));
  const signature = sign('sha256', data, { key: signer, dsaEncoding: 'ieee-p1363' });
  if (!verify('sha256', data, { key: verifier, dsaEncoding: 'ieee-p1363' }, signature))
    throw new Error('Update signing key mismatch');
  release.signature = signature.toString('base64');
} else
  console.log(
    'Live installation disabled: no release signing key configured. Native updates use the existing signed APK.',
  );
writeFileSync(join(directory, 'latest.json'), JSON.stringify(release, null, 2));
console.log(`Packaged release ${commit.slice(0, 7)} (${archive.length} bytes)`);
