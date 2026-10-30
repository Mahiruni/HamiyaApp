import test from 'node:test';
import assert from 'node:assert/strict';
import { appView, authMode, authRoutes, afterSignIn } from '../src/navigation.ts';

test('unauthenticated customer sees welcome/auth entry, not dashboard', () => {
  for (const route of ['home', 'welcome', 'signin', 'register', 'forgot']) {
    assert.equal(appView({ authLoading: false, signedIn: false, recovery: false, route }), 'auth');
  }
});

test('session restoration retains splash until resolved', () => {
  assert.equal(appView({ authLoading: true, signedIn: false, recovery: false, route: 'home' }), 'loading');
  assert.equal(appView({ authLoading: false, signedIn: true, recovery: false, route: 'home' }), 'dashboard');
});

test('onboarding and password recovery stay separate from dashboard', () => {
  assert.equal(appView({ authLoading: false, signedIn: true, recovery: false, route: 'home', needsProfile: true }), 'onboarding');
  assert.equal(appView({ authLoading: false, signedIn: true, recovery: true, route: 'account' }), 'auth');
});

test('login, registration and password recovery modes remain routable', () => {
  for (const mode of ['login', 'register', 'forgot']) {
    assert.equal(authMode(authRoutes[mode]), mode);
  }
  assert.equal(authMode('welcome'), 'login');
  assert.equal(afterSignIn('draft'), 'account');
  assert.equal(afterSignIn('approved'), 'home');
});
