// worker.js — 作業員（グレーの帽子と作業服）。Blender で作ったモデル（GLB）を読み込み、歩く動きを骨の回転で付ける。
// 形は blender/worker/build.py で生成。体・骨・ウェイト・目は MakeHuman / MPFB の CC0 データ、服・帽子・靴・髪はスクリプトで作成。
// 架空の人物。実在の人の写真・顔・氏名・所属・ロゴは使わない。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import GLB from './worker/worker.glb';
import BODY_URI from './worker/body.jpg';
import OUTFIT_URI from './worker/outfit.jpg';

function tex(uri) { const t = new THREE.TextureLoader().load(uri); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
// 布の織り目（綾織りふうの細かい凹凸）。小さな Canvas を敷き詰める
function weave() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, 64, 64);
  for (let i = -64; i < 128; i += 4) { g.strokeStyle = 'rgb(108,116,255)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.strokeStyle = 'rgb(148,140,255)'; g.beginPath(); g.moveTo(i + 2, 0); g.lineTo(i + 66, 64); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(90, 90); return t;
}

let TW = 1.1;
export function createWorker() {
  const root = new THREE.Group(), B = {}, rest = {}, wr = {};
  let ready = false, phase = 0, amp = 0, last = performance.now();
  new GLTFLoader().parse(GLB.buffer.slice(GLB.byteOffset, GLB.byteOffset + GLB.byteLength), '', gltf => {
    const model = gltf.scene; model.rotation.y = Math.PI; root.add(model);          // モデルの正面（+Z）を、歩く向き（−Z）に合わせる
    const body = new THREE.MeshStandardMaterial({ map: tex(BODY_URI), roughness: 0.58 });
    const outfit = new THREE.MeshStandardMaterial({ map: tex(OUTFIT_URI), roughness: 0.92, normalMap: weave(), normalScale: new THREE.Vector2(0.35, 0.35), side: THREE.DoubleSide });
    model.traverse(o => {
      if (o.isMesh) { o.material = /body|skin/.test(o.name + o.material.name) ? body : outfit; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
      if (o.isBone) B[o.name] = o;
    });
    model.updateMatrixWorld(true);
    const inv = model.getWorldQuaternion(new THREE.Quaternion()).invert();
    for (const [n, b] of Object.entries(B)) { rest[n] = b.quaternion.clone(); wr[n] = inv.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion())); }
    ready = true; pose(0, 0);
  });
  const X = new THREE.Vector3(1, 0, 0), Zf = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), r = new THREE.Quaternion(), c = new THREE.Quaternion();
  // 骨を、モデルの向き（X＝左右、Y＝上、Z＝前）で表した回転で動かす。rots は [軸, 角度] の並び
  function turn(name, ...rots) {
    const b = B[name]; if (!b) return;
    r.identity(); for (const [axis, a] of rots) r.multiply(q.setFromAxisAngle(axis, a));
    b.quaternion.copy(rest[name]).multiply(c.copy(wr[name]).invert()).multiply(r).multiply(wr[name]);
  }
  function pose(p, a) {
    const s = Math.sin(p), co = Math.cos(p), t = performance.now() / 1000, br = Math.sin(t * 1.3) * 0.012;
    // 腕：組み立てたときは斜めに開いているので、下ろす。歩くときは、足と逆に振る
    for (const [sd, k] of [['l', 1], ['r', -1]]) {
      const sw = -k * s * 0.5 * a;
      turn('upperarm_' + sd, [X, sw], [Zf, -k * (0.72 + br)]);
      turn('lowerarm_' + sd, [X, -0.22 - Math.max(0, sw) * 0.5 - 0.1 * a], [Zf, -k * 0.1], [Y, k * 0.2]);
      turn('hand_' + sd, [Zf, -k * 0.06], [Y, k * TW]);
      const lg = k * s;                                                             // 左足が前のとき＋
      turn('thigh_' + sd, [X, -lg * 0.48 * a]);
      turn('calf_' + sd, [X, (Math.max(0, -k * co) * 0.85 + 0.06) * a]);
      turn('foot_' + sd, [X, (lg * 0.18 - Math.max(0, -k * co) * 0.25) * a]);
      for (const f of ['index', 'middle', 'ring', 'pinky']) for (const n of ['01', '02', '03']) turn(f + '_' + n + '_' + sd, [Zf, -k * 0.09]);
    }
    turn('spine_01', [Y, s * 0.05 * a]); turn('spine_03', [Y, -s * 0.09 * a], [X, br * 0.6 + 0.03 * a]); turn('head', [Y, s * 0.04 * a], [X, -br * 0.4]);
    root.children[0].position.y = -Math.abs(Math.sin(p)) * 0.022 * a - 0.004 * a;    // 歩くときの上下
  }
  return { root, set tw(v) { TW = v; }, update(distance) {
    if (!ready) return;
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    const moving = distance > 0.00001; phase += distance * 4.4;                     // 1歩 約0.7m
    amp += ((moving ? 1 : 0) - amp) * Math.min(1, dt * 8);
    if (!moving && amp < 0.02) phase = 0;
    pose(phase, amp);
  } };
}
