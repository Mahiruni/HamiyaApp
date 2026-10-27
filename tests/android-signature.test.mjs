import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifySigningIdentity,
  expectedFingerprint,
} from '../scripts/verify-android-signature.mjs';

test('Android signing verification accepts supported SDK labels and rejects a different identity', () => {
  for (const label of ['Signer #1', 'V2 Signer', 'V3.1 Signer']) {
    assert.equal(
      verifySigningIdentity(`${label}: certificate SHA-256 digest: ${expectedFingerprint}`),
      expectedFingerprint,
    );
  }
  assert.equal(
    verifySigningIdentity(
      `V2 Signer: certificate SHA-256 digest: ${expectedFingerprint.toUpperCase()}`,
    ),
    expectedFingerprint,
  );
  assert.throws(() => verifySigningIdentity('Verifies, without a certificate digest'));
  assert.throws(() =>
    verifySigningIdentity('V2 Signer: certificate SHA-256 digest: ' + 'a'.repeat(64)),
  );
  assert.throws(() =>
    verifySigningIdentity(
      `Signer #1: certificate SHA-256 digest: ${expectedFingerprint}\nSigner #2: certificate SHA-256 digest: ${'a'.repeat(64)}`,
    ),
  );
});
