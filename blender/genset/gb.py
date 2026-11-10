# gb.py — bmesh で部品を積み上げるための道具箱
# 部品は「袋」（グループ × 材質 × 種別）ごとに 1 つの bmesh にためて、最後にオブジェクトにする。
#   group : 'rig'（振動する機械本体） / 'static'（床に固定） / 'fan'（回転）
#   cls   : 'big'（ライトマップで AO を焼く） / 'small'（頂点カラーで AO） / 'panel'（透過模様の板） / 'decal'（ラベル）
import bpy, bmesh, math
from contextlib import contextmanager
from mathutils import Matrix, Vector
import numpy as np

SHARP = math.radians(38)


def T(x=0.0, y=0.0, z=0.0): return Matrix.Translation((x, y, z))
def R(axis, deg): return Matrix.Rotation(math.radians(deg), 4, axis)
def S(x=1.0, y=1.0, z=1.0): return Matrix.Diagonal((x, y, z, 1.0))


def rrect(w, h, r, n=4, cx=0.0, cy=0.0):
    pts = []
    for (sx, sy, a0) in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        ox, oy = cx + sx * (w / 2 - r), cy + sy * (h / 2 - r)
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n); pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts


def arc(r, a0, a1, n=12, cx=0.0, cy=0.0):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * k / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * k / n))) for k in range(n + 1)]


def fillet_path(P, rad, n=5):
    P = [Vector(p) for p in P]
    if len(P) < 3 or not rad: return P
    out = [P[0]]
    for i in range(1, len(P) - 1):
        A, B, C = P[i - 1], P[i], P[i + 1]
        d1, d2 = (A - B), (C - B); l1, l2 = d1.length, d2.length
        if l1 < 1e-6 or l2 < 1e-6: continue
        d1 /= l1; d2 /= l2
        phi = d1.angle(d2)
        if phi > math.pi - 0.03: out.append(B); continue
        t = min(rad / math.tan(phi / 2), 0.45 * l1, 0.45 * l2)
        rr = t * math.tan(phi / 2)
        O = B + (d1 + d2).normalized() * (rr / math.sin(phi / 2))
        a, b = (B + d1 * t) - O, (B + d2 * t) - O
        ang = a.angle(b); ax = a.cross(b)
        if ax.length < 1e-9: out.append(B); continue
        ax.normalize()
        for k in range(n + 1):
            out.append(O + Matrix.Rotation(ang * k / n, 3, ax) @ a)
    out.append(P[-1])
    return out


def catmull(P, per=6):
    P = [Vector(p) for p in P]; Q = [P[0]] + P + [P[-1]]; out = []
    for i in range(1, len(Q) - 2):
        p0, p1, p2, p3 = Q[i - 1], Q[i], Q[i + 1], Q[i + 2]
        for k in range(per):
            t = k / per; t2 = t * t; t3 = t2 * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-1]); return out


class GB:
    def __init__(self):
        self.bags = {}; self.group = 'rig'; self.cls = 'big'; self.M = Matrix.Identity(4)
        self.tris = 0; self.roots_loc = {}; self.dec = {}; self._last = None; self._n = 0

    # ---- 文脈 ----
    @contextmanager
    def use(self, group=None, cls=None):
        og, oc = self.group, self.cls
        if group: self.group = group
        if cls: self.cls = cls
        try: yield
        finally: self.group, self.cls = og, oc

    @contextmanager
    def at(self, M):
        old = self.M; self.M = old @ M
        try: yield
        finally: self.M = old

    def _flush(self):
        # 直前に作った部品を、0.5mm ほど伸び縮みさせる（部品同士の面がぴったり重なると、陰影の焼き込みに黒い筋が出るため）
        if not self._last: return
        b, start = self._last; self._last = None
        b.verts.ensure_lookup_table(); vs = b.verts[start:]
        if not vs: return
        c = sum((v.co for v in vs), Vector()) / len(vs); ext = max((v.co - c).length for v in vs)
        if ext < 1e-6: return
        self._n += 1; d = (((self._n * 2654435761) % 1000) / 1000.0 - 0.5) * 0.0016
        f = 1.0 + d / ext
        for v in vs: v.co = c + (v.co - c) * f

    def bm(self, mat, group=None, cls=None):
        self._flush()
        key = (group or self.group, mat, cls or self.cls)
        b = self.bags.get(key)
        if b is None:
            b = self.bags[key] = bmesh.new()
            if key[2] in ('panel', 'decal'): b.loops.layers.uv.new('UV')
        if key[2] in ('big', 'small'): self._last = (b, len(b.verts))
        return b

    def _bevel(self, bm, verts, w, seg=1):
        if not w or w <= 0: return
        vs = set(verts); es = set()
        for v in verts:
            for e in v.link_edges:
                if e.verts[0] in vs and e.verts[1] in vs and len(e.link_faces) == 2 and e.calc_face_angle(0.0) > 0.5: es.add(e)
        if es: bmesh.ops.bevel(bm, geom=list(es), offset=w, offset_type='OFFSET', segments=seg, profile=0.5, affect='EDGES', clamp_overlap=True)

    # ---- 基本形 ----
    def box(self, mat, x0, x1, y0, y1, z0, z1, bev=0.004, seg=1, **kw):
        bm = self.bm(mat, **kw)
        M = self.M @ T((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2) @ S(abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))
        r = bmesh.ops.create_cube(bm, size=1.0, matrix=M)
        self._bevel(bm, r['verts'], min(bev, 0.3 * min(abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))) if bev else 0, seg)

    def cyl(self, mat, p0, p1, r, seg=24, r2=None, bev=0.0, cap=True, **kw):
        bm = self.bm(mat, **kw); p0 = Vector(p0); p1 = Vector(p1); d = p1 - p0
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        M = self.M @ Matrix.Translation((p0 + p1) / 2) @ q.to_matrix().to_4x4()
        rr = bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=seg, radius1=r, radius2=(r if r2 is None else r2), depth=d.length, matrix=M)
        self._bevel(bm, rr['verts'], bev)

    def cylx(self, mat, x0, x1, y, z, r, **kw): self.cyl(mat, (x0, y, z), (x1, y, z), r, **kw)
    def cyly(self, mat, y0, y1, x, z, r, **kw): self.cyl(mat, (x, y0, z), (x, y1, z), r, **kw)
    def cylz(self, mat, z0, z1, x, y, r, **kw): self.cyl(mat, (x, y, z0), (x, y, z1), r, **kw)

    def sphere(self, mat, c, r, sx=1.0, sy=1.0, sz=1.0, u=16, v=10, **kw):
        bm = self.bm(mat, **kw)
        bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r, matrix=self.M @ T(*c) @ S(sx, sy, sz))

    def lathe(self, mat, o, axis, prof, seg=32, cap0=True, cap1=True, **kw):
        """prof: [(軸方向の距離, 半径), ...] を軸まわりに回す"""
        bm = self.bm(mat, **kw); o = Vector(o); a = Vector(axis).normalized()
        t = Vector((0, 0, 1)) if abs(a.z) < 0.9 else Vector((1, 0, 0))
        u = (t - a * t.dot(a)).normalized(); v = a.cross(u)
        rings = []
        for (s, r) in prof:
            if r <= 1e-7: rings.append([bm.verts.new(self.M @ (o + a * s))])
            else: rings.append([bm.verts.new(self.M @ (o + a * s + (u * math.cos(2 * math.pi * k / seg) + v * math.sin(2 * math.pi * k / seg)) * r)) for k in range(seg)])
        for i in range(len(rings) - 1):
            A, B = rings[i], rings[i + 1]
            for k in range(seg):
                k2 = (k + 1) % seg
                if len(A) == 1 and len(B) == 1: continue
                if len(A) == 1: bm.faces.new((A[0], B[k2], B[k]))
                elif len(B) == 1: bm.faces.new((A[k], A[k2], B[0]))
                else: bm.faces.new((A[k], A[k2], B[k2], B[k]))
        if cap0 and len(rings[0]) > 1: bm.faces.new(list(reversed(rings[0])))
        if cap1 and len(rings[-1]) > 1: bm.faces.new(rings[-1])

    def prism(self, mat, poly, axis, a0, a1, bev=0.004, seg=1, **kw):
        """poly（2D）を軸方向に押し出す。axis='x':(y,z) / 'y':(x,z) / 'z':(x,y)"""
        bm = self.bm(mat, **kw)
        def P(u, v, a):
            return self.M @ (Vector((a, u, v)) if axis == 'x' else Vector((u, a, v)) if axis == 'y' else Vector((u, v, a)))
        A = [bm.verts.new(P(u, v, a0)) for (u, v) in poly]; B = [bm.verts.new(P(u, v, a1)) for (u, v) in poly]
        n = len(poly)
        for i in range(n): bm.faces.new((A[i], A[(i + 1) % n], B[(i + 1) % n], B[i]))
        bm.faces.new(list(reversed(A))); bm.faces.new(B)
        self._bevel(bm, A + B, bev, seg)

    def loft(self, mat, loops, cap0=True, cap1=True, bev=0.0, closed=True, **kw):
        """同じ点数の輪を順につなぐ"""
        bm = self.bm(mat, **kw)
        L = [[bm.verts.new(self.M @ Vector(p)) for p in lp] for lp in loops]; n = len(L[0])
        for j in range(len(L) - 1):
            for i in range(n if closed else n - 1):
                bm.faces.new((L[j][i], L[j][(i + 1) % n], L[j + 1][(i + 1) % n], L[j + 1][i]))
        if cap0: bm.faces.new(list(reversed(L[0])))
        if cap1: bm.faces.new(L[-1])
        self._bevel(bm, [v for l in L for v in l], bev)

    def tube(self, mat, pts, r, fillet=None, seg=12, cap=True, fn=5, **kw):
        P = [Vector(p) for p in pts]
        if fillet: P = fillet_path(P, fillet, fn)
        Q = [P[0]]
        for p in P[1:]:
            if (p - Q[-1]).length > 1e-6: Q.append(p)
        P = Q; n = len(P)
        if n < 2: return
        Tn = []
        for i in range(n):
            if i == 0: t = P[1] - P[0]
            elif i == n - 1: t = P[-1] - P[-2]
            else: t = (P[i + 1] - P[i]).normalized() + (P[i] - P[i - 1]).normalized()
            Tn.append(t.normalized() if t.length > 1e-9 else Tn[-1])
        a = Vector((0, 0, 1)) if abs(Tn[0].z) < 0.9 else Vector((1, 0, 0))
        nrm = (a - Tn[0] * a.dot(Tn[0])).normalized()
        bm = self.bm(mat, **kw); rings = []
        for i in range(n):
            if i > 0:
                nrm = Tn[i - 1].rotation_difference(Tn[i]) @ nrm
                nrm = (nrm - Tn[i] * nrm.dot(Tn[i])).normalized()
            b = Tn[i].cross(nrm); rr = r[i] if isinstance(r, (list, tuple)) else r
            rings.append([bm.verts.new(self.M @ (P[i] + (nrm * math.cos(2 * math.pi * k / seg) + b * math.sin(2 * math.pi * k / seg)) * rr)) for k in range(seg)])
        for i in range(n - 1):
            for k in range(seg):
                k2 = (k + 1) % seg; bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
        if cap: bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])

    def cable(self, mat, pts, r, per=6, seg=8, **kw): self.tube(mat, catmull(pts, per), r, seg=seg, **kw)

    def torus(self, mat, c, axis, Rr, r, seg=32, rseg=10, **kw):
        c = Vector(c); a = Vector(axis).normalized()
        t = Vector((0, 0, 1)) if abs(a.z) < 0.9 else Vector((1, 0, 0))
        u = (t - a * t.dot(a)).normalized(); v = a.cross(u); bm = self.bm(mat, **kw); rings = []
        for i in range(seg):
            th = 2 * math.pi * i / seg; d = u * math.cos(th) + v * math.sin(th)
            rings.append([bm.verts.new(self.M @ (c + d * (Rr + r * math.cos(2 * math.pi * k / rseg)) + a * (r * math.sin(2 * math.pi * k / rseg)))) for k in range(rseg)])
        for i in range(seg):
            A, B = rings[i], rings[(i + 1) % seg]
            for k in range(rseg):
                k2 = (k + 1) % rseg; bm.faces.new((A[k], A[k2], B[k2], B[k]))

    # ---- ボルト・フランジ ----
    def bolt(self, mat, p, d, s=0.011, h=None, washer=False, **kw):
        p = Vector(p); d = Vector(d).normalized(); h = h or s * 0.75
        kw.setdefault('cls', 'small')
        self.cyl(mat, p, p + d * h, s, seg=6, **kw)
        if washer: self.cyl(mat, p, p + d * (h * 0.25), s * 1.35, seg=12, **kw)

    def bolts_circle(self, mat, c, axis, Rr, n, s=0.011, phase=0.0, **kw):
        c = Vector(c); a = Vector(axis).normalized()
        t = Vector((0, 0, 1)) if abs(a.z) < 0.9 else Vector((1, 0, 0))
        u = (t - a * t.dot(a)).normalized(); v = a.cross(u)
        for i in range(n):
            th = math.radians(phase) + 2 * math.pi * i / n
            self.bolt(mat, c + (u * math.cos(th) + v * math.sin(th)) * Rr, a, s, **kw)

    def flange(self, mat, p, d, Rr, t=0.016, nb=8, s=0.009, both=True, **kw):
        p = Vector(p); d = Vector(d).normalized()
        self.cyl(mat, p - d * t / 2, p + d * t / 2, Rr, seg=24, bev=0.002, **kw)
        kb = {k: v for k, v in kw.items() if k == 'group'}
        self.bolts_circle(mat, p + d * t / 2, d, Rr * 0.8, nb, s, **kb)
        if both: self.bolts_circle(mat, p - d * t / 2, -d, Rr * 0.8, nb, s, **kb)

    # ---- UV つきの板（透過模様・ラベル） ----
    def quad(self, mat, p0, pu, pv, uv=None, cls='panel', **kw):
        """p0 から pu, pv に張る四角。uv=None なら実寸（m）の UV、uv=(u0,v0,u1,v1) ならアトラス指定"""
        bm = self.bm(mat, cls=cls, **kw); L = bm.loops.layers.uv['UV']
        p0 = Vector(p0); pu = Vector(pu); pv = Vector(pv)
        vs = [bm.verts.new(self.M @ q) for q in (p0, p0 + pu, p0 + pu + pv, p0 + pv)]
        f = bm.faces.new(vs)
        if uv is None: uvs = [(0, 0), (pu.length, 0), (pu.length, pv.length), (0, pv.length)]
        else: u0, v0, u1, v1 = uv; uvs = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
        for lp, q in zip(f.loops, uvs): lp[L].uv = q

    def poly_panel(self, mat, pts, uvs, cls='panel', **kw):
        """多角形の板（扇形に三角分割）。uvs は各点の UV"""
        bm = self.bm(mat, cls=cls, **kw); L = bm.loops.layers.uv['UV']
        vs = [bm.verts.new(self.M @ Vector(p)) for p in pts]
        for i in range(1, len(vs) - 1):
            f = bm.faces.new((vs[0], vs[i], vs[i + 1]))
            for lp, k in zip(f.loops, (0, i, i + 1)): lp[L].uv = uvs[k]

    def decal(self, name, p0, pu, pv, **kw):
        self.quad('decal', p0, pu, pv, uv=self.dec[name], cls='decal', **kw)

    def decal_cylx(self, name, x0, x1, cy, cz, r, a0, a1, n=6, **kw):
        """x 軸の円筒に巻くラベル。u は x 方向、v は角度（a0→a1、+y から +z へ測る度）"""
        u0, v0, u1, v1 = self.dec[name]
        for j in range(n):
            ta, tb = j / n, (j + 1) / n; aa = math.radians(a0 + (a1 - a0) * ta); ab = math.radians(a0 + (a1 - a0) * tb)
            pa = Vector((x0, cy + r * math.cos(aa), cz + r * math.sin(aa))); pb = Vector((x0, cy + r * math.cos(ab), cz + r * math.sin(ab)))
            bm = self.bm('decal', cls='decal', **kw); L = bm.loops.layers.uv['UV']
            vs = [bm.verts.new(self.M @ q) for q in (pa, pa + Vector((x1 - x0, 0, 0)), pb + Vector((x1 - x0, 0, 0)), pb)]
            f = bm.faces.new(vs)
            for lp, q in zip(f.loops, ((u0, v0 + (v1 - v0) * ta), (u1, v0 + (v1 - v0) * ta), (u1, v0 + (v1 - v0) * tb), (u0, v0 + (v1 - v0) * tb))): lp[L].uv = q

    def decal_cylz(self, name, cx, cy, r, a0, a1, z0, z1, n=6, **kw):
        """z 軸の円筒に巻くラベル。u は角度（a0→a1、+x から +y へ測る度）、v は高さ"""
        u0, v0, u1, v1 = self.dec[name]
        for j in range(n):
            ta, tb = j / n, (j + 1) / n; aa = math.radians(a0 + (a1 - a0) * ta); ab = math.radians(a0 + (a1 - a0) * tb)
            pa = Vector((cx + r * math.cos(aa), cy + r * math.sin(aa), z0)); pb = Vector((cx + r * math.cos(ab), cy + r * math.sin(ab), z0))
            bm = self.bm('decal', cls='decal', **kw); L = bm.loops.layers.uv['UV']
            vs = [bm.verts.new(self.M @ q) for q in (pa, pb, pb + Vector((0, 0, z1 - z0)), pa + Vector((0, 0, z1 - z0)))]
            f = bm.faces.new(vs)
            for lp, q in zip(f.loops, ((u0 + (u1 - u0) * ta, v0), (u0 + (u1 - u0) * tb, v0), (u0 + (u1 - u0) * tb, v1), (u0 + (u1 - u0) * ta, v1))): lp[L].uv = q

    def lumpy(self, mat, c, r, sx=1.0, sy=1.0, sz=1.0, amp=0.02, seed=1, u=20, v=14, **kw):
        """でこぼこの塊（保温材の巻き物など）"""
        import random
        bm = self.bm(mat, **kw); rnd = random.Random(seed)
        res = bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r, matrix=Matrix.Identity(4))
        M = self.M @ T(*c) @ S(sx, sy, sz)
        for vv in res['verts']:
            d = vv.co.normalized() if vv.co.length > 1e-9 else Vector((0, 0, 1))
            k = 1.0 + (rnd.random() - 0.5) * 2 * amp / r
            vv.co = M @ (vv.co * k + d * 0)

    def taped(self, mat, pts, r, bands=(0.25, 0.6), per=6, tape='tape', **kw):
        """白いテープを巻いたケーブル"""
        C = catmull(pts, per); self.tube(mat, C, r, seg=8, **kw)
        for b in bands:
            i = min(len(C) - 2, max(0, int(b * (len(C) - 1))))
            a, d = C[i], (C[i + 1] - C[i]).normalized()
            self.cyl(tape, a, a + d * 0.035, r + 0.002, seg=8, **kw)

    # ---- 仕上げ ----
    def finalize(self, mats):
        self._flush()
        objs = []
        roots = {}
        for (group, mat, cls), bm in sorted(self.bags.items(), key=lambda kv: kv[0]):
            if not bm.faces: continue
            if cls in ('big', 'small'): bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
            for f in bm.faces: f.smooth = True
            for e in bm.edges:
                if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > SHARP: e.smooth = False
            bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4], quad_method='BEAUTY', ngon_method='BEAUTY')
            me = bpy.data.meshes.new(f"{group}|{mat}|{cls}"); bm.to_mesh(me); bm.free()
            me.materials.append(mats[mat])
            ob = bpy.data.objects.new(me.name, me); bpy.context.collection.objects.link(ob)
            if group not in roots:
                roots[group] = bpy.data.objects.new(group, None); bpy.context.collection.objects.link(roots[group])
                roots[group].location = self.roots_loc.get(group, (0, 0, 0))
            ob.parent = roots[group]
            ob['cls'] = cls; ob['grp'] = group; ob['mat'] = mat
            self.tris += sum(len(p.vertices) - 2 for p in me.polygons)
            objs.append(ob)
        self.bags = {}
        return objs


def add_tile_uv(me, name='TILE'):
    """面の向きごとに平面投影した、実寸（m）の UV。模様のタイル貼り用"""
    n = len(me.loops)
    co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    vi = np.empty(n, np.int32); me.loops.foreach_get('vertex_index', vi)
    pn = np.empty(len(me.polygons) * 3, np.float32); me.polygons.foreach_get('normal', pn); pn = pn.reshape(-1, 3)
    lt = np.empty(len(me.polygons), np.int32); me.polygons.foreach_get('loop_total', lt)
    ln = np.repeat(pn, lt, axis=0)
    p = co[vi]; ax = np.argmax(np.abs(ln), axis=1)
    uv = np.where((ax == 0)[:, None], p[:, [1, 2]], np.where((ax == 1)[:, None], p[:, [0, 2]], p[:, [0, 1]]))
    layer = me.uv_layers.new(name=name)
    layer.data.foreach_set('uv', uv.astype(np.float32).ravel())
    return layer
