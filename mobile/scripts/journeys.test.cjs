const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const exportsForTest = {};
const source = readFileSync(path.join(__dirname, '../src/utils/journeys.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsForTest });
const { filterJourneys, legStops, transferCount } = exportsForTest;

test('sorts across midnight without mutating cached journeys', () => {
  const journeys = [
    { start_time: '2026-10-11 00:10:00', transfer_count: 1 },
    { start_time: '2026-10-10 23:50:00', transfer_count: 0 },
    { start_time: '2026-10-10 12:00:00', transfer_count: 0 },
  ];
  assert.equal(filterJourneys(journeys, 'all').map(journey => journey.start_time).join(','), '2026-10-10 12:00:00,2026-10-10 23:50:00,2026-10-11 00:10:00');
  assert.equal(journeys[0].start_time, '2026-10-11 00:10:00');
});

test('filters direct trips and trips with any number of transfers', () => {
  const journeys = [{ start_time: '14:00', transfer_count: 2 }, { start_time: '12:00', transfer_count: 0 }, { start_time: '13:00', transfer_count: 1 }];
  assert.equal(filterJourneys(journeys, 'direct').map(journey => journey.start_time).join(','), '12:00');
  assert.equal(filterJourneys(journeys, 'transfers').map(journey => journey.start_time).join(','), '13:00,14:00');
  assert.equal(transferCount({ trips: [{}, {}] }), 1);
});

test('orders stops and limits the timeline to the selected boarding and arrival stops', () => {
  const leg = { depart_from_code: 'EX', destination_stop_code: 'OA', stops: [
    { code: 'AL', order: 4 }, { code: 'OA', order: 3 }, { code: 'UN', order: 1 }, { code: 'EX', order: 2 },
  ] };
  assert.equal(legStops(leg).map(stop => stop.code).join(','), 'EX,OA');
  assert.equal(leg.stops[0].code, 'AL');
});

test('handles missing stop details', () => {
  assert.equal(legStops({ depart_from_code: 'UN', destination_stop_code: 'OA' }).length, 0);
});
