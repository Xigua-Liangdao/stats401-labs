# Lab 5 — Urban Transit Connections

This assignment uses the two unmodified, synthetic 50-station / 50-route CSVs
provided by [STATS 401 Lab 5](https://github.com/hiilab/stats-401/blob/main/Lab5.md).
Downloaded on 2026-09-12 from the course repository's `data/` directory.

- `index.html`: the two views, design descriptions, and all six findings.
- `lab5.js`: D3 data binding, force simulation, dragging, zoom, linked
  highlighting, tooltips, legends, station inspector, and matrix ordering.
- `network-data.js`: validation, undirected lookup, degree, components, and
  matrix preparation; simulation data are copied to preserve original endpoints.
- `lab5.css`: styles scoped to Lab 5; existing labs keep their styles.
- `vendor/`: D3 7.9.0 and its ISC license. The page needs no CDN at runtime.
- `network-data.test.cjs`: data integrity, matrix symmetry, mutation isolation,
  invalid input handling, and checks of the six reported findings.

The matrix has 2,500 cells; 100 filled cells represent 50 unique undirected
connections. All 50 stations are retained. Five stations (S42, S43, S46, S48,
S49) have degree zero. A labeled strip keeps them visible beside the simulated
45-station component. Layout coordinates do not encode geography or travel time.
The node-link view visually encodes all five required attributes. Its symbol
area, not radius, is proportional to daily passenger volume.

From the repository root, serve the existing static site:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/lab5/`. Double-clicking the HTML file is unsuitable
because the page loads the CSV files over HTTP.

Run the checks without installing packages:

```sh
node --test lab5/network-data.test.cjs
node --check lab5/lab5.js
```

The page follows the repository's existing GitHub Pages structure. After the
updated `main` branch is published, the direct assignment path is `/lab5/`.

Course-document note: Part A contains older variable names. This implementation
uses `district`, `daily_passengers`, `station_type`, `travel_time_min`, and
`route_type`, matching the supplied tables and final submission checklist.
