# Assignment requirements and evidence

The [Individual Project assignment](https://canvas.duke.edu/courses/87959/assignments/395542) was rechecked in the authenticated Canvas page on September 27, 2026. Its report requirement is **“500–800 word report.”** The checklist below maps the published project to those requirements; it does not claim an instructor evaluation. Canvas submission remains unperformed at the author’s request.

## Individual project

| Requirement | Evidence | Review status |
| --- | --- | --- |
| Critique a sufficiently complex existing visualization | Information Is Beautiful’s *World’s Biggest Data Breaches & Hacks*, with hundreds of events, magnitude encoding, chronology, categories, and event stories | Identified; original source linked in the report and figure caption |
| Explain data, intended audience, and tasks | Report: “Reading the original”; the public-overview purpose is explicitly labeled as an interpretation | Report checked |
| Identify at least two strengths | Report: chronology/magnitude overview; recognizable organizations linked to stories and sources | Two strengths checked |
| Identify at least three problems and their consequences | Report: visual competition; difficulty comparing area; dispersed cases requiring mental comparison | Three limitations checked |
| Build a D3.js redesign using an external CSV or JSON file | Bubble timeline loads `data/breaches.json`; browser totals match the frozen CSV and transformation audit | Final local runtime checked |
| Explain at least three design decisions | Report: proportional circles and packing; overview/focus; selective annotations with a named list and details; separate linear comparison | Four decisions checked |
| Compare original and redesign, including limitations | Report: “What improves, and what remains difficult”; Figure 1 is original and Figure 2 is the bubble timeline | Updated text and two figures checked locally |
| Include a 500–800-word report | `report.md` and matching `report.html`: **645 body words**, excluding headings | Word count checked |
| Include original image, redesigned visualization, screenshots, and sources | Figure 1: `assets/original-chart.png`; Figure 2: `assets/redesign-bubbles.png`, focused on 2022–2026 | Images, captions, inline source links, and asset paths checked locally |
| Add a “Visualization Critique and Redesign” section to the GitHub Pages course website | Course website: `https://xigua-liangdao.github.io/stats401-labs/`; project: `/individual-project/` | Course homepage navigation and project section link to the original/data, redesign, before/after figures, and report; repository README provides the same entry points. Live deployment is checked after publication. |
| Submit the project webpage URL to Canvas | The submission URL is the published project URL | **Not submitted, as requested** |

## One-minute presentation

The [presentation assignment](https://canvas.duke.edu/courses/87959/assignments/395556) was also rechecked on September 27, 2026: one page, one minute, PDF export, and `FirstName_LastName.pdf`. Both assignments display a September 27, 2026, 11:59 pm deadline.

| Requirement | Evidence | Review status |
| --- | --- | --- |
| Present the same individual project | Updated slide shows the original purpose, original excerpt, and final bubble timeline | Revised slide content and render checked |
| Exactly one slide | `assets/Teresa_Tu.pdf` matches `output/pdf/Teresa_Tu.pdf`; one 960 × 540 pt page (16:9) | Exactly one page; render checked |
| PDF format, named `FirstName_LastName.pdf` | Both final PDF copies are named **`Teresa_Tu.pdf`** | Format and filename checked |
| Fit a one-minute presentation | `presentation-notes.md`: 112-word script describing the final bubble timeline | Script checked; actual delivery speed requires rehearsal |
| Upload to Canvas | Presentation PDF is the upload artifact | **Not submitted, as requested** |

## Data and interpretation checks

- Frozen source snapshot: September 25, 2026; 539 retained events, reporting years 2004–2026.
- 499 events have a usable numeric count; 40 remain accessible without a proportional bubble: 11 explicitly unknown, 28 unresolved possible placeholders, and one incompatible unit.
- “Reporting year” and “records” are qualified. This is a curated collection, not a census of breaches or a count of unique people.
- The report does not claim new user-study results or universal superiority.
- The full sheet includes cases below the original graphic’s stated 30,000-record threshold; the report states this scope difference.

## Local browser verification

The final page and its retained controls were checked in the browser. The applicable earlier checks and final integration checks are recorded below:

- Full collection: 539 events, with 499 numeric circles. The 40 entries without usable counts remain in the named list and year overview.
- Brushing synchronizes the year controls. The 2022–2026 window contains 123 numeric and 6 nonnumeric events.
- The linear comparison displays three selected values, 2,700,000,000 / 560,000,000 / 1,000,000,000, with proportional widths from a common zero baseline.
- Searching Wendy’s returns zero numeric entries and one incompatible-unit entry; its comparison button is disabled. Industry Finance plus cause Hacked returns 28 numeric and 2 nonnumeric entries.
- Keyboard Enter selects SoundCloud from the event list.
- At a 390-pixel viewport, the page width remains 390 pixels. The chart alone deliberately scrolls horizontally at a readable 900-pixel minimum width.
- No browser console errors were observed. Repeated rendering retains exactly two axis labels; the reset control explicitly says “Reset filters.”

- The final page contains only the bubble timeline, with no view switch. Previously saved query links normalize to the canonical page.
- The original and redesign appear as exactly two before/after figures. The displayed report count is 645 words.
- Final checks confirmed 499 circles for the full collection, 123 numeric plus 6 nonnumeric events for 2022–2026, Wendy’s unavailable count and disabled comparison button, and reset followed by keyboard selection of SoundCloud and a three-event comparison.
- Asset paths are valid and document IDs are unique.

## Presentation export verification

- The deliverable and website copies of `Teresa_Tu.pdf` are identical.
- The final PDF contains exactly one 960 × 540 pt page (16:9); its render was inspected.
- The slide shows the original and the final bubble timeline, and the accompanying 112-word script describes that design.

Canvas intentionally unsubmitted. Live deployment verification is reported with delivery.
