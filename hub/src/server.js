import http from "node:http";
import { listPublications, updateLabel, deleteBuild, readCurrent } from "./publications.js";
import { verifyBundle, submitBundle, setCurrent } from "./ota.js";
import { cardsList, stripHtml } from "./cards.js";
import { DECK_ALLOCATION } from "./decks.js";
import { renderShell, escapeHtml } from "./layout.js";
import { requireAuth, renderLoginPage, handleLoginPost } from "./auth.js";

const MAX_BODY_BYTES = 67108864; // D48 — same ceiling the publish guards enforce anyway

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(data) });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("request body exceeds 64 MiB"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const body = await readBody(req);
  return body.length ? JSON.parse(body.toString("utf8")) : {};
}

// ---- Publish history ----

function renderHistoryPage(publications, current) {
  const rows = publications
    .map((p) => {
      const isCurrent = current && current.buildId === p.build_id;
      return `<tr>
        <td>${isCurrent ? '<span class="pill pill-ok">● current</span> ' : ""}<span class="mono">${escapeHtml(p.build_id)}</span></td>
        <td class="wrap">${escapeHtml(p.label || "")}</td>
        <td class="mono">${escapeHtml(p.base_version)}</td>
        <td class="num">${p.patch_rev}</td>
        <td class="num">${p.data_rev}</td>
        <td class="num">${p.card_count}</td>
        <td class="mono">${escapeHtml(p.bundle_sha.slice(0, 4))}…${escapeHtml(p.bundle_sha.slice(-4))}</td>
        <td class="mono">${escapeHtml(new Date(p.created_at).toISOString())}</td>
        <td>
          <button class="btn-ghost set-current-btn" data-build-id="${escapeHtml(p.build_id)}" ${isCurrent ? "disabled" : ""}>set current</button>
          <button class="btn-ghost edit-label-btn" data-build-id="${escapeHtml(p.build_id)}">edit label</button>
          <button class="btn-ghost btn-danger delete-build-btn" data-build-id="${escapeHtml(p.build_id)}">delete</button>
        </td>
      </tr>`;
    })
    .join("\n");

  return renderShell({
    title: "mjolnir / hub — publish history",
    activeHref: "/mjolnir",
    body: `
<div class="page-head"><div><h2>Publish history</h2></div></div>
<div class="panel">
  <div class="table-wrap">
    <table>
      <thead><tr><th>Build</th><th>Label</th><th>Base</th><th>Logic</th><th>Data</th><th>Cards</th><th>sha256</th><th>Published</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="9">no publications yet</td></tr>`}</tbody>
    </table>
  </div>
</div>
<div class="inline-note">"set current" repoints <code>current.json</code> at that build (no shell command). "delete" is blocked while a build shipped any occurrence (D93) or is the live current build.</div>
<script>
document.querySelectorAll('.set-current-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const buildId = btn.dataset.buildId;
    const res = await fetch('/mjolnir/ota/api/set-current', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buildId }) });
    if (res.ok) location.reload(); else alert('error: ' + (await res.json()).error);
  });
});
document.querySelectorAll('.edit-label-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const buildId = btn.dataset.buildId;
    const label = prompt('New label for ' + buildId + ':');
    if (label === null) return;
    const res = await fetch('/mjolnir/ota/api/label', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buildId, label }) });
    if (res.ok) location.reload(); else alert('error: ' + (await res.json()).error);
  });
});
document.querySelectorAll('.delete-build-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const buildId = btn.dataset.buildId;
    if (!confirm('Delete ' + buildId + ' from history? This does not affect the device unless it is the current build (blocked if so).')) return;
    const res = await fetch('/mjolnir/ota/api/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buildId }) });
    if (res.ok) location.reload(); else alert('error: ' + (await res.json()).error);
  });
});
</script>`,
  });
}

// ---- Cards ----

function occurrenceBadge(side) {
  if (side.status === "shipped") return `<span class="pill pill-ok">${escapeHtml(side.letter)} · ${escapeHtml(side.buildId)}</span>`;
  return `<span class="pill pill-warn">${escapeHtml(side.letter)} · ${side.remaining} to go</span>`;
}

function renderCardsPage(cards, { search, deckCode, statusFilter }, stabburUiBase) {
  const byDeck = new Map();
  for (const card of cards) {
    if (!byDeck.has(card.deckCode)) byDeck.set(card.deckCode, []);
    byDeck.get(card.deckCode).push(card);
  }

  const panels = [...byDeck.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([deckCode, deckCards]) => {
      const hasGrammar = deckCards.some((c) => c.grammarRuleId);
      const rows = deckCards
        .map((c) => {
          const noteLink = stabburUiBase
            ? `<a href="${escapeHtml(stabburUiBase)}/ui#/notes/${escapeHtml(c.noteId)}" target="_blank" rel="noopener">${escapeHtml(stripHtml(c.N) || c.id)} ↗</a>`
            : escapeHtml(stripHtml(c.N) || c.id);
          const ruleLink =
            hasGrammar && c.grammarRuleId
              ? `<td>${stabburUiBase ? `<a href="${escapeHtml(stabburUiBase)}/ui#/grammar/${escapeHtml(c.grammarRuleId)}" target="_blank" rel="noopener">rule ↗</a>` : escapeHtml(c.grammarRuleId)}</td>`
              : hasGrammar
                ? "<td></td>"
                : "";
          return `<tr>
            <td class="mono">${escapeHtml(c.id)}</td>
            <td class="wrap">${escapeHtml(stripHtml(c.N))}</td>
            <td class="wrap">${escapeHtml(stripHtml(c.E))}</td>
            <td>${c.sides.map(occurrenceBadge).join(" ")}</td>
            <td>${noteLink}</td>
            ${ruleLink}
          </tr>`;
        })
        .join("\n");
      return `<div class="panel">
        <div class="panel-head"><h3>${escapeHtml(deckCode)} — ${escapeHtml(deckCards[0].deckTitle)} <span class="pill pill-neutral" style="margin-left:8px;">${deckCards.length} cards</span></h3></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Card</th><th>Front (N)</th><th>Back (E)</th><th>Occurrences</th><th>Source note</th>${hasGrammar ? "<th>Grammar rule</th>" : ""}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
    })
    .join("\n");

  const deckOptions = DECK_ALLOCATION.map(
    (d) => `<option value="${escapeHtml(d.code)}" ${d.code === deckCode ? "selected" : ""}>${escapeHtml(d.code)}</option>`
  ).join("");

  return renderShell({
    title: "mjolnir / hub — cards",
    activeHref: "/mjolnir/cards",
    body: `
<div class="page-head"><div><h2>Cards</h2><div class="page-sub">Every card ever minted — the device-side counterpart to stabbur's Notes list.</div></div></div>
<form class="toolbar" method="GET" action="/mjolnir/cards">
  <input class="search-input" type="search" name="q" value="${escapeHtml(search)}" placeholder="Search card content…">
  <select name="deck"><option value="">Deck: all</option>${deckOptions}</select>
  <select name="status">
    <option value="">Occurrence status: all</option>
    <option value="shipped" ${statusFilter === "shipped" ? "selected" : ""}>fully shipped</option>
    <option value="pending" ${statusFilter === "pending" ? "selected" : ""}>a side pending</option>
  </select>
  <button type="submit">Filter</button>
</form>
${panels || `<div class="panel panel-pad">no cards match this filter</div>`}
${!stabburUiBase ? `<div class="inline-note">STABBUR_UI_BASE is not configured — note/grammar-rule links are disabled, but the list above is unaffected.</div>` : ""}`,
  });
}

// ---- OTA console ----

function renderOtaPage() {
  return renderShell({
    title: "mjolnir / hub — submit bundle",
    activeHref: "/mjolnir/ota",
    body: `
<div class="page-head"><div><h2>Submit bundle</h2><div class="page-sub">Replaces running <code>ota-publish.sh</code> by hand.</div></div></div>
<div class="panel panel-pad">
  <div id="dropzone" class="dropzone"><div class="icon">📦</div>Drop <strong>index.android.bundle</strong> here, or <input type="file" id="file-input" style="display:none">click to choose a file</div>
  <div class="field-row" style="margin-top:16px;">
    <div class="field"><label>Build id</label><input type="text" id="build-id" placeholder="b000013"></div>
    <div class="field"><label>Label</label><input type="text" id="label" placeholder="base 1.5.12 · logic 3 · data 13"></div>
  </div>
  <div class="panel" style="margin-top:16px; background:var(--bg-sunken);">
    <div class="panel-pad" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-size:13px; font-weight:600;">Verification</div>
        <div class="inline-note" id="verify-note" style="margin-top:4px;">Drop a file to verify — size, sha256, magic-prefix, buildId reuse.</div>
      </div>
      <span class="pill pill-neutral" id="verify-pill">no file yet</span>
    </div>
  </div>
  <div style="display:flex; gap:8px; margin-top:16px;">
    <button class="btn-primary" id="publish-btn" disabled>Publish</button>
  </div>
  <div id="result" class="inline-note"></div>
</div>
<script>
let fileBytes = null;
const dz = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const buildIdInput = document.getElementById('build-id');
const verifyPill = document.getElementById('verify-pill');
const verifyNote = document.getElementById('verify-note');
const publishBtn = document.getElementById('publish-btn');
const result = document.getElementById('result');

dz.addEventListener('click', () => fileInput.click());
dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
dz.addEventListener('drop', (e) => {
  e.preventDefault();
  dz.classList.remove('dragover');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

async function handleFile(file) {
  fileBytes = await file.arrayBuffer();
  if (!buildIdInput.value) buildIdInput.value = file.name.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 20) || 'b' + Date.now();
  await runVerify();
}

async function runVerify() {
  if (!fileBytes) return;
  verifyPill.textContent = 'verifying…';
  verifyPill.className = 'pill pill-neutral';
  const res = await fetch('/mjolnir/ota/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-Build-Id': buildIdInput.value },
    body: fileBytes,
  });
  const body = await res.json();
  if (body.ok) {
    verifyPill.textContent = '✓ ' + body.checks.length + ' checks passed';
    verifyPill.className = 'pill pill-ok';
    publishBtn.disabled = false;
  } else {
    const failed = body.checks.filter((c) => !c.ok).map((c) => c.check + ': ' + c.detail).join('; ');
    verifyPill.textContent = '✗ failed';
    verifyPill.className = 'pill pill-err';
    verifyNote.textContent = failed;
    publishBtn.disabled = true;
  }
}
buildIdInput.addEventListener('change', runVerify);

publishBtn.addEventListener('click', async () => {
  publishBtn.disabled = true;
  result.textContent = 'publishing…';
  try {
    const res = await fetch('/mjolnir/ota/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Build-Id': buildIdInput.value, 'X-Label': document.getElementById('label').value },
      body: fileBytes,
    });
    const body = await res.json();
    result.textContent = res.ok ? ('published ' + body.buildId + ' — sha256 ' + body.sha256) : ('error: ' + body.error);
  } catch (err) {
    result.textContent = 'error: ' + err.message;
  } finally {
    publishBtn.disabled = false;
  }
});
</script>`,
  });
}

export function createServer(pool, config) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");

      // D-H6: checked before every route except /mjolnir/login itself.
      // Namespaced under /mjolnir (not a bare /login) because Caddy only
      // routes /mjolnir/* to this service (task 7.4) — a path outside that
      // prefix would never be reachable through the real deploy at all.
      // Disabled entirely if OPERATOR_AUTH_TOKEN is unset (local/dev) — see
      // config.js and task 7.4 on why that's safe only before the Caddy
      // routes are uncommented.
      const LOGIN_PATH = "/mjolnir/login";
      if (config.operatorAuthToken) {
        if (req.method === "GET" && url.pathname === LOGIN_PATH) {
          const next = url.searchParams.get("next") || "/mjolnir";
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          return res.end(renderLoginPage({ next, loginPath: LOGIN_PATH }));
        }
        if (req.method === "POST" && url.pathname === LOGIN_PATH) {
          return handleLoginPost(req, res, config.operatorAuthToken, { loginPath: LOGIN_PATH });
        }
        if (!requireAuth(req, res, config.operatorAuthToken, { loginPath: LOGIN_PATH })) return;
      }

      if (req.method === "GET" && url.pathname === "/mjolnir/api/publications") {
        return sendJson(res, 200, await listPublications());
      }
      if (req.method === "GET" && (url.pathname === "/mjolnir" || url.pathname === "/mjolnir/")) {
        const [publications, current] = [await listPublications(), readCurrent(config.dataDir)];
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(renderHistoryPage(publications, current));
      }

      if (req.method === "GET" && url.pathname === "/mjolnir/cards") {
        const search = url.searchParams.get("q") || "";
        const deckCode = url.searchParams.get("deck") || "";
        const statusFilter = url.searchParams.get("status") || "";
        const cards = await cardsList(pool, config.bundlePath, { search, deckCode, statusFilter });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(renderCardsPage(cards, { search, deckCode, statusFilter }, config.stabburUiBase));
      }

      if (req.method === "GET" && url.pathname === "/mjolnir/ota") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(renderOtaPage());
      }
      if (req.method === "POST" && url.pathname === "/mjolnir/ota/verify") {
        const bytes = await readBody(req);
        const buildId = req.headers["x-build-id"] || "";
        return sendJson(res, 200, verifyBundle(bytes, buildId, { dataDir: config.dataDir }));
      }
      if (req.method === "POST" && url.pathname === "/mjolnir/ota/publish") {
        const bytes = await readBody(req);
        const buildId = req.headers["x-build-id"] || "";
        const label = req.headers["x-label"] || buildId;
        const result = await submitBundle(bytes, buildId, label, { dataDir: config.dataDir, publicBase: config.publicBase });
        return sendJson(res, 200, result);
      }
      if (req.method === "POST" && url.pathname === "/mjolnir/ota/api/set-current") {
        const { buildId } = await readJson(req);
        await setCurrent(buildId, { dataDir: config.dataDir, publicBase: config.publicBase });
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === "POST" && url.pathname === "/mjolnir/ota/api/label") {
        const { buildId, label } = await readJson(req);
        await updateLabel(buildId, label);
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === "POST" && url.pathname === "/mjolnir/ota/api/delete") {
        const { buildId } = await readJson(req);
        await deleteBuild(buildId, { dataDir: config.dataDir });
        return sendJson(res, 200, { ok: true });
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: err.message });
    }
  });
}
