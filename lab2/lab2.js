const regionOrder = ["North", "South", "East", "West"];

const regionColors = new Map([
    ["North", "#5b7cfa"],
    ["South", "#e36b5d"],
    ["East", "#24a07a"],
    ["West", "#9a6add"]
]);

const developmentRadius = new Map([
    ["Low", 7],
    ["Medium", 11],
    ["High", 15]
]);

const developmentStroke = new Map([
    ["Low", 2],
    ["Medium", 4],
    ["High", 7]
]);

const tooltip = d3.select("#tooltip");

function tooltipContent(d) {
    return `
        <strong>${d.city}</strong>
        <span>Region: ${d.region}</span>
        <span>Population: ${d.population.toFixed(1)} million</span>
        <span>Temperature: ${d.temp_c.toFixed(1)}°C</span>
        <span>Development: ${d.development_level}</span>
    `;
}

function positionTooltip(event) {
    const targetBox = event.currentTarget.getBoundingClientRect();
    const pageX = event.pageX || window.scrollX + targetBox.left + targetBox.width / 2;
    const pageY = event.pageY || window.scrollY + targetBox.top;

    tooltip
        .style("left", `${pageX + 14}px`)
        .style("top", `${pageY + 14}px`);
}

function showTooltip(event, d) {
    tooltip
        .html(tooltipContent(d))
        .classed("visible", true);
    positionTooltip(event);
}

function hideTooltip() {
    tooltip.classed("visible", false);
}

function addTooltipEvents(selection) {
    selection
        .attr("tabindex", 0)
        .attr("role", "img")
        .attr("aria-label", d =>
            `${d.city}, ${d.region}, population ${d.population.toFixed(1)} million, ` +
            `${d.temp_c.toFixed(1)} degrees Celsius, ${d.development_level} development`
        )
        .on("pointerenter", showTooltip)
        .on("pointermove", positionTooltip)
        .on("pointerleave", hideTooltip)
        .on("focus", showTooltip)
        .on("blur", hideTooltip);
}

function temperatureScale(data) {
    const [minimum, maximum] = d3.extent(data, d => d.temp_c);
    return d3.scaleSequential(d3.interpolateRdYlBu)
        .domain([maximum, minimum]);
}

function drawTemperatureLegend(svg, scale, x, y, width) {
    const gradientId = `temperature-gradient-${Math.random().toString(16).slice(2)}`;
    const [maximum, minimum] = scale.domain();

    const gradient = svg.append("defs")
        .append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("x2", "100%");

    gradient.selectAll("stop")
        .data(d3.range(0, 1.01, 0.1))
        .join("stop")
        .attr("offset", d => `${d * 100}%`)
        .attr("stop-color", d => scale(minimum + d * (maximum - minimum)));

    const legend = svg.append("g")
        .attr("class", "temperature-legend")
        .attr("transform", `translate(${x}, ${y})`);

    legend.append("text")
        .attr("class", "legend-title")
        .attr("y", -10)
        .text("Average temperature");

    legend.append("rect")
        .attr("width", width)
        .attr("height", 12)
        .attr("rx", 6)
        .attr("fill", `url(#${gradientId})`);

    legend.append("text")
        .attr("class", "legend-value")
        .attr("y", 30)
        .text(`${minimum.toFixed(1)}°C`);

    legend.append("text")
        .attr("class", "legend-value")
        .attr("x", width)
        .attr("y", 30)
        .attr("text-anchor", "end")
        .text(`${maximum.toFixed(1)}°C`);
}

function drawDevelopmentLegend(svg, x, y) {
    const legend = svg.append("g")
        .attr("class", "development-legend")
        .attr("transform", `translate(${x}, ${y})`);

    legend.append("text")
        .attr("class", "legend-title")
        .attr("y", -14)
        .text("Development level");

    const items = legend.selectAll("g")
        .data(["Low", "Medium", "High"])
        .join("g")
        .attr("transform", (d, i) => `translate(${i * 88}, 0)`);

    items.append("circle")
        .attr("cx", 10)
        .attr("cy", 8)
        .attr("r", 7)
        .attr("fill", "#ffffff")
        .attr("stroke", "#263748")
        .attr("stroke-width", d => Math.min(developmentStroke.get(d), 5));

    items.append("text")
        .attr("class", "legend-value")
        .attr("x", 24)
        .attr("y", 12)
        .text(d => d);
}

function drawClusteredBubbles(data) {
    const width = 960;
    const height = 700;

    const centers = new Map([
        ["North", { x: 250, y: 205 }],
        ["South", { x: 710, y: 205 }],
        ["East", { x: 250, y: 485 }],
        ["West", { x: 710, y: 485 }]
    ]);

    const panels = [
        { region: "North", x: 28, y: 60 },
        { region: "South", x: 488, y: 60 },
        { region: "East", x: 28, y: 340 },
        { region: "West", x: 488, y: 340 }
    ];

    const radius = d3.scaleSqrt()
        .domain([0, d3.max(data, d => d.population)])
        .range([0, 48]);

    const color = temperatureScale(data);

    const svg = d3.select("#clustered-bubbles")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "img")
        .attr("aria-labelledby", "bubble-title bubble-description");

    svg.append("title")
        .attr("id", "bubble-title")
        .text("Regional city clusters");

    svg.append("desc")
        .attr("id", "bubble-description")
        .text("Cities are grouped by region. Bubble area shows population, color shows temperature, and outline thickness shows development level.");

    const panel = svg.selectAll("g.region-panel-group")
        .data(panels)
        .join("g")
        .attr("class", "region-panel-group");

    panel.append("rect")
        .attr("class", "region-panel")
        .attr("x", d => d.x)
        .attr("y", d => d.y)
        .attr("width", 444)
        .attr("height", 252)
        .attr("rx", 24);

    panel.append("text")
        .attr("class", "region-label")
        .attr("x", d => d.x + 22)
        .attr("y", d => d.y + 32)
        .attr("fill", d => regionColors.get(d.region))
        .text(d => d.region);

    const nodes = data.map(d => ({
        ...d,
        r: radius(d.population),
        x: centers.get(d.region).x,
        y: centers.get(d.region).y
    }));

    const simulation = d3.forceSimulation(nodes)
        .force("x", d3.forceX(d => centers.get(d.region).x).strength(0.16))
        .force("y", d3.forceY(d => centers.get(d.region).y).strength(0.16))
        .force("collide", d3.forceCollide(d => d.r + 9).strength(1).iterations(3))
        .stop();

    for (let tick = 0; tick < 260; tick += 1) {
        simulation.tick();
    }

    const bubbles = svg.append("g")
        .attr("class", "bubble-layer")
        .selectAll("g.city-bubble")
        .data(nodes)
        .join("g")
        .attr("class", "city-bubble")
        .attr("transform", d => `translate(${d.x}, ${d.y})`);

    bubbles.append("circle")
        .attr("class", "bubble-shadow")
        .attr("r", d => d.r + 5);

    bubbles.append("circle")
        .attr("class", "bubble-mark")
        .attr("r", d => d.r)
        .attr("fill", d => color(d.temp_c))
        .attr("stroke", "#263748")
        .attr("stroke-width", d => developmentStroke.get(d.development_level));

    bubbles.append("text")
        .attr("class", "bubble-city-name")
        .attr("y", -2)
        .text(d => d.city);

    bubbles.append("text")
        .attr("class", "bubble-population")
        .attr("y", 15)
        .text(d => `${d.population.toFixed(1)}M`);

    addTooltipEvents(bubbles);
    drawTemperatureLegend(svg, color, 72, 658, 220);
    drawDevelopmentLegend(svg, 585, 658);
}

function drawScatterplot(data) {
    const width = 960;
    const height = 570;
    const margin = { top: 42, right: 245, bottom: 78, left: 78 };

    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.population))
        .nice()
        .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
        .domain(d3.extent(data, d => d.temp_c))
        .nice()
        .range([height - margin.bottom, margin.top]);

    const svg = d3.select("#city-scatterplot")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "img")
        .attr("aria-labelledby", "scatter-title scatter-description");

    svg.append("title")
        .attr("id", "scatter-title")
        .text("City population and temperature scatterplot");

    svg.append("desc")
        .attr("id", "scatter-description")
        .text("Population is shown on the horizontal axis, temperature on the vertical axis, region by color, and development level by point size.");

    svg.append("g")
        .attr("class", "grid-lines")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(x)
            .ticks(6)
            .tickSize(-(height - margin.top - margin.bottom))
            .tickFormat(""));

    svg.append("g")
        .attr("class", "grid-lines")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(y)
            .ticks(6)
            .tickSize(-(width - margin.left - margin.right))
            .tickFormat(""));

    svg.append("g")
        .attr("class", "chart-axis")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(6));

    svg.append("g")
        .attr("class", "chart-axis")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(y).ticks(6));

    svg.append("text")
        .attr("class", "axis-title")
        .attr("x", (margin.left + width - margin.right) / 2)
        .attr("y", height - 22)
        .text("Population (millions)");

    svg.append("text")
        .attr("class", "axis-title")
        .attr("transform", "rotate(-90)")
        .attr("x", -(margin.top + height - margin.bottom) / 2)
        .attr("y", 22)
        .text("Average temperature (°C)");

    const points = svg.append("g")
        .attr("class", "scatter-points")
        .selectAll("g.city-point")
        .data(data)
        .join("g")
        .attr("class", "city-point")
        .attr("transform", d => `translate(${x(d.population)}, ${y(d.temp_c)})`);

    points.append("circle")
        .attr("r", d => developmentRadius.get(d.development_level))
        .attr("fill", d => regionColors.get(d.region));

    points.append("text")
        .attr("class", "point-label")
        .attr("x", d => developmentRadius.get(d.development_level) + 5)
        .attr("y", -5)
        .text(d => d.city);

    addTooltipEvents(points);

    const regionLegend = svg.append("g")
        .attr("class", "scatter-legend")
        .attr("transform", `translate(${width - margin.right + 55}, 80)`);

    regionLegend.append("text")
        .attr("class", "legend-title")
        .text("Region");

    const regionItems = regionLegend.selectAll("g")
        .data(regionOrder)
        .join("g")
        .attr("transform", (d, i) => `translate(0, ${28 + i * 34})`);

    regionItems.append("circle")
        .attr("r", 7)
        .attr("fill", d => regionColors.get(d));

    regionItems.append("text")
        .attr("class", "legend-value")
        .attr("x", 16)
        .attr("y", 4)
        .text(d => d);

    const sizeLegend = svg.append("g")
        .attr("class", "scatter-legend")
        .attr("transform", `translate(${width - margin.right + 55}, 285)`);

    sizeLegend.append("text")
        .attr("class", "legend-title")
        .text("Development level");

    const sizeItems = sizeLegend.selectAll("g")
        .data(["Low", "Medium", "High"])
        .join("g")
        .attr("transform", (d, i) => `translate(0, ${36 + i * 48})`);

    sizeItems.append("circle")
        .attr("r", d => developmentRadius.get(d))
        .attr("fill", "#aeb9c7")
        .attr("opacity", 0.8);

    sizeItems.append("text")
        .attr("class", "legend-value")
        .attr("x", 24)
        .attr("y", 4)
        .text(d => d);
}

d3.csv("../data/cities_multivariate.csv", d => ({
    city: d.city,
    population: +d.population,
    temp_c: +d.temp_c,
    development_level: d.development_level,
    region: d.region
}))
    .then(data => {
        drawClusteredBubbles(data);
        drawScatterplot(data);
    })
    .catch(error => {
        d3.selectAll("#clustered-bubbles, #city-scatterplot")
            .append("p")
            .attr("class", "error-message")
            .text("The city data could not be loaded. Please view this page through a web server.");
        console.error("Unable to load city data:", error);
    });
