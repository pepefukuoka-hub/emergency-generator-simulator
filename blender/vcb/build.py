# build.py — 引出形の真空遮断器（VCB）の本体を Blender（bpy）で作り、AO を焼いて GLB に書き出す
#   写真（ドライブ機器室 IMG_3618〜3620）から形を起こした教育用の想像モデル。寸法は写真からの比率で、実測ではない。
#   メーカー名・形式・銘板の文字は入れない（前面の文字・ラベルは、three.js 側の Canvas で描くデカール）。
#   使い方: python build.py [--ao-size 1024] [--samples 64] [--noao]
#   座標（Blender）：x＝幅（正面から見て右が +）、y＝奥行き（正面が −y）、z＝上。単位 m。原点は底面の中心。
import bpy, bmesh, sys, os, math, time
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..', 'genset'))
import gb
from gb import GB

ARGS = sys.argv[1:]
def arg(name, default=None, cast=str): return cast(ARGS[ARGS.index(name) + 1]) if name in ARGS else default
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
AO_SIZE = arg('--ao-size', 1024, int); SAMPLES = arg('--samples', 64, int)
t0 = time.time()
def log(*a): print(f"[{time.time() - t0:6.1f}s]", *a, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module='cycles')
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
MATS = {}
class MatDict(dict):
    def __missing__(self, k):
        m = bpy.data.materials.get(k) or bpy.data.materials.new(k); m.use_nodes = True; MATS[k] = m; self[k] = m; return m
mats = MatDict()

# ---------- 寸法（写真の比率から） ----------
W, D, H = 0.50, 0.54, 0.56          # 本体の幅・奥行き・高さ（車輪・台枠を含む）
FY = -D / 2                          # 正面の面（本体）
PY = FY - 0.012                      # 前板の表面
B0 = 0.055                           # 台枠の高さ

g = GB()
with g.use(group='vcb'):
    # 本体（塗装の箱）と前板（一段高い板。縁を丸める）
    g.box('vbody', -W / 2, W / 2, FY, D / 2, B0, H, bev=0.008, seg=2)
    g.box('vfront', -W / 2 + 0.012, W / 2 - 0.012, PY, FY + 0.002, B0 + 0.018, H - 0.012, bev=0.005, seg=2)
    # 銘板まわりの枠（細い段）
    fx0, fx1, fz0, fz1, t = -0.21, 0.21, 0.315, 0.485, 0.004
    for (x0, x1, z0, z1) in ((fx0, fx1, fz1 - t, fz1), (fx0, fx1, fz0, fz0 + t), (fx0, fx0 + t, fz0, fz1), (fx1 - t, fx1, fz0, fz1)):
        g.box('vframe', x0, x1, PY - 0.0025, PY + 0.001, z0, z1, bev=0.001)
    g.box('vplate', -0.19, 0.19, PY - 0.0015, PY + 0.001, 0.33, 0.39, bev=0.001)          # 定格の銘板（文字は描かない）
    # 開閉回数計の窓と、入／切の表示窓
    # 窓の縁だけ立体（中の数字・赤い表示はデカール）
    for (x0, x1, z0, z1) in ((-0.158, -0.082, 0.502, 0.530), (-0.023, 0.038, 0.500, 0.532)):
        for (a0, a1, b0, b1) in ((x0, x1, z1 - 0.004, z1), (x0, x1, z0, z0 + 0.004), (x0, x0 + 0.004, z0, z1), (x1 - 0.004, x1, z0, z1)):
            g.box('black', a0, a1, PY - 0.004, PY + 0.001, b0, b1, bev=0.001)
    # 開路（TRIP）の押しボタン：黒い座金＋赤いきのこ形
    bx, bz = -0.035, 0.285
    g.cyl('black', (bx, PY + 0.001, bz), (bx, PY - 0.010, bz), 0.024, seg=32, bev=0.002)
    g.lathe('red', (bx, PY - 0.010, bz), (0, -1, 0), [(0.0, 0.0), (0.0, 0.019), (0.006, 0.020), (0.012, 0.017), (0.016, 0.010), (0.0175, 0.0)], seg=32)
    # 閉路（CLOSE）の操作部：透明のカバー、黒いつまみ、鍵
    cx, cz = -0.035, 0.205
    g.box('steel', cx - 0.026, cx + 0.026, PY - 0.004, PY + 0.001, cz - 0.05, cz + 0.05, bev=0.002)
    g.cyl('black', (cx, PY - 0.004, cz + 0.01), (cx, PY - 0.020, cz + 0.01), 0.019, seg=32, bev=0.002)
    g.box('steel', cx - 0.003, cx + 0.003, PY - 0.030, PY - 0.018, cz + 0.006, cz + 0.04, bev=0.001)
    g.cyl('brass', (cx, PY - 0.004, cz - 0.04), (cx, PY - 0.02, cz - 0.04), 0.006, seg=16)
    with g.use(cls='glass'):
        g.box('acryl', cx - 0.03, cx + 0.03, PY - 0.035, PY - 0.004, cz - 0.055, cz + 0.055, bev=0.003)
    # 蓄勢の操作口（黒い開口と、手動の操作軸）
    hx, hz = 0.095, 0.18
    g.box('black', hx - 0.022, hx + 0.022, PY - 0.002, PY + 0.003, hz - 0.07, hz + 0.07, bev=0.003)
    g.cyl('steel', (hx, PY + 0.02, hz - 0.02), (hx, PY - 0.03, hz - 0.02), 0.009, seg=20)
    g.cyl('steeld', (hx, PY - 0.03, hz - 0.02), (hx, PY - 0.032, hz - 0.02), 0.0095, seg=20)
    # 左右の取っ手（クロメートの金具＋灰色の握り。下の端は丸い）
    for s in (-1, 1):
        x = s * (W / 2 + 0.012)
        for z in (0.33, 0.46):
            g.box('chrom', x - 0.012, x + 0.012, PY - 0.035, FY + 0.02, z - 0.018, z + 0.018, bev=0.002)
        g.cyl('grip', (x, PY - 0.045, 0.30), (x, PY - 0.045, 0.485), 0.016, seg=24, bev=0.002)
        g.sphere('grip', (x, PY - 0.045, 0.485), 0.016, u=20, v=10)
        g.lathe('grip', (x, PY - 0.045, 0.30), (0, 0, -1), [(0.0, 0.0), (0.0, 0.016), (0.006, 0.019), (0.018, 0.019), (0.024, 0.012), (0.025, 0.0)], seg=24)
        g.cyl('black', (x, PY - 0.045, 0.275), (x, PY - 0.045, 0.272), 0.008, seg=16)
    # 下：インタロックの板（クロメート、角穴）と、台枠・レール・車輪
    g.box('chrom', -0.07, 0.07, PY - 0.03, PY + 0.002, B0 + 0.0, B0 + 0.045, bev=0.002)
    g.box('black', -0.012, 0.012, PY - 0.0305, PY - 0.029, B0 + 0.012, B0 + 0.03, bev=0.0)
    g.box('chrom', -0.07, 0.07, PY - 0.06, PY - 0.03, B0 + 0.04, B0 + 0.045, bev=0.001)
    for s in (-1, 1):
        g.box('chrom', s * (W / 2 - 0.02) - 0.02, s * (W / 2 - 0.02) + 0.02, FY - 0.01, D / 2, 0.012, B0, bev=0.003)
        for y in (FY + 0.06, D / 2 - 0.06):
            g.cyl('rubber', (s * (W / 2 - 0.045), y, 0.024), (s * (W / 2 - 0.065), y, 0.024), 0.024, seg=24, bev=0.002)
    g.box('chrom', -W / 2 + 0.02, W / 2 - 0.02, FY - 0.01, FY + 0.02, 0.012, B0, bev=0.003)
    # ねじ（前板の四隅・上の札の上）
    for (x, z) in ((-W / 2 + 0.03, B0 + 0.035), (W / 2 - 0.03, B0 + 0.035), (-W / 2 + 0.03, H - 0.035), (W / 2 - 0.03, H - 0.035), (0.02, H - 0.025)):
        g.bolt('steel', (x, PY + 0.001, z), (0, -1, 0), s=0.006, washer=True)
    # 前面のデカール（文字・ラベル。three.js 側で Canvas を貼る。UV は前板全体で 0〜1）
    g.quad('vlabel', (-W / 2 + 0.012, PY - 0.0019, B0 + 0.018), (W - 0.024, 0, 0), (0, 0, H - 0.012 - B0 - 0.018), uv=(0, 0, 1, 1), cls='decal')

objs = g.finalize(mats)
log('objects', len(objs), 'tris', g.tris)
for ob in objs:
    if ob['cls'] in ('big', 'small', 'glass'):
        md = ob.modifiers.new('wn', 'WEIGHTED_NORMAL'); md.keep_sharp = True; md.weight = 60; md.mode = 'FACE_AREA'
        bpy.context.view_layer.objects.active = ob; ob.select_set(True); bpy.ops.object.modifier_apply(modifier='wn'); ob.select_set(False)

bigs = [o for o in objs if o['cls'] == 'big']; smalls = [o for o in objs if o['cls'] == 'small']
if '--noao' not in ARGS:
    import xatlas
    atlas = xatlas.Atlas(); meta = []
    for ob in bigs:
        me = ob.data; me.calc_loop_triangles(); nt = len(me.loop_triangles)
        tl = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get('loops', tl)
        vi = np.empty(len(me.loops), np.int32); me.loops.foreach_get('vertex_index', vi)
        co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
        atlas.add_mesh(co, vi[tl].reshape(-1, 3).astype(np.uint32)); meta.append((ob, tl.reshape(-1, 3)))
    co_ = xatlas.ChartOptions(); co_.max_iterations = 1
    po = xatlas.PackOptions(); po.resolution = AO_SIZE; po.padding = 3; po.bilinear = True
    atlas.generate(co_, po); log('xatlas', atlas.chart_count, 'charts')
    for i, (ob, tl) in enumerate(meta):
        vmap, idx, uvs = atlas[i]; me = ob.data
        if not me.uv_layers: me.uv_layers.new(name='UV0')
        layer = me.uv_layers.new(name='LM'); uv = np.zeros((len(me.loops), 2), np.float32); uv[tl.ravel()] = uvs[idx.ravel()]; layer.data.foreach_set('uv', uv.ravel())
    w = bpy.data.worlds.new('w'); sc.world = w
    try: w.light_settings.distance = 0.12
    except Exception as e: log('ao dist', e)
    bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, 0)); floor = bpy.context.object
    sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = False
    sc.render.bake.margin = 6; sc.render.bake.use_clear = True; sc.render.bake.use_selected_to_active = False
    img = bpy.data.images.new('AO', AO_SIZE, AO_SIZE, alpha=False); img.colorspace_settings.name = 'Non-Color'; img.generated_color = (1, 1, 1, 1)
    for m in MATS.values():
        nt = m.node_tree; nd = nt.nodes.new('ShaderNodeTexImage'); nd.name = '_bake'; nd.image = img; nt.nodes.active = nd
    bpy.ops.object.select_all(action='DESELECT')
    for ob in bigs:
        ob.data.uv_layers.active = ob.data.uv_layers['LM']; ob.data.uv_layers['LM'].active_render = True; ob.select_set(True)
    bpy.context.view_layer.objects.active = bigs[0]
    sc.render.bake.target = 'IMAGE_TEXTURES'; log('bake AO...'); bpy.ops.object.bake(type='AO')
    img.filepath_raw = os.path.join(OUT, 'ao.png'); img.file_format = 'PNG'; img.save(); log('AO saved')
    if smalls:
        bpy.ops.object.select_all(action='DESELECT')
        for ob in smalls:
            ca = ob.data.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER'); ob.data.color_attributes.active_color = ca; ob.data.color_attributes.render_color_index = 0; ob.select_set(True)
        bpy.context.view_layer.objects.active = smalls[0]
        sc.render.bake.target = 'VERTEX_COLORS'; bpy.ops.object.bake(type='AO'); log('vertex AO done')
    bpy.data.objects.remove(floor)
    for m in MATS.values(): m.node_tree.nodes.remove(m.node_tree.nodes['_bake'])
    for ob in bigs: ob.data.uv_layers.active = ob.data.uv_layers[0]; ob.data.uv_layers[0].active_render = True

bpy.ops.object.select_all(action='DESELECT')
path = os.path.join(OUT, 'vcb.glb')
kw = dict(filepath=path, export_format='GLB', export_yup=True, export_apply=False, export_texcoords=True, export_normals=True, export_materials='EXPORT', export_cameras=False, export_lights=False, export_animations=False)
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
for k, v in (('export_vertex_color', 'ACTIVE'), ('export_all_vertex_colors', False), ('export_active_vertex_color_when_no_material', True), ('export_image_format', 'NONE'), ('export_tangents', False), ('export_extras', False)):
    if k in props: kw[k] = v
bpy.ops.export_scene.gltf(**kw)
log('exported', path, os.path.getsize(path) // 1024, 'KB')
