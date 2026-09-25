"""Tests target missing-data semantics and source-row reconciliation."""

import unittest
from pathlib import Path

from prepare_data import build, narrative_corroborates, parse_count, prepare_count


class CountSemanticsTests(unittest.TestCase):
    def test_numeric_display_and_typo_parsing(self):
        self.assertEqual(parse_count("2.7bn"), 2_700_000_000)
        self.assertEqual(parse_count('"one billion"'), 1_000_000_000)
        self.assertEqual(parse_count("53;000"), 53_000)
        self.assertIsNone(parse_count("unknown"))
        with self.assertRaises(ValueError):
            parse_count("53;00")
        with self.assertRaises(ValueError):
            parse_count("2,400,00")

    def test_unknown_display_does_not_become_plotting_number(self):
        result = prepare_count({"records lost": "10,000,000", "displayed records": "unknown", "story": ""})
        self.assertIsNone(result["records"])
        self.assertEqual(result["sourceRecords"], 10_000_000)

    def test_placeholder_ambiguity_is_preserved_without_asserting_fact(self):
        result = prepare_count({"records lost": "3,000,000", "displayed records": "", "story": "Customer details exposed."})
        self.assertIsNone(result["records"])
        self.assertEqual(result["recordsBasis"], "unresolved placeholder ambiguity")
        self.assertEqual(result["recordsLabel"], "Unresolved count")
        self.assertTrue(narrative_corroborates(3_000_000, "Details of 3m customers exposed."))
        self.assertFalse(narrative_corroborates(3_000_000, "3 months later, customers were told."))

    def test_unknown_hackers_does_not_mean_unknown_quantity(self):
        result = prepare_count({"records lost": "1,270,000", "displayed records": "", "story": "Unknown hackers stole user IDs."})
        self.assertEqual(result["records"], 1_270_000)

    def test_source_display_overrides_layout_value(self):
        result = prepare_count({"records lost": "1,000,000,000", "displayed records": "2.7bn", "story": ""})
        self.assertEqual(result["records"], 2_700_000_000)
        self.assertEqual(result["recordsStatus"], "approximate")
        self.assertEqual(result["recordsRaw"], "1,000,000,000")


class FrozenSnapshotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data, cls.audit = build(Path(__file__).resolve().parents[1] / "data" / "breaches-source-2026-09-25.csv", "2026-09-25")

    def test_every_source_event_survives(self):
        events = self.data["events"]
        self.assertEqual(len(events), 539)
        self.assertEqual(len({e["id"] for e in events}), len(events))
        self.assertEqual(len(events) + 2, self.audit["totalCsvRowsIncludingHeader"])

    def test_missing_and_numeric_counts_reconcile(self):
        events = self.data["events"]
        stats = self.data["metadata"]["stats"]
        self.assertEqual(stats["numericCount"] + stats["unknownOrUnresolvedCount"], len(events))
        self.assertEqual(stats["explicitUnknownCount"] + stats["unresolvedPlaceholderCount"] + stats["incompatibleUnitCount"], stats["unknownOrUnresolvedCount"])
        for event in events:
            self.assertEqual(event["records"] is None, event["recordsStatus"] == "unknown")
            if event["records"] is not None:
                self.assertGreater(event["records"], 0)
            self.assertTrue(event["sectorComponents"])
            self.assertTrue(event["methodComponents"])

    def test_missing_link_is_not_fabricated(self):
        aimware = next(e for e in self.data["events"] if e["organization"] == "Aimware")
        self.assertEqual(aimware["sources"], [])

    def test_malformed_count_correction_is_documented(self):
        webtpa = next(e for e in self.data["events"] if e["sourceId"] == "480")
        self.assertEqual(webtpa["records"], 2_400_000)
        self.assertIsNone(webtpa["sourceRecords"])
        self.assertEqual(webtpa["recordsRaw"], "2,400,00")
        self.assertEqual(webtpa["recordsStatus"], "approximate")
        self.assertIn("linked-source correction", webtpa["recordsBasis"])

    def test_system_count_is_not_plotted_as_records(self):
        wendys = next(e for e in self.data["events"] if e["sourceId"] == "219")
        self.assertIsNone(wendys["records"])
        self.assertEqual(wendys["sourceRecords"], 1025)
        self.assertEqual(wendys["recordsBasis"], "source count describes systems, not records")


if __name__ == "__main__":
    unittest.main()
