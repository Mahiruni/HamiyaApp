import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

const expected = readFileSync(process.argv[2]);
const checksum = (bytes) => createHash('sha256').update(bytes).digest('hex');
const expectedHash = checksum(expected);
const tag = `android-build-${process.env.GITHUB_RUN_NUMBER}`;
const url = `https://hamiyainvestmentgroup.vercel.app/api/android?release=${tag}`;
for (let attempt = 0; ; attempt++) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(50000) });
    assert.equal(response.status, 200, 'Production APK download must succeed');
    assert.equal(response.headers.get('content-type'), 'application/vnd.android.package-archive');
    assert.match(response.headers.get('content-disposition') || '', /attachment;.*Hamiya\.apk/);
    const archive = Buffer.from(await response.arrayBuffer());
    assert.equal(
      archive.length,
      expected.length,
      'Production download length must match the signed APK',
    );
    assert.equal(
      checksum(archive),
      expectedHash,
      'Production download must be byte-identical to the signed APK',
    );
    console.log(
      `Verified production APK download: ${archive.length} bytes, SHA-256 ${expectedHash}`,
    );
    break;
  } catch (error) {
    if (attempt === 5) throw error;
    console.log(`Waiting for the HAMIYA production download endpoint (attempt ${attempt + 1}/6).`);
    await setTimeout(10000);
  }
}
