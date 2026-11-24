"""Add walking and lateral footwork to a COPY of the Blender contact rig.

First build the editable contact rig with author-court-skill-clips.py. Then run
blender -b -P scripts/author-court-travel-clips.py. Both actions use the same
native IK and controls as the contact actions. The export removes only the
travel in world space; the simulation owns the court path and planted shoes.
"""
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".tmp" / "volleyball-v2"
SOURCE = OUT / "Go Atleta - Gestos com bola.blend"
DEST = OUT / "Go Atleta - Fundamentos e deslocamentos.blend"
MODULE = ROOT / "public" / "visual-court-3d" / "travel-motion-data.mjs"


def xyz(x, y, z):
    return Vector((x, y, z))


def blender(v):
    return xyz(v.x, -v.z, v.y)


def court(v):
    return xyz(v.x, v.z, -v.y)


def rotation(degrees, axis):
    return Matrix.Rotation(math.radians(degrees), 3, axis)


def smooth(u):
    u = min(1, max(0, u))
    return u*u*(3-2*u)


def pose(phase, shuffle):
    """0–1 left swings, 1–2 right swings. Left is -X, forward is +Z."""
    step = .34 if shuffle else .36
    progress = xyz(-phase*step/2, 0, 0) if shuffle else xyz(0, 0, phase*step)
    half_wave = math.sin(math.pi*phase)
    counter = math.cos(math.pi*phase)
    g = {}
    for edge, (suffix, sign) in enumerate((("L",-1),("R",1))):
        # The center of the rooted portion of the sole stays fixed. A small
        # double-support interval precedes and follows every swing.
        u = min(1, max(0, phase-edge))
        transit = smooth((u-.045)/.91)
        lift = math.sin(math.pi*u)**2
        if shuffle:
            toe = xyz(sign*.193-step*transit, .038+.083*lift, -.029*sign+.16)
            tilt = 5*math.sin(2*math.pi*u)*lift
            heading = sign*8
        else:
            start = sign*step*.50
            toe = xyz(sign*.122, .038+.122*lift, start+2*step*transit+.16)
            # Toe off the floor at first heel contact, heel up before toe-off.
            # In stance the heel rolls over the pinned forefoot late in the step.
            swing = (edge==0 and phase<=1) or (edge==1 and phase>=1)
            if swing:
                tilt = 18*(1-smooth(u/.48)) - 7*smooth((u-.65)/.35)
                toe.y += .021*smooth((u-.65)/.35)
            else:
                settle = phase-1 if edge==0 else phase
                tilt = -7*(1-smooth(settle/.23)) + 18*smooth((settle-.60)/.40)
                toe.y += .021*(1-smooth(settle/.23))
            heading = sign*5
        heading_matrix = rotation(heading, "Y")
        # This is the Blender ankle-to-toe bone length in the contact rig.
        ankle_to_toe = heading_matrix @ rotation(tilt, "X") @ xyz(0,-.057,.182)
        g["toe"+suffix] = toe-progress
        g["ankle"+suffix] = g["toe"+suffix]-ankle_to_toe

    if shuffle:
        # The outside foot pushes. Weight arrives over the opening foot before
        # the trailing foot gathers; the receiver keeps watching the server.
        transfer = math.sin(math.pi*(phase+.15))
        hip = xyz(.056*transfer, .858+.025*half_wave**2+.009*counter, -.111)
        lean, chest_yaw = 25-3*counter, 2.5*counter
        hip_yaw, tilt, pelvic_tilt = -2.2*counter, 3.1*transfer, 2.2*transfer
    else:
        hip = xyz(.026*half_wave, .956+.024*half_wave**2, -.012)
        lean, chest_yaw = 5.2+.9*half_wave**2, 6.5*counter
        hip_yaw, tilt, pelvic_tilt = -5.2*counter, -1.4*half_wave, 3.0*half_wave
    hip_axes = rotation(hip_yaw, "Y") @ rotation(pelvic_tilt, "Z")
    trunk = rotation(chest_yaw, "Y") @ rotation(tilt, "Z") @ rotation(lean, "X")

    # Guard reach in the widest part of the sideways stride. Avoid forcing the
    # solver to stretch the leg or silently move a foot off its footprint.
    for suffix, sign in (("L",-1),("R",1)):
        offset = hip_axes @ xyz(.101*sign, 0, 0)
        ankle = g["ankle"+suffix]
        span = math.hypot(hip.x+offset.x-ankle.x,hip.z+offset.z-ankle.z)
        hip.y = min(hip.y, ankle.y-offset.y+math.sqrt(.902**2-span**2))
    g["hips"] = hip
    g["chest"] = hip + trunk @ xyz(0,.515,.015)
    g["skull"] = g["chest"] + rotation(lean*.33,"X") @ xyz(0,.224,.018)
    for suffix, sign in (("L",-1),("R",1)):
        thigh = g["hip"+suffix] = hip + hip_axes @ xyz(sign*.101,0,0)
        g["kneePole"+suffix] = thigh+xyz(sign*(.26 if shuffle else .065),-.32,.83)
        shoulder = g["shoulder"+suffix] = g["chest"] + trunk @ xyz(sign*.187,0,0)
        if shuffle:
            # Sikana, “Recepção”, 1:03–1:06: hands travel low beside the hips.
            # The separate pass action brings them together when reading the ball.
            hand = shoulder + xyz(sign*.043-.032*transfer,
                                  -.495+.022*sign*half_wave, .147-.028*sign*counter)
            pole = xyz(sign*.20,-.45,-.65)
            fingers = xyz(-sign*.20,-.74,.60)
        else:
            arm_swing = -.235*sign*counter
            hand = shoulder+xyz(sign*(.035+.013*half_wave**2),
                                -.683+.028*counter**2, .038+arm_swing)
            pole = xyz(sign*.19,-.28,-.93)
            fingers = xyz(-sign*.08,-.97,.19+.35*arm_swing)
        g["palm"+suffix] = hand
        g["elbowPole"+suffix] = shoulder+pole
        g["fingerGoal"+suffix] = hand+fingers.normalized()*.092
    return progress,g


def sample(scene, rig, frame):
    whole = math.floor(frame)
    scene.frame_set(whole, subframe=frame-whole)
    bones = rig.evaluated_get(bpy.context.evaluated_depsgraph_get()).pose.bones
    result = [bones["ctl."+name].head for name in ("hips","chest","skull")]
    for side in "LR":
        for name, end in (("arm","head"),("forearm","head"),("hand","head"),
                          ("thigh","head"),("shin","head"),("foot","head"),("foot","tail")):
            result.append(getattr(bones[name+side],end))
    return [round(m*1000) for b in result for m in court(b)]


bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
scene = bpy.context.scene
lines = ["// Generated from the evaluated Blender IK in scripts/author-court-travel-clips.py.",
         "// Local millimetres, +Z forward; 0..16 left swings, 16..32 right swings.",
         "// shufflePoses opens to -X; reflect X and exchange sides to open to +X."]
rest = {b.name[4:]: b.head_local.copy() for b in rig.data.bones if b.name.startswith("ctl.")}
for action in bpy.data.actions:
    # In the combined file changing back to a stationary clip also restores
    # the object's base position if a travelling action was previously active.
    rig.animation_data.action = action
    for index in (0,1):
        rig.location[index] = 0
        rig.keyframe_insert("location", index=index, frame=1, group="Origem da jogada")
for name, shuffle, length in (("Caminhada",False,32),("Deslocamento lateral",True,24)):
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    for index in range(33):
        phase = index/16
        progress, goals = pose(phase,shuffle)
        frame = 1 + length*phase/2
        rig.location = blender(progress)
        rig.keyframe_insert("location",frame=frame,group="Trajeto no piso")
        for joint, position in goals.items():
            bone = rig.pose.bones["ctl."+joint]
            bone.location = blender(position)-rest[joint]
            bone.keyframe_insert("location",frame=frame,group=joint)
        ball = rig.pose.bones["bola"]
        ball.location = (0,0,-10)
        ball.keyframe_insert("location",frame=frame,group="Bola de referência")
    for curve in action.fcurves:
        for key in curve.keyframe_points:
            key.interpolation = "LINEAR" if curve.data_path=="location" else "BEZIER"
            key.handle_left_type = key.handle_right_type = "AUTO_CLAMPED"
        cycle = curve.modifiers.new("CYCLES")
        # Continue travelling in Blender when looping, rather than sliding
        # backwards to the origin. The export keeps one in-place cycle.
        if curve.data_path == "location":
            cycle.mode_before = cycle.mode_after = "REPEAT_OFFSET"
    for label, frame in (("Passo esquerdo",1),("Passo direito",1+length//2),("Fim do ciclo",1+length)):
        action.pose_markers.new(label).frame = frame
    action.use_fake_user = True
    action.asset_mark()
    rows = [sample(scene,rig,1+length*i/32) for i in range(33)]
    assert max(abs(a-b) for a,b in zip(rows[0],rows[-1])) <= 1, name
    export = "shufflePoses" if shuffle else "walkPoses"
    lines.append(f"export const {export} = [")
    lines.extend("  ["+",".join(map(str,row))+"]," for row in rows)
    lines.append("];")
MODULE.write_bytes(("\n".join(lines)+"\n").encode("utf-8"))
scene.frame_start = 1
scene.frame_end = max(int(action.frame_range[1]) for action in bpy.data.actions)
scene.frame_set(8)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(DEST))
