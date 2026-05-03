#!/bin/bash
# metadata.sh — Herramienta simple para manejar metadata de imágenes del archivo.
#
# Uso:
#   ./metadata.sh set <número> "<artista>" "<descripción>"   — Embeber metadata en la imagen
#   ./metadata.sh show <número>                              — Ver metadata actual
#   ./metadata.sh list                                       — Listar imágenes con metadata
#   ./metadata.sh generate                                   — Regenerar images.json desde EXIF
#   ./metadata.sh save                                       — Escribir metadata del JSON al EXIF
#
# Ejemplos:
#   ./metadata.sh set 176 "Ana Regin (@rotten_dreamer)" "Guadalajara es un lugar..."
#   ./metadata.sh show 176
#   ./metadata.sh generate

set -e
cd "$(dirname "$0")"

DIR="archiveImages"
OUT="images.json"

# Find the actual file for a given image number
find_file() {
  local num="$1"
  for f in "$DIR"/archiveImage"$num".*; do
    [ -f "$f" ] && echo "$f" && return 0
  done
  echo "Error: No se encontró archiveImage${num}.*" >&2
  return 1
}

case "${1:-help}" in

  set)
    [ -z "$2" ] && echo "Uso: $0 set <número> \"<artista>\" \"<descripción>\"" && exit 1
    FILE=$(find_file "$2")
    ARTISTA="${3:-}"
    DESC="${4:-}"
    ARGS=(-overwrite_original)
    [ -n "$ARTISTA" ] && ARGS+=("-Artist=$ARTISTA")
    [ -n "$DESC" ]    && ARGS+=("-ImageDescription=$DESC")
    exiftool "${ARGS[@]}" "$FILE"
    echo "✅ Metadata guardada en $FILE"
    exiftool -Artist -ImageDescription "$FILE"
    ;;

  show)
    [ -z "$2" ] && echo "Uso: $0 show <número>" && exit 1
    FILE=$(find_file "$2")
    exiftool -Artist -ImageDescription "$FILE"
    ;;

  list)
    echo "Imágenes con metadata:"
    echo "---"
    for f in "$DIR"/archiveImage*; do
      META=$(exiftool -s3 -Artist "$f" 2>/dev/null)
      if [ -n "$META" ]; then
        DESC=$(exiftool -s3 -ImageDescription "$f" 2>/dev/null)
        NUM=$(echo "$f" | grep -oE '[0-9]+')
        printf "  #%-3s  %-45s  %s\n" "$NUM" "$META" "${DESC:0:60}"
      fi
    done
    ;;

  generate)
    python3 - "$DIR" "$OUT" << 'PYEOF'
import json, sys, os, glob, subprocess, re

img_dir, out_file = sys.argv[1], sys.argv[2]

extensions = ("*.jpg", "*.jpeg", "*.png", "*.gif", "*.webp", "*.avif", "*.svg")
files = set()
for ext in extensions:
    for path in glob.glob(os.path.join(img_dir, ext)):
        files.add(os.path.basename(path))

def sort_key(name):
    m = re.search(r'(\d+)', name)
    return int(m.group(1)) if m else 0

def fix_description(s):
    """Fix newlines that exiftool converts to periods."""
    if not s: return s
    s = re.sub(r'\.\.\.(?=[A-ZÀ-Ý¿¡"])', '.\n\n', s)
    s = re.sub(r'\.\.(?=[A-ZÀ-Ý¿¡"(])', '.\n', s)
    s = re.sub(r'\. \.(?=[A-ZÀ-Ý¿¡])', '.\n', s)
    s = re.sub(r',\.(?=[a-zà-ÿ])', ',\n', s)
    s = re.sub(r', \.(?=[¿¡])', ',\n', s)
    s = re.sub(r';\.(?=[a-zà-ÿ])', ';\n', s)
    s = re.sub(r'(?<=…)\.(?=[a-zà-ÿ])', '\n', s)
    s = re.sub(r'(?<=\w\w)\.(?=[a-zà-ÿ])', '\n', s)
    s = re.sub(r'(?<=[a-zà-ÿ])\.(?=[A-ZÀ-Ý¿¡])', '\n', s)
    return s

output = []
for name in sorted(files, key=sort_key):
    filepath = os.path.join(img_dir, name)
    artista, descripcion = "", ""
    try:
        r = subprocess.run(
            ["exiftool", "-j", "-Artist", "-ImageDescription", filepath],
            capture_output=True, text=True, timeout=5
        )
        data = json.loads(r.stdout)
        if data:
            artista = str(data[0].get("Artist", "")).strip()
            descripcion = fix_description(str(data[0].get("ImageDescription", "")).strip())
    except Exception:
        pass
    output.append({"filename": name, "artista": artista, "descripcion": descripcion})

with open(out_file, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2, ensure_ascii=False)
    f.write("\n")

meta_count = sum(1 for e in output if e["artista"] or e["descripcion"])
print(f"✅ {out_file}: {len(output)} imágenes, {meta_count} con metadata")
PYEOF
    ;;

  save)
    echo "Escribiendo metadata del JSON al EXIF..."
    python3 - "$DIR" "$OUT" << 'PYEOF'
import json, sys, os, subprocess

img_dir, json_file = sys.argv[1], sys.argv[2]
data = json.load(open(json_file, encoding="utf-8"))
count = 0

for entry in data:
    artista = entry.get("artista", "").strip()
    descripcion = entry.get("descripcion", "").strip()
    if not artista and not descripcion:
        continue

    filepath = os.path.join(img_dir, entry["filename"])
    if not os.path.exists(filepath):
        print(f"  SKIP {entry['filename']}: no existe")
        continue

    args = ["exiftool", "-overwrite_original"]
    if artista:
        args.append("-Artist=" + artista)
    if descripcion:
        args.append("-ImageDescription=" + descripcion)
    args.append(filepath)

    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode == 0:
        count += 1
    else:
        print(f"  ERROR {entry['filename']}: {r.stderr.strip()}")

print(f"✅ Metadata escrita en {count} imágenes")
PYEOF
    ;;

  *)
    echo "metadata.sh — Manejar metadata de imágenes del archivo"
    echo ""
    echo "Comandos:"
    echo "  set <num> \"<artista>\" \"<desc>\"   Embeber metadata en imagen"
    echo "  show <num>                        Ver metadata de una imagen"
    echo "  list                              Listar todas con metadata"
    echo "  generate                          Regenerar images.json desde EXIF"
    echo "  save                              Escribir metadata del JSON al EXIF"
    ;;
esac
