// 機器室の高圧の盤（受電・饋電盤の列、配電盤の列）の、区画ごとの扉と中身。
// 写真（VCB の区画：配電盤-7 の上の区画、ZPD の区画：配電盤-1 の上の区画）から作った。VCB・ZPD／VT／LA の本体、リレー・端子台・遮断器・ヒューズ・配線ダクトは、部品箱（src/parts.js、Blender で作成）の共通部品。ほかの区画も同じ作りとして使い回す（利用者の指示）。
// 寸法・奥行き・扉の裏の部品の数は、写真からの近似と推測。メーカー名・形式名は入れない。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makePart, PART } from './parts.js';

export function makeHv({ M, canvasTex }) {
  const doors = [];
  const fit = (c, t, x, y, maxW, px, bold = true) => { let s = px; do { c.font = (bold ? 'bold ' : '') + s + 'px sans-serif'; s--; } while (c.measureText(t).width > maxW && s > 6); c.fillText(t, x, y); };
  // ---------- 材質（全区画で共有） ----------
  const beige = M(0xd9d6c8, 0.15, 0.7, { emissive: 0x2a2924 }), body = M(0xd3d2c5, 0.25, 0.6), unitM = M(0xd8d2bf, 0.2, 0.55);
  const greyDuct = M(0x9ea3ad, 0.1, 0.6), black = M(0x1d1e21, 0.2, 0.55), brass = M(0xb8973c, 0.75, 0.35), silver = M(0xc9ccd0, 0.85, 0.3);
  const galv = M(0xa9afb4, 0.8, 0.4), yellowW = M(0xe7c22a, 0.1, 0.5), greyWrap = M(0x8b8e92, 0.1, 0.75), red = M(0xd8231f, 0.1, 0.4, { emissive: 0x400000 });
  const greenW = M(0x2f8a3e, 0.1, 0.5), tube = M(0xffffff, 0, 0.3, { emissive: 0xffffff, emissiveIntensity: 1.2 });
  const tex = (w, h, d) => M(0xffffff, 0.15, 0.6, { map: canvasTex(w, h, d) });
  // 盤内の蛍光灯に照らされた面（暗くなりすぎないよう、絵を少し光らせる）
  const texL = (w, h, d) => { const t = canvasTex(w, h, d); return M(0xffffff, 0.1, 0.65, { map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.12 }); };
  // 配線ダクト（すき間の切り込み）
  const ductT = tex(64, 256, (c, w, h) => { c.fillStyle = '#a3a8b1'; c.fillRect(0, 0, w, h); c.fillStyle = '#5f646c'; for (let y = 4; y < h; y += 10) { c.fillRect(0, y, 18, 5); c.fillRect(w - 18, y, 18, 5); } c.fillStyle = '#b8bcc4'; c.fillRect(22, 0, w - 44, h); });
  const shelfTag = texL(256, 52, (c, w, h) => { c.fillStyle = '#f4f4ef'; c.fillRect(0, 0, w, h); c.strokeStyle = '#999'; c.strokeRect(1, 1, w - 2, h - 2); c.fillStyle = '#222'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, '盤内照明(5A)', w / 2, h / 2 + 2, w - 16, 34, false); });
  // 区画の札（写真の札の文字は、回路の略号だけにした）
  const tagT = t => tex(128, 36, (c, w, h) => { c.fillStyle = '#fafaf7'; c.fillRect(0, 0, w, h); c.strokeStyle = '#999'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2); c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, t, w / 2, h / 2 + 1, w - 10, 26); });
  const TAG = { vcb: tagT('52F'), zpd: tagT('ZPD'), vt: tagT('VT') };
  // 扉の裏（平らな鋼板。ねじと、変流器の銘板らしい白い札2枚）
  const doorBackT = tex(256, 256, (c, w, h) => { c.fillStyle = '#d7d4c6'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b8b4a4'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4);
    c.fillStyle = '#888'; for (const [x, y] of [[14, 14], [w - 14, 14], [14, h - 14], [w - 14, h - 14]]) { c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); } });
  const plateT = tex(128, 64, (c, w, h) => { c.fillStyle = '#f7f7f4'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a4f9a'; c.fillRect(6, 6, 40, 8); c.fillStyle = '#777'; for (let k = 0; k < 8; k++) c.fillRect(6, 20 + k * 5, 110 - (k % 3) * 18, 1.5); });

  // ---------- 組み立ての道具 ----------
  const B = (p, w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); p.add(o); return o; };
  const RB = (p, w, h, d, r, m, x, y, z) => { const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m); o.position.set(x, y, z); p.add(o); return o; };
  const P = (p, w, h, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.y = ry; p.add(o); return o; };
  const C = (p, r, l, m, x, y, z, axis = 'y', seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, seg), m); o.position.set(x, y, z); if (axis === 'x') o.rotation.z = Math.PI / 2; if (axis === 'z') o.rotation.x = Math.PI / 2; p.add(o); return o; };
  const wire = (p, pts, r, m) => { const cv = new THREE.CatmullRomCurve3(pts.map(a => new THREE.Vector3(...a))); const o = new THREE.Mesh(new THREE.TubeGeometry(cv, 20, r, 6), m); p.add(o); return o; };

  // 部品箱（src/parts.js。Blender で作り、陰影を焼き込んだ共通部品）を置く。裏（取付面）の下の中心が基準で、手前が +Z
  const put = (p, name, x, y, z, sc = 1, opts) => { const o = makePart(name, opts); o.position.set(x, y, z); o.scale.setScalar(sc); p.add(o); return o; };
  // 穴あきの配線ダクトを横に渡す（長さ 0.24m の部品を並べ、端は縮める）。x0→x1、y は中心の高さ、z は取付面
  const ductRun = (p, x0, x1, y, z, sc = 0.7) => { const seg = PART.duct.L * sc; for (let x = x0; x < x1 - 0.005; x += seg) { const o = makePart('duct'), l = Math.min(seg, x1 - x); o.rotation.z = -Math.PI / 2; o.scale.set(sc, sc * l / seg, sc); o.position.set(x, y, z); p.add(o); } };
  // 縦の配線ダクト（y0→y1）。ry＝π で扉の裏向き
  const ductV = (p, x, y0, y1, z, ry = 0, sc = 0.9) => { const seg = PART.duct.L * sc; for (let y = y0; y < y1 - 0.005; y += seg) { const o = makePart('duct'), l = Math.min(seg, y1 - y); o.rotation.y = ry; o.scale.set(sc, sc * l / seg, sc); o.position.set(x, y, z); p.add(o); } };
  // 扉の裏に付く部品（手前が −Z）
  const putB = (p, name, x, y, sc = 1, rz = 0) => { const o = makePart(name); o.rotation.set(0, Math.PI, rz); o.position.set(x, y, -0.001); o.scale.setScalar(sc); p.add(o); return o; };
  // 細い線を何本か束ねた配線（太い1本の管にしない）
  const bundle = (p, pts, n, r, m, sp = 0.006) => { for (let k = 0; k < n; k++) { const a = k * 2.4, d = sp * Math.sqrt((k + 0.5) / n); wire(p, pts.map(([x, y, z], i) => [x + Math.cos(a + i * 0.5) * d, y, z + Math.sin(a + i * 0.5) * d]), r, m); } };
  const railM = M(0xc9ccd0, 0.85, 0.3);
  // 共通：蛍光灯、右の縦ダクトと端子、左の黄色の配線、接地線
  function common(g, Wi, Hs) {
    B(g, Wi * 0.86, 0.03, 0.06, M(0xeeeeea, 0.1, 0.6), 0, Hs / 2 - 0.035, -0.16); C(g, 0.011, Wi * 0.78, tube, 0, Hs / 2 - 0.06, -0.15, 'x');
    for (const s of [-1, 1]) B(g, 0.018, 0.03, 0.03, M(0xeeeeea, 0.1, 0.6), s * Wi * 0.4, Hs / 2 - 0.06, -0.15);
    ductV(g, Wi / 2 - 0.045, -0.02 - Hs * 0.4, -0.02 + Hs * 0.4, -0.2);
    B(g, 0.02, Hs * 0.45, 0.025, black, Wi / 2 - 0.045, 0.02, -0.125);
    for (let k = 0; k < 8; k++) B(g, 0.024, 0.006, 0.004, silver, Wi / 2 - 0.045, 0.02 - Hs * 0.2 + k * Hs * 0.055, -0.111);
    wire(g, [[Wi / 2 - 0.03, -Hs / 2 + 0.02, -0.13], [Wi / 2 - 0.05, -Hs * 0.3, -0.12], [Wi / 2 - 0.04, -Hs * 0.1, -0.13]], 0.004, greenW);
  }
  function vcbInside(g, Wi, Hs) {
    common(g, Wi, Hs);
    // 上の制御の棚：灰色の棚板、奥の板に端子・リレーの列（絵）、手前に立体のリレー
    const ys = Hs / 2 - 0.27;
    B(g, Wi * 0.9, 0.014, 0.5, greyDuct, -0.02, ys, -0.36);
    B(g, Wi * 0.9, 0.012, 0.012, greyDuct, -0.02, ys + 0.005, -0.112);
    // 奥の取付板に、金具レール・差し込み式のリレー10個・端子台2組、その下に横の配線ダクト（部品箱の共通部品）
    B(g, Wi * 0.86, 0.19, 0.004, beige, -0.02, ys + 0.105, -0.582);
    B(g, Wi * 0.8, 0.016, 0.006, railM, -0.02, ys + 0.125, -0.577);
    for (let i = 0; i < 10; i++) { const x = -Wi * 0.4 + i * 0.03; put(g, 'relay', x, ys + 0.088, -0.574);
      wire(g, [[x, ys + 0.09, -0.555], [x + 0.002, ys + 0.07, -0.55], [x, ys + 0.05, -0.56]], 0.002, yellowW); }
    for (let i = 0; i < 2; i++) put(g, 'tb', Wi * 0.4 - 0.16 + i * 0.11, ys + 0.1, -0.58);
    ductRun(g, -Wi * 0.43, Wi * 0.4, ys + 0.045, -0.58, 0.6);
    // 左の黄色の配線の束（棚から下へ）
    bundle(g, [[-Wi / 2 + 0.03, ys + 0.05, -0.2], [-Wi / 2 + 0.035, ys - 0.15, -0.16], [-Wi / 2 + 0.03, -Hs / 2 + 0.15, -0.17]], 9, 0.0026, yellowW, 0.009);
    // VCB 本体（引出形）：部品箱の共通部品（補助回路のプラグ・台枠・車輪まで含む）を、区画の高さに合わせて縮めて置く
    const V = PART.vcb, sc = Math.min(Hs * 0.57, 0.42) / V.H, bw = V.W * sc, bx = -0.02;
    put(g, 'vcb', bx, -Hs / 2 + 0.035, -0.15 - V.front * sc, sc, { tag: '52F' });
    // 床：真ちゅう色のレールと、引き出し用の受け台（銀の板）
    for (const s of [-1, 1]) { B(g, 0.03, 0.022, 0.6, chrom, bx + s * (bw * 0.5 - 0.02), -Hs / 2 + 0.016, -0.43); B(g, 0.004, 0.04, 0.6, chrom, bx + s * (bw * 0.5 + 0.012), -Hs / 2 + 0.025, -0.43); }
    B(g, bw * 1.12, 0.004, 0.2, chrom, bx, -Hs / 2 + 0.007, -0.1);
    const rp = RB(g, bw * 0.42, 0.006, 0.13, 0.002, M(0xb9bdc2, 0.75, 0.35), bx + 0.02, -Hs / 2 + 0.014, -0.085); rp.rotation.x = 0.06;
    B(g, 0.03, 0.002, 0.018, M(0x2f9a5a, 0.1, 0.6), bx + bw * 0.36, -Hs / 2 + 0.0095, -0.06);
  }
  function unitInside(g, Wi, Hs, kind) {
    common(g, Wi, Hs);
    // 上の灰色の枠（DIN レール、ヒューズ、リレー、端子）
    const ys = Hs / 2 - 0.26, fw = Wi * 0.82, fh = 0.17;
    B(g, fw, fh, 0.004, beige, -0.03, ys + fh / 2, -0.502);
    for (const y of [ys, ys + fh]) B(g, fw + 0.02, 0.022, 0.38, greyDuct, -0.03, y, -0.31);
    for (const s of [-1, 1]) B(g, 0.022, fh, 0.38, greyDuct, -0.03 + s * fw / 2, ys + fh / 2, -0.31);
    // 金具レールに、ヒューズ・小形の配線用遮断器2台・差し込み式のリレー6個（部品箱の共通部品）。上に名札、下へ黄色の線
    B(g, fw * 0.92, 0.02, 0.006, railM, -0.03, ys + fh * 0.5, -0.497);
    put(g, 'fuse', -0.03 - fw * 0.36, ys + fh * 0.5 - 0.036, -0.494, 0.92);
    for (let i = 0; i < 2; i++) put(g, 'cp', -0.03 - fw * 0.16 + i * 0.05, ys + fh * 0.5 - 0.04, -0.494, 0.85);
    for (let i = 0; i < 6; i++) put(g, 'relay', -0.03 + fw * 0.08 + i * 0.027 + (i > 2 ? 0.012 : 0), ys + fh * 0.5 - 0.037, -0.494);
    P(g, 0.085, 0.017, shelfTag, -0.03 - fw * 0.2, ys + fh - 0.022, -0.499);
    for (let i = 0; i < 9; i++) { const x = -0.03 - fw * 0.38 + i * fw * 0.095; wire(g, [[x, ys + fh * 0.3, -0.47], [x + 0.003, ys + 0.03, -0.46], [x, ys + 0.008, -0.47]], 0.002, i === 8 ? greenW : yellowW); }
    wire(g, [[-0.03 - fw / 2, ys + 0.02, -0.25], [-0.03 - fw / 2 - 0.02, ys - 0.03, -0.2], [-Wi / 2 + 0.02, ys - 0.06, -0.22]], 0.012, M(0x111111, 0.1, 0.6));
    // 本体（引出形）
    const U = PART.unit, sc = Math.min(Wi * 0.6 / U.W, Math.min(Hs * 0.55, 0.42) / U.H), uw = U.W * sc, uh = U.H * sc, uy = -Hs / 2 + 0.02 + uh / 2, ux = -0.04;
    // 本体と受け皿：部品箱の共通部品（取っ手・赤いコネクタと線・注意の札・止め金具まで含む）。名札は ZPD／VT で差し替える
    put(g, 'unit', ux, -Hs / 2 + 0.02, -0.14 - U.front * sc, sc, { tag: kind === 'vt' ? 'VT' : 'ZPD' });
    // 両わきの案内の板（左に札）
    for (const s of [-1, 1]) B(g, 0.014, uh * 1.05, 0.42, beige, ux + s * (uw / 2 + 0.035), uy, -0.36);
    P(g, 0.07, 0.025, TAG[kind], ux - uw / 2 - 0.035, uy + uh * 0.32, -0.148);
  }

  // ---------- 引込計器盤（No.2）の中：写真2枚（IMG_3624・3625）より。上から 照明、89R（断路器）とアクリルの覆い、木の板に取引用計器・通信装置・試験端子箱、左に遠方手動操作器、制御の棚、下に LA-R の引出し ----------
  const chromT = canvasTex(256, 64, (c, w, h) => {   // 有色クロメートめっき（黄緑〜金〜赤紫の色むら）
    const gr = c.createLinearGradient(0, 0, w, h); [['#c9c25a', 0], ['#a9c46a', 0.25], ['#d9b44c', 0.45], ['#b98fa0', 0.6], ['#cfc45e', 0.8], ['#9fbf74', 1]].forEach(([col, k]) => gr.addColorStop(k, col)); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(${150 + Math.random() * 90 | 0},${120 + Math.random() * 90 | 0},${60 + Math.random() * 120 | 0},.18)`; c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 8 + Math.random() * 30, 4 + Math.random() * 10, Math.random() * 3, 0, 7); c.fill(); } });
  const chrom = M(0xffffff, 0.75, 0.32, { map: chromT });
  const tan = M(0xd9c8a0, 0.15, 0.55), insul = M(0x4a2c22, 0.1, 0.45), copper = M(0xc7cdd2, 0.85, 0.28), redPart = M(0xa8322a, 0.2, 0.5);
  const acryl = new THREE.MeshPhysicalMaterial({ color: 0xeef4f6, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  const darkBack = M(0x26282c, 0.3, 0.6);
  const woodT = canvasTex(256, 320, (c, w, h) => { c.fillStyle = '#6a2f15'; c.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { c.strokeStyle = `rgba(${40 + Math.random() * 40 | 0},${12 + Math.random() * 14 | 0},4,.35)`; c.lineWidth = 0.6 + Math.random() * 1.6; c.beginPath(); const x = Math.random() * w; c.moveTo(x, 0); c.bezierCurveTo(x + 8 - Math.random() * 16, h * 0.3, x + 10 - Math.random() * 20, h * 0.7, x + 6 - Math.random() * 12, h); c.stroke(); } });
  const wood = M(0xffffff, 0.05, 0.35, { map: woodT });
  const signT = texL(256, 64, (c, w, h) => { c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, w, h); c.strokeStyle = '#bbb'; c.strokeRect(1, 1, w - 2, h - 2); c.fillStyle = '#d61f1f'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, '高圧危険', w / 2, h / 2 + 2, w - 20, 44, false); });
  const noteT = texL(256, 300, (c, w, h) => { c.fillStyle = '#fafaf7'; c.fillRect(0, 0, w, h); c.fillStyle = '#222'; c.font = 'bold 13px sans-serif'; c.fillText('遠方手動操作器', 14, 22); c.fillText('手動操作順序', 140, 22);
    c.strokeStyle = '#333'; c.lineWidth = 1.2; c.strokeRect(10, 30, 118, 90); c.beginPath(); c.arc(68, 78, 22, 0, 7); c.moveTo(20, 60); c.lineTo(110, 95); c.stroke();
    for (let k = 0; k < 3; k++) { c.strokeRect(140, 34 + k * 62, 40, 54); c.beginPath(); c.arc(160, 60 + k * 62, 9, 0, 7); c.stroke(); c.fillStyle = '#d22'; c.fillRect(184, 50 + k * 62, 18, 6); c.fillStyle = '#999'; for (let j = 0; j < 5; j++) c.fillRect(186, 62 + k * 62 + j * 5, 60, 1); }
    c.fillStyle = '#999'; for (let j = 0; j < 22; j++) c.fillRect(14, 130 + j * 6.5, 110 - (j % 4) * 10, 1.2); c.fillStyle = '#111'; c.fillRect(0, h - 34, w, 34); c.fillStyle = '#f1d21c'; for (let j = 0; j < 3; j++) c.fillRect(20, h - 28 + j * 8, 200 - j * 30, 1.5); });
  const meterT = texL(256, 340, (c, w, h) => {   // 取引用計器の前面（文字は線だけ。名称・形式・番号は入れない）
    c.fillStyle = '#e9ebec'; c.fillRect(0, 0, w, h); c.fillStyle = '#d42b25'; c.fillRect(20, 14, 52, 22); c.fillStyle = '#fff'; c.font = 'bold 14px sans-serif'; c.fillText('50A', 32, 31); c.fillStyle = '#2f8a3e'; c.fillRect(150, 14, 92, 22);
    c.fillStyle = '#c9cdc6'; c.fillRect(56, 50, 170, 92); c.strokeStyle = '#444'; c.lineWidth = 1.5; c.strokeRect(56, 50, 170, 92); c.fillStyle = '#2a2d2a'; c.font = 'bold 22px monospace'; c.fillText('0.139', 120, 82); c.fillText('0.267', 110, 128); c.font = 'bold 20px monospace'; c.fillText('d', 66, 82);
    c.fillStyle = '#888'; for (let j = 0; j < 9; j++) c.fillRect(30, 156 + j * 10, 190 - (j % 3) * 30, 1.6); for (let j = 0; j < 9; j++) c.fillRect(4, 50 + j * 16, 18, 10);
    c.fillStyle = '#111'; c.fillRect(60, 254, 110, 20); c.fillStyle = '#eee'; c.fillRect(70, 260, 90, 2); c.fillStyle = '#777'; c.fillRect(30, 282, 200, 1.5); c.fillRect(30, 296, 200, 1.5); });
  const commT = texL(256, 128, (c, w, h) => { c.fillStyle = '#7f8486'; c.fillRect(0, 0, w, h); c.fillStyle = '#fafafa'; c.fillRect(70, 22, 170, 52); c.fillStyle = '#888'; for (let j = 0; j < 6; j++) c.fillRect(76, 28 + j * 7, 110 - j * 8, 1.4); c.fillStyle = '#222'; for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) if ((i * 3 + j * 5) % 4) c.fillRect(204 + i * 4, 30 + j * 4, 3.4, 3.4); });
  const ckT = texL(128, 160, (c, w, h) => { c.fillStyle = '#6d7270'; c.fillRect(0, 0, w, h); c.strokeStyle = '#5b605e'; c.lineWidth = 3; c.strokeRect(16, 30, w - 32, h - 46); c.fillStyle = '#c4c7c8'; c.fillRect(30, 108, 68, 20); c.fillStyle = '#333'; for (let j = 0; j < 3; j++) c.fillRect(34, 112 + j * 5, 60 - j * 10, 1.2); });
  const shelfLT = texL(512, 128, (c, w, h) => { c.fillStyle = '#d8d5c7'; c.fillRect(0, 0, w, h); const lab = ['制御電源', '表示電源', '盤内照明・コンセント電源', '盤内照明(5A)', 'コンセント(15A)'], xs = [40, 115, 190, 330, 410];
    lab.forEach((t, i) => { c.fillStyle = '#f6f6f2'; c.fillRect(xs[i], 4, i === 2 ? 110 : 64, 16); c.fillStyle = '#222'; c.textAlign = 'left'; c.textBaseline = 'middle'; fit(c, t, xs[i] + 3, 12.5, (i === 2 ? 110 : 64) - 6, 11, false); });
    c.fillStyle = '#b9bcbf'; c.fillRect(10, 64, w - 20, 16); c.strokeStyle = '#e7c22a'; c.lineWidth = 2; for (let x = 40; x < w - 30; x += 13) { c.beginPath(); c.moveTo(x, 96); c.lineTo(x + 1, h); c.stroke(); } });
  const opT = texL(64, 128, (c, w, h) => { c.fillStyle = '#f3f3ef'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a9a4a'; c.font = 'bold 18px sans-serif'; c.save(); c.translate(36, 60); c.rotate(-Math.PI / 2); c.fillText('OFF', -50, 0); c.fillStyle = '#d22'; c.fillText('ON', 12, 0); c.restore(); c.fillStyle = '#d22'; c.fillRect(24, 54, 10, 14); });
  const lbl = (t, w = 0.09, ht = 0.034) => texL(128, Math.round(128 * ht / w), (c, cw, ch) => { c.fillStyle = '#fafaf7'; c.fillRect(0, 0, cw, ch); c.strokeStyle = '#222'; c.lineWidth = 3; c.strokeRect(2, 2, cw - 4, ch - 4); c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, t, cw / 2, ch / 2 + 1, cw - 12, ch * 0.75); });
  const tag89 = lbl('89R'), tagLA = lbl('LA-R');
  function inletInside(g, Wi, Hs) {
    common(g, Wi, Hs);
    const Y = t => Hs / 2 - t;                                   // 上からの距離 → 高さ
    // 左の縦ダクト（黄色の配線）
    ductV(g, -Wi / 2 + 0.035, Y(0.55) - Hs * 0.21, Y(0.55) + Hs * 0.21, -0.235);
    bundle(g, [[-Wi / 2 + 0.04, Y(0.08), -0.25], [-Wi / 2 + 0.03, Y(0.4), -0.17], [-Wi / 2 + 0.035, Y(0.95), -0.17]], 9, 0.0026, yellowW, 0.009);
    // ---- 89R（断路器）の区画 ----
    const t0 = 0.12, t1 = 1.02, zc0 = -0.42;
    B(g, Wi - 0.1, t1 - t0, 0.006, darkBack, 0, Y((t0 + t1) / 2), -0.66);
    B(g, Wi - 0.12, 0.04, 0.006, galv, 0, Y(0.66), -0.62);                                       // 奥の穴あきの帯
    for (let i = 0; i < 14; i++) B(g, 0.02, 0.012, 0.002, darkBack, -Wi / 2 + 0.1 + i * (Wi - 0.2) / 14, Y(0.66), -0.616);
    const ph = [[-0.19, 0xc8231d], [0, 0xe8e8e2], [0.19, 0x1f3fb4]];
    for (const [x, col] of ph) {
      const cm = M(col, 0.1, 0.5);
      B(g, 0.05, 0.36, 0.008, copper, x, Y(0.13 + 0.18), zc0 - 0.04);                          // 上の母線
      C(g, 0.012, 0.004, cm, x, Y(0.36), zc0 - 0.035, 'z', 20);                                  // 相の色の丸
      RB(g, 0.06, 0.075, 0.03, 0.004, copper, x, Y(0.47), zc0); C(g, 0.011, 0.02, silver, x, Y(0.47), zc0 + 0.02, 'z', 12);   // 上の端子とボルト
      B(g, 0.03, 0.012, 0.006, M(0xd8a020, 0.2, 0.5), x, Y(0.43), zc0 + 0.016); B(g, 0.03, 0.012, 0.006, cm, x, Y(0.445), zc0 + 0.016);
      for (const dx of [-0.017, 0.017]) RB(g, 0.011, 0.31, 0.022, 0.003, tan, x + dx, Y(0.66), zc0 + 0.005);                  // 刃（2枚）
      C(g, 0.018, 0.28, insul, x - 0.035, Y(0.66), zc0 - 0.12); for (let k = 0; k < 5; k++) C(g, 0.026, 0.008, insul, x - 0.035, Y(0.54 + k * 0.055), zc0 - 0.12, 'y', 20);   // がいし（かさ付き）
      B(g, 0.05, 0.03, 0.03, redPart, x, Y(0.66), zc0 + 0.03);                                    // 操作の連結（赤）
      RB(g, 0.06, 0.07, 0.03, 0.004, copper, x, Y(0.85), zc0); C(g, 0.011, 0.02, silver, x, Y(0.85), zc0 + 0.02, 'z', 12);
      B(g, 0.05, 0.16, 0.008, copper, x, Y(0.96), zc0 - 0.04);                                   // 下の母線
      B(g, 0.03, 0.012, 0.006, M(0xd8a020, 0.2, 0.5), x, Y(0.9), zc0 - 0.034); C(g, 0.012, 0.004, cm, x, Y(0.94), zc0 - 0.035, 'z', 20);
    }
    const bp = B(g, Wi * 0.66, 0.13, 0.01, chrom, 0, Y(0.66), zc0 - 0.08);                       // クロメートの台板
    P(g, 0.04, 0.05, plateT, -0.1, Y(0.66), zc0 - 0.074); P(g, 0.05, 0.035, plateT, 0.08, Y(0.65), zc0 - 0.074);
    C(g, 0.009, Wi * 0.78, silver, 0.03, Y(0.66), zc0 + 0.045, 'x');                             // 操作軸
    C(g, 0.045, 0.012, brass, Wi * 0.38, Y(0.66), zc0 + 0.045, 'x', 28);                          // 軸の端の円板
    RB(g, 0.05, 0.06, 0.05, 0.004, chrom, -Wi * 0.36, Y(0.64), zc0 - 0.03); C(g, 0.014, 0.03, M(0xb87333, 0.6, 0.4), -Wi * 0.36, Y(0.64), zc0 + 0.0, 'x', 16);   // 左の小さな機構（コイル）
    // アクリルの覆いと、留め金具・札
    P(g, Wi - 0.06, t1 - t0 + 0.02, acryl, 0, Y((t0 + t1) / 2), -0.12);
    for (const sx of [-1, 1]) for (const tt of [0.2, 0.92]) { RB(g, 0.035, 0.05, 0.03, 0.004, silver, sx * (Wi / 2 - 0.04), Y(tt), -0.12); C(g, 0.009, 0.034, silver, sx * (Wi / 2 - 0.04), Y(tt), -0.11, 'z', 12); }
    P(g, 0.26, 0.065, signT, 0.0, Y(0.96), -0.116); P(g, 0.08, 0.04, tag89, 0.25, Y(0.96), -0.116); P(g, 0.2, 0.235, noteT, -0.25, Y(0.84), -0.116);
    // ---- 横の仕切りと、木の板 ----
    B(g, Wi, 0.04, 0.55, beige, 0, Y(1.05), -0.38);
    B(g, Wi * 0.2, 0.5, 0.01, beige, -Wi * 0.4, Y(1.3), -0.55);
    const bx = 0.04, bw = 0.44, bh = 0.56, bz = -0.4;
    B(g, bw, bh, 0.018, wood, bx, Y(1.07 + bh / 2), bz);
    for (const [dx, dt] of [[-1, 0.03], [1, 0.03], [-1, bh - 0.03], [1, bh - 0.03]]) C(g, 0.009, 0.012, silver, bx + dx * (bw / 2 - 0.025), Y(1.07 + dt), bz + 0.012, 'z', 12);
    // 取引用計器（透明カバー付き）
    const mx = bx - 0.07, mt = 1.17, mz = bz + 0.009;
    RB(g, 0.155, 0.05, 0.075, 0.006, M(0x2a2c2e, 0.2, 0.5), mx, Y(mt + 0.145), mz + 0.04);
    RB(g, 0.15, 0.2, 0.07, 0.01, M(0xdfe2e4, 0.1, 0.4), mx, Y(mt + 0.02), mz + 0.035);
    P(g, 0.135, 0.18, meterT, mx, Y(mt + 0.02), mz + 0.0705);
    RB(g, 0.158, 0.21, 0.08, 0.012, acryl, mx, Y(mt + 0.02), mz + 0.042);
    // 通信装置（灰色の箱）と端子
    RB(g, 0.15, 0.1, 0.05, 0.006, M(0x878c8f, 0.15, 0.5), bx + 0.13, Y(1.13), mz + 0.025); P(g, 0.14, 0.07, commT, bx + 0.13, Y(1.13), mz + 0.0505);
    RB(g, 0.15, 0.03, 0.04, 0.004, M(0x7c8184, 0.15, 0.5), bx + 0.13, Y(1.195), mz + 0.02);
    B(g, 0.06, 0.02, 0.02, black, bx + 0.09, Y(1.2), mz + 0.042);
    // 色の配線（計器の下から右へ）と、黄色の束・黒いケーブル
    const cols = [0xc8231d, 0x1f3fb4, 0x7a4a2a, 0xe7c22a, 0xf2f2ee, 0x2f8a3e];
    cols.forEach((col, i) => wire(g, [[mx - 0.05 + i * 0.018, Y(mt + 0.17), mz + 0.03], [mx - 0.04 + i * 0.016, Y(mt + 0.21), mz + 0.03], [mx + 0.06, Y(mt + 0.225 + i * 0.004), mz + 0.03], [bx + 0.08, Y(mt + 0.215), mz + 0.03]], 0.0035, M(col, 0.1, 0.5)));
    for (const [c2, dy] of [[0xc8231d, 0], [0x1f3fb4, 0.01], [0xe7c22a, 0.02]]) wire(g, [[bx + 0.1 + dy, Y(1.2), mz + 0.04], [bx + 0.1 + dy, Y(1.3), mz + 0.04], [bx + 0.06, Y(1.42), mz + 0.03]], 0.003, M(c2, 0.1, 0.5));
    wire(g, [[bx + 0.06, Y(1.43), mz + 0.03], [bx + 0.18, Y(1.44), mz + 0.03], [Wi / 2 - 0.05, Y(1.45), -0.17]], 0.006, yellowW);
    wire(g, [[bx + 0.17, Y(1.2), mz + 0.03], [bx + 0.18, Y(1.5), mz + 0.04], [bx + 0.05, Y(1.58), mz + 0.05], [-0.05, Y(1.63), -0.3]], 0.006, black);
    // 試験端子箱（チェックターミナル）
    RB(g, 0.17, 0.2, 0.06, 0.02, M(0x6f7472, 0.25, 0.45), bx - 0.04, Y(1.5), mz + 0.03); P(g, 0.16, 0.19, ckT, bx - 0.04, Y(1.5), mz + 0.0605);
    C(g, 0.012, 0.03, M(0x6f7472, 0.25, 0.45), bx - 0.04, Y(1.385), mz + 0.03, 'y', 16);
    // ---- 左の遠方手動操作器（89R を動かす） ----
    const ox = -Wi / 2 + 0.09, oz = -0.16;
    B(g, 0.11, 0.34, 0.01, chrom, ox, Y(1.28), oz - 0.04);
    P(g, 0.03, 0.09, opT, ox - 0.02, Y(1.32), oz - 0.034);
    RB(g, 0.05, 0.05, 0.05, 0.006, chrom, ox + 0.02, Y(1.15), oz); C(g, 0.03, 0.02, chrom, ox + 0.02, Y(1.2), oz - 0.01, 'z', 24);
    const arm = RB(g, 0.03, 0.2, 0.008, 0.004, chrom, ox + 0.04, Y(1.22), oz + 0.02); arm.rotation.z = -0.5;
    for (const dx of [-0.02, 0.025]) { const sp = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 40 }, (_, k) => new THREE.Vector3(ox + dx + Math.cos(k * 1.2) * 0.008, Y(1.36) + k * 0.0018, oz + Math.sin(k * 1.2) * 0.008))), 80, 0.0018, 4), silver); g.add(sp); }
    C(g, 0.008, 0.6, silver, ox - 0.035, Y(1.32), oz - 0.02);
    // ---- 制御の棚（小形の配線用遮断器3台・ヒューズ2本・リレー・端子） ----
    const ys = Y(1.88), fh = 0.24, fw = Wi * 0.82;
    P(g, fw, fh, shelfLT, -0.02, ys + fh / 2, -0.42);
    for (const y of [ys, ys + fh]) { B(g, fw + 0.02, 0.012, 0.1, greyDuct, -0.02, y, -0.37); const lip = B(g, fw + 0.02, 0.04, 0.012, ductT, -0.02, y + (y === ys ? 0.014 : -0.014), -0.32); lip.material = [greyDuct, greyDuct, greyDuct, greyDuct, ductT, greyDuct]; }
    for (const sx of [-1, 1]) B(g, 0.03, fh, 0.1, greyDuct, -0.02 + sx * fw / 2, ys + fh / 2, -0.37);
    B(g, fw * 0.94, 0.02, 0.012, silver, -0.02, ys + fh * 0.5, -0.41);
    for (let i = 0; i < 3; i++) put(g, 'cp', -fw / 2 + 0.08 + i * 0.07, ys + fh * 0.5 - 0.047, -0.404);
    for (let i = 0; i < 2; i++) put(g, 'fuse', 0.06 + i * 0.045, ys + fh * 0.5 - 0.039, -0.404);
    for (let i = 0; i < 4; i++) put(g, 'relay', 0.16 + i * 0.027, ys + fh * 0.5 - 0.037, -0.404);
    put(g, 'tb', fw / 2 - 0.075, ys + fh * 0.5 - 0.022, -0.404, 0.8);
    // ---- LA-R の引出し（ZPD と同じ形。写真より） ----
    const U = PART.unit, usc = 0.27 / U.H, uw = U.W * usc, uh = 0.27, uy = -Hs / 2 + 0.03 + uh / 2, ux = -0.02;
    put(g, 'unit', ux, -Hs / 2 + 0.03, -0.14 - U.front * usc, usc, { tag: 'LA-R' });
    for (const sx of [-1, 1]) B(g, 0.014, uh * 1.1, 0.42, beige, ux + sx * (uw / 2 + 0.035), uy, -0.36);
    P(g, 0.07, 0.026, tagLA, ux - uw / 2 - 0.035, uy + uh * 0.36, -0.148);
    // 右の黒い波付き管
    wire(g, [[Wi / 2 - 0.09, Y(0.1), -0.3], [Wi / 2 - 0.08, Y(0.9), -0.2], [Wi / 2 - 0.09, Y(1.7), -0.2], [0.05, Y(1.95), -0.3]], 0.008, black);
  }
  // 扉の裏の部品（扉の座標：x −W/2〜W/2、蝶番は +W/2、裏は z<0）
  function doorBack(lf, W, Hs, kind) {
    P(lf, W - 0.004, Hs - 0.004, doorBackT, 0, 0, -0.0005, Math.PI);
    // 締め金具の棒とレバー（開く側）
    C(lf, 0.007, Hs * 0.9, silver, -W / 2 + 0.05, 0, -0.02); RB(lf, 0.04, 0.09, 0.012, 0.004, silver, -W / 2 + 0.08, -0.05, -0.025);
    if (kind === 'inlet') {
      // 引込計器盤の扉の裏（写真より）：蝶番の側に縦ダクト2本と灰色の束、上に小さな棚とリレー、のぞき窓のステンレスの枠、下に書類入れ
      for (const dx of [0.07, 0.16]) ductV(lf, W / 2 - dx, -Hs * 0.45, Hs * 0.41, -0.001, Math.PI);
      wire(lf, [[W / 2 - 0.115, Hs * 0.45, -0.07], [W / 2 - 0.12, 0, -0.075], [W / 2 - 0.11, -Hs * 0.4, -0.07]], 0.016, greyWrap);
      B(lf, 0.2, 0.012, 0.09, greyDuct, W / 2 - 0.3, Hs * 0.33, -0.05); B(lf, 0.2, 0.05, 0.01, greyDuct, W / 2 - 0.3, Hs * 0.345, -0.095);
      for (const [x, y] of [[W / 2 - 0.32, Hs * 0.36], [W / 2 - 0.28, Hs * 0.36], [W / 2 - 0.3, Hs * 0.25]]) putB(lf, 'relay', x, y, 1.2);
      const fs = new THREE.Shape(), r = 0.05, ww = 0.3, wh = 0.46, rr = (s2, w2, h2, r2) => { s2.moveTo(-w2 / 2 + r2, -h2 / 2); s2.lineTo(w2 / 2 - r2, -h2 / 2); s2.quadraticCurveTo(w2 / 2, -h2 / 2, w2 / 2, -h2 / 2 + r2); s2.lineTo(w2 / 2, h2 / 2 - r2); s2.quadraticCurveTo(w2 / 2, h2 / 2, w2 / 2 - r2, h2 / 2); s2.lineTo(-w2 / 2 + r2, h2 / 2); s2.quadraticCurveTo(-w2 / 2, h2 / 2, -w2 / 2, h2 / 2 - r2); s2.lineTo(-w2 / 2, -h2 / 2 + r2); s2.quadraticCurveTo(-w2 / 2, -h2 / 2, -w2 / 2 + r2, -h2 / 2); };
      rr(fs, ww, wh, r); const hole = new THREE.Path(); rr(hole, ww - 0.04, wh - 0.04, r - 0.015); fs.holes.push(hole);
      const fr = new THREE.Mesh(new THREE.ExtrudeGeometry(fs, { depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 3, curveSegments: 8 }), M(0xc9ccd0, 0.9, 0.22)); fr.position.set(-0.08, Hs * 0.05, -0.02); lf.add(fr);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(ww - 0.04, wh - 0.04), new THREE.MeshPhysicalMaterial({ color: 0x9fb2b8, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.45 })); gl.position.set(-0.08, Hs * 0.05, -0.006); gl.rotation.y = Math.PI; lf.add(gl);
      B(lf, 0.22, 0.2, 0.025, M(0xd7d4c6, 0.15, 0.6), -0.05, -Hs * 0.3, -0.02);
      return;
    }
    if (kind === 'vcb') {
      // 縦の端子台とダクト（蝶番の側）、黒い丸い機器、小さい端子台、横のトレイ、下の黒い箱（写真より。数は簡略）
      ductV(lf, W / 2 - 0.11, Hs * 0.08 - Hs * 0.31, Hs * 0.08 + Hs * 0.31, -0.001, Math.PI);
      for (let k = 0, n = Math.floor(Hs * 0.55 / 0.107); k < n; k++) putB(lf, 'tb', W / 2 - 0.185, Hs * 0.08 + (k - (n - 1) / 2) * 0.107, 1, Math.PI / 2);
      C(lf, 0.045, 0.07, black, 0.0, Hs * 0.3, -0.04, 'z', 24);
      P(lf, 0.08, 0.04, plateT, -0.2, Hs * 0.4, -0.002, Math.PI); P(lf, 0.08, 0.04, plateT, -0.1, Hs * 0.4, -0.002, Math.PI);
      for (let i = 0; i < 4; i++) putB(lf, 'relay', -0.12 + i * 0.045, Hs * 0.02, 1.2);
      B(lf, W * 0.55, 0.05, 0.08, greyDuct, -0.03, -Hs * 0.07, -0.045);
      RB(lf, 0.2, Hs * 0.26, 0.085, 0.006, black, -0.02, -Hs * 0.3, -0.045);
      wire(lf, [[W / 2 - 0.1, Hs * 0.35, -0.05], [0.05, Hs * 0.2, -0.06], [0.0, Hs * 0.33, -0.06]], 0.006, yellowW);
      wire(lf, [[W / 2 - 0.1, -Hs * 0.05, -0.07], [W / 2 - 0.05, -Hs * 0.2, -0.06], [W / 2 - 0.02, -Hs * 0.35, -0.04]], 0.014, greyWrap);
    } else {
      ductV(lf, W / 2 - 0.1, Hs * 0.05, Hs * 0.35, -0.001, Math.PI, 0.8);
      B(lf, W * 0.5, 0.045, 0.07, greyDuct, -0.03, -Hs * 0.02, -0.04);
      RB(lf, 0.13, Hs * 0.2, 0.07, 0.006, black, -0.01, -Hs * 0.28, -0.04);
      putB(lf, 'relay', W / 2 - 0.2, Hs * 0.28, 1.2);
      wire(lf, [[W / 2 - 0.1, Hs * 0.05, -0.05], [W / 2 - 0.04, -Hs * 0.2, -0.05], [W / 2 - 0.02, -Hs * 0.32, -0.03]], 0.011, greyWrap);
    }
  }

  // 盤1面。p は親、pos は正面の中心（床の高さ）、ry は正面の向き、W 幅、D 奥行き、h 高さ、front は正面の絵の材質。
  // secs：上から各区画 [上端の割合, 下端の割合, 種類 'vcb'|'zpd'|'vt'|null]
  function build(p, pos, ry, W, D, h, front, secs, no) {
    const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = ry; p.add(g);
    const y0 = 0.06, hh = h - y0, cd = 0.72, t = 0.018;
    B(g, W, hh, D - cd, body, 0, y0 + hh / 2, -cd - (D - cd) / 2);
    B(g, W - 0.04, y0, D - 0.04, M(0x6d6f6a, 0.3, 0.7), 0, y0 / 2, -D / 2);
    for (const s of [-1, 1]) B(g, 0.02, hh, cd, body, s * (W / 2 - 0.01), y0 + hh / 2, -cd / 2);
    const yOf = f => y0 + hh * (1 - f);
    B(g, W, 0.02, cd, body, 0, yOf(0) - 0.01, -cd / 2);
    secs.forEach(([f0, f1, kind], si) => {
      const ya = yOf(f1), yb = yOf(f0), Hs = yb - ya, yc = (ya + yb) / 2;
      B(g, W, 0.02, cd, body, 0, ya + 0.01, -cd / 2);                      // 区画の床（仕切り）
      // 扉：蝶番は正面から見て右（写真より）
      const pv = new THREE.Group(); pv.position.set(W / 2, yc, 0); g.add(pv);
      const lf = new THREE.Group(); lf.position.set(-W / 2, 0, 0); pv.add(lf);
      B(lf, W - 0.006, Hs - 0.006, t, body, 0, 0, t / 2);
      const geo = new THREE.PlaneGeometry(W - 0.006, Hs - 0.006), uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) ? 1 - f0 : 1 - f1);
      const fr = new THREE.Mesh(geo, front); fr.position.z = t + 0.001; lf.add(fr);
      if (!kind) return;
      doorBack(lf, W, Hs, kind);
      const inner = new THREE.Group(); inner.position.set(0, yc, 0); g.add(inner);
      B(inner, W - 0.04, Hs - 0.04, 0.004, beige, 0, 0, -cd + 0.004);
      if (kind === 'vcb') vcbInside(inner, W - 0.04, Hs - 0.02); else if (kind === 'inlet') inletInside(inner, W - 0.04, Hs - 0.02); else unitInside(inner, W - 0.04, Hs - 0.02, kind);
      inner.visible = false;
      const d = { pv, lf, inner, cur: 0, target: 0, kind, g, no, si };
      lf.traverse(o => { o.userData.kd = doors.length; });
      doors.push(d);
    });
    return g;
  }
  const OPEN = 1.95;
  // 開いている区画を照らす光（1つを使い回す）。盤の中の蛍光灯のつもり
  const light = new THREE.PointLight(0xfff4e6, 0, 1.4, 1.6);
  let lastOpen = null;
  const find = (no, si) => doors.findIndex(d => d.no === no && d.si === si);
  const open = i => { if (i >= 0 && !doors[i].target) toggle(i); };
  const toggle = i => { const d = doors[i]; d.target = d.target ? 0 : OPEN; if (d.target) { lastOpen = d; d.inner.add(light); light.position.set(0, d.kind === 'inlet' ? 0.25 : 0.05, d.kind === 'inlet' ? 0.5 : 0.3); light.distance = d.kind === 'inlet' ? 2.4 : 1.4; } };
  const tick = dt => {
    for (const d of doors) { if (d.cur === d.target) continue; d.cur += (d.target - d.cur) * Math.min(1, dt * 4); if (Math.abs(d.cur - d.target) < 0.002) d.cur = d.target; d.pv.rotation.y = d.cur; d.inner.visible = d.cur > 0.02; }
    light.intensity = lastOpen ? 0.9 * Math.min(1, lastOpen.cur / 1.0) : 0;
  };
  const hit = raycaster => { const h = raycaster.intersectObjects(doors.map(d => d.lf), true)[0]; return h ? h.object.userData.kd : undefined; };
  return { build, doors, toggle, open, find, tick, hit, OPEN };
}
