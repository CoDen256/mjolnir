import http from "node:http";
import { runForecast, runPublish } from "./pipeline.js";
import { recentBuildJobs } from "./buildJobs.js";
import { buildGrammarRuleLookup } from "./stabburClient.js";

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

// Task 6.5: "C20 (4), C22 (1)" — what "publish now" is actually about to do,
// shown before the request fires, not just a disabled button while it's in
// flight.
function summarizeForecast(forecast) {
  const minting = forecast.decks.filter((d) => d.newlyEligibleCount > 0);
  if (minting.length === 0) return "nothing eligible right now — publish now would be a no-op";
  const total = minting.reduce((sum, d) => sum + d.newlyEligibleCount, 0);
  const perDeck = minting.map((d) => `${d.deckCode} (${d.newlyEligibleCount})`).join(", ");
  return `would mint ${total} note${total === 1 ? "" : "s"} across ${minting.length} deck${minting.length === 1 ? "" : "s"}: ${perDeck}`;
}

function renderForecastPage(forecast, jobs) {
  const rows = forecast.decks
    .map(
      (d) => `<tr>
        <td>${escapeHtml(d.deckCode)}</td>
        <td>${d.newlyEligibleCount}</td>
        <td>${d.pendingQueueDepth}</td>
        <td>${d.pendingOldestRemaining === null ? "" : d.pendingOldestRemaining}</td>
      </tr>`
    )
    .join("\n");
  const summary = summarizeForecast(forecast);

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
  nav { font-size: 14px; margin-bottom: 1rem; }
</style>
</head>
<body>
<h1>Forecast</h1>
<nav><a href="/mjolnir">hub's publish history →</a></nav>
<p>Live dry run — notes eligible to mint per deck right now, and each deck's pending-E queue (D91: no floor, every eligible note mints and publishes this run).</p>
<table>
  <thead><tr><th>deck</th><th>newly eligible</th><th>E's queued</th><th>oldest E's countdown</th></tr></thead>
  <tbody>${rows || `<tr><td colspan="4">no eligible notes pulled</td></tr>`}</tbody>
</table>
<p id="summary">${escapeHtml(summary)}</p>
<button id="publish-now">Publish now</button>
<div id="result"></div>
${renderBuildJobsTable(jobs)}
<script>
document.getElementById('publish-now').addEventListener('click', async () => {
  const btn = document.getElementById('publish-now');
  const result = document.getElementById('result');
  const summary = document.getElementById('summary').textContent;
  btn.disabled = true;
  result.textContent = summary + ' — publishing…';
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
      // schedule — a no-op if nothing is newly eligible (runPublish handles it).
      if (req.method === "POST" && url.pathname === "/builder/api/publish") {
        // D89: fetch stabbur's grammar rules once for this run, not once per
        // note — `type=grammar` notes project with real content instead of
        // a placeholder once this is wired in.
        const grammarRuleLookup = await buildGrammarRuleLookup({ baseUrl: config.stabburBaseUrl });
        const result = await runPublish(pool, { ...config, grammarRuleLookup });
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
