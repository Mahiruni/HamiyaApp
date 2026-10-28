import { createHash } from 'node:crypto';

const repository = 'https://github.com/Mahiruni/HamiyaApp';
const latest = 'https://api.github.com/repos/Mahiruni/HamiyaApp/releases/latest';
const maximumBytes = 50_000_000;
const failureCopy = {
  en: 'The Android download is temporarily unavailable. Please retry from Hamiya Settings.',
  am: 'የአንድሮይድ ማውረጃ ለጊዜው አይገኝም። ከሐሚያ ቅንብሮች እንደገና ይሞክሩ።',
  om: 'Buufamni Android yeroo muraasaaf hin argamu. Qindaaʼina Hamiya keessaa irra deebiʼii yaali.',
};

async function readLimited(response, limit) {
  if (!response.body || Number(response.headers.get('content-length')) > limit)
    throw new Error('invalid_length');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw new Error('invalid_length');
      chunks.push(value);
    }
    return Buffer.concat(chunks, bytes);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function releaseAsset(fetcher, signal) {
  const response = await fetcher(latest, {
    signal,
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Hamiya-Android-Download' },
    redirect: 'error',
  });
  if (!response.ok) throw new Error('release_unavailable');
  const release = JSON.parse((await readLimited(response, 1_000_000)).toString('utf8'));
  const asset = release.assets?.find((item) => item.name === 'Hamiya.apk');
  if (
    release.draft ||
    release.prerelease ||
    !/^android-build-\d+$/.test(release.tag_name) ||
    !asset ||
    asset.state !== 'uploaded' ||
    !Number.isSafeInteger(asset.size) ||
    asset.size < 4 ||
    asset.size > maximumBytes ||
    !/^sha256:[a-f0-9]{64}$/.test(asset.digest) ||
    asset.browser_download_url !== `${repository}/releases/download/${release.tag_name}/Hamiya.apk`
  )
    throw new Error('invalid_release');
  return { ...asset, tag: release.tag_name };
}

async function fetchArchive(asset, fetcher, signal) {
  let url = asset.browser_download_url;
  for (let redirects = 0; redirects < 4; redirects++) {
    const response = await fetcher(url, { signal, redirect: 'manual', credentials: 'omit' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('invalid_redirect');
      const target = new URL(location, url);
      if (
        target.protocol !== 'https:' ||
        target.username ||
        target.password ||
        target.port ||
        !['release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(
          target.hostname,
        )
      )
        throw new Error('invalid_redirect');
      url = target.href;
      continue;
    }
    if (!response.ok) throw new Error('archive_unavailable');
    const archive = await readLimited(response, asset.size);
    if (
      archive.length !== asset.size ||
      !archive.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
      `sha256:${createHash('sha256').update(archive).digest('hex')}` !== asset.digest
    )
      throw new Error('archive_verification_failed');
    return archive;
  }
  throw new Error('too_many_redirects');
}

// Web-standard streaming keeps the APK above Vercel's buffered-response size limit.
// No customer session, GitHub token, arbitrary URL or caller-supplied file is used.
export async function androidDownload(request, { fetcher = fetch, timeout = 50_000 } = {}) {
  if (!['GET', 'HEAD'].includes(request.method))
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  const language = new URL(request.url).searchParams.get('lang') || 'en';
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(timeout)]);
  try {
    const asset = await releaseAsset(fetcher, signal);
    const headers = {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="Hamiya.apk"',
      'Content-Length': String(asset.size),
      'X-Content-Type-Options': 'nosniff',
      'X-Hamiya-Release': asset.tag,
      ETag: `"${asset.digest}"`,
      'Cache-Control': 'public, max-age=0, s-maxage=300',
      'Access-Control-Allow-Origin': '*',
    };
    if (request.method === 'HEAD') return new Response(null, { headers });
    const archive = await fetchArchive(asset, fetcher, signal);
    let offset = 0;
    const body = new ReadableStream({
      pull(controller) {
        if (offset === archive.length) return controller.close();
        const end = Math.min(offset + 64 * 1024, archive.length);
        controller.enqueue(archive.subarray(offset, end));
        offset = end;
      },
    });
    return new Response(body, { headers });
  } catch (error) {
    // Log only a controlled error code, never signed redirect URLs or credentials.
    console.error(
      'Hamiya Android download unavailable:',
      error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : 'request_failed',
    );
    return new Response(failureCopy[language] || failureCopy.en, {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Retry-After': '30',
      },
    });
  }
}
