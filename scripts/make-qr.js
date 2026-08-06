/* Generates qr-deeplink.png — the Web App deep link as a scannable QR.
   Run: npm run qr  [--  https://your-url/  "App Name"]

   The `qrcode` CLI emits a PNG whose light modules are FULLY TRANSPARENT
   (the code lives in the alpha channel, RGB is 0 everywhere). That renders
   as black-on-black — i.e. invisible — in any dark-themed README or viewer.
   So we decode it, composite onto opaque white, and re-encode without alpha. */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var zlib = require('zlib');
var execFileSync = require('child_process').execFileSync;

var url = process.argv[2] || 'https://mikedevbeddo.github.io/mrbd-stocks/';
var appName = process.argv[3] || 'Stocks';
var WIDTH = 300;

var deepLink = 'fb-viewapp://web_app_deep_link?appName=' + encodeURIComponent(appName) +
               '&appUrl=' + encodeURIComponent(url);

var tmp = path.join(os.tmpdir(), 'mrbd-qr-raw.png');
execFileSync('npx', ['-y', 'qrcode', '-t', 'png', '-o', tmp, '-w', String(WIDTH), '-q', '2', deepLink],
             { stdio: ['ignore', 'ignore', 'inherit'] });

/* ------------------------------- decode ---------------------------------- */

function decodePng(buf) {
  var off = 8, width = 0, height = 0, colorType = 0, bitDepth = 0, idat = [];
  while (off < buf.length) {
    var len = buf.readUInt32BE(off);
    var type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IHDR') {
      width = buf.readUInt32BE(off + 8);
      height = buf.readUInt32BE(off + 12);
      bitDepth = buf[off + 16];
      colorType = buf[off + 17];
    } else if (type === 'IDAT') {
      idat.push(buf.slice(off + 8, off + 8 + len));
    }
    off += len + 12;
  }
  if (bitDepth !== 8) throw new Error('unexpected bit depth ' + bitDepth);

  var channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!channels) throw new Error('unsupported color type ' + colorType);

  var raw = zlib.inflateSync(Buffer.concat(idat));
  var stride = width * channels;
  var out = Buffer.alloc(stride * height);
  var pos = 0;

  // Undo the per-scanline filters (PNG spec 9.2)
  for (var y = 0; y < height; y++) {
    var filter = raw[pos++];
    var line = raw.slice(pos, pos + stride);
    pos += stride;
    var cur = out.slice(y * stride, (y + 1) * stride);
    for (var x = 0; x < stride; x++) {
      var a = x >= channels ? cur[x - channels] : 0;
      var b = y > 0 ? out[(y - 1) * stride + x] : 0;
      var c = (x >= channels && y > 0) ? out[(y - 1) * stride + x - channels] : 0;
      var v = line[x];
      switch (filter) {
        case 0: break;
        case 1: v = v + a; break;
        case 2: v = v + b; break;
        case 3: v = v + ((a + b) >> 1); break;
        case 4: {
          var p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = v + (pa <= pb && pa <= pc ? a : (pb <= pc ? b : c));
          break;
        }
        default: throw new Error('unknown filter ' + filter);
      }
      cur[x] = v & 0xFF;
    }
  }
  return { width: width, height: height, channels: channels, data: out };
}

/* ------------------------ flatten onto white ------------------------------ */

var img = decodePng(fs.readFileSync(tmp));
var rgb = Buffer.alloc(img.width * img.height * 3);

for (var i = 0, n = img.width * img.height; i < n; i++) {
  var s = i * img.channels;
  var r, g, b2, alpha;
  if (img.channels === 4) { r = img.data[s]; g = img.data[s + 1]; b2 = img.data[s + 2]; alpha = img.data[s + 3] / 255; }
  else if (img.channels === 3) { r = img.data[s]; g = img.data[s + 1]; b2 = img.data[s + 2]; alpha = 1; }
  else { r = g = b2 = img.data[s]; alpha = 1; }
  // over opaque white
  rgb[i * 3]     = Math.round(r * alpha + 255 * (1 - alpha));
  rgb[i * 3 + 1] = Math.round(g * alpha + 255 * (1 - alpha));
  rgb[i * 3 + 2] = Math.round(b2 * alpha + 255 * (1 - alpha));
}

/* -------------------------------- encode ---------------------------------- */

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
  var c = -1;
  for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
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
ihdr.writeUInt32BE(img.width, 0);
ihdr.writeUInt32BE(img.height, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 2;   // color type: RGB, no alpha -> nothing can render transparent
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

var rowBytes = img.width * 3;
var rawOut = Buffer.alloc(img.height * (rowBytes + 1));
for (var row = 0; row < img.height; row++) {
  rawOut[row * (rowBytes + 1)] = 0;  // filter: none
  rgb.copy(rawOut, row * (rowBytes + 1) + 1, row * rowBytes, (row + 1) * rowBytes);
}

var png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(rawOut, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);

var out = path.join(__dirname, '..', 'qr-deeplink.png');
fs.writeFileSync(out, png);
fs.unlinkSync(tmp);

console.log('deep link: ' + deepLink);
console.log('wrote ' + out + ' (' + img.width + 'x' + img.height + ', opaque RGB, ' + png.length + ' bytes)');
