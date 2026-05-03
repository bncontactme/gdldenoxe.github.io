#!/bin/bash
# Generates images.json + thumbnails from the archiveImages/ directory.
# Always writes from scratch. Metadata is read fresh from EXIF on each run.
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

# --- Generate 96px thumbnails for the file explorer ---
import shutil
from pathlib import Path

# Wipe old thumbnails and regenerate from scratch
thumb_dir = os.path.join(img_dir, "thumbs")
if os.path.isdir(thumb_dir):
    shutil.rmtree(thumb_dir)
os.makedirs(thumb_dir)

# Determine which tool to use for resizing
sips = shutil.which("sips")          # macOS built-in
magick = shutil.which("magick") or shutil.which("convert")  # ImageMagick
ffmpeg_bin = shutil.which("ffmpeg")

generated = 0
failed = 0

for name in sorted_files:
    src = os.path.join(img_dir, name)
    base = Path(name).stem          # archiveImage12
    dest = os.path.join(thumb_dir, base + ".jpg")

    try:
        if sips:
            subprocess.run(
                ["sips", "-Z", "96", "-s", "format", "jpeg", src, "--out", dest],
                capture_output=True, timeout=15
            )
        elif magick:
            subprocess.run(
                [magick, src + "[0]", "-thumbnail", "96x96>", "-quality", "80", dest],
                capture_output=True, timeout=15
            )
        elif ffmpeg_bin:
            subprocess.run(
                [ffmpeg_bin, "-y", "-i", src, "-vframes", "1",
                 "-vf", "scale='min(96,iw)':'min(96,ih)':force_original_aspect_ratio=decrease",
                 dest],
                capture_output=True, timeout=15
            )
        else:
            print("⚠️  No image tool found (sips/magick/ffmpeg). Skipping thumbnails.")
            break
        generated += 1
    except Exception as e:
        print(f"   ⚠️  Thumb failed for {name}: {e}")
        failed += 1

print(f"🖼️  Thumbnails: {generated} generated" +
      (f", {failed} failed" if failed else ""))
PYEOF
