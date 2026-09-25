# Data Breaches, Reassembled

STATS 401 · Visualization Critique and Redesign · Teresa Tu

## Deliverables

- [Interactive project and 707-word report](https://xigua-liangdao.github.io/stats401-labs/individual-project/)
- [One-page presentation PDF](assets/Teresa_Tu.pdf)
- [One-minute speaking script](presentation-notes.md)
- [Source data and cleaning audit](data/README.md)

The static page uses locally pinned D3.js v7.9.0 and loads `data/breaches.json` externally. It offers industry, cause, and logarithmic-scale views, animated regrouping, search, reporting-year playback, and event details with original sources. Screenshots are labeled excerpts of the original visualization and implemented redesign.

## Run locally

From the course repository root:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/individual-project/`. A local server is required for the external JSON request; opening `index.html` as a file is insufficient.

## Reproduce data

```sh
python3 individual-project/scripts/prepare_data.py
python3 -m unittest discover -s individual-project/scripts -p 'test_*.py'
```

The frozen source CSV contains 539 events, dated September 25, 2026. There are 499 numeric quantities and 40 entries without a comparable numeric count. Unknown, ambiguous, and incompatible-unit records stay visible and searchable. The collection is curated, and reported records are not unique people.

## Submission

The individual-project submission is the published webpage URL above. The presentation upload is `Teresa_Tu.pdf`, exactly one page. Canvas submission is intentionally left to a later step at the author's request.
