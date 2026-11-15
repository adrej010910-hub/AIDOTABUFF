const http = require("node:http");

function createGsiServer(port, onState) {
  const server = http.createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/") {
      res.writeHead(404); return res.end("not found");
    }
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 2_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        const state = JSON.parse(body);
        onState(state);
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("ok");
      } catch {
        res.writeHead(400); res.end("invalid payload");
      }
    });
  });
  server.listen(port, "127.0.0.1");
  return server;
}

module.exports = { createGsiServer };