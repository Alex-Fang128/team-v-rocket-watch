import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bearingDegrees, countdown, directionName, distanceMeters } from './geo.ts';

test('distance handles identical, known-distance, and antipodal locations', () => {
  assert.equal(distanceMeters({lat:0,lng:0},{lat:0,lng:0}),0);
  assert.ok(Math.abs(distanceMeters({lat:0,lng:0},{lat:0,lng:1}) - 111195) < 2);
  assert.ok(Number.isFinite(distanceMeters({lat:0,lng:0},{lat:0,lng:180})));
});
test('bearing follows clockwise true-north convention', () => {
  const start = {lat:0,lng:0};
  for (const [end,expected] of [[{lat:1,lng:0},0],[{lat:0,lng:1},90],[{lat:-1,lng:0},180],[{lat:0,lng:-1},270]] as const) assert.equal(bearingDegrees(start,end),expected);
  const bearing = bearingDegrees({lat:34.1442,lng:-118.1187},{lat:34.632,lng:-120.611});
  assert.ok(bearing > 280 && bearing < 290);
  assert.equal(directionName(359),'N');
  assert.equal(directionName(bearing),'WNW');
});
test('countdown does not recycle an elapsed launch and supports more than 24 hours', () => {
  assert.equal(countdown(1000,1000),null);
  assert.equal(countdown(0,1000),null);
  assert.deepEqual(countdown(90061000,0),['25','01','01']);
});
