import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogLocation, catalogRoute, unitLabel, variantLabel } from '../src/storefront.ts';
import { storefrontCopy } from '../src/storefront-translations.ts';
import { translate } from '../src/i18n.ts';

test('home search links preserve localized text and route delimiters through catalog filtering', () => {
  for (const search of ['Banana', 'ሙዝ', 'Buna Hawinet', 'coffee & food / #1?']) {
    const route = catalogRoute('all', search);
    assert.deepEqual(catalogLocation(route), { category: 'all', search });
    assert.deepEqual(catalogLocation(catalogRoute('coffee', search)), {
      category: 'coffee',
      search,
    });
  }
  assert.equal(catalogRoute('all', '   '), 'catalog');
  assert.deepEqual(catalogLocation('catalog/food'), { category: 'food', search: '' });
  assert.deepEqual(catalogLocation('catalog/unrecognized?q=Cookies'), {
    category: 'all',
    search: 'Cookies',
  });
});

test('storefront copy and known product variants and units resolve in every supported language', () => {
  for (const language of ['en', 'am', 'om']) {
    const t = (key) => translate(language, key);
    for (const key of Object.keys(storefrontCopy.en)) {
      assert.ok(storefrontCopy[language][key]?.trim(), language + ': ' + key);
      assert.notEqual(t(key), key);
    }
    assert.equal(unitLabel('carton', t), t('cartonUnit'));
    assert.equal(variantLabel('Hard', t), t('variantHard'));
    assert.equal(variantLabel('Softi', t), t('variantSoft'));
    assert.equal(unitLabel('special container', t), 'special container');
    assert.equal(variantLabel('Custom edition', t), 'Custom edition');
  }
});
