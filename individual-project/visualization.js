/* D3 views share one filter, selection and comparison state. */
(async function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const compact = n => n == null ? 'Count unavailable' : n >= 1e9 ? `${d3.format('.3~g')(n / 1e9)}B` : n >= 1e6 ? `${d3.format('.3~g')(n / 1e6)}M` : n >= 1e3 ? `${d3.format('.3~g')(n / 1e3)}k` : d3.format(',')(n);
  const label = e => `${e.recordsStatus === 'approximate' ? '≈ ' : ''}${compact(e.records)}`;
  const motion = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240;
  let data;
  try { data = await d3.json('data/breaches.json'); }
  catch (error) { $('result-count').textContent = 'Data could not be loaded. Please refresh.'; console.error(error); return; }
  const events = data.events;
  const byId = new Map(events.map(e => [e.id, e]));
  const yearMin = d3.min(events, e => e.year), yearMax = d3.max(events, e => e.year);
  const initial = events.find(e => e.organization === 'National Public Data') || events[0];
  const ticket = events.find(e => e.organization === 'Ticketmaster' && e.year === 2024);
  const state = {view:new URL(location.href).searchParams.get('view') === 'scatter' ? 'scatter' : 'bubbles', query:'', sector:'', method:'', start:yearMin, end:yearMax, selected:initial.id, compare:[initial.id, ticket?.id].filter(Boolean), page:0, order:'latest', group:null};
  const colors = new Map([['Web','#247c78'],['Government','#5363a2'],['Health','#c86642'],['Retail','#ae853b'],['Finance','#9b597e'],['Other industries','#8b9787']]);
  const color = e => colors.get(e.sector) || colors.get('Other industries');
  let focused = [], base = [], layout, xScale, yScale, renderedWidth = 0;
  let brush, brushGroup, overviewX, syncingBrush = false;
  const announce = message => { $('live-status').textContent = message; };
  const inFocus = e => focused.some(item => item.id === e.id);
  function baseMatch(e) {
    const query = state.query.toLowerCase().trim();
    return (!state.sector || e.sector === state.sector) && (!state.method || e.method === state.method)
      && (!query || `${e.organization} ${e.sector} ${e.method}`.toLowerCase().includes(query));
  }
  function populate(select, values) {
    values.forEach(value => select.add(new Option(value, value)));
  }
  populate($('sector-filter'), [...new Set(events.map(e => e.sector))].sort());
  populate($('method-filter'), [...new Set(events.map(e => e.method))].sort());
  ['year-start','year-end'].forEach(id => populate($(id), d3.range(yearMin, yearMax + 1)));
  $('sector-legend').innerHTML = [...colors].map(([name,fill]) => `<span class="legend-item"><span class="legend-dot" style="background:${fill}"></span>${name}</span>`).join('');
  $('data-audit-note').textContent = 'The snapshot retains 539 source events, including below-threshold entries. Of these, 499 have usable numeric counts. The other 40 comprise 11 explicitly unknown values, 28 uncorroborated possible placeholders, and one count of systems rather than records. Treat unresolved values as uncertain, not proven unknown. Seventeen numeric labels are approximate.';

  function render() {
    base = events.filter(baseMatch);
    focused = base.filter(e => e.year >= state.start && e.year <= state.end);
    $('result-count').textContent = `${focused.length} events in focus · ${events.length} in the source collection`;
    $('focus-summary').textContent = `${state.start}–${state.end} · ${focused.filter(e => e.records != null).length} numeric events · ${focused.filter(e => e.records == null).length} without a comparable count`;
    $('year-start').value = state.start;
    $('year-end').value = state.end;
    $('year-window').textContent = `${state.start}–${state.end}`;
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', button.dataset.view === state.view));
    $('view-title').textContent = state.view === 'bubbles' ? 'A · Bubble timeline' : 'B · Time × size';
    $('view-description').textContent = state.view === 'bubbles'
      ? 'One circle per numeric event. Solid area shows reported records; horizontal position shows the reporting year.'
      : 'Year runs left to right. Higher means more reported records; each vertical step is 10×. Click a numbered group to see its events.';
    drawMain(); drawOverview(); drawList(); drawDetails(); drawComparison();
  }
  function setYears(start, end) {
    state.start = Math.max(yearMin, Math.min(yearMax, start));
    state.end = Math.max(state.start, Math.min(yearMax, end));
    state.page = 0; state.group = null; render();
    announce(`Focused on reporting years ${state.start} through ${state.end}. ${focused.length} events.`);
  }
  function selectEvent(id) {
    state.selected = id; drawMain(); drawList(); drawDetails();
    announce(`${byId.get(id).organization}, ${label(byId.get(id))}, selected.`);
  }
  function tooltip(event, html) {
    const node = $('chart-tooltip');
    node.innerHTML = html; node.hidden = false;
    const [px,py] = d3.pointer(event, $('chart-stage'));
    node.style.left = `${Math.min(layout.width - 265, Math.max(5, px + 15))}px`;
    node.style.top = `${Math.max(5, py - 64)}px`;
  }
  function hideTooltip() { $('chart-tooltip').hidden = true; }
  function drawMain() {
    hideTooltip();
    const width = $('chart-stage').clientWidth;
    renderedWidth = width;
    const options = {width,height:state.view === 'bubbles' ? 440 : 500,yearStart:state.start,yearEnd:state.end};
    layout = state.view === 'bubbles' ? BreachLayouts.bubble(focused, options) : BreachLayouts.scatterGrouped(focused, options);
    const {height,margins:m} = layout;
    xScale = d3.scaleLinear().domain(layout.xDomain).range([m.left,width-m.right]);
    yScale = d3.scaleLog().domain([10,1e10]).range([height-m.bottom,m.top]);
    const svg = d3.select('#main-chart').attr('viewBox',`0 0 ${width} ${height}`).attr('data-view',state.view).attr('data-event-count',focused.filter(e=>e.records!=null).length);
    svg.selectAll('g, text').remove();
    $('chart-title').textContent = `${$('view-title').textContent}, reporting years ${state.start}–${state.end}`;
    $('chart-description').textContent = state.view === 'bubbles'
      ? 'Circle solid area is proportional to reported records. Vertical position only separates events. Outlined tiny-event rings are visibility targets. Use the named event list below for keyboard access to every event.'
      : 'Horizontal position is exact reporting year. Vertical position is logarithmic reported records, from ten to ten billion. Numbered badges group nearby same-year events; their lines show minimum to maximum values. Use the named list below to select individual events.';
    const ticks = d3.range(state.start,state.end+1).filter((year,i) => (state.end-state.start <= 12) || i%2===0 || year===state.end);
    svg.append('g').attr('class','grid').selectAll('line').data(ticks).join('line').attr('x1',d=>xScale(d)).attr('x2',d=>xScale(d)).attr('y1',m.top).attr('y2',height-m.bottom);
    if (state.view === 'scatter') {
      const powers=d3.range(1,11).map(n=>10**n);
      svg.append('g').attr('class','grid').selectAll('line').data(powers).join('line').attr('x1',m.left).attr('x2',width-m.right).attr('y1',yScale).attr('y2',yScale);
      svg.append('g').attr('class','axis').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(yScale).tickValues(powers).tickFormat(compact).tickSize(0).tickPadding(10));
      svg.append('text').attr('class','plot-label').attr('x',m.left).attr('y',13).text('Reported records · logarithmic scale');
    } else svg.append('text').attr('class','plot-label').attr('x',m.left).attr('y',13).text('Vertical position separates events; it does not encode a variable.');
    svg.append('g').attr('class','axis').attr('transform',`translate(0,${height-m.bottom})`).call(d3.axisBottom(xScale).tickValues(ticks).tickFormat(d3.format('d')).tickSize(4).tickPadding(7));
    svg.append('text').attr('class','plot-label').attr('x',width-m.right).attr('y',height-5).attr('text-anchor','end').text('Reporting year');
    const marks = svg.append('g').attr('class','marks');
    if (state.view === 'bubbles') {
      const nodes=marks.selectAll('g').data(layout.positions,d=>d.id).join('g').attr('class','bubble-event').attr('data-id',d=>d.id);
      nodes.append('circle').attr('class','event-mark').attr('cx',d=>d.x).attr('cy',d=>d.y).attr('r',d=>d.trueRadius).attr('fill',d=>color(byId.get(d.id))).attr('fill-opacity',.85);
      nodes.filter(d=>d.tiny).append('circle').attr('class','visibility-target').attr('cx',d=>d.x).attr('cy',d=>d.y).attr('r',2.8).attr('fill','none').attr('stroke',d=>color(byId.get(d.id))).attr('stroke-width',1);
      nodes.append('circle').attr('class','event-mark hit-target').attr('cx',d=>d.x).attr('cy',d=>d.y).attr('r',d=>Math.max(d.r,4.3)).attr('fill','transparent').on('click',(ev,d)=>selectEvent(d.id)).on('pointermove',(ev,d)=>{const e=byId.get(d.id);tooltip(ev,`<strong>${escape(e.organization)}</strong><br>${e.year} · ${label(e)} reported records<br>${escape(e.sector)} · ${escape(e.method)}<br>Click for the event story`);}).on('pointerleave',hideTooltip).append('title').text(d=>`${byId.get(d.id).organization}, ${d.year}, ${label(byId.get(d.id))}`);
      drawSizeLegend();
    } else {
      $('size-legend').hidden = true;
      const nodes=marks.selectAll('g').data(layout.positions,d=>d.id).join('g').attr('data-id',d=>d.id).attr('data-members',d=>d.members.join(',')).attr('data-count',d=>d.count).attr('class',d=>d.isGroup?'group-badge':'singleton');
      nodes.filter(d=>d.isGroup).append('line').attr('x1',d=>d.x).attr('x2',d=>d.x).attr('y1',d=>d.yMin).attr('y2',d=>d.yMax);
      nodes.append('circle').attr('class','event-mark').attr('cx',d=>d.x).attr('cy',d=>d.y).attr('r',d=>d.r).attr('fill',d=>d.isGroup?'#e3ebe0':color(byId.get(d.id)));
      nodes.filter(d=>d.isGroup).append('text').attr('x',d=>d.x).attr('y',d=>d.y+3.3).attr('text-anchor','middle').text(d=>d.count);
      nodes.on('click',(ev,d)=>{
        if (d.isGroup) {state.group={members:d.members,year:d.year,min:d.minRecords,max:d.maxRecords};state.page=0;state.selected=d.members[0];drawMain();drawList();drawDetails();announce(`${d.count} events in ${d.year}. The named event list now shows this group's members.`);$('group-focus').scrollIntoView({block:'nearest',behavior:motion?'smooth':'auto'});}
        else {state.group=null;selectEvent(d.id);}
      }).on('pointermove',(ev,d)=>{
        const e=byId.get(d.id);
        tooltip(ev,d.isGroup?`<strong>${d.count} events · ${d.year}</strong><br>${compact(d.minRecords)}–${compact(d.maxRecords)} reported records<br>Line = minimum to maximum; number = events<br>Click to inspect every member`:`<strong>${escape(e.organization)}</strong><br>${e.year} · ${label(e)} reported records<br>${escape(e.sector)} · Click for details`);
      }).on('pointerleave',hideTooltip);
      nodes.append('title').text(d=>d.isGroup?`${d.count} events in ${d.year}, ${compact(d.minRecords)} to ${compact(d.maxRecords)} records. Click to list members.`:`${byId.get(d.id).organization}, ${label(byId.get(d.id))}`);
    }
    // Pin the selected individual at its exact coordinate in B, even inside a group.
    const selected=byId.get(state.selected);
    if(selected && selected.records != null && inFocus(selected)) {
      const p=state.view==='bubbles'?layout.positions.find(d=>d.id===selected.id):{x:xScale(selected.year),y:yScale(selected.records),r:6};
      svg.append('g').attr('class','selected-pin').attr('data-id',selected.id).append('circle').attr('class','selection-ring').attr('cx',p.x).attr('cy',p.y).attr('r',state.view==='bubbles'?p.r+4:7);
    }
    drawAnnotations(svg);
    const unknown=focused.filter(e=>e.records==null).length;
    $('encoding-note').textContent=state.view==='bubbles'
      ? `Solid area ∝ reported count, with a fixed scale across year windows. ${layout.tinyCount} tiny events have outlined visibility rings; ring size does not encode count. ${unknown} events without comparable counts remain in the list and overview.`
      : `Numbered groups = nearby events in one year; vertical spans show their min–max counts, not uncertainty. The orange pin marks the selected event exactly. ${unknown} events without comparable counts remain in the list and overview.`;
    $('empty-state').hidden=layout.positions.length>0;
    $('empty-state').textContent=focused.length?'These events have no comparable numeric count. Read them in the list below.':'No events match this selection.';
    if(motion) marks.attr('opacity',.4).transition().duration(motion).attr('opacity',1);
  }
  function drawSizeLegend() {
    $('size-legend').hidden=false;
    const legend=d3.select('#size-legend').html('').append('svg').attr('width',200).attr('height',68).attr('viewBox','0 0 200 68').attr('role','img').attr('aria-label','Solid bubble area key: one billion, one hundred million, and ten million records');
    [1e9,1e8,1e7].forEach((n,i)=>{
      const x=35+i*63,r=46*Math.sqrt(n/2.7e9);
      legend.append('circle').attr('cx',x).attr('cy',32).attr('r',r).attr('fill','#247c78').attr('opacity',.6);
      legend.append('text').attr('x',x).attr('y',67).attr('text-anchor','middle').attr('font-size',10).attr('fill','#607366').text(compact(n));
    });
  }
  function drawAnnotations(svg) {
    const top=focused.filter(e=>e.records!=null).sort((a,b)=>b.records-a.records).slice(0,3);
    const selected=byId.get(state.selected);
    if(selected?.records!=null && inFocus(selected) && !top.some(e=>e.id===selected.id)) top.push(selected);
    const used=[];
    const layer=svg.append('g').attr('class','annotations');
    for (const e of top) {
      const p=state.view==='bubbles'?layout.positions.find(d=>d.id===e.id):{x:xScale(e.year),y:yScale(e.records),r:8};
      if(!p)continue;
      const name=e.organization.length>32?`${e.organization.slice(0,30)}…`:e.organization;
      const w=Math.max(116,Math.min(202,name.length*5.8+18)),h=37;
      const offsets=[[p.r+9,-h/2],[-w-p.r-9,-h/2],[-w/2,-p.r-h-8],[-w/2,p.r+9],[p.r+8,-h-45],[-w-p.r-8,35]];
      // Test nearby and progressively more distant boxes against every visible
      // mark, so labels do not solve text crowding by covering other events.
      for(const distance of [65,110,155,200,245,290,335]) {
        for(const dx of [-w/2,p.r+9,-w-p.r-9]) offsets.push([dx,-h-distance],[dx,distance]);
      }
      const candidates=offsets.map(([dx,dy])=>({x:Math.max(66,Math.min(layout.width-w-5,p.x+dx)),y:Math.max(22,Math.min(layout.height-h-47,p.y+dy))}));
      const overlaps=(a,b)=>a.x<b.x+b.w+5&&a.x+w+5>b.x&&a.y<b.y+b.h+4&&a.y+h+4>b.y;
      const score=q=>{
        const covered=layout.positions.filter(mark=>{
          const nx=Math.max(q.x,Math.min(q.x+w,mark.x));
          const ny=Math.max(q.y,Math.min(q.y+h,mark.y));
          return Math.hypot(mark.x-nx,mark.y-ny)<mark.r+3;
        }).length;
        return used.filter(b=>overlaps(q,b)).length*100000+covered*10000+Math.hypot(q.x+w/2-p.x,q.y+h/2-p.y);
      };
      const q=candidates.map((q,i)=>({...q,cost:score(q)+i*.001})).sort((a,b)=>a.cost-b.cost)[0];
      used.push({...q,w,h});
      const g=layer.append('g').attr('class','annotation').attr('data-id',e.id).style('pointer-events','none');
      g.append('line').attr('x1',p.x).attr('y1',p.y).attr('x2',q.x+w/2).attr('y2',q.y+h/2);
      g.append('rect').attr('x',q.x).attr('y',q.y).attr('width',w).attr('height',h).attr('rx',4);
      g.append('text').attr('class','label-name').attr('x',q.x+8).attr('y',q.y+14).text(name);
      g.append('text').attr('x',q.x+8).attr('y',q.y+28).text(`${e.year} · ${label(e)}${e.id===state.selected?' · selected':''}`);
    }
  }
  function drawOverview() {
    const width=Math.max(500,$('overview-chart').clientWidth),height=105;
    const svg=d3.select('#overview-chart').attr('viewBox',`0 0 ${width} ${height}`);
    svg.selectAll('*').remove();
    overviewX=d3.scaleLinear().domain([yearMin-.5,yearMax+.5]).range([30,width-15]);
    const counts=d3.rollup(base,v=>v.length,d=>d.year);
    const yearData=d3.range(yearMin,yearMax+1).map(year=>({year,count:counts.get(year)||0}));
    const y=d3.scaleLinear().domain([0,d3.max(yearData,d=>d.count)||1]).range([77,12]);
    const barWidth=(width-45)/(yearMax-yearMin+1)-3;
    svg.append('g').selectAll('rect').data(yearData).join('rect').attr('class',d=>`overview-bar${d.year>=state.start&&d.year<=state.end?' is-focused':''}`).attr('x',d=>overviewX(d.year)-barWidth/2).attr('y',d=>y(d.count)).attr('width',barWidth).attr('height',d=>77-y(d.count)).append('title').text(d=>`${d.year}: ${d.count} matching source events`);
    svg.append('g').attr('class','axis').attr('transform','translate(0,77)').call(d3.axisBottom(overviewX).tickValues(d3.range(yearMin,yearMax+1,2)).tickFormat(d3.format('d')).tickSize(3));
    svg.append('text').attr('x',27).attr('y',15).attr('text-anchor','end').attr('font-size',9).attr('fill','#65756f').text(d3.max(yearData,d=>d.count));
    svg.append('text').attr('x',27).attr('y',78).attr('text-anchor','end').attr('font-size',9).attr('fill','#65756f').text('0');
    brush=d3.brushX().extent([[30,8],[width-15,77]]).on('end',event=>{
      if(syncingBrush||!event.sourceEvent)return;
      if(!event.selection){setYears(yearMin,yearMax);return;}
      const a=Math.ceil(overviewX.invert(event.selection[0])),b=Math.floor(overviewX.invert(event.selection[1]));
      setYears(Math.min(a,b),Math.max(a,b));
    });
    brushGroup=svg.append('g').attr('class','brush').call(brush);
    syncingBrush=true;brushGroup.call(brush.move,[overviewX(state.start-.5),overviewX(state.end+.5)]);syncingBrush=false;
  }
  function listData() {
    let list=focused;
    if(state.group)list=list.filter(e=>state.group.members.includes(e.id));
    return list.slice().sort(state.order==='name'?(a,b)=>a.organization.localeCompare(b.organization)||b.year-a.year:state.order==='largest'?(a,b)=>(b.records??-1)-(a.records??-1)||b.year-a.year:(a,b)=>b.year-a.year||(b.records??-1)-(a.records??-1));
  }
  function drawList() {
    const list=listData(),pageSize=6,pages=Math.max(1,Math.ceil(list.length/pageSize));
    state.page=Math.min(state.page,pages-1);
    $('group-focus').hidden=!state.group;$('clear-group').hidden=!state.group;
    if(state.group)$('group-focus').textContent=`Showing ${list.length} members of a ${state.group.year} group · ${compact(state.group.min)}–${compact(state.group.max)} reported records. Select a name to locate its exact value.`;
    $('event-list').innerHTML=list.slice(state.page*pageSize,(state.page+1)*pageSize).map(e=>`<button class="event-list-row" data-id="${escape(e.id)}" aria-pressed="${state.selected===e.id}"><span><strong>${escape(e.organization)}</strong><small>${e.year} · ${escape(e.sector)} · ${escape(e.method)}</small></span><span>${label(e)}</span></button>`).join('')||'<p class="detail-meta">No matching events in this list.</p>';
    $('event-list').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>selectEvent(button.dataset.id)));
    $('page-status').textContent=`${list.length?state.page*pageSize+1:0}–${Math.min((state.page+1)*pageSize,list.length)} of ${list.length}`;
    $('prev-page').disabled=state.page===0;$('next-page').disabled=state.page>=pages-1;
  }
  function drawDetails() {
    const e=byId.get(state.selected);
    if(!e)return;
    const added=state.compare.includes(e.id),full=state.compare.length>=3;
    const count=e.records==null?'Comparable count unavailable':`${d3.format(',')(e.records)}${e.recordsStatus==='approximate'?' (approx.)':''}`;
    const sources=(e.sources||[]).filter(s=>/^https?:\/\//i.test(s.url)).map(s=>`<a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.name||'Source report')} ↗</a>`).join('');
    $('event-detail').innerHTML=`<p class="detail-kicker">Selected event · reported ${e.year}</p><h3>${escape(e.organization)}</h3><p class="detail-count">${count}</p><p class="detail-meta">${e.records!=null?'Source-reported records · ':''}${escape(e.sector)} · ${escape(e.method)}</p><p class="detail-story">${escape(e.story||'The source sheet provides no narrative for this event.')}</p>${e.recordsNote?`<p class="detail-caveat">${escape(e.recordsNote)}</p>`:''}<div class="detail-sources">${sources||'No individual report URL provided in the source.'}</div><button class="add-comparison" ${e.records==null||added||full?'disabled':''}>${e.records==null?'No comparable numeric count':added?'Added to comparison':full?'Comparison full (3 events)':'Add to comparison'}</button>${!inFocus(e)?'<p class="detail-visibility">This selected event is outside the current filters or year window.</p>':''}`;
    $('event-detail').querySelector('button').addEventListener('click',()=>{
      if(e.records==null||state.compare.length>=3||state.compare.includes(e.id))return;
      state.compare.push(e.id);drawDetails();drawComparison();announce(`${e.organization} added to the linear comparison.`);
    });
  }
  function drawComparison() {
    const list=state.compare.map(id=>byId.get(id)).filter(Boolean);
    $('comparison-chips').innerHTML=list.map(e=>`<button data-id="${escape(e.id)}" aria-label="Remove ${escape(e.organization)} from comparison">${escape(e.organization)} · ${e.year}${!inFocus(e)?' · outside focus':''}<span aria-hidden="true">×</span></button>`).join('');
    $('comparison-chips').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{state.compare=state.compare.filter(id=>id!==button.dataset.id);drawDetails();drawComparison();}));
    $('compare-empty').hidden=list.length>0;$('comparison-chart').hidden=!list.length;
    $('clear-comparison').disabled=!list.length;
    if(!list.length)return;
    const width=$('comparison-stage').clientWidth,height=list.length*65+46;
    const x=d3.scaleLinear().domain([0,d3.max(list,e=>e.records)]).nice().range([0,width-10]);
    const svg=d3.select('#comparison-chart').attr('viewBox',`0 0 ${width} ${height}`);
    svg.selectAll('*').remove();
    list.forEach((e,i)=>{
      const y=24+i*65;
      svg.append('text').attr('x',0).attr('y',y).attr('font-size',11).attr('fill','#17332f').attr('font-weight',600).text(`${e.organization.length > Math.floor((width-115)/6) ? e.organization.slice(0,Math.max(10,Math.floor((width-115)/6)-1))+'…' : e.organization} (${e.year})`).append('title').text(`${e.organization} (${e.year})`);
      svg.append('text').attr('x',width-10).attr('y',y).attr('font-size',11).attr('text-anchor','end').attr('fill','#17332f').text(label(e));
      svg.append('rect').attr('x',0).attr('y',y+10).attr('width',width-10).attr('height',16).attr('fill','#edf0e7');
      svg.append('rect').attr('class','comparison-bar').attr('data-id',e.id).attr('data-records',e.records).attr('x',0).attr('y',y+10).attr('width',x(e.records)).attr('height',16).attr('fill',color(e));
    });
    svg.append('g').attr('class','axis').attr('transform',`translate(0,${height-37})`).call(d3.axisBottom(x).ticks(width<500?3:6).tickFormat(compact).tickSize(4));
    svg.append('text').attr('x',width-10).attr('y',height-5).attr('font-size',10).attr('text-anchor','end').attr('fill','#65756f').text('Reported records · linear scale, starting at zero');
  }
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
    state.view=button.dataset.view;state.group=null;
    const url=new URL(location.href);url.searchParams.set('view',state.view);history.replaceState(null,'',url);
    render();announce(`${state.view==='bubbles'?'Bubble timeline':'Time by size'} view. Filters and selected events retained.`);
  }));
  let inputTimer;
  $('search').addEventListener('input',()=>{clearTimeout(inputTimer);inputTimer=setTimeout(()=>{state.query=$('search').value;state.page=0;state.group=null;render();},120);});
  [['sector-filter','sector'],['method-filter','method']].forEach(([id,key])=>$(id).addEventListener('change',()=>{state[key]=$(id).value;state.page=0;state.group=null;render();}));
  $('year-start').addEventListener('change',()=>setYears(+$('year-start').value,Math.max(+$('year-start').value,state.end)));
  $('year-end').addEventListener('change',()=>setYears(Math.min(state.start,+$('year-end').value),+$('year-end').value));
  $('all-years').addEventListener('click',()=>setYears(yearMin,yearMax));
  $('reset-button').addEventListener('click',()=>{state.query='';state.sector='';state.method='';$('search').value='';$('sector-filter').value='';$('method-filter').value='';state.order='latest';$('list-order').value='latest';setYears(yearMin,yearMax);});
  $('list-order').addEventListener('change',()=>{state.order=$('list-order').value;state.page=0;drawList();});
  $('prev-page').addEventListener('click',()=>{state.page--;drawList();});
  $('next-page').addEventListener('click',()=>{state.page++;drawList();});
  $('clear-group').addEventListener('click',()=>{state.group=null;state.page=0;drawList();});
  $('clear-comparison').addEventListener('click',()=>{state.compare=[];drawDetails();drawComparison();announce('Comparison cleared.');});
  render();
  let resizeTimer;
  new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if($('chart-stage').clientWidth!==renderedWidth){drawMain();drawOverview();}drawComparison();},150);}).observe($('explorer'));
})();
