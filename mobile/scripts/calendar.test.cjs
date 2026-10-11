const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const exportsForTest = {};
vm.runInNewContext(ts.transpileModule(readFileSync(path.join(__dirname, '../src/utils/calendar.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsForTest });
const { isPastDate, canGoToPreviousMonth } = exportsForTest;

test('disables yesterday but allows today regardless of the departure time', () => {
  const today = new Date(2026, 9, 10, 12);
  assert.equal(isPastDate(new Date(2026, 9, 9, 23, 59), today), true);
  assert.equal(isPastDate(new Date(2026, 9, 10, 0), today), false);
  assert.equal(isPastDate(new Date(2026, 9, 11), today), false);
});

test('allows month navigation back to the current month, including year boundaries', () => {
  const today = new Date(2026, 11, 31);
  assert.equal(canGoToPreviousMonth(new Date(2026, 11, 1), today), false);
  assert.equal(canGoToPreviousMonth(new Date(2027, 0, 1), today), true);
  assert.equal(isPastDate(new Date(2026, 11, 30), today), true);
  assert.equal(isPastDate(new Date(2027, 0, 1), today), false);
});
