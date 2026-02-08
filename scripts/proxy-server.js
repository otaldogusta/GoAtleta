const http = require("http");
const https = require("https");
const { URL } = require("url");

const TARGET =
  "https://script.google.com/macros/s/AKfycbzzk5n1OmrL_5wzROONHxGeK9NOuNrRziteNVnFSUlo1P052HBEBy2w6Lxrhcu_Fx8oEw/exec";
const PORT = process.env.PORT || 8787;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const requestWithRedirects = (targetUrl, method, body, res, depth) => {
  if (depth > 5) {
    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({ ok: false, error: "Too many redirects" }));
    return;
  }

  const options = {
    method,
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
  };

  const client = targetUrl.protocol === "https:"  https : http;
  const proxyReq = client.request(targetUrl, options, (proxyRes) => {
    const status = proxyRes.statusCode || 0;
    const location = proxyRes.headers.location;
    if (location && [301, 302, 303, 307, 308].includes(status)) {
      const nextUrl = new URL(location, targetUrl);
      const nextMethod = status === 303  "GET" : method;
      requestWithRedirects(nextUrl, nextMethod, body, res, depth + 1);
      return;
    }

    let responseBody = "";
    proxyRes.on("data", (chunk) => {
      responseBody += chunk;
    });
    proxyRes.on("end", () => {
      res.writeHead(200, corsHeaders);
      res.end(responseBody);
    });
  });

  proxyReq.on("error", (err) => {
    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({ ok: false, error: String(err) }));
  });

  if (body && method !== "GET") {
    proxyReq.write(body);
  }
  proxyReq.end();
};

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const targetUrl = new URL(TARGET);
  url.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    requestWithRedirects(targetUrl, req.method, body, res, 0);
  });
});

server.listen(PORT, () => {
  console.log(`CORS proxy running at http://localhost:${PORT}`);
});
