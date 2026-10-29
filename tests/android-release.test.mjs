import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('Android release metadata binds the APK bytes to the exact version, repository and commit', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hamiya-release-'));
  try {
    const apk = join(directory, 'fixture.apk'),
      metadata = join(directory, 'android-release.json');
    const bytes = Buffer.from('APK fixture, not a production package');
    writeFileSync(apk, bytes);
    const run = (commit) =>
      execFileSync(process.execPath, ['scripts/package-android-release.mjs', apk, metadata], {
        env: { ...process.env, GITHUB_RUN_NUMBER: '20', GITHUB_SHA: commit },
        stdio: 'pipe',
      });
    run('a'.repeat(40));
    const release = JSON.parse(readFileSync(metadata));
    assert.equal(release.commit, 'a'.repeat(40));
    assert.equal(release.appId, 'com.hamiyainvestmentgroup.customer');
    assert.equal(release.versionCode, 10020);
    assert.equal(release.bytes, bytes.length);
    assert.equal(release.checksum, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(
      release.url,
      'https://github.com/Mahiruni/HamiyaApp/releases/download/android-build-20/Hamiya.apk',
    );
    assert.throws(() => run('main'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
