import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const base = new URL('../', import.meta.url);
const events = JSON.parse(await readFile(new URL('data/breaches.json', base), 'utf8')).events;
const context = vm.createContext({});
vm.runInContext(await readFile(new URL('chart-layouts.js', base), 'utf8'), context);
const layouts = context.BreachLayouts;
const approximately = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const summaries = [];
const cases = [360, 750, 1100].flatMap(width => [[2004, 2026], [2018, 2026]]
  .map(([yearStart, yearEnd]) => ({ width, yearStart, yearEnd })));
cases.push({ width: 1166, yearStart: 2022, yearEnd: 2026 });

for (const options of cases) {
  const { width, yearStart, yearEnd } = options;
  const numeric = events.filter(e => Number.isFinite(e.records) && e.records > 0
    && e.year >= yearStart && e.year <= yearEnd);
  const bubble = layouts.bubble(events, options);
  assert.equal(bubble.positions.length, numeric.length);
  assert.equal(new Set(bubble.positions.map(p => p.id)).size, numeric.length);
  assert.deepEqual([...bubble.positions.map(p => p.id)].sort(), numeric.map(e => e.id).sort());
  assert.ok(bubble.positions.every(p => [p.x, p.y, p.r].every(Number.isFinite)));
  assert.equal(JSON.stringify(bubble), JSON.stringify(layouts.bubble(events.slice().reverse(), options)),
    'Input order must not change layout');
  for (const point of bubble.positions) {
    approximately(point.trueRadius ** 2 / layouts.maxBubbleRadius ** 2, point.records / layouts.maxRecords);
    approximately(point.x, 64 + (point.year - bubble.xDomain[0]) * bubble.yearSpacing);
    assert.equal(point.tiny, point.trueRadius < 2.8);
    approximately(point.r, Math.max(point.trueRadius, 2.8));
    approximately(point.collisionRadius, Math.max(point.trueRadius, 2.8) + 1.5);
    assert.ok(point.y - point.collisionRadius >= layouts.margins.top - 1e-6);
    assert.ok(point.y + point.collisionRadius <= bubble.height - layouts.margins.bottom + 1e-6);
  }
  for (let i = 0; i < bubble.positions.length; i++) {
    for (let j = i + 1; j < bubble.positions.length; j++) {
      const a = bubble.positions[i], b = bubble.positions[j];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.collisionRadius + b.collisionRadius - 1e-6,
        `Bubble collision: ${a.id}, ${b.id}, width ${width}`);
    }
  }
  summaries.push({ width, years: `${yearStart}–${yearEnd}`, count: numeric.length,
    bubbleHeight: bubble.height, tinyMarkers: bubble.tinyCount });
}
assert.equal(layouts.bubble([], { width: 360 }).positions.length, 0);
assert.equal(layouts.bubble(events, { width: 360, yearStart: 2023, yearEnd: 2023 }).positions.length, 49);
const full = layouts.bubble(events, { width: 1100 });
assert.equal(full.positions.length, 499);
const filtered = layouts.bubble(events.filter(event => event.sector === 'Web'), { width: 1100 });
const fullById = new Map(full.positions.map(point => [point.id, point]));
for (const point of filtered.positions) {
  approximately(point.trueRadius, fullById.get(point.id).trueRadius);
}
console.table(summaries);
console.log(`PASS: event counts, determinism, proportional area, fixed size across filters, collision clearance, exact reporting-year positions (${fileURLToPath(base)}).`);
