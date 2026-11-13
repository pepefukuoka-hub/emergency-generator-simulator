// worker.js — 作業員（白い保護帽とグレーの作業服）。Blender で作ったモデル（GLB）を読み込み、歩く動きを骨の回転で付ける。
// 形は blender/worker/build.py で生成。体・骨・ウェイト・目は MakeHuman / MPFB の CC0 データ、服・帽子・靴・髪はスクリプトで作成。
// 架空の人物。実在の人の写真・顔・氏名・所属・ロゴは使わない。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import GLB from './worker-natural/worker.glb';
import BODY_URI from './worker-natural/body.jpg';
import OUTFIT_URI from './worker-natural/outfit.jpg';

function tex(uri) { const t = new THREE.TextureLoader().load(uri); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
// 布の織り目（綾織りふうの細かい凹凸）。小さな Canvas を敷き詰める
function weave() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, 64, 64);
  for (let i = -64; i < 128; i += 4) { g.strokeStyle = 'rgb(108,116,255)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.strokeStyle = 'rgb(148,140,255)'; g.beginPath(); g.moveTo(i + 2, 0); g.lineTo(i + 66, 64); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(90, 90); return t;
}


// A：モデル（glb・body・outfit の絵）。省略すると作業員B。私服の「38歳」は worker-casual.js から呼ぶ
export function createWorker(A = { glb: GLB, body: BODY_URI, outfit: OUTFIT_URI, weave: true }) {
  const root = new THREE.Group(), B = {}, rest = {};
  let floorY = 0;
  let ready = false, phase = 0, amp = 0, run = 0, last = performance.now();
  new GLTFLoader().parse(A.glb.buffer.slice(A.glb.byteOffset, A.glb.byteOffset + A.glb.byteLength), '', gltf => {
    const model = gltf.scene; model.rotation.y = Math.PI; root.add(model);          // モデルの正面（+Z）を、歩く向き（−Z）に合わせる
    const body = new THREE.MeshStandardMaterial({ map: tex(A.body), roughness: 0.58 });
    const outfit = new THREE.MeshStandardMaterial({ map: tex(A.outfit), roughness: 0.92, normalMap: A.weave ? weave() : null, normalScale: new THREE.Vector2(0.025, 0.025), side: THREE.DoubleSide, shadowSide: THREE.BackSide });
    model.traverse(o => {
      if (o.isMesh) { o.material = /body|skin/.test(o.name + o.material.name) ? body : outfit; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
      if (o.isBone) B[o.name] = o;
    });
    model.updateMatrixWorld(true);
    for (const [n, b] of Object.entries(B)) rest[n] = b.quaternion.clone();
    floorY = model.worldToLocal(B.foot_l.getWorldPosition(new THREE.Vector3())).y;
    ready = true; pose(0, 0, 0);
  });
  const X = new THREE.Vector3(1, 0, 0), q = new THREE.Quaternion();
  // Aim a bone in model coordinates, accounting for its parent's current rotation.
  // This avoids applying the same shoulder rotation again at the wrist.
  const from = new THREE.Vector3(), to = new THREE.Vector3(), target = new THREE.Vector3();
  const worldQ = new THREE.Quaternion(), parentQ = new THREE.Quaternion(), delta = new THREE.Quaternion();
  function aim(name, child, direction) {
    const bone = B[name], end = B[child]; if (!bone || !end) return;
    const model = root.children[0]; model.updateMatrixWorld(true);
    bone.getWorldPosition(from); end.getWorldPosition(to);
    target.copy(direction).normalize().applyQuaternion(model.getWorldQuaternion(worldQ));
    delta.setFromUnitVectors(to.sub(from).normalize(), target);
    bone.getWorldQuaternion(worldQ); bone.parent.getWorldQuaternion(parentQ);
    bone.quaternion.copy(parentQ.invert().multiply(delta.multiply(worldQ)));
    model.updateMatrixWorld(true);
  }
  const pos = name => root.children[0].worldToLocal(B[name].getWorldPosition(new THREE.Vector3()));
  const v = (x,y,z) => new THREE.Vector3(x,y,z);
  // 走る（r：0＝歩く〜1＝走る）：歩幅を広げ、両足が浮く時間を作り、ひじを曲げて大きく振り、体を前へ傾ける
  function pose(p, a, r = 0) {
    const breath = Math.sin(performance.now() / 1000 * 1.35) * 0.006 * (1-a);
    for (const [name,bone] of Object.entries(B)) bone.quaternion.copy(rest[name]);
    const model = root.children[0];
    model.position.y = 0;
    model.updateMatrixWorld(true);
    for (const [sd,k] of [['l',1],['r',-1]]) {
      const cycle = ((p / (Math.PI*2) + (k === 1 ? 0 : 0.5)) % 1 + 1) % 1;
      // Stance: foot travels backwards relative to pelvis; swing: toe clears floor.
      const sr = 0.62 - 0.27 * r;                       // 接地の割合（走ると短く、両足が浮く時間ができる）
      const stance = cycle < sr;
      const u = stance ? cycle/sr : (cycle-sr)/(1-sr);
      const stride = (0.54 + 0.5 * r) * a;
      const z = stance ? stride*(0.5-u) : stride*(-0.5 + u*u*(3-2*u));
      const lift = stance ? 0 : Math.sin(Math.PI*u)*(0.085 + 0.17 * r)*a;
      const hip = pos('thigh_'+sd), knee = pos('calf_'+sd), ankle = pos('foot_'+sd);
      const l1 = hip.distanceTo(knee), l2 = knee.distanceTo(ankle);
      const goal = v(ankle.x, ankle.y + lift + 0.025*a, z + ankle.z);
      const d = goal.clone().sub(hip), length = Math.min(l1+l2-0.001,d.length());
      d.normalize();
      const along = (l1*l1-l2*l2+length*length)/(2*length);
      const bend = Math.sqrt(Math.max(0,l1*l1-along*along));
      const forward = v(0,0,1).addScaledVector(d,-d.z).normalize();
      const kneeGoal = hip.clone().addScaledVector(d,along).addScaledVector(forward,bend);
      aim('thigh_'+sd,'calf_'+sd,kneeGoal.sub(hip));
      aim('calf_'+sd,'foot_'+sd,goal.sub(pos('calf_'+sd)));
      aim('foot_'+sd,'ball_'+sd,v(0,-0.12,1));
      const swing = -z * (0.85 + 0.3 * r); // 同側の足の前後位置と必ず逆に振る
      aim('upperarm_'+sd,'lowerarm_'+sd,v(k*(0.08+0.06*r),-1,swing));
      aim('lowerarm_'+sd,'hand_'+sd,v(k*0.025,-1+1.05*r,0.09+swing+0.95*r));   // 走るときは、ひじを約90°曲げる
      // Neutral wrists: retain the hand's rest rotation relative to the forearm.
      // Gentle local finger flexion, no global 132-degree wrist twist.
      for (const f of ['index','middle','ring','pinky']) {
        for (const n of ['01','02','03']) {
          const bone=B[f+'_'+n+'_'+sd];
          if(bone) bone.quaternion.multiply(q.setFromAxisAngle(X,n==='01'?0.12:0.20));
        }
      }
    }
    model.position.y = floorY - Math.min(pos('foot_l').y, pos('foot_r').y) + (r > 0.3 ? Math.max(0, Math.sin(p * 2)) * 0.03 * r * a : 0);
    if (B.spine_01 && r) B.spine_01.quaternion.multiply(q.setFromAxisAngle(X, 0.16 * r * a));   // 走るときは前へ傾ける
    // 小さな呼吸。足の接地と首・手首の自然な向きを保つ。
    if (B.spine_03) B.spine_03.quaternion.multiply(q.setFromAxisAngle(X, breath));
    if (B.head) B.head.quaternion.multiply(q.setFromAxisAngle(X, -breath * 0.5));
  }
  return { root, get ready() { return ready; }, preview(p, a=1, r=0) { if (ready) pose(p,a,r); }, update(distance) {
    if (!ready) return;
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    const moving = Math.abs(distance) > 0.00001, speed = Math.abs(distance) / Math.max(dt, 0.001);
    run += ((moving && speed > 2.4 ? 1 : 0) - run) * Math.min(1, dt * 5);              // 速いときだけ、走る形へ
    phase += distance * (Math.PI * 2 / ((0.54 + 0.5 * run) / (0.62 - 0.27 * run)));                     // 接地中の足の速度を移動距離に合わせる
    amp += ((moving ? 1 : 0) - amp) * Math.min(1, dt * 8);
    if (!moving && amp < 0.02) phase = 0;
    pose(phase, amp, run);
  }, get running() { return run; } };
}
