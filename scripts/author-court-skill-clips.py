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
        if not lateral:
            transfer *= .20 if dig else .07
            yaw *= .26 if dig else .09
        g = body(height, lean, yaw, -transfer * 57, transfer, -.055 - .12 * joined,
                 lift=.025 * joined, roundness=joined)
        feet(g, .326 if dig else .254, .088 if dig else .054)
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
    # Forehead window on ascent, brief finger loading, then full release.
    keys = [
        (0, .915, 4, .24, .842, .13, 0, 0),
        (7, .895, 6, .26, 1.18, .26, 0, 0),
        (14, .725 if jump else .805, 11, .145, 1.54, .26, 0, .13),
        (20, .815 if jump else .851, 8, .124, 1.72, .225, 3, .24),
        (23, .91, 4, .115, 1.865, .210, 12 if jump else 4, .28),
        (26, .943, 0, .102, 1.91, .189, 26 if jump else 9, .22),
        (29, .963, -4 if back else 2, .090, 2.154, .11 if back else .16, 31 if jump else 14, .80),
        (32, .960, -9 if back else 3, .090, 2.16, -.16 if back else .30, 30 if jump else 15, 1),
        (35, .934, -11 if back else 6, .105, 2.09, -.28 if back else .43, 29 if jump else 13, .95),
        (42, .765 if jump else .885, 8, .260, 1.61, .37, 3, .28),
        (47, .84 if jump else .90, 7, .277, 1.18, .31, 0, .10),
        (54, .915, 4, .24, .842, .13, 0, 0),
    ]
    poses = []
    for frame, height, lean, space, palm_y, reach, heel, release in keys:
        g = body(height, lean, 1.5, -1.3, x=.012, z=-.105 if frame==14 else -.018,
                 lift=.03 * release)
        feet(g, .167, .055, heel=(heel, heel * .87))
        for side, sign in (("L", -1), ("R", 1)):
            airborne_hand = palm_y > 1.45
            arm(g, side, (sign * space, palm_y + (.012 * sign if airborne_hand else 0), reach),
                (sign * .72, -.44, -.20 if airborne_hand else -.42),
                (-sign * .22, 1, -.35 if back and release>.5 else .42) if airborne_hand
                else (0, -.94, .28))
        poses.append((frame, g))
    return markers, poses


def serving(spin):
    markers = dict(ready=0, toss=17, draw=30, contact=37, follow=45, idle=62, recover=62)
    # The guide hand separates at the toss. Pelvis then chest rotate into the
    # ball, with a late elbow extension and a longer cross-body finish for spin.
    keys = [
        (0,.915,3,22,-.06,-.02,(-.06,1.46,.50),(.26,1.06,.20),0),
        (9,.895,4,24,-.09,-.03,(-.08,1.38,.48),(.32,1.26,.01),0),
        (13,.922,1,25,-.07,-.01,(-.085,1.67,.46),(.51,1.48,-.13),3),
        (17,.945,0,27,-.06,.02,(-.11,2.055,.30),(.43,1.64,-.19),5),
        (23,.932,-5,34,-.055,.015,(-.11,2.079,.24),(.34,1.78,-.27),7),
        (30,.910,-8,43 if spin else 36,-.045,-.015,(-.14,1.85,.32),(.29,1.81,-.36),8),
        (33,.927,-4,18,.005,.025,(-.30,1.60,.47),(.32,1.78,-.16),18),
        (35,.948,1,-2,.030,.050,(-.31,1.36,.38),(.33,1.97,.07),26),
        (37,.957,5,-11,.047,.070,(-.26,1.21,.17),(.210,2.229,.344),31),
        (39,.944,8,-20,.058,.085,(-.24,1.12,.16),
         (.155,2.005,.55) if spin else (.247,2.148,.505),34),
        (42,.916,12,-26 if spin else -16,.052,.09,(-.27,1.10,.15),
         (-.040,1.56,.65) if spin else (.252,1.965,.707),29),
        (45,.883,14 if spin else 9,-32 if spin else -18,.052,.09,
         (-.24,1.035,.18),(-.21,1.11,.40) if spin else (.225,1.67,.776),21),
        (53,.894,8,-11,.027,.035,(-.23,.99,.16),(-.06,1.03,.26) if spin else (.24,1.115,.431),6),
        (62,.915,4,0,0,0,(-.24,.842,.13),(.24,.842,.13),0),
    ]
    poses = []
    for frame, height, lean, yaw, x, z, guide, hit, heel in keys:
        g = body(height, lean, yaw, -2 if frame<32 else 3, x, z,
                 lift=.045 if frame in (35,37,39) else .014)
        feet(g, .177, .177, heel=(0, heel))
        arm(g, "L", guide, (-.73, -.43, -.42),
            (-.06, .99, .28) if 15<frame<=30 else (.02, -.2 if frame<15 else -.90, .87))
        # At maximum external rotation the elbow is out and the forearm up.
        if frame <= 13:
            pole = (.45, -.86, -.35)
        elif frame == 17:
            pole = (.80, -.43, -.40)
        elif frame <= 35:
            pole = (.94, .10, -.19)
        else:
            pole = (.94, .05, .30)
        tip = (.05, .96, -.24) if 17<=frame<=35 else (.02, .97, .21)
        if frame>37:
            tip = (-.16, -.7, .85) if spin else (.02, .74 if frame<45 else -.40, .78)
        if frame<17 or frame>=53:
            tip = (0, -.91, .34)
        arm(g, "R", hit, pole, tip)
        poses.append((frame, g))
    return markers, poses


ACTIONS = {
    "pass": ("Manchete frontal", passing("pass")),
    "passSide": ("Manchete lateral", passing("passSide")),
    "dig": ("Defesa baixa", passing("dig")),
    "set": ("Levantamento à frente", setting("set")),
    "setBack": ("Levantamento de costas", setting("setBack")),
    "setJump": ("Levantamento em suspensão", setting("setJump")),
    "serve": ("Saque flutuante", serving(False)),
    "serveSpin": ("Saque com rotação", serving(True)),
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
    for i in range(4):
        oval(hand,"pele",((i-1.5)*.019,.06,0),(.010,.031-abs(i-1.2)*.004,.010))
    oval(hand,"pele",(-sign*.034,.026,.010),(.015,.027,.014))
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
    if key.startswith("serve"):
        contact = g["palmR"] + vec(0,.025,.096)
        release = lookup[markers["toss"]]["palmL"] + vec(.025,.085,.050)
        keys = [(0,lookup[0]["palmL"] + vec(0,.09,.035)),
                (9,lookup[9]["palmL"] + vec(0,.09,.035)),
                (17,release), (26,release.lerp(contact,.45) + vec(0,.43,0)),
                (marker_frame,contact), (41,contact + vec(0,.09,1.48)),
                (62,contact + vec(0,-.43,6))]
    elif key.startswith("set"):
        contact = (g["palmR"] + g["palmL"])/2 + vec(0,.070,.045)
        receive = (lookup[26]["palmR"] + lookup[26]["palmL"])/2 + vec(0,.095,.041)
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


def encode_frame():
    evaluated = rig.evaluated_get(bpy.context.evaluated_depsgraph_get()).pose.bones
    points = [evaluated["ctl."+name].head for name in ("hips", "chest", "skull")]
    for side in "LR":
        for bone, attr in (("arm","head"),("forearm","head"),("hand","head"),("hand","tail"),
                           ("thigh","head"),("shin","head"),("foot","head"),("foot","tail")):
            points.append(getattr(evaluated[bone+side], attr))
    return [round(coord*1000) for p in points for coord in court(p)]


joints = ["hips","chest","skull"] + [name+side for side in "LR" for name in
         ("shoulder","elbow","palm","fingertip","hip","knee","ankle","toe")]
lines = ["// Generated by Blender using scripts/author-court-skill-clips.py.",
         "// Evaluated IK in rig-local millimetres, +Y up, +Z forward.",
         "export const skillJoints = " + json.dumps(joints) + ";", "export const skillClips = {"]
actions = {}
for key, (label, (markers, poses)) in ACTIONS.items():
    action = bpy.data.actions.new(label)
    rig.animation_data_create().action = action
    for frame, g in poses:
        for name, position in g.items():
            ctl = rig.pose.bones["ctl."+name]
            ctl.location = blender(position - rest[name])
            ctl.keyframe_insert("location", frame=frame+1, group=name)
    add_review_motion(key, markers, poses)
    for fcurve in action.fcurves:
        for keyframe in fcurve.keyframe_points:
            keyframe.handle_left_type = keyframe.handle_right_type = "AUTO_CLAMPED"
    for name, index in markers.items():
        action.pose_markers.new(name).frame = index+1
    action.use_fake_user = True
    action.asset_mark()
    actions[key] = action
    lines.append('  ' + key + ': {markers: ' + json.dumps(markers) + ', frames: [')
    for i in range(poses[-1][0]+1):
        scene.frame_set(i+1)
        row = encode_frame()
        assert len(row) == 57
        lines.append("    [" + ",".join(map(str,row)) + "],")
    lines.append("  ]},")
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
rig.animation_data.action = actions["serve"]
scene.frame_set(ACTIONS["serve"][1][0]["draw"]+1)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "Go Atleta - Gestos com bola.blend"))
if "--stills" in sys.argv:
    for key, action in actions.items():
        rig.animation_data.action = action
        for phase in ("load","draw","contact","follow"):
            frame = ACTIONS[key][1][0].get(phase)
            if frame is None:
                continue
            scene.frame_set(frame+1)
            scene.render.filepath = str(OUT / f"{key}-{phase}.png")
            bpy.ops.render.render(write_still=True)
