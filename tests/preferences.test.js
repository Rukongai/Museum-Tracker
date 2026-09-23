import test from 'node:test';
import assert from 'node:assert/strict';
import { readPreferences, isSetCollapsed } from '../src/preferences.js';

test('invalid settings recover defaults without modifying donation storage', () => {
  assert.deepEqual(readPreferences('{broken', 'dark'), { theme: 'dark', autoCollapse: false, hideDonated: false, museumLayout: 'cards', collapsedSets: {} });
  assert.deepEqual(readPreferences('{"theme":"invalid","autoCollapse":"true","collapsedSets":{"a":true,"b":"false"}}'), { theme: 'light', autoCollapse: false, hideDonated: false, museumLayout: 'cards', collapsedSets: { a: true } });
  assert.equal(readPreferences('{"hideDonated":true}').hideDonated, true);
  assert.equal(readPreferences('{"hideDonated":"true"}').hideDonated, false);
  assert.equal(readPreferences('{"museumLayout":"table"}').museumLayout, 'table');
  assert.equal(readPreferences('{"museumLayout":"invalid"}').museumLayout, 'cards');
});

test('automatic collapse only affects completed sets and respects manual reopening', () => {
  const settings = { autoCollapse: true, collapsedSets: {} };
  assert.equal(isSetCollapsed('Fish:Legendary', false, settings), false);
  assert.equal(isSetCollapsed('Fish:Legendary', true, settings), true);
  settings.collapsedSets['Fish:Legendary'] = false;
  assert.equal(isSetCollapsed('Fish:Legendary', true, settings), false);
  settings.collapsedSets['Fish:Legendary'] = true;
  settings.autoCollapse = false;
  assert.equal(isSetCollapsed('Fish:Legendary', false, settings), true);
});
