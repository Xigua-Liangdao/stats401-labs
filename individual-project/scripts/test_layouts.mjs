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

for (const width of [360, 750, 1100]) {
  for (const [yearStart, yearEnd] of [[2004, 2026], [2018, 2026]]) {
    const options = { width, yearStart, yearEnd };
    const numeric = events.filter(e => typeof e.records === 'number' && e.year >= yearStart && e.year <= yearEnd);
    const bubble = layouts.bubble(events, options);
    const scatter = layouts.scatter(events, { ...options, height: 430 });
    const grouped = layouts.scatterGrouped(events, { ...options, height: 430 });
    for (const result of [bubble, scatter]) {
      assert.equal(result.positions.length, numeric.length);
      assert.equal(new Set(result.positions.map(p => p.id)).size, numeric.length);
      assert.ok(result.positions.every(p => [p.x, p.y, p.r].every(Number.isFinite)));
      assert.deepEqual(JSON.stringify(result), JSON.stringify(result === bubble
        ? layouts.bubble(events.slice().reverse(), options)
        : layouts.scatter(events.slice().reverse(), { ...options, height: 430 })), 'Input order must not change layout');
    }
    for (const point of bubble.positions) {
      approximately(point.trueRadius ** 2 / layouts.maxBubbleRadius ** 2, point.records / layouts.maxRecords);
      approximately(point.x, 64 + (point.year - bubble.xDomain[0]) * bubble.yearSpacing);
      assert.equal(point.tiny, point.trueRadius < 2.8);
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
    for (const point of scatter.positions) {
      approximately(point.y, 386 - (Math.log10(point.records) - 1) / 9 * 361);
      assert.ok(Math.abs(point.xOffset) <= scatter.yearSpacing * 0.32 + 1e-6);
      approximately(point.x, point.baseX + point.xOffset);
      assert.equal(point.r, 4.3);
    }
    const members = grouped.positions.flatMap(point => point.members);
    assert.equal(members.length, numeric.length);
    assert.equal(new Set(members).size, numeric.length, 'Every event belongs to exactly one group or singleton');
    assert.deepEqual([...members].sort(), numeric.map(event => event.id).sort());
    assert.equal(JSON.stringify(grouped), JSON.stringify(layouts.scatterGrouped(events.slice().reverse(), { ...options, height: 430 })));
    const byId = new Map(numeric.map(event => [event.id, event]));
    for (const point of grouped.positions) {
      const groupEvents = point.members.map(id => byId.get(id));
      assert.equal(point.count, groupEvents.length);
      assert.ok(groupEvents.every(event => event.year === point.year));
      assert.equal(point.minRecords, Math.min(...groupEvents.map(event => event.records)));
      assert.equal(point.maxRecords, Math.max(...groupEvents.map(event => event.records)));
      approximately(point.yMin, 386 - (Math.log10(point.maxRecords) - 1) / 9 * 361);
      approximately(point.yMax, 386 - (Math.log10(point.minRecords) - 1) / 9 * 361);
      approximately(point.y, (point.yMin + point.yMax) / 2);
      approximately(point.x, 64 + (point.year - grouped.xDomain[0]) * grouped.yearSpacing);
      assert.equal(point.isGroup, point.count > 1);
      assert.equal(point.r, point.isGroup ? 9 : 4.3);
      assert.equal(point.records, point.isGroup ? null : groupEvents[0].records);
    }
    for (let i = 0; i < grouped.positions.length; i++) {
      for (let j = i + 1; j < grouped.positions.length; j++) {
        const a = grouped.positions[i], b = grouped.positions[j];
        if (a.year === b.year) assert.ok(Math.abs(a.y - b.y) >= a.r + b.r + 1 - 1e-6,
          `Same-year grouped badge collision: ${a.id}, ${b.id}`);
      }
    }
    summaries.push({ width, years: `${yearStart}–${yearEnd}`, count: numeric.length,
      bubbleHeight: bubble.height, tinyMarkers: bubble.tinyCount,
      scatterOverlapPairs: scatter.overlapPairs, scatterOverlappingEvents: scatter.overlappingEventCount,
      groupedNodes: grouped.positions.length, groupedBadges: grouped.groupedNodeCount });
  }
}
for (const method of ['bubble', 'scatter', 'scatterGrouped']) {
  assert.equal(layouts[method]([], { width: 360 }).positions.length, 0);
  const oneYear = layouts[method](events, { width: 360, yearStart: 2023, yearEnd: 2023 });
  assert.equal(method === 'scatterGrouped' ? oneYear.positions.reduce((sum, point) => sum + point.count, 0) : oneYear.positions.length, 49);
}
console.table(summaries);
console.log(`PASS: counts, determinism, proportional area, collision-free bubbles, exact log-y, honest year jitter, grouped partition/ranges/clearance (${fileURLToPath(base)}).`);
