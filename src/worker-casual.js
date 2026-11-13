// worker-casual.js — 私服の男性「38歳」（架空の人物）。黒いジップパーカー・黒いズボン・黒いサンダル。
// 形は blender/worker/build-casual.py で生成。歩く・走る動きは worker.js と共通。
import GLB from './worker-casual/worker.glb';
import BODY_URI from './worker-casual/body.jpg';
import OUTFIT_URI from './worker-casual/outfit.jpg';
import { createWorker as make } from './worker.js';
export function createWorker() { return make({ glb: GLB, body: BODY_URI, outfit: OUTFIT_URI, weave: false }); }
