#!/bin/bash
# Generates images.json from the archiveImages/ directory.
# Run this script every time you add or remove images:
#   cd archivoPage && bash generate-manifest.sh

DIR="archiveImages"
OUT="images.json"

# Collect image filenames into a JSON array
echo "[" > "$OUT"
first=true
for f in "$DIR"/*.{jpg,jpeg,png,gif,webp,avif,svg}; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  if $first; then
    first=false
  else
    printf ",\n" >> "$OUT"
  fi
  printf '  "%s"' "$name" >> "$OUT"
done
echo "" >> "$OUT"
echo "]" >> "$OUT"

echo "✅ Generated $OUT with $(grep -c '"' "$OUT") images"
