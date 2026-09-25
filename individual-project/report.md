---
title: "Visualization Critique and Redesign: Data Breaches, Reassembled"
word_count: 707
word_count_scope: "Body prose only; excludes section headings and references."
verification_status: "Source audit and interface implementation checked."
---

## Purpose, audience, and data

Information Is Beautiful’s [“World’s Biggest Data Breaches & Hacks”](https://informationisbeautiful.net/visualizations/worlds-biggest-data-breaches-hacks/) introduces a public audience to the scale and variety of reported data breaches. Its audience includes readers exploring familiar organizations, journalists seeking examples, and students comparing sectors or causes. Useful tasks include finding an event, comparing its reported size, and examining how events are distributed across categories.

This redesign uses an external JSON snapshot prepared from the visualization’s [linked data sheet](https://docs.google.com/spreadsheets/d/1i0oIJJMRG-7t1GT-mr4smaTTU7988yXVz8nPlwaJ8Xk/edit). Each dot represents one listed event, with organization, reporting year, sector, method, and reported record count. Records are not necessarily unique people, and the year denotes when the story broke, not necessarily when the breach occurred.

The downloaded snapshot is dated September 25, 2026 and contains 539 listed events with reporting years from 2004 through 2026. All source rows are retained, including entries below the original graphic’s stated 30,000-record threshold. Preserving that file and its source references makes the analysis reproducible even if the live editorial collection is later updated.

## Two strengths worth preserving

First, the original combines a chronological overview with conspicuous differences in bubble size. This makes unusually large events visually prominent and gives readers an immediate sense of the dataset’s scale. Second, the visualization connects recognizable organization names with explanatory event details and sources. Those entry points support exploratory reading: a familiar company can lead readers into an unfamiliar security story. The original also provides filters and search, so adding those controls alone would not constitute a redesign. Figure 1 shows the original presentation.

## Three issues with comparison

The first issue is visual competition. Large bubbles dominate the available space, while smaller marks and labels compete in dense regions. A reader looking for a modest-sized breach must work harder to locate it and connect it with its description.

The second issue is quantitative comparison. Circle area offers no shared baseline, making similarly sized events difficult to distinguish accurately. The range of record counts compounds this problem: preserving the largest bubbles makes small events visually inconspicuous.

The third issue concerns categorical comparison. A chronological arrangement supports browsing through time, but comparing events within an industry or across methods requires readers to gather scattered marks mentally. Filtering narrows the selection; it does not, by itself, provide an aligned view of the remaining distribution.

## Redesign decisions

The redesign first assigns every event the same dot size. This prevents record count from determining how much visual territory an event receives. Equal dots describe the collection of events; they do not imply that all breaches have equal consequences.

Second, sector and method views regroup those same dots into labeled clusters. Grouping makes category membership spatially explicit, reducing the need to search across a timeline. Continuous transitions preserve each event’s identity as the arrangement changes. The useful improvement comes from the destination layout; animation helps readers follow the change rather than solving clutter on its own.

Third, a scale view places dots along a labeled logarithmic axis and separates nearby marks with a beeswarm layout. Position supports more precise magnitude comparisons than circle area, while logarithmic spacing accommodates several orders of magnitude. Equal distances indicate equal ratios, not equal additions.

Finally, event details appear on selection instead of attaching every story to the main plot. This keeps the overview readable while retaining names, reported values, and source links. Entries with unknown counts, unresolved possible placeholders, or incompatible units remain in category views and a separate area beside the numeric axis. This avoids giving editorial stand-ins false quantitative precision.

## Before, after, and limitations

Compared with Figure 1, Figure 2 assigns small and large events equal-sized marks and supplies a common position scale for magnitude. The grouping views prioritize categorical exploration; the original remains stronger at conveying an immediate visual impression of enormous events. These are task-based tradeoffs, not evidence that one chart is universally better.

The redesign also has limits. Dense groups can still be difficult to inspect, logarithmic scales require explanation, and animated transitions can distract. Category labels simplify events that may cross industries or involve multiple causes. Source quantities also vary: accounts, documents, images, and other reported units are not directly equivalent. Most importantly, this is a curated collection, not a complete census: category counts and reporting-year patterns cannot establish underlying breach incidence or relative industry risk. No user study was conducted; the claimed improvements are design arguments tied to specific reading tasks.

## References

1. Information Is Beautiful. [*World’s Biggest Data Breaches & Hacks*](https://informationisbeautiful.net/visualizations/worlds-biggest-data-breaches-hacks/). Design and concept: David McCandless; code: Tom Evans. Accessed September 25, 2026. Original visualization shown in Figure 1.
2. Information Is Beautiful. [*World’s Biggest Data Breaches* source spreadsheet](https://docs.google.com/spreadsheets/d/1i0oIJJMRG-7t1GT-mr4smaTTU7988yXVz8nPlwaJ8Xk/edit). Accessed September 25, 2026. Includes event descriptions and links to underlying news reports.
3. [Archived source CSV](data/breaches-source-2026-09-25.csv), downloaded September 25, 2026. The live visualization loads a cleaned external JSON derived from this snapshot.
