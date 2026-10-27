import assert from 'node:assert/strict';
import test from 'node:test';
import { navigateHistory, registerOverlay } from '../src/overlay-history.ts';

function browser() {
  let index = 0;
  const entries = [{ state: null, hash: '#home' }];
  const listeners = new Set();
  const host = {
    location: {
      get hash() {
        return entries[index].hash;
      },
      get href() {
        return 'https://hamiya.test/' + this.hash;
      },
    },
    history: {
      get state() {
        return entries[index].state;
      },
      pushState(state, _, url) {
        entries.splice(index + 1);
        entries.push({ state, hash: new URL(url, host.location.href).hash });
        index++;
      },
      replaceState(state, _, url) {
        entries[index] = { state, hash: new URL(url, host.location.href).hash };
      },
      back() {
        if (index) {
          index--;
          for (const listener of [...listeners]) listener();
        }
      },
    },
    addEventListener(_, fn) {
      listeners.add(fn);
    },
    removeEventListener(_, fn) {
      listeners.delete(fn);
    },
    get length() {
      return entries.length;
    },
  };
  return host;
}
test('Android Back dismisses the overlay and keeps the current page', () => {
  const host = browser();
  let closed = 0;
  const cleanup = registerOverlay(() => closed++, host);
  host.history.back();
  cleanup();
  assert.equal(closed, 1);
  assert.equal(host.location.hash, '#home');
});
test('closing a dialog removes its history entry before navigating back', () => {
  const host = browser();
  navigateHistory('catalog', host);
  const cleanup = registerOverlay(() => assert.fail('cleanup must not close twice'), host);
  cleanup();
  assert.equal(host.location.hash, '#catalog');
  host.history.back();
  assert.equal(host.location.hash, '#home');
});
test('drawer navigation replaces the overlay so Back reaches the previous page', () => {
  const host = browser();
  const cleanup = registerOverlay(() => {}, host);
  navigateHistory('orders', host);
  cleanup();
  assert.equal(host.location.hash, '#orders');
  host.history.back();
  assert.equal(host.location.hash, '#home');
});
test('nested overlays close in reverse order', () => {
  const host = browser();
  let outer = 0,
    inner = 0;
  const a = registerOverlay(() => outer++, host);
  const b = registerOverlay(() => inner++, host);
  host.history.back();
  b();
  assert.equal(inner, 1);
  assert.equal(outer, 0);
  host.history.back();
  a();
  assert.equal(outer, 1);
});
test('reselecting the active page does not grow history', () => {
  const host = browser();
  navigateHistory('home', host);
  navigateHistory('home', host);
  assert.equal(host.length, 1);
});
test('consuming an order detail link lets the sheet close before Back returns home', () => {
  const host = browser();
  navigateHistory('orders/order-1', host);
  navigateHistory('orders', host, true);
  assert.equal(host.length, 2);
  let closed = 0;
  const cleanup = registerOverlay(() => closed++, host);
  host.history.back();
  cleanup();
  assert.equal(closed, 1);
  assert.equal(host.location.hash, '#orders');
  host.history.back();
  assert.equal(host.location.hash, '#home');
});
