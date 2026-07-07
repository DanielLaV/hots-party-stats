#!/usr/bin/env python
"""Prints how many data/games.csv rows are new (by game_id) between a
before/after snapshot, broken down by mode. Used by refresh.sh to report
what a `git pull` actually added, since the pulled CSVs don't say so
themselves.

Usage: python count_new_games.py <before_csv> <after_csv>
"""
import csv
import sys
from collections import Counter

before_path, after_path = sys.argv[1], sys.argv[2]


def load(path):
    try:
        with open(path, newline="", encoding="utf-8") as f:
            return {row["game_id"]: row["mode"] for row in csv.DictReader(f)}
    except FileNotFoundError:
        return {}


before = load(before_path)
after = load(after_path)

added_modes = [mode for game_id, mode in after.items() if game_id not in before]

if not added_modes:
    print("No new games since last refresh.")
else:
    counts = Counter(added_modes)
    parts = ", ".join(f"{mode}: {n}" for mode, n in sorted(counts.items()))
    print(f"New games since last refresh: {parts} ({len(added_modes)} total)")
