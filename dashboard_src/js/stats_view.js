// Persisted across re-renders (e.g. when "Min games" changes) so tweaking a
// global filter doesn't silently reset the player/role selection here.
let statsPlayerHeroPlayer = null;
let statsPlayerHeroRole = "All";
let statsVsEnemyComp = null;
let statsHeroWithRole = "All";
let statsHeroVsRole = "All";

function renderStatsView() {
  const games = filteredGames();
  const players = filteredPlayers();
  const main = document.getElementById("main");

  const overview = { games: games.length, winrate: computeWinrate(games) };

  const maps = groupTable(games, r => r.map);
  const teamComp = groupTable(games, r => r.team_comp);
  const enemyComp = groupTable(games, r => r.enemy_comp);
  const missing = groupTable(games.filter(r => r.missing_from_group), r => r.missing_from_group);

  // Enemy comps that actually appear, most-played first, so the picker below
  // surfaces the comps you see most often rather than one-off oddities.
  const enemyCompOptions = enemyComp.slice().sort((a, b) => b.games - a.games).map(e => e.key);
  if (statsVsEnemyComp === null || !enemyCompOptions.includes(statsVsEnemyComp)) {
    statsVsEnemyComp = enemyCompOptions[0] || null;
  }
  const bestVsEnemyComp = statsVsEnemyComp
    ? groupTable(games.filter(r => r.enemy_comp === statsVsEnemyComp), r => r.team_comp)
    : [];

  const heroWith = new Map(), heroVs = new Map();
  for (const r of games) {
    for (const h of r.team_heroes.split("|")) { if (!heroWith.has(h)) heroWith.set(h, []); heroWith.get(h).push(r); }
    for (const h of r.enemy_heroes.split("|")) { if (!heroVs.has(h)) heroVs.set(h, []); heroVs.get(h).push(r); }
  }
  const heroWithTable = [...heroWith.entries()].map(([key, rs]) => ({ key, role: DATA.heroRoles[key] || "Unknown", games: rs.length, winrate: computeWinrate(rs) }));
  const heroVsTable = [...heroVs.entries()].map(([key, rs]) => ({ key, role: DATA.heroRoles[key] || "Unknown", games: rs.length, winrate: computeWinrate(rs) }));

  const heroDuos = new Map();
  for (const r of games) {
    const heroes = r.team_heroes.split("|");
    for (let i = 0; i < heroes.length; i++) {
      for (let j = i + 1; j < heroes.length; j++) {
        const key = [heroes[i], heroes[j]].sort().join(" + ");
        if (!heroDuos.has(key)) heroDuos.set(key, []);
        heroDuos.get(key).push(r);
      }
    }
  }
  const heroDuoTable = [...heroDuos.entries()].map(([key, rs]) => ({ key, games: rs.length, winrate: computeWinrate(rs) }));

  const enemyHeroDuos = new Map();
  for (const r of games) {
    const heroes = r.enemy_heroes.split("|");
    for (let i = 0; i < heroes.length; i++) {
      for (let j = i + 1; j < heroes.length; j++) {
        const key = [heroes[i], heroes[j]].sort().join(" + ");
        if (!enemyHeroDuos.has(key)) enemyHeroDuos.set(key, []);
        enemyHeroDuos.get(key).push(r);
      }
    }
  }
  const enemyHeroDuoTable = [...enemyHeroDuos.entries()].map(([key, rs]) => ({ key, games: rs.length, winrate: computeWinrate(rs) }));

  const playerHeroMap = new Map(), playerRoleMap = new Map(), playerStatsMap = new Map();
  for (const p of players) {
    const hk = `${p.name} ${p.hero}`;
    if (!playerHeroMap.has(hk)) playerHeroMap.set(hk, { player: p.name, hero: p.hero, role: p.class, rows: [] });
    playerHeroMap.get(hk).rows.push(p);

    const rk = `${p.name} ${p.class}`;
    if (!playerRoleMap.has(rk)) playerRoleMap.set(rk, { player: p.name, role: p.class, rows: [] });
    playerRoleMap.get(rk).rows.push(p);

    if (!playerStatsMap.has(p.name)) playerStatsMap.set(p.name, []);
    playerStatsMap.get(p.name).push(p);
  }
  const playerHero = [...playerHeroMap.values()].map(v => ({ player: v.player, hero: v.hero, role: v.role, games: v.rows.length, winrate: computeWinrate(v.rows) }));
  const playerRole = [...playerRoleMap.values()].map(v => ({ player: v.player, role: v.role, games: v.rows.length, winrate: computeWinrate(v.rows) }));

  const gameGroups = new Map();
  for (const p of players) {
    if (!gameGroups.has(p.game_id)) gameGroups.set(p.game_id, []);
    gameGroups.get(p.game_id).push(p);
  }
  const roleDuoMap = new Map();
  for (const rows of gameGroups.values()) {
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = `${dn(rows[i].name)}: ${rows[i].class}`;
        const b = `${dn(rows[j].name)}: ${rows[j].class}`;
        const key = [a, b].sort().join("  +  ");
        if (!roleDuoMap.has(key)) roleDuoMap.set(key, []);
        roleDuoMap.get(key).push(rows[i]);
      }
    }
  }
  const roleDuoTable = [...roleDuoMap.entries()].map(([key, rs]) => ({ key, games: rs.length, winrate: computeWinrate(rs) }));
  const statCols = ["games","Takedowns","SoloKill","Deaths","Assists","HeroDamage","SiegeDamage","DamageTaken","Healing","TeamfightHeroDamage","ExperienceContribution"];
  const playerStats = [...playerStatsMap.entries()].map(([name, rows]) => {
    const row = { player: name, games: rows.length };
    for (const c of statCols) { if (c !== "games") row[c] = avg(rows.map(r => r[c])); }
    return row;
  }).sort((a, b) => a.player.localeCompare(b.player));

  const utilityCols = ["games", "TimeCCdEnemyHeroes", "TimeStunningEnemyHeroes", "TimeRootingEnemyHeroes", "TimeSilencingEnemyHeroes", "ProtectionGivenToAllies", "ClutchHealsPerformed", "EscapesPerformed", "VengeancesPerformed"];
  const playerUtility = [...playerStatsMap.entries()].map(([name, rows]) => {
    const row = { player: name, games: rows.length };
    for (const c of utilityCols) { if (c !== "games") row[c] = avg(rows.map(r => r[c])); }
    return row;
  }).sort((a, b) => a.player.localeCompare(b.player));

  main.innerHTML = `
    <div class="cards">
      <div class="card"><div class="num">${overview.games}</div><div class="label">Games</div></div>
      <div class="card"><div class="num">${pct(overview.winrate)}</div><div class="label">Win rate</div></div>
    </div>

    <section class="panel" style="margin-bottom:24px">
      <h2>Our best comp against a given enemy comp</h2>
      <div class="hint">Pick an enemy comp to see which of our comps have fared best against it specifically.</div>
      <div class="hint">T=Tank B=Bruiser RA=Ranged Assassin MA=Melee Assassin H=Healer Su=Support</div>
      <select class="hots-select" id="enemyCompPicker"></select>
      <div class="scroll" id="tbl-bestvsenemycomp" style="margin-top:10px"></div>
    </section>

    <div class="grid">
      <section class="panel">
        <h2>Win rate by map</h2>
        <div class="scroll" id="tbl-maps"></div>
      </section>
      <section class="panel">
        <h2>Win rate by who sat out</h2>
        <div class="scroll" id="tbl-missing"></div>
      </section>
      <section class="panel">
        <h2>Win rate by team composition</h2>
        <div class="hint">T=Tank B=Bruiser RA=Ranged Assassin MA=Melee Assassin H=Healer Su=Support</div>
        <div class="scroll" id="tbl-comp"></div>
      </section>
      <section class="panel">
        <h2>Win rate by enemy team composition</h2>
        <div class="hint">Same comp shorthand, for whatever the other team ran.</div>
        <div class="scroll" id="tbl-enemycomp"></div>
      </section>
      <section class="panel">
        <h2>Our win rate when we play this hero</h2>
        <div class="hint">Any of the 5 on our team, not just one player</div>
        <div class="subtabs" id="heroWithRoleBtns"></div>
        <div class="scroll" id="tbl-herowith"></div>
      </section>
      <section class="panel">
        <h2>Our win rate when the enemy plays this hero</h2>
        <div class="hint">High % = we handle this hero well. Low % = we struggle against it.</div>
        <div class="subtabs" id="heroVsRoleBtns"></div>
        <div class="scroll" id="tbl-herovs"></div>
      </section>
      <section class="panel">
        <h2>Win rate by hero duo</h2>
        <div class="hint">Both heroes on our team in the same game. Click "Win rate" again to flip to worst duos.</div>
        <div class="scroll" id="tbl-heroduo"></div>
      </section>
      <section class="panel">
        <h2>Win rate by enemy hero duo</h2>
        <div class="hint">Both heroes on the enemy team in the same game. Click "Win rate" again to flip to worst matchups.</div>
        <div class="scroll" id="tbl-enemyheroduo"></div>
      </section>
    </div>

    <section class="panel" style="margin-bottom:24px">
      <h2>Role distribution per player</h2>
      <div id="rolebars"></div>
      <div class="legend">
        ${DATA.roles.map(r => `<span><span class="sw ${roleClass(r)}"></span>${r}</span>`).join("")}
      </div>
    </section>

    <section class="panel" style="margin-bottom:24px">
      <h2>Per-player hero win rates <span id="heroCount" style="color:var(--muted);font-weight:400;font-size:13px"></span></h2>
      <div class="playerbtns" id="playerBtns"></div>
      <div class="subtabs" id="roleFilterBtns" style="margin-top:8px"></div>
      <div class="scroll" id="tbl-playerhero" style="margin-top:10px"></div>
    </section>

    <section class="panel" style="margin-bottom:24px">
      <h2>Per-player win rate by role</h2>
      <div id="tbl-playerrole"></div>
    </section>

    <section class="panel" style="margin-bottom:24px">
      <h2>Win rate by player-role duo</h2>
      <div class="hint">Any two of us on the same team, each in the given role, same game. Click "Win rate" again to see the worst-performing duos.</div>
      <div class="scroll" id="tbl-roleduo"></div>
    </section>

    <section class="panel" style="margin-bottom:24px">
      <h2>CC &amp; utility leaderboard</h2>
      <div class="hint">Per-game averages. Time stats are seconds of crowd control applied to enemy heroes, not received.</div>
      <div class="scroll" id="tbl-utility"></div>
    </section>

    <section class="panel">
      <h2>Per-player average stats per game</h2>
      <div class="scroll" id="tbl-playerstats"></div>
    </section>
  `;

  sortableTable("tbl-maps",
    [{key:"key", label:"Map"}, {key:"games", label:"Games"}, {key:"winrate", label:"Win rate", render: r => barCell(r.winrate, r.games)}],
    maps, {minGamesFilter: true, defaultSort:"winrate"});

  sortableTable("tbl-comp",
    [{key:"key", label:"Comp"}, {key:"games", label:"Games"}, {key:"winrate", label:"Win rate", render: r => barCell(r.winrate, r.games)}],
    teamComp, {minGamesFilter: true, defaultSort:"winrate"});

  sortableTable("tbl-enemycomp",
    [{key:"key", label:"Comp"}, {key:"games", label:"Games"}, {key:"winrate", label:"Win rate", render: r => barCell(r.winrate, r.games)}],
    enemyComp, {minGamesFilter: true, defaultSort:"winrate"});

  sortableTable("tbl-missing",
    [{key:"key", label:"Missing", render: r => dn(r.key)}, {key:"games", label:"Games"}, {key:"winrate", label:"Win rate", render: r => barCell(r.winrate, r.games)}],
    missing, {defaultSort:"winrate"});

  // hero-with/hero-vs tables with a role filter each (independent of one another)
  const heroRoleOptions = ["All", ...DATA.roles];
  const heroWithColumns = [{key:"key", label:"Hero"}, {key:"role", label:"Role"}, {key:"games", label:"Games"}, {key:"winrate", label:"Win rate", render: r => barCell(r.winrate, r.games)}];
  const heroVsColumns = heroWithColumns;

  const heroWithRoleBar = document.getElementById("heroWithRoleBtns");
  heroWithRoleBar.innerHTML = heroRoleOptions.map(r => `<button class="subtab${r===statsHeroWithRole?" active":""}" data-r="${r}">${r}</button>`).join("");
  function drawHeroWith() {
    const rows = statsHeroWithRole === "All" ? heroWithTable : heroWithTable.filter(r => r.role === statsHeroWithRole);
    sortableTable("tbl-herowith", heroWithColumns, rows, {minGamesFilter: true, defaultSort:"winrate"});
  }
  heroWithRoleBar.querySelectorAll("button").forEach(b => b.onclick = () => {
    statsHeroWithRole = b.dataset.r;
    heroWithRoleBar.querySelectorAll("button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    drawHeroWith();
  });
  drawHeroWith();

  const heroVsRoleBar = document.getElementById("heroVsRoleBtns");
  heroVsRoleBar.innerHTML = heroRoleOptions.map(r => `<button class="subtab${r===statsHeroVsRole?" active":""}" data-r="${r}">${r}</button>`).join("");
  function drawHeroVs() {
    const rows = statsHeroVsRole === "All" ? heroVsTable : heroVsTable.filter(r => r.role === statsHeroVsRole);
    sortableTable("tbl-herovs", heroVsColumns, rows, {minGamesFilter: true, defaultSort:"winrate"});
  }
  heroVsRoleBar.querySelectorAll("button").forEach(b => b.onclick = () => {
    statsHeroVsRole = b.dataset.r;
    heroVsRoleBar.querySelectorAll("button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    drawHeroVs();
  });
  drawHeroVs();

  sortableTable("tbl-heroduo",
    [{key:"key", label:"Duo"}, {key:"games", label:"Games"}, {key:"winrate", label:"Win rate", render: r => barCell(r.winrate, r.games)}],
    heroDuoTable, {minGamesFilter: true, defaultSort:"winrate"});

  sortableTable("tbl-enemyheroduo",
    [{key:"key", label:"Duo"}, {key:"games", label:"Games"}, {key:"winrate", label:"Win rate", render: r => barCell(r.winrate, r.games)}],
    enemyHeroDuoTable, {minGamesFilter: true, defaultSort:"winrate"});

  // enemy comp picker -> our best comp against it
  const enemyCompPicker = document.getElementById("enemyCompPicker");
  enemyCompPicker.innerHTML = enemyCompOptions.map(k => {
    const count = enemyComp.find(e => e.key === k).games;
    return `<option value="${k}" ${k === statsVsEnemyComp ? "selected" : ""}>${k} (${count} games)</option>`;
  }).join("");
  sortableTable("tbl-bestvsenemycomp",
    [{key:"key", label:"Our comp"}, {key:"games", label:"Games"}, {key:"winrate", label:"Win rate", render: r => barCell(r.winrate, r.games)}],
    bestVsEnemyComp, {minGamesFilter: true, defaultSort:"winrate"});
  enemyCompPicker.onchange = (e) => {
    statsVsEnemyComp = e.target.value;
    render();
  };

  // role distribution bars
  let rb = "";
  for (const player of DATA.group) {
    const rows = playerRole.filter(r => r.player === player);
    const total = rows.reduce((s, r) => s + r.games, 0);
    if (!total) { rb += `<div class="rolebar-row"><div class="name">${dn(player)}</div><div style="color:var(--muted);font-size:12px">no games</div></div>`; continue; }
    let segs = "";
    for (const role of DATA.roles) {
      const row = rows.find(r => r.role === role);
      const g = row ? row.games : 0;
      if (!g) continue;
      const w = (100 * g / total).toFixed(1);
      const label = w >= 6 ? `${Math.round(w)}%` : "";
      segs += `<span class="seg ${roleClass(role)}" style="width:${w}%" title="${role}: ${g} games, ${row.winrate}% win rate">${label}</span>`;
    }
    rb += `<div class="rolebar-row"><div class="name">${dn(player)}</div><div class="rolebar"><div class="rolebar" style="display:flex">${segs}</div></div></div>`;
  }
  document.getElementById("rolebars").innerHTML = rb;

  // per-player hero table with player + role filter
  if (statsPlayerHeroPlayer === null) statsPlayerHeroPlayer = DATA.group[0];
  let selectedPlayer = statsPlayerHeroPlayer;
  let selectedRole = statsPlayerHeroRole;
  const btnBar = document.getElementById("playerBtns");
  btnBar.innerHTML = DATA.group.map(p => `<button class="playerbtn${p===selectedPlayer?" active":""}" data-p="${p}">${dn(p)}</button>`).join("");
  const roleBar = document.getElementById("roleFilterBtns");
  const roleOptions = ["All", ...DATA.roles];
  roleBar.innerHTML = roleOptions.map(r => `<button class="subtab${r===selectedRole?" active":""}" data-r="${r}">${r}</button>`).join("");
  function drawPlayerHero() {
    let rows = playerHero.filter(r => r.player === selectedPlayer);
    if (selectedRole !== "All") rows = rows.filter(r => r.role === selectedRole);
    const visibleCount = rows.filter(r => r.games >= minGames).length;
    document.getElementById("heroCount").textContent = `${visibleCount} Hero${visibleCount === 1 ? "" : "es"}`;
    sortableTable("tbl-playerhero",
      [{key:"hero", label:"Hero"}, {key:"role", label:"Role"}, {key:"games", label:"Games"}, {key:"winrate", label:"Win rate", render: r => barCell(r.winrate, r.games)}],
      rows, {minGamesFilter: true, defaultSort:"winrate"});
  }
  roleBar.querySelectorAll("button").forEach(b => b.onclick = () => {
    selectedRole = statsPlayerHeroRole = b.dataset.r;
    roleBar.querySelectorAll("button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    drawPlayerHero();
  });
  btnBar.querySelectorAll("button").forEach(b => b.onclick = () => {
    selectedPlayer = statsPlayerHeroPlayer = b.dataset.p;
    btnBar.querySelectorAll("button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    drawPlayerHero();
  });
  drawPlayerHero();

  // per-player x role win rate, pivoted into one row per player so each
  // role column is independently sortable (sorts players by win rate in that role)
  const playerRolePivot = DATA.group.map(player => {
    const out = {player};
    for (const role of DATA.roles) {
      const row = playerRole.find(r => r.player === player && r.role === role);
      out[`${role}__winrate`] = row ? row.winrate : null;
      out[`${role}__games`] = row ? row.games : 0;
    }
    return out;
  });
  sortableTable("tbl-playerrole",
    [
      {key: "player", label: "Player", render: r => dn(r.player)},
      ...DATA.roles.map(role => ({
        key: `${role}__winrate`,
        label: role,
        render: r => r[`${role}__games`] ? barCell(r[`${role}__winrate`], r[`${role}__games`]) : `<span style="color:var(--muted)">-</span>`,
      })),
    ],
    playerRolePivot, {defaultSort: "player", defaultDir: 1});

  sortableTable("tbl-roleduo",
    [{key:"key", label:"Duo"}, {key:"games", label:"Games"}, {key:"winrate", label:"Win rate", render: r => barCell(r.winrate, r.games)}],
    roleDuoTable, {minGamesFilter: true, defaultSort:"winrate"});

  sortableTable("tbl-utility",
    [
      {key:"player", label:"Player", render: r => dn(r.player)},
      {key:"games", label:"Games"},
      {key:"TimeCCdEnemyHeroes", label:"Total CC/game", render: r => r.TimeCCdEnemyHeroes != null ? formatMinSec(Math.round(r.TimeCCdEnemyHeroes)) : "-"},
      {key:"TimeStunningEnemyHeroes", label:"Stun/game", render: r => r.TimeStunningEnemyHeroes != null ? formatMinSec(Math.round(r.TimeStunningEnemyHeroes)) : "-"},
      {key:"TimeRootingEnemyHeroes", label:"Root/game", render: r => r.TimeRootingEnemyHeroes != null ? formatMinSec(Math.round(r.TimeRootingEnemyHeroes)) : "-"},
      {key:"TimeSilencingEnemyHeroes", label:"Silence/game", render: r => r.TimeSilencingEnemyHeroes != null ? formatMinSec(Math.round(r.TimeSilencingEnemyHeroes)) : "-"},
      {key:"ProtectionGivenToAllies", label:"Protection/game", render: r => r.ProtectionGivenToAllies ?? "-"},
      {key:"ClutchHealsPerformed", label:"Clutch heals/game", render: r => r.ClutchHealsPerformed ?? "-"},
      {key:"EscapesPerformed", label:"Escapes/game", render: r => r.EscapesPerformed ?? "-"},
      {key:"VengeancesPerformed", label:"Vengeances/game", render: r => r.VengeancesPerformed ?? "-"},
    ],
    playerUtility, {defaultSort:"TimeCCdEnemyHeroes"});

  // per-player average stats
  sortableTable("tbl-playerstats",
    [{key:"player", label:"Player", render: r => dn(r.player)}, ...statCols.map(c => ({key:c, label:c, render: r => r[c] ?? "-"}))],
    playerStats, {defaultSort:"games"});
}
