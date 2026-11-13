// vcb.js — Blender で作った引出形 VCB の本体（GLB）を読み込み、材質と前面のラベルを付ける。
// 形は blender/vcb/build.py で生成（AO は大きな部品をライトマップ UV1、ねじなど小さな部品を頂点カラーに焼いてある）。
// 写真（ドライブ機器室 IMG_3618〜3620）からの比率で作った教育用の想像モデル。メーカー名・形式・銘板の文字は入れない。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import GLB from './vcb/vcb.glb';
import AO_URI from './vcb/ao.jpg';

// 模型の寸法（Blender の build.py と同じ）。原点は底面の中心、正面は +Z。前板の表面は z = +0.282
export const VCB_SIZE = { W: 0.5, H: 0.56, D: 0.54, front: 0.282 };

const fit = (c, t, x, y, maxW, px, bold = true) => { let s = px; do { c.font = (bold ? 'bold ' : '') + s + 'px sans-serif'; s--; } while (c.measureText(t).width > maxW && s > 6); c.fillText(t, x, y); };
// 前面のラベル（透明の地に文字と札だけ。前板全体に 0〜1 で貼る）
function labelTex() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 1024; const c = cv.getContext('2d'); c.scale(2, 2);
  c.clearRect(0, 0, 512, 512); c.textAlign = 'center'; c.textBaseline = 'middle';
  // 開閉回数計の窓と数字、入／切の表示窓（赤＝入）
  c.fillStyle = '#101112'; c.fillRect(88, 21, 78, 26); c.fillStyle = '#e8e8e2'; c.font = 'bold 14px monospace'; c.fillText('00198', 127, 35);
  c.fillStyle = '#c8221c'; c.fillRect(233, 19, 62, 31); c.fillStyle = '#fff'; fit(c, '入', 264, 28, 20, 11); fit(c, 'CLOSED', 264, 42, 54, 9, false);
  // 銘板の枠の中：「VCB」の文字（形式名・メーカー名は入れない）と、読めない線の銘板
  c.save(); c.translate(256, 104); c.transform(1, 0, -0.22, 1, 0, 0); c.fillStyle = '#4a4c4e'; c.font = 'bold 72px sans-serif'; c.fillText('VCB', 0, 0); c.restore();
  c.fillStyle = '#f2f3f4'; c.fillRect(56, 171, 400, 62); c.fillStyle = '#1d2d4f'; c.fillRect(56, 171, 400, 10); c.fillRect(56, 223, 400, 8);
  c.fillStyle = '#556'; for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) c.fillRect(62 + k * 98, 185 + r * 7, 70 - (r + k) % 3 * 12, 2);
  // 開路（TRIP）・閉路（CLOSE）
  c.fillStyle = '#222'; fit(c, '開路', 262, 274, 50, 14, false); fit(c, 'TRIP', 262, 290, 50, 14, false);
  fit(c, '閉路', 270, 346, 50, 13, false); fit(c, 'CLOSE', 274, 361, 56, 13, false);
  // 蓄勢の表示（黄色）
  c.fillStyle = '#f2c21c'; c.fillRect(60, 322, 62, 24); c.fillStyle = '#c03018'; c.fillRect(60, 322, 62, 10); c.fillStyle = '#fff'; fit(c, '蓄勢', 91, 327, 56, 9); c.fillStyle = '#222'; fit(c, 'Spring Charged', 91, 340, 58, 8, false);
  // 注意の札（左下・右上の3枚・右の大きな注意）。文字は線で、読めない
  const note = (x, y, w, h, hd) => { c.fillStyle = '#fbfbf8'; c.fillRect(x, y, w, h); c.strokeStyle = '#999'; c.lineWidth = 0.8; c.strokeRect(x, y, w, h);
    if (hd) { c.fillStyle = hd; c.fillRect(x + 2, y + 2, w - 4, 11); } c.fillStyle = '#e8c21c'; c.beginPath(); c.moveTo(x + 8, y + 12); c.lineTo(x + 14, y + 3); c.lineTo(x + 20, y + 12); c.fill();
    c.fillStyle = '#777'; for (let j = y + 18; j < y + h - 4; j += 5) c.fillRect(x + 5, j, w - 10 - (j * 7 % 3) * 6, 1.3); };
  note(28, 392, 168, 92, null); note(318, 286, 50, 40, null);
  for (let k = 0; k < 3; k++) { note(390 + k * 38, 286, 36, 52, k === 1 ? '#d62424' : null); c.fillStyle = '#111'; c.beginPath(); c.moveTo(399 + k * 38, 330); c.lineTo(408 + k * 38, 314); c.lineTo(417 + k * 38, 330); c.closePath(); c.strokeStyle = '#111'; c.lineWidth = 1.4; c.stroke(); }
  note(392, 346, 108, 92, '#444');
  // ロック解除位置・ロック位置（矢印）
  c.fillStyle = '#222'; c.fillRect(250, 412, 2, 46); c.beginPath(); c.moveTo(245, 414); c.lineTo(251, 404); c.lineTo(257, 414); c.fill(); c.beginPath(); c.moveTo(245, 456); c.lineTo(251, 466); c.lineTo(257, 456); c.fill();
  c.textAlign = 'left'; fit(c, 'UNLOCK', 260, 420, 50, 11, false); fit(c, 'LOCK', 260, 452, 46, 11, false);
  const t = new THREE.CanvasTexture(cv); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// 写真から拾った色（sRGB）
const DEF = {
  vbody: { c: 0xcfcabb, r: 0.55 }, vfront: { c: 0xdad6c9, r: 0.5 }, vframe: { c: 0xc9c4b5, r: 0.5 }, vplate: { c: 0xe6e8ea, r: 0.4, m: 0.3 },
  black: { c: 0x151617, r: 0.5 }, red: { c: 0xc8221c, r: 0.35, e: 0x2a0000 }, steel: { c: 0xd4d7da, r: 0.32, m: 0.55 }, steeld: { c: 0x3c3f42, r: 0.5, m: 0.7 },
  brass: { c: 0xc9a24a, r: 0.35, m: 0.6 }, grip: { c: 0x9a9da0, r: 0.45 }, rubber: { c: 0x1c1c1c, r: 0.85 }, chrom: { c: 0xd2c46a, r: 0.35, m: 0.45, chrom: true },
};
function chromTex() {   // 有色クロメートめっきの色むら（黄緑〜金〜赤紫）
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const c = cv.getContext('2d');
  const gr = c.createLinearGradient(0, 0, 256, 256); [['#d8cf6a', 0], ['#b5cf7a', 0.25], ['#e2bd58', 0.45], ['#c49aa8', 0.6], ['#dccf6c', 0.8], ['#acc982', 1]].forEach(([col, k]) => gr.addColorStop(k, col)); c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(${160 + Math.random() * 90 | 0},${120 + Math.random() * 100 | 0},${70 + Math.random() * 120 | 0},.2)`; c.beginPath(); c.ellipse(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 40, 5 + Math.random() * 14, Math.random() * 3, 0, 7); c.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

let template = null; const waiting = [];
// VCB の本体を1つ返す（同じ形・材質を共有する複製）。読み込みが終わる前に呼ばれたら、空のグループを返して、あとで中身を入れる
export function makeVcb() {
  const g = new THREE.Group(); g.name = 'vcb';
  if (template) g.add(template.clone()); else waiting.push(g);
  return g;
}
{
  const TL = new THREE.TextureLoader(); const ao = TL.load(AO_URI); ao.flipY = false; ao.channel = 1; ao.colorSpace = THREE.NoColorSpace;
  const label = labelTex(), ch = chromTex(), cache = {};
  const material = (name, cls, lm) => {
    const key = name + '|' + cls + (lm ? '' : '|n'); if (cache[key]) return cache[key];
    let m;
    if (cls === 'decal') m = new THREE.MeshStandardMaterial({ map: label, transparent: true, alphaTest: 0.02, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    else if (name === 'acryl') m = new THREE.MeshPhysicalMaterial({ color: 0xf4f8fa, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false });
    else if (name === 'glassd') m = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.08, transparent: true, opacity: 0.55, depthWrite: false });
    else {
      const d = DEF[name] || { c: 0xff00ff };
      m = new THREE.MeshStandardMaterial({ color: d.chrom ? 0xffffff : d.c, roughness: d.r ?? 0.5, metalness: d.m ?? 0, map: d.chrom ? ch : null });
      if (d.e) m.emissive = new THREE.Color(d.e);
      if (cls === 'big' && lm) { m.aoMap = ao; m.aoMapIntensity = 1.0; }
      if (cls === 'small' && lm) m.vertexColors = true;
    }
    m.name = key; return (cache[key] = m);
  };
  const buf = GLB.buffer.slice(GLB.byteOffset, GLB.byteOffset + GLB.byteLength);
  new GLTFLoader().parse(buf, '', gltf => {
    const root = new THREE.Group(); const meshes = []; gltf.scene.updateMatrixWorld(true); gltf.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
    for (const o of meshes) {
      const [, name, cls] = o.name.split('|');
      o.material = material(name, cls, cls === 'big' ? !!o.geometry.attributes.uv1 : !!o.geometry.attributes.color);
      if (cls === 'decal' || cls === 'glass') o.renderOrder = 2;
      o.applyMatrix4(o.parent.matrixWorld); o.removeFromParent(); root.add(o);
    }
    template = root; waiting.splice(0).forEach(g => g.add(template.clone()));
  }, e => console.error('vcb', e));
}
