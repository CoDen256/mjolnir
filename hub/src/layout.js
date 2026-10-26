// Shared page chrome for hub's operator UI — design system lifted directly
// from the mockup at tun/docs/13-operator-console-ux.md (the artifact linked
// there), not improvised. Each service embeds its own copy of this (hub and
// builder are separate processes, D80) rather than sharing a package for one
// stylesheet.
const STYLE = `
:root {
  --bg: #14171c; --bg-elevated: #1b1f26; --bg-sunken: #0f1216;
  --border: #2a3039; --border-soft: #232832;
  --text: #e8e6e1; --text-dim: #8b94a3; --text-faint: #566073;
  --accent: #c6703f; --accent-soft: #c6703f26; --accent-text: #f2b688;
  --ok: #5bab7e; --ok-soft: #5bab7e1f;
  --warn: #d4a73d; --warn-soft: #d4a73d1f;
  --err: #d1453f; --err-soft: #d1453f1f;
  --radius: 6px;
  --sans: ui-sans-serif, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --mono: ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Consolas, monospace;
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #f5f3ef; --bg-elevated: #ffffff; --bg-sunken: #ebe7e0;
    --border: #e2ddd3; --border-soft: #ece8e0;
    --text: #221f1a; --text-dim: #6b6660; --text-faint: #9a948a;
    --accent: #b35a2d; --accent-soft: #b35a2d14; --accent-text: #8a431c;
    --ok: #2f8a5c; --ok-soft: #2f8a5c14;
    --warn: #a87c1f; --warn-soft: #a87c1f14;
    --err: #b23a34; --err-soft: #b23a3414;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: var(--sans); font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
h1, h2, h3 { text-wrap: balance; font-weight: 650; margin: 0; }
code, .mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }
a { color: var(--accent-text); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.top-bar { display: flex; align-items: center; gap: 14px; padding: 10px 20px; background: var(--bg-sunken); border-bottom: 1px solid var(--border); font-size: 13px; }
.top-bar strong { font-weight: 700; }
.top-bar nav { margin-left: auto; display: flex; gap: 14px; }
.top-bar nav a { color: var(--text-dim); text-decoration: none; }
.top-bar nav a:hover { color: var(--text); }

.shell { display: flex; min-height: calc(100vh - 41px); }
.rail { width: 192px; flex: none; border-right: 1px solid var(--border); padding: 16px 10px; display: flex; flex-direction: column; gap: 2px; }
.rail-group-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .07em; color: var(--text-faint); padding: 12px 10px 6px; }
.rail-group-label:first-child { padding-top: 2px; }
.rail a { padding: 7px 10px; border-radius: var(--radius); font-size: 13px; color: var(--text-dim); text-decoration: none; display: block; }
.rail a:hover { background: var(--bg-elevated); color: var(--text); }
.rail a.active { background: var(--accent-soft); color: var(--accent-text); font-weight: 600; }

.content { flex: 1; min-width: 0; padding: 24px 28px 48px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.page-head h2 { font-size: 18px; }
.page-sub { color: var(--text-dim); font-size: 13px; margin-top: 3px; }

button, .btn { font: inherit; font-weight: 600; font-size: 13px; padding: 7px 14px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--bg-elevated); color: var(--text); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
button:hover { border-color: var(--text-faint); }
.btn-primary { background: var(--accent); border-color: var(--accent); color: #1a0d05; }
.btn-primary:hover { filter: brightness(1.08); border-color: var(--accent); }
.btn-ghost { background: transparent; border-color: transparent; color: var(--text-dim); padding: 7px 9px; }
.btn-ghost:hover { background: var(--bg-elevated); color: var(--text); border-color: transparent; }
.btn-danger { color: var(--err); }

.panel { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 10px; }
.panel + .panel { margin-top: 16px; }
.panel-pad { padding: 18px 20px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border-soft); }
.panel-head h3 { font-size: 13.5px; }

.toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
select, input[type="text"], input[type="number"], input[type="search"] { font: inherit; font-size: 13px; background: var(--bg-sunken); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 10px; }
.search-input { min-width: 220px; }
.spacer { flex: 1; }

.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 9px 14px; white-space: nowrap; }
thead th { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-faint); font-weight: 600; border-bottom: 1px solid var(--border); }
tbody tr { border-bottom: 1px solid var(--border-soft); }
tbody tr:last-child { border-bottom: none; }
td.wrap { white-space: normal; }
td.num { text-align: right; font-family: var(--mono); font-variant-numeric: tabular-nums; }

.pill { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; padding: 2px 9px 3px; border-radius: 99px; }
.pill::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.pill-ok { background: var(--ok-soft); color: var(--ok); }
.pill-warn { background: var(--warn-soft); color: var(--warn); }
.pill-err { background: var(--err-soft); color: var(--err); }
.pill-neutral { background: var(--border-soft); color: var(--text-dim); }

.inline-note { font-size: 12.5px; color: var(--text-faint); margin-top: 6px; }
.dropzone { border: 2px dashed var(--border); border-radius: 10px; padding: 36px; text-align: center; color: var(--text-dim); font-size: 13px; cursor: pointer; }
.dropzone.dragover { border-color: var(--accent); background: var(--accent-soft); }
.dropzone .icon { font-size: 28px; margin-bottom: 8px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field label { font-size: 12px; font-weight: 600; color: var(--text-dim); }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
`;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const NAV = [
  { group: "Content", items: [{ href: "/mjolnir/cards", label: "Cards" }] },
  {
    group: "OTA",
    items: [
      { href: "/mjolnir/ota", label: "Submit bundle" },
      { href: "/mjolnir", label: "Publish history" },
    ],
  },
];

function renderRail(activeHref) {
  return NAV.map(
    ({ group, items }) => `<div class="rail-group-label">${escapeHtml(group)}</div>
${items.map((i) => `<a href="${i.href}" class="${i.href === activeHref ? "active" : ""}">${escapeHtml(i.label)}</a>`).join("\n")}`
  ).join("\n");
}

export function renderShell({ title, activeHref, body }) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="top-bar">
  <strong>mjølnir · hub</strong>
  <nav><a href="/builder">builder's forecast &amp; publish-now →</a></nav>
</div>
<div class="shell">
  <div class="rail">${renderRail(activeHref)}</div>
  <div class="content">${body}</div>
</div>
</body>
</html>`;
}

export { escapeHtml };
