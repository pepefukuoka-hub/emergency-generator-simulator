# Blender スクリプト（発電機モデル）

`genset/` … 非常用発電機の外観を、Blender（bpy）のスクリプトだけで作る。写真は使わない（寸法比は写真から測って数値にした）。
- `gb.py` 形を積み上げる道具箱 / `model.py` `m_engine.py` `m_site.py` 形の定義 / `textures.py` 模様とラベル / `build.py` 陰影（AO）の焼き込みと GLB 書き出し
- `run.sh` 一式を作り直して `src/genset/` に置く

```bash
python -m venv env && env/bin/pip install bpy xatlas pillow numpy
PY=env/bin/python blender/genset/run.sh --ao-size 2048 --samples 40
npm run build
```
決まり：メーカー名・形式・製造番号は入れない。ラベルの細かい字は、読めない線にしてある。
