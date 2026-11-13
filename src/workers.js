import * as THREE from 'three';
import {createWorker as natural} from './worker.js';
import {createWorker as legacy} from './worker-legacy.js';
export function createWorker() {
  const root = new THREE.Group(), cache = {};
  let selected = 'natural';
  try { if(localStorage.getItem('generator-worker') === 'legacy') selected='legacy'; } catch {}
  function select(id) {
    selected = id === 'legacy' ? 'legacy' : 'natural';
    if(!cache[selected]) { cache[selected]=(selected === 'legacy' ? legacy : natural)(); root.add(cache[selected].root); }
    for(const [key,worker] of Object.entries(cache)) worker.root.visible=key===selected;
    try {localStorage.setItem('generator-worker',selected);} catch {}
  }
  select(selected);
  return {root, select, get selected(){return selected;}, get active(){return cache[selected];}, update(d){cache[selected].update(selected === 'legacy' ? Math.abs(d) : d);}};
}
