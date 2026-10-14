"""Offline CPU comparison on an explicitly supplied local video; no network/upload.

Requires an existing Python environment with cv2, numpy and onnxruntime. Outputs
candidate coordinates, paired review sheets and timing, never accuracy without GT.
"""
import argparse
import hashlib
import json
import time
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort


def decode(output, family, width, height, threshold):
    points = []
    if family == "grid":
        pred = output.reshape(9, 4, 27, 48)
        for frame in pred:
            row, col = np.unravel_index(np.argmax(frame[0]), frame[0].shape)
            score = float(frame[0, row, col])
            x = (col + float(frame[1, row, col])) * width / 48
            y = (row + float(frame[2, row, col])) * height / 27
            points.append((score, (x, y) if score >= threshold else None))
    else:
        for heatmap in output[0, :9]:
            score = float(np.max(heatmap))
            binary = np.uint8(heatmap >= threshold) * 255
            contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            point = None
            if contours:
                moments = cv2.moments(max(contours, key=cv2.contourArea))
                if moments["m00"] > 0:
                    point = (moments["m10"] / moments["m00"] * width / 512,
                             moments["m01"] / moments["m00"] * height / 288)
            points.append((score, point))
    return points


def panel(frame, label, timestamp, prediction):
    width, height = frame.shape[1], frame.shape[0]
    image = cv2.resize(frame, (600, round(height * 600 / width)))
    score, point = prediction
    if point is not None:
        x, y = point
        cv2.circle(image, (round(x * 600 / width), round(y * 600 / width)), 9, (0, 255, 0), 2)
    image = cv2.copyMakeBorder(image, 27, 0, 0, 0, cv2.BORDER_CONSTANT, value=(18, 18, 18))
    text = f"{label} {timestamp:.3f}s  score {score:.3f}" + (" MISSING" if point is None else "")
    cv2.putText(image, text, (8, 19), cv2.FONT_HERSHEY_SIMPLEX, .5, (255, 255, 255), 1, cv2.LINE_AA)
    return image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", type=Path, required=True)
    parser.add_argument("--grid-model", type=Path, required=True)
    parser.add_argument("--heatmap-model", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--threads", type=int, default=2)
    parser.add_argument("--threshold", type=float, default=.5)
    args = parser.parse_args()
    for path in (args.video, args.grid_model, args.heatmap_model):
        if not path.is_file():
            parser.error(f"Missing explicit local file: {path}")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = args.threads
    opts.inter_op_num_threads = 1
    models = []
    for label, family, path, expected_in, expected_out in (
        ("GridV2b", "grid", args.grid_model, [1, 9, 432, 768], [1, 36, 27, 48]),
        ("V4c", "heatmap", args.heatmap_model, [1, 9, 288, 512], [1, 18, 288, 512]),
    ):
        loaded = time.perf_counter()
        session = ort.InferenceSession(str(path), sess_options=opts, providers=["CPUExecutionProvider"])
        load_ms = (time.perf_counter() - loaded) * 1000
        shape = session.get_inputs()[0].shape
        out_shape = session.get_outputs()[0].shape
        if isinstance(shape[0], str) or shape[0] is None:
            shape = [1, *shape[1:]]
        if isinstance(out_shape[0], str) or out_shape[0] is None:
            out_shape = [1, *out_shape[1:]]
        if shape != expected_in or out_shape != expected_out:
            parser.error(f"Unexpected {label} shapes: {shape} -> {out_shape}")
        session.run(None, {session.get_inputs()[0].name: np.zeros(shape, np.float32)})
        models.append(dict(label=label, family=family, path=path, session=session,
                           input_shape=shape, output_shape=out_shape, load_ms=load_ms,
                           sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                           model_bytes=path.stat().st_size))
    cap = cv2.VideoCapture(str(args.video))
    if not cap.isOpened():
        parser.error("Unable to open local video")
    fps = cap.get(cv2.CAP_PROP_FPS)
    reports = []
    for start, end in ((20, 26), (73, 77), (880, 885)):
        cap.set(cv2.CAP_PROP_POS_MSEC, start * 1000)
        frames = []
        for _ in range(round((end-start) * fps)):
            success, frame = cap.read()
            if not success:
                break
            frames.append(frame)
        if not frames:
            raise RuntimeError(f"No frames at {start}s")
        height, width = frames[0].shape[:2]
        predictions = {}
        timings = {}
        for model in models:
            all_predictions = []
            infer_ms, total_start = [], time.perf_counter()
            session = model["session"]
            in_height, in_width = model["input_shape"][2:]
            for offset in range(0, len(frames), 9):
                batch = frames[offset:offset+9]
                padded = batch + [batch[-1]] * (9-len(batch))
                tensor = np.stack([cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY),
                                             (in_width, in_height)).astype(np.float32) / 255
                                   for frame in padded])[None]
                inference_start = time.perf_counter()
                output = session.run(None, {session.get_inputs()[0].name: tensor})[0]
                infer_ms.append((time.perf_counter() - inference_start) * 1000)
                all_predictions.extend(decode(output, model["family"], width, height,
                                              args.threshold)[:len(batch)])
            elapsed = time.perf_counter() - total_start
            predictions[model["label"]] = all_predictions
            timings[model["label"]] = dict(
                frames=len(frames), detected=sum(p[1] is not None for p in all_predictions),
                pipeline_seconds=elapsed, pipeline_fps=len(frames)/elapsed,
                inference_median_ms=float(np.median(infer_ms)),
                inference_only_fps=9/(float(np.median(infer_ms))/1000),
            )
        samples = list(range(0, len(frames), max(1, round(fps / 2))))
        for page, first in enumerate(range(0, len(samples), 4), 1):
            rows = []
            for index in samples[first:first+4]:
                rows.append(np.concatenate([panel(frames[index], model["label"], start+index/fps,
                                                  predictions[model["label"]][index])
                                            for model in models], axis=1))
            cv2.imwrite(str(args.output_dir / f"paired-{start}-{page}.jpg"), np.concatenate(rows, axis=0))
        reports.append(dict(start=start, end=end, fps=fps, frames=len(frames), timing=timings))
        data = {model["label"]: [dict(time=start+i/fps, score=score, point=point)
                                 for i, (score, point) in enumerate(predictions[model["label"]])]
                for model in models}
        (args.output_dir / f"predictions-{start}.json").write_text(json.dumps(data), encoding="utf-8")
        print(json.dumps(reports[-1]), flush=True)
    cap.release()
    metadata = [{key: value for key, value in model.items() if key not in ("session", "path")}
                for model in models]
    result = dict(version=1, provider="CPUExecutionProvider", threads=args.threads,
                  runtime=ort.__version__, threshold=args.threshold, models=metadata, segments=reports,
                  note="Coverage and speed only. No accuracy, precision or recall without ground truth. "
                       "Pipeline includes preprocessing/inference/postprocessing, excludes video decode, "
                       "model load/warmup and review image writing. No interpolation.")
    (args.output_dir / "report.json").write_text(json.dumps(result, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
