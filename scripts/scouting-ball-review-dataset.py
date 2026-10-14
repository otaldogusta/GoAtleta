#!/usr/bin/env python3
"""Prepare ball annotations for review; no video download or model training.

Example:
  python scripts/scouting-ball-review-dataset.py --analysis original.json \
      --output candidates.csv --game-group match-2026-10-10

The CSV uses zero-based original-video frames at 30 fps and normalized image x/y.
Automatic positions are ALWAYS candidates; manual corrections still need review.
Missing positions are unknown, never a claim that the ball is absent. The sidecar
manifest assigns the whole game to one partition (unassigned by default). Give all
edits, cameras and files from the same game the same --game-group, and keep that
group entirely in train, validation or test. Do not split individual frames.

--every samples the review rows, retaining every manual correction. The default
keeps contiguous frames so a later trainer can build nine-frame sequences. This
tool contains no trainer, image extractor, network client or executable checkpoint.
Both output files are created exclusively and existing files are never overwritten.
"""

import argparse
import csv
import json
import math
from pathlib import Path
import re
import sys


FPS = 30
MAX_FRAMES = 54000
MAX_INPUT_BYTES = 24 * 1024 * 1024
FIELDS = ("source_fingerprint", "frame", "time", "x", "y", "status")
MODELS = {"vballnet-v2b-browser-1", "vballnet-v2b-local", "vballnet-v4c-browser-1"}
SPLITS = ("unassigned", "train", "validation", "test")


class AnnotationError(ValueError):
    """An annotation cannot safely be mapped to original frames."""


def _finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _identity(value, label):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", value):
        raise AnnotationError(f"{label} must be a bounded local identifier, without paths or URLs.")
    return value


def _media(value, label):
    if not isinstance(value, dict):
        raise AnnotationError(f"Invalid {label} metadata.")
    duration, width, height = (value.get(key) for key in ("duration", "width", "height"))
    if not _finite(duration) or duration <= 0 or duration > 86400:
        raise AnnotationError(f"Invalid {label} duration.")
    if any(not isinstance(n, int) or isinstance(n, bool) or not 0 < n <= 16384 for n in (width, height)):
        raise AnnotationError(f"Invalid {label} image dimensions.")
    return duration, width, height


def _points(value, duration, *, ordered, limit, label):
    if not isinstance(value, list) or len(value) > limit:
        raise AnnotationError(f"Invalid or excessive {label} positions.")
    rows, previous = [], -1
    for point in value:
        if not isinstance(point, dict):
            raise AnnotationError(f"Invalid {label} position.")
        time, x, y = (point.get(key) for key in ("time", "x", "y"))
        if not all(_finite(n) for n in (time, x, y)) or not 0 <= time < duration or not 0 <= x <= 1 or not 0 <= y <= 1:
            raise AnnotationError(f"Invalid {label} time or normalized coordinates.")
        if ordered and time <= previous:
            raise AnnotationError(f"{label} positions must have increasing times.")
        previous = time
        rows.append((time, x, y))
    return rows


def build_review_rows(document, every=1, split="unassigned", game_group=None):
    """Return (CSV rows, sanitized manifest); never promote suggestions to truth."""
    if not isinstance(every, int) or isinstance(every, bool) or not 1 <= every <= FPS:
        raise AnnotationError("--every must be an integer from 1 to 30.")
    if split not in SPLITS:
        raise AnnotationError("Invalid dataset partition.")
    if not isinstance(document, dict) or document.get("version") != 1 or isinstance(document.get("version"), bool):
        raise AnnotationError("Expected an exported VideoDocument version 1.")
    media = document.get("media")
    media_duration, _, _ = _media(media, "video")
    for field, limit in (("rallies", 2000), ("contacts", 20000)):
        values = document.get(field)
        if not isinstance(values, list) or len(values) > limit or (field == "rallies" and not values):
            raise AnnotationError("Invalid VideoDocument annotation limits.")
    analysis = document.get("analysis")
    if not isinstance(analysis, dict) or not isinstance(analysis.get("model"), str) or analysis.get("model") not in MODELS or analysis.get("sampledFps") != FPS:
        raise AnnotationError("Expected supported original tracking at 30 fps.")
    positions = _points(analysis.get("positions"), media_duration, ordered=True, limit=MAX_FRAMES, label="automatic")
    corrections = _points(document.get("corrections"), media_duration, ordered=False, limit=20000, label="manual")
    cuts = analysis.get("cuts")
    if not isinstance(cuts, list) or len(cuts) > 2000 or any(not _finite(t) or not 0 < t < media_duration or (i and t <= cuts[i - 1]) for i, t in enumerate(cuts)):
        raise AnnotationError("Invalid automatic cut timestamps.")

    youtube_id = media.get("youtubeId")
    source = analysis.get("source")
    offset = 0
    if youtube_id is not None:
        if not isinstance(youtube_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{11}", youtube_id) or media.get("fingerprint") != f"youtube:{youtube_id}":
            raise AnnotationError("Invalid YouTube identity.")
        if not isinstance(source, dict):
            raise AnnotationError("YouTube tracking needs its explicit original source; timestamps cannot be guessed.")
        duration, width, height = _media(source, "original")
        offset = source.get("offsetSeconds")
        if not _finite(offset) or abs(offset) > 1800:
            raise AnnotationError("Invalid original-to-YouTube offset.")
        fingerprint = _identity(source.get("fingerprint"), "Original fingerprint")
    else:
        if "source" in analysis:
            raise AnnotationError("Original local tracking cannot already carry a YouTube source mapping.")
        duration, width, height = _media(media, "original")
        fingerprint = _identity(media.get("fingerprint"), "Original fingerprint")
    frame_count = math.ceil(duration * FPS)
    if frame_count > MAX_FRAMES:
        raise AnnotationError("Original video exceeds the 54,000-frame review limit (30 minutes at 30 fps).")
    group = _identity(game_group, "Game group") if game_group is not None else fingerprint
    if any(not 0 < cut - offset < duration for cut in cuts):
        raise AnnotationError("An automatic cut falls outside the declared original video.")

    def frame_rows(points, label):
        mapped = {}
        for time, x, y in points:
            original_time = time - offset
            if original_time < -1e-6 or original_time >= duration:
                raise AnnotationError("A tracking label falls outside the declared original video.")
            frame = math.floor(max(0, original_time) * FPS + .5)
            # A valid timestamp within the last half-frame maps to the last frame.
            frame = min(frame, frame_count - 1)
            if frame in mapped:
                raise AnnotationError(f"Several {label} positions map to one frame; review this ambiguity first.")
            mapped[frame] = (x, y)
        return mapped

    automatic_frames = frame_rows(positions, "automatic")
    manual_frames = frame_rows(corrections, "manual")
    selected = sorted(set(range(0, frame_count, every)) | set(manual_frames))
    rows, counts = [], {"candidate": 0, "manual_correction": 0, "unknown": 0}
    for frame in selected:
        status = "manual_correction" if frame in manual_frames else "candidate" if frame in automatic_frames else "unknown"
        point = manual_frames.get(frame, automatic_frames.get(frame))
        rows.append({"source_fingerprint": fingerprint, "frame": frame, "time": f"{frame / FPS:.6f}",
                     "x": "" if point is None else point[0], "y": "" if point is None else point[1], "status": status})
        counts[status] += 1
    manifest = {
        "version": 1, "purpose": "ball_position_review", "training_ready": False,
        "review_required": True, "automatic_labels_are_ground_truth": False,
        "unknown_means_ball_absent": False, "source_fingerprint": fingerprint,
        "candidate_model": analysis["model"],
        "game_group": group, "split": split, "split_unit": "whole_game",
        "same_game_other_files_require_same_group": True,
        "frame_rate": FPS, "frame_origin": 0, "original_frame_count": frame_count,
        "original_duration": duration, "original_width": width, "original_height": height,
        "offset_seconds_removed": offset, "coordinate_space": "normalized_original_image",
        "time_quantization": "nearest_30fps_frame", "review_stride": every,
        "sequence_context_frames": 9, "row_count": len(rows), "status_counts": counts,
    }
    return rows, manifest


def export_review_csv(document, output, every=1, split="unassigned", game_group=None):
    """Write CSV and its manifest with exclusive creation; return the manifest."""
    rows, manifest = build_review_rows(document, every, split, game_group)
    output = Path(output)
    manifest_path = output.with_suffix(output.suffix + ".manifest.json")
    created = []
    try:
        # Open both exclusively before writing either to avoid partial exports.
        with output.open("x", encoding="utf-8", newline="") as csv_file:
            created.append(output)
            with manifest_path.open("x", encoding="utf-8", newline="\n") as manifest_file:
                created.append(manifest_path)
                writer = csv.DictWriter(csv_file, fieldnames=FIELDS)
                writer.writeheader()
                writer.writerows(rows)
                json.dump(manifest, manifest_file, ensure_ascii=False, indent=2, allow_nan=False)
                manifest_file.write("\n")
    except Exception:
        for path in reversed(created):
            path.unlink(missing_ok=True)
        raise
    return manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--analysis", type=Path, required=True, help="Exported VideoDocument JSON, read locally only.")
    parser.add_argument("--output", type=Path, required=True, help="New CSV path; a new .csv.manifest.json is created alongside it.")
    parser.add_argument("--every", type=int, default=1, help="Review every Nth frame (1..30); all manual corrections remain included.")
    parser.add_argument("--split", choices=SPLITS, default="unassigned", help="Assign the whole game, never frames, to a dataset partition.")
    parser.add_argument("--game-group", help="Shared safe identifier for all videos/edits/cameras from this game.")
    args = parser.parse_args(argv)
    try:
        with args.analysis.open("rb") as source_file:
            raw = source_file.read(MAX_INPUT_BYTES + 1)
        if len(raw) > MAX_INPUT_BYTES:
            raise AnnotationError("Input JSON exceeds the 24 MiB limit.")
        document = json.loads(raw.decode("utf-8-sig"))
        manifest = export_review_csv(document, args.output, args.every, args.split, args.game_group)
    except (AnnotationError, OSError, UnicodeError, json.JSONDecodeError) as error:
        # Do not echo input contents, source names, local paths or credential fields.
        reason = str(error) if isinstance(error, AnnotationError) else type(error).__name__
        print(f"Review export failed: {reason}", file=sys.stderr)
        return 1
    print(f"Review package created: {manifest['row_count']} rows; partition={manifest['split']}; human review required.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
