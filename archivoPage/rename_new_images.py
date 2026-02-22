#!/usr/bin/env python3
"""
Rename new images to archiveImageN.ext and extract artist/description metadata.
Dry-run by default. Pass --apply to actually rename and update images.json.
"""
import os, re, json, sys

img_dir = "archiveImages"
json_file = "images.json"
dry_run = "--apply" not in sys.argv

# Find the highest existing archiveImageN number
existing_nums = []
for f in os.listdir(img_dir):
    m = re.match(r'^archiveImage(\d+)\.\w+$', f)
    if m:
        existing_nums.append(int(m.group(1)))
next_num = max(existing_nums) + 1 if existing_nums else 1
print(f"Highest existing: archiveImage{next_num - 1}")
print(f"Next number: {next_num}")

# Find new files (not matching archiveImageN.ext) — only image files
IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'}
new_files = []
for f in sorted(os.listdir(img_dir)):
    ext = os.path.splitext(f)[1].lower()
    if ext not in IMAGE_EXTS:
        continue
    if not re.match(r'^archiveImage\d+\.\w+$', f):
        new_files.append(f)

print(f"Found {len(new_files)} new files to process:\n")

def parse_metadata(filename):
    name_no_ext = os.path.splitext(filename)[0]
    artista = ""
    descripcion = ""

    # Find parenthesized groups containing "insta" or "instagram" (case insensitive)
    artist_pattern = re.compile(r'\(([^)]*?(?:insta(?:gram)?)[^)]*?)\)', re.IGNORECASE)
    artist_matches = list(artist_pattern.finditer(name_no_ext))

    if artist_matches:
        match = artist_matches[-1]
        artist_text = match.group(1).strip()

        parts = re.split(r'\s+insta(?:gram)?\s*', artist_text, flags=re.IGNORECASE)
        if len(parts) >= 2:
            artista = parts[0].strip()
            handle = parts[1].strip()
            # Clean handle: keep only the username part (letters, digits, underscores, dots)
            # but strip trailing junk like "10archiveImage (1" 
            handle_match = re.match(r'^([A-Za-z_][A-Za-z0-9_.]*?)(?:\d*archiveImage.*|\s.*|$)', handle)
            if handle_match:
                handle = handle_match.group(1)
            if handle:
                artista += f" (@{handle})"
        else:
            artista = artist_text.strip()

        # Description is everything outside the artist parens
        desc_text = name_no_ext[:match.start()] + name_no_ext[match.end():]
        # Clean up junk from description
        desc_text = re.sub(r'archiveImage\s*\(\d+\)', '', desc_text)
        desc_text = re.sub(r'\(\d+\)\s*\(\d+\)', '', desc_text)
        desc_text = re.sub(r'\(\d+\)', '', desc_text)
        desc_text = re.sub(r'^\d+', '', desc_text)
        # Remove ForoFil_HelloSeahorse-style prefixes (before actual description)
        desc_text = desc_text.strip(' ._-')
        if desc_text:
            descripcion = desc_text
    else:
        # No closed parens with artist - check for unclosed leading paren
        # e.g. "(Ana Regin Insta rotten_dreamer1.jpg" or "(Paola ... insta polvocossmico10archiveImage (1)"
        m = re.match(r'^\((.+?)\s+(?:insta(?:gram)?)\s*([A-Za-z_]+)', name_no_ext, re.IGNORECASE)
        if m:
            name_part = m.group(1).strip()
            handle = m.group(2).strip()
            artista = name_part
            if handle:
                artista += f" (@{handle})"

    # Clean up description: remove internal file naming artifacts
    if descripcion:
        # Remove prefixes like "ForoFil_HelloSeahorse" before the actual description
        descripcion = re.sub(r'^[A-Za-z]+_[A-Za-z]+\s+', '', descripcion)
        descripcion = descripcion.strip(' ._-')

    return artista, descripcion

# Process files
results = []
for f in new_files:
    ext = os.path.splitext(f)[1].lower()
    artista, descripcion = parse_metadata(f)
    new_name = f"archiveImage{next_num}{ext}"
    results.append((f, new_name, artista, descripcion))
    
    mode = "DRY-RUN" if dry_run else "RENAME"
    print(f"  [{mode}] {f}")
    print(f"    -> {new_name}")
    print(f"    Artista: {artista or '(none)'}")
    print(f"    Descripcion: {descripcion or '(none)'}")
    print()
    next_num += 1

if dry_run:
    print(f"\n=== DRY RUN === {len(results)} files would be renamed.")
    print("Run with --apply to execute renaming and update images.json")
    sys.exit(0)

# Actually rename files
print(f"\nRenaming {len(results)} files...")
for old_name, new_name, _, _ in results:
    old_path = os.path.join(img_dir, old_name)
    new_path = os.path.join(img_dir, new_name)
    os.rename(old_path, new_path)
    print(f"  {old_name} -> {new_name}")

# Load existing JSON
if os.path.isfile(json_file):
    with open(json_file, encoding="utf-8") as f:
        data = json.load(f)
else:
    data = []

# Add new entries with metadata
for _, new_name, artista, descripcion in results:
    entry = {}
    entry["filename"] = new_name
    if artista:
        entry["artista"] = artista
    if descripcion:
        entry["descripcion"] = descripcion
    
    if artista or descripcion:
        data.append(entry)
    else:
        data.append(new_name)

# Write updated JSON
with open(json_file, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"\n✅ Done! Renamed {len(results)} files and updated {json_file}")
