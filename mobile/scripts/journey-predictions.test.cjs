const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadUtility(name, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path.join(__dirname, `../src/utils/${name}.ts`), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: name => dependencies[name] });
  return exports;
}
const { journeyStopTime, journeyEndpoints } = loadUtility('journeyPredictions', { './stopTimes': loadUtility('stopTimes') });
const journey = { start_time: '2026-10-10 18:28:00', end_time: '2026-10-10 19:05:00', trips: [{ depart_from_code: 'BE', destination_stop_code: 'UN' }] };

test('uses actual stop predictions for boarding and arrival independently', () => {
  const report = { stops: [
    { code: 'BE', departure_scheduled: '18:28', departure_computed: '18:47' },
    { code: 'UN', arrival_scheduled: '19:05', arrival_computed: '19:20' },
  ] };
  const times = journeyEndpoints(journey, [report]);
  assert.equal(times.departure.estimated, '18:47');
  assert.equal(times.arrival.estimated, '19:20');
  assert.equal(times.departure.scheduled, journey.start_time);
});

test('does not manufacture predictions from a journey-wide delay', () => {
  const times = journeyEndpoints({ ...journey, delay_minutes: 19 }, [undefined]);
  assert.equal(times.departure.estimated, undefined);
  assert.equal(times.arrival.estimated, undefined);
  assert.equal(times.arrival.scheduled, journey.end_time);
});

test('does not substitute arrival estimates for departure estimates', () => {
  const report = { stops: [{ code: 'BE', arrival_scheduled: '18:25', arrival_computed: '18:30' }] };
  assert.equal(journeyStopTime({ code: 'BE', time: '18:28' }, report, 'departure').estimated, undefined);
});

test('does not substitute a terminal departure prediction for arrival', () => {
  const report = { stops: [{ code: 'UN', departure_computed: '19:23' }] };
  assert.equal(journeyStopTime({ code: 'UN', time: '19:05' }, report, 'arrival').estimated, undefined);
});

test('uses the last transfer leg’s destination estimate', () => {
  const transfer = { ...journey, trips: [{ depart_from_code: 'BE', destination_stop_code: 'MA' }, { depart_from_code: 'MA', destination_stop_code: 'UN' }] };
  const times = journeyEndpoints(transfer, [{ stops: [{ code: 'MA', arrival_computed: '18:58' }] }, { stops: [{ code: 'UN', arrival_computed: '19:20' }] }]);
  assert.equal(times.arrival.estimated, '19:20');
});
