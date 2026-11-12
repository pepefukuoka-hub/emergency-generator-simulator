// 機器室（発電機室の入口のドアの向こう）。配置図から読み取った盤の並びを、箱と盤面の絵で作る。
// 教育用の想像モデル。位置は図面からの近似、盤面の絵・高さ・色は推測。形式名・メーカー名は入れない。
import * as THREE from 'three';

export function buildKiki({ M, canvasTex, plateMat }) {
  const g = new THREE.Group();
  const blocks = [];
  // 室の内のり。発電機室（X −13〜3.6）と壁をそろえ、ドアの壁（Z −3.4）から −Z へ約23m。
  const X0 = -13, X1 = 3.6, Z0 = -26.5, Z1 = -3.62, H = 4.4;
  // 図面の写真の画素 → 座標（図の左＝−Z、図の上＝+X）
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
  // 盤1面：本体の箱＋正面の絵。dir は正面の向き。
  function cab(x0, x1, z0, z1, h, dir, kind, no, name) {
    box(x0, x1, 0.06, h, z0, z1, body); box(x0 + 0.02, x1 - 0.02, 0, 0.06, z0 + 0.02, z1 - 0.02, plinth);
    const m = M(0xffffff, 0.2, 0.55, { map: canvasTex(256, Math.round(256 * (h - 0.06) / (dir[0] === 'x' ? z1 - z0 : x1 - x0)), DRAW[kind](no, name)) });
    const e = 0.004, hh = h - 0.06, cy = 0.06 + hh / 2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (dir === 'x+') plane(z1 - z0, hh, m, x1 + e, cy, cz, dir); else if (dir === 'x-') plane(z1 - z0, hh, m, x0 - e, cy, cz, dir);
    else if (dir === 'z+') plane(x1 - x0, hh, m, cx, cy, z1 + e, dir); else plane(x1 - x0, hh, m, cx, cy, z0 - e, dir);
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
    items.forEach(([no, name, k], i) => cab(x0, x1, z0 + (z1 - z0) * i / n + 0.004, z0 + (z1 - z0) * (i + 1) / n - 0.004, h, dir, k || kind, no, name));
    blocks.push([x0, x1, z0, z1]);
    if (o.pit !== false) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.008, z1 - z0), plateMat); p.position.set(dir === 'x+' ? x1 + 0.45 : x0 - 0.45, 0.004, (z0 + z1) / 2); g.add(p); }
    if (o.rack !== false) rack((x0 + x1) / 2, z0 - 0.3, z1 + 0.3);
  }

  // A 変圧器盤の列（No.52・28〜21）。正面は −X（図の下向き）
  row(442, 895, xc(680) - 0.1, xc(680) - 1.9, 2.3, 'x-', 'tr', [
    ['52', '急速充電器用変圧器盤'], ['28', '道路駐車場照明変圧器盤'], ['27', '所内動力変圧器盤'], ['26', '所内照明変圧器盤'], ['25', 'エプロン照明変圧器盤'],
    ['24', '照明変圧器盤-2'], ['23', '照明変圧器盤-1'], ['22', 'No.2 CCR変圧器盤'], ['21', 'No.1 CCR変圧器盤']]);
  // B 定電流調整器（CCR）の列。上下2段。正面は +X（図の上向き）。上段＝操作部、下段＝CCR本体は推測
  row(640, 930, xc(870) - 0.05, xc(870) - 1.05, 2.3, 'x+', 'stack', [
    [['31', '32'], ['CCR 予備器-4', 'CCR PAPI']], [['49', '50'], ['操作部 ALS-2', 'CCR ALS-2']], [['47', '48'], ['操作部 REDL-2', 'CCR REDL-2']],
    [['46', '52'], ['CCR 予備器-2', 'CCR 予備器-3']], [['41', '42'], ['操作部 RTZL', 'CCR RTZL']], [['43', '44'], ['操作部 RCLL-2', 'CCR RCLL-2']],
    [['39', '40'], ['操作部 ALS-1', 'CCR 予備器-1']], [['37', '38'], ['操作部 ALS-1', 'CCR ALS-1']], [['35', '36'], ['操作部 RCLL-1', 'CCR RCLL-1']], [['33', '34'], ['操作部 REDL-1', 'CCR REDL-1']]]);
  // C 伝送ユニット盤・ケーブル切替盤・CCT（No.87・57・58・53〜56・45・51）。正面は +X
  row(420, 462, xc(875) - 0.05, xc(875) - 1.25, 2.1, 'x+', 'ctl', [['87', '伝送ユニット盤']], { rack: false });
  row(465, 560, xc(875) - 0.05, xc(875) - 1.05, 2.3, 'x+', 'stack', [
    [['57', '58'], ['ケーブル切替盤', 'CCT 予備器']], [['53,54', '55,56'], ['CCT TEDL-1・2', 'CCT TCLL-1・2']], [['45', '51'], ['ケーブル導入盤', 'CCT RGL']]]);
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
    変圧器盤: [[-2.6, 1.8, -10.6], [-0.9, 1.2, -17]],
  };
  const info = ['機器室（配置図からの想像モデル）', [
    ['受電・饋電盤の列（No.2〜6・74）', [[-7.2, 1.7, -4.2], [-5.0, 1.2, -7.6]], '役割：高圧で受電して、各系統へ送り出す盤の列です。図面の名称は、引込計器盤、受電盤、VT盤・ZPD盤、饋電盤、電力インタフェース盤です。', '見る点：計器の指示、表示灯、継電器の動作表示、異音・異臭、盤内の過熱の跡。', '根拠：点検の周期と項目は、保安規程（電気事業法 第42条）で定めます。', '※ 盤面の絵は推測です。実物の盤面の写真があれば、合わせ直します。'],
    ['配電盤・コンデンサ盤の列（No.7〜14）', [[-6.6, 1.7, -4.2], [-9.2, 1.2, -7.6]], '役割：電源切換盤で、商用と発電機の電源を切り換え、配電盤から負荷へ送ります。コンデンサ盤は力率の改善用です。', '見る点：切換の状態表示、コンデンサのふくらみ・油漏れ・異音、直列リアクトルの過熱。', '※ 盤面の絵は推測です。'],
    ['変圧器盤の列（No.21〜28・52）', [[-3.0, 1.8, -10.4], [-0.9, 1.2, -17]], '役割：CCR用、照明用、所内動力用などの変圧器を納めた盤です。', '見る点：温度計の指示、うなり音の変化、通気口のほこり、油入なら油面と漏れ。', '※ 盤の中身（変圧器の種類・容量）は、図面からは読めず、未確認です。'],
    ['定電流調整器（CCR）の列（No.31〜52）', [[-1.9, 1.9, -19.5], [-4.2, 1.1, -14]], '役割：灯火の直列回路に、一定の電流を流す装置です。光度の段階（タップ）ごとに、出力電流を切り換えます。回路名は ALS・REDL・RCLL・RTZL・PAPI など、図面の表記のままです。', '見る点：出力電流の指示、タップの表示、故障表示、通気口の詰まり、予備器への切換ができるか。', '※ 上下2段のうち、上段を操作部、下段をCCR本体としたのは推測です。形式名は表示していません。出力電流の値は、現場の資料で確認してください。'],
    ['ケーブル切替盤・CCT（No.45・51・53〜58・87）', [[-2.2, 1.8, -24.5], [-4.6, 1.1, -21]], '役割：図面の名称は、ケーブル導入盤、ケーブル切替盤、CCT（TEDL・TCLL・RGL・予備器）、伝送ユニット盤です。', '※ CCT の中身は、図面からは読めず、未確認です。'],
    ['監視用UPS（No.61-1〜3）', [[0.3, 1.7, -8.6], [0.3, 1.1, -5.4]], '役割：監視・制御の機器へ、停電のときも電気を送り続けます。インバータ盤、直流電源盤、蓄電池盤の3面です。', '見る点：入出力の電圧・電流、故障表示、蓄電池の電圧・液面・温度、ファンの音。', '※ 正面の向きは推測です。'],
    ['CCR用UPS（No.62・63）', [[-6.2, 1.8, -17.2], [-8.6, 1.0, -21]], '役割：図面の名称は、CCR-U の入出力盤、UPS盤、蓄電池盤（No.1・No.2）です。図面では破線で描かれています。', '※ 破線の意味（将来分か、扉の開く範囲か）は未確認です。並びは簡略化しています。'],
    ['論理制御盤・灯火インタフェース盤（No.71〜73）', [[-8.5, 1.7, -24.2], [-8.5, 1.1, -26.4]], '役割：監視室の操作卓と、機器室の盤の間で、灯火の入・切と光度の指令、状態の信号を受け渡します。', '見る点：故障表示、電源表示、通信の異常表示。'],
  ]];
  return { group: g, blocks, room: [X0 + 0.1, X1 - 0.1, Z0 + 0.1, Z1 - 0.1], door: [DX0, DX1], views, info };
}
