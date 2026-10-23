import assert from 'node:assert/strict';
import test from 'node:test';
import { appView, authMode, afterSignIn } from '../src/navigation.ts';

const guest = { authLoading: false, signedIn: false, recovery: false, route: 'home' };

test('opening the app and guest deep links always show standalone authentication', () => {
  for (const route of [
    'home',
    'account',
    'catalog/food',
    'orders',
    'admin',
    'signin',
    'register',
    'forgot',
  ]) {
    assert.equal(appView({ ...guest, route }), 'auth', route);
  }
  assert.equal(authMode('home'), 'login');
  assert.equal(authMode('register'), 'register');
  assert.equal(authMode('forgot'), 'forgot');
});

test('session restoration renders a neutral loading view before choosing a layout', () => {
  assert.equal(appView({ ...guest, authLoading: true }), 'loading');
  assert.equal(appView({ ...guest, authLoading: true, signedIn: true }), 'loading');
  assert.equal(appView({ ...guest, signedIn: true }), 'dashboard');
});

test('new customer profiles precede the dashboard, while submitted profiles can enter it', () => {
  assert.equal(afterSignIn('draft'), 'account');
  assert.equal(
    appView({ ...guest, signedIn: true, needsProfile: true, route: 'home' }),
    'onboarding',
  );
  assert.equal(
    appView({ ...guest, signedIn: true, needsProfile: true, route: 'orders' }),
    'onboarding',
  );
  for (const verification of ['pending', 'approved', 'rejected']) {
    assert.equal(afterSignIn(verification), 'home');
    assert.equal(appView({ ...guest, signedIn: true, needsProfile: false }), 'dashboard');
  }
});

test('password recovery stays outside the dashboard even with a restored session', () => {
  assert.equal(appView({ ...guest, signedIn: true, recovery: true, route: 'account' }), 'auth');
  assert.equal(
    appView({ ...guest, signedIn: true, recovery: false, route: 'account' }),
    'dashboard',
  );
});

test('privacy, terms and help remain available without exposing dashboard navigation', () => {
  for (const route of ['privacy', 'terms', 'help']) {
    assert.equal(appView({ ...guest, route }), 'information');
    assert.equal(appView({ ...guest, signedIn: true, recovery: true, route }), 'information');
    assert.equal(appView({ ...guest, signedIn: true, needsProfile: true, route }), 'information');
  }
});

test('sign-out removes access to every dashboard route', () => {
  for (const route of ['home', 'orders', 'account', 'admin']) {
    const current = { ...guest, route, signedIn: true };
    assert.equal(appView(current), 'dashboard');
    assert.equal(appView({ ...current, signedIn: false }), 'auth');
  }
});
