function formatMinSec(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function quarterLabel(dateStr) {
  const year = dateStr.slice(0, 4);
  const month = parseInt(dateStr.slice(5, 7), 10);
  const quarter = Math.floor((month - 1) / 3) + 1;
  return `${year} Q${quarter}`;
}

function winrateLineChart(items, width, opts) {
  opts = opts || {};
  const getLabel = opts.getLabel || (it => it.key);
  const estLabelWidth = opts.estLabelWidth || 46;

  const H = 240, padTop = 24, padBottom = 36, padLeft = 38, padRight = 16;
  const W = Math.max(width, 280);
  const innerW = W - padLeft - padRight;
  const n = items.length;
  const stepX = n > 1 ? innerW / (n - 1) : 0;

  // Scale to the actual data range (always including 50%) rather than a
  // fixed 0-100% axis -- a full-height axis makes ordinary variation around
  // break-even (e.g. 46%-54%) look like huge green/red swings.
  const values = items.map(it => it.winrate);
  const rawMin = Math.min(50, ...values);
  const rawMax = Math.max(50, ...values);
  const pad = Math.max(rawMax - rawMin, 10) * 0.25;
  const domainMin = Math.max(0, rawMin - pad);
  const domainMax = Math.min(100, rawMax + pad);
  const scaleY = v => padTop + (1 - (v - domainMin) / (domainMax - domainMin)) * (H - padTop - padBottom);
  const scaleX = i => padLeft + i * stepX;

  // Skip labels when points are too dense to fit text without overlapping;
  // the point and its hover tooltip are still drawn regardless.
  const labelEvery = Math.max(1, Math.ceil(estLabelWidth / Math.max(stepX, 1)));

  const points = items.map((it, i) => ({ x: scaleX(i), y: scaleY(it.winrate), it }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const y50 = scaleY(50);

  let markers = "";
  points.forEach((p, i) => {
    const color = p.it.winrate >= 50 ? "var(--good)" : "var(--bad)";
    const label = getLabel(p.it);
    const showLabel = label && i % labelEvery === 0;
    markers += `
      <g class="chart-tooltip-target">
        <title>${p.it.key}: ${p.it.winrate.toFixed(1)}% (${p.it.games} games)</title>
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${color}"></circle>
        ${showLabel ? `<text x="${p.x.toFixed(1)}" y="${p.y - 10}" text-anchor="middle" font-size="11" fill="var(--text)">${p.it.winrate.toFixed(0)}%</text>` : ""}
        ${showLabel ? `<text x="${p.x.toFixed(1)}" y="${H - padBottom + 16}" text-anchor="middle" font-size="11" fill="var(--muted)">${label}</text>` : ""}
      </g>
    `;
  });

  return `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
        <line x1="${padLeft}" y1="${y50.toFixed(1)}" x2="${W - padRight}" y2="${y50.toFixed(1)}" stroke="var(--border)" stroke-dasharray="4 3"></line>
        <text x="4" y="${(y50 - 4).toFixed(1)}" font-size="10" fill="var(--muted)">50%</text>
        <path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="2"></path>
        ${markers}
      </svg>
    </div>
  `;
}

function drawResponsiveChart(containerId, items, opts) {
  const container = document.getElementById(containerId);
  if (!items.length) {
    container.innerHTML = `<p class="hint">No games in this filter.</p>`;
    return;
  }
  const width = container.clientWidth || 600;
  container.innerHTML = winrateLineChart(items, width, opts);
}

// Persisted across re-renders so switching mode/season tabs doesn't silently
// reset the player/hero/role selection here.
let graphsTimePlayer = "All";
let graphsTimeHero = "All";
let graphsTimeRolePlayer = "All";
let graphsTimeRole = "All";

function renderGraphsView() {
  const games = filteredGames();
  const players = filteredPlayers();
  const main = document.getElementById("main");

  main.innerHTML = `
    <section class="panel" style="margin-bottom:24px">
      <h2>Win rate over time by player / hero</h2>
      <div class="hint">By quarter. Filter to one player and/or one hero, or leave on "All" for either.</div>
      <div class="playerbtns" id="timePlayerBtns"></div>
      <select class="hots-select" id="timeHeroSelect" style="margin-top:8px"></select>
      <div id="chart-playertime" style="margin-top:10px"></div>
    </section>
    <section class="panel" style="margin-bottom:24px">
      <h2>Win rate over time by player / role</h2>
      <div class="hint">By quarter. Filter to one player and/or one role, or leave on "All" for either.</div>
      <div class="playerbtns" id="timeRolePlayerBtns"></div>
      <div class="subtabs" id="timeRoleBtns" style="margin-top:8px"></div>
      <div id="chart-playerroletime" style="margin-top:10px"></div>
    </section>
    <section class="panel" style="margin-bottom:24px">
      <h2>Win rate over the years</h2>
      <div class="hint">By quarter.</div>
      <div id="chart-years"></div>
    </section>
    <section class="panel">
      <h2>Win rate by game length</h2>
      <div class="hint">Every game, bucketed in 30-second increments. Hover a point for its game count -- some outliers are single games.</div>
      <div id="chart-length"></div>
    </section>
  `;

  const byQuarter = groupTable(games, r => r.date ? quarterLabel(r.date) : "Unknown")
    .sort((a, b) => a.key.localeCompare(b.key));
  drawResponsiveChart("chart-years", byQuarter);

  // player/hero-filtered win rate over time
  const heroOptions = ["All", ...new Set(players.map(p => p.hero))].sort((a, b) => a === "All" ? -1 : b === "All" ? 1 : a.localeCompare(b));
  if (!heroOptions.includes(graphsTimeHero)) graphsTimeHero = "All";

  const timePlayerBar = document.getElementById("timePlayerBtns");
  const timePlayerOptions = ["All", ...DATA.group];
  timePlayerBar.innerHTML = timePlayerOptions.map(p => `<button class="playerbtn${p === graphsTimePlayer ? " active" : ""}" data-p="${p}">${p === "All" ? "All" : dn(p)}</button>`).join("");

  const heroSelect = document.getElementById("timeHeroSelect");
  heroSelect.innerHTML = heroOptions.map(h => `<option value="${h}" ${h === graphsTimeHero ? "selected" : ""}>${h}</option>`).join("");

  function drawPlayerTimeChart() {
    let rows = players;
    if (graphsTimePlayer !== "All") rows = rows.filter(p => p.name === graphsTimePlayer);
    if (graphsTimeHero !== "All") rows = rows.filter(p => p.hero === graphsTimeHero);
    const byQuarterFiltered = groupTable(rows, r => r.date ? quarterLabel(r.date) : "Unknown")
      .sort((a, b) => a.key.localeCompare(b.key));
    drawResponsiveChart("chart-playertime", byQuarterFiltered);
  }
  timePlayerBar.querySelectorAll("button").forEach(b => b.onclick = () => {
    graphsTimePlayer = b.dataset.p;
    timePlayerBar.querySelectorAll("button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    drawPlayerTimeChart();
  });
  heroSelect.onchange = (e) => {
    graphsTimeHero = e.target.value;
    drawPlayerTimeChart();
  };
  drawPlayerTimeChart();

  // player/role-filtered win rate over time
  const roleOptions = ["All", ...DATA.roles];
  if (!roleOptions.includes(graphsTimeRole)) graphsTimeRole = "All";

  const timeRolePlayerBar = document.getElementById("timeRolePlayerBtns");
  timeRolePlayerBar.innerHTML = timePlayerOptions.map(p => `<button class="playerbtn${p === graphsTimeRolePlayer ? " active" : ""}" data-p="${p}">${p === "All" ? "All" : dn(p)}</button>`).join("");

  const roleBar = document.getElementById("timeRoleBtns");
  roleBar.innerHTML = roleOptions.map(r => `<button class="subtab${r === graphsTimeRole ? " active" : ""}" data-r="${r}">${r}</button>`).join("");

  function drawPlayerRoleTimeChart() {
    let rows = players;
    if (graphsTimeRolePlayer !== "All") rows = rows.filter(p => p.name === graphsTimeRolePlayer);
    if (graphsTimeRole !== "All") rows = rows.filter(p => p.class === graphsTimeRole);
    const byQuarterFiltered = groupTable(rows, r => r.date ? quarterLabel(r.date) : "Unknown")
      .sort((a, b) => a.key.localeCompare(b.key));
    drawResponsiveChart("chart-playerroletime", byQuarterFiltered);
  }
  timeRolePlayerBar.querySelectorAll("button").forEach(b => b.onclick = () => {
    graphsTimeRolePlayer = b.dataset.p;
    timeRolePlayerBar.querySelectorAll("button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    drawPlayerRoleTimeChart();
  });
  roleBar.querySelectorAll("button").forEach(b => b.onclick = () => {
    graphsTimeRole = b.dataset.r;
    roleBar.querySelectorAll("button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    drawPlayerRoleTimeChart();
  });
  drawPlayerRoleTimeChart();

  const bucketSeconds = 30;
  const withLength = games.filter(g => g.game_length_seconds != null);
  const bucketMap = new Map();
  for (const g of withLength) {
    const startSec = Math.floor(g.game_length_seconds / bucketSeconds) * bucketSeconds;
    if (!bucketMap.has(startSec)) bucketMap.set(startSec, []);
    bucketMap.get(startSec).push(g);
  }
  const lengthBuckets = [...bucketMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([startSec, rs]) => ({
      key: `${formatMinSec(startSec)}-${formatMinSec(startSec + bucketSeconds)}`,
      startSec,
      games: rs.length,
      winrate: computeWinrate(rs),
    }));
  drawResponsiveChart("chart-length", lengthBuckets, {
    getLabel: it => (it.startSec % 60 === 0 ? String(Math.floor(it.startSec / 60)) : null),
    estLabelWidth: 20,
  });
}
