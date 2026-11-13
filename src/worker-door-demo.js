import * as THREE from 'three';
const smooth = x => { x = THREE.MathUtils.clamp(x,0,1); return x*x*x*(10+x*(-15+6*x)); };
// A single cabinet demonstration; no electrical operation or test state is changed.
export function createDoorDemo({worker, door, camera, controls, prepare, available, hud}) {
  let active = false, time = 0, saved, palmError = null;
  const handle = door.g.userData.handle, point = new THREE.Vector3(0,-0.046,0.035);
  const panel = door.g.parent, home = new THREE.Vector3(), base = new THREE.Vector3();
  const notice = document.createElement('div');
  notice.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:35;background:#17232eee;color:white;padding:12px 18px;border-radius:12px;max-width:85vw;display:none';
  const label = document.createElement('span'), stop = document.createElement('button'); stop.textContent = '終了'; stop.style.marginLeft='12px'; notice.append(label,stop); document.body.append(notice);
  function finish() {
    if (!active) return;
    active=false; notice.style.display='none'; hud.forEach((el,i)=>el.style.display=saved.hud[i]); controls.enabled=saved.controls;
    door.cur=saved.cur; door.target=saved.target; door.g.rotation.y=door.cur;
    worker.select(saved.selected); worker.root.position.copy(saved.position); worker.root.rotation.copy(saved.rotation); worker.root.visible=saved.visible;
    worker.active.preview?.(0,0); camera.position.copy(saved.camera); controls.target.copy(saved.targetCamera); controls.update();
    document.getElementById('workerChoice').value=worker.selected;
  }
  stop.onclick=finish;
  document.addEventListener('click', e => {
    if (active && !notice.contains(e.target) && e.target.closest('button,select') && e.target.id !== 'doorDemo') finish();
  }, true);
  document.addEventListener('pointerup', e => {
    if (active && e.target.tagName === 'CANVAS') e.stopImmediatePropagation();
  }, true);
  window.addEventListener('keydown',e=>{if(e.key==='Escape') finish();});
  function start() {
    if(active || !available()) return;
    prepare();
    saved={hud:hud.map(el=>el.style.display),selected:worker.selected,position:worker.root.position.clone(),rotation:worker.root.rotation.clone(),visible:worker.root.visible,cur:door.cur,target:door.target,camera:camera.position.clone(),targetCamera:controls.target.clone(),controls:controls.enabled};
    worker.select('natural'); document.getElementById('workerChoice').value='natural';
    controls.enabled=false; active=true; time=0; notice.style.display='block';
    door.cur=door.target=0; door.g.rotation.y=0; panel.updateMatrixWorld(true);
    home.copy(handle.localToWorld(point.clone()));
    base.copy(panel.worldToLocal(home.clone())); base.y=0; base.x-=0.23; base.z+=0.44;
    const target=home.clone(); target.y=1.1;
    camera.position.copy(panel.localToWorld(base.clone().add(new THREE.Vector3(2.0,1.75,2.4))));
    controls.target.copy(target); camera.lookAt(target);
    tick(0);
  }
  function tick(dt) {
    if(!active) return;
    if(!available()) {finish();return;}
    hud.forEach(el=>el.style.display='none');
    worker.root.visible=true;
    if(!worker.active.ready) {label.textContent='作業員を準備中…';return;}
    time=Math.min(7.5,time+dt);
    const pull=smooth((time-1.6)/3.2), release=smooth((time-5.5)/1.2);
    door.cur=door.target=-1.15*pull; door.g.rotation.y=door.cur;
    const position=base.clone(); position.z+=0.48*pull; position.x-=0.30*pull;
    worker.root.position.copy(panel.localToWorld(position));
    worker.root.rotation.y=Math.PI/2-0.30*pull;
    worker.active.preview(pull*Math.PI*2,0.30*Math.sin(Math.PI*pull),0);
    panel.updateMatrixWorld(true);
    const target=handle.localToWorld(point.clone());
    const actual=worker.active.reach(target,smooth(time/1.3)*(1-release),smooth((time-1.1)/0.5)*(1-release));
    palmError=actual?actual.distanceTo(target):null;
    label.textContent=time<1.6?'手を伸ばして取っ手をつかむ':time<5.5?'取っ手に手を合わせて引く':time<6.7?'手を離す':'試作の動きです';
    if(time>=7.5) finish();
  }
  return {start,tick,finish,get active(){return active;},get state(){return {time,palmError,angle:door.cur};}};
}
