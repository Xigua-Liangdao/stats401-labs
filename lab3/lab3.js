const DATA_PATH = "../data/lab3_lpl_2025.csv";
const PAGE_SIZE = 50;
const NUMERIC_COLUMNS = new Set([
    "game_number",
    "kills",
    "deaths",
    "assists",
    "kda",
    "total_gold",
    "total_cs",
    "damage_to_champions",
    "game_minutes"
]);

const table = d3.select("#lpl-table");
const headerRow = table.select("thead tr");
const body = table.select("tbody");
const searchInput = document.querySelector("#table-search");
const outcomeFilter = document.querySelector("#outcome-filter");
const status = document.querySelector("#table-status");
const pageReadout = document.querySelector("#page-readout");
const previousButton = document.querySelector("#previous-page");
const nextButton = document.querySelector("#next-page");

let records = [];
let filteredRecords = [];
let columns = [];
let currentPage = 1;
let sortState = { column: "date", ascending: true };

function parseRecord(row) {
    const parsed = { ...row };
    NUMERIC_COLUMNS.forEach(column => {
        parsed[column] = Number(row[column]);
    });
    return parsed;
}

function columnLabel(column) {
    return column
        .replaceAll("_", " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatCell(value, column) {
    if (["total_gold", "total_cs", "damage_to_champions"].includes(column)) {
        return d3.format(",")(value);
    }
    if (column === "kda" || column === "game_minutes") {
        return d3.format(".1f")(value);
    }
    return value;
}

function compareRows(a, b) {
    const { column, ascending } = sortState;
    const comparison = NUMERIC_COLUMNS.has(column)
        ? d3.ascending(a[column], b[column])
        : d3.ascending(String(a[column]).toLowerCase(), String(b[column]).toLowerCase());
    return comparison * (ascending ? 1 : -1);
}

function updateHeaders() {
    headerRow
        .selectAll("th")
        .data(columns)
        .join("th")
        .attr("scope", "col")
        .attr("aria-sort", column => {
            if (column !== sortState.column) return "none";
            return sortState.ascending ? "ascending" : "descending";
        })
        .html(column => {
            const marker = column === sortState.column
                ? (sortState.ascending ? " ↑" : " ↓")
                : "";
            return `<button type="button">${columnLabel(column)}${marker}</button>`;
        })
        .select("button")
        .on("click", (_, column) => {
            sortState = {
                column,
                ascending: sortState.column === column ? !sortState.ascending : true
            };
            currentPage = 1;
            renderTable();
        });
}

function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    const outcome = outcomeFilter.value;

    filteredRecords = records.filter(record => {
        const matchesOutcome = outcome === "all" || record.outcome === outcome;
        const matchesQuery = !query || [
            record.team,
            record.player,
            record.champion,
            record.position
        ].some(value => String(value).toLowerCase().includes(query));
        return matchesOutcome && matchesQuery;
    });

    currentPage = 1;
    renderTable();
}

function renderTable() {
    filteredRecords.sort(compareRows);
    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRecords = filteredRecords.slice(start, start + PAGE_SIZE);

    updateHeaders();

    const rows = body
        .selectAll("tr")
        .data(pageRecords, row => row.record_id)
        .join("tr")
        .attr("class", row => row.outcome === "Win" ? "win-row" : "loss-row");

    rows
        .selectAll("td")
        .data(row => columns.map(column => ({ column, value: row[column] })))
        .join("td")
        .attr("class", cell => NUMERIC_COLUMNS.has(cell.column) ? "numeric-cell" : null)
        .text(cell => formatCell(cell.value, cell.column));

    const visibleStart = filteredRecords.length ? start + 1 : 0;
    const visibleEnd = Math.min(start + PAGE_SIZE, filteredRecords.length);
    status.textContent = `Showing ${visibleStart.toLocaleString()}–${visibleEnd.toLocaleString()} of ${filteredRecords.length.toLocaleString()} records`;
    pageReadout.textContent = `Page ${currentPage} of ${totalPages}`;
    previousButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages;
}

d3.csv(DATA_PATH, parseRecord)
    .then(data => {
        if (data.length < 1000) {
            throw new Error("The dataset contains fewer than 1,000 records.");
        }

        records = data;
        filteredRecords = [...data];
        columns = data.columns.filter(column => column !== "game_id");
        document.querySelector("#record-count").textContent = data.length.toLocaleString();
        document.querySelector("#game-count").textContent = new Set(data.map(row => row.game_id)).size;
        document.querySelector("#team-count").textContent = new Set(data.map(row => row.team)).size;
        renderTable();
    })
    .catch(error => {
        status.textContent = "The LPL data could not be loaded. Please view this page through a web server.";
        status.classList.add("error-message");
        console.error("Unable to load LPL data:", error);
    });

searchInput.addEventListener("input", applyFilters);
outcomeFilter.addEventListener("change", applyFilters);
previousButton.addEventListener("click", () => {
    currentPage -= 1;
    renderTable();
});
nextButton.addEventListener("click", () => {
    currentPage += 1;
    renderTable();
});
