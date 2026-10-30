import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestSheetSnap, sheetViewportGeometry } from '../src/sheet-geometry.ts';

for (const [name, viewport, dockTop] of [
  ['small Android portrait', 640, 560],
  ['compact Android portrait', 720, 632],
  ['standard Android portrait', 844, 756],
]) {
  test(`product sheet respects bottom dock on ${name}`, () => {
    const geometry = sheetViewportGeometry({
      layoutHeight: viewport, visualHeight: viewport,
      safeTop: 24, safeBottom: 24, dockTop,
    });
    for (const snap of [45, 60, 75]) {
      const height = geometry.usable * snap / 100;
      const sheetTop = viewport - geometry.bottom - height;
      assert.ok(sheetTop >= geometry.top + 12, 'sheet must not reach status bar');
      assert.ok(viewport - geometry.bottom <= dockTop - 12, 'sheet must stop above navigation');
      assert.ok(height < viewport, 'sheet must never cover the full screen');
      assert.equal(nearestSheetSnap(height, geometry.usable), snap);
    }
  });
}

test('keyboard resize keeps product sheet inside visual viewport', () => {
  const geometry = sheetViewportGeometry({
    layoutHeight: 800, visualHeight: 430, visualTop: 0,
    safeTop: 24, safeBottom: 24, dockTop: undefined,
  });
  assert.ok(800 - geometry.bottom <= 418);
  assert.ok(geometry.usable * 0.75 <= 430);
});

test('dragged heights snap to nearest allowed position', () => {
  assert.equal(nearestSheetSnap(450, 1000), 45);
  assert.equal(nearestSheetSnap(600, 1000), 60);
  assert.equal(nearestSheetSnap(750, 1000), 75);
  assert.equal(nearestSheetSnap(730, 1000), 75);
});
