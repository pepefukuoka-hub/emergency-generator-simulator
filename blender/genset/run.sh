#!/bin/bash
# 発電機モデルを作り直して、src/genset/ に配置する。使い方: blender/genset/run.sh [build.py への引数]
#   PY に、bpy（pip install bpy）と xatlas・pillow が入った Python を指定する。
set -e
cd "$(dirname "$0")"; PY=${PY:-python}
$PY textures.py >/dev/null
$PY build.py "$@" 2>&1 | grep -v "Deprecat\|use_nodes\|INFO: \|^$\|Draco\|MeshOpt\|Baking map saved"
D=../../src/genset; mkdir -p $D
cp out/checker_n.png out/cast_n.png out/perf.png out/mesh.png out/decals.webp $D/
if [ -f out/ao.png ]; then $PY -c "
from PIL import Image, ImageFilter
im=Image.open('out/ao.png').convert('L').point(lambda v: int(112+0.56*v)); im.save('$D/ao.jpg', quality=80)"; fi
cp out/genset_raw.glb $D/genset.glb
ls -la $D
