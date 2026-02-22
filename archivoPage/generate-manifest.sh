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

# Sort for deterministic output
sorted_files = sorted(files)

# Build output: preserve metadata for known files, plain strings for the rest
output = []
for name in sorted_files:
    if name in existing_meta:
        entry = {"filename": name}
        entry.update(existing_meta[name])
        output.append(entry)
    else:
        output.append(name)

with open(out_file, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"✅ Generated {out_file} with {len(sorted_files)} images")
PYEOF
