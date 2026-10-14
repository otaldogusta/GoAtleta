"""Offline contract tests; no model/video/network dependency."""
import copy
import importlib.util
import math
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location("wasb_benchmark", Path(__file__).with_name("scouting-wasb-benchmark.py"))
BENCHMARK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BENCHMARK)


def reference():
    return dict(width=1202, height=676, fps=29.99999560777488, start=20, end=40,
                frameSelection="round(time * fps)", samples=[
                    dict(time=20, status="observed", visible=True, pixelX=724, pixelY=143,
                         x=724 / 1202, y=143 / 676),
                    dict(time=21, status="observed", visible=True, pixelX=699, pixelY=70,
                         x=699 / 1202, y=70 / 676),
                    dict(time=24, status="unknown", visible=False, pixelX=None, pixelY=None, x=None, y=None)])


class WasbBenchmarkTests(unittest.TestCase):
    def test_uses_exact_native_frame_rounding(self):
        self.assertEqual(BENCHMARK.frame_index(20, 29.99999560777488), 600)
        self.assertEqual(BENCHMARK.frame_index(39, 29.99999560777488), 1170)
        self.assertEqual(BENCHMARK.frame_index(0.051, 30), 2)

    def test_unknown_prediction_is_unscored_and_not_absence(self):
        report = BENCHMARK.measure_predictions(reference(), [(.9, (724, 143)), (.2, None), (.8, (1000, 500))])
        self.assertEqual((report["observed"], report["unknown"]), (2, 1))
        self.assertEqual(report["hits_on_observed"], 1)
        self.assertEqual(report["missing_on_observed"], 1)
        self.assertEqual(report["hit_fraction_on_observed"], .5)
        self.assertEqual(report["rows"][2]["outcome"], "unscored_unknown")
        self.assertIsNone(report["rows"][2]["distance_pixels"])
        self.assertIsNone(report["rows"][2]["within_tolerance"])
        self.assertNotIn("false_positives", report)
        self.assertNotIn("precision", report)

    def test_distances_and_tolerance_use_native_pixels_not_resized_canvas(self):
        report = BENCHMARK.measure_predictions(reference(), [(.8, (736, 152)), (.8, (715, 70)), (.2, None)])
        self.assertEqual(report["rows"][0]["distance_pixels"], 15)
        self.assertEqual(report["rows"][1]["distance_pixels"], 16)
        self.assertEqual(report["hits_on_observed"], 1)
        self.assertEqual(report["localization_errors_on_observed"], 1)
        self.assertEqual(report["distance_median_pixels"], 15.5)
        self.assertEqual(report["distance_max_pixels"], 16)

    def test_missing_predictions_do_not_fake_zero_distance(self):
        report = BENCHMARK.measure_predictions(reference(), [(.1, None), (.2, None), (.3, None)])
        self.assertEqual(report["missing_on_observed"], 2)
        self.assertIsNone(report["distance_median_pixels"])
        self.assertIsNone(report["distance_max_pixels"])
        self.assertEqual(report["hit_fraction_on_observed"], 0)

    def test_reference_is_unchanged(self):
        source = reference()
        before = copy.deepcopy(source)
        BENCHMARK.measure_predictions(source, [(.9, (724, 143)), (.1, None), (.4, None)])
        self.assertEqual(source, before)

    def test_sequence_padding_does_not_add_scored_frames_and_tracker_resets(self):
        class Adapter:
            resets = 0
            batches = []

            def reset(self):
                self.resets += 1

            def predict(self, frames, width, height, threshold):
                self.batches.append(list(frames))
                self.assertion = (width, height, threshold)
                return [dict(score=.8, xy=[frame + 10, 20], component_weight=2., candidates=1)
                        for frame in frames]

        adapter = Adapter()
        model = dict(label="WASB", family="wasb", sequence=3, adapter=adapter)
        predictions, timing = BENCHMARK.run_model(model, [0, 1, 2, 3], 1202, 676, None, None, None)
        self.assertEqual(adapter.resets, 1)
        self.assertEqual(adapter.batches, [[0, 1, 2], [3, 3, 3]])
        self.assertEqual(adapter.assertion, (1202, 676, .5))
        self.assertEqual([point for _, point in predictions], [(10, 20), (11, 20), (12, 20), (13, 20)])
        self.assertEqual((timing["frames"], timing["final_padding_frames"]), (4, 2))
        self.assertEqual(len(model["diagnostics"]), 4)

    def test_sequence_output_alignment_mismatch_is_rejected(self):
        class Adapter:
            def reset(self):
                pass

            def predict(self, frames, width, height, threshold):
                return [dict(score=.8, xy=[10, 20], component_weight=2., candidates=1)]

        model = dict(label="WASB", family="wasb", sequence=3, adapter=Adapter())
        with self.assertRaisesRegex(BENCHMARK.BenchmarkError, "sequence length"):
            BENCHMARK.run_model(model, [0, 1, 2], 1202, 676, None, None, None)

    def test_finite_scores_bounds_and_sums_are_validated(self):
        for prediction in ((float("nan"), None), (float("inf"), None), (True, None),
                           (1.1, None), (-.1, None), (.5, (1202, 50)), (.5, (50, 676)),
                           (.5, (-1, 10)), (.5, (math.nan, 10)), (.5, (True, 10)), (.5, [50])):
            with self.subTest(prediction=prediction), self.assertRaises(BENCHMARK.BenchmarkError):
                BENCHMARK.validate_prediction(prediction, 1202, 676)

    def test_unknown_truth_cannot_be_given_coordinates(self):
        source = reference()
        source["samples"][2]["pixelX"] = 0
        with self.assertRaisesRegex(BENCHMARK.BenchmarkError, "Unknown"):
            BENCHMARK.validate_reference(source)

    def test_duplicate_unordered_outside_and_mixed_status_samples_rejected(self):
        for mutate in (lambda doc: doc["samples"].append(copy.deepcopy(doc["samples"][0])),
                       lambda doc: doc["samples"].reverse(),
                       lambda doc: doc["samples"][0].update(time=19),
                       lambda doc: doc["samples"][0].update(time=40),
                       lambda doc: doc["samples"][0].update(status="unknown"),
                       lambda doc: doc["samples"][0].update(x=.9),
                       lambda doc: doc["samples"][0].update(pixelX=math.inf)):
            source = reference()
            mutate(source)
            with self.assertRaises(BENCHMARK.BenchmarkError):
                BENCHMARK.validate_reference(source)

    def test_invalid_time_fps_dimensions_and_count_rejected(self):
        for seconds, fps in ((-1, 30), (1, 0), (math.inf, 30), (1, True)):
            with self.assertRaises(BENCHMARK.BenchmarkError):
                BENCHMARK.frame_index(seconds, fps)
        for key, value in (("width", 0), ("height", 1.5), ("fps", -1), ("end", 120)):
            source = reference()
            source[key] = value
            with self.assertRaises(BENCHMARK.BenchmarkError):
                BENCHMARK.validate_reference(source)
        with self.assertRaisesRegex(BENCHMARK.BenchmarkError, "every reference"):
            BENCHMARK.measure_predictions(reference(), [])


if __name__ == "__main__":
    unittest.main()
