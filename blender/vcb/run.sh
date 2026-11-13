#!/bin/bash
# VCB の本体を作り直して、src/vcb/ に置く。使い方: PY=（bpy・xatlas・pillow 入りの python） blender/vcb/run.sh [build.py への引数]
set -e
cd "$(dirname "$0")"; PY=${PY:-python}
$PY build.py "$@" 2>&1 | grep -v "Deprecat\|INFO: \|^$\|Draco\|MeshOpt\|Baking map saved"
mkdir -p ../../src/vcb; cp out/vcb.glb ../../src/vcb/vcb.glb
$PY -c "
from PIL import Image
Image.open('out/ao.png').convert('L').point(lambda v: int(96+0.625*v)).save('../../src/vcb/ao.jpg', quality=82)"
ls -la ../../src/vcb
