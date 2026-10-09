// Baseline: plain node:http, no framework. Upper bound for any Node.js framework.
import { createServer } from 'node:http';

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') return json(res, 200, { hello: 'world' });
  const m = /^\/users\/([^/]+)$/.exec(req.url);
  if (req.method === 'GET' && m) return json(res, 200, { id: m[1], name: 'Ada' });
  if (req.method === 'POST' && req.url === '/users') {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = JSON.parse(raw);
      if (
        typeof body.name !== 'string' ||
        body.name.length < 2 ||
        !String(body.email).includes('@')
      )
        return json(res, 400, { error: 'invalid' });
      json(res, 201, { id: 1, ...body });
    });
    return;
  }
  json(res, 404, { error: 'not found' });
}).listen(Number(process.argv[2]), '127.0.0.1', () => console.log('ready'));
process.on('SIGTERM', () => process.exit(0)); // lets --cpu-prof write its profile
