import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d2228);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
function view(p, t) { camera.position.set(...p); controls.target.set(...t); }
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
const gen = new THREE.Group(); scene.add(gen);
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
const floor = new THREE.Mesh(new THREE.PlaneGeometry(14.1, 7.2), mat.floor);
floor.rotation.x = -Math.PI / 2; floor.position.set(-3.45, 0, 0.2); floor.receiveShadow = true; room.add(floor);
const wallMat = M(0xffffff, 0, 1, { map: concreteTex([5, 2]), side: THREE.BackSide });
const walls = new THREE.Mesh(new THREE.BoxGeometry(14.1, 4.4, 7.2), wallMat); walls.position.set(-3.45, 2.2, 0.2); room.add(walls);
for (const [x0, x1, z0, z1] of [[-3.6, 3.2, -1.95, -1.85], [-3.6, 3.2, 2.0, 2.1], [-3.6, -3.5, -1.95, 2.1], [3.1, 3.2, -1.95, 2.1]])
  bx(x0, x1, 0, 0.01, z0, z1, mat.black, room);
const lamp = M(0xffffff, 0, 0.3, { emissive: 0xffffff, emissiveIntensity: 1 });
for (const z of [-1.6, 1.6]) for (const x of [-10.0, -8.4, -6.8, -5.2, -3.6, -2.0, -0.4, 1.2, 2.8]) bx(x - 0.6, x + 0.6, 4.25, 4.3, z - 0.07, z + 0.07, lamp, room);


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
for (const x of [-10.0, -8.0, -6.0, -4.0, -2.0, 0.0, 2.0]) bx(x - 0.15, x + 0.15, 4.0, 4.4, -3.4, 3.8, M(0x5a5d60, 0, 0.95), room);
// 左壁（-z側）の下部ベージュ帯と、床の縞鋼板
bx(-10.5, 3.6, 0, 1.25, -3.4, -3.37, M(0x9c9d83, 0, 0.9), room);
bx(-4.1, 3.6, 0, 0.012, -3.3, -2.5, mat.plate, room); bx(-10.4, -9.5, 0, 0.012, -3.3, -1.0, mat.plate, room);
// 排気管（天井まで→入口側へ）と、風道の曲がり
pipe([[0.95, 4.2, -0.05], [0.95, 4.05, -0.05], [0.4, 4.05, -0.05], [-0.8, 4.05, -0.05]], 0.2, mat.lag, room);
pipe([[2.3, 2.8, 0], [2.3, 3.6, -0.6], [1.8, 3.75, -1.8], [0.4, 3.75, -2.9], [-2.5, 3.75, -3.0]], 0.38, duct, room);
// 背面壁の換気扇
bx(3.52, 3.6, 2.6, 3.4, -1.9, -1.1, M(0xb5babd, 0.4, 0.6), room);
{ const f = new THREE.Mesh(new THREE.CircleGeometry(0.33, 28), M(0x6e7479, 0.4, 0.6, { side: THREE.DoubleSide })); f.rotation.y = -Math.PI / 2; f.position.set(3.51, 3.0, -1.5); room.add(f); }
// 燃料タンクの防油堤
for (const [x0, x1, z0, z1] of [[1.55, 3.45, 2.0, 2.15], [1.55, 3.45, 3.45, 3.6], [1.55, 1.7, 2.0, 3.6], [3.3, 3.45, 2.0, 3.6]]) bx(x0, x1, 0, 0.18, z0, z1, conc, room);
// 蓄電池設備（黄色い耐酸マットの区画・架台・配管）
const bat = new THREE.Group(); bat.position.set(-1.0, 0, 2.7); room.add(bat);
for (const [x0, x1, z0, z1] of [[-0.95, 0.95, -0.6, -0.5], [-0.95, 0.95, 0.5, 0.6], [-0.95, -0.85, -0.6, 0.6], [0.85, 0.95, -0.6, 0.6]]) bx(x0, x1, 0, 0.12, z0, z1, conc, bat);
bx(-0.85, 0.85, 0, 0.02, -0.5, 0.5, M(0xd6c94a, 0, 0.9), bat);
for (const x of [-0.6, 0.6]) for (const z of [-0.3, 0.3]) bx(x - 0.03, x + 0.03, 0, 0.55, z - 0.03, z + 0.03, beige, bat);
bx(-0.72, 0.72, 0.55, 0.6, -0.34, 0.34, beige, bat);
bx(-0.7, 0.7, 0.6, 0.9, -0.3, 0.3, M(0x2a2e3a, 0.3, 0.4, { transparent: true, opacity: 0.9 }), bat);
for (let i = 0; i < 12; i++) for (const z of [-0.14, 0.14]) {
  const x = -0.64 + i * 0.116;
  bx(x - 0.04, x + 0.04, 0.9, 0.96, z - 0.05, z + 0.05, M(0x1a1c20), bat);
  cyl(0.028, 0.04, i % 3 === 0 ? mat.yellow : M(0x4a5a78, 0.2, 0.5), x, 0.98, z, 'y', bat, 12);
}
pipe([[-0.62, 0.95, 0], [-0.62, 1.15, 0], [-0.4, 1.2, 0]], 0.02, mat.cable, bat);
for (const z of [0.0, 0.1, 0.2]) { cyl(0.05, 0.9, beige, 0.78, 0.45, z + 0.3, 'y', bat, 14); pipe([[0.62, 0.9, z * 0.3], [0.72, 1.0, z * 0.5 + 0.1], [0.78, 0.9, z + 0.3]], 0.02, mat.cable, bat); }
// 壁の掲示物・スイッチ
{ const n = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.5), M(0xf2f2f0, 0, 0.8)); n.position.set(-0.6, 1.5, 3.57); n.rotation.y = Math.PI; room.add(n); }
bx(-1.4, -1.28, 1.5, 1.7, 3.55, 3.6, M(0xdcdcdc), room);
bx(-0.5, -0.38, 1.9, 2.05, 3.55, 3.6, M(0xdcdcdc), room);
// はしご・白い袋・パレット・塗料缶
const lad = new THREE.Group(); lad.position.set(-3.7, 0, 2.5); room.add(lad);
for (const z of [-0.2, 0.2]) bx(-0.03, 0.03, 0, 2.3, z - 0.03, z + 0.03, beige, lad);
for (let i = 0; i < 8; i++) bx(-0.02, 0.02, 0.25 + i * 0.28, 0.29 + i * 0.28, -0.2, 0.2, beige, lad);
bx(-4.4, -3.4, 0, 0.1, 1.6, 2.2, M(0xb9a98a, 0, 0.9), room);
bx(-4.2, -3.6, 0.1, 0.35, 1.7, 2.1, M(0xf4f4f0, 0, 0.9), room);
for (const [x, z] of [[-4.6, 0.9], [-4.1, 1.2], [-3.4, 0.2]]) cyl(0.13, 0.32, M(0xb8bcc0, 0.8, 0.35), x, 0.16, z, 'y', room, 20);
cyl(0.13, 0.32, M(0x3a4a6a, 0.5, 0.5), -4.8, 0.16, 1.1, 'y', room, 20);


// ---------- 盤室側（ビデオ2・3より）：配電盤の並び・給気ガラリ・棚 ----------
const panelNames = ['高圧配電盤 GF2/GF1', '補機盤', '電源自動切換盤', '発電機盤', '自動操作盤'];
// ---- 盤面描画ヘルパ ----
const PW = 512, PH = 1256;
const D = {
  plate(g, x, y, w, h, t, fs = 24) { g.fillStyle = '#f7f7f5'; g.fillRect(x, y, w, h); g.strokeStyle = '#999'; g.lineWidth = 1.5; g.strokeRect(x, y, w, h); g.fillStyle = '#111'; g.font = `bold ${fs}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x + w / 2, y + h / 2 + 1); },
  text(g, x, y, t, fs = 12, c = '#111') { g.fillStyle = c; g.font = `${fs}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x, y); },
  meter(g, cx, cy, r, unit, nums, ang) {
    if (D.rec) D.rec.meter.push({ cx, cy, r });
    g.fillStyle = '#16181b'; g.fillRect(cx - r - 5, cy - r - 5, 2 * r + 10, 2 * r + 10);
    g.fillStyle = '#f6f6f2'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
    g.strokeStyle = '#111'; g.lineWidth = 1.5;
    for (let i = 0; i <= 20; i++) { const a = a0 + (a1 - a0) * i / 20, l = i % 2 ? 4 : 8; g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4)); g.lineTo(cx + Math.cos(a) * (r - 4 - l), cy + Math.sin(a) * (r - 4 - l)); g.stroke(); }
    nums.forEach((n, i) => { const a = a0 + (a1 - a0) * i / (nums.length - 1); D.text(g, cx + Math.cos(a) * (r - 20), cy + Math.sin(a) * (r - 20), n, Math.max(9, r * 0.24)); });
    D.text(g, cx, cy + r * 0.45, unit, r * 0.3);
    const a = a0 + (a1 - a0) * ang; g.strokeStyle = '#111'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8)); g.stroke();
    g.fillStyle = '#ddd'; g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fill(); g.stroke();
  },
  round(g, cx, cy, r) { if (D.rec) D.rec.meter.push({ cx, cy, r: r + 8, round: true }); g.fillStyle = '#16181b'; g.beginPath(); g.arc(cx, cy, r + 8, 0, 7); g.fill(); g.fillStyle = '#25282c'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.strokeStyle = '#ddd'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r - 8, 0, 7); g.stroke(); g.strokeStyle = '#e44'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + r * 0.55, cy - r * 0.2); g.stroke(); },
  relay(g, x, y, w, h, title) { if (D.rec) D.rec.relay.push({ x, y, w, h, title }); },
  knob(g, x, y, t) { g.fillStyle = '#b9bcbf'; g.fillRect(x - 17, y - 17, 34, 34); g.strokeStyle = '#666'; g.strokeRect(x - 17, y - 17, 34, 34); if (D.rec) D.rec.knob.push({ x, y }); if (t) D.text(g, x, y + 30, t, 10); g.fillStyle = '#e22'; g.beginPath(); g.moveTo(x + 17, y - 22); g.lineTo(x + 25, y - 22); g.lineTo(x + 21, y - 15); g.fill(); },
  lamp(g, x, y, c) { g.fillStyle = '#222'; g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); },
  matrix(g, x, y, cols, rows, cw, ch, cells, lit = []) { g.fillStyle = '#16181b'; g.fillRect(x - 4, y - 4, cols * cw + 8, rows * ch + 8); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const i = r * cols + c; g.fillStyle = lit.includes(i) ? '#f5dcb4' : '#efe2e0'; g.fillRect(x + c * cw + 1, y + r * ch + 1, cw - 2, ch - 2); if (cells && cells[i]) { const t = cells[i], k = Math.ceil(t.length / (t.length > 7 ? 3 : 2)), fs = Math.min(9, cw / 4.2); if (t.length <= 4) D.text(g, x + c * cw + cw / 2, y + r * ch + ch / 2, t, fs); else { const ls = []; for (let j = 0; j < t.length; j += k) ls.push(t.slice(j, j + k)); ls.forEach((l, j) => D.text(g, x + c * cw + cw / 2, y + r * ch + ch / 2 + (j - (ls.length - 1) / 2) * (fs + 1), l, fs)); } } } },
  handle(g, x, y) { if (D.rec) D.rec.handle.push({ x, y }); },
  danger(g, x, y, w = 78, h = 100) { g.fillStyle = '#fff'; g.fillRect(x, y, w, h); g.strokeStyle = '#bbb'; g.strokeRect(x, y, w, h); g.save(); g.translate(x + w - 18, y + 14); g.rotate(Math.PI / 4); g.fillStyle = '#e8590c'; g.fillRect(-9, -9, 18, 18); g.restore(); D.text(g, x + 20, y + 14, '危険', 11); g.fillStyle = '#aaa'; for (let i = 0; i < 7; i++) g.fillRect(x + 6, y + 32 + i * 9, w - 12, 3); },
  block(g, x, y, t, red) { if (D.rec) D.rec.block.push({ x, y, t, red }); },
};
const V300 = ['0', '50', '100', '150', '200', '250', '300'], V9000 = ['0', '2000', '4000', '6000', '8000', '9000'], HZ = ['55', '56', '58', '60', '62', '64', '65'], CS = ['.5', '.7', '.9', '1.0', '.9', '.7', '.5'];
function panelTex(name, kind) {
  const rec = { meter: [], relay: [], knob: [], handle: [], block: [], push: [] }; let first = true;
  const _t = canvasTex(PW, PH, (g, w, h) => {
    D.rec = first ? rec : null; first = false;
    g.fillStyle = '#cdc9b8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#a49f8c'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
    const L = (x, y, ww, t) => D.plate(g, x, y, ww, 18, t, 11);
    if (kind === 0) { // 高圧配電盤 GF2(上)/GF1(下)
      D.plate(g, 90, 22, 330, 40, '高圧配電盤GF2', 26);
      D.relay(g, 160, 300, 135, 150, 'ocr:51GF2'); D.text(g, 228, 475, '停電時実施', 12);
      D.matrix(g, 205, 495, 2, 1, 30, 26, ['GF2過電流', '']);
      L(95, 560, 50, '電流'); D.meter(g, 120, 635, 42, 'A', ['0', '10', '20', '30', '40'], 0.3);
      D.knob(g, 330, 620, '43RD2'); D.danger(g, 400, 280, 85, 110); D.handle(g, 440, 450);
      D.plate(g, 170, 735, 120, 14, 'NO.1CCR変圧器盤', 9); D.lamp(g, 195, 770, '#2c2'); D.lamp(g, 240, 770, '#e22');
      D.knob(g, 120, 810); D.knob(g, 215, 810, '3-52GF2'); D.block(g, 330, 790, 'CT2次');
      g.fillStyle = '#0a2fa0'; g.fillRect(150, 870, 190, 58); g.fillStyle = '#fff'; g.font = 'bold 20px sans-serif'; g.textAlign = 'center'; g.fillText('No1CCR', 245, 886); g.fillText('変圧器盤', 245, 913);
      g.fillStyle = '#9c978a'; g.fillRect(0, 940, w, 4);
      D.plate(g, 90, 975, 330, 40, '高圧配電盤GF1', 26);
      D.knob(g, 330, 1040, '43RD1'); D.lamp(g, 100, 1030, '#2c2'); D.lamp(g, 145, 1030, '#e22'); D.meter(g, 80, 1130, 34, 'A', ['0', '5', '10'], 0.3); D.relay(g, 160, 1085, 135, 150, 'ocr:51GF1'); D.block(g, 340, 1160, 'CT2次'); D.matrix(g, 205, 1060, 2, 1, 30, 26, ['GF1過電流', '']);
    } else if (kind === 1) { // 補機盤
      D.plate(g, 120, 90, 290, 44, '補 機 盤', 28);
      L(60, 230, 62, 'AC210V負荷'); L(290, 232, 62, 'AC105V負荷');
      [['V', ['0', '100', '200', '250', '300'], 0.6, 70], ['A', ['0', '20', '40', '60', '75'], 0.45, 185], ['V', ['0', '50', '100', '150'], 0.7, 300], ['A', ['0', '5', '10', '20', '30'], 0.6, 415]].forEach(([u, n, a, x]) => { D.plate(g, x - 25, 258, 50, 14, u === 'V' ? '電圧' : '電流', 9); D.meter(g, x, 328, 46, u, n, a); });
      D.matrix(g, 160, 460, 5, 2, 38, 34, ['LBS用ヒューズ断', '210V主幹MCCB断', '105V主幹MCCB断', '補機回路過電流', '送風機異常', '30kVA変圧器温度上昇', '210V分岐MCCB断', '105V分岐MCCB断', '補機回路漏電', '']);
      [[60, 600, ''], [175, 600, ''], [285, 600, ''], [395, 600, '']].forEach(([x, y]) => D.knob(g, x, y));
      ['43F', '43Q', '43WP', '43WH'].forEach((t, i) => D.knob(g, 60 + i * 112, 700, t)); ['43EF', '43S3', '43S2'].forEach((t, i) => D.knob(g, 60 + i * 112, 790, t));
      D.danger(g, 380, 920, 88, 120); D.handle(g, 440, 700);
    } else if (kind === 2) { // 電源自動切換盤
      D.plate(g, 100, 70, 310, 44, '電源自動切換盤', 28);
      [['電圧', 'V', V9000, 0.73 * S.load, 100], ['電力', 'kW', ['0', '100', '200', '300', '400'], 0.38 * S.load, 255], ['電流', 'A', ['0', '10', '20', '30', '40'], 0.3 * S.load, 410]].forEach(([l, u, n, a, x]) => { D.plate(g, x - 25, 200, 50, 14, l, 9); D.meter(g, x, 270, 46, u, n, a); });
      D.plate(g, 75, 335, 50, 14, '周波数', 9); D.meter(g, 100, 405, 46, 'Hz', HZ, S.mains ? 0.5 : S.brk ? S.hzAng : 0); D.plate(g, 385, 335, 50, 14, '力率', 9); D.meter(g, 410, 405, 46, 'cosφ', CS, S.load ? 0.55 : 0.5);
      D.knob(g, 150, 600); D.knob(g, 330, 600); D.lamp(g, 215, 680, S.mains && !S.brk ? '#f33' : '#401'); D.lamp(g, 260, 680, S.brk ? '#f33' : '#401'); D.text(g, 215, 660, '83C', 10); D.text(g, 260, 660, '83B', 10); D.knob(g, 238, 725, '3-83BC');
      D.handle(g, 40, 690); D.handle(g, 440, 690); D.danger(g, 400, 560, 80, 105);
      g.fillStyle = '#9c978a'; g.fillRect(0, 860, w, 3);
      [[70, 910, '27R1'], [270, 910, '27R2'], [70, 1060, '27RR1'], [270, 1060, '27RR2']].forEach(([x, y, t]) => { D.text(g, x + 70, y - 12, '停電時実施', 11); D.relay(g, x, y, 130, 125, (t.startsWith('27RR') ? 'ovr:' : 'uvr:') + t); });
      D.block(g, 80, 1200, 'VT2次', true); D.block(g, 230, 1200, 'CT2次'); D.block(g, 400, 1200, 'VT2次', true);
    } else if (kind === 3) { // 発電機盤
      D.plate(g, 100, 40, 310, 40, '発 電 機 盤', 28);
      L(85, 110, 60, 'VT2次'); L(335, 110, 70, 'EVT2次');
      [[75, 'V', V300, S.vAng, '電圧'], [255, 'A', ['0', '200', '400', '600', '800', '1000', '1200'], S.aAng, '電流'], [430, 'V', V9000, S.evtAng, '電圧']].forEach(([x, u, n, a, l]) => { D.plate(g, x - 25, 148, 50, 14, l, 9); D.meter(g, x, 218, 46, u, n, a); });
      [[75, 'Hz', HZ, S.hzAng, '周波数'], [255, 'kW', ['0', '100', '200', '300', '400'], S.kwAng, '電力'], [430, 'cosφ', CS, S.cosAng, '力率']].forEach(([x, u, n, a, l]) => { D.plate(g, x - 25, 288, 50, 14, l, 9); D.meter(g, x, 358, 46, u, n, a); });
      D.plate(g, 50, 430, 50, 14, '運転時間', 9); D.round(g, 75, 490, 30); D.text(g, 75, 490, '0527', 10, '#fff');
      D.plate(g, 225, 430, 50, 14, '電力量', 9); g.fillStyle = '#f3f3ef'; g.fillRect(215, 455, 80, 100); g.strokeStyle = '#222'; g.lineWidth = 3; g.strokeRect(215, 455, 80, 100); D.text(g, 255, 475, '06884', 13); D.text(g, 255, 520, '機械電力量計', 8);
      D.plate(g, 405, 430, 50, 14, '零相電圧', 9); D.meter(g, 430, 500, 46, 'V', ['0', '2000', '4000', '6000', '7000'], 0.5);
      D.plate(g, 50, 565, 50, 14, '運転度数', 9); g.fillStyle = '#16181b'; g.fillRect(45, 590, 62, 24); D.text(g, 76, 602, '00983', 11, '#fff');
      ['R', 'S', 'T'].forEach((t, i) => { D.text(g, 385 + i * 40, 580, t, 11); D.lamp(g, 385 + i * 40, 605, '#333'); });
      D.knob(g, 75, 680); D.knob(g, 255, 680); D.knob(g, 430, 680);
      D.plate(g, 215, 745, 80, 14, '発電機遮断器', 9); D.lamp(g, 232, 785, S.brk ? '#041' : '#2c2'); D.lamp(g, 278, 785, S.brk ? '#f33' : '#401');
      D.round(g, 100, 840, 50); D.knob(g, 385, 830, '電圧'); D.handle(g, 40, 940); D.handle(g, 465, 840); D.danger(g, 10, 650, 78, 100); D.danger(g, 425, 650, 80, 100);
      D.relay(g, 120, 910, 130, 150, 'ocr:51G'); D.relay(g, 280, 910, 130, 150, 'ovr:59G'); D.relay(g, 200, 1090, 90, 150, 'lvg:64G');
      D.plate(g, 330, 1130, 170, 90, '自家発電装置 300kVA 210V 60Hz（例）', 11); 
      D.block(g, 30, 1200, 'VT2次', true); D.block(g, 100, 1200, 'CT2次'); D.block(g, 170, 1200, 'EVT2次', true);
    } else { // 自動操作盤
      D.plate(g, 60, 30, 400, 56, '自動操作盤', 36);
      D.plate(g, 90, 180, 70, 14, '界磁電圧', 9); D.meter(g, 125, 250, 56, 'V', ['0', '10', '20', '30', '40', '50'], 0.6 * S.volt); D.plate(g, 290, 180, 70, 14, '界磁電流', 9); D.meter(g, 325, 250, 56, 'A', ['0', '2', '4', '6', '8', '10'], 0.5 * S.volt);
      L(190, 395, 66, '状態表示'); D.matrix(g, 150, 420, 5, 2, 40, 30, ['制御電源', '自動', '試験', '商用電源受電中', '発電装置運転中', '', '手動', '試験始動', '商用電力側', '発電電源側'], [0, 1, ...(S.mains ? [3] : []), ...(S.rpm > 600 ? [4] : []), S.brk ? 9 : 8]);
      L(190, 495, 66, '故障表示'); D.matrix(g, 80, 520, 8, 3, 40, 30, ['過電流', '過電圧', '過速度', '自然停止', '', '燃料油面異常', '自動充電装置異常', '変圧器温度上昇', '水温過昇', '電圧低下', '始動渋滞', '非常停止', '', '地絡過電圧', '保温装置異常', '', '', '制御電源故障', '油圧低下', '励磁装置故障', '', '注油圧力不足', '', '']);
      g.fillStyle = '#fff'; g.fillRect(195, 625, 90, 36); g.strokeStyle = '#d33'; g.strokeRect(195, 625, 90, 36); D.text(g, 240, 637, '43E', 11, '#d22'); D.text(g, 240, 653, '常に自動', 11, '#d22'); D.knob(g, 240, 700, '43E');
      ['試験停止', '試験始動', '警報停止', '故障復帰', '試験点灯'].forEach((t, i) => { const x = 55 + i * 62; L(x - 28, 800, 56, t); D.rec && D.rec.push.push({ x, y: 850, r: 22, c: 0x15171a }); });
      L(375, 800, 60, '非常停止'); D.rec && D.rec.push.push({ x: 405, y: 850, r: 28, c: 0xd01010, estop: true }); D.text(g, 405, 892, '5E (PULL)', 11);
      g.fillStyle = '#fafafa'; g.fillRect(300, 330, 175, 270); g.strokeStyle = '#aaa'; g.strokeRect(300, 330, 175, 270); D.text(g, 388, 345, '予備自家発電設備 停止・起動準備手順', 8); for (let i = 0; i < 30; i++) { g.fillStyle = i < 9 ? '#c33' : '#555'; g.fillRect(308, 360 + i * 7.5, 160 - (i % 5) * 9, 2); }
      D.danger(g, 380, 640, 88, 115); D.handle(g, 430, 860); g.fillStyle = '#c9a15c'; g.fillRect(412, 940, 36, 110);
    }
  });
  D.rec = null; _t.userData.rec = rec;
  if (kind >= 2) dynTex.push(_t);
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
function relayFace(type, tag) {
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
  const bw = f.vert ? 0.115 : 0.205, bh = f.vert ? 0.215 : 0.26, fw = bw - 0.075, fh = bh - 0.105;
  g3.add(ext(rrShape(bw, bh, 0.014), 0.02, blkG));
  const st = ext(rrShape(bw - 0.03, bh - 0.04, 0.01), 0.012, blkG); st.position.z = 0.022; g3.add(st);
  const rec = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.058, bh - 0.08, 0.004), M(0x050506, 0.2, 0.9)); rec.position.z = 0.036; g3.add(rec);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshStandardMaterial({ map: f.tex, roughness: 0.4, metalness: 0.5 })); face.position.set(0, 0.006, 0.039); g3.add(face);
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
  g3.userData.size = [bw, bh]; return g3;
}
function blockFace(t, red) {
  return canvasTex(160, 140, (g, w, h) => {
    g.fillStyle = '#14161a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2f2f0'; g.fillRect(14, 12, 132, 34); g.fillStyle = '#111'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 80, 30);
    g.fillStyle = '#35373b'; g.fillRect(14, 56, 132, 46); g.fillStyle = '#aaa'; for (let i = 0; i < 4; i++) g.fillRect(24 + i * 30, 62, 18, 12);
    if (red) { g.fillStyle = '#d11'; g.fillRect(14, 110, 132, 22); g.fillStyle = '#fff'; g.font = 'bold 18px sans-serif'; g.fillText('PT', 80, 122); } else { g.fillStyle = '#ddd'; g.font = 'bold 20px sans-serif'; g.fillText('CT', 80, 122); }
  });
}
function block3D(t, red) {
  const g3 = new THREE.Group();
  g3.add(ext(rrShape(0.085, 0.075, 0.006), 0.022, blkG, 0.002));
  const fc = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.062), new THREE.MeshStandardMaterial({ map: blockFace(t, red), roughness: 0.4 })); fc.position.z = 0.0245; g3.add(fc);
  const cv = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.016), new THREE.MeshPhysicalMaterial({ color: 0xcfe0e8, transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false })); cv.position.set(0, -0.002, 0.03); cv.rotation.x = -0.25; g3.add(cv);
  return g3;
}
const starShape = (() => { const s = new THREE.Shape(); const n = 12; for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n, r = i % 2 ? 0.0205 : 0.0265; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); } s.closePath(); return s; })();
function knob3D() {
  const g3 = new THREE.Group();
  const kb = ext(starShape, 0.022, blkG, 0.0025); kb.position.z = 0.004; g3.add(kb);
  const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.014, 20), blkG); sk.rotation.x = Math.PI / 2; sk.position.z = 0.002; g3.add(sk);
  const ptr = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.022, 0.002), M(0xeeeeee, 0, 0.5)); ptr.position.set(0, 0.01, 0.0305); g3.add(ptr);
  return g3;
}
function handle3D() {
  const g3 = new THREE.Group(), b = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.016, 24), chrome); b.rotation.x = Math.PI / 2; b.position.z = 0.008; g3.add(b);
  const arm = ext(rrShape(0.026, 0.115, 0.012), 0.018, chrome, 0.003); arm.position.set(0, -0.045, 0.02); g3.add(arm);
  const ax = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 18), chrome); ax.rotation.x = Math.PI / 2; ax.position.z = 0.026; g3.add(ax); return g3;
}
function meter3D(r, round) {
  const g3 = new THREE.Group(), R = r * KM, S2 = (r + 5) * KM, th = 0.0045;
  if (round) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.012, R + 0.012, 0.035, 36, 1, true), blkG); ring.rotation.x = Math.PI / 2; ring.position.z = 0.0175; g3.add(ring);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.005, 0.008, 10, 40), blkG); rim.position.z = 0.035; g3.add(rim);
  } else {
    for (const [w, h, x, y] of [[2 * S2, th, 0, S2 - th / 2], [2 * S2, th, 0, -S2 + th / 2], [th, 2 * S2, S2 - th / 2, 0], [th, 2 * S2, -S2 + th / 2, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.034), blkG); b.position.set(x, y, 0.017); b.castShadow = true; g3.add(b); }
    const rim = ext(rrShape(2 * S2, 2 * S2, 0.006), 0.004, blkG, 0.001); rim.position.z = 0.033; rim.scale.set(1, 1, 1); rim.visible = false; g3.add(rim);
  }
  const gl = new THREE.Mesh(new THREE.CircleGeometry(R + 0.004, 36), glassM); gl.position.z = 0.03; g3.add(gl);
  const hl = new THREE.Mesh(new THREE.PlaneGeometry(R * 0.9, R * 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false })); hl.position.set(-R * 0.15, R * 0.55, 0.031); hl.rotation.z = 0.5; g3.add(hl);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.11, R * 0.13, 0.012, 20), M(0xeeeeee, 0.6, 0.3)); cap.rotation.x = Math.PI / 2; cap.position.z = 0.012; g3.add(cap);
  return g3;
}
function push3D(r, c, estop) {
  const g3 = new THREE.Group(), R = r * KM;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.012, 24), silv); ring.rotation.x = Math.PI / 2; ring.position.z = 0.006; g3.add(ring);
  if (estop) { const m = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.85, R * 0.9, 0.028, 28), M(c, 0.2, 0.4)); m.rotation.x = Math.PI / 2; m.position.z = 0.026; g3.add(m); const dm = new THREE.Mesh(new THREE.SphereGeometry(R * 0.85, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(c, 0.2, 0.35)); dm.rotation.x = Math.PI / 2; dm.position.z = 0.04; g3.add(dm); }
  else { const cp2 = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.7, R * 0.72, 0.014, 24), M(c, 0.3, 0.35)); cp2.rotation.x = Math.PI / 2; cp2.position.z = 0.018; g3.add(cp2); }
  return g3;
}
function buildDevices(parent, px, rec, z0 = -2.875) {
  const P = (x, y) => [px + (x - 256) * KM, 2.29 - y * KM];
  const put = (o, x, y, z = 0.001) => { const [wx, wy] = P(x, y); o.position.set(wx, wy, z0 + z); parent.add(o); return o; };
  rec.meter.forEach(m => put(meter3D(m.r, m.round), m.cx, m.cy));
  rec.relay.forEach(r => { const [type, tag] = r.title.split(':'); const o = relay3D(type, tag); put(o, r.x + r.w / 2, r.y + r.h / 2); });
  rec.block.forEach(b => put(block3D(b.t, b.red), b.x + 23, b.y + 20));
  rec.knob.forEach(k => { const o = put(knob3D(), k.x, k.y); o.rotation.z = -0.6 + (k.x * 0.013 + k.y * 0.007) % 1.2; });
  rec.handle.forEach(h => put(handle3D(), h.x, h.y));
  rec.push.forEach(p => put(push3D(p.r, p.c, p.estop), p.x, p.y));
}

const pnl = new THREE.Group(); pnl.rotation.y = Math.PI / 2; pnl.position.set(-6.97, 0, -5.15); room.add(pnl);
// ================= 盤の扉と内部（写真：発電機盤・自動操作盤の内部） =================
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
function cabinetInside(ig, kind) {
  // 共通：背板・縦ダクト・棚レール・照明
  bx(-0.43, 0.43, 0.14, 2.24, 0.0, 0.01, sheetM, ig);
  wduct(ig, -0.4, 1.2, 0.05, 2.0, true); wduct(ig, 0.41, 1.2, 0.05, 2.0, true);
  for (const y of [0.12, 2.2]) bx(-0.44, 0.44, y, y + 0.03, 0.0, 0.3, railM, ig);
  bx(-0.3, 0.3, 2.19, 2.23, 0.12, 0.2, M(0xc9c9c0, 0.3, 0.6), ig);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 12), new THREE.MeshBasicMaterial({ color: 0xfffbe8 })); tube.rotation.z = Math.PI / 2; tube.position.set(0, 2.17, 0.17); ig.add(tube);
  cyl(0.02, 0.025, darkP, 0.38, 2.2, 0.22, 'z', ig, 14);   // 扉連動の灯
  for (let y = 0.3; y < 2.1; y += 0.07) { wire(ig, [-0.39, y, 0.06], [-0.3 + rnd() * 0.1, y + 0.03, 0.04]); if (rnd() > 0.4) wire(ig, [0.4, y, 0.06], [0.3 - rnd() * 0.1, y + 0.03, 0.04]); }
  if (kind === 4) {            // 自動操作盤（写真1）
    for (const [y, x] of [[1.98, -0.2], [1.72, -0.2]]) { bx(x - 0.1, x + 0.1, y - 0.045, y + 0.045, 0.02, 0.1, cream, ig); for (let i = 0; i < 6; i++) { cyl(0.008, 0.03, darkP, x - 0.08 + i * 0.032, y, 0.115, 'z', ig, 8); bx(x - 0.085 + i * 0.032, x - 0.075 + i * 0.032, y - 0.04, y - 0.03, 0.1, 0.12, whtM, ig); } wire(ig, [x - 0.09, y - 0.045, 0.1], [x - 0.3, y - 0.12, 0.05]); }
    { const mc = new THREE.Group(); mc.position.set(0.17, 1.82, 0.02); ig.add(mc); bx(-0.1, 0.1, -0.18, 0.18, 0, 0.1, darkP, mc); bx(-0.08, 0.08, 0.02, 0.1, 0.1, 0.105, M(0xc6c6c6), mc); bx(-0.03, 0.03, -0.04, 0.0, 0.1, 0.16, M(0xcc2222, 0.2, 0.5), mc); const lb = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), plateT([['MCCB', 16], ['2 POLE', 12]], 128, 70)); lb.position.set(0, 0.13, 0.106); mc.add(lb); }
    for (const [yc, hh] of [[1.42, 0.32], [0.97, 0.5], [0.45, 0.5]]) {
      bx(-0.31, 0.3, yc - hh / 2, yc + hh / 2, 0.02, 0.26, cream, ig);
      const mp = new THREE.Mesh(new THREE.PlaneGeometry(0.46, hh - 0.06), new THREE.MeshStandardMaterial({ map: meshMat.map.clone(), roughness: 0.6 })); mp.material.map.needsUpdate = true; mp.material.map.repeat.set(3, hh * 8); mp.position.set(0, yc, 0.262); ig.add(mp);
      const rd = new THREE.Mesh(new THREE.PlaneGeometry(0.46, (hh - 0.06) * 0.6), M(0xb02a2a, 0, 0.9)); rd.position.set(0, yc - (hh - 0.06) * 0.2, 0.258); if (yc < 1.2) ig.add(rd);
      for (const hx of [-0.285, 0.275]) bx(hx - 0.008, hx + 0.008, yc - 0.06, yc + 0.06, 0.262, 0.285, M(0x9a9fa5, 0.5, 0.4), ig);
    }
    { const t = new THREE.Group(); t.position.set(-0.17, 1.08, 0.27); ig.add(t); const rg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 28), blkG); rg.rotation.x = Math.PI / 2; t.add(rg); const fc = new THREE.Mesh(new THREE.CircleGeometry(0.062, 28), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#e9e9e4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 3; for (let i = 0; i < 12; i++) { const a = Math.PI * (0.75 + 1.5 * i / 11); g.beginPath(); g.moveTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); g.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); g.stroke(); } g.lineWidth = 4; g.beginPath(); g.moveTo(64, 64); g.lineTo(90, 40); g.stroke(); }), roughness: 0.3 })); fc.position.z = 0.021; t.add(fc); wire(ig, [-0.17, 1.15, 0.27], [-0.35, 1.45, 0.06], M(0xb8bcc0, 0.6, 0.4), 0.004); }
  } else if (kind === 3) {      // 発電機盤（写真2）
    bx(-0.37, -0.03, 1.9, 2.03, 0.02, 0.1, darkP, ig); relayRow(ig, 0.0, 1.97, 10, 0.034, 0.1, darkP); bx(0.36, 0.43, 1.88, 2.06, 0.02, 0.09, darkP, ig);
    for (let i = 0; i < 4; i++) bx(-0.37 + i * 0.04 - 0.017, -0.37 + i * 0.04 + 0.017, 1.72, 1.8, 0.02, 0.1, cream, ig);
    bx(0.04, 0.12, 1.74, 1.82, 0.02, 0.09, darkP, ig); bx(0.27, 0.4, 1.7, 1.84, 0.02, 0.1, cream, ig);
    for (let i = 0; i < 4; i++) wire(ig, [-0.35 + i * 0.04, 1.72, 0.1], [-0.37 + i * 0.05, 1.62, 0.06]);
    bx(-0.38, 0.3, 1.575, 1.585, 0.0, 0.07, railM, ig); timerRow(ig, -0.34, 1.58 + 0.03, 10, 0.07);
    bx(-0.34, 0.34, 1.12, 1.4, 0.0, 0.02, M(0xc8ccce, 0.6, 0.4), ig);
    { const av = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.2), plateT([['自動電圧調整器', 22], ['形式 AVR-A', 15]], 320, 100)); av.position.set(-0.03, 1.27, 0.025); ig.add(av); const mod = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.2), plateT([['モジュール部', 14]], 160, 100)); mod.position.set(0.18, 1.27, 0.026); mod.visible = false; ig.add(mod); }
    for (let i = 0; i < 16; i++) { bx(-0.33 + i * 0.038, -0.3 + i * 0.038, 1.13, 1.16, 0.02, 0.045, i % 3 === 0 ? blueM : whtM, ig); wire(ig, [-0.315 + i * 0.038, 1.13, 0.045], [-0.315 + i * 0.038 + (rnd() - 0.5) * 0.02, 1.04, 0.04]); }
    { const u = new THREE.Group(); u.position.set(-0.02, 0.1, 0.12); ig.add(u); bx(-0.19, 0.19, 0.12, 0.88, -0.08, 0.2, cream, u); bx(-0.19, 0.19, 0.05, 0.12, -0.06, 0.18, railM, u); bx(-0.17, 0.17, 0.86, 0.9, -0.06, 0.18, M(0x303236, 0.5, 0.5), u);
      for (const sx of [-0.09, 0.09]) { const mt = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.07), new THREE.MeshStandardMaterial({ map: canvasTex(128, 112, (g, w, h) => { g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4); g.beginPath(); g.arc(64, 90, 50, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); g.beginPath(); g.moveTo(64, 90); g.lineTo(80, 50); g.stroke(); }), roughness: 0.3 })); mt.position.set(sx, 0.68, 0.201); u.add(mt); }
      bx(-0.16, 0.16, 0.34, 0.56, 0.2, 0.205, M(0xbfbba8, 0.2, 0.7), u); for (let i = 0; i < 4; i++) bx(-0.14 + i * 0.07, -0.1 + i * 0.07, 0.8, 0.83, 0.2, 0.205, i % 2 ? M(0xf0a040) : M(0xe8d9a0), u); }
    for (const y of [0.9, 0.6]) { bx(0.3, 0.42, y - 0.06, y + 0.06, 0.03, 0.09, M(0xb4b8bc, 0.5, 0.4), ig); const k = knob3D(); k.position.set(0.36, y, 0.09); ig.add(k); }
    for (const x of [-0.36, -0.28]) cyl(0.03, 0.8, M(0x8a8e92, 0.2, 0.9), x, 0.52, 0.06, 'y', ig, 12);
  } else if (kind === 0) {      // 高圧配電盤 GF2/GF1：真空遮断器（VCB）の見本（実際は開閉不可の想定）
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
  } else if (kind === 1) {      // 補機盤（写真：リレー列・MCCB・変圧器・端子台が段ごとに並ぶ）
    bx(-0.4, -0.29, 2.0, 2.11, 0.02, 0.11, darkP, ig); bx(-0.32, -0.2, 2.03, 2.07, 0.11, 0.115, M(0xe8d9a0), ig);
    for (let i = 0; i < 12; i++) { bx(-0.2 + i * 0.028, -0.18 + i * 0.028, 2.0, 2.1, 0.02, 0.07, i % 3 === 0 ? whtM : cream, ig); bx(-0.195 + i * 0.028, -0.185 + i * 0.028, 2.1, 2.115, 0.02, 0.07, redM, ig); wire(ig, [-0.19 + i * 0.028, 2.0, 0.07], [-0.19 + i * 0.028, 1.93, 0.06], i % 2 ? yelM : redM); }
    timerRow(ig, 0.12, 2.06, 3, 0.05);
    for (const y of [1.965, 1.775, 1.49, 1.24, 1.0, 0.84, 0.64, 0.46]) bx(-0.4, 0.4, y, y + 0.02, 0.0, 0.1, railM, ig);
    relayRow(ig, -0.36, 1.87, 22, 0.0335, 0.07, darkP);
    for (const x of [-0.17, 0.17]) { bx(x - 0.04, x + 0.04, 1.55, 1.68, 0.02, 0.09, darkP, ig); bx(x - 0.03, x + 0.03, 1.63, 1.66, 0.09, 0.095, M(0xe9c820), ig); bx(x - 0.01, x + 0.01, 1.57, 1.6, 0.09, 0.11, redM, ig); for (let k = 0; k < 3; k++) wire(ig, [x - 0.025 + k * 0.025, 1.68, 0.09], [x - 0.03 + k * 0.03, 1.74, 0.05]); }
    for (let i = 0; i < 4; i++) { const x = -0.26 + i * 0.16; bx(x - 0.04, x + 0.04, 1.31, 1.41, 0.02, 0.09, M(0x5b3a22, 0.3, 0.6), ig); bx(x - 0.045, x + 0.045, 1.29, 1.31, 0.02, 0.09, darkP, ig); wire(ig, [x, 1.41, 0.09], [x + 0.03, 1.47, 0.06]); }
    for (let i = 0; i < 5; i++) { const x = -0.3 + i * 0.12; bx(x - 0.04, x + 0.04, 1.06, 1.2, 0.02, 0.08, darkP, ig); bx(x - 0.03, x + 0.03, 1.15, 1.18, 0.08, 0.085, M(0xe9c820), ig); wire(ig, [x - 0.02, 1.06, 0.08], [x - 0.02, 1.0, 0.05]); wire(ig, [x + 0.02, 1.2, 0.08], [x + 0.02, 1.26, 0.05]); }
    for (let i = 0; i < 22; i++) { const x = -0.36 + i * 0.033; bx(x - 0.012, x + 0.012, 0.9, 1.0, 0.0, 0.06, i % 4 ? cream : whtM, ig); wire(ig, [x, 0.9, 0.06], [x + (rnd() - 0.5) * 0.03, 0.84, 0.05]); }
    for (let i = 0; i < 8; i++) { const x = -0.34 + i * 0.075; bx(x - 0.03, x + 0.03, 0.66, 0.84, 0.02, 0.09, darkP, ig); bx(x - 0.01, x + 0.01, 0.8, 0.82, 0.09, 0.1, whtM, ig); wire(ig, [x - 0.02, 0.66, 0.09], [x - 0.02, 0.58, 0.05], redM); wire(ig, [x + 0.02, 0.66, 0.09], [x + 0.02, 0.58, 0.05]); }
    wduct(ig, 0, 0.55, 0.06, 0.78, false); wduct(ig, 0, 0.37, 0.06, 0.78, false);
    for (let i = 0; i < 24; i++) { const x = -0.36 + i * 0.031; bx(x - 0.011, x + 0.011, 0.4, 0.5, 0.0, 0.05, i % 5 ? cream : whtM, ig); bx(x - 0.011, x + 0.011, 0.22, 0.32, 0.0, 0.05, i % 4 ? cream : whtM, ig); }
    bx(-0.38, 0.38, 0.12, 0.16, 0.0, 0.2, M(0x9aa09c, 0.4, 0.6), ig);
  } else if (kind === 2) {      // 電源自動切換盤（写真：網カバー付きの大きな切換器ユニット）
    const cmesh = (w, h, x, y, z) => { const mp = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: meshMat.map.clone(), roughness: 0.6 })); mp.material.map.needsUpdate = true; mp.material.map.repeat.set(w * 7, h * 7); mp.position.set(x, y, z); ig.add(mp); };
    bx(-0.38, 0.38, 1.55, 2.1, 0.02, 0.3, cream, ig); cmesh(0.58, 0.42, -0.03, 1.84, 0.302); bx(0.3, 0.33, 1.7, 1.95, 0.3, 0.32, M(0x9a9fa5, 0.5, 0.4), ig);
    { const h = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.025), chrome); h.position.set(0.335, 1.82, 0.32); ig.add(h); }
    { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.04), plateT([['89GR', 20]], 160, 56)); pl.position.set(0.28, 1.62, 0.302); ig.add(pl); const wn = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.07), new THREE.MeshStandardMaterial({ map: canvasTex(64, 90, drawWarn), roughness: 0.5 })); wn.position.set(0.335, 2.0, 0.302); ig.add(wn); }
    bx(-0.38, 0.38, 1.28, 1.5, 0.02, 0.3, cream, ig); cmesh(0.5, 0.14, -0.02, 1.4, 0.302);
    bx(-0.4, 0.4, 1.23, 1.26, 0.0, 0.1, railM, ig); bx(-0.4, 0.4, 1.0, 1.02, 0.0, 0.1, railM, ig);
    relayRow(ig, -0.32, 1.11, 3, 0.04, 0.07, darkP); relayRow(ig, 0.0, 1.11, 2, 0.05, 0.07, darkP); timerRow(ig, 0.2, 1.1, 2, 0.06);
    for (const x of [-0.37, 0.37]) { bx(x - 0.02, x + 0.02, 1.0, 1.25, 0.0, 0.06, whtM, ig); }
    bx(-0.37, 0.31, 0.14, 0.92, 0.02, 0.34, cream, ig); cmesh(0.56, 0.28, -0.03, 0.73, 0.342); cmesh(0.56, 0.28, -0.03, 0.35, 0.342);
    bx(0.12, 0.23, 0.5, 0.68, 0.34, 0.35, darkP, ig); bx(0.12, 0.23, 0.12, 0.28, 0.34, 0.35, darkP, ig);
    for (const [t, y] of [['83C', 0.7], ['83B', 0.28]]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.025), plateT([[t, 18]], 100, 52)); pl.position.set(0.17, y + 0.1, 0.352); ig.add(pl); }
    bx(-0.34, -0.31, 0.3, 0.58, 0.34, 0.37, M(0x9a9fa5, 0.5, 0.4), ig);
    { const wn = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.07), new THREE.MeshStandardMaterial({ map: canvasTex(64, 90, drawWarn), roughness: 0.5 })); wn.position.set(-0.2, 0.55, 0.342); ig.add(wn); }
    bx(-0.2, -0.04, 0.0, 0.14, 0.0, 0.02, M(0x9aa09c, 0.3, 0.6), ig);
    for (let i = 0; i < 18; i++) { const y = 0.3 + i * 0.1; wire(ig, [0.4, y, 0.06], [0.33 - rnd() * 0.05, y - 0.03, 0.05], yelM); }
  } else {                      // その他の盤：DIN レール＋端子台
    for (const y of [1.9, 1.62, 1.34, 1.06]) { bx(-0.36, 0.36, y - 0.12, y - 0.1, 0.0, 0.05, railM, ig); relayRow(ig, -0.32, y, 10, 0.07, 0.07, i0(y)); for (let i = 0; i < 8; i++) bx(-0.3 + i * 0.075, -0.27 + i * 0.075, y - 0.2, y - 0.17, 0.02, 0.06, i % 2 ? whtM : blueM, ig); }
    if (kind === 1) { bx(-0.3, 0.3, 0.2, 0.82, 0.02, 0.3, M(0x9aa09c, 0.3, 0.6), ig); bx(-0.2, 0.2, 0.84, 0.88, 0.1, 0.2, M(0x2a2c30), ig); }
    else bx(-0.34, 0.34, 0.2, 0.7, 0.02, 0.12, M(0xb4b6b0, 0.3, 0.6), ig);
  }
}
const i0 = y => (y > 1.5 ? darkP : cream);
function doorBack(dg, rec, cx) {
  const P = (xx, yy) => [cx + (xx - 256) * KM, 2.29 - yy * KM];
  const termDots = (g, x, y, w) => { for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.012, 8), M(0xd0b060, 0.8, 0.3)); t.rotation.x = Math.PI / 2; t.position.set(x - w / 2 + 0.01 + i * (w - 0.02) / 5, y, -0.115); g.add(t); } };
  const rows = new Set();
  rec.meter.forEach(m => { const [x, y] = P(m.cx, m.cy); const r = m.r * KM * 0.62; const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.07, 22), darkP); b.rotation.x = Math.PI / 2; b.position.set(x, y, -0.065); b.castShadow = true; dg.add(b); termDots(dg, x, y - r * 0.5, r * 1.6); rows.add(Math.round(y * 5)); if (rnd() > 0.2) wire(dg, [x - r * 0.4, y - r * 0.55, -0.12], [Math.min(x + 0.1, 0.12), y - r - 0.04, -0.09]); });
  rec.relay.forEach(rl => { const [x, y] = P(rl.x + rl.w / 2, rl.y + rl.h / 2); const b = bx(x - 0.055, x + 0.055, y - 0.06, y + 0.06, -0.14, -0.03, darkP, dg); termDots(dg, x, y - 0.05, 0.1); termDots(dg, x, y + 0.05, 0.1); rows.add(Math.round(y * 5)); wire(dg, [x - 0.04, y + 0.065, -0.15], [0.08, y + 0.12, -0.09]); wire(dg, [x + 0.04, y - 0.065, -0.15], [0.08, y - 0.12, -0.09]); });
  rec.knob.forEach(k => { const [x, y] = P(k.x, k.y); cyl(0.02, 0.05, darkP, x, y, -0.055, 'z', dg, 12); const t = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.012), M(0xd0b060, 0.8, 0.3)); t.position.set(x, y - 0.03, -0.085); dg.add(t); if (rnd() > 0.5) wire(dg, [x, y - 0.03, -0.09], [0.08, y - 0.06, -0.09]); });
  rec.block.forEach(b => { const [x, y] = P(b.x + 23, b.y + 20); bx(x - 0.04, x + 0.04, y - 0.035, y + 0.035, -0.09, -0.03, darkP, dg); wire(dg, [x, y - 0.03, -0.09], [0.08, y - 0.1, -0.09]); });
  wduct(dg, cx - 0.36, 1.2, -0.075, 1.9, true); rows.forEach(r => { const y = r / 5 - 0.12; if (y > 0.3) wduct(dg, cx + 0.1, y, -0.075, 0.5, false, 0.04); });
  bx(cx - 0.455, cx - 0.435, 0.1, 2.2, -0.05, -0.03, M(0xb89a3c, 0.8, 0.35), dg);     // 蝶番側の金具
  bx(cx - 0.455, cx + 0.45, 0.78, 0.8, -0.05, -0.03, M(0xb89a3c, 0.8, 0.35), dg);
  const np = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.14), plateT([['盤銘板', 15], ['（教育用モデル）', 15]], 200, 90)); np.position.set(cx - 0.05, 0.5, -0.032); np.rotation.y = Math.PI; dg.add(np);
}
function buildCabinet(i, x, nm) {
  const tx = panelTex(nm, i), rec = tx.userData.rec, hingeX = x - 0.465, W = 0.93;
  // 盤の躯体（背板・側板・天板・底・前枠）
  bx(x - 0.47, x + 0.47, 0, 2.3, -3.38, -3.36, sheetM, pnl); bx(x - 0.47, x - 0.45, 0, 2.3, -3.38, -2.88, cream, pnl); bx(x + 0.45, x + 0.47, 0, 2.3, -3.38, -2.88, cream, pnl);
  bx(x - 0.47, x + 0.47, 2.28, 2.3, -3.38, -2.88, cream, pnl); bx(x - 0.47, x + 0.47, 0, 0.12, -3.38, -2.88, M(0xbdb8a5, 0.2, 0.7), pnl);
  bx(x - 0.47, x + 0.47, 2.25, 2.3, -2.9, -2.875, cream, pnl); bx(x - 0.47, x + 0.47, 0.1, 0.14, -2.9, -2.875, cream, pnl);
  const ig = new THREE.Group(); ig.position.set(x, 0, -3.36); pnl.add(ig); cabinetInside(ig, i);
  // 扉（表：計器・継電器・スイッチ／裏：計器の背面・配線）
  const dg = new THREE.Group(); dg.position.set(hingeX, 0, -2.875); pnl.add(dg); dg.userData.door = i;
  bx(0.0, W, 0.01, 2.29, -0.03, -0.002, cream, dg);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(W, 2.28), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.45 })); f.position.set(W / 2, 1.15, 0); dg.add(f);
  buildDevices(dg, 0.465, rec, 0);
  doorBack(dg, rec, 0.465);
  const d = { g: dg, cur: 0, target: 0, light: null };
  if (i === 3 || i === 4 || i === 2) { const l = new THREE.PointLight(0xfff2dc, 0, 2.6, 1.6); l.position.set(x, 2.0, -3.0); pnl.add(l); d.light = l; }
  doors.push(d);
}

panelNames.forEach((nm, i) => buildCabinet(i, -8.3 + i * 0.95, nm));
// 盤の右隣（-z壁）：給気ガラリ、鋼製棚、灰色キャビネット、扉　／　盤の左端：ケーブルドラム（写真1・2より）
const lv = new THREE.Group(); lv.position.set(-3.0, 3.0, -3.36); room.add(lv);
bx(-0.65, 0.65, -0.5, 0.5, -0.04, 0.04, M(0x6f8f96, 0.4, 0.6), lv);
for (let i = 0; i < 9; i++) bx(-0.6, 0.6, -0.45 + i * 0.105, -0.4 + i * 0.105, 0.04, 0.1, M(0xe0dccb, 0.2, 0.7), lv);
const rack = new THREE.Group(); rack.position.set(-9.85, 0, -1.7); rack.rotation.y = Math.PI / 2; room.add(rack);
const teal = M(0x79a59f, 0.4, 0.6);
for (const x of [-0.5, 0.5]) for (const z of [-0.28, 0.28]) bx(x - 0.03, x + 0.03, 0, 2.0, z - 0.03, z + 0.03, teal, rack);
for (const y of [0.6, 1.2, 1.8]) { bx(-0.5, 0.5, y, y + 0.05, -0.3, 0.3, teal, rack); bx(-0.42, 0.42, y + 0.05, y + 0.3, -0.25, 0.25, M(0x8fb0b0, 0.3, 0.6), rack); }
bx(-9.4, -8.5, 0, 0.3, -3.3, -2.7, M(0xf0f0ee, 0, 0.8), room);                  // 白い台
bx(-10.4, -9.95, 0, 2.0, -3.3, -2.35, M(0xbfc3b8, 0.2, 0.7), room); bx(-9.97, -9.93, 0, 2.0, -2.85, -2.81, M(0x8a8e84), room); for (const z of [-2.9, -2.76]) bx(-9.98, -9.93, 0.95, 1.1, z - 0.01, z + 0.01, chrome, room);
bx(-5.95, -4.65, 0, 2.55, -3.4, -3.36, M(0xc8c4a8, 0, 0.9), room); bx(-5.8, -4.8, 0, 2.15, -3.36, -3.3, M(0xd2d3cd, 0.3, 0.6), room); bx(-5.31, -5.29, 0, 2.15, -3.3, -3.29, M(0x888c86), room); for (const x of [-5.36, -5.24]) bx(x - 0.01, x + 0.01, 1.0, 1.15, -3.31, -3.27, chrome, room);
{ const es = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.14), new THREE.MeshStandardMaterial({ map: canvasTex(256, 72, (g, w, h) => { g.fillStyle = '#1f7f3f'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('入口', w / 2, h / 2 + 2); }) })); es.position.set(-5.3, 2.35, -3.37 + 0.0); es.rotation.y = 0; room.add(es); }
{ const n2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.42), M(0xf2f2f0, 0, 0.8)); n2.position.set(-0.75, 1.55, -3.285); n2.rotation.y = Math.PI; n2.visible = false; room.add(n2); }
bx(0.2, 1.1, 0, 0.75, -3.4, -3.05, M(0xe9dfc0, 0.1, 0.7), room); for (let i = 0; i < 6; i++) bx(0.35, 0.95, 0.5 + i * 0.03, 0.52 + i * 0.03, -3.05, -3.04, M(0x9a9482), room); // 温風機
bx(0.0, 0.14, 1.9, 2.04, -3.4, -3.33, M(0xc0141a, 0, 0.5), room);               // 火災報知機
cyl(0.28, 0.25, M(0x1a1a1c), -8.0, 0.13, -3.0, 'y', room, 28); cyl(0.28, 0.25, M(0x1a1a1c), -8.0, 0.38, -3.0, 'y', room, 28); cyl(0.2, 0.32, M(0x1d6b40), -7.3, 0.16, -3.0, 'y', room, 20);
bx(-1.75, -1.35, 0, 0.25, -2.55, -2.15, M(0xd8a95a, 0, 0.9), room);               // 段ボール
bx(-1.25, -0.85, 0, 0.24, -2.45, -2.05, M(0x2b6dc4, 0, 0.7), room);               // 青いコンテナ
// 消火器・はしご台車（ステンレス）
for (const z of [3.2, 3.4]) cyl(0.07, 0.4, M(0xc0141a, 0.4, 0.4), -3.2, 0.2, z, 'y', room, 16);
for (const z of [3.05, 3.55]) bx(-3.65, -3.6, 0, 2.2, z - 0.02, z + 0.02, M(0xc8ccd0, 0.8, 0.3), room);

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
function showStat() { const v = TXT[S.mode]; $('stt').textContent = v[0]; $('std').textContent = v[1]; $('stw').textContent = '見どころ：' + v[2]; }
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
css.textContent = '.hud{position:fixed;color:#fff;font:13px/1.6 sans-serif;background:#000b;padding:8px 12px;border-radius:8px}.hud button{font-size:13px;padding:4px 8px;margin:2px;cursor:pointer}.hud button.on{background:#3a7;color:#fff}#hud2{left:12px;bottom:12px;max-width:640px}#stt{font-weight:bold;font-size:15px;color:#ffd866}#rd{color:#9fe;font-family:monospace}';
document.head.appendChild(css);
const h1 = document.createElement('div'); h1.className = 'hud'; h1.style.cssText = 'top:12px;left:12px';
h1.innerHTML = '<b>非常用発電機シミュレータ</b><br>ドラッグ:回転 / ホイール:拡大<br><label><input id=w type=checkbox checked> 機械室</label> <label><input id=a type=checkbox> 自動回転</label><br>' +
  '<button data-v=0>全体</button><button data-v=4>入口から</button><button data-v=5>蓄電池</button><button data-v=6>配電盤</button><button data-v=7>盤面アップ</button><button data-v=1>点検側</button><button data-v=2>操作盤側</button><button data-v=3>発電機端面</button><button data-v=8>内部を見る位置</button><button data-v=9>盤の内部</button>';
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
const views = [[[-5.6, 2.4, 5.2], [0, 1.4, 0]], [[-0.3, 1.9, 3.3], [-0.3, 1.5, 0]], [[-3.4, 1.8, -3.0], [-1.5, 1.1, -1.0]], [[-6.2, 1.9, 0.4], [-1, 1.5, 0]], [[-5.3, 1.65, -2.8], [0.5, 1.3, 1.0]], [[-3.4, 1.8, 0.4], [-1, 0.7, 2.7]], [[-6.3, 1.6, 1.0], [-9.8, 1.5, 1.0]], [[-8.2, 1.5, 1.25], [-9.8, 1.4, 1.25]], [[-0.4, 2.4, 6.4], [-0.6, 1.6, 0]], [[-7.4, 1.6, -0.2], [-9.9, 1.4, 0.1]]];
h1.querySelectorAll('button').forEach(b => b.onclick = () => { if (walk.on) setWalk(false); view(...views[b.dataset.v]); if (b.dataset.v === '9') { doors[3].target = OPEN; doors[4].target = OPEN; } });
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
function modal(html) { mod.innerHTML = '<div class=box>' + html + '<div style="text-align:right"><button id=mClose>閉じる</button></div></div>'; mod.style.display = 'flex'; $('mClose').onclick = () => { mod.style.display = 'none'; }; }
let started = false; h1.style.display = h2.style.display = 'none'; controls.enabled = false; controls.autoRotate = true; controls.autoRotateSpeed = 0.7;
function enterTitle() { if (walk.on) setWalk(false); if (typeof dwBtn !== 'undefined') { dwBtn.style.display = dw.style.display = 'none'; } ov.style.display = 'flex'; menuBtn.style.display = 'none'; h1.style.display = h2.style.display = 'none'; controls.enabled = false; controls.autoRotate = true; if (!started) view(...views[0]); $('tStart').textContent = started ? '▶ つづける' : '▶ スタート'; }
function enterGame() { started = true; if (typeof dwBtn !== 'undefined') dwBtn.style.display = 'block'; ov.style.display = 'none'; menuBtn.style.display = 'block'; h1.style.display = h2.style.display = 'block'; controls.enabled = true; controls.autoRotate = $('a').checked; }
$('tStart').onclick = () => { audioInit(); enterGame(); };
menuBtn.onclick = enterTitle;
$('tHow').onclick = () => modal('<h2>操作説明</h2>・<b>ドラッグ</b>：画面を回す　<b>ホイール／ピンチ</b>：拡大縮小<br>・左上のボタン：見る場所を切り替えます（点検側、操作盤側、配電盤、内部を見る位置など）<br>・左下の「運転」：<b>始動（試験運転）</b>、<b>停電→自動始動</b>、<b>復電・停止</b><br>・「内部」：<b>透かして見る</b>／<b>断面（半分切る）</b>で、ピストンや回転子の動きが見えます<br>・画面下の説明に、いま何が起きているかが出ます<br>・音が出ます。気になるときは、オプションで切れます<br><span style="color:#9bd">※ 教育用の想像モデルです。内部構造や数値は実機と異なる場合があります。</span>');
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
const walk = { on: false, yaw: Math.PI + 0.5, pitch: -0.05, pos: new THREE.Vector3(-5.3, 1.65, -2.5), keys: {}, pad: { f: 0, s: 0 }, saved: null };
const BLOCKS = [[-3.2, 2.75, -0.85, 0.85], [-2.9, -1.55, -1.5, -0.78], [-1.55, -0.5, -1.9, -1.15], [-0.5, 1.0, 0.5, 1.5], [-0.5, 0.15, 1.2, 1.95], [-0.5, 1.0, -1.5, -0.5], [1.3, 3.1, -0.95, 0.95],
  [1.7, 3.3, 2.0, 3.6], [-2.0, 0.0, 2.1, 3.3], [0.15, 1.15, -3.4, -3.0], [-4.4, -3.4, 1.6, 2.2], [-3.8, -3.5, 2.2, 2.8], [-10.4, -9.5, -1.2, 3.7], [-10.4, -9.3, -2.3, -1.1], [-10.4, -9.9, -3.4, -2.3], [-9.4, -8.5, -3.4, -2.7], [-8.4, -6.9, -3.4, -2.6]];
const ROOM = [-10.4, 3.5, -3.3, 3.7], PR = 0.28;
const hitAt = (x, z) => x < ROOM[0] || x > ROOM[1] || z < ROOM[2] || z > ROOM[3] || BLOCKS.some(b => x > b[0] - PR && x < b[1] + PR && z > b[2] - PR && z < b[3] + PR);
function walkStep(dt) {
  const k = walk.keys, run = k.ShiftLeft || k.ShiftRight ? 2.2 : 1;
  const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + walk.pad.f, sd = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + walk.pad.s;
  if (k.ArrowLeft) walk.yaw += 1.6 * dt; if (k.ArrowRight) walk.yaw -= 1.6 * dt;
  const sp = 1.5 * run * dt, fx = -Math.sin(walk.yaw), fz = -Math.cos(walk.yaw), rx = Math.cos(walk.yaw), rz = -Math.sin(walk.yaw);
  const dx = (fx * f + rx * sd) * sp, dz = (fz * f + rz * sd) * sp;
  if (!hitAt(walk.pos.x + dx, walk.pos.z)) walk.pos.x += dx; if (!hitAt(walk.pos.x, walk.pos.z + dz)) walk.pos.z += dz;
  const bob = (f || sd) ? Math.sin(vt * 9 * run) * 0.012 : 0;
  camera.position.set(walk.pos.x, 1.65 + bob, walk.pos.z); camera.rotation.set(walk.pitch, walk.yaw, 0, 'YXZ');
}
function setWalk(on) {
  walk.on = on; $('bw').textContent = on ? '🎥 全体の視点に戻る' : '🚶 歩く視点'; pad.style.display = on ? 'block' : 'none'; hint.style.display = on ? 'block' : 'none';
  if (on) { walk.saved = [camera.position.clone(), controls.target.clone()]; controls.enabled = false; controls.autoRotate = false; camera.fov = 68; camera.updateProjectionMatrix(); renderer.domElement.style.touchAction = 'none'; setTimeout(() => { hint.style.display = 'none'; }, 6000); }
  else { controls.enabled = true; camera.fov = 45; camera.updateProjectionMatrix(); camera.rotation.order = 'XYZ'; const sv = walk.saved || [new THREE.Vector3(-5.6, 2.4, 5.2), new THREE.Vector3(0, 1.4, 0)]; camera.position.copy(sv[0]); controls.target.copy(sv[1]); camera.up.set(0, 1, 0); camera.lookAt(sv[1]); controls.update(); }
}
const pad = document.createElement('div'); pad.className = 'hud'; pad.style.cssText = 'right:14px;bottom:14px;display:none;user-select:none;touch-action:none;padding:6px';
pad.innerHTML = '<div style="display:grid;grid-template-columns:repeat(3,52px);grid-auto-rows:52px;gap:4px"><span></span><button data-p="f1">▲</button><span></span><button data-p="s-1">◀</button><button data-p="f-1">▼</button><button data-p="s1">▶</button></div><div style="font-size:11px;text-align:center;color:#bcd">移動パッド</div>';
document.body.appendChild(pad);
pad.querySelectorAll('button').forEach(b => { const [t, v] = [b.dataset.p[0], +b.dataset.p.slice(1)]; const set = on => { walk.pad[t] = on ? v : 0; }; b.style.fontSize = '20px'; b.onpointerdown = e => { e.preventDefault(); set(true); b.setPointerCapture(e.pointerId); }; b.onpointerup = b.onpointercancel = () => set(false); });
const hint = document.createElement('div'); hint.className = 'hud'; hint.style.cssText = 'left:50%;top:70px;transform:translateX(-50%);display:none;text-align:center;pointer-events:none';
hint.innerHTML = '<b>歩く視点</b><br>W A S D／矢印キー：移動　Shift：小走り　<br>ドラッグ：見回す　画面右下のパッド：移動（スマホ）';
document.body.appendChild(hint);
h1.insertAdjacentHTML('beforeend', '<br><button id=bw style="background:#2a6;color:#fff;font-weight:bold">🚶 歩く視点</button>');
$('bw').onclick = () => setWalk(!walk.on);
addEventListener('keydown', e => { if (walk.on) { walk.keys[e.code] = true; if (/^(Arrow|Space)/.test(e.code)) e.preventDefault(); } if (e.key === 'Escape' && walk.on && mod.style.display !== 'flex') { /* メニューは既存処理 */ } });
addEventListener('keyup', e => { walk.keys[e.code] = false; });
{ let drag = false, lx = 0, ly = 0; const el = renderer.domElement;
  el.addEventListener('pointerdown', e => { if (walk.on) { drag = true; lx = e.clientX; ly = e.clientY; el.setPointerCapture(e.pointerId); } });
  el.addEventListener('pointermove', e => { if (walk.on && drag) { walk.yaw -= (e.clientX - lx) * 0.005; walk.pitch = Math.max(-1.2, Math.min(1.2, walk.pitch - (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY; } });
  el.addEventListener('pointerup', () => { drag = false; }); el.addEventListener('pointercancel', () => { drag = false; }); }

// ================= 盤の扉：クリック／ボタンで開閉 =================
const OPEN = -1.85;
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
{ let dx = 0, dy = 0, t0 = 0; const el = renderer.domElement;
  el.addEventListener('pointerdown', e => { dx = e.clientX; dy = e.clientY; t0 = performance.now(); });
  el.addEventListener('pointerup', e => {
    if (Math.hypot(e.clientX - dx, e.clientY - dy) > 6 || performance.now() - t0 > 600 || ov.style.display !== 'none') return;
    const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); raycaster.setFromCamera(ndc, camera);
    for (const h of raycaster.intersectObjects(doors.map(d => d.g), true)) { let o = h.object; while (o && o.userData.door === undefined) o = o.parent; if (o) { const d = doors[o.userData.door]; d.target = d.target ? 0 : OPEN; break; } }
  }); }
h1.insertAdjacentHTML('beforeend', ' <button id=bd>🚪 盤の扉を開閉</button>');
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
    ['蓄電池（始動・制御用）', [[-3.4, 1.8, 0.4], [-1.0, 0.7, 2.7]], '役割：セルモータの始動と、制御電源に使います。鉛蓄電池です。足元の黄色いマットは、電解液がこぼれた時の耐酸マットです。', '見る点：電圧、液量（液式の場合は比重）、端子の腐食と緩み、外観の膨れ、充電器の動作。']]],
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
let fly = null;
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

// ================= 毎フレーム =================
const clock = new THREE.Clock(); let vt = 0, texAcc = 0;
const lampBase = lamp, tmpC = new THREE.Color(), cA = new THREE.Color(0xff8a2a), cB = new THREE.Color(0x8a8f94);
let hemiT = 0.9, lampT = 1;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05); vt += dt;
  stepState(dt); derive();
  const k = Math.min(1, S.rpm / 1200), w = S.rpm / 60 * Math.PI * 2 * S.scale; S.phi += w * dt;
  // 回転部分
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
  texAcc += dt; if (texAcc > 0.12) { texAcc = 0; dynTex.forEach(t => t.userData.redraw()); }
  $('rd').textContent = `回転 ${Math.round(S.rpm)} min⁻¹ ｜ 電圧 ${Math.round(210 * S.volt)} V ｜ 周波数 ${S.hz.toFixed(1)} Hz ｜ ${S.mains ? '商用' : S.brk ? '発電' : '停電'}`;
  doors.forEach(d => { d.cur += (d.target - d.cur) * Math.min(1, dt * 4); d.g.rotation.y = d.cur; if (d.light) d.light.intensity = 1.8 * Math.min(1, -d.cur / 1.2); });
  audioUpdate(); if (fly) { fly.t = Math.min(1, fly.t + dt / 0.9); const k = ease(fly.t); camera.position.lerpVectors(fly.p0, fly.p1, k); controls.target.lerpVectors(fly.t0, fly.t1, k); if (fly.t >= 1) fly = null; }
  if (walk.on) walkStep(dt); else controls.update(); renderer.render(scene, camera);
});
