const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const exportsForTest = {};
const transitExports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(path.join(__dirname, '../src/utils/transit.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: transitExports });
const source = readFileSync(path.join(__dirname, '../src/utils/journeys.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsForTest, require: () => transitExports });
const { filterJourneys, legStops, transferCount, upcomingArriveByJourneys, arrivalMinutesAfterTarget } = exportsForTest;

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

test('arrive-by results retain latest-departure ordering after transfer filters', () => {
  const journeys = [
    { start_time: '2026-10-12 23:30:00', end_time: '2026-10-13 00:30:00', transfer_count: 1 },
    { start_time: '2026-10-13 00:05:00', end_time: '2026-10-13 00:30:00', transfer_count: 0 },
    { start_time: '2026-10-13 00:05:00', end_time: '2026-10-13 00:25:00', transfer_count: 1 },
  ];
  const all = filterJourneys(journeys, 'all', 'arrive_by');
  assert.equal(all[0].end_time, '2026-10-13 00:25:00');
  assert.equal(all[2].start_time, '2026-10-12 23:30:00');
  assert.equal(filterJourneys(journeys, 'transfers', 'arrive_by')[0].start_time, '2026-10-13 00:05:00');
  assert.equal(journeys[0].start_time, '2026-10-12 23:30:00');
});

test('arrival search excludes departed cached options and arrivals outside the inclusive one hour before / 30 minutes after window', () => {
  const journey = (start, end) => ({ start_time: `2026-10-13 ${start}`, end_time: `2026-10-13 ${end}` });
  const options = [journey('08:00:00', '08:40:00'), journey('08:10:00', '08:30:00'),
    journey('08:15:00', '09:00:00'), journey('08:15:00', '09:30:00'), journey('08:15:00', '09:30:01'), journey('07:00:00', '07:59:59')];
  const results = upcomingArriveByJourneys(options, '20261013', '0900', new Date('2026-10-13T12:10:00Z'));
  assert.equal(results.map(item => item.end_time).join(','), '2026-10-13 08:30:00,2026-10-13 09:00:00,2026-10-13 09:30:00');
  assert.equal(upcomingArriveByJourneys(options, '20261013', '0900', new Date('2026-10-13T12:15:01Z')).length, 0);
});

test('arrival window spans midnight and uses Toronto time rather than the device zone', () => {
  const options = [{ start_time: '2026-10-12 23:20:00', end_time: '2026-10-12 23:50:00' },
    { start_time: '2026-10-12 23:00:00', end_time: '2026-10-12 23:14:00' }];
  assert.equal(upcomingArriveByJourneys(options, '20261013', '0015', new Date('2026-10-13T03:15:00Z')).length, 1);
});

test('after-target options are included across midnight and identified clearly', () => {
  const option = {start_time:'2026-10-14 00:00:00',end_time:'2026-10-14 00:20:00'};
  assert.equal(upcomingArriveByJourneys([option], '20261013', '2350', new Date('2026-10-13T12:00:00Z')).length, 1);
  assert.equal(arrivalMinutesAfterTarget(option, '20261013', '2350'), 30);
  assert.equal(arrivalMinutesAfterTarget(option, '20261014', '0030'), 0);
});
