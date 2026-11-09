# Blender スクリプト

`generator.py` … 非常用発電機（エンジン・発電機・操作盤・金網ガード・防振ゴム）を、手で作った形で出力します。写真は使いません。

## Mac での使い方
1. Blender（無料）を blender.org から入れる（Apple Silicon は「macOS Apple Silicon」版）。
2. ターミナルで、リポジトリの直下に移動して、次を実行する。
```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P blender/generator.py -- 64 gpu
```
- `64` … サンプル数（大きいほどきれいで遅い。確認だけなら 16）。
- `gpu` … Mac の GPU（Metal）で描画する。付けなければ CPU。
- `noexport` … 画像を描かず、`generator.glb` だけ書き出す。
3. `blender/out/` に、画像（`gen_desk.png`、`gen_deck.png`、`gen_end.png`）と `generator.glb` ができる。`out/` は Git に入れない。

## 古い Mac（2015年ごろの MacBook Pro など Intel 機）の場合
- **`gpu` は付けない**（CPU で描画する）。Intel Mac の GPU 描画は、機種と macOS で、使えるか変わる（未確認）。
- サンプル数は小さめ（16〜32）から。重ければ、画像を描かず `noexport` で `generator.glb` だけ作る。
- このスクリプトは、Blender 4.0 以降の部品名を使う（Principled BSDF の `Transmission Weight` など）。**Blender 3.x では動かない。** 手元の macOS に対応する、4.x の最新版を選ぶ（対応 OS は、blender.org のダウンロードページで確認。未確認）。
- 時間がかかる描画は、この環境（クラウド）に任せる、という分担もできる。

## Blender の画面で見たいとき
Blender を普通に開き、「Scripting」タブでこのファイルを開いて「実行」を押す（`-b` なしと同じ。`ARGS` は空になり、CPU・32サンプルで動く）。

## 決まり
- メーカー名・形式・製造番号は、スクリプトにも、材質（テクスチャ）にも入れない。
- 写真（実機・掲示）は、リポジトリに入れない。使うときは、Mac のローカルに置いて、パスを引数で渡す形にする。
