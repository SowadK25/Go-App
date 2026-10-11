const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadUtility(name, dependencies = {}) {
  const exports = {};
  const source = readFileSync(path.join(__dirname, `../src/utils/${name}.ts`), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: name => dependencies[name] });
  return exports;
}
const transit = loadUtility('transit');
const { legLiveStatus, journeyLiveStatus, legOccurrence, shouldRefreshLeg } = loadUtility('liveStatus', { './transit': transit });
const now = new Date('2026-10-10T22:46:44Z');
const journey = {
  start_time: '2026-10-10 18:28:00', end_time: '2026-10-10 19:05:00',
  trips: [{ number: '3030', line: 'KI', vehicle_type: 'T', depart_from_code: 'BE', destination_stop_code: 'UN', stops: [{ code: 'BE', time: '18:28' }, { code: 'UN', time: '19:05' }] }],
};
const active = { trip_number: '3030', line_code: 'GT', delay_status: 'delayed', delay_minutes: 19, modified_at: '2026-10-10 18:46:44' };

test('matches the reported Bramalea train through the GT/KI alias', () => {
  const result = legLiveStatus(journey, 0, now, [active]);
  assert.equal(result.label, 'Delayed - 19 min');
  assert.equal(result.tone, 'danger');
});

test('only shows On time or Early when the live feed explicitly reports it', () => {
  assert.equal(legLiveStatus(journey, 0, now, [{ ...active, delay_status: 'on_time' }]).kind, 'on_time');
  assert.equal(legLiveStatus(journey, 0, now, [{ ...active, delay_status: 'early', delay_minutes: -2 }]).label, 'Early - 2 min');
  assert.equal(legLiveStatus(journey, 0, now, [{ ...active, delay_status: undefined }]).kind, 'unavailable');
});

test('missing, stale, wrong-date, wrong-line, and wrong-number records remain unavailable', () => {
  for (const trips of [undefined, [], [{ ...active, modified_at: '2026-10-09 18:46:44' }], [{ ...active, modified_at: '2026-10-10 18:30:00' }], [{ ...active, line_code: 'LW' }], [{ ...active, trip_number: '3032' }]]) {
    assert.equal(legLiveStatus(journey, 0, now, trips).kind, 'unavailable');
  }
});

test('future dates remain Scheduled even when the same trip number is active today', () => {
  const future = { ...journey, start_time: '2026-10-13 18:28:00' };
  assert.equal(legLiveStatus(future, 0, now, [active]).kind, 'scheduled');
});

test('today’s later trips are Scheduled until live status is available', () => {
  const future = { ...journey, start_time: '2026-10-10 19:28:00', trips: [{ ...journey.trips[0], stops: [{ code: 'BE', time: '19:28' }] }] };
  assert.equal(legLiveStatus(future, 0, now, []).kind, 'scheduled');
});

test('polls only near departure or while a service may still be running', () => {
  assert.equal(shouldRefreshLeg(journey, 0, now), true);
  const distant = { ...journey, start_time: '2026-10-10 21:28:00', end_time: '2026-10-10 22:05:00', trips: [{ ...journey.trips[0], stops: [{ code: 'BE', time: '21:28' }, { code: 'UN', time: '22:05' }] }] };
  assert.equal(shouldRefreshLeg(distant, 0, now), false);
  assert.equal(shouldRefreshLeg({ ...journey, start_time: '2026-10-13 18:28:00' }, 0, now), false);
  const completed = { ...journey, start_time: '2026-10-10 08:28:00', end_time: '2026-10-10 09:05:00', trips: [{ ...journey.trips[0], stops: [{ code: 'BE', time: '08:28' }, { code: 'UN', time: '09:05' }] }] };
  assert.equal(shouldRefreshLeg(completed, 0, now), false);
});

test('fresh cancellations override live delay, but another day’s cancellation does not', () => {
  const exception = { trip_number: '3030', is_cancelled: true, affected_stops: [{ scheduled_departure: '2026-10-10 18:28:00' }] };
  const feed = { mode: 'train', generated_at: '2026-10-10 18:46:00', trips: [exception] };
  assert.equal(legLiveStatus(journey, 0, now, [active], feed).kind, 'cancelled');
  feed.trips[0].affected_stops[0].scheduled_departure = '2026-10-13 18:28:00';
  assert.equal(legLiveStatus(journey, 0, now, [active], feed).kind, 'delayed');
});

test('overnight transfer legs match their own calendar date', () => {
  const overnight = { start_time: '2026-10-10 23:50:00', trips: [journey.trips[0], { ...journey.trips[0], depart_from_code: 'UN', stops: [{ code: 'UN', time: '00:20' }] }] };
  assert.equal(legOccurrence(overnight, 1).date, '20261011');
  assert.equal(legLiveStatus(overnight, 1, now, [active]).kind, 'scheduled');
});

test('overall transfer status prioritizes cancellation and delay without assuming missing legs are on time', () => {
  const delayed = { kind: 'delayed', label: 'Delayed - 19 min', tone: 'danger', delayMinutes: 19 };
  const unknown = { kind: 'unavailable', label: 'Status unavailable', tone: 'neutral' };
  const onTime = { kind: 'on_time', label: 'On time', tone: 'success' };
  const cancelled = { kind: 'cancelled', label: 'Cancelled', tone: 'danger' };
  assert.equal(journeyLiveStatus([onTime, unknown]).kind, 'unavailable');
  assert.equal(journeyLiveStatus([unknown, delayed]).kind, 'delayed');
  assert.equal(journeyLiveStatus([delayed, cancelled]).kind, 'cancelled');
});
