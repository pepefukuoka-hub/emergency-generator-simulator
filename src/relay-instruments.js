import * as THREE from 'three';

// 写真を参考にした外観。寸法・材質の数値は、教材用の見た目の近似。
const TAU = Math.PI * 2, RAD = Math.PI / 180;
const plastic = new THREE.MeshStandardMaterial({ color: 0x131619, roughness: 0.3, metalness: 0.16 });
const edge = new THREE.MeshStandardMaterial({ color: 0x303438, roughness: 0.36, metalness: 0.3 });
const silver = new THREE.MeshStandardMaterial({ color: 0xbcc2c4, roughness: 0.23, metalness: 0.88 });
const ivory = new THREE.MeshStandardMaterial({ color: 0xffefb0, roughness: 0.5 });
const ink = new THREE.MeshStandardMaterial({ color: 0x16191b, roughness: 0.6 });

function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); parent.add(m);
  m.castShadow = true; m.receiveShadow = true; return m;
}
function disc(r, depth, z, material, parent, segments = 32) {
  const m = mesh(new THREE.CylinderGeometry(r, r, depth, segments), material, parent, 0, 0, z);
  m.rotation.x = Math.PI / 2; return m;
}
function rounded(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function rim(w, h, r, thickness, depth, material, parent, x, y, z) {
  const shape = rounded(w, h, r), hole = rounded(w - thickness * 2, h - thickness * 2, Math.max(r - thickness, 0.0003));
  shape.holes.push(new THREE.Path(hole.getPoints(8)));
  return mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 }), material, parent, x, y, z);
}
function screw(parent, x, y, z, r) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); disc(r, r * 0.35, 0, silver, g, 16);
  for (const a of [0, Math.PI / 2]) { const m = mesh(new THREE.BoxGeometry(r * 1.25, r * 0.18, r * 0.05), ink, g, 0, 0, r * 0.2); m.rotation.z = a; }
}

export function paintRotary(g, x, y, r, angle, round = false) {
  g.save(); g.translate(x, y);
  g.shadowColor = '#000b'; g.shadowBlur = 9; g.shadowOffsetX = 5; g.shadowOffsetY = 7;
  const base = g.createLinearGradient(-r, -r, r, r); base.addColorStop(0, '#63666a'); base.addColorStop(0.15, '#24282c'); base.addColorStop(0.9, '#090b0d'); base.addColorStop(1, '#4e5255');
  g.fillStyle = base; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.shadowColor = 'transparent';
  g.strokeStyle = '#73777a'; g.lineWidth = 1.5; g.stroke();
  g.rotate(angle * RAD);
  if (round) {
    const cap = g.createRadialGradient(-r * 0.32, -r * 0.43, 2, 0, 0, r * 0.9);
    cap.addColorStop(0, '#656a6e'); cap.addColorStop(0.3, '#2b3034'); cap.addColorStop(0.8, '#14171a'); cap.addColorStop(1, '#050709');
    g.fillStyle = cap; g.beginPath(); g.arc(0, 0, r * 0.92, 0, TAU); g.fill();
    g.strokeStyle = '#fff1ba'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -r * 0.56); g.lineTo(0, -r * 0.91); g.stroke();
    g.strokeStyle = '#92989c'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, r * 0.85, -2.8, -1.9); g.stroke();
  } else {
    const cap = g.createLinearGradient(-r * 0.4, 0, r * 0.4, 0);
    cap.addColorStop(0, '#0c0f11'); cap.addColorStop(0.22, '#575d61'); cap.addColorStop(0.43, '#31363b'); cap.addColorStop(1, '#090c0f');
    g.fillStyle = cap; g.beginPath();
    g.moveTo(-r * 0.2, -r * 0.97); g.lineTo(r * 0.2, -r * 0.97); g.lineTo(r * 0.37, -r * 0.55);
    g.lineTo(r * 0.31, r * 0.83); g.lineTo(r * 0.15, r); g.lineTo(-r * 0.15, r); g.lineTo(-r * 0.31, r * 0.83); g.lineTo(-r * 0.37, -r * 0.55); g.closePath(); g.fill();
    g.strokeStyle = '#798084'; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#fff0b1'; g.beginPath(); g.moveTo(0, -r * 0.91); g.lineTo(r * 0.17, -r * 0.56); g.lineTo(-r * 0.17, -r * 0.56); g.closePath(); g.fill();
    g.fillStyle = '#969b9d'; g.beginPath(); g.arc(0, r * 0.55, r * 0.09, 0, TAU); g.fill();
    g.strokeStyle = '#141719'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-r * 0.07, r * 0.55); g.lineTo(r * 0.07, r * 0.55); g.stroke();
  }
  g.restore();
}

function makeKnob(parent, r, round) {
  disc(r * 1.06, r * 0.15, r * 0.1, edge, parent); disc(r, r * 0.35, r * 0.32, plastic, parent);
  const grip = new THREE.Group(); parent.add(grip);
  if (round) {
    const profile = [[0, 0], [0.78, 0], [0.96, 0.12], [0.94, 0.45], [0.8, 0.65], [0.45, 0.79], [0, 0.83]].map(([x, y]) => new THREE.Vector2(x * r, y * r));
    // Lathe の Y 軸をパネル前方 +Z に向ける。
    const cap = mesh(new THREE.LatheGeometry(profile, 40), plastic, grip, 0, 0, r * 0.4); cap.rotation.x = Math.PI / 2;
    // 指標は丸い表面に沿わせる（平面の板だとキャップの中に埋まる）。
    const vertices = [], indices = [], curve = [[0.55, 0.76], [0.65, 0.72], [0.75, 0.67], [0.85, 0.58], [0.9, 0.51]];
    curve.forEach(([y, z], i) => {
      vertices.push(-r * 0.025, y * r, (z + 0.425) * r, r * 0.025, y * r, (z + 0.425) * r);
      if (i) { const a = i * 2; indices.push(a - 2, a - 1, a, a - 1, a + 1, a); }
    });
    const mark = new THREE.BufferGeometry(); mark.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); mark.setIndex(indices); mark.computeVertexNormals(); mesh(mark, ivory, grip);
  } else {
    const shape = new THREE.Shape(); shape.moveTo(-r * 0.18, r * 0.9); shape.lineTo(r * 0.18, r * 0.9);
    shape.lineTo(r * 0.32, r * 0.5); shape.lineTo(r * 0.27, -r * 0.78); shape.lineTo(0, -r * 0.92); shape.lineTo(-r * 0.27, -r * 0.78); shape.lineTo(-r * 0.32, r * 0.5); shape.closePath();
    mesh(new THREE.ExtrudeGeometry(shape, { depth: r * 0.48, bevelEnabled: true, bevelSize: r * 0.08, bevelThickness: r * 0.08, bevelSegments: 2, steps: 1 }), plastic, grip, 0, 0, r * 0.5);
    const arrow = new THREE.Shape(); arrow.moveTo(0, r * 0.83); arrow.lineTo(-r * 0.15, r * 0.53); arrow.lineTo(r * 0.15, r * 0.53); arrow.closePath();
    mesh(new THREE.ShapeGeometry(arrow), ivory, grip, 0, 0, r * 1.075); screw(grip, 0, -r * 0.5, r * 1.08, r * 0.075);
  }
  return grip;
}

// メーター窓内の座標（パネルの論理ピクセル）。2D・3Dで同じ針の形を使う。
function dialLayout(w, h) { return { cx: w / 2, cy: h * 1.5, R: h * 1.25, a0: -133, sweep: 86 }; }
export function needleSegment(w, h, value) {
  const { cx, cy, R, a0, sweep } = dialLayout(w, h), a = (a0 + sweep * THREE.MathUtils.clamp(value, -0.02, 1.08)) * RAD;
  const dx = Math.cos(a), dy = Math.sin(a); let from = 0, to = R + 4;
  for (const [p, d, low, high] of [[cx, dx, 5, w - 5], [cy, dy, 5, h - 4]]) {
    if (Math.abs(d) < 1e-8) continue;
    const a = (low - p) / d, b = (high - p) / d; from = Math.max(from, Math.min(a, b)); to = Math.min(to, Math.max(a, b));
  }
  return [cx + dx * from, cy + dy * from, cx + dx * to, cy + dy * to];
}
// 目盛りの段（写真）：電圧計は 300／150 が外の弧を共用し、75 が内の弧。電流計は 50 が外、15 が内（0.5・5 は 50 の段、1.5 は 15 の段を読み替える）。
const DIALS = {
  V: [{ div: 60, major: 4, nums: [{ max: 300, step: 20, lift: 15 }, { max: 150, step: 10, lift: 6 }] }, { div: 75, major: 5, nums: [{ max: 75, step: 5, lift: 6 }] }],
  A: [{ div: 50, major: 5, nums: [{ max: 50, step: 5, lift: 6 }] }, { div: 75, major: 5, nums: [{ max: 15, step: 1, lift: 6 }] }],
};
function paintDial(g, w, h, unit, rows, active) {
  const paper = g.createLinearGradient(0, 0, 0, h); paper.addColorStop(0, '#dcdbc4'); paper.addColorStop(0.25, '#eeedd9'); paper.addColorStop(1, '#dddcc2');
  g.fillStyle = paper; g.fillRect(0, 0, w, h);
  const { cx, cy, R, a0, sweep } = dialLayout(w, h), range = active >= 0 ? rows[active] : 0;
  const lead = String(range).replace(/[0.]/g, '')[0];   // 5→'5'（50 の段）、1.5→'1'（15 の段）
  g.fillStyle = '#3d423c'; g.font = 'bold 7.5px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('.DTL ,.OC CIRTCELE NISSIN', cx, 9);
  DIALS[unit].forEach((arc, band) => {
    const rr = R - band * 24;
    g.strokeStyle = '#2c312b'; g.lineWidth = 0.55; g.beginPath(); g.arc(cx, cy, rr, a0 * RAD, (a0 + sweep) * RAD); g.stroke();
    for (let i = 0; i <= arc.div; i++) {
      const a = (a0 + sweep * i / arc.div) * RAD, big = i % arc.major === 0, length = big ? 7 : (i * 2) % arc.major === 0 ? 5 : 3.2;
      g.lineWidth = big ? 0.8 : 0.5; g.beginPath(); g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); g.lineTo(cx + Math.cos(a) * (rr + (band ? -length : length * 0)), cy + Math.sin(a) * (rr + (band ? -length : 0))); g.stroke();
      if (!band) { g.beginPath(); g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); g.lineTo(cx + Math.cos(a) * (rr - length), cy + Math.sin(a) * (rr - length)); g.stroke(); }
    }
    for (const n of arc.nums) {
      const selected = range && String(n.max)[0] === lead;
      g.fillStyle = selected ? '#151a14' : '#4f5549'; g.font = `${selected ? 'bold ' : ''}6.6px sans-serif`;
      for (let v = 0; v <= n.max + 1e-6; v += n.step) {
        const a = (a0 + sweep * v / n.max) * RAD, rad = band ? rr + n.lift : rr + n.lift;
        g.save(); g.translate(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); g.rotate(a + Math.PI / 2); g.fillText(String(v), 0, 0); g.restore();
      }
    }
  });
  // 太い帯（写真の濃い灰色の弧）
  const bandR = R - 46;
  g.strokeStyle = '#555a56'; g.lineWidth = 8; g.beginPath(); g.arc(cx, cy, bandR, (a0 + 1) * RAD, (a0 + sweep - 1) * RAD); g.stroke();
  g.fillStyle = '#1d221d'; g.font = '300 34px sans-serif'; g.fillText(unit, cx, h * 0.735);
  g.font = '13px sans-serif'; g.fillText('~', cx, h * 0.845); g.font = '8.5px sans-serif'; g.fillText('0.5', cx - 26, h * 0.92);
  g.strokeStyle = '#1d221d'; g.lineWidth = 0.9; for (const dy of [-3, 0, 3]) { g.beginPath(); g.moveTo(cx - 4, h * 0.92 + dy); g.lineTo(cx + 3, h * 0.92 + dy); g.stroke(); } g.beginPath(); g.moveTo(cx - 1.5, h * 0.92 - 4.5); g.lineTo(cx - 1.5, h * 0.92 + 4.5); g.moveTo(cx + 18, h * 0.92); g.lineTo(cx + 30, h * 0.92); g.stroke();
  // 窓内の落ち影で、紙の文字盤がガラスより奥にあることを表す。
  const shadow = g.createLinearGradient(0, 0, 0, 16); shadow.addColorStop(0, '#25291d66'); shadow.addColorStop(1, '#25291d00'); g.fillStyle = shadow; g.fillRect(0, 0, w, 16);
}

// メーターの箱（写真）：盤面から高く立つ黒い角丸の箱。窓は上寄り、下半分に縦の溝、中央下にゼロ調整ねじ、四隅にねじ。
const MB = { mx: 26, mt: 22, mb: 190, depth: 0.03 };
const grooves = (w, h) => [...[0.03, 0.062, 0.094].map(f => [f * w, h + 30, h + 168]), ...[0.9, 0.932, 0.964].map(f => [f * w, h + 30, h + 168]), ...[0.44, 0.48, 0.52, 0.56].map(f => [f * w, h + 30, h + 108]), ...[0.48, 0.52].map(f => [f * w, h + 140, h + 168])];
function makeMeter(unit, key, x, y, w, h) {
  const u = unit.userData, s = u.pw / u.W, group = new THREE.Group(), D = MB.depth;
  group.position.set((x - u.W / 2) * s, (u.H / 2 - y) * s, 0.002); u.pane.parent.add(group);
  const housingH = (h + MB.mt + MB.mb) * s, cx = w * s / 2, cy = -(h + MB.mb - MB.mt) * s / 2;
  mesh(new THREE.ExtrudeGeometry(rounded((w + MB.mx * 2) * s, housingH, 0.007), { depth: D, bevelEnabled: true, bevelSize: 0.0016, bevelThickness: 0.0016, bevelSegments: 3 }), plastic, group, cx, cy, 0);
  const top = D + 0.0016;
  rim((w + 8) * s, (h + 8) * s, 0.006, 0.0024, 0.0022, edge, group, cx, -h * s / 2, top);
  rim((w - 2) * s, (h - 2) * s, 0.005, 0.0006, 0.001, silver, group, cx, -h * s / 2, top + 0.0012);
  const cv = document.createElement('canvas'); cv.width = w * 4; cv.height = h * 4;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  mesh(new THREE.PlaneGeometry(w * s, h * s), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), group, cx, -h * s / 2, top + 0.0002);
  const needle = mesh(new THREE.CylinderGeometry(0.00022, 0.00014, 1, 6), ink, group);
  mesh(new THREE.PlaneGeometry((w - 6) * s, (h - 6) * s), new THREE.MeshPhysicalMaterial({ color: 0xe3edf0, roughness: 0.1, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.12, depthWrite: false }), group, cx, -h * s / 2, top + 0.0026);
  for (const [gx, y0, y1] of grooves(w, h)) mesh(new THREE.BoxGeometry(3 * s, (y1 - y0) * s, 0.0012), edge, group, gx * s, -(y0 + y1) / 2 * s, top - 0.0003);
  for (const px of [-MB.mx + 9, w + MB.mx - 9]) for (const py of [-MB.mt + 9, h + MB.mb - 9]) screw(group, px * s, -py * s, top, 0.0019);
  screw(group, cx, -(h + 124) * s, top, 0.0024);
  return { cv, tex, group, needle, s, w, h, top };
}

export function paintMeter(g, x, y, w, h, key, rows, active, value, label, over, unit) {
  const u = unit.userData; u.meters ??= {};
  const m = u.meters[key] ??= makeMeter(unit, key, x, y, w, h);
  if (m.active !== active) { m.active = active; const dg = m.cv.getContext('2d'); dg.setTransform(4, 0, 0, 4, 0, 0); paintDial(dg, w, h, key, rows, active); m.tex.needsUpdate = true; }
  g.save();
  const hx = x - MB.mx, hy = y - MB.mt, hw = w + MB.mx * 2, hh = h + MB.mt + MB.mb;
  const housing = g.createLinearGradient(hx, hy, hx + hw, hy + hh); housing.addColorStop(0, '#3a3f43'); housing.addColorStop(0.05, '#15191c'); housing.addColorStop(0.6, '#0d1012'); housing.addColorStop(0.97, '#14181b'); housing.addColorStop(1, '#4a4f52');
  g.shadowColor = '#000c'; g.shadowBlur = 10; g.shadowOffsetX = 4; g.shadowOffsetY = 7; g.fillStyle = housing;
  g.beginPath(); g.roundRect(hx, hy, hw, hh, 16); g.fill(); g.shadowColor = 'transparent';
  g.strokeStyle = '#6f7477'; g.lineWidth = 1.2; g.stroke();
  g.strokeStyle = '#2a2f33'; g.lineWidth = 2; g.beginPath(); g.roundRect(hx + 5, hy + 5, hw - 10, hh - 10, 12); g.stroke();
  g.fillStyle = '#1b1f22'; g.beginPath(); g.roundRect(x - 6, y - 6, w + 12, h + 12, 14); g.fill();
  g.fillStyle = '#b8b7a4'; g.beginPath(); g.roundRect(x - 2, y - 2, w + 4, h + 4, 12); g.fill();
  g.save(); g.beginPath(); g.roundRect(x, y, w, h, 11); g.clip(); g.drawImage(m.cv, x, y, w, h);
  const [x0, y0, x1, y1] = needleSegment(w, h, value);
  g.strokeStyle = '#30352444'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + x0 + 2, y + y0 + 2); g.lineTo(x + x1 + 2, y + y1 + 2); g.stroke();
  g.strokeStyle = '#1b201b'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(x + x0, y + y0); g.lineTo(x + x1, y + y1); g.stroke();
  const glass = g.createLinearGradient(x, y, x + w, y + h); glass.addColorStop(0, '#ffffff38'); glass.addColorStop(0.3, '#ffffff00'); glass.addColorStop(0.62, '#ffffff00'); glass.addColorStop(0.68, '#ffffff1c'); glass.addColorStop(0.74, '#ffffff00'); glass.addColorStop(1, '#d8e4e800'); g.fillStyle = glass; g.fillRect(x, y, w, h); g.restore();
  for (const [gx, ya, yb] of grooves(w, h)) { g.strokeStyle = '#3b4144'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + gx, y + ya); g.lineTo(x + gx, y + yb); g.stroke(); g.strokeStyle = '#05070a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + gx + 1.6, y + ya); g.lineTo(x + gx + 1.6, y + yb); g.stroke(); }
  for (const xx of [hx + 9, hx + hw - 9]) for (const yy of [hy + 9, hy + hh - 9]) paintScrew(g, xx, yy, 4.6);
  paintScrew(g, x + w / 2, y + h + 124, 6, true);
  g.restore();
  const p0 = new THREE.Vector3(x0 * m.s, -y0 * m.s, m.top + 0.0014), p1 = new THREE.Vector3(x1 * m.s, -y1 * m.s, m.top + 0.0014);
  m.needle.position.copy(p0).lerp(p1, 0.5); m.needle.scale.y = p0.distanceTo(p1); m.needle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.sub(p0).normalize());
}

// ---------- 盤面の小さな部品（端子・トグル・押しボタン・ランプ・コネクタ・ヒューズ・ねじ） ----------
// 2D（上から見た絵）と 3D（机上の立体）を、同じ部品の定義から作る。形は写真からの近似。
const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0d0e, roughness: 0.5, metalness: 0.05 });
const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe3e5, roughness: 0.16, metalness: 0.95 });
const ivoryDull = new THREE.MeshStandardMaterial({ color: 0xd9d4bd, roughness: 0.55 });
const recess = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.9 });
function zc(r0, r1, h, z, material, parent, seg = 24) { const m = mesh(new THREE.CylinderGeometry(r1, r0, h, seg), material, parent, 0, 0, z + h / 2); m.rotation.x = Math.PI / 2; return m; }
function glow(color) { return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0, roughness: 0.18, transparent: true, opacity: 0.92 }); }
export function paintScrew(g, x, y, r, minus) {
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.5, x, y, r); gr.addColorStop(0, '#e9eced'); gr.addColorStop(0.7, '#8d9396'); gr.addColorStop(1, '#3b4043');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = '#1a1d1f'; g.lineWidth = Math.max(0.9, r * 0.24); g.beginPath(); g.moveTo(x - r * 0.62, y); g.lineTo(x + r * 0.62, y); if (!minus) { g.moveTo(x, y - r * 0.62); g.lineTo(x, y + r * 0.62); } g.stroke();
}
export function paintPart(g, p) {
  const { x, y } = p, r = p.r; g.save();
  const shade = (rr, dx = 3, dy = 5) => { g.shadowColor = '#000c'; g.shadowBlur = rr * 0.5; g.shadowOffsetX = dx; g.shadowOffsetY = dy; };
  switch (p.t) {
    case 'screw': paintScrew(g, x, y, r); break;
    case 'post': {
      if (p.conn) { g.strokeStyle = p.col; g.lineWidth = 5; g.beginPath(); g.arc(x, y, r + 5, 0, TAU); g.stroke(); }
      g.fillStyle = '#9aa0a3'; g.beginPath(); g.arc(x, y, r * 0.62, 0, TAU); g.fill();
      shade(r); const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r); gr.addColorStop(0, '#5c6165'); gr.addColorStop(0.35, '#1d2023'); gr.addColorStop(1, '#030405');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); break; }
    case 'earth': {
      if (p.conn) { g.strokeStyle = p.col; g.lineWidth = 5; g.beginPath(); g.arc(x, y, r + 5, 0, TAU); g.stroke(); }
      shade(r); g.fillStyle = '#b9bdbf'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.shadowColor = 'transparent';
      g.fillStyle = '#d9d4bd'; g.beginPath(); g.arc(x, y, r * 0.76, 0, TAU); g.fill(); g.fillStyle = '#eef0f0'; g.beginPath(); g.arc(x, y, r * 0.42, 0, TAU); g.fill(); break; }
    case 'tog': {
      const st = p.st, d = r * 1.15 * st, lx = p.dir === 'h' ? x + d : x, ly = p.dir === 'h' ? y : y - d;
      shade(r, 2, 3); g.fillStyle = '#aab0b3'; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.lineTo(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5); } g.closePath(); g.fill(); g.shadowColor = 'transparent';
      g.fillStyle = '#5d6366'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.strokeStyle = '#c9cdd0'; g.lineWidth = r * 0.95; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(lx, ly); g.stroke();
      g.fillStyle = '#f3f5f5'; g.beginPath(); g.arc(lx, ly, r * 0.58, 0, TAU); g.fill(); break; }
    case 'btn': {
      if (p.big) {
        shade(r); const bz = g.createLinearGradient(x - r, y - r, x + r, y + r); bz.addColorStop(0, '#f4f6f6'); bz.addColorStop(0.5, '#8d9396'); bz.addColorStop(1, '#dfe2e3');
        g.fillStyle = bz; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.shadowColor = 'transparent';
        g.strokeStyle = '#4a4f52'; g.lineWidth = 0.6; for (let i = 0; i < 48; i++) { const a = i * TAU / 48; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.88, y + Math.sin(a) * r * 0.88); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); }
        const cg = g.createRadialGradient(x - r * 0.25, y - r * 0.3, 2, x, y, r * 0.8); cg.addColorStop(0, p.lit ? p.colLit : p.col); cg.addColorStop(1, p.colDark);
        g.fillStyle = cg; g.beginPath(); g.arc(x, y, r * (p.down ? 0.74 : 0.78), 0, TAU); g.fill();
        g.strokeStyle = '#0003'; g.lineWidth = 1; for (const f of [0.2, 0.36, 0.52, 0.66]) { g.beginPath(); g.arc(x, y, r * f, 0, TAU); g.stroke(); }
      } else {
        shade(r, 2, 3); g.fillStyle = '#9ea4a7'; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.5; g.lineTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3); } g.closePath(); g.fill(); g.shadowColor = 'transparent';
        const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r); gr.addColorStop(0, p.down ? '#2a2d30' : '#4a4e52'); gr.addColorStop(1, '#050607'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * (p.down ? 0.9 : 1), 0, TAU); g.fill();
      } break; }
    case 'lamp': {
      shade(r, 1, 2); g.fillStyle = '#a7adb0'; g.beginPath(); g.arc(x, y, r * 1.25, 0, TAU); g.fill(); g.shadowColor = 'transparent';
      if (p.on) { g.shadowColor = p.col; g.shadowBlur = r * 1.6; }
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, 1, x, y, r); gr.addColorStop(0, p.on ? '#fff' : (p.clear ? '#f2f2ec' : '#ffb9a0')); gr.addColorStop(0.45, p.on ? p.col : (p.clear ? '#b9bab2' : p.col)); gr.addColorStop(1, p.on ? p.col : (p.clear ? '#70726c' : '#6a1d0c'));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); break; }
    case 'conn': {
      shade(r); const fl = g.createLinearGradient(x - r, y - r, x + r, y + r); fl.addColorStop(0, '#f6f7f7'); fl.addColorStop(0.5, '#a2a8ab'); fl.addColorStop(1, '#e3e6e7');
      g.fillStyle = fl; g.beginPath(); if (p.square) g.roundRect(x - r, y - r, r * 2, r * 2, r * 0.25); else g.arc(x, y, r, 0, TAU); g.fill(); g.shadowColor = 'transparent';
      g.fillStyle = '#868c8f'; g.beginPath(); g.arc(x, y, r * 0.8, 0, TAU); g.fill(); g.fillStyle = p.on ? '#111315' : '#2e3336'; g.beginPath(); g.arc(x, y, r * (p.on ? 0.84 : 0.66), 0, TAU); g.fill();
      if (!p.on) { g.fillStyle = '#cfd3d5'; const n = p.pins || 6; for (let i = 0; i < n; i++) { const a = i * TAU / (n - 1), rr = i === n - 1 ? 0 : r * 0.38; g.beginPath(); g.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, r * 0.085, 0, TAU); g.fill(); } }
      else { g.fillStyle = '#3a3e41'; g.beginPath(); g.arc(x, y, r * 0.42, 0, TAU); g.fill(); }
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + TAU / 8, rr = p.square ? r * 1.13 : r * 0.9; paintScrew(g, x + Math.cos(a) * rr, y + Math.sin(a) * rr, r * 0.075); } break; }
    case 'fuse': {
      shade(r, 2, 3); g.fillStyle = '#17191b'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.shadowColor = 'transparent';
      g.fillStyle = '#2b2f32'; g.beginPath(); g.arc(x, y, r * 0.74, 0, TAU); g.fill(); g.fillStyle = '#d9dcdc'; g.font = `${r * 0.42}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FUSE', x, y); break; }
    case 'nfb': {
      const w = p.w, h = p.h; g.fillStyle = '#060708'; g.fillRect(x - w / 2, y - h / 2, w, h); g.strokeStyle = '#4d5255'; g.lineWidth = 1; g.strokeRect(x - w / 2, y - h / 2, w, h);
      const ly = p.on ? y - h * 0.27 : y + h * 0.05; shade(6, 2, 3); const gr = g.createLinearGradient(0, ly, 0, ly + h * 0.42); gr.addColorStop(0, p.on ? '#50565a' : '#1c1f21'); gr.addColorStop(1, p.on ? '#16181a' : '#4a4f53'); g.fillStyle = gr; g.fillRect(x - w * 0.36, ly, w * 0.72, h * 0.42); break; }
    case 'sock': {
      const w = p.w, h = p.h; g.fillStyle = '#9da3a6'; g.beginPath(); g.roundRect(x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 6, 4); g.fill(); g.fillStyle = '#060708'; g.fillRect(x - w / 2, y - h / 2, w, h);
      if (p.on) { shade(8); g.fillStyle = '#1a1c1e'; g.beginPath(); g.roundRect(x - w * 0.42, y - h * 0.42, w * 0.84, h * 0.84, 6); g.fill(); g.shadowColor = 'transparent'; g.fillStyle = '#2f3336'; g.beginPath(); g.arc(x, y, w * 0.2, 0, TAU); g.fill(); }
      else { g.fillStyle = '#c9cdcf'; for (const dy of [-h * 0.2, h * 0.2]) g.fillRect(x - w * 0.22, y + dy - 2.5, w * 0.5, 5); } break; }
  }
  g.restore();
}
function makePart(p, s) {
  const G = new THREE.Group(), R = (p.r || 10) * s, d = { G };
  switch (p.t) {
    case 'screw': screw(G, 0, 0, 0.0004, R); break;
    case 'post': {
      zc(R * 0.62, R * 0.62, R * 0.45, 0, silver, G); zc(R * 0.72, R, R * 0.5, R * 0.45, rubber, G); zc(R, R, R * 1.25, R * 0.95, rubber, G, 28);
      const dome = mesh(new THREE.SphereGeometry(R, 24, 10, 0, TAU, 0, Math.PI / 2), rubber, G, 0, 0, R * 2.2); dome.rotation.x = Math.PI / 2; dome.scale.y = 0.55;
      d.ring = mesh(new THREE.TorusGeometry(R * 0.78, R * 0.2, 8, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), G, 0, 0, R * 0.25); break; }
    case 'earth': {
      zc(R, R, R * 0.3, 0, silver, G); zc(R * 0.76, R * 0.76, R * 1.7, R * 0.3, ivoryDull, G, 18); zc(R * 0.42, R * 0.42, R * 1.0, R * 2.0, chrome, G);
      d.ring = mesh(new THREE.TorusGeometry(R * 0.6, R * 0.18, 8, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), G, 0, 0, R * 2.1); break; }
    case 'tog': {
      zc(R * 1.5, R * 1.5, R * 0.5, 0, silver, G, 6); zc(R, R * 0.85, R * 0.9, R * 0.5, silver, G);
      d.pivot = new THREE.Group(); d.pivot.position.z = R * 1.1; G.add(d.pivot); zc(R * 0.4, R * 0.6, R * 3.4, 0, chrome, d.pivot, 16);
      const tip = mesh(new THREE.SphereGeometry(R * 0.6, 14, 10), chrome, d.pivot, 0, 0, R * 3.4); void tip; break; }
    case 'btn': {
      if (p.big) {
        zc(R, R, R * 0.3, 0, chrome, G, 48); zc(R * 0.96, R * 0.9, R * 0.12, R * 0.3, chrome, G, 48);
        d.mat = new THREE.MeshStandardMaterial({ color: p.col, emissive: p.colLit, emissiveIntensity: 0, roughness: 0.35 });
        d.cap = new THREE.Group(); G.add(d.cap); zc(R * 0.78, R * 0.74, R * 0.3, R * 0.2, d.mat, d.cap, 40);
        for (const f of [0.25, 0.42, 0.58]) { const t = mesh(new THREE.TorusGeometry(R * f, R * 0.012, 6, 40), d.mat, d.cap, 0, 0, R * 0.5); void t; }
        d.travel = R * 0.14;
      } else { zc(R * 1.3, R * 1.3, R * 0.5, 0, silver, G, 6); d.cap = new THREE.Group(); G.add(d.cap); zc(R, R * 0.92, R * 1.5, R * 0.4, rubber, d.cap, 20); d.travel = R * 0.6; }
      break; }
    case 'lamp': {
      zc(R * 1.25, R * 1.25, R * 0.5, 0, silver, G, 6); zc(R * 1.05, R * 1.05, R * 0.5, R * 0.5, chrome, G);
      d.mat = glow(p.clear ? 0xdedfd6 : p.col); d.col = new THREE.Color(p.col); d.off = new THREE.Color(p.clear ? 0xdedfd6 : p.col).multiplyScalar(p.clear ? 1 : 0.45);
      const dome = mesh(new THREE.SphereGeometry(R, 20, 12), d.mat, G, 0, 0, R * 1.0); dome.scale.z = 1.15; dome.castShadow = false; break; }
    case 'conn': {
      if (p.square) mesh(new THREE.BoxGeometry(R * 2, R * 2, R * 0.14), chrome, G, 0, 0, R * 0.07); else zc(R, R, R * 0.12, 0, chrome, G, 40);
      zc(R * 0.8, R * 0.8, R * 0.5, 0, chrome, G, 40); zc(R * 0.66, R * 0.66, R * 0.02, R * 0.5, recess, G, 32);
      d.pins = new THREE.Group(); G.add(d.pins); const n = p.pins || 6; for (let i = 0; i < n; i++) { const a = i * TAU / (n - 1), rr = i === n - 1 ? 0 : R * 0.38; const pin = zc(R * 0.07, R * 0.07, R * 0.12, R * 0.5, chrome, d.pins, 8); pin.position.x = Math.cos(a) * rr; pin.position.y = Math.sin(a) * rr; }
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + TAU / 8, rr = p.square ? R * 1.13 : R * 0.9; screw(G, Math.cos(a) * rr, Math.sin(a) * rr, R * 0.14, R * 0.075); }
      d.plug = new THREE.Group(); G.add(d.plug); zc(R * 0.88, R * 0.88, R * 0.5, R * 0.3, chrome, d.plug, 32); zc(R * 0.8, R * 0.55, R * 0.7, R * 0.8, rubber, d.plug, 24); break; }
    case 'fuse': { zc(R, R, R * 0.4, 0, rubber, G); zc(R * 0.8, R * 0.72, R * 0.9, R * 0.4, rubber, G, 18); mesh(new THREE.BoxGeometry(R * 1.0, R * 0.14, R * 0.05), edge, G, 0, 0, R * 1.31); break; }
    case 'nfb': {
      mesh(new THREE.BoxGeometry(p.w * s, p.h * s, 0.004), recess, G, 0, 0, 0.002); rim(p.w * s + 0.002, p.h * s + 0.002, 0.0006, 0.0008, 0.0045, edge, G, 0, 0, 0);
      d.pivot = new THREE.Group(); d.pivot.position.z = 0.003; G.add(d.pivot); mesh(new THREE.BoxGeometry(p.w * s * 0.7, p.h * s * 0.2, 0.014), rubber, d.pivot, 0, 0, 0.007); break; }
    case 'sock': {
      rim(p.w * s + 0.003, p.h * s + 0.003, 0.001, 0.0015, 0.002, silver, G, 0, 0, 0); mesh(new THREE.PlaneGeometry(p.w * s, p.h * s), recess, G, 0, 0, 0.0006);
      d.pins = new THREE.Group(); G.add(d.pins); for (const dy of [-0.2, 0.2]) mesh(new THREE.BoxGeometry(p.w * s * 0.5, 0.0016, 0.004), chrome, d.pins, p.w * s * 0.03, dy * p.h * s, 0.002);
      d.plug = new THREE.Group(); G.add(d.plug); mesh(new THREE.BoxGeometry(p.w * s * 0.84, p.h * s * 0.84, 0.022), rubber, d.plug, 0, 0, 0.011); zc(p.w * s * 0.22, p.w * s * 0.16, 0.012, 0.022, rubber, d.plug, 14); break; }
  }
  return d;
}
function updatePart(d, p, s) {
  const R = (p.r || 10) * s;
  switch (p.t) {
    case 'post': case 'earth': d.ring.visible = !!p.conn; if (p.conn) d.ring.material.color.set(p.col); break;
    case 'tog': d.axis = p.dir === 'h' ? 'y' : 'x'; d.tr = p.dir === 'h' ? p.st * 0.36 : -p.st * 0.36; if (d.init === undefined) { d.init = 1; d.pivot.rotation[d.axis] = d.tr; } break;
    case 'btn': d.cap.position.z = p.down ? -d.travel : 0; if (d.mat) d.mat.emissiveIntensity = p.lit ? 0.9 : 0; break;
    case 'lamp': d.mat.color.copy(p.on ? d.col : d.off); d.mat.emissive.copy(d.col); d.mat.emissiveIntensity = p.on ? (p.dim ? 0.5 : 2.2) : 0; break;
    case 'conn': case 'sock': d.plug.visible = !!p.on; d.pins.visible = !p.on; break;
    case 'nfb': d.axis = 'x'; d.tr = p.on ? -0.5 : 0.5; d.ty = p.on ? p.h * s * 0.12 : -p.h * s * 0.12; if (d.init === undefined) { d.init = 1; d.pivot.rotation.x = d.tr; d.pivot.position.y = d.ty; } break;
  }
  void R;
}
export function syncTesterParts(unit, parts, which) {
  const u = unit.userData; u.parts3D ??= new Map(); const s = u.pw / u.W;
  for (const p of parts) {
    const key = p.t + ':' + (p.key || p.id);
    let d = u.parts3D.get(key);
    if (!d) { d = makePart(p, s); d.G.position.set((p.x - u.W / 2) * s, (u.H / 2 - p.y) * s, 0.0012); u.pane.parent.add(d.G); u.parts3D.set(key, d); }
    updatePart(d, p, s);
    if (p.hit) d.G.userData.rtControl = { which, hit: p.hit };
  }
}

export function syncTesterControls(unit, hits, which) {
  const u = unit.userData; u.controls3D ??= new Map();
  const s = u.pw / u.W;
  for (const h of hits) {
    if (h.k !== 'rot' && h.k !== 'reg') continue;
    let control = u.controls3D.get(h.id);
    if (!control) {
      const group = new THREE.Group(); group.position.set((h.x - u.W / 2) * s, (u.H / 2 - h.y) * s, 0.002); u.pane.parent.add(group);
      const grip = makeKnob(group, h.bodyRadius * s, h.k === 'reg'); control = { group, grip }; u.controls3D.set(h.id, control);
    }
    control.group.userData.rtControl = { which, hit: h }; if (control.tz === undefined) control.grip.rotation.z = -h.angle * RAD; control.tz = -h.angle * RAD;
  }
}

// ---------- 筐体（写真の正面から読める範囲：ベージュの細い枠、手前の留め金2つと革の取っ手。側面・足・通気口は推測） ----------
const caseMat = new THREE.MeshStandardMaterial({ color: 0xa3957a, roughness: 0.62, metalness: 0.25 });
const trimMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a2, roughness: 0.35, metalness: 0.7 });
const leather = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.8 });
export function buildCase(tilt, pw, ph) {
  const W = pw + 0.024, H = ph + 0.024, D = 0.11, g = new THREE.Group(); tilt.add(g);
  mesh(new THREE.ExtrudeGeometry(rounded(W, H, 0.008), { depth: D, bevelEnabled: false, curveSegments: 6 }), caseMat, g, 0, 0, -D - 0.003);
  rim(W + 0.002, H + 0.002, 0.009, 0.0125, 0.006, trimMat, g, 0, 0, -0.004);            // 上の縁（盤面より 2mm 高い枠）
  rim(W + 0.003, H + 0.003, 0.009, 0.002, 0.012, trimMat, g, 0, 0, -D - 0.003);          // 底の縁
  for (const sx of [-1, 1]) {
    // 留め金（手前の面）
    const L = new THREE.Group(); L.position.set(sx * pw * 0.36, -H / 2 - 0.001, -0.02); g.add(L);
    mesh(new THREE.BoxGeometry(0.03, 0.003, 0.03), silver, L, 0, -0.001, 0); mesh(new THREE.BoxGeometry(0.02, 0.004, 0.018), chrome, L, 0, -0.004, -0.002);
    const loop = mesh(new THREE.TorusGeometry(0.009, 0.0013, 6, 16, Math.PI), chrome, L, 0, -0.003, 0.012); loop.rotation.x = Math.PI / 2; loop.rotation.set(0, 0, 0);
    // 奥の面のちょうつがい（ふたを外した後の受け）と、角の黒いゴム
    const hz = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.04, 10), silver, g, sx * pw * 0.3, H / 2 + 0.003, -0.004); hz.rotation.z = Math.PI / 2;
    const bump = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 16), rubber, g, sx * (W / 2 - 0.004), H / 2 + 0.002, -0.014); bump.rotation.x = Math.PI / 2;
    // 取っ手の受け金具
    mesh(new THREE.BoxGeometry(0.016, 0.006, 0.02), chrome, g, sx * 0.075, -H / 2 - 0.003, -0.055);
    // 足（底の四隅。推測）
    for (const sy of [-1, 1]) { const f = mesh(new THREE.CylinderGeometry(0.01, 0.011, 0.006, 14), rubber, g, sx * (W / 2 - 0.03), sy * (H / 2 - 0.03), -D - 0.006); f.rotation.x = Math.PI / 2; }
    // 側面の通気口（推測：細い縦の溝）
    for (let i = 0; i < 6; i++) mesh(new THREE.BoxGeometry(0.0012, 0.004, 0.045), recess, g, sx * (W / 2 + 0.0002), -0.04 + i * 0.016, -0.06);
  }
  // 革の取っ手（手前の面。机の上では下へ垂れる）
  const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16, a = Math.PI * t; pts.push(new THREE.Vector3(-0.075 + 0.15 * t, -H / 2 - 0.004 - Math.sin(a) * 0.012, -0.055 - Math.sin(a) * 0.03)); }
  const strap = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.006, 8), leather, g); strap.scale.set(1, 1, 1);
  return g;
}

// つまみ・トグルの動き：切り換えた位置へ、短い時間で「カチッ」と寄せる（毎フレーム呼ぶ）
export function animateTester(unit, dt) {
  const u = unit.userData, k = 1 - Math.exp(-dt * 26);
  if (u.controls3D) for (const c of u.controls3D.values()) { const d = c.tz - c.grip.rotation.z; c.grip.rotation.z = Math.abs(d) < 0.002 ? c.tz : c.grip.rotation.z + d * k; }
  if (u.parts3D) for (const d of u.parts3D.values()) { if (d.tr === undefined) continue; const e = d.tr - d.pivot.rotation[d.axis]; d.pivot.rotation[d.axis] = Math.abs(e) < 0.002 ? d.tr : d.pivot.rotation[d.axis] + e * k; if (d.ty !== undefined) d.pivot.position.y += (d.ty - d.pivot.position.y) * k; }
}
