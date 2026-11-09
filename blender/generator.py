import bpy, math, sys, random
from mathutils import Vector
import os
# 使い方：blender -b -P blender/generator.py -- [サンプル数] [noexport]
#   出力は、blender/out/ に、画像3枚（gen_*.png）と generator.glb。
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out') + os.sep
os.makedirs(OUT, exist_ok=True)
SAMPLES = next((int(a) for a in ARGS if a.isdigit()), 32)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module='cycles')
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'GPU' if 'gpu' in ARGS else 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1500, 960
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
random.seed(3)

def mat(name, col, rough=0.5, metal=0.0, bump=0.0, scale=60):
    m = bpy.data.materials.new(name); m.use_nodes = True; n = m.node_tree.nodes; b = n['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if bump:
        t = n.new('ShaderNodeTexNoise'); t.inputs['Scale'].default_value = scale; t.inputs['Detail'].default_value = 8
        bp = n.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump; bp.inputs['Distance'].default_value = 0.01
        m.node_tree.links.new(t.outputs['Fac'], bp.inputs['Height']); m.node_tree.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m
PAINT = mat('paint', (0.50, 0.60, 0.60), 0.42, 0.0, 0.08, 120)       # 機関の淡い青灰色
PAINT2 = mat('paint2', (0.58, 0.64, 0.63), 0.45, 0.0, 0.08, 120)
GREY = mat('grey', (0.62, 0.64, 0.64), 0.5, 0.0, 0.06, 90)
DESK = mat('desk', (0.55, 0.62, 0.55), 0.5, 0.0, 0.05, 90)
STEEL = mat('steel', (0.72, 0.73, 0.75), 0.28, 1.0, 0.03, 200)
SILVER = mat('silver', (0.8, 0.8, 0.82), 0.22, 1.0)
LAG = mat('lag', (0.62, 0.63, 0.65), 0.38, 0.85, 0.15, 25)
BLACK = mat('black', (0.01, 0.01, 0.012), 0.4)
RED = mat('red', (0.75, 0.08, 0.05), 0.5); YEL = mat('yellow', (0.85, 0.65, 0.05), 0.5); WHITE = mat('white', (0.9, 0.9, 0.88), 0.6)
RUB = mat('rubber', (0.02, 0.02, 0.02), 0.8)
CONC = mat('conc', (0.32, 0.32, 0.33), 0.85, 0.0, 0.4, 25); WALL = mat('wall', (0.30, 0.29, 0.28), 0.9, 0.0, 0.8, 18)
GL = mat('glass', (1, 1, 1), 0.03); GL.node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value = 1.0
FACE = mat('gaugeface', (0.93, 0.93, 0.9), 0.4)

def rbox(name, x0, x1, y0, y1, z0, z1, m, bv=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0+x1)/2, (y0+y1)/2, (z0+z1)/2)); o = bpy.context.object; o.name = name
    o.scale = (x1-x0, y1-y0, z1-z0); bpy.ops.object.transform_apply(scale=True); o.data.materials.append(m)
    if bv: md = o.modifiers.new('bv', 'BEVEL'); md.width = min(bv, (x1-x0)/3, (y1-y0)/3, (z1-z0)/3); md.segments = 3
    return o
def cyl(name, r, d, loc, m, axis='z', verts=40, r2=None):
    rot = {'z': (0, 0, 0), 'x': (0, math.pi/2, 0), 'y': (math.pi/2, 0, 0)}[axis]
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d, vertices=verts, location=loc, rotation=rot)
    else: bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=d, vertices=verts, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.data.materials.append(m); bpy.ops.object.shade_smooth(); return o
def pipe(name, pts, r, m):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 4; cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); sp.points.add(len(pts)-1)
    for i, p in enumerate(pts): sp.points[i].co = (*p, 1)
    o = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(o); o.data.materials.append(m)
    # 角を丸める
    sp.type = 'BEZIER' if False else 'POLY'; return o
def bolt_ring(cx, cy, cz, R, n, axis='x', r=0.009):
    for i in range(n):
        a = 2*math.pi*i/n
        loc = {'x': (cx, cy+math.cos(a)*R, cz+math.sin(a)*R), 'y': (cx+math.cos(a)*R, cy, cz+math.sin(a)*R), 'z': (cx+math.cos(a)*R, cy+math.sin(a)*R, cz)}[axis]
        cyl('bolt', r, 0.012, loc, STEEL, axis, 6)

# GPU（Mac の Metal など）を使うとき： ... -- gpu
if 'gpu' in ARGS:
    pr = bpy.context.preferences.addons['cycles'].preferences
    for t in ('METAL', 'OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
        try:
            pr.compute_device_type = t; pr.get_devices()
            if any(d.type == t for d in pr.devices):
                for d in pr.devices: d.use = True
                break
        except Exception: pass
# ---------------- 床・壁 ----------------
bpy.ops.mesh.primitive_plane_add(size=30, location=(0.3, 0, 0)); bpy.context.object.data.materials.append(CONC)
rbox('wall', 3.6, 3.8, -8, 8, 0, 5, WALL, 0)
# ---------------- 共通ベース（架台）と防振ゴム ----------------
rbox('skid', -2.95, 2.65, -0.78, 0.78, 0.3, 0.8, GREY, 0.02)
rbox('skid_top', -2.9, 2.6, -0.7, 0.7, 0.78, 0.82, GREY, 0.01)
for x in (-2.6, -1.3, 0.1, 1.5, 2.4):
    for y in (-0.6, 0.6):
        cyl('rubber', 0.12, 0.2, (x, y, 0.15), RUB); cyl('rubber_top', 0.1, 0.06, (x, y, 0.32), STEEL)
# ---------------- 発電機（交流発電機） ----------------
cyl('alt', 0.6, 1.1, (-1.6, 0, 1.55), PAINT2, 'x', 64)
for x in (-1.95, -1.3): 
    bpy.ops.mesh.primitive_torus_add(location=(x, 0, 1.55), rotation=(0, math.pi/2, 0), major_radius=0.6, minor_radius=0.013); bpy.context.object.data.materials.append(PAINT2)
rbox('lv_box_L', -2.55, -2.15, -0.7, 0.7, 0.95, 2.2, PAINT2, 0.02); rbox('lv_box_R', -1.05, -0.65, -0.7, 0.7, 0.95, 2.2, PAINT2, 0.02)
rbox('lv_top', -2.55, -0.65, -0.55, 0.55, 2.2, 2.38, PAINT2, 0.02)
for xc in (-2.35, -0.85):
    for s in (-1, 1):
        rbox('lv_frame', xc-0.2, xc+0.2, s*0.7-0.01 if s<0 else s*0.7, s*0.7+0.02 if s>0 else s*0.7+0.01, 1.0, 2.15, PAINT2, 0.004)
        for i in range(16): rbox('louver', xc-0.17, xc+0.17, s*0.705-0.02, s*0.705+0.02, 1.04+i*0.065, 1.075+i*0.065, GREY, 0.003)
cyl('endcap', 0.6, 0.12, (-2.62, 0, 1.55), PAINT2, 'x', 64); cyl('bracket', 0.38, 0.3, (-2.8, 0, 1.55), PAINT2, 'x', 48, 0.2)
cyl('hub', 0.22, 0.2, (-3.0, 0, 1.55), PAINT2, 'x'); bolt_ring(-3.1, 0, 1.55, 0.15, 8, 'x'); bolt_ring(-2.7, 0, 1.55, 0.5, 18, 'x')
rbox('termbox', -2.78, -2.6, -0.58, -0.28, 1.15, 1.58, PAINT2, 0.01)
rbox('fw_house', -0.65, -0.35, -0.65, 0.65, 1.0, 2.1, PAINT, 0.03); cyl('fw_cyl', 0.5, 0.3, (-0.52, 0, 1.55), PAINT, 'x', 64)
for sx in (-0.5, 0.5): bpy.ops.mesh.primitive_torus_add(location=(-0.52, sx*0.4, 2.05), rotation=(math.pi/2, 0, 0), major_radius=0.07, minor_radius=0.018); bpy.context.object.data.materials.append(STEEL)
# ---------------- ディーゼル機関 ----------------
rbox('block', -0.4, 1.3, -0.46, 0.46, 0.9, 1.75, PAINT, 0.03)
rbox('head', -0.4, 1.3, -0.4, 0.4, 1.75, 2.0, PAINT, 0.02)
rbox('oilpan', -0.3, 1.2, -0.38, 0.38, 0.82, 0.92, PAINT, 0.02)
for i in range(6):
    x = -0.25 + 0.26*i
    rbox('cover%d' % i, x-0.105, x+0.105, -0.2, 0.2, 2.0, 2.3, PAINT, 0.04)
    rbox('ridge%d' % i, x-0.06, x+0.06, -0.12, 0.12, 2.28, 2.33, PAINT, 0.02)
    # 点検蓋（前面）
    rbox('insp%d' % i, x-0.105, x+0.105, -0.485, -0.455, 0.98, 1.42, PAINT2, 0.03)
    for (dx, dz) in [(-0.08, 0.02), (0.08, 0.02), (-0.08, 0.4), (0.08, 0.4)]: cyl('b', 0.008, 0.012, (x+dx, -0.49, 0.98+dz+0.02), STEEL, 'y', 6)
    # 噴射管
    pipe('inj%d' % i, [(0.12+0.1*i, -0.6, 1.8), (x, -0.52, 1.9), (x, -0.36, 2.02)], 0.009, STEEL)
rbox('rail', -0.3, 1.2, -0.58, -0.5, 1.5, 1.56, STEEL, 0.004)
rbox('pump', 0.1, 0.72, -0.66, -0.46, 1.48, 1.82, SILVER, 0.02); rbox('pump2', 0.15, 0.4, -0.7, -0.66, 1.5, 1.7, SILVER, 0.01)
cyl('governor', 0.1, 0.24, (-0.05, -0.55, 1.65), SILVER, 'y')
# 燃料フィルタ（赤ラベル付き）
for x in (-0.3, -0.1):
    cyl('filter', 0.075, 0.42, (x, -0.62, 1.95), PAINT2, 'z'); cyl('filter_lid', 0.08, 0.04, (x, -0.62, 2.18), PAINT2, 'z')
    rbox('flabel', x-0.045, x+0.045, -0.7, -0.695, 1.82, 2.08, RED, 0.002)
for x in (1.0, 1.16):
    cyl('filter', 0.065, 0.3, (x, -0.62, 1.95), PAINT2, 'z'); rbox('flabel', x-0.04, x+0.04, -0.69, -0.685, 1.88, 2.05, RED, 0.002)
rbox('fbase', -0.45, 0.1, -0.78, -0.45, 1.78, 1.84, PAINT2, 0.01); rbox('fbase2', 0.9, 1.3, -0.74, -0.45, 1.78, 1.84, PAINT2, 0.01)
# 過給機・排気（保温巻き）
cyl('turbo', 0.17, 0.35, (0.95, 0, 2.55), PAINT, 'z'); pipe('exh_in', [(0.6, 0, 2.5), (0.85, 0, 2.5), (0.95, 0, 2.5)], 0.1, LAG)
cyl('exh', 0.205, 1.7, (0.95, 0, 3.3), LAG, 'z', 48)
for z in (2.55, 2.95, 3.35, 3.75, 4.15): bpy.ops.mesh.primitive_torus_add(location=(0.95, 0, z), major_radius=0.205, minor_radius=0.012); bpy.context.object.data.materials.append(STEEL)
cyl('duct', 0.38, 0.5, (0.95, 0, 4.35), SILVER, 'z', 48, 0.22)
# 冷却水・潤滑油の配管
pipe('water1', [(-0.2, -0.5, 0.98), (0.5, -0.5, 0.98), (1.2, -0.5, 1.0), (1.45, -0.5, 1.3)], 0.045, PAINT2)
pipe('water2', [(-0.35, -0.55, 1.2), (-0.5, -0.6, 1.4), (-0.55, -0.6, 1.9), (-0.4, -0.4, 2.3)], 0.04, PAINT2)
pipe('lube', [(1.22, -0.55, 1.0), (1.22, -0.55, 1.9)], 0.035, PAINT2)
cyl('cooler', 0.085, 1.0, (0.35, 0.58, 1.62), PAINT, 'x'); 
for x in (-0.17, 0.87): cyl('cooler_f', 0.115, 0.03, (x, 0.58, 1.62), PAINT2, 'x'); bolt_ring(x, 0.58, 1.62, 0.1, 8, 'x', 0.007)
cyl('yvalve', 0.04, 0.02, (1.0, -0.66, 1.18), YEL, 'y'); bpy.ops.mesh.primitive_torus_add(location=(1.0, -0.66, 1.18), rotation=(math.pi/2, 0, 0), major_radius=0.05, minor_radius=0.01); bpy.context.object.data.materials.append(YEL)
# 点検デッキ（縞鋼板）と補機モータ
CHK = mat('checker', (0.62, 0.64, 0.64), 0.4, 0.5, 0.6, 140)
rbox('deck', -0.45, 0.95, 0.5, 1.45, 1.06, 1.1, CHK, 0.005); rbox('deck_side', -0.45, 0.95, 1.38, 1.45, 0.8, 1.06, GREY, 0.005)
for i in range(5): rbox('step', -0.4+i*0.28, -0.26+i*0.28, 1.45, 1.52, 0.82, 0.98, GREY, 0.004)
cyl('motor', 0.085, 0.3, (0.65, 0.98, 1.2), PAINT2, 'x'); rbox('mbase', 0.55, 0.75, 0.9, 1.06, 1.1, 1.14, PAINT2, 0.005)
# ---------------- 冷却ファンとラジエータ ----------------
rbox('radbox', 1.3, 2.95, -0.84, 0.84, 0.88, 2.5, GREY, 0.02)
bpy.ops.mesh.primitive_torus_add(location=(1.33, 0, 1.65), rotation=(0, math.pi/2, 0), major_radius=0.72, minor_radius=0.045); bpy.context.object.data.materials.append(GREY)
cyl('shroud', 0.72, 0.5, (1.58, 0, 1.65), GREY, 'x', 64)
cyl('hubfan', 0.11, 0.12, (1.55, 0, 1.65), STEEL, 'x')
for i in range(8):
    a = i*math.pi/4; rc = 0.39
    b = rbox('blade', 1.52, 1.58, -0.11, 0.11, -0.27, 0.27, YEL, 0.01); b.location = (0, -rc*math.sin(a), 1.65+rc*math.cos(a)); b.rotation_euler = (a, 0, 0)
for r in (0.22, 0.44, 0.66): bpy.ops.mesh.primitive_torus_add(location=(1.28, 0, 1.65), rotation=(0, math.pi/2, 0), major_radius=r, minor_radius=0.005); bpy.context.object.data.materials.append(STEEL)
for i in range(8):
    a = i*math.pi/4; rc = 0.36
    bb = rbox('spoke', 1.27, 1.29, -0.004, 0.004, -0.36, 0.36, STEEL, 0); bb.location = (0, -rc*math.sin(a), 1.65+rc*math.cos(a)); bb.rotation_euler = (a, 0, 0)
rbox('stack', 1.6, 2.8, -0.55, 0.55, 2.5, 2.8, GREY, 0.02)
# ---------------- 機側操作盤（デスク型）と金網ガード ----------------
cx, cy = -1.05, -1.55
rbox('desk_low', cx-0.45, cx+0.45, cy-0.3, cy+0.3, 0.0, 0.85, DESK, 0.01)
rbox('door_l', cx-0.44, cx-0.01, cy-0.31, cy-0.29, 0.05, 0.8, DESK, 0.006); rbox('door_r', cx+0.01, cx+0.44, cy-0.31, cy-0.29, 0.05, 0.8, DESK, 0.006)
for dx in (-0.05, 0.05): rbox('handle', cx+dx-0.012, cx+dx+0.012, cy-0.325, cy-0.31, 0.3, 0.5, SILVER, 0.004)
import bmesh
me = bpy.data.meshes.new('desk_top'); bm = bmesh.new()
pts = [(-0.46, -0.32, 0.85), (0.46, -0.32, 0.85), (0.46, -0.32, 1.05), (-0.46, -0.32, 1.05)]
vs = [bm.verts.new(p) for p in [(-0.46, -0.32, 0.85), (0.46, -0.32, 0.85), (0.46, 0.32, 0.85), (-0.46, 0.32, 0.85), (-0.46, -0.32, 1.02), (0.46, -0.32, 1.02), (0.46, 0.32, 1.3), (-0.46, 0.32, 1.3)]]
for f in [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]: bm.faces.new([vs[i] for i in f])
bm.normal_update(); bm.to_mesh(me); bm.free(); dt = bpy.data.objects.new('desk_top', me); bpy.context.collection.objects.link(dt); dt.data.materials.append(DESK)
dt.location = (cx, cy, 0); md = dt.modifiers.new('bv', 'BEVEL'); md.width = 0.008; md.segments = 2
ang = math.atan2(0.28, 0.64)
def on_desk(u, v):   # 天板上の点（u:左右, v:手前から奥へ0..1）
    return (cx+u, cy-0.32+0.64*v, 1.02+0.28*v)
for (u, v, r) in [(0.3, 0.72, 0.085), (-0.1, 0.74, 0.055), (-0.22, 0.74, 0.055), (-0.34, 0.74, 0.055)]:
    p = on_desk(u, v)
    bz = cyl('bezel', r*1.15, 0.03, p, BLACK, 'z', 48); bz.rotation_euler = (ang, 0, 0)
    fc = cyl('face', r, 0.034, p, FACE, 'z', 48); fc.rotation_euler = (ang, 0, 0)
    nd = rbox('needle', -0.003, 0.003, 0.0, r*0.8, 0.0, 0.002, RED, 0); nd.parent = fc; nd.location = (0, 0, 0.019); nd.rotation_euler = (0, 0, -0.9)
p = on_desk(0.3, 0.3); sw = rbox('sw_plate', p[0]-0.045, p[0]+0.045, p[1]-0.045, p[1]+0.045, p[2], p[2]+0.012, SILVER, 0.004); sw.rotation_euler = (ang, 0, 0)
kb = cyl('swknob', 0.024, 0.04, (p[0], p[1], p[2]+0.03), BLACK, 'z'); kb.rotation_euler = (ang, 0, 0)
lev = rbox('swlever', -0.012, 0.012, -0.075, 0.0, 0.0, 0.02, BLACK, 0.006); lev.location = (p[0]-0.01, p[1]-0.02, p[2]+0.05); lev.rotation_euler = (ang, 0, 0.3)
for ex in (-0.4, 0.4): 
    bpy.ops.mesh.primitive_torus_add(location=(cx+ex, cy+0.28, 1.31), rotation=(math.pi/2, 0, 0), major_radius=0.03, minor_radius=0.008); bpy.context.object.data.materials.append(STEEL)
# 金網ガード
gx, gy = -2.2, -1.12
for x in (-0.65, 0.65):
    for y in (-0.33, 0.33): rbox('gpost', gx+x-0.02, gx+x+0.02, gy+y-0.02, gy+y+0.02, 0.0, 2.0, PAINT2, 0.004)
for z in (0.08, 1.95): rbox('grail', gx-0.67, gx+0.67, gy-0.35, gy+0.35, z, z+0.04, PAINT2, 0.004)
def mesh_panel(name, x0, x1, y0, y1, z0, z1):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=int(abs(x1-x0+y1-y0)/0.03), y_subdivisions=int((z1-z0)/0.03), size=1)
    g = bpy.context.object; g.name = name; g.dimensions = (abs(x1-x0) or 0.01, abs(y1-y0) or 0.01, 1)
    return g
for (px, py, w, h, rz) in [(gx, gy-0.35, 1.3, 1.9, 0), (gx, gy+0.35, 1.3, 1.9, 0), (gx-0.67, gy, 0.7, 1.9, math.pi/2), (gx+0.67, gy, 0.7, 1.9, math.pi/2)]:
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=int(w/0.035), y_subdivisions=int(h/0.035), size=1, location=(px, py, 1.0+0.04), rotation=(math.pi/2, 0, rz))
    g = bpy.context.object; g.scale = (w, h, 1); bpy.ops.object.transform_apply(scale=True)
    wf = g.modifiers.new('wf', 'WIREFRAME'); wf.thickness = 0.0045; wf.use_replace = True; g.data.materials.append(PAINT2)
bpy.ops.mesh.primitive_plane_add(size=0.42, location=(gx+0.25, gy-0.375, 1.1), rotation=(math.pi/2, 0, 0)); sg = bpy.context.object; sg.data.materials.append(WHITE)
bpy.ops.mesh.primitive_plane_add(size=0.2, location=(gx+0.25, gy-0.378, 1.1), rotation=(math.pi/2, 0, math.pi/4)); sg2 = bpy.context.object; mo = mat('orange', (0.9, 0.25, 0.02), 0.5); sg2.data.materials.append(mo)
# ---------------- Y方向の鏡像（写真に合わせる：操作盤の側が +Y） ----------------
root = bpy.data.objects.new('root', None); bpy.context.collection.objects.link(root); root.scale = (1, -1, 1)
for o in list(bpy.data.objects):
    if o.type in ('MESH', 'CURVE') and o.name != 'wall' and not o.name.startswith('Plane'): o.parent = root
# ---------------- 照明とカメラ ----------------
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.55, 0.58, 0.6, 1); bg.inputs['Strength'].default_value = 0.25
def area(loc, e, size, tgt=(0.3, 0, 1.5)):
    bpy.ops.object.light_add(type='AREA', location=loc); l = bpy.context.object; l.data.energy = e; l.data.size = size
    l.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
area((-2, 5, 5), 260, 3); area((4, 3, 4), 110, 3); area((0, -3, 5), 90, 4)
for lx in (-0.5, 1.2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(lx, 2.2, 3.9)); t = bpy.context.object; t.scale = (1.2, 0.06, 0.03); t.data.materials.append(mat('tube', (1, 1, 1), 0.3)); t.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value = (1, 1, 1, 1); t.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 4
def cam(name, loc, tgt, lens, out):
    bpy.ops.object.camera_add(location=loc); c = bpy.context.object; c.data.lens = lens
    c.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); sc.camera = c
    sc.render.filepath = OUT + out; bpy.ops.render.render(write_still=True)
if 'noexport' not in ARGS:
    cam('c1', (0.6, 5.0, 2.0), (-0.6, 0.0, 1.5), 32, 'gen_desk.png')
    cam('c2', (-1.0, -6.2, 2.2), (-0.4, 0.0, 1.4), 30, 'gen_deck.png')
    cam('c3', (-6.2, -2.8, 2.4), (0.2, 0.0, 1.4), 26, 'gen_end.png')
bpy.ops.object.select_all(action='DESELECT')
for o in [o for o in bpy.data.objects if o.parent is root]:
    m = o.matrix_world.copy(); o.parent = None; o.matrix_world = m
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type == 'CURVE' and o.name != 'wall': o.select_set(True)
if bpy.context.selected_objects:
    bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]; bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name != 'wall' and not o.name.startswith('Plane'): o.select_set(True)
bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
bpy.ops.object.make_single_user(object=True, obdata=True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type in ('MESH', 'CURVE') and o.name not in ('wall',) and not o.name.startswith('Plane'): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT + 'generator.glb', use_selection=True, export_apply=True)
print('OK')
