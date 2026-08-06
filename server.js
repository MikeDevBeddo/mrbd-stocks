/* Minimal zero-dependency static server.
   Local dev:  npm start   ->  http://localhost:3000
   Vercel:     serves the same files statically (see vercel.json). */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');

var ROOT = __dirname;
var PORT = process.env.PORT || 3001;

var TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

http.createServer(function (req, res) {
  var pathname = decodeURIComponent(req.url.split('?')[0]);
  if (pathname === '/') pathname = '/index.html';

  var file = path.join(ROOT, path.normalize(pathname));
  if (file.indexOf(ROOT) !== 0) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, function (err, buf) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(buf);
  });
}).listen(PORT, function () {
  console.log('Stocks running on http://localhost:' + PORT);
  console.log('Simulator:            http://localhost:' + PORT + '/simulator.html');
});
