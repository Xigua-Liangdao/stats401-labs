# Assignment requirements and evidence

This checklist follows the assignment requirements already provided in the conversation. The original Canvas pages were **not freshly rechecked**: the school login had expired, and the author asked to finish the work without submitting to Canvas. This file does not claim a Canvas submission or an instructor evaluation.

## Individual project

| Requirement | Evidence | Review status |
| --- | --- | --- |
| Critique a sufficiently complex existing visualization | Information Is Beautiful’s *World’s Biggest Data Breaches & Hacks*, with hundreds of events, magnitude encoding, chronology, categories, and event stories | Identified; source cited in the report |
| Explain data, intended audience, and tasks | Report: “Purpose, audience, and data”; the public-overview purpose is explicitly labeled as an interpretation | Report checked |
| Identify at least two strengths | Report: chronology/magnitude overview; recognizable organizations linked to stories and sources | Two strengths checked |
| Identify at least three problems and their consequences | Report: visual competition; difficulty comparing area; dispersed cases requiring mental comparison | Three limitations checked |
| Build a D3.js redesign using an external CSV or JSON file | Both D3 alternatives load `data/breaches.json`; browser totals match the frozen CSV and transformation audit | Local browser runtime checked |
| Explain at least three design decisions | Report: overview/focus; proportional circles; grouped log-coordinate alternative; names/details; separate linear comparison | Five decisions checked |
| Compare original and redesign, including limitations | Report: “Before, after, and limitations”; Figures 1, 2, and 3 compare original, Alternative A, and Alternative B | Text and all three linked figures checked locally |
| Include a 500–800-word report | `report.md` and matching `report.html`: **745 body words**, excluding headings and references | Word count checked |
| Include original image, redesigned visualization, screenshots, and sources | Figure 1: `assets/original-chart.png`; Figure 2: `assets/redesign-bubbles.png`; Figure 3: `assets/redesign-time-size.png`; both redesign screenshots use 2022–2026 | Images, captions, report, and source links checked locally |
| Add a “Visualization Critique and Redesign” section to the GitHub Pages course website | Course website: `https://xigua-liangdao.github.io/stats401-labs/`; project: `/individual-project/` | Local page complete; updated deployment check pending |
| Submit the project webpage URL to Canvas | The submission URL is the published project URL | **Not submitted, as requested** |

## One-minute presentation

| Requirement | Evidence | Review status |
| --- | --- | --- |
| Present the same individual project | Slide shows the original purpose, original excerpt, and actual A/B screenshots of the 2022–2026 window | Updated slide content and render checked |
| Exactly one slide | `assets/Teresa_Tu.pdf` matches `output/pdf/Teresa_Tu.pdf`; one 960 × 540 pt page (16:9) | Exactly one page; unclipped render checked |
| PDF format, named `FirstName_LastName.pdf` | Both final PDF copies are named **`Teresa_Tu.pdf`** | Format and filename checked |
| Fit a one-minute presentation | `presentation-notes.md`: 114-word script with suggested timing | Script checked; actual delivery speed requires rehearsal |
| Upload to Canvas | Presentation PDF is the upload artifact | **Not submitted, as requested** |

## Data and interpretation checks

- Frozen source snapshot: September 25, 2026; 539 retained events, reporting years 2004–2026.
- 499 events have a usable numeric count; 40 remain accessible without a numeric size position: 11 explicitly unknown, 28 unresolved possible placeholders, and one incompatible unit.
- “Reporting year” and “records” are qualified. This is a curated collection, not a census of breaches or a count of unique people.
- The report does not claim new user-study results or universal superiority of either alternative.
- The full sheet includes cases below the original graphic’s stated 30,000-record threshold; the report states this scope difference.

## Local browser verification

The following checks were completed on the implemented page before deployment:

- Full collection: 539 events; A contains 499 numeric circles; B singleton and group membership totals 499. The 40 entries without usable counts remain in the named list and year overview.
- Brushing synchronizes the year controls. The 2022–2026 window contains 123 numeric and 6 nonnumeric events.
- Opening a two-member B group reveals both names and values. Selecting a member places its pin at its exact year and numeric coordinate.
- The linear comparison displays three selected values, 2,700,000,000 / 560,000,000 / 1,000,000,000, with proportional widths from a common zero baseline.
- Switching A/B preserves the focused years, filters, selected event ID, and three comparison IDs.
- Searching Wendy’s returns zero numeric entries and one incompatible-unit entry; its comparison button is disabled. Industry Finance plus cause Hacked returns 28 numeric and 2 nonnumeric entries.
- Keyboard Enter selects SoundCloud from the event list.
- At a 390-pixel viewport, the page width remains 390 pixels. The chart alone deliberately scrolls horizontally at a readable 900-pixel minimum width.
- No browser console errors were observed in these checks. Repeated rendering no longer accumulates axis labels; the reset control explicitly says “Reset filters.”
- The 745-word report is injected into the page, and the original and two redesigned screenshot figures are linked and captioned.

## Presentation export verification

- The deliverable and website copies of `Teresa_Tu.pdf` are identical.
- The PDF contains exactly one 16:9 page, 960 × 540 points. Its rendered page was inspected and is not clipped.
- Original and actual A/B screenshots are present; both redesigns use the same 2022–2026 focus window.
- Two URI links point to the original source and the project page.
- The accompanying 114-word script has a one-minute timing guide; the author still needs to rehearse its delivery.

Updated deployment verification is the only remaining artifact check. Canvas submission remains intentionally unperformed.
