import http from "node:http";
import { runForecast, runPublish } from "./pipeline.js";
import { recentBuildJobs, getBuildJob } from "./buildJobs.js";
import { buildGrammarRuleLookup } from "./stabburClient.js";
import { getSchedule, setSchedule } from "./schedulerConfig.js";
import { jobLogLines, makeDbLogger } from "./jobLogs.js";
import { recentBatches, occurrencesForBuild } from "./batchHistory.js";
import { renderShell, escapeHtml } from "./layout.js";
import { requireAuth, renderLoginPage, handleLoginPost } from "./auth.js";

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(data) });
  res.end(data);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  return body.length ? JSON.parse(body.toString("utf8")) : {};
}

function timeAgo(date) {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ---- Forecast & publish (occurrence-level, D-H2) ----

function occurrenceRow(o, { withReason = false } = {}) {
  const sideLetter = o.letter === "E" ? `<span class="pill pill-warn">${o.letter}</span>` : `<span class="pill pill-ok">${o.letter}</span>`;
  return `<tr>
    <td class="mono">${escapeHtml(o.cardId)}</td>
    <td>${sideLetter}</td>
    <td class="mono">${escapeHtml(o.deckCode)}</td>
    <td class="wrap">${o.noteText ? escapeHtml(o.noteText) : ""}</td>
    ${withReason ? `<td>${escapeHtml(o.reason || "")}</td>` : ""}
  </tr>`;
}

function renderForecastPage(forecast, jobs, batches, batchDetails) {
  const totalEligible = forecast.byDeck.reduce((n, d) => n + d.newlyEligibleCount, 0);
  const affectedDecks = forecast.byDeck.filter((d) => d.newlyEligibleCount > 0);
  const totalQueueDepth = forecast.byDeck.reduce((n, d) => n + d.pendingQueueDepth, 0);
  const lastJob = jobs.find((j) => j.status === "succeeded" && j.build_id);

  const deckRows = forecast.byDeck
    .map((d) => {
      const willShip = forecast.wouldShip.filter((o) => o.deckCode === d.deckCode && o.reason === "new card").length;
      const willQueue = forecast.wouldQueue.filter((o) => o.deckCode === d.deckCode).length;
      return `<tr>
        <td class="mono">${escapeHtml(d.deckCode)}</td>
        <td class="num">${d.newlyEligibleCount}</td>
        <td>${willShip ? `${willShip}× A` : "—"}</td>
        <td>${willQueue ? `${willQueue}× E (@11)` : "—"}</td>
        <td class="num">${d.pendingQueueDepth}</td>
      </tr>`;
    })
    .join("\n");

  const shipRows = forecast.wouldShip.map((o) => occurrenceRow(o, { withReason: true })).join("\n");
  const queueRows = forecast.wouldQueue
    .map(
      (o) => `<tr>
        <td class="mono">${escapeHtml(o.cardId)}</td>
        <td><span class="pill pill-neutral">${escapeHtml(o.letter)}</span></td>
        <td class="mono">${escapeHtml(o.deckCode)}</td>
        <td class="wrap">${escapeHtml(o.noteText || "")}</td>
        <td class="num">${o.remaining}</td>
      </tr>`
    )
    .join("\n");

  const batchPanels = batches
    .map((b) => {
      const contents = batchDetails.get(b.buildId) || [];
      const rows = contents.map((o) => occurrenceRow(o)).join("\n");
      return `<details class="json-toggle">
        <summary><span class="mono">${escapeHtml(b.buildId)}</span> — ${b.nonECount} new, ${b.eCount} drained · ${escapeHtml(new Date(b.createdAt).toISOString())} <span class="pill pill-ok" style="margin-left:8px;">published</span></summary>
        <div class="table-wrap" style="margin-top:6px;">
          <table>
            <thead><tr><th>Card</th><th>Side</th><th>Deck</th><th>Note</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="4">no occurrences recorded</td></tr>`}</tbody>
          </table>
        </div>
      </details>`;
    })
    .join("\n");

  return renderShell({
    title: "mjolnir / builder — forecast",
    activeHref: "/builder",
    body: `
<div class="page-head">
  <div><h2>Forecast &amp; publish</h2><div class="page-sub">What would ship if you published right now — no floor, every eligible note mints.</div></div>
  <button class="btn-primary" id="publish-now">Publish now</button>
</div>

<div class="stat-row">
  <div class="stat"><div class="label">Eligible notes</div><div class="value">${totalEligible}</div><div class="sub">across ${affectedDecks.length} deck${affectedDecks.length === 1 ? "" : "s"}</div></div>
  <div class="stat"><div class="label">Decks affected</div><div class="value">${affectedDecks.length}</div><div class="sub">${affectedDecks.map((d) => d.deckCode).join(", ") || "—"}</div></div>
  <div class="stat"><div class="label">Queue depth</div><div class="value">${totalQueueDepth}</div><div class="sub">E's waiting, all decks</div></div>
  <div class="stat"><div class="label">Last publish</div><div class="value" style="font-size:16px;">${lastJob ? escapeHtml(lastJob.build_id) : "—"}</div><div class="sub">${lastJob ? timeAgo(lastJob.finished_at) : "never"}</div></div>
</div>

<div class="panel">
  <div class="panel-head"><h3>Would publish this run — by deck</h3></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Deck</th><th>New notes</th><th>Will ship</th><th>Will queue</th><th>Queue depth now</th></tr></thead>
      <tbody>${deckRows || `<tr><td colspan="5">no eligible notes pulled</td></tr>`}</tbody>
    </table>
  </div>
</div>

<div class="panel">
  <div class="panel-head"><h3>Occurrences shipping in this batch</h3></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Card</th><th>Side</th><th>Deck</th><th>Note</th><th>Reason</th></tr></thead>
      <tbody>${shipRows || `<tr><td colspan="5">nothing would ship right now</td></tr>`}</tbody>
    </table>
  </div>
  <div class="inline-note" style="margin:0 18px 14px;">A new card's <strong>A</strong> ships the run it's minted. Its <strong>E</strong> doesn't — it ships whenever the queue drains, which can be many batches later. The two rarely land in the same batch, which is why this list is occurrences, not cards.</div>
</div>

<div class="panel">
  <div class="panel-head"><h3>Newly queued from this batch <span class="pill pill-neutral" style="margin-left:8px;">ships later</span></h3></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Card</th><th>Side</th><th>Deck</th><th>Note</th><th>Remaining</th></tr></thead>
      <tbody>${queueRows || `<tr><td colspan="5">nothing would be newly queued</td></tr>`}</tbody>
    </table>
  </div>
</div>

<div class="panel">
  <div class="panel-head"><h3>Past batches</h3></div>
  <div class="panel-pad">${batchPanels || "no publications yet"}</div>
</div>

<div id="result" class="inline-note"></div>
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
    if (res.ok) setTimeout(() => location.reload(), 800);
  } catch (err) {
    result.textContent = 'error: ' + err.message;
  } finally {
    btn.disabled = false;
  }
});
</script>`,
  });
}

// ---- Schedule ----

function renderSchedulePage(schedule) {
  const row = (kind, checked, inner) =>
    `<label class="radio-row ${checked ? "active" : ""}"><input type="radio" name="sched" value="${kind}" ${checked ? "checked" : ""}> ${inner}</label>`;

  return renderShell({
    title: "mjolnir / builder — schedule",
    activeHref: "/builder/schedule",
    body: `
<div class="page-head"><div><h2>Schedule</h2><div class="page-sub">Automatic publishing, independent of the button on the forecast page.</div></div></div>
<div class="panel panel-pad">
  <div class="schedule-options">
    ${row("daily", schedule.kind === "daily", `Every night at <input type="text" id="daily-at" value="${escapeHtml(schedule.kind === "daily" ? schedule.at : "02:00")}">`)}
    ${row("interval", schedule.kind === "interval", `Every <input type="text" id="interval-hours" value="${schedule.kind === "interval" ? schedule.hours : 6}"> hours`)}
    ${row("manual", schedule.kind === "manual", "Manual only — never run automatically")}
  </div>
  <div style="margin-top:16px;"><button class="btn-primary" id="save-btn">Save schedule</button></div>
  <div id="result" class="inline-note"></div>
</div>
<script>
document.querySelectorAll('input[name="sched"]').forEach((r) => r.addEventListener('change', () => {
  document.querySelectorAll('.radio-row').forEach((row) => row.classList.remove('active'));
  r.closest('.radio-row').classList.add('active');
}));
document.getElementById('save-btn').addEventListener('click', async () => {
  const kind = document.querySelector('input[name="sched"]:checked').value;
  let schedule;
  if (kind === 'daily') schedule = { kind: 'daily', at: document.getElementById('daily-at').value };
  else if (kind === 'interval') schedule = { kind: 'interval', hours: Number(document.getElementById('interval-hours').value) };
  else schedule = { kind: 'manual' };
  const res = await fetch('/builder/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(schedule) });
  document.getElementById('result').textContent = res.ok ? 'saved — takes effect on the next scheduling check, no restart needed' : 'error saving schedule';
});
</script>`,
  });
}

// ---- Run log ----

function renderLogsPage(jobs, selectedJob, logLines) {
  const rows = jobs
    .map((j) => {
      const dotClass = j.status === "succeeded" ? "ok" : j.status === "failed" ? "err" : "";
      const pillClass = j.status === "succeeded" ? "pill-ok" : j.status === "failed" ? "pill-err" : "pill-neutral";
      const title = j.status === "succeeded" ? `Published ${escapeHtml(j.build_id || "?")}` : j.status === "failed" ? "Failed" : "Running";
      return `<div class="tl-row">
        <div class="tl-time">${escapeHtml(new Date(j.requested_at).toISOString())}</div>
        <div class="tl-rail"><div class="tl-dot ${dotClass}"></div></div>
        <div class="tl-body">
          <div class="tl-title"><a href="/builder/logs?job=${j.id}">${title}</a> <span class="pill ${pillClass}">${escapeHtml(j.status)}</span></div>
          <div class="tl-detail">${j.error ? escapeHtml(j.error) : `job #${j.id}`}</div>
        </div>
      </div>`;
    })
    .join("\n");

  const logOutput = selectedJob
    ? `<div class="panel-head" style="border-top:1px solid var(--border-soft);"><h3>job #${selectedJob.id}${selectedJob.build_id ? ` — ${escapeHtml(selectedJob.build_id)}` : ""} — full output</h3></div>
    <div class="panel-pad">
      ${logLines.map((l) => `<div class="log-line">${escapeHtml(new Date(l.at).toISOString())} ${escapeHtml(l.line)}</div>`).join("\n") || "no log lines recorded for this job"}
    </div>`
    : "";

  return renderShell({
    title: "mjolnir / builder — run log",
    activeHref: "/builder/logs",
    body: `
<div class="page-head"><div><h2>Run log</h2></div></div>
<div class="panel">
  <div class="panel-head"><h3>Recent runs</h3></div>
  <div class="panel-pad"><div class="timeline">${rows || "no runs yet"}</div></div>
  ${logOutput}
</div>`,
  });
}

export function createServer(pool, config) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");

      // D-H6: checked before every route except /builder/login itself.
      // Namespaced under /builder (not a bare /login) because Caddy only
      // routes /builder/* to this service (task 7.4) — a path outside that
      // prefix would never be reachable through the real deploy at all.
      // Disabled entirely if OPERATOR_AUTH_TOKEN is unset (local/dev) — see
      // config.js and task 7.4 on why that's safe only before the Caddy
      // routes are uncommented.
      const LOGIN_PATH = "/builder/login";
      if (config.operatorAuthToken) {
        if (req.method === "GET" && url.pathname === LOGIN_PATH) {
          const next = url.searchParams.get("next") || "/builder";
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          return res.end(renderLoginPage({ next, loginPath: LOGIN_PATH }));
        }
        if (req.method === "POST" && url.pathname === LOGIN_PATH) {
          return handleLoginPost(req, res, config.operatorAuthToken, { loginPath: LOGIN_PATH });
        }
        if (!requireAuth(req, res, config.operatorAuthToken, { loginPath: LOGIN_PATH })) return;
      }

      if (req.method === "GET" && url.pathname === "/builder/api/forecast") {
        return sendJson(res, 200, await runForecast(pool, config));
      }
      if (req.method === "GET" && (url.pathname === "/builder" || url.pathname === "/builder/")) {
        const [forecast, jobs, batches] = await Promise.all([
          runForecast(pool, config),
          recentBuildJobs(pool),
          recentBatches(pool, 5),
        ]);
        const batchDetails = new Map();
        for (const b of batches) batchDetails.set(b.buildId, await occurrencesForBuild(pool, b.buildId, config.bundlePath));
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(renderForecastPage(forecast, jobs, batches, batchDetails));
      }
      // Task 4.15: triggers 4.2-4.12 immediately, independent of the
      // schedule — a no-op if nothing is newly eligible (runPublish handles it).
      if (req.method === "POST" && url.pathname === "/builder/api/publish") {
        const grammarRuleLookup = await buildGrammarRuleLookup({ baseUrl: config.stabburBaseUrl, authToken: config.stabburAuthToken });
        const result = await runPublish(pool, { ...config, grammarRuleLookup, log: makeDbLogger(pool) });
        return sendJson(res, 200, result);
      }

      if (req.method === "GET" && url.pathname === "/builder/schedule") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(renderSchedulePage(await getSchedule(pool)));
      }
      if (req.method === "POST" && url.pathname === "/builder/api/schedule") {
        const schedule = await readJson(req);
        await setSchedule(pool, schedule);
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === "GET" && url.pathname === "/builder/logs") {
        const jobId = url.searchParams.get("job");
        const [jobs, selectedJob] = await Promise.all([recentBuildJobs(pool), jobId ? getBuildJob(pool, Number(jobId)) : null]);
        const logLines = selectedJob ? await jobLogLines(pool, selectedJob.id) : [];
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(renderLogsPage(jobs, selectedJob, logLines));
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: err.message });
    }
  });
}
