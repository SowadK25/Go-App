const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(relative, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path.join(__dirname, '../src', relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: name => dependencies[name] });
  return exports;
}
const utils = load('storage/preferences.ts', { '../utils/transit': load('utils/transit.ts') });
const searchUtils = load('utils/tripSearch.ts', { './transit': load('utils/transit.ts') });
const from = { id: 'BE', name: 'Bramalea GO', type: 'train' };
const to = { id: 'UN', name: 'Union Station GO', type: 'train' };
const tracked = { fromName: from.name, toName: to.name, date: '20261011', journey: {
  start_time: '2026-10-11 23:28:00', end_time: '2026-10-12 00:05:00',
  trips: [{ number: '3030', display: 'Union', line: 'KI', direction: 'E', vehicle_type: 'T',
    depart_from_code: 'BE', destination_stop_code: 'UN', stops: [{ code: 'BE', time: '23:28' }] }],
} };

test('existing home/work/favorites survive hydration without tracking fields', () => {
  const value = utils.readPreferences({ home: from, work: to, favorites: [from] });
  assert.equal(value.home.id, 'BE'); assert.equal(value.work.id, 'UN');
  assert.equal(value.favorites.length, 1);
  assert.equal(value.trackedTrip, null);
});
test('trip search initializes in Toronto time, including UTC date rollover', () => {
  const search = searchUtils.searchDateTime(searchUtils.initialSearchDate(new Date('2026-10-12T01:30:00Z')));
  assert.equal(search.date, '20261011'); assert.equal(search.time, '2130');
});
test('tracking expires using Toronto arrival date and allows overnight delay buffer', () => {
  assert.equal(utils.trackingExpired(tracked, new Date('2026-10-12T05:30:00Z')), false);
  assert.equal(utils.trackingExpired(tracked, new Date('2026-10-12T06:06:00Z')), true);
  assert.equal(utils.readPreferences({ trackedTrip: tracked }, new Date('2026-10-12T06:06:00Z')).trackedTrip, null);
});
test('persisted valid trip survives restart; malformed legs are rejected', () => {
  const restored = utils.readPreferences(JSON.parse(JSON.stringify({ savedTrips: [{ from, to }], home: from, work: to, favorites: [from], trackedTrip: tracked })), new Date('2026-10-12T01:00:00Z'));
  assert.equal('savedTrips' in restored, false);
  assert.equal(restored.home.id, from.id); assert.equal(restored.work.id, to.id);
  assert.equal(restored.favorites.length, 1);
  assert.equal(restored.trackedTrip.journey.trips[0].number, '3030');
  assert.equal(utils.isTrackedTrip({ ...tracked, journey: { ...tracked.journey, trips: [null] } }), false);
  assert.equal(utils.isTrackedTrip({ ...tracked, date: '20261012' }), false);
});
test('tracking identity distinguishes service dates and boarding stations', () => {
  assert.notEqual(utils.trackedTripKey(tracked), utils.trackedTripKey({ ...tracked, date: '20261012' }));
  const changed = JSON.parse(JSON.stringify(tracked)); changed.journey.trips[0].depart_from_code = 'MA';
  assert.notEqual(utils.trackedTripKey(tracked), utils.trackedTripKey(changed));
});
