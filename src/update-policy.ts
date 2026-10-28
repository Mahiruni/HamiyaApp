export const updateOrigin = 'https://hamiyainvestmentgroup.vercel.app';
export const apkDownloadUrl =
  'https://github.com/Mahiruni/HamiyaApp/releases/latest/download/Hamiya.apk';
export const updateAppId = 'com.hamiyainvestmentgroup.customer';
export interface AppRelease {
  schema: 1;
  signature?: string;
  appId: string;
  version: string;
  commit: string;
  minimumNativeVersion: string;
  nativeVersion: string;
  url: string;
  checksum: string;
  bytes: number;
  releasedAt: string;
}
export function compareVersions(left: string, right: string) {
  const parse = (value: string) => {
    if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error('Invalid native version');
    return value.split('.').map(Number);
  };
  const a = parse(left),
    b = parse(right);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}
export function validateRelease(input: unknown): AppRelease {
  if (!input || typeof input !== 'object') throw new Error('Invalid release');
  const value = input as AppRelease;
  if (
    value.schema !== 1 ||
    (value.signature !== undefined && !/^[A-Za-z0-9+/]{86}==$/.test(value.signature)) ||
    value.appId !== updateAppId ||
    !/^[a-f0-9]{40}$/.test(value.commit) ||
    !/^[a-f0-9]{64}$/.test(value.checksum) ||
    value.version !== `${value.nativeVersion}-r${value.commit.slice(0, 12)}` ||
    !Number.isSafeInteger(value.bytes) ||
    value.bytes <= 0 ||
    value.bytes > 50_000_000 ||
    !Number.isFinite(Date.parse(value.releasedAt))
  )
    throw new Error('Invalid release');
  if (compareVersions(value.nativeVersion, value.minimumNativeVersion) < 0)
    throw new Error('Incompatible release metadata');
  const url = new URL(value.url);
  if (
    url.origin !== updateOrigin ||
    url.pathname !== `/updates/hamiya-${value.commit}.zip` ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error('Untrusted update URL');
  return value;
}
export function updateAction(
  release: AppRelease,
  currentCommit: string,
  nativeVersion: string | null,
) {
  if (nativeVersion !== null && compareVersions(nativeVersion, release.minimumNativeVersion) < 0)
    return 'apk';
  return release.commit === currentCommit ? 'current' : 'live';
}

export function releaseSigningPayload(value: AppRelease) {
  return JSON.stringify([
    value.schema,
    value.appId,
    value.version,
    value.commit,
    value.minimumNativeVersion,
    value.nativeVersion,
    value.url,
    value.checksum,
    value.bytes,
    value.releasedAt,
  ]);
}
