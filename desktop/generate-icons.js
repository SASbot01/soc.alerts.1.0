#!/usr/bin/env node
// BlackWolf SOC — Placeholder Icon Generator
// Run: node generate-icons.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUTPUT_DIR = path.join(__dirname, 'icons');

// ─── PNG Encoder ─────────────────────────────────────────────

function crc32(buf) {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (~crc) >>> 0;
}

function pngChunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function generatePng(width, height, pixelFn) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA

  const rowSize = 1 + width * 4;
  const raw = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      const off = y * rowSize + 1 + x * 4;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

// ─── Shield Shape ────────────────────────────────────────────

const AMBER = [245, 158, 11];
const DARK_FILL = [15, 15, 26];

function isInsideShield(x, y, size) {
  const cx = size / 2;
  const topY = size * 0.06;
  const bottomY = size * 0.92;
  const midY = size * 0.48;
  const halfWidth = size * 0.44;

  if (y < topY || y > bottomY) return false;

  const nx = Math.abs(x - cx) / halfWidth;

  if (y <= midY) {
    const t = (y - topY) / (midY - topY);
    return nx <= 0.88 + 0.12 * Math.sin(t * Math.PI * 0.5);
  }

  const t = (y - midY) / (bottomY - midY);
  return nx <= 1.0 * (1 - t * t);
}

function isNearShieldBorder(x, y, size, borderWidth) {
  if (!isInsideShield(x, y, size)) return false;
  const step = borderWidth * 0.5;
  for (let dx = -borderWidth; dx <= borderWidth; dx += step) {
    for (let dy = -borderWidth; dy <= borderWidth; dy += step) {
      if (!isInsideShield(x + dx, y + dy, size)) return true;
    }
  }
  return false;
}

function isClawMark(x, y, size) {
  const cx = size / 2;
  const cy = size * 0.46;
  const len = size * 0.17;
  const width = size * 0.022;

  for (let i = -1; i <= 1; i++) {
    const ox = cx + i * size * 0.085;
    const dx = x - ox;
    const dy = y - cy;
    // Slight rotation
    const angle = -0.15;
    const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ry = dx * Math.sin(angle) + dy * Math.cos(angle);

    if (Math.abs(rx) < width && Math.abs(ry) < len) return true;
  }
  return false;
}

function shieldPixel(x, y, width, height) {
  const size = Math.min(width, height);
  const border = size * 0.025;

  if (!isInsideShield(x, y, size)) return [0, 0, 0, 0];

  if (isNearShieldBorder(x, y, size, border)) {
    return [...AMBER, 255];
  }

  if (isClawMark(x, y, size)) {
    return [...AMBER, 255];
  }

  return [...DARK_FILL, 255];
}

// ─── Generate ────────────────────────────────────────────────

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('Generating BlackWolf SOC placeholder icons...\n');

const sizes = [
  { name: 'icon.png', size: 512 },
  { name: 'tray-icon.png', size: 32 }
];

for (const { name, size } of sizes) {
  const png = generatePng(size, size, shieldPixel);
  const outPath = path.join(OUTPUT_DIR, name);
  fs.writeFileSync(outPath, png);
  console.log(`  ${outPath} (${size}x${size}, ${(png.length / 1024).toFixed(1)} KB)`);
}

console.log('\nDone! Replace these with your actual brand icons.');
console.log('electron-builder auto-converts icon.png for all platforms.');
