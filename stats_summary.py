#!/usr/bin/env python
"""Read data/games.csv (produced by parse_replays.py) and print summary stats."""

import csv
import os
import sys
from collections import defaultdict

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
GAMES_CSV = os.path.join(OUT_DIR, "games.csv")

MIN_SAMPLE = 3  # don't bother printing rows with fewer than this many games


def load_games():
    with open(GAMES_CSV, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def winrate(rows):
    if not rows:
        return 0.0, 0
    wins = sum(1 for r in rows if r["win"] == "True")
    return 100.0 * wins / len(rows), len(rows)


def print_table(title, groups, min_sample=MIN_SAMPLE):
    print(f"\n== {title} ==")
    rows = [(k, rs) for k, rs in groups.items() if len(rs) >= min_sample]
    rows.sort(key=lambda kv: -len(kv[1]))
    if not rows:
        print("  (no groups with enough samples)")
        return
    for key, rs in rows:
        wr, n = winrate(rs)
        print(f"  {key:<30} {n:>4} games   {wr:5.1f}% win rate")


def section_mode_split(games):
    print("\n" + "=" * 60)
    print("GAMES BY MODE")
    print("=" * 60)
    by_mode = defaultdict(list)
    for r in games:
        by_mode[r["mode"]].append(r)
    print_table("Win rate by mode", by_mode, min_sample=1)


def section_for_mode(games, mode_name):
    mode_games = [r for r in games if r["mode"] == mode_name]
    if not mode_games:
        print(f"\n(no games found for mode = {mode_name})")
        return

    print("\n" + "=" * 60)
    print(f"{mode_name.upper()}  ({len(mode_games)} qualifying games)")
    print("=" * 60)

    overall_wr, overall_n = winrate(mode_games)
    print(f"Overall win rate: {overall_wr:.1f}% ({overall_n} games)")

    by_map = defaultdict(list)
    by_hero_me = defaultdict(list)
    by_missing = defaultdict(list)
    by_team_comp = defaultdict(list)

    # any-teammate hero presence (win rate when hero X is on our team, by anyone)
    by_team_hero_any = defaultdict(list)
    # enemy hero presence (win rate when hero X is on the enemy team)
    by_enemy_hero_any = defaultdict(list)

    for r in mode_games:
        by_map[r["map"]].append(r)
        by_hero_me[r["my_hero"]].append(r)
        missing = r["missing_from_group"] or "(all 6 accounted for / other elsewhere)"
        by_missing[missing].append(r)
        by_team_comp[r["team_comp"]].append(r)

        for h in r["team_heroes"].split("|"):
            by_team_hero_any[h].append(r)
        for h in r["enemy_heroes"].split("|"):
            by_enemy_hero_any[h].append(r)

    print_table("Win rate by map", by_map)
    print_table("Win rate by hero (me)", by_hero_me)
    print_table("Win rate by who sat out that game", by_missing, min_sample=1)
    print_table("Win rate by our team composition (Tank-Bruiser-RangedAssassin-MeleeAssassin-Healer-Support counts)", by_team_comp)

    print_table("Win rate when hero X is on OUR team (any of the 5)", by_team_hero_any, min_sample=5)
    print_table("Win rate when hero X is on the ENEMY team (what we beat / lose to)", by_enemy_hero_any, min_sample=5)


def main():
    games = load_games()
    section_mode_split(games)
    section_for_mode(games, "Storm League")
    section_for_mode(games, "ARAM")
    section_for_mode(games, "Quick Match")


if __name__ == "__main__":
    main()
