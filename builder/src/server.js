import http from "node:http";
import { runForecast, runPublish } from "./pipeline.js";
import { recentBuildJobs } from "./buildJobs.js";

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(data) });
  res.end(data);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// D80: a live forecast (dry run, task 4.14) plus the manual "publish now"
// button (task 4.15) — the history view lives in hub's own UI, not here.
function renderBuildJobsTable(jobs) {
  const rows = jobs
    .map(
      (j) => `<tr>
        <td>${j.id}</td>
        <td>${escapeHtml(j.status)}</td>
        <td>${escapeHtml(new Date(j.requested_at).toISOString())}</td>
        <td>${j.finished_at ? escapeHtml(new Date(j.finished_at).toISOString()) : ""}</td>
        <td>${j.error ? escapeHtml(j.error) : ""}</td>
      </tr>`
    )
    .join("\n");
  return `<h2>Recent build jobs</h2>
<table>
  <thead><tr><th>id</th><th>status</th><th>requested_at</th><th>finished_at</th><th>error</th></tr></thead>
  <tbody>${rows || `<tr><td colspan="5">no jobs yet</td></tr>`}</tbody>
</table>`;
}

function renderForecastPage(forecast, jobs) {
  const rows = forecast.decks
    .map(
      (d) => `<tr>
        <td>${escapeHtml(d.deckCode)}</td>
        <td>${d.newlyEligibleCount}</td>
        <td>${d.floor}</td>
        <td>${d.crossed ? "yes — will publish next run" : "waiting"}</td>
      </tr>`
    )
    .join("\n");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>mjolnir / builder — forecast</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #1a1a1a; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 1.5rem; }
  th, td { text-align: left; padding: 6px 12px; border-bottom: 1px solid #ddd; font-size: 14px; }
  th { color: #555; font-weight: 600; }
  button { font-size: 14px; padding: 8px 16px; cursor: pointer; }
  #result { margin-top: 1rem; font-size: 14px; }
</style>
</head>
<body>
<h1>Forecast</h1>
<p>Live dry run — which decks are close to the 6-note floor, computed the same way a real run would.</p>
<table>
  <thead><tr><th>deck</th><th>newly eligible</th><th>floor</th><th>status</th></tr></thead>
  <tbody>${rows || `<tr><td colspan="4">no eligible notes pulled</td></tr>`}</tbody>
</table>
<button id="publish-now">Publish now</button>
<div id="result"></div>
${renderBuildJobsTable(jobs)}
<script>
document.getElementById('publish-now').addEventListener('click', async () => {
  const btn = document.getElementById('publish-now');
  const result = document.getElementById('result');
  btn.disabled = true;
  result.textContent = 'publishing…';
  try {
    const res = await fetch('/builder/api/publish', { method: 'POST' });
    const body = await res.json();
    result.textContent = res.ok ? JSON.stringify(body) : ('error: ' + (body.error || res.status));
  } catch (err) {
    result.textContent = 'error: ' + err.message;
  } finally {
    btn.disabled = false;
  }
});
</script>
</body>
</html>`;
}

export function createServer(pool, config) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");

      if (req.method === "GET" && url.pathname === "/builder/api/forecast") {
        return sendJson(res, 200, await runForecast(pool, config));
      }
      if (req.method === "GET" && (url.pathname === "/builder" || url.pathname === "/builder/")) {
        const [forecast, jobs] = await Promise.all([runForecast(pool, config), recentBuildJobs(pool)]);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(renderForecastPage(forecast, jobs));
      }
      // Task 4.15: triggers 4.2-4.12 immediately, independent of the
      // schedule, still subject to the floor (runPublish enforces it).
      if (req.method === "POST" && url.pathname === "/builder/api/publish") {
        const result = await runPublish(pool, config);
        return sendJson(res, 200, result);
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: err.message });
    }
  });
}
