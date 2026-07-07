"""CSV merge-on-write, so repeated or multi-person runs accumulate data
instead of each run overwriting the last."""

import csv
import os


def merge_and_write_csv(path, new_rows, key_fields):
    """Merge new_rows into any existing CSV at `path`, keyed by key_fields,
    instead of overwriting it wholesale. New rows win on key collisions.
    Output is sorted by key so the file's git diffs are stable and readable
    instead of shuffling every run."""
    combined = {}
    if os.path.exists(path):
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                combined[tuple(str(row.get(k, "")) for k in key_fields)] = row

    n_before = len(combined)
    for row in new_rows:
        combined[tuple(str(row.get(k, "")) for k in key_fields)] = row

    if not combined:
        return 0, 0

    # Union of fieldnames, new_rows' columns first, so a schema change (e.g. a
    # newly added stat column) doesn't get buried after old columns for rows
    # that still only have the old schema.
    fieldnames = list(new_rows[0].keys()) if new_rows else list(next(iter(combined.values())).keys())
    for row in combined.values():
        for k in row.keys():
            if k not in fieldnames:
                fieldnames.append(k)

    rows_sorted = sorted(combined.values(), key=lambda r: tuple(str(r.get(k, "")) for k in key_fields))

    with open(path, "w", newline="", encoding="utf-8") as f:
        # lineterminator="\n" -- csv's default is "\r\n", which would stamp
        # CRLF onto every line (not just new ones) on every run, making the
        # whole file look changed in git diff instead of just the new rows.
        w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        w.writeheader()
        w.writerows(rows_sorted)

    return len(combined), len(combined) - n_before
