---
title: "Visualization Critique and Redesign: Data Breaches in Context"
word_count: 737
word_count_scope: "Body prose only; excludes section headings and references."
---

## Purpose, audience, and data

I interpret Information Is Beautiful’s [“World’s Biggest Data Breaches & Hacks”](https://informationisbeautiful.net/visualizations/worlds-biggest-data-breaches-hacks/) as a public overview of major reported breaches: readers notice their magnitude, locate familiar organizations, and investigate individual stories. This is an inference from its design, not an explicit author statement. My redesign preserves that overview while making dense periods and selected events easier to inspect and compare.

The D3 bubble timeline loads an external JSON file derived from the original’s [linked spreadsheet](https://docs.google.com/spreadsheets/d/1i0oIJJMRG-7t1GT-mr4smaTTU7988yXVz8nPlwaJ8Xk/edit). The September 25, 2026 snapshot retains 539 events across reporting years 2004–2026, including entries below the original graphic’s stated 30,000-record threshold. There are 499 usable numeric counts and 40 unknown, unresolved, or incompatible-unit entries. Year means when the story broke, not necessarily when the breach happened. Reported records are not unique people.

The excluded counts comprise 11 explicitly unknown values, 28 possible placeholders lacking corroboration, and one count of systems rather than records. Exclusion is conservative: an unresolved value is not proof that the real quantity is unknown.

## Two strengths worth preserving

First, the original’s chronology and contrasting bubble sizes give a striking impression of time and magnitude. Large events attract attention before readers study exact values. Second, recognizable organization names lead into stories and source links, connecting an abstract collection to specific incidents. These strengths support discovery as well as numerical reading. The original already has search and filters; adding them alone would not establish an improvement. Figure 1 is an excerpt of the original.

## Three limitations

First, large bubbles dominate space, making smaller marks and nearby labels compete for attention. A readable overview becomes harder to maintain in dense regions.

Second, circle areas lack a common baseline. Similar quantities are difficult to distinguish, while extreme values make smaller events visually inconspicuous. A dramatic impression of scale does not guarantee accurate comparison.

Third, events from an industry or cause are dispersed through the chronological display. Comparing selected cases requires finding their marks and retaining their values mentally. Filtering reduces the collection, but does not itself provide a common comparison baseline.

## Design decisions

First, the redesign retains circles with solid areas proportional to reported count and horizontal positions corresponding to reporting year. Vertical packing separates circles; vertical position has no data meaning. Outlined visibility rings make tiny events selectable without enlarging their encoded solid areas. A fixed area scale across focused periods preserves the meaning of size when the year window changes.

Second, a compact overview counts source events by reporting year. Brushing a period, or choosing its start and end years, focuses the main timeline while the full temporal context remains visible. Organization search and industry or cause filters refine that focus. This lets readers inspect dense periods while understanding where they fall within the collection.

Third, annotations identify major and selected events, with placement that avoids covering circle marks. Labeling selectively preserves room for the overview, while names and printed quantities in the result list provide a more systematic way to read individual cases. This is a deliberate division of work between visual discovery and explicit identification.

Fourth, selecting a named event opens its reported quantity, story, and available source links. Pagination makes every matching entry accessible without placing hundreds of labels on the chart. The 40 events without usable counts remain in the named list and year overview, but receive no invented proportional bubble. Their count explanations remain available in the details.

Fifth, readers can choose up to three numeric events for a secondary, zero-baseline linear bar comparison with printed values. This addresses the area-comparison problem while retaining the main timeline’s visual emphasis on magnitude. Brief transitions acknowledge changes in the display; understanding the result does not depend on autoplay or remembering an animation.

## Before, after, and limitations

Figure 2 preserves Figure 1’s chronology and scale emphasis, while separating circles and adding focused inspection with a persistent overview. The accompanying list and comparison bars make selected names and values explicit. These changes support the original discovery task rather than redefining the project as a ranking alone.

The tradeoffs remain. Packing can require more space, tiny-event rings add clutter, and small solid circles remain hard to see. Selective annotations leave some identification work to the list. Linear comparison bars can compress small quantities beside very large ones. Source quantities can describe accounts, documents, or images, so comparisons are imperfect. Values have not all been independently verified, and this curated collection cannot establish worldwide breach incidence or industry risk. No user study was conducted; the claimed benefits are design arguments, not measured performance improvements.

## References

1. Information Is Beautiful. [*World’s Biggest Data Breaches & Hacks*](https://informationisbeautiful.net/visualizations/worlds-biggest-data-breaches-hacks/). Design and concept: David McCandless; code: Tom Evans. Accessed September 25, 2026. Original visualization excerpt shown in Figure 1.
2. Information Is Beautiful. [*World’s Biggest Data Breaches* source spreadsheet](https://docs.google.com/spreadsheets/d/1i0oIJJMRG-7t1GT-mr4smaTTU7988yXVz8nPlwaJ8Xk/edit). Accessed September 25, 2026. Includes event descriptions and links to underlying reports.
3. [Archived source CSV](data/breaches-source-2026-09-25.csv), downloaded September 25, 2026. See the [data audit](data/README.md) for cleaning decisions and the [external JSON](data/breaches.json) loaded by the D3 timeline.
