# サードパーティのライセンス

| 名前 | バージョン | ライセンス | 用途 |
|---|---|---|---|
| [three.js](https://github.com/mrdoob/three.js) | 0.160.0 | MIT (c) 2010-2023 three.js authors | 3D 描画 |
| [esbuild](https://github.com/evanw/esbuild) | ビルド時のみ | MIT | バンドル（成果物には含まれません） |

`docs/index.html` には three.js が組み込まれており、そのライセンス表記はファイル内にコメントとして残しています。

## MakeHuman / MPFB のデータ（CC0 1.0）
作業員のモデル（`src/worker/worker.glb`）は、次の CC0 のデータをもとに、`blender/worker/build.py` で作っています。プログラムは取り込んでいません（データだけ）。
- 基本メッシュ（hm08）、体型の差分、骨、ウェイト：MPFB2（https://github.com/makehumancommunity/mpfb2 、アセットは CC0 1.0）
- 目のメッシュ：MakeHuman（https://github.com/makehumancommunity/makehuman 、アセットは CC0 1.0）
服・帽子・靴・髪・顔と服の色の絵は、このリポジトリのスクリプトで作成しています。
