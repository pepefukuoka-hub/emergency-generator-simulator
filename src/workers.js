import * as THREE from 'three';
import {createWorker as natural} from './worker.js';
import {createWorker as legacy} from './worker-legacy.js';
import {createWorker as casual} from './worker-casual.js';
const MAKE = {natural, legacy, casual};
export function createWorker() {
  const root = new THREE.Group(), cache = {};
  let selected = 'natural';
  try { const v = localStorage.getItem('generator-worker'); if(MAKE[v]) selected=v; } catch {}
  function select(id) {
    selected = MAKE[id] ? id : 'natural';
    if(!cache[selected]) { cache[selected]=MAKE[selected](); root.add(cache[selected].root); }
    for(const [key,worker] of Object.entries(cache)) worker.root.visible=key===selected;
    try {localStorage.setItem('generator-worker',selected);} catch {}
  }
  select(selected);
  return {root, select, get selected(){return selected;}, get active(){return cache[selected];}, update(d){cache[selected].update(selected === 'legacy' ? Math.abs(d) : d);}};
}
