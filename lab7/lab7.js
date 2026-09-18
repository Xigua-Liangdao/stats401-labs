const chartWidth = 1100;
const chartHeight = 640;
const frameDuration = 900;
const transitionDuration = 280;
const regionColors = new Map([
    ["Asia", "#EBA4B6"],
    ["Europe", "#CAB8DC"],
    ["North America", "#EED5BD"]
]);
const transactionColors = new Map([
    ["goods", "#B96E89"],
    ["shipping", "#8371B1"],
    ["components", "#628EA9"],
    ["materials", "#A48245"],
    ["services", "#548F80"]
]);
const money = d3.format("$,.2f");
const shortMoney = d3.format("$~s");
const formatDate = d3.utcFormat("%b %-d, %Y");
const parseDate = d3.utcParse("%Y-%m-%d");
const tooltip = d3.select("#lab7-tooltip");
let currentDay = 1;
let timer = null;
let showDay;

function moveTooltip(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX ?? bounds.left + bounds.width / 2;
    const y = event.clientY ?? bounds.top + bounds.height / 2;
    const box = tooltip.node().getBoundingClientRect();
    tooltip
        .style("left", `${Math.max(10, Math.min(x + 14, window.innerWidth - box.width - 10))}px`)
        .style("top", `${Math.max(10, Math.min(y + 14, window.innerHeight - box.height - 10))}px`);
}

function showDetails(event, title, lines) {
    tooltip.selectAll("*").remove();
    tooltip.append("strong").text(title);
    tooltip.selectAll("div").data(lines).join("div").text(d => d);
    tooltip.property("hidden", false);
    moveTooltip(event);
}

function hideTooltip() {
    tooltip.property("hidden", true);
}

function pause() {
    if (timer) timer.stop();
    timer = null;
    d3.select("#play").property("disabled", false);
    d3.select("#pause").property("disabled", true);
}

function play() {
    if (timer) return;
    if (currentDay === 60) showDay(1);
    d3.select("#play").property("disabled", true);
    d3.select("#pause").property("disabled", false);
    timer = d3.interval(() => {
        showDay(currentDay + 1);
        if (currentDay === 60) pause();
    }, frameDuration);
}

function drawLegends(radius, linkWidth) {
    for (const [selector, colors, link] of [
        ["#region-legend", regionColors, false],
        ["#type-legend", transactionColors, true]
    ]) {
        const items = d3.select(selector).selectAll("span")
            .data([...colors]).join("span").attr("class", "lab7-legend-item");
        items.append("i").attr("class", link ? "link-swatch" : null)
            .style("background", d => d[1]);
        items.append("span").text(d => d[0][0].toUpperCase() + d[0].slice(1));
    }

    const sizeLegend = d3.select("#volume-legend").append("svg")
        .attr("viewBox", "0 0 310 104").attr("role", "img")
        .attr("aria-label", "Circle areas for daily volumes of 8,000, 40,000, and 80,000 US dollars");
    const sizes = sizeLegend.selectAll("g").data([8000, 40000, 80000])
        .join("g").attr("transform", (_, i) => `translate(${45 + i * 105},0)`);
    sizes.append("circle").attr("cy", d => 76 - radius(d))
        .attr("r", radius).attr("fill", "#EBA4B6").attr("stroke", "#788597");
    sizes.append("text").attr("y", 99).text(shortMoney);

    const widthLegend = d3.select("#amount-legend").append("svg")
        .attr("viewBox", "0 0 310 48").attr("role", "img")
        .attr("aria-label", "Link widths for transaction amounts of 8,000, 20,000, and 34,000 US dollars");
    const widths = widthLegend.selectAll("g").data([8000, 20000, 34000])
        .join("g").attr("transform", (_, i) => `translate(${45 + i * 105},0)`);
    widths.append("line").attr("x1", -28).attr("x2", 28).attr("y1", 12).attr("y2", 12)
        .attr("stroke", "#788597").attr("stroke-linecap", "round").attr("stroke-width", linkWidth);
    widths.append("text").attr("y", 43).text(shortMoney);
}

function drawNetwork(companies, transactions) {
    const byId = new Map(companies.map(company => [company.id, company]));
    const byDay = d3.group(transactions, d => d.day);
    const frames = d3.range(1, 61).map(day => {
        const links = byDay.get(day) || [];
        const activity = new Map(companies.map(company => [company.id, {volume: 0, count: 0, partners: new Set()}]));
        for (const link of links) {
            for (const [id, partner] of [[link.source, link.target], [link.target, link.source]]) {
                const company = activity.get(id);
                company.volume += link.amount_usd;
                company.count += link.transaction_count;
                company.partners.add(partner);
            }
        }
        return {day, date: links[0].date, links, activity};
    });
    const maximumVolume = d3.max(frames, frame => d3.max([...frame.activity.values()], d => d.volume));
    const radius = d3.scaleSqrt().domain([0, maximumVolume]).range([0, 36]);
    const linkWidth = d3.scaleLinear().domain([0, d3.max(transactions, d => d.amount_usd)]).range([1, 8]);
    const regionX = new Map([["Asia", 185], ["Europe", 550], ["North America", 915]]);
    const regionIndex = new Map();
    companies.forEach(company => {
        const index = regionIndex.get(company.region) || 0;
        regionIndex.set(company.region, index + 1);
        company.anchorX = regionX.get(company.region);
        company.anchorY = 105 + index * 140;
        company.x = company.anchorX;
        company.y = company.anchorY;
    });
    const layoutLinks = [...d3.group(transactions, d => d.key).values()]
        .map(links => ({source: links[0].source, target: links[0].target}));
    const simulation = d3.forceSimulation(companies)
        .randomSource(d3.randomLcg(401))
        .force("link", d3.forceLink(layoutLinks).id(d => d.id).distance(180).strength(0.04))
        .force("charge", d3.forceManyBody().strength(-240))
        .force("collision", d3.forceCollide(68))
        .force("x", d3.forceX(d => d.anchorX).strength(0.35))
        .force("y", d3.forceY(d => d.anchorY).strength(0.2))
        .stop();
    simulation.tick(300);
    companies.forEach(company => {
        company.x = Math.max(95, Math.min(chartWidth - 95, company.x));
        company.y = Math.max(65, Math.min(chartHeight - 95, company.y));
        company.fx = company.x;
        company.fy = company.y;
    });

    const svg = d3.select("#commercial-network").append("svg")
        .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`)
        .attr("aria-label", "Commercial network with company region, daily volume, transaction type, and transaction amount");
    const linksLayer = svg.append("g").attr("class", "links-layer");
    const nodes = svg.append("g").attr("class", "nodes-layer").selectAll("g")
        .data(companies, d => d.id).join("g")
        .attr("class", "company-node")
        .attr("data-company", d => d.id)
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .attr("tabindex", 0).attr("role", "img");
    nodes.append("circle").attr("r", 5).attr("fill", d => regionColors.get(d.region));
    nodes.append("text").attr("y", 52).each(function(company) {
        const words = company.company_name.split(" ");
        const label = d3.select(this);
        label.append("tspan").attr("x", 0).text(words[0]);
        label.append("tspan").attr("x", 0).attr("dy", 16).text(words.slice(1).join(" "));
    });

    function companyDetails(event, company) {
        const frame = frames[currentDay - 1];
        const activity = frame.activity.get(company.id);
        showDetails(event, company.company_name, [
            `Day ${currentDay} · ${formatDate(frame.date)}`,
            `Region: ${company.region}`,
            `Sector: ${company.sector}`,
            `Daily volume: ${money(activity.volume)}`,
            `Active partners: ${activity.partners.size}`,
            `Transactions: ${activity.count}`
        ]);
    }

    function linkDetails(event, link) {
        if (+event.currentTarget.dataset.day !== currentDay) return;
        const source = byId.get(link.source);
        const target = byId.get(link.target);
        showDetails(event, `${source.company_name} ↔ ${target.company_name}`, [
            `Day ${currentDay} · ${formatDate(link.date)}`,
            `${source.region} ↔ ${target.region}`,
            `Type: ${link.transaction_type}`,
            `Amount: ${money(link.amount_usd)}`,
            `Transactions: ${link.transaction_count}`
        ]);
    }

    nodes.on("mouseenter", companyDetails).on("focus", companyDetails)
        .on("mousemove", moveTooltip).on("mouseleave", hideTooltip).on("blur", hideTooltip);

    function linkPath(link) {
        const source = byId.get(link.source);
        const target = byId.get(link.target);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.hypot(dx, dy);
        const curve = 24;
        const cx = (source.x + target.x) / 2 - dy / distance * curve;
        const cy = (source.y + target.y) / 2 + dx / distance * curve;
        return `M${source.x},${source.y}Q${cx},${cy} ${target.x},${target.y}`;
    }

    showDay = day => {
        currentDay = Math.max(1, Math.min(60, day));
        hideTooltip();
        const frame = frames[currentDay - 1];
        d3.select("#current-day").text(`Day ${currentDay} · ${formatDate(frame.date)}`);
        d3.select("#time-slider").property("value", currentDay)
            .attr("aria-valuetext", `Day ${currentDay}, ${formatDate(frame.date)}`);
        const activeCount = [...frame.activity.values()].filter(d => d.volume > 0).length;
        d3.select("#daily-summary").text(`${activeCount} active companies · ${frame.links.length} relationships · ${money(d3.sum(frame.links, d => d.amount_usd))} total transaction value`);

        const links = linksLayer.selectAll(".transaction-link")
            .data(frame.links, d => d.key)
            .join(
                enter => {
                    const group = enter.append("g").attr("class", "transaction-link").style("opacity", 0);
                    group.append("path").attr("class", "transaction-mark");
                    group.append("path").attr("class", "transaction-hit");
                    return group;
                },
                update => update,
                exit => exit.attr("data-active", "false").attr("tabindex", -1).attr("aria-hidden", "true")
                    .style("pointer-events", "none")
                    .interrupt().transition().duration(transitionDuration).style("opacity", 0).remove()
            )
            .attr("data-active", "true").attr("data-day", currentDay)
            .attr("data-pair", d => d.key).attr("data-amount", d => d.amount_usd)
            .attr("tabindex", 0).attr("role", "img").attr("aria-hidden", null)
            .style("pointer-events", null)
            .attr("aria-label", d => `${byId.get(d.source).company_name} and ${byId.get(d.target).company_name}: ${d.transaction_type}, ${money(d.amount_usd)}, ${d.transaction_count} transactions`)
            .on("mouseenter", linkDetails).on("focus", linkDetails)
            .on("mousemove", moveTooltip).on("mouseleave", hideTooltip).on("blur", hideTooltip);
        links.selectAll("path").attr("d", linkPath);
        links.select(".transaction-mark")
            .attr("stroke", d => transactionColors.get(d.transaction_type))
            .interrupt().transition().duration(transitionDuration)
            .attr("stroke-width", d => linkWidth(d.amount_usd));
        links.interrupt().transition().duration(transitionDuration).style("opacity", 1);

        nodes.classed("inactive", d => frame.activity.get(d.id).volume === 0)
            .attr("data-volume", d => frame.activity.get(d.id).volume)
            .attr("data-partners", d => frame.activity.get(d.id).partners.size)
            .attr("aria-label", d => `${d.company_name}, ${d.region}, ${d.sector}: ${money(frame.activity.get(d.id).volume)} daily volume, ${frame.activity.get(d.id).partners.size} active partners`);
        nodes.select("circle")
            .style("stroke", d => frame.activity.get(d.id).volume === 0 ? regionColors.get(d.region) : null)
            .interrupt().transition().duration(transitionDuration)
            .attr("r", d => frame.activity.get(d.id).volume > 0 ? radius(frame.activity.get(d.id).volume) : 5);
    };

    drawLegends(radius, linkWidth);
    showDay(1);
    d3.select("#reset").property("disabled", false).on("click", () => {
        pause();
        showDay(1);
    });
    d3.select("#play").property("disabled", false).on("click", play);
    d3.select("#pause").on("click", pause);
    d3.select("#time-slider").property("disabled", false).on("input", function() {
        pause();
        showDay(+this.value);
    });
}

Promise.all([
    d3.csv("../data/lab7_assignment_companies.csv"),
    d3.csv("../data/lab7_assignment_transactions_60days.csv", row => ({
        date: parseDate(row.date),
        day: +row.day,
        source: row.source,
        target: row.target,
        amount_usd: +row.amount_usd,
        transaction_type: row.transaction_type,
        transaction_count: +row.transaction_count,
        key: [row.source, row.target].sort().join("-")
    }))
]).then(([companies, transactions]) => drawNetwork(companies, transactions))
    .catch(() => {
        d3.select("#daily-summary").attr("class", "error-message")
            .text("The company or transaction data could not be loaded.");
    });
