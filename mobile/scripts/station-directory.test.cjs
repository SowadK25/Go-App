const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const exportsForTest = {};
vm.runInNewContext(ts.transpileModule(readFileSync(path.join(__dirname, '../src/utils/stationDirectory.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {exports:exportsForTest});
const { filterStationDirectory } = exportsForTest;
test('line directory includes the full terminus and separates train/bus stations with the same name', () => {
  const stops = [{id:'KI',name:'Kitchener GO',type:'Train Station'}, {id:'02186',name:'Kitchener GO',type:'Bus Stop'}, {id:'MO',name:'Mount Pleasant GO',type:'Train Station'}];
  const members = [stops[0],stops[2]];
  assert.equal(filterStationDirectory(stops,'Kitchener',members).map(stop=>stop.id).join(','),'KI');
});
test('directory preserves stations missing from the live catalog without confusing an empty line with all stations', () => {
  const catalog = [{id:'UN',name:'Union Station GO',type:'Train Station'}];
  const members = [{id:'KI',name:'Kitchener GO',type:'Train Station'}, {id:'UN',name:'Union',type:'Train Station'}];
  assert.equal(filterStationDirectory(catalog,'',members).map(stop=>stop.name).join(','),'Kitchener GO,Union Station GO');
  assert.equal(filterStationDirectory(catalog,'',[]).length,0);
  assert.equal(filterStationDirectory(catalog,'').length,1);
});
