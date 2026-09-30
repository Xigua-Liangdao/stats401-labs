const width = 700;
const height = 480;
const missingColor = "#e4e8ed";
const tooltip = d3.select("#lab9-tooltip");
const valueFormat = d3.format(",.3f");
const tickFormat = d3.format(",.0f");

async function initialize() {
    const [world, stats] = await Promise.all([
        d3.json("../data/lab9_world.geojson"),
        d3.csv("../data/lab9_gdp_2025_top50.csv", d => ({iso3: d.iso3, country: d.country, value: +d.gdp_2025_billion_usd, rank: +d.rank}))
    ]);
    const byId = new Map(stats.map(d => [d.iso3, d]));
    world.features = world.features.filter(d => d.properties.iso3 !== "ATA");
    world.features.forEach(d => { d.id = /^[A-Z]{3}$/.test(d.properties.iso3) ? d.properties.iso3 : d.properties.id; });
    const features = new Map(world.features.map(d => [d.id, d]));
    if (stats.length !== 50 || stats.some(d => !features.has(d.iso3) || !Number.isFinite(d.value) || d.value <= 0)) {
        throw new Error("GDP records do not match the geographic data.");
    }
    const domain = d3.extent(stats, d => d.value);
    const color = d3.scaleSequentialLog(d3.interpolateRgbBasis(["#fae8ef", "#e5adc4", "#cd7c9f", "#925373"])).domain(domain);
    const radius = d3.scaleSqrt().domain([0, domain[1]]).range([0, 86]);
    const projection = d3.geoEqualEarth().fitExtent([[18, 24], [width - 18, height - 26]], world);
    const path = d3.geoPath(projection);
    const selector = d3.select("#country-select");
    const maps = [];
    let selected = null;
    let hovered = null;

    selector.selectAll("option.economy").data([...stats].sort((a, b) => d3.ascending(a.country, b.country))).join("option")
        .attr("class", "economy").attr("value", d => d.iso3).text(d => d.country);

    function makeMap(target, label) {
        const svg = d3.select(target).append("svg").attr("viewBox", `0 0 ${width} ${height}`)
            .attr("role", "group").attr("aria-label", label);
        svg.append("title").text(label);
        const clipId = `${target.slice(1)}-clip`;
        svg.append("defs").append("clipPath").attr("id", clipId).append("rect").attr("width", width).attr("height", height);
        const layer = svg.append("g").attr("clip-path", `url(#${clipId})`).append("g").attr("class", "map-layer");
        const zoom = d3.zoom().scaleExtent([1, 12]).extent([[0, 0], [width, height]])
            .on("zoom", event => { layer.attr("transform", event.transform); tooltip.attr("hidden", true); });
        svg.call(zoom);
        maps.push({svg, zoom});
        return layer;
    }

    const choropleth = makeMap("#choropleth", "2025 GDP choropleth with Equal Earth projection");
    const countries = choropleth.selectAll("path").data(world.features).join("path")
        .attr("class", "map-region country").attr("data-iso3", d => d.id).attr("d", path)
        .attr("fill", d => byId.has(d.id) ? color(byId.get(d.id).value) : missingColor);
    bindInteractions(countries, d => d.id);

    const cartogram = makeMap("#cartogram", "2025 GDP Dorling cartogram; circle area is proportional to GDP");
    const context = cartogram.append("g").selectAll("path").data(world.features).join("path")
        .attr("class", "map-region context-country").attr("data-iso3", d => d.id).attr("d", path)
        .attr("fill", d => byId.has(d.id) ? "#f0f3f7" : missingColor);
    bindInteractions(context, d => d.id);
    const nodes = stats.map(d => {
        const place = features.get(d.iso3).properties;
        const [anchorX, anchorY] = projection([place.label_lon, place.label_lat]);
        return {...d, x: anchorX, y: anchorY, anchorX, anchorY, r: radius(d.value)};
    });
    const simulation = d3.forceSimulation(nodes).randomSource(d3.randomLcg(401))
        .force("x", d3.forceX(d => d.anchorX).strength(0.08))
        .force("y", d3.forceY(d => d.anchorY).strength(0.08))
        .force("collide", d3.forceCollide(d => d.r + 1.5).iterations(5)).stop();
    simulation.tick(500);
    const circles = cartogram.append("g").selectAll("circle").data(nodes).join("circle")
        .attr("class", "map-region cartogram-circle").attr("data-iso3", d => d.iso3)
        .attr("cx", d => d.x).attr("cy", d => d.y).attr("r", d => d.r).attr("fill", d => color(d.value));
    bindInteractions(circles, d => d.iso3);
    cartogram.append("g").selectAll("text").data(nodes).join("text").attr("class", "cartogram-label")
        .attr("x", d => d.x).attr("y", d => d.y).attr("font-size", d => Math.min(14, d.r * 1.05))
        .style("fill", d => d.value > 10000 ? "#fff" : "#354255").text(d => d.iso3);

    const colorLegend = d3.select("#color-legend").append("svg").attr("viewBox", `0 0 ${width} 150`).attr("role", "img");
    colorLegend.append("title").text("2025 GDP in billions of US dollars; logarithmic color scale, from 300 to 30,616");
    const gradient = colorLegend.append("defs").append("linearGradient").attr("id", "gdp-gradient");
    gradient.selectAll("stop").data(d3.range(0, 1.001, 0.05)).join("stop").attr("offset", d => `${d * 100}%`)
        .attr("stop-color", d => color(Math.exp(Math.log(domain[0]) + d * Math.log(domain[1] / domain[0]))));
    colorLegend.append("text").attr("class", "legend-title").attr("x", 24).attr("y", 19).text("GDP · billions of US dollars");
    colorLegend.append("rect").attr("x", 24).attr("y", 53).attr("width", width - 48).attr("height", 16).attr("rx", 3).attr("fill", "url(#gdp-gradient)");
    const legendScale = d3.scaleLog().domain(domain).range([24, width - 24]);
    const ticks = [domain[0], 1000, 5000, 10000, domain[1]];
    colorLegend.selectAll("line").data(ticks).join("line").attr("x1", legendScale).attr("x2", legendScale).attr("y1", 70).attr("y2", 76).attr("stroke", "#aeb8c4");
    colorLegend.selectAll("text.tick").data(ticks).join("text").attr("class", "legend-label tick").attr("x", legendScale).attr("y", 94)
        .attr("text-anchor", (d, i) => i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle").text(tickFormat);
    colorLegend.append("text").attr("class", "legend-label").attr("x", 24).attr("y", 124).text("Log scale · equal color steps represent equal ratios");

    const areaLegend = d3.select("#area-legend").append("svg").attr("viewBox", `0 0 ${width} 150`).attr("role", "img");
    areaLegend.append("title").text("Circle areas represent GDP: 1,000, 5,000 and 10,000 billion US dollars at the initial map scale");
    areaLegend.append("text").attr("class", "legend-title").attr("x", 24).attr("y", 19).text("Circle area · billions of US dollars");
    const sizes = [{value: 1000, x: 85}, {value: 5000, x: 255}, {value: 10000, x: 480}];
    areaLegend.selectAll("circle").data(sizes).join("circle").attr("cx", d => d.x).attr("cy", d => 120 - radius(d.value))
        .attr("r", d => radius(d.value)).attr("fill", d => color(d.value)).attr("stroke", "#fff");
    areaLegend.selectAll("text.size").data(sizes).join("text").attr("class", "legend-label size").attr("x", d => d.x)
        .attr("y", 141).attr("text-anchor", "middle").text(d => tickFormat(d.value));

    function description(id) {
        const data = byId.get(id);
        return data ? `${data.country} · $${valueFormat(data.value)} billion · rank ${data.rank} of 50` : `${features.get(id).properties.name} · No GDP value in the provided top-50 dataset`;
    }

    function updateHighlight() {
        const active = hovered || selected;
        d3.selectAll(".map-region").classed("is-active", function () { return this.getAttribute("data-iso3") === active; })
            .attr("aria-pressed", function () { return this.getAttribute("data-iso3") === selected ? "true" : "false"; });
        d3.select("#selection-status").text(active ? description(active) : "50 of 50 GDP records matched. Hover over an economy, or click to keep it selected.");
        selector.property("value", selected && byId.has(selected) ? selected : "");
    }

    function showTooltip(event, id) {
        const data = byId.get(id);
        tooltip.selectAll("*").remove();
        tooltip.append("strong").text(data ? data.country : features.get(id).properties.name);
        tooltip.append("div").text(data ? `2025 GDP: $${valueFormat(data.value)} billion` : "No GDP value in the provided dataset");
        if (data) tooltip.append("div").text(`Rank ${data.rank} of 50 · ${id}`);
        tooltip.attr("hidden", null);
        positionTooltip(event);
    }

    function positionTooltip(event) {
        const box = tooltip.node().getBoundingClientRect();
        const target = event.currentTarget.getBoundingClientRect();
        const x = event.clientX || target.left + target.width / 2;
        const y = event.clientY || target.top + target.height / 2;
        tooltip.style("left", `${Math.max(10, Math.min(x + 14, window.innerWidth - box.width - 10))}px`)
            .style("top", `${Math.max(10, Math.min(y + 14, window.innerHeight - box.height - 10))}px`);
    }

    function bindInteractions(elements, key) {
        elements.attr("tabindex", 0).attr("role", "button").attr("aria-label", d => description(key(d)))
            .on("pointerenter focus", (event, d) => { hovered = key(d); updateHighlight(); showTooltip(event, hovered); })
            .on("pointermove", positionTooltip)
            .on("pointerleave blur", () => { hovered = null; updateHighlight(); tooltip.attr("hidden", true); })
            .on("click", (event, d) => { selected = selected === key(d) ? null : key(d); updateHighlight(); })
            .on("keydown", (event, d) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selected = selected === key(d) ? null : key(d);
                    updateHighlight();
                }
            });
    }

    selector.on("change", function () {
        selected = this.value || null;
        hovered = null;
        tooltip.attr("hidden", true);
        updateHighlight();
    });
    d3.select("#reset-view").on("click", () => {
        selected = null;
        hovered = null;
        tooltip.attr("hidden", true);
        for (const {svg, zoom} of maps) svg.interrupt().call(zoom.transform, d3.zoomIdentity);
        updateHighlight();
    });
    d3.selectAll(".lab9-controls select, .lab9-controls button").property("disabled", false);
    updateHighlight();
}

initialize().catch(error => {
    d3.select("#selection-status").text("The map data could not be loaded. Please reload the page.");
    console.error(error);
});
