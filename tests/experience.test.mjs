import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { validStockTarget } from '../src/inventory.ts';
import { polishCopy } from '../src/polish-translations.ts';
import { translate, hasTranslation } from '../src/i18n.ts';

test('stock editing accepts whole counts and protects reservations and numeric limits', () => {
  for (const value of ['20', '200', '10000000'])
    assert.equal(validStockTarget(value, 20), true, value);
  for (const value of ['', '19', '-1', '20.5', '1e3', '10000001', '9007199254740993'])
    assert.equal(validStockTarget(value, 20), false, value);
  assert.equal(validStockTarget('0', 0), true);
});
test('all shared polish and operational labels have translations in each language', () => {
  for (const lang of ['en', 'am', 'om'])
    for (const key of Object.keys(polishCopy.en)) {
      assert.ok(polishCopy[lang][key]?.trim(), lang + ': ' + key);
      assert.notEqual(translate(lang, key), key, lang + ': ' + key);
    }
});
test('literal translation keys used by every screen resolve in all three languages', () => {
  for (const file of readdirSync(new URL('../src/', import.meta.url)).filter((name) =>
    name.endsWith('.tsx'),
  )) {
    const content = readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
    for (const [, key] of content.matchAll(/\bt\('([^']+)'\)/g)) {
      for (const lang of ['en', 'am', 'om'])
        assert.ok(hasTranslation(lang, key), file + ': ' + lang + ': ' + key);
    }
  }
});
