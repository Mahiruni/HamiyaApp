import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const expectedFingerprint =
  '7fcd1f1b41d9286ae9f8cfe3e0eeeec6da6237f1a805d70efc4700d8a30f253c';

export function verifySigningIdentity(output) {
  // SDK releases label this field as "Signer #1" or "V2 Signer".
  // Compare the certificate data independently of that display label.
  const fingerprints = new Set(
    Array.from(output.matchAll(/certificate SHA-256 digest:\s*([a-f0-9]{64})/gi), (match) =>
      match[1].toLowerCase(),
    ),
  );
  if (fingerprints.size !== 1 || !fingerprints.has(expectedFingerprint)) {
    throw new Error('Signing certificate does not match the existing Hamiya Android release.');
  }
  return expectedFingerprint;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifySigningIdentity(readFileSync(process.argv[2], 'utf8'));
  console.log('Signing certificate matches the existing Hamiya app.');
}
