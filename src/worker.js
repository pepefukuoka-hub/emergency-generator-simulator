// worker.js — 作業員（白い保護帽とグレーの作業服）。Blender で作ったモデル（GLB）を読み込み、歩く動きを骨の回転で付ける。
// 形は blender/worker/build.py で生成。体・骨・ウェイト・目は MakeHuman / MPFB の CC0 データ、服・帽子・靴・髪はスクリプトで作成。
// 架空の人物。実在の人の写真・顔・氏名・所属・ロゴは使わない。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import GLB from './worker-natural/worker.glb';
import BODY_URI from './worker-natural/body.jpg';
import OUTFIT_URI from './worker-natural/outfit.jpg';

function tex(uri) { const t = new THREE.TextureLoader().load(uri); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
// 衣服アトラスの灰色領域だけに織り目と粗さを付け、白い保護帽・黒い靴と区別。
function fabricMaps(material, texture) {
  const apply = () => {
    const image = texture.image;
    const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
    const ctx = c.getContext('2d'); ctx.drawImage(image, 0, 0);
    const base = ctx.getImageData(0, 0, c.width, c.height);
    const normal = ctx.createImageData(c.width, c.height), rough = ctx.createImageData(c.width, c.height);
    const sheen = ctx.createImageData(c.width, c.height);
    const smooth = (lo,hi,x) => {const t=Math.max(0,Math.min(1,(x-lo)/(hi-lo))); return t*t*(3-2*t);};
    for (let y=0;y<c.height;y++) for(let x=0;x<c.width;x++) {
      const i=(y*c.width+x)*4, l=(base.data[i]+base.data[i+1]+base.data[i+2])/765;
      const mask=smooth(.17,.32,l)*(1-smooth(.67,.82,l));
      const wave=Math.sin((x+y)*Math.PI/2), cross=Math.sin((x-y)*Math.PI/2);
      normal.data.set([128+wave*9*mask,128+cross*7*mask,255,255],i);
      const grain=((x*73+y*151)%101)/100;
      const r= Math.round(255*(.36*(1-mask)+mask*(.78+.10*grain)));
      rough.data.set([r,r,r,255],i);
      const sh=Math.round(mask*100);sheen.data.set([sh,sh,sh,255],i);
    }
    const make = pixels => {const canvas=document.createElement('canvas');canvas.width=c.width;canvas.height=c.height;canvas.getContext('2d').putImageData(pixels,0,0);const t=new THREE.CanvasTexture(canvas);t.flipY=false;t.anisotropy=8;return t;};
    material.normalMap=make(normal);material.roughnessMap=make(rough);material.sheenColorMap=make(sheen);material.needsUpdate=true;
  };
  if(texture.image?.complete) apply();
  else { let attempts=0; const wait=()=>{if(texture.image?.complete)apply();else if(++attempts<200)setTimeout(wait,50);};wait(); }
}


export function createWorker() {
  const root = new THREE.Group(), B = {}, rest = {};
  let floorY = 0;
  let ready = false, phase = 0, amp = 0, last = performance.now();
  new GLTFLoader().parse(GLB.buffer.slice(GLB.byteOffset, GLB.byteOffset + GLB.byteLength), '', gltf => {
    const model = gltf.scene; model.rotation.y = Math.PI; root.add(model);          // モデルの正面（+Z）を、歩く向き（−Z）に合わせる
    const body = new THREE.MeshStandardMaterial({ map: tex(BODY_URI), roughness: 0.58 });
    const outfitMap = tex(OUTFIT_URI);
    const outfit = new THREE.MeshPhysicalMaterial({ map: outfitMap, roughness: 1, sheen: 0.3, sheenColor: 0xb9bfc5, sheenRoughness: 0.8, normalScale: new THREE.Vector2(0.3, 0.3), side: THREE.DoubleSide, shadowSide: THREE.BackSide });
    fabricMaps(outfit, outfitMap);
    model.traverse(o => {
      if (o.isMesh) { o.material = /body|skin/.test(o.name + o.material.name) ? body : outfit; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
      if (o.isBone) B[o.name] = o;
    });
    model.updateMatrixWorld(true);
    for (const [n, b] of Object.entries(B)) rest[n] = b.quaternion.clone();
    floorY = model.worldToLocal(B.foot_l.getWorldPosition(new THREE.Vector3())).y;
    ready = true; pose(0, 0);
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
  function pose(p, a) {
    const breath = Math.sin(performance.now() / 1000 * 1.35) * 0.006 * (1-a);
    for (const [name,bone] of Object.entries(B)) bone.quaternion.copy(rest[name]);
    const model = root.children[0];
    model.position.y = 0;
    model.updateMatrixWorld(true);
    for (const [sd,k] of [['l',1],['r',-1]]) {
      const cycle = ((p / (Math.PI*2) + (k === 1 ? 0 : 0.5)) % 1 + 1) % 1;
      // Stance: foot travels backwards relative to pelvis; swing: toe clears floor.
      const stance = cycle < 0.62;
      const u = stance ? cycle/0.62 : (cycle-0.62)/0.38;
      const stride = 0.54 * a;
      const z = stance ? stride*(0.5-u) : stride*(-0.5 + u*u*(3-2*u));
      const smooth = t => { t=Math.max(0,Math.min(1,t));return t*t*(3-2*t); };
      const push = stance ? smooth((u-.68)/.32) : 1-smooth(u/.45);
      const heelLift = push * 0.055 * a;
      const lift = stance ? heelLift : (Math.sin(Math.PI*u)*0.16*a + heelLift);
      const pitch = stance ? push * 0.50*a : (push * 0.50 - smooth((u-.55)/.45)*0.12)*a;
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
      aim('foot_'+sd,'ball_'+sd,v(0,-0.12-Math.sin(pitch),Math.cos(pitch)));
      const swing = -z * 0.85; // 同側の足の前後位置と必ず逆に振る
      aim('upperarm_'+sd,'lowerarm_'+sd,v(k*0.28,-1,swing));
      aim('lowerarm_'+sd,'hand_'+sd,v(k*0.10,-1,0.09+swing));
      // Neutral wrists: retain the hand's rest rotation relative to the forearm.
      // Gentle local finger flexion, no global 132-degree wrist twist.
      for (const f of ['index','middle','ring','pinky']) {
        for (const n of ['01','02','03']) {
          const bone=B[f+'_'+n+'_'+sd];
          if(bone) bone.quaternion.multiply(q.setFromAxisAngle(X,n==='01'?0.12:0.20));
        }
      }
    }
    // つま先への荷重移行では足首の高さを維持する。
    const contact = ['l','r'].map(sd => Math.min(pos('foot_'+sd).y, pos('ball_'+sd).y + 0.012));
    model.position.y = floorY - Math.min(...contact);
    // 小さな呼吸。足の接地と首・手首の自然な向きを保つ。
    if (B.spine_03) B.spine_03.quaternion.multiply(q.setFromAxisAngle(X, breath));
    if (B.head) B.head.quaternion.multiply(q.setFromAxisAngle(X, -breath * 0.5));
  }
  return { root, get ready() { return ready; }, preview(p, a=1) { if (ready) pose(p,a); }, update(distance) {
    if (!ready) return;
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    const moving = Math.abs(distance) > 0.00001; phase += distance * (Math.PI * 2 / (0.54 / 0.62));                     // 接地中の足の速度を移動距離に合わせる
    amp += ((moving ? 1 : 0) - amp) * Math.min(1, dt * 8);
    if (!moving && amp < 0.02) phase = 0;
    pose(phase, amp);
  } };
}
