# 作業員のモデル（Blender スクリプト）

白い保護帽と明るいグレーの作業服の作業員を作ります。架空の人物です。実在の人の写真・顔・氏名・所属・ロゴは使いません。

## 作り方
```bash
python -m venv bl && ./bl/bin/pip install bpy numpy pillow
git clone --depth 1 https://github.com/makehumancommunity/mpfb2
git clone --depth 1 https://github.com/makehumancommunity/makehuman
./bl/bin/python blender/worker/build.py mpfb2/src/mpfb/data makehuman/makehuman/data out
cp out/worker.glb out/body.jpg out/outfit.jpg src/worker/
npm run build
```
- 最後に `preview` を付けると、確認用の絵（`out/pv_*.png`）も描きます。
- MPFB・MakeHuman は、**データ（CC0）を読むだけ**です。プログラムは実行しません。

## 中身
- 体・骨・ウェイト・目：MakeHuman / MPFB のデータ。体型は、成人男性・平均の体格。身長 1.70m。
- 服：全身のヘルパー形状をふくらませて、上着とズボンに分けたもの。えり・前立て・ボタン・胸ポケット・ベルトを足してあります。
- 帽子・髪：頭の形から作成。靴：足の形の凸包から作成。
- 色の絵：UV の各画素の3D位置から色を決めて描き、Cycles の AO を掛けています（1024×1024 の JPEG 2枚）。
- 歩く動きは、`src/worker.js` で骨を回して付けています（モーションデータは使っていません）。

## 限界
- 市販のゲームのような、実写に近い人物ではありません。顔の肌の絵、髪、服のしわ、指の動きは簡素です。
- 服のゆとりと保護帽の外観は、ユーザー指定の点検写真を参考にしています。寸法、前面の細部、靴の形は推測です。元写真や人物の顔は素材として使用していません。
