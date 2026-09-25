# Data audit

Snapshot: **2026-09-25**. [Original visualization](https://informationisbeautiful.net/visualizations/worlds-biggest-data-breaches-hacks/) · [Official source sheet](https://docs.google.com/spreadsheets/d/1i0oIJJMRG-7t1GT-mr4smaTTU7988yXVz8nPlwaJ8Xk/edit#gid=2).

The raw CSV has 541 rows: one header, one instruction row, and **539 retained event rows**. All source event IDs are unique. No event row was dropped or deduplicated.

The source's story years span **2004–2026**. These are the sheet's 'year story broke' values, not independently reconciled event dates. This is a curated collection, so its time distribution does not estimate the worldwide incidence of breaches.

## Count handling

**499 rows have a usable numeric count. 40 rows remain in the explorer but are excluded from a numeric size axis:**

- 11 explicitly unknown or undisclosed counts: 6 in the displayed-records field and 5 in the source narrative.
- 28 unresolved values matching the source's 3m / 4m / 5m / 10m placeholder instructions, without a corroborating display label or matching quantity in the narrative. They may be real counts; the conservative treatment makes no claim that their true values are definitely unknown.

- 1 incompatible unit: Wendy's source count of 1,025 describes point-of-sale systems rather than stolen records. The row stays searchable with this explanation; it receives no numeric records-axis position.

When a displayed numeric label is present, it takes precedence over the numeric plotting field. **16 rows change numeric value** under this rule. These are labeled approximate/source-displayed. The raw value, display label, selected basis and a note remain in each JSON record. Nissan's `53;000` typo is parsed as 53,000; the supplied source link also names 'over-53-000-employees'. WebTPA's malformed `2,400,00` is corrected to the rounded 2.4 million in its [linked article headline](https://www.bleepingcomputer.com/news/security/webtpa-data-breach-impacts-24-million-insurance-policyholders/), checked on the snapshot date, and labeled approximate.

Examples: National Public Data is 2.7bn in the source display versus 1bn in its plotting field; Yahoo (2013) is 1bn versus 550m; Microsoft (2023) has a 10m plotting number but its display says unknown. Values are source-reported and have not been independently verified against every linked article.

Usable counts range from **30 to 2,700,000,000**. 'Records' can mean accounts, personal records, documents or images, depending on the source row. It is not a count of unique people. Related incidents/reports may overlap; no sum of records is presented as unique people.

## Categories and provenance

Category whitespace is trimmed, academic/academia are normalized to Education, and multi-category rows remain Multiple sectors / Multiple methods with all original components retained. No primary sector is invented for mixed records. The UI may group smaller sectors under Other if its legend explains the grouping.

6 rows have no story text and 1 row has no external source link (Aimware). No story or URL is fabricated. Original event and sheet-row IDs, alternative names, raw categories, raw count fields, dates, sensitivity and available source links are retained.

## Reproduce

Run `python3 individual-project/scripts/prepare_data.py` to rebuild from the frozen CSV, or `python3 individual-project/scripts/prepare_data.py --refresh --date YYYY-MM-DD` to download a new dated snapshot. Run `python3 -m unittest discover -s individual-project/scripts -p 'test_*.py'` for parsing, missing-data and source-reconciliation checks.

Raw CSV SHA-256: `67825937fe1df1dbf705c69fddd6628dc563858043191eeb8c891ab4511763a1`.

The full lists of numeric overrides, unresolved/unknown rows, and the typo correction are in `audit.json`. The JSON is deliberately loaded as an external data file by the D3 page.
