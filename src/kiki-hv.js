// 機器室の高圧の盤（受電・饋電盤の列、配電盤の列）の、区画ごとの扉と中身。
// 写真（VCB の区画：配電盤-7 の上の区画、ZPD の区画：配電盤-1 の上の区画）から作った。ほかの区画も同じ作りとして使い回す（利用者の指示）。
// 寸法・奥行き・扉の裏の部品の数は、写真からの近似と推測。メーカー名・形式名は入れない。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

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
  // 端子台・小形リレーの列（棚の奥の板）。黄色の配線が下へ
  const relayRow = (c, w, h, n, y0) => {
    c.fillStyle = '#9da1a6'; c.fillRect(0, y0 - 6, w, 12);
    for (let i = 0; i < n; i++) { const x = 10 + i * (w - 20) / n, ww = (w - 20) / n - 4;
      c.fillStyle = '#26272b'; c.fillRect(x, y0 - 22, ww, 44); c.fillStyle = i % 4 === 0 ? '#c9814a' : '#3a3c40'; c.fillRect(x + 3, y0 - 18, ww - 6, 10); c.fillStyle = '#ddd'; c.fillRect(x + 3, y0 + 4, ww - 6, 4);
      c.strokeStyle = '#e7c22a'; c.lineWidth = 2; for (const dx of [0.3, 0.7]) { c.beginPath(); c.moveTo(x + ww * dx, y0 + 22); c.lineTo(x + ww * dx + (i % 3 - 1) * 2, h); c.stroke(); } }
  };
  const vcbShelfT = texL(512, 128, (c, w, h) => { c.fillStyle = '#d6d3c4'; c.fillRect(0, 0, w, h); relayRow(c, w * 0.7, h, 14, 48);
    for (let i = 0; i < 3; i++) { const x = w * 0.74 + i * 40; c.fillStyle = '#2b2d33'; c.fillRect(x, 20, 34, 58); c.fillStyle = '#5b78a6'; c.fillRect(x + 4, 26, 26, 20); c.fillStyle = '#eee'; c.fillRect(x + 6, 52, 22, 6); c.strokeStyle = '#e7c22a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 17, 78); c.lineTo(x + 17, h); c.stroke(); } });
  const zpdShelfT = texL(512, 160, (c, w, h) => { c.fillStyle = '#d8d5c7'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f4f4ef'; c.fillRect(150, 8, 110, 20); c.strokeStyle = '#999'; c.strokeRect(150, 8, 110, 20); c.fillStyle = '#222'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, '盤内照明(5A)', 205, 18.5, 104, 14, false);
    c.fillStyle = '#b9bcbf'; c.fillRect(20, 70, w - 40, 22); c.fillStyle = '#8d9094'; for (let x = 26; x < w - 30; x += 18) c.fillRect(x, 77, 10, 8);
    c.fillStyle = '#f3f3f0'; c.fillRect(60, 44, 46, 74); c.fillStyle = '#c9cdd2'; c.beginPath(); c.arc(83, 70, 13, 0, 7); c.fill();   // ヒューズ
    for (const x of [190, 238]) { c.fillStyle = '#25262a'; c.fillRect(x, 42, 42, 78); c.fillStyle = '#e8e8e2'; c.fillRect(x + 5, 48, 32, 12); }
    for (let i = 0; i < 7; i++) { const x = 300 + i * 18 + (i > 2 ? 10 : 0); c.fillStyle = '#2a2b2e'; c.fillRect(x, 50, 15, 62); c.fillStyle = '#e8e8e2'; c.fillRect(x + 2, 60, 11, 6); }
    c.strokeStyle = '#e7c22a'; c.lineWidth = 2; for (const x of [80, 200, 222, 248, 270, 306, 324, 352, 370, 388]) { c.beginPath(); c.moveTo(x, 120); c.lineTo(x + 2, h); c.stroke(); } c.strokeStyle = '#2f8a3e'; c.beginPath(); c.moveTo(400, 112); c.lineTo(404, h); c.stroke(); });
  // 引出形の遮断器（VCB）の前面。形式名は入れず「VCB」だけ
  const vcbFrontT = texL(256, 200, (c, w, h) => {
    c.fillStyle = '#ddd8c6'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b9b4a2'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2);
    c.fillStyle = '#e9e6d8'; c.fillRect(38, 22, 180, 64); c.strokeStyle = '#3a3a3a'; c.lineWidth = 2.5; c.strokeRect(40, 24, 176, 60);
    c.fillStyle = '#2a2a2a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.save(); c.translate(128, 46); c.transform(1, 0, -0.22, 1, 0, 0); c.font = 'bold 30px sans-serif'; c.fillText('VCB', 0, 0); c.restore();
    c.fillStyle = '#555'; for (let k = 0; k < 4; k++) c.fillRect(56, 64 + k * 4.5, 144 - k * 14, 1.6);
    c.fillStyle = '#c9c4b2'; c.fillRect(20, 8, 26, 8); c.fillStyle = '#a33'; c.fillRect(150, 8, 18, 8);
    c.fillStyle = '#e3c51c'; c.fillRect(70, 112, 22, 10); c.fillStyle = '#fafafa'; c.fillRect(150, 104, 60, 30); c.fillStyle = '#e3c51c'; for (let k = 0; k < 3; k++) c.fillRect(153 + k * 19, 107, 16, 9); c.fillStyle = '#999'; for (let k = 0; k < 4; k++) c.fillRect(154, 120 + k * 3, 52, 1);
    c.fillStyle = '#fafafa'; c.fillRect(22, 146, 66, 44); c.fillStyle = '#999'; for (let k = 0; k < 9; k++) c.fillRect(26, 152 + k * 4, 56 - (k % 3) * 8, 1);
    c.fillStyle = '#fafafa'; c.fillRect(150, 140, 60, 50); c.fillStyle = '#777'; for (let k = 0; k < 9; k++) c.fillRect(154, 146 + k * 4.6, 50 - (k % 2) * 10, 1);
    c.fillStyle = '#e3c51c'; c.fillRect(214, 112, 26, 8); c.fillStyle = '#2a2a2a'; c.fillRect(108, 140, 26, 56); c.fillStyle = '#3d3d3d'; c.fillRect(112, 150, 18, 30);
  });
  // 引出形の ZPD／VT 本体の前面（写真は ZPD。VT は同じ形として名札だけ変える）
  const unitFront = kind => texL(256, 200, (c, w, h) => {
    c.fillStyle = '#ddd7c4'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b5af9c'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2);
    c.fillStyle = '#fafaf7'; c.fillRect(14, 10, 90, 24); c.strokeStyle = '#888'; c.lineWidth = 1; c.strokeRect(14, 10, 90, 24); c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, kind, 59, 23, 84, 18);
    c.fillStyle = '#f5f5f2'; c.fillRect(96, 64, 44, 42); c.fillStyle = '#888'; for (let k = 0; k < 8; k++) c.fillRect(100, 70 + k * 4.5, 36 - (k % 3) * 6, 1);
    c.fillStyle = '#e8e8e4'; c.fillRect(144, 86, 34, 18); c.fillStyle = '#c33'; c.fillRect(146, 88, 30, 2);
    c.fillStyle = '#fafafa'; c.fillRect(186, 42, 54, 12); c.fillStyle = '#e3c51c'; c.fillRect(188, 44, 14, 8); c.fillStyle = '#333'; c.font = 'bold 7px sans-serif'; c.fillText('注意', 214, 48.5);
    c.fillStyle = '#f2d321'; c.fillRect(34, 128, 60, 40); c.fillStyle = '#c22'; c.font = 'bold 7px sans-serif'; c.fillText('"注 意"', 64, 134); c.fillStyle = '#555'; for (let k = 0; k < 6; k++) c.fillRect(38, 140 + k * 4, 52 - (k % 2) * 8, 1);
    c.fillStyle = '#fafafa'; c.fillRect(110, 140, 40, 10); c.fillStyle = '#e3c51c'; c.fillRect(111, 141, 9, 8);
    c.fillStyle = '#333'; c.font = 'bold 7px sans-serif'; c.fillText('UNLOCK ← LOCK', 76, 186); c.fillStyle = '#d33'; c.fillRect(156, 180, 6, 10);
  });
  const zpdFrontT = unitFront('ZPD'), vtFrontT = unitFront('VT');
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

  // 共通：蛍光灯、右の縦ダクトと端子、左の黄色の配線、接地線
  function common(g, Wi, Hs) {
    B(g, Wi * 0.86, 0.03, 0.06, M(0xeeeeea, 0.1, 0.6), 0, Hs / 2 - 0.035, -0.16); C(g, 0.011, Wi * 0.78, tube, 0, Hs / 2 - 0.06, -0.15, 'x');
    for (const s of [-1, 1]) B(g, 0.018, 0.03, 0.03, M(0xeeeeea, 0.1, 0.6), s * Wi * 0.4, Hs / 2 - 0.06, -0.15);
    const d = B(g, 0.05, Hs * 0.8, 0.07, ductT, Wi / 2 - 0.045, -0.02, -0.17); d.material = [greyDuct, greyDuct, greyDuct, greyDuct, ductT, greyDuct];
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
    P(g, Wi * 0.86, 0.18, vcbShelfT, -0.02, ys + 0.1, -0.58);
    B(g, Wi * 0.6, 0.012, 0.012, silver, -0.1, ys + 0.115, -0.56);
    for (let i = 0; i < 10; i++) { const x = -Wi * 0.4 + i * Wi * 0.058; RB(g, 0.034, 0.05, 0.05, 0.004, black, x, ys + 0.115, -0.53); B(g, 0.022, 0.012, 0.004, i % 4 ? M(0x3a3c40, 0.2, 0.5) : M(0xc9814a, 0.1, 0.5), x, ys + 0.13, -0.504); }
    for (let i = 0; i < 3; i++) RB(g, 0.04, 0.07, 0.06, 0.004, M(0x2b2d33, 0.2, 0.5), Wi * 0.2 + i * 0.05, ys + 0.1, -0.52);
    // 札（回路の略号）を棚の前の縁に
    const tg = P(g, 0.11, 0.032, TAG.vcb, Wi * 0.18, ys - 0.03, -0.105);
    tg.userData.tagSlot = true;
    // 左の黄色の配線の束（棚から下へ）
    wire(g, [[-Wi / 2 + 0.03, ys + 0.05, -0.2], [-Wi / 2 + 0.035, ys - 0.15, -0.16], [-Wi / 2 + 0.03, -Hs / 2 + 0.15, -0.17]], 0.012, yellowW);
    // VCB 本体（引出形）。前面の絵＋立体の取っ手・トリップボタン・鍵
    const bw = Wi * 0.6, bh = Math.min(Hs * 0.52, 0.4), bd = 0.5, by = -Hs / 2 + 0.05 + bh / 2, bz = -0.13 - bd / 2, bx = -0.04;
    RB(g, bw, bh, bd, 0.012, unitM, bx, by, bz);
    P(g, bw - 0.01, bh - 0.01, vcbFrontT, bx, by, -0.129);
    for (const s of [-1, 1]) { C(g, 0.009, bh * 0.36, M(0x8a9099, 0.6, 0.35), bx + s * (bw / 2 - 0.025), by + bh * 0.15, -0.105); for (const dy of [-1, 1]) C(g, 0.006, 0.025, M(0x8a9099, 0.6, 0.35), bx + s * (bw / 2 - 0.025), by + bh * 0.15 + dy * bh * 0.15, -0.117, 'z'); }
    C(g, 0.016, 0.014, M(0x222222, 0.3, 0.5), bx - 0.015, by - bh * 0.02, -0.122, 'z', 20); C(g, 0.013, 0.02, red, bx - 0.015, by - bh * 0.02, -0.112, 'z', 20);
    C(g, 0.013, 0.014, M(0x2a2a2a, 0.3, 0.5), bx - 0.015, by - bh * 0.17, -0.122, 'z', 20); B(g, 0.006, 0.018, 0.012, silver, bx - 0.015, by - bh * 0.17, -0.11);
    // 左の黒い機器（操作機構の箱らしいもの。推測）
    RB(g, 0.06, bh * 0.5, 0.22, 0.006, black, bx - bw / 2 - 0.045, by + bh * 0.05, bz + 0.1);
    // 床：真ちゅう色のレールと、引き出し用の受け台（銀の板）
    for (const s of [-1, 1]) B(g, 0.03, 0.03, 0.62, brass, bx + s * bw * 0.42, -Hs / 2 + 0.03, -0.42);
    B(g, bw * 1.05, 0.008, 0.16, brass, bx, -Hs / 2 + 0.012, -0.1);
    B(g, bw * 0.45, 0.012, 0.11, silver, bx + 0.02, -Hs / 2 + 0.02, -0.09);
  }
  function unitInside(g, Wi, Hs, kind) {
    common(g, Wi, Hs);
    // 上の灰色の枠（DIN レール、ヒューズ、リレー、端子）
    const ys = Hs / 2 - 0.26, fw = Wi * 0.82, fh = 0.17;
    P(g, fw, fh, zpdShelfT, -0.03, ys + fh / 2, -0.5);
    for (const y of [ys, ys + fh]) B(g, fw + 0.02, 0.022, 0.38, greyDuct, -0.03, y, -0.31);
    for (const s of [-1, 1]) B(g, 0.022, fh, 0.38, greyDuct, -0.03 + s * fw / 2, ys + fh / 2, -0.31);
    B(g, fw * 0.92, 0.02, 0.012, silver, -0.03, ys + fh * 0.45, -0.49);
    for (const x of [-0.04, 0.0]) RB(g, 0.034, 0.075, 0.05, 0.004, black, -0.03 + x, ys + fh * 0.48, -0.465);
    for (let i = 0; i < 6; i++) RB(g, 0.016, 0.06, 0.04, 0.002, M(0x2a2b2e, 0.2, 0.5), -0.03 + 0.07 + i * 0.019, ys + fh * 0.45, -0.47);
    RB(g, 0.04, 0.07, 0.04, 0.004, M(0xf2f2ee, 0.1, 0.5), -0.03 - fw * 0.33, ys + fh * 0.48, -0.47);
    wire(g, [[-0.03 - fw / 2, ys + 0.02, -0.25], [-0.03 - fw / 2 - 0.02, ys - 0.03, -0.2], [-Wi / 2 + 0.02, ys - 0.06, -0.22]], 0.012, M(0x111111, 0.1, 0.6));
    // 本体（引出形）
    const uw = Wi * 0.6, uh = Math.min(Hs * 0.55, 0.42), ud = 0.45, uy = -Hs / 2 + 0.05 + uh / 2, uz = -0.14 - ud / 2, ux = -0.04;
    RB(g, uw, uh, ud, 0.008, unitM, ux, uy, uz);
    P(g, uw - 0.008, uh - 0.008, kind === 'vt' ? vtFrontT : zpdFrontT, ux, uy, -0.139);
    // 取っ手（コの字）
    B(g, 0.1, 0.012, 0.012, silver, ux, uy - uh * 0.22, -0.112); for (const s of [-1, 1]) B(g, 0.012, 0.012, 0.03, silver, ux + s * 0.045, uy - uh * 0.22, -0.125);
    // 右上の赤いコネクタと、灰色の配線の束（右のダクトへ）
    RB(g, 0.04, 0.035, 0.03, 0.004, red, ux + uw / 2 - 0.06, uy + uh * 0.28, -0.125);
    wire(g, [[ux + uw / 2 - 0.05, uy + uh * 0.24, -0.12], [ux + uw / 2 + 0.01, uy - uh * 0.15, -0.11], [Wi / 2 - 0.08, uy - uh * 0.05, -0.14], [Wi / 2 - 0.05, uy + uh * 0.2, -0.16]], 0.013, greyWrap);
    // 両わきの案内の板（左に札）
    for (const s of [-1, 1]) B(g, 0.014, uh * 1.05, 0.42, beige, ux + s * (uw / 2 + 0.035), uy, -0.36);
    P(g, 0.07, 0.025, TAG[kind], ux - uw / 2 - 0.035, uy + uh * 0.32, -0.148);
    // 床：亜鉛めっきの受け皿と、引き出し用の金具
    B(g, Wi * 0.86, 0.01, 0.62, galv, -0.02, -Hs / 2 + 0.008, -0.42);
    B(g, 0.03, 0.015, 0.16, silver, ux, -Hs / 2 + 0.02, -0.14); B(g, 0.05, 0.012, 0.02, silver, ux, -Hs / 2 + 0.03, -0.06);
  }
  // 扉の裏の部品（扉の座標：x −W/2〜W/2、蝶番は +W/2、裏は z<0）
  function doorBack(lf, W, Hs, kind) {
    P(lf, W - 0.004, Hs - 0.004, doorBackT, 0, 0, -0.0005, Math.PI);
    // 締め金具の棒とレバー（開く側）
    C(lf, 0.007, Hs * 0.9, silver, -W / 2 + 0.05, 0, -0.02); RB(lf, 0.04, 0.09, 0.012, 0.004, silver, -W / 2 + 0.08, -0.05, -0.025);
    if (kind === 'vcb') {
      // 縦の端子台とダクト（蝶番の側）、黒い丸い機器、小さい端子台、横のトレイ、下の黒い箱（写真より。数は簡略）
      const d = B(lf, 0.05, Hs * 0.62, 0.06, ductT, W / 2 - 0.11, Hs * 0.08, -0.035); d.material = [greyDuct, greyDuct, greyDuct, greyDuct, greyDuct, ductT];
      B(lf, 0.022, Hs * 0.55, 0.03, black, W / 2 - 0.16, Hs * 0.08, -0.02);
      C(lf, 0.045, 0.07, black, 0.0, Hs * 0.3, -0.04, 'z', 24);
      P(lf, 0.08, 0.04, plateT, -0.2, Hs * 0.4, -0.002, Math.PI); P(lf, 0.08, 0.04, plateT, -0.1, Hs * 0.4, -0.002, Math.PI);
      for (let i = 0; i < 4; i++) { RB(lf, 0.04, 0.045, 0.03, 0.004, black, -0.12 + i * 0.06, Hs * 0.05, -0.02); B(lf, 0.03, 0.01, 0.004, M(0xd96a1c, 0.1, 0.5), -0.12 + i * 0.06, Hs * 0.065, -0.036); }
      B(lf, W * 0.55, 0.05, 0.08, greyDuct, -0.03, -Hs * 0.07, -0.045);
      RB(lf, 0.2, Hs * 0.26, 0.085, 0.006, black, -0.02, -Hs * 0.3, -0.045);
      wire(lf, [[W / 2 - 0.1, Hs * 0.35, -0.05], [0.05, Hs * 0.2, -0.06], [0.0, Hs * 0.33, -0.06]], 0.006, yellowW);
      wire(lf, [[W / 2 - 0.1, -Hs * 0.05, -0.07], [W / 2 - 0.05, -Hs * 0.2, -0.06], [W / 2 - 0.02, -Hs * 0.35, -0.04]], 0.014, greyWrap);
    } else {
      const d = B(lf, 0.04, Hs * 0.3, 0.05, ductT, W / 2 - 0.1, Hs * 0.2, -0.03); d.material = [greyDuct, greyDuct, greyDuct, greyDuct, greyDuct, ductT];
      B(lf, W * 0.5, 0.045, 0.07, greyDuct, -0.03, -Hs * 0.02, -0.04);
      RB(lf, 0.13, Hs * 0.2, 0.07, 0.006, black, -0.01, -Hs * 0.28, -0.04);
      RB(lf, 0.05, 0.04, 0.03, 0.004, black, W / 2 - 0.2, Hs * 0.33, -0.02);
      wire(lf, [[W / 2 - 0.1, Hs * 0.05, -0.05], [W / 2 - 0.04, -Hs * 0.2, -0.05], [W / 2 - 0.02, -Hs * 0.32, -0.03]], 0.011, greyWrap);
    }
  }

  // 盤1面。p は親、pos は正面の中心（床の高さ）、ry は正面の向き、W 幅、D 奥行き、h 高さ、front は正面の絵の材質。
  // secs：上から各区画 [上端の割合, 下端の割合, 種類 'vcb'|'zpd'|'vt'|null]
  function build(p, pos, ry, W, D, h, front, secs) {
    const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = ry; p.add(g);
    const y0 = 0.06, hh = h - y0, cd = 0.72, t = 0.018;
    B(g, W, hh, D - cd, body, 0, y0 + hh / 2, -cd - (D - cd) / 2);
    B(g, W - 0.04, y0, D - 0.04, M(0x6d6f6a, 0.3, 0.7), 0, y0 / 2, -D / 2);
    for (const s of [-1, 1]) B(g, 0.02, hh, cd, body, s * (W / 2 - 0.01), y0 + hh / 2, -cd / 2);
    const yOf = f => y0 + hh * (1 - f);
    B(g, W, 0.02, cd, body, 0, yOf(0) - 0.01, -cd / 2);
    for (const [f0, f1, kind] of secs) {
      const ya = yOf(f1), yb = yOf(f0), Hs = yb - ya, yc = (ya + yb) / 2;
      B(g, W, 0.02, cd, body, 0, ya + 0.01, -cd / 2);                      // 区画の床（仕切り）
      // 扉：蝶番は正面から見て右（写真より）
      const pv = new THREE.Group(); pv.position.set(W / 2, yc, 0); g.add(pv);
      const lf = new THREE.Group(); lf.position.set(-W / 2, 0, 0); pv.add(lf);
      B(lf, W - 0.006, Hs - 0.006, t, body, 0, 0, t / 2);
      const geo = new THREE.PlaneGeometry(W - 0.006, Hs - 0.006), uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) ? 1 - f0 : 1 - f1);
      const fr = new THREE.Mesh(geo, front); fr.position.z = t + 0.001; lf.add(fr);
      if (!kind) continue;
      doorBack(lf, W, Hs, kind);
      const inner = new THREE.Group(); inner.position.set(0, yc, 0); g.add(inner);
      B(inner, W - 0.04, Hs - 0.04, 0.004, beige, 0, 0, -cd + 0.004);
      if (kind === 'vcb') vcbInside(inner, W - 0.04, Hs - 0.02); else unitInside(inner, W - 0.04, Hs - 0.02, kind);
      inner.visible = false;
      const d = { pv, lf, inner, cur: 0, target: 0, kind, g };
      lf.traverse(o => { o.userData.kd = doors.length; });
      doors.push(d);
    }
    return g;
  }
  const OPEN = 1.95;
  // 開いている区画を照らす光（1つを使い回す）。盤の中の蛍光灯のつもり
  const light = new THREE.PointLight(0xfff4e6, 0, 1.4, 1.6);
  let lastOpen = null;
  const open = i => { if (!doors[i].target) toggle(i); };
  const toggle = i => { const d = doors[i]; d.target = d.target ? 0 : OPEN; if (d.target) { lastOpen = d; d.inner.add(light); light.position.set(0, 0.05, 0.3); } };
  const tick = dt => {
    for (const d of doors) { if (d.cur === d.target) continue; d.cur += (d.target - d.cur) * Math.min(1, dt * 4); if (Math.abs(d.cur - d.target) < 0.002) d.cur = d.target; d.pv.rotation.y = d.cur; d.inner.visible = d.cur > 0.02; }
    light.intensity = lastOpen ? 0.9 * Math.min(1, lastOpen.cur / 1.0) : 0;
  };
  const hit = raycaster => { const h = raycaster.intersectObjects(doors.map(d => d.lf), true)[0]; return h ? h.object.userData.kd : undefined; };
  return { build, doors, toggle, open, tick, hit, OPEN };
}
