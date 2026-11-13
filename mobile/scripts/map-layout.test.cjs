const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isMajorStation, stationIsVisible, groupNearbyTrains, trainDirection } = require('../src/components/map/mapLayout');

test('direction points toward the reported next stop in each compass direction', () => {
  const train = {latitude:43.7,longitude:-79.5,status:'moving',stop_code:'NEXT',line_code:'KI'};
  for (const [latitude,longitude,compass,bearing] of [[43.8,-79.5,'north',0],[43.7,-79.4,'east',90],[43.6,-79.5,'south',180],[43.7,-79.6,'west',270]]) {
    const direction = trainDirection(train,[{id:'NEXT',name:'Next GO',line_codes:['KI'],latitude,longitude}]);
    assert.equal(direction.compass,compass);
    assert.ok(Math.abs(direction.bearing-bearing)<1);
    assert.equal(direction.stopName,'Next GO');
  }
});

test('direction is omitted at stops and when a next stop cannot establish direction', () => {
  const train = {latitude:43.7,longitude:-79.5,status:'approaching',stop_code:'NEXT',line_code:'KI'};
  const stop = {id:'NEXT',name:'Next GO',line_codes:['KI'],latitude:43.8,longitude:-79.5};
  assert.equal(trainDirection({...train,status:'stopped'},[stop]),null);
  assert.equal(trainDirection({...train,status:'reported'},[stop]),null);
  assert.equal(trainDirection(train,[]),null);
  assert.equal(trainDirection(train,[{...stop,line_codes:['LE']}]),null);
  assert.equal(trainDirection(train,[{...stop,latitude:43.7001}]),null);
  assert.equal(trainDirection(train,[{...stop,longitude:NaN}]),null);
});

test('overview prioritizes rail hubs without classifying bus interchanges as rail hubs', () => {
  const lines = [{code:'KI',vehicle_type:'Train'},{code:'UP',vehicle_type:'Train'},{code:'30',vehicle_type:'Bus'},{code:'31',vehicle_type:'Bus'}];
  assert.equal(isMajorStation({name:'Bloor GO',line_codes:['KI','UP']},lines),true);
  assert.equal(isMajorStation({name:'Kitchener GO',line_codes:['KI']},lines),true);
  assert.equal(isMajorStation({name:'Unionville GO',line_codes:['KI']},lines),false);
  assert.equal(isMajorStation({name:'Local stop',line_codes:['30','31']},lines),false);
});

test('zoom reveals stations progressively and searches always expose their matches', () => {
  const rail = {isTrain:true,isMajor:false};
  const bus = {isTrain:false,isMajor:false};
  assert.equal(stationIsVisible({...rail,isMajor:true},8,false),true);
  assert.equal(stationIsVisible(rail,9,false),false);
  assert.equal(stationIsVisible(rail,10,false),true);
  assert.equal(stationIsVisible(bus,12,false),false);
  assert.equal(stationIsVisible(bus,13,false),true);
  assert.equal(stationIsVisible(bus,8,true),true);
});

test('overlapping trains group at overview scale and separate as their projected distance increases', () => {
  const points = [{id:'a',x:0,y:0},{id:'b',x:40,y:0},{id:'c',x:200,y:0}];
  assert.deepEqual(groupNearbyTrains(points).map(group=>group.map(item=>item.id)),[['a','b'],['c']]);
  assert.equal(groupNearbyTrains(points.map(point=>({...point,x:point.x*4}))).length,3);
  assert.equal(points[0].x,0);
});

test('groups are stable across feed order and do not merge a chain spanning the map', () => {
  const points = [{id:'a',x:0,y:0},{id:'b',x:40,y:0},{id:'c',x:80,y:0}];
  const ids = items=>groupNearbyTrains(items).map(group=>group.map(item=>item.id));
  assert.deepEqual(ids(points),[['a','b'],['c']]);
  assert.deepEqual(ids([...points].reverse()),ids(points));
  assert.deepEqual(groupNearbyTrains([]),[]);
  assert.deepEqual(ids([{id:'a',x:0,y:0},{id:'b',x:0,y:0}]),[['a','b']]);
});
