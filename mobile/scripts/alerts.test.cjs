const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(name, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path.join(__dirname, `../src/utils/${name}.ts`), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: name => dependencies[name] });
  return exports;
}
const { journeyLineCodes, filterAlertsByLines } = load('alerts', { './transit': load('transit') });
const alert = (code, lines, type = 'Service') => ({ code, affected_lines: lines, alert_type: type });
test('tracked lines include train aliases and bus routes without duplicate legs', () => {
  assert.equal(journeyLineCodes({ trips: [{line:'GT'}, {line:'KI'}, {line:'30'}, {line:' 30 '}] }).join(','), 'KI,30');
});
test('counts matching alerts once across transfer lines and keeps information notices', () => {
  const notices = [alert('both', ['GT','30']), alert('both', ['GT','30']), alert('bus', ['30'], 'Information'), alert('other', ['LW'])];
  assert.equal(filterAlertsByLines(notices, ['KI','30']).map(item => item.code).join(','), 'both,bus');
  assert.equal(filterAlertsByLines(notices, ['LE']).length, 0);
});
test('all-lines view includes unscoped notices while a tracked-line filter excludes them', () => {
  const notices = [alert('train', ['GT']), alert('general', [])];
  assert.equal(filterAlertsByLines(notices, []).length, 2);
  assert.equal(filterAlertsByLines(notices, ['KI']).length, 1);
});
