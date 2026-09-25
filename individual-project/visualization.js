/* Data Breaches, Reassembled — Teresa Tu, STATS 401.
 * D3 7.9.0, external JSON, stable event IDs. Equal-size marks in all views.
 * Cluster and beeswarm layouts are deterministic. Scale x positions are never
 * jittered: displacement in y only prevents overlap and has no quantitative meaning.
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const svg = d3.select('#breach-chart');
  const stage = $('chart-stage');
  const background = svg.append('g').attr('class', 'layout-background');
  const marks = svg.append('g').attr('class', 'event-marks');
  const selectedLayer = svg.append('g').attr('class', 'selected-layer');
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  stage.appendChild(tooltip);
  const palette = ['#0072B2', '#D55E00', '#009E73', '#A5689B', '#C98D00', '#7C8C88'];
  const state = { events: [], filtered: [], layout: 'sector', year: 2026, search: '', selected: null, playing: false, timer: null, width: 0, sectors: [], methods: [], scaleCache: null };
  const RADIUS = 4.15;
  const GAP = 1.85;
  const DISTANCE = RADIUS * 2 + GAP;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const formatExact = d3.format(',');
  const compact = (n) => n >= 1e9 ? `${d3.format('.3~g')(n / 1e9)}B` : n >= 1e6 ? `${d3.format('.3~g')(n / 1e6)}M` : n >= 1e3 ? `${d3.format('.3~g')(n / 1e3)}k` : formatExact(n);
  const color = (d) => palette[state.sectors.indexOf(d.displaySector)] || palette[5];
  const safeUrl = (value) => { try { const url = new URL(value); return /^(https?:)$/.test(url.protocol) ? url.href : null; } catch { return null; } };
  const countText = (d) => d.records === null ? (d.recordsLabel || 'No comparable count') : `${d.recordsStatus === 'approximate' ? '≈ ' : ''}${formatExact(d.records)}`;
  const visibleEvents = () => state.events.filter((d) => d.year <= state.year && (!state.search || d.searchText.includes(state.search)));
  const announce = (message) => { $('live-status').textContent = message; };
  function stopPlayback() {
    clearInterval(state.timer); state.timer = null; state.playing = false;
    $('play-button').innerHTML = '<span aria-hidden="true">▶</span> Play years';
    $('play-button').setAttribute('aria-label', 'Play through disclosure years');
  }
  function playback() {
    if (state.playing) { stopPlayback(); return; }
    if (state.year >= state.maxYear) state.year = state.minYear;
    state.playing = true;
    $('play-button').innerHTML = '<span aria-hidden="true">Ⅱ</span> Pause';
    $('play-button').setAttribute('aria-label', 'Pause disclosure-year playback');
    update();
    state.timer = setInterval(() => {
      if (state.year >= state.maxYear) { stopPlayback(); announce(`Playback complete. All years through ${state.maxYear} are shown.`); return; }
      state.year += 1; update();
      if (state.year >= state.maxYear) { stopPlayback(); announce(`Playback complete. All years through ${state.maxYear} are shown.`); }
    }, 1150);
  }
  function addText(parent, text, x, y, cls, attrs = {}) {
    const el = parent.append('text').attr('x', x).attr('y', y).attr('class', cls).text(text);
    Object.entries(attrs).forEach(([key, value]) => el.attr(key, value));
    return el;
  }
  function packPoints(n, usableWidth) {
    if (!n) return [];
    const halfColumns = Math.max(1, Math.floor((usableWidth / 2 - RADIUS) / DISTANCE));
    const rowLimit = Math.max(3, Math.ceil(n / (halfColumns * 2)) + 3);
    const candidates = [];
    for (let row = -rowLimit; row <= rowLimit; row += 1) {
      for (let col = -halfColumns; col <= halfColumns; col += 1) {
        const x = (col + (Math.abs(row) % 2) * .5) * DISTANCE;
        const y = row * DISTANCE * Math.sqrt(3) / 2;
        if (Math.abs(x) + RADIUS <= usableWidth / 2) candidates.push({ x, y, distance: x * x + y * y });
      }
    }
    return candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x).slice(0, n);
  }
  function clusterLayout(data, key, groups, width) {
    const columns = width >= 660 ? 3 : width >= 390 ? 2 : 1;
    const gutter = 12;
    const cardWidth = (width - (columns - 1) * gutter) / columns;
    const plans = groups.map((group) => {
      const events = data.filter((d) => d[key] === group).sort((a, b) => d3.ascending(a.id, b.id));
      const offsets = packPoints(events.length, cardWidth - 30);
      const halfHeight = d3.max(offsets, (p) => Math.abs(p.y)) || 0;
      return { group, events, offsets, halfHeight, naturalHeight: Math.max(154, halfHeight * 2 + 87) };
    });
    const positions = new Map();
    let currentY = 0;
    for (let start = 0; start < plans.length; start += columns) {
      const row = plans.slice(start, start + columns);
      const rowHeight = d3.max(row, (p) => p.naturalHeight);
      row.forEach((plan, column) => {
        const left = column * (cardWidth + gutter);
        const card = background.append('g');
        card.append('rect').attr('class', 'chart-group-box').attr('x', left).attr('y', currentY).attr('width', cardWidth).attr('height', rowHeight).attr('rx', 7);
        addText(card, plan.group, left + 13, currentY + 22, 'chart-group-label');
        addText(card, `${plan.events.length} event${plan.events.length === 1 ? '' : 's'}`, left + 13, currentY + 39, 'chart-group-count');
        const centerY = currentY + 48 + (rowHeight - 59) / 2;
        plan.events.forEach((event, i) => positions.set(event.id, { x: left + cardWidth / 2 + plan.offsets[i].x, y: centerY + plan.offsets[i].y }));
        if (!plan.events.length) addText(card, 'No matching events', left + cardWidth / 2, centerY + 4, 'chart-group-count', { 'text-anchor': 'middle' });
      });
      currentY += rowHeight + gutter;
    }
    return { positions, height: Math.max(180, currentY - gutter) };
  }
  function swarm(events, scale) {
    const placed = [];
    const d2 = DISTANCE * DISTANCE;
    events.slice().sort((a, b) => d3.ascending(a.records, b.records) || d3.ascending(a.id, b.id)).forEach((event) => {
      const x = scale(event.records);
      const nearby = placed.filter((point) => Math.abs(point.x - x) < DISTANCE);
      const candidates = [0];
      nearby.forEach((point) => {
        const dy = Math.sqrt(Math.max(0, d2 - (point.x - x) ** 2)) + .02;
        candidates.push(point.y + dy, point.y - dy);
      });
      candidates.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
      const y = candidates.find((candidate) => nearby.every((point) => (point.x - x) ** 2 + (point.y - candidate) ** 2 >= d2 - .001)) ?? 0;
      placed.push({ id: event.id, x, y });
    });
    return placed;
  }
  function scaleLayout(width) {
    if (state.scaleCache?.width === width) return state.scaleCache;
    const narrow = width < 500;
    const margin = { left: 10, right: 6, top: 64, bottom: 28 };
    const unknownWidth = narrow ? 67 : 89;
    const plotRight = width - unknownWidth - 19;
    const knownValues = state.events.filter((d) => d.records !== null).map((d) => d.records);
    const extent = d3.extent(knownValues);
    const lowExponent = Math.floor(Math.log10(extent[0]));
    const highExponent = Math.ceil(Math.log10(extent[1]));
    const x = d3.scaleLog().domain([10 ** lowExponent, 10 ** highExponent]).range([margin.left + 2, plotRight - 8]);
    const plans = state.sectors.map((sector) => {
      const events = state.events.filter((d) => d.displaySector === sector);
      const known = swarm(events.filter((d) => d.records !== null), x);
      const unknownEvents = events.filter((d) => d.records === null);
      const unknownOffsets = packPoints(unknownEvents.length, unknownWidth - 12);
      const unknown = unknownEvents.map((d, i) => ({ id: d.id, x: width - unknownWidth / 2, y: unknownOffsets[i].y, dx: unknownOffsets[i].x }));
      const halfHeight = Math.max(12, d3.max(known, (p) => Math.abs(p.y)) || 0, d3.max(unknown, (p) => Math.abs(p.y)) || 0);
      return { sector, known, unknown, height: halfHeight * 2 + 54, halfHeight };
    });
    const positions = new Map();
    let currentY = margin.top;
    plans.forEach((plan) => {
      plan.top = currentY;
      const center = currentY + 29 + plan.halfHeight;
      plan.known.forEach((p) => positions.set(p.id, { x: p.x, y: center + p.y }));
      plan.unknown.forEach((p) => positions.set(p.id, { x: p.x + p.dx, y: center + p.y }));
      currentY += plan.height;
    });
    state.scaleCache = { width, positions, plans, x, plotRight, unknownWidth, lowExponent, highExponent, height: currentY + margin.bottom };
    return state.scaleCache;
  }
  function drawScale(layout, data) {
    const { x, plotRight, unknownWidth, width, lowExponent, highExponent, height, plans } = layout;
    background.append('rect').attr('class', 'unknown-band').attr('x', width - unknownWidth).attr('y', 0).attr('width', unknownWidth).attr('height', height - 12).attr('rx', 5);
    addText(background, 'REPORTED RECORDS · LOG SCALE', 10, 12, 'scale-axis-label');
    addText(background, '10× per step', 10, 27, 'scale-axis-label');
    addText(background, 'No comparable', width - unknownWidth / 2, 15, 'scale-axis-label', { 'text-anchor': 'middle' });
    addText(background, 'record count', width - unknownWidth / 2, 29, 'scale-axis-label', { 'text-anchor': 'middle' });
    const ticks = d3.range(lowExponent, highExponent + 1).map((p) => 10 ** p);
    const showTicks = ticks;
    const axis = d3.axisTop(x).tickValues(showTicks).tickFormat(compact).tickSize(4).tickPadding(4);
    background.append('g').attr('class', 'scale-axis').attr('transform', 'translate(0,53)').call(axis);
    const grid = background.append('g').attr('class', 'scale-grid');
    ticks.forEach((tick) => grid.append('line').attr('x1', x(tick)).attr('x2', x(tick)).attr('y1', 59).attr('y2', height - 26));
    plans.forEach((plan) => {
      const count = data.filter((d) => d.displaySector === plan.sector).length;
      background.append('line').attr('class', 'scale-lane-rule').attr('x1', 0).attr('x2', width).attr('y1', plan.top).attr('y2', plan.top);
      addText(background, `${plan.sector}  ·  ${count}`, 10, plan.top + 16, 'chart-group-label');
    });
  }
  function showTooltip(event, d) {
    tooltip.replaceChildren();
    const title = document.createElement('strong'); title.textContent = d.organization; tooltip.appendChild(title);
    const details = document.createElement('div'); details.textContent = `${d.year} · ${countText(d)}${d.records !== null ? ' records' : ''}`; tooltip.appendChild(details);
    const hint = document.createElement('div'); hint.textContent = 'Click to inspect'; hint.className = 'tip-small'; tooltip.appendChild(hint);
    tooltip.hidden = false;
    moveTooltip(event);
  }
  function moveTooltip(event) {
    const rect = stage.getBoundingClientRect();
    const maxLeft = Math.max(0, rect.width - tooltip.offsetWidth - 8);
    tooltip.style.left = `${Math.min(maxLeft, Math.max(0, event.clientX - rect.left + 13))}px`;
    tooltip.style.top = `${Math.max(0, event.clientY - rect.top - tooltip.offsetHeight - 10)}px`;
  }
  function selectEvent(id, shouldAnnounce = true) {
    state.selected = id || null;
    $('event-select').value = state.selected || '';
    renderDetail(); renderSelection();
    if (shouldAnnounce && id) { const event = state.events.find((d) => d.id === id); announce(`${event.organization}, ${event.year}, ${countText(event)}. Details shown beside the chart.`); }
  }
  function renderDetail() {
    const panel = $('event-detail');
    const event = state.events.find((d) => d.id === state.selected);
    if (!event) {
      panel.innerHTML = '<div class="detail-empty"><span class="detail-crosshair" aria-hidden="true">⊕</span><h3 id="detail-heading">Every event has a story.</h3><p>Click a dot or choose an event above to see its reported scale, background, and source.</p><p class="detail-tip">Try each layout to follow the selected event as it moves.</p></div>';
      return;
    }
    panel.replaceChildren();
    const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text) node.textContent = text; panel.appendChild(node); return node; };
    el('p', 'event-meta', `Disclosure year · ${event.year}`);
    const heading = el('h3', '', event.organization); heading.id = 'detail-heading';
    el('p', 'detail-number', countText(event));
    el('p', 'detail-number-label', event.records === null ? 'No reliable numeric position assigned' : `${event.recordsStatus === 'approximate' ? 'Approximate' : 'Reported'} records affected`);
    const tags = el('div', 'detail-tags');
    [event.sector, event.method].forEach((value) => { const span = document.createElement('span'); span.textContent = value; tags.appendChild(span); });
    el('p', 'detail-source-fields', `Source industry: ${event.sectorRaw || event.sector}. Source cause: ${event.methodRaw || event.method}.`);
    if (event.recordsNote) el('p', 'detail-caveat', event.recordsNote);
    else if (event.records === null) el('p', 'detail-caveat', 'The source does not establish a reliable numeric count. This event remains visible in a separate column.');
    el('p', 'detail-story', event.story || 'No additional narrative was supplied in the source spreadsheet.');
    const sources = el('div', 'detail-sources', 'Event sources');
    let safeSources = 0;
    (event.sources || []).forEach((source, i) => {
      const href = safeUrl(source.url); if (!href) return;
      const link = document.createElement('a'); link.href = href; link.textContent = `${source.name || `Source ${i + 1}`} ↗`; link.target = '_blank'; link.rel = 'noopener noreferrer'; sources.appendChild(link); safeSources += 1;
    });
    if (!safeSources) { const note = document.createElement('p'); note.textContent = 'No article URL is supplied for this source row; see the dataset spreadsheet.'; sources.appendChild(note); }
  }
  function renderSelection() {
    marks.selectAll('circle.chart-dot').classed('is-selected', (d) => d.id === state.selected).attr('opacity', (d) => !state.selected || d.id === state.selected ? 1 : .62);
    selectedLayer.selectAll('*').remove();
    const selected = state.filtered.find((d) => d.id === state.selected);
    if (!selected || !state.currentPositions) return;
    const point = state.currentPositions.get(selected.id);
    if (!point) return;
    const group = selectedLayer.append('g').attr('transform', `translate(${point.x},${point.y})`);
    group.append('circle').attr('class', 'selection-halo').attr('r', RADIUS + 4);
    const label = selected.organization.length > 27 ? `${selected.organization.slice(0, 26)}…` : selected.organization;
    const anchor = point.x > state.width * .7 ? 'end' : 'start';
    addText(group, label, anchor === 'end' ? -10 : 10, -12, 'selected-caption', { 'text-anchor': anchor });
  }
  function renderDropdown() {
    const select = $('event-select');
    const previous = state.selected;
    select.replaceChildren();
    const prompt = document.createElement('option'); prompt.value = ''; prompt.textContent = state.filtered.length ? `Choose from ${state.filtered.length} events…` : 'No matching events'; select.appendChild(prompt);
    state.filtered.slice().sort((a, b) => d3.ascending(a.organization.toLowerCase(), b.organization.toLowerCase()) || a.year - b.year).forEach((d) => {
      const option = document.createElement('option'); option.value = d.id; option.textContent = `${d.organization} (${d.year}) — ${d.records === null ? (d.recordsLabel || 'no comparable count') : compact(d.records)}`; select.appendChild(option);
    });
    select.disabled = state.filtered.length === 0;
    if (previous && state.filtered.some((d) => d.id === previous)) select.value = previous;
    else if (previous) { state.selected = null; renderDetail(); }
  }
  function update({ resize = false } = {}) {
    if (!state.events.length) return;
    tooltip.hidden = true;
    state.filtered = visibleEvents();
    const width = Math.max(220, Math.floor(stage.clientWidth)); state.width = width;
    $('year-slider').value = state.year; $('year-label').value = state.year;
    $('event-count').textContent = state.filtered.length;
    $('count-label').textContent = `${state.filtered.length === state.events.length ? '' : `of ${state.events.length} `}events shown`;
    const descriptions = {
      sector: ['Which industries appear?', 'Events grouped by industry; each dot has equal visual weight.', 'Position within a group has no data meaning.'],
      method: ['How were records exposed?', 'Events regroup by cause; industry colors remain unchanged.', 'Cause follows the source classification, not an independent forensic finding.'],
      scale: ['How large were the reported breaches?', 'Compare horizontal position; each labeled power-of-ten step represents 10× records.', 'Only horizontal position encodes scale. Vertical offsets prevent overlap.']
    };
    const [title, description, footnote] = descriptions[state.layout];
    $('view-title').textContent = title; $('view-description').textContent = description; $('position-note').textContent = footnote;
    $('chart-svg-title').textContent = `${title} ${state.filtered.length} events through ${state.year}.`;
    $('chart-svg-description').textContent = `${description} ${footnote} Colors indicate industry. Select any visible event with the dropdown for its exact value and source. Unknown, unresolved, and incomparable counts remain visible.`;
    document.querySelectorAll('[data-layout]').forEach((button) => button.setAttribute('aria-pressed', button.dataset.layout === state.layout));
    background.selectAll('*').remove(); selectedLayer.selectAll('*').remove();
    const layout = state.layout === 'scale' ? scaleLayout(width) : clusterLayout(state.filtered, state.layout === 'sector' ? 'displaySector' : 'method', state.layout === 'sector' ? state.sectors : state.methods, width);
    if (state.layout === 'scale') drawScale(layout, state.filtered);
    state.currentPositions = layout.positions;
    svg.attr('viewBox', `0 0 ${width} ${layout.height}`).attr('height', layout.height);
    const duration = prefersReducedMotion.matches || resize ? 0 : 760;
    const transition = svg.transition('layout').duration(duration).ease(d3.easeCubicInOut);
    const dots = marks.selectAll('circle.chart-dot').data(state.filtered, (d) => d.id);
    dots.exit().interrupt('layout').transition('layout').duration(duration ? 210 : 0).attr('r', 0).attr('opacity', 0).remove();
    const enter = dots.enter().append('circle').attr('class', 'chart-dot').attr('r', 0)
      .attr('cx', width / 2).attr('cy', layout.height / 2).attr('fill', color)
      .on('pointerenter', showTooltip).on('pointermove', moveTooltip).on('pointerleave', () => { tooltip.hidden = true; })
      .on('click', (_, d) => { stopPlayback(); selectEvent(d.id); });
    enter.append('title');
    const merged = enter.merge(dots);
    merged.select('title').text((d) => `${d.organization} (${d.year}) — ${countText(d)}${d.records !== null ? ' records' : ''}`);
    merged.interrupt('layout').transition(transition)
      .attr('cx', (d) => layout.positions.get(d.id).x).attr('cy', (d) => layout.positions.get(d.id).y)
      .attr('r', RADIUS).attr('fill', color).attr('opacity', (d) => !state.selected || d.id === state.selected ? 1 : .62);
    renderDropdown();
    if (duration) { transition.on('end.selection', renderSelection); }
    else renderSelection();
    $('chart-status').hidden = state.filtered.length > 0;
    $('chart-status').textContent = 'No events match these filters. Try another name, a later year, or Reset all.';
    if (!state.playing) announce(`${state.filtered.length} of ${state.events.length} events shown through ${state.year}. ${title}`);
  }
  function bindEvents() {
    document.querySelectorAll('[data-layout]').forEach((button) => button.addEventListener('click', () => { state.layout = button.dataset.layout; update(); }));
    $('search').addEventListener('input', (event) => { stopPlayback(); state.search = event.target.value.trim().toLocaleLowerCase(); update(); });
    $('year-slider').addEventListener('input', (event) => { stopPlayback(); state.year = Number(event.target.value); update(); });
    $('play-button').addEventListener('click', playback);
    $('reset-button').addEventListener('click', () => { stopPlayback(); state.year = state.maxYear; state.search = ''; state.selected = null; $('search').value = ''; renderDetail(); update(); });
    $('event-select').addEventListener('change', (event) => { stopPlayback(); selectEvent(event.target.value); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlayback(); });
    let resizeTimer;
    new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (Math.floor(stage.clientWidth) !== state.width) update({ resize: true }); }, 100); }).observe(stage);
  }
  async function init() {
    try {
      const dataset = await d3.json('data/breaches.json');
      if (!Array.isArray(dataset.events) || !dataset.events.length) throw new Error('No events found in the external JSON file.');
      state.events = dataset.events.map((d) => ({ ...d, records: Number.isFinite(d.records) && d.records > 0 ? d.records : null }));
      if (new Set(state.events.map((d) => d.id)).size !== state.events.length) throw new Error('Duplicate event IDs found in the dataset.');
      const sortedSectors = d3.rollups(state.events, (events) => events.length, (d) => d.sector).sort((a, b) => b[1] - a[1] || d3.ascending(a[0], b[0]));
      const topSectors = sortedSectors.slice(0, 5).map(([sector]) => sector);
      const hasOther = sortedSectors.length > 5;
      state.sectors = [...topSectors, ...(hasOther ? ['Other industries'] : [])];
      state.events.forEach((d) => {
        d.displaySector = topSectors.includes(d.sector) ? d.sector : 'Other industries';
        d.searchText = [d.organization, d.sector, d.sectorRaw, d.method, d.methodRaw, d.year].join(' ').toLocaleLowerCase();
      });
      state.methods = d3.rollups(state.events, (events) => events.length, (d) => d.method).sort((a, b) => b[1] - a[1] || d3.ascending(a[0], b[0])).map(([method]) => method);
      [state.minYear, state.maxYear] = d3.extent(state.events, (d) => d.year); state.year = state.maxYear;
      $('year-slider').min = state.minYear; $('year-slider').max = state.maxYear; $('year-slider').value = state.maxYear;
      $('year-min').textContent = state.minYear; $('year-max').textContent = state.maxYear;
      $('grouping-note').textContent = hasOther ? 'Colors show the five most frequent source industries plus Other industries. Full original categories appear in event details.' : 'Industry colors remain consistent across all views.';
      const legend = $('sector-legend');
      state.sectors.forEach((sector, index) => { const label = document.createElement('span'); label.className = 'legend-item'; const dot = document.createElement('span'); dot.className = 'legend-dot'; dot.style.backgroundColor = palette[index]; dot.setAttribute('aria-hidden', 'true'); label.appendChild(dot); label.appendChild(document.createTextNode(sector)); legend.appendChild(label); });
      const unresolved = state.events.filter((d) => d.records === null).length;
      const approximate = state.events.filter((d) => d.recordsStatus === 'approximate' && d.records !== null).length;
      $('data-audit-note').textContent = `Dataset audit: ${state.events.length} events retained; ${unresolved} events without a comparable numeric record count are shown separately in Scale; ${approximate} counts marked approximate. Values reflect the cited snapshot, not a live feed.`;
      $('snapshot-date').textContent = 'Source snapshot: September 25, 2026.';
      bindEvents(); update({ resize: true });
      // Exposes only harmless layout state to support reproducible local QA.
      window.breachExplorer = { getState: () => ({ layout: state.layout, year: state.year, total: state.events.length, visible: state.filtered.length, selected: state.selected, playing: state.playing }), getPositions: () => state.filtered.map((d) => ({ id: d.id, records: d.records, sector: d.displaySector, ...state.currentPositions.get(d.id) })), radius: RADIUS };
    } catch (error) {
      $('chart-status').hidden = false;
      $('chart-status').classList.add('error-panel');
      $('chart-status').textContent = `The dataset could not be loaded. Open this page through the course website or a local web server. ${error.message}`;
      document.querySelectorAll('.explorer-toolbar button, .timeline-controls button, .timeline-controls input, #event-select, #search').forEach((el) => { el.disabled = true; });
      console.error(error);
    }
  }
  init();
})();
