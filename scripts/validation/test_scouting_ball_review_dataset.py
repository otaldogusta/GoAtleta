"""Small offline fixtures for candidate review export; no video/GPU/network."""
import copy
import csv
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout

SPEC = importlib.util.spec_from_file_location("ball_review_dataset", Path(__file__).resolve().parents[1] / "scouting-ball-review-dataset.py")
DATASET = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DATASET)


def local_document():
    return {"version": 1, "media": {"fingerprint": "original-a", "name": "private-match.mp4", "duration": .2, "width": 1202, "height": 676},
            "rallies": [{"id": "r1", "start": 0, "winner": None, "reviewed": False}], "contacts": [],
            "analysis": {"model": "vballnet-v2b-browser-1", "sampledFps": 30, "cuts": [],
                         "positions": [{"time": 0, "x": .2, "y": .3}, {"time": 2 / 30, "x": .4, "y": .5}]},
            "corrections": [{"time": 2 / 30, "x": .6, "y": .7}]}


def youtube_document():
    doc = local_document()
    original = copy.deepcopy(doc["media"])
    doc["media"] = {"youtubeId": "mdfgd1K3HTc", "fingerprint": "youtube:mdfgd1K3HTc", "name": "YouTube", "duration": 1, "width": 1280, "height": 720}
    doc["analysis"]["source"] = {**original, "offsetSeconds": .1}
    for point in doc["analysis"]["positions"] + doc["corrections"]:
        point["time"] += .1
    return doc


class BallReviewDatasetTests(unittest.TestCase):
    def test_supported_candidate_models_are_recorded_without_promoting_labels(self):
        for model in ("vballnet-v2b-browser-1", "vballnet-v2b-local", "vballnet-v4c-browser-1"):
            with self.subTest(model=model):
                doc = local_document()
                doc["analysis"]["model"] = model
                rows, manifest = DATASET.build_review_rows(doc)
                self.assertEqual(manifest["candidate_model"], model)
                self.assertEqual(rows[0]["status"], "candidate")
                self.assertFalse(manifest["automatic_labels_are_ground_truth"])

    def test_candidates_manual_and_unknown_remain_distinct(self):
        doc = local_document()
        snapshot = copy.deepcopy(doc)
        rows, manifest = DATASET.build_review_rows(doc)
        self.assertEqual(len(rows), 6)
        self.assertEqual(rows[0]["status"], "candidate")
        self.assertEqual(rows[1]["status"], "unknown")
        self.assertEqual((rows[1]["x"], rows[1]["y"]), ("", ""))
        self.assertEqual((rows[2]["status"], rows[2]["x"], rows[2]["y"]), ("manual_correction", .6, .7))
        self.assertEqual(rows[2]["time"], "0.066667")
        self.assertFalse(manifest["training_ready"])
        self.assertFalse(manifest["automatic_labels_are_ground_truth"])
        self.assertTrue(manifest["review_required"])
        self.assertEqual(doc, snapshot)

    def test_youtube_uses_original_times_and_dimensions(self):
        rows, manifest = DATASET.build_review_rows(youtube_document())
        original_rows, _ = DATASET.build_review_rows(local_document())
        self.assertEqual(rows, original_rows)
        self.assertEqual(manifest["offset_seconds_removed"], .1)
        self.assertEqual((manifest["original_width"], manifest["original_height"]), (1202, 676))

    def test_negative_youtube_offset_maps_back_to_original(self):
        doc = youtube_document()
        doc["analysis"]["source"]["offsetSeconds"] = -.1
        doc["analysis"]["positions"] = [{"time": .033333333333333326, "x": .2, "y": .3}]
        doc["corrections"] = []
        rows, _ = DATASET.build_review_rows(doc)
        self.assertEqual(rows[4]["status"], "candidate")

    def test_stride_keeps_manual_corrections_and_whole_game_partition(self):
        rows, manifest = DATASET.build_review_rows(local_document(), every=3, split="test", game_group="game-a")
        self.assertEqual([row["frame"] for row in rows], [0, 2, 3])
        self.assertEqual(manifest["game_group"], "game-a")
        self.assertEqual(manifest["split"], "test")
        self.assertEqual(manifest["split_unit"], "whole_game")
        self.assertTrue(manifest["same_game_other_files_require_same_group"])

    def test_untrusted_extra_fields_and_private_names_never_enter_outputs(self):
        doc = youtube_document()
        doc["media"]["url"] = "javascript:secret"
        doc["analysis"]["source"].update({"name": "private-name.mp4", "path": "C:/private/secret.mp4", "token": "secret-token", "url": "https://secret.example"})
        rows, manifest = DATASET.build_review_rows(doc)
        serialized = json.dumps([rows, manifest])
        for secret in ("private-name", "C:/private", "secret-token", "secret.example", "javascript"):
            self.assertNotIn(secret, serialized)

    def test_youtube_without_source_and_invalid_mapping_are_rejected(self):
        for offset in (None, float("nan"), 1801, .2):
            doc = youtube_document()
            doc["analysis"]["source"]["offsetSeconds"] = offset
            with self.assertRaises(DATASET.AnnotationError):
                DATASET.build_review_rows(doc)
        doc = youtube_document()
        del doc["analysis"]["source"]
        with self.assertRaisesRegex(DATASET.AnnotationError, "explicit original source"):
            DATASET.build_review_rows(doc)

    def test_bad_coordinates_duplicate_frames_order_and_limits_are_rejected(self):
        for point in ({"time": 0, "x": float("nan"), "y": .3}, {"time": 0, "x": 1.1, "y": .3}, {"time": .2, "x": .2, "y": .3}):
            doc = local_document()
            doc["analysis"]["positions"] = [point]
            with self.assertRaises(DATASET.AnnotationError):
                DATASET.build_review_rows(doc)
        doc = local_document()
        doc["analysis"]["positions"].append({"time": .067, "x": .4, "y": .5})
        with self.assertRaisesRegex(DATASET.AnnotationError, "one frame"):
            DATASET.build_review_rows(doc)
        doc = local_document()
        doc["analysis"]["positions"].reverse()
        with self.assertRaises(DATASET.AnnotationError):
            DATASET.build_review_rows(doc)
        doc = local_document()
        doc["media"]["duration"] = 1800.1
        with self.assertRaisesRegex(DATASET.AnnotationError, "54,000"):
            DATASET.build_review_rows(doc)
        for every in (0, 31, True, 1.5):
            with self.assertRaises(DATASET.AnnotationError):
                DATASET.build_review_rows(local_document(), every=every)
        doc = local_document()
        doc["analysis"]["model"] = []
        with self.assertRaises(DATASET.AnnotationError):
            DATASET.build_review_rows(doc)

    def test_identity_paths_and_urls_are_rejected(self):
        for fingerprint in ("https://secret.example", "C:\\private\\video.mp4", "a" * 129):
            doc = local_document()
            doc["media"]["fingerprint"] = fingerprint
            with self.assertRaises(DATASET.AnnotationError):
                DATASET.build_review_rows(doc)

    def test_invalid_original_cut_and_ambiguous_manual_frames_are_rejected(self):
        doc = youtube_document()
        doc["analysis"]["cuts"] = [.1]
        with self.assertRaisesRegex(DATASET.AnnotationError, "cut falls outside"):
            DATASET.build_review_rows(doc)
        doc = local_document()
        doc["corrections"].append({"time": .067, "x": .5, "y": .6})
        with self.assertRaisesRegex(DATASET.AnnotationError, "one frame"):
            DATASET.build_review_rows(doc)
        doc = local_document()
        doc["analysis"]["source"] = None
        with self.assertRaises(DATASET.AnnotationError):
            DATASET.build_review_rows(doc)

    def test_writes_csv_and_sanitized_manifest_exclusively(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "review.csv"
            manifest = DATASET.export_review_csv(local_document(), output)
            with output.open(encoding="utf-8", newline="") as file:
                rows = list(csv.DictReader(file))
            self.assertEqual(rows[0]["source_fingerprint"], "original-a")
            self.assertEqual(rows[1]["x"], "")
            self.assertEqual(json.loads(output.with_suffix(".csv.manifest.json").read_text(encoding="utf-8")), manifest)
            before = output.read_bytes()
            with self.assertRaises(FileExistsError):
                DATASET.export_review_csv(local_document(), output)
            self.assertEqual(output.read_bytes(), before)

    def test_existing_manifest_is_preserved_and_partial_csv_is_removed(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "review.csv"
            manifest = output.with_suffix(".csv.manifest.json")
            manifest.write_text("existing", encoding="utf-8")
            with self.assertRaises(FileExistsError):
                DATASET.export_review_csv(local_document(), output)
            self.assertFalse(output.exists())
            self.assertEqual(manifest.read_text(encoding="utf-8"), "existing")

    def test_cli_reports_counts_without_echoing_private_paths(self):
        with tempfile.TemporaryDirectory() as folder:
            analysis, output = Path(folder) / "input.json", Path(folder) / "review.csv"
            analysis.write_text(json.dumps(local_document()), encoding="utf-8")
            stdout, stderr = io.StringIO(), io.StringIO()
            with redirect_stdout(stdout), redirect_stderr(stderr):
                result = DATASET.main(["--analysis", str(analysis), "--output", str(output), "--split", "validation"])
            self.assertEqual(result, 0)
            self.assertIn("6 rows", stdout.getvalue())
            self.assertNotIn(folder, stdout.getvalue())
            with redirect_stdout(stdout), redirect_stderr(stderr):
                self.assertEqual(DATASET.main(["--analysis", str(analysis), "--output", str(output)]), 1)
            self.assertNotIn(folder, stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
