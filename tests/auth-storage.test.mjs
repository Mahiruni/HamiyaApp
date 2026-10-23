import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthStorage } from '../src/auth-storage.ts';

function store() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}
const key = 'sb-test-auth-token';

test('remembered sessions and existing Supabase sessions survive a new tab', () => {
  const local = store();
  local.setItem(key, 'existing');
  const auth = createAuthStorage(local, store());
  assert.equal(auth.getItem(key), 'existing');
  auth.setItem(key, 'refreshed');
  assert.equal(createAuthStorage(local, store()).getItem(key), 'refreshed');
});

test('unremembered sessions survive reloads in the same tab without leaving a persistent copy', () => {
  const local = store(),
    session = store();
  local.setItem(key, 'old-session');
  const auth = createAuthStorage(local, session);
  auth.setRemember(false);
  auth.setItem(key, 'tab-session');
  const reloaded = createAuthStorage(local, session);
  assert.equal(reloaded.remembers(), false);
  assert.equal(reloaded.getItem(key), 'tab-session');
  assert.equal(local.getItem(key), null);
  assert.equal(createAuthStorage(local, store()).getItem(key), null);
});

test('changing persistence replaces the old copy and sign-out removes both stores', () => {
  const local = store(),
    session = store();
  const auth = createAuthStorage(local, session);
  auth.setRemember(false);
  auth.setItem(key, 'first');
  auth.setRemember(true);
  auth.setItem(key, 'second');
  assert.equal(session.getItem(key), null);
  assert.equal(local.getItem(key), 'second');
  // Also clear any stale value from another tab.
  session.setItem(key, 'stale');
  auth.removeItem(key);
  assert.equal(local.getItem(key), null);
  assert.equal(session.getItem(key), null);
  assert.equal(auth.getItem(key), null);
});

test('disabled browser storage supports an in-memory session without crashing', () => {
  const blocked = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
    removeItem() {
      throw new Error('blocked');
    },
  };
  const auth = createAuthStorage(blocked, blocked);
  auth.setRemember(false);
  auth.setItem(key, 'temporary');
  assert.equal(auth.getItem(key), 'temporary');
  auth.removeItem(key);
  assert.equal(auth.getItem(key), null);
});
