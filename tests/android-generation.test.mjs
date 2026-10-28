import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('Android generation is repeatable and retains edge-to-edge, system surfaces and Back handling', () => {
  const root = mkdtempSync(join(tmpdir(), 'hamiya-android-'));
  const java = join(root, 'app/src/main/java/com/hamiyainvestmentgroup/customer');
  const res = join(root, 'app/src/main/res/values');
  mkdirSync(java, { recursive: true });
  mkdirSync(res, { recursive: true });
  writeFileSync(
    join(java, 'MainActivity.java'),
    'package com.hamiyainvestmentgroup.customer; public class MainActivity extends BridgeActivity {}',
  );
  writeFileSync(
    join(res, 'styles.xml'),
    '<resources><style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar"></style><style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar"></style><style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen"></style></resources>',
  );
  writeFileSync(
    join(root, 'app/src/main/AndroidManifest.xml'),
    '<manifest><application><activity android:name=".MainActivity" /></application></manifest>',
  );
  writeFileSync(
    join(root, 'app/build.gradle'),
    'android { defaultConfig { versionCode 1; versionName "1.0" } }',
  );
  const run = () =>
    execFileSync(process.execPath, ['scripts/configure-android.mjs', root], { stdio: 'pipe' });
  try {
    run();
    const paths = [
      join(java, 'MainActivity.java'),
      join(java, 'HamiyaSystemUiPlugin.java'),
      join(res, 'styles.xml'),
      join(root, 'app/src/main/AndroidManifest.xml'),
    ];
    const before = paths.map((path) => readFileSync(path, 'utf8'));
    run();
    assert.deepEqual(
      paths.map((path) => readFileSync(path, 'utf8')),
      before,
    );
    assert.match(before[0], /EdgeToEdge.enable\(this\)/);
    assert.match(before[0], /OnBackPressedCallback/);
    assert.match(before[0], /requestApplyInsets/);
    assert.match(before[0], /getSupportActionBar\(\)\.hide\(\)/);
    assert.match(before[0], /getActionBar\(\)\.hide\(\)/);
    assert.ok(
      before[0].indexOf('requestWindowFeature(Window.FEATURE_NO_TITLE)') <
        before[0].indexOf('super.onCreate'),
    );
    assert.ok(
      before[0].indexOf('supportRequestWindowFeature(Window.FEATURE_NO_TITLE)') <
        before[0].indexOf('super.onCreate'),
    );
    assert.ok(
      before[0].indexOf('requestWindowFeature(Window.FEATURE_NO_TITLE)') <
        before[0].indexOf('EdgeToEdge.enable(this)'),
    );
    assert.match(before[2], /name="android:windowNoTitle">true/);
    assert.match(before[2], /name="android:windowActionBar">false/);
    assert.doesNotMatch(before[2], /DarkActionBar/);
    assert.match(before[1], /setAppearanceLightStatusBars/);
    assert.match(before[1], /Type.systemBars\(\)/);
    assert.match(before[3], /adjustResize/);
    assert.match(before[3], /enableOnBackInvokedCallback="true"/);
    assert.match(before[3], /allowBackup="false"/);
    assert.match(before[3], /usesCleartextTraffic="false"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
