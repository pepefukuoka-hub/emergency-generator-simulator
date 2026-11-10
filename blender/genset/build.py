# build.py — 発電機モデルを作り、AO を焼いて、GLB に書き出す
#   使い方: python build.py [--test] [--noao] [--ao-size 2048] [--samples 48]
import bpy, bmesh, sys, os, math, json, time
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import gb
from gb import GB

ARGS = sys.argv[1:]
def arg(name, default=None, cast=str):
    return cast(ARGS[ARGS.index(name) + 1]) if name in ARGS else default
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
AO_SIZE = arg('--ao-size', 2048, int); SAMPLES = arg('--samples', 48, int)
t0 = time.time()
def log(*a): print(f"[{time.time() - t0:6.1f}s]", *a, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module='cycles')
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'

MATS = {}
def material(name):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name); m.use_nodes = True
    MATS[name] = m; return m
class MatDict(dict):
    def __missing__(self, k): self[k] = material(k); return self[k]
mats = MatDict()

g = GB()
if '--test' in ARGS:
    g.box('paint_eng', -0.5, 0.5, -0.3, 0.3, 0.2, 0.8, bev=0.01)
    g.cylx('paint_eng', -0.8, 0.8, 0, 0.5, 0.2, seg=24, bev=0.005)
    g.tube('paint_eng', [(0, 0.4, 0.2), (0, 0.4, 1.0), (0.5, 0.4, 1.0)], 0.03, fillet=0.08, cls='small')
    g.bolts_circle('steel', (0.5, 0, 0.5), (1, 0, 0), 0.25, 8)
    g.quad('perf', (-0.5, -0.6, 0), (1, 0, 0), (0, 0, 1))
    with g.use(group='static'): g.box('paint_sheet', -1, 1, -1, 1, 0.0, 0.1)
else:
    import model
    model.build(g)
objs = g.finalize(mats)
log('objects', len(objs), 'tris', g.tris)

# ---- 面の重みつき法線（面取りを丸く見せる） ----
bpy.ops.object.select_all(action='DESELECT')
for ob in objs:
    if ob['cls'] in ('big', 'small'):
        md = ob.modifiers.new('wn', 'WEIGHTED_NORMAL'); md.keep_sharp = True; md.weight = 60; md.mode = 'FACE_AREA'
        bpy.context.view_layer.objects.active = ob; ob.select_set(True)
        bpy.ops.object.modifier_apply(modifier='wn'); ob.select_set(False)
log('weighted normals done')

# ---- UV ----
for ob in objs:
    if ob['cls'] == 'big': gb.add_tile_uv(ob.data, 'TILE')
bigs = [o for o in objs if o['cls'] == 'big']; smalls = [o for o in objs if o['cls'] == 'small']

if '--noao' not in ARGS and bigs:
    import xatlas
    atlas = xatlas.Atlas(); meta = []
    for ob in bigs:
        me = ob.data; me.calc_loop_triangles()
        nt = len(me.loop_triangles)
        tl = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get('loops', tl)
        vi = np.empty(len(me.loops), np.int32); me.loops.foreach_get('vertex_index', vi)
        co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
        # ワールド座標（親は原点なのでそのまま）。角ごとの法線も渡して、面取りで島が割れすぎないようにする
        atlas.add_mesh(co, vi[tl].reshape(-1, 3).astype(np.uint32))
        meta.append((ob, tl.reshape(-1, 3)))
    co_ = xatlas.ChartOptions(); co_.max_iterations = 1; co_.normal_deviation_weight = 1.0
    po = xatlas.PackOptions(); po.resolution = AO_SIZE; po.padding = 3; po.bilinear = True; po.blockAlign = False; po.bruteForce = False
    log('xatlas generate...')
    atlas.generate(co_, po)
    log('xatlas done', atlas.width, atlas.height, 'charts', atlas.chart_count)
    for i, (ob, tl) in enumerate(meta):
        vmap, idx, uvs = atlas[i]
        me = ob.data; layer = me.uv_layers.new(name='LM')
        uv = np.zeros((len(me.loops), 2), np.float32)
        uv[tl.ravel()] = uvs[idx.ravel()]
        layer.data.foreach_set('uv', uv.ravel())

    # ---- AO を焼く ----
    w = bpy.data.worlds.new('w'); sc.world = w
    try: w.light_settings.distance = 0.9
    except Exception as e: log('ao dist', e)
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0)); floor = bpy.context.object; floor.name = '_floor'
    sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = False
    sc.render.bake.margin = 6; sc.render.bake.use_clear = True; sc.render.bake.use_selected_to_active = False
    img = bpy.data.images.new('AO', AO_SIZE, AO_SIZE, alpha=False); img.colorspace_settings.name = 'Non-Color'
    img.generated_color = (1, 1, 1, 1)
    for m in MATS.values():
        nt = m.node_tree; nd = nt.nodes.new('ShaderNodeTexImage'); nd.name = '_bake'; nd.image = img; nt.nodes.active = nd
    bpy.ops.object.select_all(action='DESELECT')
    for ob in bigs:
        ob.data.uv_layers.active = ob.data.uv_layers['LM']; ob.data.uv_layers['LM'].active_render = True; ob.select_set(True)
    bpy.context.view_layer.objects.active = bigs[0]
    log('bake AO texture...')
    sc.render.bake.target = 'IMAGE_TEXTURES'
    bpy.ops.object.bake(type='AO')
    img.filepath_raw = os.path.join(OUT, 'ao.png'); img.file_format = 'PNG'; img.save()
    log('AO texture saved')
    if smalls:
        bpy.ops.object.select_all(action='DESELECT')
        for ob in smalls:
            ca = ob.data.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER'); ob.data.color_attributes.active_color = ca; ob.data.color_attributes.render_color_index = 0
            ob.select_set(True)
        bpy.context.view_layer.objects.active = smalls[0]
        sc.render.bake.target = 'VERTEX_COLORS'; sc.cycles.samples = max(16, SAMPLES // 2)
        log('bake AO vertex colors...')
        bpy.ops.object.bake(type='AO')
        log('vertex AO done')
    bpy.data.objects.remove(floor)
    for m in MATS.values():
        nt = m.node_tree; nt.nodes.remove(nt.nodes['_bake'])
    for ob in bigs:
        ob.data.uv_layers.active = ob.data.uv_layers['TILE']; ob.data.uv_layers['TILE'].active_render = True

# ---- 書き出し ----
bpy.ops.object.select_all(action='DESELECT')
path = os.path.join(OUT, 'genset_raw.glb')
kw = dict(filepath=path, export_format='GLB', export_yup=True, export_apply=False, export_texcoords=True, export_normals=True, export_materials='EXPORT', export_cameras=False, export_lights=False, export_animations=False)
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
for k, v in (('export_vertex_color', 'ACTIVE'), ('export_all_vertex_colors', False), ('export_active_vertex_color_when_no_material', True), ('export_image_format', 'NONE'), ('export_tangents', False), ('export_extras', False)):
    if k in props: kw[k] = v
bpy.ops.export_scene.gltf(**kw)
log('exported', path, os.path.getsize(path) // 1024, 'KB')
json.dump({'tris': g.tris, 'objects': [o.name for o in objs]}, open(os.path.join(OUT, 'stats.json'), 'w'), ensure_ascii=False, indent=1)
