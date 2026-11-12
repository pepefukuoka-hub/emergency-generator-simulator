// 機器室（発電機室の入口のドアの向こう）。配置図から読み取った盤の並びを、箱と盤面の絵で作る。
// 教育用の想像モデル。位置は図面からの近似、盤面の絵・高さ・色は推測。形式名・メーカー名は入れない。
import * as THREE from 'three';

export function buildKiki({ M, canvasTex, plateMat }) {
  const g = new THREE.Group();
  const blocks = [];
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
  const wm = M(0xe9e8e0, 0, 0.95), DX0 = -5.8, DX1 = -4.8, DH = 2.15;
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
  const FINE = ['cct', 'rgl', 'paper', 'ccr'];
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
  DRAW.plain = () => (c, w, h) => { c.fillStyle = GRG; c.fillRect(0, 0, w, h); };
  // 盤1面：本体の箱＋正面の絵。dir は正面の向き。
  function cab(x0, x1, z0, z1, h, dir, kind, no, name, back) {
    box(x0, x1, 0.06, h, z0, z1, body); box(x0 + 0.02, x1 - 0.02, 0, 0.06, z0 + 0.02, z1 - 0.02, plinth);
    const e = 0.004, hh = h - 0.06, cy = 0.06 + hh / 2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, wd = dir[0] === 'x' ? z1 - z0 : x1 - x0;
    const tex = (k, a, b) => { const R = FINE.includes(k) ? 2 : 1, d = DRAW[k](a, b); return M(0xffffff, 0.2, 0.55, { map: canvasTex(256 * R, Math.round(256 * hh / wd) * R, (c, w, hc) => { c.save(); c.scale(R, R); d(c, w / R, hc / R); c.restore(); }) }); };
    const put = (m, d) => { if (d === 'x+') plane(wd, hh, m, x1 + e, cy, cz, d); else if (d === 'x-') plane(wd, hh, m, x0 - e, cy, cz, d); else if (d === 'z+') plane(wd, hh, m, cx, cy, z1 + e, d); else plane(wd, hh, m, cx, cy, z0 - e, d); };
    put(tex(kind, no, name), dir);
    if (back) put(tex('stack', back[0], back[1]), { 'x+': 'x-', 'x-': 'x+', 'z+': 'z-', 'z-': 'z+' }[dir]);
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
  row(442, 895, xc(680) - 0.1, xc(680) - 1.9, 2.3, 'x-', 'ups', [
    ['52', '急速充電器用変圧器盤'], ['28', '道路駐車場照明変圧器盤'], ['27', '所内動力変圧器盤'], ['26', '所内照明変圧器盤'], ['25', 'エプロン照明変圧器盤'],
    ['24', '照明変圧器盤-2'], ['23', '照明変圧器盤-1'], ['22', 'No.2 CCR変圧器盤'], ['21', 'No.1 CCR変圧器盤']]);
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
  // D CCR用UPS（No.62・63。図面では破線）。背中合わせの2列
  for (const [a, b, no, nm] of [[425, 458, '62-1', 'CCR-U No.1入出力盤'], [458, 492, '62-2', 'CCR-U No.1UPS盤'], [520, 556, '62-3', 'CCR-U No.1蓄電池盤']])
    row(a, b, xc(1020) + 0.5, xc(1020) - 0.5, 1.95, 'x+', 'ups', [[no, nm]], { pit: false, rack: false });
  for (const [a, b, no, nm] of [[458, 492, '63-3', 'CCR-U No.2蓄電池盤'], [525, 558, '63-2', 'CCR-U No.2UPS盤'], [558, 590, '63-1', 'CCR-U No.2入出力盤']])
    row(a, b, xc(1078) + 0.5, xc(1078) - 0.5, 1.95, 'x-', 'ups', [[no, nm]], { pit: false, rack: false });
  // E 受電・饋電盤の列（No.74・6〜2）。正面は −X。ドアの前をあけるため、図面より +X へ 0.5m 寄せた
  const eX = xc(850) + 0.5;
  row(968, 1172, eX, eX - 1.9, 2.3, 'x-', 'hv', [
    ['74', '電力インタフェース盤', 'ctl'], ['6', '饋電盤-5,6'], ['5', '饋電盤-2,3,4'], ['4', 'VT盤・ZPD盤・饋電盤-1'], ['3', '受電盤'], ['2', '引込計器盤']]);
  // F 配電盤・コンデンサ盤の列（No.14〜11・8・7）。正面は +X
  row(978, 1168, xc(1045), xc(1045) - 1.9, 2.3, 'x+', 'hv', [
    ['14', '配電盤-5,6,7'], ['13', '配電盤-2,3,4'], ['12', 'VT盤・ZPD盤・配電盤-1'], ['11', '電源切換盤'], ['8', 'コンデンサ盤-2', 'lv'], ['7', 'コンデンサ盤-1', 'lv']]);
  // G 監視用UPS（No.61-1〜3）。X方向に並ぶ。正面は −Z（推測）
  { const z0 = zc(1152), z1 = zc(1187), xa = xc(643), xb = xc(792), nm = [['61-1', '監視用UPS インバータ盤'], ['61-2', '監視用UPS 直流電源盤'], ['61-3', '監視用UPS 蓄電池盤']];
    nm.forEach(([no, name], i) => cab(xa + (xb - xa) * (i + 1) / 3 + 0.004, xa + (xb - xa) * i / 3 - 0.004, z0, z1, 2.0, 'z-', 'ups', no, name)); blocks.push([xb, xa, z0, z1]); }
  // H 監視室側の壁ぎわ：論理制御盤×3・灯火インタフェース盤（No.71・72）、電流計測処理装置（No.73）。正面は +Z
  { const xa = xc(970), xb = xc(1107), nm = [['71', '論理制御盤-1'], ['71', '論理制御盤-2'], ['71', '論理制御盤'], ['72', '灯火インタフェース盤']];
    nm.forEach(([no, name], i) => cab(xa + (xb - xa) * (i + 1) / 4 + 0.004, xa + (xb - xa) * i / 4 - 0.004, Z0 + 0.02, Z0 + 0.72, 2.1, 'z+', 'ctl', no, name)); blocks.push([xb, xa, Z0, Z0 + 0.72]);
    cab(xc(765), xc(730), Z0 + 0.02, Z0 + 0.72, 2.1, 'z+', 'ctl', '73', '電流計測処理装置'); blocks.push([xc(765), xc(730), Z0, Z0 + 0.72]); }

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
  for (const py of [690, 820]) plane(1.6, 2.1, dm2, xc(py), 1.05, Z0 + e, 'z+');                                        // 監視室への扉
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
    全体: [[-17.5, 15, -15], [-4.5, 0, -15]],
    入口から: [[-5.3, 1.65, -4.3], [-6.6, 1.2, -14]],
    受配電盤: [[-6.9, 1.7, -3.9], [-6.9, 1.2, -8.5]],
    CCRの列: [[-1.9, 1.9, -19.5], [-4.2, 1.1, -14]],
    CCT: [[-1.9, 1.6, -20.9], [-4.1, 1.2, -20.9]],
    変圧器盤: [[-2.6, 1.8, -10.6], [-0.9, 1.2, -17]],
  };
  const info = ['機器室（配置図からの想像モデル）', [
    ['受電・饋電盤の列（No.2〜6・74）', [[-7.2, 1.7, -4.2], [-5.0, 1.2, -7.6]], '役割：高圧で受電して、各系統へ送り出す盤の列です。図面の名称は、引込計器盤、受電盤、VT盤・ZPD盤、饋電盤、電力インタフェース盤です。', '見る点：計器の指示、表示灯、継電器の動作表示、異音・異臭、盤内の過熱の跡。', '根拠：点検の周期と項目は、保安規程（電気事業法 第42条）で定めます。', '※ 盤面の絵は推測です。実物の盤面の写真があれば、合わせ直します。'],
    ['配電盤・コンデンサ盤の列（No.7〜14）', [[-6.6, 1.7, -4.2], [-9.2, 1.2, -7.6]], '役割：電源切換盤で、商用と発電機の電源を切り換え、配電盤から負荷へ送ります。コンデンサ盤は力率の改善用です。', '見る点：切換の状態表示、コンデンサのふくらみ・油漏れ・異音、直列リアクトルの過熱。', '※ 盤面の絵は推測です。'],
    ['変圧器盤の列（No.21〜28・52）', [[-3.0, 1.8, -10.4], [-0.9, 1.2, -17]], '役割：CCR用、照明用、所内動力用などの変圧器を納めた盤です。', '見る点：温度計の指示、うなり音の変化、通気口のほこり、油入なら油面と漏れ。', '※ 盤の中身（変圧器の種類・容量）は、図面からは読めず、未確認です。'],
    ['定電流調整器（CCR）の列（No.31〜52）', [[-1.9, 1.9, -19.5], [-4.2, 1.1, -14]], '役割：灯火の直列回路に、一定の電流を流す装置です。光度の段階（タップ）ごとに、出力電流を切り換えます。', '並び（写真より。正面は北向き、西から）：予備器-4／PAPI、ALS-2、REDL-2、予備器-2／予備器-3、RTZL、RCLL-2、ALS-1／予備器-1、ALS-1、RCLL-1、REDL-1。同じ回路名は、上段が操作部、下段がCCR本体です。', '操作部のパネル：押しボタン、遠方／直接の切換、絶縁抵抗の数字表示（MΩ）、接地警報設定（10・5・3・1・0.5MΩ・OFF）、警報音の入／切。', 'CCR本体のパネル：押しボタン3つ、遠方／直接の切換、液晶の表示画面。', '見る点：絶縁抵抗の表示と、その下がり方。接地警報の設定値。遠方／直接の位置。故障表示。通気口の詰まり。予備器へ切り換えられるか。', '※ 押しボタンの文字は写真で読めず、色だけにしてあります。接地警報設定の値は写真から読んだもので、要確認です。形式名は表示していません。南の面は背面です。'],
    ['ケーブル切替盤・CCT（No.51・53〜58・87）', [[-1.9, 1.6, -20.9], [-4.1, 1.2, -20.9]], '並び（写真より。正面は北向き）：西から、掲示を貼った盤、ケーブル切替盤（上）と予備器（下）、TEDL-1・2（上）と TCLL-1・2（下）、RGL（下段だけの低い盤）。', '回路ごとの計器パネル：出力電流計（A）、絶縁抵抗計（MΩ）、表示灯（受電・開路・過電流・接地）、遠方／直接の切換、OFF・ON・RESET の押しボタン。', 'ケーブル切替盤：切換スイッチで、TEDL-1・2、TCLL-1・2 のどれか1回路を、予備器へ切り換えます。ふだんは OFF です。', '見る点：出力電流の指示、絶縁抵抗計の指示（低下の傾向）、開路・過電流・接地の表示、切換スイッチの位置、通気口の詰まり。', '※ 表示灯とボタンの文字は、写真から読んだもので、細部は要確認です。ケーブル導入盤（No.45）の位置は、写真では分からず、作っていません。形式名は表示していません。'],
    ['監視用UPS（No.61-1〜3）', [[0.3, 1.7, -8.6], [0.3, 1.1, -5.4]], '役割：監視・制御の機器へ、停電のときも電気を送り続けます。インバータ盤、直流電源盤、蓄電池盤の3面です。', '見る点：入出力の電圧・電流、故障表示、蓄電池の電圧・液面・温度、ファンの音。', '※ 正面の向きは推測です。'],
    ['CCR用UPS（No.62・63）', [[-6.2, 1.8, -17.2], [-8.6, 1.0, -21]], '役割：図面の名称は、CCR-U の入出力盤、UPS盤、蓄電池盤（No.1・No.2）です。図面では破線で描かれています。', '※ 破線の意味（将来分か、扉の開く範囲か）は未確認です。並びは簡略化しています。'],
    ['論理制御盤・灯火インタフェース盤（No.71〜73）', [[-8.5, 1.7, -24.2], [-8.5, 1.1, -26.4]], '役割：監視室の操作卓と、機器室の盤の間で、灯火の入・切と光度の指令、状態の信号を受け渡します。', '見る点：故障表示、電源表示、通信の異常表示。'],
  ]];
  return { group: g, blocks, room: [X0 + 0.1, X1 - 0.1, Z0 + 0.1, Z1 - 0.1], door: [DX0, DX1], views, info };
}
