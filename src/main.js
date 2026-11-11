import { createWorker } from './worker.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RELAY_PHOTO, TERM_PHOTO } from './relay-photos.js';
import { DESK_PHOTO } from './desk-photo.js';
import { loadGenset, GENSET } from './genset.js';
import { paintRotary, paintMeter, paintPart, syncTesterControls, syncTesterParts, buildCase, animateTester } from './relay-instruments.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d2228);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.04, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.screenSpacePanning = true;
controls.minDistance = 0.2;
controls.zoomToCursor = true;
let fly = null;
controls.addEventListener('start', () => { fly = null; });
function view(p, t) { fly = null; camera.position.set(...p); controls.target.set(...t); }
window.viewTo = view;
view([-5.6, 2.4, 5.2], [0, 1.4, 0]);

const hemi = new THREE.HemisphereLight(0xffffff, 0x667077, 0.9); scene.add(hemi);
renderer.localClippingEnabled = true;
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; }
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(2, 9, 5); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, far: 30 });
scene.add(sun);

// ---------- テクスチャ ----------
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cg = c.getContext('2d'); draw(cg, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.userData.redraw = () => { draw(cg, w, h); t.needsUpdate = true; };
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); }
  return t;
}
const concreteTex = (rep) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#7c7f82'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) { const v = 90 + Math.random() * 80 | 0; g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
}, rep);
const plateTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#9fb7b4'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#c7d6d4';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    g.save(); g.translate(x * 16 + 8, y * 16 + 8); g.rotate((x + y) % 2 ? 0.8 : -0.8); g.fillRect(-5, -1.5, 10, 3); g.restore();
  }
}, [4, 4]);
const perfTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#8fb0aa'; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-out';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.beginPath(); g.arc(x * 8 + (y % 2 ? 4 : 0) + 3, y * 8 + 4, 2.4, 0, 7); g.fill(); }
}, [3, 8]);
function labelTex(w, h, draw) { return canvasTex(w, h, draw); }

// ---------- 運転状態（盤面・動作で共有） ----------
const S = { mode: 'stop', t: 0, rpm: 0, rpm0: 0, volt: 0, volt0: 0, brk: false, mains: true, phi: 0, scale: 0.05, sound: true, auto: false };
const dynTex = [];
function derive() {
  S.load = (S.mains || S.brk) ? 1 : 0;
  S.hz = 60 * S.rpm / 1200;
  S.hzAng = S.rpm > 10 ? Math.min(1, Math.max(0, (S.hz - 55) / 10)) : 0;
  S.vAng = 0.7 * S.volt; S.aAng = S.brk ? 0.35 * S.volt : 0; S.evtAng = S.brk ? 0.73 * S.volt : 0; S.kwAng = S.brk ? 0.38 * S.volt : 0; S.cosAng = S.brk ? 0.55 : 0.5;
}
derive();

// ---------- マテリアル ----------
const M = (c, m = 0.35, r = 0.55, o = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, ...o });
const mat = {
  body: M(0x8fb0aa), light: M(0xa9c4c2), cover: M(0xa7c2c6), gray: M(0xbcc6c8, 0.3, 0.6),
  dark: M(0x24282d, 0.5, 0.6), black: M(0x111315, 0.2, 0.8), steel: M(0xc4c8cc, 0.6, 0.4), lag: M(0xb3b8bd, 0.7, 0.45),
  turbo: M(0x6f8f86, 0.2, 0.8), yellow: M(0xd0a61c, 0.2, 0.55), red: M(0xd0242a, 0.2, 0.5), plate: M(0xffffff, 0.4, 0.6, { map: plateTex }),
  perf: new THREE.MeshStandardMaterial({ map: perfTex, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.3, roughness: 0.6 }),
  cable: M(0x2c2f33, 0.2, 0.8), floor: M(0xffffff, 0, 0.95, { map: concreteTex([6, 6]) }),
};
const gen = new THREE.Group(); gen.position.z = -0.7; scene.add(gen);
const blkG = M(0x14161a, 0.35, 0.25), chrome = M(0xdfe3e6, 1, 0.18), silv = M(0xb9bdc2, 0.9, 0.3);
const bx = (x0, x1, y0, y1, z0, z1, m, p = gen) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m);
  o.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); o.castShadow = o.receiveShadow = true; p.add(o); return o;
};
const cyl = (r, len, m, x, y, z, axis = 'x', p = gen, seg = 36, r2 = r) => {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, len, seg), m);
  o.position.set(x, y, z); if (axis === 'x') o.rotation.z = Math.PI / 2; if (axis === 'z') o.rotation.x = Math.PI / 2;
  o.castShadow = o.receiveShadow = true; p.add(o); return o;
};
const pipe = (pts, r, m, p = gen) => {
  const o = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(v => new THREE.Vector3(...v)), false, 'catmullrom', 0.04), 80, r, 10), m);
  o.castShadow = true; p.add(o); return o;
};

// ---------- 室（機械室） ----------
const room = new THREE.Group(); scene.add(room);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(16.6, 8.0), mat.floor);
floor.rotation.x = -Math.PI / 2; floor.position.set(-4.7, 0, 0.6); floor.receiveShadow = true; room.add(floor);
const wallMat = M(0xffffff, 0, 1, { map: concreteTex([5, 2]), side: THREE.BackSide });
const walls = new THREE.Mesh(new THREE.BoxGeometry(16.6, 4.4, 8.0), wallMat); walls.position.set(-4.7, 2.2, 0.6); room.add(walls);
// 表示を消せる組：wall＝壁・天井まわりと壁ぎわの物、small＝床に置いた小物
const hideSets = { wall: [walls], small: [] }; let _hn = 0; const grab = (k, n0) => hideSets[k].push(...room.children.slice(n0));
for (const [x0, x1, z0, z1] of [[-3.6, 3.2, -1.95, -1.85], [-3.6, 3.2, 2.0, 2.1], [-3.6, -3.5, -1.95, 2.1], [3.1, 3.2, -1.95, 2.1]])
  bx(x0, x1, 0, 0.01, z0, z1, mat.black, room);
const lamp = M(0xffffff, 0, 0.3, { emissive: 0xffffff, emissiveIntensity: 1 });
_hn = room.children.length;
for (const z of [-1.6, 1.6, 3.8]) bx(-12.8, -11.6, 4.25, 4.3, z - 0.07, z + 0.07, lamp, room);
for (const z of [-1.6, 1.6]) for (const x of [-10.0, -8.4, -6.8, -5.2, -3.6, -2.0, -0.4, 1.2, 2.8]) bx(x - 0.6, x + 0.6, 4.25, 4.3, z - 0.07, z + 0.07, lamp, room);
grab('wall', _hn);


// ---------- 共通ベース（鋼製架台＋防振装置） ----------
// 発電機下は箱形リブ構造、エンジン下は一体
bx(-2.9, -0.55, 0.35, 0.4, -0.75, 0.75, mat.body);
bx(-2.9, -0.55, 0.75, 0.8, -0.75, 0.75, mat.body);
bx(-2.9, -0.55, 0.4, 0.75, -0.75, -0.72, mat.body);
for (const x of [-2.9, -2.4, -1.85, -1.3, -0.8, -0.55]) bx(x, x + 0.04, 0.4, 0.75, -0.75, 0.75, mat.body);
bx(-0.55, 2.6, 0.35, 0.8, -0.75, 0.75, mat.body);
bx(-2.5, -0.7, 0.8, 1.0, -0.55, 0.55, mat.light); // 発電機台座
const _is0 = gen.children.length;
for (const x of [-2.6, -1.3, 0.1, 1.5, 2.4]) for (const z of [-0.6, 0.6]) {
  cyl(0.13, 0.12, mat.dark, x, 0.06, z, 'y'); cyl(0.1, 0.2, mat.black, x, 0.2, z, 'y');
  cyl(0.05, 0.06, mat.steel, x, 0.34, z, 'y');
}

// ---------- 発電機本体 ----------
const AY = 1.55;
cyl(0.6, 1.1, mat.light, -1.6, AY, 0);
bx(-2.55, -2.15, 0.95, 2.2, -0.7, 0.7, mat.body);   // 通風ルーバー箱（反駆動側）
bx(-1.05, -0.65, 0.95, 2.2, -0.7, 0.7, mat.body);   // 通風ルーバー箱（駆動側）
bx(-2.55, -0.65, 2.2, 2.38, -0.55, 0.55, mat.body); // 上部ダクト
for (const xc of [-2.35, -0.85]) for (const s of [-1, 1]) for (let i = 0; i < 14; i++)
  bx(xc - 0.15, xc + 0.15, 1.05 + i * 0.075, 1.08 + i * 0.075, s * 0.7, s * 0.7 + s * 0.04, mat.gray);
bx(-0.65, -0.4, 1.0, 2.1, -0.65, 0.65, mat.body);   // フライホイールハウジング
cyl(0.6, 0.12, mat.body, -2.62, AY, 0);             // 反駆動側エンドブラケット
for (let i = 0; i < 8; i++) {
  const rib = new THREE.Group(); rib.rotation.x = i * Math.PI / 4; rib.position.set(-2.7, AY, 0);
  bx(-0.03, 0.03, 0.12, 0.56, -0.04, 0.04, mat.body, rib); gen.add(rib);
}
cyl(0.3, 0.3, mat.body, -2.85, AY, 0); cyl(0.22, 0.2, mat.light, -3.05, AY, 0);
bx(-2.78, -2.62, 1.2, 1.55, 0.3, 0.55, mat.light);  // 端子箱
pipe([[-2.7, 1.3, 0.5], [-2.7, 1.0, 0.7], [-2.2, 0.55, 0.78], [-1.0, 0.55, 0.78]], 0.07, mat.cable);
pipe([[-2.7, 1.3, 0.5], [-2.72, 0.95, 0.7], [-2.2, 0.5, 0.8], [-1.0, 0.5, 0.8]], 0.07, mat.cable);

// ---------- ディーゼル機関（直列6気筒想定） ----------
bx(-0.4, 1.3, 0.9, 1.75, -0.45, 0.45, mat.body);       // クランクケース
bx(-0.4, 1.3, 1.75, 2.0, -0.4, 0.4, mat.body);         // シリンダヘッド
for (let i = 0; i < 6; i++) {
  const x = -0.25 + i * 0.26;
  bx(x - 0.1, x + 0.1, 2.0, 2.3, -0.22, 0.22, mat.cover);
  bx(x - 0.1, x + 0.1, 2.3, 2.34, -0.1, 0.1, mat.cover);
  bx(x - 0.1, x + 0.1, 1.05, 1.5, 0.45, 0.47, mat.light);         // 点検蓋
  bx(x - 0.1, x + 0.1, 1.05, 1.5, -0.47, -0.45, mat.light);
  pipe([[x, 1.75, 0.38], [x, 1.85, 0.5], [x, 2.05, 0.3]], 0.012, mat.steel);
}
bx(-0.3, 1.2, 1.5, 1.56, 0.46, 0.54, mat.steel);          // 燃料管ヘッダ
bx(0.25, 0.7, 1.5, 1.82, 0.45, 0.75, M(0xd0d4d8, 0.9, 0.3)); // 燃料噴射ポンプ
for (const x of [-0.3, -0.08]) cyl(0.09, 0.4, mat.gray, x, 1.95, 0.55, 'y');   // 燃料フィルタ
bx(-0.3, -0.12, 1.88, 2.0, 0.5, 0.6, mat.red).position.y = 1.95;
// 掃気トランク／インタークーラ
bx(-0.35, 1.2, 2.34, 2.56, -0.5, -0.2, mat.body);
cyl(0.17, 0.35, mat.turbo, 0.95, 2.6, -0.05, 'y');       // 過給機（保温カバー付）
cyl(0.2, 0.2, mat.black, 0.95, 2.4, -0.05, 'y');
// 排気管（保温カバー付き・天井へ）
cyl(0.2, 1.6, mat.lag, 0.95, 3.6, -0.05, 'y');
for (let y = 2.9; y < 4.3; y += 0.25) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.012, 6, 28), mat.steel); r.rotation.x = Math.PI / 2; r.position.set(0.95, y, -0.05); gen.add(r); }
// 冷却水配管・潤滑油配管
pipe([[-0.2, 0.98, 0.58], [0.5, 0.98, 0.58], [1.2, 1.0, 0.58], [1.45, 1.3, 0.58]], 0.045, mat.body);
pipe([[-0.35, 1.2, 0.56], [-0.5, 1.4, 0.6], [-0.55, 1.9, 0.6], [-0.4, 2.3, 0.4]], 0.04, mat.body);
pipe([[1.3, 2.3, 0.3], [1.5, 2.45, 0.3], [1.5, 2.2, 0.0]], 0.07, mat.body);
const vw = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 16), mat.yellow); vw.position.set(1.0, 1.18, 0.62); gen.add(vw);
cyl(0.015, 0.1, mat.steel, 1.0, 1.1, 0.62, 'y');
cyl(0.07, 0.3, mat.gray, 0.45, 0.95, 0.9, 'x');          // 補機ポンプモータ
// 整備用デッキ（縞鋼板）＋ステップ
bx(-0.45, 0.95, 1.06, 1.1, 0.5, 1.45, mat.plate);
bx(-0.45, 0.95, 0.8, 1.06, 1.38, 1.45, mat.body);
for (let i = 0; i < 5; i++) bx(-0.4 + i * 0.28, -0.4 + i * 0.28 + 0.14, 0.82, 0.98, 1.45, 1.52, mat.gray);
bx(-0.45, -0.1, 0.55, 0.6, 1.2, 1.9, mat.plate);
bx(-0.45, -0.42, 0.6, 1.06, 1.2, 1.45, mat.body); bx(-0.13, -0.1, 0.6, 1.06, 1.2, 1.45, mat.body);

// ---------- 冷却ファン・排気風洞 ----------
const FX = 1.5, FY = 1.65;
bx(1.3, 1.36, 0.9, 2.45, -0.8, 0.8, mat.gray);        // 風洞前板
bx(1.3, 2.9, 0.88, 0.95, -0.82, 0.82, mat.gray);
bx(1.3, 2.9, 2.45, 2.5, -0.82, 0.82, mat.gray);
bx(1.3, 2.9, 0.9, 2.45, -0.82, -0.78, mat.gray);
bx(1.3, 2.9, 0.9, 2.45, 0.78, 0.82, mat.gray);
bx(2.9, 2.95, 0.9, 2.5, -0.82, 0.82, mat.gray);
const shroud = cyl(0.72, 0.5, mat.gray, 1.62, FY, 0, 'x', gen, 48); shroud.material = M(0xbcc6c8, 0.3, 0.6, { side: THREE.DoubleSide }); shroud.geometry = new THREE.CylinderGeometry(0.72, 0.72, 0.5, 48, 1, true);
const fan = new THREE.Group(); fan.position.set(FX + 0.15, FY, 0); gen.add(fan);
for (let i = 0; i < 8; i++) {
  const p = new THREE.Group(); p.rotation.x = i * Math.PI / 4; fan.add(p);
  const b = bx(-0.02, 0.02, 0.12, 0.66, -0.1, 0.1, mat.yellow, p); b.rotation.x = 0.35;
}
cyl(0.11, 0.1, mat.steel, 0, 0, 0, 'x', fan);
for (let a = 0; a < 6; a++) { const r = bx(1.3, 1.34, -0.01, 0.01, -0.72, 0.72, mat.gray); r.position.y = FY; r.position.x = 1.33; r.rotation.x = a * Math.PI / 6; }
cyl(0.9, 0.5, mat.gray, 2.2, 2.6, 0, 'y', gen, 4, 1.1).rotation.y = Math.PI / 4;   // 排気ダクト上部
bx(1.6, 2.8, 2.5, 2.8, -0.55, 0.55, mat.gray);

// ================= 機関・発電機の作り込み（写真の細部） =================
function sticker(w, h, draw, x, y, z, ry = 0, rx = 0, p = gen) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: canvasTex(128, Math.max(32, Math.round(128 * h / w)), draw), roughness: 0.55, metalness: 0.1 }));
  m.position.set(x, y, z); m.rotation.y = ry; m.rotation.x = rx; p.add(m); return m;
}
const drawWarn = (g, w, h) => { g.fillStyle = '#f3f3f0'; g.fillRect(0, 0, w, h); g.fillStyle = '#e9b400'; g.beginPath(); g.moveTo(w * 0.22, h * 0.85); g.lineTo(w * 0.42, h * 0.2); g.lineTo(w * 0.62, h * 0.85); g.closePath(); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 4; g.stroke(); g.fillStyle = '#111'; g.font = 'bold 28px sans-serif'; g.textAlign = 'center'; g.fillText('!', w * 0.42, h * 0.72); g.fillStyle = '#c55'; g.fillRect(w * 0.68, h * 0.1, w * 0.28, h * 0.25); g.fillStyle = '#999'; for (let i = 0; i < 5; i++) g.fillRect(w * 0.68, h * 0.42 + i * h * 0.1, w * 0.28, 3); };
const drawPlate = (lines) => (g, w, h) => { g.fillStyle = '#d9dcdd'; g.fillRect(0, 0, w, h); g.strokeStyle = '#777'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4); g.fillStyle = '#222'; g.font = '11px sans-serif'; g.textAlign = 'left'; lines.forEach((t, i) => g.fillText(t, 8, 14 + i * 13)); };
const drawArrow = (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#111'; g.fillRect(w * 0.4, h * 0.4, w * 0.2, h * 0.55); g.beginPath(); g.moveTo(w * 0.12, h * 0.42); g.lineTo(w * 0.5, h * 0.05); g.lineTo(w * 0.88, h * 0.42); g.closePath(); g.fill(); };
const boltPts = [];
const bolt = (x, y, z, ax = 2) => boltPts.push([x, y, z, ax]);
function boltRing(cx, cy, cz, r, n, ax = 2) { for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n; if (ax === 0) bolt(cx, cy + Math.cos(a) * r, cz + Math.sin(a) * r, 0); else if (ax === 2) bolt(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz, 2); else bolt(cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r, 1); } }
function bands(pts, r, n, m = M(0xf2f2ee, 0, 0.7)) {
  const cv = new THREE.CatmullRomCurve3(pts.map(v => new THREE.Vector3(...v)), false, 'catmullrom', 0.04);
  for (let i = 1; i <= n; i++) { const u = i / (n + 1), p = cv.getPointAt(u), t = cv.getTangentAt(u), tr = new THREE.Mesh(new THREE.TorusGeometry(r, 0.01, 8, 18), m); tr.position.copy(p); tr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), t); gen.add(tr); }
}
const AYc = 1.55;
// ---- 発電機（交流発電機）----
for (const x of [-1.95, -1.3]) { const tr = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.012, 8, 48), mat.body); tr.rotation.y = Math.PI / 2; tr.position.set(x, AYc, 0); gen.add(tr); }
sticker(0.2, 0.12, drawPlate(['交流発電機 300kVA', '210V 60Hz', '（教育用モデル）']), -1.82, 1.66, 0.597);
sticker(0.16, 0.1, drawPlate(['定格 力率0.8', '絶縁 F種', '回転 900min⁻¹']), -1.5, 1.66, 0.597);
cyl(0.34, 0.28, mat.body, -2.78, AYc, 0, 'x', gen, 36, 0.6);                                 // 先細りのエンドブラケット
boltRing(-3.0, AYc, 0, 0.245, 10, 0); boltRing(-3.15, AYc, 0, 0.15, 6, 0); boltRing(-2.66, AYc, 0, 0.5, 16, 0);
sticker(0.1, 0.06, drawPlate(['銘板']), -2.69, AYc + 0.45, 0.2, -Math.PI / 2); sticker(0.1, 0.06, drawPlate(['銘板']), -2.69, AYc + 0.45, -0.15, -Math.PI / 2);
sticker(0.1, 0.1, drawWarn, -2.66, 1.5, 0.62, 0);
bx(-2.8, -2.6, 1.15, 1.58, 0.28, 0.58, mat.light);                                          // 端子箱
bx(-2.81, -2.59, 1.17, 1.56, 0.58, 0.6, mat.light); boltRing(-2.7, 1.37, 0.6, 0.13, 6, 2);
cyl(0.045, 0.08, mat.steel, -2.7, 1.12, 0.43, 'y');
bands([[-2.7, 1.12, 0.5], [-2.7, 0.95, 0.7], [-2.2, 0.55, 0.8], [-1.0, 0.55, 0.8]], 0.076, 7);
for (const xc of [-2.35, -0.85]) for (const s of [-1, 1]) {
  bx(xc - 0.2, xc + 0.2, 0.99, 1.03, s * 0.7, s * 0.7 + s * 0.012, mat.light); bx(xc - 0.2, xc + 0.2, 2.17, 2.21, s * 0.7, s * 0.7 + s * 0.012, mat.light);
  bx(xc - 0.2, xc - 0.17, 0.99, 2.21, s * 0.7, s * 0.7 + s * 0.012, mat.light); bx(xc + 0.17, xc + 0.2, 0.99, 2.21, s * 0.7, s * 0.7 + s * 0.012, mat.light);
  for (const [bxx, byy] of [[-0.18, 1.02], [0.18, 1.02], [-0.18, 2.18], [0.18, 2.18]]) bolt(xc + bxx, byy, s * 0.715, 2);
}
for (const x of [-2.3, -0.85]) { const tr = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 16), mat.steel); tr.rotation.y = Math.PI / 2; tr.position.set(x, 2.46, 0); gen.add(tr); }
// ---- フライホイールハウジング ----
cyl(0.5, 0.3, mat.body, -0.52, AYc, 0, 'x', gen, 36);
cyl(0.13, 0.04, mat.light, -0.55, 1.35, 0.66, 'z'); boltRing(-0.55, 1.35, 0.68, 0.1, 8, 2);
sticker(0.1, 0.1, drawWarn, -0.5, 1.85, 0.652); sticker(0.12, 0.07, drawPlate(['フライホイール', 'ハウジング']), -0.6, 1.1, 0.652);
// ---- エンジン +z 側（点検デッキ側）----
cyl(0.085, 1.0, mat.body, 0.35, 1.62, 0.58, 'x');
for (const x of [-0.17, 0.87]) { cyl(0.115, 0.03, mat.light, x, 1.62, 0.58, 'x'); boltRing(x, 1.62, 0.58, 0.1, 8, 0); }
sticker(0.16, 0.08, drawPlate(['潤滑油冷却器', 'LUBE OIL COOLER']), 0.35, 1.63, 0.67);
pipe([[-0.1, 1.58, 0.6], [-0.25, 1.4, 0.62], [-0.3, 1.0, 0.6]], 0.035, mat.body); pipe([[0.8, 1.58, 0.6], [0.95, 1.4, 0.62], [1.0, 1.0, 0.6]], 0.035, mat.body);
bx(-0.35, 1.2, 1.78, 1.98, 0.42, 0.47, mat.perf); bx(-0.35, 1.2, 1.78, 1.8, 0.47, 0.5, mat.light); bx(-0.35, 1.2, 1.96, 1.98, 0.47, 0.5, mat.light);
bx(0.0, 0.3, 1.83, 1.93, 0.47, 0.475, mat.black); bx(0.7, 1.0, 1.83, 1.93, 0.47, 0.475, mat.black);
for (const x of [0.1, 0.4]) bx(x - 0.012, x + 0.012, 2.0, 2.3, 0.5, 0.526, M(0xe8eef0, 0.1, 0.3));
pipe([[-0.45, 0.95, 0.52], [-0.45, 1.95, 0.52]], 0.035, mat.body); pipe([[1.22, 1.0, 0.54], [1.22, 1.9, 0.54]], 0.035, mat.body);
for (const [x, y] of [[-0.45, 1.3], [1.22, 1.4]]) sticker(0.05, 0.1, drawArrow, x, y, 0.56);
{ const mt = new THREE.Group(); mt.position.set(0.65, 1.2, 0.98); gen.add(mt);                       // デッキ上の電動ポンプ
  cyl(0.085, 0.3, mat.gray, 0, 0, 0, 'x', mt); cyl(0.1, 0.03, mat.light, 0.17, 0, 0, 'x', mt); cyl(0.05, 0.1, mat.steel, 0.24, 0, 0, 'x', mt);
  bx(-0.1, 0.1, 0.085, 0.14, -0.04, 0.04, mat.black, mt); bx(-0.12, 0.12, -0.12, -0.09, -0.07, 0.07, mat.dark, mt); }
for (let i = 0; i < 5; i++) { const x = -0.34 + i * 0.28; pipe([[x, 0.88, 1.5], [x, 0.78, 1.56], [x + 0.05, 0.7, 1.56], [x + 0.1, 0.78, 1.52]], 0.012, M(0xdadfe2, 0.6, 0.4)); }
// ---- エンジン -z 側（燃料噴射ポンプ・フィルタ側）----
bx(0.1, 0.72, 1.5, 1.8, -0.64, -0.45, M(0xcfd3d6, 0.45, 0.4)); cyl(0.09, 0.24, M(0xc4c8cc, 0.45, 0.4), -0.05, 1.65, -0.55, 'z');
for (let i = 0; i < 6; i++) { const x = -0.25 + i * 0.26; pipe([[0.12 + i * 0.1, 1.8, -0.6], [x - 0.02, 1.9, -0.5], [x, 2.05, -0.32]], 0.01, mat.steel); cyl(0.045, 0.05, mat.steel, x, 2.36, 0, 'y'); bx(x - 0.12, x + 0.12, 1.99, 2.03, -0.28, 0.28, mat.cover); }
for (const x of [1.0, 1.16]) { cyl(0.065, 0.3, mat.gray, x, 1.95, -0.62, 'y'); cyl(0.067, 0.12, mat.red, x, 1.97, -0.62, 'y'); }
bx(-0.45, 0.95, 1.06, 1.1, -1.45, -0.5, mat.plate); bx(-0.45, 0.95, 0.8, 1.06, -1.45, -1.38, mat.body);
for (const x of [-0.4, 0.9]) bx(x - 0.02, x + 0.02, 0.8, 1.06, -1.4, -0.5, mat.body);
// ---- ファン周り ----
{ const bell = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 12, 48), mat.gray); bell.rotation.y = Math.PI / 2; bell.position.set(1.37, FY, 0); gen.add(bell); }
for (const r of [0.22, 0.44, 0.66]) { const tr = new THREE.Mesh(new THREE.TorusGeometry(r, 0.005, 6, 40), mat.steel); tr.rotation.y = Math.PI / 2; tr.position.set(1.31, FY, 0); gen.add(tr); }
pipe([[1.3, 2.2, 0.45], [1.55, 2.55, 0.5], [1.75, 2.45, 0.2]], 0.075, mat.body);
sticker(0.05, 0.1, drawArrow, 1.4, 1.2, 0.6);
// ---- 過給機・排気 ----
cyl(0.15, 0.1, mat.black, 0.55, 2.65, 0.05, 'x'); pipe([[0.6, 2.62, 0.03], [0.8, 2.6, 0], [0.9, 2.6, -0.02]], 0.05, mat.black);
pipe([[0.6, 2.35, -0.05], [0.85, 2.4, -0.05], [0.95, 2.45, -0.05]], 0.105, mat.lag);
for (const y of [3.0, 3.5]) { cyl(0.25, 0.03, mat.steel, 0.95, y, -0.05, 'y'); boltRing(0.95, y, -0.05, 0.22, 10, 1); }
cyl(0.205, 0.45, M(0x9aa0a5, 0.85, 0.45), 0.95, 3.25, -0.05, 'y');
for (let k = 0; k < 7; k++) { const tr = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.012, 6, 28), mat.steel); tr.rotation.x = Math.PI / 2; tr.position.set(0.95, 3.05 + k * 0.065, -0.05); gen.add(tr); }
function buildBolts() {
  const geo = new THREE.CylinderGeometry(0.011, 0.011, 0.013, 6), im = new THREE.InstancedMesh(geo, M(0x7d8689, 0.8, 0.45), boltPts.length), d = new THREE.Object3D();
  boltPts.forEach(([x, y, z, ax], i) => { d.position.set(x, y, z); d.rotation.set(ax === 2 ? Math.PI / 2 : 0, 0, ax === 0 ? Math.PI / 2 : 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
  im.castShadow = true; gen.add(im);
}
buildBolts();

const isoObjs = new Set(gen.children.slice(_is0, _is0 + 30));
const rig = new THREE.Group();
[...gen.children].forEach(o => { if (!isoObjs.has(o)) rig.add(o); });
gen.add(rig);
for (const x of [-2.6, -1.3, 0.1, 1.5, 2.4]) for (const z of [-0.6, 0.6]) for (const y of [0.14, 0.26]) { const tr = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 10, 24), mat.black); tr.rotation.x = Math.PI / 2; tr.position.set(x, y, z); tr.castShadow = true; gen.add(tr); }
// ---------- 操作盤（デスク型）＋金網ガード ----------
const cp = new THREE.Group(); cp.position.set(-1.05, 0, -1.52); cp.rotation.y = Math.PI; gen.add(cp);
bx(-0.45, 0.45, 0, 0.85, -0.3, 0.3, mat.body, cp);
const sh = new THREE.Shape(); sh.moveTo(-0.3, 0.85); sh.lineTo(0.3, 0.85); sh.lineTo(0.3, 1.05); sh.lineTo(-0.3, 1.3); sh.closePath();
const prismG = new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: false }); prismG.translate(0, 0, -0.45);
const prism = new THREE.Mesh(prismG, mat.body); prism.rotation.y = -Math.PI / 2; prism.castShadow = true; cp.add(prism);
bx(-0.43, -0.01, 0.05, 0.8, 0.3, 0.315, mat.light, cp); bx(0.01, 0.43, 0.05, 0.8, 0.3, 0.315, mat.light, cp);
bx(-0.07, -0.03, 0.3, 0.5, 0.315, 0.34, mat.steel, cp); bx(0.03, 0.07, 0.3, 0.5, 0.315, 0.34, mat.steel, cp);
for (const x of [-0.3, 0.3]) { const e = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 8, 16), mat.steel); e.position.set(x, 1.31, -0.28); cp.add(e); }
const deskNeedles = [];
const desk = new THREE.Group(); const al = Math.atan2(0.6, 0.25); desk.rotation.x = -al; desk.position.set(0, 1.175, 0); cp.add(desk);
function gauge(x, y, r, max) {
  const t = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 3; g.fillStyle = '#111';
    for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.8 + 1.4 * i / 10); g.beginPath(); g.moveTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46); g.lineTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56); g.stroke(); }
    g.strokeStyle = '#c00'; g.lineWidth = 5; const a = Math.PI * (0.8 + 1.4 * max); g.beginPath(); g.moveTo(64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40); g.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); g.stroke();
    g.strokeStyle = '#111'; g.lineWidth = 4; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(Math.PI * 1.9) * 40, 64 + Math.sin(Math.PI * 1.9) * 40); g.stroke();
  });
  const grp = new THREE.Group(); grp.position.set(x, y, 0.012);
  grp.add(new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshStandardMaterial({ map: t, roughness: 0.3 })));
  const bz = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, r * 0.14, 8, 32), mat.black); bz.position.z = 0.006; grp.add(bz); desk.add(grp);
}
gauge(-0.24, 0.1, 0.075, 0.75); gauge(0.05, 0.1, 0.05, 0.6); gauge(0.17, 0.1, 0.05, 0.5); gauge(0.29, 0.1, 0.05, 0.55);
bx(-0.31, -0.17, -0.2, -0.06, 0, 0.01, mat.black, desk);
const knob = bx(-0.255, -0.225, -0.17, -0.09, 0.01, 0.04, mat.black, desk); knob.rotation.z = -0.5;
// 天板は、実機の写真（真上に補正）を貼る。回転計が左、圧力計3つが右、切替スイッチが回転計の下。
desk.children.forEach(o => { o.visible = false; });
{ const t = new THREE.TextureLoader().load(DESK_PHOTO.uri); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const top = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9 * DESK_PHOTO.h / DESK_PHOTO.w * 0.9 / 0.9), new THREE.MeshStandardMaterial({ map: t, color: 0xe3f6f1, roughness: 0.5, metalness: 0.1 })); top.position.z = 0.0015; top.receiveShadow = true; desk.add(top);
  // 計器の針（写真では消してある。運転状態に連動して動く）。位置は、補正した写真の画素（1040×750）で指定。
  const PXM = 0.9 / DESK_PHOTO.w, needleM = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.5 });
  const mkNeedle = (hx, hy, tipLen, tailLen, rest, span, fn) => {
    const g = new THREE.Group(); g.position.set((hx - DESK_PHOTO.w / 2) * PXM, (DESK_PHOTO.h / 2 - hy) * PXM, 0.004); desk.add(g);
    const len = (tipLen + tailLen) * PXM, n = new THREE.Mesh(new THREE.BoxGeometry(0.0019, len, 0.0012), needleM); n.position.y = (tipLen - tailLen) * PXM / 2; g.add(n);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.002, 16), needleM); cap.rotation.x = Math.PI / 2; g.add(cap);
    deskNeedles.push({ g, rest, span, fn }); };
  // rest：停止時の向き（上から時計回りの度）、span：目盛りの端までの角度
  mkNeedle(245, 205, 40, 8, -118.6, 222.6, () => S.rpm / 1800);       // 機関回転計（0〜1800 min⁻¹）
  mkNeedle(651, 189, 31, 12, -137, 265, () => 0.5 * Math.min(1, S.rpm / 1200));   // 潤滑油（0〜1 MPa）
  mkNeedle(781, 190, 33, 12, -137, 265, () => 0.46 * Math.min(1, S.rpm / 1200));  // 冷却水（0〜0.4 MPa）
  mkNeedle(919, 189, 36, 14, -137, 265, () => 0.35 * Math.min(1, S.rpm / 1200));  // 給気（0〜0.4 MPa）
}
// 金網ガード（危険表示付）：写真1・3より、発電機側面（-z側）で操作盤の隣（反駆動側寄り）
const cage = new THREE.Group(); cage.position.set(-2.2, 0, -1.12); cage.rotation.y = 0; gen.add(cage);
const CW = 1.3, CD = 0.65, CH = 1.9;
const plane = (w, h, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat.perf); m.position.set(x, y, z); m.rotation.y = ry; cage.add(m); };
const perfFrame = M(0x8fb0aa, 0.35, 0.55);
plane(CW, CH, 0, CH / 2 + 0.1, -CD / 2, 0); plane(CW, CH, 0, CH / 2 + 0.1, CD / 2, 0); plane(CD, CH, -CW / 2, CH / 2 + 0.1, 0, Math.PI / 2); plane(CD, CH, CW / 2, CH / 2 + 0.1, 0, Math.PI / 2);
for (const x of [-CW / 2, CW / 2]) for (const z of [-CD / 2, CD / 2]) bx(x - 0.02, x + 0.02, 0, CH + 0.1, z - 0.02, z + 0.02, perfFrame, cage);
for (const y of [0.1, CH + 0.08]) { bx(-CW / 2, CW / 2, y, y + 0.04, -CD / 2 - 0.02, -CD / 2 + 0.02, perfFrame, cage); bx(-CW / 2, CW / 2, y, y + 0.04, CD / 2 - 0.02, CD / 2 + 0.02, perfFrame, cage); bx(-CW / 2 - 0.02, -CW / 2 + 0.02, y, y + 0.04, -CD / 2, CD / 2, perfFrame, cage); bx(CW / 2 - 0.02, CW / 2 + 0.02, y, y + 0.04, -CD / 2, CD / 2, perfFrame, cage); }
bx(-CW / 2, CW / 2, CH + 0.1, CH + 0.13, -CD / 2, CD / 2, mat.body, cage);
// 扉（観音開き風に中央で分割・掛け金・蝶番）
bx(-0.02, 0.02, 0.1, CH + 0.1, -CD / 2 - 0.03, -CD / 2 + 0.02, perfFrame, cage);
for (const y of [0.5, 1.0, 1.5]) cyl(0.018, 0.09, chrome, CW / 2 - 0.02, y, -CD / 2 - 0.03, 'y', cage, 12);
const latch = bx(-0.06, 0.06, 1.38, 1.42, -CD / 2 - 0.045, -CD / 2 - 0.02, chrome, cage);
const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshStandardMaterial({ map: labelTex(128, 128, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.save(); g.translate(64, 64); g.rotate(Math.PI / 4); g.fillStyle = '#e8590c'; g.fillRect(-36, -36, 72, 72); g.restore();
  g.fillStyle = '#111'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('危険', 64, 66);
}) })); sign.position.set(0.28, 1.0, -CD / 2 - 0.025); sign.rotation.y = Math.PI; cage.add(sign);

// ---------- 室内燃料タンク ----------
const tank = new THREE.Group(); tank.position.set(2.5, 0, 2.7); gen.add(tank);
bx(-0.75, 0.75, 0, 0.18, -0.6, 0.6, M(0x9a9ea2, 0.1, 0.9), tank);
for (const x of [-0.45, 0.45]) for (const z of [-0.35, 0.35]) bx(x - 0.04, x + 0.04, 0.18, 1.3, z - 0.04, z + 0.04, mat.gray, tank);
bx(-0.5, 0.5, 1.3, 2.5, -0.4, 0.4, mat.gray, tank);
const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.2), new THREE.MeshStandardMaterial({ map: labelTex(256, 64, (g, w, h) => { g.fillStyle = '#c3cbcd'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('室内燃料タンク', 128, 34); }) }));
tl.position.set(0, 2.15, -0.401); tl.rotation.y = Math.PI; tank.add(tl);
pipe([[0.35, 1.3, -0.42], [0.35, 0.8, -0.5], [0.0, 0.7, -0.5], [-0.3, 0.6, -0.55]], 0.025, mat.red, tank);
pipe([[0.45, 1.8, -0.42], [0.6, 1.8, -0.5], [0.6, 0.5, -0.55]], 0.025, mat.red, tank);


// ---------- 機械室の付帯設備（ビデオより） ----------
const conc = M(0x9a9ea2, 0.05, 0.9), beige = M(0xd9d0b4, 0.2, 0.6), duct = M(0x9aa0a4, 0.5, 0.45);
// 天井のはり
_hn = room.children.length;
for (const x of [-10.0, -8.0, -6.0, -4.0, -2.0, 0.0, 2.0]) bx(x - 0.15, x + 0.15, 4.0, 4.4, -3.4, 4.6, M(0x5a5d60, 0, 0.95), room);
grab('wall', _hn);
// 左壁（-z側）の下部ベージュ帯と、床の縞鋼板
_hn = room.children.length;
bx(-10.5, 3.6, 0, 1.25, -3.4, -3.37, M(0x9c9d83, 0, 0.9), room);
grab('wall', _hn);
bx(-4.1, 3.6, 0, 0.012, -3.3, -2.5, mat.plate, room); bx(-10.4, -9.5, 0, 0.012, -3.3, -1.0, mat.plate, room);
// 排気管（天井まで→入口側へ）と、風道の曲がり
pipe([[0.55, 4.3, -0.32], [0.55, 4.05, -0.32], [0.4, 4.05, -0.05], [-0.8, 4.05, -0.05]], 0.2, mat.lag, room);
pipe([[2.3, 2.8, 0], [2.3, 3.6, -0.6], [1.8, 3.75, -1.8], [0.4, 3.75, -2.9], [-2.5, 3.75, -3.0]], 0.38, duct, room);
// 背面壁の換気扇
_hn = room.children.length;
bx(3.52, 3.6, 2.6, 3.4, -1.9, -1.1, M(0xb5babd, 0.4, 0.6), room);
{ const f = new THREE.Mesh(new THREE.CircleGeometry(0.33, 28), M(0x6e7479, 0.4, 0.6, { side: THREE.DoubleSide })); f.rotation.y = -Math.PI / 2; f.position.set(3.51, 3.0, -1.5); room.add(f); }
grab('wall', _hn);
// 燃料タンクの防油堤
for (const [x0, x1, z0, z1] of [[1.55, 3.45, 2.0, 2.15], [1.55, 3.45, 3.45, 3.6], [1.55, 1.7, 2.0, 3.6], [3.3, 3.45, 2.0, 3.6]]) bx(x0, x1, 0, 0.18, z0, z1, conc, room);
// 蓄電池設備（写真：鉛蓄電池12セル＝6個×2列、黒い枠、黄色の注液栓、触媒栓、番号札、「代表槽」札、+−端子と透明カバー、ベージュの鋼製架台、黄色の耐酸マット）
const bat = new THREE.Group(); bat.position.set(-1.0, 0, 2.7); room.add(bat);
for (const [x0, x1, z0, z1] of [[-0.85, 0.85, -0.6, -0.5], [-0.85, 0.85, 0.5, 0.6], [-0.85, -0.75, -0.6, 0.6], [0.75, 0.85, -0.6, 0.6]]) bx(x0, x1, 0, 0.12, z0, z1, conc, bat);
bx(-0.75, 0.75, 0, 0.02, -0.5, 0.5, M(0xd6c94a, 0, 0.9), bat);   // 耐酸マット
{
  const stand = M(0xcfc6ae, 0.3, 0.55), jar = new THREE.MeshPhysicalMaterial({ color: 0x1a2550, transparent: true, opacity: 0.82, roughness: 0.12, metalness: 0, clearcoat: 0.6 });
  const blk = M(0x101114, 0.2, 0.45), yel = M(0xe8c21a, 0, 0.45), cap = M(0x5a6f96, 0, 0.9), wht = M(0xf2f2f0, 0, 0.6);
  const CW = 0.158, CD = 0.2, CH = 0.37, Y0 = 0.5;                  // セルの幅・奥行き・高さ、底の高さ
  for (const x of [-0.58, 0.58]) for (const z of [-0.26, 0.26]) bx(x - 0.025, x + 0.025, 0, Y0 - 0.04, z - 0.025, z + 0.025, stand, bat);   // 脚
  for (const z of [-0.26, 0.26]) bx(-0.64, 0.64, Y0 - 0.1, Y0 - 0.04, z - 0.03, z + 0.03, stand, bat);
  for (const x of [-0.58, 0.58]) bx(x - 0.03, x + 0.03, 0.2, 0.26, -0.26, 0.26, stand, bat);
  bx(-0.62, 0.62, Y0 - 0.04, Y0, -0.24, 0.24, stand, bat);          // 受け板
  const tex = (txt, w = 64, h = 64, bg = '#f4f4f0', fg = '#111', fs = 40) => canvasTex(w, h, (g, ww, hh) => { g.fillStyle = bg; g.fillRect(0, 0, ww, hh); g.fillStyle = fg; g.font = 'bold ' + fs + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, ww / 2, hh / 2 + 2); });
  for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
    const num = r === 0 ? c + 1 : 12 - c, x = -0.5 + c * (CW + 0.013), z = r === 0 ? -0.108 : 0.108, xx = x - 0.0;
    // 電槽（透明）と蓋の黒い枠
    const j = bx(xx - CW / 2, xx + CW / 2, Y0, Y0 + CH, z - CD / 2, z + CD / 2, jar, bat); j.castShadow = false;
    bx(xx - CW / 2 - 0.004, xx + CW / 2 + 0.004, Y0 + CH, Y0 + CH + 0.035, z - CD / 2 - 0.004, z + CD / 2 + 0.004, blk, bat);
    cyl(0.043, 0.07, blk, xx + 0.005, Y0 + CH + 0.07, z + (r === 0 ? 0.035 : 0.035), 'y', bat, 20);                       // 触媒栓の筒
    cyl(0.047, 0.026, cap, xx + 0.005, Y0 + CH + 0.118, z + 0.035, 'y', bat, 24);                                            // 青灰色の栓
    cyl(0.017, 0.032, yel, xx - 0.04, Y0 + CH + 0.052, z - 0.06, 'y', bat, 8);                                              // 黄色い注液栓
    // 番号札（手前側の面）
    const lab = new THREE.Mesh(new THREE.CircleGeometry(0.016, 20), new THREE.MeshStandardMaterial({ map: tex(String(num), 64, 64, '#f4f4f0', '#111', 40), roughness: 0.6 }));
    if (r === 0) { lab.position.set(xx + 0.045, Y0 + CH + 0.036, z - CD / 2 - 0.003 + 0.0); lab.rotation.x = -Math.PI / 2 + 0.0; lab.position.y = Y0 + CH + 0.0365; lab.position.z = z - 0.07; lab.rotation.x = -Math.PI / 2; } else { lab.position.set(xx + 0.045, Y0 + CH + 0.0365, z - 0.07); lab.rotation.x = -Math.PI / 2; }
    // 電槽の前面：液面線（黄）と、ラベル
    if (r === 0) { bx(xx - CW / 2 + 0.01, xx + CW / 2 - 0.01, Y0 + CH - 0.07, Y0 + CH - 0.065, z - CD / 2 - 0.001, z - CD / 2 + 0.001, yel, bat); }
    if (r === 0) { const sp = new THREE.Mesh(new THREE.PlaneGeometry(CW - 0.03, 0.05), new THREE.MeshStandardMaterial({ map: tex('蓄電池', 128, 32, '#00000000', '#e8c21a', 20), transparent: true })); sp.position.set(xx, Y0 + 0.07, z - CD / 2 - 0.002); sp.rotation.y = Math.PI; bat.add(sp); }
    bat.add(lab);
  }
  // 壁の掲示「蓄電池保守点検要領」（写真：蓄電池の後ろの壁、端子側の上。タップすると全文を読める。連絡先・会社名は入れない）
  { const NOTE = ['１．日常保守の管理ポイント', '　(1) 浮動充電中の蓄電池総電圧が適正値（2.20V／セル×セル数）であることを確認する。', '　(2) 電解液面が適正であることを確認する。減液している場合は最高液面線まで精製水を補水する。', '　(3) 蓄電池の外観を調査し、異常のないことを確認する。', '２．定期の保守', '　(1) 3ヶ月に1度は均等充電を行う。（2.40V／セルで7〜8時間）', '　(2) 浮動充電中の全セルの電圧・電解液比重及び液温を3ヶ月に1回測定し、異常のないことを確認する。', '　　　浮動充電電圧：2.20±0.05V／セル', '　　　電解液比重：1.260±0.005（20℃）', '　　上記規定値以下のセルがある場合は均等充電を行う。', '　(a) 比重の温度換算式　D20 = Dt + 0.0007（t − 20）', '　　　D20：20℃に換算した比重　Dt：測定時（t℃）における比重', '　　　t：測定時の電解液温度　0.0007：温度換算係数', '３．注意事項', '　(1) 蓄電池及びその周囲は清潔にし、乾燥状態を保ってください。', '　(2) 蓄電池には火気を近づけないでください。', '　(3) 電解液が目、皮膚や衣服に付いた時は、直ちに大量の水で洗い流し、特に目に入った時は医師の診察を受けてください。', '４．その他', '　(1) その他詳細は取扱説明書をご覧ください。'];
    window.__batNote = NOTE;
    // 紙の見た目は、掲示の写真に合わせる：少し灰色がかった紙、細いゴシック、字間をあけて下線を引いた題、(a) の右に (b) の図。透明な板にはさみ、上を金具2つで吊る。連絡先・会社名は入れない
    const paintNote = (g, W, H) => {
      const k = W / 724; g.save(); g.scale(k, k);
      const pg = g.createLinearGradient(0, 0, 724, 1024); pg.addColorStop(0, '#d9dad5'); pg.addColorStop(0.5, '#dfe0db'); pg.addColorStop(1, '#d2d3ce'); g.fillStyle = pg; g.fillRect(0, 0, 724, 1024);
      g.fillStyle = '#1b1d1f'; g.textBaseline = 'alphabetic';
      const F = (px, b) => { g.font = (b ? '600 ' : '400 ') + px + 'px "Hiragino Sans","Yu Gothic","Noto Sans JP",sans-serif'; };
      F(27); g.textAlign = 'center'; if ('letterSpacing' in g) g.letterSpacing = '13px'; g.fillText('蓄電池保守点検要領', 362 + 6, 118); if ('letterSpacing' in g) g.letterSpacing = '0px'; g.fillRect(228, 127, 268, 1.3);
      g.textAlign = 'left';
      const T = (x, y, t, px = 12.6, b) => { F(px, b); g.fillText(t, x, y); };
      T(78, 184, '１．日常保守の管理ポイント', 17);
      T(98, 214, '（１）浮動充電中の蓄電池総電圧が適正値（２.２０Ｖ／セル×セル数）であることを確認する。');
      T(98, 241, '（２）電解液面が適正であることを確認する。減液している場合は最高液面線まで精製水を補水する。');
      T(98, 268, '（３）蓄電池の外観を調査し、異常のないことを確認する。');
      T(88, 314, '２．定期の保守', 15.5, true);
      T(106, 343, '（１）３ヶ月に１度は均等充電を行う。（２.４０Ｖ／セルで７〜８時間）');
      T(106, 370, '（２）浮動充電中の全セルの電圧・電解液比重及び液温を３ヶ月に１回測定し、異常のないことを確認する。', 12.1);
      T(170, 394, '浮動充電電圧：２.２０±０.０５Ｖ／セル'); T(170, 419, '電 解 液 比 重：１.２６０±０.００５（２０℃）');
      T(140, 444, '上記規定値以下のセルがある場合は均等充電を行う。', 11.6);
      T(142, 468, '（ａ）比重の温度換算式', 11.2); T(432, 468, '（ｂ）電解液比重の測り方', 11.2);
      T(176, 492, 'Ｄ₂₀＝ Ｄｔ＋０.０００７（ｔ−２０）');
      T(176, 516, 'ここに　Ｄ₂₀', 11.6); T(276, 516, '：２０℃に換算した比重', 11.2);
      T(220, 539, 'Ｄｔ', 11.6); T(276, 539, '：測定時（ｔ℃）における比重', 11.2);
      T(224, 562, 'ｔ', 11.6); T(276, 562, '：測定時の電解液温度', 11.2);
      T(220, 585, '０.０００７：温度換算係数', 11.2);
      // (b) の図：電槽の口に入れた比重計と、液面を横から見る目
      g.strokeStyle = '#3a3c3e'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(478, 500); g.lineTo(478, 588); g.moveTo(534, 496); g.lineTo(534, 590); g.moveTo(478, 500); g.quadraticCurveTo(505, 492, 534, 496); g.stroke();
      g.beginPath(); g.arc(462, 510, 7, 0, 7); g.moveTo(467, 515); g.lineTo(480, 524); g.stroke();
      g.beginPath(); g.moveTo(499, 512); g.lineTo(499, 560); g.quadraticCurveTo(486, 566, 486, 588); g.moveTo(513, 512); g.lineTo(513, 560); g.quadraticCurveTo(526, 566, 526, 588); g.moveTo(499, 512); g.quadraticCurveTo(506, 506, 513, 512); g.stroke();
      for (let y = 518; y < 556; y += 3.2) { g.beginPath(); g.moveTo(503, y); g.lineTo(509, y); g.stroke(); }
      g.beginPath(); g.moveTo(480, 526); g.lineTo(499, 526); g.moveTo(513, 526); g.lineTo(534, 526); g.stroke(); g.setLineDash([3, 2.5]); g.beginPath(); g.moveTo(513, 524); g.lineTo(556, 524); g.stroke(); g.setLineDash([]);
      g.beginPath(); g.ellipse(563, 524, 5, 3.4, 0, 0, 7); g.stroke(); g.beginPath(); g.arc(562, 524, 1.6, 0, 7); g.fill();
      T(112, 622, '３．注意事項', 14.5, true);
      T(126, 646, '（１）蓄電池及びその周囲は清潔にし、乾燥状態を保ってください。', 11.2);
      T(126, 668, '（２）蓄電池には火気を近づけないでください。', 11.2);
      T(126, 690, '（３）電解液が目、皮膚や衣服に付いた時は、直ちに大量の水で洗い流し、特に目に入った時は医師の', 11.2);
      T(153, 711, '診察を受けてください。', 11.2);
      T(120, 744, '４．その他', 14.5, true);
      T(134, 766, '（１）その他詳細は取扱説明書をご覧ください。', 11.2);
      T(134, 787, '（２）異常が発見された場合は、下記へご連絡ください。', 11.2);
      g.fillStyle = '#6a6c6e'; T(232, 850, '（連絡先・会社名は、この教材では省略）', 11.5);
      // 透明な板の映り込み（斜めの薄い帯）
      const gl = g.createLinearGradient(0, 0, 724, 600); gl.addColorStop(0, '#ffffff00'); gl.addColorStop(0.42, '#ffffff00'); gl.addColorStop(0.5, '#ffffff2e'); gl.addColorStop(0.58, '#ffffff00'); gl.addColorStop(1, '#ffffff00'); g.fillStyle = gl; g.fillRect(0, 0, 724, 1024);
      g.restore();
    };
    window.__batNotePaint = paintNote;
    const nt = canvasTex(1448, 2048, paintNote);
    nt.anisotropy = 8;
    const nb = new THREE.Group(); nb.position.set(-0.72, 1.62, 1.895); nb.rotation.y = Math.PI; bat.add(nb); nb.userData.note = true;
    // 紙（透明な板より一回り小さい）、白い縁の透明な板、上の金具2つ
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.43, 0.608), new THREE.MeshStandardMaterial({ map: nt, roughness: 0.42 })); sh.position.y = 0.006; nb.add(sh);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.66, 0.004), M(0xdcdcd8, 0, 0.5)); fr.position.z = -0.004; nb.add(fr);
    const ac = new THREE.Mesh(new THREE.PlaneGeometry(0.462, 0.652), new THREE.MeshPhysicalMaterial({ color: 0xf2f6f6, transparent: true, opacity: 0.05, roughness: 0.06, clearcoat: 1, depthWrite: false })); ac.position.z = 0.002; nb.add(ac);
    for (const x of [-0.14, 0.14]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.032, 0.012), M(0xb9bdc2, 0.8, 0.35)); c.position.set(x, 0.335, 0); nb.add(c); }
    window.__batNoteObj = nb; }
  // 「代表槽」の札（1番セルの前面）
  { const t = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.035), new THREE.MeshStandardMaterial({ map: tex('代表槽', 128, 40, '#8fc7ff', '#111', 24), roughness: 0.6 })); t.position.set(-0.5, Y0 + 0.2, -0.2 - 0.002); t.rotation.y = Math.PI; bat.add(t); }
  // +−端子と透明カバー、太いケーブル（右端）
  bx(-0.6, -0.575, Y0 + CH - 0.02, Y0 + CH + 0.04, -0.2, 0.2, blk, bat);
  bx(-0.72, -0.6, Y0 + 0.02, Y0 + CH + 0.06, -0.24, 0.24, new THREE.MeshPhysicalMaterial({ color: 0xcfe0f0, transparent: true, opacity: 0.22, roughness: 0.05 }), bat).castShadow = false;
  for (const [zz, red] of [[-0.1, false], [0.1, true]]) for (const dz of [-0.02, 0.02]) pipe([[-0.6, Y0 + CH + 0.01, zz + dz], [-0.8, Y0 + CH + 0.05, zz + dz], [-0.88, 1.15, zz + dz * 2], [-0.84, 0.6, zz + dz * 3 + (red ? 0.1 : -0.1)]], 0.022, mat.cable, bat);
  for (const [zz, tx] of [[-0.1, '−'], [0.1, '+']]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.025), new THREE.MeshStandardMaterial({ map: tex(tx, 64, 40, '#f4f4f0', '#111', 34) })); m.position.set(0.5 - 5 * (CW + 0.013) - 0.0, Y0 + CH + 0.0365, zz > 0 ? 0.108 + 0.07 : -0.108 - 0.07); m.rotation.x = -Math.PI / 2; m.visible = false; bat.add(m); }
  // ケーブル用の配管（右）
  for (const z of [0.0, 0.1, 0.2]) cyl(0.05, 0.9, beige, -0.78, 0.45, z + 0.3, 'y', bat, 14);
}
// 壁の掲示物・スイッチ
_hn = room.children.length;
{ const n = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.5), M(0xf2f2f0, 0, 0.8)); n.position.set(-0.6, 1.5, 3.57); n.rotation.y = Math.PI; room.add(n); }
bx(-1.4, -1.28, 1.5, 1.7, 3.55, 3.6, M(0xdcdcdc), room);
bx(-0.5, -0.38, 1.9, 2.05, 3.55, 3.6, M(0xdcdcdc), room);
grab('wall', _hn);
// はしご・白い袋・パレット・塗料缶
_hn = room.children.length;
const lad = new THREE.Group(); lad.position.set(-3.7, 0, 2.5); room.add(lad);
for (const z of [-0.2, 0.2]) bx(-0.03, 0.03, 0, 2.3, z - 0.03, z + 0.03, beige, lad);
for (let i = 0; i < 8; i++) bx(-0.02, 0.02, 0.25 + i * 0.28, 0.29 + i * 0.28, -0.2, 0.2, beige, lad);
bx(-4.4, -3.4, 0, 0.1, 1.6, 2.2, M(0xb9a98a, 0, 0.9), room);
bx(-4.2, -3.6, 0.1, 0.35, 1.7, 2.1, M(0xf4f4f0, 0, 0.9), room);
for (const [x, z] of [[-4.6, 0.9], [-4.1, 1.2], [-3.4, 0.2]]) cyl(0.13, 0.32, M(0xb8bcc0, 0.8, 0.35), x, 0.16, z, 'y', room, 20);
cyl(0.13, 0.32, M(0x3a4a6a, 0.5, 0.5), -4.8, 0.16, 1.1, 'y', room, 20);
grab('small', _hn);


// ---------- 盤室側（ビデオ2・3より）：配電盤の並び・給気ガラリ・棚 ----------
const panelNames = ['高圧配電盤 GF2/GF1', '補機盤', '電源自動切換盤', '発電機盤', '自動操作盤'];
// ---- 盤面描画ヘルパ ----
// 盤面の座標は、扉 1枚を 512×1256 とした論理座標（正面の写真を、扉ごとに正面へ補正して読み取った位置）。
// 塗装・銘板・ラベル・シールは Canvas（2倍の解像度）に描き、計器・表示灯・集合表示灯・スイッチは 3D の部品にする（rec に登録）。
const PW = 512, PH = 1256, PQ = 2;
let _r0 = 11; const rnd0 = () => { _r0 = (_r0 * 16807) % 2147483647; return _r0 / 2147483647; };
const dyn3 = [];   // 毎フレーム動かす盤面の部品（指針・表示灯・集合表示灯）
const D = {
  rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); },
  text(g, x, y, t, fs = 12, c = '#111', b = '') { g.fillStyle = c; g.font = `${b}${fs}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x, y); },
  // 小さなラベル板（白・黒文字・両端に小ねじ）。中心で指定
  label(g, cx, cy, t, w = 44, h = 11, fs = 7.6) {
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(cx - w / 2 + 0.8, cy - h / 2 + 1, w, h);
    g.fillStyle = '#f6f6f3'; g.fillRect(cx - w / 2, cy - h / 2, w, h); g.strokeStyle = '#9b9b96'; g.lineWidth = 0.5; g.strokeRect(cx - w / 2, cy - h / 2, w, h);
    g.fillStyle = '#8d8f92'; for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * (w / 2 - 3), cy, 1.1, 0, 7); g.fill(); }
    D.text(g, cx, cy + 0.4, t, fs, '#151515');
  },
  name(g, cx, cy, w, h, t) { if (D.rec) D.rec.name.push({ cx, cy, w, h, t }); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(cx - w / 2 + 1, cy - h / 2 + 2, w, h); },
  meter(g, cx, cy, r, unit, nums, get, kind) { if (D.rec) D.rec.meter.push({ cx, cy, r, unit, nums, get, kind }); if (kind) return; g.fillStyle = 'rgba(0,0,0,.25)'; D.rr(g, cx - r - 2, cy - r - 1, 2 * r + 7, 2 * r + 7, 5); g.fill(); },
  relay(g, x, y, w, h, title) { if (D.rec) D.rec.relay.push({ x, y, w, h, title }); },
  knob(g, x, y, t, tag) { if (D.rec) D.rec.knob.push({ x, y, t, tag }); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x - 15, y - 15, 33, 33); },
  pistol(g, x, y, t) { if (D.rec) D.rec.pistol.push({ x, y, t }); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x - 15, y - 15, 33, 33); },
  lamp(g, x, y, c, get, r = 5.5) { if (D.rec) D.rec.lamp.push({ x, y, c, get, r }); },
  matrix(g, x, y, cols, rows, cw, ch, cells, lit) { if (D.rec) D.rec.matrix.push({ x, y, cols, rows, cw, ch, cells, lit }); },
  handle(g, x, y) { if (D.rec) D.rec.handle.push({ x, y }); },
  block(g, x, y, t, red) { if (D.rec) D.rec.block.push({ x, y, t, red }); },
  box(g, x, y, w, h, kind, t) { if (D.rec) D.rec.box.push({ x, y, w, h, kind, t }); },
  // 「危険」シール（白地・橙のひし形に稲妻・注意書き）
  danger(g, x, y, w = 58, h = 68) {
    g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x + 0.6, y + 0.8, w, h); g.fillStyle = '#fbfbf8'; g.fillRect(x, y, w, h); g.strokeStyle = '#b9b9b2'; g.lineWidth = 0.5; g.strokeRect(x, y, w, h);
    g.save(); g.translate(x + w - 13, y + 11); g.rotate(Math.PI / 4); g.fillStyle = '#ee6a12'; g.fillRect(-6.5, -6.5, 13, 13); g.strokeStyle = '#222'; g.lineWidth = 0.6; g.strokeRect(-6.5, -6.5, 13, 13); g.restore();
    g.fillStyle = '#151515'; g.beginPath(); g.moveTo(x + w - 11.5, y + 5.5); g.lineTo(x + w - 15.5, y + 11.5); g.lineTo(x + w - 13, y + 11.5); g.lineTo(x + w - 14.5, y + 16.5); g.lineTo(x + w - 10.2, y + 9.8); g.lineTo(x + w - 12.8, y + 9.8); g.closePath(); g.fill();
    g.fillStyle = '#d5281c'; g.beginPath(); g.moveTo(x + 8, y + 5); g.lineTo(x + 12, y + 9); g.lineTo(x + 8, y + 13); g.lineTo(x + 4, y + 9); g.fill(); D.text(g, x + 22, y + 9.5, '危険', 7, '#151515', 'bold ');
    D.text(g, x + 20, y + 21, '●感電の恐れあり', 4.2, '#222');
    g.fillStyle = '#6f6f6c'; for (let i = 0; i < 9; i++) g.fillRect(x + 5, y + 27 + i * 4.3, (w - 10) * (i % 3 === 2 ? 0.62 : 1), 1.1);
  },
  // 「警告・注意」シール（高圧配電盤：黄の三角と、青丸の指示）
  warn(g, x, y, w = 66, h = 70) {
    g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x + 0.6, y + 0.8, w, h); g.fillStyle = '#fbfbf8'; g.fillRect(x, y, w, h); g.strokeStyle = '#8fa3c8'; g.lineWidth = 0.6; g.strokeRect(x, y, w, h);
    g.fillStyle = '#e7ebf3'; g.fillRect(x + 2, y + 2, w - 4, 8); D.text(g, x + w / 2 + 6, y + 6.3, '警 告', 5.5, '#222', 'bold ');
    g.fillStyle = '#f2c81c'; g.beginPath(); g.moveTo(x + 15, y + 12); g.lineTo(x + 25, y + 29); g.lineTo(x + 5, y + 29); g.closePath(); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 0.8; g.stroke();
    g.fillStyle = '#222'; g.beginPath(); g.moveTo(x + 16.5, y + 16); g.lineTo(x + 12.5, y + 22.5); g.lineTo(x + 15, y + 22.5); g.lineTo(x + 13.5, y + 27.5); g.lineTo(x + 18, y + 20.5); g.lineTo(x + 15.5, y + 20.5); g.closePath(); g.fill();
    D.text(g, x + 44, y + 16, '感電の恐れあり', 4.4, '#222', 'bold '); g.fillStyle = '#777'; g.fillRect(x + 29, y + 21, w - 34, 1); g.fillRect(x + 29, y + 24.5, w - 40, 1);
    g.fillStyle = '#e7ebf3'; g.fillRect(x + 2, y + 32, w - 4, 8); D.text(g, x + w / 2 + 6, y + 36.3, '注 意', 5.5, '#222', 'bold ');
    for (const [k, t] of [[0, '施錠厳守'], [1, '取扱説明書参照']]) { const cx = x + 17 + k * 32; g.fillStyle = '#1c5fb8'; g.beginPath(); g.arc(cx, y + 50, 8.5, 0, 7); g.fill(); g.fillStyle = '#fff'; if (k) { g.fillRect(cx - 4.5, y + 46, 6, 8); g.beginPath(); g.arc(cx + 3.5, y + 47.5, 2, 0, 7); g.fill(); } else { g.fillRect(cx - 4, y + 49.5, 8, 6); g.lineWidth = 1.4; g.strokeStyle = '#fff'; g.beginPath(); g.arc(cx, y + 49, 3, Math.PI, 0); g.stroke(); } D.text(g, cx, y + 63, t, 3.8, '#222'); }
  },
};
const V300 = ['0', '50', '100', '150', '200', '250', '300'], V9000 = ['0', '2000', '4000', '6000', '8000', '9000'], HZ = ['55', '56', '58', '60', '62', '64', '65'], CS = ['.5', '.7', '.9', '1', '.9', '.7', '.5'], KW4 = ['0', '100', '200', '300', '400'];
function panelTex(name, kind) {
  const rec = { meter: [], relay: [], knob: [], handle: [], block: [], push: [], pistol: [], lamp: [], matrix: [], name: [], box: [] };
  const _t = canvasTex(PW * PQ, PH * PQ, (g) => {
    const w = PW, h = PH; g.scale(PQ, PQ); D.rec = rec;
    // 塗装（淡いベージュ系のグレー）。わずかな濃淡と、扉の縁の折り曲げ
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#c6c3b4'); gr.addColorStop(0.5, '#cfccbd'); gr.addColorStop(1, '#c8c5b6'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${i % 2 ? 255 : 60},${i % 2 ? 255 : 60},${i % 2 ? 250 : 50},0.035)`; g.fillRect(rnd0() * w, rnd0() * h, 1.5 + rnd0() * 3, 1 + rnd0() * 2); }
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.2; g.strokeRect(1.6, 1.6, w - 3.2, h - 3.2); g.strokeStyle = 'rgba(70,66,52,.55)'; g.lineWidth = 1.2; g.strokeRect(0.6, 0.6, w - 1.2, h - 1.2);
    const L = D.label.bind(D, g), stop = (x, y) => D.text(g, x, y, '停電時実施', 6.5, '#222');
    if (kind === 0) { // 高圧配電盤 GF2(上)/GF1(下)
      D.name(g, 251, 29, 262, 34, '高圧配電盤GF2');
      D.relay(g, 197, 205, 113, 120, 'ocr:51GF2'); stop(253, 339);
      D.warn(g, 425, 187, 67, 70); D.handle(g, 460, 310);
      D.matrix(g, 230, 350, 2, 1, 24, 25, ['GF2過電流', '']);
      L(143, 357, '電流', 40); D.meter(g, 140, 400, 31, 'A', ['0', '10', '20', '30', '40'], () => 0.3 * S.load);
      D.knob(g, 360, 400, '43RD2', true);
      L(255, 492, 'NO.1CCR変圧器盤', 60, 10, 5.5); D.lamp(g, 238, 510, 'g', () => !S.load); D.lamp(g, 270, 510, 'r', () => !!S.load);
      D.knob(g, 143, 538, 'AS'); D.pistol(g, 255, 540, '3-52GF2'); D.block(g, 343, 518, 'CT2次');
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(193, 587, 126, 30); g.fillStyle = '#1437a6'; g.fillRect(192, 585, 126, 30); D.text(g, 255, 593.5, 'N o 1 C C R', 10.5, '#fff', 'bold '); D.text(g, 255, 606.5, '変圧器盤', 10.5, '#fff', 'bold ');
      g.fillStyle = '#6f6b5c'; g.fillRect(0, 620.5, w, 2.2); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(0, 623, w, 1); g.fillStyle = 'rgba(60,56,44,.35)'; g.fillRect(0, 619.3, w, 1.2);
      D.name(g, 255, 658, 266, 36, '高圧配電盤GF1');
      L(143, 727, '電流', 40); D.meter(g, 143, 770, 31, 'A', ['0', '25', '50', '75'], () => 0.3 * S.load);
      D.matrix(g, 233, 718, 2, 1, 24, 24, ['GF1過電流', '']); D.knob(g, 360, 772, '43RD1', true);
      L(255, 823, '電源切換盤', 46); D.lamp(g, 238, 841, 'g', () => !S.load); D.lamp(g, 272, 841, 'r', () => !!S.load);
      D.knob(g, 143, 870, 'AS'); D.pistol(g, 255, 872, '3-52GF1'); D.block(g, 343, 850, 'CT2次');
      D.warn(g, 430, 815, 65, 70); D.handle(g, 462, 935);
      stop(253, 970); D.relay(g, 200, 982, 112, 118, 'ocr:51GF1');
    } else if (kind === 1) { // 補機盤
      D.name(g, 253, 100, 258, 36, '補　機　盤');
      L(164, 170, 'AC210V負荷', 46, 10, 6); L(346, 170, 'AC105V負荷', 46, 10, 6);
      [['V', ['0', '100', '200', '300'], 0.7, 117], ['A', ['0', '25', '50', '75'], 0.42, 208], ['V', ['0', '50', '100', '150'], 0.7, 298], ['A', ['0', '10', '20', '30'], 0.55, 390]].forEach(([u, n, a, x]) => { L(x, 197, u === 'V' ? '電圧' : '電流', 40); D.meter(g, x, 238, 31, u, n, () => a * S.load); });
      D.matrix(g, 200, 356, 5, 2, 21.2, 20.5, ['LBS用ヒューズ断', '210V主幹MCCB断', '105V主幹MCCB断', '補機回路過電流', '送風機異常', '30kVA変圧器温度上昇', '210V分岐MCCB断', '105V分岐MCCB断', '補機回路漏電', '']);
      ['VS', 'AS', 'VS', 'AS'].forEach((t, i) => D.knob(g, 135 + i * 78.3, 545, t));
      ['43F', '43Q', '43WP', '43WH'].forEach((t, i) => D.knob(g, 135 + i * 78.3, 628, t, true)); ['43EF', '43S3', '43S2'].forEach((t, i) => D.knob(g, 135 + i * 78.3, 710, t, true));
      D.danger(g, 432, 510, 58, 68); D.handle(g, 458, 632);
      D.relay(g, 222, 990, 60, 110, 'elr:ELR');
    } else if (kind === 2) { // 電源自動切換盤
      D.name(g, 255, 99, 260, 38, '電源自動切換盤');
      [['電圧', 'V', V9000, 0.73, 146], ['電力', 'kW', KW4, 0.38, 256], ['電流', 'A', ['0', '10', '20', '30', '40'], 0.3, 365]].forEach(([l, u, n, a, x]) => { L(x, 195, l, 40); D.meter(g, x, 237, 31, u, n, () => a * S.load); });
      L(146, 280, '周波数', 40); D.meter(g, 146, 320, 31, 'Hz', HZ, () => S.mains ? 0.5 : S.brk ? S.hzAng : 0); L(365, 280, '力率', 40); D.meter(g, 365, 320, 31, 'cosφ', CS, () => S.load ? 0.55 : 0.5);
      D.knob(g, 146, 540, 'VS'); D.knob(g, 363, 540, 'AS'); D.danger(g, 428, 507, 60, 70);
      L(238, 578, '83C', 22, 9, 6); L(272, 578, '83B', 22, 9, 6); D.lamp(g, 238, 594, 'r', () => S.mains && !S.brk); D.lamp(g, 270, 594, 'r', () => S.brk);
      D.pistol(g, 253, 622, '3-83BC'); D.handle(g, 455, 630);
      [[134, 838, '27R1'], [264, 838, '27R2'], [132, 981, '27RR1'], [264, 981, '27RR2']].forEach(([x, y, t]) => { stop(x + 54, y - 11); D.relay(g, x, y, 108, 119, (t.startsWith('27RR') ? 'ovr:' : 'uvr:') + t); });
      D.block(g, 163, 1165, 'VT2次', true); D.block(g, 293, 1165, 'CT2次');
    } else if (kind === 3) { // 発電機盤
      D.name(g, 259, 102, 262, 35, '発　電　機　盤');
      L(203, 172, 'VT2次', 40, 10, 6.5); L(368, 172, 'EVT2次', 44, 10, 6.5);
      [[147, 'V', V300, () => S.vAng, '電圧'], [257, 'A', ['0', '200', '400', '600', '800', '1000', '1200'], () => S.aAng, '電流'], [368, 'V', V9000, () => S.evtAng, '電圧']].forEach(([x, u, n, a, l]) => { L(x, 200, l, 40); D.meter(g, x, 242, 31, u, n, a); });
      [[147, 'Hz', HZ, () => S.hzAng, '周波数'], [257, 'kW', KW4, () => S.kwAng, '電力'], [368, 'cosφ', CS, () => S.cosAng, '力率']].forEach(([x, u, n, a, l]) => { L(x, 283, l, 40); D.meter(g, x, 325, 31, u, n, a); });
      L(146, 367, '運転時間', 40); D.meter(g, 146, 406, 29, 'h', [], 0, 'hour');
      L(256, 367, '電力量', 40); D.box(g, 225, 380, 62, 102, 'kwh');
      L(366, 367, '零相電圧', 40); D.meter(g, 366, 410, 31, 'V', ['0', '2000', '4000', '6000', '7000'], 0.02);
      L(146, 447, '運転度数', 40); D.box(g, 116, 460, 60, 25, 'count', '00983');
      ['R', 'S', 'T'].forEach((t, i) => { L(342 + i * 23, 453, t, 13, 9, 6.5); D.lamp(g, 342 + i * 23, 468, 'w', 0, 4); });
      D.knob(g, 146, 545, 'VS'); D.knob(g, 255, 545, 'AS'); D.knob(g, 366, 545, 'VS'); D.danger(g, 432, 513, 58, 67);
      L(253, 583, '発電機遮断器', 52, 10, 6); D.lamp(g, 237, 600, 'g', () => !S.brk); D.lamp(g, 270, 600, 'r', () => S.brk);
      D.meter(g, 137, 653, 46, '℃', [], 0.35, 'gauge'); D.box(g, 346, 610, 36, 36, 'vr'); D.handle(g, 460, 632);
      D.relay(g, 137, 842, 108, 118, 'ocr:51G'); D.relay(g, 266, 844, 108, 118, 'ovr:59G'); D.relay(g, 290, 993, 58, 107, 'lvg:64G');
      // 定格銘板（製造者・形式・製造番号は書かない）
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(377, 1098.5, 102, 55); g.fillStyle = '#f4f4f0'; g.fillRect(376, 1097, 102, 55); g.strokeStyle = '#8a8a84'; g.lineWidth = 0.6; g.strokeRect(376, 1097, 102, 55);
      D.text(g, 412, 1104, '自家発電装置', 6.5, '#151515', 'bold '); g.strokeStyle = '#555'; g.lineWidth = 0.4; g.strokeRect(445, 1100, 28, 8); D.text(g, 459, 1104.3, '（例）', 5, '#222');
      [['出力', '300kVA'], ['電圧', '210V'], ['周波数', '60Hz'], ['力率', '0.8'], ['相数', '3'], ['区分', '長時間形']].forEach(([a, b], i) => { g.textAlign = 'left'; g.font = '4.6px sans-serif'; g.fillStyle = '#222'; g.fillText(a, 380 + (i % 2) * 36, 1115 + (i >> 1) * 7.5); g.fillText(b, 400 + (i % 2) * 34, 1115 + (i >> 1) * 7.5); });
      D.text(g, 427, 1146, '数値は教材用の目安（架空）', 4.4, '#444');
      g.fillStyle = '#c9a43a'; g.beginPath(); g.arc(461, 1124, 9, 0, 7); g.fill(); g.fillStyle = '#3a2f10'; g.beginPath(); g.arc(461, 1124, 6.5, 0, 7); g.fill(); g.fillStyle = '#d8b84e'; g.fillRect(455.5, 1122, 11, 4);
      ['VT2次', 'CT2次', 'EVT2次', 'EVT3次'].forEach((t, i) => D.block(g, 115 + i * 77.3, 1167, t, i !== 1));
    } else { // 自動操作盤
      D.name(g, 258, 100, 260, 36, '自動操作盤');
      L(200, 194, '界磁電圧', 40); D.meter(g, 202, 236, 32, 'V', ['0', '10', '20', '30', '40', '50'], () => 0.6 * S.volt); L(310, 194, '界磁電流', 40); D.meter(g, 310, 236, 32, 'A', ['0', '2', '4', '6', '8', '10'], () => 0.5 * S.volt);
      L(255, 330, '状態表示', 40); D.matrix(g, 202, 350, 5, 2, 20.8, 20, ['制御電源', '自動', '試験', '商用電源受電中', '発電装置運転中', '', '手動', '試験始動', '商用電力側', '発電電源側'], () => [0, 1, ...(S.mains ? [3] : []), ...(S.rpm > 600 ? [4] : []), S.brk ? 9 : 8]);
      L(255, 410, '故障表示', 40); D.matrix(g, 173, 428, 8, 3, 20.6, 19, ['過電流', '過電圧', '過速度', '自然停止', '', '燃料油面異常', '自動充電装置異常', '変圧器温度上昇', '水温過昇', '電圧低下', '始動渋滞', '非常停止', '', '地絡過電圧', '保温装置異常', '', '', '制御電源故障', '油圧低下', '励磁装置故障', '', '注油圧力不足', '', '']);
      // 手順書（掲示）。文面は読めない細かさの線で表す
      g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(359, 311.5, 139, 163); g.fillStyle = '#fbfbf9'; g.fillRect(358, 310, 139, 163); g.strokeStyle = '#c9c9c4'; g.lineWidth = 0.5; g.strokeRect(358, 310, 139, 163);
      D.text(g, 427, 319, '予備自家発電設備　停止・起動準備手順', 5.4, '#222');
      D.text(g, 372, 329, '停止操作', 4.6, '#c22'); D.text(g, 372, 399, '起動準備', 4.6, '#c22');
      for (let i = 0; i < 34; i++) { const y = 335 + i * 3.9 + (i > 15 ? 8 : 0), red = i < 5 || (i > 15 && i < 20); g.fillStyle = red ? '#cf4038' : '#5a5a5a'; g.fillRect(366 + (red ? 0 : 6), y, (124 - (red ? 0 : 6)) * (0.62 + ((i * 37) % 38) / 100), 0.9); if (!red) { g.fillStyle = '#777'; g.fillRect(363, y, 2, 0.9); } }
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(358, 310, 139, 5);
      // 「43E 常に自動」の札
      g.fillStyle = '#fff'; g.strokeStyle = '#d33'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(225, 487); g.lineTo(280, 487); g.lineTo(280, 510); g.lineTo(257, 510); g.lineTo(252, 515); g.lineTo(247, 510); g.lineTo(225, 510); g.closePath(); g.fill(); g.stroke();
      D.text(g, 252.5, 493.5, '4 3 E', 6.5, '#d22'); D.text(g, 252.5, 503.5, '常に自動', 6.5, '#d22'); D.knob(g, 252, 534, '43E', true);
      L(145, 585, '試験時操作', 50); L(255, 585, '故障時操作', 50); L(365, 585, '非常停止', 46);
      ['試験停止', '試験始動', '警報停止', '故障復帰', '試験点灯'].forEach((t, i) => { const x = [126, 165, 215, 255, 292][i]; L(x, 601, t, 24, 7, 4.6); rec.push.push({ x, y: 618, r: 10.5, c: 0x15171a }); });
      rec.push.push({ x: 367, y: 618, r: 12.5, c: 0xd01010, estop: true });
      D.danger(g, 432, 500, 58, 70); D.handle(g, 458, 620); D.box(g, 448, 688, 32, 142, 'tag');
    }
  });
  D.rec = null; _t.userData.rec = rec; _t.anisotropy = 8;
  return _t;
}
// ================= 盤面の3D部品（継電器・計器・スイッチ・端子ブロック） =================
const KM = 0.93 / 512;

const glassM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0, depthWrite: false });
function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
const ext = (shape, depth, m, bevel = 0.003) => { const o = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2 }), m); o.castShadow = true; return o; };
function dialMark(g, cx, cy, R, vals, a0 = 225, a1 = -45, fs = 15) {
  g.strokeStyle = '#111'; g.lineWidth = 4;
  for (let i = 0; i < 24; i++) { const a = (a0 + (a1 - a0 - 0) * i / 23) * Math.PI / 180; g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 12), cy - Math.sin(a) * (R - 12)); g.lineTo(cx + Math.cos(a) * (R - 3), cy - Math.sin(a) * (R - 3)); g.stroke(); }
  g.fillStyle = '#111'; g.font = `${fs}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  vals.forEach((v, i) => { const a = (a0 + (a1 - a0) * i / (vals.length - 1)) * Math.PI / 180; g.fillText(String(v), cx + Math.cos(a) * (R + 14), cy - Math.sin(a) * (R + 14)); });
}
const photoTex = {};
function relayFace(type, tag) {
  const pk = type === 'ovr' ? (tag === '59G' ? 'ovr59' : 'ovr27') : type, ph = pk && RELAY_PHOTO[pk];
  if (ph) { const t = photoTex[pk] || (photoTex[pk] = (() => { const x = new THREE.TextureLoader().load(ph.uri); x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = 4; return x; })()); return { tex: t, W: ph.w, H: ph.h, dials: [], vert: type === 'lvg', ex: [], aspect: ph.w / ph.h }; }
  const vert = type === 'elr' || type === 'lvg', W = vert ? 280 : 400, H = vert ? 440 : 500, dials = [];
  const Q = 2, ex = [];
  const tex = canvasTex(W * Q, H * Q, (g) => {
    const w = W, h = H; g.scale(Q, Q);
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e3e4e5'); gr.addColorStop(1, '#c4c6c9'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(255,255,255,${0.05 + (y % 9) * 0.01})`; g.fillRect(0, y, w, 1); }
    g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const T = (x, y, t, fs = 16, b) => { g.font = `${b ? 'bold ' : ''}${fs}px sans-serif`; g.fillText(t, x, y); };
    const yel = (x, y, t) => { g.fillStyle = '#ead84a'; g.fillRect(x, y, 78, 20); g.fillStyle = '#111'; T(x + 39, y + 11, t, 14); };
    const screw = (x, y) => { g.fillStyle = '#9a9ca0'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.strokeStyle = '#444'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 5, y - 2); g.lineTo(x + 5, y + 2); g.stroke(); };
    if (type === 'ocr') {
      T(115, 24, '限時電流整定(A)', 16); dialMark(g, 115, 100, 46, ['3', '3.5', '4', '4.5', '5', '6']); dials.push([115 / 400, 100 / 500, 0.7]);
      T(285, 24, '瞬時電流整定(A)', 16); dialMark(g, 285, 100, 46, ['20', '30', '40', '50', '60', '除外']); dials.push([285 / 400, 100 / 500, 2.3]);
      T(115, 172, '限時時間整定', 16); dialMark(g, 115, 255, 52, ['0.25', '0.5', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], 240, -60, 13); dials.push([115 / 400, 255 / 500, 1.6]);
      T(300, 172, '経過時間', 13); T(240, 188, '始動', 11); T(298, 188, '40', 11); T(358, 188, '80%', 11);
      g.fillStyle = '#8fb83a'; for (let i = 0; i < 3; i++) g.fillRect(232 + i * 58, 196, 40, 9);
      g.strokeStyle = '#222'; g.lineWidth = 1.5; g.strokeRect(228, 232, 150, 100); for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(228, 232 + i * 20); g.lineTo(378, 232 + i * 20); g.stroke(); }
      g.lineWidth = 2.5; g.beginPath(); g.moveTo(232, 240); g.bezierCurveTo(250, 290, 290, 318, 376, 328); g.stroke(); T(300, 345, '動作時間(No.1)', 12);
      T(110, 385, '継電器', 22, true); yel(160, 372, tag); T(120, 418, '高圧受電用過電流継電器', 15); T(300, 418, '形式 OCR-A', 20, true);
      T(75, 445, '定格 5A,6VA 50/60Hz', 11); T(75, 462, '表示器 整定値以下', 11); g.strokeStyle = '#444'; g.strokeRect(290, 436, 90, 18); T(335, 445, '製造年 2017', 11);
      g.fillStyle = '#17181a'; for (let i = 0; i < 3; i++) { g.fillRect(70 + i * 90, 468, 74, 26); g.fillStyle = '#9a9ca0'; g.fillRect(74 + i * 90, 472, 66, 18); g.fillStyle = '#17181a'; }
      T(105, 462, '瞬時', 9); T(200, 462, 'R相 ートリップー T相', 9); screw(24, 480); screw(376, 480);
    } else if (type === 'uvr' || type === 'ovr') {
      const u = type === 'uvr'; T(105, 24, u ? '不定電圧整定(V)'.replace('不定', '不足') : '過電圧整定(V)', 16);
      dialMark(g, 105, 105, 46, u ? ['70', '75', '80', '85', '90', '95', '100', '105'] : ['85', '90', '95', '100', '105', '110', '115'], 225, -45, 13); dials.push([105 / 400, 105 / 500, 1.2]);
      T(105, 180, '動作時間整定(秒)', 15); dialMark(g, 105, 265, 48, ['即時', '0.2', '0.4', '0.6', '0.8', '1.0', '1.2', '1.4', '1.6', '1.8', '2.0'], 240, -60, 12); dials.push([105 / 400, 265 / 500, 0.9]);
      T(320, 150, '動作', 14); g.fillStyle = '#e89a2c'; g.fillRect(308, 165, 24, 10); g.strokeStyle = '#333'; g.strokeRect(308, 165, 24, 10);
      T(320, 235, '試験スイッチ', 13); g.fillStyle = '#44464a'; g.beginPath(); g.arc(320, 262, 11, 0, 7); g.fill(); g.fillStyle = '#b8babd'; g.beginPath(); g.arc(320, 262, 6, 0, 7); g.fill();
      T(70, 370, '継電器', 20, true); T(210, 372, u ? '不足電圧継電器' : '過電圧継電器', 16); T(250, 398, u ? '形式 UVR-A' : '形式 OVR-A', 18, true); yel(300, 332, tag);
      g.strokeStyle = '#444'; g.strokeRect(40, 415, 320, 50); [['定格電圧', '110VAC'], ['定格周波数', '50/60Hz'], ['定格制御電圧', '24VDC'], ['定格消費VA', '8VA']].forEach(([a, b], i) => { T(86 + (i % 2) * 190, 428 + Math.floor(i / 2) * 22, a + ' ' + b, 11); });
      screw(24, 480); screw(376, 480);
    } else if (type === 'lvg') {
      T(w / 2, 24, '地絡過電圧継電器', 18, true); T(w / 2, 64, '整定電圧(%)', 14); dialMark(g, w / 2, 125, 42, ['2.5', '5', '7.5', '10', '15'], 225, -45, 12); dials.push([0.5, 125 / 440, 1.0]);
      T(w / 2, 202, '動作時間(秒)', 14); dialMark(g, w / 2, 265, 42, ['0.05', '0.2', '0.5', '1.0'], 225, -45, 12); dials.push([0.5, 265 / 440, 0.4]);
      T(60, 345, '電源', 12); g.fillStyle = '#3c3'; g.beginPath(); g.arc(60, 366, 9, 0, 7); g.fill(); T(w - 60, 345, '動作', 12); g.fillStyle = '#d22'; g.beginPath(); g.arc(w - 60, 366, 9, 0, 7); g.fill();
      yel(w / 2 - 39, 395, tag); T(w / 2, 425, '形式 OVG-A', 12);
    } else {
      T(w / 2, 22, '漏電リレー', 17, true); T(80, 52, '感度整定値', 12); dialMark(g, 150, 95, 36, ['0.1', '0.2', '0.4', '0.6', '0.8'], 200, -20, 11); dials.push([150 / 280, 95 / 440, 1.3]); T(210, 62, '(A)', 11);
      g.strokeStyle = '#333'; g.lineWidth = 1; g.strokeRect(20, 150, 240, 120); ['形式 ELR-A', '定格 AC100/110V 50/60Hz', '感度電流 0.1/0.2/0.4/0.6/0.8A', '動作時間 0.1s以下', '製造 1999年'].forEach((t, i) => { g.font = '10px sans-serif'; g.textAlign = 'left'; g.fillStyle = '#111'; g.fillText(t, 28, 166 + i * 21); }); g.textAlign = 'center';
      T(60, 300, '試験', 12); g.fillStyle = '#d22'; g.beginPath(); g.arc(60, 330, 14, 0, 7); g.fill(); T(125, 300, '復帰', 12); g.fillStyle = '#222'; g.beginPath(); g.arc(125, 330, 14, 0, 7); g.fill(); T(205, 300, '動作表示', 11); g.fillStyle = '#d22'; g.beginPath(); g.arc(205, 330, 6, 0, 7); g.fill();
      yel(w / 2 - 39, 385, 'ELR');
    }
  });
  if (type === 'uvr' || type === 'ovr') ex.push({ k: 'btn', u: 320 / 400, v: 262 / 500 }, { k: 'led', u: 320 / 400, v: 170 / 500, c: 0xffa030 });
  if (type === 'elr') ex.push({ k: 'btn', u: 60 / 280, v: 330 / 440, c: 0xd22222 }, { k: 'btn', u: 125 / 280, v: 330 / 440, c: 0x222222 }, { k: 'led', u: 205 / 280, v: 330 / 440, c: 0xff3030 });
  if (type === 'lvg') ex.push({ k: 'led', u: 60 / 280, v: 366 / 440, c: 0x40e040 }, { k: 'led', u: 220 / 280, v: 366 / 440, c: 0xff3030 });
  return { tex, W, H, dials, vert, ex };
}
const gearShape = (() => { const sh = new THREE.Shape(), n = 40; for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n, r = 0.0088 + (i % 2 ? 0.0006 : -0.0003); const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? sh.lineTo(x, y) : sh.moveTo(x, y); } sh.closePath(); return sh; })();
const streakTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0.15, 'rgba(255,255,255,0)'); gr.addColorStop(0.32, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.08)'); gr.addColorStop(0.62, 'rgba(255,255,255,0.3)'); gr.addColorStop(0.75, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
function relay3D(type, tag) {
  const f = relayFace(type, tag), g3 = new THREE.Group();
  const bw = f.vert ? 0.115 : 0.2, bh = f.vert ? 0.215 : 0.236; let fw = bw - 0.075, fh = bh - 0.105;
  if (f.aspect) { if (f.vert) { fh = 0.15; fw = fh * f.aspect; } else { fw = 0.135; fh = fw / f.aspect; } }
  g3.add(ext(rrShape(bw, bh, 0.014), 0.02, blkG));
  const st = ext(rrShape(bw - 0.03, bh - 0.04, 0.01), 0.012, blkG); st.position.z = 0.022; g3.add(st);
  const rec = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.058, bh - 0.08, 0.004), M(0x050506, 0.2, 0.9)); rec.position.z = 0.036; g3.add(rec);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshStandardMaterial({ map: f.tex, roughness: f.aspect ? 0.35 : 0.4, metalness: f.aspect ? 0 : 0.5 })); face.position.set(0, 0.006, 0.039); g3.add(face);
  f.dials.forEach(([u, v, ang]) => {
    const d = new THREE.Group(); d.position.set((u - 0.5) * fw, (0.5 - v) * fh + 0.006, 0.04); d.rotation.z = -ang; g3.add(d);
    const kn = ext(gearShape, 0.012, blkG, 0.0004); kn.position.z = 0.0; d.add(kn);
    const rg = new THREE.Mesh(new THREE.TorusGeometry(0.0125, 0.0012, 6, 36), M(0x1b1c1f, 0.3, 0.5)); rg.position.z = 0.001; d.add(rg);
    const tp = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.002, 24), M(0xcdd0d4, 0.9, 0.25)); tp.rotation.x = Math.PI / 2; tp.position.z = 0.0125; d.add(tp);
    const pt = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.009, 0.003), M(0xf4f4f4, 0, 0.4)); pt.position.set(0, 0.0035, 0.0132); d.add(pt);
  });
  f.ex.forEach(e => {
    const p = new THREE.Vector3((e.u - 0.5) * fw, (0.5 - e.v) * fh + 0.006, 0.04);
    if (e.k === 'btn') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0058, 0.006, 18), e.c ? M(e.c, 0.3, 0.4) : chrome); b.rotation.x = Math.PI / 2; b.position.copy(p); b.position.z += 0.003; g3.add(b); }
    else { const l = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: e.c, emissive: e.c, emissiveIntensity: 0.12, roughness: 0.3 })); l.rotation.x = Math.PI / 2; l.position.copy(p); g3.add(l); }
  });
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(bw - 0.058, bh - 0.08), glassM); gl.position.z = 0.058; g3.add(gl);
  const stk = new THREE.Mesh(new THREE.PlaneGeometry(bw - 0.058, bh - 0.08), new THREE.MeshBasicMaterial({ map: streakTex, transparent: true, opacity: 0.35, depthWrite: false })); stk.position.z = 0.0585; g3.add(stk);
  const hood = ext(rrShape(bw - 0.036, bh - 0.05, 0.008), 0.022, M(0x0a0b0d, 0.2, 0.4), 0.002); hood.scale.set(1, 1, 1); hood.position.z = 0.036; hood.visible = false; g3.add(hood);
  const lug = ext(rrShape(0.05, 0.03, 0.008), 0.016, blkG, 0.002); lug.position.set(0, -bh / 2 - 0.006, 0.0); g3.add(lug);
  const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.01, 18), chrome); sc.rotation.x = Math.PI / 2; sc.position.set(0, -bh / 2 - 0.006, 0.02); g3.add(sc);
  { const xs = f.vert ? [-0.036, -0.012, 0.012, 0.036] : [-0.06, -0.02, 0.02, 0.06]; g3.userData.ports = xs.map(x => new THREE.Vector3(x, -bh / 2 - 0.006, 0.03));
    xs.forEach(x => { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.022, 10), chrome); st.rotation.x = Math.PI / 2; st.position.set(x, -bh / 2 - 0.006, 0.02); g3.add(st); const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.006, 12), M(0xc9a24a, 0.8, 0.35)); hd.rotation.x = Math.PI / 2; hd.position.set(x, -bh / 2 - 0.006, 0.033); g3.add(hd); }); }
  g3.userData.size = [bw, bh]; return g3;
}
function blockFace(t, red) {
  return canvasTex(160, 140, (g, w, h) => {
    g.fillStyle = '#14161a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2f2f0'; g.fillRect(14, 12, 132, 34); g.fillStyle = '#111'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 80, 30);
    g.fillStyle = '#35373b'; g.fillRect(14, 56, 132, 46); g.fillStyle = '#aaa'; for (let i = 0; i < 4; i++) g.fillRect(24 + i * 30, 62, 18, 12);
    if (red) { g.fillStyle = '#d11'; g.fillRect(14, 110, 132, 22); g.fillStyle = '#fff'; g.font = 'bold 18px sans-serif'; g.fillText('PT', 80, 122); } else { g.fillStyle = '#ddd'; g.font = 'bold 20px sans-serif'; g.fillText('CT', 80, 122); }
  });
}
const termTex = {};
function termMap(t) { const k = t.startsWith('EVT3') ? 'evt3' : t.startsWith('EVT') ? 'evt2' : t.startsWith('VT') ? 'vt' : t.startsWith('CT') ? 'ct' : null; if (!k) return null; return termTex[k] || (termTex[k] = (() => { const x = new THREE.TextureLoader().load(TERM_PHOTO[k].uri); x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = 4; return x; })()); }
function block3D(t, red) {
  const g3 = new THREE.Group();
  g3.add(ext(rrShape(0.085, 0.075, 0.006), 0.022, blkG, 0.002));
  const tm = termMap(t);
  const fc = new THREE.Mesh(new THREE.PlaneGeometry(tm ? 0.084 : 0.07, tm ? 0.082 : 0.062), new THREE.MeshStandardMaterial({ map: tm || blockFace(t, red), roughness: 0.4 })); fc.position.z = 0.0245; g3.add(fc);
  const cv = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.016), new THREE.MeshPhysicalMaterial({ color: 0xcfe0e8, transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false })); cv.position.set(0, -0.002, 0.03); cv.rotation.x = -0.25; g3.add(cv);
  return g3;
}
const pChrome = M(0xe4e7ea, 0.55, 0.26);
const starShape = (() => { const s = new THREE.Shape(); const n = 12; for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n, r = i % 2 ? 0.0165 : 0.0215; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); } s.closePath(); return s; })();
const zc = (r1, r2, len, m, z, seg = 24) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, seg), m); o.rotation.x = Math.PI / 2; o.position.z = z; return o; };
// 切換スイッチの座金（銀色の角板。上に位置の刻印、四隅にねじ）
const escTex = {};
function escFace(t, pistol) {
  const k = (pistol ? 'p' : 'k') + (t || ''); return escTex[k] || (escTex[k] = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#d9dcdf'); gr.addColorStop(0.5, '#b4b8bc'); gr.addColorStop(1, '#cfd2d5'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(255,255,255,${0.04 + (y % 6) * 0.012})`; g.fillRect(0, y, w, 1); }
    g.strokeStyle = '#6d7175'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    g.fillStyle = '#17181a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 13px sans-serif';
    const P = pistol ? ['切', '', '入'] : t === 'VS' ? ['R-S', 'S-T', 'T-R'] : t === 'AS' ? ['R', 'S', 'T'] : ['手動', '', '自動'];
    P.forEach((s, i) => { const a = (-140 + i * 50) * Math.PI / 180; if (s) g.fillText(s, 64 + Math.cos(a) * 49, 66 + Math.sin(a) * 49 + (i === 1 ? 3 : 8)); g.fillRect(64 + Math.cos(a) * 36 - 1.5, 64 + Math.sin(a) * 36 - 1.5, 3, 3); });
    if (t && t.length > 2) { g.font = 'bold 12px sans-serif'; g.fillText(t, 64, 116); }
    g.fillStyle = '#7b7f84'; for (const [x, y] of [[11, 11], [117, 11], [11, 117], [117, 117]]) { g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); g.fillStyle = '#3d4044'; g.fillRect(x - 3.5, y - 0.7, 7, 1.4); g.fillStyle = '#7b7f84'; }
  }));
}
const tagTri = (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.011, 0.004); s.lineTo(0.004, 0.011); s.closePath(); return new THREE.ShapeGeometry(s); })();
const redTagM = new THREE.MeshStandardMaterial({ color: 0xe02020, roughness: 0.5, side: THREE.DoubleSide });
function escPlate(g3, t, pistol, tag) {
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.003), [silv, silv, silv, silv, new THREE.MeshStandardMaterial({ map: escFace(t, pistol), metalness: 0.55, roughness: 0.38 }), silv]); p.position.z = 0.0015; p.castShadow = true; g3.add(p);
  if (tag) { const tr = new THREE.Mesh(tagTri, redTagM); tr.position.set(0.026, 0.026, 0.0005); g3.add(tr); }
}
function knob3D(t, tag) {
  const g3 = new THREE.Group(), k = new THREE.Group(); escPlate(g3, t, false, tag); g3.add(k); g3.userData.knob = k;
  k.add(zc(0.012, 0.0145, 0.012, blkG, 0.009, 20));
  const kb = ext(starShape, 0.016, blkG, 0.002); kb.position.z = 0.016; k.add(kb);
  const ptr = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.016, 0.0012), M(0xf2f2f2, 0, 0.5)); ptr.position.set(0, 0.011, 0.0345); k.add(ptr);
  return g3;
}
// ひねりハンドル形の操作スイッチ（遮断器の入・切）
function pistol3D(t) {
  const g3 = new THREE.Group(); escPlate(g3, t, true);
  g3.add(zc(0.0135, 0.015, 0.016, blkG, 0.011, 20));
  const grip = ext(rrShape(0.017, 0.058, 0.007), 0.017, blkG, 0.002); grip.position.set(0, -0.021, 0.019); g3.add(grip);
  const ln = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.03, 0.001), M(0xf2f2f2, 0, 0.5)); ln.position.set(0, -0.03, 0.0385); g3.add(ln);
  return g3;
}
function handle3D() {
  const g3 = new THREE.Group();
  g3.add(zc(0.021, 0.023, 0.012, pChrome, 0.006, 28)); g3.add(zc(0.012, 0.012, 0.022, pChrome, 0.02, 20));
  const arm = ext(rrShape(0.024, 0.118, 0.011), 0.015, pChrome, 0.003); arm.position.set(0, -0.046, 0.024); g3.add(arm);
  const key = zc(0.0065, 0.0065, 0.004, M(0x8f9396, 0.9, 0.35), 0.044, 16); g3.add(key);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.008, 0.001), M(0x222325, 0.5, 0.5)); slot.position.z = 0.0462; g3.add(slot);
  return g3;
}
// 計器の文字盤（広角形。目盛りは数値に比例させる）
const MA0 = Math.PI * 0.8, MA1 = Math.PI * 2.2, faceTex = {};
function pnlMeterFace(m) {
  const key = (m.kind || '') + m.unit + '|' + m.nums.join(','); if (faceTex[key]) return faceTex[key];
  const t = canvasTex(256, 256, (g, w, h) => {
    const c = 128, R = 126, T = (x, y, s, fs, col = '#111', b = 'bold ') => { g.fillStyle = col; g.font = `${b}${fs}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y); };
    const ray = (a, r0, r1, lw, col = '#111') => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); g.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); g.stroke(); };
    if (m.kind === 'gauge') {   // 黒い丸形の指示計（温度計を想定。目安）
      g.fillStyle = '#0c0d0f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8e8e4'; g.lineWidth = 2; g.beginPath(); g.arc(c, c, 100, MA0, MA1); g.stroke();
      for (let i = 0; i <= 50; i++) { const a = MA0 + (MA1 - MA0) * i / 50; ray(a, 100, i % 5 ? 92 : 84, i % 5 ? 1.5 : 3, '#e8e8e4'); }
      ['0', '20', '40', '60', '80', '100'].forEach((s, i) => { const a = MA0 + (MA1 - MA0) * i / 5; T(c + Math.cos(a) * 68, c + Math.sin(a) * 68, s, 17, '#e8e8e4'); });
      T(c, c + 50, '℃', 22, '#e8e8e4'); T(c, c + 76, '（目安）', 12, '#9a9a96', ''); return;
    }
    const gr = g.createRadialGradient(c - 30, c - 40, 20, c, c, R); gr.addColorStop(0, '#fbfbf7'); gr.addColorStop(1, '#e9e9e3'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (m.kind === 'hour') {    // 時間計（丸形・数字車）
      T(c, 58, '稼働時間計', 21); g.fillStyle = '#17181a'; g.fillRect(48, 86, 160, 40); g.fillStyle = '#f2f2ee'; for (let i = 0; i < 5; i++) { g.fillRect(52 + i * 31, 90, 28, 32); }
      g.fillStyle = '#d43a2a'; g.fillRect(52 + 4 * 31, 90, 28, 32); '00527'.split('').forEach((s, i) => T(66 + i * 31, 107, s, 26, i === 4 ? '#fff' : '#111')); T(222, 107, 'h', 18);
      T(c, 152, 'AC 100V  60Hz', 14, '#333', ''); T(c, 176, '（数値は架空）', 13, '#555', ''); g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.arc(c, c, 118, 0, 7); g.stroke(); return;
    }
    const v = m.nums.map(Number), num = v.every(x => !isNaN(x)) && m.unit !== 'cosφ', lo = v[0], hi = v[v.length - 1];
    const fr = i => num ? (v[i] - lo) / (hi - lo) : i / (v.length - 1), A = f => MA0 + (MA1 - MA0) * f;
    g.strokeStyle = '#111'; g.lineWidth = 2.5; g.beginPath(); g.arc(c, c, 96, MA0, MA1); g.stroke();
    for (let i = 0; i < v.length; i++) {
      ray(A(fr(i)), 96, 114, 4);
      if (i < v.length - 1) { const d = fr(i + 1) - fr(i), n = d < 0.09 ? 2 : d < 0.14 ? 4 : 5; for (let j = 1; j < n; j++) ray(A(fr(i) + d * j / n), 96, n === 4 && j === 2 ? 110 : 106, 1.8); }
      const s = m.nums[i], fs = s.length > 3 ? 17 : s.length > 2 ? 20 : 23, rr = s.length > 3 ? 66 : 72; T(c + Math.cos(A(fr(i))) * rr, c + Math.sin(A(fr(i))) * rr + 1, s, fs);
    }
    if (m.unit === 'Hz') { ray(A(0.5), 116, 124, 5, '#d22'); }
    if (m.unit === 'kW' || m.unit === 'cosφ') { g.fillStyle = '#d22'; const a = A(m.unit === 'kW' ? 0.6 : 0.72); g.beginPath(); g.arc(c + Math.cos(a) * 119, c + Math.sin(a) * 119, 4.5, 0, 7); g.fill(); }
    if (m.unit === 'cosφ') { T(c - 62, c - 8, 'LEAD', 12, '#222'); T(c + 62, c - 8, 'LAG', 12, '#222'); }
    T(c, c + 64, m.unit, m.unit.length > 2 ? 24 : 30); g.fillStyle = '#777'; g.fillRect(c - 34, c + 88, 68, 2); g.fillRect(c - 24, c + 95, 48, 2); T(c + 0, c + 108, '1.5級', 10, '#555', '');
  });
  t.anisotropy = 8; return faceTex[key] = t;
}
const needleM = M(0x0c0c0d, 0.2, 0.5), hubM = M(0xf3f3f0, 0.1, 0.35), faceRing = M(0x08090a, 0.3, 0.5);
function meter3D(m) {
  const g3 = new THREE.Group(), R = m.r * KM, round = !!m.kind, S2 = R + 0.007;
  const mk = (white) => {   // 指針：軸のまわりで回す
    const nd = new THREE.Group(); nd.position.z = 0.012; g3.add(nd);
    const b = new THREE.Mesh(new THREE.BoxGeometry(R * 1.02, R * 0.04, 0.0012), white ? M(0xf0f0ec, 0, 0.5) : needleM); b.position.x = R * 0.33; nd.add(b);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(R * 0.2, R * 0.018, 0.0012), white ? M(0xd22020, 0, 0.5) : needleM); tip.position.x = R * 0.93; nd.add(tip);
    return nd;
  };
  if (m.kind === 'gauge') {
    g3.add(zc(R, R, 0.03, blkG, 0.015, 48)); const rim = new THREE.Mesh(new THREE.TorusGeometry(R - 0.006, 0.006, 12, 56), blkG); rim.position.z = 0.03; g3.add(rim);
    const f = new THREE.Mesh(new THREE.CircleGeometry(R - 0.008, 48), new THREE.MeshStandardMaterial({ map: pnlMeterFace(m), roughness: 0.6 })); f.position.z = 0.0305; g3.add(f);
    const nd = mk(true); nd.position.z = 0.033; nd.scale.setScalar(0.78); nd.rotation.z = -(MA0 + (MA1 - MA0) * m.get); g3.add(zc(R * 0.1, R * 0.1, 0.006, blkG, 0.034, 20));
    const gl = new THREE.Mesh(new THREE.CircleGeometry(R - 0.008, 40), glassM); gl.position.z = 0.038; g3.add(gl); return g3;
  }
  if (m.kind === 'hour') {
    g3.add(zc(R, R, 0.016, chrome, 0.008, 48)); const rim = new THREE.Mesh(new THREE.TorusGeometry(R - 0.003, 0.003, 10, 56), chrome); rim.position.z = 0.016; g3.add(rim);
    const f = new THREE.Mesh(new THREE.CircleGeometry(R - 0.005, 48), new THREE.MeshStandardMaterial({ map: pnlMeterFace(m), roughness: 0.6 })); f.position.z = 0.0165; g3.add(f);
    const gl = new THREE.Mesh(new THREE.CircleGeometry(R - 0.005, 40), glassM); gl.position.z = 0.02; g3.add(gl);
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const lug = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.004), silv); lug.position.set(x * R * 0.78, y * R * 0.78, 0.002); g3.add(lug); }
    return g3;
  }
  // 角形の黒い枠（丸窓）
  const sh = rrShape(2 * S2, 2 * S2, 0.011), hole = new THREE.Path(); hole.absarc(0, 0, R - 0.001, 0, Math.PI * 2, true); sh.holes.push(hole);
  const fr = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.024, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 20 }), blkG); fr.position.z = 0.002; fr.castShadow = true; g3.add(fr);
  const f = new THREE.Mesh(new THREE.CircleGeometry(R + 0.001, 56), new THREE.MeshStandardMaterial({ map: pnlMeterFace(m), roughness: 0.55 })); f.position.z = 0.007; g3.add(f);
  const nd = mk(false), hub = zc(R * 0.2, R * 0.22, 0.009, hubM, 0.0125, 28); g3.add(hub);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(R * 0.5, R * 0.1, 0.004), hubM); cross.position.z = 0.0125; g3.add(cross); g3.add(zc(R * 0.045, R * 0.045, 0.003, silv, 0.018, 10));
  const set = v => { nd.rotation.z = -(MA0 + (MA1 - MA0) * Math.min(1.02, Math.max(-0.02, v))); };
  if (typeof m.get === 'function') { let cur = m.get(); set(cur); dyn3.push(dt => { const t = m.get(); if (Math.abs(t - cur) > 1e-4) { cur += (t - cur) * Math.min(1, dt * 6); set(cur); } }); } else set(m.get || 0);
  const gl = new THREE.Mesh(new THREE.CircleGeometry(R, 40), glassM); gl.position.z = 0.024; g3.add(gl);
  const hl = new THREE.Mesh(new THREE.PlaneGeometry(R * 0.9, R * 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false })); hl.position.set(-R * 0.15, R * 0.58, 0.0245); hl.rotation.z = 0.5; g3.add(hl);
  return g3;
}
function push3D(r, c, estop) {
  const g3 = new THREE.Group(), R = r * KM;
  g3.add(zc(R, R * 1.04, 0.006, pChrome, 0.003, 28)); g3.add(zc(R * 0.86, R * 0.9, 0.008, pChrome, 0.009, 28));
  if (estop) { g3.add(zc(R * 0.55, R * 0.55, 0.014, M(c, 0.2, 0.4), 0.019, 20)); g3.add(zc(R * 1.05, R * 1.15, 0.01, M(c, 0.15, 0.35), 0.03, 32)); const dm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 28, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(c, 0.15, 0.32)); dm.rotation.x = Math.PI / 2; dm.scale.z = 0.35; dm.position.z = 0.035; g3.add(dm); }
  else { g3.add(zc(R * 0.68, R * 0.7, 0.008, M(c, 0.3, 0.35), 0.016, 24)); }
  return g3;
}
// 表示灯（クロムの枠と色レンズ。点灯で発光）
const LAMPC = { g: [0x18c048, 0x0a3a18], r: [0xff2a20, 0x4a0c0a], w: [0xfff2d0, 0x3a3833] };
function lamp3D(l) {
  const g3 = new THREE.Group(), R = l.r * KM, [on, off] = LAMPC[l.c];
  g3.add(zc(R * 1.25, R * 1.32, 0.005, pChrome, 0.0025, 24)); g3.add(zc(R, R * 1.1, 0.006, pChrome, 0.007, 24));
  const mat = new THREE.MeshStandardMaterial({ color: off, emissive: on, emissiveIntensity: 0, roughness: 0.25 });
  const lens = new THREE.Mesh(new THREE.SphereGeometry(R * 0.9, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat); lens.rotation.x = Math.PI / 2; lens.scale.z = 0.7; lens.position.z = 0.009; g3.add(lens);
  let st = null; const set = v => { v = !!v; if (v === st) return; st = v; mat.color.setHex(v ? on : off); mat.emissiveIntensity = v ? 1.5 : 0; };
  if (typeof l.get === 'function') { set(l.get()); dyn3.push(() => set(l.get())); } else set(l.get);
  return g3;
}
// 集合表示灯（黒枠・乳白の窓。点灯した窓だけ描き直す）
function matrix3D(mx) {
  const g3 = new THREE.Group(), w = mx.cols * mx.cw * KM, h = mx.rows * mx.ch * KM, k = Math.min(8, 96 / mx.cw), CW = mx.cw * k, CH = mx.ch * k;
  const get = () => (typeof mx.lit === 'function' ? mx.lit() : mx.lit || []);
  let lit = get();
  const tex = canvasTex(Math.round(mx.cols * CW), Math.round(mx.rows * CH), (g) => {
    g.fillStyle = '#0d0e10'; g.fillRect(0, 0, mx.cols * CW, mx.rows * CH);
    for (let r = 0; r < mx.rows; r++) for (let c = 0; c < mx.cols; c++) {
      const i = r * mx.cols + c, on = lit.includes(i), x = c * CW + 4, y = r * CH + 4, ww = CW - 8, hh = CH - 8;
      const gr = g.createLinearGradient(0, y, 0, y + hh); if (on) { gr.addColorStop(0, '#fff3c4'); gr.addColorStop(1, '#ffc65a'); } else { gr.addColorStop(0, '#f1e7e3'); gr.addColorStop(1, '#dccfcb'); }
      g.fillStyle = gr; g.fillRect(x, y, ww, hh); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5; g.strokeRect(x, y, ww, hh);
      const t = mx.cells && mx.cells[i]; if (!t) continue;
      const n = t.length <= 4 ? (t.length > 3 ? 2 : 1) : t.length > 8 ? 3 : 2, per = Math.ceil(t.length / n), fs = Math.min(hh / (n + 0.6), ww / (per + 0.4) * 1.0);
      g.fillStyle = on ? '#3a2400' : '#5a2a26'; g.font = `bold ${fs}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let j = 0; j < n; j++) g.fillText(t.slice(j * per, (j + 1) * per), x + ww / 2, y + hh / 2 + (j - (n - 1) / 2) * fs * 1.08 + 1);
    }
  }); tex.anisotropy = 8;
  const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.012, h + 0.012, 0.008), blkG); fr.position.z = 0.004; fr.castShadow = true; g3.add(fr);
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.35 });
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); f.position.z = 0.0083; g3.add(f);
  if (typeof mx.lit === 'function') { let key = lit.join(); dyn3.push(() => { const n = get(), k2 = n.join(); if (k2 !== key) { key = k2; lit = n; tex.userData.redraw(); } }); }
  return g3;
}
// 盤名の銘板（白いアクリル板・6本の小ねじ）
function name3D(n) {
  const g3 = new THREE.Group(), w = n.w * KM, h = n.h * KM, q = 5;
  const tex = canvasTex(Math.round(n.w * q), Math.round(n.h * q), (g, W, H) => {
    g.fillStyle = '#f7f7f4'; g.fillRect(0, 0, W, H); g.strokeStyle = '#b5b5b0'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, H - 3);
    const s = n.t.replace(/[\s　]/g, ''), fs = H * 0.58, sp = Math.min(fs * 1.9, (W * 0.8) / s.length); g.fillStyle = '#141414'; g.font = `bold ${fs}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    [...s].forEach((ch, i) => g.fillText(ch, W / 2 + (i - (s.length - 1) / 2) * sp, H / 2 + fs * 0.04));
  }); tex.anisotropy = 8;
  const side = M(0xe9e9e4, 0, 0.35), b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.004), [side, side, side, side, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25 }), side]); b.position.z = 0.002; b.castShadow = true; g3.add(b);
  for (const x of [-1, 0, 1]) for (const y of [-1, 1]) { const s = zc(0.0028, 0.0028, 0.0016, silv, 0.0048, 10); s.position.x = x * (w / 2 - 0.007); s.position.y = y * (h / 2 - 0.006); g3.add(s); }
  return g3;
}
const woodM = M(0xc99a4e, 0, 0.7);
function box3D(b) {
  const g3 = new THREE.Group(), w = b.w * KM, h = b.h * KM;
  if (b.kind === 'kwh') {   // 電力量計（白い箱・黒い枠・透明カバー）
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), blkG); fr.position.z = 0.015; fr.castShadow = true; g3.add(fr);
    const tex = canvasTex(248, 408, (g, W, H) => {
      g.fillStyle = '#f3f3ef'; g.fillRect(0, 0, W, H); g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 20px sans-serif'; g.fillText('電力量計', W / 2, 26);
      g.fillStyle = '#17181a'; g.fillRect(40, 48, 168, 40); '06884'.split('').forEach((s, i) => { g.fillStyle = i === 4 ? '#d43a2a' : '#f2f2ee'; g.fillRect(45 + i * 32, 53, 28, 30); g.fillStyle = i === 4 ? '#fff' : '#111'; g.font = 'bold 24px sans-serif'; g.fillText(s, 59 + i * 32, 69); });
      g.fillStyle = '#111'; g.font = '14px sans-serif'; g.fillText('kWh', 218, 100);
      g.strokeStyle = '#222'; g.lineWidth = 1.5; g.strokeRect(22, 118, 204, 200); for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(22, 118 + i * 25); g.lineTo(226, 118 + i * 25); g.stroke(); } g.beginPath(); g.moveTo(110, 118); g.lineTo(110, 318); g.stroke();
      [['相線式', '三相3線'], ['電圧', '110 V'], ['電流', '5 A'], ['周波数', '60 Hz'], ['計器定数', '（例）'], ['乗率', '（例）'], ['形式', '―'], ['製造', '―']].forEach(([a, c], i) => { g.font = '13px sans-serif'; g.fillStyle = '#111'; g.fillText(a, 66, 131 + i * 25); g.fillText(c, 168, 131 + i * 25); });
      g.font = '12px sans-serif'; g.fillStyle = '#444'; g.fillText('数値は教材用（架空）', W / 2, 340); g.fillStyle = '#c9ccce'; g.beginPath(); g.arc(W / 2, 378, 11, 0, 7); g.fill(); g.strokeStyle = '#555'; g.stroke();
    }); tex.anisotropy = 8;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.012, h - 0.012), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 })); f.position.z = 0.0305; g3.add(f);
    const gl = new THREE.Mesh(new THREE.BoxGeometry(w - 0.01, h - 0.01, 0.006), glassM); gl.position.z = 0.034; g3.add(gl);
  } else if (b.kind === 'count') {   // 運転度数計（数字車）
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.016), blkG); fr.position.z = 0.008; fr.castShadow = true; g3.add(fr);
    const tex = canvasTex(240, 100, (g, W, H) => { g.fillStyle = '#101113'; g.fillRect(0, 0, W, H); g.fillStyle = '#050506'; g.fillRect(40, 24, 160, 52); [...b.t].forEach((s, i) => { g.fillStyle = '#1d1f22'; g.fillRect(44 + i * 31, 28, 28, 44); g.fillStyle = '#f0f0ec'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 58 + i * 31, 51); }); });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.004, h - 0.004), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 })); f.position.z = 0.0163; g3.add(f);
  } else if (b.kind === 'vr') {     // 電圧調整器（角板・目盛り・つまみ）
    const tex = canvasTex(128, 128, (g, W, H) => { g.fillStyle = '#c3c6c9'; g.fillRect(0, 0, W, H); g.strokeStyle = '#666'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, H - 3); g.fillStyle = '#17181a'; g.beginPath(); g.arc(64, 64, 50, 0, 7); g.fill(); g.strokeStyle = '#eee'; for (let i = 0; i <= 20; i++) { const a = (135 + i * 13.5) * Math.PI / 180; g.lineWidth = i % 5 ? 1.5 : 3; g.beginPath(); g.moveTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46); g.lineTo(64 + Math.cos(a) * (i % 5 ? 40 : 36), 64 + Math.sin(a) * (i % 5 ? 40 : 36)); g.stroke(); } g.fillStyle = '#777'; for (const [x, y] of [[10, 10], [118, 10], [10, 118], [118, 118]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); } });
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.003), [silv, silv, silv, silv, new THREE.MeshStandardMaterial({ map: tex, metalness: 0.4, roughness: 0.4 }), silv]); p.position.z = 0.0015; g3.add(p);
    g3.add(zc(0.011, 0.0125, 0.016, blkG, 0.011, 24)); const pt = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.009, 0.001), M(0xf2f2f2, 0, 0.5)); pt.position.set(0.003, 0.005, 0.0195); pt.rotation.z = -0.5; g3.add(pt);
  } else if (b.kind === 'tag') {    // 取っ手に下げた木の札（ひも付き）
    const t = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, h, 0.007), woodM); t.position.z = 0.012; t.rotation.z = 0.015; t.castShadow = true; g3.add(t);
    const hole = zc(0.006, 0.006, 0.0075, M(0x2a2118, 0, 0.9), 0.0122, 14); hole.position.y = -h / 2 + 0.022; g3.add(hole);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.07, 6), M(0x1c1c1c, 0, 0.8)); st.position.set(0.004, h / 2 + 0.03, 0.02); st.rotation.z = -0.12; g3.add(st);
  }
  return g3;
}
const RELAYS = {};
function buildDevices(parent, px, rec, z0 = -2.875) {
  const P = (x, y) => [px + (x - 256) * KM, 2.29 - y * KM];
  const put = (o, x, y, z = 0.001) => { const [wx, wy] = P(x, y); o.position.set(wx, wy, z0 + z); parent.add(o); return o; };
  rec.name.forEach(n => put(name3D(n), n.cx, n.cy));
  rec.meter.forEach(m => put(meter3D(m), m.cx, m.cy));
  rec.relay.forEach(r => { const [type, tag] = r.title.split(':'); const o = relay3D(type, tag); if (z0 > -3) RELAYS[tag] = o; put(o, r.x + r.w / 2, r.y + r.h / 2); });
  rec.block.forEach(b => put(block3D(b.t, b.red), b.x + 23, b.y + 20));
  rec.knob.forEach(k => { const o = put(knob3D(k.t, k.tag), k.x, k.y); o.userData.knob.rotation.z = k.tag ? -0.75 : 0.6 - ((k.x * 13 + k.y * 7) % 3) * 0.6; });
  rec.pistol.forEach(k => put(pistol3D(k.t), k.x, k.y));
  rec.lamp.forEach(l => put(lamp3D(l), l.x, l.y));
  rec.matrix.forEach(m => put(matrix3D(m), m.x + m.cols * m.cw / 2, m.y + m.rows * m.ch / 2));
  rec.box.forEach(b => put(box3D(b), b.x + b.w / 2, b.y + b.h / 2));
  rec.handle.forEach(h => put(handle3D(), h.x, h.y));
  rec.push.forEach(p => put(push3D(p.r, p.c, p.estop), p.x, p.y));
}

const pnl = new THREE.Group(); pnl.rotation.y = Math.PI / 2; pnl.position.set(-6.97, 0, -5.15); room.add(pnl);
// ================= 盤の扉と内部（写真：補機盤・電源自動切換盤・発電機盤・自動操作盤の内部） =================
const slotCanvas = vert => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.fillStyle = '#a8adb2'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#2b2e32'; if (vert) g.fillRect(8, 5, 16, 9); else g.fillRect(5, 8, 9, 16); return c; };
const slotV = new THREE.CanvasTexture(slotCanvas(true)), slotH = new THREE.CanvasTexture(slotCanvas(false));
[slotV, slotH].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
function wduct(p, x, y, z, len, vertical, th = 0.05) {
  const tex = (vertical ? slotV : slotH).clone(); tex.needsUpdate = true; tex.repeat.set(vertical ? 1 : len / 0.045, vertical ? len / 0.045 : 1);
  const b = new THREE.Mesh(new THREE.BoxGeometry(vertical ? th : len, vertical ? len : th, 0.045), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.2 }));
  b.position.set(x, y, z); b.castShadow = false; p.add(b); return b;
}
const yelM = M(0xe9c820, 0, 0.6), whtM = M(0xeeeeee, 0, 0.6), grnM = M(0x2a9a3a, 0, 0.6), redM = M(0xcc2222, 0, 0.6), blueM = M(0x3a66c8, 0.2, 0.5);
let _rs = 7; const rnd = () => { _rs = (_rs * 16807) % 2147483647; return _rs / 2147483647; };
function wire(p, a, b, m = yelM, r = 0.0028) {
  const mid = [(a[0] + b[0]) / 2 + (rnd() - 0.5) * 0.04, (a[1] + b[1]) / 2 + (rnd() - 0.5) * 0.04, Math.max(a[2], b[2]) + 0.012];
  p.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(...a), new THREE.Vector3(...mid), new THREE.Vector3(...b)]), 8, r, 4), m));
}
const cream = M(0xd9d4bf, 0.2, 0.6), darkP = M(0x1a1b1e, 0.3, 0.5), sheetM = M(0xd7d4c4, 0, 0.8), railM = M(0x9aa0a5, 0.4, 0.55);
const plateT = (lines, W = 256, H = 90) => new THREE.MeshStandardMaterial({ map: canvasTex(W, H, (g, w, h) => { g.fillStyle = '#cfd2d4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#666'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4); g.fillStyle = '#222'; g.textAlign = 'center'; lines.forEach(([t, fs], i) => { g.font = `${fs}px sans-serif`; g.fillText(t, w / 2, 24 + i * 24); }); }), roughness: 0.4, metalness: 0.5 });
const meshMat = new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#d9d6c5'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2c2d30'; g.lineWidth = 5; for (let i = -h; i < w + h; i += 14) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); } }, [4, 6]), roughness: 0.6 });
const doors = [];
function relayRow(p, x0, y, n, step, h = 0.075, m = darkP) { for (let i = 0; i < n; i++) { const b = bx(x0 + i * step - 0.0075, x0 + i * step + 0.0075, y - h / 2, y + h / 2, 0.05, 0.1, m, p); bx(x0 + i * step - 0.005, x0 + i * step + 0.005, y + h / 2, y + h / 2 + 0.004, 0.05, 0.1, whtM, p); wire(p, [x0 + i * step, y + h / 2, 0.1], [x0 + i * step + (rnd() - 0.5) * 0.04, y + h / 2 + 0.06, 0.06]); wire(p, [x0 + i * step, y - h / 2, 0.1], [x0 + i * step + (rnd() - 0.5) * 0.04, y - h / 2 - 0.06, 0.06]); } }
function timerRow(p, x0, y, n, step) { for (let i = 0; i < n; i++) { cyl(0.027, 0.06, cream, x0 + i * step, y, 0.08, 'z', p, 18); cyl(0.012, 0.012, darkP, x0 + i * step, y, 0.113, 'z', p, 12); wire(p, [x0 + i * step - 0.015, y - 0.03, 0.1], [x0 + i * step - 0.02, y - 0.09, 0.07]); wire(p, [x0 + i * step + 0.015, y - 0.03, 0.1], [x0 + i * step + 0.02, y - 0.09, 0.07], redM); } }
// ---- 盤の内部の部品（利用者の写真4枚から。寸法は写真の見た目からの近似で、実測ではない） ----
const steelP = M(0xc8ccce, 0.6, 0.4), handM = M(0x9a9fa5, 0.5, 0.4), amberM = new THREE.MeshStandardMaterial({ color: 0xd2bb72, transparent: true, opacity: 0.8, roughness: 0.25 }), clearM = new THREE.MeshStandardMaterial({ color: 0xe4ebe7, transparent: true, opacity: 0.4, roughness: 0.15 });
const _mt = {}; const meshTexOf = bg => _mt[bg] || (_mt[bg] = canvasTex(64, 64, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = '#d6d2c0'; g.lineWidth = 4; for (let i = -h; i < w + h; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); } }));
function meshWin(p, w, h, x, y, z, bg = '#25272a') { const t = meshTexOf(bg).clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w * 9, h * 9); t.needsUpdate = true; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 })); m.position.set(x, y, z); p.add(m); return m; }
function tagP(p, t, x, y, z, w = 0.07, h = 0.028) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), plateT([[t, 22]], Math.round(w / h * 40), 40)); m.position.set(x, y, z); p.add(m); return m; }
const warnMat = new THREE.MeshStandardMaterial({ map: canvasTex(64, 90, drawWarn), roughness: 0.5 });
function warnP(p, x, y, z) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.056), warnMat); m.position.set(x, y, z); p.add(m); }
const handleV = (p, x, y, z, len = 0.11) => bx(x - 0.007, x + 0.007, y - len / 2, y + len / 2, z, z + 0.022, handM, p);
const dotTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#cfcab6'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a3b3d'; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.beginPath(); g.arc(x * 8 + (y % 2 ? 6 : 2), y * 8 + 4, 1.8, 0, 7); g.fill(); } });
const lineTex = canvasTex(128, 80, (g, w, h) => { g.fillStyle = '#d5d7d8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#666'; g.lineWidth = 2; g.strokeRect(2, 2, w - 4, h - 4); g.fillStyle = '#888'; for (let i = 0; i < 6; i++) g.fillRect(10, 12 + i * 10, w - 20 - (i % 3) * 18, 3); });
const dialFace = (lo, hi) => new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#ecece6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.fillStyle = '#111'; g.lineWidth = 3; g.font = '11px sans-serif'; g.textAlign = 'center'; for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.75 + 1.5 * i / 10); g.beginPath(); g.moveTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); g.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); g.stroke(); if (i % 2 === 0) g.fillText(String(Math.round(lo + (hi - lo) * i / 10)), 64 + Math.cos(a) * 39, 68 + Math.sin(a) * 39); } g.lineWidth = 4; g.beginPath(); g.moveTo(64, 64); g.lineTo(84, 34); g.stroke(); g.beginPath(); g.arc(64, 64, 6, 0, 7); g.fill(); }), roughness: 0.3 });
// スナップスイッチが6個並んだ箱
function togBox(p, x, y) { bx(x - 0.11, x + 0.11, y - 0.05, y + 0.05, 0.02, 0.09, cream, p); for (let i = 0; i < 6; i++) { const sx = x - 0.085 + i * 0.034; cyl(0.009, 0.006, darkP, sx, y - 0.014, 0.092, 'z', p, 10); const t = cyl(0.004, 0.026, chrome, sx, y - 0.008, 0.104, 'z', p, 8); t.rotation.x = Math.PI / 2 - 0.45; bx(sx - 0.012, sx + 0.012, y + 0.02, y + 0.034, 0.09, 0.092, yelM, p); } wire(p, [x + 0.11, y, 0.06], [x + 0.17, y - 0.04, 0.05], whtM); }
// 配線用遮断器（黒い箱・黄色のラベル・つまみ）
function mccb(p, x, y, w, h, d = 0.1) { bx(x - w / 2, x + w / 2, y - h / 2, y + h / 2, 0.02, d, darkP, p); bx(x - w * 0.36, x + w * 0.36, y + h * 0.14, y + h * 0.3, d, d + 0.003, yelM, p); bx(x - w * 0.3, x + w * 0.3, y - h * 0.24, y + h * 0.06, d, d + 0.004, M(0x3a3d42, 0.3, 0.5), p); bx(x - w * 0.09, x + w * 0.09, y - h * 0.16, y, d, d + 0.02, darkP, p); for (let k = 0; k < 3; k++) { const sx = x + (k - 1) * w * 0.3; wire(p, [sx, y + h / 2, d - 0.03], [sx + (rnd() - 0.5) * 0.02, y + h / 2 + 0.05, 0.05], k === 1 ? darkP : yelM); wire(p, [sx, y - h / 2, d - 0.03], [sx + (rnd() - 0.5) * 0.02, y - h / 2 - 0.05, 0.05], darkP); } }
// 端子台の列（クリーム色の小さな端子＋上下の配線）
function termRow(p, x0, y, n, step, wm = yelM) { for (let i = 0; i < n; i++) { const x = x0 + i * step; bx(x - step * 0.42, x + step * 0.42, y - 0.03, y + 0.03, 0.02, 0.06, i % 5 ? cream : whtM, p); cyl(0.005, 0.004, darkP, x, y, 0.062, 'z', p, 8); if (i % 2 === 0) wire(p, [x, y + 0.03, 0.055], [x + (rnd() - 0.5) * 0.02, y + 0.075, 0.06], wm, 0.0022); wire(p, [x, y - 0.03, 0.055], [x + (rnd() - 0.5) * 0.02, y - 0.075, 0.05], i % 3 ? darkP : whtM, 0.0022); } }
const floorRails = ig => { for (const x of [-0.2, 0.2]) bx(x - 0.03, x + 0.03, 0.14, 0.155, 0.02, 0.44, railM, ig); bx(-0.12, 0.12, 0.14, 0.146, 0.1, 0.36, M(0xcbc6b3, 0.2, 0.7), ig); };
const sideStrip = (ig, y0, y1) => { bx(0.335, 0.372, y0, y1, 0.02, 0.06, whtM, ig); for (let y = y0 + 0.02; y < y1; y += 0.035) { cyl(0.004, 0.004, M(0x2a9a3a, 0.2, 0.5), 0.353, y, 0.062, 'z', ig, 6); if (rnd() > 0.3) wire(ig, [0.34, y, 0.06], [0.3, y + 0.04, 0.05], yelM, 0.0022); } };

// 自動操作盤の内部（写真：上から、制御ユニットと小形リレー、補助リレーと設定器、タイマ10個、自動電圧調整器、下に計器2個付きの箱）
function insideAuto(ig) {
  for (const y of [2.075, 1.845, 1.635, 1.415, 0.985]) wduct(ig, 0.0, y, 0.07, 0.74, false, 0.035);
  bx(-0.35, -0.275, 1.89, 2.03, 0.02, 0.12, cream, ig); bx(-0.335, -0.322, 1.995, 2.005, 0.12, 0.123, redM, ig);
  for (let i = 0; i < 4; i++) bx(-0.27 + i * 0.038, -0.236 + i * 0.038, 1.89, 2.03, 0.02, 0.115, darkP, ig);
  for (let i = 0; i < 4; i++) wire(ig, [-0.34 + i * 0.02, 1.89, 0.1], [-0.37, 1.87 - i * 0.01, 0.07]);
  for (let i = 0; i < 10; i++) { const x = -0.095 + i * 0.037; bx(x - 0.016, x + 0.016, 1.935, 2.035, 0.02, 0.11, darkP, ig); bx(x - 0.011, x + 0.011, 2.0, 2.022, 0.11, 0.112, whtM, ig); bx(x - 0.017, x + 0.017, 1.895, 1.935, 0.02, 0.09, cream, ig); wire(ig, [x, 1.895, 0.085], [x + (rnd() - 0.5) * 0.02, 1.855, 0.075], yelM, 0.0022); }
  bx(0.305, 0.38, 1.86, 2.04, 0.02, 0.13, darkP, ig); bx(0.315, 0.37, 1.99, 2.02, 0.13, 0.132, whtM, ig); for (let i = 0; i < 6; i++) cyl(0.004, 0.004, steelP, 0.372, 1.88 + i * 0.018, 0.132, 'z', ig, 6);
  bx(-0.37, -0.16, 1.728, 1.742, 0.0, 0.04, railM, ig);
  for (let i = 0; i < 4; i++) { const x = -0.34 + i * 0.046; bx(x - 0.02, x + 0.02, 1.685, 1.785, 0.02, 0.07, darkP, ig); bx(x - 0.017, x + 0.017, 1.705, 1.77, 0.07, 0.118, amberM, ig); wire(ig, [x - 0.01, 1.785, 0.065], [x - 0.01, 1.83, 0.075]); wire(ig, [x + 0.01, 1.685, 0.065], [x + 0.01, 1.65, 0.075]); }
  bx(-0.03, 0.09, 1.728, 1.742, 0.0, 0.04, railM, ig); bx(-0.015, 0.05, 1.69, 1.79, 0.02, 0.09, whtM, ig); cyl(0.011, 0.012, darkP, 0.005, 1.765, 0.096, 'z', ig, 14); cyl(0.011, 0.012, darkP, 0.03, 1.72, 0.096, 'z', ig, 14);
  bx(0.185, 0.36, 1.675, 1.805, 0.02, 0.1, darkP, ig); bx(0.195, 0.35, 1.715, 1.797, 0.1, 0.103, whtM, ig); for (let i = 0; i < 3; i++) cyl(0.009, 0.01, darkP, 0.22 + i * 0.034, 1.752, 0.107, 'z', ig, 12); bx(0.312, 0.345, 1.74, 1.765, 0.103, 0.105, darkP, ig);
  for (let i = 0; i < 6; i++) { cyl(0.005, 0.006, redM, 0.2 + i * 0.029, 1.692, 0.102, 'z', ig, 8); wire(ig, [0.2 + i * 0.029, 1.69, 0.1], [0.2 + i * 0.029, 1.655, 0.075], yelM, 0.0022); }
  bx(-0.36, 0.33, 1.515, 1.53, 0.0, 0.04, railM, ig);
  for (let i = 0; i < 10; i++) bx(-0.31 + i * 0.068 - 0.03, -0.31 + i * 0.068 + 0.03, 1.49, 1.555, 0.02, 0.055, darkP, ig);
  timerRow(ig, -0.31, 1.525, 10, 0.068);
  // 自動電圧調整器（銘板は名称だけ。形式は入れない）
  bx(-0.35, 0.3, 1.03, 1.3, 0.0, 0.03, steelP, ig);
  { const a = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.2), plateT([['', 10], ['自動電圧調整器', 30]], 360, 200)); a.position.set(-0.16, 1.185, 0.031); ig.add(a); const b = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.2), plateT([['', 10], ['モジュール部', 20]], 220, 200)); b.position.set(0.155, 1.185, 0.0312); ig.add(b); }
  bx(-0.33, 0.1, 1.045, 1.075, 0.03, 0.05, darkP, ig); cyl(0.006, 0.006, M(0x35a04a, 0.2, 0.5), -0.335, 1.11, 0.034, 'z', ig, 10);
  for (let i = 0; i < 16; i++) { const x = -0.32 + i * 0.027; bx(x - 0.004, x + 0.004, 1.02, 1.047, 0.045, 0.053, blueM, ig); wire(ig, [x, 1.02, 0.05], [x + (rnd() - 0.5) * 0.02, 0.99, 0.075], i % 5 === 4 ? grnM : yelM, 0.0022); }
  bx(0.33, 0.42, 0.78, 1.14, 0.03, 0.12, cream, ig); for (const y of [1.06, 0.87]) { const k = knob3D(); k.position.set(0.375, y, 0.12); k.scale.setScalar(1.5); ig.add(k); }
  { const u = new THREE.Group(); u.position.set(0.04, 0.14, 0.14); ig.add(u);          // 下段の箱（計器2個・表示灯4個）
    for (const x of [-0.17, 0.15]) { bx(x, x + 0.03, 0, 0.02, -0.1, 0.3, railM, u); bx(x + 0.005, x + 0.025, 0.02, 0.13, 0.16, 0.2, cream, u); }
    bx(-0.17, 0.17, 0.13, 0.86, -0.08, 0.22, cream, u); bx(-0.18, -0.165, 0.2, 0.26, 0.2, 0.225, handM, u); bx(-0.18, -0.165, 0.7, 0.76, 0.2, 0.225, handM, u);
    { const v = dotTex.clone(); v.wrapS = v.wrapT = THREE.RepeatWrapping; v.repeat.set(5, 1.5); v.needsUpdate = true; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.07), new THREE.MeshStandardMaterial({ map: v, roughness: 0.7 })); m.position.set(0, 0.81, 0.2205); u.add(m); }
    ['#e89a3a', '#e89a3a', '#e9e2c8', '#e9e2c8'].forEach((c, i) => bx(-0.085 + i * 0.036, -0.055 + i * 0.036, 0.725, 0.745, 0.22, 0.224, M(new THREE.Color(c).getHex(), 0, 0.5), u));
    for (const sx of [-0.07, 0.075]) { bx(sx - 0.05, sx + 0.05, 0.585, 0.665, 0.22, 0.226, darkP, u); const mt = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.07), new THREE.MeshStandardMaterial({ map: canvasTex(128, 100, (g, w, h) => { g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.arc(64, 96, 62, Math.PI * 1.22, Math.PI * 1.78); g.stroke(); g.beginPath(); g.moveTo(64, 96); g.lineTo(sx < 0 ? 84 : 44, 40); g.stroke(); g.font = 'bold 16px sans-serif'; g.fillStyle = '#111'; g.textAlign = 'center'; g.fillText(sx < 0 ? 'V' : 'A', 64, 84); }), roughness: 0.3 })); mt.position.set(sx, 0.625, 0.2265); u.add(mt); }
    bx(-0.12, 0.12, 0.36, 0.53, 0.22, 0.224, M(0xcfcab6, 0.2, 0.7), u); bx(-0.045, 0.045, 0.475, 0.49, 0.224, 0.226, M(0x8f8b7a), u);
    { const n = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), new THREE.MeshStandardMaterial({ map: lineTex, roughness: 0.4, metalness: 0.4 })); n.position.set(-0.02, 0.21, 0.2205); u.add(n); }
    for (const y of [0.75, 0.18]) cyl(0.011, 0.008, chrome, 0.14, y, 0.223, 'z', u, 14); }
  for (const x of [-0.345, -0.29]) cyl(0.026, 0.78, M(0x8a8e92, 0.2, 0.9), x, 0.55, 0.07, 'y', ig, 12);   // 灰色の保護チューブで束ねた配線
  pipe([[-0.3, 0.3, 0.1], [-0.27, 0.2, 0.16], [-0.25, 0.15, 0.24]], 0.012, darkP, ig); for (let i = 0; i < 3; i++) cyl(0.014, 0.003, whtM, -0.24 + i * 0.03, 0.16 + i * 0.01, 0.27 + i * 0.01, 'z', ig, 10);
  floorRails(ig);
}
// 発電機盤の内部（写真：上にスイッチ箱2個と大きな配線用遮断器、下に金網付きカバー3段、丸形の指示計）
function insideGen(ig) {
  wduct(ig, 0.0, 1.985, 0.07, 0.74, false, 0.035); wduct(ig, -0.18, 1.74, 0.07, 0.3, false, 0.03); wduct(ig, 0.0, 1.525, 0.07, 0.74, false, 0.035);
  togBox(ig, -0.18, 1.86); togBox(ig, -0.18, 1.63);
  bx(0.02, 0.25, 1.555, 1.965, 0.02, 0.14, darkP, ig); bx(0.05, 0.21, 1.855, 1.882, 0.14, 0.142, yelM, ig); tagP(ig, 'MCCB', 0.1, 1.905, 0.142, 0.07, 0.026); bx(0.16, 0.235, 1.895, 1.945, 0.14, 0.142, whtM, ig);
  bx(0.085, 0.185, 1.665, 1.83, 0.14, 0.15, M(0x2e3034, 0.3, 0.5), ig); bx(0.12, 0.15, 1.75, 1.81, 0.15, 0.19, darkP, ig); bx(0.105, 0.165, 1.685, 1.705, 0.15, 0.156, redM, ig); bx(0.03, 0.24, 1.565, 1.65, 0.14, 0.142, M(0x4a4e55, 0.3, 0.5), ig); bx(0.115, 0.155, 1.585, 1.625, 0.142, 0.144, whtM, ig);
  for (let k = 0; k < 3; k++) cyl(0.012, 0.06, darkP, 0.075 + k * 0.06, 1.99, 0.09, 'y', ig, 10);
  sideStrip(ig, 1.42, 2.0);
  const cov = (y0, y1) => bx(-0.3, 0.31, y0, y1, 0.02, 0.26, cream, ig);
  cov(1.2, 1.5); meshWin(ig, 0.27, 0.2, 0.0, 1.35, 0.262); warnP(ig, 0.255, 1.455, 0.262); handleV(ig, -0.265, 1.33, 0.26, 0.08); handleV(ig, 0.28, 1.33, 0.26, 0.08);
  cov(0.71, 1.18); meshWin(ig, 0.32, 0.37, 0.04, 0.95, 0.262); meshWin(ig, 0.32, 0.11, 0.04, 0.82, 0.2625, '#a52a26'); warnP(ig, 0.262, 1.1, 0.262); handleV(ig, 0.283, 0.96, 0.26);
  cov(0.2, 0.68); meshWin(ig, 0.32, 0.38, 0.04, 0.44, 0.262); meshWin(ig, 0.32, 0.2, 0.04, 0.5, 0.2625, '#a52a26'); warnP(ig, 0.262, 0.6, 0.262); handleV(ig, -0.265, 0.44, 0.26); handleV(ig, 0.283, 0.4, 0.26);
  // 丸形の指示計（扉の丸窓から見える位置。用途は写真では読めない）
  bx(-0.38, -0.11, 0.87, 1.06, 0.24, 0.275, cream, ig);
  { const t = new THREE.Group(); t.position.set(-0.2, 0.965, 0.275); ig.add(t); const rg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 28), blkG); rg.rotation.x = Math.PI / 2; rg.position.z = 0.02; t.add(rg); const fc = new THREE.Mesh(new THREE.CircleGeometry(0.063, 28), dialFace(0, 200)); fc.position.z = 0.041; t.add(fc); }
  pipe([[-0.2, 1.04, 0.3], [-0.25, 1.1, 0.33], [-0.34, 1.12, 0.3], [-0.37, 1.2, 0.2], [-0.38, 1.4, 0.1]], 0.006, steelP, ig);
  floorRails(ig);
}
// 補機盤の内部（写真：段ごとに、変圧器と端子台とタイマ、補助リレー列、配線用遮断器、小形変圧器、電磁接触器、端子台）
function insideAux(ig) {
  for (const y of [1.965, 1.795, 1.555, 1.42, 1.205, 1.03, 0.83]) wduct(ig, -0.02, y, 0.07, 0.7, false, 0.03);
  bx(-0.37, -0.27, 1.99, 2.1, 0.02, 0.11, darkP, ig); bx(-0.355, -0.285, 2.035, 2.06, 0.11, 0.113, yelM, ig);
  bx(-0.2, -0.02, 2.0, 2.06, 0.02, 0.06, cream, ig); for (let i = 0; i < 12; i++) { const x = -0.192 + i * 0.015; cyl(0.004, 0.004, redM, x, 2.01, 0.062, 'z', ig, 6); if (i < 11) wire(ig, [x, 2.06, 0.055], [x + 0.015, 2.06, 0.055], yelM, 0.0022); wire(ig, [x, 2.0, 0.055], [x + (rnd() - 0.5) * 0.01, 1.975, 0.075], yelM, 0.0022); }
  for (let i = 0; i < 3; i++) bx(0.1 + i * 0.06, 0.15 + i * 0.06, 2.0, 2.065, 0.02, 0.055, darkP, ig); timerRow(ig, 0.125, 2.035, 3, 0.06);
  bx(-0.36, 0.3, 1.875, 1.888, 0.0, 0.04, railM, ig);
  for (let i = 0; i < 16; i++) { const x = -0.33 + i * 0.037; bx(x - 0.015, x + 0.015, 1.835, 1.87, 0.02, 0.07, redM, ig); bx(x - 0.015, x + 0.015, 1.87, 1.93, 0.02, 0.085, darkP, ig); bx(x - 0.011, x + 0.011, 1.895, 1.92, 0.085, 0.087, yelM, ig); wire(ig, [x, 1.93, 0.07], [x + (rnd() - 0.5) * 0.02, 1.955, 0.075], i % 3 ? yelM : redM, 0.0022); wire(ig, [x, 1.835, 0.065], [x + (rnd() - 0.5) * 0.02, 1.805, 0.075], yelM, 0.0022); }
  for (const x of [-0.17, 0.13]) { mccb(ig, x, 1.665, 0.075, 0.14); bx(x - 0.03, x + 0.03, 1.765, 1.78, 0.01, 0.014, darkP, ig); }
  for (let i = 0; i < 4; i++) { const x = -0.25 + i * 0.135; bx(x - 0.04, x + 0.04, 1.44, 1.455, 0.02, 0.09, darkP, ig); bx(x - 0.032, x + 0.032, 1.455, 1.52, 0.03, 0.085, M(0x6a4526, 0.3, 0.6), ig); bx(x - 0.022, x + 0.022, 1.47, 1.5, 0.085, 0.087, yelM, ig); wire(ig, [x - 0.02, 1.52, 0.06], [x - 0.03, 1.55, 0.075], darkP); wire(ig, [x + 0.02, 1.52, 0.06], [x + 0.03, 1.55, 0.075], whtM); }
  for (let i = 0; i < 5; i++) mccb(ig, -0.29 + i * 0.105 + (i === 4 ? -0.008 : 0), 1.31, i === 4 ? 0.06 : 0.085, 0.13);
  for (let i = 0; i < 15; i++) { const x = -0.33 + i * 0.038 + (i > 6 ? 0.03 : 0); bx(x - 0.015, x + 0.015, 1.075, 1.155, 0.02, 0.07, cream, ig); cyl(0.009, 0.006, M(0x8f8b7a, 0.3, 0.6), x, 1.125, 0.072, 'z', ig, 10); wire(ig, [x, 1.155, 0.06], [x + (rnd() - 0.5) * 0.02, 1.19, 0.075], i % 2 ? whtM : darkP, 0.0022); wire(ig, [x, 1.075, 0.06], [x, 1.045, 0.075], i % 3 ? redM : whtM, 0.0022); }
  for (let i = 0; i < 8; i++) { const x = -0.32 + i * 0.076, w = i === 7 ? 0.022 : 0.032; bx(x - w, x + w, 0.865, 0.99, 0.02, 0.1, darkP, ig); bx(x - w * 0.6, x + w * 0.6, 0.91, 0.95, 0.1, 0.104, M(0xb9bcb8, 0.2, 0.6), ig); for (let k = 0; k < 3; k++) { const sx = x + (k - 1) * w * 0.6; cyl(0.005, 0.006, k === 1 ? blueM : redM, sx, 0.975, 0.102, 'z', ig, 6); cyl(0.005, 0.006, redM, sx, 0.88, 0.102, 'z', ig, 6); } wire(ig, [x, 0.99, 0.09], [x + (rnd() - 0.5) * 0.02, 1.02, 0.075], darkP); wire(ig, [x, 0.865, 0.09], [x + (rnd() - 0.5) * 0.02, 0.835, 0.075], darkP); }
  wduct(ig, 0.0, 0.775, 0.1, 0.62, false, 0.035); bx(-0.36, 0.3, 0.69, 0.71, 0.0, 0.03, cream, ig); termRow(ig, -0.33, 0.7, 3, 0.022); termRow(ig, -0.22, 0.7, 16, 0.031, whtM);
  { const v = dotTex.clone(); v.wrapS = v.wrapT = THREE.RepeatWrapping; v.repeat.set(6, 1.4); v.needsUpdate = true; const m = bx(-0.17, 0.12, 0.575, 0.645, 0.01, 0.03, new THREE.MeshStandardMaterial({ map: v, color: 0x555555, roughness: 0.7 }), ig); void m; }
  wduct(ig, 0.0, 0.535, 0.1, 0.62, false, 0.035); bx(-0.36, 0.3, 0.45, 0.47, 0.0, 0.03, cream, ig); termRow(ig, -0.33, 0.46, 24, 0.0265, redM);
  bx(-0.33, 0.3, 0.3, 0.33, 0.0, 0.16, M(0x9aa0a5, 0.3, 0.6), ig); bx(-0.13, 0.13, 0.14, 0.146, 0.1, 0.36, M(0xcbc6b3, 0.2, 0.7), ig);
  pipe([[0.2, 0.42, 0.06], [0.24, 0.3, 0.12], [0.26, 0.15, 0.16]], 0.016, darkP, ig); for (let i = 0; i < 3; i++) cyl(0.013, 0.003, whtM, 0.18 + i * 0.03, 0.3 - i * 0.02, 0.15 + i * 0.01, 'z', ig, 10);
}
// 電源自動切換盤の内部（写真：金網付きカバー2段、補助リレーの段、下に金網付きの大きな箱。札は 89GR・83C・83B）
function insideXfer(ig) {
  bx(-0.28, 0.33, 1.53, 2.04, 0.02, 0.3, cream, ig); meshWin(ig, 0.42, 0.36, -0.01, 1.82, 0.302);
  cyl(0.016, 0.02, chrome, 0.285, 1.79, 0.31, 'z', ig, 14); { const h = bx(0.277, 0.293, 1.77, 1.86, 0.315, 0.33, chrome, ig); h.rotation.z = 0.25; }
  tagP(ig, '89GR', 0.265, 1.6, 0.302, 0.075, 0.03); warnP(ig, 0.28, 1.95, 0.302);
  bx(-0.28, 0.33, 1.22, 1.5, 0.02, 0.3, cream, ig); meshWin(ig, 0.36, 0.14, -0.02, 1.38, 0.302); warnP(ig, 0.26, 1.42, 0.302);
  wduct(ig, 0.0, 1.195, 0.07, 0.56, false, 0.03); wduct(ig, 0.0, 1.0, 0.07, 0.56, false, 0.035);
  bx(-0.24, 0.26, 1.095, 1.108, 0.0, 0.04, railM, ig);
  [[-0.2, 0], [-0.15, 0], [-0.08, 1], [0.0, 1], [0.08, 1], [0.17, 0], [0.22, 0]].forEach(([x, pair]) => { const w = pair ? 0.02 : 0.009; bx(x - w, x + w, 1.07, 1.14, 0.02, 0.075, pair ? darkP : cream, ig); if (pair) { bx(x - w, x + w, 1.115, 1.135, 0.075, 0.078, redM, ig); bx(x - w * 0.7, x + w * 0.7, 1.08, 1.1, 0.075, 0.078, yelM, ig); } wire(ig, [x, 1.14, 0.06], [x + (rnd() - 0.5) * 0.02, 1.185, 0.075]); wire(ig, [x, 1.07, 0.06], [x + (rnd() - 0.5) * 0.02, 1.01, 0.075]); });
  for (const sx of [-1, 1]) { const x = sx * 0.345; bx(x - 0.045, x + 0.045, 1.08, 1.2, 0.02, 0.035, darkP, ig); bx(x - 0.04, x + 0.04, 1.085, 1.195, 0.035, 0.12, clearM, ig); bx(x - 0.02, x + 0.02, 1.11, 1.16, 0.035, 0.09, M(0x4a3a2a, 0.3, 0.6), ig); bx(x - 0.03, x + 0.03, 1.165, 1.18, 0.035, 0.1, steelP, ig); wire(ig, [x, 1.08, 0.04], [x - sx * 0.02, 1.03, 0.06]); wire(ig, [x, 1.08, 0.04], [x + sx * 0.02, 1.02, 0.06], darkP); }
  bx(-0.24, 0.26, 0.16, 0.96, 0.02, 0.36, cream, ig); bx(-0.27, 0.29, 0.14, 0.17, 0.02, 0.4, railM, ig);
  meshWin(ig, 0.32, 0.2, -0.01, 0.8, 0.362); meshWin(ig, 0.32, 0.2, -0.01, 0.4, 0.362);
  for (const [t, y] of [['83C', 0.655], ['83B', 0.23]]) { tagP(ig, t, 0.2, y, 0.362, 0.055, 0.024); bx(0.1, 0.19, y - 0.075, y - 0.02, 0.36, 0.362, M(0x2a2b2e, 0.3, 0.6), ig); for (let k = 0; k < 4; k++) cyl(0.004, 0.004, pinMat, 0.112 + k * 0.022, y - 0.05, 0.363, 'z', ig, 6); }
  warnP(ig, 0.07, 0.62, 0.362); handleV(ig, 0.235, 0.56, 0.36); { const h = bx(-0.21, -0.13, 0.6, 0.62, 0.36, 0.385, handM, ig); h.rotation.z = -0.3; }
  for (const y of [0.9, 0.2]) cyl(0.008, 0.006, M(0x7d8689, 0.8, 0.45), 0.235, y, 0.362, 'z', ig, 8);
  bx(-0.385, -0.3, 0.84, 0.93, 0.02, 0.1, cream, ig); for (let i = 0; i < 4; i++) cyl(0.004, 0.02, chrome, -0.3, 0.855 + i * 0.02, 0.07, 'x', ig, 6);
  sideStrip(ig, 1.25, 2.0);
  bx(-0.12, 0.12, 0.14, 0.146, 0.36, 0.46, M(0xcbc6b3, 0.2, 0.7), ig);
}
const pinMat = M(0xd0b060, 0.8, 0.3);
function cabinetInside(ig, kind) {
  // 共通：背板・縦ダクト・棚レール・照明
  bx(-0.43, 0.43, 0.14, 2.24, 0.0, 0.01, sheetM, ig);
  wduct(ig, -0.4, 1.2, 0.05, 2.0, true); wduct(ig, 0.41, 1.2, 0.05, 2.0, true);
  for (const y of [0.12, 2.2]) bx(-0.44, 0.44, y, y + 0.03, 0.0, 0.3, railM, ig);
  bx(-0.3, 0.3, 2.19, 2.23, 0.12, 0.2, M(0xc9c9c0, 0.3, 0.6), ig);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 12), new THREE.MeshBasicMaterial({ color: 0xfffbe8 })); tube.rotation.z = Math.PI / 2; tube.position.set(0, 2.17, 0.17); ig.add(tube);
  cyl(0.02, 0.025, darkP, 0.38, 2.2, 0.22, 'z', ig, 14);   // 扉連動の灯
  for (let y = 0.3; y < 2.1; y += 0.07) { wire(ig, [-0.39, y, 0.06], [-0.3 + rnd() * 0.1, y + 0.03, 0.04]); if (rnd() > 0.4) wire(ig, [0.4, y, 0.06], [0.3 - rnd() * 0.1, y + 0.03, 0.04]); }
  if (kind === 4) insideAuto(ig);
  else if (kind === 3) insideGen(ig);
  else if (kind === 1) insideAux(ig);
  else if (kind === 2) insideXfer(ig);
  else if (kind === 0) {      // 高圧配電盤 GF2/GF1：真空遮断器（VCB）の見本
    { const silverC = M(0x9aa0a5, 0.7, 0.45);
      bx(-0.43, -0.385, 0.35, 1.15, 0.0, 0.07, darkP, ig);                                  // 左の端子台
      for (let i = 0; i < 16; i++) { const y = 0.38 + i * 0.048; bx(-0.43, -0.385, y, y + 0.018, 0.07, 0.078, i % 4 ? M(0xc9a24a, 0.8, 0.3) : whtM, ig); wire(ig, [-0.4, y + 0.01, 0.078], [-0.34, y + 0.03, 0.09]); wire(ig, [-0.4, y + 0.01, 0.078], [-0.37, y - 0.02, 0.1]); }
      pipe([[-0.36, 1.5, 0.12], [-0.34, 1.3, 0.2], [-0.38, 1.1, 0.16], [-0.4, 0.95, 0.1]], 0.03, silverC, ig);   // 銀色テープの蛇腹管
      pipe([[0.36, 1.5, 0.1], [0.4, 1.3, 0.18], [0.38, 1.0, 0.14]], 0.028, mat.cable, ig); } // （実際は開閉不可の想定）
    const gold = M(0xb59a3a, 0.8, 0.4), vcbBody = M(0xd8d2bb, 0.2, 0.55);
    const vcb = (y0, tag) => {
      const u = new THREE.Group(); u.position.set(0, y0, 0); ig.add(u);
      bx(-0.4, 0.4, 0.62, 0.64, 0.0, 0.12, railM, u);                                  // 上段の DIN レール
      relayRow(u, -0.34, 0.74, 9, 0.045, 0.1, darkP); relayRow(u, 0.08, 0.74, 3, 0.05, 0.1, M(0x6a7a8c, 0.3, 0.5));
      bx(-0.4, 0.4, 0.58, 0.62, 0.0, 0.14, M(0x9aa0a5, 0.3, 0.6), u); bx(-0.4, 0.4, 0.82, 0.85, 0.0, 0.14, whtM, u).visible = false;
      bx(-0.33, 0.28, 0.0, 0.03, 0.02, 0.36, gold, u);                                 // 金色の台（引出し用）
      bx(-0.33, -0.3, 0.0, 0.1, 0.02, 0.36, gold, u); bx(0.25, 0.28, 0.0, 0.1, 0.02, 0.36, gold, u);
      bx(-0.27, 0.27, 0.03, 0.5, 0.06, 0.34, vcbBody, u);                              // VCB 本体
      for (const x of [-0.25, 0.25]) bx(x - 0.012, x + 0.012, 0.22, 0.46, 0.34, 0.37, M(0x9a9fa5, 0.6, 0.4), u); // 取っ手
      const lb = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.12), new THREE.MeshStandardMaterial({ map: canvasTex(320, 110, (g, w, h) => { g.fillStyle = '#e9e4cf'; g.fillRect(0, 0, w, h); g.strokeStyle = '#444'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = '#222'; g.font = 'italic bold 40px sans-serif'; g.textAlign = 'center'; g.fillText('VCB', w / 2, 48); g.font = '14px sans-serif'; g.fillText('VACUUM CIRCUIT BREAKER（教育用モデル）', w / 2, 76); g.font = '11px sans-serif'; g.fillText('630A 7.2kV（例）', w / 2, 96); }), roughness: 0.4 })); lb.position.set(0, 0.4, 0.342); u.add(lb);
      const tg = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.045), plateT([[tag, 22]], 120, 56)); tg.position.set(-0.02, 0.535, 0.342); u.add(tg);
      const ct = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.02), new THREE.MeshStandardMaterial({ map: canvasTex(100, 40, (g, w, h) => { g.fillStyle = '#111'; g.fillRect(0, 0, w, h); g.fillStyle = '#eee'; g.font = '24px monospace'; g.fillText('00158', 6, 28); }) })); ct.position.set(-0.14, 0.49, 0.342); u.add(ct);
      const ind = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.02), M(0xcc2a2a, 0, 0.5)); ind.position.set(0.0, 0.49, 0.342); u.add(ind);
      const trip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 18), M(0xd01818, 0.2, 0.4)); trip.rotation.x = Math.PI / 2; trip.position.set(-0.05, 0.3, 0.348); u.add(trip);
      const cl = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.014, 16), chrome); cl.rotation.x = Math.PI / 2; cl.position.set(-0.05, 0.25, 0.348); u.add(cl);
      const wn = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshStandardMaterial({ map: canvasTex(160, 80, (g, w, h) => { g.fillStyle = '#f3f3ef'; g.fillRect(0, 0, w, h); g.fillStyle = '#e9b400'; g.fillRect(4, 4, 36, 20); g.fillStyle = '#c33'; g.fillRect(90, 4, 30, 20); g.fillStyle = '#777'; for (let i = 0; i < 6; i++) g.fillRect(6, 32 + i * 8, w - 12, 3); }), roughness: 0.5 })); wn.position.set(0.12, 0.2, 0.342); u.add(wn);
      cyl(0.011, 0.04, M(0xe8c040, 0.8, 0.3), 0.04, 0.2, 0.355, 'z', u, 12);
      bx(-0.34, 0.04, 0.0, 0.2, -0.0, 0.05, M(0x1a1a1c), u).visible = false;
      bx(-0.4, -0.34, 0.1, 0.4, 0.02, 0.2, darkP, u);                                   // 左の制御用ユニット
      for (let i = 0; i < 6; i++) wire(u, [-0.37, 0.12 + i * 0.045, 0.2], [-0.4, 0.15 + i * 0.045, 0.1]);
      for (const x of [-0.33, -0.32, 0.31, 0.33]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.012, 6), M(0x7d8689, 0.8, 0.45)); b.rotation.x = Math.PI / 2; b.position.set(x, 0.03, 0.3); u.add(b); }
    };
    vcb(1.38, '52F3'); vcb(0.22, '52F4');
    bx(-0.4, 0.4, 1.2, 1.25, 0.0, 0.34, M(0xe6e1cc, 0.2, 0.6), ig);                    // 室の仕切り棚
    bx(-0.4, 0.4, 0.14, 0.17, 0.0, 0.34, M(0xe6e1cc, 0.2, 0.6), ig);
    for (let i = 0; i < 12; i++) wire(ig, [-0.39, 1.3 + i * 0.07, 0.06], [-0.34, 1.34 + i * 0.07, 0.05]);
  }
}
const i0 = y => (y > 1.5 ? darkP : cream);
function doorBack(dg, rec, cx, kind) {
  const P = (xx, yy) => [cx + (xx - 256) * KM, 2.29 - yy * KM];
  const termDots = (g, x, y, w) => { for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.012, 8), M(0xd0b060, 0.8, 0.3)); t.rotation.x = Math.PI / 2; t.position.set(x - w / 2 + 0.01 + i * (w - 0.02) / 5, y, -0.115); g.add(t); } };
  const rows = new Set();
  rec.meter.forEach(m => { const [x, y] = P(m.cx, m.cy); const r = m.r * KM * 0.62; const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.07, 22), darkP); b.rotation.x = Math.PI / 2; b.position.set(x, y, -0.065); b.castShadow = true; dg.add(b); termDots(dg, x, y - r * 0.5, r * 1.6); rows.add(Math.round(y * 5)); if (rnd() > 0.2) wire(dg, [x - r * 0.4, y - r * 0.55, -0.12], [Math.min(x + 0.1, 0.12), y - r - 0.04, -0.09]); });
  rec.relay.forEach(rl => { const [x, y] = P(rl.x + rl.w / 2, rl.y + rl.h / 2); const b = bx(x - 0.055, x + 0.055, y - 0.06, y + 0.06, -0.14, -0.03, darkP, dg); termDots(dg, x, y - 0.05, 0.1); termDots(dg, x, y + 0.05, 0.1); for (let k = 0; k < 8; k++) cyl(0.007, 0.004, whtM, x - 0.03 + (k % 4) * 0.02, y + 0.012 - (k >> 2) * 0.024, -0.141, 'z', dg, 10); rows.add(Math.round(y * 5)); wire(dg, [x - 0.04, y + 0.065, -0.15], [0.08, y + 0.12, -0.09]); wire(dg, [x + 0.04, y - 0.065, -0.15], [0.08, y - 0.12, -0.09]); });
  rec.knob.forEach(k => { const [x, y] = P(k.x, k.y); cyl(0.02, 0.05, darkP, x, y, -0.055, 'z', dg, 12); const t = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.012), M(0xd0b060, 0.8, 0.3)); t.position.set(x, y - 0.03, -0.085); dg.add(t); if (rnd() > 0.5) wire(dg, [x, y - 0.03, -0.09], [0.08, y - 0.06, -0.09]); });
  rec.block.forEach(b => { const [x, y] = P(b.x + 23, b.y + 20); bx(x - 0.04, x + 0.04, y - 0.035, y + 0.035, -0.09, -0.03, darkP, dg); wire(dg, [x, y - 0.03, -0.09], [0.08, y - 0.1, -0.09]); });
  // 盤面に追加した部品の背面（表の位置に合わせる。形は一般的な盤用部品の形で、実機の写真を見たものではない＝推測）
  const brassB = M(0xd0b060, 0.8, 0.3), stud = (x, y, z) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.012, 8), brassB); t.rotation.x = Math.PI / 2; t.position.set(x, y, z); dg.add(t); };
  rec.pistol.forEach(k => { const [x, y] = P(k.x, k.y); for (let i = 0; i < 4; i++) { bx(x - 0.027, x + 0.027, y - 0.027, y + 0.027, -0.05 - i * 0.022, -0.032 - i * 0.022, i % 2 ? darkP : cream, dg); for (const sx of [-1, 1]) for (const sy of [-1, 1]) stud(x + sx * 0.03, y + sy * 0.015, -0.041 - i * 0.022); } cyl(0.006, 0.1, railM, x, y, -0.075, 'z', dg, 8); wire(dg, [x - 0.03, y - 0.015, -0.06], [0.08, y - 0.07, -0.09]); wire(dg, [x - 0.03, y + 0.015, -0.085], [0.08, y + 0.05, -0.09], redM); rows.add(Math.round(y * 5)); });
  rec.lamp.forEach(l => { const [x, y] = P(l.x, l.y), r = l.r * KM; cyl(r * 1.1, 0.04, darkP, x, y, -0.05, 'z', dg, 12); stud(x - r * 0.5, y, -0.074); stud(x + r * 0.5, y, -0.074); if (rnd() > 0.4) wire(dg, [x - r * 0.5, y, -0.078], [0.08, y - 0.05, -0.09], rnd() > 0.5 ? yelM : whtM, 0.0022); });
  rec.matrix.forEach(m => { const [x, y] = P(m.x + m.cols * m.cw / 2, m.y + m.rows * m.ch / 2), w = m.cols * m.cw * KM, h = m.rows * m.ch * KM; bx(x - w / 2, x + w / 2, y - h / 2, y + h / 2, -0.11, -0.03, darkP, dg); for (const sy of [-1, 1]) { bx(x - w / 2 + 0.004, x + w / 2 - 0.004, y + sy * (h / 2 - 0.008) - 0.006, y + sy * (h / 2 - 0.008) + 0.006, -0.118, -0.11, cream, dg); for (let i = 0; i < m.cols + 1; i++) { const sx = x - w / 2 + 0.012 + i * (w - 0.024) / m.cols; stud(sx, y + sy * (h / 2 - 0.008), -0.12); if (i % 2 === 0) wire(dg, [sx, y + sy * (h / 2 - 0.008), -0.124], [0.08, y + sy * (h / 2 + 0.05), -0.09], yelM, 0.0022); } } rows.add(Math.round(y * 5)); });
  rec.box.forEach(b => { const [x, y] = P(b.x + b.w / 2, b.y + b.h / 2), w = b.w * KM, h = b.h * KM;
    if (b.kind === 'kwh') { bx(x - w / 2 + 0.006, x + w / 2 - 0.006, y - h / 2 + 0.006, y + h / 2 - 0.006, -0.13, -0.03, cream, dg); bx(x - w / 2 + 0.01, x + w / 2 - 0.01, y - h / 2 + 0.008, y - h / 2 + 0.04, -0.14, -0.13, darkP, dg); for (let i = 0; i < 6; i++) { const sx = x - w / 2 + 0.02 + i * (w - 0.04) / 5; stud(sx, y - h / 2 + 0.024, -0.143); wire(dg, [sx, y - h / 2 + 0.024, -0.147], [0.08, y - h / 2 - 0.05, -0.09], i % 3 === 2 ? whtM : yelM, 0.0022); } }
    else if (b.kind === 'count') { bx(x - w / 2 + 0.004, x + w / 2 - 0.004, y - h / 2 + 0.004, y + h / 2 - 0.004, -0.08, -0.03, darkP, dg); stud(x - 0.02, y, -0.084); stud(x + 0.02, y, -0.084); wire(dg, [x - 0.02, y, -0.088], [0.08, y - 0.04, -0.09], whtM, 0.0022); }
    else if (b.kind === 'vr') { cyl(0.019, 0.03, M(0x6a4a2a, 0.2, 0.6), x, y, -0.045, 'z', dg, 20); for (const sx of [-0.012, 0, 0.012]) stud(x + sx, y - 0.022, -0.05); wire(dg, [x, y - 0.022, -0.054], [0.08, y - 0.06, -0.09], whtM, 0.0022); }
  });
  rec.push.forEach(p => { const [x, y] = P(p.x, p.y); cyl(0.013, 0.03, darkP, x, y, -0.045, 'z', dg, 14); bx(x - 0.015, x + 0.015, y - 0.02, y + 0.02, -0.095, -0.06, p.estop ? redM : grnM, dg); stud(x - 0.009, y + 0.014, -0.098); stud(x + 0.009, y + 0.014, -0.098); stud(x - 0.009, y - 0.014, -0.098); stud(x + 0.009, y - 0.014, -0.098); wire(dg, [x - 0.009, y - 0.014, -0.102], [0.08, y - 0.07, -0.09], p.estop ? redM : yelM, 0.0022); rows.add(Math.round(y * 5)); });
  wduct(dg, cx - 0.36, 1.2, -0.075, 1.9, true); rows.forEach(r => { const y = r / 5 - 0.12; if (y > 0.3) wduct(dg, cx + 0.1, y, -0.075, 0.5, false, 0.04); });
  bx(cx - 0.455, cx - 0.435, 0.1, 2.2, -0.05, -0.03, M(0xb89a3c, 0.8, 0.35), dg);     // 蝶番側の金具
  bx(cx - 0.455, cx + 0.45, 0.78, 0.8, -0.05, -0.03, M(0xb89a3c, 0.8, 0.35), dg);
  if (kind === 0) {   // 高圧配電盤の扉の裏（写真：スリット付き配線ダクト、端子台と黄色い配線、吊り下げた黒い箱、計器の背面、扉の開き止め）
    const silverM = M(0xa9aeb3, 0.7, 0.4), tie = M(0xf2f2ee, 0, 0.6);
    wduct(dg, 0.2, 1.25, -0.075, 1.6, true, 0.1);                                   // 縦ダクト
    bx(0.265, 0.295, 0.5, 1.95, -0.1, -0.04, darkP, dg);                              // 端子台
    for (let i = 0; i < 26; i++) { const y = 0.55 + i * 0.055; bx(0.262, 0.298, y, y + 0.02, -0.105, -0.095, i % 5 ? M(0xc9a24a, 0.8, 0.3) : tie, dg); wire(dg, [0.28, y + 0.01, -0.105], [0.23 + (i % 3) * 0.01, y - 0.02, -0.08]); wire(dg, [0.28, y + 0.01, -0.105], [0.14, y - 0.01, -0.08]); }
    wduct(dg, 0.58, 1.02, -0.09, 0.72, false, 0.11);                                // 横ダクト
    for (let i = 0; i < 16; i++) { const x = 0.26 + i * 0.045; wire(dg, [x, 1.08, -0.1], [x + 0.01, 0.98, -0.1]); }
    bx(0.38, 0.78, 0.52, 0.93, -0.32, -0.12, M(0x0d0e10, 0.2, 0.5), dg);               // 吊り下げた黒い箱
    bx(0.4, 0.76, 0.9, 0.95, -0.16, -0.1, silverM, dg);                                // 受け金具
    { const m = cyl(0.1, 0.26, M(0x121316, 0.3, 0.5), 0.72, 1.74, -0.18, 'z', dg, 32); cyl(0.085, 0.012, silverM, 0.72, 1.74, -0.315, 'z', dg, 32); }   // 計器の背面（丸い筒）
    for (let i = 0; i < 12; i++) wire(dg, [0.62, 1.55 + i * 0.012, -0.1], [0.66, 1.74, -0.2]);
    for (const y of [0.35, 0.45]) bx(0.5, 0.8, y, y + 0.05, -0.1, -0.06, silverM, dg);   // 取付け金具
    bx(0.62, 0.99, 2.2, 2.215, -0.22, -0.2, silverM, dg); cyl(0.012, 0.03, silverM, 0.62, 2.21, -0.21, 'z', dg, 10); cyl(0.012, 0.03, silverM, 0.99, 2.21, -0.21, 'z', dg, 10); // 開き止めの棒
    for (let k = 0; k < 8; k++) { const t = bx(0.19, 0.21, 0.6 + k * 0.17, 0.612 + k * 0.17, -0.12, -0.1, tie, dg); void t; }
  }
  const np = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.14), plateT([['盤銘板', 15], ['（教育用モデル）', 15]], 200, 90)); np.position.set(cx - 0.05, 0.5, -0.032); np.rotation.y = Math.PI; dg.add(np);
}
function buildCabinet(i, x, nm) {
  const tx = panelTex(nm, i), rec = tx.userData.rec, hingeX = x - 0.465, W = 0.93;
  // 盤の躯体（背板・側板・天板・底・前枠）
  bx(x - 0.47, x + 0.47, 0, 2.3, -3.38, -3.36, sheetM, pnl); bx(x - 0.47, x - 0.45, 0, 2.3, -4.88, -2.88, cream, pnl); bx(x + 0.45, x + 0.47, 0, 2.3, -4.88, -2.88, cream, pnl);
  bx(x - 0.47, x + 0.47, 0, 2.3, -4.88, -4.86, sheetM, pnl); bx(x - 0.45, x + 0.45, 2.28, 2.3, -4.88, -3.38, cream, pnl); bx(x - 0.45, x + 0.45, 0, 0.12, -4.88, -3.38, M(0xbdb8a5, 0.2, 0.7), pnl);
  bx(x - 0.47, x + 0.47, 2.28, 2.3, -3.38, -2.88, cream, pnl); bx(x - 0.47, x + 0.47, 0, 0.12, -3.38, -2.88, M(0xbdb8a5, 0.2, 0.7), pnl);
  bx(x - 0.47, x + 0.47, 2.25, 2.3, -2.9, -2.875, cream, pnl); bx(x - 0.47, x + 0.47, 0.1, 0.14, -2.9, -2.875, cream, pnl);
  const ig = new THREE.Group(); ig.position.set(x, 0, -3.36); pnl.add(ig); cabinetInside(ig, i);
  // 扉（表：計器・継電器・スイッチ／裏：計器の背面・配線）
  const dg = new THREE.Group(); dg.position.set(hingeX, 0, -2.875); pnl.add(dg); dg.userData.door = i;
  bx(0.0, W, 0.01, 2.29, -0.03, -0.002, cream, dg);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(W, 2.28), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.45 })); f.position.set(W / 2, 1.15, 0); dg.add(f);
  buildDevices(dg, 0.465, rec, 0);
  doorBack(dg, rec, 0.465, i);
  const d = { g: dg, cur: 0, target: 0, light: null };
  if (i >= 1) { const l = new THREE.PointLight(0xfff2dc, 0, 2.6, 1.6); l.position.set(x, 2.0, -3.0); pnl.add(l); d.light = l; }
  doors.push(d);
}

panelNames.forEach((nm, i) => buildCabinet(i, -8.3 + i * 0.95, nm));
// 盤の右隣（-z壁）：給気ガラリ、鋼製棚、灰色キャビネット、扉　／　盤の左端：ケーブルドラム（写真1・2より）
_hn = room.children.length;
const lv = new THREE.Group(); lv.position.set(-3.0, 3.0, -3.36); room.add(lv);
bx(-0.65, 0.65, -0.5, 0.5, -0.04, 0.04, M(0x6f8f96, 0.4, 0.6), lv);
for (let i = 0; i < 9; i++) bx(-0.6, 0.6, -0.45 + i * 0.105, -0.4 + i * 0.105, 0.04, 0.1, M(0xe0dccb, 0.2, 0.7), lv);
const rack = new THREE.Group(); rack.position.set(-9.3, 0, -3.08); room.add(rack);
const teal = M(0x79a59f, 0.4, 0.6);
for (const x of [-0.5, 0.5]) for (const z of [-0.28, 0.28]) bx(x - 0.03, x + 0.03, 0, 2.0, z - 0.03, z + 0.03, teal, rack);
for (const y of [0.6, 1.2, 1.8]) { bx(-0.5, 0.5, y, y + 0.05, -0.3, 0.3, teal, rack); bx(-0.42, 0.42, y + 0.05, y + 0.3, -0.25, 0.25, M(0x8fb0b0, 0.3, 0.6), rack); }
grab('wall', _hn);
_hn = room.children.length;
bx(-7.5, -6.6, 0, 0.3, -3.3, -2.7, M(0xf0f0ee, 0, 0.8), room);                  // 白い台
grab('small', _hn);
_hn = room.children.length;
bx(-8.75, -7.7, 0, 2.0, -3.4, -2.95, M(0xbfc3b8, 0.2, 0.7), room); bx(-8.22, -8.18, 0, 2.0, -2.97, -2.93, M(0x8a8e84), room); for (const x of [-8.28, -8.12]) bx(x - 0.01, x + 0.01, 0.95, 1.1, -2.98, -2.93, chrome, room);
bx(-5.95, -4.65, 0, 2.55, -3.4, -3.36, M(0xc8c4a8, 0, 0.9), room); bx(-5.8, -4.8, 0, 2.15, -3.36, -3.3, M(0xd2d3cd, 0.3, 0.6), room); bx(-5.31, -5.29, 0, 2.15, -3.3, -3.29, M(0x888c86), room); for (const x of [-5.36, -5.24]) bx(x - 0.01, x + 0.01, 1.0, 1.15, -3.31, -3.27, chrome, room);
{ const es = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.14), new THREE.MeshStandardMaterial({ map: canvasTex(256, 72, (g, w, h) => { g.fillStyle = '#1f7f3f'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('入口', w / 2, h / 2 + 2); }) })); es.position.set(-5.3, 2.35, -3.37 + 0.0); es.rotation.y = 0; room.add(es); }
{ const n2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.42), M(0xf2f2f0, 0, 0.8)); n2.position.set(-0.75, 1.55, -3.285); n2.rotation.y = Math.PI; n2.visible = false; room.add(n2); }
bx(0.2, 1.1, 0, 0.75, -3.4, -3.05, M(0xe9dfc0, 0.1, 0.7), room); for (let i = 0; i < 6; i++) bx(0.35, 0.95, 0.5 + i * 0.03, 0.52 + i * 0.03, -3.05, -3.04, M(0x9a9482), room); // 温風機
bx(0.0, 0.14, 1.9, 2.04, -3.4, -3.33, M(0xc0141a, 0, 0.5), room);               // 火災報知機
grab('wall', _hn);
_hn = room.children.length;
cyl(0.28, 0.25, M(0x1a1a1c), -3.6, 0.13, -3.0, 'y', room, 28); cyl(0.28, 0.25, M(0x1a1a1c), -3.6, 0.38, -3.0, 'y', room, 28); cyl(0.2, 0.32, M(0x1d6b40), -4.1, 0.16, -3.0, 'y', room, 20);
bx(-1.75, -1.35, 0, 0.25, -2.55, -2.15, M(0xd8a95a, 0, 0.9), room);               // 段ボール
bx(-1.25, -0.85, 0, 0.24, -2.45, -2.05, M(0x2b6dc4, 0, 0.7), room);               // 青いコンテナ
// 消火器・はしご台車（ステンレス）
for (const z of [3.2, 3.4]) cyl(0.07, 0.4, M(0xc0141a, 0.4, 0.4), -3.2, 0.2, z, 'y', room, 16);
for (const z of [3.05, 3.55]) bx(-3.65, -3.6, 0, 2.2, z - 0.02, z + 0.02, M(0xc8ccd0, 0.8, 0.3), room);
grab('small', _hn);

// ================= 内部構造（透視・断面で表示） =================
const inner = new THREE.Group(); inner.visible = false; rig.add(inner);
const CY = 1.55, CR = 0.1, CL = 0.38;
const metal = M(0xd0d4d8, 0.9, 0.25), copper = M(0xc2682a, 0.8, 0.35, { side: THREE.DoubleSide });
const linerMat = M(0x9aa4ab, 0.7, 0.4, { transparent: true, opacity: 0.45, side: THREE.DoubleSide });
const shaft = new THREE.Group(); shaft.position.set(-1.55, CY, 0); inner.add(shaft);   // 軸（発電機〜エンジン）
cyl(0.065, 2.1, M(0x8b9096, 0.9, 0.3), 0, 0, 0, 'x', shaft, 20);
bx(-1.0, 1.0, 0.055, 0.075, -0.012, 0.012, mat.red, shaft); // 回転が分かる目印
const crank = new THREE.Group(); crank.position.set(0.45, CY, 0); inner.add(crank);
cyl(0.045, 1.8, M(0x8b9096, 0.9, 0.3), 0, 0, 0, 'x', crank, 20);
bx(-0.9, 0.9, 0.04, 0.06, -0.01, 0.01, mat.red, crank);
const fw = new THREE.Group(); fw.position.set(-0.5, CY, 0); inner.add(fw);                   // フライホイール
cyl(0.4, 0.09, M(0x5d6268, 0.8, 0.4), 0, 0, 0, 'x', fw, 40);
for (let k = 0; k < 6; k++) { const sp = new THREE.Group(); sp.rotation.x = k * Math.PI / 3; fw.add(sp); bx(-0.05, 0.05, 0.1, 0.38, -0.025, 0.025, mat.yellow, sp); }
// 発電機内部：固定子コイルと回転子
const rotor = new THREE.Group(); rotor.position.set(-1.6, CY, 0); inner.add(rotor);
cyl(0.34, 1.0, M(0x6b7178, 0.8, 0.4), 0, 0, 0, 'x', rotor, 32);
for (let k = 0; k < 4; k++) { const pole = new THREE.Group(); pole.rotation.x = k * Math.PI / 2; rotor.add(pole); bx(-0.45, 0.45, 0.34, 0.5, -0.11, 0.11, k % 2 ? M(0x2255cc, 0.3, 0.5) : mat.red, pole); }
const statorC = cyl(0.56, 1.1, copper, -1.6, CY, 0, 'x', inner, 40); statorC.geometry = new THREE.CylinderGeometry(0.56, 0.56, 1.1, 40, 1, true); statorC.material = M(0xc2682a, 0.7, 0.4, { side: THREE.DoubleSide, transparent: true, opacity: 0.55 });
for (const x of [-2.15, -1.05]) { const tr = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 10, 40), copper); tr.rotation.y = Math.PI / 2; tr.position.set(x, CY, 0); tr.userData.ring = 1; inner.add(tr); }
// ピストン6本（直列6気筒）
const cylXs = [0, 1, 2, 3, 4, 5].map(i => -0.25 + i * 0.26);
const kOf = [0, 4, 2, 5, 1, 3]; // 点火順序 1-5-3-6-2-4
const cyls = cylXs.map((x, i) => {
  const liner = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.45, 24, 1, true), linerMat); liner.position.set(x, 1.98, 0); inner.add(liner);
  const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.1, 24), metal); inner.add(piston);
  const rod = new THREE.Mesh(new THREE.BoxGeometry(0.03, CL, 0.045), M(0xaab0b6, 0.9, 0.3)); inner.add(rod);
  const web = new THREE.Group(); web.position.set(x, CY, 0); inner.add(web);
  bx(-0.022, 0.022, -0.02, CR, -0.02, 0.02, M(0x777c82, 0.8, 0.4), web); bx(-0.03, 0.03, -0.17, -0.02, -0.04, 0.04, M(0x777c82, 0.8, 0.4), web);
  cyl(0.032, 0.07, M(0xbfc4c8, 0.9, 0.3), 0, CR, 0, 'x', web, 14);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff8a1a, transparent: true, opacity: 0, depthWrite: false })); inner.add(flash);
  return { x, piston, rod, web, flash, fire: kOf[i] * 2 * Math.PI / 3 };
});
// 冷却水・燃料・排気ガス（粒子で流れを表示）
const waterPath = new THREE.CatmullRomCurve3([[1.35, 1.0, 0.58], [0.5, 0.98, 0.58], [-0.2, 0.98, 0.58], [-0.3, 1.3, 0.3], [0.0, 1.9, 0.0], [0.6, 2.45, -0.35], [1.3, 2.35, 0.3], [1.55, 2.3, 0.3], [1.5, 1.9, 0.2], [1.5, 1.4, 0.55]].map(v => new THREE.Vector3(...v)), true);
const fuelPath = new THREE.CatmullRomCurve3([[2.85, 1.25, 2.3], [2.8, 0.65, 2.2], [1.9, 0.6, 1.8], [1.0, 0.6, 1.2], [0.55, 1.1, 0.8], [0.5, 1.6, 0.6]].map(v => new THREE.Vector3(...v)));
const gasPath = new THREE.CatmullRomCurve3([[0.2, 1.95, 0], [0.6, 2.25, -0.05], [0.95, 2.5, -0.05], [0.95, 3.2, -0.05], [0.95, 4.0, -0.05]].map(v => new THREE.Vector3(...v)));
function particles(n, color, size, parent, path, closed) {
  const arr = []; const geo = new THREE.SphereGeometry(size, 8, 6);
  for (let k = 0; k < n; k++) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false })); m.renderOrder = 5; m.userData.u = k / n; parent.add(m); arr.push(m); }
  return { arr, path, closed };
}
const fuelGroup = new THREE.Group(); fuelGroup.visible = false; gen.add(fuelGroup);
const pWater = particles(34, 0x4aa8ff, 0.028, inner, waterPath, true), pFuel = particles(22, 0xffd23a, 0.03, fuelGroup, fuelPath, false), pGas = particles(26, 0xff8a2a, 0.045, inner, gasPath, false);
// 部品ラベル
function sprite(text, x, y, z) {
  const t = canvasTex(256, 64, (g, w, h) => { g.fillStyle = 'rgba(10,20,30,0.85)'; g.fillRect(0, 0, w, h); g.strokeStyle = '#7fd'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4); g.fillStyle = '#fff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2); });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); sp.scale.set(0.62, 0.155, 1); sp.position.set(x, y, z); sp.renderOrder = 10; inner.add(sp); return sp;
}
sprite('ピストン', 0.38, 2.5, 0.3); sprite('クランク軸', 0.4, 1.25, 0.35); sprite('フライホイール', -0.5, 2.1, 0.3);
sprite('回転子（界磁）', -1.6, 2.35, 0.2); sprite('固定子コイル', -1.6, 0.85, 0.2); sprite('冷却水', 0.8, 0.8, 0.7); sprite('排気ガス', 1.5, 3.4, 0.2);
const fuelLabel = sprite('燃料', 1.0, 0.5, 1.2); fuelLabel.parent.remove(fuelLabel); fuelGroup.add(fuelLabel);

// 外殻の透過・断面（半分切る）
const shellMats = [], shellBase = new Set([mat.body, mat.light, mat.cover, mat.gray, mat.lag, mat.turbo]), cache = new Map();
const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
{
  const bb = new THREE.Box3();
  rig.traverse(o => {
    if (!o.isMesh || o.parent === inner || !shellBase.has(o.material) || o.geometry.type === 'TubeGeometry') return;
    bb.setFromObject(o); if (bb.max.y < 0.86 || o.parent && o.parent.parent === inner) return;
    let m = cache.get(o.material); if (!m) { m = o.material.clone(); cache.set(o.material, m); shellMats.push(m); } o.material = m;
  });
}
let xray = false, section = false;
// ---------- 発電機の外観：Blender で作ったモデルに差し替える（古い手作りの外観は隠す。内部の動く部品・天板の写真・燃料タンクは残す） ----------
rig.children.forEach(o => { if (o !== inner) o.visible = false; });
gen.children.forEach(o => { if (o.isMesh) o.visible = false; });
fan.visible = true; fan.children.forEach(o => { o.visible = false; }); fan.position.set(...GENSET.fan);
cage.visible = false; cp.children.forEach(o => { if (o !== desk) o.visible = false; });
cp.position.set(-1.775, 0, -1.2025); desk.rotation.x = -Math.atan2(0.625, 0.24); desk.position.set(0, 1.108, 0);
inner.position.set(-0.29, -0.30, 0);      // 新しい外観の軸の高さ・シリンダ位置に合わせる
cutPlane.constant = -0.7;                 // 断面は、発電機の軸を通る面で切る
loadGenset(out => {
  out.rig.forEach(o => rig.add(o)); out.static.forEach(o => gen.add(o)); out.fan.forEach(o => { o.userData.tip = 'fan'; fan.add(o); });
  Object.values(out.materials).forEach(m => { if (m.userData.cls === 'big' || m.userData.cls === 'small') shellMats.push(m); });
  applyView();
});
function applyView() {
  inner.visible = xray || section; fuelGroup.visible = inner.visible;
  shellMats.forEach(m => { m.transparent = xray; m.opacity = xray ? 0.16 : 1; m.depthWrite = !xray; m.clippingPlanes = section ? [cutPlane] : []; m.needsUpdate = true; });
  $('bi').classList.toggle('on', xray); $('bc').classList.toggle('on', section);
}

// ================= 音（Web Audio で合成） =================
let ac, au = {};
function audioInit() {
  if (ac) { ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination); au.master = master;
    const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = (f, type, q) => { const n = ac.createBufferSource(); n.buffer = nb; n.loop = true; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 1; const g = ac.createGain(); g.gain.value = 0; n.connect(fl); fl.connect(g); g.connect(master); n.start(); return { fl, g }; };
    au.o1 = ac.createOscillator(); au.o1.type = 'sawtooth'; au.lp = ac.createBiquadFilter(); au.lp.type = 'lowpass'; au.am = ac.createGain(); au.am.gain.value = 0.55; au.g1 = ac.createGain(); au.g1.gain.value = 0;
    au.o1.connect(au.lp); au.lp.connect(au.am); au.am.connect(au.g1); au.g1.connect(master); au.o1.start();
    au.lfo = ac.createOscillator(); au.lfoG = ac.createGain(); au.lfoG.gain.value = 0.45; au.lfo.connect(au.lfoG); au.lfoG.connect(au.am.gain); au.lfo.start();
    au.o2 = ac.createOscillator(); au.o2.type = 'triangle'; au.g2 = ac.createGain(); au.g2.gain.value = 0; au.o2.connect(au.g2); au.g2.connect(master); au.o2.start();
    au.mech = noise(900, 'bandpass', 0.8); au.fan = noise(1800, 'highpass', 0.7);
    au.os = ac.createOscillator(); au.os.type = 'sawtooth'; const sl = ac.createBiquadFilter(); sl.type = 'lowpass'; sl.frequency.value = 1400; au.gs = ac.createGain(); au.gs.gain.value = 0; au.os.connect(sl); sl.connect(au.gs); au.gs.connect(master); au.os.start();
  } catch (e) { ac = null; }
}
function audioUpdate() {
  if (!ac) return; const t = ac.currentTime, f = S.rpm / 60 * 3, k = Math.min(1, S.rpm / 1200), on = S.sound && S.rpm > 3;
  au.master.gain.setTargetAtTime(S.sound ? 0.8 : 0, t, 0.05);
  au.o1.frequency.setTargetAtTime(Math.max(f, 2), t, 0.05); au.lfo.frequency.setTargetAtTime(Math.max(f, 1), t, 0.05); au.o2.frequency.setTargetAtTime(Math.max(f * 2, 4), t, 0.05);
  au.lp.frequency.setTargetAtTime(160 + S.rpm * 0.35, t, 0.1);
  au.g1.gain.setTargetAtTime(on && S.mode !== 'crank' ? 0.3 * (0.35 + 0.65 * k) : on ? 0.08 : 0, t, 0.1); au.g2.gain.setTargetAtTime(on && S.mode !== 'crank' ? 0.07 * k : 0, t, 0.1);
  au.mech.g.gain.setTargetAtTime(on ? 0.1 * k : 0, t, 0.15); au.fan.g.gain.setTargetAtTime(on ? 0.06 * k * k : 0, t, 0.2);
  au.os.frequency.setTargetAtTime(110 + S.rpm * 2.2, t, 0.05); au.gs.gain.setTargetAtTime(S.mode === 'crank' ? 0.07 : 0, t, 0.1);
}

// ================= 運転シーケンス =================
const ease = x => x * x * (3 - 2 * x), clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const TXT = {
  stop: ['停止中', 'エンジンは止まっています。商用電源（電力会社）から受電中で、盤の「商用」ランプが点灯しています。', '「始動」で試験運転（無負荷）、「停電」で実際の停電時の流れを再現します。'],
  blackout: ['① 停電発生', '商用電源が止まりました。受電の電圧が下がり、不足電圧継電器（27）が検出します。', '照明が消える → 非常電源の出番です。盤面の「商用」ランプが消えます。'],
  crank: ['② 始動中（セルモータ）', '自動操作盤が始動指令を出し、セルモータ（始動用モータ）でエンジンを回しています。まだ燃焼していません。', '音に注目：「キュルル…」という始動モータの音。ピストンが動き、空気を圧縮しています（内部ボタンで確認）。'],
  accel: ['③ 着火・回転上昇', '燃料が噴射されて燃焼が始まり、回転が定格まで上がります。発電機の電圧が立ち上がります。', 'ピストン上でオレンジ色に光る＝燃焼。点火順序は 1-5-3-6-2-4。回転・電圧・周波数の針が上がります。※消防用の非常電源は、停電後40秒以内に電圧確立が必要（消防法施行規則 第12条）。'],
  run: ['④ 定格運転（無負荷）', '定格回転数・定格電圧に達しました。負荷にはまだつながっていません（試験運転の状態）。', '発電機盤で電圧・周波数（60Hz）を確認します。'],
  xfer: ['⑤ 電源の切換', '電源自動切換盤が、商用側（83C）を切って発電側（83B）を入れます。', '切換盤の83C/83Bランプが入れ替わります。'],
  supply: ['⑥ 非常電源として給電中', '発電機の電力が負荷（非常用照明・消防設備など）に供給されています。', '電圧・周波数・電流が安定しているか、発電機盤で確認します。燃料・冷却水・潤滑油の状態も監視します。'],
  stopping: ['停止中（復電・停止）', '商用電源が復旧し、負荷を商用側へ戻して発電機を停止しています。', '回転が下がり、盤の針も戻ります。機種によっては停止前に無負荷の冷却運転を行います。'],
};
function showStat() { const v = TXT[S.mode]; $('stt').textContent = v[0] + (h2.classList.contains('ex') ? '  ▾' : '  ▸ タップで説明'); $('std').textContent = v[1]; $('stw').textContent = '見どころ：' + v[2]; }
function go(m) { S.mode = m; S.t = 0; if (m === 'stopping') { S.rpm0 = S.rpm; S.volt0 = S.volt; } showStat(); }
function stepState(dt) {
  S.t += dt;
  switch (S.mode) {
    case 'blackout': if (S.t > 2.5) go('crank'); break;
    case 'crank': S.rpm = 150 * ease(Math.min(1, S.t / 2.5)); if (S.t >= 2.5) go('accel'); break;
    case 'accel': S.rpm = 150 + 1050 * ease(Math.min(1, S.t / 4)); S.volt = clamp((S.rpm - 800) / 400, 0, 1); if (S.t >= 4) go(S.auto ? 'xfer' : 'run'); break;
    case 'run': case 'supply': S.rpm = 1200 + 5 * Math.sin(vt * 3); S.volt = 1; break;
    case 'xfer': S.rpm = 1200; S.volt = 1; if (S.t > 1.5) { S.brk = true; go('supply'); } break;
    case 'stopping': { const k = Math.min(1, S.t / 3.5); S.rpm = S.rpm0 * (1 - ease(k)); S.volt = Math.max(0, S.volt0 * (1 - k * 1.6)); if (S.t >= 3.5) { S.rpm = 0; go('stop'); } break; }
    default: S.rpm = 0; S.volt = 0;
  }
}
const FIRE_MODES = ['accel', 'run', 'xfer', 'supply'];

// ================= UI =================
const css = document.createElement('style');
css.textContent = '.hud{position:fixed;color:#fff;font:13px/1.6 sans-serif;background:#000b;padding:8px 12px;border-radius:8px}.hud button{font-size:13px;padding:4px 8px;margin:2px;cursor:pointer}.hud button.on{background:#3a7;color:#fff}#hud2{left:12px;bottom:12px;max-width:640px}#stt{font-weight:bold;font-size:15px;color:#ffd866}#rd{color:#9fe;font-family:monospace}.hudtg{background:#1c3a46;color:#fff;border:1px solid #7fe0d0;border-radius:6px;font-weight:bold;display:block;width:100%;text-align:left}.hud.min{padding:4px}.hud.min .hb{display:none}.hud.min .hudtg{width:auto}#std,#stw{display:none}#hud2.ex #std,#hud2.ex #stw{display:block}#stt{cursor:pointer;padding:4px 0}@media (pointer:coarse){.hud button,.hud select{min-height:34px}}';
document.head.appendChild(css);
const h1 = document.createElement('div'); h1.className = 'hud'; h1.style.cssText = 'top:12px;left:12px';
h1.innerHTML = '<b>非常用発電機シミュレータ</b><br>ドラッグ:回転 / 右ドラッグ:移動 / ホイール:拡大<br>スマホ:2本指で移動・ピンチで拡大<br><label><input id=w type=checkbox checked> 機械室</label> <label><input id=a type=checkbox> 自動回転</label><br>' +
  '<button data-v=0>全体</button><button data-v=4>入口から</button><button data-v=5>蓄電池</button><button data-v=6>配電盤</button><button data-v=7>盤面アップ</button><button data-v=10>盤の下側</button><button data-v=11>操作盤の下側</button><button data-v=1>点検側</button><button data-v=2>操作盤側</button><button data-v=3>発電機端面</button><button data-v=8>内部を見る位置</button><button data-v=9>盤の内部</button>';
document.body.appendChild(h1);
const h2 = document.createElement('div'); h2.className = 'hud'; h2.id = 'hud2';
h2.innerHTML = '<b>運転</b> <button id=bs>▶ 始動（試験運転）</button><button id=bo>⚡ 停電→自動始動</button><button id=bx>■ 復電・停止</button> <label><input id=snd type=checkbox checked> 音</label> 速度<select id=spd><option value=0.02>超スロー</option><option value=0.05 selected>スロー</option><option value=0.12>普通</option></select><br>' +
  '<b>内部</b> <button id=bi>透かして見る</button><button id=bc>断面（半分切る）</button><br><span id=rd></span><div id=stt></div><div id=std></div><div id=stw style="color:#bdf"></div>';
document.body.appendChild(h2);
function $(id) { return document.getElementById(id); }
$('w').onchange = e => room.visible = e.target.checked;
$('a').onchange = e => controls.autoRotate = e.target.checked;
$('snd').onchange = e => { S.sound = e.target.checked; };
$('spd').onchange = e => { S.scale = +e.target.value; };
$('bs').onclick = () => { audioInit(); if (S.mode === 'stop') { S.auto = false; go('crank'); } };
$('bo').onclick = () => { audioInit(); if (S.mode === 'stop') { S.auto = true; S.mains = false; go('blackout'); } };
$('bx').onclick = () => { if (S.mode !== 'stop' && S.mode !== 'stopping') { S.mains = true; S.brk = false; S.auto = false; go('stopping'); } };
$('bi').onclick = () => { xray = !xray; applyView(); };
$('bc').onclick = () => { section = !section; applyView(); };
const views = [[[-5.6, 2.4, 5.2], [0, 1.4, 0]], [[-0.3, 1.9, 3.3], [-0.3, 1.5, 0]], [[-3.4, 1.8, -3.0], [-1.5, 1.1, -1.0]], [[-6.2, 1.9, 0.4], [-1, 1.5, 0]], [[-5.3, 1.65, -2.8], [0.5, 1.3, 1.0]], [[-1, 0.85, 1.25], [-1, 0.7, 2.7]], [[-6.3, 1.6, 1.0], [-9.8, 1.5, 1.0]], [[-8.2, 1.5, 1.25], [-9.8, 1.4, 1.25]], [[-0.4, 2.4, 6.4], [-0.6, 1.6, 0]], [[-7.4, 1.6, -0.2], [-9.9, 1.4, 0.1]]];
views.push([[-8.3, 0.55, -0.65], [-9.8, 0.55, -0.65]], [[-1.05, 0.5, -3.6], [-1.05, 0.5, -2.22]]);
h1.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { if (walk.on) setWalk(false); view(...views[b.dataset.v]); if (b.dataset.v === '9') { doors[3].target = OPEN; doors[4].target = OPEN; } });
// 注視点ごと移動するので、下側へ移ってから拡大できる。
const cameraPad = document.createElement('div');
cameraPad.innerHTML = '<span>視点移動 </span><button data-pan="left" aria-label="視点を左へ">←</button><button data-pan="up" aria-label="視点を上へ">↑</button><button data-pan="down" aria-label="視点を下へ">↓</button><button data-pan="right" aria-label="視点を右へ">→</button><button data-zoom="0.8">＋ 拡大</button><button data-zoom="1.25">− 縮小</button>';
h1.appendChild(cameraPad);
cameraPad.querySelectorAll('button').forEach(b => b.onclick = () => {
  if (walk.on) setWalk(false);
  fly = null;
  controls.autoRotate = false; $('a').checked = false;
  const offset = camera.position.clone().sub(controls.target);
  if (b.dataset.zoom) {
    offset.setLength(Math.max(controls.minDistance, offset.length() * Number(b.dataset.zoom)));
    camera.position.copy(controls.target).add(offset);
  } else {
    camera.updateMatrix();
    const vertical = ['up', 'down'].includes(b.dataset.pan);
    const sign = ['left', 'down'].includes(b.dataset.pan) ? -1 : 1;
    const shift = new THREE.Vector3().setFromMatrixColumn(camera.matrix, vertical ? 1 : 0)
      .multiplyScalar(sign * Math.max(0.04, offset.length() * 0.12));
    camera.position.add(shift); controls.target.add(shift);
  }
  controls.update();
});
h1.style.maxWidth = 'min(640px, calc(100vw - 48px))';
h1.style.maxHeight = '38vh'; h1.style.overflowY = 'auto';
cameraPad.querySelectorAll('button').forEach(b => { protectControl(b); b.style.minHeight = '44px'; b.style.minWidth = '44px'; });
scene.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) o.material.envMapIntensity = 0.5; });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
showStat();

// ================= タイトル画面・オプション =================
const css2 = document.createElement('style');
css2.textContent = `#ov{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,#0a1620cc 0%,#05090dee 100%);color:#fff;font-family:sans-serif;z-index:20;text-align:center}
#ov .ttl{padding:20px}#ov .sub{letter-spacing:.3em;color:#7fe0d0;font-size:13px;margin-bottom:10px}
#ov h1{margin:0 0 26px;font-size:clamp(30px,7vw,64px);line-height:1.15;letter-spacing:.08em;text-shadow:0 0 24px #2ad8c080,0 3px 0 #000}
#ov .btns{display:flex;flex-direction:column;gap:12px;align-items:center}
#ov .btns button{width:min(300px,80vw);padding:13px 0;font-size:19px;letter-spacing:.2em;border:1px solid #7fe0d0;background:#0e2a30cc;color:#e8fffb;border-radius:6px;cursor:pointer}
#ov .btns button:hover{background:#17555e}#ov .btns #tStart{background:#1f8f7a;font-weight:bold;font-size:22px}#ov .btns #tStart:hover{background:#27b89d}
#ov .cr{margin-top:28px;font-size:12px;color:#8aa}
#mod{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#000a;z-index:30;font-family:sans-serif}
#mod .box{background:#0f1d24;border:1px solid #7fe0d0;border-radius:10px;color:#fff;padding:18px 24px;max-width:min(560px,92vw);max-height:88vh;overflow:auto;line-height:1.8;font-size:14px}
#mod h2{margin:0 0 8px;font-size:18px;color:#7fe0d0}#mod label{display:block;margin:6px 0}#mod button{padding:8px 22px;margin-top:12px;font-size:15px;cursor:pointer}
#menuBtn{position:fixed;top:12px;right:12px;z-index:10;padding:8px 14px;font-size:14px;cursor:pointer;display:none}`;
document.head.appendChild(css2);
const ov = document.createElement('div'); ov.id = 'ov';
ov.innerHTML = '<div class=ttl><div class=sub>実機写真ベース 3D 教育用</div><h1>非常用発電機<br>シミュレータ</h1><div class=btns><button id=tStart>▶ スタート</button><button id=tHow>操作説明</button><button id=tOpt>⚙ オプション</button></div></div>';
document.body.appendChild(ov);
const mod = document.createElement('div'); mod.id = 'mod'; document.body.appendChild(mod);
const menuBtn = document.createElement('button'); menuBtn.id = 'menuBtn'; menuBtn.textContent = '☰ メニュー'; document.body.appendChild(menuBtn);
function showBatNote() { const cv = document.createElement('canvas'); cv.width = 1448; cv.height = 2048; window.__batNotePaint(cv.getContext('2d'), 1448, 2048); modal('<h2>蓄電池保守点検要領（壁の掲示）</h2><div id=batNoteImg style="max-height:62vh;overflow:auto;background:#8a8a86;padding:8px;border-radius:6px"></div><div style="margin-top:12px;font-size:12px;color:#9fc">※ 蓄電池の横に掲示してある要領を、紙の見た目に合わせて描いたものです（連絡先・会社名は省略）。数値は、この掲示の一例です。実際は、設置してある蓄電池の取扱説明書と、保安規程の点検基準に従ってください。</div>'); cv.style.cssText = 'width:100%;min-width:560px;display:block'; const d = document.getElementById('batNoteImg'); if (d) d.appendChild(cv); }
function modal(html) { mod.innerHTML = '<div class=box>' + html + '<div style="text-align:right"><button id=mClose>閉じる</button></div></div>'; mod.style.display = 'flex'; $('mClose').onclick = () => { mod.style.display = 'none'; }; }
let started = false; h1.style.display = h2.style.display = 'none'; controls.enabled = false; controls.autoRotate = true; controls.autoRotateSpeed = 0.7;
function enterTitle() { if (walk.on) setWalk(false); if (typeof dwBtn !== 'undefined') { dwBtn.style.display = dw.style.display = 'none'; } ov.style.display = 'flex'; menuBtn.style.display = 'none'; h1.style.display = h2.style.display = 'none'; controls.enabled = false; controls.autoRotate = true; if (!started) view(...views[0]); $('tStart').textContent = started ? '▶ つづける' : '▶ スタート'; }
function enterGame() { started = true; if (typeof dwBtn !== 'undefined') dwBtn.style.display = 'block'; ov.style.display = 'none'; menuBtn.style.display = 'block'; h1.style.display = h2.style.display = 'block'; controls.enabled = true; controls.autoRotate = $('a').checked; }
$('tStart').onclick = () => { audioInit(); enterGame(); };
menuBtn.onclick = enterTitle;
$('tHow').onclick = () => modal('<h2>操作説明</h2>・<b>ドラッグ</b>：画面を回す　<b>ホイール／ピンチ</b>：拡大縮小<br>・<b>右ドラッグ／2本指の移動／矢印ボタン</b>：見る中心を上下左右へ動かします。下側へ移動してから拡大できます。<br>・左上のボタン：見る場所を切り替えます（点検側、操作盤側、配電盤、内部を見る位置など）<br>・左下の「運転」：<b>始動（試験運転）</b>、<b>停電→自動始動</b>、<b>復電・停止</b><br>・「内部」：<b>透かして見る</b>／<b>断面（半分切る）</b>で、ピストンや回転子の動きが見えます<br>・画面下の説明に、いま何が起きているかが出ます<br>・音が出ます。気になるときは、オプションで切れます<br><span style="color:#9bd">※ 教育用の想像モデルです。内部構造や数値は実機と異なる場合があります。</span>');
$('tOpt').onclick = () => modal('<h2>オプション</h2><label><input id=o_snd type=checkbox ' + (S.sound ? 'checked' : '') + '> 音を鳴らす</label><label>動作の速さ <select id=o_spd><option value=0.02>超スロー</option><option value=0.05>スロー</option><option value=0.12>普通</option></select></label><label><input id=o_shd type=checkbox ' + (renderer.shadowMap.enabled ? 'checked' : '') + '> 影を表示（重いときは切る）</label><label><input id=o_hq type=checkbox ' + (renderer.getPixelRatio() > 1 ? 'checked' : '') + '> 高画質（重いときは切る）</label><label><input id=o_exp type=checkbox ' + ($('std').style.display !== 'none' ? 'checked' : '') + '> 解説文を表示</label>');
mod.addEventListener('change', e => {
  const t = e.target.id;
  if (t === 'o_snd') { S.sound = e.target.checked; $('snd').checked = S.sound; }
  if (t === 'o_spd') { S.scale = +e.target.value; $('spd').value = e.target.value; }
  if (t === 'o_shd') { renderer.shadowMap.enabled = e.target.checked; sun.castShadow = e.target.checked; scene.traverse(o => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(x => { x.needsUpdate = true; }); } }); }
  if (t === 'o_hq') renderer.setPixelRatio(e.target.checked ? Math.min(devicePixelRatio, 2) : 1), renderer.setSize(innerWidth, innerHeight);
  if (t === 'o_exp') { $('std').style.display = $('stw').style.display = e.target.checked ? '' : 'none'; }
});
mod.addEventListener('click', e => { if (e.target === mod) mod.style.display = 'none'; });
mod.addEventListener('transitionend', () => {});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (mod.style.display === 'flex') mod.style.display = 'none'; else if (started && ov.style.display === 'none') enterTitle(); } });
new MutationObserver(() => { const sel = $('o_spd'); if (sel) sel.value = String(S.scale); }).observe(mod, { childList: true });

// ================= 歩く視点（一人称） =================
const worker = createWorker(); scene.add(worker.root); worker.root.visible = false; window.__worker = worker;
const walk = { third: false, on: false, yaw: Math.PI + 0.5, pitch: -0.05, pos: new THREE.Vector3(-5.3, 1.65, -2.5), keys: {}, pad: { f: 0, s: 0 }, saved: null };
const BLOCKS = [[-3.1, 1.35, -1.5, 0.1], [-2.95, -1.25, -2.25, -1.4], [-0.8, 1.15, -2.55, -1.4], [-0.9, 1.1, 0.0, 1.1], [1.3, 3.5, -1.95, 0.55],
  [1.7, 3.3, 1.3, 3.0], [-2.0, 0.0, 2.1, 3.3], [0.15, 1.15, -3.4, -3.0], [-4.4, -3.4, 1.6, 2.2], [-3.8, -3.5, 2.2, 2.8], [-12.0, -9.5, -1.2, 3.65], [-9.85, -7.7, -3.4, -2.75], [-7.5, -6.6, -3.4, -2.75], [-4.4, -3.2, -3.4, -2.65]];
const ROOM = [-12.9, 3.5, -3.3, 4.5], PR = 0.28;
const hitAt = (x, z) => x < ROOM[0] || x > ROOM[1] || z < ROOM[2] || z > ROOM[3] || BLOCKS.some(b => x > b[0] - PR && x < b[1] + PR && z > b[2] - PR && z < b[3] + PR);
function walkStep(dt) {
  const k = walk.keys, run = k.ShiftLeft || k.ShiftRight ? 2.2 : 1;
  const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + walk.pad.f, sd = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + walk.pad.s;
  walk.yaw -= sd * 1.6 * dt;   // 左右：その場で回る
  const sp = 1.5 * run * dt, fx = -Math.sin(walk.yaw), fz = -Math.cos(walk.yaw);
  const before = walk.pos.clone();
  const dx = fx * f * sp, dz = fz * f * sp;
  if (!hitAt(walk.pos.x + dx, walk.pos.z)) walk.pos.x += dx; if (!hitAt(walk.pos.x, walk.pos.z + dz)) walk.pos.z += dz;
  const bob = f ? Math.sin(vt * 9 * run) * 0.012 : 0;
  worker.root.position.set(walk.pos.x, 0, walk.pos.z);
  worker.root.rotation.y = walk.yaw;
  worker.update(walk.pos.distanceTo(before));
  worker.root.visible = walk.third;
  if (walk.third) {
    const target = new THREE.Vector3(walk.pos.x, 1.1, walk.pos.z);
    // 背後が壁際なら斜め後ろ・横の空いている方向へ回す。
    let best = null;
    for (const angle of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]) {
      const offset = new THREE.Vector3(Math.sin(walk.yaw + angle) * 2.7,
        1.25 - walk.pitch * 1.2, Math.cos(walk.yaw + angle) * 2.7);
      let fraction = 1;
      for (let i = 1; i <= 50; i++) {
        const t = i / 50;
        if (hitAt(target.x + offset.x * t, target.z + offset.z * t)) {
          fraction = Math.max(0.02, (i - 1) / 50); break;
        }
      }
      if (!best || fraction > best.fraction) best = { offset, fraction };
      if (fraction >= 0.8) break;
    }
    camera.position.copy(target).addScaledVector(best.offset, best.fraction);
    camera.position.y = Math.max(camera.position.y, 2.15);
    camera.lookAt(target);

  } else {
    camera.position.set(walk.pos.x, 1.65 + bob, walk.pos.z); camera.rotation.set(walk.pitch, walk.yaw, 0, 'YXZ');
  }
}
function setWalk(on) {
  stopMovement();
  fly = null; worker.root.visible = on && walk.third; $('personView').style.display = on ? '' : 'none';
  walk.on = on; $('bw').textContent = on ? '🎥 全体の視点に戻る' : '🚶 歩く視点'; pad.style.display = on ? 'block' : 'none'; hint.style.display = on ? 'block' : 'none';
  if (on) { walk.saved = [camera.position.clone(), controls.target.clone()]; controls.enabled = false; controls.autoRotate = false; camera.fov = 68; camera.updateProjectionMatrix(); renderer.domElement.style.touchAction = 'none'; setTimeout(() => { hint.style.display = 'none'; }, 6000); }
  else { controls.enabled = true; camera.fov = 45; camera.updateProjectionMatrix(); camera.rotation.order = 'XYZ'; const sv = walk.saved || [new THREE.Vector3(-5.6, 2.4, 5.2), new THREE.Vector3(0, 1.4, 0)]; camera.position.copy(sv[0]); controls.target.copy(sv[1]); camera.up.set(0, 1, 0); camera.lookAt(sv[1]); controls.update(); }
}
const pad = document.createElement('div'); pad.className = 'hud'; pad.style.cssText = 'right:14px;bottom:14px;display:none;padding:6px';
pad.innerHTML = '<div style="display:grid;grid-template-columns:repeat(3,52px);grid-auto-rows:52px;gap:4px"><span></span><button data-p="f1">▲</button><span></span><button data-p="s-1">◀</button><button data-p="f-1">▼</button><button data-p="s1">▶</button></div><div style="font-size:11px;text-align:center;color:#bcd">▲▼：前後　◀▶：その場で回る</div>';
document.body.appendChild(pad);
function protectControl(b) {
  b.style.userSelect = 'none'; b.style.webkitUserSelect = 'none';
  b.style.touchAction = 'none'; b.style.webkitTouchCallout = 'none';
  for (const type of ['contextmenu', 'selectstart', 'dragstart']) b.addEventListener(type, e => e.preventDefault());
}
const movementStops = new Set();
function stopMovement() {
  movementStops.forEach(stop => stop());
  walk.keys = {}; walk.pad.f = walk.pad.s = 0;
}
addEventListener('blur', stopMovement);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopMovement(); });
pad.querySelectorAll('button').forEach(b => {
  const [t, v] = [b.dataset.p[0], +b.dataset.p.slice(1)];
  let pointer = null;
  protectControl(b); b.style.fontSize = '20px';
  const stop = e => {
    if (pointer === null || (e && e.pointerId !== pointer)) return;
    const id = pointer; pointer = null; walk.pad[t] = 0;
    if (b.hasPointerCapture(id)) b.releasePointerCapture(id);
  };
  movementStops.add(stop);
  b.addEventListener('pointerdown', e => {
    if (e.button !== 0 || pointer !== null) return;
    e.preventDefault(); stopMovement(); pointer = e.pointerId;
    b.setPointerCapture(pointer); walk.pad[t] = v;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave']) b.addEventListener(type, stop);
  for (const type of ['pointerup', 'pointercancel']) addEventListener(type, stop);
  b.addEventListener('pointermove', e => {
    const r = b.getBoundingClientRect();
    if (!e.buttons || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) stop(e);
  });
});
const hint = document.createElement('div'); hint.className = 'hud'; hint.style.cssText = 'left:50%;top:70px;transform:translateX(-50%);display:none;text-align:center;pointer-events:none';
hint.innerHTML = '<b>歩く視点</b><br>W／S（↑／↓）：前へ・後ろへ　A／D（←／→）：その場で左右に回る　Shift：小走り　<br>ドラッグ：見回す　画面右下のパッド（スマホ）';
document.body.appendChild(hint);
h1.insertAdjacentHTML('beforeend', '<br><button id=bw style="background:#2a6;color:#fff;font-weight:bold">🚶 歩く視点</button>');
pad.insertAdjacentHTML('afterbegin', '<button id=personView style="display:none">本人の目線 → 後ろから見る</button>');
$('personView').onclick = () => {
  stopMovement(); walk.third = !walk.third; walk.pitch = -0.05;
  $('personView').textContent = walk.third ? '後ろから見る → 本人の目線' : '本人の目線 → 後ろから見る';
};
protectControl($('personView'));
$('bw').onclick = () => setWalk(!walk.on);
addEventListener('keydown', e => { if (walk.on && !document.hidden && !e.target.closest('input,select,textarea,[contenteditable=true]')) { if (e.repeat && !walk.keys[e.code]) return; walk.keys[e.code] = true; if (/^(Arrow|Space)/.test(e.code)) e.preventDefault(); } if (e.key === 'Escape' && walk.on && mod.style.display !== 'flex') { /* メニューは既存処理 */ } });
addEventListener('keyup', e => { walk.keys[e.code] = false; });
{ let drag = false, lx = 0, ly = 0; const el = renderer.domElement;
  el.addEventListener('pointerdown', e => { if (walk.on) { drag = true; lx = e.clientX; ly = e.clientY; el.setPointerCapture(e.pointerId); } });
  el.addEventListener('pointermove', e => { if (walk.on && drag) { walk.yaw -= (e.clientX - lx) * 0.005; walk.pitch = Math.max(-1.2, Math.min(1.2, walk.pitch - (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY; } });
  movementStops.add(() => { drag = false; });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, () => { drag = false; }); }

// ================= 盤の扉：クリック／ボタンで開閉 =================
const OPEN = -1.85;
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
{ let dx = 0, dy = 0, t0 = 0; const el = renderer.domElement;
  el.addEventListener('pointerdown', e => { dx = e.clientX; dy = e.clientY; t0 = performance.now(); });
  el.addEventListener('pointerup', e => {
    if (Math.hypot(e.clientX - dx, e.clientY - dy) > 6 || performance.now() - t0 > 600 || ov.style.display !== 'none') return;
    const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); raycaster.setFromCamera(ndc, camera);
    if (raycaster.intersectObject(window.__batNoteObj, true).length) { showBatNote(); return; }
    for (const h of raycaster.intersectObjects(doors.map(d => d.g), true)) { let o = h.object; while (o && o.userData.door === undefined) o = o.parent; if (o) { const d = doors[o.userData.door]; d.target = d.target ? 0 : OPEN; break; } }
  }); }
h1.insertAdjacentHTML('beforeend', ' <button id=bd>🚪 盤の扉を開閉</button>');
// 邪魔な物を消すボタン（床の小物／壁・天井まわり）。見た目だけを消す。歩く視点の当たり判定は変えない。
h1.insertAdjacentHTML('beforeend', ' <button id=bhs>🧹 小物を消す</button><button id=bhw>🧱 壁を消す</button>');
for (const [id, k, t] of [['bhs', 'small', '小物'], ['bhw', 'wall', '壁']]) $(id).onclick = () => { const v = !hideSets[k][0].visible; hideSets[k].forEach(o => { o.visible = v; }); $(id).textContent = (k === 'small' ? '🧹 ' : '🧱 ') + t + (v ? 'を消す' : 'を戻す'); };
$('bd').onclick = () => { const c = doors.some(d => d.target === 0); doors.forEach(d => { d.target = c ? OPEN : 0; }); };

// ================= 設備の説明（収納できる引き出し） =================
const pz = i => 3.15 - 0.95 * i;
const INFO = [
  ['発電設備', [
    ['交流発電機', [[-5.2, 2.3, 2.4], [-1.6, 1.5, 0]], '役割：エンジンの回転力を電気に変えます。回転子（界磁）に直流を流して磁石にし、固定子コイルに交流が発生します。盤の銘板では 300kVA／210V／60Hz です。', '見る点：絶縁抵抗、異音・振動、端子箱のケーブルの緩みや変色（発熱）、通風ルーバーの詰まり。', '根拠：自家用電気工作物の保安は、電気事業法に基づく保安規程で定めます。'],
    ['ディーゼルエンジン', [[0.3, 2.3, 4.6], [0.2, 1.6, 0]], '役割：軽油の燃焼でピストンを動かし、クランク軸を回します。このモデルは直列6気筒の想定です。', '見る点：潤滑油の量と色、冷却水の量、燃料の量、配管のにじみ・漏れ、ベルトやホース、始動性、排気の色。', '補足：非常用は「いざという時にかかること」が一番大事です。消防用設備の非常電源は、消防法の点検（機器点検・総合点検）の対象です（細かい条文は要確認）。'],
    ['冷却ファン・ラジエータ', [[3.8, 2.2, 3.6], [2.0, 1.7, 0]], '役割：エンジンの冷却水の熱を、ファンの風で外へ逃がします。熱い空気は後ろの排気風洞から室外へ出ます。', '見る点：ファンガードと羽根の損傷、ベルトの張り、冷却水の漏れ、風洞のダンパが開くか。'],
    ['過給機・排気管', [[2.6, 3.1, 2.8], [0.95, 2.8, 0]], '役割：排気ガスの勢いでタービンを回し、空気を押し込んで出力を上げます。排気管は高温なので、保温材で巻いてあります。', '見る点：保温材の破れ、フランジの漏れ（すす）、蛇腹継手の損傷、排気の色。点検直後は火傷に注意。'],
    ['防振装置（空気ばね）', [[-1.0, 0.7, 2.8], [-1.3, 0.3, 0]], '役割：機械の振動を床に伝えないようにします。', '見る点：ゴムのひび・へたり、ボルトの緩み、機械の傾き。'],
    ['室内燃料タンク', [[1.0, 1.9, 4.9], [2.5, 1.4, 2.7]], '役割：エンジンに送る燃料（軽油）を貯めます。下の赤い配管が燃料の配管です。', '見る点：油面計と貯油量、漏れ、防油堤に油がたまっていないか、バルブが「常時開」の札どおりか。', '根拠：軽油は危険物です。貯蔵・取扱いは消防法の規制対象です（要確認）。'],
    ['蓄電池（始動・制御用）', [[-1, 0.85, 1.25], [-1, 0.7, 2.7]], '役割：セルモータの始動と、制御電源に使います。鉛蓄電池です。後ろの壁の掲示（蓄電池保守点検要領）は、タップすると全文が読めます。足元の黄色いマットは、電解液がこぼれた時の耐酸マットです。', '見る点：浮動充電中の総電圧（掲示の目安：2.20V／セル×セル数）、電解液面（減っていれば最高液面線まで精製水を補水）、外観の異常、端子の腐食と緩み。', '定期の保守（現場の掲示の目安）：3ヶ月に1回、均等充電（2.40V／セルで7〜8時間）と、全セルの電圧・比重・液温の測定。浮動充電電圧 2.20±0.05V／セル、比重 1.260±0.005（20℃）。比重の温度換算：D20 ＝ Dt ＋ 0.0007（t − 20）。規定値以下のセルがあれば、均等充電を行う。数値は、使う電池の取扱説明書で確認してください。', '12セル（6個×2列）。1番セルに「代表槽」の札があり、右端にプラスとマイナスの端子と、透明なカバー、太いケーブルがつながる。']]],
  ['機側の設備', [
    ['操作盤（デスク型）', [[-3.1, 1.8, -3.0], [-1.05, 1.1, -1.5]], '役割：機側の計器盤です。回転計、油圧計、水温計、切替スイッチがあります。', '見る点：始動時と運転中の油圧、水温、回転数。値を記録して、前回と比べます。'],
    ['金網ガード', [[-3.9, 1.7, -2.5], [-2.2, 1.0, -1.1]], '役割：発電機の側面で、回転部や端子に不用意に触れないようにします。', '見る点：施錠、扉の開閉、「危険」表示の状態。']]],
  ['配電盤', [
    ['高圧配電盤 GF2/GF1', [[-7.9, 1.6, pz(0)], [-9.8, 1.4, pz(0)]], '役割：高圧の配電盤です。青い銘板には「No1CCR変圧器盤」とあります。電流計、遮断器の操作スイッチ、過電流継電器があります。内部の真空遮断器（VCB、52F3／52F4）は、見本の形です。実機では扉を開けられません。', '見る点：電流計の指示、表示灯、継電器の動作表示（フラグ）。扉を開ける時は、感電に注意。'],
    ['補機盤', [[-7.9, 1.6, pz(1)], [-9.8, 1.4, pz(1)]], '役割：ポンプやヒータなど、補機の運転切換と電源の盤です。AC210V負荷とAC105V負荷の電圧計・電流計、表示窓があります。', '見る点：切替スイッチが「自動」の位置か、表示窓の警報、電圧・電流の値。スイッチの名称は、盤の銘板で確認してください。'],
    ['電源自動切換盤', [[-7.9, 1.6, pz(2)], [-9.8, 1.4, pz(2)]], '役割：停電を検出して、商用電源から発電機の電源へ自動で切り換えます。83Cが商用側、83Bが発電側です。', '見る点：切換試験（停電を模擬して切換時間を確認）、復電した時の戻り、表示灯。'],
    ['発電機盤', [[-7.9, 1.6, pz(3)], [-9.8, 1.4, pz(3)]], '役割：発電機の電圧、電流、周波数、電力、力率を監視します。運転時間計と運転度数、零相電圧計、温度計、発電機遮断器の表示灯があります。', '見る点：運転中の値が定格の範囲か（60Hz、定格電圧）、記録。保護継電器（51、59、64）の動作表示。'],
    ['自動操作盤', [[-7.9, 1.6, pz(4)], [-9.8, 1.4, pz(4)]], '役割：始動・停止の自動制御の盤です。状態表示、故障表示、43E（手動／試験／自動）、試験停止・試験始動、警報停止、故障復帰のボタンがあります。', '見る点：43Eが「常に自動」か、故障表示が出ていないか、試験始動で自動的に立ち上がるか。', '注意：点検後に「自動」へ戻し忘れると、停電時に発電機が始動しません。']]],
  ['保護継電器・試験部', [
    ['過電流継電器（51）', [[-8.0, 1.65, pz(0) + 0.03], [-9.8, 1.61, pz(0) + 0.03]], '役割：大きな電流が流れた時、遮断器を切ります。限時電流（A）、限時時間、瞬時電流（A）を整定します。', '見る点：整定値が整定表どおりか、動作表示器（フラグ）の履歴、動作特性試験（動作電流・動作時間）。盤の銘板「停電時実施」のとおり、試験は停電時に行います。', '根拠：電技 第14条（過電流からの電線・電気機械器具の保護対策）。'],
    ['不足電圧継電器（27）', [[-8.0, 0.75, pz(2) + 0.15], [-9.8, 0.55, pz(2) + 0.15]], '役割：電圧の低下（停電）を検出します。発電機の始動や電源切換のきっかけになります。', '見る点：整定電圧（V）と動作時間、試験スイッチでの動作確認、動作LED。'],
    ['過電圧継電器（59）', [[-8.0, 0.8, pz(3) - 0.15], [-9.8, 0.5, pz(3) - 0.15]], '役割：電圧が高くなりすぎた時に動作します。発電機の電圧制御が異常になった場合の保護です。', '見る点：整定電圧と動作時間、動作表示。'],
    ['地絡過電圧継電器（64）', [[-8.0, 0.5, pz(3)], [-9.8, 0.2, pz(3)]], '役割：零相電圧で、地絡（大地への漏れ）を検出します。', '見る点：整定電圧（％）と動作時間、動作表示。', '根拠：電技 第15条（地絡に対する保護対策）。'],
    ['試験端子（VT/CT）', [[-8.0, 0.6, pz(2) + 0.1], [-9.8, 0.1, pz(2) + 0.1]], '役割：継電器の試験をする時に、計器用変成器（VT／CT）の二次側を安全に切り離したり、試験電流・電圧をつなぐ端子です。', '注意：CTの二次側は、絶対に開放しないでください。高電圧が発生して危険です。VTの二次側は短絡しないでください。'],
    ['非常停止（5E）', [[-8.0, 0.95, pz(4) - 0.27], [-9.8, 0.75, pz(4) - 0.27]], '役割：緊急の時に、エンジンを止めます。', '見る点：押されたままになっていないか（押したままだと始動しません）。点検後は引いて復帰させます。']]],
];
const dwBtn = document.createElement('button'); dwBtn.id = 'dwBtn'; dwBtn.textContent = '📖 設備の説明'; document.body.appendChild(dwBtn);
const dw = document.createElement('div'); dw.id = 'dw'; document.body.appendChild(dw);
const css3 = document.createElement('style');
css3.textContent = '#dwBtn{position:fixed;top:52px;right:12px;z-index:10;padding:8px 14px;font-size:14px;cursor:pointer;display:none}#dw{position:fixed;top:92px;right:12px;width:min(370px,92vw);max-height:calc(100vh - 270px);overflow:auto;z-index:10;display:none;background:#0b1a22ee;color:#fff;border:1px solid #7fe0d0;border-radius:8px;font:13px/1.7 sans-serif;padding:8px 10px}#dw h4{margin:10px 0 4px;color:#7fe0d0;font-size:13px}#dw .it{display:block;width:100%;text-align:left;background:#133040;color:#fff;border:1px solid #2a5566;border-radius:5px;margin:3px 0;padding:6px 8px;font-size:13px;cursor:pointer}#dw .it.on{background:#1f7f6e}#dw .tx{background:#08141a;border-left:3px solid #7fe0d0;margin:2px 0 6px;padding:6px 10px;font-size:13px}#dw .hd{display:flex;justify-content:space-between;align-items:center;font-weight:bold}#dw .hd button{cursor:pointer}';
document.head.appendChild(css3);
dw.innerHTML = '<div class=hd><span>設備の説明</span><button id=dwClose>▲ 収納</button></div><div style="font-size:11px;color:#9cc">項目を押すと、説明が開いて、その設備の場所へ移動します。</div>' +
  INFO.map(([cat, items], ci) => '<h4>' + cat + '</h4>' + items.map(([nm, , ...tx], ii) => `<button class=it data-c=${ci} data-i=${ii}>${nm}</button><div class=tx data-t=${ci}-${ii} style="display:none">${tx.map(t => '<p style="margin:3px 0">' + t + '</p>').join('')}</div>`).join('')).join('') +
  '<div style="font-size:11px;color:#9cc;margin-top:8px">※ 教育用の説明です。実際の整定値・点検項目は、保安規程と現場の資料に従ってください。</div>';
window.__desk = { needles: deskNeedles, S };
function flyTo(p, t) { if (walk.on) setWalk(false); fly = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...p), t1: new THREE.Vector3(...t) }; }
dw.addEventListener('click', e => {
  const b = e.target.closest('.it'); if (!b) return;
  const ci = +b.dataset.c, ii = +b.dataset.i, box = dw.querySelector(`[data-t="${ci}-${ii}"]`), open = box.style.display === 'none';
  dw.querySelectorAll('.tx').forEach(x => { x.style.display = 'none'; }); dw.querySelectorAll('.it').forEach(x => x.classList.remove('on'));
  if (open) { box.style.display = 'block'; b.classList.add('on'); const v = INFO[ci][1][ii][1]; flyTo(v[0], v[1]); }
});
dw.style.display = 'none';
const dwSet = on => { dw.style.display = on ? 'block' : 'none'; dwBtn.textContent = on ? '📖 設備の説明（収納）' : '📖 設備の説明'; };
dwBtn.onclick = () => dwSet(dw.style.display === 'none'); $('dwClose').onclick = () => dwSet(false);

// ================= 部品にポインタを乗せる／タップで説明 =================
const TIPS = {
  shaft: ['シャフト（回転軸）', 'エンジンの回転を、発電機の回転子へ伝える太い軸です。エンジンと発電機は、この軸でまっすぐつながっています。回転数が決まると周波数が決まります。このモデルは、毎分1200回転・6極の想定です。周波数 ＝ 極数 × 回転数 ÷ 120 で、60Hz になります。'],
  crank: ['クランク軸', 'ピストンの上下運動を、回転運動に変える軸です。ピストンは、コンロッドという棒でつながっています。'],
  flywheel: ['フライホイール', '重い円盤です。エンジンの回転のむらをならして、なめらかに回します。始動時の勢いをためる役目もあります。'],
  piston: ['ピストン', '燃焼の圧力で、押し下げられる部品です。ディーゼルは、空気を強く圧縮して高温にし、そこに軽油を吹きかけて自然に着火させます（圧縮着火）。点火プラグはありません。6本が、1-5-3-6-2-4 の順に燃えます。'],
  liner: ['シリンダ（筒）', 'ピストンが上下する筒です。潤滑油の膜で、摩耗を防ぎます。潤滑油の量と色が、点検の目安になります。'],
  rotor: ['回転子（界磁）', '磁石の役目をします。励磁装置から直流を流して、電磁石にします。回転すると、回る磁界ができます。界磁電圧・界磁電流は、自動操作盤の計器で見られます。'],
  stator: ['固定子コイル', '銅線のコイルで、外側に固定されています。回転子の磁界が、コイルを横切ると、交流の電圧が発生します。これが、発電機の出力になります。'],
  water: ['冷却水', 'エンジンの熱を受け取って、ラジエータで冷やしながら循環します。見る点：水量、漏れ、水温計の値、ホースやベルトの状態。水温が上がりすぎると、自動操作盤に「水温過昇」の故障表示が出ます。'],
  fuel: ['燃料（軽油）', '燃料タンクから、フィルタ、噴射ポンプを通って、各シリンダへ高圧で噴射されます。見る点：油量、フィルタ、配管の漏れ、水の混入（水抜き）。'],
  gas: ['排気ガス', '燃焼後の高温のガスです。過給機のタービンを回して、消音器を通って屋外へ出ます。排気管は高温なので、保温材で巻いてあります。'],
  fan: ['冷却ファン', 'エンジンの回転で駆動して、ラジエータへ風を送り、冷却水の熱を逃がします。熱い空気は、後ろの排気風洞から室外へ出ます。見る点：羽根の損傷、ガードの状態、ベルトの張り。'],
};
function tipSet(o, key) { o.traverse(m => { if (m.isMesh) m.userData.tip = key; }); }
tipSet(shaft, 'shaft'); tipSet(crank, 'crank'); tipSet(fw, 'flywheel'); tipSet(rotor, 'rotor'); tipSet(statorC, 'stator'); inner.children.forEach(o => { if (o.userData.ring) o.userData.tip = 'stator'; }); tipSet(fan, 'fan');
cyls.forEach(c => { c.piston.userData.tip = 'piston'; c.rod.userData.tip = 'piston'; tipSet(c.web, 'crank'); });
inner.children.forEach(o => { if (o.isMesh && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.openEnded && o.geometry.parameters.radiusTop < 0.1) o.userData.tip = 'liner'; });
function hitTube(path, r, key, parent) { const m = new THREE.Mesh(new THREE.TubeGeometry(path, 60, r, 8, false), new THREE.MeshBasicMaterial({ visible: false })); m.userData.tip = key; parent.add(m); }
hitTube(waterPath, 0.07, 'water', inner); hitTube(fuelPath, 0.07, 'fuel', fuelGroup); hitTube(gasPath, 0.1, 'gas', inner);
const tipRay = new THREE.Raycaster(), tipV = new THREE.Vector2();
const tipEl = document.createElement('div');
tipEl.style.cssText = 'position:fixed;z-index:15;display:none;max-width:min(340px,86vw);background:#0b1a22f2;color:#fff;border:1px solid #7fe0d0;border-radius:8px;padding:8px 12px;font:13px/1.7 sans-serif;pointer-events:none';
document.body.appendChild(tipEl);
const visDeep = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
function tipPick(e) {
  if (ov.style.display !== 'none' || walk.on) return null;
  const r = renderer.domElement.getBoundingClientRect(); tipV.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); tipRay.setFromCamera(tipV, camera);
  const objs = []; [inner, fuelGroup, fan].forEach(g => { if (visDeep(g)) g.traverse(o => { if (o.isMesh && o.userData.tip && visDeep(o)) objs.push(o); }); });
  const PR = { piston: 1, crank: 1, flywheel: 1, shaft: 1, rotor: 2, liner: 3, fan: 3, water: 4, fuel: 4, gas: 4, stator: 5 };
  const hs = tipRay.intersectObjects(objs, false); if (!hs.length) return null;
  let best = hs[0]; for (const h of hs) if (PR[h.object.userData.tip] < PR[best.object.userData.tip]) best = h; return best.object.userData.tip;
}
function tipShow(k, x, y, pin) {
  const t = TIPS[k]; tipEl.innerHTML = '<b style="color:#ffd866">' + t[0] + '</b><br>' + t[1] + (pin ? '<div style="font-size:11px;color:#9cc;margin-top:4px">（別の場所をタップで閉じます）</div>' : '');
  tipEl.style.display = 'block'; const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  tipEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 14)) + 'px'; tipEl.style.top = Math.max(8, Math.min(innerHeight - h - 8, y + 14)) + 'px';
}
{ const el = renderer.domElement; let down = null;
  el.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || e.buttons) return; const k = tipPick(e); if (k) { tipShow(k, e.clientX, e.clientY); el.style.cursor = 'help'; } else { tipEl.style.display = 'none'; el.style.cursor = ''; } });
  el.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY, performance.now()]; });
  el.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6 || performance.now() - down[2] > 600) return;
    const k = tipPick(e); if (k) tipShow(k, Math.min(e.clientX, innerWidth - 360), Math.max(60, e.clientY - 120), true); else tipEl.style.display = 'none';
  }); el.addEventListener('pointerleave', () => { tipEl.style.display = 'none'; }); }
$('bc').insertAdjacentHTML('afterend', ' <span style="font-size:12px;color:#9fe">▶ 部品にポインタを乗せる／タップで説明</span>');

// ================= 継電器試験（PRT-3M／PRT-3TR を模した試験機） =================
// 銘板・パネル配置・端子名は、実機写真（銘板の結線図・操作の説明）に合わせています。
// 内部の挙動（電流の求め方、継電器の特性、判定値）は、教材用の簡略モデルです。
const OUTR = [5, 10, 30, 60, 130, 250], RSR = [0, 0.25, 0.5, 1, 2, 5], VRNG = [75, 150, 300], AMR = [0, 0.5, 1.5, 5, 15, 50];
const SELN = ['OC', 'OCG', 'DG', 'OV', 'UV', 'DVT'], MODEN = ['DVT', 'OPERATION CHECK', 'TIME MEASURING'], TRIPN = ['DC TRIP CONTACT', 'CT TRIP'], CNTN = ['OFF', '10S', '100S'];
const AMN = ['SHORT', '0.5', '1.5', '5', '15', '50'];
const RT = { open: false, plug: false, plugRev: true, earth: false, pbPol: false, polOK: false, nfb: false, mc: false, s1: false, s2: false, rangeV: 5, rs: 0, reg: 0, started: false, applied: false,
  fine: 0, sel: 5, mode: 0, trip: 1, vr: 2, io: 0, am: 0, cnt: 0, uvt: 1, s7: 0, tCount: 0, counting: false, over: false, tripped: false, lastOp: null,
  target: '51GF2', hasPower: false, polLamp: 'off', test: 'oc_pick', bad: false, iso: { outage: false, ctShort: false, ctLift: false, vtLift: false, tripLift: false, restored: [] }, leads: {}, rec: [], log: [], pt: 0,
  Iv: 0, Vv: 0, Ia: 0, Va: 0, needleA: 0, needleV: 0, rel: { op: false, acc: 0, armed: false, instTime: null }, dirty: true, hold: null, danger: 0, ex: {} };
const RDEF = {
  '51GF2': { type: 'ocr', panel: 0, name: '過電流継電器 51GF2', Is: 4, T300: 1.0, Iinst: 40, lever: '4' },
  '51GF1': { type: 'ocr', panel: 0, name: '過電流継電器 51GF1', Is: 4, T300: 1.0, Iinst: 40, lever: '4' },
  '51G': { type: 'ocr', panel: 3, name: '過電流継電器 51G（発電機盤）', Is: 5, T300: 0.8, Iinst: 50, lever: '3' },
  '27R1': { type: 'uvr', panel: 2, name: '不足電圧継電器 27R1', Vs: 80, T: 1.0 },
  '27R2': { type: 'uvr', panel: 2, name: '不足電圧継電器 27R2', Vs: 80, T: 1.0 },
  '27RR1': { type: 'ovr', panel: 2, name: '過電圧継電器 27RR1', Vs: 120, T: 1.0 },
  '27RR2': { type: 'ovr', panel: 2, name: '過電圧継電器 27RR2', Vs: 120, T: 1.0 },
  '59G': { type: 'ovr', panel: 3, name: '過電圧継電器 59G（発電機盤）', Vs: 125, T: 1.0 },
  // 64G：零相電圧の入力に試験電圧を入れて、過電圧継電器と同じ手順で試験する扱い（教材での簡略化）。整定 10%（110V 基準で 11V）・0.5秒は架空
  '64G': { type: 'ovr', panel: 3, name: '地絡過電圧継電器 64G（発電機盤・整定は架空）', Vs: 11, T: 0.5 },
};
const DEV = { good: { Is: 1.015, T: 1.03, Inst: 1.025, V: 1.006, TV: 1.02 }, bad: { Is: 1.12, T: 1.27, Inst: 1.22, V: 0.9, TV: 1.28 } };
const TOL = { op: 0.05, inst: 0.15, time: 0.10, timeMin: 0.05 };
const cur = () => RDEF[RT.target], devv = () => (RT.bad ? DEV.bad : DEV.good);
const Rtot = () => RSR[RT.rs] + 0.1;

// ---------- 試験機の置き場（盤の前） ----------
const tset = new THREE.Group(); room.add(tset);
const tableM = M(0xc2c6ca, 0.8, 0.35);
{ const top = bx(-0.35, 0.35, 0.74, 0.78, -0.62, 0.62, tableM, tset); for (const x of [-0.31, 0.31]) for (const z of [-0.58, 0.58]) bx(x - 0.015, x + 0.015, 0, 0.74, z - 0.015, z + 0.015, tableM, tset); bx(-0.3, 0.3, 0.2, 0.22, -0.58, 0.58, tableM, tset); void top; }
// 盤面の Canvas の解像度（表示用）。寄っても文字がぼやけないように、マウスの機種は3倍。タッチの機種はメモリを抑えて2倍。操作の座標は論理座標（1000×700／1000×720）のまま
const PANEL_SCALE = matchMedia('(pointer: coarse)').matches ? 2 : 3;
function mkUnit(W, H, name) {
  const cv = document.createElement('canvas'); cv.width = W * PANEL_SCALE; cv.height = H * PANEL_SCALE; cv.dataset.panelWidth = W; cv.dataset.panelHeight = H; cv.getContext('2d').scale(PANEL_SCALE, PANEL_SCALE);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  // パネルを天板と平行にし、ケースの足（ローカル z=-0.119）を机の上に載せる。
  const g = new THREE.Group(), tilt = new THREE.Group(); g.add(tilt); tilt.rotation.x = -Math.PI / 2; tilt.position.y = 0.119;
  const pw = 0.4, ph = pw * H / W;
  buildCase(tilt, pw, ph);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.25 })); pane.position.z = 0.001; pane.receiveShadow = true; tilt.add(pane);
  g.userData = { cv, tex, pane, pw, ph, W, H, name };
  return g;
}
const uM = mkUnit(1000, 700, 'PRT-3M'), uT = mkUnit(1000, 720, 'PRT-3TR');
tset.add(uM); tset.add(uT);
uM.rotation.y = uT.rotation.y = Math.PI / 2; uM.position.set(0, 0.78, 0.27); uT.position.set(0, 0.78, -0.27); // 盤に向かって、左が測定箱・右が電源箱（利用者の指示）
// 外したふた2枚（置き場所は推測：机の下の棚。内側を上にして置く。内側の白い紙は、結線図の貼り紙）
for (const z of [0.3, -0.3]) { const lid = new THREE.Group(); lid.position.set(0, 0.22, z); lid.rotation.y = Math.PI / 2; tset.add(lid);
  const w = 0.424, d = z > 0 ? 0.304 : 0.312, wall = M(0xa3957a, 0.25, 0.65);
  bx(-w / 2, w / 2, 0, 0.004, -d / 2, d / 2, wall, lid); for (const sx of [-1, 1]) bx(sx * w / 2 - 0.002, sx * w / 2 + 0.002, 0, 0.05, -d / 2, d / 2, wall, lid); for (const sz of [-1, 1]) bx(-w / 2, w / 2, 0, 0.05, sz * d / 2 - 0.002, sz * d / 2 + 0.002, wall, lid);
  const st = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.12), new THREE.MeshStandardMaterial({ map: canvasTex(400, 240, (g, W, H) => { g.fillStyle = '#eceee9'; g.fillRect(0, 0, W, H); g.strokeStyle = '#333'; g.lineWidth = 1.2; g.strokeRect(14, 14, W - 28, H - 28); g.strokeRect(30, 40, 150, 130); g.strokeRect(210, 40, 160, 90); for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(40, 60 + i * 18); g.lineTo(170, 60 + i * 18); g.stroke(); } g.fillStyle = '#222'; g.font = '13px sans-serif'; g.textAlign = 'center'; g.fillText('内部結線図（模式）', W / 2, 205); }), roughness: 0.7 })); st.rotation.x = -Math.PI / 2; st.position.set(0, 0.0045, 0); lid.add(st); }
tset.visible = false;
const tableBlock = [0, 0, 0, 0];
function placeSet() {
  if (!RT.open) return;
  const d = cur(), z = pz(d.panel); tset.position.set(-9.28, 0, z); tset.visible = true; leadGrp.visible = true;
  if (!BLOCKS.includes(tableBlock)) BLOCKS.push(tableBlock);
  tableBlock[0] = -9.65; tableBlock[1] = -8.9; tableBlock[2] = z - 0.65; tableBlock[3] = z + 0.65; RT.leadsDirty = true;
}
function termWorld(unit, px, py, pz = 0.012) { const u = unit.userData; const v = new THREE.Vector3((px / u.W - 0.5) * u.pw, (0.5 - py / u.H) * u.ph, pz); return u.pane.localToWorld(v); }

// ---------- パネルの絵（クリックできる範囲も同時に登録） ----------
let HIT = { M: [], T: [] };
const KB = '#111214';
// 彫刻文字（細い白のゴシック）
const EF = '"Helvetica Neue",Arial,"Noto Sans JP",sans-serif', WH = '#eceeed', OR = '#ff9d3a';
function lbl(g, t, x, y, px = 14, col = WH, al = 'center', bold) { g.fillStyle = col; g.font = (bold ? 'bold ' : '') + px + 'px ' + EF; g.textAlign = al; g.textBaseline = 'middle'; g.fillText(t, x, y); }
function ln(g, pts, w = 1.4, col = WH) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'butt'; g.lineJoin = 'miter'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); }
let PARTS = [];
// 部品を1つ置く：絵（2D）、立体（3D）、クリックできる範囲を、同じ定義から作る
function part(g, hits, p, hk, hr) { if (hk) { const h = { k: hk, id: p.id, x: p.x, y: p.y, r: hr || 30 }; hits.push(h); p.hit = h; } PARTS.push(p); paintPart(g, p); return p; }
const post = (g, hits, id, x, y, conn, col, r = 19) => part(g, hits, { t: 'post', id, x, y, r, conn, col }, 'term', 36);
const scr = (g, pts, r = 6) => pts.forEach(([x, y]) => part(g, null, { t: 'screw', key: x + '_' + y, x, y, r }));
// ロータリー：angles は「番号（idx）ごとの角度」。写真の刻印の並びに合わせるため、等間隔とは限らない
function knobRot(g, hits, id, x, y, r, idx, angles, labels, o = {}) {
  hits.push({ k: 'rot', id, x, y, r: r + (o.hr || 34), bodyRadius: r, angle: angles[idx], n: angles.length });
  angles.forEach((ang, i) => {
    const a = (ang - 90) * Math.PI / 180, lr = r + (o.lr || 22);
    if (labels && labels[i] != null) { const [t, col] = [].concat(labels[i]); lbl(g, t, x + Math.cos(a) * lr * (o.sx || 1), y + Math.sin(a) * lr, o.lf || 14, i === idx ? '#fff0b1' : (col || WH), 'center', i === idx); }
  });
  paintRotary(g, x, y, r, angles[idx]);
}
// 刻印が左右の列に並び、引き出し線でつまみにつながる形（SERIES RESISTOR・OUTPUT RANGE）
function colKnob(g, hits, id, x, y, r, idx, angles, cols) {
  for (const [i, t, lx, ly, col] of cols) { const a = (angles[i] - 90) * Math.PI / 180, left = lx < x, ex = x + Math.cos(a) * (r + 7), ey = y + Math.sin(a) * (r + 7), kx = left ? Math.min(ex - 10, lx + 34) : Math.max(ex + 10, lx - 34);
    lbl(g, t, lx, ly, 14.5, i === idx ? '#fff0b1' : (col || WH), left ? 'left' : 'right', i === idx); const tw = g.measureText(t).width + 6; ln(g, [[left ? lx + tw : lx - tw, ly], [kx, ly], [ex, ey]], 1.3); }
  knobRot(g, hits, id, x, y, r, idx, angles, null);
}
// MAX. CURRENT の表（罫線つき）
function maxTable(g, x, y, heads, rows, rh) { const cw = 31, w = cw * 2;
  g.strokeStyle = WH; g.lineWidth = 1.1; g.strokeRect(x, y, w, 15); g.strokeRect(x, y + 15, w, 15 + rows.length * rh); ln(g, [[x + cw, y + 15], [x + cw, y + 30 + rows.length * rh]], 1.1); ln(g, [[x, y + 30], [x + w, y + 30]], 1.1);
  lbl(g, 'MAX. CURRENT', x + w / 2, y + 8, 7.6); heads.forEach((t, i) => lbl(g, t, x + cw * (i + 0.5), y + 23, 7.6));
  rows.forEach((r, k) => { if (k) ln(g, [[x, y + 30 + k * rh], [x + w, y + 30 + k * rh]], 0.9); r.forEach((t, i) => { lbl(g, t, x + cw * (i + 0.5) - (k ? 0 : 2), y + 30 + (k + 0.5) * rh, 10.5); if (!k) lbl(g, 'A', x + cw * (i + 0.5) + 11, y + 30 + rh * 0.32, 6.5); }); });
}
function plate(g, W, H) { g.clearRect(0, 0, W, H); const b = g.createLinearGradient(0, 0, W, H); b.addColorStop(0, '#16181a'); b.addColorStop(0.5, '#0e1012'); b.addColorStop(1, '#131517'); g.fillStyle = b; g.fillRect(0, 0, W, H); g.strokeStyle = '#2c3033'; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2); }
function nameplate(g, x, y, unit, x2) {
  g.strokeStyle = OR; g.lineWidth = 1.4; g.beginPath(); g.arc(x - 118, y + 2, 9, 0, 7); g.stroke(); g.beginPath(); g.arc(x - 118, y + 2, 5.2, 0, 7); g.stroke(); g.fillStyle = OR; g.beginPath(); g.arc(x - 118, y + 2, 2, 0, 7); g.fill();
  lbl(g, '.DTL ,.OC CIRTCELE NISSIN', x, y, 14.5, OR, 'center', true); lbl(g, 'NAPAJ OTOYK', x, y + 14, 7.5, OR);
  lbl(g, unit, x2, y + 2, 20, OR);
}
function meterFace(g, x, y, w, h, unit, rows, active, val, label, over) {
  paintMeter(g, x, y, w, h, unit, rows, active, val, label, over, uM);
}
const LC = { R: '#ff4d3d', T: '#f2f2f2', E: '#3fd163', T1: '#4aa8ff', T2: '#b07bff', P1: '#ffb52e', P2: '#c58b3a' };
// 角度の表（写真の刻印の並び）。番号（idx）は RT の値と同じ
const ANG = { mode: [-48, 0, 48], vr: [50, 3, -50], io: [-42, 0, 42], am: [-92, 85, 50, 15, -25, -60], sel: [-92, -62, -28, 8, 42, 85], rs: [80, 55, 25, -25, -55, -80], outr: [-80, -55, -25, 25, 55, 80] };
// 左から右への並び順（つまみの左半分で左へ、右半分で右へ動かすため）
const ROT_ORDER = Object.fromEntries(Object.entries(ANG).map(([k, a]) => [k, a.map((v, i) => i).sort((p, q) => a[p] - a[q])]));
const REG = { reg: [-167, 334], fine: [-150, 300] };
const regAngle = k => REG[k][0] + REG[k][1] * RT[k] / 10;
function drawM() {
  const g = uM.userData.cv.getContext('2d'), hits = HIT.M = [], c = RT.leads; PARTS = [];
  plate(g, 1000, 700);
  scr(g, [[495, 10], [836, 9], [12, 500], [986, 498], [138, 688], [545, 688], [852, 688]]);
  // 上段：補助コネクタ、TRIP（T1・T2）、V.OUTPUT（P1・(E)P2）、COUNTER、電流出力（R・T・E）、PL2、MC
  part(g, null, { t: 'conn', key: 'aux', x: 62, y: 58, r: 25, pins: 8, square: true });
  [['T1', 161, 'T1'], ['T2', 224, 'T2'], ['P1', 287, 'P1'], ['P2', 349, '(E)P2']].forEach(([id, x, t]) => { post(g, hits, id, x, 44, c[id], LC[id]); lbl(g, t.replace(/(\d)$/, ''), x - (t.length > 2 ? 0 : 4), 84, 17); if (/\d$/.test(t)) lbl(g, t.slice(-1), x + (t.length > 2 ? 21 : 8), 88, 11); });
  ln(g, [[134, 70], [134, 101], [170, 101]]); ln(g, [[214, 101], [252, 101], [252, 70]]); lbl(g, 'TRIP', 192, 101, 12);
  ln(g, [[262, 70], [262, 101], [280, 101]]); ln(g, [[356, 101], [378, 101], [378, 70]]); lbl(g, 'V.OUTPUT', 318, 101, 12);
  ln(g, [[466, 26], [420, 26], [420, 112], [408, 124], [408, 214], [584, 214], [584, 124], [572, 112], [572, 26], [534, 26]]); lbl(g, 'COUNTER', 500, 26, 15);
  lbl(g, 'RANGE', 465, 46, 12); lbl(g, '100S', 465, 60, 12); lbl(g, 'OFF', 437, 92, 12); lbl(g, '10S', 465, 116, 12);
  part(g, hits, { t: 'tog', id: 'cntR', x: 465, y: 88, r: 7, st: RT.cnt === 2 ? 1 : RT.cnt === 1 ? -1 : 0 }, 'tog', 48);
  lbl(g, 'RESET', 522, 62, 12); part(g, hits, { t: 'btn', id: 'pb4', x: 522, y: 84, r: 9, down: RT.hold === 'pb4' }, 'btn', 40);
  scr(g, [[430, 76], [562, 74], [430, 240], [562, 240]], 5);
  // カウンタの表示窓（紫がかった窓。数字は7セグメント風）
  g.fillStyle = '#1c0d22'; g.fillRect(424, 128, 144, 58); g.strokeStyle = '#3b2146'; g.lineWidth = 2; g.strokeRect(424, 128, 144, 58);
  { const t = RT.tCount, txt = RT.cnt === 0 ? '' : RT.over ? '-----' : (RT.cnt === 1 ? t.toFixed(3) : t.toFixed(2)).padStart(6, ' '); g.font = 'italic bold 34px "DSEG7 Classic","Courier New",monospace'; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillStyle = '#3a1c40'; if (RT.cnt) g.fillText('88.888', 562, 158); g.fillStyle = '#ff4a8a'; g.shadowColor = '#ff4a8a'; g.shadowBlur = 6; g.fillText(txt, 562, 158); g.shadowColor = 'transparent'; }
  lbl(g, 'OVER', 426, 196, 9.5, WH, 'left'); lbl(g, 'RANGE', 426, 206, 9.5, WH, 'left'); lbl(g, 'SEC', 566, 198, 10, WH, 'right'); if (RT.over) { g.fillStyle = '#ff4a8a'; g.beginPath(); g.arc(470, 201, 3, 0, 7); g.fill(); }
  [['R', 659], ['T', 724], ['E', 786]].forEach(([id, x]) => { post(g, hits, id, x, 44, id === 'T' ? false : c[id], LC[id]); lbl(g, id, id === 'E' ? x : x + (id === 'R' ? -22 : 22), 82, 17); });
  ln(g, [[645, 82], [650, 82], [650, 94], [676, 94]]); ln(g, [[706, 94], [733, 94], [733, 82], [738, 82]]);
  ln(g, [[630, 70], [630, 108], [812, 108], [812, 70]]);
  part(g, hits, { t: 'tog', id: 's7', x: 691, y: 92, r: 6.5, dir: 'h', st: RT.s7 === 0 ? -1 : 1 }, 'tog', 34);
  part(g, null, { t: 'lamp', key: 'pl2', x: 838, y: 50, r: 11, on: RT.hasPower && RT.mc, col: '#ff5a20' }); lbl(g, 'PL', 836, 88, 15); lbl(g, '2', 851, 92, 10);
  part(g, hits, { t: 'conn', id: 'mcM', x: 926, y: 54, r: 44, pins: 6, on: RT.mc }, 'tog', 46); lbl(g, 'MC', 884, 100, 15);
  // メーター（左：電圧計、右：電流計）
  const vmax = VRNG[RT.vr], amax = AMR[RT.am] || 50;
  meterFace(g, 44, 127, 320, 160, 'V', VRNG, RT.vr, RT.needleV, '', RT.Vv > vmax * 1.08);
  meterFace(g, 636, 127, 320, 160, 'A', [0.5, 1.5, 5, 15, 50], RT.am - 1, RT.needleA, '', RT.am > 0 && RT.Iv > amax * 1.08);
  // 中央：動作確認ランプ、TEST MODE、TRIP MODE
  part(g, null, { t: 'lamp', key: 'pl3', x: 506, y: 264, r: 8, on: RT.pl3, col: '#ffe35a', clear: true });
  ln(g, [[494, 268], [476, 268], [470, 276], [470, 284]]); lbl(g, 'OPERATION', 474, 292, 11.5); lbl(g, 'CHECK', 474, 305, 11.5);
  lbl(g, 'DVT', 426, 320, 11.5, OR); lbl(g, '(耐電圧)', 424, 333, 9, OR); ln(g, [[440, 320], [447, 320], [451, 326]], 1.2);
  ln(g, [[489, 326], [493, 320], [500, 320]], 1.2); lbl(g, 'TIME', 503, 320, 11.5, WH, 'left'); lbl(g, 'MEASURING', 497, 333, 10, WH, 'left');
  knobRot(g, hits, 'mode', 470, 356, 25, RT.mode, ANG.mode, null, { hr: 26 });
  lbl(g, 'DC TRIP', 572, 300, 11); lbl(g, 'CONTACT', 572, 312, 11); lbl(g, 'CT TRIP', 572, 378, 11);
  part(g, hits, { t: 'tog', id: 'trip', x: 572, y: 344, r: 7, st: RT.trip === 0 ? 1 : -1 }, 'tog', 42);
  lbl(g, 'TEST  MODE', 462, 414, 14.5); lbl(g, 'TRIP  MODE', 560, 414, 14.5);
  // 下段
  lbl(g, 'TEST', 38, 538, 12.5); lbl(g, 'NORMAL', 42, 608, 12.5); part(g, hits, { t: 'tog', id: 'uvt', x: 38, y: 572, r: 7.5, st: RT.uvt === 0 ? 1 : -1 }, 'tog', 44); lbl(g, 'UV  TIME', 54, 650, 15);
  lbl(g, 'DVT', 143, 503, 10.5, OR); knobRot(g, hits, 'vr', 140, 578, 34, RT.vr, ANG.vr, ['75', '150', '300'], { lf: 13.5, lr: 24, hr: 30 }); lbl(g, 'VOLTMETER', 140, 640, 15); lbl(g, 'RANGE (V)', 140, 657, 15);
  knobRot(g, hits, 'io', 268, 572, 26, RT.io, ANG.io, ['0.5', '0.9', '1.2'], { lf: 13, lr: 22, hr: 26 });
  ln(g, [[262, 606], [262, 660], [300, 660]]); lbl(g, 'Io  RANGE (A)', 350, 660, 14.5); ln(g, [[400, 660], [436, 660], [436, 648]]);
  // FINE（大きな丸つまみ。白い円弧と、回す向きの矢印）
  g.strokeStyle = WH; g.lineWidth = 2; g.beginPath(); g.arc(443, 560, 76, (-150 - 90) * Math.PI / 180, (150 - 90) * Math.PI / 180); g.stroke();
  { const a = 60 * Math.PI / 180, ax = 443 + Math.cos(a) * 76, ay = 560 + Math.sin(a) * 76; g.fillStyle = WH; g.beginPath(); g.moveTo(ax + 3, ay + 9); g.lineTo(ax - 8, ay - 2); g.lineTo(ax + 7, ay - 5); g.fill(); g.beginPath(); g.arc(443 + Math.cos(2.094) * 76, 560 + Math.sin(2.094) * 76, 3.5, 0, 7); g.fill(); }
  hits.push({ k: 'reg', id: 'fine', x: 443, y: 560, r: 74, bodyRadius: 62, angle: regAngle('fine') }); paintRotary(g, 443, 560, 62, regAngle('fine'), true); lbl(g, 'FINE', 443, 647, 15);
  knobRot(g, hits, 'am', 667, 566, 34, RT.am, ANG.am, AMN, { lf: 13, lr: 25, sx: 1.12, hr: 34 }); lbl(g, 'AMMETER', 667, 638, 15); lbl(g, 'RANGE (A)', 667, 655, 15);
  knobRot(g, hits, 'sel', 882, 566, 36, RT.sel, ANG.sel, ['OC', 'OCG', 'DG', 'OV', 'UV', ['DVT', OR]], { lf: 13, lr: 25, sx: 1.1, hr: 34 }); lbl(g, '(耐電圧)', 950, 583, 9, OR); lbl(g, 'TEST  SELECT', 880, 650, 15.5);
  nameplate(g, 400, 683, 'METER UNIT : PRT-3M', 700);
  syncTesterControls(uM, hits, 'M'); syncTesterParts(uM, PARTS, 'M'); uM.userData.tex.needsUpdate = true;
}
function drawT() {
  const g = uT.userData.cv.getContext('2d'), hits = HIT.T = []; PARTS = [];
  plate(g, 1000, 720);
  scr(g, [[14, 128], [470, 22], [706, 24], [986, 122], [200, 164], [372, 70], [352, 374], [444, 428], [540, 318], [650, 290], [596, 344], [826, 214], [880, 200], [100, 424], [226, 420], [24, 520], [200, 650], [540, 650], [788, 664], [985, 512], [160, 716], [498, 714], [840, 712]], 5.5);
  // 左上：MC、ヒューズ
  part(g, hits, { t: 'conn', id: 'mc', x: 72, y: 62, r: 52, pins: 6, on: RT.mc }, 'tog', 54); lbl(g, 'MC', 132, 104, 15);
  part(g, null, { t: 'fuse', key: 'f1', x: 262, y: 40, r: 15 }); lbl(g, 'AC250V  1A', 272, 74, 11.5);
  // 右上：補助電源（DC110V・AC110V）
  part(g, null, { t: 'fuse', key: 'f2', x: 556, y: 32, r: 13 }); lbl(g, '0.2A', 556, 66, 11);
  post(g, hits, 'dcm', 620, 32, false, '', 17); post(g, hits, 'dcp', 682, 32, false, '', 17); lbl(g, '−', 620, 68, 17); lbl(g, '+', 682, 68, 17);
  ln(g, [[546, 56], [536, 56], [536, 172], [594, 172]]); ln(g, [[656, 172], [705, 172], [705, 56], [698, 56]]); lbl(g, 'DC110V', 625, 173, 14.5);
  lbl(g, 'ON', 653, 86, 11); lbl(g, 'OFF', 620, 112, 11); part(g, hits, { t: 'tog', id: 's2', x: 653, y: 110, r: 7, st: RT.s2 ? 1 : -1 }, 'tog', 48); lbl(g, 'TIME', 653, 140, 10.5); lbl(g, 'MEASURING', 653, 152, 10.5);
  post(g, hits, 'X', 750, 32, false, '', 17); post(g, hits, 'Y', 820, 32, false, '', 17); lbl(g, 'X', 750, 68, 15); lbl(g, '(E)Y', 820, 68, 15);
  ln(g, [[740, 56], [733, 56], [733, 172], [752, 172]]); ln(g, [[818, 172], [836, 172], [836, 56], [830, 56]]); lbl(g, 'AC110V', 785, 173, 14.5);
  lbl(g, 'ON', 782, 86, 11); lbl(g, 'OFF', 782, 138, 11); part(g, hits, { t: 'tog', id: 's1', x: 782, y: 110, r: 7, st: RT.s1 ? 1 : -1 }, 'tog', 48);
  lbl(g, 'AUX.  SOURCE', 722, 196, 14.5);
  // 右端：接地端子、極性確認、差し込み口、PL1、POWER
  { const p = part(g, hits, { t: 'earth', id: 'earth', x: 956, y: 28, r: 13, conn: RT.earth, col: LC.E }, 'term', 38); void p; ln(g, [[984, 36], [984, 46]], 1.4); for (const [w, yy] of [[9, 46], [6, 50], [3, 54]]) ln(g, [[984 - w, yy], [984 + w, yy]], 1.4); }
  { const on = RT.polLamp === 'bright' || RT.polLamp === 'dim'; part(g, null, { t: 'lamp', key: 'pol', x: 936, y: 76, r: 9, on, dim: RT.polLamp === 'dim', col: RT.polLamp === 'dim' ? '#a8763a' : '#ffd070', clear: true });
    ln(g, [[900, 80], [916, 80]], 1.2); g.strokeStyle = WH; g.lineWidth = 1.2; g.beginPath(); g.arc(908, 80, 5, Math.PI, 0); g.stroke(); for (const a of [-2.5, -1.57, -0.64]) ln(g, [[908 + Math.cos(a) * 7, 80 + Math.sin(a) * 7], [908 + Math.cos(a) * 11, 80 + Math.sin(a) * 11]], 1.1); }
  lbl(g, 'SOURCE POLARITY', 928, 101, 10.5); lbl(g, 'CHECK', 934, 114, 10.5); lbl(g, 'PUSH', 908, 146, 11.5);
  part(g, hits, { t: 'btn', id: 'pb1', x: 956, y: 140, r: 10, down: RT.pbPol }, 'btn', 40);
  part(g, hits, { t: 'sock', id: 'plug', x: 920, y: 262, w: 46, h: 72, on: RT.plug }, 'tog', 42); lbl(g, 'E', 884, 292, 14); lbl(g, 'SOURCE', 922, 322, 14.5); lbl(g, 'AC110V', 922, 339, 14.5);
  part(g, null, { t: 'lamp', key: 'pl1', x: 916, y: 412, r: 11, on: RT.nfb && RT.plug, col: '#ff5a20' }); lbl(g, 'PL', 914, 446, 15); lbl(g, '1', 928, 450, 10);
  lbl(g, 'ON', 922, 500, 11.5); part(g, hits, { t: 'nfb', id: 'nfb', x: 926, y: 556, w: 26, h: 62, on: RT.nfb }, 'tog', 48); lbl(g, '15A', 950, 590, 7.5, '#e8d44a'); lbl(g, 'OFF', 928, 612, 11.5); lbl(g, 'POWER', 930, 664, 15);
  // 左：SERIES RESISTOR と MAX. CURRENT の表
  lbl(g, '(Ω)', 178, 204, 13.5);
  maxTable(g, 20, 178, ['30SEC', 'CONT.'], [['30', '12'], ['20', '8'], ['10', '5']], 23); maxTable(g, 276, 178, ['CONT.', '30SEC'], [['20', '50'], ['20', '50']], 23);
  colKnob(g, hits, 'rs', 170, 284, 42, RT.rs, ANG.rs, [[3, '1', 92, 220], [4, '2', 92, 243], [5, '5', 92, 266], [2, '0.5', 270, 220], [1, '0.25', 270, 243], [0, '0', 252, 266]]);
  lbl(g, 'SERIES  RESISTOR', 176, 360, 15.5);
  // 左下：START／STOP
  part(g, hits, { t: 'btn', id: 'start', big: true, x: 90, y: 508, r: 38, col: '#149a63', colLit: '#39f09a', colDark: '#0a5a3a', lit: RT.started, down: RT.hold === 'start' }, 'btn', 44);
  part(g, hits, { t: 'btn', id: 'stop', big: true, x: 86, y: 622, r: 38, col: '#e0302c', colLit: '#ff5a50', colDark: '#8a1512', down: RT.hold === 'stop' }, 'btn', 44);
  lbl(g, 'START', 136, 509, 13.5, WH, 'left'); lbl(g, 'STOP', 136, 623, 13.5, WH, 'left'); ln(g, [[184, 509], [200, 509], [200, 548]]); ln(g, [[200, 584], [200, 623], [178, 623]]); lbl(g, 'TEST  START', 202, 566, 15.5);
  // 中央下：OUTPUT RANGE と MAX. CURRENT の表、REGULATOR
  lbl(g, '(V)', 402, 436, 13.5);
  maxTable(g, 246, 414, ['30SEC', 'CONT.'], [['50', '12'], ['50', '15'], ['50', '20']], 25); maxTable(g, 496, 412, ['CONT.', '30SEC'], [['10', '35'], ['7', '15'], ['1', '1']], 25);
  lbl(g, 'DVT', 478, 470, 10, OR, 'right');
  colKnob(g, hits, 'outr', 399, 524, 40, RT.rangeV, ANG.outr, [[2, '30', 316, 458], [1, '10', 316, 483], [0, '5', 320, 508], [3, '60', 488, 456], [4, '130', 488, 482], [5, '250', 488, 507]]);
  ln(g, [[399, 574], [399, 620], [486, 620]]); lbl(g, 'OUTPUT  RANGE', 556, 620, 15.5); ln(g, [[626, 620], [698, 620], [698, 610]]);
  { const X = 698, Y = 484; for (let i = 0; i <= 10; i++) { const a = (REG.reg[0] + REG.reg[1] * i / 10 - 90) * Math.PI / 180; lbl(g, String(i), X + Math.cos(a) * 91, Y + Math.sin(a) * 91, 13.5); ln(g, [[X + Math.cos(a) * 74, Y + Math.sin(a) * 74], [X + Math.cos(a) * 81, Y + Math.sin(a) * 81]], 2); }
    g.strokeStyle = WH; g.lineWidth = 1.4; g.beginPath(); g.arc(X, Y, 74, (REG.reg[0] - 90) * Math.PI / 180, (REG.reg[0] + REG.reg[1] - 90) * Math.PI / 180); g.stroke();
    g.beginPath(); g.arc(X, Y, 106, (-40 - 90) * Math.PI / 180, (34 - 90) * Math.PI / 180); g.stroke(); const a = (36 - 90) * Math.PI / 180, ax = X + Math.cos(a) * 106, ay = Y + Math.sin(a) * 106; g.fillStyle = WH; g.beginPath(); g.moveTo(ax + 8, ay + 6); g.lineTo(ax - 7, ay + 3); g.lineTo(ax + 1, ay - 9); g.fill();
    hits.push({ k: 'reg', id: 'reg', x: X, y: Y, r: 100, bodyRadius: 60, angle: regAngle('reg') }); paintRotary(g, X, Y, 60, regAngle('reg'), true); lbl(g, 'REGULATOR', X, 598, 15.5); }
  nameplate(g, 350, 696, 'POWER UNIT : PRT-3TR', 668);
  syncTesterControls(uT, hits, 'T'); syncTesterParts(uT, PARTS, 'T'); uT.userData.tex.needsUpdate = true;
  // 盤面に載せない操作の状態（写真にない文字）は、パネルの上の状態行に出す
  const st = `MC：${RT.mc ? '<b class=ok>接続済</b>' : '未接続（MC の丸をクリック）'}　／　接地：${RT.earth ? '<b class=ok>済</b>' : '未'}　／　電源プラグ：${RT.plug ? '<b class=ok>差した（向き ' + (RT.plugRev ? 'A' : 'B') + '）</b>' : '抜いてある（次に差す向き ' + (RT.plugRev ? 'A' : 'B') + '）'} <button data-flip=1>向きを逆に差し直す</button>　／　調整器 <b>${RT.reg.toFixed(1)}</b>` + (RT.Vv > VRNG[RT.vr] * 1.08 ? '　／　<b class=ng>電圧計：レンジ超過</b>' : '') + (RT.am > 0 && RT.Iv > (AMR[RT.am] || 50) * 1.08 ? '　／　<b class=ng>電流計：レンジ超過</b>' : '');
  if (st !== RT.statHTML && typeof rtStatEl !== 'undefined' && rtStatEl) { RT.statHTML = st; rtStatEl.innerHTML = st; }
}
// ---------- 試験の定義 ----------
const Tcurve = (m, T300) => T300 * (Math.pow(3, 0.14) - 1) / (Math.pow(Math.max(m, 1.0001), 0.14) - 1);
const TESTS = {
  oc_pick: { g: 'ocr', title: '限時要素 動作電流', pt: () => cur().Is, unit: 'A', kind: 'pick' },
  oc_t300: { g: 'ocr', title: '限時 動作時間（300%）', pt: () => 3 * cur().Is, unit: 'A', kind: 'time', nom: () => cur().T300, pct: 300 },
  oc_t500: { g: 'ocr', title: '限時 動作時間（500%）', pt: () => 5 * cur().Is, unit: 'A', kind: 'time', nom: () => Tcurve(5, cur().T300), pct: 500 },
  oc_i120: { g: 'ocr', title: '瞬時要素（整定の120%）', pt: () => 1.2 * cur().Iinst, unit: 'A', kind: 'inst', pct: 120 },
  oc_i85: { g: 'ocr', title: '瞬時要素（整定の85%）', pt: () => 0.85 * cur().Iinst, unit: 'A', kind: 'noinst', pct: 85 },
  uv_pick: { g: 'uvr', title: '動作電圧', pt: () => cur().Vs, unit: 'V', kind: 'pick' },
  uv_time: { g: 'uvr', title: '動作時間（110V→0V）', pt: () => 110, unit: 'V', kind: 'time', nom: () => cur().T },
  ov_pick: { g: 'ovr', title: '動作電圧', pt: () => cur().Vs, unit: 'V', kind: 'pick' },
  ov_time: { g: 'ovr', title: '動作時間（整定の130%）', pt: () => 1.3 * cur().Vs, unit: 'V', kind: 'time', nom: () => cur().T },
};
const testsFor = g => Object.keys(TESTS).filter(k => TESTS[k].g === g);
const RT_PORTS = { R: 0, P1: 0, E: 1, P2: 1, T1: 2, T2: 3 };
const LEADSET = { ocr: ['R', 'E', 'T1', 'T2'], uvr: ['P1', 'P2', 'T1', 'T2'], ovr: ['P1', 'P2', 'T1', 'T2'] };
const LEADTXT = { R: '電流出力 R → 継電器 電流入力①', E: '電流出力 E → 継電器 電流入力②（共通）', P1: '電圧出力 P1 → 継電器 電圧入力①', P2: '電圧出力 (E)P2 → 継電器 電圧入力②', T1: 'TRIP T1 → 継電器 接点出力③', T2: 'TRIP T2 → 継電器 接点出力④' };
const TERMX = { T1: 161, T2: 224, P1: 287, P2: 349, R: 659, T: 724, E: 786 };
function rtMsg(t, lv = 'w') { RT.log.unshift({ t, lv, at: performance.now() }); RT.log.length = Math.min(RT.log.length, 4); RT.guideDirty = true; }
const grp = () => cur().type;
const leadsOK = () => LEADSET[grp()].every(k => RT.leads[k]);
const isoOK = () => RT.iso.outage && RT.iso.tripLift && (grp() === 'ocr' ? RT.iso.ctShort && RT.iso.ctLift : RT.iso.vtLift);
const sets = () => {
  const t = TESTS[RT.test], pt = t.pt(), r = [];
  const need = grp() === 'ocr' ? 0 : grp() === 'ovr' ? 3 : 4;
  r.push(['TEST SELECT = ' + SELN[need], RT.sel === need]);
  r.push(['TEST MODE = ' + (t.kind === 'pick' ? 'OPERATION CHECK' : 'TIME MEASURING'), RT.mode === (t.kind === 'pick' ? 1 : 2)]);
  r.push(['TRIP MODE = DC TRIP CONTACT（この継電器は a接点）', RT.trip === 0]);
  if (grp() === 'ocr') {
    const imax = OUTR[RT.rangeV] / Rtot(), need2 = pt * 1.15;
    r.push(['AMMETER RANGE：目標 ' + pt.toFixed(1) + 'A を読める最小のレンジ（' + (AMR.find(v => v >= pt * 1.0) || 50) + 'A）', AMR[RT.am] >= pt && AMR[RT.am] <= (AMR.find(v => v >= pt) || 50)]);
    r.push(['OUTPUT RANGE と SERIES RESISTOR：最大電流が ' + need2.toFixed(1) + 'A 以上（今：' + imax.toFixed(1) + 'A）', imax >= need2 && OUTR[RT.rangeV] <= 30]);
    if (t.kind !== 'pick') r.push(['COUNTER RANGE = 10S', RT.cnt === 1]);
  } else {
    const lowV = cur().Vs < 50; // 64G のように整定の電圧が低いものは、低いレンジで細かく合わせる
    if (lowV) { r.push(['OUTPUT RANGE = 30V または 60V（整定の電圧が低いので、低い側で細かく合わせる）', OUTR[RT.rangeV] >= 30 && OUTR[RT.rangeV] <= 60]); r.push(['VOLTMETER RANGE：75V', VRNG[RT.vr] === 75]); }
    else { r.push(['OUTPUT RANGE = 130V または 250V（電圧試験は高い側）', OUTR[RT.rangeV] >= 130]);
    r.push(['VOLTMETER RANGE：' + (pt > 150 ? '300V' : '150V'), VRNG[RT.vr] >= pt && VRNG[RT.vr] <= (pt > 150 ? 300 : 150)]); }
    if (t.kind !== 'pick') r.push(['COUNTER RANGE = 10S', RT.cnt === 1]);
    if (RT.test === 'uv_time') r.push(['UV TIME = TEST（STARTで電圧を0Vへ急変）※教材での解釈', RT.uvt === 0]);
  }
  return r;
};
// ---------- 試験機の動作（毎フレーム） ----------
const ipt = { noise: 0 };
function rtTick(dt) {
  const t = TESTS[RT.test], d = cur(), dv = devv();
  RT.hasPower = RT.plug && RT.nfb;
  const live = RT.hasPower && RT.mc, Vr = OUTR[RT.rangeV], Vset = live ? Vr * RT.reg / 10 : 0;
  const kindI = RT.sel === 0, kindV = RT.sel === 3 || RT.sel === 4;
  const on = live && ((RT.mode === 1 && RT.started) || (RT.mode === 2 && RT.applied));
  const prev = live && RT.mode === 2 && !RT.applied && !RT.started;
  let Vo = (on || prev) ? Vset : 0, Io = 0;
  const loopI = RT.leads.R && RT.leads.E;
  if (kindI && Vo > 0) Io = loopI ? Vo / Rtot() : 0;
  if (RT.test === 'uv_time' && on && RT.mode === 2 && RT.uvt === 0) Vo = 0;
  RT.Iv = RT.am === 0 ? 0 : Io; RT.Vv = Vo;
  const ca = AMR[RT.am] || 1, cv = VRNG[RT.vr];
  RT.needleA += (clamp(RT.Iv / ca, 0, 1.08) - RT.needleA) * Math.min(1, dt * 9); RT.needleV += (clamp(RT.Vv / cv, 0, 1.08) - RT.needleV) * Math.min(1, dt * 9);
  // 継電器
  const rel = RT.rel, ready = leadsOK() && isoOK() && ((t.g === 'ocr' && RT.sel === 0) || (t.g === 'uvr' && RT.sel === 4) || (t.g === 'ovr' && RT.sel === 3));
  const level = t.g === 'ocr' ? Io : Vo, lvlPrev = t.g === 'ocr' ? (loopI && kindI ? Vset / Rtot() : 0) : Vset;
  const sense = RT.trip === 0 && RT.leads.T1 && RT.leads.T2;
  const lv = on ? level : (prev ? lvlPrev : 0);
  let want = false;
  if (ready && (on || prev)) {
    if (t.g === 'ocr') {
      const Is = d.Is * dv.Is, Ti = d.Iinst * dv.Inst, T3 = d.T300 * dv.T;
      if (on) { if (lv >= Ti) rel.acc += dt / 0.045; else if (lv >= Is) { const Tm = RT.mode === 1 ? Math.min(Tcurve(lv / d.Is, T3), 0.25) : Tcurve(lv / d.Is, T3); rel.acc += dt / Math.min(Tm, 300); } else { rel.acc = 0; if (RT.mode === 1 && lv < Is * 0.9) rel.op = false; } }
    } else if (t.g === 'uvr') {
      const Vs = d.Vs * dv.V, Tt = d.T * dv.TV;
      if (lv >= Vs * 1.02) rel.armed = true;
      if (on && rel.armed) { if (lv <= Vs) rel.acc += dt / (RT.mode === 1 ? Math.min(Tt, 0.5) : Tt); else { rel.acc = 0; if (RT.mode === 1 && lv > Vs * 1.05) rel.op = false; } }
    } else {
      const Vs = d.Vs * dv.V, Tt = d.T * dv.TV;
      if (on) { if (lv >= Vs) rel.acc += dt / (RT.mode === 1 ? Math.min(Tt, 0.5) : Tt); else { rel.acc = 0; if (RT.mode === 1 && lv < Vs * 0.95) rel.op = false; } }
    }
    if (rel.acc >= 1 && !rel.op) {
      rel.op = true; want = true;
      if (sense) {
        if (RT.mode === 1) RT.lastOp = { v: lv, kind: t.g, test: RT.test };
        else { RT.lastTime = RT.tCount + (Math.sin(performance.now()) * 0.0004); RT.lastOp = { time: RT.lastTime, test: RT.test, lv }; RT.counting = false; RT.applied = false; RT.started = false; }
      } else rtMsg('継電器は動作しましたが、試験機が接点を検出できません。TRIP MODE と T1・T2 の接続を確認してください。');
    }
  } else if (!(on || prev)) { rel.acc = 0; if (RT.mode === 1 || !RT.counting) { if (RT.reg === 0 && !RT.started) rel.op = false; } }
  if (RT.counting && RT.mode === 2) { RT.tCount += dt; const lim = RT.cnt === 1 ? 10 : 100; if (RT.cnt !== 0 && RT.tCount > lim) { RT.over = true; RT.counting = false; RT.applied = false; RT.started = false; rtMsg('カウンタが範囲を超えました。継電器が動作しませんでした（接続・設定を確認）。'); } else if (RT.cnt === 0 && RT.tCount > 120) { RT.counting = false; RT.applied = false; } }
  if (on && RT.mode === 1 && Io > 12) { RT.hot = (RT.hot || 0) + dt; if (RT.hot > 30) { RT.started = false; RT.hot = 0; rtMsg('大電流を30秒以上流したため停止しました（30秒制限・連続定格に注意）。', 'e'); } } else RT.hot = Math.max(0, (RT.hot || 0) - dt);
  RT.pl3 = rel.op && sense; RT.level = lv; void want;
  RT.pt += dt; if (RT.open || RT.pt < 0.3) { if (RT.pt > 0.07) { RT.pt = 0; const sig = JSON.stringify(RT, (k, v) => k === 'log' || k === 'rec' || k === 'pt' || k === 'statHTML' || k === 'drawSig' || k === 'hot' || k === 'rel' || k === 'iso' ? undefined : typeof v === 'number' ? Math.round(v * 400) / 400 : v); if (sig !== RT.drawSig) { RT.drawSig = sig; drawM(); drawT(); } RT.dirty = false; } }
}
// ---------- 配線（3D のリード線） ----------
const leadGrp = new THREE.Group(); leadGrp.visible = false; scene.add(leadGrp);
function rebuildLeads() {
  while (leadGrp.children.length) { const o = leadGrp.children[0]; leadGrp.remove(o); o.geometry.dispose(); if (!o.userData.keepMat) o.material.dispose(); }
  if (!tset.visible) return; const rel = RELAYS[RT.target]; if (!rel) return; scene.updateMatrixWorld(true);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const tube = (pts, col, r = 0.0032, tension = 0.5) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', tension), 56, r, 7), M(col, 0.05, 0.55)); m.castShadow = true; leadGrp.add(m); };
  const stub = (a, b, r, col, metal = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 10), M(col, metal, metal ? 0.3 : 0.5)); m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); m.castShadow = true; leadGrp.add(m); };
  // 机の奥の縁（盤側）。線は、端子の上 → 机の奥の縁の外 → 机と盤のすき間 → 継電器の端子、と通す（机・箱を突き抜けない）
  const back = tset.position.x - 0.35 - 0.035, topY = 0.78;
  Object.keys(RT.leads).filter(id => RT.leads[id]).forEach((id, n) => {
    const col = new THREE.Color(LC[id]).getHex(), A = termWorld(uM, TERMX[id], 44, 0.021), B = rel.localToWorld(rel.userData.ports[RT_PORTS[id]].clone());
    // 端子側：差し込みプラグ（色つきの絶縁筒。形は推測）
    stub(A, A.clone().add(V(0, 0.022, 0)), 0.0042, col); const A1 = A.clone().add(V(0, 0.022, 0));
    // 継電器側：ワニ口クリップ（色つきの絶縁カバーと金属の先。形は推測）
    const C = B.clone().add(V(0.03, -0.012, 0)); stub(B, B.clone().lerp(C, 0.4), 0.0022, 0xc8ccce, 0.9); stub(B.clone().lerp(C, 0.4), C, 0.0045, col);
    const dz = (n - 1.5) * 0.012, edge = V(back, Math.max(topY + 0.06, A1.y - 0.02), A1.z + dz * 0.5);
    const pts = [A1, A1.clone().add(V(-0.012, 0.035, 0)), edge];
    if (C.y < topY + 0.03) pts.push(V(back - 0.012, topY - 0.04, (edge.z + C.z) / 2 + dz), V(Math.max(C.x + 0.03, back - 0.03), C.y - 0.07 - n * 0.008, C.z + dz * 0.4));
    else pts.push(V((back + C.x) / 2, Math.min(edge.y, C.y) - 0.05, (edge.z + C.z) / 2));
    pts.push(C.clone().add(V(0.012, -0.03, 0)), C); tube(pts, col);
  });
  if (RT.earth) { const A = termWorld(uT, 956, 28, 0.016), A1 = A.clone().add(V(0, 0.016, 0)); stub(A, A1, 0.004, 0x3fd163);
    tube([A1, A1.clone().add(V(-0.02, 0.02, 0)), V(back, topY + 0.05, A.z - 0.01), V(back - 0.01, 0.45, A.z - 0.02), V(back - 0.03, 0.03, A.z - 0.03), V(back - 0.09, 0.012, A.z - 0.03)], 0x3fd163); }
  if (RT.mc) { const A = termWorld(uM, 926, 54, 0.03), B = termWorld(uT, 72, 62, 0.036), m = A.clone().lerp(B, 0.5); m.y = Math.max(A.y, B.y) + 0.035; m.x -= 0.05; tube([A, A.clone().add(V(0, 0.03, 0)), m, B.clone().add(V(0, 0.03, 0)), B], 0x1b1b1f, 0.007); }
  if (RT.plug) { const A = termWorld(uT, 920, 262, 0.034), fz = tset.position.z - 0.62 - 0.05; tube([A, A.clone().add(V(0, 0.03, 0)), V(A.x + 0.005, A.y + 0.035, A.z - 0.05), V(A.x + 0.02, topY + 0.06, fz + 0.03), V(A.x + 0.04, 0.3, fz - 0.02), V(A.x + 0.1, 0.012, fz - 0.03), V(A.x + 0.5, 0.01, fz - 0.05)], 0x1b1b1f, 0.005); }
}
// ---------- 操作 ----------
const lockedRot = new Set(['rs', 'outr', 'am', 'sel', 'mode', 'io']);
function rtRot(id, dir) {
  if ((RT.started || RT.applied) && lockedRot.has(id)) { rtMsg('通電中に切換えないでください。まず STOP を押して試験電源を OFF にしてから切換えます（銘板の注意：ロータリースイッチ）。', 'e'); return; }
  const map = { rs: ['rs', 6], outr: ['rangeV', 6], am: ['am', 6], sel: ['sel', 6], mode: ['mode', 3], vr: ['vr', 3], io: ['io', 3] }; const [k, n] = map[id];
  { const ord = ROT_ORDER[id], pos = ord.indexOf(RT[k]); RT[k] = ord[clamp(pos + dir, 0, n - 1)]; } RT.guideDirty = true; if (id === 'sel') RT.rel = { op: false, acc: 0, armed: false };
}
function rtAct(a) {
  const I = RT.iso;
  switch (a) {
    case 'outage': I.outage = !I.outage; break;
    case 'ctShort': if (grp() !== 'ocr') break; I.ctShort = !I.ctShort; if (!I.ctShort && I.ctLift) { I.ctShort = true; rtMsg('危険：継電器の線をつないだまま、CT二次側の短絡を外そうとしました。先に継電器の線を戻してください。', 'e'); RT.danger++; } break;
    case 'ctLift': if (!I.ctShort) { rtMsg('危険：CT二次側を短絡する前に、継電器の線は外せません。CT二次側を開放すると、二次側に高電圧が出ます（電技解釈：CT二次側は開放しない）。先に「CT二次側を短絡」です。', 'e'); RT.danger++; break; } if (!I.ctLift && Object.values(RT.leads).some(Boolean)) { break; } I.ctLift = !I.ctLift; break;
    case 'vtLift': I.vtLift = !I.vtLift; break;
    case 'tripLift': if (I.tripLift && Object.values(RT.leads).some(Boolean)) break; I.tripLift = !I.tripLift; break;
    case 'clearLeads': if (RT.nfb) { rtMsg('先に POWER(NFB) を OFF にしてから、リードを外します。', 'w'); break; } RT.leads = {}; RT.leadsDirty = true; break;
  }
  RT.guideDirty = true;
}
function rtLead(id) {
  if (RT.leads[id]) { if (RT.nfb) { rtMsg('通電中は外せません。POWER(NFB) を OFF にしてください。'); return; } RT.leads[id] = false; RT.leadsDirty = true; RT.guideDirty = true; return; }
  if (!RT.iso.outage) { rtMsg('先に停電を確認してください（盤の「停電時実施」）。', 'e'); return; }
  if (!RT.iso.tripLift) { rtMsg('先に遮断器のトリップ回路を切り離してください。そのまま試験すると、遮断器が実際に落ちます。', 'e'); return; }
  if (grp() === 'ocr' ? !(RT.iso.ctShort && RT.iso.ctLift) : !RT.iso.vtLift) { rtMsg(grp() === 'ocr' ? '先に CT二次側を短絡 → 継電器の電流線を外す、の順で切り離してください。' : '先に VT二次側（ヒューズ等）を切り離してください。', 'e'); return; }
  if (RT.nfb) { rtMsg('POWER(NFB) が ON です。OFF にしてから接続してください。'); return; }
  RT.leads[id] = true; RT.leadsDirty = true; RT.guideDirty = true;
}
function rtClick(which, h, ev, cv) {
  const id = h.id;
  if (h.k === 'rot') { const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) * +cv.dataset.panelWidth / r.width; rtRot(id, x < h.x ? -1 : 1); return; }
  if (h.k === 'tog') {
    switch (id) {
      case 'trip': RT.trip = RT.trip ? 0 : 1; break; case 'uvt': RT.uvt = RT.uvt ? 0 : 1; break; case 's7': RT.s7 = RT.s7 ? 0 : 1; break;
      case 'cntR': RT.cnt = (RT.cnt + 1) % 3; break; case 'mc': case 'mcM': RT.mc = !RT.mc; RT.leadsDirty = true; break;
      case 'plug': RT.plug = !RT.plug; if (!RT.plug) RT.nfb = false; RT.leadsDirty = true; break;
      case 'nfb': if (!RT.plug) { rtMsg('電源プラグ（SOURCE AC110V）を差してください。'); break; } RT.nfb = !RT.nfb; if (RT.nfb && !RT.polOK) rtMsg('電源の極性確認がまだです。E 接地 → PB1 を押す → ランプの明るさを確認、の順です。'); if (!RT.nfb) { RT.started = false; RT.applied = false; } break;
      case 's1': RT.s1 = !RT.s1; break; case 's2': RT.s2 = !RT.s2; break;
    }
  }
  if (h.k === 'term' && id === 'earth') { RT.earth = !RT.earth; RT.polOK = false; RT.leadsDirty = true; }
  if (id === 'plugflip') { if (RT.nfb) { rtMsg('極性を逆に差し替えるときは、POWER(NFB) を OFF にします（銘板の注意）。'); } else { RT.plugRev = !RT.plugRev; RT.polOK = false; rtMsg('電源プラグを、逆向きに差し直しました。もう一度、極性確認（PUSH）をしてください。', 'i'); } }
  if (h.k === 'term' && id !== 'earth') rtMsg('リード線の接続は、手順ガイドの「接続」ボタンで行います。（接続したリードは端子の色の輪で表示されます）', 'i');
  RT.guideDirty = true; RT.dirty = true;
}
function rtDown(h) {
  const id = h.id; RT.hold = id;
  if (id === 'pb1') { RT.pbPol = true; if (!RT.plug) { rtMsg('先に電源プラグを差してください。'); RT.polLamp = 'off'; return; } if (!RT.earth) { rtMsg('E 端子を接地してから押します。'); RT.polLamp = 'off'; return; } if (RT.nfb) rtMsg('極性確認は POWER(NFB) を OFF にして行います（銘板の注意）。'); RT.polLamp = RT.plugRev ? 'dim' : 'bright'; RT.polOK = !RT.plugRev; if (RT.plugRev) rtMsg('ランプが暗い（または点灯しない）→ コンセントの極性が逆です。「向きを逆に」で差し替えて、もう一度確認します。'); else rtMsg('ランプが明るく点灯 → 極性 OK です。', 'i'); }
  if (id === 'pb4') { RT.tCount = 0; RT.over = false; RT.rel.op = false; RT.rel.acc = 0; RT.lastTime = null; }
  if (id === 'start') {
    if (!RT.hasPower) { rtMsg('電源が入っていません（プラグ・POWER）。'); return; } if (!RT.mc) { rtMsg('測定箱と電源箱が、MC コネクタで接続されていません。'); return; }
    if (!RT.iso.tripLift) { rtMsg('遮断器のトリップ回路が切り離されていません。このまま通電すると、遮断器が落ちます。', 'e'); RT.danger++; return; }
    if (RT.mode === 0) { rtMsg('DVT（耐電圧試験）は、この教材では扱いません。', 'i'); return; }
    if (RT.reg > 0.2) rtMsg('調整器が 0 ではありません。0 に戻してから START する決まりです（銘板：調整器の位置）。', 'w');
    if (RT.mode === 1) RT.started = true; else { RT.applied = true; RT.started = true; RT.counting = RT.cnt !== 0; RT.tCount = 0; RT.over = false; RT.rel.op = false; RT.rel.acc = 0; if (RT.cnt === 0) rtMsg('COUNTER RANGE が OFF です。10S にしてください。'); if (RT.test === 'uv_time' && RT.uvt !== 0) rtMsg('UV TIME が NORMAL です。電圧が 0V に急変しないため、不足電圧継電器は動作しません。'); }
  }
  if (id === 'stop') { RT.started = false; RT.applied = false; RT.counting = false; }
  RT.guideDirty = true; RT.dirty = true;
}
function rtUp(h) { RT.hold = null; if (h.id === 'pb1') { RT.pbPol = false; RT.polLamp = 'off'; } RT.dirty = true; }
function regFromEv(ev, cv, h) { const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) * +cv.dataset.panelWidth / r.width - h.x, y = (ev.clientY - r.top) * +cv.dataset.panelHeight / r.height - h.y; rtRegAt(x + h.x, y + h.y, h); }
function rtRegAt(x, y, h) { const k = h.id === 'fine' ? 'fine' : 'reg', a = Math.atan2(x - h.x, h.y - y) * 180 / Math.PI; RT[k] = clamp(Math.round((a - REG[k][0]) / REG[k][1] * 100) / 10, 0, 10); RT.dirty = RT.guideDirty = true; }
function rtRegStep(h, d) { const k = h.id === 'fine' ? 'fine' : 'reg'; RT[k] = clamp(Math.round((RT[k] + d) * 10) / 10, 0, 10); RT.dirty = RT.guideDirty = true; }
// ---------- 記録表 ----------
function rtRecord() {
  const t = TESTS[RT.test], d = cur(), L = RT.lastOp; if (!L || L.test !== RT.test) { rtMsg('まだ、この項目の測定値がありません。'); return; }
  let meas, set, rng, ok, txt;
  if (t.kind === 'pick') { meas = L.v; set = t.pt(); const lo = set * (1 - TOL.op), hi = set * (1 + TOL.op); rng = lo.toFixed(2) + '〜' + hi.toFixed(2) + ' ' + t.unit; ok = meas >= lo && meas <= hi; txt = meas.toFixed(2) + ' ' + t.unit; }
  else { meas = L.time; if (t.kind === 'time') { set = t.nom(); const tol = Math.max(set * TOL.time, TOL.timeMin); rng = (set - tol).toFixed(3) + '〜' + (set + tol).toFixed(3) + ' 秒'; ok = Math.abs(meas - set) <= tol; } else if (t.kind === 'inst') { set = 0.05; rng = '0.1 秒以下（瞬時）'; ok = meas <= 0.1; } else { set = 0; rng = '瞬時で動作しない（0.1 秒を超える）'; ok = meas > 0.1; } txt = meas.toFixed(3) + ' 秒'; }
  RT.rec.push({ name: cur().name + '：' + t.title, point: t.kind === 'pick' ? '整定 ' + t.pt().toFixed(2) + t.unit : '印加 ' + t.pt().toFixed(1) + ' ' + t.unit, rng, txt, ok }); RT.guideDirty = true;
}

// ---------- 画面（右側のパネル） ----------
const css4 = document.createElement('style');
css4.textContent = '#rtp{position:fixed;top:0;right:0;bottom:0;width:min(700px,100vw);z-index:18;display:none;background:#0a1820f7;color:#fff;font:13px/1.65 sans-serif;overflow-y:auto;border-left:1px solid #7fe0d0;padding:8px 12px 40px}#rtp.min{bottom:auto;height:auto;overflow:visible;width:min(420px,100vw)}#rtp.min .rtbody{display:none}#rtp h3{margin:12px 0 4px;color:#7fe0d0;font-size:14px}#rtp .hd{display:flex;justify-content:space-between;align-items:center;font-weight:bold;font-size:15px;position:sticky;top:0;background:#0a1820;padding:4px 0;z-index:2}#rtp button,#rtp select{font-size:13px;padding:3px 8px;margin:2px;cursor:pointer}#rtp .st{display:flex;gap:6px;padding:3px 6px;border-radius:5px;margin:2px 0;background:#0d2530}#rtp .st.ok{opacity:.62}#rtp .st.now{background:#1f4a55;outline:1px solid #ffd866}#rtp .why{color:#9cc;font-size:12px}#rtp .warn{background:#3a1d1d;border-left:3px solid #f66;padding:4px 8px;margin:4px 0;font-size:12px}#rtp .info{background:#12303a;border-left:3px solid #7fe0d0;padding:4px 8px;margin:4px 0;font-size:12px}#rtp canvas{width:100%;border-radius:8px;display:block;margin:4px 0;touch-action:none;cursor:pointer}#rtp table{border-collapse:collapse;width:100%;font-size:12px}#rtp td,#rtp th{border:1px solid #2c5560;padding:3px 5px}#rtp .okc{color:#7f7}#rtp .ngc{color:#f77;font-weight:bold}#rtp .lg{font-size:12px}#rtp .lg.e{color:#ff8a8a}#rtp .lg.i{color:#8fe}';
document.head.appendChild(css4);
const rtp = document.createElement('div'); rtp.id = 'rtp'; document.body.appendChild(rtp);
const rtBtn = document.createElement('button'); h1.insertAdjacentHTML('beforeend', ' <button id=bt style="background:#2563a8;color:#fff;font-weight:bold">🧪 継電器試験</button>');
rtp.innerHTML = '<div class=hd><span>🧪 継電器試験（PRT-3M／PRT-3TR）</span><span><button id=rtMin>▼ 小さくして3Dを見る</button><button id=rtX>✕ 終了して収納</button></span></div><div id=rtZoomRow style="margin:4px 0">3Dで寄る：<button id=rtZoomM>測定箱</button><button data-z="M,204,230,0.3">電圧計</button><button data-z="M,796,230,0.3">電流計</button><button data-z="M,496,120,0.17">カウンタ</button><button data-z="M,882,566,0.13">TEST SELECT</button><button id=rtZoomT>電源箱</button><button data-z="T,698,484,0.2">調整器</button><button data-z="T,399,500,0.2">出力レンジ</button></div><div class=rtbody>' +
  '<div>試験対象：<select id=rtTarget></select> 試験項目：<select id=rtTest></select> <label><input id=rtBad type=checkbox> 不良個体（判定を体験）</label></div><div id=rtLog></div>' +
  '<h3>手順ガイド</h3><div id=rtGuide></div><h3>試験機（クリックで操作）</h3><div id=rtStat class=info></div><div class=info>ロータリー：つまみの左半分で左へ・右半分で右へ回る　／　トグル：クリック　／　調整器：円をドラッグ（ホイールで微調整）　／　START・STOP：押す</div><div id=rtUnits></div><h3>記録表</h3><div id=rtRec></div><h3>この試験の考え方と出典</h3><div id=rtRef></div></div>';
const rtTargetSel = $('rtTarget'), rtTestSel = $('rtTest'), rtStatEl = $('rtStat');
rtTargetSel.innerHTML = Object.keys(RDEF).map(k => `<option value="${k}">${RDEF[k].name}</option>`).join('');
function fillTests() { rtTestSel.innerHTML = testsFor(grp()).map(k => `<option value="${k}">${TESTS[k].title}</option>`).join('') + '<option value="_ground">地絡（OCG／DG）・漏電リレー：解説のみ</option>'; rtTestSel.value = RT.test; }
function selectTarget(tag) { RT.target = tag; RT.test = testsFor(grp())[0]; RT.leads = {}; RT.iso = { outage: false, ctShort: false, ctLift: false, vtLift: false, tripLift: false }; RT.rel = { op: false, acc: 0, armed: false }; RT.lastOp = null; rtTargetSel.value = tag; fillTests(); placeSet(); RT.leadsDirty = true; RT.guideDirty = true; }
rtTargetSel.onchange = () => { selectTarget(rtTargetSel.value); flyTo([-7.3, 1.55, pz(cur().panel)], [-9.3, 0.9, pz(cur().panel)]); };
rtTestSel.onchange = () => { RT.test = rtTestSel.value; RT.lastOp = null; RT.rel = { op: false, acc: 0, armed: false }; RT.tCount = 0; RT.over = false; RT.guideDirty = true; };
$('rtBad').onchange = e => { RT.bad = e.target.checked; RT.lastOp = null; rtMsg(RT.bad ? '不良個体にしました（整定値からずれた継電器）。測定して、判定が「不合格」になるのを体験できます。' : '良品に戻しました。', 'i'); };
const unitsDiv = $('rtUnits'); unitsDiv.append(uM.userData.cv, uT.userData.cv);
// 当たりの範囲は広めに取り、重なったときは「中心にいちばん近い部品」を選ぶ（スマホで押しやすくするため）
function rtHitAt(which, x, y) { let best = null, bd = 1e9; for (const h of HIT[which]) { const d = Math.hypot(x - h.x, y - h.y); if (d <= h.r && d / h.r < bd) { bd = d / h.r; best = h; } } return best; }
function bindCanvas(cv, which) {
  let cur2 = null;
  const pos = ev => { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) * +cv.dataset.panelWidth / r.width, (ev.clientY - r.top) * +cv.dataset.panelHeight / r.height]; };
  const find = ev => rtHitAt(which, ...pos(ev));
  cv.addEventListener('pointerdown', ev => { const h = find(ev); if (!h) return; cv.setPointerCapture(ev.pointerId); cur2 = h; if (h.k === 'reg') { regFromEv(ev, cv, h); } else if (h.k === 'btn' && h.id !== 'plugflip') rtDown(h); else rtClick(which, h, ev, cv); });
  cv.addEventListener('pointermove', ev => { if (cur2 && cur2.k === 'reg' && ev.buttons) regFromEv(ev, cv, cur2); });
  cv.addEventListener('pointerup', () => { if (cur2 && cur2.k === 'btn') rtUp(cur2); cur2 = null; });
  cv.addEventListener('pointercancel', () => { if (cur2 && cur2.k === 'btn') rtUp(cur2); cur2 = null; });
  cv.addEventListener('wheel', ev => { const h = find(ev); if (h && h.k === 'reg') { ev.preventDefault(); rtRegStep(h, ev.deltaY < 0 ? 0.1 : -0.1); } }, { passive: false });
}
bindCanvas(uM.userData.cv, 'M'); bindCanvas(uT.userData.cv, 'T');
// 机上の立体部品も、右側の操作パネルと同じ状態・安全処理を使う。
const rtRay = new THREE.Raycaster(), rtPointer = new THREE.Vector2();
let rtDrag3D = null;
function rtRayAt(e) {
  const b = renderer.domElement.getBoundingClientRect();
  rtPointer.set((e.clientX - b.left) / b.width * 2 - 1, 1 - (e.clientY - b.top) / b.height * 2);
  scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); rtRay.setFromCamera(rtPointer, camera);
}
function rtPanelPoint(unit, point) {
  const u = unit.userData, p = u.pane.worldToLocal(point.clone());
  return [(p.x / u.pw + 0.5) * u.W, (0.5 - p.y / u.ph) * u.H];
}
function rtPick3D(e) {
  if (!RT.open || !tset.visible || walk.on || ov.style.display !== 'none') return null;
  rtRayAt(e);
  for (const hit of rtRay.intersectObjects([uM, uT], true)) {
    let o = hit.object;
    while (o && !o.userData.rtControl && o !== uM && o !== uT) o = o.parent;
    if (o?.userData.rtControl) {
      const { which, hit: h } = o.userData.rtControl, unit = which === 'M' ? uM : uT;
      return { unit, which, h, point: rtPanelPoint(unit, hit.point) };
    }
    const unit = o === uM ? uM : o === uT ? uT : null;
    if (!unit || hit.object !== unit.userData.pane) continue;
    const which = unit === uM ? 'M' : 'T', point = rtPanelPoint(unit, hit.point);
    const h = rtHitAt(which, ...point);
    return h ? { unit, which, h, point } : null;
  }
  return null;
}
function rtDrawUnit(which) { if (which === 'M') drawM(); else drawT(); }
function endRT3D(e) {
  if (!rtDrag3D || (e && e.pointerId !== rtDrag3D.pointerId)) return;
  const d = rtDrag3D; rtDrag3D = null;
  if (d.h.k === 'btn') rtUp(d.h);
  controls.enabled = d.controlsEnabled; rtDrawUnit(d.which);
}
{
  const el = renderer.domElement;
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || rtDrag3D) return;
    const d = rtPick3D(e); if (!d) return;
    e.preventDefault(); e.stopImmediatePropagation();
    rtDrag3D = { ...d, pointerId: e.pointerId, controlsEnabled: controls.enabled }; controls.enabled = false; el.setPointerCapture(e.pointerId);
    if (d.h.k === 'rot') rtRot(d.h.id, d.point[0] < d.h.x ? -1 : 1);
    else if (d.h.k === 'reg') rtRegAt(...d.point, d.h);
    else if (d.h.k === 'btn' && d.h.id !== 'plugflip') rtDown(d.h);
    else rtClick(d.which, d.h, e, d.unit.userData.cv);
    rtDrawUnit(d.which);
  }, true);
  el.addEventListener('pointermove', e => {
    if (!rtDrag3D || e.pointerId !== rtDrag3D.pointerId) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const d = rtDrag3D; if (d.h.k !== 'reg') return;
    rtRayAt(e);
    const pane = d.unit.userData.pane, normal = new THREE.Vector3(0, 0, 1).transformDirection(pane.matrixWorld);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, pane.getWorldPosition(new THREE.Vector3()));
    const hit = rtRay.ray.intersectPlane(plane, new THREE.Vector3());
    if (hit) { rtRegAt(...rtPanelPoint(d.unit, hit), d.h); rtDrawUnit(d.which); }
  }, true);
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(name, e => {
    if (!rtDrag3D || e.pointerId !== rtDrag3D.pointerId) return;
    e.stopImmediatePropagation(); endRT3D(e);
  }, true);
  el.addEventListener('wheel', e => {
    const d = rtPick3D(e); if (!d || d.h.k !== 'reg') return;
    e.preventDefault(); e.stopImmediatePropagation(); rtRegStep(d.h, e.deltaY < 0 ? 0.1 : -0.1); rtDrawUnit(d.which);
  }, { capture: true, passive: false });
}
function rtFocusUnit(unit) {
  rtp.classList.add('min'); $('rtMin').textContent = '▲ 開く';
  tset.updateWorldMatrix(true, true); const p = unit.getWorldPosition(new THREE.Vector3()); p.y += 0.09;
  const fit = Math.max(1, 1.05 / camera.aspect);
  fly = null; view([p.x + 0.36 * fit, p.y + 0.5 * fit, p.z], p.toArray()); controls.update();
}
$('rtZoomM').onclick = () => rtFocusUnit(uM); $('rtZoomT').onclick = () => rtFocusUnit(uT);
rtp.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.z) { const [w, x, y, d] = b.dataset.z.split(','); rtp.classList.add('min'); $('rtMin').textContent = '▲ 開く'; tset.updateWorldMatrix(true, true); const q = termWorld(w === 'M' ? uM : uT, +x, +y, 0.02), fit = Math.max(1, 1.05 / camera.aspect); fly = null; view([q.x + d * 0.3 * fit, q.y + d * fit, q.z], q.toArray()); controls.update(); return; }
  if (b.dataset.flip) { rtClick('T', { k: 'btn', id: 'plugflip' }); RT.dirty = true; drawT(); return; }
  if (b.dataset.a) rtAct(b.dataset.a); if (b.dataset.l) rtLead(b.dataset.l); if (b.dataset.rec) rtRecord();
  if (b.dataset.del) { RT.rec.splice(+b.dataset.del - 1, 1); RT.guideDirty = true; } if (b.dataset.cp) { navigator.clipboard && navigator.clipboard.writeText(RT.rec.map(r => [r.name, r.point, r.rng, r.txt, r.ok ? '合格' : '不合格'].join('\t')).join('\n')); rtMsg('記録表をコピーしました。', 'i'); }
  if (b.dataset.fix) { RT.iso = { outage: false, ctShort: false, ctLift: false, vtLift: false, tripLift: false }; RT.leads = {}; RT.leadsDirty = true; RT.guideDirty = true; }
});
function btnA(a, lab) { return ` <button data-a="${a}">${lab}</button>`; }
function guideHTML() {
  const t = TESTS[RT.test], I = RT.iso, g = grp(), n = [];
  if (RT.test === '_ground') return '<div class=info><b>地絡（OCG・DG）の試験の考え方（解説のみ。この教材では模擬しません）</b><br>・TEST SELECT を <b>OCG（地絡過電流）</b> または <b>DG（地絡方向）</b> にして、Io RANGE（0.5／0.9／1.2 A）と FINE で試験電流を作ります。<br>・地絡方向継電器（DG）は、零相電流（Io）に加えて、零相電圧を同時に与えて、方向を判定する継電器です。試験では電圧と電流の位相関係に注意します。<br>・ZCT（零相変流器）二次側の取り扱いも、CT と同様に、開放・短絡の扱いが決まっています。<br>・<b>具体的な結線・整定・判定値は、継電器と試験器の取扱説明書、および現場の自主検査要領で確認してください。</b>（この教材は、そこまで確認できていません）</div>';
  const rows = [];
  const row = (ok, txt, extra = '', why = '') => rows.push({ ok, h: `<div class="st __C__"><span>${ok ? '✅' : '⬜'}</span><div>${txt}${extra}${why ? `<div class=why>${why}</div>` : ''}</div></div>` });
  row(I.outage, '① 高圧側の<b>停電・検電・接地</b>を確認する（盤の「停電時実施」の表示）', btnA('outage', I.outage ? '確認済み（クリックで取り消し）' : '確認した'), '継電器の試験は、停電して、遮断器の動作に影響しない状態で行います。');
  row(true, '② 試験機を、盤の前に置く（置き済み）');
  row(RT.mc, '③ 測定箱（PRT-3M）と電源箱（PRT-3TR）を、<b>MC コネクタ</b>で接続する', '', '電源箱の「MC」の丸をクリック。');
  row(RT.earth, '④ 電源箱の <b>E 端子</b>を、接地コードで接地する', '', '電源箱の右上の E 端子をクリック。');
  row(RT.plug, '⑤ 電源プラグ（AC110V）を差す', '', '電源箱の右側の「SOURCE AC110V」をクリック。');
  row(RT.polOK, '⑥ <b>電源の極性確認</b>：PB1 を押して、ランプ（PL）が明るく点灯するか確認。暗ければ、POWER を OFF にして、プラグを逆に差し替える', '', '銘板の指示どおり（ケース電位を安全にするため）。E の接地が前提です。');
  row(RT.reg === 0 && !RT.nfb, '⑦ <b>調整器を 0</b> に、POWER（NFB）を OFF にしておく', '', '銘板：調整用スライダック（T1）と VR は、必ず零位置で準備。');
  if (g === 'ocr') {
    row(I.ctShort, '⑧ 継電器の電流回路を、<b>CT二次側を短絡</b>して切り離す（CT試験端子の短絡）', btnA('ctShort', I.ctShort ? '短絡済み（解除する）' : 'CT二次側を短絡'), 'CT二次側は、<b>先に短絡してから</b>継電器の線を外す。開放すると高電圧が出て危険です。');
    row(I.ctLift, '⑨ 継電器の電流入力の線を、外す', btnA('ctLift', I.ctLift ? '外した（戻す）' : '継電器の線を外す'));
  } else row(I.vtLift, '⑧ 継電器の電圧入力を、VT二次側から切り離す（ヒューズ・端子を外す）', btnA('vtLift', I.vtLift ? '切り離し済み（戻す）' : 'VT二次側を切り離す'), 'VT二次側は、<b>短絡してはいけません</b>（短絡電流で焼損）。切り離すだけにします。');
  row(I.tripLift, '⑩ <b>遮断器のトリップ回路</b>を切り離す（試験中に実際の遮断器が落ちないように）', btnA('tripLift', I.tripLift ? '切り離し済み（戻す）' : 'トリップ回路を切り離す'));
  const ls = LEADSET[g]; row(ls.every(k => RT.leads[k]), '⑪ 試験リードを接続する（継電器の下端の端子①〜④）', ls.map(k => `<br>${RT.leads[k] ? '🟢' : '⚪'} ${LEADTXT[k]} <button data-l="${k}">${RT.leads[k] ? '外す' : '接続'}</button>`).join('') + btnA('clearLeads', 'すべて外す'), '接続は、停電・切り離しのあと、POWER が OFF の間に行います。');
  const sp = sets(); row(sp.every(x => x[1]), '⑫ 試験機の設定', '<br>' + sp.map(x => (x[1] ? '✔ ' : '✘ ') + x[0]).join('<br>'), '設定を変えるときは、STOP を押して、通電をやめてから。');
  row(RT.nfb && RT.plug, '⑬ POWER（NFB）を ON → PL1 点灯', '', '電源箱の右下のスイッチをクリック。');
  const pt = t.pt(), unit = t.unit; let m = '';
  if (t.kind === 'pick') m = g === 'ocr' ? `⑭ START を押す → 調整器を 0 から<b>ゆっくり</b>右へ回す → 継電器が動作して <b>PL3（動作確認ランプ）が点灯</b>したら手を止め、${unit === 'A' ? '電流計' : '電圧計'}を読む（整定 ${pt.toFixed(1)} ${unit}）` : (g === 'uvr' ? `⑭ START を押す → 調整器で <b>110V まで上げて</b>継電器を復帰させる → そこから<b>ゆっくり下げ</b>、PL3 が点灯した時の電圧計を読む（整定 ${pt} V）` : `⑭ START を押す → 調整器を 0 から<b>ゆっくり上げ</b>、PL3 が点灯した時の電圧計を読む（整定 ${pt} V）`);
  else if (t.kind === 'time') m = RT.test === 'uv_time' ? '⑭ 調整器で <b>110V</b> に合わせる（TIME MEASURING では、通電前でも指示が出ます）→ <b>START</b> を押すと、電圧が 0V に急変してカウンタが動き、継電器の動作で止まる → カウンタを読む → 記録（やり直しは RESET）' : `⑭ 調整器で <b>${pt.toFixed(1)} ${unit}</b> に合わせる（通電前の指示は、教材のための簡略化です）→ <b>START</b> を押す → 通電と同時にカウンタが動き、継電器の動作で止まる → カウンタを読む → 記録（やり直しは RESET）`;
  else m = `⑭ 調整器で <b>${pt.toFixed(1)} A</b> に合わせる → <b>START</b> → カウンタを読む。${t.kind === 'inst' ? '瞬時要素なら 0.1 秒以下で動作します。' : 'この電流では瞬時要素は動作せず、限時要素で動作するため、0.1 秒を超えます。'}`;
  row(false, m, ` <button data-rec=1>📝 この測定値を記録</button>`, (RT.lastOp && RT.lastOp.test === RT.test) ? ('今の測定値：' + (RT.lastOp.v != null ? RT.lastOp.v.toFixed(2) + ' ' + unit : (RT.lastOp.time * 1).toFixed(3) + ' 秒')) : '');
  row(false, '⑮ <b>試験後</b>：調整器 0 → STOP → POWER OFF → リードを外す → 継電器の線を戻す → CT短絡（VT）を戻す → トリップ回路を戻す', '', '戻し忘れ（特にトリップ回路・CT短絡）は事故のもとです。上の各ボタンを、逆の順に押して戻せます。');
  const first = rows.findIndex(r => !r.ok && !r.h.includes('⑭') && !r.h.includes('⑮'));
  return rows.map((r, i) => r.h.replace('__C__', (r.ok ? 'ok' : '') + (i === first ? ' now' : ''))).join('');
}
function recHTML() { if (!RT.rec.length) return '<div class=why>測定したあと「記録」を押すと、ここに並びます。</div>'; return '<table><tr><th>項目</th><th>条件</th><th>判定の範囲（目安）</th><th>測定値</th><th>判定</th><th></th></tr>' + RT.rec.map((r, i) => `<tr><td>${r.name}</td><td>${r.point}</td><td>${r.rng}</td><td>${r.txt}</td><td class=${r.ok ? 'okc' : 'ngc'}>${r.ok ? '合格' : '不合格'}</td><td><button data-del=${i + 1}>削除</button></td></tr>`).join('') + '</table><button data-cp=1>表をコピー</button>'; }
const REFHTML = '<div class=info>・<b>この教材の判定値は目安</b>です。限時・瞬時要素の動作値：整定値の ±5%／瞬時 ±15%（メーカー資料の一例）、不足・過電圧の動作電圧 ±5%・動作時間 ±10%（下限 ±50ms）（メーカー資料の一例）。<b>JIS C 4602 など規格の本文の数値は確認できていません。</b>実際の管理値は、継電器の取扱説明書、JEM-TR 156（保護継電器の保守・点検指針）、現場の自主検査要領で確認してください。</div>' +
  '<div class=info>・不足電圧継電器の時間試験は、定格電圧から 0V へ急変させて測る形式が、自主検査の様式（例：岡山市の様式）で確認できます。PRT-3M の「UV TIME」スイッチの正確な意味は、取扱説明書で確認してください（この教材では「TEST＝STARTで 0V に急変」と解釈しています）。</div>' +
  '<div class=info>・試験機の銘板（PRT-3M／PRT-3TR）の結線図・端子名・操作の注意（極性確認、調整器は零位置、通電中にロータリースイッチを切換えない、ヒューズ定格）は、実機の銘板の写真に合わせています。</div>' +
  '<div class=warn>・教材での簡略化：継電器の特性は模擬モデルです（限時＝反限時カーブの近似）。動作確認モードでは、待ち時間を短くしてあります。TIME MEASURING の「通電前の指示」は、教材のための表示です。整定値（4A／80V／120V など）も架空です。</div>';
let guideSig = '';
function rtRender() {
  const sig = JSON.stringify([RT.iso, RT.leads, RT.mc, RT.earth, RT.plug, RT.polOK, RT.nfb, RT.reg === 0, RT.sel, RT.mode, RT.trip, RT.vr, RT.am, RT.rs, RT.rangeV, RT.cnt, RT.uvt, RT.test, RT.target, RT.rec.length, RT.lastOp && (RT.lastOp.v || RT.lastOp.time), RT.log.length && RT.log[0].t, RT.bad]);
  if (sig === guideSig && !RT.guideDirty) return; guideSig = sig; RT.guideDirty = false;
  $('rtGuide').innerHTML = guideHTML(); $('rtRec').innerHTML = recHTML(); $('rtRef').innerHTML = REFHTML;
  $('rtLog').innerHTML = RT.log.map(l => `<div class="lg ${l.lv}">${l.lv === 'e' ? '⚠ ' : l.lv === 'i' ? 'ℹ ' : '・'}${l.t}</div>`).join('');
}
function rtOpen() { if (walk.on) setWalk(false); dw.style.display = 'none'; dwBtn.style.display = 'none'; tipEl.style.display = 'none'; doors.forEach(d => { d.target = 0; }); RT.open = true; rtTargetSel.value = RT.target; fillTests(); placeSet(); rtp.style.display = 'block'; rtp.classList.remove('min'); $('rtMin').textContent = '▼ 小さくして3Dを見る'; RT.guideDirty = true; flyTo([-7.3, 1.55, pz(cur().panel)], [-9.3, 0.9, pz(cur().panel)]); }
function rtClose() {
  // 収納で電気的な復旧手順を飛ばさない。記録・対象・設定は次回も保持する。
  if (RT.reg !== 0 || RT.started || RT.applied || RT.counting || RT.nfb || Object.values(RT.leads).some(Boolean) || RT.iso.ctLift || RT.iso.vtLift || RT.iso.ctShort || RT.iso.tripLift) {
    rtp.classList.remove('min'); $('rtMin').textContent = '▼ 小さくして3Dを見る';
    rtMsg('収納前に、調整器0 → STOP → POWER OFF → リードを外す → 継電器の線を戻す → CT短絡（VT）を戻す → トリップ回路を戻す、の順で復旧してください。', 'e'); return;
  }
  RT.plug = RT.mc = RT.earth = RT.polOK = RT.pbPol = RT.hasPower = false; RT.polLamp = 'off'; RT.hold = null;
  RT.open = false; tset.visible = leadGrp.visible = false;
  const i = BLOCKS.indexOf(tableBlock); if (i !== -1) BLOCKS.splice(i, 1);
  rebuildLeads(); RT.dirty = RT.guideDirty = true;
  rtp.style.display = 'none'; dwBtn.style.display = 'block';
}
$('bt').onclick = rtOpen; $('rtX').onclick = rtClose; $('rtMin').onclick = () => { rtp.classList.toggle('min'); $('rtMin').textContent = rtp.classList.contains('min') ? '▲ 開く' : '▼ 小さくして3Dを見る'; };
window.__rt = { tset, HIT: () => HIT, screenOf: (w, x, y, z) => { const v = termWorld(w === 'M' ? uM : uT, x, y, z).project(camera), b = renderer.domElement.getBoundingClientRect(); return [b.left + (v.x + 1) / 2 * b.width, b.top + (1 - v.y) / 2 * b.height]; }, RT, rtAct, rtLead, rtRot, rtDown, rtUp, rtTick, rtRecord, selectTarget, TESTS, cur, drawM, drawT, rebuildLeads, rtOpen, rtClick };
drawM(); drawT();

// ---------- スマホ向け：画面の文字を収納できるようにする ----------
function wrapHud(h, label, openLabel) {
  const hb = document.createElement('div'); hb.className = 'hb';
  while (h.firstChild) hb.appendChild(h.firstChild);
  const tg = document.createElement('button'); tg.className = 'hudtg'; h.append(tg, hb);
  const sync = () => { tg.textContent = h.classList.contains('min') ? label : openLabel; };
  tg.onclick = () => { h.classList.toggle('min'); sync(); };
  h._collapse = () => { h.classList.add('min'); sync(); };
  const narrow = innerWidth < 760 || matchMedia('(pointer:coarse)').matches;
  if (narrow) h.classList.add('min'); sync();
}
wrapHud(h1, '📋 視点・操作', '▲ 収納');
wrapHud(h2, '🎛 運転・内部', '▼ 収納');
if (h1.classList.contains('min')) h1.querySelector('.hb').addEventListener('click', e => { const b = e.target.closest('button'); if (b && (b.dataset.v || b.id === 'bw' || b.id === 'bd')) h1._collapse(); });
$('stt').addEventListener('click', () => { h2.classList.toggle('ex'); showStat(); });
showStat();

// ================= 毎フレーム =================
const clock = new THREE.Clock(); let vt = 0, texAcc = 0;
const lampBase = lamp, tmpC = new THREE.Color(), cA = new THREE.Color(0xff8a2a), cB = new THREE.Color(0x8a8f94);
let hemiT = 0.9, lampT = 1;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05); vt += dt;
  stepState(dt); derive();
  const k = Math.min(1, S.rpm / 1200), w = S.rpm / 60 * Math.PI * 2 * S.scale; S.phi += w * dt;
  // 回転部分
  deskNeedles.forEach(d => { const k = Math.max(0, Math.min(1.05, d.fn())); d.g.rotation.z = -((d.rest + d.span * k) * Math.PI / 180); });
  fan.rotation.x = S.phi; shaft.rotation.x = S.phi; crank.rotation.x = S.phi; fw.rotation.x = S.phi; rotor.rotation.x = S.phi;
  // 振動（運転中の機械全体）
  const va = (S.mode === 'crank' ? 0.0035 : 0.0022 * k) * (S.rpm > 3 ? 1 : 0), vf = 18 + S.rpm * 0.04;
  rig.position.set(Math.sin(vt * vf) * va * 0.5, Math.sin(vt * vf * 1.3) * va, Math.cos(vt * vf * 0.9) * va * 0.6); rig.rotation.x = Math.sin(vt * vf * 0.8) * va * 0.5;
  // 内部の動き
  if (inner.visible) {
    const fireOn = FIRE_MODES.includes(S.mode) || (S.mode === 'stopping' && S.t < 0.4);
    cyls.forEach(c => {
      const th = S.phi - c.fire, yp = CY + CR * Math.cos(th), zp = CR * Math.sin(th), pp = yp + Math.sqrt(CL * CL - zp * zp);
      c.web.rotation.x = th; c.piston.position.set(c.x, pp + 0.05, 0);
      const dy = pp - yp, dz = -zp; c.rod.position.set(c.x, (yp + pp) / 2, zp / 2); c.rod.rotation.x = Math.atan2(dz, dy);
      const ph = ((S.phi - c.fire) % (4 * Math.PI) + 4 * Math.PI) % (4 * Math.PI), on = fireOn && ph < 1.3;
      c.flash.position.set(c.x, pp + 0.13, 0); c.flash.material.opacity = on ? 0.9 * (1 - ph / 1.3) : 0; c.flash.scale.setScalar(on ? 1 + (1 - ph / 1.3) * 0.5 : 0.01);
    });
    const flow = (P, sp) => P.arr.forEach(m => { m.userData.u = (m.userData.u + dt * sp) % 1; m.position.copy(P.path.getPointAt(m.userData.u)); });
    const sp = 0.04 + k * 0.5 * (S.scale / 0.05 > 1.5 ? 1.4 : 1);
    flow(pWater, S.rpm > 3 ? 0.03 + k * 0.12 : 0); flow(pFuel, FIRE_MODES.includes(S.mode) ? 0.08 : 0);
    pGas.arr.forEach(m => { const on = FIRE_MODES.includes(S.mode); m.userData.u = (m.userData.u + dt * (on ? 0.15 : 0)) % 1; m.position.copy(gasPath.getPointAt(m.userData.u)); m.material.color.copy(tmpC.copy(cA).lerp(cB, Math.min(1, m.userData.u * 1.6))); m.visible = on; });
    void sp;
  }
  // 照明（停電で暗くなり、給電で戻る）
  const lit = S.mains ? 1 : S.brk ? 0.6 : 0; hemiT += ((0.25 + 0.65 * lit) - hemiT) * Math.min(1, dt * 4); lampT += (lit - lampT) * Math.min(1, dt * 6);
  hemi.intensity = hemiT; lampBase.emissiveIntensity = lampT; sun.intensity = 0.4 + 1.1 * (S.mains || S.brk ? 1 : 0);
  // 盤面の更新
  texAcc += dt; if (texAcc > 0.12) { texAcc = 0; dynTex.forEach(t => t.userData.redraw()); } dyn3.forEach(f => f(dt));
  $('rd').textContent = `回転 ${Math.round(S.rpm)} min⁻¹ ｜ 電圧 ${Math.round(210 * S.volt)} V ｜ 周波数 ${S.hz.toFixed(1)} Hz ｜ ${S.mains ? '商用' : S.brk ? '発電' : '停電'}`;
  if (typeof rtTick === 'function') { rtTick(dt); if (RT.open) { animateTester(uM, dt); animateTester(uT, dt); } if (RT.leadsDirty) { RT.leadsDirty = false; rebuildLeads(); } if (RT.open) rtRender(); }
  doors.forEach(d => { d.cur += (d.target - d.cur) * Math.min(1, dt * 4); d.g.rotation.y = d.cur; if (d.light) d.light.intensity = 1.8 * Math.min(1, -d.cur / 1.2); });
  audioUpdate(); if (fly) { fly.t = Math.min(1, fly.t + dt / 0.9); const k = ease(fly.t); camera.position.lerpVectors(fly.p0, fly.p1, k); controls.target.lerpVectors(fly.t0, fly.t1, k); if (fly.t >= 1) fly = null; }
  if (walk.on) walkStep(dt); else controls.update(); renderer.render(scene, camera);
});
