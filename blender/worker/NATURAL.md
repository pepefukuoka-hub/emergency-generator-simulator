# 選択式の作業員

- A（保存版）：`src/worker/` と `src/worker-legacy.js`。2026-11-11 の公開版をそのまま保存。
- B（新しい歩行）：`src/worker-natural/` と `src/worker.js`。`build-natural.py` で生成。
- `src/workers.js` が選択と遅延初期化を担当。選択は localStorage に保存し、利用不可でも動作する。

B は指定された点検写真の短い上着、袖のゆとり、折り襟を参考にした架空の人物。顔の再現や機械学習を実施したものではない。寸法、前面、靴、手袋は推測。手袋は普通の作業手袋の外観であり、絶縁性能を示すものではない。元写真は含めない。

Blender 4.3.2で `build-natural.py` を既存の build.py と同じ引数で実行する。出力3ファイルを `src/worker-natural/` へコピーし、npm run build。

歩行は接地62%・遊脚38%の簡略化した周期。膝を二関節の幾何計算で曲げ、遊脚を持ち上げる。腕は親の回転を考慮して下向きに整え、脚と逆に振る。モーションキャプチャではない。地面の凹凸、階段、走行専用モーションは未対応。

## 私服の男性「38歳」（C）
- `blender/worker/build-casual.py`（build-natural.py を元に、服・髪・靴を変更）→ `src/worker-casual/`、読み込みは `src/worker-casual.js`（動きは `src/worker.js` と共通）。
- 利用者のイラストの服装を参考にした架空の人物：黒いジップパーカー（胴は濃い灰色、ラグランのそでは黒、そでをまくって前腕は素肌、首の後ろにたたんだフード）、黒いズボン、黒いサンダル。顔は写していない（体は CC0 データのまま）。
- 実行：`python build-casual.py <mpfb data> <makehuman data> outc [preview]` → 3ファイルを `src/worker-casual/` へ。
- 走る：`pose(p, a, r)` の r（0＝歩く〜1＝走る）。接地の割合 62%→35%（両足が浮く時間）、歩幅 +0.5m、足の持ち上げ、ひじ約90°、体の前傾、上下動。移動の速さが 2.4m/s を超えると走る形になる（Shift キー、または右下の 🏃 ボタン）。A・B・C すべて共通（A は旧方式なので対象外）。モーションキャプチャではない。
