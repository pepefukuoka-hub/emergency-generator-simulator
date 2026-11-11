import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// 写真の配置を正規化した座標。寸法・目盛りは教材用の近似。
export function buildDeskInstruments(desk, S, needles) {
  const black = new THREE.MeshStandardMaterial({color:0x101416,metalness:0.48,roughness:0.24});
  const resin = new THREE.MeshStandardMaterial({color:0x141719,metalness:0.05,roughness:0.22});
  const steel = new THREE.MeshStandardMaterial({color:0xb8bfc0,metalness:0.85,roughness:0.26});
  const red = new THREE.MeshStandardMaterial({color:0xb3132b,roughness:0.35});
  const paint = new THREE.MeshStandardMaterial({color:0x83948e,metalness:0.25,roughness:0.35});
  const white = new THREE.MeshStandardMaterial({color:0xe4e6dd,roughness:0.6});
  const add = (p,g,m,x=0,y=0,z=0) => {const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;};
  const rounded = (p,w,h,d,r,m,x,y,z) => add(p,new RoundedBoxGeometry(w,h,d,5,r),m,x,y,z);
  const disk = (p,r,d,m,z) => {const o=add(p,new THREE.CylinderGeometry(r,r,d,96),m,0,0,z);o.rotation.x=Math.PI/2;return o;};
  const ring = (p,r,t,m,z) => add(p,new THREE.TorusGeometry(r,t,20,128),m,0,0,z);
  const label = (p,words,w,h,x,y,z) => {
    const c=document.createElement('canvas');c.width=1024;c.height=192;
    const g=c.getContext('2d');g.fillStyle='#e8e9e0';g.fillRect(0,0,c.width,c.height);
    g.fillStyle='#353a38';g.font='76px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(words,512,96);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
    rounded(p,w,h,0.0015,0.0007,white,x,y,z);
    add(p,new THREE.PlaneGeometry(w*0.96,h*0.9),new THREE.MeshStandardMaterial({map:t,roughness:0.65}),x,y,z+0.001);
  };
  rounded(desk,0.9,0.649,0.008,0.003,paint,0,0,0.001);
  const unit=0.9/1040;
  const specs=[
    [245,205,0.052,'機関回転計',18,'min⁻¹ ×100',-118.6,222.6,()=>S.rpm/1800,0.78],
    [651,189,0.043,'潤滑油',1,'MPa',-137,265,()=>0.5*Math.min(1,S.rpm/1200),0.5],
    [781,190,0.043,'冷却水',0.4,'MPa',-137,265,()=>0.46*Math.min(1,S.rpm/1200),0.35],
    [919,189,0.043,'給気',0.4,'MPa',-137,265,()=>0.35*Math.min(1,S.rpm/1200),0.1]
  ];
  specs.forEach(([px,py,r,title,max,units,rest,span,fn,reference],index)=>{
    const root=new THREE.Group();root.name='Desk_Gauge_'+index;root.position.set((px-520)*unit,(375-py)*unit,0.006);desk.add(root);
    disk(root,r*1.09,0.005,resin,0.001);
    disk(root,r*1.04,0.013,black,0.007);
    ring(root,r*0.98,r*0.055,black,0.015);
    ring(root,r*0.88,0.0008,steel,0.014);
    const c=document.createElement('canvas');c.width=c.height=1024;const g=c.getContext('2d');
    g.fillStyle='#ecece3';g.fillRect(0,0,1024,1024);g.translate(512,512);
    const point=(f,radius)=>{const a=(rest+span*f-90)*Math.PI/180;return [Math.cos(a)*radius,Math.sin(a)*radius];};
    const count=index===0?90:100, major=index===0?10:10;
    g.strokeStyle='#202826';g.fillStyle='#202826';
    for(let i=0;i<=count;i++){
      const long=i%major===0;const a=point(i/count,long?349:379),b=point(i/count,431);
      g.lineWidth=long?4:2;g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();
      if(long){const [x,y]=point(i/count,304);g.font='44px serif';g.textAlign='center';g.textBaseline='middle';g.fillText(index===0?String(i/5):(max*i/count).toFixed(max===1?1:2),x,y);}
    }
    g.lineWidth=1.5;
    for(const radius of [447,460]){g.beginPath();for(let i=0;i<=150;i++){const p=point(i/150,radius);i?g.lineTo(...p):g.moveTo(...p);}g.stroke();}
    if(index===1){g.strokeStyle='#23896b';g.lineWidth=10;g.beginPath();for(let i=0;i<=40;i++){const p=point(0.42+i/200,469);i?g.lineTo(...p):g.moveTo(...p);}g.stroke();}
    g.fillStyle='#252b29';g.font='42px sans-serif';g.textAlign='center';g.fillText(units,0,215);
    g.font='26px sans-serif';g.fillText('目安・架空',0,266);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=16;
    add(root,new THREE.CircleGeometry(r*0.875,128),new THREE.MeshStandardMaterial({map:tex,roughness:0.6}),0,0,0.0142);
    const n=new THREE.Group();n.position.z=0.015;root.add(n);
    const shape=new THREE.Shape();shape.moveTo(-0.0012,-r*0.2);shape.lineTo(0.0012,-r*0.2);shape.lineTo(0.00035,r*0.73);shape.lineTo(-0.00035,r*0.73);shape.closePath();
    add(n,new THREE.ExtrudeGeometry(shape,{depth:0.0007,bevelEnabled:true,bevelSize:0.00015,bevelThickness:0.00015,bevelSegments:3,steps:1}),black);
    disk(root,r*(index===0?0.18:0.09),0.003,black,0.018);
    ring(root,r*(index===0?0.18:0.09),0.0006,steel,0.019);
    needles.push({g:n,rest,span,fn});
    // 薄い透明面と弧状の反射。文字盤を白く覆わない。
    add(root,new THREE.CircleGeometry(r*0.87,128),new THREE.MeshPhysicalMaterial({color:0xdceef4,transparent:true,opacity:0.09,roughness:0.08,metalness:0.1,clearcoat:1,depthWrite:false}),0,0,0.021);
    const marker=rounded(root,0.0018,r*0.25,0.001,0.0004,red,0,0,0.023);
    const angle=-(rest+span*reference)*Math.PI/180;
    marker.position.x=-Math.sin(angle)*r*0.9;marker.position.y=Math.cos(angle)*r*0.9;marker.rotation.z=angle;
    if(index>0)for(const side of [-1,1]){
      const screw=new THREE.Group();screw.position.set(side*r*0.80,-r*0.64,0.016);root.add(screw);
      disk(screw,0.0026,0.0015,steel,0);
      rounded(screw,0.0032,0.00045,0.0003,0.0001,black,0,0,0.001);
    }
    label(desk,title,index===0?0.067:0.058,0.014,root.position.x,root.position.y+r*1.35,0.008);
  });
  const lever=new THREE.Group();lever.name='Desk_Selector';lever.position.set(-0.24,-0.155,0.007);desk.add(lever);
  rounded(lever,0.083,0.102,0.006,0.009,black,0,0,0);
  rounded(lever,0.076,0.095,0.003,0.007,white,0,0,0.004);
  label(lever,'始動',0.027,0.009,0.017,0.034,0.007);
  label(lever,'操作　中',0.055,0.009,0,-0.034,0.007);
  disk(lever,0.024,0.004,steel,0.009);
  disk(lever,0.021,0.012,black,0.015);
  ring(lever,0.020,0.0013,black,0.022);
  const grip=new THREE.Group();grip.position.set(0,0,0.024);grip.rotation.z=-0.20;lever.add(grip);
  // 断面の連続曲面で、根元から先端へ緩く膨らむ成形レバー。
  const points=[new THREE.Vector2(0,-0.006),new THREE.Vector2(0.006,-0.005),new THREE.Vector2(0.008,0),new THREE.Vector2(0.009,0.018),new THREE.Vector2(0.011,0.048),new THREE.Vector2(0.012,0.067),new THREE.Vector2(0.010,0.073),new THREE.Vector2(0,0.075)];
  const curve=new THREE.SplineCurve(points);
  const handle=add(grip,new THREE.LatheGeometry(curve.getPoints(96),96),resin);
  handle.rotation.x=Math.PI-0.24;handle.scale.z=0.65;
}
