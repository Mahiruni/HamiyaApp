import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const archive = readFileSync(process.argv[2] || 'release/Hamiya.apk');
const output = process.argv[3] || 'release/android-release.json';
const run = Number(process.env.GITHUB_RUN_NUMBER);
const commit = process.env.GITHUB_SHA;
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
if (!Number.isSafeInteger(run) || run < 1 || !/^[a-f0-9]{40}$/.test(commit || ''))
  throw new Error('An exact GitHub release identity is required');
const tag = `android-build-${run}`;
writeFileSync(
  output,
  JSON.stringify(
    {
      schema: 1,
      appId: 'com.hamiyainvestmentgroup.customer',
      version,
      versionCode: 10000 + run,
      tag,
      commit,
      url: `https://github.com/Mahiruni/HamiyaApp/releases/download/${tag}/Hamiya.apk`,
      checksum: createHash('sha256').update(archive).digest('hex'),
      bytes: archive.length,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Android release metadata prepared for ${tag}`);
