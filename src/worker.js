import * as THREE from 'three';

// 架空の作業員。写真・氏名・所属・ロゴは使わない。
export function createWorker() {
  const root = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: 0x858b90, roughness: 0.9 });
  const seams = new THREE.MeshStandardMaterial({ color: 0x555d65, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8aa87, roughness: 0.85 });
  const boots = new THREE.MeshStandardMaterial({ color: 0x272c30, roughness: 0.8 });
  const add = (parent, geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  };
  const box = (p, m, w, h, d, x, y, z) => add(p, new THREE.BoxGeometry(w, h, d), m, x, y, z);
  box(root, cloth, 0.43, 0.53, 0.25, 0, 1.18, 0);
  box(root, seams, 0.44, 0.055, 0.26, 0, 0.94, 0);
  box(root, seams, 0.015, 0.43, 0.012, 0, 1.19, -0.132);
  for (const x of [-0.12, 0.12]) {
    box(root, seams, 0.13, 0.11, 0.012, x, 1.28, -0.133);
    box(root, cloth, 0.13, 0.035, 0.018, x, 1.32, -0.143);
  }
  add(root, new THREE.CylinderGeometry(0.07, 0.07, 0.11, 12), skin, 0, 1.49, 0);
  const head = add(root, new THREE.SphereGeometry(0.145, 20, 16), skin, 0, 1.64, 0);
  head.scale.set(0.85, 1.15, 0.9);
  add(root, new THREE.SphereGeometry(0.028, 12, 8), skin, 0, 1.63, -0.13);
  for (const x of [-0.05, 0.05]) add(root, new THREE.SphereGeometry(0.012, 8, 8), boots, x, 1.68, -0.12);
  add(root, new THREE.CylinderGeometry(0.13, 0.15, 0.09, 24), cloth, 0, 1.79, 0);
  box(root, seams, 0.25, 0.025, 0.19, 0, 1.75, -0.11);
  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * 0.29, 1.4, 0); root.add(arm);
    box(arm, cloth, 0.14, 0.48, 0.16, 0, -0.23, 0);
    add(arm, new THREE.SphereGeometry(0.075, 12, 10), skin, 0, -0.51, 0);
    arms.push(arm);
    const leg = new THREE.Group(); leg.position.set(side * 0.12, 0.93, 0); root.add(leg);
    box(leg, cloth, 0.18, 0.76, 0.21, 0, -0.38, 0);
    box(leg, boots, 0.2, 0.15, 0.32, 0, -0.84, -0.045); legs.push(leg);
  }
  let phase = 0;
  return { root, update(distance) {
    phase += distance * 9;
    const swing = distance > 0.00001 ? Math.sin(phase) * 0.45 : 0;
    legs[0].rotation.x = arms[1].rotation.x = swing;
    legs[1].rotation.x = arms[0].rotation.x = -swing;
  }};
}
