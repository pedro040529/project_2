#!/usr/bin/env bash
set -euo pipefail
DEST=/Users/pedro/PROJECT_2/public/textures/src
mkdir -p "$DEST"
cd "$DEST"

# ambientCG CC0 textures (CC0 1.0) — 1K JPG downloads via their public API.
ASSET_PAIRS="Fabric034:felt Cardboard004:cardboard Wood060:wood Paper002:paper"

for pair in $ASSET_PAIRS; do
  id="${pair%%:*}"
  name="${pair##*:}"
  url="https://ambientcg.com/get?file=${id}_1K-JPG.zip"
  echo "== Downloading $id ($name) from $url"
  if ! curl -sL -m 60 -o "${name}.zip" "$url"; then
    echo "   FAILED curl for $id"
    continue
  fi
  filesize=$(stat -f%z "${name}.zip" 2>/dev/null || echo 0)
  filetype=$(file -b "${name}.zip")
  echo "   size: $filesize bytes, type: $filetype"
  if [[ "$filetype" != Zip* ]]; then
    echo "   NOT A ZIP, removing and skipping"
    rm -f "${name}.zip"
    continue
  fi
  mkdir -p "$name"
  unzip -o -q "${name}.zip" -d "$name"
  echo "   OK -> $name/"
done

echo "--- done ---"
find "$DEST" -maxdepth 2 -type d
