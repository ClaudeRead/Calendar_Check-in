import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'icons');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  const typeBuf = Buffer.from(type, 'ascii');
  out.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 8 + data.length);
  return out;
}

function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function roundedRectAlpha(x, y, size, radius) {
  if (radius <= 0) return 1;
  const min = radius, max = size - radius;
  const cx = Math.max(min, Math.min(x, max));
  const cy = Math.max(min, Math.min(y, max));
  const dx = x - cx, dy = y - cy;
  return (dx * dx + dy * dy <= radius * radius) ? 1 : 0;
}

function drawPanda(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const bg = [93, 187, 143], bgTop = [126, 214, 168];
  const face = [255, 255, 255], dark = [58, 46, 42], blush = [244, 164, 164];
  const radius = maskable ? 0 : size * 0.22;

  const faceR = size * 0.34, faceCy = size * 0.56;
  const earR = size * 0.14, earDx = size * 0.26, earY = size * 0.20;
  const eyeR = size * 0.075, eyeDx = size * 0.11, eyeDy = size * 0.54, pupilR = size * 0.028;
  const blushR = size * 0.045, blushDx = size * 0.15, blushDy = size * 0.64;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const alpha = Math.round(255 * roundedRectAlpha(x + 0.5, y + 0.5, size, radius));
      const t = y / size;
      let r = Math.round(bg[0] + (bgTop[0] - bg[0]) * t);
      let g = Math.round(bg[1] + (bgTop[1] - bg[1]) * t);
      let b = Math.round(bg[2] + (bgTop[2] - bg[2]) * t);
      const px = x + 0.5, py = y + 0.5;

      const e1 = (px - (c - earDx)) ** 2 + (py - earY) ** 2;
      const e2 = (px - (c + earDx)) ** 2 + (py - earY) ** 2;
      if (e1 <= earR * earR || e2 <= earR * earR) { r = dark[0]; g = dark[1]; b = dark[2]; }

      const f = (px - c) ** 2 + (py - faceCy) ** 2;
      if (f <= faceR * faceR) { r = face[0]; g = face[1]; b = face[2]; }

      const ep1 = (px - (c - eyeDx)) ** 2 + (py - eyeDy) ** 2;
      const ep2 = (px - (c + eyeDx)) ** 2 + (py - eyeDy) ** 2;
      if (ep1 <= eyeR * eyeR || ep2 <= eyeR * eyeR) { r = dark[0]; g = dark[1]; b = dark[2]; }
      if (ep1 <= pupilR * pupilR || ep2 <= pupilR * pupilR) { r = 255; g = 255; b = 255; }

      const bl1 = (px - (c - blushDx)) ** 2 + (py - blushDy) ** 2;
      const bl2 = (px - (c + blushDx)) ** 2 + (py - blushDy) ** 2;
      if (bl1 <= blushR * blushR || bl2 <= blushR * blushR) { r = blush[0]; g = blush[1]; b = blush[2]; }

      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = alpha;
    }
  }
  return rgba;
}

mkdirSync(outDir, { recursive: true });
[['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true]].forEach(([name, size, mask]) => {
  writeFileSync(join(outDir, name), encodePNG(size, drawPanda(size, mask)));
  console.log('wrote', name);
});
