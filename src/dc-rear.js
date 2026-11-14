// 機器室の監視用UPSのうち、直流電源盤（No.61-2）と蓄電池盤（No.61-3）の裏側。
// 写真（裏から撮ったもの）：蓄電池盤＝棚2段に蓄電池が2列ずつ。直流電源盤＝格子の枠、上にエキスパンドメタル、
// 灰色の箱2台、白い丸い機器（用途未確認）、単相の変圧器、下に三相の変圧器2台。
// 教育用の想像モデル。寸法・個数・配線は写真からの近似。裏の扉（両開き）は推測。メーカー名・ロゴは入れない。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export function makeDcRear({ M, canvasTex }) {
  // ---------- 共通の材質・形 ----------
  const frameM = M(0xd9d5c3, 0.15, 0.55);          // 盤の枠（ベージュの塗装）
  const innerM = M(0xe4e2d8, 0.1, 0.7);
  const plateM = M(0xd2d4d0, 0.15, 0.6);
  const blackM = M(0x151618, 0.2, 0.45), cableM = M(0x111213, 0.1, 0.38);
  const lidM = M(0x0d0e10, 0.15, 0.18);            // 蓄電池のふた（つやのある黒）
  const alM = M(0xc4c8cc, 0.7, 0.32), zincM = M(0xc9cdd0, 0.85, 0.28), brassM = M(0xb8973c, 0.85, 0.3);
  const yelM = M(0xf2d21b, 0, 0.5), whiteM = M(0xeceae2, 0.05, 0.45);
  const coilTex = canvasTex(64, 128, (c, w, h) => {   // 巻線の横じま（樹脂含浸の黄色）
    c.fillStyle = '#e39a22'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) { c.fillStyle = `rgba(150,80,10,${0.18 + Math.random() * 0.12})`; c.fillRect(0, y, w, 1.2); }
    for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,220,140,.18)'; c.fillRect(Math.random() * w, Math.random() * h, 1, 6 + Math.random() * 14); }
  });
  const coilM = M(0xffffff, 0.05, 0.32, { map: coilTex });
  const batTex = canvasTex(128, 256, (c, w, h) => {   // 蓄電池の前面：濃い灰色、上に通気のすじ、青い印（文字・ロゴは入れない）
    c.fillStyle = '#2f3236'; c.fillRect(0, 0, w, h);
    const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,.05)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.12)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1d1f22'; for (let i = 0; i < 4; i++) c.fillRect(44 + i * 11, 14, 5, 22);
    c.strokeStyle = '#2f8fd8'; c.lineWidth = 3; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(34, 168); c.lineTo(34, 118); c.lineTo(52, 140); c.lineTo(70, 108); c.lineTo(78, 168); c.stroke();
    c.beginPath(); c.moveTo(86, 168); c.lineTo(86, 122); c.lineTo(100, 122); c.stroke();
    c.fillStyle = '#2f8fd8'; c.fillRect(34, 176, 66, 4);
  });
  const batFrontM = M(0xffffff, 0.1, 0.5, { map: batTex });
  const meshTex = canvasTex(128, 128, (c, w, h) => {   // エキスパンドメタル（ひし形の網）
    c.clearRect(0, 0, w, h); c.strokeStyle = '#c9ccce'; c.lineWidth = 5;
    for (let y = -16; y < h + 16; y += 16) for (let x = -32; x < w + 32; x += 32) { const o = (y / 16) % 2 ? 16 : 0; c.beginPath(); c.moveTo(x + o, y); c.lineTo(x + o + 16, y + 8); c.lineTo(x + o + 32, y); c.stroke(); }
  }, [6, 4]);
  const meshM = new THREE.MeshStandardMaterial({ map: meshTex, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.35 });
  const ductTex = canvasTex(64, 256, (c, w, h) => {   // 灰色の穴あきダクト（縦のスリット）
    c.fillStyle = '#9ea2a6'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a2c2e'; for (let y = 6; y < h; y += 16) c.fillRect(6, y, w - 12, 9);
  });
  const ductM = M(0xffffff, 0.2, 0.5, { map: ductTex });
  const pcbM = M(0x2f6a3a, 0.1, 0.6);

  // 盤ごとの組み立て。x0＝裏から見て左端、z1＝裏の面。u＝裏から見て左→右、d＝裏の面から奥へ
  function panel(g, kind, x0, x1, z0, z1, h) {
    const W = x1 - x0, DP = z1 - z0;
    const root = new THREE.Group(); root.position.set(x0, 0, z1); g.add(root);
    const inside = new THREE.Group(); inside.visible = false; root.add(inside);
    const B = (u0, u1, y0, y1, d0, d1, m, p = inside) => { const o = new THREE.Mesh(new THREE.BoxGeometry(u1 - u0, y1 - y0, d1 - d0), m); o.position.set((u0 + u1) / 2, (y0 + y1) / 2, -(d0 + d1) / 2); p.add(o); return o; };
    const RB = (u, y, d, du, dy, dd, r, m, p = inside) => { const o = new THREE.Mesh(new RoundedBoxGeometry(du, dy, dd, 3, r), m); o.position.set(u, y, -d); p.add(o); return o; };
    const CY = (u, y, d, r, len, m, axis = 'y', seg = 16, p = inside) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m); if (axis === 'z') o.rotation.x = Math.PI / 2; if (axis === 'x') o.rotation.z = Math.PI / 2; o.position.set(u, y, -d); p.add(o); return o; };
    const T = (pts, r, m, p = inside) => { const o = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([u, y, d]) => new THREE.Vector3(u, y, -d))), 24, r, 8, false), m); p.add(o); return o; };
    const bolt = (u, y, d, m = zincM) => CY(u, y, d, 0.007, 0.008, m, 'z', 6);

    // 箱：正面の板・側板・天板（外から見える面は今までどおり。中は明るいベージュ）。天板は直流電源盤だけ網
    B(0, W, 0.06, h, DP - 0.03, DP, innerM, root);
    B(0, 0.015, 0.06, h, 0, DP, frameM, root); B(W - 0.015, W, 0.06, h, 0, DP, frameM, root);
    B(0, W, 0.04, 0.07, 0, DP, M(0x9a9c98, 0.3, 0.7), root);   // 床板
    if (kind === 'bat') B(0, W, h - 0.015, h, 0, DP, frameM, root);
    else { B(0, W, h - 0.012, h, 0, 0.05, frameM, root); B(0, W, h - 0.012, h, DP - 0.05, DP, frameM, root);
      const mp = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.03, DP - 0.1), meshM); mp.rotation.x = -Math.PI / 2; mp.position.set(W / 2, h - 0.006, -DP / 2); root.add(mp); }
    // 裏の枠（外まわり）。ボルトの穴の点
    const fr = 0.05, holes = [];
    B(0, fr, 0.06, h, 0, 0.04, frameM, root); B(W - fr, W, 0.06, h, 0, 0.04, frameM, root); B(0, W, h - fr, h, 0, 0.04, frameM, root); B(0, W, 0.06, 0.2, 0, 0.04, frameM, root);
    for (let y = 0.3; y < h - 0.1; y += 0.25) holes.push([fr / 2, y], [W - fr / 2, y]);
    for (let u = 0.15; u < W - 0.1; u += 0.3) holes.push([u, h - fr / 2], [u, 0.17]);
    holes.forEach(([u, y]) => CY(u, y, -0.001, 0.0045, 0.002, blackM, 'z', 8, root));

    let built = false; const build = () => { if (built) return; built = true; if (kind === 'bat') batteries(); else rectifier(); };

    // ---------- 蓄電池盤：棚2段、各段2列 ----------
    function batteries() {
      const BW = 0.148, BH = 0.3, BD = 0.24, n = Math.floor((W - 0.16) / (BW + 0.004));
      const body = new RoundedBoxGeometry(BW, BH - 0.03, BD, 2, 0.006), lid = new RoundedBoxGeometry(BW + 0.004, 0.035, BD + 0.004, 2, 0.004);
      const front = new THREE.PlaneGeometry(BW - 0.008, BH - 0.04), hole = new THREE.CylinderGeometry(0.026, 0.026, 0.004, 20), post = new THREE.CylinderGeometry(0.008, 0.008, 0.02, 8);
      const tagGeo = new THREE.PlaneGeometry(0.03, 0.016), tagM = M(0xf2f2ee, 0, 0.6), batM = M(0x2c2f33, 0.15, 0.5);
      const tier = (y0) => {
        // 棚の床と、前の斜めの縁（写真の手前に傾いた板）
        B(fr, W - fr, y0 - 0.025, y0, 0.03, DP - 0.04, frameM);
        const lip = B(fr, W - fr, 0, 0.085, -0.006, 0.006, frameM); lip.position.set(W / 2, y0 + 0.03, -0.045); lip.rotation.x = -0.32;
        B(fr, W - fr, y0 - 0.06, y0 - 0.025, 0.0, 0.05, frameM);
        // 仕切り板（左の数個を分ける）
        B(0.36, 0.366, y0, y0 + 0.16, 0.07, DP - 0.05, frameM);
        for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) {
          const u = 0.08 + BW / 2 + i * (BW + 0.004), d = 0.075 + BD / 2 + r * (BD + 0.03), yb = y0 + (BH - 0.03) / 2;
          const o = new THREE.Mesh(body, batM); o.position.set(u, yb, -d); inside.add(o);
          const l = new THREE.Mesh(lid, lidM); l.position.set(u, y0 + BH - 0.03 + 0.0175, -d); inside.add(l);
          if (r === 0) { const f = new THREE.Mesh(front, batFrontM); f.position.set(u, yb, -d + BD / 2 + 0.0005); inside.add(f); }
          for (const dd of [-0.06, 0.06]) { const hh = new THREE.Mesh(hole, blackM); hh.position.set(u, y0 + BH + 0.004, -(d + dd)); inside.add(hh);
            const p = new THREE.Mesh(post, zincM); p.position.set(u, y0 + BH - 0.004, -(d + dd)); inside.add(p); }
          const tg = new THREE.Mesh(tagGeo, tagM); tg.rotation.x = -Math.PI / 2; tg.position.set(u + 0.04, y0 + BH + 0.007, -(d - 0.09)); inside.add(tg);
        }
        // 電池どうしをつなぐ太い線（前の列と奥の列を、ふたの上で弧に）と、上へ抜ける主の線
        for (let i = 0; i < n; i += 2) { const u = 0.08 + BW / 2 + i * (BW + 0.004);
          T([[u, y0 + BH + 0.005, 0.135], [u + 0.02, y0 + BH + 0.09, 0.27], [u, y0 + BH + 0.005, 0.405]], 0.011, cableM); }
        for (let i = 1; i < n - 1; i += 3) { const u = 0.08 + BW / 2 + i * (BW + 0.004);
          T([[u, y0 + BH + 0.005, 0.405], [u + 0.08, y0 + BH + 0.07, 0.42], [u + BW + 0.004, y0 + BH + 0.005, 0.405]], 0.009, cableM); }
        return n;
      };
      tier(0.24); tier(1.04);
      // 段の間の太いはり（写真の幅の広い板）
      B(fr, W - fr, 0.86, 1.0, 0.0, 0.05, frameM); B(fr, W - fr, 0.86, 0.87, 0.0, 0.3, frameM);
      // 主の線：上段の端から上へ（天板の穴へ）、下段の端から奥の柱沿いに上へ
      T([[0.15, 1.35, 0.14], [0.1, 1.62, 0.2], [0.12, 1.9, 0.32], [0.16, h, 0.4]], 0.014, cableM);
      T([[W - 0.2, 1.35, 0.41], [W - 0.25, 1.7, 0.55], [W - 0.32, h, 0.62]], 0.014, cableM);
      T([[W - 0.15, 0.56, 0.4], [W - 0.12, 0.75, 0.6], [W - 0.1, 1.2, 0.7], [W - 0.1, h, 0.7]], 0.012, cableM);
      T([[0.15, 0.56, 0.14], [0.1, 0.72, 0.3], [0.07, 1.0, 0.65], [0.08, 1.5, 0.72], [0.08, h, 0.72]], 0.012, cableM);
      // 正面の扉の裏（奥に見える白い面）の締め金
      RB(W * 0.48, 1.62, DP - 0.04, 0.04, 0.16, 0.02, 0.005, M(0x8f9397, 0.6, 0.35));
      B(W * 0.48 - 0.12, W * 0.48 + 0.12, 1.63, 1.645, DP - 0.06, DP - 0.05, zincM);
    }

    // ---------- 直流電源盤：格子の枠と、変圧器・整流の機器 ----------
    function rectifier() {
      const um = 0.72, ya = 0.72, yb = 1.38, bw = 0.05;
      // 格子（裏の面に溶接した枠。写真の細かい区切り）
      B(um - bw / 2, um + bw / 2, 0.2, h - fr, 0, 0.04, frameM);
      B(fr, W - fr, ya - bw / 2, ya + bw / 2, 0, 0.04, frameM); B(fr, W - fr, yb - bw / 2, yb + bw / 2, 0, 0.04, frameM);
      for (const u of [0.27, 0.49]) B(u - 0.02, u + 0.02, ya, yb, 0, 0.04, frameM);
      B(fr, um, 1.04, 1.08, 0, 0.04, frameM);
      for (const u of [0.27, 0.49]) B(u - 0.02, u + 0.02, 1.08, yb, 0.04, 0.3, plateM);   // 奥への仕切り板
      // 天井ぎわの穴あきダクト（黄色の線が垂れる）
      B(0.12, W - 0.1, h - 0.16, h - 0.08, 0.32, 0.4, ductM);
      for (let i = 0; i < 6; i++) { const u = 0.8 + i * 0.07; T([[u, h - 0.12, 0.32], [u - 0.005, h - 0.16, 0.315], [u + 0.004, h - 0.2, 0.31]], 0.0025, yelM); }
      B(W - 0.2, W - 0.12, yb + 0.05, h - 0.16, 0.3, 0.38, ductM);                    // 右の縦ダクト
      for (let i = 0; i < 4; i++) T([[W - 0.2, yb + 0.1 + i * 0.08, 0.32], [W - 0.23, yb + 0.11 + i * 0.08, 0.32], [W - 0.27, yb + 0.1 + i * 0.08, 0.36]], 0.0025, yelM);
      // 上の左：灰色の箱2台（整流の機器か。ボルト2本ずつ・札）
      for (const u of [0.24, 0.48]) { RB(u, 1.66, 0.36, 0.14, 0.44, 0.34, 0.01, alM);
        bolt(u - 0.03, 1.8, 0.188); bolt(u + 0.03, 1.8, 0.188); bolt(u, 1.52, 0.188);
        B(u - 0.05, u - 0.01, 1.84, 1.87, 0.188, 0.19, M(0xf2efe0, 0, 0.6)); }
      T([[0.13, h - 0.02, 0.3], [0.14, 1.75, 0.42], [0.16, 1.5, 0.5], [0.24, 1.42, 0.55]], 0.016, cableM);
      // 上の右：黒い機器（端子に青の圧着端子）と、赤い被覆の太い線の端子
      RB(1.0, 1.6, 0.42, 0.18, 0.26, 0.2, 0.008, blackM);
      for (const y of [1.66, 1.54]) { bolt(1.0, y, 0.318, zincM); B(0.98, 1.02, y - 0.012, y + 0.012, 0.316, 0.32, M(0x2054c8, 0.1, 0.4)); }
      T([[1.0, 1.54, 0.3], [0.96, 1.48, 0.25], [0.85, 1.44, 0.3], [0.8, 1.42, 0.45]], 0.014, cableM);
      B(1.12, 1.17, 1.48, 1.86, 0.36, 0.38, zincM);                                   // 母線（銅の帯）
      for (const y of [1.78, 1.6]) { bolt(1.145, y, 0.355, brassM); CY(1.145, y + 0.05, 0.33, 0.016, 0.07, M(0xc0202a, 0.1, 0.4)); T([[1.145, y + 0.09, 0.33], [1.15, y + 0.2, 0.3], [1.13, h - 0.02, 0.28]], 0.013, cableM); }
      for (let i = 0; i < 3; i++) RB(1.26, 1.5 + i * 0.12, 0.42, 0.08, 0.1, 0.1, 0.008, M(0x2a2c30, 0.2, 0.5));
      // 中の左：白い丸い機器（用途未確認）と、まわりを回る黒い線
      CY(0.38, 1.06, 0.5, 0.25, 0.34, whiteM, 'z', 40);
      CY(0.38, 1.06, 0.33, 0.235, 0.004, M(0xd8d6ce, 0.05, 0.5), 'z', 40);
      { const tor = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.012, 8, 40, Math.PI * 1.2), cableM); tor.position.set(0.38, 1.06, -0.36); tor.rotation.z = Math.PI * 0.55; inside.add(tor); }
      // 中の右：単相の変圧器（巻線2つ）。上に赤い被覆の端子と黒い線、奥に緑の基板
      xfmr(1.0, 0.8, 0.4, 2, 0.95, false);
      B(0.8, 1.25, 0.82, 1.32, 0.7, 0.71, pcbM);
      for (let i = 0; i < 12; i++) B(0.84 + (i % 6) * 0.07, 0.88 + (i % 6) * 0.07, 0.9 + (i / 6 | 0) * 0.25, 0.94 + (i / 6 | 0) * 0.25, 0.69, 0.7, i % 3 ? blackM : M(0xd8c47a, 0.3, 0.5));
      // 下：三相の変圧器（左）と、もう1台（右）
      xfmr(0.4, 0.22, 0.38, 3, 1.0, true);
      xfmr(1.03, 0.22, 0.38, 3, 0.85, true);
      // 床の取付けはり
      B(fr, W - fr, 0.07, 0.12, 0.2, 0.6, M(0x7a7c78, 0.3, 0.6));
    }

    // 変圧器：巻線 n 個（黄色の含浸）・黒い鉄心の締め金・台・上の端子台（三相は青・白・赤の印）
    function xfmr(u, y0, d, n, s, strip) {
      const cw = 0.15 * s, ch = 0.24 * s, cd = 0.17 * s, gap = 0.012, tot = n * cw + (n - 1) * gap, ul = u - tot / 2;
      B(u - tot / 2 - 0.05, u + tot / 2 + 0.05, y0, y0 + 0.02, d - 0.12, d + 0.12, blackM);                // 台
      B(u - tot / 2 - 0.03, u + tot / 2 + 0.03, y0 + 0.02, y0 + 0.07 * s, d - cd / 2 - 0.02, d - cd / 2 + 0.005, blackM);   // 下の締め金（手前）
      B(u - tot / 2 - 0.03, u + tot / 2 + 0.03, y0 + 0.02, y0 + 0.07 * s, d + cd / 2 - 0.005, d + cd / 2 + 0.02, blackM);
      const yc = y0 + 0.03 + ch / 2;
      for (let i = 0; i < n; i++) { const uc = ul + cw / 2 + i * (cw + gap);
        RB(uc, yc, d, cw, ch, cd, 0.035 * s, coilM);
        B(uc - cw * 0.3, uc + cw * 0.3, yc + ch / 2 - 0.004, yc + ch / 2 + 0.012, d - cd * 0.35, d + cd * 0.35, M(0xb87a1c, 0.1, 0.4));   // 巻線の上の口出し部
        // 口出し線（白）を上の端子へ
        T([[uc - 0.02, yc + ch / 2 + 0.01, d - 0.03], [uc - 0.03, yc + ch / 2 + 0.06, d - 0.06], [uc - 0.025, yc + ch / 2 + 0.12, d - 0.1]], 0.005, whiteM);
        T([[uc + 0.02, yc + ch / 2 + 0.01, d - 0.03], [uc + 0.02, yc + ch / 2 + 0.07, d - 0.07], [uc + 0.025, yc + ch / 2 + 0.12, d - 0.1]], 0.005, whiteM); }
      B(u - tot / 2 - 0.03, u + tot / 2 + 0.03, yc + ch / 2 + 0.012, yc + ch / 2 + 0.05, d - cd / 2 - 0.02, d - cd / 2, blackM);   // 上の締め金
      const ty = yc + ch / 2 + 0.13;
      if (strip) {   // 端子台（クリーム色の帯、6端子。2つ目ごとに青・白・赤の印と黒い線）
        B(u - tot / 2 - 0.02, u + tot / 2 + 0.02, ty - 0.03, ty + 0.03, d - 0.1, d - 0.08, blackM);
        B(u - tot / 2, u + tot / 2, ty - 0.022, ty + 0.022, d - 0.11, d - 0.1, M(0xeee6cf, 0.05, 0.55));
        for (const k of [-1, 1]) bolt(u + k * (tot / 2 + 0.005), ty, d - 0.115);
        for (let i = 0; i < n * 2; i++) { const ut = ul + (i + 0.5) * tot / (n * 2);
          bolt(ut, ty, d - 0.112, zincM);
          if (i % 2) { const col = [0x2054c8, 0xf0f0ea, 0xc0202a][(i / 2 | 0) % 3]; CY(ut, ty + 0.03, d - 0.115, 0.007, 0.022, M(col, 0.1, 0.4));
            T([[ut, ty + 0.04, d - 0.115], [ut + 0.01, ty + 0.12, d - 0.14], [ut + 0.04, ty + 0.2, d - 0.22], [ut + 0.08, ty + 0.24, d - 0.34]], 0.007, cableM);
            T([[ut - 0.02, ty + 0.02, d - 0.115], [ut - 0.01, ty + 0.1, d - 0.12], [ut + 0.03, ty + 0.16, d - 0.13]], 0.0018, yelM); } }
        // 下の黄色い渡り線（写真の巻線の足もとを回る線）
        T([[ul + 0.01, y0 + 0.07, d - cd / 2 - 0.03], [u, y0 + 0.05, d - cd / 2 - 0.035], [ul + tot - 0.01, y0 + 0.075, d - cd / 2 - 0.03]], 0.006, M(0xe0a830, 0.2, 0.4));
      } else {       // 単相：赤い被覆の圧着端子と黒い太い線（上へ）
        for (let i = 0; i < n; i++) { const uc = ul + cw / 2 + i * (cw + gap);
          CY(uc, ty, d - 0.1, 0.017, 0.08, M(0xb3202c, 0.15, 0.35));
          CY(uc, ty - 0.06, d - 0.1, 0.008, 0.05, zincM);
          T([[uc, ty + 0.04, d - 0.1], [uc + 0.01, ty + 0.2, d - 0.12], [uc + 0.03, ty + 0.4, d - 0.18], [uc + 0.05, 1.98, d - 0.2]], 0.014, cableM); }
        // 裏の柱を通る接地の棒（銅色）
        CY(u, yc, d - cd / 2 - 0.01, 0.004, ch + 0.06, M(0xb06a3a, 0.7, 0.35));
      }
    }

    // ---------- 裏の扉（1枚、推測）。列の外側の端に蝶番、裏の通路側へ大きく開いて隣の盤の裏に沿う ----------
    const leaves = [];
    const doorM = M(0xd3d2c5, 0.25, 0.6), gasket = M(0x222222, 0.1, 0.8);
    for (const [hx, k] of kind === 'bat' ? [[0, -1]] : [[W, 1]]) {
      const leaf = new THREE.Group(); leaf.position.set(hx, 0, 0.004); leaf.userData.k = k; root.add(leaf);
      const s = k < 0 ? 1 : -1, lw = W - 0.006;
      const plate = new THREE.Mesh(new RoundedBoxGeometry(lw, h - 0.08, 0.022, 2, 0.004), doorM); plate.position.set(s * lw / 2, 0.06 + (h - 0.08) / 2, 0.011); leaf.add(plate);
      const gk = new THREE.Mesh(new THREE.BoxGeometry(lw - 0.04, h - 0.12, 0.004), gasket); gk.position.set(s * lw / 2, 0.06 + (h - 0.08) / 2, -0.002); leaf.add(gk);
      const hd = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.16, 0.03, 2, 0.008), M(0x8f9397, 0.6, 0.35)); hd.position.set(s * (lw - 0.07), 1.0, 0.035); for (const y of [0.5, 1.5]) { const lk = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 16), zincM); lk.rotation.x = Math.PI / 2; lk.position.set(s * (lw - 0.07), y, 0.027); leaf.add(lk); }; leaf.add(hd);
      for (const y of [0.35, h - 0.35]) { const hg = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.08, 10), zincM); hg.position.set(s * 0.004, y, 0.022); leaf.add(hg); }
      leaves.push(leaf);
    }
    return {
      leaves, light: { intensity: 0 }, cur: 0, target: 0, OPEN: 2.85, cab: [x0, x1, z0, z1], inside,
      build, toggle() { build(); this.target = this.target ? 0 : this.OPEN; inside.visible = true; },
    };
  }
  return { panel };
}
