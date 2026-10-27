import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { zipSync } from 'fflate';
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
writeFileSync(
  join(directory, 'latest.json'),
  JSON.stringify(
    {
      schema: 1,
      appId: 'com.hamiyainvestmentgroup.customer',
      version: `${version}-r${commit.slice(0, 12)}`,
      commit,
      minimumNativeVersion: '1.1.0',
      nativeVersion: version,
      url: `https://hamiyainvestmentgroup.vercel.app/updates/hamiya-${commit}.zip`,
      checksum: createHash('sha256').update(archive).digest('hex'),
      bytes: archive.length,
      releasedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log(`Packaged live update ${commit.slice(0, 7)} (${archive.length} bytes)`);
