import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { listPublications, updateLabel, deleteBuild, readCurrent } from "./publications.js";
import { verifyBundle, verifyLogicBundleBytes, submitBundle, activateLogicBundle, forcePublish, setCurrent } from "./ota.js";
import { findBakedBaseVersion, findBakedPatchRev } from "../../tool/src/otaPublish.js";
import { list as listLogicBundles } from "./logicBundles.js";
import { cardsList, stripHtml, getCardSlot } from "./cards.js";
import { get as getCardContent } from "./cardContent.js";
import { DECK_ALLOCATION } from "./decks.js";
import { renderShell, escapeHtml } from "./layout.js";
import { requireAuth, renderLoginPage, handleLoginPost } from "./auth.js";
import { createRequestHandler as createWorkbenchHandler } from "../../src/commands/ui.js";

const WORKBENCH_MOUNT = "/mjolnir/workbench";

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

// D-C9: every page route reads this from its own query string and threads
// it into `renderShell` — true only when the unified console's iframe
// requested it.
function isEmbed(url) {
  return url.searchParams.get("embed") === "1";
}

// D-C7: a small, local, filesystem-safe slug — lowercase, non-alphanumerics
// collapsed to a single hyphen, trimmed to a sane length. No dependency
// needed for something this constrained.
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// ---- Unified console ----

// D-C9: four iframes over already-working routes (`embed=1` strips each
// one's own top-bar/rail so only the console's own tab bar shows chrome).
// Not a merge of hub's and builder's backend processes — each iframe is a
// normal same-origin request to whichever service already serves that path
// (Caddy routes `/builder/*` and `/mjolnir/*` to their own containers
// exactly as before; this page just frames both from hub).
const CONSOLE_SECTIONS = [
  { key: "cards", label: "Cards", src: "/mjolnir/cards?embed=1" },
  { key: "builder", label: "Builder", src: "/builder?embed=1" },
  { key: "ota", label: "OTA", src: "/mjolnir/ota?embed=1" },
  { key: "tools", label: "Tools", src: "/mjolnir/workbench/?embed=1" },
];

function renderConsolePage() {
  const tabs = CONSOLE_SECTIONS.map(
    (s, i) => `<button type="button" class="console-tab ${i === 0 ? "active" : ""}" data-section="${s.key}">${escapeHtml(s.label)}</button>`
  ).join("\n");
  const frames = CONSOLE_SECTIONS.map(
    (s, i) => `<iframe class="console-frame ${i === 0 ? "active" : ""}" data-section="${s.key}" src="${escapeHtml(s.src)}"></iframe>`
  ).join("\n");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>mjølnir · console</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; font-family: ui-sans-serif, system-ui, sans-serif; background: #14171c; }
  .console-tabs { display: flex; gap: 4px; padding: 10px 14px; background: #0f1216; border-bottom: 1px solid #2a3039; }
  .console-tab { font: inherit; font-weight: 600; font-size: 13px; padding: 7px 16px; border-radius: 6px; border: 1px solid transparent; background: transparent; color: #8b94a3; cursor: pointer; }
  .console-tab:hover { background: #1b1f26; color: #e8e6e1; }
  .console-tab.active { background: #c6703f26; color: #f2b688; }
  .console-frames { position: relative; height: calc(100vh - 45px); }
  .console-frame { position: absolute; inset: 0; width: 100%; height: 100%; border: none; display: none; background: #14171c; }
  .console-frame.active { display: block; }
</style>
</head>
<body>
<div class="console-tabs">${tabs}</div>
<div class="console-frames">${frames}</div>
<script>
document.querySelectorAll('.console-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const section = btn.dataset.section;
    document.querySelectorAll('.console-tab').forEach((b) => b.classList.toggle('active', b.dataset.section === section));
    document.querySelectorAll('.console-frame').forEach((f) => f.classList.toggle('active', f.dataset.section === section));
  });
});
</script>
</body>
</html>`;
}

// ---- Publish history ----

function renderHistoryPage(publications, current, config, embed = false) {
  const rows = publications
    .map((p) => {
      const isCurrent = current && current.buildId === p.build_id;
      const bundlePath = path.join(config.dataDir, "ota", "bundle", `${p.build_id}.js`);
      const inspectHref = `${WORKBENCH_MOUNT}/?open=${encodeURIComponent(bundlePath)}`;
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
          <a class="btn-ghost" href="/mjolnir/ota/download/${encodeURIComponent(p.build_id)}">download</a>
          <a class="btn-ghost" href="${inspectHref}" onclick="return openInWorkbench(this.href)">inspect →</a>
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
    embed,
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
<div class="inline-note">"download" streams that build's exact published bytes, named from its label. "inspect" opens it in the bundle workbench — repeated inspects reuse the same workbench window/tab rather than piling up new ones. "set current" repoints <code>current.json</code> at that build (no shell command). "delete" is blocked while a build shipped any occurrence (D93) or is the live current build.</div>
<script>
// D-C6: a named window is reused/focused/navigated by every subsequent
// "open in workbench" link, instead of each click opening yet another tab.
function openInWorkbench(href) {
  window.open(href, 'mjolnir-workbench');
  return false;
}
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

// ---- Catalogue ----

// D-C5: a single browsable list of everything there is to inspect — every
// OTA build ever published, every logic bundle ever submitted — each one
// click away from opening in the workbench. The workbench itself has no
// database access (by design), so this is hub-rendered, not fetched by the
// workbench; it's the same `?open=<path>` link every other inspect action
// already uses, just gathered in one place instead of scattered per page.
function renderCataloguePage(publications, logicBundles, config, embed = false) {
  const activeLogicBundleId = logicBundles.find((b) => b.active)?.id;

  const buildRows = publications
    .map((p) => {
      const bundlePath = path.join(config.dataDir, "ota", "bundle", `${p.build_id}.js`);
      const href = `${WORKBENCH_MOUNT}/?open=${encodeURIComponent(bundlePath)}`;
      return `<tr>
        <td class="mono">${escapeHtml(p.build_id)}</td>
        <td class="wrap">${escapeHtml(p.label || "")}</td>
        <td class="mono">${escapeHtml(new Date(p.created_at).toISOString())}</td>
        <td><a class="btn-ghost" href="${href}" onclick="return openInWorkbench(this.href)">inspect →</a></td>
      </tr>`;
    })
    .join("\n");

  const logicRows = logicBundles
    .map((b) => {
      const href = `${WORKBENCH_MOUNT}/?open=${encodeURIComponent(b.file_path)}`;
      return `<tr>
        <td>${b.id === activeLogicBundleId ? '<span class="pill pill-ok">● active</span>' : ""}</td>
        <td class="mono">#${b.id}</td>
        <td class="mono">${escapeHtml(b.base_version)}</td>
        <td class="wrap">${escapeHtml(b.label || "")}</td>
        <td><a class="btn-ghost" href="${href}" onclick="return openInWorkbench(this.href)">inspect →</a></td>
      </tr>`;
    })
    .join("\n");

  return renderShell({
    title: "mjolnir / hub — catalogue",
    activeHref: "/mjolnir/catalogue",
    embed,
    body: `
<div class="page-head"><div><h2>Catalogue</h2><div class="page-sub">Every OTA build and every logic bundle, one click away from the workbench.</div></div></div>

<div class="panel">
  <div class="panel-head"><h3>OTA builds</h3></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Build</th><th>Label</th><th>Published</th><th></th></tr></thead>
      <tbody>${buildRows || `<tr><td colspan="4">no publications yet</td></tr>`}</tbody>
    </table>
  </div>
</div>

<div class="panel">
  <div class="panel-head"><h3>Logic bundles</h3></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th></th><th>ID</th><th>Base</th><th>Label</th><th></th></tr></thead>
      <tbody>${logicRows || `<tr><td colspan="5">no logic bundles yet</td></tr>`}</tbody>
    </table>
  </div>
</div>
<script>
function openInWorkbench(href) {
  window.open(href, 'mjolnir-workbench');
  return false;
}
</script>`,
  });
}

// ---- Cards ----

function occurrenceBadge(side) {
  if (side.status === "shipped") return `<span class="pill pill-ok">${escapeHtml(side.letter)} · ${escapeHtml(side.buildId)}</span>`;
  return `<span class="pill pill-warn">${escapeHtml(side.letter)} · ${side.remaining} to go</span>`;
}

// D-C8: colors/fonts extracted directly from the real stock app bundle
// (`base/smali.mjolnir.merged/assets/index.android.bundle`'s own theme/
// class-style map), not invented — light theme only (see design.md's
// recorded non-goal on dark-mode fidelity). Poppins falls back to the
// browser's default sans-serif when unavailable; close enough for "does
// this look right," not pixel-perfect (an explicit non-goal).
const CARD_PREVIEW_STYLE = `
body { margin: 0; padding: 24px; background: #f0f0f0; font-family: system-ui, sans-serif; }
.back-link { display: inline-block; margin-bottom: 16px; color: #246BFD; text-decoration: none; font-size: 13px; }
.faces { display: flex; gap: 20px; flex-wrap: wrap; }
.face-wrap { flex: 1; min-width: 220px; max-width: 320px; }
.face-label { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #666; margin-bottom: 6px; font-family: system-ui, sans-serif; }
.card-face {
  font-family: 'Poppins', system-ui, sans-serif;
  color: #16215B;
  background: #fff;
  text-align: center;
  border-radius: 10px;
  padding: 24px 18px;
  min-height: 120px;
  box-shadow: 0 1px 4px rgba(0,0,0,.12);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}
.card-face b { font-family: 'Poppins', system-ui, sans-serif; font-weight: 700; color: #246BFD; }
.card-face .teal { color: #00A4BF; }
.card-face .red { color: red; }
.card-face .green { color: #5DD8D0; }
.card-face .left { text-align: left; }
.card-face i, .card-face .italic { font-style: italic; }
.card-face:empty::after { content: "(empty)"; color: #bbb; font-style: italic; }
.audio-badge { margin-top: 10px; font-size: 20px; }
.audio-badge.static { opacity: .5; cursor: default; }
audio { width: 100%; margin-top: 8px; }
`;

function cardFaceHtml(letter, html, audioLetter, hasAudioFile, cardId) {
  const isAudioFace = letter === audioLetter;
  const audioHtml = !isAudioFace
    ? ""
    : hasAudioFile
      ? `<audio controls src="/mjolnir/cards/${encodeURIComponent(cardId)}/audio"></audio>`
      : `<div class="audio-badge static" title="this face carries the card's audio, but no clip is on disk">🔊</div>`;
  return `<div class="face-wrap">
    <div class="face-label">${letter === "N" ? "Front (N)" : letter === "E" ? "Back (E)" : "Extra (X)"}${isAudioFace ? " · 🔊 audio" : ""}</div>
    <div class="card-face">${html || ""}</div>
    ${audioHtml}
  </div>`;
}

function renderCardPreviewPage({ cardId, deckCode, deckTitle, content, hasAudioFile }) {
  const faces = ["N", "E", "X"].map((letter) => cardFaceHtml(letter, content[letter], content.A, hasAudioFile, cardId)).join("\n");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(cardId)} — card preview</title>
<style>${CARD_PREVIEW_STYLE}</style>
</head>
<body>
<a class="back-link" href="/mjolnir/cards">← back to cards</a>
<h2 style="font-family: system-ui, sans-serif;">${escapeHtml(cardId)} <span style="font-weight:400; color:#888;">— ${escapeHtml(deckCode)} · ${escapeHtml(deckTitle)}</span></h2>
<div class="faces">${faces}</div>
</body>
</html>`;
}

function renderCardsPage(cards, { search, deckCode, statusFilter }, stabburUiBase, embed = false) {
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
            ? `<a href="${escapeHtml(stabburUiBase)}#/notes/${escapeHtml(c.noteId)}" target="_blank" rel="noopener">${escapeHtml(stripHtml(c.N) || c.id)} ↗</a>`
            : escapeHtml(stripHtml(c.N) || c.id);
          const ruleLink =
            hasGrammar && c.grammarRuleId
              ? `<td>${stabburUiBase ? `<a href="${escapeHtml(stabburUiBase)}#/grammar/${escapeHtml(c.grammarRuleId)}" target="_blank" rel="noopener">rule ↗</a>` : escapeHtml(c.grammarRuleId)}</td>`
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
            <td><a class="btn-ghost" href="/mjolnir/cards/${encodeURIComponent(c.id)}/preview" target="_blank" rel="noopener">👁 preview</a></td>
          </tr>`;
        })
        .join("\n");
      return `<div class="panel">
        <div class="panel-head"><h3>${escapeHtml(deckCode)} — ${escapeHtml(deckCards[0].deckTitle)} <span class="pill pill-neutral" style="margin-left:8px;">${deckCards.length} cards</span></h3></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Card</th><th>Front (N)</th><th>Back (E)</th><th>Occurrences</th><th>Source note</th>${hasGrammar ? "<th>Grammar rule</th>" : ""}<th></th></tr></thead>
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
    embed,
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

function logicBundleRow(b, isActive) {
  const inspectHref = `${WORKBENCH_MOUNT}/?open=${encodeURIComponent(b.file_path)}`;
  return `<tr>
    <td>${isActive ? '<span class="pill pill-ok">● active</span>' : ""}</td>
    <td class="mono">#${b.id}</td>
    <td class="mono">${escapeHtml(b.base_version)}</td>
    <td class="num">${b.patch_rev}</td>
    <td class="wrap">${escapeHtml(b.label || "")}</td>
    <td class="mono">${escapeHtml(b.bundle_sha.slice(0, 4))}…${escapeHtml(b.bundle_sha.slice(-4))}</td>
    <td class="mono">${escapeHtml(new Date(b.created_at).toISOString())}</td>
    <td>
      <a class="btn-ghost" href="${inspectHref}" onclick="return openInWorkbench(this.href)">inspect →</a>
      <button class="btn-ghost activate-logic-bundle-btn" data-id="${b.id}" ${isActive ? "disabled" : ""}>activate</button>
    </td>
  </tr>`;
}

function renderOtaPage(logicBundles, embed = false) {
  const activeId = logicBundles.find((b) => b.active)?.id;
  const rows = logicBundles.map((b) => logicBundleRow(b, b.id === activeId)).join("\n");

  return renderShell({
    title: "mjolnir / hub — submit bundle",
    activeHref: "/mjolnir/ota",
    embed,
    body: `
<div class="page-head"><div><h2>Submit bundle</h2><div class="page-sub">Submitting creates a <code>logic_bundles</code> entry — it does not touch <code>current.json</code> or run <code>builder</code> by itself. Activate the one you want <code>builder</code>'s next publish to build onto.</div></div></div>

<div class="panel panel-pad">
  <div id="dropzone" class="dropzone"><div class="icon">📦</div>Drop an assembled <strong>base+patch</strong> bundle here, or <input type="file" id="file-input" style="display:none">click to choose a file</div>

  <div class="panel" style="margin-top:16px; background:var(--bg-sunken);">
    <div class="panel-pad">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="font-size:13px; font-weight:600;">Verification</div>
        <span class="pill pill-neutral" id="verify-pill">no file yet</span>
      </div>
      <div class="inline-note" id="verify-note" style="margin-top:4px;">Drop a file to verify — size and magic-prefix.</div>
    </div>
  </div>

  <div class="field-row" style="margin-top:16px;" id="version-fields" hidden>
    <div class="field"><label>Base version</label><input type="text" id="base-version" placeholder="1.5.12"></div>
    <div class="field"><label>Patch rev</label><input type="number" id="patch-rev" placeholder="3"></div>
  </div>
  <div class="inline-note" id="baked-note"></div>

  <div class="field" style="margin-top:16px;"><label>Label (optional)</label><input type="text" id="label" placeholder="e.g. adds verb-conjugation patch"></div>

  <div style="display:flex; gap:8px; margin-top:16px;">
    <button class="btn-primary" id="submit-btn" disabled>Create logic bundle</button>
  </div>
  <div id="submit-result" class="inline-note"></div>
</div>

<div class="panel">
  <div class="panel-head"><h3>Logic bundles</h3></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th></th><th>ID</th><th>Base</th><th>Patch</th><th>Label</th><th>sha256</th><th>Submitted</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="8">no logic bundles submitted yet — drop one above to get started</td></tr>`}</tbody>
    </table>
  </div>
</div>
<div class="inline-note">"activate" is what <code>builder</code>'s <em>next</em> run will build onto — it does not publish anything by itself.</div>

<div class="panel" style="margin-top:28px; border-color: var(--err);">
  <div class="panel-head"><h3 style="color: var(--err);">⚠ Force publish to current.json now</h3></div>
  <div class="panel-pad">
    <div class="inline-note" style="margin-bottom:12px;">Emergency/manual override only. Publishes a raw bundle straight to <code>current.json</code> under a <code>buildId</code> you choose — bypasses <code>logic_bundles</code> activation and never triggers <code>builder</code>. A record is still kept in the history above (inactive), for provenance.</div>
    <div id="force-dropzone" class="dropzone"><div class="icon">⚠</div>Drop a bundle to force-publish, or <input type="file" id="force-file-input" style="display:none">click to choose a file</div>
    <div class="field-row" style="margin-top:16px;">
      <div class="field"><label>Build id</label><input type="text" id="force-build-id" placeholder="b000013"></div>
      <div class="field"><label>Label</label><input type="text" id="force-label" placeholder="emergency hotfix"></div>
    </div>
    <div class="panel" style="margin-top:16px; background:var(--bg-sunken);">
      <div class="panel-pad" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:13px; font-weight:600;">Verification</div>
          <div class="inline-note" id="force-verify-note" style="margin-top:4px;">Drop a file to verify — size, sha256, magic-prefix, buildId reuse, companion match.</div>
        </div>
        <span class="pill pill-neutral" id="force-verify-pill">no file yet</span>
      </div>
    </div>
    <div style="display:flex; gap:8px; margin-top:16px;">
      <button class="btn-primary btn-danger" style="background: var(--err); border-color: var(--err); color: #fff;" id="force-publish-btn" disabled>Force publish now</button>
    </div>
    <div id="force-result" class="inline-note"></div>
  </div>
</div>

<script>
function openInWorkbench(href) {
  window.open(href, 'mjolnir-workbench');
  return false;
}
document.querySelectorAll('.activate-logic-bundle-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const id = btn.dataset.id;
    const res = await fetch('/mjolnir/ota/logic-bundles/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (res.ok) location.reload(); else alert('error: ' + (await res.json()).error);
  });
});

// ---- Submit (default) flow ----
let fileBytes = null;
let bakedBaseVersion = null;
let bakedPatchRev = null;
const dz = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const verifyPill = document.getElementById('verify-pill');
const verifyNote = document.getElementById('verify-note');
const versionFields = document.getElementById('version-fields');
const bakedNote = document.getElementById('baked-note');
const submitBtn = document.getElementById('submit-btn');
const submitResult = document.getElementById('submit-result');

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
  verifyPill.textContent = 'verifying…';
  verifyPill.className = 'pill pill-neutral';
  const res = await fetch('/mjolnir/ota/verify-logic', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: fileBytes });
  const body = await res.json();
  if (body.ok) {
    verifyPill.textContent = '✓ ' + body.checks.length + ' checks passed';
    verifyPill.className = 'pill pill-ok';
  } else {
    verifyPill.textContent = '✗ failed';
    verifyPill.className = 'pill pill-err';
    verifyNote.textContent = body.checks.filter((c) => !c.ok).map((c) => c.check + ': ' + c.detail).join('; ');
    submitBtn.disabled = true;
    return;
  }

  bakedBaseVersion = body.baseVersion;
  bakedPatchRev = body.patchRev;
  if (bakedBaseVersion && bakedPatchRev !== null) {
    versionFields.hidden = true;
    bakedNote.textContent = 'baked base_version ' + bakedBaseVersion + ' · patch_rev ' + bakedPatchRev + ' — read automatically, nothing to type.';
  } else {
    versionFields.hidden = false;
    bakedNote.textContent = 'no baked version constants found in this bundle — enter base_version/patch_rev manually below.';
  }
  submitBtn.disabled = false;
}

submitBtn.addEventListener('click', async () => {
  submitBtn.disabled = true;
  submitResult.textContent = 'creating logic bundle…';
  try {
    const res = await fetch('/mjolnir/ota/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Label': document.getElementById('label').value,
        'X-Base-Version': document.getElementById('base-version').value,
        'X-Patch-Rev': document.getElementById('patch-rev').value,
      },
      body: fileBytes,
    });
    const body = await res.json();
    if (res.ok) {
      submitResult.textContent = 'created logic bundle #' + body.id + ' (base ' + body.base_version + ' · patch ' + body.patch_rev + ') — activate it above when ready.';
      setTimeout(() => location.reload(), 1200);
    } else {
      submitResult.textContent = 'error: ' + body.error;
    }
  } catch (err) {
    submitResult.textContent = 'error: ' + err.message;
  } finally {
    submitBtn.disabled = false;
  }
});

// ---- Force-publish flow ----
let forceFileBytes = null;
const forceDz = document.getElementById('force-dropzone');
const forceFileInput = document.getElementById('force-file-input');
const forceBuildIdInput = document.getElementById('force-build-id');
const forceVerifyPill = document.getElementById('force-verify-pill');
const forceVerifyNote = document.getElementById('force-verify-note');
const forcePublishBtn = document.getElementById('force-publish-btn');
const forceResult = document.getElementById('force-result');

forceDz.addEventListener('click', () => forceFileInput.click());
forceDz.addEventListener('dragover', (e) => { e.preventDefault(); forceDz.classList.add('dragover'); });
forceDz.addEventListener('dragleave', () => forceDz.classList.remove('dragover'));
forceDz.addEventListener('drop', (e) => {
  e.preventDefault();
  forceDz.classList.remove('dragover');
  if (e.dataTransfer.files[0]) handleForceFile(e.dataTransfer.files[0]);
});
forceFileInput.addEventListener('change', () => { if (forceFileInput.files[0]) handleForceFile(forceFileInput.files[0]); });

async function handleForceFile(file) {
  forceFileBytes = await file.arrayBuffer();
  if (!forceBuildIdInput.value) forceBuildIdInput.value = file.name.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 20) || 'b' + Date.now();
  await runForceVerify();
}

async function runForceVerify() {
  if (!forceFileBytes) return;
  forceVerifyPill.textContent = 'verifying…';
  forceVerifyPill.className = 'pill pill-neutral';
  const res = await fetch('/mjolnir/ota/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-Build-Id': forceBuildIdInput.value },
    body: forceFileBytes,
  });
  const body = await res.json();
  if (body.ok) {
    forceVerifyPill.textContent = '✓ ' + body.checks.length + ' checks passed';
    forceVerifyPill.className = 'pill pill-ok';
    forcePublishBtn.disabled = false;
  } else {
    const failed = body.checks.filter((c) => !c.ok).map((c) => c.check + ': ' + c.detail).join('; ');
    forceVerifyPill.textContent = '✗ failed';
    forceVerifyPill.className = 'pill pill-err';
    forceVerifyNote.textContent = failed;
    forcePublishBtn.disabled = true;
  }
}
forceBuildIdInput.addEventListener('change', runForceVerify);

forcePublishBtn.addEventListener('click', async () => {
  if (!confirm('Force-publish straight to current.json now? This bypasses logic_bundles activation and builder entirely.')) return;
  forcePublishBtn.disabled = true;
  forceResult.textContent = 'publishing…';
  try {
    const res = await fetch('/mjolnir/ota/force-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Build-Id': forceBuildIdInput.value, 'X-Label': document.getElementById('force-label').value },
      body: forceFileBytes,
    });
    const body = await res.json();
    forceResult.textContent = res.ok ? ('published ' + body.buildId + ' — sha256 ' + body.sha256) : ('error: ' + body.error);
  } catch (err) {
    forceResult.textContent = 'error: ' + err.message;
  } finally {
    forcePublishBtn.disabled = false;
  }
});
</script>`,
  });
}

export function createServer(pool, config) {
  // bundle-session-management: reachable embedded here, with no local
  // `bundle-tool ui`/npx invocation required for a deployed instance.
  // Instantiated once (not per-request) — its session store is an
  // in-memory Map that must survive across requests. `patchesDir` is the
  // same `patches/` directory the standalone CLI and `bundle-tool assemble`
  // already read/write, so a logic bundle assembled here is immediately
  // visible to the CLI and vice versa.
  const workbenchHandler = createWorkbenchHandler({ patchesDir: config.workbenchPatchesDir || "patches" });

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");

      // Mounted before the operator-auth gate below would otherwise apply
      // per-route — checked explicitly here instead, since the workbench's
      // own routes/static assets live under one prefix rather than hub's
      // per-page route list. Every path here is already gated the exact
      // same way every other operator page is: skipped entirely when
      // `OPERATOR_AUTH_TOKEN` is unset (local/dev), required otherwise.
      if (url.pathname === WORKBENCH_MOUNT) {
        // Relative asset/API paths (`app.js`, `api/...`) only resolve
        // correctly against a trailing-slash URL — redirect once, like any
        // static-site mount point would.
        res.writeHead(302, { Location: `${WORKBENCH_MOUNT}/` });
        return res.end();
      }
      if (url.pathname === WORKBENCH_MOUNT + "/" || url.pathname.startsWith(WORKBENCH_MOUNT + "/")) {
        if (config.operatorAuthToken) {
          if (!requireAuth(req, res, config.operatorAuthToken, { loginPath: "/mjolnir/login" })) return;
        }
        // Strip the mount prefix so the embedded handler sees exactly the
        // same paths it would standalone (`/`, `/app.js`, `/api/...`).
        req.url = url.pathname.slice(WORKBENCH_MOUNT.length) + url.search;
        return workbenchHandler(req, res);
      }

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

      // D-C9: the unified console — Cards/Builder/OTA/Tools as sections of
      // one page, each an iframe over its own already-working route with
      // `embed=1` (same-origin, so the existing shared `operator_token`
      // cookie/token already authenticates every iframe — see design.md's
      // recorded risk if hub/builder are ever given different tokens).
      if (req.method === "GET" && url.pathname === "/mjolnir/console") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(renderConsolePage());
      }
      // /mjolnir/ui is the canonical entry point, matching stabbur's own
      // /stabbur/ui and builder's /builder/ui (D46: one convention across
      // services). The bare path is kept working too — existing bookmarks,
      // the Caddyfile's own bare-path handling, and every internal link
      // built before this alias existed all still resolve.
      if (
        req.method === "GET" &&
        (url.pathname === "/mjolnir" || url.pathname === "/mjolnir/" || url.pathname === "/mjolnir/ui")
      ) {
        const [publications, current] = [await listPublications(), readCurrent(config.dataDir)];
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(renderHistoryPage(publications, current, config, isEmbed(url)));
      }

      if (req.method === "GET" && url.pathname === "/mjolnir/catalogue") {
        const [publications, logicBundles] = [await listPublications(), await listLogicBundles()];
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(renderCataloguePage(publications, logicBundles, config, isEmbed(url)));
      }
      // Streams a historical build's exact published bytes — the operator
      // asked to be able to inspect/download a publish, not just see its
      // metadata row. Same file `setCurrent`/`forcePublish` already treat as
      // the on-disk source of truth; this route only ever reads it.
      if (req.method === "GET" && url.pathname.startsWith("/mjolnir/ota/download/")) {
        const buildId = decodeURIComponent(url.pathname.slice("/mjolnir/ota/download/".length));
        const bundlePath = path.join(config.dataDir, "ota", "bundle", `${buildId}.js`);
        let bytes;
        try {
          bytes = fs.readFileSync(bundlePath);
        } catch {
          res.writeHead(404, { "Content-Type": "text/plain" });
          return res.end(`no bundle on disk for "${buildId}"`);
        }
        // D-C7: the build id alone was never a meaningful filename — fold
        // the publication's own label in when it has one.
        const publication = (await listPublications()).find((p) => p.build_id === buildId);
        const filename = `${buildId}${publication && publication.label ? `-${slugify(publication.label)}` : ""}.js`;
        res.writeHead(200, {
          "Content-Type": "application/javascript; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": bytes.length,
        });
        return res.end(bytes);
      }

      if (req.method === "GET" && url.pathname === "/mjolnir/cards") {
        const search = url.searchParams.get("q") || "";
        const deckCode = url.searchParams.get("deck") || "";
        const statusFilter = url.searchParams.get("status") || "";
        const cards = await cardsList(pool, { search, deckCode, statusFilter });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(renderCardsPage(cards, { search, deckCode, statusFilter }, config.stabburUiBase, isEmbed(url)));
      }

      // card-preview: a visual preview of one card's N/E/X faces, styled
      // from the real stock app's own extracted CSS (D-C8) — not hub's own
      // operator-console theme, deliberately a standalone page.
      if (req.method === "GET" && url.pathname.startsWith("/mjolnir/cards/") && url.pathname.endsWith("/preview")) {
        const cardId = decodeURIComponent(url.pathname.slice("/mjolnir/cards/".length, -"/preview".length));
        const [slot, content] = await Promise.all([getCardSlot(pool, cardId), getCardContent(cardId)]);
        if (!slot) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          return res.end(`no such card "${cardId}"`);
        }
        const hasAudioFile = !!(slot.audio_sha256 && fs.existsSync(path.join(config.dataDir, "blob", slot.audio_sha256)));
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(
          renderCardPreviewPage({
            cardId,
            deckCode: slot.deck_code,
            deckTitle: slot.deck_title,
            content: content || { N: "", E: "", X: "", A: "N" },
            hasAudioFile,
          })
        );
      }
      if (req.method === "GET" && url.pathname.startsWith("/mjolnir/cards/") && url.pathname.endsWith("/audio")) {
        const cardId = decodeURIComponent(url.pathname.slice("/mjolnir/cards/".length, -"/audio".length));
        const slot = await getCardSlot(pool, cardId);
        const blobPath = slot && slot.audio_sha256 ? path.join(config.dataDir, "blob", slot.audio_sha256) : null;
        if (!blobPath || !fs.existsSync(blobPath)) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          return res.end(`no audio on disk for "${cardId}"`);
        }
        const bytes = fs.readFileSync(blobPath);
        res.writeHead(200, { "Content-Type": "audio/mpeg", "Content-Length": bytes.length });
        return res.end(bytes);
      }

      if (req.method === "GET" && url.pathname === "/mjolnir/ota") {
        const logicBundles = await listLogicBundles();
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(renderOtaPage(logicBundles, isEmbed(url)));
      }
      // D-L1/task 4.1: the default submit flow's own, narrower verification
      // — no buildId exists yet for a freshly-dropped logic bundle. Also
      // surfaces the baked base_version/patch_rev (or nulls, prompting the
      // UI's manual-entry fields) so the operator sees what will actually be
      // recorded before confirming.
      if (req.method === "POST" && url.pathname === "/mjolnir/ota/verify-logic") {
        const bytes = await readBody(req);
        const verify = verifyLogicBundleBytes(bytes);
        return sendJson(res, 200, {
          ...verify,
          baseVersion: findBakedBaseVersion(bytes),
          patchRev: findBakedPatchRev(bytes),
        });
      }
      if (req.method === "POST" && url.pathname === "/mjolnir/ota/submit") {
        const bytes = await readBody(req);
        const label = req.headers["x-label"] || null;
        const baseVersion = req.headers["x-base-version"] || undefined;
        const patchRevHeader = req.headers["x-patch-rev"];
        const patchRev = patchRevHeader ? Number(patchRevHeader) : undefined;
        const row = await submitBundle(bytes, {
          label,
          baseVersion,
          patchRev,
          dataDir: config.dataDir,
          logicBundleDir: config.logicBundleDir,
        });
        return sendJson(res, 200, row);
      }
      if (req.method === "POST" && url.pathname === "/mjolnir/ota/logic-bundles/activate") {
        const { id } = await readJson(req);
        await activateLogicBundle(id);
        return sendJson(res, 200, { ok: true });
      }
      // The force-publish path keeps the original buildId-centric guards
      // (companion match, reuse-by-buildId) — it still publishes an
      // identity-addressed bundle straight to current.json, unlike the
      // default submit flow above.
      if (req.method === "POST" && url.pathname === "/mjolnir/ota/verify") {
        const bytes = await readBody(req);
        const buildId = req.headers["x-build-id"] || "";
        return sendJson(res, 200, verifyBundle(bytes, buildId, { dataDir: config.dataDir }));
      }
      if (req.method === "POST" && url.pathname === "/mjolnir/ota/force-publish") {
        const bytes = await readBody(req);
        const buildId = req.headers["x-build-id"] || "";
        const label = req.headers["x-label"] || buildId;
        const result = await forcePublish(bytes, buildId, label, {
          dataDir: config.dataDir,
          logicBundleDir: config.logicBundleDir,
          publicBase: config.publicBase,
        });
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
