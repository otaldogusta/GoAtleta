"""Compare three local ball detectors against independently reviewed video frames.

This is an offline benchmark, not an app importer. No network, downloads, uploads,
interpolation or changes to scouting drafts. The WASB adapter must have been audited
before being explicitly supplied. Dependencies are imported only by the CLI so the
reference/metric contract can be tested with the Python standard library.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import statistics
import time
from pathlib import Path


class BenchmarkError(ValueError):
    pass


def finite_number(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise BenchmarkError(f"{label} must be a finite number")
    return float(value)


def frame_index(seconds, fps):
    seconds = finite_number(seconds, "time")
    fps = finite_number(fps, "fps")
    if seconds < 0 or fps <= 0:
        raise BenchmarkError("Time must be nonnegative and fps positive")
    return round(seconds * fps)


def validate_reference(reference):
    if not isinstance(reference, dict):
        raise BenchmarkError("Reference must be an object")
    width = finite_number(reference.get("width"), "reference width")
    height = finite_number(reference.get("height"), "reference height")
    fps = finite_number(reference.get("fps"), "reference fps")
    start = finite_number(reference.get("start"), "reference start")
    end = finite_number(reference.get("end"), "reference end")
    if width <= 0 or height <= 0 or width != int(width) or height != int(height):
        raise BenchmarkError("Reference dimensions must be positive integers")
    if fps <= 0 or start < 0 or end <= start or end - start > 90:
        raise BenchmarkError("Reference must describe one positive segment up to 90 seconds")
    if reference.get("frameSelection") != "round(time * fps)":
        raise BenchmarkError("Reference frame selection must be round(time * fps)")
    samples = reference.get("samples")
    if not isinstance(samples, list) or not samples:
        raise BenchmarkError("Reference samples are required")
    seen = set()
    previous = -1
    for sample in samples:
        if not isinstance(sample, dict):
            raise BenchmarkError("Reference samples must be objects")
        sample_time = finite_number(sample.get("time"), "sample time")
        index = frame_index(sample_time, fps)
        if not start <= sample_time < end or index in seen or index <= previous:
            raise BenchmarkError("Samples must be ordered, unique frames within the segment")
        seen.add(index)
        previous = index
        if sample.get("status") == "observed" and sample.get("visible") is True:
            x = finite_number(sample.get("pixelX"), "reference pixelX")
            y = finite_number(sample.get("pixelY"), "reference pixelY")
            if not 0 <= x < width or not 0 <= y < height:
                raise BenchmarkError("Reference center is outside the source frame")
            nx = finite_number(sample.get("x"), "reference x")
            ny = finite_number(sample.get("y"), "reference y")
            if not 0 <= nx <= 1 or not 0 <= ny <= 1 or abs(nx * width - x) > 1 or abs(ny * height - y) > 1:
                raise BenchmarkError("Normalized and pixel reference coordinates disagree")
        elif sample.get("status") == "unknown" and sample.get("visible") is False:
            if any(sample.get(key) is not None for key in ("x", "y", "pixelX", "pixelY")):
                raise BenchmarkError("Unknown reference frames cannot contain asserted coordinates")
        else:
            raise BenchmarkError("Reference status must be observed or unknown, never inferred absence")
    return reference


def validate_prediction(prediction, width, height):
    if not isinstance(prediction, (tuple, list)) or len(prediction) != 2:
        raise BenchmarkError("Prediction must be (score, point-or-None)")
    score = finite_number(prediction[0], "prediction score")
    if not 0 <= score <= 1:
        raise BenchmarkError("Prediction score must be a heatmap peak in [0, 1], not component sum")
    point = prediction[1]
    if point is None:
        return score, None
    if not isinstance(point, (tuple, list)) or len(point) != 2:
        raise BenchmarkError("Prediction point must contain x and y")
    x = finite_number(point[0], "prediction x")
    y = finite_number(point[1], "prediction y")
    if not 0 <= x < width or not 0 <= y < height:
        raise BenchmarkError("Prediction center is outside the source frame")
    return score, (x, y)


def measure_predictions(reference, sample_predictions, tolerance_pixels=15):
    """Distances use native pixels. Unknown truth is unscored, never false positive."""
    validate_reference(reference)
    tolerance = finite_number(tolerance_pixels, "tolerance")
    if tolerance <= 0:
        raise BenchmarkError("Tolerance must be positive")
    if len(sample_predictions) != len(reference["samples"]):
        raise BenchmarkError("One prediction is required for every reference sample")
    rows, distances = [], []
    visible, unknown, missing, hits = 0, 0, 0, 0
    for sample, prediction in zip(reference["samples"], sample_predictions):
        score, point = validate_prediction(prediction, reference["width"], reference["height"])
        row = dict(time=sample["time"], frame=frame_index(sample["time"], reference["fps"]),
                   truth_status=sample["status"], score=score, point=point, distance_pixels=None,
                   within_tolerance=None)
        if sample["status"] == "unknown":
            unknown += 1
            row["outcome"] = "unscored_unknown"
        else:
            visible += 1
            if point is None:
                missing += 1
                row["outcome"] = "missing_on_observed"
                row["within_tolerance"] = False
            else:
                distance = math.hypot(point[0] - sample["pixelX"], point[1] - sample["pixelY"])
                distances.append(distance)
                matched = distance <= tolerance
                hits += int(matched)
                row.update(distance_pixels=distance, within_tolerance=matched,
                           outcome="hit" if matched else "localization_error")
        rows.append(row)
    return dict(samples=len(rows), observed=visible, unknown=unknown,
                tolerance_pixels=tolerance, hits_on_observed=hits,
                missing_on_observed=missing, localization_errors_on_observed=visible - missing - hits,
                hit_fraction_on_observed=hits / visible if visible else None,
                distance_median_pixels=statistics.median(distances) if distances else None,
                distance_max_pixels=max(distances) if distances else None,
                distance_denominator="detected observed samples only; missing predictions excluded",
                unknown_policy="unscored; unknown does not prove absence; no precision or false-positive claim",
                rows=rows)


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_onnx_models(args, np, ort):
    options = ort.SessionOptions()
    options.intra_op_num_threads = args.threads
    options.inter_op_num_threads = 1
    models = []
    for label, family, path, expected_input, expected_output in (
        ("GridV2b", "grid", args.grid_model, [1, 9, 432, 768], [1, 36, 27, 48]),
        ("V4c", "heatmap", args.heatmap_model, [1, 9, 288, 512], [1, 18, 288, 512]),
    ):
        started = time.perf_counter()
        session = ort.InferenceSession(str(path), sess_options=options, providers=["CPUExecutionProvider"])
        inputs, outputs = session.get_inputs()[0].shape, session.get_outputs()[0].shape
        inputs = [1, *inputs[1:]] if inputs[0] is None or isinstance(inputs[0], str) else inputs
        outputs = [1, *outputs[1:]] if outputs[0] is None or isinstance(outputs[0], str) else outputs
        if inputs != expected_input or outputs != expected_output:
            raise BenchmarkError(f"Unexpected {label} shapes: {inputs} -> {outputs}")
        load_seconds = time.perf_counter() - started
        warm_started = time.perf_counter()
        session.run(None, {session.get_inputs()[0].name: np.zeros(inputs, np.float32)})
        models.append(dict(label=label, family=family, sequence=9, session=session,
                           metadata=dict(label=label, input_shape=inputs, output_shape=outputs,
                                         sha256=sha256(path), bytes=path.stat().st_size,
                                         load_seconds=load_seconds,
                                         warmup_seconds=time.perf_counter() - warm_started,
                                         preprocess="9 grayscale frames resized, float32 / 255",
                                         threshold=.5, postprocess="existing offline CPU decoder from scouting-ball-model-benchmark.py",
                                         interpolation=False)))
    return models


def load_frames(args, reference, cv2):
    capture = cv2.VideoCapture(str(args.video))
    try:
        if not capture.isOpened():
            raise BenchmarkError("Unable to open explicit local video")
        fps = capture.get(cv2.CAP_PROP_FPS)
        if not math.isfinite(fps) or fps <= 0 or abs(fps - reference["fps"]) > .0001:
            raise BenchmarkError("Video fps differs from independently reviewed reference")
        first = frame_index(reference["start"], fps)
        stop = frame_index(reference["end"], fps)
        capture.set(cv2.CAP_PROP_POS_FRAMES, first)
        frames = []
        started = time.perf_counter()
        for _ in range(first, stop):
            success, frame = capture.read()
            if not success:
                raise BenchmarkError("Video ends before reference segment is complete")
            if frame.shape[1] != reference["width"] or frame.shape[0] != reference["height"]:
                raise BenchmarkError("Video dimensions differ from independently reviewed reference")
            frames.append(frame)
        return frames, first, time.perf_counter() - started
    finally:
        capture.release()


def run_model(model, frames, width, height, decoder, np, cv2):
    predictions, inference_ms = [], []
    model["diagnostics"] = []
    sequence = model["sequence"]
    if model["family"] == "wasb":
        model["adapter"].reset()
    started = time.perf_counter()
    for offset in range(0, len(frames), sequence):
        batch = frames[offset:offset + sequence]
        padded = batch + [batch[-1]] * (sequence - len(batch))
        if model["family"] == "wasb":
            raw_outputs = model["adapter"].predict(padded, width, height, threshold=.5)
            outputs = [(value["score"], value["xy"]) for value in raw_outputs]
            model["diagnostics"].extend({"component_weight": value["component_weight"],
                                         "candidates": value["candidates"]}
                                        for value in raw_outputs[:len(batch)])
        else:
            session = model["session"]
            in_height, in_width = model["metadata"]["input_shape"][2:]
            tensor = np.stack([cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY),
                                         (in_width, in_height)).astype(np.float32) / 255
                               for frame in padded])[None]
            inference_started = time.perf_counter()
            result = session.run(None, {session.get_inputs()[0].name: tensor})[0]
            inference_ms.append((time.perf_counter() - inference_started) * 1000)
            outputs = decoder.decode(result, model["family"], width, height, .5)
        if len(outputs) != sequence:
            raise BenchmarkError(f"{model['label']} returned a different sequence length")
        predictions.extend(validate_prediction(value, width, height) for value in outputs[:len(batch)])
        if (offset + sequence) % (sequence * 20) == 0:
            print(json.dumps(dict(progress=model["label"], frames=min(offset + sequence, len(frames)),
                                  total=len(frames))), flush=True)
    elapsed = time.perf_counter() - started
    timing = dict(frames=len(frames), detected=sum(point is not None for _, point in predictions),
                  pipeline_seconds=elapsed, pipeline_fps=len(frames) / elapsed,
                  sequence_length=sequence, final_padding_frames=(-len(frames)) % sequence,
                  pipeline_scope="preprocess + inference + postprocess; excludes decode/load/warmup/images")
    if inference_ms:
        timing.update(inference_median_ms=statistics.median(inference_ms),
                      inference_only_fps=sequence / (statistics.median(inference_ms) / 1000))
    return predictions, timing


def write_mosaics(output_dir, reference, frames, first_frame, models, predictions, np, cv2):
    colors = {"GridV2b": (0, 165, 255), "V4c": (255, 80, 210), "WASB": (255, 255, 0)}
    page_files = []
    for page, start in enumerate(range(0, len(reference["samples"]), 4), 1):
        rows = []
        for sample in reference["samples"][start:start + 4]:
            offset = frame_index(sample["time"], reference["fps"]) - first_frame
            panels = []
            for model in models:
                image = cv2.resize(frames[offset], (400, round(reference["height"] * 400 / reference["width"])))
                image = cv2.copyMakeBorder(image, 52, 0, 0, 0, cv2.BORDER_CONSTANT, value=(18, 18, 18))
                if sample["status"] == "observed":
                    ground_truth = (round(sample["pixelX"] * 400 / reference["width"]),
                                    52 + round(sample["pixelY"] * 400 / reference["width"]))
                    cv2.circle(image, ground_truth, 6, (0, 255, 0), 2)
                score, point = predictions[model["label"]][offset]
                if point is not None:
                    candidate = (round(point[0] * 400 / reference["width"]),
                                 52 + round(point[1] * 400 / reference["width"]))
                    cv2.circle(image, candidate, 9, colors[model["label"]], 2)
                text = f"{model['label']}  {sample['time']:.3f}s  peak {score:.3f}"
                if point is None:
                    text += " MISSING"
                cv2.putText(image, text, (7, 19), cv2.FONT_HERSHEY_SIMPLEX, .44, (255, 255, 255), 1, cv2.LINE_AA)
                truth_text = "Green = independent truth" if sample["status"] == "observed" else "Truth unknown: unscored"
                cv2.putText(image, truth_text, (7, 39), cv2.FONT_HERSHEY_SIMPLEX, .43, (0, 255, 0), 1, cv2.LINE_AA)
                panels.append(image)
            rows.append(np.concatenate(panels, axis=1))
        file = output_dir / f"comparison-{page:02d}.png"
        if not cv2.imwrite(str(file), np.concatenate(rows, axis=0)):
            raise BenchmarkError("Unable to write local review mosaic")
        page_files.append(file.name)
    return page_files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", type=Path, required=True)
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--grid-model", type=Path, required=True)
    parser.add_argument("--heatmap-model", type=Path, required=True)
    parser.add_argument("--wasb-adapter", type=Path, required=True, help="Explicit locally audited Python adapter")
    parser.add_argument("--wasb-checkpoint", type=Path, required=True)
    parser.add_argument("--wasb-config", type=Path, help="Optional audited full model config JSON; default is pinned official adapter config")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--threads", type=int, default=2)
    args = parser.parse_args()
    if args.threads < 1 or args.threads > 16:
        parser.error("threads must be in [1, 16]")
    for path in (args.video, args.reference, args.grid_model, args.heatmap_model,
                 args.wasb_adapter, args.wasb_checkpoint):
        if not path.is_file():
            parser.error(f"Missing explicit local file: {path}")
    if args.wasb_config is not None and not args.wasb_config.is_file():
        parser.error("Missing explicit local WASB config")
    if args.output_dir.exists() and any(args.output_dir.iterdir()):
        parser.error("Choose a new output directory; benchmark never overwrites prior evidence")
    reference = validate_reference(json.loads(args.reference.read_text(encoding="utf-8-sig")))
    import cv2
    import numpy as np
    import onnxruntime as ort
    cv2.setNumThreads(args.threads)
    decoder = load_module("existing_ball_decoder", Path(__file__).with_name("scouting-ball-model-benchmark.py"))
    models = load_onnx_models(args, np, ort)
    wasb_module = load_module("audited_wasb_adapter", args.wasb_adapter)
    started = time.perf_counter()
    wasb = wasb_module.load_model(args.wasb_checkpoint, args.wasb_config, args.threads)
    load_seconds = time.perf_counter() - started
    wasb_metadata = dict(wasb.metadata)
    wasb_metadata.update(label="WASB", threshold=.5, interpolation=False,
                         checkpoint_sha256=sha256(args.wasb_checkpoint),
                         adapter_sha256=sha256(args.wasb_adapter),
                         config_sha256=sha256(args.wasb_config) if args.wasb_config else None,
                         config_source="explicit local JSON" if args.wasb_config else "pinned official config embedded in audited adapter",
                         bytes=args.wasb_checkpoint.stat().st_size, load_seconds=load_seconds)
    warm_started = time.perf_counter()
    dummy_frame = np.zeros((reference["height"], reference["width"], 3), dtype=np.uint8)
    wasb.predict([dummy_frame] * 3, reference["width"], reference["height"], threshold=.5)
    wasb.reset()
    wasb_metadata["warmup_seconds"] = time.perf_counter() - warm_started
    models.append(dict(label="WASB", family="wasb", sequence=3, adapter=wasb, metadata=wasb_metadata))
    frames, first_frame, decode_seconds = load_frames(args, reference, cv2)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    predictions, reports = {}, []
    for model in models:
        all_predictions, timing = run_model(model, frames, reference["width"], reference["height"], decoder, np, cv2)
        sample_predictions = [all_predictions[frame_index(sample["time"], reference["fps"]) - first_frame]
                              for sample in reference["samples"]]
        metrics = measure_predictions(reference, sample_predictions)
        if model["family"] == "wasb":
            for row in metrics["rows"]:
                row.update(model["diagnostics"][row["frame"] - first_frame])
        predictions[model["label"]] = all_predictions
        reports.append(dict(**model["metadata"], timing=timing, metrics=metrics))
        print(json.dumps(dict(model=model["label"], timing=timing, metrics={k: v for k, v in metrics.items() if k != "rows"})), flush=True)
    mosaics = write_mosaics(args.output_dir, reference, frames, first_frame, models, predictions, np, cv2)
    full_predictions = {label: [dict(frame=first_frame + i, time=(first_frame + i) / reference["fps"], score=score, point=point)
                               for i, (score, point) in enumerate(values)] for label, values in predictions.items()}
    for model in models:
        if model["family"] == "wasb":
            for row, diagnostics in zip(full_predictions[model["label"]], model["diagnostics"]):
                row.update(diagnostics)
    (args.output_dir / "predictions.json").write_text(json.dumps(full_predictions, allow_nan=False), encoding="utf-8")
    result = dict(version=1, video_id=reference.get("videoId"), width=reference["width"], height=reference["height"],
                  fps=reference["fps"], start=reference["start"], end=reference["end"], frames=len(frames),
                  first_frame=first_frame, reference_sha256=sha256(args.reference),
                  ground_truth_method=reference.get("method"), threads=args.threads,
                  provider="CPU", onnxruntime_version=ort.__version__, decode_seconds=decode_seconds,
                  fixed_threshold=.5, no_reference_based_parameter_tuning=True, interpolation=False,
                  tolerance_native_pixels=15, models=reports, mosaics=mosaics,
                  limits="20 manually reviewed instants of one video, not a general accuracy benchmark. "
                         "Unknown truth is unscored. No precision/false-positive claims. Native source dimensions; "
                         "comparison does not grant access to YouTube frames. Model sequence lengths differ (9 vs 3). "
                         "V4c uses the existing offline OpenCV largest-contour/moments decoder; the browser uses "
                         "connected components with a minimum 4-pixel area, centroid and additional filtering. "
                         "This comparison does not establish browser accuracy or speed.")
    (args.output_dir / "report.json").write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")


if __name__ == "__main__":
    main()
