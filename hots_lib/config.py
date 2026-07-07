"""Group-specific configuration. Edit this file for your own squad --
everything else in the project works unmodified, and produces output that
merges cleanly with anyone else in the group who runs it against their own
replay folder (see replay.qualifies -- nothing here is anchored to one
specific person)."""

import os
import platform
import sys

# Battletag display names (no #1234 -- replays only store the display name).
# EDIT THESE for your own group -- the examples below are placeholders.
GROUP = ["Player1", "Player2", "Player3", "Player4", "Player5", "Player6"]

# Minimum GROUP members required on one team, out of a 5-player team.
MIN_KNOWN = 5

# Alt-account battletag -> canonical GROUP name, so both accounts count together.
# Example only -- replace with your own group's alt accounts (or leave empty).
NAME_ALIASES = {
    "Player1Alt": "Player1",
    "Player1Alt2": "Player1",
    "Player3Alt": "Player3",
    "Player3Alt": "Player3",
    "Player6ALt": "Player6",
}

# Prettier dashboard name for a GROUP member, if you'd rather not show their
# exact battletag. Cosmetic only -- data files still use the GROUP name.
# Example only -- replace with your own group's preferred display names.
DISPLAY_NAMES = {
    "Player1": "P1",
}


def _default_docs_root():
    """Windows path is confirmed. The Mac path follows Blizzard's usual
    convention but hasn't been verified against an actual install -- check
    ~/Library/Application Support/Blizzard/Heroes of the Storm/ if it's wrong."""
    if platform.system() == "Darwin":
        return os.path.expanduser("~/Library/Application Support/Blizzard/Heroes of the Storm/Accounts")
    return os.path.expanduser(r"~\Documents\Heroes of the Storm\Accounts")


if len(sys.argv) > 1:
    # An argument was provided, so use it.
    DOCS_ROOT = os.path.expanduser(sys.argv[1])
else:
    # No argument was provided, so fall back to a default path.
    DOCS_ROOT = _default_docs_root()

# Canonical display order for the 6 current hero roles.
ROLES = ["Tank", "Bruiser", "Ranged Assassin", "Melee Assassin", "Healer", "Support"]
