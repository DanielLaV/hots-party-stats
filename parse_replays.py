#!/usr/bin/env python
"""
Scan all local Heroes of the Storm replay files and pull out the games where
at least MIN_KNOWN members of GROUP were on the same team.

No single person is privileged: "our team" each game is whichever of the two
teams has the most GROUP members, not "whoever ran the script's team". That
means everyone in the group gets identical output for the same shared match,
which is what lets multiple people's runs (or repeated runs against a
replay folder that's had old files rotated out) merge into one accumulating
dataset instead of each run overwriting the last.

Configure this for your own group in hots_lib/config.py.

Output:
  data/games.csv   - one row per qualifying game
  data/players.csv - one row per player per qualifying game (long format, easy to pivot)
"""

import os
import sys

from hots_lib.config import DOCS_ROOT, GROUP
from hots_lib.csv_io import merge_and_write_csv
from hots_lib.replay import class_counts, comp_signature, find_replay_files, parse_replay, qualifies
from hots_lib.scoreboard import SCORE_STAT_FIELDS, TALENT_TIERS, attach_score_stats

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    replay_files = find_replay_files()
    print(f"Found {len(replay_files)} replay files under {DOCS_ROOT}")

    games_rows = []
    players_rows = []

    n_ok, n_err, n_qualify = 0, 0, 0

    for path in replay_files:
        try:
            game = parse_replay(path)
        except Exception as e:
            n_err += 1
            print(f"[error] {path}: {e}", file=sys.stderr)
            continue
        n_ok += 1

        result = qualifies(game)
        if result is None:
            continue
        our_team, other_team = result
        n_qualify += 1

        try:
            attach_score_stats(game)
        except Exception as e:
            print(f"[error] score stats for {game['path']}: {e}", file=sys.stderr)

        win = our_team[0]["result"] == 1
        known_on_team = [p for p in our_team if p["name"] in GROUP]
        our_team_names = {p["name"] for p in our_team}
        missing = sorted(set(GROUP) - our_team_names)  # the one of GROUP not on our team this game
        enemy_known = [p["name"] for p in other_team if p["name"] in GROUP]

        game_id = game["game_id"]

        games_rows.append(
            {
                "game_id": game_id,
                "date": game["date"],
                "time": game["time"],
                "map": game["map"],
                "mode": game["mode"],
                "win": win,
                "game_length_seconds": game["game_length_seconds"],
                "known_on_team": len(known_on_team),
                "missing_from_group": "|".join(missing),
                "missing_played_vs_us": "|".join(enemy_known),
                "team_names": "|".join(p["name"] for p in our_team),
                "team_heroes": "|".join(p["hero"] for p in our_team),
                "team_comp": comp_signature(our_team),
                "enemy_heroes": "|".join(p["hero"] for p in other_team),
                "enemy_comp": comp_signature(other_team),
                "path": game["path"],
            }
        )

        for p in game["players"]:
            row = {
                "game_id": game_id,
                "date": game["date"],
                "map": game["map"],
                "mode": game["mode"],
                "win": (p["result"] == 1),
                "name": p["name"],
                "hero": p["hero"],
                "class": p["class"],
                "is_my_team": p["team"] == our_team[0]["team"],
                "is_known": p["name"] in GROUP,
            }
            for stat in SCORE_STAT_FIELDS:
                row[stat] = p["stats"].get(stat, "")
            for tier in TALENT_TIERS:
                row[f"Tier{tier}Talent"] = p["talents"].get(tier, "")
            players_rows.append(row)

    games_csv = os.path.join(OUT_DIR, "games.csv")
    players_csv = os.path.join(OUT_DIR, "players.csv")

    games_total, games_new = merge_and_write_csv(games_csv, games_rows, ["game_id"])
    players_total, players_new = merge_and_write_csv(players_csv, players_rows, ["game_id", "name"])

    print(f"Parsed OK: {n_ok}, errors: {n_err}, qualifying games this scan: {n_qualify}")
    print(f"Wrote {games_csv} ({games_total} games total, {games_new} new this run)")
    print(f"Wrote {players_csv} ({players_total} rows total, {players_new} new this run)")


if __name__ == "__main__":
    main()
