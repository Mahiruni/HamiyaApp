import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

test('Android branding requires a generated project and preserves unrelated native resources', async () => {
  const tempBase = resolve(tmpdir());
  const root = await mkdtemp(join(tempBase, 'hamiya-branding-'));
  try {
    await mkdir(join(root, 'scripts'));
    await cp(
      new URL('../scripts/apply-android-branding.mjs', import.meta.url),
      join(root, 'scripts/apply-android-branding.mjs'),
    );
    await cp(new URL('../resources/android/', import.meta.url), join(root, 'resources/android'), {
      recursive: true,
    });
    const run = () =>
      execFileSync(process.execPath, ['scripts/apply-android-branding.mjs'], {
        cwd: root,
        encoding: 'utf8',
        stdio: 'pipe',
      });
    assert.throws(run, /Generate the Android project/);
    const main = join(root, 'android/app/src/main');
    await mkdir(join(main, 'res/values'), { recursive: true });
    await writeFile(join(main, 'AndroidManifest.xml'), '<manifest/>');
    await writeFile(join(main, 'res/values/strings.xml'), '<resources/>');
    assert.match(run(), /launcher icons applied/);
    assert.equal(await readFile(join(main, 'res/values/strings.xml'), 'utf8'), '<resources/>');
    const themed = await readFile(join(main, 'res/mipmap-anydpi-v33/ic_launcher.xml'), 'utf8');
    assert.match(themed, /@drawable\/hamiya_launcher_monochrome/);
    for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
      for (const icon of ['ic_launcher', 'ic_launcher_round']) {
        const png = await readFile(join(main, `res/mipmap-${density}/${icon}.png`));
        assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      }
    }
  } finally {
    assert.equal(dirname(root), tempBase);
    assert(basename(root).startsWith('hamiya-branding-'));
    await rm(root, { recursive: true, force: true });
  }
});
