function renderAwardsView() {
  const players = filteredPlayers();
  const main = document.getElementById("main");

  const perPlayer = new Map();
  for (const p of DATA.group) perPlayer.set(p, { player: p, games: 0, totalAwards: 0 });
  for (const p of players) {
    const row = perPlayer.get(p.name);
    if (!row) continue; // not one of our named group
    row.games += 1;
    row.totalAwards += (p.awards || []).length;
  }
  const summary = [...perPlayer.values()].map(r => ({
    ...r,
    perGame: r.games ? Math.round(100 * r.totalAwards / r.games) / 100 : 0,
  }));

  const wonAwards = DATA.awardTypes.filter(a => players.some(p => (p.awards || []).includes(a)));

  main.innerHTML = `
    <section class="panel" style="margin-bottom:24px">
      <h2>Awards won per player</h2>
      <div class="hint">Total end-of-match awards won across all games, and the average per game.</div>
      <div id="tbl-awardsummary"></div>
    </section>
    <section class="panel">
      <h2>Leaderboard by award</h2>
      <div class="controls">
        <label>Award:
          <select id="awardTypeSelect">
            ${wonAwards.map(a => `<option value="${a}">${a}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="scroll" id="tbl-awardtype" style="margin-top:10px"></div>
    </section>
  `;

  sortableTable("tbl-awardsummary",
    [
      {key: "player", label: "Player", render: r => dn(r.player)},
      {key: "games", label: "Games"},
      {key: "totalAwards", label: "Total awards"},
      {key: "perGame", label: "Awards / game"},
    ],
    summary, {defaultSort: "perGame"});

  if (!wonAwards.length) {
    document.getElementById("tbl-awardtype").innerHTML = `<p class="hint">No award data yet -- run parse_replays.py to backfill it.</p>`;
    return;
  }

  let selectedAward = wonAwards[0];

  function drawAwardType() {
    const counts = new Map();
    for (const p of DATA.group) counts.set(p, { player: p, games: 0, count: 0 });
    for (const p of players) {
      const row = counts.get(p.name);
      if (!row) continue;
      row.games += 1;
      if ((p.awards || []).includes(selectedAward)) row.count += 1;
    }
    const rows = [...counts.values()].map(r => ({
      ...r,
      rate: r.games ? Math.round(1000 * r.count / r.games) / 10 : 0,
    }));
    sortableTable("tbl-awardtype",
      [
        {key: "player", label: "Player", render: r => dn(r.player)},
        {key: "count", label: "Times won"},
        {key: "games", label: "Games"},
        {key: "rate", label: "% of games"},
      ],
      rows, {defaultSort: "count"});
  }
  document.getElementById("awardTypeSelect").onchange = (e) => {
    selectedAward = e.target.value;
    drawAwardType();
  };
  drawAwardType();
}
