// 開発用：発電機モデルの確認ページを blender/genset/out/preview.html に作る
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
const r = await build({ entryPoints: ['src/genset-preview.js'], bundle: true, minify: true, format: 'iife', write: false, loader: { '.glb': 'binary', '.jpg': 'dataurl', '.png': 'dataurl', '.webp': 'dataurl' } });
writeFileSync('blender/genset/out/preview.html', '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;overflow:hidden;background:#000}</style></head><body><script>' + r.outputFiles[0].text.replace(/<\/script>/g, '<\\/script>') + '</script></body></html>');
console.log('preview.html');
