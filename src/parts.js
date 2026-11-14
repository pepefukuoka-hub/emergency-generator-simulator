// parts.js — 制御盤の「部品箱」。Blender で作った部品（src/parts/parts.glb、陰影は ao.jpg と頂点カラーに焼き込み済み）を読み込み、
// 材質と前面の札（Canvas のデカール）を付けて、複製して渡す。形は blender/parts/build.py で生成（作り直しは blender/parts/run.sh）。
// 写真（ドライブ機器室 IMG_3602・3603・3617・3620・3623）からの比率で作った教育用の想像モデル。メーカー名・形式・銘板の文字は入れない（銘板は線だけ）。
// 札の絵は、写真の画素の座標のまま描いてある（各 LABEL の setTransform が、写真の画素 → Canvas の変換）。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import GLB from './parts/parts.glb';
import AO_URI from './parts/ao.jpg';

// 部品の寸法（m。build.py と同じ）。原点：vcb・unit・vmc は底面の中心（正面は +Z、front＝前板の表面の z）。そのほかは取付面（裏）の下の中心で、手前が +Z
export const PART = {
  vcb: { W: 0.5, H: 0.56, D: 0.54, front: 0.282 }, unit: { W: 0.52, H: 0.405, D: 0.45, front: 0.2275 }, vmc: { W: 0.46, H: 0.475, D: 0.5, front: 0.26 },
  mc: { W: 0.115, H: 0.118, D: 0.092 }, elb: { W: 0.09, H: 0.155, D: 0.082 }, cp: { W: 0.05, H: 0.095, D: 0.074 },
  relay: { W: 0.023, H: 0.074, D: 0.059 }, tb: { W: 0.101, H: 0.045, D: 0.035 }, fuse: { W: 0.036, H: 0.078, D: 0.063 }, duct: { W: 0.054, L: 0.24, D: 0.062 },
};

// ---------- 札を描く道具 ----------
const fit = (c, t, x, y, maxW, px, bold = true, font = 'sans-serif') => { let s = px; do { c.font = (bold ? 'bold ' : '') + s + 'px ' + font; s -= 1; } while (c.measureText(t).width > maxW && s > 5); c.fillText(t, x, y); };
const lines = (c, x, y, w, h, step, col = '#777', lw = 1.6) => { c.fillStyle = col; let k = 0; for (let j = y; j < y + h - lw; j += step, k++) c.fillRect(x, j, w * (1 - ((k * 7) % 4) * 0.09), lw); };
const tri = (c, x, y, s) => { c.fillStyle = '#f2c81c'; c.strokeStyle = '#111'; c.lineWidth = s * 0.09; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x, y - s * 0.55); c.lineTo(x + s * 0.6, y + s * 0.45); c.lineTo(x - s * 0.6, y + s * 0.45); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#111'; c.fillRect(x - s * 0.05, y - s * 0.22, s * 0.1, s * 0.38); c.fillRect(x - s * 0.05, y + s * 0.24, s * 0.1, s * 0.1); };
// 注意の札：白地、頭に ⚠ と見出し、下は読めない線
const note = (c, x, y, w, h, title, o = {}) => {
  c.fillStyle = o.bg || '#fbfbf8'; c.fillRect(x, y, w, h); c.strokeStyle = '#8a8a86'; c.lineWidth = 1.5; c.strokeRect(x, y, w, h);
  const hh = o.hh || Math.min(h * 0.3, 30);
  if (o.head) { c.fillStyle = o.head; c.fillRect(x, y, w, hh); }
  if (title) { tri(c, x + hh * 0.62, y + hh * 0.52, hh * 0.72); c.fillStyle = o.head ? '#fff' : (o.tcol || '#111'); c.textAlign = 'left'; c.textBaseline = 'middle'; fit(c, title, x + hh * 1.15, y + hh * 0.55, w - hh * 1.3, hh * 0.78); }
  lines(c, x + w * 0.06, y + hh + 6, w * 0.88, h - hh - 8, o.step || 9, o.lc || '#666', o.lw || 1.6);
};
// 警告3枚組（注意・危険・注意）
const warn3 = (c, x, y, w, h) => { const cw = w / 3; ['注意', '危険', '注意'].forEach((t, k) => { const x0 = x + k * cw; c.fillStyle = '#fbfbf8'; c.fillRect(x0, y, cw - 2, h); c.strokeStyle = '#555'; c.lineWidth = 1.5; c.strokeRect(x0, y, cw - 2, h);
  tri(c, x0 + cw * 0.2, y + h * 0.13, h * 0.17); c.fillStyle = '#111'; c.textAlign = 'left'; c.textBaseline = 'middle'; fit(c, t, x0 + cw * 0.38, y + h * 0.14, cw * 0.56, h * 0.17);
  if (k) { tri(c, x0 + cw * 0.5, y + h * 0.48, h * 0.3); lines(c, x0 + cw * 0.1, y + h * 0.72, cw * 0.78, h * 0.26, 7, '#444', 1.5); } else lines(c, x0 + cw * 0.1, y + h * 0.3, cw * 0.78, h * 0.68, 7, '#444', 1.5); }); };
const arrowDown = (c, x, y, r) => { c.fillStyle = '#f6f6f2'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillStyle = '#d8231f'; c.fillRect(x - r * 0.16, y - r * 0.62, r * 0.32, r * 0.7); c.beginPath(); c.moveTo(x - r * 0.48, y + r * 0.02); c.lineTo(x + r * 0.48, y + r * 0.02); c.lineTo(x, y + r * 0.68); c.fill(); };
const lockMark = (c, x, y0, y1, tx) => { c.fillStyle = '#3a3a3a'; c.fillRect(x - 1.5, y0 + 10, 3, y1 - y0 - 20); c.beginPath(); c.moveTo(x - 8, y0 + 14); c.lineTo(x, y0); c.lineTo(x + 8, y0 + 14); c.fill(); c.beginPath(); c.moveTo(x - 8, y1 - 14); c.lineTo(x, y1); c.lineTo(x + 8, y1 - 14); c.fill();
  c.textAlign = 'left'; c.textBaseline = 'middle'; fit(c, 'ロック解除位置', tx, y0 + 2, 110, 17, false); fit(c, 'UNLOCK', tx, y0 + 24, 110, 22, false); fit(c, 'ロック位置', tx + 3, y1 - 26, 100, 17, false); fit(c, 'LOCK', tx + 3, y1 - 4, 100, 22, false); };
// 定格の銘板（文字は入れず、帯と線だけ）
const plate = (c, x, y, w, h, bar = '#1d2d4f') => { c.fillStyle = '#f1f2f2'; c.fillRect(x, y, w, h); c.strokeStyle = '#b9bbbd'; c.lineWidth = 2; c.strokeRect(x, y, w, h); c.fillStyle = bar; c.fillRect(x + w * 0.02, y + h * 0.1, w * 0.96, h * 0.14); c.fillRect(x + w * 0.02, y + h * 0.78, w * 0.96, h * 0.13);
  c.fillStyle = '#e9eaec'; c.fillRect(x + w * 0.04, y + h * 0.14, w * 0.5, h * 0.05); c.fillRect(x + w * 0.3, y + h * 0.82, w * 0.4, h * 0.045);
  for (let k = 0; k < 4; k++) { const x0 = x + w * (0.03 + k * 0.243); for (let r = 0; r < 3; r++) { c.fillStyle = '#4a4f58'; c.fillRect(x0, y + h * (0.3 + r * 0.16), w * (0.1 + ((k + r) % 3) * 0.02), 2.2); c.fillStyle = '#8b8f96'; c.fillRect(x0, y + h * (0.36 + r * 0.16), w * 0.12, 1.4); c.fillStyle = '#4a4f58'; c.fillRect(x0 + w * 0.15, y + h * (0.31 + r * 0.16), w * 0.07, 2); } } };
const mk = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); c.clearRect(0, 0, w, h); draw(c, w, h); const t = new THREE.CanvasTexture(cv); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

// ---------- 部品ごとの前面の札 ----------
const LABEL = {
  // VCB（写真 IMG_3620）。前板 0.47×0.42m
  vcb: () => mk(1024, 915, c => { c.setTransform(0.828, 0, 0, 0.828, -230.7, -169.7); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#0e0f10'; c.fillRect(603, 215, 134, 50); c.fillStyle = '#d9dad4'; c.font = 'bold 34px monospace'; c.fillText('00198', 670, 242); c.fillStyle = 'rgba(255,255,255,.14)'; for (let k = 1; k < 5; k++) c.fillRect(612 + k * 23.5, 219, 1.5, 42);
    c.fillStyle = '#c4221c'; c.fillRect(882, 215, 96, 47); c.fillStyle = '#fff'; fit(c, '入', 930, 231, 40, 24); fit(c, 'CLOSED', 930, 251, 84, 15, false);
    c.strokeStyle = '#55585a'; c.lineWidth = 5; c.strokeRect(535, 337, 775, 388);
    c.save(); c.translate(925, 440); c.transform(1, 0, -0.24, 1, 0, 0); c.fillStyle = '#45484a'; c.font = 'bold 128px sans-serif'; c.fillText('VCB', 0, 0); c.restore();
    plate(c, 600, 505, 645, 175);
    c.fillStyle = '#3a3a3a'; c.textAlign = 'left'; fit(c, '開路', 892, 800, 70, 21, false); fit(c, 'TRIP', 892, 824, 70, 25, false); fit(c, '閉路', 895, 978, 70, 21, false); fit(c, 'CLOSE', 895, 1000, 90, 25, false);
    c.fillStyle = '#e8b21a'; c.fillRect(590, 870, 92, 42); c.fillStyle = '#7a4a10'; c.fillRect(590, 870, 92, 20); c.fillStyle = '#fff'; c.textAlign = 'center'; fit(c, '蓄 勢', 636, 881, 80, 17); c.fillStyle = '#222'; fit(c, 'Spring Charged', 636, 902, 86, 13, false);
    note(c, 1000, 872, 85, 138, '注意', { hh: 34, step: 12 }); warn3(c, 1145, 905, 265, 135);
    note(c, 1165, 1042, 215, 95, '注意', { head: '#5d6062', hh: 26, bg: '#e9e7dc', step: 11 }); note(c, 1165, 1137, 215, 98, 'CAUTION', { head: '#5d6062', hh: 26, bg: '#e9e7dc', step: 11 });
    note(c, 470, 1085, 320, 98, '注意', { hh: 24, step: 11 }); note(c, 470, 1183, 320, 117, 'CAUTION', { hh: 24, step: 11 });
    lockMark(c, 830, 1150, 1248, 845); arrowDown(c, 1190, 1280, 24);
  }),
  // ZPD／VT／LA の引出しの本体（写真 IMG_3623）。上 773px が前面、下の帯が受け皿の札
  unit: () => mk(1024, 873, c => { c.setTransform(0.7126, 0, 0, 0.7126, -191, -146.1); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#f4f4f0'; c.fillRect(985, 236, 50, 18); c.fillStyle = '#555'; c.fillRect(992, 244, 36, 2.5);
    c.fillStyle = '#f4f4f0'; c.fillRect(962, 620, 48, 17); c.fillStyle = '#555'; c.fillRect(968, 627, 36, 2.5);
    const gr = c.createLinearGradient(962, 640, 1070, 838); gr.addColorStop(0, '#d5d9dc'); gr.addColorStop(0.5, '#bfc4c8'); gr.addColorStop(1, '#cdd1d4'); c.fillStyle = gr; c.fillRect(962, 640, 108, 198);
    c.fillStyle = '#2a2d30'; c.fillRect(985, 650, 62, 3.5); for (let r = 0; r < 6; r++) { c.fillRect(968, 668 + r * 12, 26, 2.2); c.fillRect(1010, 668 + r * 12, 38 + (r % 3) * 6, 2.2); } c.fillRect(985, 745, 64, 3);
    c.strokeStyle = '#2a2d30'; c.lineWidth = 1.6; c.strokeRect(1000, 770, 46, 50); c.beginPath(); for (const x of [1012, 1023, 1034]) { c.moveTo(x, 762); c.lineTo(x, 800); } c.moveTo(1006, 800); c.lineTo(1040, 800); c.stroke();
    c.fillStyle = '#c9cdd1'; c.fillRect(1075, 730, 160, 102); lines(c, 1083, 742, 144, 86, 15, '#c8322a', 3.2);
    note(c, 1445, 520, 210, 75, '注意', { hh: 75, step: 13 }); c.fillStyle = '#fbfbf8'; c.fillRect(1560, 524, 92, 67); lines(c, 1566, 534, 80, 54, 16, '#333', 3);
    note(c, 922, 972, 200, 54, '注意', { hh: 54, step: 13 }); c.fillStyle = '#fbfbf8'; c.fillRect(1030, 975, 89, 48); lines(c, 1036, 983, 78, 40, 14, '#333', 3);
    c.fillStyle = '#f5d21a'; c.fillRect(622, 948, 246, 217); c.fillStyle = '#c8261e'; fit(c, '“注 意”', 745, 972, 130, 24); lines(c, 640, 1000, 205, 62, 15, '#3a3320', 3);
    c.strokeStyle = '#3a3320'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(652, 1118); c.lineTo(700, 1118); c.lineTo(712, 1136); c.lineTo(800, 1136); c.lineTo(812, 1112); c.lineTo(850, 1112); c.moveTo(700, 1100); c.lineTo(780, 1100); c.lineTo(780, 1118); c.moveTo(690, 1086); c.lineTo(760, 1086); c.stroke(); c.fillStyle = '#3a3320'; c.fillRect(700, 1092, 56, 9);
    c.fillStyle = '#f4f4f0'; c.fillRect(697, 1163, 173, 35); c.fillStyle = '#151515'; c.textAlign = 'left'; fit(c, 'UNLOCK', 702, 1182, 74, 21); fit(c, 'LOCK', 818, 1182, 50, 21); c.beginPath(); c.moveTo(778, 1181); c.lineTo(794, 1171); c.lineTo(794, 1177); c.lineTo(814, 1177); c.lineTo(814, 1185); c.lineTo(794, 1185); c.lineTo(794, 1191); c.fill();
    arrowDown(c, 1118, 1178, 22);
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#f5d21a'; c.fillRect(0, 780, 160, 88); c.fillStyle = '#151515'; c.textAlign = 'center'; fit(c, '接 続', 80, 826, 140, 62);
  }),
  // 真空電磁接触器（写真 IMG_3617）。上 966px が前面、下の帯が台の札
  vmc: () => mk(1024, 1066, c => { c.setTransform(0.8943, 0, 0, 0.8943, -156.5, -304.1); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#f4f4f0'; c.fillRect(725, 352, 36, 16); c.fillStyle = '#555'; c.fillRect(731, 359, 24, 2.5);
    c.fillStyle = '#6b6d6f'; c.fillRect(452, 515, 583, 293);
    c.save(); c.translate(745, 572); c.transform(1, 0, -0.24, 1, 0, 0); c.fillStyle = '#e4dfd0'; c.font = 'bold 86px sans-serif'; c.fillText('VMC', 0, 0); c.restore();
    plate(c, 465, 628, 555, 172, '#3d4046');
    note(c, 522, 1078, 138, 87, '注意', { head: '#5d6062', hh: 24, bg: '#e9e7dc', step: 10 }); note(c, 522, 1165, 138, 80, 'CAUTION', { head: '#5d6062', hh: 22, bg: '#e9e7dc', step: 10 });
    c.fillStyle = '#101112'; c.fillRect(398, 1183, 100, 55); c.fillStyle = '#2f9a5a'; c.textAlign = 'right'; fit(c, 'OFF', 494, 1196, 44, 19, false); c.fillStyle = '#c4221c'; c.fillRect(446, 1207, 52, 28); c.fillStyle = '#fff'; fit(c, 'O N', 494, 1222, 44, 19, false); c.fillStyle = '#eee'; c.fillRect(404, 1207, 34, 6);
    c.fillStyle = '#17181a'; c.fillRect(757, 1310, 98, 30); c.fillStyle = '#b9bab4'; c.textAlign = 'center'; c.font = 'bold 22px monospace'; c.fillText('015641', 806, 1326);
    warn3(c, 938, 1138, 217, 105);
    note(c, 912, 1255, 68, 83, '注意', { hh: 26, step: 9, lw: 1.3 }); c.fillStyle = '#fbfbf8'; c.fillRect(980, 1255, 28, 83); c.strokeStyle = '#8a8a86'; c.strokeRect(980, 1255, 28, 83); c.fillStyle = '#222'; fit(c, '釈', 994, 1272, 22, 18, false); fit(c, '放', 994, 1292, 22, 18, false); c.fillStyle = '#d8231f'; c.fillRect(990, 1304, 8, 16); c.beginPath(); c.moveTo(983, 1318); c.lineTo(1005, 1318); c.lineTo(994, 1334); c.fill();
    lockMark(c, 872, 1350, 1418, 884);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#f4f4f0'; c.fillRect(0, 970, 70, 92); c.fillStyle = '#d8231f'; c.fillRect(0, 970, 70, 16); c.fillStyle = '#2f9a5a'; c.fillRect(0, 1046, 70, 16); c.fillStyle = '#fff'; fit(c, '運転', 35, 978, 60, 12); fit(c, '試験', 35, 1054, 60, 12);
    arrowDown(c, 125, 1017, 43);
  }),
  // 電磁接触器（写真 IMG_3603）。真ん中の段 88×72mm
  mc: () => mk(512, 421, c => { c.setTransform(1.0667, 0, 0, 1.0667, -378.7, -832); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#2b2d2f';
    fit(c, '3 L2', 606, 812, 70, 24, false); fit(c, '5 L3', 712, 812, 70, 24, false); c.fillRect(560, 828, 205, 2);
    c.textAlign = 'left'; fit(c, 'NO', 772, 808, 24, 13, false); fit(c, 'NC', 772, 828, 24, 13, false); c.strokeStyle = '#2b2d2f'; c.lineWidth = 1.5; for (const y of [800, 820]) c.strokeRect(798, y, 22, 16);
    c.fillStyle = '#2b2d2f'; c.fillRect(380, 860, 58, 9); c.fillRect(384, 878, 34, 5); c.fillRect(384, 892, 50, 4);
    c.fillStyle = '#ee7a1c'; c.fillRect(378, 912, 119, 58); c.fillStyle = '#5a2c06'; c.fillRect(386, 921, 60, 3.5); c.fillRect(386, 954, 52, 3.5);
    const grid = (x, y, w, h, rows) => { c.strokeStyle = '#3a3c3e'; c.lineWidth = 1.2; c.strokeRect(x, y, w, h); for (let r = 1; r < rows; r++) { c.beginPath(); c.moveTo(x, y + h * r / rows); c.lineTo(x + w, y + h * r / rows); c.stroke(); } for (const k of [0.36, 0.68]) { c.beginPath(); c.moveTo(x + w * k, y); c.lineTo(x + w * k, y + h); c.stroke(); } c.fillStyle = '#3a3c3e'; for (let r = 0; r < rows; r++) for (const [k, ww] of [[0.06, 0.22], [0.42, 0.18], [0.76, 0.16]]) c.fillRect(x + w * k, y + h * (r + 0.45) / rows, w * ww, 2.6); };
    grid(380, 978, 112, 62, 4); c.fillStyle = '#2b2d2f'; c.fillRect(384, 1048, 96, 3);
    c.fillStyle = '#ee7a1c'; c.fillRect(708, 912, 114, 64); c.fillStyle = '#5a2c06'; for (let r = 0; r < 4; r++) c.fillRect(714, 921 + r * 14, 70 - (r % 2) * 14, 3.5);
    grid(710, 982, 110, 80, 5); c.fillStyle = '#2b2d2f'; lines(c, 714, 1070, 100, 36, 11, '#2b2d2f', 2.6);
    c.fillStyle = '#2b2d2f'; c.fillRect(465, 1112, 300, 2); c.textAlign = 'center'; fit(c, '2 T1', 502, 1134, 70, 24, false); fit(c, '4 T2', 618, 1134, 70, 24, false); fit(c, '6 T3', 728, 1132, 70, 24, false);
    c.textAlign = 'left'; for (const [x, y] of [[404, 1106], [404, 1130], [772, 1108], [772, 1128]]) fit(c, y < 1120 ? 'NC' : 'NO', x, y, 24, 13, false); for (const [x, y] of [[380, 1098], [380, 1122], [798, 1100], [798, 1120]]) c.strokeRect(x, y, 22, 16);
  }),
  // 漏電遮断器（写真 IMG_3602）。札の面 90×53mm
  elb: () => mk(1024, 604, c => { c.setTransform(1.1506, 0, 0, 1.1506, -316.4, -707.6); c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = '#b6b9b6'; c.fillRect(281, 652, 322, 478); c.fillStyle = '#222';
    fit(c, 'EARTH LEAKAGE', 388, 688, 205, 25); fit(c, 'CIRCUIT BREAKER', 376, 720, 220, 25);
    c.fillStyle = '#3db9a6'; c.fillRect(284, 738, 304, 60); c.fillStyle = '#17403a'; c.fillRect(294, 760, 150, 16); c.fillRect(492, 764, 78, 11);
    lines(c, 294, 812, 180, 58, 18, '#2a2a2a', 4.5); c.strokeStyle = '#222'; c.lineWidth = 2; c.strokeRect(490, 808, 44, 24); c.beginPath(); c.moveTo(488, 858); c.lineTo(556, 850); c.stroke(); c.fillRect(286, 872, 300, 2.5);
    c.strokeRect(300, 885, 100, 164); c.fillStyle = '#222'; c.textAlign = 'center'; fit(c, '20A', 350, 950, 90, 36); lines(c, 308, 972, 84, 70, 12, '#333', 2.6); lines(c, 310, 896, 60, 30, 13, '#333', 2.6);
    lines(c, 408, 880, 176, 180, 15.5, '#2a2a2a', 3.4); c.fillRect(300, 1094, 290, 2.5); lines(c, 304, 1104, 280, 14, 20, '#2a2a2a', 6);
    c.fillStyle = '#b3b6b5'; c.beginPath(); c.roundRect(862, 648, 314, 322, 10); c.fill();
    c.fillStyle = '#222'; c.textAlign = 'left'; fit(c, 'LEAKAGE', 905, 766, 110, 18); fit(c, 'INDICATOR', 905, 784, 110, 18);
    c.fillRect(868, 967, 278, 2.5); lines(c, 870, 980, 220, 34, 17, '#222', 5);
    fit(c, 'T', 874, 1050, 40, 46); fit(c, 'test', 874, 1072, 40, 12, false); c.fillRect(872, 1082, 46, 2.5); fit(c, 'PUSH', 1018, 1046, 70, 21); fit(c, 'TO TRIP', 992, 1068, 100, 21);
    lines(c, 870, 1100, 80, 10, 20, '#222', 5); lines(c, 978, 1100, 110, 10, 20, '#222', 5);
    c.fillStyle = '#9da09f'; c.fillRect(812, 668, 3, 28); c.beginPath(); c.moveTo(808, 760); c.lineTo(830, 760); c.lineTo(819, 782); c.closePath(); c.strokeStyle = '#9da09f'; c.lineWidth = 2; c.stroke(); c.beginPath(); c.ellipse(819, 940, 9, 15, 0, 0, 7); c.stroke();
    c.fillStyle = '#111'; c.fillRect(649, 615, 143, 80); c.fillStyle = '#f2f2f2'; c.textAlign = 'center'; fit(c, '20A', 720, 656, 110, 44);
  }),
  // 小形の配線用遮断器（推測の絵）。札の面 50×55mm
  cp: () => mk(256, 282, c => { c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = '#ee7a1c'; c.fillRect(12, 150, 72, 56); c.fillStyle = '#5a2c06'; c.fillRect(18, 160, 40, 4); c.fillRect(18, 172, 54, 4); c.fillRect(18, 190, 30, 4);
    c.fillStyle = '#2b2d2f'; c.fillRect(12, 56, 50, 9); lines(c, 12, 76, 70, 60, 13, '#2b2d2f', 3.4); lines(c, 12, 218, 70, 50, 12, '#555', 2.6);
    lines(c, 174, 60, 70, 80, 14, '#2b2d2f', 3.4); c.strokeStyle = '#2b2d2f'; c.lineWidth = 2; c.strokeRect(176, 160, 62, 46); c.fillStyle = '#2b2d2f'; c.textAlign = 'center'; fit(c, '5A', 207, 184, 54, 28); lines(c, 176, 220, 60, 44, 12, '#555', 2.6);
    fit(c, 'ON', 128, 66, 50, 17); c.fillStyle = '#777'; fit(c, 'OFF', 128, 214, 50, 18, false);
  }),
};
// 名札（白地に黒の文字）。縦横の比は、部品ごとの札の板に合わせる
const TAG_AR = { vcb: 0.39, unit: 0.282, vmc: 0.46, mc: 0.316, elb: 0.312, cp: 0.239 };
const tagCache = {};
const tagTex = (name, text) => tagCache[name + '|' + text] || (tagCache[name + '|' + text] = mk(320, Math.round(320 * TAG_AR[name]), (c, w, h) => {
  c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, w, h); if (name === 'vcb' || name === 'unit' || name === 'vmc') { c.strokeStyle = '#333'; c.lineWidth = 2; c.strokeRect(w * 0.05, h * 0.14, w * 0.9, h * 0.72); }
  c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, text, w / 2, h / 2 + h * 0.04, w * 0.84, h * 0.7); }));

// ---------- 材質（写真から拾った色、sRGB） ----------
const DEF = {
  vbody: { c: 0xcbc6b6, r: 0.55 }, vfront: { c: 0xd9d5c7, r: 0.5 }, ubody: { c: 0xd3cdbb, r: 0.52 }, uinset: { c: 0xe0d4c6, r: 0.6 },
  black: { c: 0x17181a, r: 0.48 }, blackd: { c: 0x0b0b0c, r: 0.7 }, rubber: { c: 0x1c1c1c, r: 0.85 }, glassd: { c: 0x0c0d0f, r: 0.1 },
  red: { c: 0xc8221c, r: 0.38, e: 0x260000 }, redd: { c: 0x4a0c0a, r: 0.6 }, blue: { c: 0x1f44b8, r: 0.4, e: 0x00041a }, yel: { c: 0xe7c81e, r: 0.4, e: 0x1a1400 }, green: { c: 0x3fae7c, r: 0.42, e: 0x001a0c }, orange: { c: 0xe8742a, r: 0.5 },
  steel: { c: 0xd4d7da, r: 0.3, m: 0.6 }, steeld: { c: 0x4a4d50, r: 0.45, m: 0.75 }, sus: { c: 0xe2e4e6, r: 0.16, m: 0.9 }, galv: { c: 0xaab2b8, r: 0.42, m: 0.7, galv: true },
  brass: { c: 0xc9a24a, r: 0.32, m: 0.65 }, brassy: { c: 0xb9a85c, r: 0.36, m: 0.6 }, copper: { c: 0xb86a3a, r: 0.35, m: 0.7 }, chrom: { c: 0xffffff, r: 0.33, m: 0.5, chrom: true },
  grip: { c: 0x9c9fa3, r: 0.46 }, knobg: { c: 0x26302c, r: 0.4 }, white: { c: 0xf3f3ee, r: 0.55 }, wrap: { c: 0x9da1a6, r: 0.5, m: 0.25, wrap: true },
  wy: { c: 0xe9c41e, r: 0.42 }, wgreen: { c: 0x2f8a3e, r: 0.42 }, wwhite: { c: 0xe9e4d6, r: 0.45 }, wgrey: { c: 0x6f7276, r: 0.5 },
  mcream: { c: 0xe9e6da, r: 0.42 }, egrey: { c: 0xd2d4d1, r: 0.42 }, ewhite: { c: 0xe3e5e2, r: 0.4 }, fwhite: { c: 0xf0f0ea, r: 0.36 }, duct: { c: 0xa9acba, r: 0.55 }, ductin: { c: 0x55575f, r: 0.7 },
};
function chromTex() {   // 有色クロメートめっきの色むら（黄緑〜金〜赤紫）
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const c = cv.getContext('2d');
  const gr = c.createLinearGradient(0, 0, 256, 256); [['#d8cf6a', 0], ['#b5cf7a', 0.25], ['#e2bd58', 0.45], ['#c49aa8', 0.6], ['#dccf6c', 0.8], ['#acc982', 1]].forEach(([col, k]) => gr.addColorStop(k, col)); c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(${160 + rnd() * 90 | 0},${120 + rnd() * 100 | 0},${70 + rnd() * 120 | 0},.2)`; c.beginPath(); c.ellipse(rnd() * 256, rnd() * 256, 10 + rnd() * 40, 5 + rnd() * 14, rnd() * 3, 0, 7); c.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

let template = null; const waiting = [];
const label = {}, cache = {};
function fill(g, name, opts) {
  const src = template[name]; if (!src) { console.error('parts: no part', name); return; }
  for (const o of src.children) {
    const [, mat, cls] = o.name.split('|'); let m = o.material;
    if (cls === 'decal' && mat === 'tag') { if (!opts.tag) continue; m = tagMat(name, opts.tag); }
    const c = new THREE.Mesh(o.geometry, m); c.renderOrder = o.renderOrder; c.name = o.name; g.add(c);
  }
}
const decalMat = map => new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: 0.02, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const tagMats = {}; const tagMat = (name, text) => tagMats[name + '|' + text] || (tagMats[name + '|' + text] = decalMat(tagTex(name, text)));
/** 部品を1つ返す（形・材質は共有）。name は PART のキーか 'mcw'（電磁接触器の線）。opts.tag＝名札の文字（なければ札なし）。読み込み前に呼ばれたら、あとで中身が入る */
export function makePart(name, opts = {}) {
  const g = new THREE.Group(); g.name = 'part-' + name;
  if (template) fill(g, name, opts); else waiting.push([g, name, opts]);
  return g;
}
{
  const TL = new THREE.TextureLoader(); const ao = TL.load(AO_URI); ao.flipY = false; ao.channel = 1; ao.colorSpace = THREE.NoColorSpace;
  const ch = chromTex();
  const material = (grp, name, cls, lm) => {
    if (cls === 'decal') { if (name !== 'label') return null; return label[grp] || (label[grp] = decalMat(LABEL[grp]())); }
    const key = name + '|' + cls + (lm ? '' : '|n'); if (cache[key]) return cache[key];
    let m;
    if (name === 'acryl') m = new THREE.MeshPhysicalMaterial({ color: 0xf4f8fa, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false });
    else {
      const d = DEF[name] || { c: 0xff00ff };
      m = new THREE.MeshStandardMaterial({ color: d.c, roughness: d.r ?? 0.5, metalness: d.m ?? 0, map: d.chrom ? ch : null });
      if (d.e) m.emissive = new THREE.Color(d.e);
      if (cls === 'big' && lm) { m.aoMap = ao; m.aoMapIntensity = 1.0; }
      if (cls === 'small' && lm) m.vertexColors = true;
    }
    m.name = key; return (cache[key] = m);
  };
  const buf = GLB.buffer.slice(GLB.byteOffset, GLB.byteOffset + GLB.byteLength);
  new GLTFLoader().parse(buf, '', gltf => {
    const T = {};
    for (const root of gltf.scene.children) {
      const grp = new THREE.Group(); T[root.name] = grp;
      for (const o of [...root.children]) {
        if (!o.isMesh) continue; const [, name, cls] = o.name.split('|');
        o.material = material(root.name, name, cls, cls === 'big' ? !!o.geometry.attributes.uv1 : !!o.geometry.attributes.color);
        if (cls === 'decal') o.renderOrder = 2; if (cls === 'glass') o.renderOrder = 3;
        grp.add(o);
      }
    }
    template = T; waiting.splice(0).forEach(([g, name, opts]) => fill(g, name, opts));
  }, e => console.error('parts', e));
}
