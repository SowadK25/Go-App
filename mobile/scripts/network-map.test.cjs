const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(name, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path.join(__dirname, '../src', name), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,
    {exports, require: name => dependencies[name], URL});
  return exports;
}
const filters = load('utils/networkMap.ts');
const bridge = load('components/map/mapTypes.ts');
const document = load('components/map/mapDocument.ts', {'./generatedAssets':{leafletJs:'',leafletCss:'',mapRuntime:'',mapCss:''}});
const network = {lines:[{code:'KI',vehicle_type:'Train'},{code:'30',vehicle_type:'Bus'}], stops:[
  {id:'KI',name:'Kitchener GO',line_codes:['KI','30']}, {id:'00958',name:'Bus Stop',line_codes:['30']}, {id:'other',name:'Other',line_codes:[]}
]};
test('map filtering includes transfer stations and preserves search by code', () => {
  assert.equal(filters.visibleMapStops(network,{mode:'train',search:''}).map(stop=>stop.id).join(','),'KI');
  assert.equal(filters.visibleMapStops(network,{mode:'bus',lineCode:'30',search:''}).length,2);
  assert.equal(filters.visibleMapStops(network,{mode:'all',search:'00958'}).length,1);
});
test('map bridge accepts only known stations/lines and HTTPS attribution links', () => {
  const selected=[];
  const props={network,onSelectStop:id=>selected.push(id),onSelectLine:code=>selected.push(code),onTileError:()=>{}};
  bridge.handleMapMessage({source:'transitflow-map',type:'select-stop',stopId:'KI'},props);
  bridge.handleMapMessage({source:'transitflow-map',type:'select-stop',stopId:'unknown'},props);
  bridge.handleMapMessage({source:'other',type:'select-line',lineCode:'30'},props);
  assert.equal(selected.join(','),'KI');
  assert.equal(bridge.attributionUrl({url:'javascript:alert(1)'}),null);
  assert.equal(bridge.attributionUrl({url:'https://untrusted.example'}),null);
  assert.equal(bridge.attributionUrl({url:'https://www.openstreetmap.org/copyright'}),'https://www.openstreetmap.org/copyright');
});
test('map JSON cannot close the inline script through transit data', () => {
  assert.equal(document.scriptJson({name:'</script><script>alert(1)</script>'}).includes('<'),false);
});

test('multi-line visibility keeps shared stations and removes hidden-only stations', () => {
  const selection = filters.toggleMapLine([], '30');
  const filter = {mode:'all',search:'',hiddenLineCodes:selection};
  assert.equal(filters.visibleMapLines(network,filter).map(line=>line.code).join(','),'KI');
  assert.equal(filters.visibleMapStops(network,filter).map(stop=>stop.id).join(','),'KI');
  const allHidden = filters.toggleMapLine(selection,'KI');
  assert.equal(filters.visibleMapStops(network,{...filter,hiddenLineCodes:allHidden}).length,0);
  assert.equal(filters.toggleMapLine(selection,'30').length,0);
  assert.equal(selection.join(','),'30');
});
