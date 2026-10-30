import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('native Android generator produces a white HAMIYA splash with dark status icons', () => {
  const source = readFileSync(new URL('../scripts/configure-android.mjs', import.meta.url), 'utf8');
  assert.match(source, /hamiya_surface">#ffffff/);
  assert.match(source, /android:windowLightStatusBar">true/);
  assert.match(source, /android:windowLightNavigationBar">true/);
  assert.match(source, /private static boolean darkSurface = false/);
  assert.match(source, /windowSplashScreenAnimatedIcon/);
  assert.match(source, /@drawable\/hamiya_logo/);
});

test('pre-React startup and installed PWA use matching white surfaces', () => {
  const html = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../public/startup.css', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.match(html, /name="theme-color" content="#ffffff"/);
  assert.match(html, /class="startup-splash"/);
  assert.match(css, /background: #fff/);
  assert.equal(manifest.background_color, '#ffffff');
  assert.equal(manifest.theme_color, '#ffffff');
});
