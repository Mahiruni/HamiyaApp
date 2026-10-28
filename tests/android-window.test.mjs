import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('Android window gate reads current and legacy InsetsSource dumps and rejects real overlaps', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hamiya-window-'));
  const xml = (top = 160) =>
    `<hierarchy><node class="android.webkit.WebView"/><node package="com.hamiyainvestmentgroup.customer" class="android.widget.EditText" bounds="[63,${top}][1017,290]"/></hierarchy>`;
  const run = (dump, markup = xml(), stage = 'portrait-no') => {
    writeFileSync(join(directory, `window-${stage}.xml`), markup);
    writeFileSync(join(directory, `insets-${stage}.txt`), dump);
    return spawnSync('python3', ['scripts/verify-android-window.py', stage, directory], {
      encoding: 'utf8',
    });
  };
  // Current form captured from the signed release on the Android 15 emulator.
  const current =
    'InsetsSource id=92ba0000 type=statusBars frame=[0,0][1080,136] visible=true flags= sideHint=TOP boundingRects=null';
  const legacy = 'InsetsSource: {92ba0000 mType=statusBars mFrame=[0,0][1080,136] mVisible=true}';
  try {
    assert.equal(run(current).status, 0);
    assert.equal(run(legacy).status, 0);
    assert.match(
      run(current.replace('visible=true', 'visible=false')).stderr,
      /status bar is not reported visible/,
    );
    assert.match(run(current, xml(40)).stderr, /overlaps Android status bar/);
    assert.match(run(current, xml(), 'keyboard-no').stderr, /Keyboard did not open/);
    assert.equal(
      run(
        current + '\nInsetsSource id=3 type=ime frame=[0,1400][1080,2400] visible=true',
        xml(),
        'keyboard-no',
      ).status,
      0,
    );
    assert.match(
      run(
        current,
        xml().replace('<hierarchy>', '<hierarchy><node resource-id="android:id/action_bar"/>'),
      ).stderr,
      /Native action bar/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('resume gate reads global window focus and fails closed for a different foreground app', () => {
  const script = readFileSync('scripts/check-installed-android-window.sh', 'utf8');
  const implementation = script.match(/wait_for_focus\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(implementation);
  const driver = `set -euo pipefail
adb() {
  if [[ "$*" == 'shell dumpsys window' ]]; then
    printf '%s\\n' "$HAMIYA_TEST_WINDOW_DUMP"
  else
    return 3
  fi
}
sleep() { :; }
${implementation}
wait_for_focus "$1"`;
  // Global focus format captured from the Android 16 resume failure. The
  // narrower "dumpsys window windows" section contains no mCurrentFocus.
  const captured =
    '  mCurrentFocus=Window{ec6c4f u0 com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity}';
  const run = (packageName, dump) =>
    spawnSync('bash', ['-c', driver, 'hamiya-focus-test', packageName], {
      encoding: 'utf8',
      env: { ...process.env, HAMIYA_TEST_WINDOW_DUMP: dump },
    });
  assert.equal(run('com.google.android.apps.nexuslauncher', captured).status, 0);
  assert.equal(run('com.hamiyainvestmentgroup.customer', captured).status, 1);
  assert.equal(run('com.hamiyainvestmentgroup.customer', 'mCurrentFocus=null').status, 1);
  assert.equal(
    run(
      'com.hamiyainvestmentgroup.customer',
      'mCurrentFocus=Window{a u0 com.hamiyainvestmentgroup.customer/com.hamiyainvestmentgroup.customer.MainActivity}',
    ).status,
    0,
  );
});
