import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyFilters, matches, stats, validateBackup, weatherTags, timeTags } from '../src/model.js';

const { items } = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url)));
const item = name => items.find(i => i.name === name);

test('all four wings have the complete museum catalog, without duplicate IDs', () => {
  assert.equal(items.length, 409);
  assert.equal(new Set(items.map(i => i.id)).size, 409);
  assert.equal(stats(items, {}).sets, 82);
  assert.equal(items.filter(i => i.wing === 'Fish').length, 109);
  assert.equal(items.filter(i => i.wing === 'Archaeology').length, 110);
  assert.equal(items.filter(i => i.wing === 'Flora').length, 95);
  assert.equal(items.filter(i => i.wing === 'Insect').length, 95);
  assert.ok(items.every(i => i.location || i.sources));
  assert.ok(items.filter(i => i.wing === 'Fish').every(i => i.size));
});
test('weather AND season AND wing: cherry fish needs Spring and Wind', () => {
  const f = { ...emptyFilters(), wing: 'Fish', seasons: ['Spring'], weather: ['Wind'] };
  assert.equal(matches(item('Cherry Fish'), f), true);
  assert.equal(matches(item('Cherry Fish'), { ...f, weather: ['Rain'] }), false);
  assert.equal(matches(item('Cherry Fish'), { ...f, seasons: ['Winter'] }), false);
  assert.equal(matches(item('Clay'), f), false);
});
test('same-filter selections use OR; year-round items have a separate season category', () => {
  assert.equal(matches(item('Cherry Fish'), { ...emptyFilters(), seasons: ['Spring', 'Winter'], weather: ['Wind','Rain'] }), true);
  assert.equal(matches(item('Koi'), { ...emptyFilters(), seasons: ['Winter'], weather: ['Blizzard'] }), false);
  assert.equal(matches(item('Koi'), { ...emptyFilters(), seasons: ['Winter', 'All Seasons'], weather: ['Blizzard', 'Any Weather'] }), true);
  assert.equal(matches(item('Koi'), { ...emptyFilters(), seasons: ['All Seasons'] }), true);
  assert.equal(matches(item('Cherry Fish'), { ...emptyFilters(), seasons: ['All Seasons'] }), false);
  assert.equal(matches(item('Ant'), { ...emptyFilters(), seasons: ['All Seasons'] }), false);
  assert.equal(matches(item('Ant'), { ...emptyFilters(), seasons: ['Spring'] }), true);
  assert.equal(matches(item('Koi'), emptyFilters()), true);
  assert.equal(matches(item('Ant'), { ...emptyFilters(), seasons: ['Winter'] }), false);
});
test('hide donated removes only donated items without changing overall progress', () => {
  const progress = { koi: { status: 'donated' }, 'cherry-fish': { status: 'collected' } };
  const preferences = { hideDonated: true };
  assert.equal(matches(item('Koi'), emptyFilters(), progress, preferences), false);
  assert.equal(matches(item('Cherry Fish'), emptyFilters(), progress, preferences), true);
  assert.equal(matches(item('Ant'), emptyFilters(), progress, preferences), true);
  assert.equal(matches(item('Koi'), emptyFilters(), progress, { hideDonated: false }), true);
  assert.equal(stats(items, progress).donated, 1);
});
test('weather aliases use exact values without confusing rain and storms', () => {
  assert.deepEqual(weatherTags('Rainy | Rain | Storm | Thunderstorm'), ['Rain','Storm']);
  assert.deepEqual(weatherTags('Sunny | Wind | Wind'), ['Sunny', 'Wind']);
  assert.equal(matches(item('Cherry Fish'), { ...emptyFilters(), weather: ['Storm'] }), false);
});
test('location, size, rarity, search, and status combine with other filters', () => {
  const f = { ...emptyFilters(), seasons: ['Spring'], locations: ['Pond'], sizes: ['Small'], rarities: ['Legendary'], query: 'cherry', status: 'remaining' };
  assert.equal(matches(item('Cherry Fish'), f), true);
  assert.equal(matches(item('Cherry Fish'), f, { 'cherry-fish': { status: 'donated' } }), false);
  assert.equal(matches(item('Cherry Fish'), { ...f, locations: ['Ocean'] }), false);
  assert.equal(matches(item('Cherry Fish'), { ...f, sizes: ['Giant'] }), false);
  assert.equal(matches(item('Clay'), { ...emptyFilters(), sizes: ['Small'] }), false);
});
test('donation and complete-set totals are independent of filtering', () => {
  const legendary = items.filter(i => i.set === 'Legendary Fish Set');
  assert.equal(legendary.length, 4);
  const progress = Object.fromEntries(legendary.map(i => [i.id, { status: 'donated' }]));
  assert.equal(stats(items, progress).completeSets, 1);
  assert.equal(stats(items, progress).donated, 4);
  progress[legendary[0].id].status = 'collected';
  assert.equal(stats(items, progress).completeSets, 0);
  assert.equal(stats(items, progress).donated, 3);
});
test('retired notes are excluded from search', () => {
  assert.equal(matches(item('Koi'), { ...emptyFilters(), query: 'near bridge' }, { koi: { notes: 'Look near the bridge' } }), false);
});
test('enrichment retains insect time windows, spawn conditions, and production requirements', () => {
  assert.deepEqual(timeTags('Day (6 AM - 8 PM)'), ['Day']);
  assert.deepEqual(timeTags('Night (8 PM - 2 AM)'), ['Night']);
  assert.deepEqual(timeTags('6 PM - 2 AM'), ['Day', 'Night']);
  assert.match(item('Grasshopper').time, /6 AM - 8 PM/);
  assert.match(item('Grasshopper').details['Spawn Condition'], /cutting grass/);
  assert.equal(matches(item('Grasshopper'), { ...emptyFilters(), times: ['Night'] }), false);
  assert.equal(matches(item('Grasshopper'), { ...emptyFilters(), times: ['Day'] }), true);
  assert.match(item('Cricket').time, /8 PM/);
  assert.equal(item('Flower Crown Beetle').rarity, 'Legendary');
  assert.match(item('Legendary Honey').details['Production requirement'], /4 legendary bees/);
  assert.match(item('Rare Fish Bait').details['Production requirement'], /4 rare Bugs/);
  assert.ok(items.every(i => Object.keys(i.details).length > 0));
});
test('invalid imports fail before any state is changed and unknown IDs are ignored', () => {
  const source = { app: 'mistria-museum-tracker', version: 1, progress: { koi: { status: 'donated', notes: '<script>not executable</script>' }, unknown: { status: 'donated', notes: '' } } };
  const imported = validateBackup(source, items);
  assert.equal(imported.koi.status, 'donated');
  assert.equal(imported.unknown, undefined);
  assert.throws(() => validateBackup({ ...source, version: 2 }, items));
  assert.throws(() => validateBackup({ ...source, progress: { koi: { status: 'wrong', notes: '' } } }, items));
  assert.equal(source.progress.koi.status, 'donated');
});

test('Any Weather is separate and can be combined with restricted weather', () => {
  assert.deepEqual(weatherTags('Any'), ['Any Weather']);
  assert.equal(matches(item('Koi'), {...emptyFilters(), weather: ['Rain']}), false);
  assert.equal(matches(item('Koi'), {...emptyFilters(), weather: ['Any Weather']}), true);
  assert.equal(matches(item('Walleye'), {...emptyFilters(), weather: ['Any Weather']}), false);
  for (const name of ['Koi', 'Walleye']) assert.equal(matches(item(name), {...emptyFilters(), weather: ['Rain', 'Any Weather']}), true);
});
test('old collected statuses become not donated without losing backup notes', () => {
  const progress = { koi: {status: 'collected', notes: 'Legacy note'}, 'cherry-fish': {status: 'donated'} };
  const parsed = validateBackup({app:'mistria-museum-tracker',version:1,progress}, items);
  assert.deepEqual(parsed.koi, {status:'missing',notes:'Legacy note'});
  assert.deepEqual(parsed['cherry-fish'], {status:'donated'});
});
