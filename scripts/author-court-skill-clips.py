"""Author the court's contact actions and bake evaluated IK landmarks.

Blender 4.5: blender -b -P scripts/author-court-skill-clips.py
The .blend contains editable goal keys and native two-link IK for each limb.
Run with -- --stills to also render the contact sheets' source frames.

Motion references: FIVB Level I Coaches Manual (passing and setting sequences);
USA Volleyball, "Five Keys to Better Passing" (hold the platform through contact);
Reeser et al., "Upper Limb Biomechanics During the Volleyball Serve and Spike"
(arm cocking, acceleration, ball contact and follow-through). Times and joint
targets below are authored for this rig, not measurements of those athletes.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".tmp" / "volleyball-v2"
MODULE = ROOT / "public" / "visual-court-3d" / "skill-motion-data.mjs"
OUT.mkdir(parents=True, exist_ok=True)


def vec(x, y, z):
    return Vector((x, y, z))


def blender(p):
    return vec(p.x, -p.z, p.y)


def court(p):
    return vec(p.x, p.z, -p.y)


def turn(degrees, axis):
    return Matrix.Rotation(math.radians(degrees), 3, axis)


def unit(v):
    return Vector(v).normalized()


def body(y, pitch, yaw=0, roll=0, x=0, z=0, lift=0, roundness=0):
    """Hip center and chest rotation. The neck counterbalances trunk flexion."""
    pelvis = vec(x, y, z)
    spine = turn(yaw, "Y") @ turn(roll, "Z") @ turn(pitch, "X")
    pelvis_rotation = turn(yaw * .43, "Y") @ turn(roll * .4, "Z")
    chest = pelvis + spine @ vec(0, .515, .015)
    neck = turn(yaw * .60, "Y") @ turn(roll * .55, "Z") @ turn(pitch * .32, "X")
    goals = dict(hips=pelvis, chest=chest, skull=chest + neck @ vec(0, .224, .018))
    for side, sign in (("L", -1), ("R", 1)):
        goals["hip" + side] = pelvis + pelvis_rotation @ vec(sign * .101, 0, 0)
        goals["shoulder" + side] = chest + spine @ vec(
            sign * (.187 - .029 * roundness), lift, .040 * roundness)
    return goals


def feet(goals, half_width, stagger, heel=(0, 0)):
    for index, (side, sign) in enumerate((("L", -1), ("R", 1))):
        outward = turn(sign * 8, "Y")
        # Rotate the heel about the ball of the foot. Toe contact stays fixed.
        sole = outward @ turn(heel[index], "X") @ vec(0, -.057, .182)
        toe = vec(sign * half_width, .038, -sign * stagger) + outward @ vec(0, 0, .182)
        goals["ankle" + side] = toe - sole
        goals["toe" + side] = toe
        goals["kneePole" + side] = goals["hip" + side] + outward @ vec(sign * .12, -.25, .80)


def arm(goals, side, palm, pole, finger):
    goals["palm" + side] = Vector(palm)
    goals["elbowPole" + side] = goals["shoulder" + side] + Vector(pole)
    goals["fingerGoal" + side] = Vector(palm) + unit(finger) * .092


def passing(kind):
    lateral = kind == "passSide"
    dig = kind == "dig"
    markers = dict(ready=0, load=12, contact=22, follow=29, recover=47)
    # Height, hip hinge, lateral transfer, shoulder turn, and platform:
    # hand spacing, forward reach and drop relative to the shoulder line.
    keys = [
        (0, .84, 18, 0, 0, .205, .32, -.27, 0),
        (7, .81, 21, .02, 5, .170, .37, -.31, .18),
        (12, .69 if dig else .76, 31 if dig else 25, .07, 17, .093, .44, -.41, .62),
        (18, .56 if dig else .73, 40 if dig else 27, .115, 26, .035, .545, -.45, .96),
        (22, .55 if dig else .735, 41 if dig else 27, .13, 29, .031, .565, -.448, 1),
        (25, .555 if dig else .742, 40 if dig else 26, .13, 29, .031, .574, -.437, 1),
        (29, .575 if dig else .76, 38 if dig else 24, .125, 27, .034, .588, -.421, 1),
        (36, .68 if dig else .80, 29 if dig else 21, .08, 15, .068, .535, -.349, .65),
        (47, .84, 18, 0, 0, .205, .32, -.27, 0),
    ]
    poses = []
    for frame, height, lean, transfer, yaw, space, reach, drop, joined in keys:
        if lateral:
            # +Z points to the setter in the court. Open to read the serve,
            # then square the shoulder line to the target by the load.
            yaw = 5 if frame == 7 else 0
        else:
            transfer *= .20 if dig else .07
            yaw *= .26 if dig else .09
        g = body(height, lean, yaw, -transfer * 57, transfer, -.055 - .12 * joined,
                 lift=.025 * joined, roundness=joined)
        feet(g, .326 if dig else .254, .088 if dig else .054)
        if lateral:
            # Lead foot opens first. The opposite shoe supports the swing,
            # then the pelvis travels over the new base before the pass.
            step = {
                0: (0, 0, 0), 7: (.10, .12, .015), 12: (.27, 0, .055),
                18: (.27, 0, .055), 22: (.27, 0, .055), 25: (.27, 0, .055),
                29: (.27, 0, .055), 36: (.16, .08, .025), 47: (0, 0, 0),
            }
            hip_shift = {0: 0, 7: 0, 12: .025, 18: .20, 22: .21,
                         25: .20, 29: .16, 36: .035, 47: 0}
            offset = vec(*step[frame])
            for name in ("ankleR", "toeR"):
                g[name] += offset
            for name in ("hips", "hipL", "hipR", "kneePoleL", "kneePoleR"):
                g[name].x += hip_shift[frame]
            for name in ("chest", "skull", "shoulderL", "shoulderR"):
                g[name].x += hip_shift[frame] * .62
        shoulder_center = (g["shoulderL"] + g["shoulderR"]) / 2
        # Lock the two forearms to a single platform approaching contact.
        # Keep the axis below the ball; the follow-through comes from the legs.
        aim = turn(yaw, "Y") @ turn(-transfer * 57, "Z")
        for side, sign in (("L", -1), ("R", 1)):
            palm = shoulder_center + aim @ vec(sign * space, drop, reach)
            arm(g, side, palm, aim @ vec(sign * (.67 - .38 * joined), -.43, -.36),
                aim @ vec(-sign * .06 * joined, -.62 + .19 * joined, .72 + .22 * joined))
        poses.append((frame, g))
    return markers, poses


def setting(kind):
    back, jump = kind == "setBack", kind == "setJump"
    markers = dict(ready=0, load=14, rise=23, contact=29, follow=35, recover=54)
    if back:
        markers["backfollow"] = markers["follow"]
    # The window is visible before the ball arrives. Receive above the brow
    # with bent elbows, then extend while the wrists follow the outgoing set.
    keys = [
        (0, .915, 4, .24, .842, .13, 0, 0),
        (7, .895, 6, .215, 1.35, .29, 0, .05),
        (14, .725 if jump else .805, 11, .182, 1.71, .25, 0, .25),
        (20, .815 if jump else .851, 8, .162, 1.84, .258, 3, .40),
        (23, .91, 4, .148, 1.95, .249, 12 if jump else 4, .52),
        (26, .943, 0, .132, 1.986, .228, 26 if jump else 9, .56),
        (29, .963, -4 if back else 2, .128, 2.016, .147 if back else .222, 31 if jump else 14, .67),
        (32, .960, -9 if back else 3, .141, 2.137, -.103 if back else .297, 30 if jump else 15, .94),
        (35, .934, -11 if back else 6, .164, 2.135, -.263 if back else .366, 29 if jump else 13, 1),
        (42, .765 if jump else .885, 8, .224, 1.69, .32, 3, .35),
        (47, .84 if jump else .90, 7, .277, 1.18, .31, 0, .10),
        (54, .915, 4, .24, .842, .13, 0, 0),
    ]
    poses = []
    for frame, height, lean, space, palm_y, reach, heel, release in keys:
        g = body(height, lean, 1.5, -1.3, x=.012, z=-.105 if frame==14 else -.018,
                 lift=.03 * release)
        # Track the descending ball through the window, then look towards the
        # release. Preserve the length of the neck in the authored capture.
        gaze = {7: 15, 14: 24, 20: 28, 23: 31, 26: 32, 29: 32,
                32: 35 if back else 26, 35: 32 if back else 22, 42: 17, 47: 8}
        g["skull"] = g["chest"] + turn(-gaze.get(frame, 0), "X") @ (g["skull"] - g["chest"])
        feet(g, .167, .055, heel=(heel, heel * .87))
        for side, sign in (("L", -1), ("R", 1)):
            raised = palm_y > 1.45
            tip = (0, -.94, .28)
            normal = vec(-sign * .74, .48, .57)
            if raised:
                # Wrist extension leaves the thumb below the index and the
                # pads above the forehead. Start releasing it after contact.
                window = turn(-sign*48, "Y") @ turn(-20, "X") @ turn(sign*26, "Z")
                tip, normal = window @ vec(0,1,0), window @ vec(0,0,1)
                if 29 < frame <= 35:
                    tip = (-sign * .11, .89, -.38 if back else .40)
            elif frame in (7, 47):
                tip = (-sign * .17, .34, .80)
            palm = vec(sign * space, palm_y, reach)
            arm(g, side, palm, (sign * .58, -.38, .19) if raised
                else (sign * .72, -.44, -.42), tip)
            # Surface of the palm looks diagonally up and in. Locking the roll
            # about the hand's long axis keeps both thumbs inside the window.
            g["palmNormal" + side] = palm + normal
        poses.append((frame, g))
    return markers, poses


def float_serve():
    markers = dict(ready=0, toss=17, draw=30, contact=37, follow=45, idle=62, recover=62)
    # The left shoe leads (+Z). The guide arm presents the ball out in front;
    # the striking hand is already beside the head before the toss starts.
    # Frame, pelvis height, pitch, yaw, pelvis X/Z, guide wrist, striking wrist, rear heel.
    keys = [
        (0,  .910,  2, 24,  .042, -.150, (-.170, 1.354, .675), (.225, 1.817, -.213),  0),
        (9,  .912,  0, 25,  .038, -.149, (-.146, 1.548, .658), (.229, 1.822, -.223),  0),
        (13, .920, -3, 26,  .032, -.147, (-.126, 1.719, .597), (.231, 1.828, -.234),  1),
        (17, .933, -6, 28,  .022, -.144, (-.110, 1.864, .495), (.237, 1.833, -.248),  3),
        (20, .939, -6, 29,  .011, -.138, (-.106, 1.909, .469), (.241, 1.836, -.261),  4),
        (24, .940, -5, 31, -.002, -.104, (-.120, 1.795, .448), (.235, 1.838, -.275),  6),
        (30, .930, -5, 33, -.019, -.046, (-.194, 1.477, .340), (.215, 1.828, -.297),  9),
        (33, .942, -2, 20, -.030,  .006, (-.231, 1.337, .264), (.200, 1.867, -.185), 17),
        (35, .955,  1,  6, -.046,  .052, (-.248, 1.231, .206), (.132, 2.047, -.025), 25),
        (37, .968,  4, -8, -.055,  .086, (-.255, 1.174, .163), (-.030, 2.242, .247), 30),
        (39, .964,  6,-13, -.060,  .103, (-.255, 1.146, .150), (-.042, 2.176, .443), 32),
        (42, .946,  8,-16, -.061,  .108, (-.254, 1.108, .143), (-.044, 1.981, .670), 30),
        (45, .926,  8,-17, -.060,  .107, (-.249, 1.075, .147), (-.032, 1.747, .788), 24),
        (53, .909,  7,-10, -.030,  .056, (-.241,  .995, .142), ( .127, 1.161, .492),  7),
        (62, .915,  4,  0,     0,     0, (-.240,  .842, .130), ( .240,  .842, .130),  0),
    ]
    poses = []
    for frame, height, pitch, yaw, x, z, guide, hit, heel in keys:
        striking = 35 <= frame <= 39
        g = body(height, pitch, yaw, 4 if striking else 0, x, z, lift=.054 if striking else .016)
        feet(g, .177, .180, heel=(0, heel))
        # After release the guide arm folds towards the ribs. The right elbow
        # stays outside the shoulder and leads the hand into the acceleration.
        guide_tip = (.09, -.04, .99) if frame <= 20 else (.12, -.65, .75)
        hit_tip = (.03, .99, -.12) if frame <= 35 else (-.03, .99, .12)
        if frame >= 45:
            hit_tip = (0, .45, .89) if frame == 45 else (0, -.84, .54)
        arm(g, "L", guide, (-.25, -.95, -.25), guide_tip)
        arm(g, "R", hit, (.81, .34, -.49) if frame <= 35 else (.87, .14, .23), hit_tip)
        g["palmNormalL"] = Vector(guide) + (vec(0, 1, 0) if frame <= 20 else vec(.86, .15, .32))
        g["palmNormalR"] = Vector(hit) + vec(.05, -.10, .99)
        poses.append((frame, g))
    return markers, poses


# Approach distance from the server's starting position. In the court the
# contact mark is editable; both the body and the ball are placed relative to it.
TOPSPIN_FORWARD = {
    0: 0, 8: .005, 13: .030, 16: .130, 17: .205, 19: .315, 21: .425,
    23: .620, 25: .850, 26: 1.01, 28: 1.29, 29: 1.43, 30: 1.55,
    31: 1.62, 33: 1.70, 35: 1.77, 37: 1.82, 39: 1.85, 42: 1.91,
    45: 1.96, 48: 2.00, 51: 2.04, 53: 2.06, 55: 2.075, 62: 2.09,
}
TOPSPIN_SUPPORT = vec(0, .15, 0)
TOPSPIN_STRIKE_OFFSET = vec(0, .032, .146)


def topspin_jump(frame):
    # The court clock takes 1.10 s from release to contact and .64 s to recover.
    seconds_from_strike = (frame - 37) * (1.10 / 20 if frame < 37 else .64 / 25)
    return .63 * max(0, 1 - (seconds_from_strike / .3584) ** 2)


def topspin_serve():
    markers = dict(ready=0, toss=17, firstStep=21, penultimate=25, plant=28, takeoff=30,
                   draw=33, contact=37, follow=42, land=51, idle=62, recover=62)
    # Frame, pelvis height, trunk pitch/yaw, lateral transfer, pelvis Z in the
    # moving frame, guide and striking wrist targets. Lower the hips on plant
    # and again after landing; the knee and shoulder action precede toe-off.
    keys = [
        (0, .895, 5, 18, .025,-.155, (-.16,1.005,.57),(.22,1.04,.24)),
        (8, .890, 5, 18, .025,-.155, (-.16,1.21,.66),(.22,1.04,.23)),
        (13,.902, 2, 19, .020,-.169, (-.14,1.495,.70),(.24,1.02,.19)),
        (16,.926,-2, 18, .015,-.135, (-.11,1.787,.565),(.27,1.00,.14)),
        (17,.936,-4, 16, .009,-.061, (-.105,1.935,.524),(.28,.99,.13)),
        (19,.929,-3, 15,-.015,-.042, (-.06,2.02,.40),(.29,1.01,.06)),
        (21,.895, 5, 12,-.035, .004, (-.12,1.83,.56),(.30,1.01,-.04)),
        (23,.868,12,  8,-.022, .010, (-.22,1.35,.60),(.29,1.07,-.27)),
        (25,.810,20,  5, .020,-.010, (-.26,.98,.17),(.25,1.12,-.48)),
        (26,.781,23,  9, .036,-.017, (-.29,1.01,-.16),(.25,1.15,-.49)),
        (28,.727,24, 12, .020,-.030, (-.29,1.12,-.44),(.27,1.18,-.47)),
        (29,.772,17, 15,-.002,-.016, (-.27,1.04,-.21),(.33,1.07,-.22)),
        (30,.897, 7, 21,-.012, .012, (-.24,1.31,.51),(.39,1.34,.29)),
        (31,.948, 0, 26,-.020, .032, (-.17,1.67,.60),(.42,1.60,.19)),
        (33,.956,-6, 36,-.026, .054, (-.12,2.00,.42),(.26,1.85,-.26)),
        (35,.967,-4, 17,-.029, .066, (-.21,1.70,.39),(.19,1.95,-.20)),
        (37,.972, 5,-13,-.034, .083, (-.24,1.21,.17),(-.03,2.218,.234)),
        (39,.956, 9,-22,-.040, .090, (-.23,1.12,.11),(-.11,2.02,.49)),
        (42,.928,14,-31,-.040, .089, (-.24,1.08,.13),(-.26,1.60,.51)),
        (45,.904,16,-33,-.035, .068, (-.27,1.07,.20),(-.31,1.22,.29)),
        (48,.897,12,-25,-.020, .036, (-.31,1.10,.25),(-.17,1.08,.25)),
        (51,.866,14,-16,-.010, .014, (-.35,1.18,.34),(.03,1.11,.32)),
        (53,.754,21, -8,-.015, .000, (-.39,1.20,.40),(.29,1.20,.44)),
        (55,.763,18, -3,-.010,-.012, (-.32,1.09,.37),(.32,1.09,.38)),
        (62,.907, 5,  0,    0,    0, (-.24,.84,.13),(.24,.84,.13)),
    ]
    poses = {}
    for frame, height, pitch, yaw, x, z, guide, hit in keys:
        g = body(height, pitch, yaw, 5 if 35 <= frame <= 39 else 0, x, z,
                 lift=.052 if 35 <= frame <= 39 else .012)
        if frame <= 19:
            # Keep the same long lever as it arcs around the shoulder.
            guide = g["shoulderL"] + unit(Vector(guide) - g["shoulderL"]) * .726
        guide_tip = (.05,.06,.99) if frame <= 19 else (.08,-.68,.73)
        arm(g, "L", guide, (-.24,-.94,-.20), guide_tip)
        if frame <= 31:
            pole, tip = (.62,-.65,-.42), (0,-.85,.53)
        elif frame <= 37:
            pole, tip = (.90,.24,-.37), (-.04,.96,-.27) if frame < 37 else (-.03,.98,.18)
        else:
            pole, tip = (.86,.05,.28), (-.18,-.52,.83) if frame <= 45 else (0,-.88,.47)
        arm(g, "R", hit, pole, tip)
        g["palmNormalL"] = Vector(guide) + (vec(0,1,0) if frame <= 19 else vec(1,.14,.25))
        g["palmNormalR"] = Vector(hit) + (vec(0,-.3,.96) if frame <= 37 else vec(.20,-.85,.49))
        for side, sign in (("L", -1), ("R", 1)):
            g["kneePole" + side] = g["hip" + side] + vec(.13*sign,-.20,.85)
        shift = vec(0, topspin_jump(frame), TOPSPIN_FORWARD[frame])
        poses[frame] = {name: position + shift for name, position in g.items()}

    # Each shoe has its own world-space controls. A stationary toe stays on
    # exactly the same mark while the other shoe swings and the hips pass it.
    # Frame, ankle Z in the level shoe, toe clearance above root lift, heel pitch.
    footfalls = {
        "L": [(0,-.13,0,0),(13,-.13,0,0),(16,-.13,0,15),(17,-.10,.03,20),
              (19,.22,.11,7),(21,.54,0,0),(23,.54,0,0),(25,.54,0,20),
              (26,.86,.12,25),(27,1.30,.11,8),(28,1.61,0,0),(29,1.61,0,5),(30,1.61,0,31),
              (31,1.64,.02,40),(33,1.63,.13,42),(35,1.67,.18,39),(37,1.76,.17,36),
              (39,1.82,.15,30),(42,1.94,.10,22),(45,2.02,.07,18),(48,2.12,.035,15),
              (51,2.17,0,10),(52,2.17,0,5),(53,2.17,0,0),(55,2.17,0,0),(62,2.17,0,0)],
        "R": [(0,.13,0,0),(17,.13,0,0),(19,.13,0,3),(21,.13,0,19),
              (23,.73,.19,24),(25,1.36,0,0),(28,1.36,0,0),(29,1.36,0,13),(30,1.36,0,37),
              (31,1.40,.03,46),(33,1.38,.17,48),(35,1.44,.23,47),(37,1.50,.23,45),
              (39,1.56,.21,42),(42,1.68,.16,34),(45,1.78,.12,27),(48,1.90,.08,17),
              (51,1.99,.04,12),(53,2.02,0,8),(54,2.02,0,3),(55,2.02,0,0),(62,2.02,0,0)],
    }
    for side, sign in (("L", -1), ("R", 1)):
        outward = turn(sign * 8, "Y")
        for frame, z, clearance, heel in footfalls[side]:
            toe = vec(sign*.165, .038 + topspin_jump(frame) + clearance, z) + outward @ vec(0,0,.182)
            sole = outward @ turn(heel,"X") @ vec(0,-.057,.182)
            g = poses.setdefault(frame, {})
            g["toe" + side], g["ankle" + side] = toe, toe - sole
    return markers, sorted(poses.items())


ACTIONS = {
    "pass": ("Manchete frontal", passing("pass")),
    "passSide": ("Manchete lateral", passing("passSide")),
    "dig": ("Defesa baixa", passing("dig")),
    "set": ("Levantamento à frente", setting("set")),
    "setBack": ("Levantamento de costas", setting("setBack")),
    "setJump": ("Levantamento em suspensão", setting("setJump")),
    "serve": ("Saque flutuante", float_serve()),
    "serveSpin": ("Saque com rotação", topspin_serve()),
}


def bend(origin, target, pole, upper, lower):
    """Non-singular rest pose giving the Blender IK chain its preferred plane."""
    axis = unit(target - origin)
    distance = min((target - origin).length, upper + lower - .003)
    along = (distance**2 + upper**2 - lower**2) / (2 * distance)
    normal = pole - origin
    normal -= axis * axis.dot(normal)
    return origin + axis * along + unit(normal) * math.sqrt(max(0, upper**2 - along**2))


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
armature = bpy.data.armatures.new("Fundamentos • controles e cadeias IK")
rig = bpy.data.objects.new("Atleta • fundamentos", armature)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
controls = armature.collections.new("Controles")
skeleton = armature.collections.new("Esqueleto")
bpy.ops.object.mode_set(mode="EDIT")
rest = ACTIONS["set"][1][1][0][1]


def make_bone(name, a, b, parent=None, connected=False, control=False, foot=False):
    bone = armature.edit_bones.new(name)
    bone.head, bone.tail = blender(a), blender(b)
    if parent:
        bone.parent = armature.edit_bones[parent]
        bone.use_connect = connected
    if not control:
        bone.align_roll(vec(0, 0, 1) if foot else vec(0, -1, 0))
    bone.use_deform = not control
    (controls if control else skeleton).assign(bone)


for name, position in rest.items():
    # Control local X/Y/Z matches Blender's world axes.
    make_bone("ctl." + name, position, position + vec(0, 0, -.075), control=True)
make_bone("bola", vec(0,0,0), vec(0,0,-.1), control=True)
make_bone("shirt", rest["hips"], rest["chest"], "ctl.hips")
make_bone("head", rest["chest"], rest["skull"], "ctl.chest")
for side in "LR":
    for root, target, pole, upper, lower, a, b in (
        ("shoulder", "palm", "elbowPole", "arm", "forearm", .352, .382),
        ("hip", "ankle", "kneePole", "thigh", "shin", .454, .451),
    ):
        start, end = rest[root+side], rest[target+side]
        joint = bend(start, end, rest[pole+side], a, b)
        make_bone(upper+side, start, joint, "ctl."+root+side)
        make_bone(lower+side, joint, end, upper+side, connected=True)
    make_bone("hand"+side, rest["palm"+side], rest["fingerGoal"+side], "forearm"+side, connected=True)
    make_bone("foot"+side, rest["ankle"+side], rest["toe"+side], "shin"+side, connected=True, foot=True)
bpy.ops.object.mode_set(mode="OBJECT")


def aim_bone(name, target):
    c = rig.pose.bones[name].constraints.new("DAMPED_TRACK")
    c.target, c.subtarget, c.track_axis = rig, "ctl." + target, "TRACK_Y"


aim_bone("shirt", "chest")
# Rotate the shoulder line around the spine during a serve.
c = rig.pose.bones["shirt"].constraints.new("LOCKED_TRACK")
c.target, c.subtarget, c.track_axis, c.lock_axis = rig, "ctl.shoulderR", "TRACK_X", "LOCK_Y"
aim_bone("head", "skull")
ik_chains = []
for side in "LR":
    for upper, lower, target, pole in (
        ("arm", "forearm", "palm", "elbowPole"), ("thigh", "shin", "ankle", "kneePole")
    ):
        for name in (upper, lower):
            rig.pose.bones[name+side].ik_stretch = 0
        c = rig.pose.bones[lower+side].constraints.new("IK")
        c.target, c.subtarget, c.pole_target, c.pole_subtarget = rig, "ctl."+target+side, rig, "ctl."+pole+side
        c.chain_count, c.use_stretch, c.iterations = 2, False, 80
        ik_chains.append((upper+side, lower+side, pole+side, c))
    aim_bone("hand"+side, "fingerGoal"+side)
    aim_bone("foot"+side, "toe"+side)

# Blender's pole-angle reference depends on bone roll. Calibrate from the
# actual evaluated rig so that knees bend forward and elbows away from ribs.
for upper, lower, pole, c in ik_chains:
    def alignment(angle):
        c.pole_angle = angle
        bpy.context.view_layer.update()
        a, b = rig.pose.bones[upper], rig.pose.bones[lower]
        axis = unit(b.tail - a.head)
        desired = blender(rest[pole]) - a.head
        actual = b.head - a.head
        return unit(desired - axis * desired.dot(axis)).dot(unit(actual - axis * actual.dot(axis)))
    angle = math.atan2(alignment(math.pi/2), alignment(0))
    assert alignment(angle) > .99, (upper, angle, alignment(angle))


def drive_from_rig(owner, path, property_name):
    driver = owner.driver_add(path).driver
    driver.type = "AVERAGE"
    variable = driver.variables.new()
    variable.name = "window"
    variable.targets[0].id = rig
    variable.targets[0].data_path = f'["{property_name}"]'


rig["setting_window"] = 0.
rig["finger_release"] = 0.
rig["palm_alignment"] = 0.
for side in "LR":
    roll = rig.pose.bones["hand"+side].constraints.new("LOCKED_TRACK")
    roll.name = "Palma voltada para a bola"
    roll.target, roll.subtarget = rig, "ctl.palmNormal"+side
    roll.track_axis, roll.lock_axis = "TRACK_Z", "LOCK_Y"
    drive_from_rig(roll, "influence", "palm_alignment")


# Create one weighted review mesh. All parts are in the armature's rest
# coordinate system, including hands and shoes. Each ring is along local Y.
vertices, faces, materials, weights = [], [], [], {}
palette = {
    "pele": (.50, .241, .137), "camisa": (.032, .42, .38), "gola": (.029, .085, .13),
    "calção": (.035, .075, .125), "cabelo": (.043, .025, .019), "meia": (.80, .85, .86),
    "tênis": (.76, .85, .86), "sola": (.045, .105, .14), "detalhe": (.35, .90, .68),
}
names = list(palette)


def loft(bone, color, rings, sides=20):
    transform = armature.bones[bone].matrix_local
    begin = len(vertices)
    for y, rx, rz, cx, cz in rings:
        for i in range(sides):
            angle = math.tau * i / sides
            vertices.append(transform @ vec(cx + rx*math.cos(angle), y, cz + rz*math.sin(angle)))
    weights.setdefault(bone, []).extend(range(begin, len(vertices)))
    ring_faces = [tuple(begin+j for j in range(sides))]
    for row in range(len(rings)-1):
        for j in range(sides):
            k = begin + row*sides
            jj = (j+1) % sides
            ring_faces.append((k+j, k+sides+j, k+sides+jj, k+jj))
    ring_faces.append(tuple(len(vertices)-1-j for j in range(sides)))
    faces.extend(ring_faces)
    materials.extend([names.index(color)] * len(ring_faces))


def rings(bone, color, profile, cx=0, cz=0):
    loft(bone, color, [(y, rx, rz, cx, cz) for y, rx, rz in profile])


def oval(bone, color, center, radii):
    x, y, z = center
    rx, ry, rz = radii
    loft(bone, color, [(y + t*ry, rx*math.sqrt(1-t*t), rz*math.sqrt(1-t*t), x, z)
                        for t in (-.998, -.85, -.55, 0, .55, .85, .998)])


# Centreline of each open digit in metres. Right-hand local axes are +X to
# the little finger, +Y towards the fingertips and +Z towards the ball.
# The same three landmarks per digit drive the actual court hand.
SETTING_DIGITS = {
    "thumb":  [(-.033,-.003,.006), (-.060,-.010,.024), (-.085,-.018,.059)],
    "index":  [(-.032, .033,.003), (-.050, .077,.015), (-.062, .109,.054)],
    "middle": [(-.011, .039,.005), (-.019, .089,.020), (-.019, .122,.057)],
    "ring":   [( .012, .036,.006), ( .029, .081,.023), ( .037, .108,.066)],
    "little": [( .034, .024,.008), ( .056, .058,.026), ( .073, .081,.082)],
}
setting_vertices, released_vertices = {}, {}


def shape_setting_digit(hand, sign, name, first_vertex):
    """Fan and curve the existing finger in a pose-specific shape key."""
    base, joint, pad = [vec(sign*x, y, z) for x, y, z in SETTING_DIGITS[name]]
    diameter_scale = 1.24 if name == "thumb" else .86 if name == "little" else 1.
    transform = armature.bones[hand].matrix_local
    sections = [(0, .003), (.12, .009), (.32, .0095), (.5, .0092),
                (.72, .0083), (.93, .007), (1, .0018)]
    for row, (fraction, radius) in enumerate(sections):
        center = base.lerp(joint, 2*fraction) if fraction < .5 else joint.lerp(pad, 2*fraction-1)
        released_z = (base.z + (joint.z*.825-base.z)*2*fraction if fraction < .5
                      else joint.z*.825 + (pad.z*.65-joint.z*.825)*(2*fraction-1))
        tangent = (joint-base).lerp(pad-joint, fraction).normalized()
        across = tangent.cross(vec(0,0,1)).normalized()
        normal = across.cross(tangent)
        for column in range(20):
            angle = math.tau*column/20
            profile = across*math.cos(angle) + normal*(.83*math.sin(angle))
            vertex = first_vertex + row*20 + column
            surface = center + profile*radius*diameter_scale
            setting_vertices[vertex] = transform @ surface
            released_vertices[vertex] = transform @ (surface + vec(0,0,released_z-center.z))


rings("shirt", "camisa", [(-.035,.155,.107),(.04,.171,.120),(.18,.157,.108),(.33,.191,.127),
                          (.42,.207,.125),(.472,.195,.098),(.505,.086,.075)])
rings("shirt", "calção", [(-.125,.131,.104),(-.082,.167,.126),(.005,.169,.121),(.026,.164,.119)])
rings("shirt", "gola", [(.475,.101,.078),(.51,.085,.074)])
rings("head", "pele", [(-.027,.064,.060),(.105,.055,.055),(.150,.079,.069)])
oval("head", "pele", (0,.231,.010), (.094,.130,.092))
oval("head", "pele", (0,.223,.095), (.024,.035,.027))
rings("head","cabelo",[(.257,.089,.085),(.296,.093,.091),(.327,.077,.077),(.354,.048,.049),(.361,.007,.008)])
for side in "LR":
    sign = -1 if side == "L" else 1
    oval("head","pele",(sign*.09,.236,.008),(.014,.026,.016))
    upper, fore, hand = "arm"+side, "forearm"+side, "hand"+side
    thigh, shin, foot = "thigh"+side, "shin"+side, "foot"+side
    oval(upper, "camisa", (0,.026,0), (.077,.083,.072))
    rings(upper, "camisa", [(0,.078,.070),(.075,.076,.068),(.12,.069,.062)])
    rings(upper,"pele",[(.09,.066,.060),(.17,.061,.057),(.26,.054,.051),(.35,.046,.045)])
    oval(fore, "pele", (0,.007,0), (.046,.046,.046))
    rings(fore, "pele", [(0,.047,.046),(.083,.055,.054),(.18,.045,.046),(.30,.031,.031),(.37,.030,.031)])
    oval(hand,"pele",(0,.016,0),(.041,.047,.023))
    for i, digit in enumerate(("index", "middle", "ring", "little")):
        start_vertex = len(vertices)
        oval(hand,"pele",((i-1.5)*.019,.06,0),(.010,.031-abs(i-1.2)*.004,.010))
        # Rest mesh is ordered along local X on both hands.
        mirror_digit = ("little", "ring", "middle", "index")[i] if sign < 0 else digit
        shape_setting_digit(hand, sign, mirror_digit, start_vertex)
    start_vertex = len(vertices)
    oval(hand,"pele",(-sign*.034,.026,.010),(.015,.027,.014))
    shape_setting_digit(hand, sign, "thumb", start_vertex)
    rings(thigh,"pele",[(.11,.083,.081),(.24,.079,.078),(.37,.061,.059),(.45,.055,.054)])
    rings(thigh,"calção",[(-.04,.095,.103),(.06,.104,.102),(.155,.092,.090),(.20,.093,.089)])
    oval(shin,"pele",(0,0,0),(.056,.060,.054))
    rings(shin,"pele",[(.01,.054,.053),(.11,.060,.066),(.19,.055,.063),(.31,.037,.041),(.448,.032,.034)])
    rings(shin,"meia",[(.299,.041,.042),(.32,.041,.042),(.39,.034,.035),(.455,.035,.036)])
    loft(foot,"tênis",[(-.067,.039,.032,0,.024),(-.040,.050,.052,0,.016),
                       (.014,.051,.057,0,.01),(.089,.055,.044,0,.010),(.168,.052,.023,0,0),
                       (.194,.024,.014,0,0)])
    loft(foot,"sola",[(-.060,.044,.012,0,-.009),(.02,.056,.015,0,-.034),
                      (.105,.059,.013,0,-.032),(.18,.044,.011,0,-.015),(.199,.016,.007,0,-.006)])

mesh = bpy.data.meshes.new("Malha esportiva")
mesh.from_pydata(vertices, [], faces)
mesh.update()
player = bpy.data.objects.new("Jogador", mesh)
scene.collection.objects.link(player)
player.parent = rig
player.shape_key_add(name="Base")
setting_hand = player.shape_key_add(name="Janela do toque")
for index, co in setting_vertices.items():
    setting_hand.data[index].co = co
drive_from_rig(setting_hand, "value", "setting_window")
released_hand = player.shape_key_add(name="Extensão dos dedos na soltura", from_mix=False)
released_hand.relative_key = setting_hand
for index, co in released_vertices.items():
    released_hand.data[index].co = co
drive_from_rig(released_hand, "value", "finger_release")
for name, rgb in palette.items():
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mesh.materials.append(mat)
for face, material in zip(mesh.polygons, materials):
    face.material_index, face.use_smooth = material, True
for bone, indices in weights.items():
    player.vertex_groups.new(name=bone).add(indices, 1, "REPLACE")
player.modifiers.new(name="Esqueleto", type="ARMATURE").object = rig
armature.display_type = "STICK"
controls.is_visible = False
rig.show_in_front = False


# These two channels are Blender-only court context. The simulation supplies
# its own ball and world-space jump height, so encode_frame samples rig space.
def add_review_motion(key, markers, poses):
    lookup = dict(poses)
    marker_frame = markers["contact"]
    g = lookup[marker_frame]
    if key == "serve":
        support = vec(0, .136, .025)
        keys = [(frame, pose["palmL"] + support) for frame, pose in poses if frame <= markers["toss"]]
        release = keys[-1][1]
        contact = g["palmR"] + vec(0, .038, .133)
        toss_duration = .60
        for frame in range(markers["toss"] + 1, marker_frame + 1):
            phase = (frame - markers["toss"]) / (marker_frame - markers["toss"])
            elapsed = phase * toss_duration
            center = release.lerp(contact, phase)
            center.y += 4.905 * elapsed * (toss_duration - elapsed)
            keys.append((frame, center))
        keys += [(41, contact + vec(0, .09, 1.48)), (62, contact + vec(0, -.43, 6))]
    elif key == "serveSpin":
        keys = [(frame, pose["palmL"] + TOPSPIN_SUPPORT) for frame, pose in poses
                if "palmL" in pose and frame <= markers["toss"]]
        release = keys[-1][1]
        contact = g["palmR"] + TOPSPIN_STRIKE_OFFSET
        for frame in range(markers["toss"] + 1, marker_frame + 1):
            u = (frame - markers["toss"]) / (marker_frame - markers["toss"])
            center = release.lerp(contact, u)
            center.y += 4.905 * 1.10 ** 2 * u * (1-u)
            keys.append((frame, center))
        keys += [(41, contact + vec(0,.18,1.65)), (62, contact + vec(0,-.4,8))]
        for frame, forward in TOPSPIN_FORWARD.items():
            rig["approach_forward"] = float(forward)
            rig.keyframe_insert('["approach_forward"]', frame=frame+1, group="Avanço da passada")
    elif key.startswith("set"):
        contact = (g["palmR"] + g["palmL"])/2 + vec(0,.076,.058)
        receive = (lookup[26]["palmR"] + lookup[26]["palmL"])/2 + vec(0,.216,.065)
        sign = -1 if key == "setBack" else 1
        keys = [(0,vec(-1.6,2.25,1.75)), (9,vec(-1.0,2.69,1.25)),
                (20,vec(-.33,2.30,.54)), (26,receive), (marker_frame,contact),
                (35,contact + vec(.09,.59,sign*.87)), (47,contact + vec(.27,1.02,sign*2.55)),
                (54,contact + vec(.38,.83,sign*3.56))]
    else:
        # Passing uses the two distal forearms, rather than the fingertips.
        hand = (g["palmR"] + g["palmL"])/2
        contact = hand + vec(0,.135,-.067)
        keys = [(0,contact + vec(-.95,1.61,2.50)), (12,contact + vec(-.43,.94,1.11)),
                (marker_frame,contact), (29,contact + vec(.21,.65,.84)),
                (39,contact + vec(.51,1.03,2.04)), (47,contact + vec(.75,.96,3.0))]
    for frame, position in keys:
        ball = rig.pose.bones["bola"]
        ball.location = blender(position)
        ball.keyframe_insert("location", frame=frame+1, group="Bola de referência")
    ball.scale = (.12/.105,)*3 if key.startswith(("set", "serve")) else (1,1,1)
    ball.keyframe_insert("scale", frame=1, group="Bola de referência")
    ball.rotation_mode = "XYZ"
    rotation = [(0,0), (17,0), (37,4.5*1.10), (62,4.5*1.10+14*.64)] if key == "serveSpin" else [(0,0)]
    for frame, radians in rotation:
        ball.rotation_euler.x = radians
        ball.keyframe_insert("rotation_euler", index=0, frame=frame+1, group="Bola de referência")
    for frame, height in ((0,0),(21,0),(25,.19),(29,.31),(32,.34),(36,.25),(42,0),(54,0)):
        rig.location.z = height if key == "setJump" else 0
        rig.keyframe_insert("location", index=2, frame=frame+1, group="Salto da demonstração")


bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=.105)
ball = bpy.context.object
ball.name = "Bola • referência de contato"
for name, color in (("Gomos amarelos", (1.0,.66,.044)), ("Gomos azuis", (.021,.125,.42)),
                    ("Gomos claros", (.88,.93,.93))):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    ball.data.materials.append(m)
for polygon in ball.data.polygons:
    p = polygon.center.normalized()
    panel = (math.atan2(p.y, p.x) + .85 * p.z + math.pi)/math.tau
    polygon.material_index = (0,1,0,2,0,1)[int(panel*6) % 6]
    polygon.use_smooth = True
ball.parent, ball.parent_type, ball.parent_bone = rig, "BONE", "bola"
ball.location = (0,-.1,0)


def encode_frame(origin):
    evaluated = rig.evaluated_get(bpy.context.evaluated_depsgraph_get()).pose.bones
    points = [evaluated["ctl."+name].head for name in ("hips", "chest", "skull")]
    for side in "LR":
        for bone, attr in (("arm","head"),("forearm","head"),("hand","head"),("hand","tail"),
                           ("thigh","head"),("shin","head"),("foot","head"),("foot","tail")):
            points.append(getattr(evaluated[bone+side], attr))
    return [round(coord*1000) for p in points for coord in (court(p) - origin)]


joints = ["hips","chest","skull"] + [name+side for side in "LR" for name in
         ("shoulder","elbow","palm","fingertip","hip","knee","ankle","toe")]
lines = ["// Generated by Blender using scripts/author-court-skill-clips.py.",
         "// Evaluated IK in rig-local millimetres, +Y up, +Z forward.",
         "// Setting fingers: hand-local metres, right hand; base, joint, distal pad.",
         "export const settingDigits = " + json.dumps(SETTING_DIGITS) + ";",
         "export const skillJoints = " + json.dumps(joints) + ";", "export const skillClips = {"]
actions = {}
for key, (label, (markers, poses)) in ACTIONS.items():
    action = bpy.data.actions.new(label)
    rig.animation_data_create().action = action
    window_keys = [(0, 0), (7, .42), (14, 1), (35, 1), (42, .72), (47, .25), (54, 0)] if key.startswith("set") else [(0, 0)]
    for frame, openness in window_keys:
        rig["setting_window"] = float(openness)
        rig.keyframe_insert('["setting_window"]', frame=frame+1, group="Janela do toque")
        rig["palm_alignment"] = 1. if key.startswith("serve") else float(openness)
        rig.keyframe_insert('["palm_alignment"]', frame=frame+1, group="Orientação das palmas")
    release_keys = [(0, 0.), (29, 0.), (35, 1.), (42, .72), (47, .25), (54, 0.)] if key.startswith("set") else [(0, 0.)]
    for frame, extension in release_keys:
        rig["finger_release"] = extension
        rig.keyframe_insert('["finger_release"]', frame=frame+1, group="Janela do toque")
    for frame, g in poses:
        for name, position in g.items():
            ctl = rig.pose.bones["ctl."+name]
            ctl.location = blender(position - rest[name])
            ctl.keyframe_insert("location", frame=frame+1, group=name)
    add_review_motion(key, markers, poses)
    for fcurve in action.fcurves:
        for keyframe in fcurve.keyframe_points:
            keyframe.handle_left_type = keyframe.handle_right_type = "AUTO_CLAMPED"
            if key == "serveSpin" and fcurve.data_path.endswith('["bola"].rotation_euler'):
                keyframe.interpolation = "LINEAR"
    if key == "serveSpin":
        # Follow the evaluated IK, including in-between frames. The free-flight
        # keys after release must not pull the held ball off the open palm.
        ball_ctl = rig.pose.bones["bola"]
        for i in range(markers["toss"] + 1):
            scene.frame_set(i+1)
            palm = court(rig.pose.bones["handL"].head)
            ball_ctl.location = blender(palm + TOPSPIN_SUPPORT)
            ball_ctl.keyframe_insert("location", frame=i+1, group="Bola de referência")
    for name, index in markers.items():
        action.pose_markers.new(name).frame = index+1
    action.use_fake_user = True
    action.asset_mark()
    actions[key] = action
    lines.append('  ' + key + ': {markers: ' + json.dumps(markers) + ', frames: [')
    window, release = [], []
    spin_root, spin_guide = [], []
    for i in range(poses[-1][0]+1):
        scene.frame_set(i+1)
        origin = vec(0,0,0)
        if key == "serveSpin":
            origin = vec(0, topspin_jump(i), rig["approach_forward"])
            spin_root.append([round(origin.z, 5), round(origin.y, 5)])
            # The court mirrors the Blender actor to display a right-handed
            # server. Its compact ball track therefore uses -X for court right.
            center = court(rig.pose.bones["bola"].head) - origin
            ball_local = [round(-center.x, 5), round(center.y, 5), round(center.z, 5)]
            if i <= markers["toss"]:
                spin_guide.append(ball_local)
            if i == markers["contact"]:
                spin_strike = ball_local
        row = encode_frame(origin)
        assert len(row) == 57
        lines.append("    [" + ",".join(map(str,row)) + "],")
        if key.startswith("set"):
            window.append(round(rig["setting_window"], 3))
            release.append(round(rig["finger_release"], 3))
    if window:
        lines.append("  ], window: " + json.dumps(window) + ",")
        lines.append("  release: " + json.dumps(release) + "},")
    else:
        lines.append("  ]},")
    if key == "serveSpin":
        # Simulation imports this light track without fetching the skeleton.
        tracks = {"topspinMarkers": markers, "topspinRoot": spin_root,
                  "topspinGuide": spin_guide, "topspinStrike": spin_strike}
        track_lines = ["// Generated with scripts/author-court-skill-clips.py. Metres, +Z downcourt.",
                       "// Root: [forward, jump]; ball: [right, height, forward] in the moving root."]
        track_lines += ["export const " + name + " = " + json.dumps(values) + ";" for name, values in tracks.items()]
        MODULE.with_name("topspin-motion-data.js").write_bytes(("\n".join(track_lines) + "\n").encode("utf-8"))
lines.append("};")
MODULE.write_bytes(("\n".join(lines)+"\n").encode("utf-8"))

scene.frame_start = 1
scene.frame_end = 63
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.cavity_type = "WORLD"
scene.display.shading.background_type = "WORLD"
if not scene.world:
    scene.world = bpy.data.worlds.new("Estúdio")
scene.world.color = (.035, .050, .073)
bpy.ops.mesh.primitive_plane_add(size=100)
floor = bpy.context.object
floor.name = "Piso"
mat = bpy.data.materials.new("Piso de treino")
mat.diffuse_color = (.082,.106,.13,1)
floor.data.materials.append(mat)
bpy.ops.object.camera_add(location=(3.3,-5,2.18))
camera = bpy.context.object
camera.rotation_euler = (vec(0,-.05,1.32)-camera.location).to_track_quat("-Z","Y").to_euler()
camera.data.type, camera.data.ortho_scale = "ORTHO", 2.96
bpy.ops.object.camera_add(location=(5.2,-3.1,2.64))
approach_camera = bpy.context.object
approach_camera.name = "Saque com rotação • passada e lançamento"
approach_camera.rotation_euler = (vec(0,-1.04,2.04)-approach_camera.location).to_track_quat("-Z","Y").to_euler()
approach_camera.data.type, approach_camera.data.ortho_scale = "ORTHO", 4.55
scene.camera = camera
scene.render.resolution_percentage = 100
scene.render.resolution_x, scene.render.resolution_y = 440, 440
for area in bpy.context.screen.areas:
    if area.type == "VIEW_3D":
        area.spaces.active.region_3d.view_perspective = "CAMERA"
        area.spaces.active.shading.color_type = "MATERIAL"
        area.spaces.active.overlay.show_overlays = False
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
rig.animation_data.action = actions["set"]
scene.frame_set(ACTIONS["set"][1][0]["rise"]+1)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "Go Atleta - Gestos com bola.blend"))
if "--stills" in sys.argv:
    for key, action in actions.items():
        rig.animation_data.action = action
        scene.camera = approach_camera if key == "serveSpin" else camera
        phases = ("ready","toss","penultimate","plant","draw","contact","follow","land") if key == "serveSpin" else ("load","draw","contact","follow")
        for phase in phases:
            frame = ACTIONS[key][1][0].get(phase)
            if frame is None:
                continue
            scene.frame_set(frame+1)
            scene.render.filepath = str(OUT / f"{key}-{phase}.png")
            bpy.ops.render.render(write_still=True)
