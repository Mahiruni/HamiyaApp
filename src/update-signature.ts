import { releaseSigningPayload, type AppRelease } from './update-policy.ts';

function decode(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
// The SPKI key is pinned by the installed app. A checksum alone is not a signature.
export async function verifyReleaseSignature(release: AppRelease, publicKey: string) {
  if (!publicKey || !release.signature) return false;
  try {
    const key = await crypto.subtle.importKey(
      'spki',
      decode(publicKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      decode(release.signature),
      new TextEncoder().encode(releaseSigningPayload(release)),
    );
  } catch {
    return false;
  }
}
