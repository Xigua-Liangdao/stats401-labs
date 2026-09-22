const palette = ["#d889a5", "#a793c3", "#86acbd", "#d2ae79", "#7ea894", "#b698a6", "#91a0cf", "#c5947e"];
const number = new Intl.NumberFormat("en-US");
const tooltip = d3.select("#lab8-tooltip");

function showTooltip(event, title, body) {
    tooltip.selectAll("*").remove();
    tooltip.append("strong").text(title);
    tooltip.append("div").text(body);
    tooltip.attr("hidden", null);
    const bounds = tooltip.node().getBoundingClientRect();
    const target = event.currentTarget.getBoundingClientRect();
    const x = event.clientX || target.left + target.width / 2;
    const y = event.clientY || target.top;
    tooltip.style("left", `${Math.max(10, Math.min(x + 14, window.innerWidth - bounds.width - 10))}px`)
        .style("top", `${Math.max(10, Math.min(y + 14, window.innerHeight - bounds.height - 10))}px`);
}

function hideTooltip() {
    tooltip.attr("hidden", true);
}

function drawBars(selector, rows, color) {
    const width = 520;
    const height = 360;
    const margin = {top: 8, right: 40, bottom: 12, left: 216};
    const x = d3.scaleLinear().domain([0, d3.max(rows, d => d.count)]).range([0, width - margin.left - margin.right]);
    const y = d3.scaleBand().domain(d3.range(rows.length)).range([margin.top, height - margin.bottom]).padding(0.3);
    const svg = d3.select(selector).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img");
    svg.append("title").text(rows.map(d => `${d.label}: ${d.count}`).join("; "));
    const row = svg.selectAll("g").data(rows).join("g").attr("transform", (d, i) => `translate(0,${y(i)})`);
    row.append("text").attr("class", "overview-label").attr("x", margin.left - 10).attr("y", y.bandwidth() / 2)
        .attr("dy", "0.35em").attr("text-anchor", "end").text(d => d.label.length > 29 ? `${d.label.slice(0, 28)}…` : d.label);
    row.append("rect").attr("x", margin.left).attr("width", d => x(d.count)).attr("height", y.bandwidth()).attr("rx", 3).attr("fill", color);
    row.append("text").attr("class", "overview-value").attr("x", d => margin.left + x(d.count) + 6)
        .attr("y", y.bandwidth() / 2).attr("dy", "0.35em").text(d => number.format(d.count));
    row.append("title").text(d => `${d.context || d.label}: ${number.format(d.count)}`);
}

async function initialize() {
    const [passages, analysis, neighbors] = await Promise.all([
        d3.csv("../data/lab8_embedding_map.csv", d => ({...d, x: +d.x, y: +d.y, word_count: +d.word_count, cluster: +d.cluster, page: +d.page, page_end: +d.page_end})),
        d3.json("../data/lab8_analysis.json"),
        d3.json("../data/lab8_neighbors.json")
    ]);
    const byId = new Map(passages.map(d => [d.passage_id, d]));
    const state = {query: "", section: "", topic: "", selected: null};
    const color = d3.scaleOrdinal().domain(analysis.topics.map(d => d.id)).range(palette);
    const radius = d3.scaleSqrt().domain([0, d3.max(passages, d => d.word_count)]).range([0, 9]);
    const search = d3.select("#search");
    const sectionFilter = d3.select("#section-filter");
    const topicFilter = d3.select("#topic-filter");
    const detail = d3.select("#detail-panel");

    d3.select("#raw-count").text(number.format(analysis.corpus.raw_passages));
    d3.select("#clean-count").text(number.format(analysis.corpus.clean_passages));
    d3.select("#average-length").text(analysis.corpus.average_words.toFixed(1));
    d3.select("#section-count").text(analysis.corpus.sections);
    d3.select("#corpus-scope").text(analysis.corpus.coverage);
    drawBars("#section-summary", [...analysis.sections].sort((a, b) => b.count - a.count).slice(0, 10)
        .map(d => ({label: d.name, count: d.count, context: `${d.chapter} · ${d.name}`})), "#91a8bc");
    drawBars("#term-summary", analysis.top_terms.map(d => ({label: d.term, count: d.count})), "#d4a1b6");

    for (const [chapter, sections] of d3.group(analysis.sections, d => d.chapter)) {
        sectionFilter.append("optgroup").attr("label", chapter).selectAll("option").data(sections).join("option")
            .attr("value", d => d.key).text(d => d.name);
    }
    topicFilter.selectAll("option.topic-option").data(analysis.topics).join("option").attr("class", "topic-option")
        .attr("value", d => d.id).text(d => d.name);
    const legend = d3.select("#topic-legend").selectAll("span").data(analysis.topics).join("span");
    legend.append("i").style("background", d => color(d.id));
    legend.append("span").text(d => `${d.name} (${d.count})`);
    legend.attr("title", d => `Characteristic terms: ${d.terms.join(", ")}`);

    const width = 800;
    const height = 620;
    const xExtent = d3.extent(passages, d => d.x);
    const yExtent = d3.extent(passages, d => d.y);
    const unit = Math.min((width - 64) / (xExtent[1] - xExtent[0]), (height - 64) / (yExtent[1] - yExtent[0]));
    const x = d => width / 2 + (d.x - d3.mean(xExtent)) * unit;
    const y = d => height / 2 - (d.y - d3.mean(yExtent)) * unit;
    const svg = d3.select("#embedding-map").append("svg").attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "group").attr("aria-label", "UMAP map of 1,014 bulletin passages. Select a circle to read it.");
    svg.append("defs").append("clipPath").attr("id", "map-clip").append("rect").attr("width", width).attr("height", height);
    const layer = svg.append("g").attr("clip-path", "url(#map-clip)").append("g").attr("class", "map-points");
    const zoom = d3.zoom().scaleExtent([1, 10]).extent([[0, 0], [width, height]])
        .on("zoom", event => { layer.attr("transform", event.transform); hideTooltip(); });
    svg.call(zoom);
    const points = layer.selectAll("circle").data(passages).join("circle").attr("class", "passage")
        .attr("data-passage", d => d.passage_id).attr("data-section", d => d.section_key).attr("data-cluster", d => d.cluster)
        .attr("cx", x).attr("cy", y).attr("r", d => radius(d.word_count)).attr("fill", d => color(d.cluster))
        .attr("tabindex", 0).attr("role", "button").attr("aria-label", d => `${d.passage_id}, ${d.section}, page ${d.page}, ${d.cluster_name}`)
        .on("click", (event, d) => selectPassage(d.passage_id))
        .on("keydown", (event, d) => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectPassage(d.passage_id); }
        })
        .on("pointerenter focus", (event, d) => showTooltip(event, `${d.section} · p. ${d.page}`, `${d.cluster_name} · ${d.word_count} words. ${d.text.slice(0, 180)}${d.text.length > 180 ? "…" : ""}`))
        .on("pointerleave blur", hideTooltip);
    const sizeLegend = d3.select("#size-legend").append("svg").attr("viewBox", "0 0 240 34").attr("aria-label", "Circle area represents passage word count");
    sizeLegend.selectAll("circle").data([50, 150, 300]).join("circle").attr("cx", (d, i) => 13 + i * 65).attr("cy", 16)
        .attr("r", radius).attr("fill", "#b7c3d0").attr("stroke", "#fff");
    sizeLegend.selectAll("text").data([50, 150, 300]).join("text").attr("x", (d, i) => 25 + i * 65).attr("y", 20).text(d => d);
    sizeLegend.append("text").attr("x", 185).attr("y", 20).text("words");

    const table = d3.select("#topic-matrix");
    const head = table.append("thead").append("tr");
    head.append("th").attr("scope", "col").text("Formal section");
    head.selectAll("th.topic-heading").data(analysis.topics).join("th").attr("class", "topic-heading")
        .attr("scope", "col").text(d => d.name).style("border-top", d => `4px solid ${color(d.id)}`);
    const rows = table.append("tbody").selectAll("tr").data(analysis.sections).join("tr");
    const labels = rows.append("th").attr("scope", "row");
    labels.append("span").text(d => d.name);
    labels.append("small").text(d => d.chapter);
    const maximum = d3.max(analysis.sections, d => d3.max(d.topics));
    const heat = d3.scaleSequentialLog([1, maximum], d3.interpolateRgb("#fff7fa", "#916387"));
    const cells = rows.selectAll("td").data(section => analysis.topics.map(topic => ({section, topic, count: section.topics[topic.id]})))
        .join("td").append("button").attr("type", "button").attr("data-section", d => d.section.key).attr("data-cluster", d => d.topic.id)
        .attr("aria-label", d => `${d.section.name}, ${d.topic.name}: ${d.count} ${d.count === 1 ? "passage" : "passages"}`)
        .attr("disabled", d => d.count === 0 ? true : null).style("background", d => d.count ? heat(d.count) : "#f5f7fa")
        .style("color", d => d.count > 60 ? "#fff" : "#172033").text(d => d.count || "–")
        .on("pointerenter focus", (event, d) => showTooltip(event, d.section.name, `${d.section.chapter} · ${d.topic.name}: ${d.count} ${d.count === 1 ? "passage" : "passages"}`))
        .on("pointerleave blur", hideTooltip)
        .on("click", (event, d) => {
            state.section = d.section.key;
            state.topic = String(d.topic.id);
            state.query = "";
            state.selected = null;
            syncControls();
            update();
            renderDetail();
            svg.call(zoom.transform, d3.zoomIdentity);
            document.querySelector("#semantic-map").scrollIntoView({behavior: "smooth", block: "start"});
        });

    function inFilter(d) {
        return (!state.section || d.section_key === state.section) && (state.topic === "" || d.cluster === +state.topic);
    }

    function matchesSearch(d) {
        return !state.query || d.text.toLowerCase().includes(state.query);
    }

    function syncControls() {
        search.property("value", state.query);
        sectionFilter.property("value", state.section);
        topicFilter.property("value", state.topic);
    }

    function update() {
        const nearby = new Set(state.selected ? neighbors[state.selected].map(d => d.id) : []);
        points.style("display", d => inFilter(d) ? null : "none")
            .attr("opacity", d => matchesSearch(d) || d.passage_id === state.selected || nearby.has(d.passage_id) ? 0.9 : 0.08)
            .classed("selected", d => d.passage_id === state.selected).classed("neighbor", d => nearby.has(d.passage_id))
            .attr("aria-pressed", d => d.passage_id === state.selected ? "true" : "false");
        points.filter(d => nearby.has(d.passage_id)).raise();
        points.filter(d => d.passage_id === state.selected).raise();
        const visible = passages.filter(inFilter);
        const matched = visible.filter(matchesSearch);
        d3.select("#map-status").text(`${number.format(visible.length)} of ${number.format(passages.length)} passages shown${state.query ? ` · ${number.format(matched.length)} match “${state.query}”` : ""}`);
        const selected = byId.get(state.selected);
        cells.classed("selected-cell", d => selected ? d.section.key === selected.section_key && d.topic.id === selected.cluster : d.section.key === state.section && String(d.topic.id) === state.topic);
    }

    function selectPassage(id, reveal = false) {
        const passage = byId.get(id);
        if (!passage) return;
        if (reveal) {
            if (!inFilter(passage)) { state.section = ""; state.topic = ""; }
            if (!matchesSearch(passage)) state.query = "";
            syncControls();
            svg.call(zoom.transform, d3.zoomIdentity);
        }
        state.selected = id;
        hideTooltip();
        update();
        renderDetail();
    }

    function renderDetail() {
        detail.selectAll("*").remove();
        const passage = byId.get(state.selected);
        detail.append("h3").text(passage ? passage.section : "Passage details");
        if (!passage) {
            detail.append("p").attr("class", "detail-placeholder").text("Select a point to read its passage, document hierarchy, and five nearest semantic neighbors.");
            return;
        }
        const list = detail.append("dl");
        const metadata = [["Passage", passage.passage_id], ["Chapter", passage.chapter], ["Section", passage.section],
            ["Subsection", passage.subsection || "—"], ["Topic", passage.cluster_name], ["Length", `${passage.word_count} words`]];
        for (const [label, value] of metadata) {
            list.append("dt").text(label);
            list.append("dd").text(value);
        }
        list.append("dt").text("Page");
        list.append("dd").append("a").attr("href", `../data/lab8_bulletin_2021_2022.pdf#page=${passage.page}`)
            .attr("target", "_blank").attr("rel", "noopener")
            .text(`${passage.page === passage.page_end ? passage.page : `${passage.page}–${passage.page_end}`} · Open PDF`);
        detail.append("p").attr("class", "passage-text").text(passage.text);
        detail.append("h4").text("Five nearest passages");
        detail.append("p").attr("class", "neighbor-note").text("Cosine similarity in the original embedding space, across the whole corpus. Select a passage to read it.");
        const buttons = detail.append("ol").attr("class", "neighbor-list").selectAll("li").data(neighbors[passage.passage_id]).join("li")
            .append("button").attr("type", "button").attr("data-passage", d => d.id).on("click", (event, d) => selectPassage(d.id, true));
        buttons.append("strong").text(d => `${byId.get(d.id).section} · p. ${byId.get(d.id).page}`);
        buttons.append("span").attr("class", "similarity").text(d => `${d.id} · cosine ${d.similarity.toFixed(3)}`);
        buttons.append("span").text(d => {
            const text = byId.get(d.id).text;
            return text.length > 200 ? `${text.slice(0, 200)}…` : text;
        });
        detail.node().scrollTop = 0;
    }

    search.on("input", function () { state.query = this.value.toLowerCase().trim(); update(); });
    sectionFilter.on("change", function () {
        state.section = this.value;
        state.selected = null;
        update();
        renderDetail();
    });
    topicFilter.on("change", function () {
        state.topic = this.value;
        state.selected = null;
        update();
        renderDetail();
    });
    d3.select("#reset-view").on("click", () => {
        Object.assign(state, {query: "", section: "", topic: "", selected: null});
        syncControls();
        update();
        renderDetail();
        svg.call(zoom.transform, d3.zoomIdentity);
    });
    d3.selectAll(".passage-reference").on("click", function () { selectPassage(this.dataset.passage, true); });
    d3.selectAll(".lab8-controls input, .lab8-controls select, .lab8-controls button").property("disabled", false);
    update();
}

initialize().catch(error => {
    d3.select("#map-status").text("The passage data could not be loaded. Please reload the page.");
    console.error(error);
});
