#!/bin/bash
# 制御盤の部品箱を作り直して、src/parts/ に置く。使い方: PY=（bpy・xatlas・pillow 入りの python） blender/parts/run.sh [build.py への引数]
set -e
cd "$(dirname "$0")"; PY=${PY:-python}
$PY build.py "$@" 2>&1 | grep -v "Deprecat\|INFO: \|^$\|Draco\|MeshOpt\|Baking map saved\|use_nodes"
mkdir -p ../../src/parts; cp out/parts.glb ../../src/parts/parts.glb
$PY -c "
from PIL import Image
Image.open('out/ao.png').convert('L').point(lambda v: int(80+0.686*v)).save('../../src/parts/ao.jpg', quality=80)"
ls -la ../../src/parts
