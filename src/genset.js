// genset.js — Blender で作った発電機モデル（GLB）を読み込み、材質を割り当てる。
// 形は blender/genset/ のスクリプトで生成。AO は、大きな部品はライトマップ（UV1）、小さな部品は頂点カラーに焼いてある。
// 教育用の想像モデル。メーカー名・形式は入れていない。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import GLB from './genset/genset.glb';
import AO_URI from './genset/ao.jpg';
import CHECKER_URI from './genset/checker_n.png';
import CAST_URI from './genset/cast_n.png';
import PERF_URI from './genset/perf.png';
import MESH_URI from './genset/mesh.png';
import DECAL_URI from './genset/decals.webp';

export const GENSET = { fan: [1.60, 2.12, 0], axisY: 1.25, pitch: 0.2726, cyl0: -0.54, deskCenter: [-1.775, 0, -1.2] };

const TL = new THREE.TextureLoader();
function tex(uri, { srgb = false, repeat = null, channel = 0 } = {}) {
  const t = TL.load(uri); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.channel = channel; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
// 色は写真から拾った値（sRGB）。c=色, r=粗さ, m=金属, n=細かい凹凸（cast/checker）, ns=凹凸の強さ
const DEF = {
  eng: { c: 0x9eb6b4, r: 0.42, n: 'cast', ns: 0.3 }, alt: { c: 0xb2bab2, r: 0.46, n: 'cast', ns: 0.25 }, alt2: { c: 0xa3afac, r: 0.48, n: 'cast', ns: 0.25 },
  light: { c: 0xc3c8c6, r: 0.5, n: 'cast', ns: 0.2 }, desk: { c: 0xa5b0a6, r: 0.45, n: 'cast', ns: 0.2 }, deskd: { c: 0x6d756f, r: 0.6 }, cage: { c: 0x9fb1b2, r: 0.5 },
  checker: { c: 0xb4bdb8, r: 0.5, m: 0.1, n: 'checker', ns: 1.0 }, jbox: { c: 0xbfbdb5, r: 0.5 }, filt: { c: 0xb9c4c0, r: 0.38 },
  alu: { c: 0xb4aea6, r: 0.5, m: 0.8, n: 'cast', ns: 0.9, e: 1.4 }, steel: { c: 0xc8ccd0, r: 0.35, m: 1, e: 1.5 }, steeld: { c: 0x4a4d50, r: 0.6, m: 0.6 },
  clad: { c: 0xe2e4e5, r: 0.42, m: 0.9, e: 1.7 }, foil: { c: 0xd4d7d7, r: 0.5, m: 0.9, n: 'cast', ns: 1.4, e: 1.6 }, blanket: { c: 0xa9b0aa, r: 0.6, m: 0.35, n: 'cast', ns: 1.2, e: 1.2 }, blanket2: { c: 0x45484a, r: 0.9 },
  flex: { c: 0xb9bcbf, r: 0.45, m: 1, e: 1.5 }, rubber: { c: 0x151515, r: 0.85 }, black: { c: 0x0c0d0e, r: 0.6 }, cable: { c: 0x2b2a2d, r: 0.7 }, tape: { c: 0xe9e6dc, r: 0.7 },
  conduit: { c: 0x9fa3a6, r: 0.5, m: 0.7 }, red: { c: 0xc42a22, r: 0.5 }, yellow: { c: 0xd9a514, r: 0.5 }, blue: { c: 0x3b6fb5, r: 0.6 }, seam: { c: 0x3a2f28, r: 0.9 },
};

export function loadGenset(onReady) {
  const ao = tex(AO_URI, { channel: 1 });
  const N = { cast: tex(CAST_URI, { repeat: [1 / 0.25, 1 / 0.25] }), checker: tex(CHECKER_URI, { repeat: [1 / 0.06, 1 / 0.06] }) };
  const cache = {};
  function material(name, cls, lm) {
    const key = name + '|' + cls + (!lm ? '|nolm' : ''); if (cache[key]) return cache[key];
    let m;
    if (cls === 'decal') m = new THREE.MeshStandardMaterial({ map: tex(DECAL_URI, { srgb: true }), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    else if (cls === 'panel') {
      const perf = name === 'perf';
      m = new THREE.MeshStandardMaterial({ color: perf ? 0xa3b3b3 : 0x8d918c, map: tex(perf ? PERF_URI : MESH_URI, { repeat: perf ? [1 / 0.008, 1 / 0.013856] : [1 / 0.024, 1 / 0.012] }), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.3 });
    } else {
      const d = DEF[name] || { c: 0xff00ff };
      m = new THREE.MeshStandardMaterial({ color: d.c, roughness: d.r ?? 0.5, metalness: d.m ?? 0 });
      if (cls === 'big') { if (lm) { m.map = ao; m.aoMap = ao; m.aoMapIntensity = 1.0; } if (d.n) { m.normalMap = N[d.n]; m.normalScale.set(d.ns, d.ns); } }
      if (cls === 'small' && lm) m.vertexColors = true;
    }
    m.envMapIntensity = (DEF[name] && DEF[name].e) || 0.5; m.name = key; m.userData.cls = cls; m.userData.base = name;
    return (cache[key] = m);
  }
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const buf = GLB.buffer.slice(GLB.byteOffset, GLB.byteOffset + GLB.byteLength);
  loader.parse(buf, '', gltf => {
    const out = { rig: [], static: [], fan: [], materials: cache };
    gltf.scene.updateMatrixWorld(true);
    const meshes = []; gltf.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
    for (const o of meshes) {
      const [grp, name, cls] = o.name.split('|');
      o.material = material(name, cls, cls === 'big' ? !!o.geometry.attributes.uv1 : !!o.geometry.attributes.color);
      o.castShadow = cls === 'big' || cls === 'small'; o.receiveShadow = cls !== 'decal';
      if (cls === 'decal') o.renderOrder = 2; if (cls === 'panel') o.renderOrder = 3;
      o.removeFromParent(); (out[grp] || out.static).push(o);
    }
    onReady(out);
  }, e => console.error('genset', e));
}
