const SUMMARY_PATH = "../data/lab4_fpl_sentiment_summary.csv";
const TERMS_PATH = "../data/lab4_fpl_top_terms.csv";
const SENTIMENTS = ["Negative", "Neutral", "Positive"];
const TIERS = ["Low", "Medium", "High"];
const COLORS = {
    Negative: "#a65a5a",
    Neutral: "#9aa8b6",
    Positive: "#315f85"
};

const tooltip = d3.select("#lab4-tooltip");
const status = document.querySelector("#chart-status");
let summaryData = [];
let termData = [];
let selectedAccount = "All accounts";
let selectedSentiment = "Positive";

function showTooltip(event, content) {
    const bounds = event.currentTarget?.getBoundingClientRect();
    const pageX = Number.isFinite(event.pageX) && event.pageX > 0
        ? event.pageX
        : (bounds?.right || 0) + window.scrollX;
    const pageY = Number.isFinite(event.pageY) && event.pageY > 0
        ? event.pageY
        : (bounds?.top || 0) + window.scrollY;
    tooltip
        .html(content)
        .classed("visible", true)
        .style("left", `${Math.min(pageX + 14, window.scrollX + window.innerWidth - 240)}px`)
        .style("top", `${pageY + 14}px`);
}

function hideTooltip() {
    tooltip.classed("visible", false);
}

function renderSentimentChart() {
    const container = d3.select("#sentiment-chart");
    container.selectAll("*").remove();
    const filtered = summaryData.filter(row => row.account_filter === selectedAccount);
    const totals = d3.rollup(filtered, values => d3.sum(values, row => row.count), row => row.engagement_tier);
    const chartRows = TIERS.map(tier => {
        const values = Object.fromEntries(
            SENTIMENTS.map(sentiment => {
                const match = filtered.find(row => row.engagement_tier === tier && row.sentiment === sentiment);
                return [sentiment, match ? match.share : 0];
            })
        );
        return { tier, ...values };
    });

    const width = 940;
    const height = 430;
    const margin = { top: 54, right: 45, bottom: 72, left: 120 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "img")
        .attr("aria-labelledby", "sentiment-chart-title sentiment-chart-description");

    svg.append("title").attr("id", "sentiment-chart-title")
        .text(`Sentiment distribution by engagement tier for ${selectedAccount.toLowerCase()}`);
    svg.append("desc").attr("id", "sentiment-chart-description")
        .text("Three horizontal one-hundred-percent stacked bars compare negative, neutral, and positive tweet shares.");

    const chart = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const x = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);
    const y = d3.scaleBand().domain(TIERS).range([0, innerHeight]).padding(0.32);

    chart.append("g")
        .attr("class", "grid-lines")
        .call(d3.axisBottom(x).ticks(5).tickSize(innerHeight).tickFormat(""));

    chart.append("g")
        .attr("class", "chart-axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".0%")));

    chart.append("g")
        .attr("class", "chart-axis engagement-axis")
        .call(d3.axisLeft(y).tickSize(0).tickPadding(18));

    const stack = d3.stack().keys(SENTIMENTS)(chartRows);
    const groups = chart.selectAll(".sentiment-layer")
        .data(stack)
        .join("g")
        .attr("class", "sentiment-layer")
        .attr("fill", layer => COLORS[layer.key]);

    groups.selectAll("rect")
        .data(layer => layer.map(segment => ({ ...segment, sentiment: layer.key })))
        .join("rect")
        .attr("x", segment => x(segment[0]))
        .attr("y", segment => y(segment.data.tier))
        .attr("width", segment => Math.max(0, x(segment[1]) - x(segment[0])))
        .attr("height", y.bandwidth())
        .attr("tabindex", 0)
        .attr("aria-label", segment => {
            const match = filtered.find(row => row.engagement_tier === segment.data.tier && row.sentiment === segment.sentiment);
            return `${segment.data.tier} engagement, ${segment.sentiment}: ${d3.format(".1%")((match || {}).share || 0)}, ${(match || {}).count || 0} tweets`;
        })
        .on("pointerenter focus", function (event, segment) {
            d3.select(this).classed("highlighted", true);
            const row = filtered.find(item => item.engagement_tier === segment.data.tier && item.sentiment === segment.sentiment);
            showTooltip(event, `
                <strong>${segment.data.tier} engagement · ${segment.sentiment}</strong>
                <span>${d3.format(",")(row.count)} of ${d3.format(",")(totals.get(segment.data.tier) || 0)} tweets</span>
                <span>${d3.format(".1%")(+row.share)} of this tier</span>
                <span>Mean model score: ${d3.format("+.2f")(+row.mean_sentiment_score)}</span>
                <span>Mean interactions: ${d3.format(".1f")(+row.mean_engagement)}</span>
            `);
        })
        .on("pointermove", event => showTooltip(event, tooltip.html()))
        .on("pointerleave blur", function () {
            d3.select(this).classed("highlighted", false);
            hideTooltip();
        });

    groups.selectAll("text")
        .data(layer => layer.map(segment => ({ ...segment, sentiment: layer.key })))
        .join("text")
        .attr("class", "segment-label")
        .attr("x", segment => x((segment[0] + segment[1]) / 2))
        .attr("y", segment => y(segment.data.tier) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("fill", segment => segment.sentiment === "Neutral" ? "#24384a" : "#ffffff")
        .text(segment => segment[1] - segment[0] >= 0.075 ? d3.format(".0%")(segment[1] - segment[0]) : "");

    svg.append("text")
        .attr("class", "axis-title")
        .attr("x", margin.left + innerWidth / 2)
        .attr("y", height - 18)
        .text("Share of tweets within engagement tier");

    const visibleTotal = d3.sum(filtered, row => row.count);
    status.textContent = `${visibleTotal.toLocaleString()} tweets · ${selectedAccount}`;
}

function renderTermsChart() {
    const container = d3.select("#terms-chart");
    container.selectAll("*").remove();
    const rows = termData
        .filter(row => row.sentiment === selectedSentiment)
        .sort((a, b) => d3.ascending(a.rank, b.rank))
        .slice(0, 8);
    const width = 940;
    const height = 450;
    const margin = { top: 34, right: 55, bottom: 60, left: 170 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "img")
        .attr("aria-label", `Top TF-IDF terms for ${selectedSentiment.toLowerCase()} tweets`);
    const chart = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const x = d3.scaleLinear()
        .domain([0, d3.max(rows, row => row.contrast_tfidf) * 1.08])
        .nice()
        .range([0, innerWidth]);
    const y = d3.scaleBand()
        .domain(rows.map(row => row.term))
        .range([0, innerHeight])
        .padding(0.24);

    chart.append("g")
        .attr("class", "grid-lines")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(5).tickSize(-innerHeight).tickFormat(""));
    chart.append("g")
        .attr("class", "chart-axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".3f")));
    chart.append("g")
        .attr("class", "chart-axis term-axis")
        .call(d3.axisLeft(y).tickSize(0).tickPadding(14));

    chart.selectAll(".term-bar")
        .data(rows)
        .join("rect")
        .attr("class", "term-bar")
        .attr("x", 0)
        .attr("y", row => y(row.term))
        .attr("width", row => x(row.contrast_tfidf))
        .attr("height", y.bandwidth())
        .attr("fill", COLORS[selectedSentiment]);

    chart.selectAll(".term-value")
        .data(rows)
        .join("text")
        .attr("class", "term-value")
        .attr("x", row => x(row.contrast_tfidf) + 9)
        .attr("y", row => y(row.term) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .text(row => d3.format(".3f")(row.contrast_tfidf));

    svg.append("text")
        .attr("class", "axis-title")
        .attr("x", margin.left + innerWidth / 2)
        .attr("y", height - 14)
        .text("TF-IDF lift versus the other sentiment classes");
}

Promise.all([
    d3.csv(SUMMARY_PATH, row => ({
        ...row,
        count: +row.count,
        share: +row.share,
        mean_engagement: +row.mean_engagement,
        mean_sentiment_score: +row.mean_sentiment_score
    })),
    d3.csv(TERMS_PATH, row => ({
        ...row,
        rank: +row.rank,
        mean_tfidf: +row.mean_tfidf,
        contrast_tfidf: +row.contrast_tfidf
    }))
])
    .then(([summary, terms]) => {
        summaryData = summary;
        termData = terms;
        const analyzed = d3.sum(
            summary.filter(row => row.account_filter === "All accounts"),
            row => row.count
        );
        document.querySelector("#analyzed-count").textContent = analyzed.toLocaleString();
        renderSentimentChart();
        renderTermsChart();
    })
    .catch(error => {
        status.textContent = "The Lab 4 data could not be loaded. Please use a web server.";
        status.classList.add("error-message");
        console.error("Unable to load Lab 4 data:", error);
    });

document.querySelectorAll("#account-filter button").forEach(button => {
    button.addEventListener("click", () => {
        selectedAccount = button.dataset.filter;
        document.querySelectorAll("#account-filter button").forEach(item => {
            item.classList.toggle("active", item === button);
        });
        renderSentimentChart();
    });
});

document.querySelectorAll("#term-filter button").forEach(button => {
    button.addEventListener("click", () => {
        selectedSentiment = button.dataset.sentiment;
        document.querySelectorAll("#term-filter button").forEach(item => {
            item.classList.toggle("active", item === button);
        });
        renderTermsChart();
    });
});
