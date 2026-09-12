/* Lab 5: external tables -> shared network -> linked D3 views. */
(() => {
    'use strict';
    const status = document.getElementById('load-status');
    const fail = error => {
        status.classList.add('error-message');
        status.setAttribute('role', 'alert');
        status.textContent = `The network could not load. ${error.message} Serve this folder through a local web server or open its GitHub Pages address.`;
        console.error(error);
    };
    if (!window.d3 || !window.Lab5Data) { fail(new Error('A required script is unavailable.')); return; }
    const Data = window.Lab5Data;
    const shortName = node => node.id.toUpperCase();
    const format = d3.format(',');
    const districtColor = d3.scaleOrdinal(Data.districts, ['#315f85', '#b76c19', '#238577', '#8056a2', '#b34769']);
    const routeColor = d3.scaleOrdinal(Data.routeTypes, ['#168078', '#b34438', '#7254a6']);
    const shape = d3.scaleOrdinal(Data.stationTypes, [d3.symbolCircle, d3.symbolDiamond, d3.symbolSquare]);
    const dash = type => ({ Metro: null, Express: '9 4', Shuttle: '2 4' })[type];
    const tooltip = d3.select('#lab5-tooltip');
    const stationSelect = d3.select('#station-select');
    const orderSelect = d3.select('#matrix-order');
    let network, area, lineWidth, opacity, simulation, graphSvg, graphLayer, zoom;
    let nodeMarks, routeMarks, routeHits, matrixMarks, axisLabels, rowGuide, colGuide, matrixBand;
    let selectedId = '', hoverNode = null, hoverRoute = null, matrixSize = 0, graphWidth = 0;
    let currentOrder = 'district', resizeFrame;

    function tooltipAt(event) {
        const bounds = event.currentTarget?.getBoundingClientRect();
        const x = Number.isFinite(event.clientX) ? event.clientX : (bounds?.left || 0) + (bounds?.width || 0) / 2;
        const y = Number.isFinite(event.clientY) ? event.clientY : (bounds?.top || 0) + (bounds?.height || 0) / 2;
        const box = tooltip.node().getBoundingClientRect();
        tooltip.style('left', `${Math.max(10, Math.min(window.innerWidth - box.width - 10, x + 14))}px`)
            .style('top', `${Math.max(10, Math.min(window.innerHeight - box.height - 10, y + 14))}px`);
    }
    function showTooltip(event, title, lines) {
        tooltip.selectAll('*').remove();
        tooltip.append('strong').text(title);
        tooltip.selectAll('span').data(lines).join('span').text(d => d);
        tooltip.classed('visible', true); tooltipAt(event);
    }
    function stationLines(node) {
        return [`${node.district} · ${node.station_type}`, `${format(node.daily_passengers)} daily passengers`,
            `${node.degree} direct connection${node.degree === 1 ? '' : 's'}`];
    }
    function routeLines(link) {
        return [`${link.route_type} · ${link.travel_time_min} minutes`,
            `${network.byId.get(Data.endpoint(link.source)).district} ↔ ${network.byId.get(Data.endpoint(link.target)).district}`];
    }
    function enterStation(event, node) {
        hoverNode = node.id; hoverRoute = null; applyHighlight();
        showTooltip(event, node.station_name, stationLines(node));
    }
    function enterRoute(event, link) {
        hoverRoute = link; hoverNode = null; applyHighlight();
        showTooltip(event, `${network.byId.get(Data.endpoint(link.source)).station_name} — ${network.byId.get(Data.endpoint(link.target)).station_name}`, routeLines(link));
    }
    function leave() {
        hoverNode = null; hoverRoute = null; tooltip.classed('visible', false); applyHighlight();
    }
    function selectStation(id) {
        selectedId = id; stationSelect.property('value', id); hoverNode = null; hoverRoute = null;
        tooltip.classed('visible', false); updateInspector(); applyHighlight();
    }
    function applyHighlight() {
        if (!nodeMarks) return;
        const id = hoverNode || selectedId, link = hoverRoute;
        const active = Boolean(id || link);
        const neighbors = id ? network.byId.get(id).neighbors : [];
        const nodes = new Set(link ? [Data.endpoint(link.source), Data.endpoint(link.target)] : [id, ...neighbors]);
        const relevantLink = d => !active || (link ? d.key === link.key : Data.endpoint(d.source) === id || Data.endpoint(d.target) === id);
        nodeMarks.attr('opacity', d => !active || nodes.has(d.id) ? 1 : 0.16).classed('selected', d => d.id === id);
        routeMarks.attr('stroke-opacity', d => relevantLink(d) ? 0.85 : 0.07);
        if (!matrixMarks) return;
        matrixMarks.attr('opacity', d => !active || (link ? d.link?.key === link.key : d.row.id === id || d.col.id === id) ? 1 : 0.18);
        axisLabels.classed('selected', d => nodes.has(d.id)).attr('opacity', d => !active || nodes.has(d.id) ? 1 : 0.38);
        const show = id && !link;
        rowGuide.attr('display', show ? null : 'none'); colGuide.attr('display', show ? null : 'none');
        if (show) {
            rowGuide.attr('y', matrixBand(id)).attr('height', matrixBand.bandwidth());
            colGuide.attr('x', matrixBand(id)).attr('width', matrixBand.bandwidth());
        }
    }
    function updateInspector() {
        const panel = d3.select('#station-detail-content'); panel.selectAll('*').remove();
        const node = network.byId.get(selectedId);
        panel.append('h3').attr('id', 'detail-title').text(node ? node.station_name : 'All stations');
        if (!node) {
            panel.append('p').text(`${network.components.length} components: one connected group of 45 stations and five isolated stations.`);
            panel.append('p').text('Select a station to inspect its passenger volume, role, and direct neighbors.');
            panel.append('p').text('Degree counts direct neighbors. Passenger volume is a separate measure.');
            return;
        }
        const details = [['District', node.district], ['Station type', node.station_type],
            ['Daily passengers', format(node.daily_passengers)], ['Degree', node.degree]];
        const dl = panel.append('dl'); details.forEach(([label, value]) => { dl.append('dt').text(label); dl.append('dd').text(value); });
        panel.append('h4').text('Direct connections');
        if (!node.degree) { panel.append('p').text('No direct connections are recorded for this station. Its entire matrix row and column are empty.'); return; }
        const links = network.links.filter(link => link.source === node.id || link.target === node.id);
        const buttons = panel.append('ul').selectAll('li').data(links).join('li').append('button')
            .attr('class', 'connection-button').attr('type', 'button')
            .on('mouseenter focus', enterRoute).on('mousemove', tooltipAt).on('mouseleave blur', leave)
            .on('click', (_, link) => selectStation(link.source === node.id ? link.target : link.source));
        buttons.append('b').text(link => network.byId.get(link.source === node.id ? link.target : link.source).station_name);
        buttons.append('span').text(link => `${link.travel_time_min} min · ${link.route_type}`);
    }

    function drawNetwork() {
        const host = document.getElementById('network-chart');
        const width = Math.floor(host.clientWidth), height = width < 500 ? 740 : 620;
        if (!width || width === graphWidth) return;
        graphWidth = width;
        if (simulation) simulation.stop();
        host.replaceChildren();
        const mainHeight = height - 125;
        // Copies protect string endpoints in the matrix and inspector from forceLink mutation.
        const nodes = network.nodes.map(node => ({ ...node }));
        const connected = nodes.filter(node => node.degree > 0), isolates = nodes.filter(node => node.degree === 0);
        const links = network.links.map(link => ({ ...link }));
        const symbol = d3.symbol().type(node => shape(node.station_type)).size(node => area(node.daily_passengers));
        // Diamond's vertical extent is larger than a circle of the same area.
        const radius = node => node.station_type === 'Transfer' ? Math.sqrt(area(node.daily_passengers) / (2 * Math.tan(Math.PI / 6)))
            : node.station_type === 'Terminal' ? Math.sqrt(area(node.daily_passengers) / 2) : Math.sqrt(area(node.daily_passengers) / Math.PI);
        const random = d3.randomLcg(401);
        connected.forEach(node => { node.x = 35 + random() * Math.max(1, width - 70); node.y = 45 + random() * (mainHeight - 80); });
        isolates.forEach((node, i) => { node.x = (i + .5) * width / isolates.length; node.y = mainHeight + 75; });
        graphSvg = d3.select(host).append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('height', height)
            .attr('role', 'img').attr('aria-label', 'Force-directed network of 50 transit stations, including five isolates displayed below the main component. Station selection is also available in the dropdown.');
        graphSvg.append('title').text('Urban transit: 50 stations and 50 undirected routes');
        graphLayer = graphSvg.append('g');
        graphLayer.append('line').attr('class', 'isolate-separator').attr('x1', 16).attr('x2', width - 16).attr('y1', mainHeight + 8).attr('y2', mainHeight + 8);
        graphLayer.append('text').attr('class', 'isolate-label').attr('x', 16).attr('y', mainHeight + 30).text('No recorded connections');
        routeHits = graphLayer.append('g').selectAll('line').data(links, d => d.key).join('line').attr('class', 'route-hit')
            .on('mouseenter', enterRoute).on('mousemove', tooltipAt).on('mouseleave', leave)
            .on('click', (event, link) => { event.stopPropagation(); selectStation(Data.endpoint(link.source)); });
        routeMarks = graphLayer.append('g').selectAll('line').data(links, d => d.key).join('line').attr('class', 'network-route')
            .attr('stroke', d => routeColor(d.route_type)).attr('stroke-width', d => lineWidth(d.travel_time_min)).attr('stroke-dasharray', d => dash(d.route_type));
        nodeMarks = graphLayer.append('g').selectAll('g').data(nodes, d => d.id).join('g').attr('class', 'network-station')
            .attr('tabindex', 0).attr('role', 'button').attr('aria-label', d => `${d.station_name}, ${stationLines(d).join(', ')}. Select to inspect.`)
            .on('mouseenter focus', enterStation).on('mousemove', tooltipAt).on('mouseleave blur', leave)
            .on('click', (event, node) => { event.stopPropagation(); selectStation(node.id); })
            .on('keydown', (event, node) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectStation(node.id); } });
        nodeMarks.append('circle').attr('r', node => Math.max(22, radius(node))).attr('fill', 'transparent');
        nodeMarks.append('path').attr('class', 'station-symbol').attr('d', symbol).attr('fill', d => districtColor(d.district));
        nodeMarks.append('text').attr('y', d => -radius(d) - 6).text(shortName);
        const tick = () => {
            connected.forEach(node => {
                const pad = radius(node) + 9;
                node.x = Math.max(pad, Math.min(width - pad, node.x));
                node.y = Math.max(pad + 19, Math.min(mainHeight - pad, node.y));
            });
            for (const marks of [routeMarks, routeHits]) marks.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
            nodeMarks.attr('transform', d => `translate(${d.x},${d.y})`);
        };
        simulation = d3.forceSimulation(connected).randomSource(d3.randomLcg(401))
            .force('link', d3.forceLink(links).id(d => d.id).distance(width < 500 ? 52 : 65).strength(.55))
            .force('charge', d3.forceManyBody().strength(width < 500 ? -70 : -110))
            .force('center', d3.forceCenter(width / 2, mainHeight / 2))
            .force('x', d3.forceX(width / 2).strength(.035))
            .force('y', d3.forceY(mainHeight / 2).strength(.04))
            .force('collide', d3.forceCollide(d => radius(d) + 10).iterations(3)).stop();
        for (let i = 0; i < 260; i++) { simulation.tick(); tick(); }
        simulation.on('tick', tick);
        const settle = () => { simulation.stop(); for (let i = 0; i < 180; i++) { simulation.tick(); tick(); } };
        nodeMarks.call(d3.drag().container(graphLayer.node())
            .on('start', (event, node) => {
                tooltip.classed('visible', false); selectStation(node.id);
                if (node.degree && !event.active) simulation.alphaTarget(.25).restart();
                node.fx = node.x; node.fy = node.y;
            }).on('drag', (event, node) => {
                const pad = radius(node) + 9;
                node.fx = Math.max(pad, Math.min(width - pad, event.x));
                node.fy = Math.max(node.degree ? pad + 19 : mainHeight + 56, Math.min(node.degree ? mainHeight - pad : height - pad, event.y));
                if (!node.degree) { node.x = node.fx; node.y = node.fy; tick(); }
            }).on('end', (event, node) => {
                if (!event.active) simulation.alphaTarget(0);
                node.fx = null; node.fy = null;
                if (matchMedia('(prefers-reduced-motion: reduce)').matches) settle();
            }));
        zoom = d3.zoom().scaleExtent([.6, 5]).extent([[0, 0], [width, height]])
            .on('zoom', event => { graphLayer.attr('transform', event.transform); tooltip.classed('visible', false); });
        graphSvg.call(zoom).on('dblclick.zoom', null);
        applyHighlight();
    }

    function drawMatrix() {
        const host = document.getElementById('matrix-chart'); host.replaceChildren();
        const available = host.parentElement.clientWidth;
        const size = Math.max(850, available - 115); matrixSize = size;
        const left = 77, top = 77, order = Data.orderNodes(network.nodes, currentOrder);
        matrixBand = d3.scaleBand().domain(order.map(d => d.id)).range([0, size]).paddingInner(.08).paddingOuter(.02);
        const band = matrixBand, cell = band.bandwidth();
        const svg = d3.select(host).append('svg').attr('width', size + left + 18).attr('height', size + top + 20)
            .attr('role', 'img').attr('aria-label', `50 by 50 symmetric adjacency matrix, ordered by ${currentOrder}. 100 filled cells represent 50 undirected routes.`);
        svg.append('title').text('Rows and columns are stations. Colored cells show direct routes.');
        const group = svg.append('g').attr('transform', `translate(${left},${top})`);
        matrixMarks = group.append('g').selectAll('rect').data(Data.matrixCells(network, currentOrder), d => `${d.row.id}:${d.col.id}`)
            .join('rect').attr('class', 'matrix-cell').attr('x', d => band(d.col.id)).attr('y', d => band(d.row.id)).attr('width', cell).attr('height', cell)
            .attr('fill', d => d.link ? routeColor(d.link.route_type) : '#f0f3f7')
            .attr('fill-opacity', d => d.link ? opacity(d.link.travel_time_min) : 1)
            .on('mouseenter', (event, d) => {
                if (d.link) enterRoute(event, d.link);
                else { hoverNode = d.row.id; hoverRoute = null; applyHighlight(); showTooltip(event, `${d.row.station_name} — ${d.col.station_name}`, ['No direct connection']); }
            }).on('mousemove', tooltipAt).on('mouseleave', leave)
            .on('click', (_, d) => selectStation(d.row.id));
        // District annotations stay in the same order as each corresponding axis.
        group.append('g').selectAll('rect').data(order).join('rect').attr('x', -12).attr('y', d => band(d.id)).attr('width', 7).attr('height', cell).attr('fill', d => districtColor(d.district));
        group.append('g').selectAll('rect').data(order).join('rect').attr('x', d => band(d.id)).attr('y', -12).attr('width', cell).attr('height', 7).attr('fill', d => districtColor(d.district));
        const labels = [
            group.append('g').selectAll('text').data(order).join('text').attr('x', -18).attr('y', d => band(d.id) + cell / 2).attr('dy', '.35em').attr('text-anchor', 'end'),
            group.append('g').selectAll('text').data(order).join('text').attr('transform', d => `translate(${band(d.id) + cell / 2},-19) rotate(-90)`).attr('dy', '.35em')
        ];
        axisLabels = d3.selectAll(labels.flatMap(selection => selection.nodes())).attr('class', 'matrix-axis-label').text(shortName)
            .on('mouseenter', enterStation).on('mousemove', tooltipAt).on('mouseleave', leave).on('click', (_, node) => selectStation(node.id));
        if (currentOrder !== 'station') {
            const field = currentOrder === 'district' ? 'district' : 'station_type';
            const groups = d3.groups(order, d => d[field]);
            for (const [name, members] of groups) {
                const start = band(members[0].id), end = band(members[members.length - 1].id) + cell;
                group.append('text').attr('class', 'matrix-group-label').attr('x', (start + end) / 2).attr('y', -60).attr('text-anchor', 'middle').text(name);
                group.append('text').attr('class', 'matrix-group-label').attr('transform', `translate(-59,${(start + end) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text(name);
                group.append('rect').attr('class', 'matrix-block-outline').attr('x', start).attr('y', 0).attr('width', end - start).attr('height', size);
                group.append('rect').attr('class', 'matrix-block-outline').attr('x', 0).attr('y', start).attr('width', size).attr('height', end - start);
            }
        }
        rowGuide = group.append('rect').attr('class', 'matrix-guide').attr('x', 0).attr('width', matrixSize).attr('display', 'none');
        colGuide = group.append('rect').attr('class', 'matrix-guide').attr('y', 0).attr('height', matrixSize).attr('display', 'none');
        d3.select('#matrix-summary').text('100 filled cells represent 50 undirected routes. Both halves mirror the same connections; the diagonal is empty. Empty rows: S42, S43, S46, S48, S49.');
        applyHighlight();
    }

    function drawLegends() {
        const districts = d3.select('#district-legend').selectAll('span').data(Data.districts).join('span').attr('class', 'legend-item');
        districts.append('i').attr('class', 'legend-dot').style('background', d => districtColor(d)); districts.append('span').text(d => d);
        const shapes = d3.select('#shape-legend').selectAll('span').data(Data.stationTypes).join('span').attr('class', 'legend-item');
        shapes.append('svg').attr('width', 24).attr('height', 28).append('path').attr('transform', 'translate(12,14)')
            .attr('d', d3.symbol().type(d => shape(d)).size(120)).attr('fill', '#536173');
        shapes.append('span').text(d => d);
        for (const selector of ['#route-legend', '#matrix-route-legend']) {
            const items = d3.select(selector).selectAll('span').data(Data.routeTypes).join('span').attr('class', 'legend-item');
            const svg = items.append('svg').attr('width', 35).attr('height', 18);
            if (selector === '#route-legend') svg.append('line').attr('x1', 1).attr('x2', 33).attr('y1', 9).attr('y2', 9).attr('stroke-width', 3).attr('stroke', routeColor).attr('stroke-dasharray', dash);
            else svg.append('rect').attr('x', 10).attr('y', 1).attr('width', 16).attr('height', 16).attr('fill', routeColor);
            items.append('span').text(d => d);
        }
        const sizeSvg = d3.select('#size-legend').append('svg').attr('width', 260).attr('height', 70).attr('role', 'img').attr('aria-label', 'Example symbol areas for 2,000, 6,000 and 10,000 daily passengers.');
        [2000, 6000, 10000].forEach((value, i) => {
            sizeSvg.append('path').attr('transform', `translate(${36 + i * 90},26)`).attr('d', d3.symbol().type(d3.symbolCircle).size(area(value))()).attr('fill', '#6b8195');
            sizeSvg.append('text').attr('x', 36 + i * 90).attr('y', 62).attr('text-anchor', 'middle').text(format(value));
        });
        const timeSvg = d3.select('#time-legend').append('svg').attr('width', 260).attr('height', 45).attr('role', 'img').attr('aria-label', 'Line width increases from 2 to 9 to 16 minutes.');
        [2, 9, 16].forEach((value, i) => {
            timeSvg.append('line').attr('x1', 10 + i * 86).attr('x2', 64 + i * 86).attr('y1', 10).attr('y2', 10).attr('stroke', '#536173').attr('stroke-width', lineWidth(value));
            timeSvg.append('text').attr('x', 37 + i * 86).attr('y', 36).attr('text-anchor', 'middle').text(`${value} min`);
        });
        const matrixTime = d3.select('#matrix-time-legend').append('svg').attr('width', 200).attr('height', 40).attr('role', 'img').attr('aria-label', 'Cell opacity increases with travel time, from 2 to 16 minutes.');
        [2, 9, 16].forEach((value, i) => {
            matrixTime.append('rect').attr('x', i * 65 + 14).attr('y', 0).attr('width', 20).attr('height', 18).attr('fill', '#536173').attr('fill-opacity', opacity(value));
            matrixTime.append('text').attr('x', i * 65 + 24).attr('y', 36).attr('text-anchor', 'middle').text(`${value} min`);
        });
    }

    Promise.all([
        d3.csv('../data/lab5_assignment_stations.csv'),
        d3.csv('../data/lab5_assignment_routes.csv')
    ]).then(([nodes, links]) => {
        network = Data.prepare(nodes, links);
        area = d3.scaleLinear().domain([0, d3.max(network.nodes, d => d.daily_passengers)]).range([0, 760]);
        lineWidth = d3.scaleLinear().domain(d3.extent(network.links, d => d.travel_time_min)).range([1.5, 7]);
        opacity = d3.scaleLinear().domain(d3.extent(network.links, d => d.travel_time_min)).range([.3, 1]);
        stationSelect.selectAll('option.station-option').data(network.nodes).join('option').attr('class', 'station-option').attr('value', d => d.id)
            .text(d => `${d.station_name} · ${d.district}`);
        stationSelect.property('disabled', false).on('change', event => selectStation(event.target.value));
        orderSelect.property('disabled', false).on('change', event => { currentOrder = event.target.value; leave(); drawMatrix(); });
        d3.select('#reset-network').property('disabled', false).on('click', () => {
            selectStation(''); graphWidth = 0; drawNetwork();
        });
        drawLegends(); drawNetwork(); drawMatrix(); updateInspector();
        d3.select('#network-counts').text(`${network.nodes.length} stations · ${network.links.length} connections · ${network.isolates.length} isolates`);
        status.textContent = 'Station and route tables loaded. Both views show the same network.';
        new ResizeObserver(() => {
            cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(() => { drawNetwork(); drawMatrix(); });
        }).observe(document.getElementById('network-chart'));
        window.addEventListener('scroll', () => tooltip.classed('visible', false), { passive: true });
        document.addEventListener('keydown', event => { if (event.key === 'Escape') selectStation(''); });
    }).catch(fail);
})();
