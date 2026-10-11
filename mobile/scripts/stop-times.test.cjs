const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const exportsForTest = {};
const source = readFileSync(path.join(__dirname, '../src/utils/stopTimes.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsForTest });
const { timeDifference, stopTimes } = exportsForTest;

test('recognizes equal, late, and early stop times', () => {
  assert.equal(timeDifference('07:07', '07:07:30'), 0);
  assert.equal(timeDifference('07:07', '07:10'), 3);
  assert.equal(timeDifference('07:07', '07:04'), -3);
});

test('compares predictions across midnight and extended service hours', () => {
  assert.equal(timeDifference('23:58', '00:03'), 5);
  assert.equal(timeDifference('00:03', '23:58'), -5);
  assert.equal(timeDifference('23:58', '24:03'), 5);
  assert.equal(timeDifference('2026-10-10 23:58:00', '2026-10-11 00:03:00'), 5);
});

test('does not compare an arrival estimate with a scheduled departure', () => {
  const pair = stopTimes({ code: 'UN', departure_scheduled: '07:07', arrival_computed: '07:05' });
  assert.equal(pair.scheduled, '07:07');
  assert.equal(pair.estimated, undefined);
  assert.equal(stopTimes({ code: 'UN', arrival_scheduled: '07:07', arrival_computed: '07:10' }).estimated, '07:10');
});

test('handles absent or unknown times without inventing a delay', () => {
  assert.equal(timeDifference('07:07', undefined), null);
  assert.equal(timeDifference('unknown', '07:07'), null);
});
