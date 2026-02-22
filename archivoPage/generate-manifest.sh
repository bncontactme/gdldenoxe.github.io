#!/bin/bash
# Generates images.json from the archiveImages/ directory.
# Preserves existing artista / descripcion metadata for known files.
# Run this script every time you add or remove images:
#   cd archivoPage && bash generate-manifest.sh

DIR="archiveImages"
OUT="images.json"

python3 - "$DIR" "$OUT" << 'PYEOF'
import json, sys, os, glob, subprocess, re

img_dir = sys.argv[1]
out_file = sys.argv[2]

# Scan directory for image files
extensions = ("*.jpg", "*.jpeg", "*.png", "*.gif", "*.webp", "*.avif", "*.svg")
files = set()
for ext in extensions:
    for path in glob.glob(os.path.join(img_dir, ext)):
        files.add(os.path.basename(path))

# Sort numerically by the number in the filename
def sort_key(name):
    m = re.search(r'(\d+)', name)
    return int(m.group(1)) if m else 0
sorted_files = sorted(files, key=sort_key)

# Read EXIF metadata (Artist + ImageDescription) from an image file
def read_exif(filepath):
    artista = ""
    descripcion = ""
    try:
        result = subprocess.run(
            ["exiftool", "-s3", "-Artist", "-ImageDescription", filepath],
            capture_output=True, text=True, timeout=5
        )
        lines = result.stdout.strip().split("\n")
        if len(lines) >= 1 and lines[0]:
            artista = lines[0].strip()
        if len(lines) >= 2 and lines[1]:
            descripcion = lines[1].strip()
    except Exception:
        pass
    return artista, descripcion

# Build output: read metadata from EXIF embedded in each image
output = []
for name in sorted_files:
    filepath = os.path.join(img_dir, name)
    artista, descripcion = read_exif(filepath)
    entry = {"filename": name, "artista": artista, "descripcion": descripcion}
    output.append(entry)

with open(out_file, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"✅ Generated {out_file} with {len(sorted_files)} images")
meta_count = sum(1 for e in output if e["artista"] or e["descripcion"])
print(f"   {meta_count} images have embedded metadata")
PYEOF
