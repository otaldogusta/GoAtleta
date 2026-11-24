"""Build the editable swing block study and sample its controls for the court.

Run with Blender 4.5 in background mode and -P scripts/author-court-swing-block.py.
The reference is the crossover and closing plant in FIVB Coaches Manual I,
photo series P69. Angles and timings here are authored, not motion capture.
"""
import bpy, json, math
from pathlib import Path
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
root=Path(__file__).resolve().parents[1]
out=root/'.tmp'/'volleyball-v2'
out.mkdir(parents=True,exist_ok=True)
scene.render.fps=30
scene.frame_end=64
controls=bpy.data.collections.new("Controles editáveis")
scene.collection.children.link(controls)
def control(name):
    o=bpy.data.objects.new(name,None); controls.objects.link(o)
    o.empty_display_size=.075
    return o
def mesh(name, xyz, scale, color, cube=False):
    if cube: bpy.ops.mesh.primitive_cube_add(size=2,location=xyz)
    else: bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=xyz)
    o=bpy.context.object; o.name=name; o.scale=scale; o.color=(*color,1)
    for p in o.data.polygons: p.use_smooth=not cube
    return o
def joint(parent, size, color):
    o=mesh(parent.name+" · malha",(0,0,0),size,color)
    o.parent=parent
def segment(a,b,r,color):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=1)
    o=bpy.context.object; o.name=a.name+" → "+b.name; o.color=(*color,1)
    for p in o.data.polygons: p.use_smooth=True
    # Stretch To uses local Y; put the mesh from the pivot to its endpoint.
    for v in o.data.vertices:
        x,y,z=v.co; v.co=(x,z+.5,-y)
    c=o.constraints.new('COPY_LOCATION'); c.target=a
    c=o.constraints.new('STRETCH_TO'); c.target=b; c.rest_length=1; c.volume='NO_VOLUME'
blue=(.12,.54,.92); orange=(.95,.54,.22); green=(.16,.69,.51)
hips=control("Quadril"); chest=control("Peito"); head=control("Cabeça")
joint(hips,(.18,.115,.10),green); joint(head,(.105,.10,.13),green)
segment(hips,chest,.105,green); segment(chest,head,.052,green)
ribcage=mesh("Caixa torácica",(0,0,-.15),(.211,.105,.243),green)
ribcage.parent=chest
sternum=mesh("Frente do peito",(0,-.093,-.092),(.147,.038,.123),(.24,.79,.57))
sternum.parent=chest
nose=mesh("Frente do rosto",(0,-.095,-.015),(.024,.035,.024),green); nose.parent=head
limbs=[]
for side,color in [('Esquerdo',blue),('Direito',orange)]:
    names=['Ombro','Cotovelo','Mão','Quadril','Joelho','Pé','Punho']
    nodes=[control(f'{name} {side.lower()}') for name in names]
    for index,size in [(0,(.068,)*3),(1,(.05,)*3),(2,(.048,.029,.071)),(6,(.031,)*3),(4,(.064,)*3),(5,(.075,.125,.046))]:
        joint(nodes[index],size,color)
    for a,b,r in [(0,1,.054),(1,6,.043),(3,4,.083),(4,5,.061)]:
        segment(nodes[a],nodes[b],r,color)
    limbs.append(nodes)
def key(o,xyz,frame):
    o.location=xyz; o.keyframe_insert(data_path='location',frame=frame)
# Facing -Y, the athlete's right is toward -X.
# Feet are marked in world coordinates to keep each stance fixed.
poses=[
# frame, pelvis X, hip Z, yaw, forward lean, arm backswing, upward reach, left foot, right foot
(1,0,.90,0,.055,0,0,(.15,0,.05),(-.15,0,.05)),
(8,-.08,.89,-.26,.095,.08,0,(.15,0,.05),(-.32,0,.11)),
(13,-.29,.88,-.72,.15,.30,0,(.15,0,.05),(-.59,0,.05)),
(20,-.62,.87,-1.20,.20,.83,0,(-.61,-.20,.28),(-.59,0,.05)),
(26,-1.13,.83,-.58,.22,1,0,(-1.45,-.06,.05),(-.82,.02,.15)),
(32,-1.48,.70,0,.20,1,0,(-1.45,-.06,.05),(-1.79,-.02,.05)),
(34,-1.56,.67,0,.17,.65,.12,(-1.45,-.06,.05),(-1.79,-.02,.05)),
(35,-1.60,.72,0,.11,.38,.38,(-1.45,-.06,.05),(-1.79,-.02,.05)),
(38,-1.62,.98,0,.04,0,.78,(-1.45,-.06,.15),(-1.79,-.02,.15)),
(46,-1.63,1.46,0,.02,0,1,(-1.46,-.11,.57),(-1.80,-.07,.57)),
(51,-1.64,1.35,0,.025,0,.95,(-1.47,-.12,.47),(-1.81,-.08,.47)),
(57,-1.64,.86,0,.05,0,.48,(-1.47,-.12,.05),(-1.81,-.08,.05)),
(60,-1.64,.74,0,.19,0,.12,(-1.47,-.12,.05),(-1.81,-.08,.05)),
(64,-1.64,.88,0,.04,0,0,(-1.47,-.12,.05),(-1.81,-.08,.05))]
# Forward swing in the shoulder plane; the elbow initiates the ascent,
# while the forearm and palm extend toward the net near takeoff.
arm_angles = {
    1:(19,112), 8:(12,96), 13:(-12,60), 20:(-45,-31),
    26:(-73,-62), 32:(-54,-36), 34:(8,35), 35:(47,99), 38:(138,157),
    46:(168,169), 51:(159,157), 57:(63,111), 60:(23,83), 64:(19,112),
}
for f,x,h,yaw,lean,back,reach,left,right in poses:
    base=Vector((x,0,h))
    across=Vector((math.cos(yaw),math.sin(yaw),0))
    forward=Vector((math.sin(yaw),-math.cos(yaw),0))
    z=Vector((0,0,1))
    shoulder=base+z*(.51-.11*lean)+forward*lean
    key(hips,base,f);key(chest,shoulder,f);key(head,shoulder+z*.23+forward*.035,f)
    chest.rotation_euler=(math.atan2(lean,shoulder.z-base.z),0,yaw)
    chest.keyframe_insert(data_path='rotation_euler',frame=f)
    # The pelvis leads the crossover. Eyes keep reading across the net
    # as the chest squares and the second shoe brakes beside the pin.
    hip_yaw=math.radians({1:0,8:-22,13:-54,20:-80,26:-65,32:-5}.get(f,0))
    gaze=math.radians({1:0,8:-6,13:-13,20:-25,26:-10,32:0}.get(f,0))
    hips.rotation_euler.z=hip_yaw
    hips.keyframe_insert(data_path='rotation_euler',frame=f)
    pelvic_across=Vector((math.cos(hip_yaw),math.sin(hip_yaw),0))
    head.rotation_euler.z=gaze
    head.keyframe_insert(data_path='rotation_euler',frame=f)
    for i,nodes in enumerate(limbs):
        s=1 if i==0 else -1
        sh=shoulder+s*.19*across
        upper,lower=map(math.radians,arm_angles[f])
        def arm_direction(angle,side_offset):
            return (forward*math.sin(angle)-z*math.cos(angle)+across*(s*side_offset)).normalized()
        elbow=sh+.30*arm_direction(upper,.18-.14*reach)
        wrist=elbow+.265*arm_direction(lower,.055-.075*reach)
        palm_axis=arm_direction(lower-math.radians(16)*reach,.015)
        hand=wrist+.064*palm_axis
        hand_rotation=nodes[2]
        hand_rotation.rotation_mode='QUATERNION'
        hand_rotation.rotation_quaternion=palm_axis.to_track_quat('Z','Y')
        hand_rotation.keyframe_insert(data_path='rotation_quaternion',frame=f)
        key(nodes[6],wrist,f)
        hip=base+s*.105*pelvic_across
        foot=Vector(left if i==0 else right)
        ankle=foot+z*.045
        axis=ankle-hip; span=axis.length; unit=axis.normalized()
        bend=(forward-unit*forward.dot(unit)).normalized()
        knee=hip+axis*.5+bend*math.sqrt(max(0,.46**2-(span/2)**2))
        for o,p in zip(nodes,(sh,elbow,hand,hip,knee,foot)): key(o,p,f)
        nodes[5].rotation_euler.z=yaw*.45 if foot.z>.051 else 0
        nodes[5].keyframe_insert(data_path='rotation_euler',frame=f)
for o in controls.objects:
    if o.animation_data:
        for curve in o.animation_data.action.fcurves:
            for k in curve.keyframe_points:k.handle_left_type=k.handle_right_type='AUTO_CLAMPED'
for f,label in [(1,'Base'),(13,'1 · Abre direita'),(26,'2 · Cruza esquerdo'),(32,'3 · Fecha direita'),(38,'Impulsão'),(46,'Bloqueio'),(57,'Aterrissagem')]:
    scene.timeline_markers.new(label,frame=f)
mesh("Piso",(-.8,0,-.066),(3.15,2,.06),(.12,.17,.23),True)
mesh("Fita da rede",(-.8,-.8,2.39),(3,.015,.023),(.77,.82,.89),True)
for n in range(29):
    mesh("Malha vertical",(-3.6+n*.2,-.8,1.93),(.006,.008,.43),(.33,.42,.55),True)
for n in range(5):
    mesh("Malha horizontal",(-.8,-.8,1.5+n*.20),(2.8,.008,.006),(.33,.42,.55),True)
bpy.ops.object.camera_add(location=(3,5.4,3.1))
camera=bpy.context.object; camera.rotation_euler=(Vector((-.75,-.1,1.38))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=5.15;scene.camera=camera
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.color_type='OBJECT';scene.display.shading.light='STUDIO'
scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True
scene.render.resolution_x=600; scene.render.resolution_y=430;scene.render.resolution_percentage=100
bpy.ops.object.select_all(action='DESELECT')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.color_type='OBJECT'
            area.spaces.active.overlay.show_extras=False
scene.frame_set(1)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'Go Atleta - Fechamento do central.blend'))

def court_axes(vector):
    return (vector.x,vector.z,-vector.y)

rows=[]
for frame in range(1,47):
    scene.frame_set(frame)
    row=[chest.rotation_euler.x,chest.rotation_euler.z]
    for nodes in limbs:
        row.extend(court_axes(nodes[5].location))
    for nodes in limbs:
        for index in (1,2,6):
            row.extend(court_axes(nodes[index].location-hips.location))
    row.extend((hips.rotation_euler.z,head.rotation_euler.z,max(0,.92-hips.location.z)))
    rows.append(json.dumps([round(v,4) for v in row],separators=(',',':')))
module=root/'public'/'visual-court-3d'/'swing-block-data.js'
module.write_text('// Generated by scripts/author-court-swing-block.py at 30 fps.\n'
                  +'export const blockClip = [\n'+',\n'.join(rows)+'\n];\n',encoding='utf-8')
