# model.py — 非常用ディーゼル発電機（教育用の想像モデル）の形
# 座標：x＝軸方向（＋がファン側）、y＝＋が操作盤のある側、z＝上。単位 m。原点は床、エンジンの後端面が x=-0.90。
# 寸法比は、真横・端面の写真に目盛りを重ねて測った値（絶対寸法は推定）。メーカー名・形式は入れない。
import math, json, os
from mathutils import Vector, Matrix
from gb import T, R, S, rrect, arc

ZA = 1.25                                   # 軸の高さ
P = 0.2726; CX = [-0.54 + i * P for i in range(6)]   # シリンダの中心（0 がはずみ車側）
SK0, SK1 = 0.145, 0.73                      # 架台の下面・上面
FX0, FX1, BX1, DX1 = -2.66, -2.29, -1.63, -1.30   # 発電機：反駆動側の箱｜胴｜駆動側の箱
W = 0.585; ZT = 1.83; ZB = 0.73             # 発電機の枠：半幅、上面、下面
MX = [-2.54, -1.86, -1.19, -0.45, 0.35, 1.10]     # 防振装置の位置
FAN_X, FAN_Z, FAN_R = 1.60, 2.12, 0.70


def ring_plate(g, mat, x0, x1, cy, cz, Rh, outline, n=64, **kw):
    """yz 面の板（外形 outline、中心 (cy,cz) に半径 Rh の丸穴）を、x0..x1 の厚みで作る"""
    bm = g.bm(mat, **kw); m = len(outline)
    angs = sorted(set([round(2 * math.pi * k / n, 6) for k in range(n)] + [round(math.atan2(z - cz, y - cy) % (2 * math.pi), 6) for (y, z) in outline]))
    def hit(a):
        dy, dz = math.cos(a), math.sin(a); best = None
        for i in range(m):
            (y1, z1), (y2, z2) = outline[i], outline[(i + 1) % m]; ex, ez = y2 - y1, z2 - z1; den = dy * ez - dz * ex
            if abs(den) < 1e-12: continue
            t = ((y1 - cy) * ez - (z1 - cz) * ex) / den; u = ((y1 - cy) * dz - (z1 - cz) * dy) / den
            if t > 0 and -1e-6 <= u <= 1 + 1e-6: best = t if best is None else min(best, t)
        return cy + dy * best, cz + dz * best
    rows = []
    for a in angs:
        oy, oz = hit(a); iy, iz = cy + Rh * math.cos(a), cz + Rh * math.sin(a)
        rows.append([bm.verts.new(g.M @ Vector(q)) for q in ((x0, iy, iz), (x0, oy, oz), (x1, oy, oz), (x1, iy, iz))])
    for i in range(len(rows)):
        A, B = rows[i], rows[(i + 1) % len(rows)]
        for k in range(4): bm.faces.new((A[k], A[(k + 1) % 4], B[(k + 1) % 4], B[k]))


def disc_panel(g, mat, x, cy, cz, Rr, n=48):
    pts = [(x, cy, cz)] + [(x, cy + Rr * math.cos(2 * math.pi * k / n), cz + Rr * math.sin(2 * math.pi * k / n)) for k in range(n + 1)]
    g.poly_panel(mat, pts, [(p[1], p[2]) for p in pts])


def louver(g, Wd, Hd, pitch=0.0275):
    """ルーバー（ローカル：x＝幅、z＝高さ、y＝外向き）"""
    F = 'alt2'
    g.box('black', 0.02, Wd - 0.02, -0.002, 0.003, 0.02, Hd - 0.02, bev=0, cls='small')
    for (x0, x1, z0, z1) in ((0, Wd, 0, 0.03), (0, Wd, Hd - 0.03, Hd), (0, 0.03, 0.03, Hd - 0.03), (Wd - 0.03, Wd, 0.03, Hd - 0.03)):
        g.box(F, x0, x1, 0, 0.032, z0, z1, bev=0.003, cls='small')
    for i in range(int((Hd - 0.07) / pitch)):
        with g.at(T(0, 0.004, 0.045 + i * pitch) @ R('X', -38)):
            g.box(F, 0.03, Wd - 0.03, 0, 0.034, -0.0015, 0.0015, bev=0, cls='small')
    for fz in (0.03, 0.27, 0.5, 0.73, 0.97):
        for x in (0.015, Wd - 0.015): g.bolt(F, (x, 0.032, 0.015 + (Hd - 0.03) * (fz - 0.03) / 0.94), (0, 1, 0), 0.009)


def skid(g):
    A = 'alt'
    with g.use('rig', 'big'):
        for s in (1, -1):
            with g.at(S(1, s, 1)):
                g.box(A, -2.72, 1.30, 0.52, 0.56, 0.17, 0.70, bev=0)             # ウェブ
                g.box(A, -2.72, 1.30, 0.40, 0.685, 0.70, 0.73, bev=0.004)        # 上フランジ
                g.box(A, -2.72, 1.30, 0.38, 0.76, SK0, 0.17, bev=0.004)          # 下フランジ
                for x in (-2.60, -2.15, -1.83, -1.29, -0.85, -0.30, 0.25, 0.80, 1.22):
                    g.prism(A, [(0.56, 0.172), (0.66, 0.172), (0.645, 0.42), (0.68, 0.698), (0.56, 0.698)], 'x', x - 0.007, x + 0.007, bev=0)
                g.box(A, -2.735, -2.72, 0.38, 0.70, 0.17, 0.73, bev=0.003)       # 端板
                g.box(A, 1.30, 1.315, 0.38, 0.70, 0.17, 0.73, bev=0.003)
                g.box(A, FX0, FX1, 0.40, 0.60, 0.73, 0.742, bev=0.002); g.box(A, BX1, DX1, 0.40, 0.60, 0.73, 0.742, bev=0.002)
                for x in MX: g.box(A, x - 0.11, x + 0.11, 0.50, 0.74, 0.135, SK0, bev=0.002, cls='small')
        g.box(A, -2.72, -1.25, -0.52, 0.52, 0.57, 0.60, bev=0)                     # 発電機の下の、低い天板
        g.box(A, -2.72, -2.705, -0.40, 0.40, 0.17, 0.60, bev=0)                    # 端面の、くぼんだ板
        for x in (-1.26, -0.90, 0.05, 1.0, 1.29): g.box(A, x - 0.01, x + 0.01, -0.52, 0.52, 0.20, 0.70, bev=0)
        g.box(A, -1.25, 1.30, -0.52, 0.52, 0.30, 0.32, bev=0)
        g.torus(A, (-1.47, -0.562, 0.45), (0, 1, 0), 0.085, 0.012, seg=24, rseg=8, cls='small')   # ケーブルの穴
        g.cyl('black', (-1.47, -0.5605, 0.45), (-1.47, -0.565, 0.45), 0.08, seg=24, cls='small')
        g.torus(A, (-2.737, 0.535, 0.50), (1, 0, 0), 0.05, 0.01, seg=20, rseg=8, cls='small')
        g.cyl('black', (-2.7355, 0.535, 0.50), (-2.739, 0.535, 0.50), 0.047, seg=20, cls='small')


def mounts(g):
    with g.use('static', 'small'):
        for x in MX:
            for s in (1, -1):
                with g.at(T(x, s * 0.62, 0) @ S(1, s, 1)):
                    g.box('steeld', -0.13, 0.13, -0.12, 0.25, 0, 0.012, bev=0.002)
                    g.lathe('rubber', (0, 0, 0), (0, 0, 1), [(0.012, 0.07), (0.02, 0.10), (0.04, 0.112), (0.058, 0.098), (0.068, 0.088), (0.078, 0.098), (0.096, 0.112), (0.116, 0.10), (0.124, 0.07)], seg=24)
                    g.cylz('steeld', 0.124, 0.135, 0, 0, 0.085, seg=24)
                    for dx in (-0.09, 0.09):
                        g.cylz('steel', 0.012, 0.075, dx, 0.20, 0.008, seg=8); g.bolt('steel', (dx, 0.20, 0.012), (0, 0, 1), 0.014, 0.012, washer=True)


def alternator(g):
    A, A2 = 'alt', 'alt2'; D = g.decal
    with g.use('rig', 'big'):
        # 反駆動側の端枠（丸いくぼみ）と箱
        outline = [(W, ZB), (W, ZT), (-W, ZT), (-W, ZB), (-0.42, ZB), (-0.30, 0.655), (0.30, 0.655), (0.42, ZB)]
        ring_plate(g, A2, FX0, FX0 + 0.05, 0, ZA, 0.536, outline)
        g.box(A2, FX0 + 0.05, FX1, -W, W, ZB + 0.025, ZT, bev=0.004)
        g.cylx(A, FX0 + 0.04, FX0 + 0.06, 0, ZA, 0.536, seg=64)
        for k in range(6):
            with g.at(T(FX0 + 0.04, 0, ZA) @ R('X', 60 * k)):
                g.prism(A, [(0, 0.25), (0, 0.525), (-0.022, 0.525), (-0.115, 0.25)], 'y', -0.016, 0.016, bev=0.003)
        g.lathe(A, (FX0 + 0.04, 0, ZA), (-1, 0, 0), [(0, 0.27), (0.105, 0.27), (0.118, 0.255), (0.118, 0.21), (0.15, 0.21), (0.16, 0.20), (0.16, 0.152), (0.385, 0.152), (0.40, 0.137), (0.40, 0.0)], seg=40, cap0=False, cap1=False)
        g.bolts_circle(A, (FX0 + 0.04 - 0.118, 0, ZA), (-1, 0, 0), 0.235, 8, 0.012, phase=22.5)
        g.bolts_circle(A, (FX0 + 0.04 - 0.16, 0, ZA), (-1, 0, 0), 0.178, 6, 0.010)
        g.bolts_circle(A, (FX0 + 0.04, 0, ZA), (-1, 0, 0), 0.497, 12, 0.012, phase=15)
        # 胴・スカート・台のレール
        g.cylx(A, FX1, BX1, 0, ZA, 0.385, seg=56)
        for x in (-2.21, -1.71): g.cylx(A, x - 0.008, x + 0.008, 0, ZA, 0.389, seg=56)
        g.box(A, FX1, BX1, -0.36, 0.36, ZB + 0.025, 0.95, bev=0)
        g.box(A, FX0 + 0.02, DX1, -W - 0.004, W + 0.004, ZB, ZB + 0.025, bev=0.003)
        # 上のフード
        g.box(A2, FX1, BX1, -0.50, 0.50, 1.80, ZT, bev=0.004)
        for s in (1, -1):
            g.prism(A2, [(FX1, ZT), (FX1, 1.58), (FX1 + 0.09, 1.69), (BX1 - 0.09, 1.69), (BX1, 1.58), (BX1, ZT)], 'y', s * 0.494, s * 0.50, bev=0)
        g.box(A2, -2.27, -1.69, -0.36, 0.36, ZT, 1.90, bev=0.006)
        # 駆動側の箱
        g.box(A2, BX1, DX1, -W, W, ZB + 0.025, ZT, bev=0.006)
        g.box(A2, DX1, DX1 + 0.02, -W, W, ZB + 0.025, ZT, bev=0.003)
        # ルーバー（4 面）
        for s in (1, -1):
            for (xa, xb) in ((FX0 + 0.05, FX1), (BX1, DX1)):
                with g.at(S(1, s, 1) @ T(xa + 0.015, W, ZB + 0.05)): louver(g, xb - xa - 0.03, ZT - ZB - 0.09)
    with g.use('rig', 'small'):
        for s in (1, -1): g.box('black', -2.20, -1.76, s * 0.358, s * 0.362, 1.85, 1.88, bev=0)
        g.box(A2, FX0 - 0.045, FX0 + 0.04, 0.40, 0.52, 1.20, 1.37, bev=0.006)           # スペースヒータの箱
        g.box(A, -2.93, -2.80, 0.13, 0.25, 1.04, 1.20, bev=0.006)                         # 軸端の小箱
        g.cyl(A, (-2.94, 0.25, 1.06), (-2.90, 0.17, 1.27), 0.006, seg=8)
        for dy in (0.0, 0.05):                                                            # 太いケーブル（白テープつき）
            pts = [(FX0 - 0.05, 0.43 + dy, 1.20), (FX0 - 0.10, 0.44 + dy, 1.08), (FX0 - 0.10, 0.46 + dy, 0.85), (FX0 - 0.085, 0.50 + dy * 0.4, 0.66), (-2.745, 0.535, 0.515)]
            g.cyl('steel', pts[0], (FX0 - 0.045, 0.43 + dy, 1.25), 0.024, seg=10)
            g.taped('cable', pts, 0.019, bands=(0.3, 0.62, 0.86))
        g.cable('cable', [(-2.87, 0.19, 1.04), (-2.86, 0.10, 0.86), (-2.80, 0.02, 0.74), (-2.745, 0.0, 0.62)], 0.011)
    # ラベル（端面は −x から見る：右が −y）
    xf = FX0 + 0.037
    D('plate_copper', (xf, 0.26, 1.54), (0, -0.12, 0), (0, 0, 0.15)); D('plate_copper2', (xf, -0.04, 1.57), (0, -0.12, 0), (0, 0, 0.11))
    D('sticker_yel', (FX0 + 0.04 - 0.1195, 0.045, ZA + 0.214), (0, -0.09, 0), (0, 0, 0.042)); D('warn_elec', (FX0 - 0.047, 0.50, 1.225), (0, -0.08, 0), (0, 0, 0.10))
    g.decal_cylx('plate_silver', -2.06, -1.93, 0, ZA, 0.3865, 177, 165); g.decal_cylx('plate_silver', -2.06, -1.93, 0, ZA, 0.3865, 191, 179)
    g.decal_cylx('plate_dark', -1.90, -1.79, 0, ZA, 0.3865, 191, 181); g.decal_cylx('sticker_red', -2.15, -2.10, 0, ZA, 0.3865, 190, 182.5)


def bell(g):
    E = 'eng'
    with g.use('rig', 'big'):
        g.prism(E, [(0.40, 0.75)] + arc(0.40, 0, 180, n=24, cy=ZA) + [(-0.40, 0.75)], 'x', DX1 + 0.02, -0.90, bev=0.008)
        g.cylx(E, -0.935, -0.90, 0, ZA, 0.44, seg=48, bev=0.004)
        g.bolts_circle(E, (-0.935, 0, ZA), (-1, 0, 0), 0.42, 16, 0.011)
        for s in (1, -1): g.box(E, -1.25, -0.95, s * 0.40, s * 0.50, 0.73, 0.80, bev=0.006)
    # −Y 側の注意ラベル（円筒面）
    g.decal_cylx('warn_tri', -1.22, -1.10, 0, ZA, 0.402, 163, 151); g.decal_cylx('warn_rot', -1.22, -1.11, 0, ZA, 0.402, 176, 165); g.decal_cylx('warn_rot', -1.22, -1.11, 0, ZA, 0.402, 189, 178)


def build(g):
    g.dec = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'decals.json')))
    import m_engine, m_site
    skid(g); mounts(g); alternator(g); bell(g)
    m_engine.engine(g); m_engine.turbo_exhaust(g)
    m_site.fan(g); m_site.radiator(g); m_site.decks(g); m_site.desk(g); m_site.cage(g); m_site.piping(g); m_site.misc(g)
