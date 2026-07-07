#!/usr/bin/env python
"""Build a single self-contained dashboard.html from data/games.csv and data/players.csv.

Aggregation (win rates, map/hero/comp breakdowns, etc.) happens client-side in
JS, not here -- this script just ships the raw per-game and per-player rows as
JSON (plus config: GROUP/ROLES/DISPLAY_NAMES/MIN_KNOWN/season boundaries).
That's what lets the dashboard's season filter recompute everything live in
the browser instead of needing a rebuild per season combination.

HTML/CSS/JS source lives in dashboard_src/ -- this script just assembles them
with the data payload substituted in.
"""

import csv
import json
import os
import re

from hots_lib.config import DISPLAY_NAMES, GROUP, MIN_KNOWN, ROLES
from hots_lib.heroes import HERO_ROLE, resolve_role
from hots_lib.scoreboard import AWARD_FIELDS, TALENT_TIERS
from hots_lib.seasons import SEASONS, UNKNOWN_CURRENT_SEASON, season_for_date
from hots_lib.talent_names import talent_display_name

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(ROOT, "data")
GAMES_CSV = os.path.join(OUT_DIR, "games.csv")
PLAYERS_CSV = os.path.join(OUT_DIR, "players.csv")
DASHBOARD_HTML = os.path.join(ROOT, "dashboard.html")

SRC_DIR = os.path.join(ROOT, "dashboard_src")
TEMPLATE_HTML = os.path.join(SRC_DIR, "template.html")
STYLE_CSS = os.path.join(SRC_DIR, "style.css")
JS_DIR = os.path.join(SRC_DIR, "js")
# Concatenation order matters: core.js defines the shared state/helpers and
# bootstraps the page at the end, so it must load after the view renderers
# it calls (renderStatsView etc.) are defined.
JS_FILES = ["stats_view.js", "awards_view.js", "talents_view.js", "graphs_view.js", "fearless_view.js", "core.js"]

# Modes shown as dashboard tabs, in display order. "Custom/Brawl/Other" games
# (from hots_lib.modes.classify_mode) are deliberately left out here -- that
# bucket mixes brawls, vs-AI, and private lobbies and isn't a clean enough
# signal to show as its own tab.
MODES = ["Storm League", "ARAM", "Quick Match"]

NUMERIC_STAT_FIELDS = [
    "Takedowns", "SoloKill", "Deaths", "Assists", "HighestKillStreak",
    "HeroDamage", "SiegeDamage", "StructureDamage", "MinionDamage", "CreepDamage", "SummonDamage",
    "DamageTaken", "DamageSoaked", "Healing", "SelfHealing",
    "TeamfightHeroDamage", "TeamfightDamageTaken", "TeamfightHealingDone",
    "TimeSpentDead", "TimeCCdEnemyHeroes",
    "TimeStunningEnemyHeroes", "TimeRootingEnemyHeroes", "TimeSilencingEnemyHeroes",
    "ProtectionGivenToAllies", "ClutchHealsPerformed", "EscapesPerformed", "VengeancesPerformed",
    "ExperienceContribution",
]


def load_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def to_num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def award_label(field):
    """EndOfMatchAwardMostHeroDamageDoneBoolean -> Most Hero Damage Done"""
    label = field[len("EndOfMatchAward"):]
    if label.endswith("Boolean"):
        label = label[: -len("Boolean")]
    return re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", label)


AWARD_LABELS = [award_label(f) for f in AWARD_FIELDS]


def build():
    games = load_csv(GAMES_CSV)
    players = load_csv(PLAYERS_CSV)

    games_out = []
    for r in games:
        games_out.append(
            {
                "game_id": r["game_id"],
                "date": r["date"],
                "season": season_for_date(r["date"]),
                "map": r["map"],
                "mode": r["mode"],
                "win": r["win"] == "True",
                "game_length_seconds": to_num(r.get("game_length_seconds")),
                "missing_from_group": r["missing_from_group"],
                "team_heroes": r["team_heroes"],
                "team_comp": r["team_comp"],
                "enemy_heroes": r["enemy_heroes"],
                "enemy_comp": r["enemy_comp"],
            }
        )

    # Only ship rows for our own known group, on their own team -- these are
    # the only players.csv rows any dashboard table uses. Excludes opponents'
    # battletags from the shipped JSON entirely (privacy, and smaller payload)
    # -- this dashboard is served on the open internet, not just the repo.
    players_out = []
    for p in players:
        if p["is_known"] != "True" or p["is_my_team"] != "True":
            continue
        row = {
            "game_id": p["game_id"],
            "date": p["date"],
            "season": season_for_date(p["date"]),
            "map": p["map"],
            "mode": p["mode"],
            "win": p["win"] == "True",
            "name": p["name"],
            "hero": p["hero"],
            "class": p["class"],
        }
        for field in NUMERIC_STAT_FIELDS:
            row[field] = to_num(p.get(field))
        row["awards"] = [label for field, label in zip(AWARD_FIELDS, AWARD_LABELS) if p.get(field) not in (None, "", "0")]
        row["talents"] = {
            tier: talent_display_name(p[f"Tier{tier}Talent"])
            for tier in TALENT_TIERS
            if p.get(f"Tier{tier}Talent")
        }
        players_out.append(row)

    # Full hero roster for the Fearless draft tracker -- HERO_ROLE union
    # whatever's actually shown up in games, so a hero played before HERO_ROLE
    # got a manual entry for it (see hots_lib/heroes.py) still shows up.
    heroes_seen = set()
    for r in games_out:
        heroes_seen.update(r["team_heroes"].split("|"))
        heroes_seen.update(r["enemy_heroes"].split("|"))
    all_heroes = sorted(set(HERO_ROLE) | heroes_seen)
    # resolve_role needs a match date only for Tassadar's pre/post-rework
    # split (see hots_lib/heroes.py) -- "9999-12-31" always resolves to his
    # current role. Any hero missing from HERO_ROLE (a brand new release the
    # table hasn't been updated for yet) groups under "Unknown" instead of
    # crashing the build.
    hero_roles = {h: resolve_role(h, "9999-12-31") or "Unknown" for h in all_heroes}

    return {
        "modes": MODES,
        "group": GROUP,
        "roles": ROLES,
        "displayNames": DISPLAY_NAMES,
        "minKnown": MIN_KNOWN,
        "seasons": [label for label, _, _ in SEASONS] + [UNKNOWN_CURRENT_SEASON],
        "awardTypes": AWARD_LABELS,
        "talentTiers": TALENT_TIERS,
        "heroes": all_heroes,
        "heroRoles": hero_roles,
        # Sent back as the X-Api-Token header on Fearless writes (see
        # dashboard_src/js/fearless_view.js and api/auth.py). Not a real
        # secret once it's in this page's source -- see api/auth.py's
        # docstring -- just enough to stop casual griefing. Empty if
        # deploy/.env wasn't set up, in which case the Fearless tab can
        # still read but its writes will 401.
        "fearlessApiToken": os.environ.get("FEARLESS_API_TOKEN", ""),
        "games": games_out,
        "players": players_out,
    }


def render_html(data):
    with open(TEMPLATE_HTML, encoding="utf-8") as f:
        template = f.read()
    with open(STYLE_CSS, encoding="utf-8") as f:
        css = f.read()
    js = "\n".join(open(os.path.join(JS_DIR, name), encoding="utf-8").read() for name in JS_FILES)

    html = template.replace("__CSS__", css)
    html = html.replace("__DATA__", json.dumps(data, ensure_ascii=False))
    html = html.replace("__JS__", js)

    with open(DASHBOARD_HTML, "w", encoding="utf-8") as f:
        f.write(html)


if __name__ == "__main__":
    data = build()
    render_html(data)
    print(f"Wrote {DASHBOARD_HTML}")
