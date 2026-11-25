"""Refine the captured spike's arm coordination in an editable Blender layer.

Open the source scene "Go Atleta - Cortada com pouso amortecido.blend" in
background mode with --disable-autoexec, run this script with -P and pass
the destination .blend after --. Export it with export-court-attack-clip.py.
"""

import hashlib
from math import radians
from pathlib import Path
import sys

import bpy


SOURCE_DIGEST = "155a732156cf4733f72a261ef9dd160bf497c550a21b3dc2096139b935ba5681"

# Additive IK control travel in centimetres: forward, anatomical left, up.
# Each arm keeps the capture's upper-arm, forearm and hand geometry. The
# wrist inherits the palm control, retaining the original contact-hand roll.
GUIDE_HAND = (
    (117, 0, 0, 0), (124, 2, 0, 5), (132, 0, 0, 0), (140, 0, 0, 0),
    (143, -11, -2, 6), (145, -24, -4, 13), (148, -23, -4, 12),
    (153, -14, -2, 8), (160, 0, 0, 0),
)
GUIDE_ELBOW = (
    (117, 0, 0, 0), (124, 1, 0, 2), (132, 0, 0, 0), (140, 0, 0, 0),
    (143, -9, 1, -4), (145, -21, 2, -9), (148, -20, 2, -9),
    (153, -9, 1, -4), (160, 0, 0, 0),
)
HITTING_HAND = (
    (117, 0, 0, 0), (124, -3, 0, -5), (132, 0, 0, 0), (136, -2, 0, 0),
    (140, -6, -2, -1), (143, -3, -1, 0), (145, 0, 0, 0),
    (147, 1, 5, 0), (150, 0, 13, 2), (154, 0, 8, 5), (162, 0, 0, 0),
)
HITTING_ELBOW = (
    (117, 0, 0, 0), (124, -1, 0, -2), (132, 0, 0, 0), (136, 0, -2, 2),
    (140, 0, -3, 4), (143, 3, 0, 2), (145, 0, 0, 0),
    (147, 1, 2, 0), (150, 0, 6, 2), (154, 0, 4, 2), (162, 0, 0, 0),
)


def add_control_offsets(collection, control_name, keys):
    offset = bpy.data.objects.new("Impulsão e cortada • " + control_name, None)
    collection.objects.link(offset)
    offset.empty_display_size = .035
    offset.hide_render = True
    for frame, forward, left, up in keys:
        offset.location = (forward / 100, left / 100, up / 100)
        offset.keyframe_insert(data_path="location", frame=frame)
    for curve in offset.animation_data.action.fcurves:
        for key in curve.keyframe_points:
            key.handle_left_type = key.handle_right_type = "AUTO_CLAMPED"
    # Apply after the original backswing control and before the native IK.
    constraint = bpy.data.objects[control_name].constraints.new("COPY_LOCATION")
    constraint.name = "Coordenação dos braços"
    constraint.target = offset
    constraint.use_offset = True


def refine(output):
    source = Path(bpy.data.filepath)
    if source.resolve() == output.resolve() or hashlib.sha256(source.read_bytes()).hexdigest() != SOURCE_DIGEST:
        raise ValueError("Use the original calibrated capture and a separate destination")
    collection = bpy.data.collections.new("Coordenação da cortada")
    bpy.context.scene.collection.children.link(collection)
    for name, keys in (("Mão esquerda", GUIDE_HAND), ("Cotovelo esquerdo", GUIDE_ELBOW),
                       ("Mão direita", HITTING_HAND), ("Cotovelo direito", HITTING_ELBOW)):
        add_control_offsets(collection, name, keys)
    # This control parents only the guide wrist. Rotate about the hand tip
    # as the elbow folds so the relaxed hand travels with the forearm.
    guide = bpy.data.objects["Mão esquerda"]
    for frame, pitch, yaw in ((140, 0, 0), (143, -36, -12), (145, -50, -18),
                              (148, -34, -18), (151, -27, -20), (155, -8, -7), (160, 0, 0)):
        guide.rotation_euler = (0, radians(pitch), radians(yaw))
        guide.keyframe_insert(data_path="rotation_euler", frame=frame, group="Recolhimento")
    bpy.context.scene.frame_set(145)
    bpy.ops.wm.save_as_mainfile(filepath=str(output.resolve()))


if __name__ == "__main__":
    destination, = sys.argv[sys.argv.index("--") + 1:]
    refine(Path(destination))
