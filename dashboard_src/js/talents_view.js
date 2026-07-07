// Persisted across re-renders (e.g. when "Min games" changes) so tweaking a
// global filter doesn't silently reset the hero/player/tier selection here.
let talentsHero = "All";
let talentsPlayer = "All";
let talentsTier = null;

function renderTalentsView() {
  const players = filteredPlayers();
  const main = document.getElementById("main");

  const heroes = [...new Set(players.map(p => p.hero))].sort();

  if (!heroes.length) {
    main.innerHTML = `
      <section class="panel">
        <h2>Win rate by talent pick</h2>
        <p class="hint">No games in this filter.</p>
      </section>
    `;
    return;
  }

  if (talentsTier === null) talentsTier = DATA.talentTiers[0];
  let selectedHero = heroes.includes(talentsHero) || talentsHero === "All" ? talentsHero : "All";
  let selectedPlayer = talentsPlayer;
  let selectedTier = talentsTier;

  main.innerHTML = `
    <section class="panel">
      <h2>Win rate by talent pick</h2>
      <div class="hint">Which talents are working for us and which aren't -- filter by hero and/or player to see who picks the best talents.</div>
      <div class="controls">
        <label>Hero:
          <select id="talentHeroSelect">
            <option value="All"${selectedHero === "All" ? " selected" : ""}>All</option>
            ${heroes.map(h => `<option value="${h}"${h === selectedHero ? " selected" : ""}>${h}</option>`).join("")}
          </select>
        </label>
        <label>Player:
          <select id="talentPlayerSelect">
            <option value="All"${selectedPlayer === "All" ? " selected" : ""}>All</option>
            ${DATA.group.map(p => `<option value="${p}"${p === selectedPlayer ? " selected" : ""}>${dn(p)}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="subtabs" id="talentTierBtns"></div>
      <div class="scroll" id="tbl-talents" style="margin-top:10px"></div>
    </section>
  `;

  const tierBar = document.getElementById("talentTierBtns");
  tierBar.innerHTML = DATA.talentTiers.map(t => `<button class="subtab${t===selectedTier?" active":""}" data-t="${t}">Tier ${t}</button>`).join("");

  function draw() {
    let rows = players.filter(p => p.talents && p.talents[selectedTier]);
    if (selectedHero !== "All") rows = rows.filter(p => p.hero === selectedHero);
    if (selectedPlayer !== "All") rows = rows.filter(p => p.name === selectedPlayer);

    if (!rows.length) {
      document.getElementById("tbl-talents").innerHTML = `<p class="hint">No talent data yet for this filter -- run parse_replays.py to backfill it.</p>`;
      return;
    }

    if (selectedHero === "All") {
      // Talent names aren't unique across heroes, so pair each with its hero
      // and show the hero as its own sortable column.
      const groups = new Map();
      for (const r of rows) {
        const key = `${r.hero}: ${r.talents[selectedTier]}`;
        if (!groups.has(key)) groups.set(key, { hero: r.hero, talent: r.talents[selectedTier], rows: [] });
        groups.get(key).rows.push(r);
      }
      const talentTable = [...groups.values()].map(v => ({ hero: v.hero, talent: v.talent, games: v.rows.length, winrate: computeWinrate(v.rows) }));
      sortableTable("tbl-talents",
        [
          {key: "hero", label: "Hero"},
          {key: "talent", label: "Talent"},
          {key: "games", label: "Games"},
          {key: "winrate", label: "Win rate", render: r => barCell(r.winrate, r.games)},
        ],
        talentTable, {minGamesFilter: true, defaultSort: "winrate"});
    } else {
      const talentTable = groupTable(rows, r => r.talents[selectedTier]);
      sortableTable("tbl-talents",
        [
          {key: "key", label: "Talent"},
          {key: "games", label: "Games"},
          {key: "winrate", label: "Win rate", render: r => barCell(r.winrate, r.games)},
        ],
        talentTable, {minGamesFilter: true, defaultSort: "winrate"});
    }
  }

  document.getElementById("talentHeroSelect").onchange = (e) => {
    selectedHero = talentsHero = e.target.value;
    draw();
  };
  document.getElementById("talentPlayerSelect").onchange = (e) => {
    selectedPlayer = talentsPlayer = e.target.value;
    draw();
  };
  tierBar.querySelectorAll("button").forEach(b => b.onclick = () => {
    selectedTier = talentsTier = parseInt(b.dataset.t, 10);
    tierBar.querySelectorAll("button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    draw();
  });

  draw();
}
