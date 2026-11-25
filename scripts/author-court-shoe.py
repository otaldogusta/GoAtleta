"""Build the editable court shoe and bake its mesh for the synchronous Three.js rig.

blender -b -P scripts/author-court-shoe.py -- --blend shoe.blend --module court-shoe-data.mjs
The footprint origin is 55 mm above the floor, with the toes toward court +Z.
"""
import argparse
import sys
from pathlib import Path

import bpy


def make_shoe():
    # Millimetres from heel to toe. Width is a half-width. The medial side
    # (+X on the negative-X foot) carries the big toe and a higher instep.
    # Each row gives lengthwise position, medial offset, width, sole rise, upper height.
    rows = [
        (-137, 0, 10, 8, 54), (-132, 0, 24, 4, 77), (-122, 0, 35, 1, 93),
        (-105, 0, 40, 0, 100), (-80, 0, 43, 0, 88), (-55, 1, 44, 0, 105),
        (-35, 2, 45, 0, 111), (-12, 2, 47, 0, 95), (15, 2, 51, 0, 76),
        (43, 2, 55, 0, 63), (65, 3, 54, 0, 55), (88, 5, 49, 1, 48),
        (108, 7, 43, 3, 43), (125, 9, 33, 6, 36), (136, 10, 20, 10, 30),
        (141, 11, 9, 14, 25),
    ]
    vertices, faces = [], []
    for z, center, width, rise, height in rows:
        # Ordered around the section as seen from the toe. The outsole has
        # its own edge and flat contact patch, merging into a tapered upper.
        h = height - rise
        wall = min(13, h*.36)
        rim = [
            (-.76, 0), (.76, 0), (.96, wall*.15), (1, wall*.38), (1, wall*.77), (.96, wall),
            (.91, h*.44), (.75, h*.70), (.49, h*.91), (.16, h),
            (-.20, h*.97), (-.55, h*.83), (-.79, h*.65), (-.91, h*.42),
            (-.96, wall), (-1, wall*.77), (-1, wall*.38), (-.96, wall*.15),
        ]
        for x, y in rim:
            vertices.append(((center+width*x)/1000, -z/1000, (rise+y-55)/1000))
    count = len(rim)
    for row in range(len(rows)-1):
        for i in range(count):
            lo, nxt = row*count+i, row*count+(i+1)%count
            faces.extend(((lo, nxt, nxt+count), (lo, nxt+count, lo+count)))
    for i in range(1, count-1):
        end = (len(rows)-1)*count
        faces.extend(((0, i+1, i), (end, end+i, end+i+1)))
    mesh = bpy.data.meshes.new("Tênis de quadra")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for face in mesh.polygons:
        face.use_smooth = True
    return mesh


def hull(points):
    """Extreme (height, length) pairs give exact sole support at any pitch."""
    points = sorted(set(points))
    def half(sequence):
        result = []
        for a, b in sequence:
            while len(result) > 1:
                (x, y), (u, v) = result[-2:]
                if (u-x)*(b-y) > (v-y)*(a-x):
                    break
                result.pop()
            result.append((a, b))
        return result
    return half(points)[:-1] + half(reversed(points))[:-1]


def bake(mesh, path):
    # Decimillimetres fit into Int16, including the support polygon.
    coords = [(round(v.co.x*10000), round(v.co.z*10000), round(-v.co.y*10000)) for v in mesh.vertices]
    faces = [tuple(p.vertices) for p in mesh.polygons]
    support = hull([(y, z) for _, y, z in coords])
    def array(name, kind, values):
        numbers = [str(n) for group in values for n in group]
        lines = [','.join(numbers[i:i+24]) for i in range(0, len(numbers), 24)]
        return f'export const {name}=new {kind}([\n '+',\n '.join(lines)+'\n]);\n'
    path.write_text('// Baked in Blender by scripts/author-court-shoe.py.\n'
                    + array('shoeVertices', 'Int16Array', coords)
                    + array('shoeIndices', 'Uint16Array', faces)
                    + array('shoeProfile', 'Int16Array', support), encoding='utf-8', newline='\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--blend', required=True, type=Path)
    parser.add_argument('--module', required=True, type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mesh = make_shoe()
    obj = bpy.data.objects.new("Tênis", mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    material = bpy.data.materials.new("Cor do jogador")
    material.diffuse_color = (.13, .62, .38, 1)
    mesh.materials.append(material)
    bake(mesh, args.module)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()))
