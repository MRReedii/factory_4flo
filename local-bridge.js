const http = require("http");
const { exec, execFile } = require("child_process");

const PORT = 4787;

function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });

  res.end(JSON.stringify(data, null, 2));
}

function fetchJSON(url) {
  return fetch(url).then(async r => {
    if (!r.ok) throw new Error(`${url} (${r.status})`);
    return r.json();
  });
}

async function discoverAI() {
  const providers = [];

  //
  // Ollama
  //
  try {
    const tags = await fetchJSON("http://localhost:11434/api/tags");

    providers.push({
      id: "ollama",
      name: "Ollama",
      endpoint: "http://localhost:11434",
      connected: true,
      models: (tags.models || []).map(model => ({
        name: model.name,
        size: model.size,
        modified: model.modified_at
      }))
    });

  } catch (err) {
    providers.push({
      id: "ollama",
      name: "Ollama",
      endpoint: "http://localhost:11434",
      connected: false,
      error: err.message,
      models: []
    });
  }

  //
  // LM Studio
  //
  try {
    const models = await fetchJSON("http://localhost:1234/v1/models");

    providers.push({
      id: "lmstudio",
      name: "LM Studio",
      endpoint: "http://localhost:1234",
      connected: true,
      models: models.data || []
    });

  } catch (err) {
    providers.push({
      id: "lmstudio",
      name: "LM Studio",
      endpoint: "http://localhost:1234",
      connected: false,
      error: err.message,
      models: []
    });
  }

  return {
    ok: true,
    providers
  };
}

http.createServer(async (req, res) => {

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    });

    return res.end();
  }

  //
  // STATUS
  //
  if (req.url === "/status") {

    return send(res, 200, {
      ok: true,
      bridge: "Factory 4flo Local Bridge",
      cwd: process.cwd(),
      platform: process.platform,
      node: process.version
    });

  }

  //
  // DETECT LOCAL REPO
  //
  if (req.url === "/detect") {

    exec(
      "git rev-parse --show-toplevel",
      { cwd: process.cwd() },
      (err, stdout) => {

        if (err) {
          return send(res, 404, {
            ok: false,
            error: "No Git repository found."
          });
        }

        send(res, 200, {
          ok: true,
          path: stdout.trim()
        });

      });

    return;
  }

  //
  // OPEN FOLDER
  //
  if (req.url === "/open-folder" && req.method === "POST") {

    let body = "";

    req.on("data", chunk => body += chunk);

    req.on("end", () => {

      try {

        const { path } = JSON.parse(body || "{}");

        if (!path) {
          return send(res, 400, {
            ok: false,
            error: "Missing path."
          });
        }

        execFile("open", [path], err => {

          if (err) {

            return send(res, 500, {
              ok: false,
              error: err.message
            });

          }

          send(res, 200, {
            ok: true,
            path
          });

        });

      } catch (err) {

        send(res, 500, {
          ok: false,
          error: err.message
        });

      }

    });

    return;

  }

  //
  // AI DISCOVERY
  //
  if (req.url === "/ai/discover") {

    const ai = await discoverAI();

    return send(res, 200, ai);

  }

  send(res, 404, {
    ok: false,
    error: "Unknown endpoint."
  });

}).listen(PORT, () => {

  console.log("");
  console.log("========================================");
  console.log(" Factory 4flo Local Bridge");
  console.log("========================================");
  console.log(`Running: http://localhost:${PORT}`);
  console.log("");
  console.log("Endpoints");
  console.log("  GET  /status");
  console.log("  GET  /detect");
  console.log("  GET  /ai/discover");
  console.log("  POST /open-folder");
  console.log("");

});