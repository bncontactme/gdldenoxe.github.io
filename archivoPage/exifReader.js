/**
 * Minimal JPEG EXIF reader – extracts Artist & ImageDescription.
 * Works by fetching the file as ArrayBuffer and parsing the APP1 (Exif) segment.
 *
 * Usage:
 *   const meta = await readExifMeta('archiveImages/archiveImage176.jpg');
 *   // meta => { artist: 'Ana Regin …', description: 'Guadalajara es …' }
 *
 * Returns null if the file isn't JPEG or has no EXIF.
 */
(function (root) {
  'use strict';

  // EXIF tag IDs we care about
  const TAG_IMAGE_DESCRIPTION = 0x010E;
  const TAG_ARTIST            = 0x013B;

  /**
   * Fetch a URL and extract Artist + ImageDescription from JPEG EXIF.
   * Only fetches the first 64 KB (enough for EXIF header).
   * @param {string} url
   * @returns {Promise<{artist:string, description:string}|null>}
   */
  async function readExifMeta(url) {
    try {
      const res = await fetch(url, { headers: { Range: 'bytes=0-65535' } });
      // If range not supported, we get the whole file — that's fine
      const buf = await res.arrayBuffer();
      return parseExif(new DataView(buf));
    } catch (_) {
      return null;
    }
  }

  /**
   * Parse EXIF from a DataView of (at least) the start of a JPEG file.
   */
  function parseExif(view) {
    // Must start with JPEG SOI marker 0xFFD8
    if (view.byteLength < 14 || view.getUint16(0) !== 0xFFD8) return null;

    // Walk markers looking for APP1 (0xFFE1)
    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      if (marker === 0xFFE1) {
        // APP1 found
        const segLen = view.getUint16(offset + 2);
        return parseApp1(view, offset + 4, segLen - 2);
      }
      // Skip to next marker
      if ((marker & 0xFF00) !== 0xFF00) return null; // not a valid marker
      const len = view.getUint16(offset + 2);
      offset += 2 + len;
    }
    return null;
  }

  /**
   * Parse the APP1 segment (Exif header).
   */
  function parseApp1(view, start, length) {
    // Check "Exif\0\0"
    const end = start + length;
    if (end > view.byteLength) return null;
    if (getString(view, start, 4) !== 'Exif') return null;

    const tiffStart = start + 6; // skip "Exif\0\0"
    // Byte order: 'II' = little-endian, 'MM' = big-endian
    const bo = view.getUint16(tiffStart);
    const le = bo === 0x4949;
    if (!le && bo !== 0x4D4D) return null;

    // Validate TIFF magic 0x002A
    if (read16(view, tiffStart + 2, le) !== 0x002A) return null;

    // Offset to first IFD
    const ifdOffset = read32(view, tiffStart + 4, le);
    return readIFD(view, tiffStart, tiffStart + ifdOffset, le);
  }

  /**
   * Read IFD entries and extract the tags we want.
   */
  function readIFD(view, tiffStart, ifdStart, le) {
    if (ifdStart + 2 > view.byteLength) return null;
    const count = read16(view, ifdStart, le);
    const result = { artist: '', description: '' };
    let found = 0;

    for (let i = 0; i < count; i++) {
      const entryOff = ifdStart + 2 + i * 12;
      if (entryOff + 12 > view.byteLength) break;

      const tag = read16(view, entryOff, le);
      if (tag !== TAG_ARTIST && tag !== TAG_IMAGE_DESCRIPTION) continue;

      const type   = read16(view, entryOff + 2, le);
      const num    = read32(view, entryOff + 4, le);
      const valOff = entryOff + 8;

      let str = '';
      if (type === 2) { // ASCII
        const byteLen = num;
        if (byteLen <= 4) {
          str = getString(view, valOff, byteLen);
        } else {
          const ptr = read32(view, valOff, le);
          str = getString(view, tiffStart + ptr, byteLen);
        }
        // Remove trailing null
        str = str.replace(/\0+$/, '');
      }

      if (tag === TAG_ARTIST)            { result.artist = str; found++; }
      if (tag === TAG_IMAGE_DESCRIPTION) { result.description = str; found++; }
      if (found === 2) break;
    }

    return (result.artist || result.description) ? result : null;
  }

  // — Helpers —

  function read16(view, off, le) {
    return off + 2 <= view.byteLength ? view.getUint16(off, le) : 0;
  }

  function read32(view, off, le) {
    return off + 4 <= view.byteLength ? view.getUint32(off, le) : 0;
  }

  function getString(view, off, len) {
    // Use TextDecoder for proper UTF-8 support (accented chars, etc.)
    const end = Math.min(off + len, view.byteLength);
    const bytes = new Uint8Array(view.buffer, view.byteOffset + off, end - off);
    // Find null terminator
    let nullIdx = bytes.indexOf(0);
    const slice = nullIdx >= 0 ? bytes.subarray(0, nullIdx) : bytes;
    try {
      return new TextDecoder('utf-8').decode(slice);
    } catch (_) {
      // Fallback to latin1
      let s = '';
      for (let i = 0; i < slice.length; i++) s += String.fromCharCode(slice[i]);
      return s;
    }
  }

  // Expose globally
  root.readExifMeta = readExifMeta;

})(typeof window !== 'undefined' ? window : this);
