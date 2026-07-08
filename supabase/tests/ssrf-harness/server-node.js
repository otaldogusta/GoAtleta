const http = require('http');

const requests = [];

const server = http.createServer(async (req, res) => {
  const { method, url, headers } = req;
  let body = '';
  req.on('data', (chunk) => { body += chunk.toString(); });
  req.on('end', () => {
    const entry = {
      time: new Date().toISOString(),
      method,
      path: url,
      headers,
      body: body || null,
    };
    requests.push(entry);
    console.log('Captured request:', JSON.stringify(entry));

    if (url === '/_requests') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ requests }, null, 2));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, seen: entry.time }));
  });
});

const port = process.env.PORT || 8000;
server.listen(port, () => console.log(`SSRF Node harness listening on http://localhost:${port}`));
