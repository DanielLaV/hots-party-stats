"""Maps a replay's internal talent identifiers (e.g. "JainaFrostboltWintersReach")
to the human-readable names players see in-game (e.g. "Winter's Reach").

hots_lib/data/talent_names.json is vendored from the heroespatchnotes/heroes-talents
project (https://github.com/heroespatchnotes/heroes-talents, MIT licensed), whose
`talentTreeId` field is documented as matching the identifier replay files use.
It reflects only the current/latest game data, so talents from older,
reworked-away hero kits aren't in it.

hots_lib/data/talent_name_overrides.json fills in as many of those gaps as
possible, sourced from that same project's full git history (which tracks
older patches even though its current snapshot doesn't) plus manual research
for identifiers older than the project's earliest commit. Anything still
missing falls back to its raw internal identifier instead of failing.
"""

import json
import os

_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

with open(os.path.join(_DATA_DIR, "talent_names.json"), encoding="utf-8") as _f:
    TALENT_NAMES = json.load(_f)

with open(os.path.join(_DATA_DIR, "talent_name_overrides.json"), encoding="utf-8") as _f:
    TALENT_NAMES.update(json.load(_f))


def talent_display_name(talent_id):
    return TALENT_NAMES.get(talent_id, talent_id)
