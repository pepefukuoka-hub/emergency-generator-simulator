// 添付の内部写真2枚を参考にした外観模型。寸法・結線は近似、操作は模擬しない。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export function roadLighting({width, height, depth, materials, fronts, canvasTex}) {
  const g = new THREE.Group(), leaves = [], [paint, metal] = materials;
  const mat = (c,m=0,r=.65) => new THREE.MeshStandardMaterial({color:c,metalness:m,roughness:r});
  const black=mat(0x202527), cream=mat(0xdad9c9), duct=mat(0x9699a5), yellow=mat(0xd7bf3e), green=mat(0x168764), red=mat(0xba2926), silver=mat(0xb5bfc2,.7,.3);
  const W=width,H=height;
  function box(p,x,y,z,w,h,d,m,round=.004){const o=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(round,w/4,h/4,d/4)),m);o.position.set(x,y,z);p.add(o);return o;}
  function wire(p,pts,m,r=.004){const curve=new THREE.CatmullRomCurve3(pts.map(v=>new THREE.Vector3(...v))); const o=new THREE.Mesh(new THREE.TubeGeometry(curve,12,r,6,false),m);p.add(o);}
  const screwGeo=new THREE.CylinderGeometry(.006,.006,.003,12);
  function screw(p,x,y,z){const o=new THREE.Mesh(screwGeo,silver);o.rotation.x=Math.PI/2;o.position.set(x,y,z);p.add(o);box(p,x,y,z+.002,.008,.001,.001,black,0);}
  function label(p,x,y,z,w,h,text){const tex=canvasTex(256,64,(c,a,b)=>{c.fillStyle='#eeeede';c.fillRect(0,0,a,b);c.fillStyle='#252a2b';c.font='24px sans-serif';c.textAlign='center';c.fillText(text,a/2,42);});box(p,x,y,z,w,h,.002,new THREE.MeshBasicMaterial({map:tex}));}
  function channel(p,x,y,z,w,h){box(p,x,y,z,w,h,.045,duct);if(h>w){for(let a=-h/2+.014;a<h/2;a+=.026)box(p,x,y+a,z+.024,w*.72,.009,.002,black);}else{for(let a=-w/2+.014;a<w/2;a+=.026)box(p,x+a,y,z+.024,.009,h*.72,.002,black);}}
  box(g,0,H/2,-depth,W,H,.035,paint);
  for(const x of [-W/2,W/2])box(g,x,H/2,-depth/2,.035,H,depth,paint);
  for(const y of [.04,H])box(g,0,y,-depth/2,W,.04,depth,paint);
  // 内部は写真で見える浅い取付面まで。奥の変圧器等は未確認。
  box(g,0,H/2,-.35,W-.06,H-.12,.025,black);
  const z=-.20;
  for(const x of [-W*.46,W*.46])channel(g,x,H*.51,z,.065,H*.84);
  box(g,0,H*.94,z,W*.40,.055,.075,cream);
  box(g,0,H*.93,z+.045,W*.38,.022,.02,new THREE.MeshBasicMaterial({color:0xffffea}));
  for(const [y,n] of [[H*.81,42],[H*.71,40]]){
    box(g,0,y,z-.04,W*.86,.075,.025,metal);
    for(let i=0;i<n;i++){const x=-W*.39+i*W*.78/(n-1);box(g,x,y,z,.031,.065,.035,black);for(const dy of [-.019,.019])screw(g,x,y+dy,z+.02);
      wire(g,[[x,y+.035,z],[x,y+.10,z-.015],[x*.98,y+.20,z-.04]],i%7===0?red:i%7===1?cream:black,.004);
      wire(g,[[x,y-.035,z],[x+.012,y-.07,z],[x,y-.10,z-.03]],black,.003);
    }
  }
  for(let i=0;i<15;i++){const x=-W*.39+i*W*.78/14;wire(g,[[x,H*.83,z-.05],[x,H*.90,z-.08],[x+.02,H*.98,z-.12]],black,.013);label(g,x,H*.905,z-.06,.035,.06,'線');}
  // 写真の上段：主幹1＋分岐12、下段：分岐16。
  function breaker(x,y,w,main=false,off=false){box(g,x,y,z+.03,w,.083,.045,cream);box(g,x,y,z+.055,w*.86,.066,.012,silver);box(g,x,y,z+.065,w*.28,.056,.012,black);box(g,x,y+(off?-.012:.012),z+.077,w*.22,.027,.015,off?black:red);box(g,x-w*.28,y+.018,z+.065,w*.22,.014,.004,green);for(const dx of [-.35,.35])screw(g,x+w*dx,y-.024,z+.065);label(g,x,y+.060,z+.04,w,.021,main?'主幹':'照明');}
  for(const [y,n,top] of [[H*.55,12,true],[H*.38,16,false]]){
    box(g,0,y,z-.02,W*.90,H*.16,.035,paint);
    box(g,0,y+.105,z+.004,W*.79,.007,.005,yellow);
    for(let i=0;i<n;i++){const x=top?-W*.31+i*W*.67/(n-1):-W*.39+i*W*.78/(n-1);box(g,x,y+.07,z+.008,.006,.07,.006,yellow);breaker(x,y,W*.040,false,!top&&[5,6,7,13].includes(i));}
    if(top)breaker(-W*.41,y,W*.060,true);
  }
  const dial=new THREE.Mesh(new THREE.CylinderGeometry(.066,.066,.04,40),black);dial.rotation.x=Math.PI/2;dial.position.set(W*.405,H*.55,z+.04);g.add(dial);
  label(g,W*.405,H*.55,z+.064,.075,.06,'目安');
  for(let i=0;i<18;i++){const x=-W*.37+i*W*.69/17,y=H*.235;box(g,x,y,z,.044,.095,.055,cream);box(g,x,y,z+.031,.025,.035,.014,black);box(g,x,y+.012,z+.04,.019,.008,.004,red);for(const dy of [-.033,.033])for(const dx of [-.012,0,.012])screw(g,x+dx,y+dy,z+.031);for(const dy of [-1,1])wire(g,[[x,y+dy*.048,z],[x+.013,y+dy*.08,z],[x,y+dy*.11,z-.02]],yellow,.0025);}
  for(const y of [H*.14,H*.07]){channel(g,0,y-.024,z,W*.84,.035);for(let i=0;i<55;i++){const x=-W*.40+i*W*.80/54;box(g,x,y+.017,z,.018,.036,.022,black);screw(g,x,y+.017,z+.014);wire(g,[[x,y,z],[x+.006,y-.014,z+.025],[x,y-.03,z+.02]],yellow,.002);}}
  for(const side of [-1,1]){
    const p=new THREE.Group();p.position.set(side*W/2,0,0);g.add(p);leaves.push(p);
    box(p,-side*W/4,H/2,0,W/2-.012,H-.05,.025,paint);
    const face=new THREE.Mesh(new THREE.PlaneGeometry(W/2-.012,H-.05),fronts[side===-1?0:1]);face.position.set(-side*W/4,H/2,.014);p.add(face);
    channel(p,-side*W*.43,H*.5,-.06,.055,H*.84);
    for(const y of [.22,.44,.64,.79]){channel(p,-side*W*.25,H*y,-.065,W*.36,.04);for(let i=0;i<6;i++){const x=-side*(W*.10+i*W*.055);box(p,x,H*y+.07,-.07,.035,.05,.035,black);wire(p,[[x,H*y+.07,-.09],[x,H*y+.025,-.10],[-side*W*.42,H*y,-.10]],yellow,.0025);}}
    wire(g,[[side*W*.45,.08,z],[side*W*.40,.05,z+.03],[side*W*.42,.18,z+.02]],green,.007);
  }
  let opened=false;
  return {g,leaves,toggle(){opened=!opened;leaves.forEach((p,i)=>p.rotation.y=(opened?1.85:0)*(i===0?-1:1));},get opened(){return opened;}};
}
