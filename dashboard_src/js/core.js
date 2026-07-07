let currentMode = DATA.modes[0];
let currentView = "stats";
let minGames = 3;
let selectedSeasons = new Set(DATA.seasons); // default: all seasons (no filtering)

const VIEWS = [
  { key: "stats", label: "Stats", render: () => renderStatsView() },
  { key: "awards", label: "Awards", render: () => renderAwardsView() },
  { key: "talents", label: "Talents", render: () => renderTalentsView() },
  { key: "graphs", label: "Graphs", render: () => renderGraphsView() },
];

function pct(n) { return n.toFixed(1) + "%"; }
function barCell(winrate, games) {
  const color = winrate >= 50 ? "wr-good" : "wr-bad";
  const w = Math.max(2, Math.min(100, winrate));
  return `<div class="barcell"><div class="bar"><span class="${color}" style="width:${w}%"></span></div><span>${pct(winrate)}</span><span style="color:var(--muted)">(${games})</span></div>`;
}

function sortableTable(id, columns, rows, opts) {
  opts = opts || {};
  let sortKey = opts.defaultSort || columns[0].key;
  let sortDir = opts.defaultDir || -1;

  function draw() {
    let filtered = rows;
    if (opts.minGamesFilter) filtered = filtered.filter(r => r.games >= minGames);
    filtered = filtered.slice().sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") return av.localeCompare(bv) * sortDir;
      return ((av ?? -Infinity) - (bv ?? -Infinity)) * sortDir;
    });
    let html = "<table><thead><tr>";
    for (const c of columns) {
      const cls = c.key === sortKey ? "sorted" : "";
      html += `<th class="${cls}" data-key="${c.key}">${c.label}</th>`;
    }
    html += "</tr></thead><tbody>";
    for (const r of filtered) {
      html += "<tr>";
      for (const c of columns) {
        if (c.render) html += `<td>${c.render(r)}</td>`;
        else html += `<td>${r[c.key] ?? ""}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table>";
    document.getElementById(id).innerHTML = html;
    document.querySelectorAll(`#${id} th`).forEach(th => {
      th.onclick = () => {
        const key = th.dataset.key;
        if (key === sortKey) sortDir *= -1; else { sortKey = key; sortDir = -1; }
        draw();
      };
    });
  }
  draw();
  return draw;
}

function roleClass(role) { return "role-" + role.replace(/ /g, "-"); }
function dn(name) { return DATA.displayNames[name] || name; }

// ---- aggregation helpers (client-side, so the season filter can recompute
// everything live without a rebuild) ----

function computeWinrate(rows) {
  if (!rows.length) return 0;
  const wins = rows.reduce((s, r) => s + (r.win ? 1 : 0), 0);
  return Math.round(1000 * wins / rows.length) / 10;
}

function groupTable(rows, keyFn) {
  const groups = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return [...groups.entries()].map(([key, rs]) => ({ key, games: rs.length, winrate: computeWinrate(rs) }));
}

function avg(values) {
  values = values.filter(v => v !== null && v !== undefined && !Number.isNaN(v));
  if (!values.length) return null;
  return Math.round(10 * values.reduce((a, b) => a + b, 0) / values.length) / 10;
}

function filteredGames() {
  return DATA.games.filter(g => g.mode === currentMode && selectedSeasons.has(g.season));
}

function filteredPlayers() {
  return DATA.players.filter(p => p.mode === currentMode && selectedSeasons.has(p.season));
}

// Fearless isn't scoped to a game mode/season, so its filter row (view
// toggle, min games, seasons) is meaningless there -- hide all three
// whenever it's the active view instead of leaving them inert on screen.
function updateFilterVisibility() {
  const hide = currentView === "fearless";
  document.getElementById("viewToggle").style.display = hide ? "none" : "";
  document.getElementById("minGamesFilter").style.display = hide ? "none" : "";
  document.getElementById("seasonFilter").style.display = hide ? "none" : "";
}

function render() {
  updateFilterVisibility();
  if (currentView === "fearless") { renderFearlessView(); return; }
  const view = VIEWS.find(v => v.key === currentView);
  view.render();
}

function renderTabs() {
  const tabs = document.getElementById("modeTabs");
  const modeTabsHtml = DATA.modes.map(m => `<div class="tab${m===currentMode && currentView!=="fearless"?" active":""}" data-m="${m}">${m}</div>`).join("");
  const fearlessTabHtml = `<div class="tab tab-fearless${currentView==="fearless"?" active":""}" data-fearless="true">Fearless</div>`;
  tabs.innerHTML = modeTabsHtml + fearlessTabHtml;
  tabs.querySelectorAll(".tab[data-m]").forEach(t => t.onclick = () => {
    currentMode = t.dataset.m;
    if (currentView === "fearless") currentView = "stats"; // leaving Fearless needs a real view again
    renderTabs();
    renderViewToggle();
    render();
  });
  tabs.querySelector(".tab[data-fearless]").onclick = () => {
    currentView = "fearless";
    renderTabs();
    render();
  };
}

function renderMinGamesFilter() {
  const el = document.getElementById("minGamesFilter");
  el.innerHTML = `<label>Min games: <input type="number" id="minGamesInput" value="${minGames}" min="1"></label>`;
  document.getElementById("minGamesInput").onchange = (e) => {
    minGames = parseInt(e.target.value) || 1;
    render();
  };
}

function renderViewToggle() {
  const el = document.getElementById("viewToggle");
  el.innerHTML = VIEWS.map(v => `<button data-v="${v.key}" class="${v.key===currentView?"active":""}">${v.label}</button>`).join("");
  el.querySelectorAll("button").forEach(b => b.onclick = () => {
    currentView = b.dataset.v;
    renderViewToggle();
    render();
  });
}

function seasonButtonLabel() {
  if (selectedSeasons.size === DATA.seasons.length) return "All seasons";
  if (selectedSeasons.size === 0) return "No seasons selected";
  if (selectedSeasons.size === 1) return [...selectedSeasons][0];
  return `${selectedSeasons.size} seasons selected`;
}

function renderSeasonFilter() {
  // Only list seasons that actually have at least one recorded game -- the
  // full SEASONS table goes back to 2015 and covers every real HotS ranked
  // season whether or not this group played during it, and separately
  // always includes a trailing "no confirmed season yet" catch-all. Checked
  // across all of DATA.games (not just the current mode tab) since this
  // filter isn't itself mode-scoped.
  const seasonsWithGames = new Set(DATA.games.map(g => g.season));
  const visibleSeasons = DATA.seasons.filter(s => seasonsWithGames.has(s));

  const el = document.getElementById("seasonFilter");
  el.innerHTML = `
    <button class="seasonbtn" id="seasonBtn">Seasons: ${seasonButtonLabel()} ▾</button>
    <div class="seasonpanel" id="seasonPanel">
      <div class="quicklinks"><a id="seasonAll">All</a><a id="seasonNone">None</a></div>
      ${visibleSeasons.slice().reverse().map(s => `
        <label><input type="checkbox" data-season="${s}" ${selectedSeasons.has(s) ? "checked" : ""}> ${s}</label>
      `).join("")}
    </div>
  `;
  const btn = document.getElementById("seasonBtn");
  const panel = document.getElementById("seasonPanel");
  btn.onclick = (e) => { e.stopPropagation(); panel.classList.toggle("open"); };
  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove("open");
  });
  panel.querySelectorAll('input[type=checkbox]').forEach(cb => cb.onchange = () => {
    const s = cb.dataset.season;
    if (cb.checked) selectedSeasons.add(s); else selectedSeasons.delete(s);
    btn.textContent = `Seasons: ${seasonButtonLabel()} ▾`;
    render();
  });
  document.getElementById("seasonAll").onclick = () => {
    selectedSeasons = new Set(DATA.seasons);
    renderSeasonFilter();
    panel.classList.add("open");
    document.getElementById("seasonPanel").classList.add("open");
    render();
  };
  document.getElementById("seasonNone").onclick = () => {
    selectedSeasons = new Set();
    renderSeasonFilter();
    document.getElementById("seasonPanel").classList.add("open");
    render();
  };
}

document.getElementById("subtitle").textContent =
  `Games where at least ${DATA.minKnown} of ${DATA.group.map(dn).join(" / ")} were on the same team.`;

renderTabs();
renderSeasonFilter();
renderViewToggle();
renderMinGamesFilter();
render();
