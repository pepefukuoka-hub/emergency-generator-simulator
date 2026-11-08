// src/main.js を three.js ごと1つの HTML にまとめて docs/index.html に出力します。
import { build, context } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const opts = { entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, legalComments: 'inline' };

function emit(js) {
  const html = '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>非常用発電機シミュレータ</title>' +
    '<style>body{margin:0;overflow:hidden;background:#000}</style></head><body><script>' +
    js.replace(/<\/script>/g, '<\\/script>') + '</script></body></html>';
  mkdirSync('docs', { recursive: true });
  writeFileSync('docs/index.html', html);
  console.log('docs/index.html を出力しました（' + Math.round(html.length / 1024) + ' KB）');
}

if (watch) {
  const ctx = await context({ ...opts, plugins: [{ name: 'emit', setup(b) { b.onEnd(r => { if (r.outputFiles) emit(r.outputFiles[0].text); }); } }] });
  await ctx.watch(); console.log('監視中…');
} else {
  const r = await build(opts); emit(r.outputFiles[0].text);
}
