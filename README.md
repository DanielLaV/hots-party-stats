# HotS Stack Stats

Turns your local Heroes of the Storm replay files into a win-rate dashboard
for a specific group of regular teammates: maps, heroes, team comps, roles,
and per-player scoreboard stats, split by game mode (Storm League / ARAM /
Quick Match).

It only looks at games where at least `MIN_KNOWN` (default 5) of your named
group were on the same team, so solo-queue and pickup games with randoms are
excluded automatically. Playing solo? Set `GROUP` to just your own battletag
and `MIN_KNOWN` to `1` and it'll track every game you play instead, group or
not.

## Table of Contents

- [Requirements](#requirements)
- [Setup](#setup)
- [Configure it for yourself](#configure-it-for-yourself)
- [Usage](#usage)
- [Running it locally (to test the Fearless tab)](#running-it-locally-to-test-the-fearless-tab)
- [Sharing data with your team](#sharing-data-with-your-team)
- [How it works, briefly](#how-it-works-briefly)
- [Data available in the replay files but not currently used](#data-available-in-the-replay-files-but-not-currently-used)
- [License](#license)

## Requirements

- **Windows or Mac.** `DOCS_ROOT` in `hots_lib/config.py` picks a default
  replay location based on your OS: `~\Documents\Heroes of the Storm\Accounts`
  on Windows (confirmed: that's what this project was built against), or
  `~/Library/Application Support/Blizzard/Heroes of the Storm/Accounts` on
  Mac (Blizzard's usual convention for its games). If it can't find your
  replays, check next to
  `~/Library/Application Support/Blizzard/Heroes of the Storm/` for the
  correct folder and hardcode it in `DOCS_ROOT`.
- **Python 3.9+.** `heroprotocol` (the Blizzard library that decodes replay
  files) still depends on the stdlib `imp` module, which was removed in
  Python 3.12. `hots_lib/__init__.py` installs a small compatibility shim
  (`hots_lib/_py312_imp_shim.py`) that patches `imp` back in on 3.12+, so any
  Python 3.9 or newer should work, so you shouldn't need to install a second
  Python version alongside your usual one.

## Setup

Windows:

```
git clone https://github.com/yourusername/hots-party-stats.git
cd hots-party-stats
python -m venv venv
venv\Scripts\pip install -r requirements.txt
```

Mac/Linux:

```
git clone https://github.com/yourusername/hots-party-stats.git
cd hots-party-stats
python3 -m venv venv
venv/bin/pip install -r requirements.txt
```

`requirements.txt` installs `heroprotocol` straight from Blizzard's GitHub repo.

The `venv\Scripts\python`/`venv/bin/python` commands used throughout the rest
of this README are the Windows/Mac equivalents of each other, respectively.

## Configure it for yourself

**Do this before running anything.** `hots_lib/config.py` ships with a
placeholder `GROUP` (`Player1`..`Player6`) and placeholder `NAME_ALIASES`/
`DISPLAY_NAMES` as examples of the shape each expects; they don't refer to
anyone real. `data/games.csv`/`data/players.csv` likewise ship as a small
synthetic sample (so `build_dashboard.py`/`dev/run.sh` work out of the box
for trying the dashboard), not real match history. Replace both with your
own group's data: edit `GROUP`, `MIN_KNOWN`, `NAME_ALIASES`, and
`DISPLAY_NAMES` near the top of `hots_lib/config.py`, then run
`parse_replays.py` against your own replay folder to regenerate the CSVs
(see "Usage" below).

| Constant | What it is |
|---|---|
| `GROUP` | Everyone in your regular group (battletag display names, no `#1234`, since replays don't store the discriminator) |
| `MIN_KNOWN` | How many of `GROUP` must share a team for a game to count (out of 5) |
| `NAME_ALIASES` | Maps an alt account's battletag to someone's canonical `GROUP` name, so both accounts' games get counted together |
| `DISPLAY_NAMES` | Optional prettier name shown in the dashboard for a `GROUP` member instead of their exact battletag (e.g. `"Player1": "P1"`). Cosmetic only; doesn't affect the data files |

Both `parse_replays.py` and `build_dashboard.py` import these from
`hots_lib/config.py`, so you only ever need to edit names in one place.

No one person is treated as "you" anywhere in the logic: each game's "our
team" is whichever of the two teams has more `GROUP` members on it, not
whoever happens to run the script. That's deliberate: it means everyone in
the group gets identical output for the same shared match, which is what
makes the merging described below work. See "Sharing data with your team".

Everything else under `hots_lib/` (hero role table, game mode IDs, scoreboard
stat list) is shared, game-level data that isn't specific to any one group,
so you shouldn't need to touch it, though see the caveats below about the two
tables that need occasional manual upkeep.

## Usage

```
venv\Scripts\python parse_replays.py    # scans all local replays, writes data/games.csv and data/players.csv
venv\Scripts\python build_dashboard.py  # reads those CSVs, writes dashboard.html
```

Then just open `dashboard.html` in a browser: it's a single self-contained
file (data is embedded as JSON), so it works by double-clicking it, no server
required.

The dashboard has five tabs: Stats, Awards, Talents, Graphs, and **Fearless**
(a League of Legends Fearless Draft-style tracker for a real-time series:
pick heroes for up to 10 games and it enforces that your side never repeats a
hero used in any earlier game, by either team). Fearless is the one exception
to "no server required": its picks are shared live across everyone viewing
the page, which needs the small API in `api/` (see "Running it locally"
below, and `deploy/README.md` for the real deployment). Stats/Awards/Talents/
Graphs are unaffected either way; they only ever read the embedded JSON.

Re-run both scripts any time you want to refresh the data with newly played
games. `parse_replays.py` re-scans every replay file on disk each time (there's
no skip-if-unchanged mode, so it can take a while if you have thousands of
replays), but it **merges** the results into `data/games.csv`/`data/players.csv`
rather than overwriting them (see "Sharing data with your team" below for
why that matters).

There's also `stats_summary.py`, a plain-console version of the same win-rate
breakdowns (map/hero/comp/who-sat-out) if you just want a quick text readout
without opening the dashboard.

## Running it locally (to test the Fearless tab)

Double-clicking `dashboard.html` is enough for every tab except Fearless,
which needs its API reachable at the same origin the page is served from
(see "Fearless tab" above). `dev/` spins up a throwaway local copy of that
setup: an nginx container routing `/api/` to the Flask API in `api/`,
matching how `deploy/` wires things up for real, just without TLS or a real
domain:

```
dev/run.sh
```

This rebuilds `dashboard.html` and starts both containers via
`dev/docker-compose.yml`; open `http://localhost:8080` and the Fearless tab
will work like it does in production, picks and all. Requires Docker, and
the venv from Setup above (it reuses `venv/bin/python` to run
`build_dashboard.py`).

When you're done:

```
cd dev && docker compose down
```

Nothing under `dev/` is part of the real deployment; see `deploy/README.md`
for that.

## Sharing data with your team

Because "our team" is always determined by group majority rather than by
whoever ran the script (see above), your output and a teammate's output for
the exact same match are identical except for the local file path column,
which is what makes the following safe:

- `parse_replays.py` merges new results into the existing CSVs by a stable
  game identifier (the match's random simulation seed + map name; see "How
  it works" below) instead of overwriting them. Running it never discards
  games that are already recorded.
- If you commit your generated `data/games.csv`/`data/players.csv` and a
  teammate clones the repo and runs `parse_replays.py` against their own
  replay folder, their run **adds** to what's there: any games their client
  still has that yours doesn't (or vice versa), rather than replacing your
  data with theirs.
- This matters because the game only keeps roughly the most recent 4096
  replays per account before deleting older ones, so different people's
  machines typically have overlapping but not identical history. Merging
  means the combined dataset keeps growing rather than being capped at
  whatever's on the single machine that most recently ran the script.
- The same benefit applies even if you never share this with anyone: each
  time you re-run the parser, games that have since aged out of your local
  replay folder stay in the CSV instead of disappearing. A fresh row always
  wins over a stale one for the same game (e.g. if `HERO_ROLE` gets updated
  for a new hero after you already recorded a game with them), so re-running
  keeps existing data current rather than frozen at whatever it looked like
  the first time.

This template ships `data/games.csv`/`data/players.csv` as a small synthetic
sample (fake names, fake games) just so the scripts run out of the box;
replace it with your own group's output from `parse_replays.py`. Once you do,
committing those CSVs to your fork works as a shared baseline dataset the
way described above. If you'd rather keep your own copy private and never
share CSVs at all, that still works fine: just add `data/` back to
`.gitignore` and nothing about this is required.

## How it works, briefly

Replay files (`.StormReplay`) are MPQ archives containing several compressed
event streams, decoded here with Blizzard's `heroprotocol` library:

- `replay.details`: player list, heroes, teams, win/loss, map title
  (`m_title`), and match end time (`m_timeUTC`)
- `replay.initData`: lobby/game options, including the matchmaking queue id
  used to tell Storm League / Quick Match / ARAM apart, and the match's
  random simulation seed (`m_randomValue`)
- `replay.attributes.events`: draft ban count (used alongside the queue id
  for mode detection)
- `replay.tracker.events`: end-of-game scoreboard stats (`SScoreResultEvent`)

Note that none of this comes from the replay filename: map name and match
time are read from the replay data itself, not parsed out of
`YYYY-MM-DD HH.MM.SS Map.StormReplay`. That matters for two reasons: it
doesn't skip replays that were saved under a non-standard name (custom lobby
names, etc.; those just get bucketed into "Custom/Brawl/Other" by mode
detection like any other unusual game), and it means the same match parsed on
two different machines produces the same map name and time even if the
filename would've differed for some reason.

Three things are worth knowing about the heuristics/design involved:

- **The merge key** (`game_id` in `parse_replay()`) is the match's random
  simulation seed plus its map name. Heroes of the Storm is a deterministic
  lockstep simulation, so that seed is identical across every participant's
  copy of the same match, unlike a filename- or wall-clock-derived key,
  which could differ across machines in different timezones (or even just
  clock drift) and cause the same real match to be recorded as two separate
  rows when merging two people's data. See `merge_and_write_csv()`.

- **Game mode detection** (`classify_mode` in `hots_lib/modes.py`) is based on
  Blizzard's internal matchmaking queue id, which gets reissued periodically
  as map pools change. The known ids are hardcoded per mode; if Blizzard ships
  a patch with a new id this script hasn't seen, it falls back to a
  bans-based guess and prints a `[mode] unrecognized ammId=...` warning so you
  know to go add the new id to the appropriate set.
- **Hero roles** (`HERO_ROLE` in `hots_lib/heroes.py`) are a hand-maintained
  table (sourced from the Heroes of the Storm wiki), not something read from
  the replay: the game's own per-replay class attribute only encodes the
  old 4-role system (Warrior/Assassin/Support/Specialist) and doesn't
  distinguish Tank from Bruiser, nor Ranged from Melee Assassin. This table
  needs a manual entry added whenever Blizzard releases a new hero. Two
  heroes need special-cased resolution instead of a static lookup: Tassadar
  switched roles in a patch (`resolve_role` checks match date), and Varian's
  role depends on his talent-driven ultimate, read from
  `EndOfGameTalentChoices` (`refine_varian_role`).
- **Talent names** (`hots_lib/data/talent_names.json`, via `hots_lib/talent_names.py`)
  map a replay's internal talent identifiers (e.g. `JainaFrostboltWintersReach`)
  to the names shown in-game (e.g. "Winter's Reach"), since the replay itself
  only stores the internal id. Vendored from
  [heroespatchnotes/heroes-talents](https://github.com/heroespatchnotes/heroes-talents)
  (MIT licensed), which reflects only the current game data. Older,
  reworked-away talents are filled in by `hots_lib/data/talent_name_overrides.json`,
  sourced from that same project's git history where possible, and manual
  research for identifiers older than the project's earliest commit. Anything
  still unmapped falls back to its raw internal id instead of failing.

## Data available in the replay files but not currently used

`SCORE_STAT_FIELDS` in `hots_lib/scoreboard.py` already pulls in per-player
combat/objective stats, all 41 `EndOfMatchAward*Boolean` fields, and full
talent picks per tier (`EndOfGameTalentChoices`). `replay.tracker.events` has
a bit more in it beyond that. Roughly in order of effort vs. payoff:

- **Draft/ban data** (`SHeroBannedEvent`, `SHeroPickedEvent`): full ban
  list and pick order per Storm League game. Would let you see what gets
  banned against your group specifically, and who ends up with last pick
  most often.
- **Blizzard's own lifetime/account counters** that happen to be embedded in
  every game's payload (`WinsWarrior`, `PlaysAssassin`, etc., cumulative
  career stats, not per-game), and seasonal crossover-event trackers (Lunar
  New Year, Starcraft dailies, Pachimari Mania) are skipped on purpose as
  irrelevant noise for per-match analysis.
- **Kill participation** (`SUnitDiedEvent`): has killer/victim unit ids and
  x/y death coordinates for every unit death in the game, not just heroes.
  With extra work cross-referencing `SUnitBornEvent` to resolve unit ids back
  to the player controlling them, this could build a "who kills whom most"
  matchup network and death-location heatmaps. More effort than the above
  since it requires tracking unit identity across events rather than reading
  one summary event.
- **Unit position snapshots** (`SUnitPositionsEvent`): periodic position
  data for every unit. Could produce movement/teamfight-location heatmaps;
  more a cool visualization than a stat that changes any decisions.

Two other event streams exist in each replay but are deliberately not parsed
at all:

- `replay.game.events`: raw clicks, ability usage, and camera commands.
  Could give APM or precise ability-usage timing, but it's the largest event
  stream by far and would meaningfully slow down parsing across a large
  replay collection for questions this project isn't trying to answer.
- `replay.message.events`: chat and pings. Could show who pings or types
  the most, but that's social trivia rather than performance data, and it
  means reading actual chat log content.

## License

MIT, see [LICENSE](LICENSE). Use it, fork it, modify it, whatever's useful
to your own group.
