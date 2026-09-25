---
title: "Visualization Critique and Redesign: Data Breaches, Compared"
word_count: 692
word_count_scope: "Body prose only; excludes section headings and references."
---

## Purpose, audience, and data

Information Is Beautiful’s [“World’s Biggest Data Breaches & Hacks”](https://informationisbeautiful.net/visualizations/worlds-biggest-data-breaches-hacks/) introduces a public audience to the scale and variety of reported breaches. Readers may recognize an organization, investigate its story, or compare events across industries. This redesign prioritizes a specific task: identifying the largest reported events within a selection and comparing their stated quantities.

The D3 visualization loads an external JSON file derived from the original’s [linked spreadsheet](https://docs.google.com/spreadsheets/d/1i0oIJJMRG-7t1GT-mr4smaTTU7988yXVz8nPlwaJ8Xk/edit). The September 25, 2026 snapshot retains 539 events from reporting years 2004–2026, including entries below the original graphic’s stated 30,000-record threshold. Of these, 499 have usable numeric counts; 40 have unknown counts, unresolved possible placeholders, or incompatible units. The year indicates when the story broke, not necessarily when the breach occurred. “Records” do not necessarily represent unique people.

## Two strengths worth preserving

First, the original’s chronology and dramatically different bubble sizes give readers an immediate impression of scale. Exceptionally large events stand out without requiring detailed numerical reading. Second, recognizable organization names connect to explanatory stories and source links, allowing a reader to move from an overview into a concrete example. The redesign preserves those names, event descriptions, and citations. The original already offers search and filters, so their presence alone is not an improvement. Figure 1 shows an excerpt of the original.

## Three issues with comparison

The first issue is visual competition. Large bubbles command much of the space, while smaller marks and nearby labels compete for attention. Locating a particular smaller event and associating it with its value requires additional searching.

The second issue is quantitative comparison. Circle areas lack a shared baseline, so readers cannot easily distinguish similar values or judge ratios. Extreme differences in record counts also make smaller events visually inconspicuous.

The third issue is scattered category membership. The chronological arrangement helps readers browse through time, but events from one industry or cause appear across the display. Comparing a chosen subset requires collecting those marks mentally; simply filtering the original does not turn them into an ordered comparison.

## Redesign decisions

First, horizontal bars replace bubbles. Every bar begins at zero on a labeled linear axis, so length directly represents the reported count. Descending order answers “Which is largest?” immediately. This common baseline addresses the original’s difficult area comparisons. The scale stays fixed across pages of one selection, but adjusts when filters change; a visible note and updated axis make that adjustment explicit.

Second, every visible row includes an organization, reporting year, and printed value. Readers can identify and compare events without hovering over anonymous marks. Approximate values retain their status rather than suggesting that additional displayed digits establish certainty.

Third, the initial view contains ten ranked events. Pagination gives access to all matching numeric entries while keeping labels separated and readable. Search and industry or cause filters narrow that ranking. Compact category bars show event counts and also act as filters, making the selection mechanism visible. Those counts describe this collection, not the relative security of industries.

Fourth, selecting an event opens its description, count explanation, and source links. Context remains available without crowding the comparison. The 40 events excluded from numeric ranking appear in a separate expandable, labeled list: an unavailable or ambiguous count is not treated as zero. Raw source values and the reasons for exclusions remain documented.

Finally, short transitions acknowledge changes in the displayed ranking. The destination remains a labeled, readable chart; understanding it does not depend on following moving points or remembering a previous animation.

## Before, after, and limitations

Figure 2 makes names, order, and values directly readable for the displayed selection. Compared with Figure 1, it supports deliberate comparison rather than a panoramic impression of the collection. The original remains more expressive as a chronological overview.

The tradeoffs are real. Pagination hides most events at any moment, and a linear scale can make small values almost invisible beside very large ones; printed values remain essential. Ranking also deemphasizes time patterns. Source quantities include accounts, documents, images, and other units, so even numeric entries are not perfectly equivalent. Multiple categories are simplified, and reported values have not all been independently verified. This curated collection cannot establish worldwide breach incidence or industry risk. No user study was conducted: these improvements are design arguments for named tasks, not measured performance claims.

## References

1. Information Is Beautiful. [*World’s Biggest Data Breaches & Hacks*](https://informationisbeautiful.net/visualizations/worlds-biggest-data-breaches-hacks/). Design and concept: David McCandless; code: Tom Evans. Accessed September 25, 2026. Original visualization excerpt shown in Figure 1.
2. Information Is Beautiful. [*World’s Biggest Data Breaches* source spreadsheet](https://docs.google.com/spreadsheets/d/1i0oIJJMRG-7t1GT-mr4smaTTU7988yXVz8nPlwaJ8Xk/edit). Accessed September 25, 2026. Includes event descriptions and links to underlying reports.
3. [Archived source CSV](data/breaches-source-2026-09-25.csv), downloaded September 25, 2026. See the [data audit](data/README.md) for cleaning decisions and the [external JSON](data/breaches.json) loaded by the D3 visualization.
