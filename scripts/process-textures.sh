#!/usr/bin/env bash
set -euo pipefail
cd /Users/pedro/PROJECT_2/public/textures

PAIRS="felt:Fabric034 cardboard:Cardboard004 wood:Wood060 paper:Paper002"

for pair in $PAIRS; do
  name="${pair%%:*}"
  id="${pair##*:}"
  src="src/${name}/${id}_1K-JPG_Color.jpg"
  rough="src/${name}/${id}_1K-JPG_Roughness.jpg"
  norm="src/${name}/${id}_1K-JPG_NormalGL.jpg"
  tmpdir=$(mktemp -d)
  sips -Z 512 "$src" --out "$tmpdir/color.jpg" >/dev/null
  sips -Z 512 "$rough" --out "$tmpdir/rough.jpg" >/dev/null
  sips -Z 512 "$norm" --out "$tmpdir/norm.jpg" >/dev/null
  cwebp -q 78 "$tmpdir/color.jpg" -o "${name}_color.webp" >/dev/null 2>&1
  cwebp -q 70 "$tmpdir/rough.jpg" -o "${name}_rough.webp" >/dev/null 2>&1
  cwebp -q 78 "$tmpdir/norm.jpg" -o "${name}_normal.webp" >/dev/null 2>&1
  rm -rf "$tmpdir"
  echo "== $name ($id)"
  ls -la "${name}_color.webp" "${name}_rough.webp" "${name}_normal.webp"
done

echo "--- total ---"
du -sh *.webp
du -ch *.webp | tail -1
