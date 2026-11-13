// 機器室の CCR の盤：扉（上段・下段）と、その中身。
// 写真（ドライブ「機器室」IMG_3609〜3614：REDL-2 の上段・下段を開けたところ）を元にした、全部の CCR 共通の中身。
// 利用者の指示で、上段・下段とも、全部の盤をこの写真の形でそろえてある（盤ごとの違いは未確認）。
// 部品の数・配線・寸法は写真からの近似（実測ではない）。メーカー名・形式名・銘板の文字は入れない。
import * as THREE from 'three';

export function makeCcrInside({ M, canvasTex }) {
  // ---------- 共通の材質 ----------
  const mt = {
    shell: M(0xd5d2c6, 0.2, 0.62), inner: M(0xdcd9cc, 0.1, 0.75), steel: M(0x9da3ae, 0.45, 0.45), steelD: M(0x7f8590, 0.5, 0.45),
    black: M(0x1c1d20, 0.1, 0.55), white: M(0xeeeee8, 0.05, 0.45), gray: M(0xc9cac6, 0.2, 0.5), cable: M(0x16171a, 0.05, 0.6),
    yel: M(0xe8c422, 0.05, 0.5), green: M(0x2e8a3c, 0.05, 0.5), led: M(0xffffff, 0, 0.3, { emissive: 0xfff8ee, emissiveIntensity: 1.2 }),
    acryl: new THREE.MeshStandardMaterial({ color: 0xdfe8ec, metalness: 0, roughness: 0.08, transparent: true, opacity: 0.22, depthWrite: false }),
    brass: M(0xbf9b4a, 0.8, 0.35),
  };
  // ---------- 描画の道具 ----------
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  const grad = (c, x, y, w, h, a, b) => { const g = c.createLinearGradient(x, y, x, y + h); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const screw = (c, x, y, r = 3.2) => { c.fillStyle = '#7e8184'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillStyle = '#d7d9db'; c.beginPath(); c.arc(x - r * 0.25, y - r * 0.25, r * 0.7, 0, 7); c.fill(); c.strokeStyle = '#555'; c.lineWidth = r * 0.35; c.beginPath(); c.moveTo(x - r * 0.6, y); c.lineTo(x + r * 0.6, y); c.stroke(); };
  const wire = (c, col, lw, pts) => { c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 4) c.quadraticCurveTo(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = lw * 0.3; c.stroke(); };
  const termRow = (c, x, y, w, h, n, wcol = '#e3c21e') => {   // 端子台（白い台に、ねじと黄色い線）
    c.fillStyle = grad(c, x, y, w, h, '#f4f3ee', '#c9c8c0'); rr(c, x, y, w, h, 2); c.fill(); c.strokeStyle = '#888'; c.lineWidth = 1; c.stroke();
    for (let i = 0; i < n; i++) { const xx = x + (i + 0.5) * w / n; c.fillStyle = '#9a9ca0'; c.fillRect(xx - w / n * 0.38, y + h * 0.2, w / n * 0.76, h * 0.6); screw(c, xx, y + h * 0.5, Math.min(w / n, h) * 0.24);
      if (wcol) { c.strokeStyle = wcol; c.lineWidth = 2.2; c.beginPath(); c.moveTo(xx, y + h); c.lineTo(xx, y + h + 10); c.stroke(); } }
  };
  const relay = (c, x, y, w, h, inner = '#e9d9a8') => {   // 透明カバーの小形リレー（中に白い台・銅色のコイル）
    c.fillStyle = '#ece9e0'; rr(c, x, y + h * 0.78, w, h * 0.22, 2); c.fill();
    c.fillStyle = 'rgba(225,232,236,.85)'; rr(c, x, y, w, h * 0.8, 3); c.fill(); c.strokeStyle = '#9aa'; c.lineWidth = 1; c.stroke();
    c.fillStyle = inner; c.fillRect(x + w * 0.2, y + h * 0.15, w * 0.6, h * 0.4); c.fillStyle = '#b8743a'; c.fillRect(x + w * 0.3, y + h * 0.22, w * 0.4, h * 0.25);
    c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(x + 2, y + 2, w * 0.18, h * 0.6);
  };
  const mccb = (c, x, y, w, h, col = '#e9e8e2') => {     // 配線用遮断器（灰白の本体、黒い取っ手、白い窓）
    c.fillStyle = grad(c, x, y, w, h, col, '#bdbcb4'); rr(c, x, y, w, h, 3); c.fill(); c.strokeStyle = '#777'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#2a2b2e'; rr(c, x + w * 0.38, y + h * 0.36, w * 0.24, h * 0.24, 2); c.fill(); c.fillStyle = '#f5f5f0'; c.fillRect(x + w * 0.12, y + h * 0.1, w * 0.3, h * 0.14);
    c.fillStyle = '#d53a2c'; c.fillRect(x + w * 0.62, y + h * 0.12, w * 0.12, h * 0.08);
    for (let i = 0; i < 3; i++) { screw(c, x + w * (0.22 + i * 0.28), y + h * 0.05, 2.4); screw(c, x + w * (0.22 + i * 0.28), y + h * 0.93, 2.4); }
  };
  const pcb = (c, x, y, w, h, seed = 1) => {             // 緑の基板（IC・コンデンサ・コネクタ）
    c.fillStyle = grad(c, x, y, w, h, '#2f8a4a', '#1f6a36'); c.fillRect(x, y, w, h); c.strokeStyle = '#174d27'; c.lineWidth = 1.5; c.strokeRect(x, y, w, h);
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    let s = seed * 9301; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    c.strokeStyle = 'rgba(160,220,170,.35)'; c.lineWidth = 0.8; for (let i = 0; i < 26; i++) { c.beginPath(); const a = x + r() * w, b = y + r() * h; c.moveTo(a, b); c.lineTo(a + (r() - 0.5) * w * 0.5, b); c.lineTo(a + (r() - 0.5) * w * 0.5, b + (r() - 0.5) * h * 0.4); c.stroke(); }
    for (let i = 0; i < 9; i++) { c.fillStyle = '#141516'; c.fillRect(x + r() * w * 0.8, y + r() * h * 0.8, w * 0.08 + r() * w * 0.06, h * 0.05 + r() * h * 0.05); }
    for (let i = 0; i < 6; i++) { const cx = x + w * 0.1 + r() * w * 0.8, cy = y + h * 0.1 + r() * h * 0.8; c.fillStyle = '#1b1c20'; c.beginPath(); c.arc(cx, cy, w * 0.03, 0, 7); c.fill(); c.fillStyle = '#9aa0a8'; c.beginPath(); c.arc(cx, cy, w * 0.018, 0, 7); c.fill(); }
    for (let i = 0; i < 4; i++) { c.fillStyle = '#f2f2ea'; c.fillRect(x + w * (0.08 + i * 0.22), y + h - h * 0.12, w * 0.14, h * 0.08); }
    c.restore();
  };
  const cableV = (c, x, y0, y1, n, col = '#141518') => { for (let i = 0; i < n; i++) { c.fillStyle = col; c.fillRect(x + i * 7, y0, 6, y1 - y0); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x + i * 7 + 1, y0, 1.5, y1 - y0); } };
  const paperDwg = (c, x, y, w, h) => {                  // 回路図の紙（文字は読めない線）
    c.fillStyle = '#f7f7f2'; c.fillRect(x, y, w, h); c.strokeStyle = '#999'; c.lineWidth = 1; c.strokeRect(x, y, w, h);
    c.strokeStyle = '#555'; c.lineWidth = 0.8; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(x + w * 0.06, y + h * (0.12 + i * 0.09)); c.lineTo(x + w * (0.3 + (i * 37 % 50) / 100), y + h * (0.12 + i * 0.09)); c.stroke(); }
    for (let i = 0; i < 6; i++) { c.strokeRect(x + w * (0.12 + i * 0.13), y + h * (0.3 + (i % 3) * 0.15), w * 0.06, h * 0.08); c.beginPath(); c.moveTo(x + w * (0.15 + i * 0.13), y + h * 0.15); c.lineTo(x + w * (0.15 + i * 0.13), y + h * 0.85); c.stroke(); }
  };

  // ---------- 取付板の絵（上段＝操作部、下段＝CCR本体）。3Dの部品の後ろに見える細かい部品・配線 ----------
  const PW = 600, PH = 1000;   // 取付板の絵の大きさ（幅0.61m・高さ1.04m に貼る）
  const plateUp = canvasTex(PW, PH, (c, w, h) => {
    c.fillStyle = grad(c, 0, 0, 0, h, '#d9d6c9', '#c9c6b8'); c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(0,0,0,.025)'; c.fillRect(Math.random() * w, Math.random() * h, 30, 2); }
    // 一番上：リレー・端子のユニット3つ（黒地に白い端子）と黄色い小形リレー
    for (let i = 0; i < 3; i++) { const x = 175 + i * 78; c.fillStyle = '#202124'; rr(c, x, 70, 60, 92, 4); c.fill(); termRow(c, x + 18, 76, 24, 80, 5, null);
      for (let k = 0; k < 5; k++) { wire(c, '#e2c11c', 3, [x + 18, 82 + k * 16, x - 6, 86 + k * 16, x - 4, 150]); wire(c, '#e7e7e0', 2.4, [x + 42, 82 + k * 16, x + 64, 90 + k * 16, x + 54, 168]); } }
    for (let i = 0; i < 3; i++) relay(c, 418 + i * 40, 92, 32, 58, '#f0c43a'); termRow(c, 410, 154, 130, 18, 8);
    // 緑の基板（右）と、配線
    pcb(c, 330, 255, 200, 140, 3); wire(c, '#e2c11c', 3, [330, 290, 300, 280, 280, 300]); wire(c, '#7a6aa8', 2.5, [530, 300, 560, 320, 548, 360]); wire(c, '#d8463c', 2.5, [530, 330, 566, 350, 552, 380]);
    // 長い端子台（中段）と小さな赤いスイッチ
    c.fillStyle = '#222'; rr(c, 30, 492, 110, 30, 3); c.fill(); c.fillStyle = '#c8322a'; c.fillRect(56, 497, 26, 20); c.fillStyle = '#ddd'; c.fillRect(90, 498, 40, 18);
    c.fillStyle = '#9ea0a2'; c.fillRect(170, 486, 360, 44); c.fillStyle = '#e9e7df'; c.fillRect(176, 492, 348, 32);
    for (let i = 0; i < 26; i++) { screw(c, 184 + i * 13, 500, 3); screw(c, 184 + i * 13, 516, 3); wire(c, '#e2c11c', 2, [184 + i * 13, 492, 186 + i * 13, 476, 190 + i * 13, 466]); }
    c.fillStyle = '#26a65a'; c.fillRect(170, 492, 6, 32); c.fillStyle = '#26a65a'; c.fillRect(524, 492, 6, 32);
    // 下段：配線用遮断器2つ、小形リレー4つ、ヒューズ2つ、青い機器
    mccb(c, 60, 600, 62, 96); mccb(c, 128, 600, 62, 96); c.fillStyle = '#222'; c.fillRect(120, 612, 12, 30);
    c.fillStyle = '#b9bcc0'; c.fillRect(225, 640, 330, 12);
    for (let i = 0; i < 4; i++) relay(c, 235 + i * 34, 600, 28, 80);
    for (let i = 0; i < 2; i++) { c.fillStyle = '#efeee8'; rr(c, 380 + i * 30, 604, 24, 76, 3); c.fill(); c.strokeStyle = '#888'; c.stroke(); c.fillStyle = '#c94a3a'; c.fillRect(386 + i * 30, 616, 12, 8); }
    c.fillStyle = grad(c, 450, 596, 30, 84, '#2f6fd8', '#1e4fa8'); rr(c, 450, 596, 30, 84, 3); c.fill(); c.fillStyle = '#fff'; c.fillRect(456, 606, 18, 10);
    for (let i = 0; i < 12; i++) wire(c, '#e2c11c', 2, [70 + i * 34, 700, 72 + i * 34, 720, 76 + i * 34, 740]);
    // 左の縦の端子台とケーブル
    c.fillStyle = '#e8e6de'; c.fillRect(16, 520, 26, 300); for (let i = 0; i < 20; i++) screw(c, 29, 528 + i * 14, 3);
    cableV(c, 4, 0, h, 2);
  });
  const plateLo = canvasTex(PW, PH, (c, w, h) => {
    c.fillStyle = grad(c, 0, 0, 0, h, '#dad7ca', '#cbc8ba'); c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(0,0,0,.025)'; c.fillRect(Math.random() * w, Math.random() * h, 30, 2); }
    // 上：取付穴の列（空いた板）
    c.fillStyle = '#3a3a36'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(90 + i * 55, 330, 3, 0, 7); c.fill(); }
    // 中：遮断器2つ（2極）・電磁接触器・ヒューズ・抵抗器と配線
    mccb(c, 40, 440, 46, 100); mccb(c, 90, 440, 46, 100);
    c.fillStyle = grad(c, 160, 470, 70, 80, '#f2f1ea', '#cfcec6'); rr(c, 160, 470, 70, 80, 4); c.fill(); c.strokeStyle = '#888'; c.stroke(); for (let i = 0; i < 4; i++) { screw(c, 170 + i * 16, 480, 3); screw(c, 170 + i * 16, 540, 3); } c.fillStyle = '#d8d6ce'; c.fillRect(178, 498, 34, 24);
    for (let i = 0; i < 3; i++) { c.fillStyle = '#e9e7df'; rr(c, 245 + i * 26, 470, 20, 60, 3); c.fill(); c.strokeStyle = '#888'; c.stroke(); c.fillStyle = '#3a8a3a'; c.fillRect(249 + i * 26, 478, 12, 6); }
    c.fillStyle = '#555'; c.fillRect(330, 480, 40, 18); c.fillStyle = '#c86a2a'; c.fillRect(334, 484, 32, 10);
    wire(c, '#e2c11c', 4, [62, 440, 80, 410, 140, 420]); wire(c, '#e2c11c', 4, [112, 540, 150, 580, 200, 556]); wire(c, '#141518', 6, [60, 540, 80, 600, 150, 590]); wire(c, '#141518', 6, [110, 440, 120, 420, 170, 430]);
    wire(c, '#d8463c', 2, [250, 530, 300, 560, 360, 500]); wire(c, '#2a2a2a', 2, [280, 470, 320, 440, 360, 480]); wire(c, '#e7e7e0', 2, [300, 530, 330, 570, 350, 540]);
    // 小形リレーの列（DIN レール）
    c.fillStyle = '#b9bcc0'; c.fillRect(30, 660, 540, 10);
    c.fillStyle = '#e9e7df'; c.fillRect(40, 625, 70, 50); for (let i = 0; i < 8; i++) screw(c, 46 + i * 9, 640, 2.6);
    for (let i = 0; i < 4; i++) relay(c, 125 + i * 30, 620, 25, 58);
    for (let i = 0; i < 2; i++) { c.fillStyle = '#efeee8'; rr(c, 250 + i * 22, 622, 18, 56, 2); c.fill(); c.strokeStyle = '#999'; c.stroke(); }
    c.fillStyle = '#1b1c1e'; c.fillRect(300, 618, 22, 64); c.fillStyle = '#fff'; c.fillRect(303, 624, 16, 8);
    for (let i = 0; i < 2; i++) { c.fillStyle = '#2b2b2b'; rr(c, 330 + i * 24, 622, 20, 54, 2); c.fill(); c.fillStyle = '#e8a42a'; c.fillRect(334 + i * 24, 630, 12, 10); }
    c.fillStyle = '#e4e3dc'; c.fillRect(470, 628, 50, 40); c.fillStyle = '#333'; c.fillRect(478, 636, 34, 16);
    // 端子台の列（下）と細い線の束
    c.fillStyle = '#b9bcc0'; c.fillRect(30, 772, 540, 10);
    termRow(c, 40, 752, 90, 30, 9, '#e7e7e0'); termRow(c, 135, 752, 90, 30, 9, '#e7e7e0'); c.fillStyle = '#c3c6ca'; c.fillRect(240, 760, 300, 14);
    for (let i = 0; i < 9; i++) wire(c, ['#e86a8a', '#f2f2ea', '#d8463c', '#4a6ad8'][i % 4], 1.8, [50 + i * 9, 784, 60 + i * 6, 840, 90 + i * 4, 880]);
    for (let i = 0; i < 5; i++) wire(c, '#2f8a4a', 2.5, [260 + i * 40, 790, 280 + i * 40, 830, 300 + i * 40, 810]);
    cableV(c, 4, 0, h * 0.92, 5);
  });
  // ---------- 扉の裏の絵 ----------
  const backUp = canvasTex(320, 560, (c, w, h) => {
    c.fillStyle = grad(c, 0, 0, w, h, '#d6d3c6', '#c8c5b8'); c.fillRect(0, 0, w, h); c.strokeStyle = '#a9a69a'; c.lineWidth = 3; c.strokeRect(8, 8, w - 16, h - 16);
    paperDwg(c, 40, 205, 150, 120); c.fillStyle = '#e8c61a'; c.fillRect(200, 300, 40, 22);
    // 前面の操作パネルの裏（基板が見える窓）
    c.fillStyle = '#16171a'; c.fillRect(66, 438, 140, 74); pcb(c, 74, 444, 124, 60, 7); for (const [x, y] of [[70, 442], [202, 442], [70, 508], [202, 508]]) screw(c, x, y, 3);
    c.fillStyle = '#9da3ae'; c.fillRect(w - 24, 60, 10, 46); c.fillRect(w - 24, h - 120, 10, 46);
  });
  const backLo = canvasTex(320, 560, (c, w, h) => {
    c.fillStyle = grad(c, 0, 0, w, h, '#d6d3c6', '#c8c5b8'); c.fillRect(0, 0, w, h); c.strokeStyle = '#a9a69a'; c.lineWidth = 3; c.strokeRect(8, 8, w - 16, h - 16);
    // 前面の表示器の裏（黒い板・アクリルのカバー）
    c.fillStyle = '#1a1b1e'; c.fillRect(48, 34, 200, 76); c.fillStyle = '#2a2b2f'; c.fillRect(72, 58, 70, 34); c.fillStyle = '#e8e6de'; c.fillRect(150, 52, 70, 14);
    wire(c, '#e2c11c', 2, [120, 60, 130, 90, 128, 120]); wire(c, '#e2c11c', 2, [196, 66, 200, 96, 206, 120]);
    // 基板2枚（3Dの棚の上）
    pcb(c, 34, 136, 116, 94, 11); pcb(c, 156, 136, 116, 94, 5);
    for (let i = 0; i < 5; i++) relay(c, 172 + i * 18, 152, 15, 26);
    paperDwg(c, 74, 258, 120, 72);
    c.fillStyle = '#f2f2ec'; c.fillRect(200, 262, 46, 26); c.fillStyle = '#e8c61a'; c.fillRect(204, 266, 38, 8);
    // 十字パンチングの通気口（前面と同じ位置）
    c.fillStyle = '#c7c4b6'; c.fillRect(50, 352, 196, 150); c.fillStyle = '#6c6a60'; for (let y = 358; y < 498; y += 7) for (let x = 56 + ((y / 7) % 2) * 3.5; x < 242; x += 7) { c.fillRect(x, y - 1, 4, 2); c.fillRect(x + 1, y - 2, 2, 4); }
  });
  // ---------- 小物の絵 ----------
  const label = (t, W = 160, H = 48) => canvasTex(W, H, (c, w, h) => { c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, w, h); c.strokeStyle = '#444'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2); c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; let s = h * 0.62; do { c.font = 'bold ' + s + 'px sans-serif'; s--; } while (c.measureText(t).width > w - 10 && s > 8); c.fillText(t, w / 2, h / 2 + 1); });
  // 常用↔予備切替器の前面（写真 IMG_3610：表題、予備／常用、コネクタ、切・入の表示、手動操作のつまみ2つ、動作回数計）
  const swFront = canvasTex(480, 300, (c, w, h) => {
    c.fillStyle = grad(c, 0, 0, 0, h, '#d8d5c8', '#c8c5b8'); c.fillRect(0, 0, w, h); c.strokeStyle = '#9a978a'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2);
    const tg = (t, x, y, ww, hh, fs) => { c.fillStyle = '#f7f7f2'; c.fillRect(x - ww / 2, y - hh / 2, ww, hh); c.strokeStyle = '#666'; c.lineWidth = 1; c.strokeRect(x - ww / 2, y - hh / 2, ww, hh); c.fillStyle = '#111'; c.font = fs + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, x, y + 1); };
    tg('常用↔予備切替器', 210, 28, 130, 22, 14); tg('予備', 150, 74, 46, 20, 13); tg('常用', 250, 74, 46, 20, 13);
    c.fillStyle = '#d9d7cf'; c.fillRect(64, 112, 52, 82); c.fillStyle = '#1b1c1e'; c.fillRect(72, 122, 18, 60); c.fillRect(96, 122, 12, 30);
    for (let i = 0; i < 5; i++) { c.strokeStyle = '#e2c11c'; c.lineWidth = 3; c.beginPath(); c.moveTo(78 + i * 3, 150); c.lineTo(76 + i * 4, 200); c.stroke(); }
    c.fillStyle = '#2aa84a'; c.beginPath(); c.arc(170, 166, 10, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 12px sans-serif'; c.fillText('切', 170, 167);
    c.fillStyle = '#d8312c'; c.beginPath(); c.moveTo(262, 152); c.lineTo(274, 152); c.lineTo(268, 160); c.fill(); c.beginPath(); c.arc(268, 172, 10, 0, 7); c.fill(); c.fillStyle = '#fff'; c.fillText('入', 268, 173);
    c.fillStyle = '#f4f4ef'; c.fillRect(146, 198, 140, 40); c.fillStyle = '#222'; c.fillRect(186, 202, 60, 26);
    for (const x of [166, 266]) { c.fillStyle = '#1b1c1e'; c.beginPath(); c.arc(x, 218, 13, 0, 7); c.fill(); c.fillStyle = '#e8e8e2'; c.fillRect(x - 2, 207, 4, 22); }
    c.fillStyle = '#111'; c.font = '9px sans-serif'; c.fillText('手動操作', 166, 246); c.fillText('手動操作', 266, 246);
    c.fillStyle = '#f2f2ec'; c.fillRect(220, 262, 44, 18); c.strokeStyle = '#555'; c.strokeRect(220, 262, 44, 18); c.fillStyle = '#111'; c.font = 'bold 11px monospace'; c.fillText('01357', 242, 272);
    for (const [x, y] of [[20, 20], [w - 20, 20], [20, h - 20], [w - 20, h - 20], [20, h / 2], [w - 20, h / 2]]) screw(c, x, y, 5);
  });
  // 黒い端子ユニット（下段の一番上。写真 IMG_3611：黒い台に、端子と黄色い線、注意の三角）
  const tUnit = canvasTex(128, 140, (c, w, h) => {
    c.fillStyle = '#1d1e21'; c.fillRect(0, 0, w, h); c.fillStyle = '#2b2c30'; c.fillRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#e9e8e2'; c.fillRect(34, 16, 44, 110); for (let i = 0; i < 6; i++) { c.fillStyle = '#9da0a3'; c.fillRect(38, 22 + i * 17, 36, 12); screw(c, 50, 28 + i * 17, 4); screw(c, 64, 28 + i * 17, 4); }
    for (let i = 0; i < 6; i++) { wire(c, '#e8c422', 5, [78, 28 + i * 17, 100, 24 + i * 17, 118, 8 + i * 4]); wire(c, '#ecece6', 4, [34, 28 + i * 17, 16, 30 + i * 17, 10, 120]); }
    c.fillStyle = '#f2d21b'; c.beginPath(); c.moveTo(20, 130); c.lineTo(28, 116); c.lineTo(36, 130); c.fill();
  });
  // 透明カバー付きの電源ユニット（下段の右）
  const psFront = canvasTex(160, 140, (c, w, h) => {
    c.fillStyle = grad(c, 0, 0, 0, h, '#e9e8e2', '#b9b8b0'); c.fillRect(0, 0, w, h); c.fillStyle = '#c3c4c6'; for (let i = 0; i < 14; i++) c.fillRect(10 + i * 10, 8, 5, 40);
    c.fillStyle = '#f4f4ef'; c.fillRect(20, 58, 120, 34); c.fillStyle = '#222'; c.font = '10px sans-serif'; c.fillText('', 30, 76);
    for (let i = 0; i < 3; i++) { c.fillStyle = '#ddd'; c.beginPath(); c.arc(50 + i * 30, 112, 9, 0, 7); c.fill(); c.fillStyle = '#9b7b3a'; c.beginPath(); c.arc(50 + i * 30, 112, 5, 0, 7); c.fill(); }
  });
  const tUnitM = M(0xffffff, 0.1, 0.55, { map: tUnit }), swM = M(0xffffff, 0.15, 0.55, { map: swFront }), psM = M(0xffffff, 0.3, 0.45, { map: psFront });
  const plateUpM = M(0xffffff, 0.1, 0.7, { map: plateUp }), plateLoM = M(0xffffff, 0.1, 0.7, { map: plateLo });
  const backUpM = M(0xffffff, 0.15, 0.62, { map: backUp }), backLoM = M(0xffffff, 0.15, 0.62, { map: backLo });
  // 穴あきの配線ダクト（灰色、上に細い溝）
  const slotTex = canvasTex(64, 32, (c, w, h) => { c.fillStyle = '#a8adb6'; c.fillRect(0, 0, w, h); c.fillStyle = '#5d626b'; for (let i = 0; i < 4; i++) c.fillRect(4 + i * 16, 0, 7, h * 0.72); }, [1, 1]);
  const slotM = M(0xffffff, 0.25, 0.5, { map: slotTex });

  // ---------- 3D の道具（tier の座標：u＝正面から見て左→右、v＝上、d＝奥→手前） ----------
  const mk = (g) => {
    const B = (u0, u1, v0, v1, d0, d1, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(u1 - u0, v1 - v0, d1 - d0), m); o.position.set((u0 + u1) / 2, (v0 + v1) / 2, (d0 + d1) / 2); g.add(o); return o; };
    const P = (w, h, m, u, v, d, ry = 0) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(u, v, d); o.rotation.y = ry; g.add(o); return o; };
    const R = (r, len, m, u, v, d, ax = 'y', seg = 14) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m); o.position.set(u, v, d); if (ax === 'x') o.rotation.z = Math.PI / 2; if (ax === 'z') o.rotation.x = Math.PI / 2; g.add(o); return o; };
    const duct = (u0, u1, v0, v1, d0, d1) => { const geo = new THREE.BoxGeometry(u1 - u0, v1 - v0, d1 - d0), uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * Math.max(1, (Math.max(u1 - u0, v1 - v0)) / 0.06)); const t = slotTex; t.wrapS = THREE.RepeatWrapping; const o = new THREE.Mesh(geo, slotM); o.position.set((u0 + u1) / 2, (v0 + v1) / 2, (d0 + d1) / 2); g.add(o); return o; };
    const tube = (pts, r, m, seg = 24) => { const o = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), seg, r, 8, false), m); g.add(o); return o; };
    return { B, P, R, duct, tube };
  };

  // 上段（操作部）の中身。W＝盤の幅、H＝段の高さ、PD＝取付板の奥行き位置（d）、FD＝扉の内側の位置（d）
  function upper(g, W, H, PD, FD, title) {
    const { B, P, R, duct, tube } = mk(g), iw = W - 0.04, u0 = 0.02, U = f => u0 + f * iw, V = f => H - 0.02 - f * (H - 0.04);
    P(iw, H - 0.04, plateUpM, W / 2, H / 2, PD + 0.002);
    // 天井の LED 照明（写真：取付板の上の白い棒）
    B(U(0.3), U(0.78), V(0.035), V(0.015), PD + 0.25, PD + 0.29, mt.led); B(U(0.28), U(0.8), V(0.015), V(0.005), PD + 0.24, PD + 0.3, mt.steel);
    // 棚の枠（青みの灰色の鋼材）：縦2本と横の棚
    for (const f of [0.27, 0.9]) B(U(f) - 0.016, U(f) + 0.016, V(0.56), V(0.06), PD, PD + 0.05, mt.steel);
    for (const f of [0.065, 0.335, 0.44, 0.555]) B(U(0.26), U(0.91), V(f + 0.012), V(f), PD, PD + 0.16, mt.steel);
    duct(U(0.27), U(0.9), V(0.2), V(0.17), PD, PD + 0.14);      // 基板の上の穴あきダクト
    // 左上：小形変圧器（黒い鉄心・端子・注意の札）と、操作箱（白い箱：緑の表示灯、黒いつまみ、赤い押しボタン）
    B(U(0.02), U(0.23), V(0.165), V(0.065), PD, PD + 0.12, mt.black); B(U(0.06), U(0.19), V(0.09), V(0.065), PD + 0.12, PD + 0.135, mt.white);
    for (let i = 0; i < 3; i++) R(0.004, 0.06, mt.yel, U(0.08 + i * 0.045), V(0.05), PD + 0.1, 'y', 6);
    B(U(0.02), U(0.25), V(0.33), V(0.18), PD, PD + 0.17, mt.white);
    R(0.008, 0.006, M(0x2bd04a, 0, 0.3, { emissive: 0x1a8a30, emissiveIntensity: 0.8 }), U(0.08), V(0.235), PD + 0.173, 'z');
    R(0.011, 0.012, mt.black, U(0.19), V(0.235), PD + 0.176, 'z'); R(0.006, 0.01, mt.black, U(0.07), V(0.3), PD + 0.175, 'z'); R(0.007, 0.012, M(0xd8312c, 0, 0.4), U(0.2), V(0.3), PD + 0.176, 'z');
    // 中段・下段の部品の厚み（遮断器・リレー・青い機器）
    B(U(0.08), U(0.22), V(0.555), V(0.455), PD, PD + 0.07, mt.gray); B(U(0.35), U(0.58), V(0.545), V(0.47), PD, PD + 0.05, mt.white); B(U(0.7), U(0.75), V(0.55), V(0.46), PD, PD + 0.06, M(0x2a62c8, 0.1, 0.45));
    B(U(0.27), U(0.88), V(0.425), V(0.355), PD, PD + 0.02, mt.white);
    // 左の縦の端子台・ケーブルの束・灰色のらせん巻きの線
    for (let i = 0; i < 4; i++) R(0.012, H - 0.06, mt.cable, U(0.005 + i * 0.03), H / 2, PD + 0.04 + (i % 2) * 0.03);
    tube([[U(0.18), V(0.58), PD + 0.12], [U(0.1), V(0.68), PD + 0.2], [U(0.12), V(0.86), PD + 0.26], [U(0.28), V(0.9), PD + 0.3]], 0.018, M(0xb8bcc0, 0.2, 0.6));
    B(U(0.03), U(0.13), V(0.95), V(0.6), PD + 0.06, PD + 0.1, mt.white);
    // 常用↔予備切替器（大きな箱、前面に取っ手2本）と、それを載せる台・床の格子
    const sv0 = V(0.92), sv1 = V(0.6), su0 = U(0.15), su1 = U(0.88), sd1 = Math.min(FD - 0.08, PD + 0.42);
    B(su0, su1, sv0, sv1, PD + 0.02, sd1, mt.shell); P(su1 - su0, sv1 - sv0, swM, (su0 + su1) / 2, (sv0 + sv1) / 2, sd1 + 0.001);
    for (const u of [su0 + 0.015, su1 - 0.015]) { R(0.007, (sv1 - sv0) * 0.45, mt.steel, u, (sv0 + sv1) / 2, sd1 + 0.03); for (const dv of [-1, 1]) R(0.006, 0.03, mt.steel, u, (sv0 + sv1) / 2 + dv * (sv1 - sv0) * 0.22, sd1 + 0.015, 'z'); }
    const lt = M(0xffffff, 0, 0.5, { map: label(title) }); P(0.12, 0.036, lt, su1 - 0.08, sv1 - 0.03, sd1 + 0.002);
    B(su0 - 0.02, su1 + 0.02, 0.0, sv0, PD + 0.04, sd1 - 0.02, mt.steelD);
    B(U(0.05), U(0.95), 0.0, 0.012, PD, FD - 0.05, mt.steel);
  }
  // 下段（CCR 本体）の中身
  function lower(g, W, H, PD, FD, title) {
    const { B, P, R, duct, tube } = mk(g), iw = W - 0.04, u0 = 0.02, U = f => u0 + f * iw, V = f => H - 0.02 - f * (H - 0.04);
    P(iw, H - 0.04, plateLoM, W / 2, H / 2, PD + 0.002);
    B(U(0.3), U(0.78), V(0.02), V(0.004), PD + 0.25, PD + 0.29, mt.led);
    // 一番上：棚と、黒い端子ユニット4つ（4つ目は赤と黒の線）
    B(U(0.06), U(0.97), V(0.035), V(0.02), PD, PD + 0.18, mt.steel); B(U(0.06), U(0.97), V(0.24), V(0.225), PD, PD + 0.18, mt.steel);
    for (let i = 0; i < 4; i++) { const a = U(0.1 + i * 0.215), b = a + iw * 0.18; B(a, b, V(0.205), V(0.05), PD, PD + 0.1, mt.black); P(b - a, V(0.05) - V(0.205), tUnitM, (a + b) / 2, (V(0.05) + V(0.205)) / 2, PD + 0.101); }
    const lt = M(0xffffff, 0, 0.5, { map: label(title) }); P(0.1, 0.03, lt, U(0.86), V(0.265), PD + 0.003);
    // 中：遮断器・電磁接触器・透明カバー付きの電源ユニット
    B(U(0.06), U(0.97), V(0.46), V(0.43), PD, PD + 0.12, mt.steel); duct(U(0.25), U(0.97), V(0.45), V(0.42), PD, PD + 0.1);
    B(U(0.06), U(0.24), V(0.54), V(0.43), PD, PD + 0.08, mt.white);
    B(U(0.27), U(0.39), V(0.55), V(0.47), PD, PD + 0.09, mt.white);
    const pu0 = U(0.63), pu1 = U(0.86), pv0 = V(0.62), pv1 = V(0.48); B(pu0, pu1, pv0, pv1, PD, PD + 0.12, mt.gray); P(pu1 - pu0, pv1 - pv0, psM, (pu0 + pu1) / 2, (pv0 + pv1) / 2, PD + 0.121);
    B(U(0.58), U(0.98), V(0.63), V(0.47), PD + 0.15, PD + 0.155, mt.acryl); B(U(0.975), U(0.98), V(0.63), V(0.47), PD, PD + 0.155, mt.acryl);
    for (let i = 0; i < 6; i++) tube([[U(0.32 + i * 0.04), V(0.5), PD + 0.05], [U(0.36 + i * 0.03), V(0.56), PD + 0.12], [U(0.45 + i * 0.02), V(0.6), PD + 0.06]], 0.004, [mt.yel, mt.cable, M(0xd8463c, 0, 0.5)][i % 3], 10);
    // 穴あきダクトとレールの列（リレー・端子）
    duct(U(0.08), U(0.97), V(0.65), V(0.62), PD, PD + 0.12); duct(U(0.08), U(0.97), V(0.73), V(0.7), PD, PD + 0.12);
    B(U(0.1), U(0.6), V(0.69), V(0.66), PD, PD + 0.05, mt.white);
    B(U(0.08), U(0.97), V(0.8), V(0.785), PD, PD + 0.02, mt.steel);
    // 床の鋼板・左の太いケーブルの束（下で曲がって床の穴へ）
    B(U(0.12), U(0.95), V(0.98), V(0.965), PD, FD - 0.06, mt.steel);
    for (let i = 0; i < 6; i++) tube([[U(0.01 + i * 0.022), H - 0.01, PD + 0.05 + (i % 2) * 0.03], [U(0.01 + i * 0.022), V(0.8), PD + 0.06 + (i % 2) * 0.03], [U(0.04 + i * 0.03), V(0.93), PD + 0.14], [U(0.12 + i * 0.02), 0.01, PD + 0.12]], 0.011, mt.cable, 20);
    B(U(0.02), U(0.09), V(0.86), V(0.8), PD + 0.03, PD + 0.12, mt.black);
  }
  // 扉の裏（上段：回路図の紙と、前面パネルの裏。下段：表示器の裏のアクリル、基板2枚の棚、回路図、通気口）
  function doorBack(leaf, W, H, t, up) {
    const g = new THREE.Group(); leaf.add(g); const { B, P } = mk(g);
    P(W - 0.01, H - 0.01, up ? backUpM : backLoM, W / 2, H / 2, -t - 0.001, Math.PI);
    if (up) { B(W * 0.12, W * 0.8, H * 0.4, H * 0.42, -t - 0.045, -t, mt.steel); }
    else { B(W * 0.1, W * 0.9, H * 0.78, H * 0.81, -t - 0.06, -t, mt.steel); B(W * 0.12, W * 0.88, H * 0.58, H * 0.6, -t - 0.06, -t, mt.steel); B(W * 0.12, W * 0.88, H * 0.6, H * 0.79, -t - 0.035, -t - 0.032, mt.acryl); B(W * 0.12, W * 0.88, H * 0.81, H * 0.95, -t - 0.035, -t - 0.032, mt.acryl); }
    return g;
  }
  return { upper, lower, doorBack, mt };
}
