#!/bin/bash
# Generates images.json from the archiveImages/ directory.
# Preserves existing artista / descripcion metadata for known files.
# Run this script every time you add or remove images:
#   cd archivoPage && bash generate-manifest.sh

DIR="archiveImages"
OUT="images.json"

python3 - "$DIR" "$OUT" << 'PYEOF'
import json, sys, os, glob

img_dir = sys.argv[1]
out_file = sys.argv[2]

# Load existing metadata from current JSON (if it exists)
existing_meta = {}  # filename -> { artista?, descripcion? }
if os.path.isfile(out_file):
    try:
        with open(out_file) as f:
            entries = json.load(f)
        for e in entries:
            if isinstance(e, dict) and "filename" in e:
                meta = {k: v for k, v in e.items() if k != "filename"}
                if meta:
                    existing_meta[e["filename"]] = meta
    except Exception:
        pass

# Scan directory for image files
extensions = ("*.jpg", "*.jpeg", "*.png", "*.gif", "*.webp", "*.avif", "*.svg")
files = set()
for ext in extensions:
    for path in glob.glob(os.path.join(img_dir, ext)):
        files.add(os.path.basename(path))

# Sort numerically by the number in the filename
import re
def sort_key(name):
    m = re.search(r'(\d+)', name)
    return int(m.group(1)) if m else 0
sorted_files = sorted(files, key=sort_key)

# Build output: always use object format with artista/descripcion fields
output = []
for name in sorted_files:
    entry = {"filename": name}
    if name in existing_meta:
        entry["artista"] = existing_meta[name].get("artista", "")
        entry["descripcion"] = existing_meta[name].get("descripcion", "")
    else:
        entry["artista"] = ""
        entry["descripcion"] = ""
    output.append(entry)

with open(out_file, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"✅ Generated {out_file} with {len(sorted_files)} images")
PYEOF
