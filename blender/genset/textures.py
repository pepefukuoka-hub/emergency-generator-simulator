# textures.py — 模様（縞鋼板・鋳肌・パンチング・金網）とラベルのアトラスを作る
#   使い方: python textures.py   → out/ に PNG/WebP と decals.json
# メーカー名・形式・製造番号は入れない。ラベルの細かい字は、読めない灰色の線にする。
import os, json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
def font(sz): return ImageFont.truetype(FONT, sz)


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength; dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    n = np.dstack([-dx, dy, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    return Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8), 'RGB')


def checker():
    # 縞鋼板：60mm 角のタイルに、±45°の菱形の突起を互い違いに 4 個
    N = 128; mm = 60.0 / N
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32); h = np.zeros((N, N), np.float32)
    for i in range(2):
        for j in range(2):
            cx, cy = (i + 0.5) * N / 2, (j + 0.5) * N / 2; a = math.radians(45 if (i + j) % 2 == 0 else -45)
            for ox in (-N, 0, N):
                for oy in (-N, 0, N):
                    u = ((xx - cx - ox) * math.cos(a) + (yy - cy - oy) * math.sin(a)) * mm; v = (-(xx - cx - ox) * math.sin(a) + (yy - cy - oy) * math.cos(a)) * mm
                    d = np.sqrt(np.maximum(np.abs(u) - 9.0, 0) ** 2 + v ** 2)   # カプセル（長さ 18+5mm、幅 5mm）
                    h = np.maximum(h, np.clip(1.0 - d / 2.8, 0, 1) ** 0.7)
    normal_from_height(h, 2.2).save(os.path.join(OUT, 'checker_n.png'))


def cast():
    # 鋳肌・塗装のゆず肌：周期ノイズ（0.25m タイル）
    N = 256; rng = np.random.default_rng(3)
    f = np.fft.fftfreq(N)[:, None] ** 2 + np.fft.fftfreq(N)[None, :] ** 2
    def band(lo, hi):
        w = np.fft.fft2(rng.standard_normal((N, N))); m = (f > lo ** 2) & (f < hi ** 2)
        r = np.real(np.fft.ifft2(w * m)); return r / (r.std() + 1e-9)
    h = band(0.03, 0.12) * 0.6 + band(0.12, 0.35) * 0.4
    normal_from_height(h.astype(np.float32), 0.35).save(os.path.join(OUT, 'cast_n.png'))
    # 粗さのむら（低周波）
    r = band(0.004, 0.03) * 0.5 + band(0.03, 0.1) * 0.5
    Image.fromarray(np.clip(128 + r * 28, 0, 255).astype(np.uint8), 'L').save(os.path.join(OUT, 'grunge.png'))


def perf():
    # パンチングメタル：Ø5mm、ピッチ 8mm の千鳥。タイル 8 × 13.856mm
    W, H = 32, 56; img = np.full((H, W), 255, np.uint8); yy, xx = np.mgrid[0:H, 0:W]
    for (cx, cy) in ((0, 0), (W, 0), (W / 2, H / 2), (0, H), (W, H)):
        d = np.sqrt((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2); a = np.clip((d - 9.0) / 1.5 + 0.5, 0, 1)
        img = np.minimum(img, (a * 255).astype(np.uint8))
    rgba = np.dstack([np.full((H, W, 3), 255, np.uint8), img]); Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, 'perf.png'))


def mesh():
    # ファンガードの金網（エキスパンドメタル風）：菱形 24 × 12mm
    W, H = 64, 32; yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u = (xx + 0.5) / W; v = (yy + 0.5) / H
    d1 = np.abs(((u + v) % 1.0) - 0.5); d2 = np.abs(((u - v) % 1.0) - 0.5)
    a = np.clip((0.085 - np.minimum(d1, d2)) / 0.03 + 0.5, 0, 1)
    rgba = np.dstack([np.full((H, W, 3), 255, np.uint8), (a * 255).astype(np.uint8)]); Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, 'mesh.png'))


def lines(d, x, y, w, n, gap, col=(90, 90, 90), h=3, jitter=True):
    rng = np.random.default_rng(int(x * 7 + y * 13))
    for i in range(n):
        ww = w * (0.55 + 0.45 * rng.random()) if jitter else w
        d.rectangle((x, y + i * gap, x + ww, y + i * gap + h), fill=col)


def decals():
    W = H = 1024; im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); rects = {}
    cur = [4, 4, 0]
    def place(name, w, h):
        if cur[0] + w + 4 > W: cur[0] = 4; cur[1] += cur[2] + 6; cur[2] = 0
        x, y = cur[0], cur[1]; cur[0] += w + 6; cur[2] = max(cur[2], h)
        rects[name] = [x / W, 1 - (y + h) / H, (x + w) / W, 1 - y / H]; return x, y
    # 危険の表示（A4 横）
    x, y = place('kiken', 420, 297); d.rectangle((x, y, x + 419, y + 296), fill=(246, 246, 243, 255))
    cx, cy = x + 210, y + 148; r = 105
    d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=(232, 96, 22, 255), outline=(20, 20, 20, 255))
    d.line([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy), (cx, cy - r)], fill=(20, 20, 20, 255), width=5)
    f = font(74); t = '危険'; tw = d.textlength(t, font=f); d.text((cx - tw / 2, cy - 46), t, font=f, fill=(15, 15, 15, 255))
    # 排気風洞の文字（透明地）
    x, y = place('duct', 360, 96); f = font(76); d.text((x + 6, y + 4), '排気風洞', font=f, fill=(25, 28, 30, 255))
    # 銘板（銀）
    x, y = place('plate_silver', 220, 140); d.rectangle((x, y, x + 219, y + 139), fill=(196, 198, 196, 255), outline=(70, 70, 70, 255), width=3)
    d.rectangle((x + 10, y + 10, x + 100, y + 30), fill=(40, 42, 46, 255)); lines(d, x + 12, y + 44, 190, 6, 14, (60, 60, 62, 255))
    for (bx, by) in ((6, 6), (208, 6), (6, 128), (208, 128)): d.ellipse((x + bx, y + by, x + bx + 6, y + by + 6), fill=(110, 110, 110, 255))
    # 銘板（銅色）
    x, y = place('plate_copper', 160, 150); d.rectangle((x, y, x + 159, y + 149), fill=(168, 118, 96, 255), outline=(90, 60, 50, 255), width=3); lines(d, x + 12, y + 16, 136, 8, 15, (110, 70, 58, 255))
    x, y = place('plate_copper2', 150, 150); d.rectangle((x, y, x + 149, y + 149), fill=(176, 110, 96, 255), outline=(96, 60, 52, 255), width=3)
    # 銘板（濃色）
    x, y = place('plate_dark', 200, 110); d.rectangle((x, y, x + 199, y + 109), fill=(52, 54, 52, 255), outline=(170, 170, 160, 255), width=3); lines(d, x + 12, y + 14, 176, 6, 15, (200, 200, 190, 255))
    # 白い表（注意書き）
    x, y = place('plate_white', 220, 160); d.rectangle((x, y, x + 219, y + 159), fill=(240, 240, 236, 255), outline=(60, 60, 60, 255), width=2)
    for i in range(1, 7): d.line((x + 4, y + i * 22, x + 216, y + i * 22), fill=(120, 120, 120, 255))
    d.line((x + 80, y + 4, x + 80, y + 156), fill=(120, 120, 120, 255)); lines(d, x + 8, y + 8, 60, 7, 22, (70, 70, 70, 255), 4)
    # 黄色い札
    x, y = place('plate_yel', 150, 100); d.rectangle((x, y, x + 149, y + 99), fill=(214, 196, 120, 255), outline=(80, 70, 40, 255), width=2); lines(d, x + 10, y + 12, 130, 6, 13, (70, 60, 40, 255))
    # 警告（三角）
    x, y = place('warn_tri', 190, 120); d.rectangle((x, y, x + 189, y + 119), fill=(244, 244, 240, 255), outline=(40, 40, 40, 255), width=2)
    d.rectangle((x + 2, y + 2, x + 187, y + 24), fill=(224, 120, 30, 255)); d.text((x + 60, y + 2), '警 告', font=font(19), fill=(255, 255, 255, 255))
    d.polygon([(x + 40, y + 34), (x + 72, y + 100), (x + 8, y + 100)], fill=(240, 196, 20, 255), outline=(20, 20, 20, 255)); d.rectangle((x + 37, y + 56, x + 43, y + 80), fill=(20, 20, 20, 255)); d.ellipse((x + 36, y + 86, x + 44, y + 94), fill=(20, 20, 20, 255))
    lines(d, x + 84, y + 38, 96, 6, 12, (70, 70, 70, 255))
    # 警告（回転部）
    x, y = place('warn_rot', 170, 110); d.rectangle((x, y, x + 169, y + 109), fill=(244, 244, 240, 255), outline=(40, 40, 40, 255), width=2)
    d.rectangle((x + 2, y + 2, x + 167, y + 22), fill=(210, 40, 36, 255)); d.text((x + 52, y + 1), '危 険', font=font(18), fill=(255, 255, 255, 255))
    d.ellipse((x + 12, y + 34, x + 72, y + 94), outline=(20, 20, 20, 255), width=9); d.ellipse((x + 34, y + 56, x + 50, y + 72), fill=(20, 20, 20, 255)); lines(d, x + 84, y + 36, 78, 5, 13, (70, 70, 70, 255))
    # 感電注意
    x, y = place('warn_elec', 110, 140); d.rectangle((x, y, x + 109, y + 139), fill=(244, 244, 240, 255), outline=(40, 40, 40, 255), width=2); d.rectangle((x + 2, y + 2, x + 107, y + 24), fill=(210, 40, 36, 255))
    cx, cy = x + 55, y + 70; d.polygon([(cx, cy - 34), (cx + 34, cy), (cx, cy + 34), (cx - 34, cy)], fill=(240, 196, 20, 255), outline=(20, 20, 20, 255))
    d.polygon([(cx + 4, cy - 22), (cx - 10, cy + 2), (cx, cy + 2), (cx - 6, cy + 22), (cx + 10, cy - 4), (cx, cy - 4)], fill=(20, 20, 20, 255)); lines(d, x + 10, y + 112, 90, 2, 11, (70, 70, 70, 255))
    # フィルタの赤ラベル・濃色ラベル
    for nm, col in (('label_red', (214, 52, 40, 255)), ('label_dark', (40, 52, 84, 255))):
        x, y = place(nm, 120, 210); d.rectangle((x, y, x + 119, y + 209), fill=col); d.rectangle((x + 8, y + 10, x + 111, y + 34), fill=(250, 250, 250, 255))
        lines(d, x + 12, y + 50, 96, 9, 16, (255, 235, 230, 255) if nm == 'label_red' else (220, 226, 240, 255))
    # 矢印（透明地）
    x, y = place('arrow', 60, 120); d.rectangle((x + 22, y + 46, x + 38, y + 116), fill=(15, 15, 15, 255)); d.polygon([(x + 30, y + 2), (x + 58, y + 50), (x + 2, y + 50)], fill=(15, 15, 15, 255))
    # 札（常時開）
    x, y = place('tag', 76, 150); d.rounded_rectangle((x, y, x + 75, y + 149), 30, fill=(248, 248, 244, 255), outline=(60, 60, 60, 255), width=2); d.ellipse((x + 32, y + 8, x + 44, y + 20), fill=(60, 60, 60, 255))
    f = font(34)
    for i, ch in enumerate('常時開'): d.text((x + 21, y + 26 + i * 38), ch, font=f, fill=(20, 20, 20, 255))
    # 黄色のステッカー、赤丸
    x, y = place('sticker_yel', 120, 70); d.rectangle((x, y, x + 119, y + 69), fill=(244, 222, 30, 255), outline=(40, 40, 30, 255)); lines(d, x + 10, y + 10, 100, 4, 14, (40, 40, 30, 255), 4)
    x, y = place('sticker_red', 84, 84); d.ellipse((x + 2, y + 2, x + 81, y + 81), fill=(244, 244, 240, 255), outline=(206, 40, 36, 255), width=7); lines(d, x + 24, y + 28, 36, 3, 12, (206, 40, 36, 255), 5, False)
    # 端子箱のラベル、ヒーターの注意
    x, y = place('jbox_label', 150, 96); d.rectangle((x, y, x + 149, y + 95), fill=(246, 246, 242, 255), outline=(50, 50, 50, 255), width=2); d.rectangle((x + 10, y + 8, x + 139, y + 30), fill=(250, 250, 250, 255), outline=(40, 40, 40, 255))
    lines(d, x + 16, y + 15, 110, 1, 10, (30, 30, 30, 255), 6, False); d.rectangle((x + 10, y + 40, x + 139, y + 62), fill=(36, 38, 42, 255)); d.rectangle((x + 10, y + 68, x + 139, y + 88), fill=(36, 38, 42, 255)); lines(d, x + 16, y + 46, 110, 1, 10, (230, 230, 230, 255), 5); lines(d, x + 16, y + 74, 110, 1, 10, (230, 230, 230, 255), 5)
    x, y = place('heater_label', 190, 70); d.rectangle((x, y, x + 189, y + 69), fill=(244, 244, 240, 255), outline=(40, 40, 40, 255)); d.rectangle((x + 2, y + 2, x + 60, y + 67), fill=(214, 52, 40, 255)); d.polygon([(x + 96, y + 8), (x + 122, y + 60), (x + 70, y + 60)], fill=(240, 196, 20, 255), outline=(20, 20, 20, 255)); lines(d, x + 130, y + 12, 52, 5, 11, (60, 60, 60, 255))
    # 温度計（白い目盛り板）
    x, y = place('thermo', 44, 150); d.rectangle((x, y, x + 43, y + 149), fill=(240, 238, 228, 255), outline=(90, 90, 80, 255), width=2); d.rectangle((x + 19, y + 12, x + 24, y + 138), fill=(200, 60, 40, 255))
    for i in range(12): d.line((x + 6, y + 14 + i * 11, x + 16, y + 14 + i * 11), fill=(40, 40, 40, 255))
    im.save(os.path.join(OUT, 'decals.png')); im.save(os.path.join(OUT, 'decals.webp'), quality=88, method=6)
    json.dump(rects, open(os.path.join(OUT, 'decals.json'), 'w'), indent=1)
    return rects


if __name__ == '__main__':
    checker(); cast(); perf(); mesh(); r = decals(); print('decals:', list(r.keys()))
