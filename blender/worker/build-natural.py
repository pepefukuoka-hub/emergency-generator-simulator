# 作業員（白い保護帽とグレーの作業服）を作る Blender スクリプト。
# 体のメッシュ・体型の差分・骨・ウェイト・目は、MakeHuman / MPFB の CC0 データを「データとして」読むだけ（MPFB のプログラムは実行しない）。
# 服・帽子・靴・髪は、体のヘルパー形状（helper-tights / helper-hair）と足の形から、このスクリプトで作る。
# 使い方： python build.py <MPFBのdataフォルダ> <MakeHumanのdataフォルダ> <出力フォルダ> [preview]
# 架空の人物。実在の人の写真・顔・名前・所属・ロゴは使わない。
import bpy, bmesh, sys, gzip, json, math, os
import numpy as np
from mathutils import Vector, Matrix

MP, MH, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
PREVIEW = len(sys.argv) > 4
os.makedirs(OUT, exist_ok=True)

# ---------- 1. 基本メッシュ（obj）を読む ----------
V, UV, F = [], [], []           # F: (頂点番号[], uv番号[], グループ名)
grp = ''
for line in open(MP + '/3dobjs/base.obj'):
    if line.startswith('v '): V.append([float(x) for x in line.split()[1:4]])
    elif line.startswith('vt '): UV.append([float(x) for x in line.split()[1:3]])
    elif line.startswith('g '): grp = line.split()[1]
    elif line.startswith('f '):
        p = [q.split('/') for q in line.split()[1:]]
        F.append(([int(q[0]) - 1 for q in p], [int(q[1]) - 1 for q in p], grp))
V = np.array(V); UV = np.array(UV)

# ---------- 2. 体型：成人男性・平均の体格（差分ファイルを足すだけ） ----------
def target(name, w=1.0):
    for line in gzip.open(MP + '/targets/' + name + '.target.gz', 'rt'):
        p = line.split()
        if len(p) == 4: V[int(p[0])] += w * np.array([float(p[1]), float(p[2]), float(p[3])])
target('macrodetails/asian-male-young'); target('macrodetails/universal-male-young-averagemuscle-averageweight')

# 座標：obj は Y が上・Z が前・単位 dm。Blender は Z が上・−Y が前・単位 m にする。足の裏を 0、身長を 1.70m に合わせる
body_idx = sorted({i for f in F if f[2] == 'body' for i in f[0]})
P = np.stack([V[:, 0], -V[:, 2], V[:, 1]], 1) * 0.1
P[:, 2] -= P[body_idx, 2].min()
P *= 1.70 / P[body_idx, 2].max()

groups = {}
for f in F: groups.setdefault(f[2], []).append(f)
def cube(name): idx = sorted({i for f in groups[name] for i in f[0]}); return P[idx].mean(0)

# ---------- 3. 骨とウェイト ----------
RIG = json.load(open(MP + '/rigs/standard/rig.game_engine.json'))
W = json.load(open(MP + '/rigs/standard/weights.game_engine.json'))['weights']
def joint(d): return cube(d['cube_name']) if d['strategy'] == 'CUBE' else P[d['vertex_indices']].mean(0)
wt = {}                         # 頂点 → [(骨, 重み)]
for b, lst in W.items():
    for i, w in lst: wt.setdefault(i, []).append((b, w))
def wsum(i, names): return sum(w for b, w in wt.get(i, []) if any(b.startswith(n) for n in names))

for o in list(bpy.data.objects): bpy.data.objects.remove(o)
arm_data = bpy.data.armatures.new('rig'); ARM = bpy.data.objects.new('worker', arm_data); bpy.context.collection.objects.link(ARM)
bpy.context.view_layer.objects.active = ARM; bpy.ops.object.mode_set(mode='EDIT')
for name, d in RIG.items():
    eb = arm_data.edit_bones.new(name); eb.head = Vector(joint(d['head'])); eb.tail = Vector(joint(d['tail'])); eb.roll = d['roll']
for name, d in RIG.items():
    if d['parent']: arm_data.edit_bones[name].parent = arm_data.edit_bones[d['parent']]
bpy.ops.object.mode_set(mode='OBJECT')

MATS = {}
def mat(name, col, rough=0.8):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; MATS[name] = m; return m

def make(name, faces, material, pos=None, rigid=None, uv=True):
    # faces: [(頂点番号[], uv番号[])]。頂点は元の番号のまま使い、ウェイトを引き継ぐ
    used = sorted({i for f in faces for i in f[0]}); remap = {v: k for k, v in enumerate(used)}
    me = bpy.data.meshes.new(name); me.from_pydata([tuple((pos if pos is not None else P)[i]) for i in used], [], [[remap[i] for i in f[0]] for f in faces]); me.update()
    if uv:
        layer = me.uv_layers.new(name='UVMap'); k = 0
        for f in faces:
            for u in f[1]: layer.data[k].uv = UV[u]; k += 1
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); me.materials.append(material)
    for p in me.polygons: p.use_smooth = True
    vg = {}
    for i in used:
        for b, w in ([(rigid, 1.0)] if rigid else wt.get(i, [])):
            if b not in vg: vg[b] = ob.vertex_groups.new(name=b)
            vg[b].add([remap[i]], w, 'REPLACE')
    ob.parent = ARM; md = ob.modifiers.new('arm', 'ARMATURE'); md.object = ARM
    ob['src'] = used
    return ob

def vnormals(faces):
    n = np.zeros_like(P)
    for f in faces:
        a = P[f[0]]; c = np.cross(a[1] - a[0], a[2] - a[0])
        for i in f[0]: n[i] += c
    l = np.linalg.norm(n, axis=1); l[l == 0] = 1; return n / l[:, None]
def smooth(pos, faces, it, k=0.5, lock=None):
    nb = {}
    for f in faces:
        v = f[0]
        for a in range(len(v)): nb.setdefault(v[a], set()).update((v[a - 1], v[(a + 1) % len(v)]))
    for _ in range(it):
        new = pos.copy()
        for i, s in nb.items():
            if lock is not None and lock[i]: continue
            new[i] = pos[i] * (1 - k) + pos[list(s)].mean(0) * k
        pos = new
    return pos

def smooth_edge(pos, cnt, it=8):       # 開いた縁の輪だけを、輪にそってならす（ぎざぎざを消す）
    nb = {}
    for (a, b), c in cnt.items():
        if c == 1: nb.setdefault(a, []).append(b); nb.setdefault(b, []).append(a)
    for _ in range(it):
        new = pos.copy()
        for i, l in nb.items(): new[i] = pos[i] * 0.4 + pos[l].mean(0) * 0.6
        pos = new
    return pos
def edge_count(faces):
    cnt = {}
    for f in faces:
        v = f[0]
        for a in range(len(v)): e = tuple(sorted((v[a], v[(a + 1) % len(v)]))); cnt[e] = cnt.get(e, 0) + 1
    return cnt

# ---------- 4. 肌（頭・首・手だけ残す。服の下は消す） ----------
keep = {i for i in body_idx if wsum(i, ['head', 'neck']) > 0.08 or wsum(i, ['hand', 'thumb', 'index', 'middle', 'ring', 'pinky']) > 0.04}
SKIN = make('skin', [f for f in groups['body'] if all(i in keep for i in f[0])], mat('skin', (0.72, 0.52, 0.40), 0.55))

# 目（MakeHuman の low-poly の目：頂点は基本メッシュの目のヘルパーと1対1）
eo = MH + '/eyes/low-poly/'
ev, euv, ef = [], [], []
order = []; on = False
for line in open(eo + 'low-poly.mhclo'):
    s = line.strip()
    if s.startswith('verts'): on = True; continue
    if on and s.isdigit(): order.append(int(s))
    elif on and s and not s.isdigit(): on = False
for line in open(eo + 'low-poly.obj'):
    if line.startswith('vt '): euv.append([float(x) for x in line.split()[1:3]])
    elif line.startswith('f '):
        p = [q.split('/') for q in line.split()[1:]]; ef.append(([order[int(q[0]) - 1] for q in p], [int(q[1]) - 1 for q in p]))
UV0 = UV; UV = np.array(euv)
EYES = make('eyes', ef, mat('eye', (0.9, 0.9, 0.88), 0.25), rigid='head'); UV = UV0

# ---------- 5. 服：全身のヘルパー（helper-tights）をふくらませて、上着とズボンにする ----------
TF = groups['helper-tights']; N = vnormals(TF)
tid = sorted({i for f in TF for i in f[0]})
waist = cube('joint-pelvis')[2] + 0.085           # ベルトの高さ（推測：骨盤の関節の少し上）
neckz = cube('joint-neck')[2]
def cloth(sel, puff, it, loose):
    pos = P.copy(); faces = [f for f in TF if all(sel(i) for i in f[0])]
    ids = sorted({i for f in faces for i in f[0]})
    cnt = {}
    for f in faces:
        v = f[0]
        for a in range(len(v)): e = tuple(sorted((v[a], v[(a + 1) % len(v)]))); cnt[e] = cnt.get(e, 0) + 1
    edge = np.zeros(len(P), bool)
    for e, c in cnt.items():
        if c == 1: edge[list(e)] = True
    for i in ids: pos[i] = P[i] + N[i] * puff(i)
    pos = smooth(pos, faces, it, 0.55, edge)             # 筋肉の凹凸を消して、布の面にする
    for i in ids: pos[i] += N[i] * loose(i)
    pos = smooth_edge(pos, cnt)
    return faces, pos, edge, ids
arm_w = lambda i: wsum(i, ['upperarm', 'lowerarm', 'hand'])
leg_w = lambda i: wsum(i, ['thigh', 'calf', 'foot', 'ball'])
# 上着：すそはベルトより 11cm 下まで。胴はゆったり、そでは少しゆったり
jf, jp, je, jid = cloth(lambda i: P[i, 2] > waist - 0.06 and wsum(i, ['hand', 'thumb', 'index', 'middle', 'ring', 'pinky']) < 0.55 and P[i, 2] < neckz + 0.012,
                   lambda i: 0.012, 6, lambda i: 0.020 if arm_w(i) > 0.5 else 0.032 + 0.020 * max(0, min(1, (waist + 0.12 - P[i, 2]) / 0.2)))
# Work jacket hangs from the shoulders instead of following the body's waist.
for i in jid:
    if arm_w(i) < 0.2 and jp[i, 2] < neckz - 0.12:
        z = jp[i, 2]
        fill = math.exp(-((z - waist - 0.12) / 0.15) ** 2)
        jp[i, 0] *= 1 + 0.20 * fill
        jp[i, 1] *= 1 + 0.16 * fill
        # Gather the bottom hem slightly, like a blouson waistband.
        hem = math.exp(-((z - waist + 0.105) / 0.045) ** 2)
        jp[i, :2] *= 1 - 0.09 * hem
# ズボン：ベルトの高さから足首まで
ankle = cube('joint-l-ankle')[2]
pf, pp, pe, pid = cloth(lambda i: P[i, 2] < waist + 0.02 and P[i, 2] > ankle - 0.035, lambda i: 0.01, 5, lambda i: 0.012 + 0.014 * max(0, min(1, (0.5 - P[i, 2]) / 0.45)))

# 布のしわ（ひじ・ひざ・わき・またの周りに、法線方向の小さな波。形は推測）
def wrinkle(pos, faces, spots, amp):
    ids = sorted({i for f in faces for i in f[0]}); n = N
    for i in ids:
        a = 0.0
        for c, r, ax, fq in spots:
            d = np.linalg.norm(P[i] - c)
            if d < r: a += (1 - d / r) ** 1.5 * math.sin((P[i] - c).dot(ax) * fq)
        h = math.sin(P[i, 2] * 61 + P[i, 0] * 37) * math.sin(P[i, 0] * 53 - P[i, 1] * 47)
        pos[i] += n[i] * (a * amp + h * amp * 0.22)
    return pos
Z = np.array([0, 0, 1.0]); X = np.array([1.0, 0, 0])
spots_j = [(cube('joint-l-elbow'), 0.13, X * 0.6 + Z * 0.8, 95), (cube('joint-r-elbow'), 0.13, -X * 0.6 + Z * 0.8, 95), (cube('joint-l-shoulder') - Z * 0.07, 0.12, Z, 80), (cube('joint-r-shoulder') - Z * 0.07, 0.12, Z, 80), (np.array([0, 0, waist + 0.03]), 0.2, Z, 90)]
spots_p = [(cube('joint-l-knee'), 0.16, Z, 85), (cube('joint-r-knee'), 0.16, Z, 85), (cube('joint-pelvis') - Z * 0.06, 0.17, X, 70), (cube('joint-l-ankle') + Z * 0.08, 0.13, Z, 110), (cube('joint-r-ankle') + Z * 0.08, 0.13, Z, 110)]
for i in jid:
    z = jp[i, 2]; lower = math.exp(-((z - waist - 0.025) / 0.095) ** 2)
    if arm_w(i) < 0.25:
        jp[i] += N[i] * (0.009 * lower * math.sin(jp[i, 0] * 42 + z * 22))
jp = wrinkle(jp, jf, spots_j, 0.0055); pp = wrinkle(pp, pf, spots_p, 0.0045)
# 縁をまっすぐにそろえる（すそ・ウエスト・ズボンのすそ）
for i in jid:
    if je[i] and jp[i, 2] < waist: jp[i, 2] = waist - 0.055
for i in pid:
    if pe[i]: pp[i, 2] = waist + 0.012 if pp[i, 2] > waist - 0.1 else ankle - 0.03

GREY = (0.32, 0.35, 0.38); GREY_D = (0.27, 0.30, 0.33)
JACKET = make('jacket', jf, mat('cloth', GREY, 0.85), jp)
PANTS = make('pants', pf, mat('cloth', GREY, 0.85), pp)

def thicken(ob, t):   # 開いた縁（そで口・すそ・えり）に、内側への折り返しを付けて厚みを見せる
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.normal_update()
    be = [e for e in bm.edges if e.is_boundary]
    r = bmesh.ops.extrude_edge_only(bm, edges=be)
    for v in [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]: v.co -= v.normal * t
    bm.normal_update(); bm.to_mesh(ob.data); bm.free()
    # 新しい頂点のウェイトは、いちばん近い元の頂点から写す
    me = ob.data; n0 = len(ob['src']); co = np.array([v.co for v in me.vertices])
    for k in range(n0, len(co)):
        j = int(np.argmin(((co[:n0] - co[k]) ** 2).sum(1)))
        for g in me.vertices[j].groups: ob.vertex_groups[g.group].add([k], g.weight, 'REPLACE')
thicken(JACKET, 0.009); thicken(PANTS, 0.008)

# 小物（えり・前立て・ボタン・胸ポケット・ベルト）：上着の面にそわせて置き、ウェイトは上着・ズボンから写す
def from_bm(name, bm, material, src):
    me = bpy.data.meshes.new(name); bm.normal_update(); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); me.materials.append(material)
    for p in me.polygons: p.use_smooth = True
    sm = src.data; sco = np.array([v.co for v in sm.vertices])
    for k, v in enumerate(me.vertices):
        j = int(np.argmin(((sco - np.array(v.co)) ** 2).sum(1)))
        for g in sm.vertices[j].groups:
            nm = src.vertex_groups[g.group].name
            (ob.vertex_groups.get(nm) or ob.vertex_groups.new(name=nm)).add([k], g.weight, 'REPLACE')
    ob.parent = ARM; md = ob.modifiers.new('arm', 'ARMATURE'); md.object = ARM
    return ob
from mathutils.bvhtree import BVHTree
jbvh = BVHTree.FromPolygons([tuple(v.co) for v in JACKET.data.vertices], [tuple(p.vertices) for p in JACKET.data.polygons])
def on_jacket(x, z, off=0.0):       # 上着の前面の点：前（−Y）から光線を当てる（＋法線方向に off）
    hit, n, _, _ = jbvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))
    if n.y > 0: n = -n
    return hit + n * off, n
def patch(bm, x0, x1, z0, z1, off, nx=4, nz=4):
    x0, x1 = min(x0, x1), max(x0, x1); rows = []
    for a in range(nz + 1):
        row = []
        for b in range(nx + 1):
            p, _ = on_jacket(x0 + (x1 - x0) * b / nx, z0 + (z1 - z0) * a / nz, off); row.append(bm.verts.new(p))
        rows.append(row)
    for a in range(nz):
        for b in range(nx): bm.faces.new((rows[a][b], rows[a][b + 1], rows[a + 1][b + 1], rows[a + 1][b]))
chest = cube('joint-spine-2')[2]
bm = bmesh.new()
patch(bm, -0.017, 0.017, waist - 0.05, neckz - 0.02, 0.005, 2, 22)                      # 前立て
for sx in (-1, 1):
    patch(bm, sx * 0.055, sx * 0.145, chest + 0.035, chest + 0.135, 0.0045)              # 胸ポケット
    patch(bm, sx * 0.05, sx * 0.15, chest + 0.118, chest + 0.15, 0.008, 4, 2)            # ポケットのふた
DETAIL = from_bm('jacket_detail', bm, mat('cloth_d', GREY_D, 0.85), JACKET)
bm = bmesh.new()
btn = [(0.0, z) for z in np.linspace(waist - 0.035, neckz - 0.05, 5)] + [(-0.1, chest + 0.134), (0.1, chest + 0.134)]
for x, z in btn:
    p, n = on_jacket(x, z, 0.0075); r = bmesh.ops.create_circle(bm, cap_ends=True, radius=0.0075, segments=10)
    q = Vector((0, 0, 1)).rotation_difference(n).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(p) @ q, verts=r['verts'])
BUTTONS = from_bm('buttons', bm, mat('button', (0.12, 0.125, 0.13), 0.5), JACKET)

# えり（折りえり）：上着の首の縁の輪から作る
pts = [Vector(jp[i]) for i in jid if je[i] and jp[i, 2] > neckz - 0.06 and abs(jp[i, 0]) < 0.13]
c = sum(pts, Vector()) / len(pts)
pts.sort(key=lambda p: math.atan2(p.x - c.x, -(p.y - c.y)))        # 前の中心から一周
bm = bmesh.new(); rings = []
# 輪の高さと半径をならす
for _ in range(6): pts = [(pts[k - 1] + pts[k] * 2 + pts[(k + 1) % len(pts)]) / 4 for k in range(len(pts))]
for k, (up, out) in enumerate([(-0.004, 0.003), (0.014, 0.004), (0.017, 0.010), (-0.020, 0.04)]):
    ring = []
    for p in pts:
        d = Vector((p.x - c.x, p.y - c.y, 0)).normalized(); front = max(0.0, -d.y)
        open_ = 1 - 0.75 * front ** 6 if k < 2 else 1                                     # 前は少し開ける
        ring.append(bm.verts.new(p + d * out + Vector((0, 0, up * (open_ if k else 1) + (0.0 if k < 3 else -0.048 * front ** 3)))))
    rings.append(ring)
for a in range(3):
    for b in range(len(pts)):
        b2 = (b + 1) % len(pts)
        if abs(pts[b].x) < 0.012 and abs(pts[b2].x) < 0.012 and pts[b].y < c.y: continue     # 前の合わせ目は切る
        bm.faces.new((rings[a][b], rings[a][b2], rings[a + 1][b2], rings[a + 1][b]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
COLLAR = from_bm('collar', bm, mat('cloth', GREY, 0.85), JACKET)

# ベルト：ズボンの上の縁の輪から
loop = [Vector(pp[i]) for i in pid if pe[i] and pp[i, 2] > waist - 0.05]
c = sum(loop, Vector()) / len(loop); loop.sort(key=lambda p: math.atan2(p.x - c.x, -(p.y - c.y)))
bm = bmesh.new(); rings = []
for dz, out in [(-0.045, 0.004), (-0.045, 0.009), (-0.007, 0.009), (-0.007, 0.004)]:
    rings.append([bm.verts.new(Vector((p.x, p.y, waist + dz)) + Vector((p.x - c.x, p.y - c.y, 0)).normalized() * out) for p in loop])
for a in range(3):
    for b in range(len(loop)): b2 = (b + 1) % len(loop); bm.faces.new((rings[a][b], rings[a][b2], rings[a + 1][b2], rings[a + 1][b]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
BELT = from_bm('belt', bm, mat('belt', (0.035, 0.035, 0.04), 0.6), PANTS)
bm = bmesh.new(); front = min(loop, key=lambda p: p.y)
r = bmesh.ops.create_cube(bm, size=1); bmesh.ops.transform(bm, matrix=Matrix.Translation((0, front.y - 0.012, waist - 0.026)) @ Matrix.Diagonal((0.05, 0.008, 0.042, 1)), verts=r['verts'])
BUCKLE = from_bm('buckle', bm, mat('metal', (0.6, 0.6, 0.6), 0.35), PANTS); MATS['metal'].node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = 1

# ---------- 6. 靴（足の形の凸包をふくらませて、底を付ける。安全靴ふう。形は推測） ----------
def shoe(side):
    names = ['foot_' + side, 'ball_' + side]
    ids = [i for i in body_idx if wsum(i, names) > 0.5 and P[i, 2] < ankle + 0.07]
    bm = bmesh.new(); vs = [bm.verts.new(P[i] + np.array([0, 0, 0.012])) for i in ids]
    bmesh.ops.convex_hull(bm, input=vs)
    for v in list(bm.verts):
        if not v.link_faces: bm.verts.remove(v)
    cen = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
    for v in bm.verts:
        d = v.co - cen; v.co = cen + Vector((d.x * 1.13, d.y * 1.06, d.z * 1.05))
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
    bmesh.ops.smooth_vert(bm, verts=bm.verts[:], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    for v in bm.verts: v.co.z = max(v.co.z, 0.022)
    # 底
    low = [v for v in bm.verts if v.co.z < 0.03]
    for v in low: v.co.z = 0.022
    me = bpy.data.meshes.new('shoe'); bm.normal_update(); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('shoe_' + side, me); bpy.context.collection.objects.link(ob); me.materials.append(mat('boot', (0.03, 0.03, 0.033), 0.45))
    for p in me.polygons: p.use_smooth = True
    g1 = ob.vertex_groups.new(name='foot_' + side); g2 = ob.vertex_groups.new(name='ball_' + side)
    toe = cube('joint-%s-foot-1' % side)[1]
    for v in ob.data.vertices:
        t = max(0.0, min(1.0, (toe - v.co.y) / 0.03 + 0.5)) if v.co.z < 0.07 else 0.0
        g1.add([v.index], 1 - t, 'REPLACE'); g2.add([v.index], t, 'REPLACE')
    ob.parent = ARM; md = ob.modifiers.new('arm', 'ARMATURE'); md.object = ARM
    # 靴底（黒いゴムの板）
    co = np.array([v.co for v in ob.data.vertices]); lo = co[co[:, 2] < 0.03]
    bm = bmesh.new(); hull = bmesh.ops.convex_hull(bm, input=[bm.verts.new((p[0], p[1], 0)) for p in lo] + [bm.verts.new((p[0], p[1], 0.024)) for p in lo])
    for v in list(bm.verts):
        if not v.link_faces: bm.verts.remove(v)
    c2 = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
    for v in bm.verts: v.co.x = c2.x + (v.co.x - c2.x) * 1.05; v.co.y = c2.y + (v.co.y - c2.y) * 1.02
    return ob, from_bm('sole_' + side, bm, mat('sole', (0.015, 0.015, 0.015), 0.8), ob)
SHOES = [shoe('l'), shoe('r')]

# ---------- 7. 帽子と髪：頭のヘルパー（helper-hair）から ----------
BF = groups['body']; BN = vnormals(BF)
eye = (cube('joint-l-eye') + cube('joint-r-eye')) / 2
hid = [i for i in body_idx if wsum(i, ['head']) > 0.5]
top = P[hid, 2].max(); ymin, ymax = P[hid, 1].min(), P[hid, 1].max()
back = lambda i: max(0.0, min(1.0, (P[i, 1] - (eye[1] + 0.03)) / (ymax - eye[1] - 0.03)))      # 0＝前、1＝後ろ
capz = lambda i: eye[2] + 0.047 - 0.035 * back(i)                                              # 帽子の下の縁（後ろ下がり）
hairz = lambda i: eye[2] + 0.026 - 0.115 * max(0.0, (back(i) - 0.42) / 0.58)                    # 髪の下の縁（耳の上、後ろはえり足まで）
def scalp(sel, puff, it):
    faces = [f for f in BF if all(i in hset and sel(i) for i in f[0])]; pos = P.copy()
    for i in {i for f in faces for i in f[0]}: pos[i] = P[i] + BN[i] * puff(i)
    return faces, smooth_edge(smooth(pos, faces, it, 0.5), edge_count(faces), 10)
hset = set(hid)
hf, hp = scalp(lambda i: P[i, 2] > hairz(i) and back(i) > 0.16, lambda i: 0.0035, 1)
HAIR = make('hair', hf, mat('hair', (0.02, 0.018, 0.016), 0.6), hp, rigid='head')
# Smooth protective helmet: elliptical shell with a rolled rim and short front peak.
# Reference informs clothing silhouette only; dimensions are approximate.
bm = bmesh.new(); rings = []; segments = 64
cy = (ymin + ymax) / 2 + 0.012
basez = eye[2] + 0.047
for j in range(25):
    angle = (j / 24) * math.pi / 2
    rr = max(0.001, math.cos(angle))
    row = []
    for k in range(segments):
        t = k * math.tau / segments
        row.append(bm.verts.new((0.103 * rr * math.cos(t), cy + 0.126 * rr * math.sin(t), basez + 0.143 * math.sin(angle))))
    rings.append(row)
for j in range(24):
    for k in range(segments):
        n = (k + 1) % segments
        bm.faces.new((rings[j][k], rings[j][n], rings[j+1][n], rings[j+1][k]))
bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.003)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
CAP = from_bm('helmet_shell', bm, mat('cap', (0.80, 0.82, 0.81), 0.32), HAIR)
# All shell vertices follow the head rigidly.
CAP.vertex_groups.clear(); g = CAP.vertex_groups.new(name='head'); g.add(list(range(len(CAP.data.vertices))), 1, 'REPLACE')
bm = bmesh.new(); rings = []
for dr, dz in [(0, 0.002), (0.006, 0.001), (0.009, -0.003), (0.005, -0.006)]:
    row = []
    for k in range(segments):
        t = k * math.tau / segments; peak = max(0, -math.sin(t)) ** 8 * 0.027
        row.append(bm.verts.new(((0.103+dr)*math.cos(t), cy+(0.126+dr+peak)*math.sin(t), basez+dz-peak*0.16)))
    rings.append(row)
for j in range(3):
    for k in range(segments):
        n=(k+1)%segments; bm.faces.new((rings[j][k],rings[j][n],rings[j+1][n],rings[j+1][k]))
bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.002)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
BRIM=from_bm('helmet_rim', bm, MATS['cap'], CAP)

# ---------- 8. まとめる：肌＋目 → body、服・帽子・髪・靴 → outfit ----------
def join(name, obs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]; bpy.ops.object.join(); obs[0].name = name; return obs[0]
def edit(ob, fn):
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); fn(); bpy.ops.object.mode_set(mode='OBJECT')
for ob in [SKIN, JACKET, PANTS, COLLAR]:
    bpy.context.view_layer.objects.active = ob
    sub = ob.modifiers.new('Tailored surface', 'SUBSURF'); sub.levels = 1
    bpy.ops.object.modifier_apply(modifier=sub.name)
BODY = join('body', [SKIN, EYES])
edit(BODY, lambda: (bpy.ops.uv.average_islands_scale(), bpy.ops.uv.pack_islands(margin=0.006, rotate=False)))
OUTFIT = join('outfit', [JACKET, PANTS, DETAIL, COLLAR, BUTTONS, BELT, BUCKLE, CAP, BRIM, HAIR] + [o for pr in SHOES for o in pr])
edit(OUTFIT, lambda: bpy.ops.uv.smart_project(angle_limit=1.2, island_margin=0.004))

# ---------- 9. 色の絵を描く（UV の各画素の3D位置を求めて、位置から色を決める） ----------
def raster(ob, S):
    me = ob.data; me.calc_loop_triangles(); uvl = me.uv_layers.active.data
    pos = np.zeros((S, S, 3)); mat_i = -np.ones((S, S), int); nor = np.zeros((S, S, 3))
    co = np.array([v.co for v in me.vertices]); no = np.array([v.normal for v in me.vertices])
    for t in me.loop_triangles:
        uv = np.array([uvl[l].uv for l in t.loops]) * S; vi = list(t.vertices)
        x0, x1 = int(max(0, math.floor(uv[:, 0].min() - 1))), int(min(S - 1, math.ceil(uv[:, 0].max() + 1)))
        y0, y1 = int(max(0, math.floor(uv[:, 1].min() - 1))), int(min(S - 1, math.ceil(uv[:, 1].max() + 1)))
        if x1 < x0 or y1 < y0: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        d = (uv[1, 1] - uv[2, 1]) * (uv[0, 0] - uv[2, 0]) + (uv[2, 0] - uv[1, 0]) * (uv[0, 1] - uv[2, 1])
        if abs(d) < 1e-12: continue
        a = ((uv[1, 1] - uv[2, 1]) * (gx - uv[2, 0]) + (uv[2, 0] - uv[1, 0]) * (gy - uv[2, 1])) / d
        b = ((uv[2, 1] - uv[0, 1]) * (gx - uv[2, 0]) + (uv[0, 0] - uv[2, 0]) * (gy - uv[2, 1])) / d
        c = 1 - a - b; m = (a >= -0.35) & (b >= -0.35) & (c >= -0.35)      # 少しはみ出して塗る（継ぎ目対策）
        inside = (a >= 0) & (b >= 0) & (c >= 0)
        ys, xs = np.nonzero(m)
        for yy, xx, ins in zip(ys, xs, inside[ys, xs]):
            Y, X = y0 + yy, x0 + xx
            if ins or mat_i[Y, X] < 0:
                w = np.array([a[yy, xx], b[yy, xx], c[yy, xx]]); pos[Y, X] = w @ co[vi]; nor[Y, X] = w @ no[vi]; mat_i[Y, X] = t.material_index + (0 if ins else 100)
    mat_i[mat_i >= 100] -= 100
    return pos, nor, mat_i
def sm(e0, e1, x): t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def noise(p, f, seed=0):      # 安い値ノイズ（位置から決まる）
    q = p * f; i = np.floor(q); fr = q - i; fr = fr * fr * (3 - 2 * fr)
    def h(o): v = (i + o) @ np.array([127.1, 311.7, 74.7]) + seed * 13.1; return np.modf(np.sin(v) * 43758.5453)[0] % 1.0
    r = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (fr[..., 0] if dx else 1 - fr[..., 0]) * (fr[..., 1] if dy else 1 - fr[..., 1]) * (fr[..., 2] if dz else 1 - fr[..., 2]); r = r + w * h(np.array([dx, dy, dz]))
    return r
def mix(a, b, t): return a * (1 - t[..., None]) + np.array(b) * t[..., None]

S = 1024
teeth_u = sorted({i for f in groups['helper-upper-teeth'] for i in f[0]}); teeth_l = sorted({i for f in groups['helper-lower-teeth'] for i in f[0]})
mouth = np.array([0, P[teeth_u, 1].min(), (P[teeth_u, 2].min() + P[teeth_l, 2].max()) / 2 - 0.010]); mw = (P[teeth_u, 0].max() - P[teeth_u, 0].min()) / 2
eyeL, eyeR = cube('joint-l-eye'), cube('joint-r-eye')
pos, nor, mi = raster(BODY, S); x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
skin_i = [k for k, m in enumerate(BODY.data.materials) if m.name == 'skin'][0]
col = np.zeros((S, S, 3)) + np.array([0.74, 0.53, 0.40])
n1 = noise(pos, 9); n2 = noise(pos, 260, 3); n3 = noise(pos, 70, 5)
col *= (0.94 + 0.1 * n1)[..., None]; col *= (0.975 + 0.05 * n2)[..., None]
front = sm(0.0, 0.5, -nor[..., 1])
head = z > neckz + 0.02
# ほお・鼻・耳の赤み、目の下とあごの影の色
col = mix(col, (0.80, 0.50, 0.42), 0.3 * front * np.exp(-(((np.abs(x) - 0.045) / 0.028) ** 2 + ((z - (mouth[2] + 0.045)) / 0.03) ** 2)) * head)
col = mix(col, (0.74, 0.50, 0.42), 0.35 * sm(0.07, 0.085, np.abs(x)) * (np.abs(z - eye[2] + 0.01) < 0.04) * head)
# ひげのそり跡（口の周りとあご）
st = front * sm(mouth[2] + 0.028, mouth[2] + 0.008, z) * sm(0.075, 0.045, np.abs(x)) * sm(neckz + 0.03, neckz + 0.06, z) * (y < eye[1] + 0.07)
col = mix(col, (0.52, 0.45, 0.42), 0.34 * st * (0.75 + 0.5 * n2))
# くちびる
lip = front * sm(mw * 1.12, mw * 0.8, np.abs(x)) * np.clip(sm(0.0105, 0.004, np.abs(z - mouth[2] - 0.001) + 0.004 * (np.abs(x) / mw) ** 2), 0, 1) * (y < mouth[1] + 0.02)
col = mix(col, (0.62, 0.36, 0.33), 0.75 * lip); col = mix(col, (0.30, 0.16, 0.15), 0.8 * lip * sm(0.0016, 0.0004, np.abs(z - mouth[2])))
# まゆ（毛の流れのむら入り）、まつ毛の線
for e, sx in ((eyeL, 1), (eyeR, -1)):
    u = (x - e[0]) * sx                         # 外側が＋
    bz = e[2] + 0.0235 + 0.0035 * np.cos((u - 0.004) / 0.03 * 1.4) - 0.004 * sm(0.012, 0.034, u)
    w = 0.0052 * (1 - 0.55 * sm(0.0, 0.034, u)) * (1 - 0.3 * sm(-0.005, -0.022, u))
    brow = front * sm(w, w * 0.35, np.abs(z - bz)) * sm(-0.024, -0.017, u) * sm(0.037, 0.028, u) * (y < e[1] + 0.03)
    strands = 0.55 + 0.45 * noise(np.stack([x * 6 + z * 2.5 * sx, y, z * 0.6 - x * 0.8 * sx], -1), 900, 7)
    col = mix(col, (0.06, 0.05, 0.045), np.clip(0.92 * brow * strands, 0, 1))
    r = np.sqrt(((x - e[0]) / 0.0165) ** 2 + ((z - e[2] - 0.0005) / 0.0078) ** 2)
    lash = front * sm(0.5, 0.9, r) * sm(1.45, 1.05, r) * (y < e[1] + 0.012) * (0.9 * (z > e[2]) + 0.35 * (z <= e[2]))
    col = mix(col, (0.12, 0.08, 0.07), 0.6 * lash)
# 髪の生えぎわから上（帽子と髪の下）は、暗い色にしておく
hl = eye[2] + 0.062 - 0.04 * sm(0.04, 0.066, np.abs(x)) - 0.1 * np.clip((y - eye[1] - 0.05) / 0.12, 0, 1)
col = mix(col, (0.05, 0.045, 0.04), sm(-0.004, 0.006, z - hl) * head * (0.85 + 0.15 * n3))
# 手：関節とつめのあたりを少し変える（つめは、指先の上面を明るく）
hand = z < 1.1
col = mix(col, (0.72, 0.50, 0.42), 0.25 * hand * n3)
# 目：白目・虹彩・ひとみ
ei = [k for k, m in enumerate(BODY.data.materials) if m.name == 'eye'][0]; E = mi == ei
for e in (eyeL, eyeR):
    near = E & (np.abs(x - e[0]) < 0.02)
    r = np.sqrt((x - e[0]) ** 2 + (z - e[2]) ** 2); f = y < e[1]
    c = np.zeros((S, S, 3)) + np.array([0.86, 0.85, 0.82]); c = mix(c, (0.75, 0.55, 0.52), 0.35 * sm(0.008, 0.013, r))
    ang = np.arctan2(z - e[2], x - e[0]); fib = 0.75 + 0.25 * np.sin(ang * 46) * np.sin(ang * 17 + 1)
    c = mix(c, (0.16, 0.09, 0.045), sm(0.0064, 0.0058, r) * f); c[..., :] *= np.where((r < 0.0058) & f, fib, 1)[..., None]
    c = mix(c, (0.03, 0.02, 0.015), sm(0.0061, 0.0054, r) * sm(0.0046, 0.0056, r) * f); c = mix(c, (0.0, 0.0, 0.0), sm(0.0025, 0.0021, r) * f)
    col[near] = c[near]
col = mix(col, (0.54, 0.55, 0.52), (z < neckz - 0.30).astype(float) * (mi == skin_i))
BODY_COL = col

pos, nor, mi = raster(OUTFIT, S)
base = np.array([list(m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value)[:3] for m in OUTFIT.data.materials])
col = base[np.clip(mi, 0, len(base) - 1)]
names = [m.name for m in OUTFIT.data.materials]; cl = np.isin(mi, [names.index(n) for n in ('cloth', 'cloth_d', 'cap')])
col = np.where(cl[..., None], col * (0.92 + 0.16 * noise(pos, 14))[..., None], col)
# ひざ・ひじ・すその汚れ（うすい暗色。位置は推測）
dirt = np.clip(np.exp(-((pos[..., 2] - 0.5) / 0.12) ** 2) * (nor[..., 1] < 0) * 0.5 + sm(0.25, 0.05, pos[..., 2]) * 0.6, 0, 1) * noise(pos, 22, 9)
col = np.where(cl[..., None], col * (1 - 0.35 * dirt)[..., None], col)
hr = mi == names.index('hair'); col = np.where(hr[..., None], col * (0.6 + 1.2 * noise(pos * np.array([40, 40, 4]), 30, 4))[..., None], col)
OUT_COL = col

# ---------- 10. 影の焼き付け（AO）を掛ける ----------
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 48
def bake_ao(ob):
    img = bpy.data.images.new(ob.name + '_ao', S, S); 
    for m in ob.data.materials:
        nd = m.node_tree.nodes.new('ShaderNodeTexImage'); nd.image = img; m.node_tree.nodes.active = nd
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='AO', margin=6)
    a = np.array(img.pixels[:]).reshape(S, S, 4)[..., 0]
    return a
from PIL import Image
def save(name, col, ao, k):
    a = 1 - k * (1 - np.clip(ao, 0, 1)); im = np.clip(col * a[..., None], 0, 1) ** (1 / 2.2)
    Image.fromarray((im[::-1] * 255).astype(np.uint8)).save(OUT + '/' + name + '.jpg', quality=88)
    img = bpy.data.images.load(OUT + '/' + name + '.jpg'); return img
imgs = {}
for ob, colr, k in ((BODY, BODY_COL, 0.75), (OUTFIT, OUT_COL, 0.85)):
    ao = bake_ao(ob); imgs[ob.name] = save(ob.name, colr, ao, k)

# ---------- 11. 書き出し：材質は body / outfit の2つにして、絵は three.js 側で貼る ----------
for ob in (BODY, OUTFIT):
    m = bpy.data.materials.new(ob.name); m.use_nodes = True; nd = m.node_tree.nodes.new('ShaderNodeTexImage'); nd.image = imgs[ob.name]
    m.node_tree.links.new(nd.outputs[0], m.node_tree.nodes['Principled BSDF'].inputs['Base Color']); m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.6 if ob is BODY else 0.85
    ob.data.materials.clear(); ob.data.materials.append(m)
    for p in ob.data.polygons: p.material_index = 0
print('OBJECTS', [(o.name, len(o.data.vertices), len(o.data.polygons)) for o in bpy.data.objects if o.type == 'MESH'])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT + '/worker.glb', export_format='GLB', export_image_format='NONE', export_skins=True, export_animations=False, export_yup=True, export_apply=False, export_tangents=False)
print('GLB', os.path.getsize(OUT + '/worker.glb'))

if PREVIEW:
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.device = 'CPU'; sc.render.resolution_x = 700; sc.render.resolution_y = 900
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.6, 0.62, 0.65, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.7
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3; sun.rotation_euler = (0.9, 0.2, 0.6); sc.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    def shot(name, pos, look, lens=50):
        cam.location = pos; cam.data.lens = lens; d = Vector(look) - Vector(pos); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = OUT + '/' + name + '.png'; bpy.ops.render.render(write_still=True)
    for n, a in sys.argv[5:] and [x.split(':') for x in sys.argv[5:]] or [('front', '0'), ('q', '40'), ('back', '180')]:
        r = math.radians(float(a)); shot('pv_' + n, (math.sin(r) * 3.6, -math.cos(r) * 3.6, 1.05), (0, 0, 0.88))
    shot('pv_face', (0.25, -0.75, 1.62), (0, 0, 1.58), 70)
