/* Deterministic geometry for the D3 bubble timeline. No DOM or simulated data. */
(function (root) {
  'use strict';

  const margins = Object.freeze({ left: 64, right: 34, top: 25, bottom: 44 });
  const maxRecords = 2700000000;
  const maxBubbleRadius = 46;
  const EPSILON = 1e-7;

  function context(events, options = {}) {
    const width = Math.max(160, Number(options.width) || 1100);
    let yearStart = Number.isFinite(Number(options.yearStart)) ? Number(options.yearStart) : 2004;
    let yearEnd = Number.isFinite(Number(options.yearEnd)) ? Number(options.yearEnd) : 2026;
    if (yearStart > yearEnd) [yearStart, yearEnd] = [yearEnd, yearStart];
    const xDomain = [yearStart - 0.6, yearEnd + 0.6];
    const yearSpacing = (width - margins.left - margins.right) / (xDomain[1] - xDomain[0]);
    const x = year => margins.left + (year - xDomain[0]) * yearSpacing;
    const numeric = events.filter(event => Number.isFinite(event.records) && event.records > 0
      && Number.isFinite(event.year) && event.year >= yearStart && event.year <= yearEnd);
    return { width, yearStart, yearEnd, xDomain, yearSpacing, x, numeric };
  }

  function compareId(a, b) {
    return String(a.id).localeCompare(String(b.id), 'en');
  }

  // Find the point nearest zero outside the union of open forbidden intervals.
  // Interval endpoints are valid: circles are tangent there, never overlapping.
  function nearestFree(intervals, lower = -Infinity, upper = Infinity) {
    const clipped = intervals.filter(([a, b]) => b > lower && a < upper)
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const merged = [];
    for (const interval of clipped) {
      const last = merged[merged.length - 1];
      if (last && interval[0] < last[1] - EPSILON) last[1] = Math.max(last[1], interval[1]);
      else merged.push(interval.slice());
    }
    const candidates = [Math.max(lower, Math.min(upper, 0))];
    for (const [a, b] of merged) {
      if (a >= lower && a <= upper) candidates.push(a);
      if (b >= lower && b <= upper) candidates.push(b);
    }
    if (Number.isFinite(lower)) candidates.push(lower);
    if (Number.isFinite(upper)) candidates.push(upper);
    candidates.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
    for (const candidate of candidates) {
      if (!merged.some(([a, b]) => candidate > a + EPSILON && candidate < b - EPSILON)) return candidate;
    }
    return null;
  }

  function bubble(events, options = {}) {
    const ctx = context(events, options);
    const desiredHeight = Math.max(400, Number(options.height) || 440);
    const ordered = ctx.numeric.slice().sort((a, b) => b.records - a.records || compareId(a, b));
    const positions = [];
    for (const event of ordered) {
      const trueRadius = maxBubbleRadius * Math.sqrt(event.records / maxRecords);
      const collisionRadius = Math.max(trueRadius, 2.8) + 1.5;
      const x = ctx.x(event.year);
      const intervals = [];
      for (const other of positions) {
        const dx = Math.abs(x - other.x);
        const clearance = collisionRadius + other.collisionRadius;
        if (dx < clearance) {
          const dy = Math.sqrt(clearance * clearance - dx * dx);
          intervals.push([other.y - dy, other.y + dy]);
        }
      }
      const y = nearestFree(intervals);
      positions.push({ id: event.id, year: event.year, records: event.records, x, y,
        r: Math.max(trueRadius, 2.8), trueRadius, tiny: trueRadius < 2.8, collisionRadius });
    }
    const minY = positions.length ? Math.min(...positions.map(p => p.y - p.collisionRadius)) : 0;
    const maxY = positions.length ? Math.max(...positions.map(p => p.y + p.collisionRadius)) : 0;
    const contentHeight = maxY - minY;
    const height = Math.ceil(Math.max(desiredHeight, contentHeight + margins.top + margins.bottom));
    const shiftY = margins.top + (height - margins.top - margins.bottom - contentHeight) / 2 - minY;
    positions.forEach(p => { p.y += shiftY; });
    return { positions, height, width: ctx.width, xDomain: ctx.xDomain,
      yearSpacing: ctx.yearSpacing, margins, maxRecords, maxBubbleRadius,
      tinyCount: positions.filter(p => p.tiny).length };
  }

  root.BreachLayouts = Object.freeze({ bubble, margins, maxRecords, maxBubbleRadius });
})(typeof window !== 'undefined' ? window : globalThis);
