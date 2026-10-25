import http from "node:http";
import crypto from "node:crypto";

// A minimal stand-in for stabbur's p4-notes API (D-N4) — enough of
// `GET /api/notes` and `GET /blob/<sha256>` for builder's pipeline tests to
// run against something real-ish rather than mocking `fetch` module-wide.
export function startFakeStabbur({ notes = [], blobs = {} } = {}) {
  let currentNotes = notes;
  const blobBytes = new Map();
  for (const [sha, text] of Object.entries(blobs)) {
    blobBytes.set(sha, Buffer.from(text));
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/api/notes") {
      const status = url.searchParams.get("status") || "ready";
      const body = JSON.stringify(currentNotes.filter((n) => n.status === status));
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(body);
    }
    if (req.method === "GET" && url.pathname.startsWith("/blob/")) {
      const sha = url.pathname.slice("/blob/".length);
      const bytes = blobBytes.get(sha);
      if (!bytes) {
        res.writeHead(404);
        return res.end("no such blob");
      }
      res.writeHead(200, { "Content-Type": "application/octet-stream" });
      return res.end(bytes);
    }
    res.writeHead(404);
    res.end("not found");
  });

  return {
    server,
    setNotes(next) {
      currentNotes = next;
    },
    addBlob(sha, text) {
      blobBytes.set(sha, Buffer.from(text));
    },
    listen() {
      return new Promise((resolve) => server.listen(0, () => resolve(`http://localhost:${server.address().port}`)));
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

// Deterministic sha256 for a fixture blob's bytes, matching
// `audioSnapshot.js`'s hash-verification on download.
export function shaOf(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}
