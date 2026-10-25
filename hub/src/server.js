import http from "node:http";
import { listPublications } from "./publications.js";

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(data) });
  res.end(data);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Read-only (D80): hub only ever shows what already happened, never a dry
// run — the forecast and "publish now" live in builder's own UI.
function renderHistoryPage(publications) {
  const rows = publications
    .map(
      (p) => `<tr>
        <td>${escapeHtml(p.build_id)}</td>
        <td>${escapeHtml(p.base_version)}</td>
        <td>${escapeHtml(p.patch_rev)}</td>
        <td>${escapeHtml(p.data_rev)}</td>
        <td><code>${escapeHtml(p.bundle_sha)}</code></td>
        <td>${escapeHtml(new Date(p.created_at).toISOString())}</td>
      </tr>`
    )
    .join("\n");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>mjolnir / hub — publish history</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #1a1a1a; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 6px 12px; border-bottom: 1px solid #ddd; font-size: 14px; }
  th { color: #555; font-weight: 600; }
  code { font-size: 12px; }
</style>
</head>
<body>
<h1>Publish history</h1>
<table>
  <thead><tr><th>build_id</th><th>base_version</th><th>patch_rev</th><th>data_rev</th><th>bundle_sha</th><th>created_at</th></tr></thead>
  <tbody>${rows || `<tr><td colspan="6">no publications yet</td></tr>`}</tbody>
</table>
</body>
</html>`;
}

// Mounted under /mjolnir (Caddy's `reverse_proxy /mjolnir/* mjolnir-hub:8000`
// forwards the full path, not stripped — tun/compose.yaml). Device-facing
// paths (/ota/*, /blob/*) are served directly off disk by Caddy, never by
// this process (P1, D55) — this server only carries the operator UI (D80).
export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && url.pathname === "/mjolnir/api/publications") {
        const publications = await listPublications();
        return sendJson(res, 200, publications);
      }
      if (req.method === "GET" && (url.pathname === "/mjolnir" || url.pathname === "/mjolnir/")) {
        const publications = await listPublications();
        const html = renderHistoryPage(publications);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(html);
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: err.message });
    }
  });
}
