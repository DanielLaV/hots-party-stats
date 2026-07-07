"""Per-player scoreboard stats, awards, and talent picks from
replay.tracker.events -- the heaviest stream to decode, so attach_score_stats
is only called for qualifying games."""

import mpyq

from .heroes import refine_varian_role
from .protocol import get_protocol

# All 41 EndOfMatchAward* fields (SScoreResultEvent), confirmed against real
# replay data. Booleans (0/1) per player. Two of these ("GivenToNonwinner",
# "MapSpecific") look like meta-flags about the award system rather than
# individually-won awards, but behave identically to the real ones
# structurally, so they're kept in.
AWARD_FIELDS = [
    "EndOfMatchAward0DeathsBoolean", "EndOfMatchAward0OutnumberedDeathsBoolean",
    "EndOfMatchAwardClutchHealerBoolean", "EndOfMatchAwardGivenToNonwinner",
    "EndOfMatchAwardHatTrickBoolean", "EndOfMatchAwardHighestKillStreakBoolean",
    "EndOfMatchAwardMVPBoolean", "EndOfMatchAwardMapSpecificBoolean",
    "EndOfMatchAwardMostAltarDamageDone", "EndOfMatchAwardMostCoinsPaidBoolean",
    "EndOfMatchAwardMostCurseDamageDoneBoolean", "EndOfMatchAwardMostDamageDoneToZergBoolean",
    "EndOfMatchAwardMostDamageTakenBoolean", "EndOfMatchAwardMostDamageToMinionsBoolean",
    "EndOfMatchAwardMostDamageToPlantsBoolean", "EndOfMatchAwardMostDaredevilEscapesBoolean",
    "EndOfMatchAwardMostDragonShrinesCapturedBoolean", "EndOfMatchAwardMostEscapesBoolean",
    "EndOfMatchAwardMostGemsTurnedInBoolean", "EndOfMatchAwardMostHealingBoolean",
    "EndOfMatchAwardMostHeroDamageDoneBoolean", "EndOfMatchAwardMostImmortalDamageBoolean",
    "EndOfMatchAwardMostInterruptedCageUnlocksBoolean", "EndOfMatchAwardMostKillsBoolean",
    "EndOfMatchAwardMostMercCampsCapturedBoolean", "EndOfMatchAwardMostNukeDamageDoneBoolean",
    "EndOfMatchAwardMostProtectionBoolean", "EndOfMatchAwardMostRootsBoolean",
    "EndOfMatchAwardMostSeedsCollectedBoolean", "EndOfMatchAwardMostSiegeDamageDoneBoolean",
    "EndOfMatchAwardMostSilencesBoolean", "EndOfMatchAwardMostSkullsCollectedBoolean",
    "EndOfMatchAwardMostStunsBoolean", "EndOfMatchAwardMostTeamfightDamageTakenBoolean",
    "EndOfMatchAwardMostTeamfightHealingDoneBoolean", "EndOfMatchAwardMostTeamfightHeroDamageDoneBoolean",
    "EndOfMatchAwardMostTimeInTempleBoolean", "EndOfMatchAwardMostTimeOnPointBoolean",
    "EndOfMatchAwardMostTimePushingBoolean", "EndOfMatchAwardMostVengeancesPerformedBoolean",
    "EndOfMatchAwardMostXPContributionBoolean",
]

# Combat/objective/map-specific stats kept from SScoreResultEvent; ~50 other
# fields (lifetime account counters, seasonal event trackers) are skipped as
# noise for per-match analysis.
SCORE_STAT_FIELDS = [
    "Takedowns", "SoloKill", "Deaths", "Assists", "HighestKillStreak",
    "HeroDamage", "SiegeDamage", "StructureDamage", "MinionDamage", "CreepDamage", "SummonDamage",
    "DamageTaken", "DamageSoaked", "Healing", "SelfHealing",
    "TeamfightHeroDamage", "TeamfightDamageTaken", "TeamfightHealingDone",
    "TimeSpentDead", "TimeCCdEnemyHeroes", "TimeStunningEnemyHeroes", "TimeRootingEnemyHeroes",
    "TimeSilencingEnemyHeroes", "ProtectionGivenToAllies", "ClutchHealsPerformed",
    "EscapesPerformed", "VengeancesPerformed", "OutnumberedDeaths",
    "MercCampCaptures", "WatchTowerCaptures", "TownKills", "ExperienceContribution", "Level", "GameScore",
    "GardenSeedsCollectedByPlayer", "CurseDamageDone", "TimeOnPoint", "RavenTributesCollected",
    "RegenGlobes", "CageUnlocksInterrupted", "KilledTreasureGoblin",
] + AWARD_FIELDS

# Tier number (1-7), not character level -- the level a tier corresponds to
# varies by hero and patch (e.g. Varian's heroic isn't level 10 like most
# heroes), but EndOfGameTalentChoices reports tier number directly.
TALENT_TIERS = list(range(1, 8))


def extract_score_stats(events, num_players):
    """One {stat_name: value} dict per player index (0-based, matching
    m_playerList order), from the game's single SScoreResultEvent. All-blank
    if that event is missing (e.g. an abnormally-ended game)."""
    score_event = next((e for e in events if e["_event"] == "NNet.Replay.Tracker.SScoreResultEvent"), None)
    per_player = [dict() for _ in range(num_players)]
    if score_event is None:
        return per_player

    for entry in score_event["m_instanceList"]:
        name = entry["m_name"].decode("utf-8", "replace")
        if name not in SCORE_STAT_FIELDS:
            continue
        values = entry["m_values"]
        for idx in range(num_players):
            if idx < len(values) and values[idx]:
                per_player[idx][name] = values[idx][0]["m_value"]
    return per_player


def extract_talent_choices(tracker_events, num_players):
    """One {tier_number: talent_name} dict per player index, from each
    player's EndOfGameTalentChoices event. Tiers not reached (game ended
    early) are simply absent."""
    per_player = [dict() for _ in range(num_players)]
    for e in tracker_events:
        if e["_event"] != "NNet.Replay.Tracker.SStatGameEvent" or e["m_eventName"] != b"EndOfGameTalentChoices":
            continue
        str_data = {d["m_key"]: d["m_value"] for d in (e["m_stringData"] or [])}
        int_data = {d["m_key"]: d["m_value"] for d in (e["m_intData"] or [])}
        player_id = int_data.get(b"PlayerID")
        if not player_id or not (1 <= player_id <= num_players):
            continue
        for tier in TALENT_TIERS:
            key = f"Tier {tier} Choice".encode()
            if key in str_data:
                per_player[player_id - 1][tier] = str_data[key].decode("utf-8", "replace")
    return per_player


def attach_score_stats(game):
    """Decode replay.tracker.events once and fill in each player's
    scoreboard stats, talent picks, and Varian's role refinement."""
    archive = mpyq.MPQArchive(game["path"])
    protocol = get_protocol(game["base_build"])
    tracker_events = list(protocol.decode_replay_tracker_events(archive.read_file("replay.tracker.events")))
    score_stats = extract_score_stats(tracker_events, len(game["players"]))
    talent_choices = extract_talent_choices(tracker_events, len(game["players"]))
    for idx, p in enumerate(game["players"]):
        p["stats"] = score_stats[idx]
        p["talents"] = talent_choices[idx]
    refine_varian_role(game, tracker_events)
