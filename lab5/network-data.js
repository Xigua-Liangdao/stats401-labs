/* DOM-free data preparation. The original tables remain separate from simulation data. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.Lab5Data = api;
}(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';
    const districts = ['Central', 'North', 'South', 'East', 'West'];
    const stationTypes = ['Local', 'Transfer', 'Terminal'];
    const routeTypes = ['Metro', 'Express', 'Shuttle'];
    const endpoint = value => typeof value === 'object' ? value.id : value;
    const pairKey = (a, b) => [endpoint(a), endpoint(b)].sort().join('|');
    const number = node => Number(node.id.replace(/^s/, ''));
    function prepare(nodeRows, linkRows) {
        if (!nodeRows.length) throw new Error('The station table is empty.');
        const nodes = nodeRows.map(row => ({
            id: String(row.id || '').trim(), station_name: String(row.station_name || '').trim(),
            district: row.district, station_type: row.station_type,
            daily_passengers: Number(row.daily_passengers), neighbors: [], degree: 0
        }));
        const byId = new Map();
        for (const node of nodes) {
            if (!/^s\d+$/.test(node.id) || !node.station_name || byId.has(node.id)) throw new Error('Station IDs must be unique and names must be present.');
            if (!districts.includes(node.district) || !stationTypes.includes(node.station_type)) throw new Error(`Unknown category at ${node.id}.`);
            if (!Number.isFinite(node.daily_passengers) || node.daily_passengers < 0) throw new Error(`Invalid passenger count at ${node.id}.`);
            byId.set(node.id, node);
        }
        const linkByPair = new Map();
        const links = linkRows.map(row => {
            const source = endpoint(row.source), target = endpoint(row.target);
            const minutes = Number(row.travel_time_min), key = pairKey(source, target);
            if (!byId.has(source) || !byId.has(target)) throw new Error('A route refers to a missing station.');
            if (source === target || linkByPair.has(key)) throw new Error('Routes must be unique pairs without self-connections.');
            if (!routeTypes.includes(row.route_type) || !Number.isFinite(minutes) || minutes <= 0) throw new Error(`Invalid route ${key}.`);
            const link = { source, target, travel_time_min: minutes, route_type: row.route_type, key };
            linkByPair.set(key, link);
            byId.get(source).neighbors.push(target); byId.get(target).neighbors.push(source);
            return link;
        });
        nodes.forEach(node => { node.degree = node.neighbors.length; });
        const seen = new Set(), components = [];
        for (const node of nodes) {
            if (seen.has(node.id)) continue;
            const group = [], stack = [node.id]; seen.add(node.id);
            while (stack.length) {
                const id = stack.pop(); group.push(id);
                for (const neighbor of byId.get(id).neighbors) if (!seen.has(neighbor)) { seen.add(neighbor); stack.push(neighbor); }
            }
            components.push(group);
        }
        const districtPairs = new Map();
        links.forEach(link => {
            const key = [byId.get(link.source).district, byId.get(link.target).district].sort().join('–');
            districtPairs.set(key, (districtPairs.get(key) || 0) + 1);
        });
        return { nodes, links, byId, linkByPair, districtPairs, components,
            isolates: nodes.filter(node => node.degree === 0), maxDegree: Math.max(...nodes.map(node => node.degree)) };
    }
    function orderNodes(nodes, order) {
        return [...nodes].sort((a, b) => {
            let difference = 0;
            if (order === 'district') difference = districts.indexOf(a.district) - districts.indexOf(b.district);
            if (order === 'type') difference = stationTypes.indexOf(a.station_type) - stationTypes.indexOf(b.station_type);
            return difference || number(a) - number(b);
        });
    }
    function matrixCells(network, order = 'district') {
        const ordered = orderNodes(network.nodes, order);
        return ordered.flatMap(row => ordered.map(col => ({ row, col,
            link: network.linkByPair.get(pairKey(row.id, col.id)) || null })));
    }
    return { districts, stationTypes, routeTypes, endpoint, pairKey, prepare, orderNodes, matrixCells };
}));
