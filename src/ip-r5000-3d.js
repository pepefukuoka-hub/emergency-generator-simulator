import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { syncTesterParts, syncTesterControls, animateTester } from './relay-instruments.js';

// 第14版 p8/p9の配置を基にした独立モデル。厚さ・側面・コネクタ細部は外観上の近似。
const W=1000,H=734,PW=.446,PH=.321,S=PW/W;
const metal=new THREE.MeshStandardMaterial({color:0x858f88,metalness:.38,roughness:.48});
const trim=new THREE.MeshStandardMaterial({color:0xc0c6c3,metalness:.78,roughness:.28});
const black=new THREE.MeshStandardMaterial({color:0x171d1e,metalness:.08,roughness:.5});
function box(g,w,h,d,x,y,z,mat,r=.002){const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,r),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function texture(canvas){const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function panelText(g,t,x,y,size=13){g.font=`${size}px sans-serif`;g.fillStyle='#1b2927';g.textAlign='center';g.textBaseline='middle';g.fillText(t,x,y);}
function unit(name,which){
 const root=new THREE.Group();root.name=name;
 const planeRoot=new THREE.Group();planeRoot.rotation.x=-Math.PI/2;planeRoot.position.y=.145;root.add(planeRoot);
 box(planeRoot,.47,.345,.136,0,0,-.071,metal,.008);
 box(planeRoot,.472,.347,.008,0,0,-.132,trim,.004);
 box(planeRoot,.469,.344,.009,0,0,-.004,trim,.004);
 const cv=canvas(W*2,H*2),g=cv.getContext('2d');g.scale(2,2);
 g.clearRect(0,0,W,H);
 box(planeRoot,PW,PH,.001,0,0,.001,new THREE.MeshStandardMaterial({color:0xcdd3ca,roughness:.85,metalness:.05}),.001);
 const tex=texture(cv);const pane=new THREE.Mesh(new THREE.PlaneGeometry(PW,PH),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));pane.position.z=.0018;planeRoot.add(pane);
 for(const x of [-.19,.19])for(const y of [-.125,.125])box(planeRoot,.025,.025,.01,x,y,-.144,black,.005);
 // 掛け金、蝶番、取っ手はパネルから独立した立体部品。
 for(const x of [-.16,.16]){box(planeRoot,.028,.008,.044,x,-.177,-.035,trim);box(planeRoot,.018,.009,.023,x,-.182,-.038,metal);box(planeRoot,.042,.011,.012,x,.174,-.01,trim);}
 for(const x of [-.073,.073]){box(planeRoot,.016,.012,.025,x,-.178,-.073,trim);box(planeRoot,.013,.024,.023,x,-.195,-.083,black,.004);}
 box(planeRoot,.158,.018,.018,0,-.204,-.091,black,.006);
 for(const x of [-.236,.236])for(let i=0;i<8;i++)box(planeRoot,.001,.004,.045,x,-.06+i*.016,-.078,black,.0004);
 root.userData={W,H,pw:PW,ph:PH,cv,tex,pane,which,hits:[]};
 const parts=[];for(const x of [12,988])for(const y of [12,365,722])parts.push({t:'screw',id:`s${x}-${y}`,x,y,r:5});
 return {root,g,parts,hits:[],which};
}
function label(u,t,x,y,size){panelText(u.g,t,x,y,size);}
function connector(u,id,x,y,labelText,r=35){u.parts.push({t:'conn',id,x,y,r,pins:5});label(u,labelText,x,y+r+18,12);}
function border(u,x,y,w,h,title){u.g.strokeStyle='#31443f';u.g.lineWidth=1.6;u.g.strokeRect(x,y,w,h);label(u,title,x+w/2,y+13,12);}
function rotary(u,id,x,y,r,labels,angles,initial=0){
 if(id==='unsupported') id+=`-${x}-${y}`;
 labels.forEach((t,i)=>{const a=angles[i]*Math.PI/180;label(u,t,x+Math.sin(a)*(r+28),y-Math.cos(a)*(r+28),11);});
 const h={k:'rot',id,x,y,r:r+12,bodyRadius:r,angle:angles[initial]};u.hits.push(h);return h;
}
function toggle(u,id,x,y,st=0){if(id==='unsupported')id+=`-${x}-${y}`;const h={k:'toggle',id,x,y,r:22};u.parts.push({t:'tog',id,x,y,r:9,st,dir:'h',hit:h});return h;}
function button(u,id,x,y,text,col){const h={k:'button',id,x,y,r:25};u.parts.push({t:'btn',id,x,y,r:22,big:true,col,colLit:col,colDark:'#172225',hit:h});label(u,text,x,y+39,12);}
function dial(u,key,x,y,w,h,max,unitLabel){
 const p=u.root.userData.pane.parent,centerX=(x+w/2-W/2)*S,centerY=(H/2-y-h/2)*PH/H;
 box(p,(w+22)*S,(h+22)*PH/H,.019,centerX,centerY,.011,black,.003);
 const c=canvas(w*3,h*3),g=c.getContext('2d');g.scale(3,3);g.fillStyle='#f5f3e7';g.fillRect(0,0,w,h);
 const cx=w/2,cy=h*.91,r=w*.44;
 g.strokeStyle='#26332f';g.lineWidth=1;
 for(let i=0;i<=50;i++){const a=(-155+i*2.6)*Math.PI/180;const major=i%10===0;g.beginPath();g.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);g.lineTo(cx+Math.cos(a)*(r-(major?12:6)),cy+Math.sin(a)*(r-(major?12:6)));g.stroke();if(major)panelText(g,String(max*i/50),cx+Math.cos(a)*(r+15),cy+Math.sin(a)*(r+15),12);}
 panelText(g,unitLabel,cx,h*.64,27);panelText(g,'0.5  ~',cx,h*.81,10);
 const tex=texture(c),face=new THREE.Mesh(new THREE.PlaneGeometry(w*S,h*PH/H),new THREE.MeshBasicMaterial({map:tex}));face.position.set(centerX,centerY,.022);p.add(face);
 const pivot=new THREE.Group();pivot.position.set(centerX,(H/2-y-cy)*PH/H,.024);p.add(pivot);
 const needle=box(pivot,.00065,r*S,.0007,0,r*S/2,0,black,.0001);
 const glass=new THREE.Mesh(new THREE.PlaneGeometry(w*S,h*PH/H),new THREE.MeshPhysicalMaterial({color:0xd9ece9,transparent:true,opacity:.09,roughness:.12,clearcoat:1,depthWrite:false}));glass.position.set(centerX,centerY,.027);p.add(glass);
 return {pivot,needle,key,set(value){pivot.rotation.z=(65-130*THREE.MathUtils.clamp(value,0,1.05))*Math.PI/180;}};
}
export function createIP3D(){
 const m=unit('IP-R5000 計器操作部','IM'),p=unit('IP-R5000 電源抵抗部','IT');
 const group=new THREE.Group();group.name='IP-R5000';group.add(m.root,p.root);
 for(const [u,z]of [[m,.27],[p,-.27]]){u.root.rotation.y=Math.PI/2;u.root.position.set(0,.78,z);}
 // 計器部: 上段の6コネクタ、2つの計器、右側のカウンタ・SC/RC・切換。
 ['EARTH SIDE','OVR/UVR/DGR.V','PUN','GCR/DGR.A','OCR','TRIP.T'].forEach((t,i)=>connector(m,`m${i}`,55+i*100,58,t));
 for(const [i,x]of [[0,155],[1,255],[2,355],[3,455]])m.parts.push({t:'lamp',id:`ml${i}`,x,y:132,r:7,col:'#e14730',on:false});
 connector(m,'SC',936,61,'SC');connector(m,'RC',936,182,'RC');m.parts.push({t:'earth',id:'earth',x:862,y:24,r:8});
 const am=dial(m,'A',35,225,350,175,50,'A'),vm=dial(m,'V',430,225,350,175,150,'V');
 label(m,'TYPE IP-R5000',165,468,21);label(m,'MULTI RELAY TESTER',220,495,14);label(m,'計器操作部  METER OPERATING UNIT',570,495,15);
 border(m,820,288,168,96,'CURRENT OUTPUT');label(m,'TEST',850,344,11);label(m,'SET',955,344,11);toggle(m,'ipPath',904,344,1);
 border(m,820,397,168,145,'CONTACT MODE');const contact=rotary(m,'ipContact',904,485,27,['TRIP','C.CHECK'],[-45,45]);
 border(m,95,547,175,169,'AM METER');const meters=[50,25,10,5,2.5,1,.5,.25],ma=[-140,-100,-60,-20,20,60,100,140];const meter=rotary(m,'ipMeter',182,646,31,meters.map(String),ma,1);
 border(m,455,547,260,169,'VOLT METER');rotary(m,'unsupported',615,646,31,['12kV/150','75','300','750'],[-40,40,-120,120],0);toggle(m,'unsupported',486,678);label(m,'INPUT   OFF   OUTPUT',490,706,9);
 toggle(m,'unsupported',752,568);label(m,'R       T',752,548,11);toggle(m,'unsupported',752,682);label(m,'NORM.  OFF  REV.',752,711,9);
 border(m,815,557,175,160,'TEST MODE');rotary(m,'mode',910,647,37,['OCR','GCR','PUN','OVR','UVR','DGR'],[-145,-100,-55,-10,35,80],0);
 // カウンタは独立テクスチャ、値が変わるときだけ更新。
 const counter=canvas(420,150),cg=counter.getContext('2d'),ct=texture(counter),cp=new THREE.Mesh(new THREE.PlaneGeometry(.093,.039),new THREE.MeshBasicMaterial({map:ct}));cp.position.set((735-500)*S,(H/2-95)*PH/H,.006);m.root.userData.pane.parent.add(cp);
 box(m.root.userData.pane.parent,.103,.053,.007,(735-500)*S,(H/2-95)*PH/H,.001,black,.002);label(m,'COUNTER',735,35,12);button(m,'ipReset',675,160,'RESET','#333a3a');
 // 電源部: 左SC/RC、右補助電源、中央大型調整器。
 connector(p,'SC',70,65,'SC',39);connector(p,'RC',70,195,'RC',39);
 border(p,170,30,660,235,'IP-R5000  MULTI RELAY TESTER');
 label(p,'OCR CT RANGE',335,75,16);label(p,'30秒定格 / 連続定格',575,75,14);
 const rs=[.5,1,2,5,10,15,20],short=[50,35,25,20,11,8,6],cont=[20,14,10,6,4.5,3.5,3];
 rs.forEach((r,i)=>{label(p,`${r} Ω`,330,104+i*20,12);label(p,`${short[i]} A   /   ${cont[i]} A`,575,104+i*20,12);});
 connector(p,'line',934,70,'AC LINE INPUT',38);p.parts.push({t:'lamp',id:'pol',x:860,y:28,r:7,col:'#ecebc9',on:false});label(p,'POLARITY',861,48,8);
 border(p,833,152,160,242,'AUX. POWER');toggle(p,'unsupported',886,199);connector(p,'aux',934,226,'AUX',26);rotary(p,'unsupported',928,338,25,['AC100','DC24','DC48','DC110'],[-120,-40,40,120]);
 border(p,10,294,200,94,'GCR/DGR.A CT RANGE');toggle(p,'unsupported',80,347);label(p,'0.5A    2.4A',83,373,10);p.parts.push({t:'fuse',id:'fuse',x:180,y:345,r:15});
 border(p,10,404,200,170,'OCR CT RANGE');const ra=[130,90,50,10,-30,-70,-110];const resistance=rotary(p,'ipResistance',110,510,40,rs.map(String),ra,2);
 const regulator={k:'reg',id:'ipKnob',x:506,y:478,r:110,bodyRadius:91,angle:-140};p.hits.push(regulator);
 for(let i=0;i<=10;i++){const a=(-140+i*28)*Math.PI/180;label(p,String(i),506+Math.sin(a)*126,478-Math.cos(a)*126,14);}label(p,'VOLTAGE REGULATOR',506,635,17);label(p,'電圧電流調整器',506,658,13);
 border(p,10,603,255,116,'TEST');button(p,'ipStop',70,656,'STOP','#c34532');button(p,'ipStart',166,656,'START','#3e7759');p.parts.push({t:'lamp',id:'start',x:236,y:655,r:8,col:'#e44830',on:false});
 border(p,833,412,160,100,'MAIN POWER');toggle(p,'ipPower',934,469,-1);p.parts.push({t:'lamp',id:'power',x:871,y:469,r:8,col:'#e44830',on:false});label(p,'ON / OFF',937,498,10);
 border(p,736,554,257,165,'OVR / UVR / DGR.V TEST');rotary(p,'unsupported',800,651,27,['0','MAX'],[0,-140]);label(p,'VOLT ADJ.',801,708,10);rotary(p,'unsupported',931,651,27,['OVR/UVR','OFF','DGR'],[-55,0,55],1);
 label(p,'POWER RESISTANCE UNIT',430,708,16);
 for(const u of [m,p]){u.root.userData.tex.needsUpdate=true;syncTesterParts(u.root,u.parts,u.which);syncTesterControls(u.root,u.hits,u.which);}
 // SC/RCの相互接続コード。経路・たわみは教材上の近似。
 group.updateMatrixWorld(true);
 for(const [id,my,py,bow]of [['SC',61,65,-.27],['RC',182,195,-.22]]){
   const local=(u,x,y)=>group.worldToLocal(u.root.userData.pane.localToWorld(new THREE.Vector3((x-W/2)*S,(H/2-y)*PH/H,.022)));
   const a=local(m,936,my),b=local(p,70,py);
   const curve=new THREE.CatmullRomCurve3([a,a.clone().add(new THREE.Vector3(-.025,.025,0)),new THREE.Vector3(bow,.98,(a.z+b.z)/2),b.clone().add(new THREE.Vector3(-.025,.025,0)),b]);
   const wire=new THREE.Mesh(new THREE.TubeGeometry(curve,32,.004,8,false),black);wire.name=id+'接続コード（経路近似）';wire.castShadow=true;group.add(wire);
   m.parts.find(x=>x.id===id).on=true;p.parts.find(x=>x.id===id).on=true;
 }
 let last='',timer='';
 function update(s,dt=.016){
  const sign=JSON.stringify([s.power,s.started,s.path,s.contact,s.meter,s.resistance,s.knob,s.earth]);
  if(sign!==last){last=sign;meter.angle=ma[meters.indexOf(s.meter)];resistance.angle=ra[rs.indexOf(s.resistance)];regulator.angle=-140+s.knob*2.8;contact.angle=s.contact==='TRIP'?-45:45;
   m.parts.find(a=>a.id==='ipPath').st=s.path==='SET'?1:-1;p.parts.find(a=>a.id==='ipPower').st=s.power?1:-1;p.parts.find(a=>a.id==='power').on=s.power;p.parts.find(a=>a.id==='start').on=s.started;
   m.parts.find(a=>a.id==='ml3').on=s.started;p.parts.find(a=>a.id==='pol').on=s.earth;
   for(const u of [m,p]){syncTesterParts(u.root,u.parts,u.which);syncTesterControls(u.root,u.hits,u.which);}
  }
  am.set(s.current/s.meter);vm.set(0);
  const text=s.elapsed.toFixed(3)+(s.operated?' TRIP':'');if(text!==timer){timer=text;cg.fillStyle='#aab7a0';cg.fillRect(0,0,420,150);cg.fillStyle='#182b20';cg.font='48px monospace';cg.textAlign='center';cg.fillText(s.elapsed.toFixed(3)+' s',210,75);cg.font='23px sans-serif';cg.fillText(s.operated?'TRIP':'',210,121);ct.needsUpdate=true;}
  for(const u of [m,p])animateTester(u.root,dt);
 }
 return {group,meter:m.root,power:p.root,units:[m.root,p.root],update};
}
