// Backed by the hots-api container (see api/fearless.py) so everyone viewing
// the live dashboard sees the same picks -- local edits apply optimistically
// and push in the background, and a poll while this tab is open picks up
// anyone else's changes. Requires the deployed dashboard (relative fetches
// to /api/fearless); a double-clicked local dashboard.html has nothing to
// talk to and will show the error state below.
const FEARLESS_API_BASE = "/api/fearless";
const FEARLESS_POLL_MS = 4000;
const FEARLESS_MAX_GAMES = 10;
const FEARLESS_SLOTS = 5;

let fearlessGames = null; // null until the first GET resolves
let fearlessLoadError = null;
let fearlessPollStarted = false;

function emptyFearlessGame() {
  return { our: Array(FEARLESS_SLOTS).fill(null), enemy: Array(FEARLESS_SLOTS).fill(null) };
}

async function fetchFearlessState() {
  const res = await fetch(FEARLESS_API_BASE);
  if (!res.ok) throw new Error(`GET ${FEARLESS_API_BASE} failed: ${res.status}`);
  return res.json();
}

async function pushFearlessState(state) {
  const res = await fetch(FEARLESS_API_BASE, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Api-Token": DATA.fearlessApiToken },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error(`PUT ${FEARLESS_API_BASE} failed: ${res.status}`);
  return res.json();
}

async function resetFearlessState() {
  const res = await fetch(`${FEARLESS_API_BASE}/reset`, {
    method: "POST",
    headers: { "X-Api-Token": DATA.fearlessApiToken },
  });
  if (!res.ok) throw new Error(`POST ${FEARLESS_API_BASE}/reset failed: ${res.status}`);
  return res.json();
}

// Pulls the latest state from the server. Only triggers a re-render if it
// actually differs from what's on screen, so an idle poll doesn't reset
// scroll position or flicker the dropdowns for no reason.
async function refreshFearlessState() {
  try {
    const state = await fetchFearlessState();
    const changed = JSON.stringify(state) !== JSON.stringify(fearlessGames);
    fearlessLoadError = null;
    if (changed) {
      fearlessGames = state;
      if (currentView === "fearless") renderFearlessView();
    }
  } catch (err) {
    fearlessLoadError = "Couldn't reach the Fearless API. This tab needs the live deployed dashboard (not a local copy of dashboard.html) with the hots-api container running.";
    if (currentView === "fearless") renderFearlessView();
  }
}

function startFearlessPolling() {
  if (fearlessPollStarted) return;
  fearlessPollStarted = true;
  setInterval(() => {
    if (currentView === "fearless") refreshFearlessState();
  }, FEARLESS_POLL_MS);
}

function isFearlessGameFull(g) {
  return g.our.every(h => h) && g.enemy.every(h => h);
}

// Grows the board one game at a time as each is completed, capped at 10.
// Returns whether it actually changed anything, so the caller knows whether
// to push the new state (otherwise a new empty game only shows up for other
// viewers once someone makes their next pick).
function ensureFearlessGamesLength() {
  let changed = false;
  while (fearlessGames.length < FEARLESS_MAX_GAMES && isFearlessGameFull(fearlessGames[fearlessGames.length - 1])) {
    fearlessGames.push(emptyFearlessGame());
    changed = true;
  }
  return changed;
}

// Every hero played this run, by either team, in any game -- we never play a
// hero once it's shown up in the game at all, regardless of who picked it.
// Removed from our side's dropdowns and the sidebar entirely. The enemy
// isn't playing fearless, so this never restricts their side.
// `exceptGameIdx`/`exceptSide`/`exceptSlot` lets a slot's own current pick
// stay in its own option list instead of vanishing.
function heroesUnavailableForUs(exceptGameIdx, exceptSide, exceptSlot) {
  const used = new Set();
  fearlessGames.forEach((g, gi) => {
    ["our", "enemy"].forEach(side => {
      g[side].forEach((h, si) => {
        if (h && !(gi === exceptGameIdx && side === exceptSide && si === exceptSlot)) used.add(h);
      });
    });
  });
  return used;
}

// Within one game, nobody on either team can run the same hero twice, so a
// hero on either team's other slots in this same game is excluded from both
// sides' pickers -- this is the only restriction that applies to the enemy.
function heroesTakenThisGame(gameIdx, side, exceptSlot) {
  const g = fearlessGames[gameIdx];
  const used = new Set();
  g.our.forEach((h, si) => { if (h && !(side === "our" && si === exceptSlot)) used.add(h); });
  g.enemy.forEach((h, si) => { if (h && !(side === "enemy" && si === exceptSlot)) used.add(h); });
  return used;
}

function fearlessHeroSelect(gameIdx, side, slotIdx) {
  const current = fearlessGames[gameIdx][side][slotIdx];
  const excluded = side === "our"
    ? heroesUnavailableForUs(gameIdx, "our", slotIdx)
    : heroesTakenThisGame(gameIdx, "enemy", slotIdx);
  const options = DATA.heroes.filter(h => h === current || !excluded.has(h));
  return `
    <select class="hots-select fearless-pick" data-game="${gameIdx}" data-side="${side}" data-slot="${slotIdx}">
      <option value="">--</option>
      ${options.map(h => `<option value="${h}" ${h === current ? "selected" : ""}>${h}</option>`).join("")}
    </select>
  `;
}

// Grouped by role (in the same canonical order as everywhere else in the
// dashboard) so it's obvious at a glance which roles are running thin.
function renderFearlessHeroGroups(heroes) {
  if (!heroes.length) return `<p class="hint">All heroes used.</p>`;
  const byRole = new Map();
  for (const h of heroes) {
    const role = DATA.heroRoles[h] || "Unknown";
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role).push(h);
  }
  const orderedRoles = [...DATA.roles, "Unknown"].filter(r => byRole.has(r));
  return orderedRoles.map(role => `
    <div class="fearless-role-group">
      <div class="fearless-role-header">
        <span class="role-dot ${roleClass(role)}"></span>${role}
        <span class="fearless-role-count">${byRole.get(role).length}</span>
      </div>
      <div class="fearless-hero-list">
        ${byRole.get(role).map(h => `<div class="fearless-hero-chip">${h}</div>`).join("")}
      </div>
    </div>
  `).join("");
}

function renderFearlessView() {
  const main = document.getElementById("main");

  if (fearlessGames === null) {
    if (fearlessLoadError) {
      // Don't refetch here -- the poll loop below already retries on its
      // own cadence. Refetching on every render too would tight-loop as
      // fast as promises settle for as long as the API stays unreachable.
      main.innerHTML = `<section class="panel"><p class="hint">${fearlessLoadError}</p></section>`;
    } else {
      main.innerHTML = `<p class="hint">Loading Fearless board...</p>`;
      refreshFearlessState();
    }
    startFearlessPolling();
    return;
  }

  if (ensureFearlessGamesLength()) {
    pushFearlessState(fearlessGames).catch(err => console.error("Failed to save new Fearless game slot:", err));
  }

  const usedByUs = heroesUnavailableForUs(-1, null, -1);
  const availableForUs = DATA.heroes.filter(h => !usedByUs.has(h));

  main.innerHTML = `
    <div class="fearless-layout">
      <aside class="fearless-sidebar">
        <div class="fearless-sidebar-header">
          <h2>Available heroes</h2>
          <button class="fearless-reset-btn" id="fearlessReset">Reset</button>
        </div>
        <div class="hint">Any hero played this run, by either team, is removed here and from our dropdowns. The enemy isn't playing fearless, so their list is never restricted. Shared live with everyone viewing this page.</div>
        <div class="fearless-hero-groups" id="fearlessAvailableList">
          ${renderFearlessHeroGroups(availableForUs)}
        </div>
      </aside>
      <div class="fearless-games">
        ${fearlessGames.map((g, gi) => `
          <section class="panel fearless-game">
            <h2>Game ${gi + 1}</h2>
            <div class="fearless-teams">
              <div class="fearless-team">
                <div class="fearless-team-label">Our team</div>
                ${Array.from({length: FEARLESS_SLOTS}, (_, si) => fearlessHeroSelect(gi, "our", si)).join("")}
              </div>
              <div class="fearless-team">
                <div class="fearless-team-label">Enemy team</div>
                ${Array.from({length: FEARLESS_SLOTS}, (_, si) => fearlessHeroSelect(gi, "enemy", si)).join("")}
              </div>
            </div>
          </section>
        `).join("")}
      </div>
    </div>
  `;

  main.querySelectorAll(".fearless-pick").forEach(sel => sel.onchange = (e) => {
    const gi = parseInt(sel.dataset.game, 10);
    const side = sel.dataset.side;
    const si = parseInt(sel.dataset.slot, 10);
    fearlessGames[gi][side][si] = e.target.value || null;
    renderFearlessView();
    pushFearlessState(fearlessGames).catch(err => console.error("Failed to save Fearless pick:", err));
  });

  document.getElementById("fearlessReset").onclick = () => {
    if (confirm("Reset the Fearless board? This clears every game's picks for everyone viewing this page and can't be undone.")) {
      resetFearlessState().then(state => {
        fearlessGames = state;
        renderFearlessView();
      }).catch(err => {
        alert("Failed to reset: " + err.message);
      });
    }
  };
}
