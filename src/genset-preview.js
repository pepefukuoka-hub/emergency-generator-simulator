// 発電機モデルだけを、シミュレータと同じ照明で確認するためのページ（開発用。公開物には入れない）
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadGenset, GENSET } from './genset.js';
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x30343a);
const camera = new THREE.PerspectiveCamera(54.7, innerWidth / innerHeight, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
window.viewTo = (p, t, fov) => { camera.position.set(...p); controls.target.set(...t); if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); } controls.update(); };
scene.add(new THREE.HemisphereLight(0xffffff, 0x667077, 0.9));
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; }
const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(2, 9, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, far: 30 }); sun.shadow.bias = -0.0005; scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0xb9b6b0, roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const wall = new THREE.Mesh(new THREE.BoxGeometry(30, 6, 0.2), new THREE.MeshStandardMaterial({ color: 0x77787a, roughness: 1 })); wall.position.set(0, 3, -4.2); scene.add(wall);
const wall2 = wall.clone(); wall2.rotation.y = Math.PI / 2; wall2.position.set(3.6, 3, 0); scene.add(wall2);
const gen = new THREE.Group(); scene.add(gen); const fan = new THREE.Group(); fan.position.set(...GENSET.fan); gen.add(fan);
window.viewTo([-0.39, 1.4, 4.05], [-0.39, 1.4, 0]);
loadGenset(out => { out.rig.forEach(o => gen.add(o)); out.static.forEach(o => gen.add(o)); out.fan.forEach(o => fan.add(o)); window.stats = renderer.info; setTimeout(() => { window.ready = true; }, 300); });
renderer.setAnimationLoop(() => { renderer.render(scene, camera); });
