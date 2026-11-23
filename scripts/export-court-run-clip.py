"""Export a complete CMU 16_35 run cycle from the open Blender scene."""

import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


scene = bpy.context.scene
rig = next(obj for obj in scene.objects if obj.type == "ARMATURE")
bones = rig.pose.bones
poses = []
for frame in range(48, 151, 2):
    scene.frame_set(frame)
    hips = (bones["LeftUpLeg"].head + bones["RightUpLeg"].head) / 2
    chest = (bones["LeftArm"].head + bones["RightArm"].head) / 2
    head = bones["Head"].head + Vector((0, 0, .12))
    origin = Vector((hips.x, hips.y, 0))
    landmarks = [hips, chest, head]
    for side in ("Left", "Right"):
        landmarks.extend(bones[side + name].head for name in (
            "Arm", "ForeArm", "Hand", "UpLeg", "Leg", "Foot", "ToeBase",
        ))
    poses.append([round(metres * 1000) for point in landmarks
                  for x, y, z in [point - origin] for metres in (-x, z, -y)])

# Blend the seam into the equivalent right-foot contact during the last 12 frames.
seam = [start - end for start, end in zip(poses[0], poses[-1])]
for index in range(1, 7):
    weight = (index / 6) ** 2
    poses[index - 7] = [round(value + correction * weight)
                        for value, correction in zip(poses[index - 7], seam)]
output = Path(sys.argv[sys.argv.index("--") + 1])
output.write_text(
    "// CMU 16_35, frames 48–150. Local XYZ in millimetres.\n"
    "export const runPoses = [\n"
    + "".join(f"  {json.dumps(pose, separators=(',', ':'))},\n" for pose in poses)
    + "];\n",
    encoding="utf-8",
)
