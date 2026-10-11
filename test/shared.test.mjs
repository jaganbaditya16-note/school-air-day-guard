import test from 'node:test';
import assert from 'node:assert/strict';
import { subIndex, aqiFrom, bandOf, levelOf, buildDay } from '../src/shared.mjs';

const PM25 = [[0,30,0,50],[30,60,50,100],[60,90,100,200],[90,120,200,300],[120,250,300,400],[250,380,400,500]];

test('sub-index hits breakpoints and interpolates', () => {
  assert.equal(subIndex(0, PM25), 0);
  assert.equal(subIndex(30, PM25), 50);
  assert.equal(subIndex(75, PM25), 150);
  assert.equal(subIndex(90, PM25), 200);
  assert.equal(subIndex(999, PM25), 500);
  assert.ok(Number.isNaN(subIndex(-1, PM25)));
});

test('AQI uses the worse pollutant', () => {
  assert.equal(aqiFrom(30, 400) > aqiFrom(30, 50), true);
  assert.equal(aqiFrom(10, 20) <= 50, true);
});

test('bands and levels', () => {
  assert.equal(bandOf(50), 'Good');
  assert.equal(bandOf(250), 'Poor');
  assert.equal(levelOf(100), 'GO');
  assert.equal(levelOf(101), 'CAUTION');
  assert.equal(levelOf(201), 'LIMIT');
  assert.equal(levelOf(301), 'INDOOR');
});

const mk = (date, pm25, pm10) => ({
  time: Array.from({ length: 24 }, (_, h) => `${date}T${String(h).padStart(2, '0')}:00`),
  pm2_5: Array(24).fill(pm25), pm10: Array(24).fill(pm10),
});

test('buildDay: clean air -> GO, smog -> INDOOR', () => {
  assert.equal(buildDay(mk('2026-10-09', 12, 30), '2026-10-09', 'Pune').level, 'GO');
  assert.equal(buildDay(mk('2026-10-09', 300, 500), '2026-10-09', 'Delhi').level, 'INDOOR');
});

test('buildDay refuses to advise on missing data', () => {
  const h = mk('2026-10-09', 12, 30); h.pm2_5 = h.pm2_5.map(() => null);
  assert.equal(buildDay(h, '2026-10-09', 'Pune'), null);
});

test('message is paste-ready', () => {
  const d = buildDay(mk('2026-10-09', 150, 300), '2026-10-09', 'Delhi');
  assert.match(d.message, /School air advisory: Delhi, 2026-10-09/);
  assert.match(d.message, /not medical advice/);
});
