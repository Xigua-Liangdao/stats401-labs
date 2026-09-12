const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const d3 = require('./vendor/d3.v7.9.0.min.js');
const Data = require('./network-data.js');
const stations = d3.csvParse(fs.readFileSync(path.join(__dirname, '../data/lab5_assignment_stations.csv'), 'utf8'));
const routes = d3.csvParse(fs.readFileSync(path.join(__dirname, '../data/lab5_assignment_routes.csv'), 'utf8'));
const network = Data.prepare(stations, routes);

test('all stations survive, including five isolated stations', () => {
    assert.equal(network.nodes.length, 50);
    assert.equal(network.links.length, 50);
    assert.deepEqual(network.isolates.map(d => d.id), ['s42', 's43', 's46', 's48', 's49']);
    assert.deepEqual(network.components.map(c => c.length).sort((a, b) => b - a), [45, 1, 1, 1, 1, 1]);
    assert.equal(network.nodes.reduce((sum, d) => sum + d.degree, 0), 100);
});

test('all three matrix orders preserve every pair and the undirected symmetry', () => {
    for (const order of ['district', 'station', 'type']) {
        const cells = Data.matrixCells(network, order);
        const byPair = new Map(cells.map(cell => [`${cell.row.id}:${cell.col.id}`, cell]));
        assert.equal(cells.length, 2500);
        assert.equal(cells.filter(c => c.link).length, 100);
        assert.equal(cells.filter(c => c.row.id === c.col.id && c.link).length, 0);
        for (const c of cells) assert.equal(c.link, byPair.get(`${c.col.id}:${c.row.id}`).link);
        for (const isolate of network.isolates) assert.equal(cells.filter(c => c.row.id === isolate.id && c.link).length, 0);
    }
    assert.equal(Data.orderNodes(network.nodes, 'station')[9].id, 's10');
    assert.ok(Data.orderNodes(network.nodes, 'district').slice(0, 10).every(n => n.district === 'Central'));
});

test('forceLink endpoint mutation cannot corrupt the source data or matrix', () => {
    const original = JSON.stringify(network.links);
    const simulationLinks = network.links.map(d => ({ ...d }));
    const sim = d3.forceSimulation(network.nodes.map(d => ({ ...d })))
        .force('link', d3.forceLink(simulationLinks).id(d => d.id)).stop();
    sim.tick(10);
    assert.equal(typeof simulationLinks[0].source, 'object');
    assert.equal(JSON.stringify(network.links), original);
    assert.equal(typeof routes[0].source, 'string');
    assert.equal(network.linkByPair.get(Data.pairKey('s31', 's7')).travel_time_min, 16);
    assert.equal(Data.matrixCells(network).filter(c => c.link).length, 100);
});

test('six written findings match the network represented by both views', () => {
    assert.equal(network.maxDegree, 3);
    assert.equal(network.nodes.filter(n => n.degree === 3).length, 14);
    for (const id of ['s4', 's7', 's10']) assert.equal(network.byId.get(id).degree, 3);
    assert.equal(network.districtPairs.get('East–South'), 11);
    assert.equal(Math.max(...network.districtPairs.values()), 11);
    assert.equal(network.districtPairs.get('Central–North'), 9);
    assert.equal(network.districtPairs.get('East–West'), 9);
    for (const id of ['s47', 's50']) {
        assert.equal(network.byId.get(id).degree, 1);
        assert.equal(network.byId.get(id).station_type, 'Transfer');
    }
    for (const id of ['s4', 's7', 's43', 's46', 's49']) assert.equal(network.byId.get(id).station_type, 'Terminal');
    assert.deepEqual([...network.nodes].sort((a, b) => b.daily_passengers - a.daily_passengers).slice(0, 3)
        .map(n => [n.id, n.daily_passengers]), [['s50', 9850], ['s49', 9677], ['s48', 9504]]);
    assert.deepEqual([...network.links].sort((a, b) => b.travel_time_min - a.travel_time_min).slice(0, 3)
        .map(l => [l.source, l.target, l.travel_time_min, l.route_type]),
        [['s7', 's31', 16, 'Express'], ['s18', 's34', 15, 'Express'], ['s29', 's50', 14, 'Express']]);
    const central = network.links.filter(l => [l.source, l.target].every(id => network.byId.get(id).district === 'Central'));
    assert.equal(central.length, 2);
    assert.ok(central.every(l => l.route_type === 'Shuttle'));
});

test('reject malformed networks instead of silently losing routes', () => {
    assert.throws(() => Data.prepare([...stations, stations[0]], routes), /unique/);
    assert.throws(() => Data.prepare(stations, [...routes, { ...routes[0], source: 's999' }]), /missing station/);
    assert.throws(() => Data.prepare(stations, [...routes, { ...routes[0], source: routes[0].target, target: routes[0].source }]), /unique pairs/);
    assert.throws(() => Data.prepare(stations, [{ ...routes[0], travel_time_min: 'unknown' }]), /Invalid route/);
    assert.throws(() => Data.prepare(stations, [{ ...routes[0], target: routes[0].source }]), /self-connections/);
});
