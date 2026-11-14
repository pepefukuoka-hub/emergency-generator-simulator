# build.py — 制御盤の「部品箱」を Blender（bpy）で作り、陰影（AO）を焼いて、1つの GLB に書き出す
#   部品は種類ごとに1つだけ作り、three.js 側（src/parts.js）で複製して、全部の盤で使い回す。
#   写真（ドライブ機器室 IMG_3602・3603・3617・3620・3623 ほか）から形を起こした教育用の想像モデル。
#   寸法は写真の比率からの近似で、実測ではない。メーカー名・形式・銘板の文字は入れない
#   （前面の文字・札は、three.js 側の Canvas で描くデカール。写真の画素の座標のまま描けるよう、板の UV を合わせてある）。
#   使い方: python build.py [--ao-size 2048] [--samples 64] [--noao]
#   座標（Blender）：x＝幅（正面から見て右が +）、y＝奥行き（正面が −y）、z＝上。単位 m。
#   部品（グループ名）：
#     vcb   引出形の真空遮断器          unit  引出形の ZPD／VT／LA の本体と受け皿     vmc  引出形の真空電磁接触器と台
#     mc    電磁接触器（補助接点つき）   mcw   その主回路の線（赤・白・青の端末）と制御線
#     elb   漏電遮断器（3極）            cp    小形の配線用遮断器（2極）
#     relay 差し込み式の小形リレー       tb    端子台（10極）      fuse  ヒューズホルダ
#     duct  穴あきの配線ダクト（長さ 0.24m。縦に置いた向き）
import bpy, bmesh, sys, os, math, time
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..', 'genset'))
import gb
from gb import GB, rrect, fillet_path

ARGS = sys.argv[1:]
def arg(name, default=None, cast=str): return cast(ARGS[ARGS.index(name) + 1]) if name in ARGS else default
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
AO_SIZE = arg('--ao-size', 2048, int); SAMPLES = arg('--samples', 64, int)
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

# ---------- 共通の道具 ----------
def circ(cx, cz, r, n=20): return [(cx + r * math.cos(2 * math.pi * k / n), cz + r * math.sin(2 * math.pi * k / n)) for k in range(n)]
def rect(x0, x1, z0, z1): return [(min(x0, x1), min(z0, z1)), (max(x0, x1), min(z0, z1)), (max(x0, x1), max(z0, z1)), (min(x0, x1), max(z0, z1))]
def cuv(x0, y0, x1, y1, Wc, Hc): return (x0 / Wc, 1 - y1 / Hc, x1 / Wc, 1 - y0 / Hc)   # Canvas の四角 → UV

def screw(g, x, z, y, r=0.0045, mat='steel', d=(0, -1, 0)):
    """なべ頭の小ねじ（十字の溝つき）。y は座面"""
    g.lathe(mat, (x, y, z), d, [(0, r), (r * 0.36, r), (r * 0.6, r * 0.62), (r * 0.68, 0)], seg=10, cls='small')
    if d == (0, -1, 0):
        for (a, b) in ((r * 0.62, r * 0.13), (r * 0.13, r * 0.62)):
            g.box('black', x - a, x + a, y - r * 0.71, y - r * 0.6, z - b, z + b, bev=0, cls='small')
    else:
        for (a, b) in ((r * 0.62, r * 0.13), (r * 0.13, r * 0.62)):
            g.box('black', x - a, x + a, y - b, y + b, z + r * 0.6, z + r * 0.71, bev=0, cls='small')

def hexbolt(g, x, z, y, s=0.007, mat='steel', d=(0, -1, 0)): g.bolt(mat, (x, y, z), d, s=s, washer=True)

def handle(g, x, z0, z1, py, so=0.042, r=0.0125, mat='grip'):
    """灰色の樹脂の取っ手：両端の太い座（正面に丸い穴）と、縦の握り"""
    for z in (z0, z1):
        g.cyl(mat, (x, py + 0.002, z), (x, py - so - r * 0.9, z), r * 1.28, seg=24, bev=0.0025)
        g.cyl('black', (x, py - so - r * 0.9 - 0.0006, z), (x, py - so - r * 0.9 + 0.003, z), r * 0.6, seg=16, cls='small')
    g.cyl(mat, (x, py - so, min(z0, z1)), (x, py - so, max(z0, z1)), r, seg=20)

def tagplate(g, grp, x0, x1, z0, z1, y, t=0.0015):
    """白い名札の板と、文字のデカール（文字は three.js 側で差し替える）"""
    g.box('white', x0, x1, y - t, y, z0, z1, bev=0.0004, cls='small')
    g.quad('tag', (x0, y - t - 0.0004, z0), (x1 - x0, 0, 0), (0, 0, z1 - z0), uv=(0, 0, 1, 1), cls='decal')


# ====================================================================================================
# 引出形の真空遮断器（VCB）。写真 IMG_3620 の画素 → 模型：x=(px−897)×0.38mm、z=0.56−(py−45)×0.38mm
# ====================================================================================================
def build_vcb(g):
    W, D, H = 0.50, 0.54, 0.56; FY = -D / 2; PY = FY - 0.012; B0 = 0.055
    X = lambda p: (p - 897) * 0.00038; Z = lambda p: 0.56 - (p - 45) * 0.00038
    with g.use(group='vcb'):
        g.box('vbody', -W / 2, W / 2, FY, D / 2, B0, H, bev=0.008, seg=2)
        # 前板：上が広く、下が少し狭い。蓄勢の操作口と、ロックのレバーの溝は、本当の穴
        out = [(-0.216, 0.079), (0.226, 0.079), (0.226, 0.30), (0.238, 0.30), (0.238, 0.499), (-0.238, 0.499), (-0.238, 0.30), (-0.216, 0.30)]
        slot = rect(X(1000), X(1082), Z(1262), Z(1010)); lock = rect(X(795), X(812), Z(1300), Z(1172))
        g.holed('vfront', out, [slot, lock], 'y', PY, FY + 0.002)
        g.box('black', X(992), X(1090), FY - 0.0015, FY + 0.001, Z(1270), Z(1002), bev=0)
        g.box('black', X(790), X(817), FY - 0.0015, FY + 0.001, Z(1304), Z(1168), bev=0)
        # 蓄勢の操作軸（中空の筒）と、その上の歯車
        sx, sz = X(1043), Z(1100)
        g.lathe('steel', (sx, FY - 0.001, sz), (0, -1, 0), [(0, 0.012), (0.024, 0.012), (0.0255, 0.0105), (0.0255, 0.0075), (0.006, 0.0075), (0.006, 0)], seg=24)
        g.cyl('steeld', (sx - 0.009, FY - 0.006, Z(1040)), (sx + 0.009, FY - 0.006, Z(1040)), 0.0115, seg=18)
        for k in range(9):
            a = k * math.pi * 2 / 9
            g.box('steeld', sx - 0.009, sx + 0.009, FY - 0.006 + 0.0125 * math.cos(a) - 0.0015, FY - 0.006 + 0.0125 * math.cos(a) + 0.0015, Z(1040) + 0.0125 * math.sin(a) - 0.0015, Z(1040) + 0.0125 * math.sin(a) + 0.0015, bev=0, cls='small')
        g.box('chrom', X(798), X(808), PY - 0.012, FY, Z(1292), Z(1245), bev=0.0008, cls='small')      # ロックのレバー
        # 開閉回数計の窓と、入／切の表示窓（黒い縁。中の数字・赤い表示はデカール）
        for (x0, x1, z0, z1) in ((X(603), X(737), Z(265), Z(215)), (X(882), X(978), Z(262), Z(215))):
            g.holed('black', rect(x0 - 0.003, x1 + 0.003, z0 - 0.003, z1 + 0.003), [rect(x0, x1, z0, z1)], 'y', PY - 0.003, PY)
        # 開路（TRIP）：黒い座と、赤いきのこ形の押しボタン
        bx, bz = X(830), Z(815)
        g.lathe('black', (bx, PY, bz), (0, -1, 0), [(0, 0.0215), (0.004, 0.0215), (0.0065, 0.019), (0.0065, 0.0)], seg=32)
        g.lathe('red', (bx, PY - 0.0065, bz), (0, -1, 0), [(0.0, 0.0125), (0.004, 0.0125), (0.0045, 0.0172), (0.0085, 0.0178), (0.0125, 0.0155), (0.0155, 0.0095), (0.0165, 0.0)], seg=32)
        # 閉路（CLOSE）：透明のカバー、緑がかった黒いつまみ、上下の真ちゅうのピン
        cx0, cx1, cz0, cz1 = X(790), X(885), Z(1100), Z(908); cx = (cx0 + cx1) / 2; kz = Z(985)
        g.box('steel', cx0 + 0.002, cx1 - 0.002, PY - 0.002, PY, cz0 + 0.004, cz1 - 0.004, bev=0.001)
        g.lathe('knobg', (cx, PY - 0.002, kz), (0, -1, 0), [(0, 0.0145), (0.008, 0.0145), (0.0105, 0.0125), (0.0105, 0.0)], seg=28)
        g.cyl('steel', (cx, PY - 0.012, kz), (cx, PY - 0.0145, kz), 0.004, seg=12, cls='small')
        for zz in (Z(940), Z(1075)):
            g.cyl('brass', (cx, PY - 0.002, zz), (cx, PY - 0.016, zz), 0.0048, seg=14, cls='small')
            g.cyl('brass', (cx, PY - 0.016, zz), (cx, PY - 0.019, zz), 0.0065, seg=14, cls='small')
        g.cyl('steel', (cx, PY - 0.010, Z(940)), (cx, PY - 0.010, Z(1075)), 0.0016, seg=8, cls='small')
        with g.use(cls='glass'):
            g.box('acryl', cx0, cx1, PY - 0.030, PY - 0.001, cz0, cz1, bev=0.003)
        # 左右の取っ手（クロメートの金具の上に、灰色の握り）
        for (x, br0, br1, za, zb) in ((X(330), X(270), X(415), Z(240), Z(700)), (X(1482), X(1420), X(1548), Z(245), Z(685))):
            g.box('chrom', br0, br1, PY - 0.004, PY + 0.001, 0.303, 0.497, bev=0.0015)
            handle(g, x, zb, za, PY - 0.004)
        # 左：補助回路のプラグ（黒い箱）と、クロメートの枠、上へ伸びる灰色の保護チューブ
        g.box('chrom', -0.335, -0.2, FY - 0.004, FY + 0.004, 0.06, 0.30, bev=0.001)
        g.box('black', -0.328, -0.224, FY - 0.105, FY - 0.004, 0.118, 0.272, bev=0.010, seg=3)
        g.box('black', -0.332, -0.220, FY - 0.060, FY - 0.050, 0.114, 0.276, bev=0.003)
        g.box('black', -0.318, -0.234, FY - 0.112, FY - 0.100, 0.13, 0.26, bev=0.004)
        for zz in (0.135, 0.255): screw(g, -0.276, zz, FY - 0.112, r=0.004)
        g.box('chrom', -0.224, -0.214, FY - 0.07, FY - 0.004, 0.16, 0.24, bev=0.001, cls='small')
        g.cable('wrap', [(-0.285, FY - 0.055, 0.268), (-0.29, FY - 0.058, 0.31), (-0.32, FY - 0.04, 0.37), (-0.345, FY + 0.0, 0.43), (-0.35, FY + 0.06, 0.47)], 0.021, per=5, seg=12)
        g.cyl('white', (-0.2885, FY - 0.06, 0.305), (-0.290, FY - 0.059, 0.312), 0.0225, seg=12, cls='small')
        # 下：台枠（クロメート）、車輪、インタロックの板（角穴）、わきの三角の板
        g.box('chrom', -0.245, 0.215, FY - 0.012, FY + 0.02, 0.012, 0.076, bev=0.003)
        for s in (-1, 1):
            g.box('chrom', s * 0.225 - 0.02, s * 0.225 + 0.02, FY - 0.01, D / 2, 0.012, B0, bev=0.003)
            for y in (FY + 0.05, D / 2 - 0.06):
                g.cyl('steeld', (s * 0.2, y, 0.024), (s * 0.176, y, 0.024), 0.024, seg=24, bev=0.002)
                g.cyl('steel', (s * 0.203, y, 0.024), (s * 0.172, y, 0.024), 0.007, seg=12, cls='small')
            g.prism('chrom', [(FY, 0.012), (FY - 0.13, 0.012), (FY - 0.13, 0.03), (FY - 0.006, 0.31), (FY, 0.31)], 'x', s * 0.243 - 0.0015, s * 0.243 + 0.0015, bev=0)
        ix0, ix1 = X(880), X(1022)
        g.holed('chrom', rect(ix0, ix1, Z(1352), Z(1272)), [rect(X(932), X(968), Z(1325), Z(1288))], 'y', PY - 0.032, PY - 0.029)
        g.box('chrom', ix0, ix1, PY - 0.032, FY, Z(1356), Z(1349), bev=0.0006)
        g.box('chrom', ix0 - 0.03, ix1 + 0.03, PY - 0.07, FY, 0.012, 0.016, bev=0.0006)
        # ねじ（上の覆い3本・前板の下2本）
        for (px, py) in ((322, 180), (930, 125), (1490, 185)): screw(g, X(px), Z(py), FY, r=0.006)
        for (px, py) in ((445, 1290), (1405, 1215)): screw(g, X(px), Z(py), PY, r=0.005)
        # 回路の名札（上の覆いの右）と、前板のデカール（前板 0.47×0.42m に Canvas を 0〜1 で貼る）
        tagplate(g, 'vcb', X(1105), X(1430), Z(232), Z(105), FY - 0.0125)
        g.quad('label', (-0.235, PY - 0.0007, 0.079), (0.47, 0, 0), (0, 0, 0.42), uv=(0, 0, 1, 1), cls='decal')


# ====================================================================================================
# 引出形の ZPD／VT／LA の本体と、亜鉛めっきの受け皿。写真 IMG_3623：x=(px−986.5)×0.362mm、z=0.405−(py−205)×0.362mm
# ====================================================================================================
def build_unit(g):
    W, D, H = 0.52, 0.45, 0.405; FY = -D / 2
    X = lambda p: (p - 986.5) * 0.000362; Z = lambda p: 0.405 - (p - 205) * 0.000362
    WC, HC = 1024, 873                                    # Canvas：上 773px が前面、下 100px が受け皿の札
    with g.use(group='unit'):
        g.box('ubody', -W / 2, W / 2, FY, D / 2, 0.04, H, bev=0.006, seg=2)
        g.box('ubody', -W / 2 + 0.004, W / 2 - 0.004, FY - 0.0025, FY + 0.002, 0.043, H - 0.004, bev=0.002)       # 前板（一段）
        # 下の切り欠き：左右の足と、奥まったすそ
        for (a, b) in ((X(420), X(585)), (X(1285), X(1445))): g.box('ubody', a, b, FY - 0.0025, FY + 0.05, 0.012, 0.043, bev=0.002)
        g.box('ubody', X(585), X(1285), FY + 0.012, FY + 0.05, 0.014, 0.043, bev=0.001)
        hexbolt(g, X(620), 0.026, FY + 0.012, s=0.006); hexbolt(g, X(1400), 0.026, FY - 0.0025, s=0.006)
        for (px, py) in ((505, 1200), (1020, 1165), (1508, 1135)):
            g.cyl('steel', (X(px), FY - 0.0025, Z(py)), (X(px), FY - 0.0035, Z(py)), 0.0075, seg=14, cls='small'); screw(g, X(px), Z(py), FY - 0.0035, r=0.0048)
        # 取っ手（みがいた角棒をコの字に曲げたもの）
        hx0, hx1, hz = X(898), X(1150), Z(935); so = 0.036; t = 0.011
        outer = fillet_path([(hx0, FY, 0), (hx0, FY - so, 0), (hx1, FY - so, 0), (hx1, FY, 0)], 0.012, 5)
        inner = fillet_path([(hx1 - t, FY, 0), (hx1 - t, FY - so + t, 0), (hx0 + t, FY - so + t, 0), (hx0 + t, FY, 0)], 0.004, 3)
        g.prism('sus', [(p.x, p.y) for p in outer + inner], 'z', hz - 0.0055, hz + 0.0055, bev=0.0012)
        # 右上：枠の中の赤いコネクタ（3×3 の穴）と、ねじ2本
        fx0, fx1, fz0, fz1 = X(1487), X(1607), Z(730), Z(598)
        g.holed('ubody', rect(fx0, fx1, fz0, fz1), [rect(fx0 + 0.004, fx1 - 0.004, fz0 + 0.004, fz1 - 0.004)], 'y', FY - 0.0065, FY - 0.002)
        g.box('uinset', fx0 + 0.003, fx1 - 0.003, FY - 0.0035, FY - 0.002, fz0 + 0.003, fz1 - 0.003, bev=0)
        rx0, rx1, rz0, rz1 = X(1512), X(1612), Z(716), Z(616)
        g.box('red', rx0, rx1, FY - 0.026, FY - 0.003, rz0, rz1, bev=0.0025)
        cw = (rx1 - rx0 - 0.006) / 3; ch = (rz1 - rz0 - 0.006) / 3
        g.holed('red', rect(rx0 + 0.001, rx1 - 0.001, rz0 + 0.001, rz1 - 0.001), [rect(rx0 + 0.003 + i * cw + 0.0016, rx0 + 0.003 + (i + 1) * cw - 0.0016, rz0 + 0.003 + j * ch + 0.0016, rz0 + 0.003 + (j + 1) * ch - 0.0016) for i in range(3) for j in range(3)], 'y', FY - 0.031, FY - 0.026)
        g.box('redd', rx0 + 0.002, rx1 - 0.002, FY - 0.0268, FY - 0.0258, rz0 + 0.002, rz1 - 0.002, bev=0, cls='small')
        for py in (628, 705): screw(g, X(1464), Z(py), FY - 0.0025, r=0.0042)
        # コネクタからの線（黄・黄・白・緑・黄、白い番号札つき）→ 灰色の保護チューブの束
        cols = ['wy', 'wy', 'white', 'wgreen', 'wy']
        for k, col in enumerate(cols):
            z0 = rz0 + 0.006 + k * 0.0055; yy = FY - 0.012 - (k % 2) * 0.006
            P = [(rx1 - 0.004, yy, z0), (rx1 + 0.012, yy - 0.004, z0 - 0.004), (rx1 + 0.022 + k * 0.002, FY - 0.028, z0 - 0.022 - k * 0.002), (rx1 + 0.03, FY - 0.034, 0.17)]
            g.cable(col, P, 0.0026, per=4, seg=6, cls='small')
            g.cable('white', [P[1], ((P[1][0] + P[2][0]) / 2 + 0.002, (P[1][1] + P[2][1]) / 2, (P[1][2] + P[2][2]) / 2 + 0.002), P[2]], 0.0036, per=2, seg=6, cls='small')
        bx = rx1 + 0.03
        g.cable('wrap', [(bx, FY - 0.034, 0.178), (bx + 0.004, FY - 0.04, 0.13), (bx + 0.03, FY - 0.036, 0.092), (bx + 0.08, FY + 0.0, 0.10), (bx + 0.10, FY + 0.07, 0.15), (bx + 0.105, FY + 0.12, 0.22)], 0.017, per=5, seg=12)
        for (p, q) in (((bx, FY - 0.0345, 0.176), (bx, FY - 0.0348, 0.170)), ((bx + 0.012, FY - 0.039, 0.108), (bx + 0.016, FY - 0.0385, 0.104))):
            g.cyl('white', p, q, 0.0185, seg=12, cls='small')
        # 受け皿（亜鉛めっき）：手前へ張り出す板、両わきの立ち上がり、真ん中の止め金具（細長い枠）とボルト
        g.box('galv', -0.31, 0.31, FY - 0.17, D / 2, 0.0, 0.006, bev=0.001)
        for s in (-1, 1):
            g.box('galv', s * 0.31 - 0.002, s * 0.31 + 0.002, FY - 0.17, D / 2, 0.0, 0.022, bev=0.001)
        g.box('galv', -0.31, 0.31, FY - 0.172, FY - 0.168, -0.012, 0.006, bev=0.001)
        lx = X(1030)
        g.holed('sus', [(lx - 0.02, FY - 0.004), (lx + 0.022, FY - 0.004), (lx + 0.011, FY - 0.155), (lx - 0.006, FY - 0.155)],
                [[(lx - 0.013, FY - 0.012), (lx + 0.015, FY - 0.012), (lx + 0.0065, FY - 0.148), (lx - 0.0015, FY - 0.148)]], 'z', 0.0085, 0.0125)
        g.box('sus', lx - 0.012, lx + 0.016, FY - 0.085, FY - 0.068, 0.0062, 0.0085, bev=0.0005, cls='small')
        hexbolt(g, lx + 0.002, 0.0085, FY - 0.0765, s=0.0055, d=(0, 0, 1))
        g.box('sus', lx - 0.016, lx + 0.018, FY - 0.006, FY + 0.012, 0.006, 0.03, bev=0.001, cls='small')         # 止め金具の立ち上がり
        g.box('sus', X(858), X(884), FY - 0.03, FY + 0.01, 0.0062, 0.0085, bev=0.0005, cls='small')               # ストッパーのレバー
        g.box('sus', X(858), X(864), FY - 0.03, FY - 0.024, 0.006, 0.024, bev=0.0005, cls='small')
        # 名札（大きい札）と、前面のデカール、受け皿の「接続」の札
        tagplate(g, 'unit', X(330), X(738), Z(390), Z(275), FY - 0.0026)
        g.quad('label', (X(268), FY - 0.0032, Z(1290)), (X(1705) - X(268), 0, 0), (0, 0, Z(205) - Z(1290)), uv=cuv(0, 0, 1024, 773, WC, HC), cls='decal')
        g.quad('label', (lx + 0.03, FY - 0.075, 0.0064), (0.036, 0, 0), (0, 0.02, 0), uv=cuv(0, 780, 160, 868, WC, HC), cls='decal')


# ====================================================================================================
# 引出形の真空電磁接触器と台。写真 IMG_3617：x=(px−747.5)×0.4017mm、z=0.475−(py−340)×0.4017mm
# ====================================================================================================
def build_vmc(g):
    W, D, H = 0.46, 0.50, 0.475; FY = -D / 2; K = 0.0004017
    X = lambda p: (p - 747.5) * K; Z = lambda p: 0.475 - (p - 340) * K
    WC, HC = 1024, 1066                                   # Canvas：上 966px が前面、下 100px が台の札
    with g.use(group='vmc'):
        g.box('ubody', -W / 2, W / 2, FY, D / 2, 0.041, H, bev=0.007, seg=2)
        # 前板：差し込みプラグの口・釈放レバーの溝・ロックの溝・入切の表示窓は、本当の穴
        holes = [rect(X(412), X(660), Z(1380), Z(1250)), rect(X(1012), X(1050), Z(1395), Z(1265)), rect(X(840), X(862), Z(1415), Z(1350)), rect(X(398), X(498), Z(1238), Z(1183)), rect(X(757), X(855), Z(1340), Z(1310))]
        g.holed('ubody', rrect(W - 0.006, H - 0.041 - 0.004, 0.006, 4, 0, (H + 0.041) / 2), holes, 'y', FY - 0.010, FY + 0.002)
        g.box('black', X(405), X(667), FY - 0.002, FY + 0.001, Z(1386), Z(1244), bev=0)
        g.box('black', X(1006), X(1056), FY - 0.002, FY + 0.001, Z(1400), Z(1260), bev=0)
        g.box('black', X(834), X(868), FY - 0.002, FY + 0.001, Z(1420), Z(1345), bev=0)
        # 銘板のリベット、六角ボルト、なべ小ねじ
        for (px, py) in ((575, 368), (912, 368), (578, 640), (905, 640)): g.sphere('steel', (X(px), FY - 0.010, Z(py)), 0.0028, sy=0.5, u=10, v=6, cls='small')
        for (px, py) in ((322, 740), (1160, 742)): g.bolt('brassy', (X(px), FY - 0.010, Z(py)), (0, -1, 0), s=0.0065, washer=True)
        for (px, py) in ((325, 798), (1157, 800), (350, 1283), (1127, 1290)):
            g.cyl('steel', (X(px), FY - 0.010, Z(py)), (X(px), FY - 0.011, Z(py)), 0.0078, seg=14, cls='small'); screw(g, X(px), Z(py), FY - 0.011, r=0.0048)
        # 取っ手2本
        handle(g, X(261), Z(1283), Z(985), FY - 0.010); handle(g, X(1222), Z(1285), Z(990), FY - 0.010)
        # 差し込みプラグ4個（赤・青・黄・緑）と黄色の線、灰色の保護チューブ
        plugs = (('red', 415, 520, 1258, 1318), ('blue', 545, 655, 1258, 1322), ('yel', 415, 520, 1318, 1372), ('green', 548, 655, 1322, 1378))
        ends = []
        for (col, a, b, c, d) in plugs:
            x0, x1, z0, z1 = X(a) + 0.001, X(b) - 0.001, Z(d) + 0.001, Z(c) - 0.001
            g.box(col, x0, x1, FY - 0.030, FY - 0.002, z0, z1, bev=0.003, seg=2)
            g.box(col, x0 + 0.004, x1 - 0.004, FY - 0.034, FY - 0.029, z0 + 0.003, z1 - 0.003, bev=0.0015)
            for xx in (x0 + 0.005, x1 - 0.005): screw(g, xx, z1 - 0.005, FY - 0.030, r=0.0024)
            for k in range(4):
                xs = x0 + 0.008 + k * (x1 - x0 - 0.016) / 3
                P = [(xs, FY - 0.034, (z0 + z1) / 2), (xs, FY - 0.046, (z0 + z1) / 2 - 0.008), (xs - 0.004, FY - 0.052, 0.062 - k * 0.002), (X(470) + (xs - X(470)) * 0.25, FY - 0.055, 0.036)]
                g.cable('wy', P, 0.0024, per=4, seg=6, cls='small')
                g.cyl('white', (P[1][0], P[1][1] - 0.002, P[1][2] - 0.004), (P[1][0] - 0.001, P[1][1] - 0.004, P[1][2] - 0.014), 0.0033, seg=8, cls='small')
        bx = X(470)
        g.cable('wrap', [(bx, FY - 0.055, 0.04), (bx - 0.012, FY - 0.07, 0.022), (bx - 0.06, FY - 0.10, 0.024), (bx - 0.14, FY - 0.10, 0.03), (bx - 0.2, FY - 0.05, 0.05), (bx - 0.215, FY + 0.03, 0.09)], 0.017, per=5, seg=12)
        g.cyl('white', (bx - 0.001, FY - 0.057, 0.038), (bx - 0.004, FY - 0.061, 0.033), 0.0185, seg=12, cls='small')
        # 釈放のレバー（真ちゅう色）と、ロックのレバー
        g.box('brass', X(1022), X(1040), FY - 0.016, FY, Z(1320), Z(1278), bev=0.0015, cls='small')
        g.box('sus', X(846), X(856), FY - 0.014, FY, Z(1468), Z(1365), bev=0.0008, cls='small')
        # 台（クロメート）：前の横はりと両端のローラ、底板、両わきの立ち上がり、インタロックの板、位置決めのピン
        g.box('chrom', X(300), X(1165), FY - 0.03, FY + 0.01, 0.014, 0.039, bev=0.002)
        for px in (290, 1168):
            s = -1 if px < 700 else 1
            g.cyl('copper', (X(px) - 0.004, FY - 0.011, 0.027), (X(px) + 0.004, FY - 0.011, 0.027), 0.012, seg=20, cls='small')
            g.cyl('steel', (X(px) + s * 0.004, FY - 0.011, 0.027), (X(px) + s * 0.020, FY - 0.011, 0.027), 0.0095, seg=16, bev=0.0015)
        g.box('chrom', -0.262, 0.262, FY - 0.20, D / 2, -0.004, 0.0, bev=0.0008)
        for s in (-1, 1):
            g.prism('chrom', [(FY - 0.20, 0.0), (D / 2, 0.0), (D / 2, 0.03), (FY - 0.03, 0.03), (FY - 0.185, 0.012), (FY - 0.20, 0.012)], 'x', s * 0.262 - 0.0015, s * 0.262 + 0.0015, bev=0)
            g.box('chrom', s * 0.262 - 0.012, s * 0.262 + 0.012, FY - 0.19, FY - 0.15, 0.0, 0.0025, bev=0.0005, cls='small')
        ix0, ix1 = X(760), X(1100)
        g.holed('chrom', [(ix0 + 0.02, FY - 0.03), (ix1, FY - 0.03), (ix1, FY - 0.125), (ix0 + 0.02, FY - 0.125), (ix0 + 0.02, FY - 0.09), (ix0, FY - 0.09), (ix0, FY - 0.045), (ix0 + 0.02, FY - 0.045)],
                [rect(X(872), X(900), FY - 0.066, FY - 0.05)], 'z', 0.004, 0.0065)
        g.box('chrom', ix0 + 0.03, ix1 - 0.005, FY - 0.125, FY - 0.09, 0.0065, 0.009, bev=0.0005, cls='small')
        g.sphere('steel', (X(795), FY - 0.06, 0.0065), 0.0045, sz=0.5, u=10, v=6, cls='small')
        for (xx, yy) in ((-0.13, FY - 0.135), (0.122, FY - 0.15)):
            g.lathe('brass', (xx, yy, 0.0), (0, 0, 1), [(0, 0.008), (0.006, 0.008), (0.014, 0.0045), (0.0165, 0.0)], seg=16, cls='small')
        hexbolt(g, 0.168, 0.0, FY - 0.115, s=0.008, d=(0, 0, 1)); hexbolt(g, -0.16, 0.0, FY - 0.03 - 0.02, s=0.005, d=(0, 0, 1))
        # 名札、前面のデカール、台の「運転／試験」の札と赤い矢印
        tagplate(g, 'vmc', X(1070), X(1265), Z(475), Z(385), FY - 0.0101)
        g.quad('label', (-0.23, FY - 0.0107, Z(1420)), (0.46, 0, 0), (0, 0, Z(340) - Z(1420)), uv=cuv(0, 0, 1024, 966, WC, HC), cls='decal')
        g.quad('label', (X(665), FY - 0.135, 0.0004), (X(737) - X(665), 0, 0), (0, 0.085, 0), uv=cuv(0, 970, 70, 1062, WC, HC), cls='decal')
        g.quad('label', (X(680), FY - 0.0304, 0.016), (0.02, 0, 0), (0, 0, 0.02), uv=cuv(80, 972, 170, 1062, WC, HC), cls='decal')


# ====================================================================================================
# 電磁接触器（補助接点つき）。写真 IMG_3603：x=(px−595)×0.1833mm、z=0.118−(py−635)×0.1833mm。裏（取付面）が y=0
# ====================================================================================================
def build_mc(g):
    K = 0.0001833; X = lambda p: (p - 595) * K; Z = lambda p: 0.118 - (p - 635) * K
    FT, FM = -0.074, -0.086                                # 端子の段の前面、真ん中の段の前面
    wells = (-0.0262, 0.0, 0.0262)
    with g.use(group='mc'):
        g.box('mcream', -0.044, 0.044, -0.060, 0.0, 0.0, 0.118, bev=0.002)
        for (z0, z1, zc) in ((Z(780), 0.118, Z(705)), (0.0, Z(1175), Z(1225))):
            g.holed('mcream', rect(-0.044, 0.044, z0, z1), [circ(x, zc, 0.0058, 20) for x in wells], 'y', FT, -0.060)
            for x in wells:
                g.cyl('steeld', (x, -0.0625, zc), (x, -0.0605, zc), 0.0056, seg=16, cls='small'); screw(g, x, zc, -0.0625, r=0.0042)
        # 真ん中の段（札の面）と、黒い可動部の窓、白いふた
        g.box('mcream', -0.044, 0.044, FM, -0.060, Z(1175), Z(780), bev=0.0018, seg=2)
        g.box('mcream', X(497), X(698), FM - 0.003, FM, Z(1103), Z(835), bev=0.0012)
        g.box('black', X(507), X(688), FM - 0.0055, FM - 0.002, Z(1093), Z(868), bev=0.001)
        g.box('white', X(510), X(685), FM - 0.007, FM - 0.002, Z(868), Z(842), bev=0.001)
        g.box('mcream', X(585), X(606), FM - 0.0075, FM - 0.006, Z(862), Z(850), bev=0, cls='small')
        for px in (535, 660): g.box('black', X(px - 14), X(px + 14), FM - 0.011, FM - 0.005, Z(1040), Z(880), bev=0.001)
        g.box('black', X(520), X(675), FM - 0.012, FM - 0.005, Z(1062), Z(1030), bev=0.001)
        g.box('blackd', X(552), X(642), FM - 0.0075, FM - 0.0055, Z(1010), Z(905), bev=0.0006, cls='small')
        g.box('black', X(566), X(580), FM - 0.009, FM - 0.007, Z(985), Z(935), bev=0, cls='small'); g.box('black', X(614), X(628), FM - 0.009, FM - 0.007, Z(985), Z(935), bev=0, cls='small')
        # 両わきの補助接点（黒い箱と、白い端子の口・ねじ）
        for s in (-1, 1):
            g.box('black', s * 0.044, s * 0.0575, -0.071, -0.008, Z(1160), Z(790), bev=0.0012)
            for (pa, pb) in ((800, 852), (1065, 1130)):
                g.holed('mcream', rect(s * 0.0448, s * 0.0572, Z(pb), Z(pa)), [circ(s * 0.051, (Z(pa) + Z(pb)) / 2, 0.0036, 14)], 'y', -0.076, -0.070)
                screw(g, s * 0.051, (Z(pa) + Z(pb)) / 2, -0.0712, r=0.0028)
        # 前面のデカール（真ん中の段。Canvas 512×421）と、名札
        g.quad('label', (-0.044, FM - 0.0004, Z(1175)), (0.088, 0, 0), (0, 0, Z(780) - Z(1175)), uv=(0, 0, 1, 1), cls='decal')
        g.quad('tag', (X(375), FM - 0.0007, Z(842)), (X(527) - X(375), 0, 0), (0, 0, Z(792) - Z(842)), uv=(0, 0, 1, 1), cls='decal')
    # 主回路の線（灰色のより線に 赤・白・青 の端末の被覆）と、補助接点の黄色の制御線（白い番号札）
    with g.use(group='mcw', cls='small'):
        for sgn in (1, -1):
            zt = 0.118 if sgn > 0 else 0.0
            for x, col in zip(wells, ('red', 'wwhite', 'blue')):
                g.cyl(col, (x, -0.0655, zt - sgn * 0.006), (x, -0.0655, zt + sgn * 0.024), 0.0058, r2=0.0050, seg=12)
                g.cable('wgrey', [(x, -0.0655, zt + sgn * 0.022), (x * 0.95, -0.066, zt + sgn * 0.045), (x * 0.5, -0.05, zt + sgn * 0.078), (x * 0.18, -0.012, zt + sgn * 0.086), (x * 0.1, 0.012, zt + sgn * 0.078)], 0.0046, per=5, seg=8)
            g.torus('rubber', (0, 0.0005, zt + sgn * 0.08), (0, 1, 0), 0.016, 0.005, seg=20, rseg=8)
            g.cyl('white', (-0.011, -0.03, zt + sgn * 0.0855), (0.011, -0.03, zt + sgn * 0.0855), 0.0022, seg=6)
            for s in (-1, 1):
                zc = (Z(800) + Z(852)) / 2 if sgn > 0 else (Z(1065) + Z(1130)) / 2
                P = [(s * 0.051, -0.073, zc + sgn * 0.004), (s * 0.052, -0.074, zc + sgn * 0.03), (s * 0.055, -0.07, zt + sgn * 0.05), (s * 0.058, -0.06, zt + sgn * 0.11)]
                g.cable('wy', P, 0.0019, per=4, seg=6)
                g.cyl('white', (s * 0.0518, -0.0742, zc + sgn * 0.016), (s * 0.0535, -0.073, zc + sgn * 0.044), 0.0029, seg=8)


# ====================================================================================================
# 漏電遮断器（3極）。写真 IMG_3602：x=(px−720)×0.1011mm、z=0.0775+(878−py)×0.1011mm。裏が y=0
# ====================================================================================================
def build_elb(g):
    K = 0.0001011; X = lambda p: (p - 720) * K; Z = lambda p: 0.0775 + (878 - p) * K
    with g.use(group='elb'):
        g.box('egrey', -0.045, 0.045, -0.050, 0.0, 0.030, 0.125, bev=0.0015)
        # 上下の端子の段（一段低い）：相の間の仕切りと、端子ねじ
        for (z0, z1) in ((0.0, 0.030), (0.125, 0.155)):
            g.box('egrey', -0.045, 0.045, -0.034, 0.0, z0, z1, bev=0.001)
            for x in (-0.0445, -0.015, 0.015, 0.0445): g.box('egrey', x - 0.0012, x + 0.0012, -0.048, -0.034, z0, z1, bev=0.0004, cls='small')
            for x in (-0.03, 0.0, 0.03):
                zc = (z0 + z1) / 2
                g.box('steel', x - 0.008, x + 0.008, -0.0365, -0.034, zc - 0.009, zc + 0.009, bev=0.0005, cls='small'); screw(g, x, zc, -0.0365, r=0.0048)
        # 真ん中の高い段（札の面）。ハンドルの溝は本当の穴
        hx0, hx1, hz0, hz1 = X(655), X(800), Z(978), Z(742)
        g.holed('egrey', rect(-0.045, 0.045, Z(1140), Z(615)), [rect(hx0, hx1, hz0, hz1)], 'y', -0.068, -0.050)
        g.holed('ewhite', rect(X(608), X(842), Z(1132), Z(622)), [rect(hx0, hx1, hz0, hz1)], 'y', -0.0705, -0.068)
        g.box('black', hx0 - 0.001, hx1 + 0.001, -0.053, -0.050, hz0 - 0.001, hz1 + 0.001, bev=0)
        g.box('red', hx0, hx1, -0.0625, -0.052, Z(858), Z(746), bev=0.0006)                                       # 入の表示（赤）
        g.box('black', hx0 + 0.0008, hx1 - 0.0008, -0.0815, -0.060, Z(700), Z(606), bev=0.0018, seg=2)              # ハンドルの頭
        g.box('black', hx0 + 0.0015, hx1 - 0.0015, -0.072, -0.052, Z(752), Z(690), bev=0.001)
        # 漏電表示ボタン（黄）・テストボタン（灰）・赤い小さな表示
        bx, bz = X(955), Z(715)
        g.lathe('yel', (bx, -0.068, bz), (0, -1, 0), [(0, 0.0027), (0.0012, 0.0027), (0.002, 0.002), (0.0023, 0.0)], seg=16, cls='small')
        tx, tz = X(950), Z(1055)
        g.lathe('egrey', (tx, -0.068, tz), (0, -1, 0), [(0, 0.0042), (0.0006, 0.0042), (0.0006, 0.0034)], seg=18, cls='small', cap1=False)
        g.lathe('grip', (tx, -0.068, tz), (0, -1, 0), [(0, 0.0033), (0.0012, 0.0033), (0.0018, 0.0026), (0.002, 0.0)], seg=18, cls='small')
        g.box('red', X(1098), X(1155), -0.0688, -0.068, Z(1056), Z(1030), bev=0.0003, cls='small')
        # デカール：札の面（Canvas 1024×604）と、ハンドルの頭の定格の文字、下の回路の名札
        g.quad('label', (-0.045, -0.0709, Z(1140)), (0.09, 0, 0), (0, 0, Z(615) - Z(1140)), uv=(0, 0, 1, 1), cls='decal')
        g.quad('label', (hx0 + 0.0015, -0.0819, Z(696)), (hx1 - hx0 - 0.003, 0, 0), (0, 0, Z(612) - Z(696)), uv=cuv(430, 0, 594, 92, 1024, 604), cls='decal')
        g.quad('tag', (X(652), -0.0711, Z(1126)), (X(825) - X(652), 0, 0), (0, 0, Z(1072) - Z(1126)), uv=(0, 0, 1, 1), cls='decal')


# ====================================================================================================
# 小形の配線用遮断器（2極）。制御の棚に並ぶ白いもの。写真は遠目だけ（IMG_3624 ほか）で、細部は推測。裏が y=0
# ====================================================================================================
def build_cp(g):
    with g.use(group='cp'):
        g.box('mcream', -0.025, 0.025, -0.044, 0.0, 0.0, 0.095, bev=0.0015)
        for (z0, z1) in ((0.0, 0.02), (0.075, 0.095)):
            g.holed('mcream', rect(-0.025, 0.025, z0, z1), [circ(x, (z0 + z1) / 2, 0.0052, 16) for x in (-0.012, 0.012)], 'y', -0.054, -0.044)
            for x in (-0.012, 0.012): screw(g, x, (z0 + z1) / 2, -0.0455, r=0.0038)
        g.holed('mcream', rect(-0.025, 0.025, 0.02, 0.075), [rect(-0.006, 0.006, 0.037, 0.06)], 'y', -0.064, -0.044)
        g.box('black', -0.0065, 0.0065, -0.047, -0.045, 0.036, 0.061, bev=0)
        g.box('black', -0.0052, 0.0052, -0.074, -0.05, 0.05, 0.059, bev=0.0012)                                    # レバー（入＝上）
        g.quad('label', (-0.025, -0.0643, 0.02), (0.05, 0, 0), (0, 0, 0.055), uv=(0, 0, 1, 1), cls='decal')
        g.quad('tag', (-0.022, -0.0646, 0.0635), (0.044, 0, 0), (0, 0, 0.0105), uv=(0, 0, 1, 1), cls='decal')


# ====================================================================================================
# 差し込み式の小形リレー（黒いソケット＋透明のケース）。写真は遠目だけで、細部は推測。裏が y=0
# ====================================================================================================
def build_relay(g):
    with g.use(group='relay'):
        w = 0.0115
        g.box('black', -w, w, -0.018, 0.0, 0.0, 0.074, bev=0.001)
        g.box('black', -w, w, -0.026, -0.018, 0.014, 0.060, bev=0.001)
        for (zc, yy) in ((0.006, -0.018), (0.068, -0.018), (0.0185, -0.026), (0.0555, -0.026)):
            for x in (-0.0056, 0.0056):
                g.box('steel', x - 0.0036, x + 0.0036, yy - 0.0008, yy, zc - 0.0036, zc + 0.0036, bev=0, cls='small'); screw(g, x, zc, yy - 0.0008, r=0.0024)
        # 透明のケースと中身（銅色のコイル・白い枠・接点の板）
        g.box('white', -0.008, 0.008, -0.031, -0.026, 0.026, 0.050, bev=0.0006, cls='small')
        g.cyl('copper', (0, -0.033, 0.031), (0, -0.050, 0.031), 0.0068, seg=14, cls='small')
        g.box('white', -0.0075, 0.0075, -0.052, -0.050, 0.024, 0.039, bev=0.0004, cls='small')
        g.box('steel', -0.007, 0.007, -0.054, -0.031, 0.0405, 0.0415, bev=0, cls='small')
        for x in (-0.004, 0.004): g.box('brassy', x - 0.0012, x + 0.0012, -0.052, -0.033, 0.043, 0.0475, bev=0, cls='small')
        g.box('orange', -0.0085, 0.0085, -0.0583, -0.0578, 0.045, 0.050, bev=0, cls='small')                       # 前面の色の札
        with g.use(cls='glass'):
            g.box('acryl', -0.0105, 0.0105, -0.058, -0.026, 0.023, 0.051, bev=0.0015)
        g.cable('steel', [(-0.0112, -0.02, 0.03), (-0.0112, -0.059, 0.036), (0.0112, -0.059, 0.036), (0.0112, -0.02, 0.03)], 0.0005, per=2, seg=4, cls='small')   # 押さえの針金


# ====================================================================================================
# 端子台（10極。ピッチ 9.5mm）とヒューズホルダ。細部は推測。裏が y=0
# ====================================================================================================
def build_tb(g):
    n, p = 10, 0.0095; L = n * p
    with g.use(group='tb'):
        g.box('black', -L / 2 - 0.003, L / 2 + 0.003, -0.022, 0.0, 0.0, 0.045, bev=0.001)
        g.box('black', -L / 2 - 0.003, L / 2 + 0.003, -0.034, -0.022, 0.0165, 0.0285, bev=0.0008)
        g.box('white', -L / 2, L / 2, -0.0346, -0.034, 0.0185, 0.0265, bev=0, cls='small')                          # 番号の札の帯
        for i in range(n + 1): g.box('black', -L / 2 + i * p - 0.0009, -L / 2 + i * p + 0.0009, -0.030, -0.022, 0.001, 0.044, bev=0.0003, cls='small')
        for i in range(n):
            x = -L / 2 + (i + 0.5) * p
            for zc in (0.008, 0.037):
                g.box('steel', x - 0.0034, x + 0.0034, -0.0228, -0.022, zc - 0.0038, zc + 0.0038, bev=0, cls='small'); screw(g, x, zc, -0.0228, r=0.0025)
    with g.use(group='fuse'):
        g.box('fwhite', -0.018, 0.018, -0.03, 0.0, 0.0, 0.078, bev=0.0015)
        g.box('fwhite', -0.018, 0.018, -0.048, -0.03, 0.016, 0.062, bev=0.002, seg=2)
        g.lathe('fwhite', (0, -0.048, 0.039), (0, -1, 0), [(0, 0.014), (0.004, 0.014), (0.006, 0.0125), (0.0125, 0.0125), (0.0145, 0.0105), (0.0145, 0.0)], seg=24)
        g.cyl('glassd', (0, -0.0624, 0.039), (0, -0.0628, 0.039), 0.0038, seg=14, cls='small')
        for k in range(12):
            a = k * math.pi / 6
            g.box('fwhite', 0.0128 * math.cos(a) - 0.0007, 0.0128 * math.cos(a) + 0.0007, -0.060, -0.053, 0.039 + 0.0128 * math.sin(a) - 0.0007, 0.039 + 0.0128 * math.sin(a) + 0.0007, bev=0, cls='small')
        for zc in (0.007, 0.071):
            g.box('steel', -0.006, 0.006, -0.0308, -0.03, zc - 0.005, zc + 0.005, bev=0, cls='small'); screw(g, 0, zc, -0.0308, r=0.0034)


# ====================================================================================================
# 穴あきの配線ダクト（長さ 0.24m、幅 50mm、深さ 60mm。縦に置いた向き：長さが z）。側面の切れ込みは本当の穴。中に黄色い線
# ====================================================================================================
def build_duct(g):
    L, w, d, pit = 0.24, 0.025, 0.06, 0.012
    with g.use(group='duct'):
        slots = [rect(-d + 0.010, -0.012, k * pit + 0.003, k * pit + 0.009) for k in range(int(L / pit))]
        for s in (-1, 1):
            g.holed('duct', rect(-d, 0.0, 0.0, L), slots, 'x', s * w - 0.0008, s * w + 0.0008)
        g.box('duct', -w, w, -0.0015, 0.0, 0.0, L, bev=0)
        g.box('duct', -w - 0.0018, w + 0.0018, -d - 0.002, -d, 0.0, L, bev=0.0006)                                  # ふた
        for s in (-1, 1): g.box('duct', s * (w + 0.0018) - 0.0008, s * (w + 0.0018) + 0.0008, -d, -d + 0.008, 0.0, L, bev=0, cls='small')
        g.box('ductin', -w + 0.001, w - 0.001, -0.004, -0.0015, 0.0, L, bev=0, cls='small')
        with g.use(cls='small'):
            for (x, y, r) in ((-0.012, -0.022, 0.006), (0.004, -0.03, 0.0075), (0.014, -0.016, 0.005), (-0.004, -0.044, 0.006), (0.013, -0.045, 0.0055), (-0.015, -0.04, 0.005)):
                g.cyl('wy', (x, y, 0.0), (x, y, L), r, seg=7, cap=False)


# ---------- 部品を、離して並べる（陰影が隣へ写らないように） ----------
g = GB()
PARTS = [('vcb', build_vcb, 0.11, 1.0, 'floor'), ('unit', build_unit, 0.10, 1.0, 'floor'), ('vmc', build_vmc, 0.10, 1.0, 'floor'),
         ('mc', build_mc, 0.022, 2.6, 'wall'), ('elb', build_elb, 0.022, 2.6, 'wall'), ('cp', build_cp, 0.018, 2.6, 'wall'),
         ('relay', build_relay, 0.012, 3.0, 'wall'), ('tb', build_tb, 0.012, 2.6, 'wall'), ('duct', build_duct, 0.02, 1.6, 'wall')]
GINFO = {}
for i, (name, fn, aod, dens, ctx) in enumerate(PARTS):
    g.jit = 0.0016 if dens == 1.0 else 0.0003
    fn(g)
    loc = (i * 1.6, 0, 0)
    for grp in ({'mc': ('mc', 'mcw'), 'tb': ('tb', 'fuse')}.get(name, (name,))):
        gl = (loc[0], 0.5, 0) if grp == 'fuse' else (loc[0], -0.5, 0) if grp == 'mcw' else loc
        g.roots_loc[grp] = gl; GINFO[grp] = dict(aod=aod, dens=dens, ctx=ctx, loc=gl)
ONLY = arg('--only')
objs = g.finalize(mats)
log('objects', len(objs), 'tris', g.tris)
for ob in objs:
    if ob['cls'] in ('big', 'small', 'glass'):
        md = ob.modifiers.new('wn', 'WEIGHTED_NORMAL'); md.keep_sharp = True; md.weight = 60; md.mode = 'FACE_AREA'
        bpy.context.view_layer.objects.active = ob; ob.select_set(True); bpy.ops.object.modifier_apply(modifier='wn'); ob.select_set(False)
bpy.context.view_layer.update()

bigs = [o for o in objs if o['cls'] == 'big']; smalls = [o for o in objs if o['cls'] == 'small']
if '--noao' not in ARGS:
    import xatlas
    atlas = xatlas.Atlas(); meta = []
    for ob in bigs:
        me = ob.data; me.calc_loop_triangles(); nt = len(me.loop_triangles)
        tl = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get('loops', tl)
        vi = np.empty(len(me.loops), np.int32); me.loops.foreach_get('vertex_index', vi)
        co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3) * GINFO[ob['grp']]['dens']   # 小さい部品は、陰影の画像の中で大きめに取る
        atlas.add_mesh(co, vi[tl].reshape(-1, 3).astype(np.uint32)); meta.append((ob, tl.reshape(-1, 3)))
    co_ = xatlas.ChartOptions(); co_.max_iterations = 1
    po = xatlas.PackOptions(); po.resolution = AO_SIZE; po.padding = 3; po.bilinear = True
    atlas.generate(co_, po); log('xatlas', atlas.chart_count, 'charts', atlas.width, atlas.height)
    for i, (ob, tl) in enumerate(meta):
        vmap, idx, uvs = atlas[i]; me = ob.data
        if not me.uv_layers: me.uv_layers.new(name='UV0')
        layer = me.uv_layers.new(name='LM'); uv = np.zeros((len(me.loops), 2), np.float32); uv[tl.ravel()] = uvs[idx.ravel()]; layer.data.foreach_set('uv', uv.ravel())
    w = bpy.data.worlds.new('w'); sc.world = w
    # まわりの面（床に置く部品は床、板に付ける部品は取付板）。陰影の焼き込みにだけ使う
    ctxs = []
    for grp, inf in GINFO.items():
        x, y, _ = inf['loc']
        if inf['ctx'] == 'floor': bpy.ops.mesh.primitive_plane_add(size=1.4, location=(x, y, -0.0045 if grp == 'vmc' else -0.0005))
        else: bpy.ops.mesh.primitive_plane_add(size=0.8, location=(x, y + 0.0005, 0.05), rotation=(math.pi / 2, 0, 0))
        ctxs.append(bpy.context.object)
    sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = False
    sc.render.bake.margin = 6; sc.render.bake.use_selected_to_active = False
    img = bpy.data.images.new('AO', AO_SIZE, AO_SIZE, alpha=False); img.colorspace_settings.name = 'Non-Color'; img.generated_color = (1, 1, 1, 1)
    for m in MATS.values():
        nt = m.node_tree; nd = nt.nodes.new('ShaderNodeTexImage'); nd.name = '_bake'; nd.image = img; nt.nodes.active = nd
    for ob in smalls:
        ca = ob.data.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER'); ob.data.color_attributes.active_color = ca; ob.data.color_attributes.render_color_index = 0
    for ob in bigs: ob.data.uv_layers.active = ob.data.uv_layers['LM']; ob.data.uv_layers['LM'].active_render = True
    first = True
    for aod in sorted({inf['aod'] for inf in GINFO.values()}, reverse=True):      # 陰影の届く距離は、部品の大きさごとに変える
        try: w.light_settings.distance = aod
        except Exception as e: log('ao dist', e)
        grp = {k for k, inf in GINFO.items() if inf['aod'] == aod}
        sel = [o for o in bigs if o['grp'] in grp]
        if sel:
            bpy.ops.object.select_all(action='DESELECT')
            for ob in sel: ob.select_set(True)
            bpy.context.view_layer.objects.active = sel[0]
            sc.render.bake.target = 'IMAGE_TEXTURES'; sc.render.bake.use_clear = first; first = False
            log('bake AO', aod, sorted(grp)); bpy.ops.object.bake(type='AO')
        sel = [o for o in smalls if o['grp'] in grp]
        if sel:
            bpy.ops.object.select_all(action='DESELECT')
            for ob in sel: ob.select_set(True)
            bpy.context.view_layer.objects.active = sel[0]
            sc.render.bake.target = 'VERTEX_COLORS'; sc.render.bake.use_clear = True; bpy.ops.object.bake(type='AO')
    for ob in smalls:      # 頂点の陰影は、くぼみの中のねじなどが真っ黒にならないよう、明るい側へ寄せる
        d = ob.data.color_attributes['Col'].data; a = np.empty(len(d) * 4, np.float32); d.foreach_get('color', a); a = a.reshape(-1, 4); a[:, :3] = 0.42 + 0.58 * a[:, :3]; d.foreach_set('color', a.ravel())
    img.filepath_raw = os.path.join(OUT, 'ao.png'); img.file_format = 'PNG'; img.save(); log('AO saved')
    for o in ctxs: bpy.data.objects.remove(o)
    for m in MATS.values(): m.node_tree.nodes.remove(m.node_tree.nodes['_bake'])
    for ob in bigs: ob.data.uv_layers.active = ob.data.uv_layers[0]; ob.data.uv_layers[0].active_render = True

# 書き出しの前に、部品を原点へ戻す（GLB の中では、どの部品も自分の原点が基準）
for ob in bpy.data.objects:
    if ob.type == 'EMPTY': ob.location = (0, 0, 0)
bpy.ops.object.select_all(action='DESELECT')
path = os.path.join(OUT, 'parts.glb')
kw = dict(filepath=path, export_format='GLB', export_yup=True, export_apply=False, export_texcoords=True, export_normals=True, export_materials='EXPORT', export_cameras=False, export_lights=False, export_animations=False)
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
for k, v in (('export_vertex_color', 'ACTIVE'), ('export_all_vertex_colors', False), ('export_active_vertex_color_when_no_material', True), ('export_image_format', 'NONE'), ('export_tangents', False), ('export_extras', False)):
    if k in props: kw[k] = v
bpy.ops.export_scene.gltf(**kw)
log('exported', path, os.path.getsize(path) // 1024, 'KB')
