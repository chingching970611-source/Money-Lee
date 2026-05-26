import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = 4173;
const root = process.cwd();

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://localhost:${port}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": types[extname(filePath)] || "application/octet-stream",
    });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Preview running at http://127.0.0.1:${port}`);
});
