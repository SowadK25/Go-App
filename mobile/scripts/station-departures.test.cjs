const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
function load(name,deps={}) { const exports={}; vm.runInNewContext(ts.transpileModule(readFileSync(path.join(__dirname,`../src/utils/${name}.ts`),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:name=>deps[name]});return exports; }
const {stationDeparturePrediction,clipReportedTripStops}=load('stationDepartures',{'./transit':load('transit'),'./stopTimes':load('stopTimes')});
test('scheduled board matches live times by service, line, trip and calendar occurrence',()=>{
 const departure={trip_number:'3826',line_code:'KI',service_type:'T',scheduled_departure_time:'2026-10-12 15:50:00'};
 const match={trip_number:'3826',line_code:'GT',service_type:'T',scheduled_departure_time:'2026-10-12 15:50:00',computed_departure_time:'2026-10-12 16:00:00'};
 assert.equal(stationDeparturePrediction(departure,[{...match,scheduled_departure_time:'2026-10-13 15:50:00'},match]),match);
 assert.equal(stationDeparturePrediction(departure,[{...match,service_type:'B'}]),undefined);
 assert.equal(stationDeparturePrediction(departure,[]),undefined);
});
test('trip details start at the boarding station rather than the trains original origin',()=>{
 const stops=[{code:'UN'},{code:'MO'},{code:'KI'},{code:'SF'}];
 assert.equal(clipReportedTripStops(stops,[{code:'KI'},{code:'SF'}]).map(stop=>stop.code).join(','),'KI,SF');
 assert.equal(clipReportedTripStops(stops,[{code:'missing'},{code:'SF'}]).length,0);
});
