// 機器室（発電機室の入口のドアの向こう）。配置図から読み取った盤の並びを、箱と盤面の絵で作る。
// 教育用の想像モデル。位置は図面からの近似、盤面の絵・高さ・色は推測。形式名・メーカー名は入れない。
import * as THREE from 'three';
import { makeHv } from './kiki-hv.js';
import { roadLighting } from './road-lighting.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeCcrInside } from './ccr-inside.js';
import { makeDcRear } from './dc-rear.js';

export function buildKiki({ M, canvasTex, plateMat }) {
  const g = new THREE.Group();
  const blocks = [];
  const hv = makeHv({ M, canvasTex });
  let road;
  const ccrDoors = [];   // CCR の扉（上段・下段）。発電機室の盤の裏扉と同じ形（leaves・toggle）で main.js へ渡す
  let CI = null, DC = null;
  const dcDoors = [];   // 監視用UPS の直流電源盤・蓄電池盤の裏の扉（dc-rear.js）
  // 室の内のり。発電機室（X −13〜3.6）と壁をそろえ、ドアの壁（Z −3.4）から −Z へ約23m。
  const X0 = -13, X1 = 3.6, Z0 = -26.5, Z1 = -3.62, H = 4.4;
  // 図面の写真の画素 → 座標（図の左＝−Z、図の上＝+X）
  // 方位：+Z＝東（発電機室の側）、−Z＝西（監視室の側）、+X＝北、−X＝南
  const zc = px => Z1 - (1230 - px) * (Z1 - Z0) / 955;
  const xc = py => X1 - (py - 597) * (X1 - X0) / 603;

  const box = (x0, x1, y0, y1, z0, z1, m) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m);
    o.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); g.add(o); return o;
  };
  const ROT = { 'x+': Math.PI / 2, 'x-': -Math.PI / 2, 'z+': 0, 'z-': Math.PI };
  const plane = (w, h, m, x, y, z, dir) => {
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.y = ROT[dir]; g.add(o); return o;
  };

  // ---------- 室 ----------
  const tile = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#dedac8'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const v = 205 + Math.random() * 25 | 0; c.fillStyle = `rgba(${v},${v - 3},${v - 20},.35)`; c.fillRect(Math.random() * w, Math.random() * h, 4, 4); }
    c.strokeStyle = '#a9a694'; c.lineWidth = 2; c.strokeRect(0, 0, w / 2, h / 2); c.strokeRect(w / 2, 0, w / 2, h / 2); c.strokeRect(0, h / 2, w / 2, h / 2); c.strokeRect(w / 2, h / 2, w / 2, h / 2);
  }, [(Z1 - Z0), (X1 - X0)]);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(Z1 - Z0, X1 - X0), M(0xc4c1b4, 0, 0.45, { map: tile }));
  fl.rotation.x = -Math.PI / 2; fl.rotation.z = Math.PI / 2; fl.position.set((X0 + X1) / 2, 0, (Z0 + Z1) / 2); g.add(fl);
  const wallM = M(0xe9e8e0, 0, 0.95, { side: THREE.BackSide }), none = new THREE.MeshBasicMaterial({ visible: false });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0, H, Z1 - Z0), [wallM, wallM, wallM, none, none, wallM]);
  shell.position.set((X0 + X1) / 2, H / 2, (Z0 + Z1) / 2); g.add(shell);
  // 発電機室との境の壁（ドアの穴 X −5.8〜−4.8、高さ 2.15）
  const wm = M(0xe9e8e0, 0, 0.95), DX0 = -6.1, DX1 = -4.5, DH = 2.15;
  plane(DX0 - X0, H, wm, (X0 + DX0) / 2, H / 2, Z1, 'z-'); plane(X1 - DX1, H, wm, (DX1 + X1) / 2, H / 2, Z1, 'z-');
  plane(DX1 - DX0, H - DH, wm, (DX0 + DX1) / 2, (H + DH) / 2, Z1, 'z-');
  const frame = M(0xc8c4a8, 0.1, 0.8);
  box(DX0 - 0.05, DX0, 0, DH, Z1 - 0.03, -3.4, frame); box(DX1, DX1 + 0.05, 0, DH, Z1 - 0.03, -3.4, frame); box(DX0 - 0.05, DX1 + 0.05, DH, DH + 0.05, Z1 - 0.03, -3.4, frame);
  box(DX0, DX1, 0, 0.004, Z1, -3.4, M(0x8a8d90, 0.6, 0.4));
  // はり・柱（図面の通り芯の位置）
  const colM = M(0xe4e3da, 0, 0.9);
  for (const px of [622, 950]) { const z = zc(px); box(X0, X1, H - 0.5, H, z - 0.2, z + 0.2, colM); box(X1 - 0.3, X1, 0, H, z - 0.25, z + 0.25, colM); box(X0, X0 + 0.3, 0, H, z - 0.25, z + 0.25, colM); }
  for (const [px, py] of [[622, 905], [950, 900]]) { const z = zc(px), x = xc(py); box(x - 0.3, x + 0.3, 0, H, z - 0.3, z + 0.3, colM); blocks.push([x - 0.3, x + 0.3, z - 0.3, z + 0.3]); }
  // 照明
  const lamp = M(0xffffff, 0, 0.3, { emissive: 0xffffff, emissiveIntensity: 1 });
  for (const x of [-11.2, -6.9, -2.6, 2.2]) for (let z = Z1 - 1.6; z > Z0 + 1; z -= 2.6) box(x - 0.06, x + 0.06, H - 0.56, H - 0.52, z - 0.6, z + 0.6, lamp);
  // ダクト（図面の「ダクト 850×1300」）
  { const z = zc(1200), x = xc(1110); box(x - 0.65, x + 0.65, 0, H, z - 0.43, z + 0.43, M(0xb9bdbf, 0.5, 0.5)); blocks.push([x - 0.65, x + 0.65, z - 0.43, z + 0.43]); }

  // ---------- 盤 ----------
  const body = M(0xd3d2c5, 0.25, 0.6), plinth = M(0x6d6f6a, 0.3, 0.7);
  const fit = (c, t, x, y, maxW, px, bold = true) => { let s = px; do { c.font = (bold ? 'bold ' : '') + s + 'px sans-serif'; s--; } while (c.measureText(t).width > maxW && s > 8); c.fillText(t, x, y); };
  const base = (c, w, h) => {
    c.fillStyle = '#d6d5c8'; c.fillRect(0, 0, w, h);
    const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,.07)'); gr.addColorStop(0.08, 'rgba(255,255,255,.05)'); gr.addColorStop(1, 'rgba(0,0,0,.05)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#9d9c8d'; c.lineWidth = 2; c.strokeRect(4, 4, w - 8, h - 8);
  };
  const plateName = (c, w, y, no, name) => {
    c.fillStyle = '#fafaf6'; c.fillRect(22, y, w - 44, 30); c.strokeStyle = '#555'; c.lineWidth = 1; c.strokeRect(22, y, w - 44, 30);
    c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, name, w / 2, y + 16, w - 54, 19);
    if (no) { c.fillStyle = '#1b3a6b'; c.fillRect(8, y - 22, 46, 20); c.fillStyle = '#fff'; fit(c, 'No.' + no, 31, y - 11, 42, 14); }
  };
  const louver = (c, x, y, w, h) => { c.fillStyle = '#b9b8aa'; c.fillRect(x, y, w, h); c.strokeStyle = '#77766a'; c.lineWidth = 1.5; for (let i = 3; i < h; i += 6) { c.beginPath(); c.moveTo(x + 3, y + i); c.lineTo(x + w - 3, y + i); c.stroke(); } };
  const perf = (c, x, y, w, h) => { c.fillStyle = '#c4c3b6'; c.fillRect(x, y, w, h); c.fillStyle = '#6f6e64'; for (let j = 3; j < h - 1; j += 5) for (let i = 3 + (j % 10 ? 2.5 : 0); i < w - 1; i += 5) c.fillRect(x + i, y + j, 2, 2); };
  const meter = (c, x, y, s, round) => {
    c.fillStyle = '#17181a'; if (round) { c.beginPath(); c.arc(x + s / 2, y + s / 2, s / 2, 0, 7); c.fill(); } else c.fillRect(x, y, s, s);
    c.fillStyle = '#f4f4ee'; c.beginPath(); c.arc(x + s / 2, y + s / 2, s * 0.4, 0, 7); c.fill();
    c.strokeStyle = '#222'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + s / 2, y + s * 0.62); c.lineTo(x + s * 0.32, y + s * 0.26); c.stroke();
  };
  const lampDot = (c, x, y, col) => { c.fillStyle = '#333'; c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); };
  const knob = (c, x, y) => { c.fillStyle = '#c9cbcd'; c.beginPath(); c.arc(x, y, 11, 0, 7); c.fill(); c.fillStyle = '#17181a'; c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); c.fillRect(x - 2, y - 13, 4, 10); };
  const handle = (c, w, y) => { c.fillStyle = '#e3e5e6'; c.fillRect(w - 24, y, 9, 34); c.strokeStyle = '#666'; c.strokeRect(w - 24, y, 9, 34); };
  const DRAW = {
    hv: (no, name) => (c, w, h) => {
      base(c, w, h); plateName(c, w, 34, no, name); c.save(); c.translate(0, (h - 512) * 0.3);
      for (let i = 0; i < 3; i++) meter(c, 38 + i * 64, 84, 50);
      c.fillStyle = '#17181a'; c.fillRect(46, 158, 70, 90); c.fillStyle = '#8a8f93'; c.fillRect(52, 164, 58, 78); c.fillStyle = '#17181a'; c.fillRect(140, 158, 70, 90); c.fillStyle = '#8a8f93'; c.fillRect(146, 164, 58, 78);
      lampDot(c, 96, 276, '#2aa84a'); lampDot(c, 160, 276, '#d8312c'); knob(c, 80, 318); knob(c, 128, 318); knob(c, 176, 318);
      handle(c, w, 300); c.fillStyle = '#e8c61a'; c.fillRect(100, 362, 56, 18); c.fillStyle = '#c00'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, '高圧危険', 128, 372, 52, 12);
      c.restore(); louver(c, 60, h - 82, 136, 46);
    },
    lv: (no, name) => (c, w, h) => {
      base(c, w, h); plateName(c, w, 34, no, name); c.save(); c.translate(0, (h - 512) * 0.3);
      for (let i = 0; i < 2; i++) meter(c, 70 + i * 66, 84, 50);
      for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) lampDot(c, 62 + i * 44, 166 + r * 24, r ? '#d8312c' : '#2aa84a');
      knob(c, 100, 240); knob(c, 156, 240); handle(c, w, 270); c.restore(); louver(c, 60, h - 82, 136, 46);
    },
    tr: (no, name) => (c, w, h) => {
      base(c, w, h); plateName(c, w, 34, no, name);
      c.strokeStyle = '#9d9c8d'; c.beginPath(); c.moveTo(w / 2, 70); c.lineTo(w / 2, h - 8); c.stroke();
      perf(c, 26, 84, 88, 70); perf(c, 142, 84, 88, 70); meter(c, 48, 186, 40, true);
      c.fillStyle = '#17181a'; c.fillRect(150, 192, 60, 30); c.fillStyle = '#9fb3a2'; c.fillRect(154, 196, 52, 22);
      c.fillStyle = '#e8c61a'; c.fillRect(160, 250, 56, 18); c.fillStyle = '#c00'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, '高圧危険', 188, 260, 52, 12);
      handle(c, w / 2 + 16, 290); perf(c, 26, h - 112, 88, 76); perf(c, 142, h - 112, 88, 76);
    },
    stack: (no, name) => (c, w, h) => {   // 上下2段積み。no・name は [上, 下]
      base(c, w, h); c.strokeStyle = '#7d7c70'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
      for (let k = 0; k < 2; k++) {
        const y = k * h / 2; plateName(c, w, y + 30, no[k], name[k]);
        perf(c, 48, y + 74, 160, 56); perf(c, 48, y + 168, 160, h / 2 - 190);
        c.fillStyle = '#f2f2ec'; c.fillRect(70, y + 140, 70, 18); handle(c, w, y + 134);
      }
    },
    ups: (no, name) => (c, w, h) => {
      base(c, w, h); plateName(c, w, 34, no, name); c.save(); c.translate(0, (h - 512) * 0.25);
      meter(c, 60, 86, 44, true); meter(c, 150, 86, 44, true);
      c.fillStyle = '#17181a'; c.fillRect(104, 150, 48, 60); c.fillStyle = '#b8c7b0'; c.fillRect(110, 156, 36, 22);
      for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) { lampDot(c, 56 + i * 36, 252 + r * 40, i % 2 ? '#d8312c' : '#2aa84a'); c.fillStyle = '#222'; c.fillRect(51 + i * 36, 264 + r * 40, 10, 10); }
      handle(c, w, 230); c.restore(); louver(c, 60, h - 122, 136, 90);
    },
    ctl: (no, name) => (c, w, h) => {
      base(c, w, h); plateName(c, w, 34, no, name);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) { c.fillStyle = (r + i) % 4 ? '#d9d2b8' : '#e7a23a'; c.fillRect(48 + i * 34, 90 + r * 20, 28, 15); c.strokeStyle = '#555'; c.lineWidth = 1; c.strokeRect(48 + i * 34, 90 + r * 20, 28, 15); }
      handle(c, w, 250); louver(c, 60, h - 72, 136, 36);
    },
  };
  const FINE = ['cct', 'rgl', 'paper', 'ccr', 'trp'];
  const BR = '#6b5b4e', BR2 = '#75655a', GRG = '#cfc8ba';
  const base2 = (c, w, h) => { c.fillStyle = GRG; c.fillRect(0, 0, w, h); c.strokeStyle = '#9a9488'; c.lineWidth = 1.5; c.strokeRect(2, 2, w - 4, h - 4); };
  const meter2 = (c, x, y, s, t, ang) => {   // 角形の計器（上が白い目盛板、下が黒）
    c.fillStyle = '#17181a'; c.fillRect(x, y, s, s * 0.95); c.fillStyle = '#f3f3ee'; c.fillRect(x + 1.5, y + 1.5, s - 3, s * 0.58);
    c.strokeStyle = '#444'; c.lineWidth = 0.6; c.beginPath(); c.arc(x + s / 2, y + s * 0.74, s * 0.5, Math.PI * 1.22, Math.PI * 1.78); c.stroke();
    c.strokeStyle = ang < 0.25 ? '#c22' : '#222'; c.lineWidth = 0.9; const a = Math.PI * (1.22 + 0.56 * ang); c.beginPath(); c.moveTo(x + s / 2, y + s * 0.6); c.lineTo(x + s / 2 + Math.cos(a) * s * 0.44, y + s * 0.74 + Math.sin(a) * s * 0.44); c.stroke();
    c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold ' + s * 0.2 + 'px sans-serif'; c.fillText(t, x + s / 2, y + s * 0.44);
  };
  const tag = (c, t, x, y, wd, ht, px) => { c.fillStyle = '#f4f4ee'; c.fillRect(x - wd / 2, y - ht / 2, wd, ht); c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, t, x, y + 0.5, wd - 2, px); };
  const led = (c, x, y, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.fill(); };
  const sknob = (c, x, y, r, a) => { c.fillStyle = '#111'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = '#eee'; c.lineWidth = r * 0.45; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(a) * r, y - Math.cos(a) * r); c.stroke(); c.fillStyle = '#d22'; c.beginPath(); c.moveTo(x - 2, y - r - 5); c.lineTo(x + 2, y - r - 5); c.lineTo(x, y - r - 1); c.fill(); };
  // 回路1つ分の計器パネル：名札、出力電流計・絶縁抵抗計、表示灯4つ、遠方／直接の切換、OFF・ON・RESET（写真より。文字の細部は要確認）
  const sub = (c, x, y, wd, ht, name) => {
    c.fillStyle = BR2; c.fillRect(x, y, wd, ht); c.strokeStyle = '#4e4138'; c.lineWidth = 1; c.strokeRect(x, y, wd, ht);
    const s = Math.min(wd * 0.29, ht * 0.56), my = y + ht * 0.2;
    tag(c, name, x + wd * 0.36, y + ht * 0.1, wd * 0.34, ht * 0.11, 7);
    meter2(c, x + wd * 0.05, my, s, 'A', 0.6); meter2(c, x + wd * 0.05 + s + 4, my, s, 'MΩ', 0.12);
    tag(c, '出力電流', x + wd * 0.05 + s / 2, my + s + 6, s * 0.7, 6, 4.5); tag(c, '絶縁抵抗', x + wd * 0.05 + s * 1.5 + 4, my + s + 6, s * 0.7, 6, 4.5);
    const lx = x + wd * 0.76; c.fillStyle = '#eee'; c.font = '4px sans-serif'; c.textAlign = 'right';
    ['受電', '開路', '過電流', '接地'].forEach((t, i) => { const ly = y + ht * (0.3 + i * 0.16); c.fillStyle = '#eee'; c.fillText(t, lx - 4, ly); led(c, lx, ly, i ? '#40382f' : '#e8d24a'); });
    const bx2 = x + wd * 0.89; sknob(c, bx2, y + ht * 0.2, 4.5, -0.7);
    c.textAlign = 'center'; [['OFF', '#d9d6cc'], ['ON', '#f0a43a'], ['RESET', '#d9d6cc']].forEach(([t, col], i) => { const by = y + ht * (0.4 + i * 0.18); c.fillStyle = '#222'; c.fillRect(bx2 - 6.5, by - 5, 13, 10); c.fillStyle = col; c.fillRect(bx2 - 5.5, by - 4, 11, 8); c.fillStyle = '#222'; c.font = '3.4px sans-serif'; c.fillText(t, bx2, by + 0.5); });
  };
  const sheet = (c, x, y, wd, ht) => { c.fillStyle = '#fbfbf8'; c.fillRect(x, y, wd, ht); c.strokeStyle = '#bbb'; c.lineWidth = 0.5; c.strokeRect(x, y, wd, ht); c.fillStyle = '#888'; c.fillRect(x + wd * 0.25, y + ht * 0.06, wd * 0.5, 1.4); c.fillStyle = '#b5b5b5'; for (let j = y + ht * 0.14; j < y + ht * 0.92; j += 3.2) c.fillRect(x + wd * 0.1, j, wd * (0.5 + ((j * 7 | 0) % 4) * 0.08), 0.8); };
  const latch = (c, x, y) => { c.fillStyle = '#e3e5e6'; c.fillRect(x, y, 7, 26); c.strokeStyle = '#777'; c.lineWidth = 0.7; c.strokeRect(x, y, 7, 26); c.fillStyle = '#888'; c.beginPath(); c.arc(x + 3.5, y + 19, 2, 0, 7); c.fill(); c.fillStyle = '#f1d21c'; c.fillRect(x - 1, y + 29, 9, 8); };
  const cross = (c, x, y, wd, ht) => { c.fillStyle = '#d5cfc2'; c.fillRect(x, y, wd, ht); c.fillStyle = '#5d564c'; for (let j = 3, r = 0; j < ht - 2; j += 3.4, r++) for (let i = 3 + (r % 2 ? 1.7 : 0); i < wd - 2; i += 3.4) { c.fillRect(x + i - 1, y + j - 0.35, 2, 0.7); c.fillRect(x + i - 0.35, y + j - 1, 0.7, 2); } };
  const noTag = (c, no, y) => { if (!no) return; c.fillStyle = '#1b3a6b'; c.fillRect(6, y, 40, 14); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, 'No.' + no, 26, y + 7.5, 37, 10); };
  // CCT の上下2段（写真より）。上段：名札・貼り紙・下に茶色の帯（計器）。下段：上に茶色の帯（計器）・名札・下に十字パンチングの通気口
  DRAW.cct = (no, d) => (c, w, h) => {
    const U = h / 2; base2(c, w, h);
    c.fillStyle = BR; c.fillRect(2, U * 0.72, w - 4, U * 0.52); c.strokeStyle = '#3c332c'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, U); c.lineTo(w, U); c.stroke();
    tag(c, d.up.title, w / 2, 26, 150, 22, 15); c.strokeStyle = '#777'; c.lineWidth = 0.6; c.strokeRect(w / 2 - 75, 15, 150, 22); noTag(c, no[0], 4);
    if (d.up.sel) for (let i = 0; i < 3; i++) sheet(c, 22 + i * 70, U * 0.4, 62, U * 0.26); else { sheet(c, 22, U * 0.45, 118, U * 0.24); sheet(c, 150, U * 0.43, 62, U * 0.26); }
    latch(c, w - 26, U * 0.42);
    const py = U * 0.76, ph = U * 0.2;
    if (d.up.circ) d.up.circ.forEach((n, i) => sub(c, 12 + i * 118, py, 114, ph, n));
    if (d.up.sel) {   // ケーブル切替盤の切換スイッチ：左に回路名4つ、中央につまみ、上に OFF
      const x = 70, wd = 116; c.fillStyle = BR2; c.fillRect(x, py, wd, ph); c.strokeStyle = '#4e4138'; c.lineWidth = 1; c.strokeRect(x, py, wd, ph);
      const kx = x + wd * 0.52, ky = py + ph * 0.55; c.strokeStyle = '#ddd'; c.lineWidth = 0.6; c.font = '4.6px sans-serif'; c.textBaseline = 'middle';
      d.up.sel.forEach((t, i) => { const ly = py + ph * (0.3 + i * 0.14); c.fillStyle = '#eee'; c.textAlign = 'left'; c.fillText(t, x + 34, ly - 2.5); led(c, x + 30, ly, '#5fae5f'); c.beginPath(); c.moveTo(x + 32, ly); c.lineTo(x + 52, ly); c.lineTo(kx, ky); c.lineTo(x + wd - 26, ly); c.lineTo(x + wd - 16, ly); c.stroke(); led(c, x + wd - 14, ly, '#5fae5f'); });
      c.fillStyle = '#eee'; c.textAlign = 'center'; c.fillText('OFF', kx, py + ph * 0.1); sknob(c, kx, ky, 5, 0);
    }
    const qy = U + U * 0.03;
    d.lo.circ.forEach((n, i) => sub(c, 12 + i * 118, qy, 114, ph, n));
    if (d.lo.blank) { c.fillStyle = BR2; c.fillRect(130, qy, 114, ph); c.strokeStyle = '#4e4138'; c.strokeRect(130, qy, 114, ph); }
    tag(c, d.lo.title, w / 2, U * 1.3, 130, 20, 14); c.strokeStyle = '#777'; c.lineWidth = 0.6; c.strokeRect(w / 2 - 65, U * 1.3 - 10, 130, 20); noTag(c, no[1], U * 1.3 - 28);
    latch(c, w - 26, U * 1.44); cross(c, 50, U * 1.62, 156, U * 0.26);
  };
  // RGL（下段だけの低い盤）：左に絶縁抵抗計・出力電流計を縦に、右に表示灯・切換・押しボタン（写真より。ボタンの文字は読めず、推測）
  DRAW.rgl = (no, name) => (c, w, h) => {
    base2(c, w, h); c.fillStyle = BR; c.fillRect(2, 2, w - 4, h * 0.24);
    const s = h * 0.09; tag(c, '絶縁抵抗', 40, h * 0.025, s * 0.8, 6, 4.5); meter2(c, 40 - s / 2, h * 0.04, s, 'MΩ', 0.12); meter2(c, 40 - s / 2, h * 0.04 + s + 4, s, 'A', 0.55); tag(c, '出力電流', 40, h * 0.04 + s * 2 + 8, s * 0.8, 6, 4.5);
    const x = 88, y = h * 0.045, wd = 150, ht = h * 0.16; c.fillStyle = BR2; c.fillRect(x, y, wd, ht); c.strokeStyle = '#4e4138'; c.lineWidth = 1; c.strokeRect(x, y, wd, ht);
    c.fillStyle = '#eee'; c.font = '4.4px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    [['過電流', 18], ['開路', 30], ['接地', 50]].forEach(([t, dx]) => { c.fillStyle = '#eee'; c.fillText(t, x + dx, y + ht * 0.28); led(c, x + dx, y + ht * 0.38, '#40382f'); });
    c.fillStyle = '#eee'; c.fillText('遠方', x + 18, y + ht * 0.52); c.fillText('直接', x + 46, y + ht * 0.52); sknob(c, x + 32, y + ht * 0.76, 5, -0.7);
    for (let i = 0; i < 2; i++) { c.fillStyle = '#f0a43a'; c.fillRect(x + 70 + i * 13, y + ht * 0.14, 11, 8); }
    ['OFF', 'ON', 'RESET'].forEach((t, i) => { c.fillStyle = '#222'; c.fillRect(x + 82 + i * 14, y + ht * 0.46, 13, 10); c.fillStyle = i === 1 ? '#f0a43a' : '#d9d6cc'; c.fillRect(x + 83 + i * 14, y + ht * 0.46 + 1, 11, 8); c.fillStyle = '#222'; c.font = '3.4px sans-serif'; c.fillText(t, x + 88.5 + i * 14, y + ht * 0.46 + 5.5); });
    for (let i = 0; i < 4; i++) { c.fillStyle = '#222'; c.fillRect(x + 78 + i * 14, y + ht * 0.72, 13, 10); c.fillStyle = i === 1 ? '#f0a43a' : '#d9d6cc'; c.fillRect(x + 79 + i * 14, y + ht * 0.72 + 1, 11, 8); }
    tag(c, name, w / 2, h * 0.33, 110, 22, 16); c.strokeStyle = '#777'; c.lineWidth = 0.6; c.strokeRect(w / 2 - 55, h * 0.33 - 11, 110, 22); noTag(c, no, h * 0.26);
    latch(c, w - 30, h * 0.48); cross(c, 50, h * 0.66, 156, h * 0.26);
  };
  // 紙を貼った無地の面（写真：操作手順の掲示が並ぶ。下に縦長の通気口）
  DRAW.paper = (no, name) => (c, w, h) => {
    base2(c, w, h); noTag(c, no, 4);
    for (let r = 0; r < 5; r++) { sheet(c, 24, h * (0.06 + r * 0.155), 100, h * 0.14); sheet(c, 132, h * (0.06 + r * 0.155), 100, h * 0.14); }
    c.fillStyle = '#4c473f'; for (let k = 0; k < 3; k++) for (let i = 0; i < 9; i++) c.fillRect(30 + i * 7, h * (0.86 + k * 0.04), 3, h * 0.03);
  };
  // CCR の上下2段（正面の写真5枚より）。無地の扉に黒い操作パネル。上段はパネルが下、下段はパネルが上で、下に十字パンチングの通気口。
  // パネルの種類：op＝操作部（押しボタン・遠方／直接・絶縁抵抗の数字表示・接地警報設定）、scr＝CCR本体（押しボタン3つ・遠方／直接・液晶画面）、
  //   opd＝表示のない操作部、combo＝両方を1枚にした幅広、scr2＝幅広のCCR本体。ボタンの文字は読めず、色だけ
  const btn = (c, x, y, col) => { c.fillStyle = '#3a3a3a'; c.fillRect(x - 5, y - 4.5, 10, 9); c.fillStyle = col; c.fillRect(x - 4, y - 3.5, 8, 7); };
  const OR = '#f2a63c', WH = '#dcdad2';
  const selk = (c, x, y) => { c.fillStyle = '#ddd'; c.font = '3.6px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('遠方', x - 7, y - 9); c.fillText('直接', x + 7, y - 9); sknob(c, x, y, 4.5, -0.7); };
  const seg = (c, x, y) => { tag(c, '絶縁抵抗', x + 11, y - 6, 20, 5.5, 4); c.fillStyle = '#0c1a10'; c.fillRect(x, y, 22, 10); c.fillStyle = '#4ee06a'; c.font = 'bold 8px monospace'; c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText('≥100', x + 21, y + 5.5); c.fillStyle = '#ddd'; c.font = '3.6px sans-serif'; c.fillText('MΩ', x + 22, y + 14); };
  const setbox = (c, x, y) => {
    c.strokeStyle = '#ddd'; c.lineWidth = 0.6; c.strokeRect(x, y, 24, 28); tag(c, '接地警報設定', x + 12, y + 3, 23, 5, 3.6);
    c.font = '3.2px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; ['10MΩ', '5MΩ', '3MΩ', '1MΩ', '0.5MΩ', 'OFF'].forEach((t, i) => { led(c, x + 3.5, y + 8.5 + i * 3.4, i ? '#2c3a2c' : '#7df08f'); c.fillStyle = '#ddd'; c.fillText(t, x + 6.5, y + 8.7 + i * 3.4); });
    c.strokeRect(x, y + 30, 24, 10); tag(c, '警報音', x + 12, y + 32.5, 23, 4.5, 3.4); c.fillStyle = '#ddd'; c.fillText('入／切', x + 12, y + 37.5);
  };
  const lcd = (c, x, y, wd, ht) => { c.fillStyle = '#17181a'; c.fillRect(x - 3, y - 3, wd + 6, ht + 6); c.strokeStyle = '#333'; c.lineWidth = 0.6; c.strokeRect(x - 3, y - 3, wd + 6, ht + 6); c.fillStyle = '#4a4d4f'; c.fillRect(x, y, wd, ht); };
  const cpanel = (c, w, y, ht, title, type) => {
    const wide = type === 'combo' || type === 'scr2', x = wide ? 30 : 62, wd = wide ? 196 : 132;
    c.fillStyle = '#1b1c20'; c.fillRect(x, y, wd, ht);
    const tx = wide ? x + wd * 0.5 : x + wd * 0.5; tag(c, title, tx, y + ht * 0.17, wide ? 96 : 100, ht * 0.2, 12);
    const by = y + ht * 0.44, ky = y + ht * 0.78, x0 = x + 16;
    if (type === 'op') { btn(c, x0, by, OR); btn(c, x0 + 11, by, OR); btn(c, x0 + 28, by, OR); btn(c, x0 + 39, by, WH); selk(c, x0 + 6, ky); btn(c, x0 + 36, ky + 2, WH); seg(c, x + 70, by - 3); setbox(c, x + 100, y + ht * 0.32); }
    else if (type === 'opd') { btn(c, x0 + 6, by, OR); btn(c, x0 + 26, by, OR); btn(c, x0 + 37, by, WH); selk(c, x0 + 6, ky); }
    else if (type === 'scr') { for (let i = 0; i < 3; i++) btn(c, x0 + i * 11, by, OR); selk(c, x0 + 8, ky); lcd(c, x + 62, y + ht * 0.44, 44, ht * 0.34); }
    else if (type === 'scr2') { for (let i = 0; i < 3; i++) btn(c, x0 + i * 11, by, OR); selk(c, x0 + 8, ky); btn(c, x0 + 32, ky + 2, OR); btn(c, x0 + 43, ky + 2, WH); lcd(c, x + 78, y + ht * 0.44, 46, ht * 0.34); }
    else { for (let i = 0; i < 3; i++) btn(c, x0 + i * 11, by, OR); selk(c, x0 + 8, ky); btn(c, x0 + 34, ky + 2, OR); btn(c, x0 + 45, ky + 2, WH); lcd(c, x + 74, y + ht * 0.46, 46, ht * 0.34); seg(c, x + 136, by - 1); setbox(c, x + 164, y + ht * 0.3); btn(c, x + wd - 22, y + ht * 0.2, WH); }
  };
  DRAW.ccr = (no, d) => (c, w, h) => {
    const U = h / 2; c.fillStyle = '#d4d1c7'; c.fillRect(0, 0, w, h);
    const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,.05)'); gr.addColorStop(0.1, 'rgba(255,255,255,.04)'); gr.addColorStop(1, 'rgba(0,0,0,.04)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#8f8c82'; c.lineWidth = 1.5; c.strokeRect(1, 1, w - 2, U - 1.5); c.strokeRect(1, U + 0.5, w - 2, U - 2);
    noTag(c, no[0], 4); cpanel(c, w, U * 0.8, U * 0.14, d.up.title, d.up.type); latch(c, w - 24, U * 0.47);
    noTag(c, no[1], U + 4); cpanel(c, w, U * 1.05, U * 0.14, d.lo.title, d.lo.type); latch(c, w - 24, U * 1.47); cross(c, 50, U * 1.65, 150, U * 0.25);
  };
  // 変圧器盤（正面の写真4枚より）。部品の位置は、扉の幅・高さに対する割合で書く。メーカーの表示は入れない
  DRAW.trp = (no, d) => (c, w, h) => {
    const X = f => f * w, Y = f => f * h;
    c.fillStyle = '#d6d4cb'; c.fillRect(0, 0, w, h);
    const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,.06)'); gr.addColorStop(0.15, 'rgba(255,255,255,.05)'); gr.addColorStop(1, 'rgba(0,0,0,.05)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#8e8b82'; c.lineWidth = 1.5; c.strokeRect(1, 1, w - 2, h - 2);
    if (d.plate) { c.fillStyle = '#f7f7f3'; c.fillRect(X(0.24), Y(0.03), X(0.52), Y(0.028)); c.strokeStyle = '#999'; c.lineWidth = 0.6; c.strokeRect(X(0.24), Y(0.03), X(0.52), Y(0.028)); c.fillStyle = '#222'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, d.plate, X(0.5), Y(0.045), X(0.48), 14, false); c.fillStyle = '#aaa'; for (const fx of [0.255, 0.745]) for (const fy of [0.036, 0.053]) { c.beginPath(); c.arc(X(fx), Y(fy), 1, 0, 7); c.fill(); } }
    noTag(c, no, 4);
    const lbl = (fx, fy, t, fw = 0.12) => { c.fillStyle = '#f2f2ee'; c.fillRect(X(fx - fw / 2), Y(fy) - 3.5, X(fw), 7); c.strokeStyle = '#aaa'; c.lineWidth = 0.4; c.strokeRect(X(fx - fw / 2), Y(fy) - 3.5, X(fw), 7); c.fillStyle = '#333'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, t, X(fx), Y(fy) + 0.3, X(fw) - 2, 5, false); };
    const lamp = (fx, fy, col, on, r = 4) => { const x = X(fx), y = Y(fy); c.fillStyle = '#e8e8e4'; c.fillRect(x - r, y - r - 5, 2 * r, 4); c.fillStyle = '#2a2a2a'; c.beginPath(); c.arc(x, y, r * 1.3, 0, 7); c.fill(); c.fillStyle = on ? col : (col === '#3ce05a' ? '#1f5a2a' : '#5a1f1f'); c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); if (on) { c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(x - 1.3, y - 1.3, 1.3, 0, 7); c.fill(); } };
    const wm = (fx, fy, fs, unit, max, ang) => {   // 角形の広角計器（黒い枠・白い丸い目盛板・240°）
      const s2 = X(fs), x = X(fx) - s2 / 2, y = Y(fy) - s2 / 2, cx = x + s2 / 2, cy = y + s2 / 2, r = s2 * 0.42;
      c.fillStyle = '#121314'; c.fillRect(x, y, s2, s2); c.fillStyle = '#fbfbf7'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
      c.strokeStyle = '#222'; c.lineWidth = 0.5; c.beginPath(); c.arc(cx, cy, r * 0.82, Math.PI * 0.75, Math.PI * 2.25); c.stroke();
      for (let i = 0; i <= 30; i++) { const a = Math.PI * (0.75 + 1.5 * i / 30), r0 = r * (i % 5 ? 0.77 : 0.72); c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82); c.stroke(); }
      c.fillStyle = '#222'; c.font = (s2 * 0.1) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      if (max !== null) for (let i = 0; i <= 6; i++) { const a = Math.PI * (0.75 + 1.5 * i / 6), lo = Array.isArray(max) ? max[0] : 0, hi = Array.isArray(max) ? max[1] : max; c.fillText(String(Math.round(lo + (hi - lo) * i / 6)), cx + Math.cos(a) * r * 0.56, cy + Math.sin(a) * r * 0.56); }
      c.font = 'bold ' + (s2 * 0.13) + 'px sans-serif'; c.fillText(unit, cx, cy + r * 0.62);
      const a = Math.PI * (0.75 + 1.5 * ang); c.strokeStyle = '#111'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85); c.stroke();
      c.fillStyle = '#e9e9e4'; c.beginPath(); c.arc(cx, cy, r * 0.17, 0, 7); c.fill(); c.strokeStyle = '#999'; c.lineWidth = 0.5; c.stroke();
    };
    const cs = (fx, fy) => { const x = X(fx), y = Y(fy), a = 8; c.fillStyle = '#b9bbbd'; c.fillRect(x - a, y - a, 2 * a, 2 * a); c.strokeStyle = '#666'; c.lineWidth = 0.5; c.strokeRect(x - a, y - a, 2 * a, 2 * a); c.fillStyle = '#141414'; c.beginPath(); for (let i = 0; i < 12; i++) { const r = i % 2 ? 4 : 6.2, t = i * Math.PI / 6; c.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r); } c.fill(); c.fillStyle = '#fff'; c.fillRect(x - 0.5, y - 5, 1, 4); };
    const pb = (fx, fy, t) => { const x = X(fx), y = Y(fy); if (t) lbl(fx, fy - 0.015, t, 0.08); c.fillStyle = '#d0d0cc'; c.beginPath(); c.arc(x, y, 5.5, 0, 7); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(x, y, 4.3, 0, 7); c.fill(); };
    const ann = (fx, fy, n, wh) => { const ww = 9, x = X(fx) - (n * ww) / 2 - 2; c.fillStyle = '#151515'; c.fillRect(x, Y(fy) - 6, n * ww + 4, 12); for (let i = 0; i < n; i++) { c.fillStyle = wh && i === n - 1 ? '#efefe8' : '#f2c9c4'; c.fillRect(x + 2.5 + i * ww, Y(fy) - 4.5, ww - 1.5, 9); c.fillStyle = '#9a6a66'; for (let k = 0; k < 3; k++) c.fillRect(x + 3.5 + i * ww, Y(fy) - 3 + k * 2.4, ww - 3.5, 0.6); } };
    const relay = (fx, fy, fw, fh, dark) => { const x = X(fx - fw / 2), y = Y(fy), ww = X(fw), hh = Y(fh); c.fillStyle = dark ? '#1c1d20' : '#b4b6b8'; c.fillRect(x, y, ww, hh); c.fillStyle = dark ? '#2d3034' : '#8c9196'; c.fillRect(x + 1.5, y + 1.5, ww - 3, hh - 3); c.fillStyle = dark ? '#c9ccc4' : '#d9dad6'; c.fillRect(x + 3, y + 3, ww - 6, hh * 0.6);
      c.fillStyle = '#777'; for (let k = 0; k < 7; k++) c.fillRect(x + 5, y + 6 + k * hh * 0.07, ww * (0.4 + (k % 3) * 0.15), 0.6); c.fillStyle = '#2a2a2a'; c.beginPath(); c.arc(x + ww * 0.45, y + hh * 0.18, 2, 0, 7); c.fill(); c.fillStyle = '#4ccb5a'; c.beginPath(); c.arc(x + ww * 0.3, y + hh * 0.72, 1.2, 0, 7); c.fill(); c.fillStyle = '#c33'; c.beginPath(); c.arc(x + ww * 0.6, y + hh * 0.72, 1.2, 0, 7); c.fill(); c.fillStyle = '#ccc'; c.fillRect(x + ww * 0.3, y + hh - 4, ww * 0.4, 2.5); };
    const dm = (fx, fy) => { const x = X(fx) - 8, y = Y(fy); c.fillStyle = '#2b2d30'; c.fillRect(x, y, 16, 30); c.fillStyle = '#c5d6b4'; c.fillRect(x + 2, y + 5, 12, 9); c.fillStyle = '#4b5a40'; for (let k = 0; k < 3; k++) c.fillRect(x + 3, y + 6.5 + k * 2.6, 10, 1); c.fillStyle = '#ddd'; c.fillRect(x + 2, y + 16, 12, 9); c.fillStyle = '#999'; c.fillRect(x + 7, y + 29, 2, 4); };
    const sel = (fx, fy, on) => { const x = X(fx), y = Y(fy); c.fillStyle = '#f2f2ee'; c.fillRect(x - 9, y - 19, 18, 9); c.strokeStyle = '#aaa'; c.lineWidth = 0.4; c.strokeRect(x - 9, y - 19, 18, 9); c.fillStyle = '#777'; c.fillRect(x - 7, y - 17, 14, 0.7); c.fillRect(x - 6, y - 13.5, 12, 0.7);
      c.fillStyle = '#c8c9cb'; c.fillRect(x - 7.5, y - 7.5, 15, 15); c.strokeStyle = '#222'; c.lineWidth = 1; c.strokeRect(x - 7.5, y - 7.5, 15, 15); c.fillStyle = '#121212'; c.beginPath(); c.arc(x, y + 0.5, 4.2, 0, 7); c.fill(); c.fillStyle = '#eee'; c.fillRect(x - 0.5, y - 3.6, 1, 3.4); c.fillStyle = '#d22'; c.beginPath(); c.moveTo(x + 9, y - 1.5); c.lineTo(x + 9, y + 1.5); c.lineTo(x + 7.8, y); c.fill();
      lamp(fx - 0.03, fy + 0.035, '#3ce05a', !on, 3.6); lamp(fx + 0.03, fy + 0.035, '#ff3b30', on, 3.6); };
    const handle = (fx, fy) => { const x = X(fx), y = Y(fy); c.fillStyle = '#e6e8ea'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); c.strokeStyle = '#888'; c.lineWidth = 0.6; c.stroke(); c.fillStyle = '#cfd3d6'; c.beginPath(); c.moveTo(x - 2.5, y); c.lineTo(x + 2.5, y); c.lineTo(x + 1.5, y + 26); c.lineTo(x - 1, y + 26); c.fill(); c.strokeStyle = '#8a8d90'; c.stroke(); };
    const louver = (y0, y1, x0 = 0.19, x1 = 0.86) => { const cols = 10, cw = (X(x1) - X(x0)) / cols; c.fillStyle = '#d0cec5'; c.fillRect(X(x0), Y(y0), X(x1) - X(x0), Y(y1) - Y(y0)); c.fillStyle = '#4d4b46'; for (let i = 0; i < cols; i++) for (let y = Y(y0) + 2; y < Y(y1) - 1; y += 3.2) c.fillRect(X(x0) + i * cw + 1.2, y, cw - 2.4, 1.3); };
    for (const e of d.parts) {
      const [t, ...a] = e;
      if (t === 'wm') wm(...a); else if (t === 'lbl') lbl(...a); else if (t === 'lamp') lamp(...a); else if (t === 'cs') cs(...a); else if (t === 'pb') pb(...a); else if (t === 'ann') ann(...a);
      else if (t === 'relay') relay(...a); else if (t === 'dm') dm(...a); else if (t === 'sel') sel(...a); else if (t === 'handle') handle(...a); else if (t === 'louver') louver(...a);
      else if (t === 'round') { const x = X(a[0]), y = Y(a[1]), r = X(a[2]); c.fillStyle = '#c9cdd0'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillStyle = '#16181a'; c.beginPath(); c.arc(x, y, r * 0.78, 0, 7); c.fill(); c.strokeStyle = '#555'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x, y); c.lineTo(x - r * 0.1, y - r * 0.5); c.moveTo(x, y); c.lineTo(x + r * 0.05, y + r * 0.45); c.stroke(); }
      else if (t === 'plt') { const [fy, tx, fx = 0.5, fw = 0.5] = a, x = X(fx - fw / 2), y = Y(fy); c.fillStyle = '#f7f7f3'; c.fillRect(x, y, X(fw), 14); c.strokeStyle = '#999'; c.lineWidth = 0.6; c.strokeRect(x, y, X(fw), 14); c.fillStyle = '#222'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, tx, X(fx), y + 7.5, X(fw) - 6, 11, false); }
      else if (t === 'blue') { const [fx, fy, tx, fw = 0.26] = a, ls = tx.split('\n'), hh = 7 * ls.length + 3; c.fillStyle = '#1d3f93'; c.fillRect(X(fx - fw / 2), Y(fy), X(fw), hh); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; ls.forEach((l, i) => fit(c, l, X(fx), Y(fy) + 5 + i * 7, X(fw) - 3, 7, false)); }
      else if (t === 'div') { c.fillStyle = '#7d7a70'; c.fillRect(0, Y(a[0]) - 1, w, 2); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(0, Y(a[0]) + 1, w, 1); }
      else if (t === 'ctt') { const x = X(a[0]), y = Y(a[1]); c.fillStyle = '#141414'; c.fillRect(x - 12, y - 6, 24, 12); c.fillStyle = '#3a3a3a'; c.fillRect(x - 9, y - 3, 18, 4); c.fillStyle = '#ddd'; c.font = '3px sans-serif'; c.textAlign = 'center'; c.fillText(a[2] || 'CTT', x, y + 4.5); }
      else if (t === 'lev') { const x = X(a[0]), y = Y(a[1]); lbl(a[0], a[1] - 0.022, '', 0.07); c.fillStyle = '#c8c9cb'; c.fillRect(x - 8, y - 8, 16, 16); c.strokeStyle = '#333'; c.lineWidth = 0.8; c.strokeRect(x - 8, y - 8, 16, 16); c.fillStyle = '#111'; c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill(); c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x + 3, y); c.lineTo(x + 2, y + 17); c.lineTo(x - 2, y + 17); c.fill(); }
      else if (t === 'slots') { const [x0, y0, x1, y1, n] = a, rh = (Y(y1) - Y(y0)) / n; c.fillStyle = '#2e2d29'; for (let r = 0; r < n; r++) for (let x = X(x0); x < X(x1); x += 3.2) c.fillRect(x, Y(y0) + r * rh + 1, 1.5, rh * 0.75); }
      else if (t === 'mfd') { const s2 = X(a[2] || 0.16), x = X(a[0]) - s2 / 2, y = Y(a[1]) - s2 / 2; c.fillStyle = '#1b1c1e'; c.fillRect(x, y, s2, s2 * 0.95); c.fillStyle = '#b9bdb5'; c.fillRect(x + 3, y + 3, s2 - 6, s2 * 0.6); c.strokeStyle = '#555'; c.lineWidth = 0.6; c.beginPath(); c.arc(x + s2 / 2, y + s2 * 0.55, s2 * 0.38, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); c.fillStyle = '#ddd'; for (let i = 0; i < 6; i++) c.fillRect(x + 4 + i * (s2 - 8) / 6, y + s2 * 0.78, (s2 - 8) / 6 - 1.5, 2.5); }
      else if (t === 'lrow') { const [fx, fy, cols, sz = 8] = a, x = X(fx) - cols.length * sz / 2; c.fillStyle = '#151515'; c.fillRect(x - 2, Y(fy) - sz / 2 - 2, cols.length * sz + 4, sz + 4); cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(x + i * sz + 0.8, Y(fy) - sz / 2 + 0.8, sz - 1.6, sz - 1.6); }); }
      else if (t === 'dig') { const x = X(a[0]) - 15, y = Y(a[1]); c.fillStyle = '#1a1a1c'; c.fillRect(x, y, 30, 30); c.fillStyle = '#300'; c.fillRect(x + 9, y + 6, 13, 6); c.fillStyle = '#ff3b30'; c.font = 'bold 5px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('100', x + 15.5, y + 9.2); c.fillStyle = '#bbb'; for (let i = 0; i < 4; i++) c.fillRect(x + 4 + i * 6, y + 21, 4, 3); }
      else if (t === 'win') { const [x0, y0, x1, y1] = a, x = X(x0), y = Y(y0), ww = X(x1 - x0), hh = Y(y1 - y0); c.fillStyle = '#c3c6c8'; c.beginPath(); c.roundRect(x, y, ww, hh, 8); c.fill(); c.fillStyle = '#26221e'; c.beginPath(); c.roundRect(x + 4, y + 4, ww - 8, hh - 8, 6); c.fill(); c.fillStyle = '#d9dbd6'; c.fillRect(x + ww * 0.38, y + hh * 0.08, ww * 0.42, hh * 0.3); c.fillStyle = '#6d7377'; c.fillRect(x + ww * 0.3, y + hh * 0.66, ww * 0.42, hh * 0.27); c.strokeStyle = '#d8b03c'; c.lineWidth = 0.6; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x + ww * 0.25, y + hh * (0.42 + k * 0.03)); c.lineTo(x + ww * 0.75, y + hh * (0.48 + k * 0.02)); c.stroke(); } }
      else if (t === 'lcd') { const [x0, y0, x1, y1] = a, x = X(x0), y = Y(y0), ww = X(x1 - x0), hh = Y(y1 - y0); c.fillStyle = '#1e1f22'; c.fillRect(x, y, ww, hh); c.fillStyle = '#d7d9d4'; c.fillRect(x + 2, y + 2, ww - 4, hh - 4); c.fillStyle = '#1e1f22'; c.fillRect(x + 4, y + 4, ww * 0.5, hh * 0.62); c.fillStyle = '#8e968e'; c.fillRect(x + ww * 0.56, y + 5, ww * 0.4, hh * 0.55); c.fillStyle = '#9bd06a'; for (let k = 0; k < 4; k++) c.fillRect(x + 8 + k * 7, y + hh * 0.3, 4, 1.5); c.fillStyle = '#777'; for (let k = 0; k < 7; k++) c.fillRect(x + 6 + k * ww * 0.13, y + hh * 0.8, ww * 0.08, 2); }
      else if (t === 'note') { const x = X(a[0]), y = Y(a[1]); c.fillStyle = '#fafafa'; c.fillRect(x - 7, y, 14, 18); c.fillStyle = '#d33'; c.fillRect(x - 6, y + 1.5, 4, 3); c.fillStyle = '#999'; for (let k = 0; k < 6; k++) c.fillRect(x - 5, y + 6 + k * 2, 10, 0.6); }
      else if (t === 'latch') { const x = X(a[0]), y = Y(a[1]); c.fillStyle = '#a9adb0'; c.fillRect(x - 3, y, 6, 22); c.fillStyle = '#5d6164'; c.fillRect(x - 1.5, y + 3, 3, 16); }
      else if (t === 'vdiv') { c.fillStyle = '#6f6c63'; c.fillRect(X(a[0]) - 1, 0, 2, h); }
      else if (t === 'tag') { const [fx, fy, tx, fw = 0.2] = a; c.fillStyle = '#fff'; c.fillRect(X(fx - fw / 2), Y(fy), X(fw), 9); c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, tx, X(fx), Y(fy) + 5, X(fw) - 2, 7, false); }
      else if (t === 'paper') { sheet(c, X(a[0]), Y(a[1]), X(a[2] - a[0]), Y(a[3] - a[1])); c.fillStyle = '#444'; c.fillRect(X(a[0] + 0.05), Y(a[1] + 0.012), X(a[2] - a[0] - 0.1), 1.2); }
    }
  };
  DRAW.plain = () => (c, w, h) => { c.fillStyle = GRG; c.fillRect(0, 0, w, h); };
  // 盤1面：本体の箱＋正面の絵。dir は正面の向き。
  // コンデンサ盤（No.7・8）の扉と中身（写真3枚より。No.8 の「88C2」の札は推測）。
  // 扉は1枚で、正面から見て右（−Z）に蝶番。扉の裏に縦横の配線ダクト・補助リレー・書類入れ。
  // 中は上から：制御の区画（端子台・名札・小形の配線用遮断器3台・ヒューズ2本）、真空電磁接触器の引出し（88C）、棚、通気口つきの下の化粧板。
  // 下の化粧板の奥（コンデンサ・リアクトル）は写っておらず、作っていない。寸法は写真からの目安。形式名・メーカー名は入れない
  const CAPD = 0.62, capDoors = [];
  const wireM = M(0xf2d21b, 0, 0.5), blackM = M(0x1b1c1e, 0.25, 0.55), inM = M(0xd9d6c8, 0.15, 0.7), frmM = M(0xa9abba, 0.35, 0.5);
  // 穴あきの配線ダクト。vert＝縦に立つダクト（横長の穴が縦に並ぶ）、横のダクトは縦長の穴が横に並ぶ。穴の奥に黄色い線が少し見える
  const ductTex = (n, vert) => canvasTex(vert ? 64 : 256, vert ? 256 : 64, (c, w, h) => {
    c.fillStyle = '#b4b6c3'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n;
      if (vert) { const y = t * h, s = h / n; c.fillStyle = '#34353c'; c.fillRect(w * 0.14, y - s * 0.2, w * 0.72, s * 0.4); c.fillStyle = 'rgba(214,180,40,.55)'; c.fillRect(w * 0.3, y - s * 0.08, w * 0.4, s * 0.16); }
      else { const x = t * w, s = w / n; c.fillStyle = '#34353c'; c.fillRect(x - s * 0.2, h * 0.14, s * 0.4, h * 0.72); c.fillStyle = 'rgba(214,180,40,.55)'; c.fillRect(x - s * 0.08, h * 0.3, s * 0.16, h * 0.4); } }
    c.fillStyle = 'rgba(255,255,255,.25)'; if (vert) { c.fillRect(0, 0, 2, h); c.fillRect(w - 2, 0, 2, h); } else { c.fillRect(0, 0, w, 2); c.fillRect(0, h - 2, w, 2); }
  });
  const ductMs = {}; const ductM = (n, vert) => ductMs[n + '' + !!vert] || (ductMs[n + '' + !!vert] = M(0xffffff, 0.2, 0.55, { map: ductTex(n, vert) }));
  const txtTex = (t, w, h, px, bg = '#f6f6f0', fg = '#111') => canvasTex(w, h, (c, W, H) => { c.fillStyle = bg; c.fillRect(0, 0, W, H); c.strokeStyle = '#777'; c.lineWidth = 1; c.strokeRect(0.5, 0.5, W - 1, H - 1); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, t, W / 2, H / 2 + 1, W - 4, px); });
  // 真空電磁接触器の前板（銘板は文字を入れず線だけ。注意の札・開閉回数計）
  const vcsTex = canvasTex(256, 320, (c, w, h) => {
    c.fillStyle = '#dcd8ca'; c.fillRect(0, 0, w, h); const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.08)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#5d5f63'; c.fillRect(48, 24, 160, 34); c.fillStyle = '#e9e9e4'; c.fillRect(60, 32, 136, 4); c.fillRect(60, 40, 136, 3); c.fillRect(60, 47, 136, 3);
    c.fillStyle = '#f2f2ee'; c.fillRect(48, 58, 160, 40); c.fillStyle = '#9a9a96'; for (let i = 0; i < 6; i++) c.fillRect(56, 63 + i * 5.6, 144, 1.4);
    for (const [x, y] of [[40, 108], [216, 108], [40, 210], [216, 210]]) { c.fillStyle = '#9b9a92'; c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill(); }
    c.fillStyle = '#f3f3ee'; c.fillRect(150, 186, 52, 22); c.fillStyle = '#f2c81c'; for (const x of [152, 166, 180, 194]) { c.beginPath(); c.moveTo(x, 205); c.lineTo(x + 5, 194); c.lineTo(x + 10, 205); c.fill(); }
    c.fillStyle = '#f3f3ee'; c.fillRect(90, 186, 42, 30); c.fillStyle = '#555'; for (let i = 0; i < 4; i++) c.fillRect(94, 191 + i * 6, 34, 1.5);
    c.fillStyle = '#c7271f'; c.fillRect(62, 214, 26, 8); c.fillStyle = '#111'; c.fillRect(62, 214, 10, 8);
    c.fillStyle = '#191919'; c.fillRect(150, 228, 36, 14); c.fillStyle = '#e8e8e2'; c.font = 'bold 10px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('0123', 168, 236);
    c.fillStyle = '#f3f3ee'; c.fillRect(150, 248, 30, 34); c.fillStyle = '#666'; for (let i = 0; i < 4; i++) c.fillRect(153, 252 + i * 7, 24, 1.4);
    c.fillStyle = '#26282b'; c.fillRect(196, 250, 8, 30);
  });
  // 下の化粧板（通気口2組・取っ手）
  const lowTex = canvasTex(256, 288, (c, w, h) => {
    c.fillStyle = '#dad7c9'; c.fillRect(0, 0, w, h); c.strokeStyle = '#a8a597'; c.lineWidth = 2; c.strokeRect(10, 4, w - 20, h - 8);
    for (const [y0, y1] of [[18, 130], [150, 272]]) for (let y = y0; y < y1; y += 9) for (let x = 46 + (((y - y0) / 9) % 2) * 6; x < 196; x += 12) { c.fillStyle = '#4a4a46'; c.fillRect(x, y, 8, 4); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x, y + 4, 8, 1); }
    c.fillStyle = '#8f8d82'; for (const [x, y] of [[22, 16], [234, 16], [22, 272], [234, 272]]) { c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); }
  });
  const tube = (pts, r, m) => { const o = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 20, r, 6, false), m); g.add(o); return o; };
  function capPanel(x0, x1, z0, z1, h, frontMat, k) {
    const wd = z1 - z0;
    // 盤内の座標：u＝前面からの奥行き、l＝正面から見て左端からの距離、y＝高さ
    const B = (u0, u1, l0, l1, y0, y1, m) => box(x1 - u1, x1 - u0, y0, y1, z1 - l1, z1 - l0, m);
    const P = (u, l, y) => [x1 - u, y, z1 - l];
    const RB = (u, l, y, du, dl, dy, r, m) => { const o = new THREE.Mesh(new RoundedBoxGeometry(du, dy, dl, 3, r), m); o.position.set(x1 - u, y, z1 - l); g.add(o); return o; };
    const face = (m, u, l, y, wl, hy) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(wl, hy), m); o.rotation.y = Math.PI / 2; o.position.set(x1 - u, y, z1 - l); g.add(o); return o; };
    // 箱（奥の板・側板・天板）
    B(CAPD - 0.02, CAPD, 0, wd, 0.06, h, inM); B(0.026, CAPD, 0, 0.02, 0.06, h, inM); B(0.026, CAPD, wd - 0.02, wd, 0.06, h, inM); B(0.026, CAPD, 0, wd, h - 0.02, h, inM);
    B(0.002, 0.026, 0, 0.004, 0.06, h, body); B(0.002, 0.026, wd - 0.004, wd, 0.06, h, body);
    B(0, CAPD, 0, wd, 0.06, 0.08, inM);
    B(0.026, 0.04, 0, 0.025, 0.06, h, body); B(0.026, 0.04, wd - 0.025, wd, 0.06, h, body); B(0.026, 0.04, 0, wd, h - 0.03, h, body);   // 扉の当たりの枠
    // 天井の照明（写真：上部に細長い灯具）
    B(0.18, 0.24, 0.12, wd - 0.18, h - 0.06, h - 0.03, M(0xf4f4f0, 0.1, 0.5)); B(0.19, 0.23, 0.13, wd - 0.19, h - 0.07, h - 0.06, M(0xffffff, 0, 0.3, { emissive: 0xffffff, emissiveIntensity: 0.9 }));
    // ① 制御の区画：グレーの枠（左右の柱・上のダクト・下の棚）
    for (const l of [0.05, 0.585]) B(0.18, 0.5, l, l + 0.035, 1.49, h - 0.03, frmM);
    B(0.2, 0.3, 0.085, 0.585, 1.99, 2.05, ductM(30));                      // 上の横ダクト（線が上へ入る）
    B(0.17, 0.5, 0.05, 0.62, 1.47, 1.53, frmM); B(0.165, 0.18, 0.05, 0.62, 1.47, 1.545, frmM);   // 下の棚（前の立ち上がり）
    B(0.3, 0.31, 0.085, 0.585, 1.55, 1.99, inM);                           // 取付板
    B(0.27, 0.3, 0.1, 0.57, 1.9, 1.92, M(0xc9cbcd, 0.75, 0.3));             // 端子台のレール
    for (let i = 0; i < 16; i++) { const l = 0.115 + i * 0.029 + (i > 2 ? 0.02 : 0) + (i > 13 ? 0.02 : 0); if (l > 0.56) break;
      RB(0.255, l, 1.91, 0.035, 0.022, 0.07, 0.004, i < 3 ? M(0x3a3c40, 0.3, 0.5) : blackM); B(0.236, 0.238, l - 0.006, l + 0.006, 1.93, 1.945, M(0xc98a2a, 0.2, 0.5));
      tube([P(0.25, l, 1.945), P(0.25, l + 0.004, 1.97), P(0.25, l, 1.995)], 0.0028, wireM); tube([P(0.25, l, 1.875), P(0.252, l - 0.004, 1.84), P(0.27, l, 1.8)], 0.0028, wireM); }
    for (let i = 0; i < 6; i++) face(M(0xffffff, 0, 0.6, { map: txtTex(['制御電源', '表示電源', '開閉器', 'コンデンサ', '投入回路', 'コンデンサ'][i] , 128, 40, 22) }), 0.278, 0.13 + i * 0.075, 1.835, 0.06, 0.018);
    // 小形の配線用遮断器3台・端子・ヒューズ2本（下の棚へ黄色い線）
    for (let i = 0; i < 3; i++) { const l = 0.14 + i * 0.075;
      RB(0.25, l, 1.665, 0.07, 0.058, 0.11, 0.006, M(0xe9e9e3, 0.1, 0.45)); B(0.213, 0.216, l - 0.02, l + 0.02, 1.68, 1.715, M(0xe9e2d2, 0.1, 0.5));
      RB(0.21, l, 1.665, 0.02, 0.016, 0.026, 0.004, blackM); B(0.213, 0.215, l + 0.008, l + 0.022, 1.632, 1.646, M(0xf08a1a, 0.1, 0.5));
      for (const d of [-0.016, 0, 0.016]) { tube([P(0.25, l + d, 1.61), P(0.25, l + d, 1.57), P(0.27, l + d, 1.535)], 0.0028, wireM); tube([P(0.25, l + d, 1.72), P(0.25, l + d, 1.76), P(0.265, l + d, 1.8)], 0.0028, wireM); } }
    RB(0.26, 0.37, 1.665, 0.05, 0.03, 0.05, 0.004, M(0x4a4d52, 0.3, 0.5)); for (const d of [-0.006, 0.006]) tube([P(0.25, 0.37 + d, 1.64), P(0.255, 0.37 + d, 1.58), P(0.27, 0.37 + d, 1.535)], 0.0028, wireM);
    B(0.285, 0.295, 0.41, 0.56, 1.655, 1.675, M(0xc9cbcd, 0.75, 0.3));
    for (const l of [0.45, 0.51]) { RB(0.25, l, 1.665, 0.06, 0.036, 0.08, 0.006, M(0xf1f1ec, 0.05, 0.4)); const cy = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 20), M(0xd8d8d2, 0.1, 0.35)); cy.rotation.z = Math.PI / 2; cy.position.set(...P(0.21, l, 1.675)); g.add(cy);
      tube([P(0.25, l, 1.62), P(0.25, l, 1.57), P(0.27, l, 1.535)], 0.0028, wireM); }
    // 右の縦ダクトと、上から下りるケーブルの束
    B(0.2, 0.3, 0.635, 0.69, 1.3, h - 0.03, ductM(60, true));
    for (let i = 0; i < 5; i++) { const l = 0.66 + (i % 3) * 0.012, du = 0.33 + (i % 2) * 0.03; tube([P(du, l, h), P(du, l, 1.9), P(du + 0.01, l - 0.01, 1.6), P(du + 0.05, l - 0.02, 1.32)], i < 3 ? 0.009 : 0.005, i < 3 ? blackM : M(0x8a5a40, 0.1, 0.6)); }
    // 左の壁ぎわ：引出しの制御線（黄色い束）が、灰色の保護チューブで上の区画へ
    tube([P(0.3, 0.18, 1.06), P(0.24, 0.1, 1.0), P(0.26, 0.04, 1.1), P(0.3, 0.035, 1.35), P(0.33, 0.035, 1.6)], 0.014, M(0xa8acb2, 0.5, 0.45));
    // ② 真空電磁接触器の引出し：黒い開口、前板、取っ手2本、赤・青の制御プラグ、引出しの台（真ちゅう色）
    B(0.32, 0.34, 0.12, 0.62, 0.93, 1.47, blackM); B(0.2, 0.32, 0.12, 0.14, 0.93, 1.47, blackM); B(0.2, 0.32, 0.6, 0.62, 0.93, 1.47, inM);
    B(0.24, 0.32, 0.145, 0.555, 0.98, 1.46, M(0xd0ccbd, 0.2, 0.55)); face(M(0xffffff, 0.15, 0.55, { map: vcsTex }), 0.239, 0.35, 1.22, 0.41, 0.48);
    for (const l of [0.2, 0.5]) { const hdl = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.12, 6, 12), M(0x8b8f95, 0.6, 0.35)); hdl.position.set(...P(0.215, l, 1.2)); g.add(hdl);
      for (const dy of [-0.06, 0.06]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.025, 10), M(0x8b8f95, 0.6, 0.35)); st.rotation.z = Math.PI / 2; st.position.set(...P(0.228, l, 1.2 + dy)); g.add(st); } }
    for (const [l, col] of [[0.24, 0xd8232a], [0.3, 0x1f4fd8]]) { RB(0.225, l, 1.045, 0.035, 0.05, 0.04, 0.005, M(col, 0.1, 0.4)); RB(0.205, l, 1.045, 0.012, 0.03, 0.022, 0.003, M(0x2a2a2a, 0.2, 0.5));
      for (let t = 0; t < 4; t++) tube([P(0.2, l - 0.012 + t * 0.008, 1.06), P(0.18, l + 0.01 + t * 0.006, 1.1), P(0.19, l - 0.04, 1.08), P(0.27, 0.18, 1.05)], 0.0026, wireM); }
    B(0.15, 0.33, 0.14, 0.6, 0.955, 0.972, M(0xb9a24a, 0.75, 0.35)); for (const l of [0.14, 0.59]) B(0.15, 0.33, l, l + 0.012, 0.972, 1.0, M(0xb9a24a, 0.75, 0.35));
    B(0.2, 0.3, 0.34, 0.45, 0.972, 0.976, M(0xc7c09c, 0.6, 0.4)); B(0.16, 0.2, 0.33, 0.36, 0.972, 0.975, M(0xd8232a, 0.1, 0.5));
    // 88C の札（引出しの右上と、盤の右側）
    const tg = txtTex('88C' + k, 96, 40, 26); for (const l of [0.48, 0.585]) face(M(0xffffff, 0, 0.6, { map: tg }), l < 0.5 ? 0.237 : 0.198, l, 1.43, 0.05, 0.022);
    // ③ 棚と、下の化粧板
    B(0.17, CAPD, 0.02, wd - 0.02, 0.86, 0.93, inM); B(0.165, 0.18, 0.02, wd - 0.02, 0.86, 0.935, M(0xe3e0d4, 0.15, 0.6));
    B(0.18, 0.2, 0.02, wd - 0.02, 0.08, 0.86, inM); face(M(0xffffff, 0.15, 0.6, { map: lowTex }), 0.179, wd / 2, 0.47, wd - 0.06, 0.76);
    const lh = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.07, 6, 10), blackM); lh.position.set(...P(0.17, wd - 0.13, 0.52)); g.add(lh);
    // ---------- 扉（正面から見て右に蝶番。開くと通路側へ） ----------
    const lg = new THREE.Group(); lg.position.set(x1, 0, z0); g.add(lg);
    const D = (a, b, y0, y1, za, zb, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(b - a, y1 - y0, zb - za), m); o.position.set((a + b) / 2, (y0 + y1) / 2, (za + zb) / 2); lg.add(o); return o; };
    const DT = (pts, r, m) => { const o = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 16, r, 6, false), m); lg.add(o); };
    const DR = (x, y, z, dx, dy, dz, r, m) => { const o = new THREE.Mesh(new RoundedBoxGeometry(dx, dy, dz, 3, r), m); o.position.set(x, y, z); lg.add(o); return o; };
    const hh = h - 0.06; D(-0.024, 0, 0.065, h - 0.005, 0.001, wd - 0.001, body);
    { const o = new THREE.Mesh(new THREE.PlaneGeometry(wd - 0.002, hh), frontMat); o.rotation.y = Math.PI / 2; o.position.set(0.002, 0.06 + hh / 2, wd / 2); lg.add(o); }
    D(-0.026, -0.024, 0.1, h - 0.04, 0.03, wd - 0.03, M(0xdedbcf, 0.15, 0.7));    // 扉の裏の面
    // 縦ダクト（蝶番の側）と横ダクト4本
    D(-0.11, -0.026, 0.82, 2.12, 0.07, 0.12, ductM(80, true));
    for (const y of [2.09, 1.64, 1.1, 0.84]) D(-0.13, -0.026, y - 0.03, y + 0.03, 0.12, 0.52, ductM(26));
    // 補助リレー（ソケット付き。黒・黄色い線がダクトへ）
    const relay = (z, y) => { DR(-0.055, y, z, 0.05, 0.05, 0.045, 0.004, blackM); D(-0.083, -0.079, y - 0.012, y + 0.012, z - 0.016, z + 0.016, M(0x3f4247, 0.3, 0.5));
      for (const dz of [-0.012, 0, 0.012]) DT([[-0.06, y + 0.025, z + dz], [-0.07, y + 0.05, z + dz], [-0.075, y + (y > 1.2 ? 0.08 : 0.06), z + dz + 0.01]], 0.0024, wireM); };
    relay(0.3, 1.58); relay(0.36, 1.58); relay(0.3, 1.17); relay(0.27, 1.01); relay(0.33, 1.01); relay(0.27, 0.92); relay(0.36, 0.92); relay(0.27, 0.75); relay(0.33, 0.75);
    D(-0.05, -0.026, 2.13, 2.17, 0.15, 0.4, M(0xc9cbcd, 0.75, 0.3)); for (let i = 0; i < 9; i++) { D(-0.07, -0.05, 2.12, 2.18, 0.16 + i * 0.026, 0.18 + i * 0.026, blackM); DT([[-0.06, 2.12, 0.17 + i * 0.026], [-0.065, 2.0, 0.15 + i * 0.01], [-0.07, 1.9, 0.1]], 0.0024, wireM); }
    // 書類入れ・銘板・扉の締め金の棒
    D(-0.05, -0.026, 0.33, 0.67, 0.13, 0.33, M(0xd6d3c6, 0.25, 0.6)); D(-0.052, -0.05, 0.6, 0.62, 0.2, 0.26, M(0x555, 0.2, 0.6));
    for (const [y, w2, col] of [[1.43, 0.09, 0xf5f5f0], [1.37, 0.09, 0xf5f5f0], [1.27, 0.08, 0xc9c9c2], [1.2, 0.08, 0xc9c9c2], [1.12, 0.1, 0xd6d6d0]]) D(-0.0275, -0.026, y - 0.025, y + 0.025, 0.58 - w2 / 2, 0.58 + w2 / 2, M(col, 0.3, 0.5));
    { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.9, 10), M(0xbfc2c4, 0.8, 0.3)); rod.position.set(-0.04, 1.18, wd - 0.09); lg.add(rod);
      DR(-0.045, 1.0, wd - 0.09, 0.03, 0.08, 0.03, 0.006, M(0x9ea2a6, 0.7, 0.35)); }
    capDoors.push({ leaves: [lg], cur: 0, target: 0, OPEN: 1.6, toggle() { this.target = this.target ? 0 : this.OPEN; } });
  }
  function cab(x0, x1, z0, z1, h, dir, kind, no, name, back) {
    if (kind === 'ccr' && dir === 'x+') return ccrCab(x0, x1, z0, z1, h, no, name, back);
    if (name && name.dc) { box(x0, x1, 0.06, h, z0, z0 + 0.03, body); box(x0 + 0.02, x1 - 0.02, 0, 0.06, z0 + 0.02, z1 - 0.02, plinth);   // 裏が開く盤（直流電源盤・蓄電池盤）：箱は dc-rear.js
      DC = DC || makeDcRear({ M, canvasTex }); const d = DC.panel(g, name.dc, x0, x1, z0, z1, h); d.title = no; dcDoors.push(d); ccrDoors.push(d); }
    else if (!(name && name.secs)) { box(x0, name && name.cap ? x1 - CAPD : x1, 0.06, h, z0, z1, body); box(x0 + 0.02, x1 - 0.02, 0, 0.06, z0 + 0.02, z1 - 0.02, plinth); }
    const e = 0.004, hh = h - 0.06, cy = 0.06 + hh / 2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, wd = dir[0] === 'x' ? z1 - z0 : x1 - x0;
    const tex = (k, a, b) => { const R = FINE.includes(k) ? 2 : 1, d = DRAW[k](a, b); return M(0xffffff, 0.2, 0.55, { map: canvasTex(256 * R, Math.round(256 * hh / wd) * R, (c, w, hc) => { c.save(); c.scale(R, R); d(c, w / R, hc / R); c.restore(); }) }); };
    const put = (m, d) => { if (d === 'x+') plane(wd, hh, m, x1 + e, cy, cz, d); else if (d === 'x-') plane(wd, hh, m, x0 - e, cy, cz, d); else if (d === 'z+') plane(wd, hh, m, cx, cy, z1 + e, d); else plane(wd, hh, m, cx, cy, z0 - e, d); };
    if (name && name.secs && dir[0] === 'x') {   // 高圧の盤：区画ごとの扉と中身（kiki-hv.js）
      const fx = dir === 'x-' ? x0 : x1; hv.build(g, new THREE.Vector3(fx, 0, cz), ROT[dir], wd, x1 - x0, h, tex(kind, no, name), name.secs, no); return;
    }
    if (name && name.cap) capPanel(x0, x1, z0, z1, h, tex(kind, no, name), name.cap); else put(tex(kind, no, name), dir);
    if (back) put(tex('stack', back[0], back[1]), { 'x+': 'x-', 'x-': 'x+', 'z+': 'z-', 'z-': 'z+' }[dir]);
  }
  // CCR の盤（正面 +X）：箱の外側＋上下2枚の扉（タップで開閉、左の蝶番で手前へ開く）。中身は、初めて開けたときに作る（ccr-inside.js、写真 IMG_3609〜3614）
  function ccrCab(x0, x1, z0, z1, h, no, d, back) {
    CI = CI || makeCcrInside({ M, canvasTex });
    const W = z1 - z0, D = x1 - x0, hh = h - 0.06, T = hh / 2, t = 0.02, PD = 0.42, sh = CI.mt.shell, inn = CI.mt.inner;
    const grp = new THREE.Group(); grp.position.set(x0, 0.06, z1); grp.rotation.y = Math.PI / 2; g.add(grp);   // u＝正面から見て左→右（−Z）、d＝奥→手前（+X）
    const B = (u0, u1, v0, v1, d0, d1, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(u1 - u0, v1 - v0, d1 - d0), m); o.position.set((u0 + u1) / 2, (v0 + v1) / 2, (d0 + d1) / 2); grp.add(o); return o; };
    box(x0 + 0.02, x1 - 0.02, 0, 0.06, z0 + 0.02, z1 - 0.02, plinth);
    B(0, W, 0, hh, 0, PD, body);                                                   // 取付板より奥（見えない部分）
    for (const [a, b] of [[0, t], [W - t, W]]) B(a, b, 0, hh, PD, D - t, sh);       // 側板
    B(0, W, hh - t, hh, PD, D - t, sh); B(0, W, 0, t, PD, D - t, sh); B(0, W, T - 0.015, T + 0.015, PD, D - t, sh);   // 天板・底板・中仕切り
    B(t, W - t, t, hh - t, PD - 0.001, PD, inn);
    // 正面の絵（上下に分けて扉に貼る）
    const R = 2, fd = DRAW.ccr(no, d), ftex = canvasTex(256 * R, Math.round(256 * hh / W) * R, (c, w, hc) => { c.save(); c.scale(R, R); fd(c, w / R, hc / R); c.restore(); });
    const fm = M(0xffffff, 0.2, 0.55, { map: ftex });
    const tiers = [[T, true], [0, false]];
    for (const [v0, up] of tiers) {
      const leaf = new THREE.Group(); leaf.position.set(0, v0, D); grp.add(leaf); leaf.userData.k = -1;
      const lh = T - 0.004, dm = new THREE.Mesh(new THREE.BoxGeometry(W - 0.006, lh, t), sh); dm.position.set(W / 2, T / 2, -t / 2); leaf.add(dm);
      const geo = new THREE.PlaneGeometry(W - 0.006, lh), uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, (up ? 0.5 : 0) + uv.getY(i) * 0.5);
      const fp = new THREE.Mesh(geo, fm); fp.position.set(W / 2, T / 2, 0.003); leaf.add(fp);
      const inside = new THREE.Group(); inside.position.set(0, v0, 0); inside.visible = false; grp.add(inside);
      const title = up ? d.up.title : d.lo.title;
      const door = { leaves: [leaf], light: { intensity: 0 }, cur: 0, target: 0, OPEN: 1.75, built: false, inside, up, title, cab: [x0, x1, z0, z1],
        build() { if (this.built) return; this.built = true; (up ? CI.upper : CI.lower)(inside, W, T, PD, D - t, title); CI.doorBack(leaf, W - 0.006, lh, t, up); },
        toggle() { this.build(); this.target = this.target ? 0 : this.OPEN; inside.visible = true; } };
      ccrDoors.push(door);
    }
    if (back) { const m = M(0xffffff, 0.2, 0.55, { map: canvasTex(256, Math.round(256 * hh / W), (c, w, hc) => DRAW.stack(back[0], back[1])(c, w, hc)) }); plane(W, hh, m, x0 - 0.004, 0.06 + hh / 2, (z0 + z1) / 2, 'x-'); }
  }
  const rackTex = canvasTex(64, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#b8bcbf'; c.fillRect(0, 0, w, 5); c.fillRect(0, h - 5, w, 5); c.fillRect(8, 0, 6, h); c.fillRect(40, 0, 6, h); }, [1, 1]);
  // ケーブルラック（盤の列の上。ビデオより。高さ・幅は推測）
  function rack(x, z0, z1) {
    const t = rackTex.clone(); t.needsUpdate = true; t.repeat.set((z1 - z0) / 0.6, 1);
    const m = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 });
    const o = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, 0.6), m); o.rotation.x = -Math.PI / 2; o.rotation.z = Math.PI / 2; o.position.set(x, 2.85, (z0 + z1) / 2); g.add(o);
    box(x - 0.2, x + 0.2, 2.86, 2.92, z0 + 0.1, z1 - 0.1, M(0x25282b, 0.2, 0.8));
    for (let z = z0 + 0.3; z < z1; z += 1.8) for (const dx of [-0.3, 0.3]) box(x + dx - 0.008, x + dx + 0.008, 2.85, H, z - 0.008, z + 0.008, M(0x9a9da0, 0.7, 0.4));
  }
  // 盤の列（Z方向に並ぶ）。items は図の左（−Z）から順。pit＝正面の床の縞鋼板（ピットのふた）
  function row(px0, px1, xa, xb, h, dir, kind, items, o = {}) {
    const z0 = zc(px0), z1 = zc(px1), n = items.length, x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
    items.forEach(([no, name, k], i) => cab(x0, x1, z0 + (z1 - z0) * i / n + 0.004, z0 + (z1 - z0) * (i + 1) / n - 0.004, h, dir, k || kind, no, name, o.back && [no, name.up ? [name.up.title, name.lo.title] : name]));
    blocks.push([x0, x1, z0, z1]);
    if (o.pit !== false) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.008, z1 - z0), plateMat); p.position.set(dir === 'x+' ? x1 + 0.45 : x0 - 0.45, 0.004, (z0 + z1) / 2); g.add(p); }
    if (o.rack !== false) rack((x0 + x1) / 2, z0 - 0.3, z1 + 0.3);
  }

  // A 変圧器盤の列（No.52・28〜21）。正面は −X（南向き。ビデオで西の端の2面の正面と、後ろの北壁の換気扇が見えた）。盤面は丸い計器2つ・スイッチと表示灯の列・下に通気口（ビデオより）
  { const xa = xc(680) - 0.1, xb = xc(680) - 1.9;
    row(442, 895, xa, xb, 2.3, 'x-', 'trp', []);
    // 計器・表示・スイッチ・継電器の組（No.27 の写真の並び）。no26 は所内照明（写真の端から。電圧の札は 210-105V）
    const std = (v, ann) => [['lbl', 0.5, 0.135, v], ['wm', 0.43, 0.17, 0.12, 'A', 300, 0.06], ['wm', 0.57, 0.17, 0.12, 'V', 300, 0.68], ['ann', 0.5, 0.29, ann, false],
      ['pb', 0.43, 0.32, '故障復帰'], ['pb', 0.57, 0.32, 'ランプテスト'], ['lbl', 0.5, 0.40, v], ['cs', 0.44, 0.42], ['cs', 0.57, 0.42], ['relay', 0.51, 0.47, 0.13, 0.085, false]];
    const circ = (ys, xs, offs) => ys.flatMap((y, r) => xs[r].map((x, k) => ['sel', x, y, !(offs && offs[r] && offs[r].includes(k))]));
    const P = [
      [0.85, '52', { plate: '急速充電器用変圧器盤', parts: [['wm', 0.34, 0.14, 0.15, 'A', 300, 0.07], ['wm', 0.72, 0.145, 0.15, 'V', 300, 0.68], ['lbl', 0.5, 0.207, '負荷開閉器', 0.14], ['lamp', 0.45, 0.225, '#3ce05a', false], ['lamp', 0.56, 0.225, '#ff3b30', true],
        ['dm', 0.5, 0.27], ['cs', 0.35, 0.48], ['cs', 0.71, 0.48], ['lbl', 0.5, 0.515, '急速充電器用', 0.15], ['cs', 0.5, 0.545], ['lamp', 0.45, 0.565, '#3ce05a', false], ['lamp', 0.56, 0.565, '#ff3b30', true], ['pb', 0.5, 0.592], ['pb', 0.5, 0.625],
        ['relay', 0.43, 0.655, 0.12, 0.06, true], ['relay', 0.6, 0.643, 0.13, 0.08, true], ['handle', 0.88, 0.535], ['louver', 0.735, 0.96]] }],
      [1.1, '28', { plate: '道路駐車場照明変圧器盤', parts: [['lbl', 0.5, 0.135, '210V'], ['wm', 0.44, 0.17, 0.11, 'A', 400, 0.3], ['wm', 0.57, 0.17, 0.11, 'V', 300, 0.68], ['ann', 0.51, 0.29, 5, true],
        ['pb', 0.44, 0.32, '故障復帰'], ['pb', 0.57, 0.32, 'ランプテスト'], ['lbl', 0.51, 0.40, '210V'], ['cs', 0.45, 0.42], ['cs', 0.58, 0.42], ['relay', 0.52, 0.47, 0.1, 0.085, false], ['handle', 0.9, 0.55],
        ...circ([0.66, 0.77], [[0.27, 0.39, 0.51, 0.63, 0.75], [0.27, 0.39, 0.51, 0.63, 0.75]])] }],
      [1.1, '', { parts: [['paper', 0.3, 0.3, 0.52, 0.46], ['round', 0.83, 0.48, 0.09], ['handle', 0.12, 0.55],
        ...circ([0.68, 0.77], [[0.29, 0.41, 0.53, 0.65, 0.77], [0.3, 0.42, 0.54, 0.65]], [[], [1, 2, 3]])] }],
      [1.0, '27', { plate: '所内動力変圧器盤', parts: [...std('210V', 2), ['handle', 0.12, 0.58]] }],
      [1.0, '26', { plate: '所内照明変圧器盤', parts: [...std('210-105V', 2), ['handle', 0.12, 0.58]] }],
      [1.0, '25', { plate: 'エプロン照明変圧器盤', parts: [...std('210V', 3), ['handle', 0.88, 0.5], ...circ([0.62, 0.71, 0.8], [[0.2, 0.32, 0.44, 0.6, 0.72, 0.84], [0.2, 0.32, 0.44, 0.6, 0.72, 0.84], [0.2]], [[1, 3, 4, 5], [2, 4, 5], []])] }],
      [1.0, '24', { plate: '照明変圧器盤-2', parts: [...std('210V', 4), ['handle', 0.88, 0.55], ...circ([0.66], [[0.42, 0.58]]), ['lamp', 0.39, 0.73, '#f6a03a', true, 3.6], ['lamp', 0.45, 0.73, '#e9e9e2', false, 3.6], ['lamp', 0.55, 0.73, '#f6a03a', true, 3.6], ['lamp', 0.61, 0.73, '#e9e9e2', false, 3.6]] }],
      [1.0, '23', { plate: '照明変圧器盤-1', parts: [...std('210V', 2), ['handle', 0.12, 0.58]] }],
      [1.0, '22', { plate: 'No.2 CCR変圧器盤', parts: [...std('420V', 4).map(e => e[0] === 'wm' ? [...e.slice(0, 5), 600, e[6]] : e), ['handle', 0.86, 0.55], ['round', 0.1, 0.48, 0.07]] }],
      [1.0, '21', { plate: 'No.1 CCR変圧器盤', parts: [...std('420V', 4).map(e => e[0] === 'wm' ? [...e.slice(0, 5), 600, e[6]] : e), ['handle', 0.86, 0.55], ['round', 0.1, 0.48, 0.07]] }]];
    const tot = P.reduce((a, p) => a + p[0], 0), za = zc(442), zb = zc(895); let z = za;
    for (let i=0;i<P.length;i++) { const [u,no,d]=P[i], z1=z+(zb-za)*u/tot;
      if(no==='28'){
        const end=z+(zb-za)*(u+P[i+1][0])/tot, width=end-z-.008;
        const fronts=[d,P[i+1][2]].map(data=>M(0xffffff,.2,.55,{map:canvasTex(512,1024,DRAW.trp('',data))}));
        road=roadLighting({width,height:2.3,depth:xa-xb,materials:[body,plinth],fronts,canvasTex});
        road.g.position.set(xb,0,(z+end)/2);road.g.rotation.y=-Math.PI/2;g.add(road.g);z=end;i++;
      }else{cab(xb,xa,z+.004,z1-.004,2.3,'x-','trp',no,d);z=z1;}
    }
  }
  // B 定電流調整器（CCR）の列。上下2段。正面は +X（北向き。図面の三角の印の側。CCT の写真で確かめた向きと同じ）。南の面は背面で、パンチングの通気口と名札（ビデオ）。正面の盤面は写真5枚に合わせた（DRAW.ccr）
  { const u = (t, type) => ({ title: t, type }), st = (a, b, up, lo) => [[a, b], { up, lo }];
    row(640, 930, xc(870) - 0.05, xc(870) - 1.05, 2.3, 'x+', 'ccr', [
      st('31', '32', u('予備器-4', 'combo'), u('PAPI', 'scr2')), st('49', '50', u('ALS-2', 'op'), u('ALS-2', 'scr')), st('47', '48', u('REDL-2', 'op'), u('REDL-2', 'scr')),
      st('46', '52', u('予備器-2', 'scr'), u('予備器-3', 'scr')), st('41', '42', u('RTZL', 'op'), u('RTZL', 'scr')), st('43', '44', u('RCLL-2', 'op'), u('RCLL-2', 'scr')),
      st('39', '40', u('ALS-1', 'opd'), u('予備器-1', 'scr')), st('37', '38', u('ALS-1', 'op'), u('ALS-1', 'scr')), st('35', '36', u('RCLL-1', 'op'), u('RCLL-1', 'scr')), st('33', '34', u('REDL-1', 'op'), u('REDL-1', 'scr'))], { back: true }); }
  // C 伝送ユニット盤・ケーブル切替盤・CCT。正面は +X（北向き。写真4枚より）。西から、紙を貼った盤（No.87 と推測）、
  //   ケーブル切替盤／予備器、TEDL-1・2／TCLL-1・2、細い無地の柱、RGL（下段だけの低い盤）。南の面は背面（ビデオ）
  { const xa = xc(875) - 0.05, xb = xa - 1.0, o = { rack: false };
    row(420, 465, xa, xb, 2.3, 'x+', 'paper', [['87', '伝送ユニット盤']], o);
    row(465, 562, xa, xb, 2.3, 'x+', 'cct', [], { pit: true, rack: true });
    const put = (a, b, h, kind, no, d, back) => { cab(xb, xa, zc(a) + 0.004, zc(b) - 0.004, h, 'x+', kind, no, d, back); };
    put(465, 496, 2.3, 'cct', ['57', '58'], { up: { title: 'ケーブル切替盤', sel: ['TEDL-1', 'TEDL-2', 'TCLL-1', 'TCLL-2'] }, lo: { title: '予備器', circ: ['予備器'], blank: true } }, [['57', '58'], ['ケーブル切替盤', '予備器']]);
    put(496, 528, 2.3, 'cct', ['53,54', '55,56'], { up: { title: 'TEDL-1 , TEDL-2', circ: ['TEDL-1', 'TEDL-2'] }, lo: { title: 'TCLL-1 , TCLL-2', circ: ['TCLL-1', 'TCLL-2'] } }, [['53,54', '55,56'], ['TEDL-1・2', 'TCLL-1・2']]);
    put(528, 534, 2.3, 'plain', '', '');
    put(534, 562, 1.22, 'rgl', '51', 'RGL');
    // RGL の天板の通気口（写真）
    const zt = (zc(534) + zc(562)) / 2, sl = M(0x2b2d2f, 0.3, 0.8);
    for (const dx of [-0.25, 0.2]) for (const dz of [-0.2, 0, 0.2]) for (let k = 0; k < 4; k++) box(xa - 0.5 + dx + k * 0.035, xa - 0.5 + dx + k * 0.035 + 0.018, 1.22, 1.222, zt + dz - 0.07, zt + dz + 0.07, sl);
  }
  // 盤面の部品の組（写真より）。高圧の盤は、1面を上中下の3段に分ける。段の上端 y、名札、青い札、継電器が上か下か
  const G = '#3ce05a', R = '#ff3b30', O = '#f6a03a', Wt = '#e9e9e2', Bn = '#7a5c58';
  const FT = (y, nm, bl, top, o = {}) => {
    const m = top ? y + 0.15 : y + 0.085, r = [['plt', y + 0.02, nm, 0.42, 0.42], ['handle', 0.12, y + (top ? 0.11 : 0.12)]];
    if (bl) r.push(['blue', 0.78, y + 0.02, bl, 0.3]);
    if (top) r.push(['relay', 0.47, y + 0.045, 0.2, 0.075, true]);
    r.push(['ann', 0.28, m, o.ann || 1, false], ['wm', 0.47, m, 0.16, 'A', o.max || 20, 0.3], ['pb', 0.64, m], ['pb', 0.74, m],
      ['lamp', 0.42, m + 0.045, G, true, 4], ['lamp', 0.52, m + 0.045, R, true, 4], ['cs', 0.28, m + 0.085], ['lev', 0.45, m + 0.085], ['cs', 0.64, m + 0.085], ['ctt', 0.8, m + 0.085]);
    if (!top) r.push(['relay', o.r2 ? 0.4 : 0.47, m + 0.12, 0.18, 0.08, true]);
    if (o.r2) r.push(['relay', 0.6, m + 0.12, 0.14, 0.08, false], ['lbl', 0.6, m + 0.112, '全停時実施', 0.14]);
    return r;
  };
  const VT = (y, top) => { const m = top ? y + 0.15 : y + 0.1; return [['plt', y + 0.02, 'VT盤', 0.5, 0.42], ['handle', 0.14, y + 0.1], ...(top ? [['relay', 0.5, y + 0.045, 0.2, 0.075, true], ['pb', 0.68, m], ['pb', 0.78, m], ['ann', 0.3, m, 1, false]] : []),
    ['wm', 0.5, m, 0.16, 'kV', 9, 0.8], ['cs', 0.5, m + 0.085], ['ctt', 0.75, m + 0.085, 'VTT']]; };
  const ZPD = y => [['plt', y + 0.02, 'ZPD盤', 0.5, 0.42], ['ann', 0.3, y + 0.075, 1, false], ['pb', 0.68, y + 0.075], ['pb', 0.78, y + 0.075], ['handle', 0.14, y + 0.15],
    ['lbl', 0.5, y + 0.165, '全停時実施', 0.16], ['relay', 0.5, y + 0.175, 0.14, 0.11, false]];
  const T3 = (a, b, c3) => [...a(0.035), ['div', 0.345], ...b(0.355), ['div', 0.665], ...c3(0.675)];
  const HV = {
    // E 列（受電・饋電）
    '6': T3(y => FT(y, '饋電盤-5', '急速充電器用\n変圧器盤', true), y => FT(y, '饋電盤-6', '', false, { ann: 2, r2: 1 }), y => [['plt', y + 0.02, '', 0.45, 0.4], ['handle', 0.14, y + 0.15]]),
    '5': T3(y => FT(y, '饋電盤-2', '電源切替盤', true, { max: 50 }), y => FT(y, '饋電盤-3', '電力用コンデンサ盤-1\n電力用コンデンサ盤-2', false), y => FT(y, '饋電盤-4', '道路駐車場照明\n変圧器盤', false)),
    'E4': T3(y => VT(y, true), ZPD, y => FT(y, '饋電盤-1', '電源自動切替盤', false, { max: 50 })),
    '3': [['plt', 0.035, '受電盤', 0.5, 0.45], ['wm', 0.27, 0.12, 0.16, 'A', 15, 0.4], ['wm', 0.46, 0.12, 0.16, 'kW', 900, 0.15], ['wm', 0.65, 0.12, 0.16, 'kV', 9, 0.8],
      ['wm', 0.38, 0.19, 0.16, 'Hz', [55, 65], 0.5], ['wm', 0.57, 0.19, 0.16, 'cosφ', null, 0.5], ['ann', 0.32, 0.26, 2, false], ['cs', 0.3, 0.36], ['cs', 0.47, 0.36],
      ['tag', 0.62, 0.41, '43RD-R1 運用中…手動', 0.28], ['lamp', 0.4, 0.425, G, true, 4], ['lamp', 0.5, 0.425, R, true, 4], ['cs', 0.25, 0.46], ['lev', 0.4, 0.46], ['cs', 0.57, 0.46], ['handle', 0.1, 0.43],
      ['pb', 0.38, 0.53], ['pb', 0.46, 0.53], ['dig', 0.42, 0.6], ['lbl', 0.33, 0.715, '全停時実施', 0.14], ['lbl', 0.53, 0.715, '全停時実施', 0.14], ['relay', 0.33, 0.725, 0.16, 0.1, true], ['relay', 0.53, 0.725, 0.16, 0.1, true],
      ['ctt', 0.25, 0.88, 'VTT'], ['ctt', 0.42, 0.88, 'VTT'], ['ctt', 0.59, 0.88], ['ctt', 0.76, 0.88]],
    '2': [['plt', 0.035, '引込計器盤', 0.5, 0.45], ['lamp', 0.44, 0.15, G, true, 4], ['lamp', 0.54, 0.15, R, true, 4], ['ann', 0.49, 0.19, 1, false], ['win', 0.27, 0.22, 0.73, 0.41], ['handle', 0.12, 0.4],
      ['pb', 0.46, 0.49], ['pb', 0.54, 0.49], ['paper', 0.26, 0.53, 0.74, 0.68], ['lbl', 0.5, 0.735, '全停時実施', 0.16], ['relay', 0.5, 0.745, 0.12, 0.11, false]],
    // F 列（配電盤・コンデンサ盤）
    '14': T3(y => FT(y, '配電盤-5', '所内動力変圧器盤', true), y => FT(y, '配電盤-6', 'SFL受電盤', false, { ann: 2, r2: 1 }), y => FT(y, '配電盤-7', '', false, { ann: 2, r2: 1, max: 30 })),
    '13': T3(y => FT(y, '配電盤-2', '照明変圧器盤', true), y => FT(y, '配電盤-3', 'エプロン照明\n変圧器盤', false), y => FT(y, '配電盤-4', '所内照明変圧器盤', false)),
    '12': T3(y => VT(y, false), ZPD, y => FT(y, '配電盤-1', 'No2CCR\n変圧器盤', false, { max: 30 })),
    '11': [['plt', 0.035, '電源切換盤', 0.5, 0.45], ['wm', 0.4, 0.14, 0.17, 'kV', 9, 0.85], ['wm', 0.6, 0.14, 0.17, 'kV', 9, 0.85], ['cs', 0.4, 0.4], ['cs', 0.6, 0.4], ['cs', 0.5, 0.46],
      ['lamp', 0.37, 0.52, G, true, 4], ['lamp', 0.45, 0.52, R, false, 4], ['lamp', 0.56, 0.52, G, false, 4], ['lamp', 0.64, 0.52, R, true, 4], ['lev', 0.41, 0.565], ['lev', 0.6, 0.565], ['handle', 0.12, 0.52],
      ['ctt', 0.4, 0.92, 'VTT'], ['ctt', 0.6, 0.92, 'VTT']],
    ...Object.fromEntries([['7', 1], ['8', 2]].map(([no, k]) => [no, [['plt', 0.035, 'コンデンサ盤-' + k, 0.5, 0.45], ['ann', 0.5, 0.31, 3, false], ['cs', 0.5, 0.45], ['lamp', 0.47, 0.5, G, true, 4], ['lamp', 0.56, 0.5, R, true, 4],
      ['cs', 0.36, 0.535], ['lev', 0.5, 0.535], ['pb', 0.47, 0.61], ['pb', 0.56, 0.61], ['handle', 0.12, 0.52]]])),
    // G 監視用UPS
    '61-1': [['plt', 0.05, 'インバータ盤', 0.5, 0.45], ['wm', 0.33, 0.15, 0.15, 'V', 150, 0.6], ['wm', 0.5, 0.15, 0.15, 'Hz', [55, 65], 0.5], ['wm', 0.67, 0.15, 0.15, 'A', 300, 0.3],
      ['lrow', 0.5, 0.245, [O, O, O, O, O, Bn, Wt]], ['lrow', 0.5, 0.262, [Bn, Bn, Bn, Bn, Bn, Bn, Bn]], ['cs', 0.25, 0.37], ['paper', 0.4, 0.33, 0.8, 0.47], ['handle', 0.86, 0.52], ['note', 0.4, 0.6], ['slots', 0.24, 0.8, 0.8, 0.92, 6]],
    '61-2': [['plt', 0.04, '直流電源盤', 0.27, 0.32], ['vdiv', 0.5], ...[0.07, 0.165, 0.26, 0.355, 0.45].map((x, i) => ['wm', x, 0.15, 0.09, i < 3 ? 'V' : 'A', [150, 150, 200, 300, 300][i], 0.5]),
      ['lrow', 0.27, 0.24, [O, O, O, Wt, Bn, Bn]], ['lrow', 0.27, 0.256, [Bn, Bn, Bn, Bn, Bn, Bn]], ...[0.1, 0.2, 0.3, 0.4].map(x => ['cs', x, 0.37]), ['paper', 0.09, 0.4, 0.38, 0.52],
      ['latch', 0.44, 0.51], ['latch', 0.53, 0.51], ['note', 0.27, 0.6], ['paper', 0.55, 0.31, 0.68, 0.45], ['paper', 0.7, 0.31, 0.83, 0.45], ['slots', 0.1, 0.8, 0.43, 0.93, 6], ['slots', 0.57, 0.83, 0.9, 0.96, 6]],
    '61-3': [['plt', 0.05, '蓄電池盤', 0.3, 0.36], ['vdiv', 0.5], ['latch', 0.46, 0.5], ['latch', 0.55, 0.5], ['tag', 0.3, 0.55, '蓄電池設備', 0.26], ['note', 0.3, 0.6], ['slots', 0.13, 0.8, 0.43, 0.93, 6], ['slots', 0.58, 0.81, 0.9, 0.94, 6]]
  };
  // CCR用UPS（写真は No.1・No.2 とも。実物は1組6面：入出力・UPS・操作パネル・蓄電池1・直流電流計・蓄電池2。図面の3面に詰めて描く）
  const UPSD = k => ({
    in: [['plt', 0.035, `No.${k} 入出力盤`, 0.42, 0.5], ...[0.25, 0.44, 0.63].map(x => ['mfd', x, 0.2, 0.16]), ['lrow', 0.45, 0.335, [O, Wt, O, O, Wt, Bn, R, Bn, O]], ['lrow', 0.42, 0.37, [O, Wt, O, Wt, O, Wt]],
      ['lrow', 0.35, 0.41, [Wt, Wt, Wt]], ['latch', 0.1, 0.47], ['slots', 0.14, 0.72, 0.88, 0.92, 4]],
    // UPS盤＋操作パネルの盤（液晶・単線結線図）を1面にまとめた（図面の面数に合わせた簡略）
    ups: [['plt', 0.03, `No.${k} UPS盤`, 0.27, 0.42], ['paper', 0.08, 0.18, 0.42, 0.42], ['slots', 0.07, 0.58, 0.45, 0.92, 8], ['vdiv', 0.5],
      ['lcd', 0.56, 0.17, 0.94, 0.25], ['paper', 0.58, 0.28, 0.9, 0.43], ['latch', 0.55, 0.5], ['slots', 0.62, 0.6, 0.94, 0.93, 8]],
    // 蓄電池盤1＋直流電流計の盤＋蓄電池盤2（両開き）を1面にまとめた
    bat: [['vdiv', 0.34], ['vdiv', 0.56], ['vdiv', 0.78],
      ['plt', 0.03, `No.${k} 蓄電池盤1`, 0.17, 0.3], ['slots', 0.04, 0.08, 0.31, 0.36, 6], ['tag', 0.17, 0.5, '蓄電池設備', 0.28], ['slots', 0.06, 0.8, 0.3, 0.92, 3],
      ['lbl', 0.45, 0.2, '直流電流', 0.1], ['wm', 0.45, 0.235, 0.12, 'A', null, 0.95], ['latch', 0.37, 0.5], ['slots', 0.37, 0.82, 0.54, 0.93, 3],
      ['plt', 0.03, `No.${k} 蓄電池盤2`, 0.67, 0.2], ['slots', 0.58, 0.08, 0.76, 0.35, 6], ['slots', 0.8, 0.08, 0.98, 0.35, 6], ['latch', 0.8, 0.5], ['slots', 0.6, 0.8, 0.76, 0.93, 3], ['slots', 0.82, 0.8, 0.98, 0.93, 3]]
  });
  // 区画の種類（上から）。配電盤・饋電盤＝VCB の区画、VT盤・ZPD盤＝ZPD の区画の作り（写真2組より。ほかの区画も同じ作りとした）。空欄の区画は開かない
  const S3 = [[0, 0.345], [0.345, 0.665], [0.665, 1]], sec = k => S3.map(([a, b], i) => [a, b, k[i]]);
  const SECS = { '6': sec(['vcb', 'vcb', null]), '5': sec(['vcb', 'vcb', 'vcb']), 'E4': sec(['vt', 'zpd', 'vcb']), '14': sec(['vcb', 'vcb', 'vcb']), '13': sec(['vcb', 'vcb', 'vcb']), '12': sec(['vt', 'zpd', 'vcb']), '2': [[0, 1, 'inlet']] };
  const HVd = no => ({ parts: HV[no], secs: SECS[no], ...(no === '7' ? { cap: 1 } : no === '8' ? { cap: 2 } : {}) });
  // D CCR用UPS（No.62・63。図面では破線）
  // 2列は向かい合わせ（No.1 は正面 −X、No.2 は正面 +X。利用者の指示）。列の中の盤は、すき間なしで並べる。
  // 幅は実物の面数（入出力1・UPS2・蓄電池3）の割合。奥行きは 0.8m とし、2列の間に約1mの通路を残す（推測）
  const upsRow = (p0, p1, xf, dir, k, order) => { const W = { in: 1, ups: 2, bat: 3 }, z0 = zc(p0), z1 = zc(p1); let z = z0;
    for (const t of order) { const z2 = z + (z1 - z0) * W[t] / 6; const xs = dir === 'x-' ? [xf, xf + 0.8] : [xf - 0.8, xf]; cab(xs[0], xs[1], z + 0.002, z2 - 0.002, 1.95, dir, 'trp', (k === 1 ? '62-' : '63-') + { in: 1, ups: 2, bat: 3 }[t], { parts: UPSD(k)[t] }); z = z2; }
    blocks.push(dir === 'x-' ? [xf, xf + 0.8, z0, z1] : [xf - 0.8, xf, z0, z1]); };
  // 2列は背中合わせで、すき間なし（利用者の写真と指示）。正面は外の通路側：No.1 は +X（北）、No.2 は −X（南）。どちらも正面から見て左から 入出力・UPS・蓄電池
  const um = (xc(1020) + xc(1078)) / 2;
  upsRow(425, 556, um + 0.8, 'x+', 1, ['bat', 'ups', 'in']);
  upsRow(458, 590, um - 0.8, 'x-', 2, ['in', 'ups', 'bat']);
  box(um - 1.7, um - 0.85, 0, 0.012, zc(458), zc(590), M(0x161616, 0, 0.9));   // No.2 の前の黒いゴムマット
  // E 受電・饋電盤の列（No.74・6〜2）。正面は −X。ドアの前をあけるため、図面より +X へ 0.5m 寄せた。盤面は写真に合わせた
  const eX = xc(850) + 0.5;
  row(968, 1172, eX, eX - 1.9, 2.3, 'x-', 'trp', [
    ['74', '電力インタフェース盤', 'ctl'], ['6', HVd('6')], ['5', HVd('5')], ['4', HVd('E4')], ['3', HVd('3')], ['2', HVd('2')]]);
  // F 配電盤・コンデンサ盤の列（No.14〜11・8・7）。正面は +X。盤面は写真に合わせた
  row(978, 1168, xc(1045), xc(1045) - 1.9, 2.3, 'x+', 'trp', [
    ['14', HVd('14')], ['13', HVd('13')], ['12', HVd('12')], ['11', HVd('11')], ['8', HVd('8')], ['7', HVd('7')]]);
  // G 監視用UPS（No.61-1〜3）。X方向に並ぶ。正面は −Z（推測）。盤面は写真に合わせた
  { const z0 = zc(1152), z1 = zc(1187), xa = xc(643), xb = xc(792), nm = ['61-1', '61-2', '61-3'];
    nm.forEach((no, i) => cab(xa + (xb - xa) * (i + 1) / 3 + 0.004, xa + (xb - xa) * i / 3 - 0.004, z0, z1, 2.0, 'z-', 'trp', no, { parts: HV[no], dc: { '61-1': 'inv', '61-2': 'rect', '61-3': 'bat' }[no] })); blocks.push([xb, xa, z0, z1]); }
  // H 監視室側の壁ぎわ：論理制御盤×3・灯火インタフェース盤（No.71・72）、電流計測処理装置（No.73）。正面は +Z
  { const xa = xc(970), xb = xc(1107), nm = [['71', '論理制御盤'], ['71', '論理制御盤'], ['71', '論理制御盤'], ['72', '灯火インタフェース盤']];
    // 盤面は写真より：扉だけ（名札・番号札・ハンドル）。左から 72、71×3
    nm.forEach(([no, name], i) => cab(xa + (xb - xa) * (i + 1) / 4 + 0.004, xa + (xb - xa) * i / 4 - 0.004, Z0 + 0.02, Z0 + 0.72, 2.1, 'z+', 'trp', no, { parts: [['plt', 0.06, name, no === '72' ? 0.45 : 0.55, 0.45], ['tag', 0.88, 0.035, no, 0.12], ['handle', 0.15, 0.55]] })); blocks.push([xb, xa, Z0, Z0 + 0.72]);
    cab(xc(765), xc(730), Z0 + 0.02, Z0 + 0.72, 2.1, 'z+', 'trp', '73', { parts: [['plt', 0.035, '電流計測処理装置', 0.5, 0.5], ['tag', 0.88, 0.03, '73', 0.1], ['paper', 0.06, 0.2, 0.94, 0.45], ['paper', 0.2, 0.53, 0.8, 0.72], ['handle', 0.13, 0.55]] }); blocks.push([xc(765), xc(730), Z0, Z0 + 0.72]); }

  // ---------- 壁の物（扉・換気扇・壁掛けの盤）。扉は絵だけで、開かない ----------
  const doorTex = two => canvasTex(128, 256, (c, w, h) => {
    c.fillStyle = '#c9cbc4'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7d7f79'; c.lineWidth = 3; c.strokeRect(2, 2, w - 4, h - 4);
    if (two) { c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke(); }
    c.fillStyle = '#e3e5e6'; for (const x of two ? [w / 2 - 12, w / 2 + 6] : [w - 20]) c.fillRect(x, h * 0.52, 6, 22);
  });
  const dm2 = M(0xffffff, 0.2, 0.6, { map: doorTex(true) }), dm1 = M(0xffffff, 0.2, 0.6, { map: doorTex(false) });
  const e = 0.012;
  for (const [a, b] of [[290, 400], [1030, 1135]]) plane(zc(b) - zc(a), 2.2, dm2, X1 - e, 1.1, zc((a + b) / 2), 'x-');   // 外への両開き
  plane(0.9, 2.1, dm1, X1 - e, 1.05, zc(920), 'x-');
  const glassDoor = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#d4d2c8'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8d8b82'; c.lineWidth = 3; c.strokeRect(2, 2, w - 4, h - 4); c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();
    for (const x0 of [16, w / 2 + 12]) { c.fillStyle = '#b9c6c8'; c.fillRect(x0, 34, w / 2 - 28, 76); c.strokeStyle = 'rgba(80,90,92,.45)'; c.lineWidth = 0.6; for (let k = 0; k < 76; k += 5) { c.beginPath(); c.moveTo(x0, 34 + k); c.lineTo(x0 + w / 2 - 28, 34 + k); c.stroke(); } for (let k = 0; k < w / 2 - 28; k += 5) { c.beginPath(); c.moveTo(x0 + k, 34); c.lineTo(x0 + k, 110); c.stroke(); } }
    c.fillStyle = '#f2ea2a'; c.fillRect(22, 116, 88, 40); c.strokeStyle = '#333'; c.lineWidth = 1; c.strokeRect(24, 118, 84, 36); c.fillStyle = '#111'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('注 意', 66, 129);
    c.font = '5px sans-serif'; c.fillText('二酸化炭素消火設備があります', 66, 139); c.fillText('放送の指示に従い退避', 66, 147);
    c.fillStyle = '#c9cccf'; c.beginPath(); c.arc(w / 2 + 14, 140, 5, 0, 7); c.fill(); });
  for (const py of [690, 820]) plane(1.6, 2.1, M(0xffffff, 0.2, 0.6, { map: glassDoor }), xc(py), 1.05, Z0 + e, 'z+');
  // 入口の横：細長い保安器盤兼電気錠制御盤と、青い箱・書庫（写真より。位置は推測）
  cab(xc(690) - 1.0, xc(690) - 1.45, Z0 + 0.02, Z0 + 0.32, 1.9, 'z+', 'trp', '', { parts: [['plt', 0.05, '保安器盤兼電気錠制御盤', 0.5, 0.8], ['handle', 0.18, 0.5]] });
  box(xc(690) - 1.5, xc(690) - 0.95, 0, 0.32, Z0 + 0.34, Z0 + 0.74, M(0x1f5fd0, 0.1, 0.5)); blocks.push([xc(690) - 1.5, xc(690) - 0.95, Z0, Z0 + 0.74]);
  // CCT の前：キャスター付きの回路表示板（緑の札。文字は読めない線。位置は推測）
  { const wb = canvasTex(256, 160, (c, w, h) => { c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, w, h); for (let r = 0; r < 13; r++) for (const x0 of [8, 130]) { c.fillStyle = '#1f4a34'; c.fillRect(x0, 8 + r * 11, 110, 9); c.fillStyle = '#dfe7df'; c.fillRect(x0 + 6, 12 + r * 11, 70 - (r * 7) % 30, 1.6); c.fillStyle = '#3ad15a'; c.beginPath(); c.arc(x0 + 112, 12 + r * 11, 3, 0, 7); c.fill(); } });
    const zx = zc(400), xx = xc(820);
    plane(1.2, 0.8, M(0xffffff, 0.2, 0.5, { map: wb, side: THREE.DoubleSide }), xx, 1.35, zx, 'x+');
    const fr = M(0xb8b6ac, 0.5, 0.5); for (const dz of [-0.62, 0.62]) box(xx - 0.02, xx + 0.02, 0.1, 1.85, zx + dz - 0.02, zx + dz + 0.02, fr); box(xx - 0.3, xx + 0.3, 0.06, 0.1, zx - 0.65, zx + 0.65, fr); blocks.push([xx - 0.3, xx + 0.3, zx - 0.65, zx + 0.65]); }
  // 南の壁ぎわ：縦のケーブルダクト（アーチ形の上部）と、作業の札（作業対象＝青、操作禁止＝赤、点検中＝青）。灰色の書庫（位置は推測）
  { const tags = canvasTex(128, 256, (c, w, h) => { c.fillStyle = '#c9c4b4'; c.fillRect(0, 0, w, h);
      const tg = (x, y, bg, t) => { c.fillStyle = bg; c.fillRect(x, y, 14, 30); c.fillStyle = '#fff'; c.font = 'bold 7px sans-serif'; c.textAlign = 'center'; [...t].forEach((ch, i) => c.fillText(ch, x + 7, y + 8 + i * 7)); };
      for (let i = 0; i < 7; i++) tg(8 + i * 16, 20, '#1d4fc4', '作業対象'); for (let i = 0; i < 7; i++) tg(8 + i * 16, 110, '#d42a2a', '操作禁止'); for (let i = 0; i < 4; i++) tg(56 + i * 16, 150, '#1d3f9a', '点検中'); });
    for (const pz of [1010, 1060, 1110]) { const z = zc(pz);
      box(X0, X0 + 0.25, 0, 2.6, z - 0.33, z + 0.33, M(0xcbc6b6, 0.3, 0.6)); plane(0.6, 1.6, M(0xffffff, 0.2, 0.6, { map: tags }), X0 + 0.255, 1.5, z, 'x+');
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 8, 20, Math.PI / 2), M(0xcbc6b6, 0.3, 0.6)); arc.rotation.y = Math.PI / 2; arc.position.set(X0 + 0.6, 2.6, z); arc.rotation.z = Math.PI / 2; g.add(arc); }
    box(X0, X0 + 0.45, 0, 1.8, zc(930) - 0.45, zc(930) + 0.45, M(0x9b9a91, 0.3, 0.55)); blocks.push([X0, X0 + 0.45, zc(930) - 0.45, zc(930) + 0.45]);
    blocks.push([X0, X0 + 0.3, zc(1010) - 0.35, zc(1110) + 0.35]); }                                        // 監視室への扉
  const fanM = M(0x8d9296, 0.5, 0.5), fanD = M(0x2a2d30, 0.3, 0.7);
  for (const px of [450, 790, 1180]) { const z = zc(px); box(X1 - 0.08, X1, 2.5, 3.2, z - 0.35, z + 0.35, fanM); const d = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 24), fanD); d.rotation.z = Math.PI / 2; d.position.set(X1 - 0.09, 2.85, z); g.add(d); }
  for (const px of [450, 790, 1085]) { const z = zc(px); box(X0, X0 + 0.06, 0.24, 0.84, z - 0.4, z + 0.4, fanM); }                // 給気ファン（FL+240）
  const wb = (x, z, w, h, no, name) => {
    const dir = x > 0 ? 'x-' : 'x+', xa = x > 0 ? X1 - 0.18 : X0, m = M(0xffffff, 0.2, 0.55, { map: canvasTex(256, 256, (c, cw, ch) => { base(c, cw, ch); plateName(c, cw, 40, no, name); handle(c, cw, 130); }) });
    box(xa, xa + 0.18, 1.0, 1.0 + h, z - w / 2, z + w / 2, body); plane(w, h, m, x > 0 ? xa - 0.004 : xa + 0.184, 1.0 + h / 2, z, dir);
  };
  wb(1, zc(318), 0.6, 0.8, '53', '保安器盤 兼 電気錠制御盤'); wb(1, zc(488), 0.6, 0.8, '55', '接地端子盤'); wb(-1, zc(980), 0.6, 0.9, '54', '分電盤');
  // 室名の表示（入口のドアの上）
  { const m = M(0xffffff, 0, 0.6, { map: canvasTex(256, 72, (c, w, h) => { c.fillStyle = '#f4f4ee'; c.fillRect(0, 0, w, h); c.strokeStyle = '#333'; c.strokeRect(2, 2, w - 4, h - 4); c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 40px sans-serif'; c.fillText('発電機室', w / 2, h / 2 + 2); }) });
    plane(0.6, 0.17, m, (DX0 + DX1) / 2, 2.4, Z1 - 0.01, 'z-'); }

  const views = {
    道路駐車場照明盤: [[road.g.position.x-3.4,1.55,road.g.position.z],[road.g.position.x,1.15,road.g.position.z]],
    全体: [[-17.5, 15, -15], [-4.5, 0, -15]],
    入口から: [[-5.3, 1.65, -4.3], [-6.6, 1.2, -14]],
    受配電盤: [[-6.9, 1.7, -3.9], [-6.9, 1.2, -8.5]],
    CCRの列: [[-1.9, 1.9, -19.5], [-4.2, 1.1, -14]],
    CCRの中: [[-2.2, 1.5, -17.2], [-4.1, 1.3, -17.2]],
    CCT: [[-1.9, 1.6, -20.9], [-4.1, 1.2, -20.9]],
    CCR用UPS: [[-11.3, 1.6, -19.0], [-9.2, 1.1, -21.3]],
    変圧器盤: [[-2.6, 1.8, -10.6], [-0.9, 1.2, -17]],
    配電盤の中: [[-6.9, 1.5, -7.0], [-8.8, 1.1, -8.6]],
    引込計器盤の中: [[-7.6, 1.35, -6.9], [-4.8, 1.15, -5.4]],
    饋電盤の中: [[-6.7, 1.25, -8.2], [-4.8, 0.95, -7.0]],
    コンデンサ盤: [[-6.3, 1.65, -6.25], [-8.7, 1.25, -6.0]],
    直流電源盤の裏: [[-0.4, 1.6, -3.68], [-0.4, 0.9, -5.2]],
    インバータ盤の裏: [[1.65, 1.6, -3.68], [1.65, 0.9, -5.2]],
  };
  // 視点を選んだときに開ける区画の扉（hv.doors の番号。並びは build の順：E列 6・5・E4、F列 14・13・12）
  const openFor = { 配電盤の中: [['14', 1], ['12', 1]], 饋電盤の中: [['4', 0], ['4', 1], ['4', 2]], 引込計器盤の中: [['2', 0]] };
  const HVIN = '盤の中：区画の扉をタップすると開け閉めできます。配電盤・饋電盤の区画は、上に制御の棚（端子・補助リレー）、真ん中に引出形の真空遮断器（VCB）、床にレール。VT盤・ZPD盤の区画は、上に端子とヒューズの棚、真ん中に引出形の VT／ZPD。扉の裏に端子台・配線・変流器の銘板など。見る点：遮断器の入・切の表示、引出の位置（接続・試験・断路）、端子のゆるみ・変色、配線の被覆の傷み、盤内の結露・ほこり・異臭。※ 中身は VCB の区画1つと ZPD の区画1つの写真から作り、ほかの区画も同じ作りとしています（利用者の説明）。VT の区画は ZPD の写真を元にした推測です。寸法・部品の数は近似です。引込計器盤（No.2）は扉1枚で、上から 断路器 89R（アクリルの覆い・高圧危険の札）、木の板に取引用の計器・通信装置・試験端子箱、左に 89R の遠方手動操作器、制御の棚（配線用遮断器・ヒューズ・リレー）、下に避雷器 LA-R の引出し。扉の裏にのぞき窓。見る点：89R の入・切の位置とロックピン、計器の表示、試験端子箱の封印、LA-R の引出しの位置。※ 写真2枚から作りました。計器などの銘板の文字は入れていません。';
  const info = ['機器室（配置図からの想像モデル）', [
    ['受電・饋電盤の列（No.2〜6・74）', [[-7.2, 1.7, -4.2], [-5.0, 1.2, -7.6]], '役割：高圧で受電して、各系統へ送り出す盤の列です。図面の名称は、引込計器盤、受電盤、VT盤・ZPD盤、饋電盤、電力インタフェース盤です。', '見る点：計器の指示、表示灯、継電器の動作表示、異音・異臭、盤内の過熱の跡。', '根拠：点検の周期と項目は、保安規程（電気事業法 第42条）で定めます。', '※ 盤面は正面の写真に合わせました（No.2〜6）。電力インタフェース盤（No.74）は推測です。計器の目盛・整定は目安です。', HVIN],
    ['配電盤・コンデンサ盤の列（No.7〜14）', [[-6.6, 1.7, -4.2], [-9.2, 1.2, -7.6]], '役割：電源切換盤で、商用と発電機の電源を切り換え、配電盤から負荷へ送ります。コンデンサ盤は力率の改善用です。', '見る点：切換の状態表示、コンデンサのふくらみ・油漏れ・異音、直列リアクトルの過熱。', '※ 盤面は正面の写真に合わせました。', HVIN],
    ['コンデンサ盤の中（No.7・8）', [[-6.3, 1.65, -6.25], [-8.7, 1.25, -6.0]], '扉は1枚で、正面から見て右に蝶番があります。扉をタップすると開け閉めできます。中は上から、制御の区画（端子台、小形の配線用遮断器、ヒューズ）、コンデンサを入り切りする真空電磁接触器（88C）の引出し、通気口のある下の化粧板です。扉の裏には、配線ダクトと補助リレー、書類入れがあります。', '見る点：接触器の開閉回数計の進み方、引出しの位置と制御プラグのはまり、端子のゆるみ・変色、配線用遮断器の入・切、下の通気口のほこり。下の奥のコンデンサ・直列リアクトルは、ふくらみ・油漏れ・うなり音・におい。', '※ 写真3枚から作りました。No.8 の中は No.7 と同じ形で、札の「88C2」は推測です。下の化粧板の奥は写真がなく、作っていません。点検の周期と項目は、保安規程（電気事業法第42条）で定めたものに従います。'],
    ['変圧器盤の列（No.21〜28・52）', [[-3.0, 1.8, -10.4], [-0.9, 1.2, -17]], '役割：CCR用、照明用、所内動力用などの変圧器を納めた盤です。', '見る点：温度計の指示、うなり音の変化、通気口のほこり、油入なら油面と漏れ。', '※ 盤の中身（変圧器の種類・容量）は、図面からは読めず、未確認です。'],
    ['定電流調整器（CCR）の列（No.31〜52）', [[-1.9, 1.9, -19.5], [-4.2, 1.1, -14]], '役割：灯火の直列回路に、一定の電流を流す装置です。光度の段階（タップ）ごとに、出力電流を切り換えます。', '並び（写真より。正面は北向き、西から）：予備器-4／PAPI、ALS-2、REDL-2、予備器-2／予備器-3、RTZL、RCLL-2、ALS-1／予備器-1、ALS-1、RCLL-1、REDL-1。同じ回路名は、上段が操作部、下段がCCR本体です。', '操作部のパネル：押しボタン、遠方／直接の切換、絶縁抵抗の数字表示（MΩ）、接地警報設定（10・5・3・1・0.5MΩ・OFF）、警報音の入／切。', 'CCR本体のパネル：押しボタン3つ、遠方／直接の切換、液晶の表示画面。', '見る点：絶縁抵抗の表示と、その下がり方。接地警報の設定値。遠方／直接の位置。故障表示。通気口の詰まり。予備器へ切り換えられるか。', '扉：上段・下段とも、タップで開け閉めできます。中身は REDL-2 の写真に合わせ、全部の盤を同じ形にしてあります。上段（操作部）：一番上に照明、小形変圧器・操作箱、リレー・端子のユニット、基板、長い端子台、配線用遮断器・小形リレー、下に常用↔予備切替器（予備／常用、切・入の表示、手動操作のつまみ、動作回数計）。下段（CCR本体）：端子ユニット4つ、遮断器・電磁接触器・電源ユニット、リレー・端子の列、左に太いケーブルの束。扉の裏に、表示器の裏・基板・回路図。', '※ 盤ごとの中身の違い、部品の名前・数・配線は未確認です（写真1面分からの想像）。', '※ 押しボタンの文字は写真で読めず、色だけにしてあります。接地警報設定の値は写真から読んだもので、要確認です。形式名は表示していません。南の面は背面です。'],
    ['ケーブル切替盤・CCT（No.51・53〜58・87）', [[-1.9, 1.6, -20.9], [-4.1, 1.2, -20.9]], '並び（写真より。正面は北向き）：西から、掲示を貼った盤、ケーブル切替盤（上）と予備器（下）、TEDL-1・2（上）と TCLL-1・2（下）、RGL（下段だけの低い盤）。', '回路ごとの計器パネル：出力電流計（A）、絶縁抵抗計（MΩ）、表示灯（受電・開路・過電流・接地）、遠方／直接の切換、OFF・ON・RESET の押しボタン。', 'ケーブル切替盤：切換スイッチで、TEDL-1・2、TCLL-1・2 のどれか1回路を、予備器へ切り換えます。ふだんは OFF です。', '見る点：出力電流の指示、絶縁抵抗計の指示（低下の傾向）、開路・過電流・接地の表示、切換スイッチの位置、通気口の詰まり。', '※ 表示灯とボタンの文字は、写真から読んだもので、細部は要確認です。ケーブル導入盤（No.45）の位置は、写真では分からず、作っていません。形式名は表示していません。'],
    ['監視用UPS（No.61-1〜3）', [[0.3, 1.7, -8.6], [0.3, 1.1, -5.4]], '役割：監視・制御の機器へ、停電のときも電気を送り続けます。インバータ盤、直流電源盤、蓄電池盤の3面です。', '見る点：入出力の電圧・電流、故障表示、蓄電池の電圧・液面・温度、ファンの音。', '※ 盤面は写真に合わせました。正面の向きは推測です。'],
    ['直流電源盤・蓄電池盤の裏（No.61-2・61-3）', [[-0.4, 1.6, -3.68], [-0.4, 0.9, -5.2]], '裏の扉（1面に1枚）をタップすると開け閉めできます。裏から見て左が蓄電池盤、右が直流電源盤です。蓄電池盤は、棚が上下2段で、各段に蓄電池（据置の鉛蓄電池の形）が前後2列。電池どうしは太い黒い線でつなぎ、主の線は天井の穴へ抜けます。直流電源盤は格子の枠で、天井はエキスパンドメタルの網。上に灰色の箱2台と配線ダクト、真ん中に白い丸い機器と単相の変圧器、下に三相の変圧器2台があります。', '見る点：蓄電池の外観（ふくらみ・亀裂・液漏れ・端子の腐食）、電池どうしの線の締め付けと変色、変圧器のうなり・変色・過熱の跡、網の天井のほこり（風の通り）。', '※ 中身は裏から撮った写真6枚（2枚はぶれ）から作りました。裏が扉か外す板か、部品の数・寸法、灰色の箱が整流の機器か、白い丸い機器の用途は推測・未確認です。蓄電池のメーカーのロゴは入れていません。'],
    ['インバータ盤の裏（No.61-1）', [[1.65, 1.6, -3.68], [1.65, 0.9, -5.2]], '裏の扉をタップすると開け閉めできます（裏から見て右端の盤）。天井は角穴のパンチングの網。上から、緑の抵抗器3本、左右の太い線（赤い被覆の端子）、横の穴あきダクト、冷却ファン2台、基板3枚、電解コンデンサ3本、変圧器の巻線と巻線2つの変圧器（K・L の札）、下に三相の変圧器と雑音フィルタです。', '見る点：ファンが回っているか・異音・ほこり、コンデンサのふくらみ・液漏れ、抵抗器・基板の変色、変圧器のうなり・過熱の跡、線の締め付け。', '※ 写真3枚（1枚はぶれ）から作りました。部品の数・寸法・用途（K・L の札の機器が変圧器かリアクトルか、フィルタか）は推測・未確認です。'],
    ['CCR用UPS（No.62・63）', [[-11.3, 1.6, -19.0], [-9.2, 1.1, -21.3]], '役割：図面の名称は、CCR-U の入出力盤、UPS盤、蓄電池盤（No.1・No.2）です。図面では破線で描かれています。', '※ 盤面は No.1・No.2 の写真に合わせました。実物は1組6面（入出力盤、UPS盤、操作パネルの盤、蓄電池盤1、直流電流計の盤、蓄電池盤2）ですが、図面の3面に詰めて描いています。写真では UPS盤と蓄電池盤の間に操作パネルの盤がもう1面ありますが、図面の面数に合わせて省いています。破線の意味は未確認です。'],
    ['論理制御盤・灯火インタフェース盤（No.71〜73）', [[-8.5, 1.7, -24.2], [-8.5, 1.1, -26.4]], '役割：監視室の操作卓と、機器室の盤の間で、灯火の入・切と光度の指令、状態の信号を受け渡します。', '見る点：故障表示、電源表示、通信の異常表示。', '※ 論理制御盤（3面）と灯火インタフェース盤の正面は、写真のとおり扉だけです（表示・計器は扉の中）。電流計測処理装置（No.73）は推測です。'],
  ]];
  return { hv, openFor, dcDoors, road, group: g, doors: ccrDoors, blocks, room: [X0 + 0.1, X1 - 0.1, Z0 + 0.1, Z1 - 0.1], door: [DX0, DX1], views, info, capDoors };
}
