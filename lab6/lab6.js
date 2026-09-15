const width = 1100;
const height = 880;
const statusColors = {
    Increase: "#EBA4B6",
    Unchanged: "#EED5BD",
    Decrease: "#CAB8DC"
};
const tooltip = d3.select("#tooltip");
const formatGDP = d3.format(",.0f");

function headerHeight(node) {
    const availableHeight = node.y1 - node.y0;
    if (node.depth === 1) return Math.min(22, availableHeight * 0.12);
    if (node.depth === 2) return Math.min(16, availableHeight * 0.20);
    return 0;
}

function fitLabel(text, label, availableWidth, fontSize) {
    text.attr("font-size", fontSize).text(label);
    if (availableWidth <= 4) {
        text.text("");
        return;
    }
    while (text.node().getComputedTextLength() > availableWidth && fontSize > 8) {
        fontSize -= 0.5;
        text.attr("font-size", fontSize);
    }
    while (text.node().getComputedTextLength() > availableWidth && label.length > 1) {
        label = label.slice(0, -1);
        text.text(`${label}…`);
    }
    if (text.node().getComputedTextLength() > availableWidth) text.text("");
}

function showTooltip(event, node) {
    tooltip.selectAll("*").remove();
    tooltip.append("strong").text(node.data.name);
    tooltip.append("div").text(`Continent: ${node.parent.parent.data.name}`);
    tooltip.append("div").text(`Area: ${node.parent.data.name}`);
    tooltip.append("div").text(`GDP: ${formatGDP(node.value)} billion USD`);
    tooltip.append("div").text(`GDP status: ${node.data.status}`);
    tooltip.property("hidden", false);
    moveTooltip(event);
}

function moveTooltip(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX ?? bounds.left + bounds.width / 2;
    const y = event.clientY ?? bounds.top + bounds.height / 2;
    const box = tooltip.node().getBoundingClientRect();
    tooltip
        .style("left", `${Math.max(10, Math.min(x + 12, window.innerWidth - box.width - 10))}px`)
        .style("top", `${Math.max(10, Math.min(y + 12, window.innerHeight - box.height - 10))}px`);
}

function drawTreemap(data, selector, tile) {
    const root = d3.hierarchy(data)
        .sum(node => node.gdp || 0)
        .sort((a, b) => b.value - a.value);

    d3.treemap()
        .tile(tile)
        .size([width, height])
        .paddingInner(node => node.depth === 0 ? 3 : 1)
        .paddingOuter(node => node.depth === 0 ? 0 : 1)
        .paddingTop(headerHeight)(root);

    const svg = d3.select(selector).append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("aria-label", `${selector.slice(1)} treemap of GDP by continent, area, and country`);
    const defs = svg.append("defs");
    const groups = root.descendants().filter(node => node.depth === 1 || node.depth === 2);

    svg.selectAll(".group-frame")
        .data(groups)
        .join("rect")
        .attr("class", node => `group-frame${node.depth === 1 ? " continent" : ""}`)
        .attr("x", node => node.x0)
        .attr("y", node => node.y0)
        .attr("width", node => node.x1 - node.x0)
        .attr("height", node => node.y1 - node.y0);

    const countries = svg.selectAll(".country")
        .data(root.leaves())
        .join("g")
        .attr("class", "country")
        .attr("transform", node => `translate(${node.x0},${node.y0})`)
        .attr("tabindex", 0)
        .attr("role", "img")
        .attr("aria-label", node => `${node.parent.parent.data.name}, ${node.parent.data.name}, ${node.data.name}: ${formatGDP(node.value)} billion USD, ${node.data.status}`)
        .on("mouseenter", showTooltip)
        .on("mousemove", moveTooltip)
        .on("mouseleave", () => tooltip.property("hidden", true))
        .on("focus", showTooltip)
        .on("blur", () => tooltip.property("hidden", true));

    countries.append("rect")
        .attr("width", node => node.x1 - node.x0)
        .attr("height", node => node.y1 - node.y0)
        .attr("fill", node => statusColors[node.data.status]);

    countries.each(function(node, index) {
        const cell = d3.select(this);
        const cellWidth = node.x1 - node.x0;
        const cellHeight = node.y1 - node.y0;
        const rotated = cellWidth < 38 && cellHeight > cellWidth;
        const labelWidth = rotated ? cellHeight : cellWidth;
        const labelHeight = rotated ? cellWidth : cellHeight;
        const clipId = `${selector.slice(1)}-country-${index}`;
        defs.append("clipPath").attr("id", clipId)
            .append("rect")
            .attr("width", Math.max(0, labelWidth - 6))
            .attr("height", Math.max(0, labelHeight - 4));
        const labels = cell.append("g")
            .attr("transform", rotated ? `translate(2,${cellHeight - 3}) rotate(-90)` : "translate(3,2)")
            .attr("clip-path", `url(#${clipId})`);
        const fontSize = Math.min(13, Math.max(8, labelHeight * 0.34));
        const name = labels.append("text")
            .attr("class", "country-label")
            .attr("y", fontSize);
        fitLabel(name, node.data.name, labelWidth - 6, fontSize);
        if (labelHeight >= 37 && labelWidth >= 48) {
            fitLabel(labels.append("text")
                .attr("class", "gdp-label")
                .attr("y", fontSize + 16), formatGDP(node.value), labelWidth - 6, 11);
        }
    });

    svg.selectAll(".group-label")
        .data(groups)
        .join("text")
        .attr("class", "group-label")
        .each(function(node) {
            const labelHeight = headerHeight(node);
            const fontSize = Math.min(node.depth === 1 ? 16 : 12, labelHeight - 2);
            const text = d3.select(this)
                .attr("x", node.x0 + 2)
                .attr("y", node.y0 + fontSize + 1);
            if (fontSize >= 7) fitLabel(text, node.data.name, node.x1 - node.x0 - 4, fontSize);
        });
}

d3.json("../data/lab6_assignment_gdp.json")
    .then(data => {
        drawTreemap(data, "#squarify", d3.treemapSquarify);
        drawTreemap(data, "#binary", d3.treemapBinary);
    })
    .catch(() => {
        d3.selectAll(".chart").append("p")
            .attr("class", "error")
            .text("The GDP data could not be loaded.");
    });
