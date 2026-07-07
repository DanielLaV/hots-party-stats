"""Per-replay parsing: header/details/initData/attributes decode (cheap),
game mode and hero role resolution, and the group-majority team logic that
makes output identical regardless of who runs the scan."""

import datetime
import glob
import os
import sys

import mpyq
from heroprotocol import versions as hp_versions

from .config import DOCS_ROOT, GROUP, MIN_KNOWN, NAME_ALIASES
from .heroes import resolve_role
from .modes import classify_mode
from .protocol import get_protocol

_FILETIME_EPOCH = datetime.datetime(1601, 1, 1, tzinfo=datetime.timezone.utc)


def filetime_to_datetime(filetime):
    """Convert replay.details' m_timeUTC (a Windows FILETIME: 100ns
    intervals since 1601-01-01 UTC) to a datetime."""
    return _FILETIME_EPOCH + datetime.timedelta(microseconds=filetime / 10)


def find_replay_files():
    pattern = os.path.join(DOCS_ROOT, "**", "*.StormReplay")
    return sorted(glob.glob(pattern, recursive=True))


def parse_replay(path):
    archive = mpyq.MPQArchive(path)
    contents = archive.header["user_data_header"]["content"]
    header = hp_versions.latest().decode_replay_header(contents)
    base_build = header["m_version"]["m_baseBuild"]

    protocol = get_protocol(base_build)

    details = protocol.decode_replay_details(archive.read_file("replay.details"))
    init = protocol.decode_replay_initdata(archive.read_file("replay.initData"))
    attrs = protocol.decode_replay_attributes_events(archive.read_file("replay.attributes.events"))

    map_name = details["m_title"].decode("utf-8", "replace")

    game_description = init["m_syncLobbyState"]["m_gameDescription"]
    game_options = game_description["m_gameOptions"]
    amm_id = game_options.get("m_ammId")
    random_value = game_description["m_randomValue"]
    scope16 = attrs["scopes"].get(16, {})
    bans = scope16.get(4021, [{}])[0].get("value", b"").decode("utf-8", "replace").strip()
    mode = classify_mode(amm_id, bans)

    # Merge key: random simulation seed + map, identical across every
    # participant's copy of the same match regardless of machine/timezone
    # (unlike a filename- or wall-clock-derived key).
    game_id = f"{map_name}_{random_value}"

    time_utc = details.get("m_timeUTC")
    if time_utc:
        dt = filetime_to_datetime(time_utc)
        date, time_ = dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M:%S")
    else:
        date, time_ = "", ""

    # HotS runs at 16 game loops/second; m_elapsedGameLoops is already in the
    # header we just decoded, so game length costs nothing extra to capture.
    game_length_seconds = round(header["m_elapsedGameLoops"] / 16)

    players = []
    for idx, p in enumerate(details["m_playerList"]):
        hero = p["m_hero"].decode("utf-8", "replace")
        role = resolve_role(hero, date)
        if role is None:
            role = "Unknown"
            print(f"[role] no role mapping for hero '{hero}' (add it to HERO_ROLE)", file=sys.stderr)
        name = p["m_name"].decode("utf-8", "replace")
        name = NAME_ALIASES.get(name, name)
        players.append(
            {
                "name": name,
                "hero": hero,
                "team": p["m_teamId"],
                "result": p["m_result"],  # 1 = win, 2 = loss
                "toon_id": p["m_toon"]["m_id"],
                "toon_region": p["m_toon"]["m_region"],
                "class": role,
                "stats": {},  # filled in later, only for qualifying games -- see scoreboard.attach_score_stats
                "talents": {},
            }
        )

    return {
        "path": path,
        "game_id": game_id,
        "date": date,
        "time": time_,
        "map": map_name,
        "base_build": base_build,
        "mode": mode,
        "amm_id": amm_id,
        "game_length_seconds": game_length_seconds,
        "players": players,
    }


def qualifies(game):
    """Return (our_team, other_team) if at least MIN_KNOWN GROUP members
    shared one team, else None. "Our team" is whichever team has more GROUP
    members -- not tied to a specific person -- so the same replay produces
    identical output regardless of who in the group ran the scan, which is
    what lets everyone's runs merge cleanly (see csv_io.merge_and_write_csv)."""
    team_ids = sorted({p["team"] for p in game["players"]})
    if len(team_ids) != 2:
        return None  # not a standard 2-team match (FFA/custom)

    counts = {t: sum(1 for p in game["players"] if p["team"] == t and p["name"] in GROUP) for t in team_ids}
    best_team = max(counts, key=counts.get)
    if counts[best_team] < MIN_KNOWN:
        return None

    our_team = [p for p in game["players"] if p["team"] == best_team]
    other_team = [p for p in game["players"] if p["team"] != best_team]
    return our_team, other_team


def class_counts(team):
    counts = {"Tank": 0, "Bruiser": 0, "Ranged Assassin": 0, "Melee Assassin": 0, "Healer": 0, "Support": 0, "Unknown": 0}
    for p in team:
        counts[p["class"]] = counts.get(p["class"], 0) + 1
    return counts


def comp_signature(team):
    c = class_counts(team)
    return (
        f"T{c['Tank']}-B{c['Bruiser']}-RA{c['Ranged Assassin']}"
        f"-MA{c['Melee Assassin']}-H{c['Healer']}-Su{c['Support']}"
    )
