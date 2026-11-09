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
function dialLayout(w, h) { return { cx: w / 2, cy: h * 1.28, R: Math.min(h * 1.1, w * 0.65), a0: -133, sweep: 86 }; }
export function needleSegment(w, h, value) {
  const { cx, cy, R, a0, sweep } = dialLayout(w, h), a = (a0 + sweep * THREE.MathUtils.clamp(value, 0, 1.08)) * RAD;
  const dx = Math.cos(a), dy = Math.sin(a); let from = 0, to = R - 5;
  for (const [p, d, low, high] of [[cx, dx, 5, w - 5], [cy, dy, 5, h - 4]]) {
    if (Math.abs(d) < 1e-8) continue;
    const a = (low - p) / d, b = (high - p) / d; from = Math.max(from, Math.min(a, b)); to = Math.min(to, Math.max(a, b));
  }
  return [cx + dx * from, cy + dy * from, cx + dx * to, cy + dy * to];
}
function paintDial(g, w, h, unit, rows, active) {
  const paper = g.createLinearGradient(0, 0, 0, h); paper.addColorStop(0, '#e0ddbd'); paper.addColorStop(0.25, '#f3efd3'); paper.addColorStop(1, '#dedab5');
  g.fillStyle = paper; g.fillRect(0, 0, w, h);
  const { cx, cy, R, a0, sweep } = dialLayout(w, h);
  g.fillStyle = '#555b52'; g.font = '9px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NISSIN ELECTRIC CO., LTD.', cx, 12);
  const scales = rows.map((max, index) => ({ max, index })).reverse();
  scales.forEach(({ max, index }, band) => {
    const rr = R - band * 14, selected = index === active;
    g.strokeStyle = selected ? '#30372c' : '#646959'; g.lineWidth = selected ? 0.95 : 0.6;
    for (let i = 0; i <= 50; i++) {
      const a = (a0 + sweep * i / 50) * RAD, length = i % 5 === 0 ? 7 : i % 2 === 0 ? 4 : 2.8;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); g.lineTo(cx + Math.cos(a) * (rr - length), cy + Math.sin(a) * (rr - length)); g.stroke();
    }
    // 0.5 / 1.5 A の内側目盛りは数字を間引き、読み重なりを避ける。
    const steps = band < 2 ? 10 : 5;
    g.fillStyle = selected ? '#20271e' : '#606650'; g.font = `${selected ? 'bold ' : ''}${band < 2 ? 8.5 : 8}px sans-serif`;
    for (let i = 0; i <= steps; i++) {
      const a = (a0 + sweep * i / steps) * RAD, value = +(max * i / steps).toFixed(2);
      g.save(); g.translate(cx + Math.cos(a) * (rr + 7), cy + Math.sin(a) * (rr + 7)); g.rotate(a + Math.PI / 2); g.fillText(String(value), 0, 0); g.restore();
    }
  });
  // 鏡面帯。針とのずれで視差が分かる実機風の反射帯。
  const mirrorR = R - scales.length * 14 - 2;
  g.strokeStyle = '#929989'; g.lineWidth = 10; g.beginPath(); g.arc(cx, cy, mirrorR, a0 * RAD, (a0 + sweep) * RAD); g.stroke();
  g.strokeStyle = '#d8ddca'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, mirrorR - 4, a0 * RAD, (a0 + sweep) * RAD); g.stroke();
  g.fillStyle = '#252c24'; g.font = '35px sans-serif'; g.fillText(unit, cx, h * 0.74);
  g.font = '11px sans-serif'; g.fillText('~', cx, h * 0.84); g.font = '9px sans-serif'; g.fillText('0.5', cx - 27, h * 0.9);
  g.font = '8px sans-serif'; g.fillText('AC', cx + 12, h * 0.9);
  g.textAlign = 'right'; g.fillStyle = '#454e3d'; g.font = '8px sans-serif'; g.fillText(active < 0 ? 'SHORT' : 'RANGE ' + rows[active] + ' ' + unit, w - 12, h - 10);
  // 窓内の落ち影で、紙の文字盤がガラスより奥にあることを表す。
  const shadow = g.createLinearGradient(0, 0, 0, 16); shadow.addColorStop(0, '#25291d66'); shadow.addColorStop(1, '#25291d00'); g.fillStyle = shadow; g.fillRect(0, 0, w, 16);
}

function makeMeter(unit, key, x, y, w, h) {
  const u = unit.userData, s = u.pw / u.W, group = new THREE.Group();
  group.position.set((x - u.W / 2) * s, (u.H / 2 - y) * s, 0.002); u.pane.parent.add(group);
  const housingH = (h + 112) * s, cx = w * s / 2, cy = -(h + 84) * s / 2;
  mesh(new THREE.ExtrudeGeometry(rounded((w + 28) * s, housingH, 0.005), { depth: 0.003, bevelEnabled: true, bevelSize: 0.0007, bevelThickness: 0.0007, bevelSegments: 2 }), plastic, group, cx, cy, 0);
  rim((w + 5) * s, (h + 5) * s, 0.005, 0.002, 0.0025, edge, group, cx, -h * s / 2, 0.0035);
  rim((w - 5) * s, (h - 5) * s, 0.004, 0.00055, 0.001, silver, group, cx, -h * s / 2, 0.005);
  const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  mesh(new THREE.PlaneGeometry(w * s, h * s), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), group, cx, -h * s / 2, 0.004);
  const needle = mesh(new THREE.CylinderGeometry(0.00024, 0.00016, 1, 6), ink, group);
  mesh(new THREE.PlaneGeometry((w - 9) * s, (h - 9) * s), new THREE.MeshPhysicalMaterial({ color: 0xe3edf0, roughness: 0.13, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.07, transparent: true, opacity: 0.1, depthWrite: false }), group, cx, -h * s / 2, 0.0075);
  for (const side of [0.15, 0.72]) for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(2.2 * s, 67 * s, 0.0012), edge, group, (side * w + i * 5) * s, -(h + 48) * s, 0.004);
  for (const px of [-5, w + 5]) for (const py of [-5, h + 93]) screw(group, px * s, -py * s, 0.0048, 0.0015);
  screw(group, cx, -(h + 59) * s, 0.005, 0.0016);
  return { cv, tex, group, needle, s, w, h };
}

export function paintMeter(g, x, y, w, h, key, rows, active, value, label, over, unit) {
  const u = unit.userData; u.meters ??= {};
  const m = u.meters[key] ??= makeMeter(unit, key, x, y, w, h);
  const dg = m.cv.getContext('2d'); dg.setTransform(2, 0, 0, 2, 0, 0); paintDial(dg, w, h, key, rows, active); m.tex.needsUpdate = true;
  g.save();
  const housing = g.createLinearGradient(x, 0, x + w, 0); housing.addColorStop(0, '#32373b'); housing.addColorStop(0.04, '#101417'); housing.addColorStop(0.96, '#14191c'); housing.addColorStop(1, '#555b5e');
  g.shadowColor = '#000b'; g.shadowBlur = 5; g.shadowOffsetY = 4; g.fillStyle = housing;
  g.beginPath(); g.roundRect(x - 14, y - 14, w + 28, h + 112, 12); g.fill(); g.shadowColor = 'transparent';
  g.strokeStyle = '#84898b'; g.lineWidth = 1.3; g.stroke();
  g.fillStyle = '#b8b7a4'; g.beginPath(); g.roundRect(x - 3, y - 3, w + 6, h + 6, 13); g.fill();
  g.save(); g.beginPath(); g.roundRect(x, y, w, h, 11); g.clip(); g.drawImage(m.cv, x, y, w, h);
  const [x0, y0, x1, y1] = needleSegment(w, h, value);
  g.strokeStyle = '#30352444'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + x0 + 2, y + y0 + 2); g.lineTo(x + x1 + 2, y + y1 + 2); g.stroke();
  g.strokeStyle = '#1b201b'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x + x0, y + y0); g.lineTo(x + x1, y + y1); g.stroke();
  const glass = g.createLinearGradient(x, y, x + w, y + h); glass.addColorStop(0, '#ffffff30'); glass.addColorStop(0.32, '#ffffff00'); glass.addColorStop(0.65, '#ffffff00'); glass.addColorStop(0.7, '#ffffff18'); glass.addColorStop(1, '#d8e4e800'); g.fillStyle = glass; g.fillRect(x, y, w, h); g.restore();
  g.strokeStyle = '#797e77'; g.lineWidth = 1; g.beginPath(); g.roundRect(x + 1, y + 1, w - 2, h - 2, 11); g.stroke();
  for (const side of [0.15, 0.72]) for (let i = 0; i < 5; i++) { const xx = x + side * w + i * 5; g.strokeStyle = '#444b4e'; g.lineWidth = 2; g.beginPath(); g.moveTo(xx, y + h + 16); g.lineTo(xx, y + h + 82); g.stroke(); g.strokeStyle = '#080b0d'; g.lineWidth = 1; g.beginPath(); g.moveTo(xx + 2, y + h + 16); g.lineTo(xx + 2, y + h + 82); g.stroke(); }
  for (const xx of [x - 5, x + w + 5]) for (const yy of [y - 5, y + h + 93]) { g.fillStyle = '#7c8487'; g.beginPath(); g.arc(xx, yy, 3, 0, TAU); g.fill(); g.strokeStyle = '#171c1f'; g.lineWidth = 1; g.beginPath(); g.moveTo(xx - 2, yy); g.lineTo(xx + 2, yy); g.stroke(); }
  g.fillStyle = '#aeb4b2'; g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillText(label, x + w / 2, y + h + 93);
  if (over) { g.fillStyle = '#ff8a58'; g.font = 'bold 13px sans-serif'; g.fillText('レンジ超過', x + w / 2, y + h + 40); }
  g.restore();
  const p0 = new THREE.Vector3(x0 * m.s, -y0 * m.s, 0.006), p1 = new THREE.Vector3(x1 * m.s, -y1 * m.s, 0.006);
  m.needle.position.copy(p0).lerp(p1, 0.5); m.needle.scale.y = p0.distanceTo(p1); m.needle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.sub(p0).normalize());
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
    control.group.userData.rtControl = { which, hit: h }; control.grip.rotation.z = -h.angle * RAD;
  }
}
