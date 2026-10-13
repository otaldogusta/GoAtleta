"""Convert local frame-based processing output to a portable studio analysis.

Reads only explicit local paths; no network, media copy or official scouting writes.
The output belongs only to the sampled fingerprint of the supplied video.
"""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--video', type=Path, required=True)
parser.add_argument('--tracks', type=Path, required=True)
parser.add_argument('--rallies', type=Path, required=True)
parser.add_argument('--report', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)


def convert(args):
    report = json.loads(args.report.read_text(encoding='utf-8'))
    tracks = json.loads(args.tracks.read_text(encoding='utf-8'))
    rallies = json.loads(args.rallies.read_text(encoding='utf-8'))
    size = args.video.stat().st_size
    digest = hashlib.sha256(f'{size}:'.encode())
    with args.video.open('rb') as media:
        digest.update(media.read(1048576))
        media.seek(max(0, size - 1048576))
        digest.update(media.read(1048576))
    fps, width, height = report['fps'], report['width'], report['height']
    if abs(fps - 30) > .01:
        raise ValueError('This converter currently supports 30 fps processing only')
    duration = report['frames'] / fps
    rows = [dict(time=p['frame'] / fps, x=p['x'] / width, y=p['y'] / height)
            for p in tracks if p['detected'] and 0 <= p['x'] <= width and 0 <= p['y'] <= height]
    starts = [r['start'] / fps for r in rallies]
    if not starts or starts[0] != 0 or any(b <= a for a, b in zip(starts, starts[1:])):
        raise ValueError('Invalid rally boundaries')
    document = dict(version=1, media=dict(fingerprint=digest.hexdigest(), name=args.video.name,
                    duration=duration, width=width, height=height),
                    rallies=[dict(id=f'imported-rally-{i+1}', start=t, winner=None, reviewed=False) for i, t in enumerate(starts)],
                    contacts=[], corrections=[], analysis=dict(model='vballnet-v2b-local', sampledFps=30,
                    positions=rows, cuts=starts[1:]))
    # Exclusive creation prevents overwriting an existing analysis artifact.
    with args.output.open('x', encoding='utf-8') as output:
        json.dump(document, output, separators=(',', ':'))
    print(json.dumps(dict(rallies=len(starts), positions=len(rows), output=str(args.output))))


if __name__ == '__main__':
    convert(parser.parse_args())
