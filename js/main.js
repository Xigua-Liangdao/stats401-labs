async function drawStudentScoreChart() {
    const chart = d3.select("#chart");

    try {
        const data = await d3.csv("../data/students.csv", d => ({
            name: d.name,
            score: +d.score
        }));

        const width = 800;
        const height = 430;
        const margin = { top: 36, right: 24, bottom: 86, left: 24 };

        const x = d3.scaleBand()
            .domain(data.map(d => d.name))
            .range([margin.left, width - margin.right])
            .padding(0.24);

        const y = d3.scaleLinear()
            .domain([0, 100])
            .range([height - margin.bottom, margin.top]);

        const svg = chart
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("role", "img")
            .attr("aria-labelledby", "chart-title chart-description");

        svg.append("title")
            .attr("id", "chart-title")
            .text("Student Scores");

        svg.append("desc")
            .attr("id", "chart-description")
            .text("A bar chart showing the scores of eight students. Higher scores have taller bars.");

        svg.append("line")
            .attr("class", "chart-baseline")
            .attr("x1", margin.left)
            .attr("x2", width - margin.right)
            .attr("y1", y(0))
            .attr("y2", y(0));

        svg.selectAll("rect")
            .data(data)
            .join("rect")
            .attr("class", "bar")
            .attr("x", d => x(d.name))
            .attr("y", d => y(d.score))
            .attr("width", x.bandwidth())
            .attr("height", d => y(0) - y(d.score))
            .attr("rx", 4);

        svg.selectAll("text.score-label")
            .data(data)
            .join("text")
            .attr("class", "score-label")
            .attr("x", d => x(d.name) + x.bandwidth() / 2)
            .attr("y", y(0) + 26)
            .text(d => d.score);

        svg.selectAll("text.name-label")
            .data(data)
            .join("text")
            .attr("class", "name-label")
            .attr("x", d => x(d.name) + x.bandwidth() / 2)
            .attr("y", y(0) + 50)
            .text(d => d.name);
    } catch (error) {
        chart
            .append("p")
            .attr("class", "error-message")
            .text("The student data could not be loaded. Please view this page through a web server.");
        console.error("Unable to load student data:", error);
    }
}

drawStudentScoreChart();
