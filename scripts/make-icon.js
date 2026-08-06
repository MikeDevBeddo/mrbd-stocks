/* Generates icon.png (64x64 RGBA) with no dependencies.
   The build guide requires a PNG favicon >= 52x52; SVG is not supported.
   Run: npm run icon */
'use strict';

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var W = 64, H = 64, R = 13;
var px = Buffer.alloc(W * H * 4); // RGBA, transparent by default

function blend(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  var i = (y * W + x) * 4;
  var dst = px[i + 3] / 255, src = Math.min(a, 1);
  var out = src + dst * (1 - src);
  if (out <= 0) return;
  px[i]     = Math.round((r * src + px[i]     * dst * (1 - src)) / out);
  px[i + 1] = Math.round((g * src + px[i + 1] * dst * (1 - src)) / out);
  px[i + 2] = Math.round((b * src + px[i + 2] * dst * (1 - src)) / out);
  px[i + 3] = Math.round(out * 255);
}

// rounded-rect coverage, sampled 3x3 per pixel for soft edges
function coverage(x, y) {
  var hits = 0, sx, sy, fx, fy, cx, cy;
  for (sy = 0; sy < 3; sy++) {
    for (sx = 0; sx < 3; sx++) {
      fx = x + (sx + 0.5) / 3;
      fy = y + (sy + 0.5) / 3;
      cx = Math.min(Math.max(fx, R), W - R);
      cy = Math.min(Math.max(fy, R), H - R);
      if ((fx - cx) * (fx - cx) + (fy - cy) * (fy - cy) <= R * R) hits++;
    }
  }
  return hits / 9;
}

// 1. background plate (#1C1E21)
for (var y = 0; y < H; y++) {
  for (var x = 0; x < W; x++) {
    var c = coverage(x, y);
    if (c > 0) blend(x, y, 0x1C, 0x1E, 0x21, c);
  }
}

// 2. rising chart line (#32D74B), drawn as overlapping discs
var PTS = [[11, 45], [23, 35], [33, 41], [45, 22], [54, 15]];
function disc(cx, cy, rad, r, g, b) {
  var x0 = Math.floor(cx - rad - 1), x1 = Math.ceil(cx + rad + 1);
  var y0 = Math.floor(cy - rad - 1), y1 = Math.ceil(cy + rad + 1);
  for (var yy = y0; yy <= y1; yy++) {
    for (var xx = x0; xx <= x1; xx++) {
      var d = Math.sqrt((xx + 0.5 - cx) * (xx + 0.5 - cx) + (yy + 0.5 - cy) * (yy + 0.5 - cy));
      var a = Math.min(1, Math.max(0, rad - d + 0.5));
      if (a > 0 && coverage(xx, yy) > 0.5) blend(xx, yy, r, g, b, a);
    }
  }
}

for (var s = 0; s < PTS.length - 1; s++) {
  var a = PTS[s], b = PTS[s + 1];
  var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  var steps = Math.ceil(len * 4);
  for (var t = 0; t <= steps; t++) {
    var f = t / steps;
    disc(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 2.1, 0x32, 0xD7, 0x4B);
  }
}
disc(PTS[PTS.length - 1][0], PTS[PTS.length - 1][1], 3.6, 0x32, 0xD7, 0x4B);

/* ------------------------------- PNG encoding ------------------------------ */

var CRC_TABLE = (function () {
  var table = new Int32Array(256), n, k, c;
  for (n = 0; n < 256; n++) {
    c = n;
    for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  var c = -1, i;
  for (i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  var len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  var body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  var crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

var ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 6;   // color type: RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

var raw = Buffer.alloc(H * (W * 4 + 1));
for (var row = 0; row < H; row++) {
  raw[row * (W * 4 + 1)] = 0; // filter: none
  px.copy(raw, row * (W * 4 + 1) + 1, row * W * 4, (row + 1) * W * 4);
}

var png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);

var out = path.join(__dirname, '..', 'icon.png');
fs.writeFileSync(out, png);
console.log('wrote ' + out + ' (' + png.length + ' bytes, ' + W + 'x' + H + ')');
