/* Data Breaches, Compared — D3 7.9.0, external frozen JSON.
   A linear, zero-based ranking with persistent event IDs and printed values. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const PAGE_SIZE = 10;
  const state = { events: [], filtered: [], numeric: [], unranked: [], page: 0, selected: null, sector: '', method: '', search: '' };
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const exact = d3.format(',');
  const compact = n => n >= 1e9 ? `${d3.format('.3~g')(n / 1e9)}B` : n >= 1e6 ? `${d3.format('.3~g')(n / 1e6)}M` : n >= 1e3 ? `${d3.format('.3~g')(n / 1e3)}k` : exact(n);
  const count = d => d.records === null ? d.recordsLabel : `${d.recordsStatus === 'approximate' ? '≈ ' : ''}${exact(d.records)}`;
  const brief = d => `${d.recordsStatus === 'approximate' ? '≈ ' : ''}${compact(d.records)}`;
  const safeUrl = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };
  const svg = d3.select('#rank-chart');
  svg.select('title').attr('id', 'rank-svg-title');
  svg.select('desc').attr('id', 'rank-svg-description');
  const grid = svg.append('g').attr('class', 'rank-grid');
  const axis = svg.append('g').attr('class', 'rank-axis');
  const rows = svg.append('g').attr('class', 'rank-rows');
  let resizeTimer, lastWidth = 0;

  function matches(d) {
    return (!state.sector || d.sector === state.sector) && (!state.method || d.method === state.method) && (!state.search || d.searchText.includes(state.search));
  }
  function node(tag, cls, text, parent) {
    const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; if (parent) parent.appendChild(n); return n;
  }
  function wrap(text, max) {
    const result = []; let line = '';
    for (const word of text.split(/\s+/)) {
      if (line && (line.length + word.length + 1) > max) { result.push(line); line = ''; }
      if (word.length > max) {
        if (line) { result.push(line); line = ''; }
        for (let k = 0; k < word.length; k += max) result.push(word.slice(k, k + max));
      } else line += (line ? ' ' : '') + word;
    }
    if (line) result.push(line);
    return result.length ? result : ['Unnamed event'];
  }
  function selectEvent(d) {
    state.selected = d.id;
    renderDetail();
    rows.selectAll('.rank-row').classed('is-selected', e => e.id === d.id).attr('aria-pressed', e => e.id === d.id);
    rows.selectAll('.rank-bar').attr('fill', e => e.id === d.id ? '#c75b37' : '#257b78');
    document.querySelectorAll('.unranked-event').forEach(el => el.setAttribute('aria-pressed', el.dataset.eventId === d.id));
    $('live-status').textContent = `${d.organization}, ${d.year}. ${count(d)}${d.records !== null ? ' reported records' : ''}. Source details updated below the chart.`;
  }
  function renderDetail() {
    const target = $('selection-detail'); target.replaceChildren();
    const d = state.filtered.find(e => e.id === state.selected);
    if (!d) { node('p', 'detail-kicker', 'EVENT DETAILS', target); node('h3', 'detail-heading', 'Select a named row to read its source.', target); return; }
    node('p', 'detail-kicker', `SELECTED EVENT · REPORTED ${d.year}`, target);
    const top = node('div', 'detail-top', undefined, target);
    node('h3', 'detail-heading', d.organization, top);
    node('p', 'detail-value', `${count(d)}${d.records !== null ? ' reported records' : ''}`, top);
    node('p', 'detail-meta', `${d.sector} · ${d.method}`, target);
    if (d.recordsNote) node('p', 'detail-caveat', d.recordsNote, target);
    node('p', 'detail-story', d.story || 'No event narrative was supplied in the source spreadsheet.', target);
    const links = node('div', 'detail-sources', undefined, target);
    node('span', '', 'Source: ', links);
    let total = 0;
    (d.sources || []).forEach((s, i) => { const url = safeUrl(s.url); if (!url) return; const a = node('a', '', `${s.name || `Article ${i + 1}`} ↗`, links); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; total++; });
    if (!total) node('span', '', 'No article link supplied; see the source spreadsheet.', links);
    node('p', 'detail-raw', `Original classifications: ${d.sectorRaw || d.sector} / ${d.methodRaw || d.method}. Reporting year is the source's “year story broke”.`, target);
  }
  function renderRanking() {
    const w = Math.max(260, Math.floor($('rank-stage').clientWidth)); lastWidth = w;
    const narrow = w < 650;
    const left = narrow ? 0 : Math.min(270, Math.max(212, Math.round(w * .26)));
    const right = narrow ? 10 : 144;
    const plotWidth = Math.max(80, w - left - right);
    const max = d3.max(state.numeric, d => d.records) || 1;
    const x = d3.scaleLinear().domain([0, max]).nice(4).range([left, left + plotWidth]);
    const page = state.numeric.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
    let y = 50;
    const data = page.map((d, i) => {
      const maxChars = narrow ? Math.max(17, Math.floor((w - 115) / 6.5)) : Math.floor((left - 48) / 7.1);
      const lines = wrap(d.organization, maxChars);
      const height = narrow ? Math.max(75, lines.length * 17 + 50) : Math.max(57, lines.length * 17 + 26);
      const row = { ...d, lines, y, height, rank: state.page * PAGE_SIZE + i + 1 }; y += height; return row;
    });
    const h = page.length ? y + 9 : 70;
    svg.style('display', page.length ? null : 'none').attr('viewBox', `0 0 ${w} ${h}`).attr('height', h).attr('role', 'group').attr('aria-labelledby', 'rank-svg-title rank-svg-description');
    svg.select('#rank-svg-title').text(`Reported breach sizes, ranks ${state.page * 10 + 1}–${state.page * 10 + page.length} of ${state.numeric.length}`);
    svg.select('#rank-svg-description').text('Horizontal bar lengths show source-reported records on a linear axis starting at zero. Each row prints its organization, reporting year, and value. Activate a row to show its sources below.');
    axis.attr('transform', 'translate(0,32)').call(d3.axisTop(x).ticks(narrow ? 3 : 4).tickSize(0).tickPadding(9).tickFormat(compact));
    axis.select('.domain').attr('stroke', '#aabbb7');
    axis.selectAll('text').attr('fill', '#526561').attr('font-size', narrow ? 10 : 11);
    grid.selectAll('line').data(x.ticks(narrow ? 3 : 4)).join('line').attr('x1', d => x(d)).attr('x2', d => x(d)).attr('y1', 36).attr('y2', h).attr('stroke', '#e2e8e2').attr('stroke-dasharray', d => d === 0 ? null : '2 4');
    const join = rows.selectAll('g.rank-row').data(data, d => d.id);
    join.exit().interrupt().remove();
    const enter = join.enter().append('g').attr('class', 'rank-row').attr('tabindex', 0).attr('role', 'button').attr('transform', d => `translate(0,${d.y})`);
    enter.append('rect').attr('class', 'rank-hit');
    enter.append('line').attr('class', 'rank-rule');
    enter.append('text').attr('class', 'rank-index');
    enter.append('text').attr('class', 'rank-name');
    enter.append('text').attr('class', 'rank-meta');
    enter.append('rect').attr('class', 'rank-bar').attr('width', 0).attr('rx', 2);
    enter.append('text').attr('class', 'rank-value');
    const merged = enter.merge(join).order().attr('aria-label', d => `Rank ${d.rank}. ${d.organization}, ${d.year}. ${count(d)} reported records. Read source details.`).attr('aria-pressed', d => d.id === state.selected).classed('is-selected', d => d.id === state.selected)
      .on('click', (_, d) => selectEvent(d)).on('keydown', (event, d) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectEvent(d); } });
    merged.interrupt().transition().duration(motion.matches ? 0 : 380).attr('transform', d => `translate(0,${d.y})`);
    merged.select('.rank-hit').attr('x', 0).attr('y', -4).attr('width', w).attr('height', d => d.height - 2).attr('fill', 'transparent').attr('rx', 4);
    merged.select('.rank-rule').attr('x1', 0).attr('x2', w).attr('y1', d => d.height - 4).attr('y2', d => d.height - 4).attr('stroke', '#e3e7e0');
    merged.select('.rank-index').attr('x', 0).attr('y', 16).attr('fill', '#7c8c88').attr('font-size', 11).text(d => String(d.rank).padStart(2, '0'));
    merged.select('.rank-name').attr('x', 29).attr('y', 16).attr('fill', '#19332f').attr('font-size', narrow ? 12 : 14).attr('font-weight', 650).each(function (d) {
      d3.select(this).selectAll('tspan').data(d.lines).join('tspan').attr('x', 29).attr('dy', (_, i) => i ? 17 : 0).text(t => t);
    });
    merged.select('.rank-meta').attr('x', 29).attr('y', d => d.lines.length * 17 + 15).attr('fill', '#71807b').attr('font-size', 10).text(d => narrow ? `${d.year}` : `${d.year} · ${d.sector}`);
    merged.select('.rank-bar').attr('x', x(0)).attr('y', d => narrow ? d.lines.length * 17 + 27 : Math.round((d.height - 24) / 2) - 1).attr('height', narrow ? 12 : 22).attr('fill', d => d.id === state.selected ? '#c75b37' : '#257b78').interrupt().transition().duration(motion.matches ? 0 : 450).attr('width', d => x(d.records) - x(0));
    merged.select('.rank-value').attr('x', w - 3).attr('y', d => narrow ? 17 : Math.round(d.height / 2) + 3).attr('text-anchor', 'end').attr('fill', '#19332f').attr('font-size', narrow ? 10 : 13).attr('font-weight', 700).text(count);
    $('empty-state').hidden = page.length > 0;
    $('empty-state').textContent = state.filtered.length ? 'No comparable numeric counts in this selection. The named events are listed below.' : 'No events match. Try another name or reset the filters.';
    $('rank-stage').classList.toggle('is-empty', page.length === 0);
    $('prev-page').disabled = state.page === 0;
    $('next-page').disabled = (state.page + 1) * PAGE_SIZE >= state.numeric.length;
    $('page-status').textContent = page.length ? `Showing ${state.page * 10 + 1}–${state.page * 10 + page.length} of ${state.numeric.length} ranked events` : 'No ranked events';
  }
  function renderSummary(key, targetId) {
    const container = $(targetId); container.replaceChildren();
    const groups = d3.rollups(state.filtered, v => v.length, d => d[key]).sort((a, b) => d3.descending(a[1], b[1]) || d3.ascending(a[0], b[0]));
    if (!groups.length) { node('p', 'summary-empty', 'No matching events.', container); return; }
    const max = Math.max(...['sector', 'method'].flatMap(k => d3.rollups(state.filtered, v => v.length, d => d[k]).map(g => g[1])));
    const makeButton = ([label, n], parent) => {
      const btn = node('button', 'summary-row', undefined, parent); btn.type = 'button'; btn.setAttribute('aria-pressed', state[key] === label); btn.setAttribute('aria-label', `Filter ${key === 'sector' ? 'industry' : 'cause'}: ${label}, ${n} events`);
      const line = node('span', 'summary-line', undefined, btn);
      node('span', 'summary-label', label, line); node('span', 'summary-count', String(n), line);
      const track = node('span', 'summary-track', undefined, btn); const fill = node('span', 'summary-fill', undefined, track); fill.style.width = `${n / max * 100}%`;
      btn.addEventListener('click', () => { state[key] = state[key] === label ? '' : label; $(key === 'sector' ? 'sector-filter' : 'method-filter').value = state[key]; update(true); $('ranking-title').scrollIntoView({ behavior: motion.matches ? 'auto' : 'smooth', block: 'start' }); });
    };
    groups.slice(0, 5).forEach(g => makeButton(g, container));
    if (groups.length > 5) { const more = node('details', 'summary-more', undefined, container); node('summary', '', `Show ${groups.length - 5} more ${key === 'sector' ? (groups.length === 6 ? 'industry' : 'industries') : (groups.length === 6 ? 'cause' : 'causes')}`, more); groups.slice(5).forEach(g => makeButton(g, more)); }
  }
  function renderUnranked() {
    $('unranked-title').textContent = `${state.unranked.length} matching event${state.unranked.length === 1 ? '' : 's'} without a comparable record count`;
    const list = $('unranked-list'); list.replaceChildren();
    if (!state.unranked.length) { node('p', '', 'Every matching event has a numeric count.', list); return; }
    state.unranked.slice().sort((a, b) => d3.ascending(a.organization, b.organization) || d3.ascending(a.year, b.year)).forEach(d => {
      const button = node('button', 'unranked-event', undefined, list); button.type = 'button'; button.dataset.eventId = d.id; button.setAttribute('aria-pressed', d.id === state.selected);
      node('strong', '', `${d.organization} · ${d.year}`, button); node('span', '', d.recordsLabel || 'No comparable count', button);
      if (d.recordsNote) node('small', '', d.recordsNote, button);
      button.addEventListener('click', () => { selectEvent(d); $('selection-detail').scrollIntoView({ behavior: motion.matches ? 'auto' : 'smooth', block: 'nearest' }); });
    });
  }
  function update(resetPage = false) {
    if (resetPage) state.page = 0;
    state.filtered = state.events.filter(matches);
    state.numeric = state.filtered.filter(d => Number.isFinite(d.records)).sort((a, b) => d3.descending(a.records, b.records) || d3.ascending(a.organization, b.organization) || d3.ascending(a.id, b.id));
    state.unranked = state.filtered.filter(d => d.records === null);
    state.page = Math.max(0, Math.min(state.page, Math.ceil(state.numeric.length / PAGE_SIZE) - 1));
    const currentPage = state.numeric.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
    if (!state.filtered.some(d => d.id === state.selected)) state.selected = currentPage[0]?.id || state.unranked[0]?.id || null;
    $('result-count').textContent = `${state.filtered.length} of ${state.events.length} events`;
    $('ranking-title').textContent = state.page ? 'Continue the ranking.' : 'Which reported breaches were largest?';
    $('ranking-subtitle').textContent = 'Reported records · linear scale from zero · ≈ marks an approximate source count';
    const leader = state.numeric[0];
    $('ranking-summary').textContent = leader ? `${leader.organization} (${leader.year}) has the largest reported count in this selection: ${brief(leader)} records. ${state.unranked.length ? `${state.unranked.length} events cannot be ranked numerically.` : ''}` : 'No comparable record counts in this selection.';
    renderRanking(); renderDetail(); renderSummary('sector', 'sector-summary'); renderSummary('method', 'method-summary'); renderUnranked();
    $('live-status').textContent = `${state.filtered.length} matching events. ${$('page-status').textContent}. ${state.unranked.length} without comparable counts.`;
  }
  function install() {
    $('search').addEventListener('input', event => { state.search = event.target.value.trim().toLocaleLowerCase(); update(true); });
    [['sector-filter', 'sector'], ['method-filter', 'method']].forEach(([id, key]) => $(id).addEventListener('change', event => { state[key] = event.target.value; update(true); }));
    $('reset-button').addEventListener('click', () => { state.search = state.sector = state.method = ''; state.selected = null; $('search').value = ''; $('sector-filter').value = ''; $('method-filter').value = ''; update(true); });
    $('prev-page').addEventListener('click', () => { state.page--; state.selected = null; update(); });
    $('next-page').addEventListener('click', () => { state.page++; state.selected = null; update(); });
    new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (Math.floor($('rank-stage').clientWidth) !== lastWidth) renderRanking(); }, 80); }).observe($('rank-stage'));
  }
  d3.json('data/breaches.json').then(data => {
    if (!Array.isArray(data.events) || !data.events.length) throw new Error('Missing event data');
    state.events = data.events.map(d => ({ ...d, searchText: [d.organization, d.year, d.sector, d.sectorRaw, d.method, d.methodRaw].join(' ').toLocaleLowerCase() }));
    [['sector-filter', 'sector', 'All industries'], ['method-filter', 'method', 'All causes']].forEach(([id, key, label]) => {
      const select = $(id); select.replaceChildren(); node('option', '', label, select).value = '';
      Array.from(new Set(state.events.map(d => d[key]))).sort(d3.ascending).forEach(value => { node('option', '', value, select).value = value; });
    });
    $('snapshot-date').textContent = 'Snapshot: September 25, 2026';
    $('data-audit-note').textContent = '539 source events · 499 numeric counts · 40 unranked entries (11 unknown, 28 unresolved possible placeholders, 1 incompatible unit).';
    update(); install();
  }).catch(error => { console.error(error); $('empty-state').hidden = false; $('empty-state').textContent = 'The data could not be loaded. Reload this page or download the source JSON below.'; $('result-count').textContent = 'Data unavailable'; });
})();
