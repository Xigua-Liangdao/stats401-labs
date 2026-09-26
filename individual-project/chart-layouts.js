/* Deterministic geometry for the two D3 views. No DOM or simulated data. */
(function (root) {
  'use strict';

  const margins = Object.freeze({ left: 64, right: 34, top: 25, bottom: 44 });
  const maxRecords = 2700000000;
  const maxBubbleRadius = 46;
  const scatterRadius = 4.3;
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

  function scatter(events, options = {}) {
    const ctx = context(events, options);
    const height = Math.max(180, Number(options.height) || 430);
    const sizeDomain = [10, 10000000000];
    const y = records => height - margins.bottom
      - (Math.log10(records) - 1) / 9 * (height - margins.top - margins.bottom);
    const maxOffset = ctx.yearSpacing * 0.32;
    const clearance = scatterRadius * 2 + 0.5;
    const ordered = ctx.numeric.slice().sort((a, b) => b.records - a.records
      || a.year - b.year || compareId(a, b));
    const positions = [];
    const coordinateCounts = new Map();
    for (const event of ordered) {
      const key = `${event.year}:${event.records}`;
      coordinateCounts.set(key, (coordinateCounts.get(key) || 0) + 1);
    }
    for (const event of ordered) {
      const baseX = ctx.x(event.year);
      const exactY = y(event.records);
      const neighbors = positions.filter(other => Math.abs(exactY - other.y) < clearance
        && Math.abs(baseX - other.x) < clearance + maxOffset);
      const intervals = neighbors.map(other => {
        const dx = Math.sqrt(clearance * clearance - (exactY - other.y) ** 2);
        return [other.x - baseX - dx, other.x - baseX + dx];
      });
      let offset = nearestFree(intervals, -maxOffset, maxOffset);
      if (offset === null) {
        // In a dense overview, exact y and an honest year band can make total
        // separation impossible. Choose the least crowded valid x and report it.
        const candidates = Array.from({ length: 49 }, (_, index) => -maxOffset + index / 48 * 2 * maxOffset);
        offset = candidates.sort((a, b) => {
          const cost = candidate => neighbors.reduce((sum, other) => {
            const distance = Math.hypot(baseX + candidate - other.x, exactY - other.y);
            return sum + Math.max(0, clearance - distance) ** 2;
          }, 0);
          return cost(a) - cost(b) || Math.abs(a) - Math.abs(b) || a - b;
        })[0];
      }
      positions.push({ id: event.id, year: event.year, records: event.records,
        x: baseX + offset, y: exactY, baseX, xOffset: offset, r: scatterRadius,
        trueRadius: scatterRadius, tiny: false, isCoincident: false, overlapCount: 0,
        coordinateCount: coordinateCounts.get(`${event.year}:${event.records}`) });
    }
    let overlapPairs = 0;
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        const a = positions[i], b = positions[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < 2 * scatterRadius - EPSILON) {
          a.isCoincident = b.isCoincident = true;
          a.overlapCount += 1;
          b.overlapCount += 1;
          overlapPairs += 1;
        }
      }
    }
    return { positions, height, width: ctx.width, xDomain: ctx.xDomain, sizeDomain,
      yearSpacing: ctx.yearSpacing, margins, maxOffset, overlapPairs,
      overlappingEventCount: positions.filter(p => p.isCoincident).length,
      hasOverlap: overlapPairs > 0 };
  }

  function scatterGrouped(events, options = {}) {
    const ctx = context(events, options);
    const height = Math.max(180, Number(options.height) || 430);
    const sizeDomain = [10, 10000000000];
    const y = records => height - margins.bottom
      - (Math.log10(records) - 1) / 9 * (height - margins.top - margins.bottom);
    const joinDistance = 10;
    const groupedRadius = 9;
    const byYear = new Map();
    const ordered = ctx.numeric.slice().sort((a, b) => a.year - b.year
      || b.records - a.records || compareId(a, b));
    for (const event of ordered) {
      if (!byYear.has(event.year)) byYear.set(event.year, []);
      byYear.get(event.year).push({ event, y: y(event.records) });
    }
    const positions = [];
    const describe = members => {
      const first = members[0], last = members[members.length - 1];
      const count = members.length;
      const minRecords = last.event.records, maxRecords = first.event.records;
      return {
        id: first.event.id, members: members.map(member => member.event.id), count,
        year: first.event.year,
        // A grouped badge is a range, not an event at its midpoint. This field
        // is only a convenience for existing tooltip code; use min/maxRecords.
        records: count === 1 ? first.event.records : null,
        x: ctx.x(first.event.year), y: (first.y + last.y) / 2,
        r: count > 1 ? groupedRadius : scatterRadius,
        minRecords, maxRecords, yMin: first.y, yMax: last.y,
        isGroup: count > 1,
      };
    };
    for (const points of byYear.values()) {
      // Adjacent exact coordinates less than ten pixels apart form a connected
      // band. A visible vertical span retains the band's real extent.
      const bands = [];
      for (const point of points) {
        const lastBand = bands[bands.length - 1];
        if (lastBand && point.y - lastBand[lastBand.length - 1].y < joinDistance) lastBand.push(point);
        else bands.push([point]);
      }
      const merged = [];
      for (const band of bands) {
        let current = band;
        while (merged.length) {
          const previous = merged[merged.length - 1];
          const a = describe(previous), b = describe(current);
          // Badge heights, rather than their member span, govern clearance.
          // Recheck the previous band after every merge until stable.
          if (b.y - a.y >= a.r + b.r + 1) break;
          current = merged.pop().concat(current);
        }
        merged.push(current);
      }
      positions.push(...merged.map(describe));
    }
    return {
      positions, height, width: ctx.width, xDomain: ctx.xDomain, sizeDomain,
      yearSpacing: ctx.yearSpacing, margins, joinDistance,
      numericEventCount: ctx.numeric.length,
      groupedNodeCount: positions.filter(point => point.isGroup).length,
      groupedEventCount: positions.filter(point => point.isGroup).reduce((sum, point) => sum + point.count, 0),
      singleEventCount: positions.filter(point => !point.isGroup).length,
    };
  }

  root.BreachLayouts = Object.freeze({ bubble, scatter, scatterGrouped, margins, maxRecords, maxBubbleRadius, scatterRadius });
})(typeof window !== 'undefined' ? window : globalThis);
