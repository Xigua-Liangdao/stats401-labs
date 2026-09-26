# Data Breaches in Context

STATS 401 · Visualization Critique and Redesign · Teresa Tu

This project preserves the original visualization’s public overview of major reported breaches while improving focus, event identification, and comparison. The original purpose is a design interpretation, not an explicit statement by its author.

## Deliverables

- [Interactive project and 745-word report](https://xigua-liangdao.github.io/stats401-labs/individual-project/)
- [One-page presentation PDF](assets/Teresa_Tu.pdf)
- [One-minute speaking script](presentation-notes.md)
- [Assignment requirements and verification](requirement-checklist.md)
- [Source data and cleaning audit](data/README.md)

## Two alternatives, shared context

**A · Bubble timeline** places events at their reporting year and makes solid circle area proportional to reported count. Vertical packing separates circles; vertical position has no data meaning. Tiny circles have outlined visibility rings, whose size does not encode count. The area scale stays fixed across focused year windows.

**B · Time × size** uses reporting year horizontally and a logarithmic count axis vertically. Isolated events occupy exact source-value coordinates. Crowded same-year events form numbered badges: the number is the event count, and a vertical span shows the minimum and maximum reported quantities. A badge’s midpoint is not an individual event value. Clicking a badge opens its named members; a selected event receives a pin at its exact coordinate.

Both alternatives retain a full reporting-year overview. Brush the overview or use the keyboard-accessible year controls to focus, then refine with organization search, industry, or cause. The named list includes every matching event, with pagination and ordering controls. Event details retain the source story and available references. Switching alternatives preserves filters, the focused years, and selected events.

A secondary linear bar chart compares up to three chosen numeric events from a common zero baseline. The initial example contains National Public Data and Ticketmaster. Entries without usable counts remain in the year overview and named list; they receive no invented numeric position and cannot be added to the numeric comparison.

The page uses locally pinned D3.js v7.9.0 and loads `data/breaches.json` externally. Source CSV, audit, report, screenshots, scripts, and vendor library are included. The original image is a labeled excerpt; the two redesign screenshots use the same 2022–2026 focus window. Mobile layouts retain readable chart geometry through an intentional horizontal chart scroller.

## Run locally

From the course repository root:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/individual-project/`. A local server is required for the external JSON request; opening `index.html` as a file is insufficient. Add `?view=scatter` to open B directly or `?view=bubbles` for A.

## Reproduce data

```sh
python3 individual-project/scripts/prepare_data.py
python3 -m unittest discover -s individual-project/scripts -p 'test_*.py'
```

The frozen September 25, 2026 source snapshot contains 539 events, with reporting years 2004–2026. There are 499 usable numeric quantities and 40 entries with unknown, unresolved, or incompatible counts. The source contains mixed units and may contain overlapping reports. It is a curated collection, not a census of breaches, a measure of industry risk, or a count of unique people affected. The report explains scope differences from the original graphic.

## Submission

The individual-project submission is the project webpage URL above. The presentation upload is `Teresa_Tu.pdf`, exactly one page. Consult the requirement checklist for final verification status. Canvas submission remains unperformed at the author’s request.
