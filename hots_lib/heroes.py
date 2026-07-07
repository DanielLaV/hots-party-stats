"""Hero -> role classification (Tank/Bruiser/Ranged Assassin/Melee Assassin/
Healer/Support). The replay's own per-player class attribute only encodes
the legacy 4-role system (Warrior/Assassin/Support/Specialist) and doesn't
distinguish Tank from Bruiser or Ranged from Melee Assassin, so this table
replaces it -- cross-checked against the official roster at
heroesofthestorm.blizzard.com/en-us/heroes.
Needs a new entry whenever Blizzard ships a hero or reworks one into a
different role."""

HERO_ROLE = {
    # Tank
    "Anub'arak": "Tank", "Arthas": "Tank", "Blaze": "Tank", "Cho": "Tank",
    "Diablo": "Tank", "E.T.C.": "Tank", "Garrosh": "Tank", "Johanna": "Tank",
    "Mal'Ganis": "Tank", "Mei": "Tank", "Muradin": "Tank", "Stitches": "Tank", "Tyrael": "Tank",
    # Bruiser
    "Artanis": "Bruiser", "Chen": "Bruiser", "D.Va": "Bruiser", "Deathwing": "Bruiser",
    "Dehaka": "Bruiser", "Gazlowe": "Bruiser", "Hogger": "Bruiser", "Imperius": "Bruiser", "Leoric": "Bruiser",
    "Malthael": "Bruiser", "Ragnaros": "Bruiser", "Rexxar": "Bruiser",
    "Varian": "Bruiser",  # fallback only -- real role depends on his ultimate, see refine_varian_role()
    "Sonya": "Bruiser", "Thrall": "Bruiser", "Xul": "Bruiser", "Yrel": "Bruiser",
    # Ranged Assassin
    "Azmodan": "Ranged Assassin", "Cassia": "Ranged Assassin", "Chromie": "Ranged Assassin",
    "Falstad": "Ranged Assassin", "Fenix": "Ranged Assassin", "Gall": "Ranged Assassin", "Genji": "Ranged Assassin",
    "Greymane": "Ranged Assassin", "Gul'dan": "Ranged Assassin", "Hanzo": "Ranged Assassin",
    "Jaina": "Ranged Assassin", "Junkrat": "Ranged Assassin", "Kael'thas": "Ranged Assassin",
    "Kel'Thuzad": "Ranged Assassin", "Li-Ming": "Ranged Assassin", "Lunara": "Ranged Assassin",
    "Mephisto": "Ranged Assassin", "Nazeebo": "Ranged Assassin", "Nova": "Ranged Assassin",
    "Orphea": "Ranged Assassin", "Probius": "Ranged Assassin", "Raynor": "Ranged Assassin",
    "Sgt. Hammer": "Ranged Assassin", "Sylvanas": "Ranged Assassin", "Tracer": "Ranged Assassin",
    "Tychus": "Ranged Assassin", "Valla": "Ranged Assassin", "Zagara": "Ranged Assassin",
    "Zul'jin": "Ranged Assassin",
    # Melee Assassin
    "Alarak": "Melee Assassin", "Illidan": "Melee Assassin",
    "Kerrigan": "Melee Assassin", "Maiev": "Melee Assassin", "Murky": "Melee Assassin",
    "Qhira": "Melee Assassin", "Samuro": "Melee Assassin", "The Butcher": "Melee Assassin",
    "Valeera": "Melee Assassin", "Zeratul": "Melee Assassin",
    # Healer
    "Alexstrasza": "Healer", "Ana": "Healer", "Anduin": "Healer", "Auriel": "Healer",
    "Brightwing": "Healer", "Deckard": "Healer", "Kharazim": "Healer", "Li Li": "Healer",
    "Lt. Morales": "Healer", "Lúcio": "Healer", "Malfurion": "Healer", "Rehgar": "Healer",
    "Stukov": "Healer", "Tyrande": "Healer", "Uther": "Healer", "Whitemane": "Healer",
    # Support (utility/shield-based, non-healing). Tassadar is deliberately
    # absent -- see resolve_role().
    "Abathur": "Support", "Medivh": "Support", "Zarya": "Support", "The Lost Vikings": "Support",
}

_TASSADAR_ROLE_SWITCH_DATE = "2020-04-14"


def resolve_role(hero, date):
    """HERO_ROLE lookup, except Tassadar, whose role depends on the match
    date rather than a single fixed entry."""
    if hero == "Tassadar":
        return "Ranged Assassin" if date >= _TASSADAR_ROLE_SWITCH_DATE else "Support"
    return HERO_ROLE.get(hero)


# Internal talent identifiers for Varian's three heroic abilities, from
# replay.tracker.events' EndOfGameTalentChoices.
VARIAN_ULTIMATE_ROLE = {
    "VarianTaunt": "Tank",
    "VarianColossusSmash": "Bruiser",
    "VarianTwinBladesOfFury": "Melee Assassin",
}


def refine_varian_role(game, tracker_events):
    """Varian's real role depends on his ultimate pick, which isn't in the
    replay's class attribute at all -- read it from the end-of-game talent
    summary and patch game["players"][i]["class"] in place. No-op without a
    Varian in the game, or if the talent event is missing (e.g. an abnormal
    ending) -- callers keep the HERO_ROLE fallback in that case.

    Only called for qualifying games, since tracker events are only decoded
    for those -- non-qualifying games show Varian's fallback role."""
    if not any(p["hero"] == "Varian" for p in game["players"]):
        return

    for e in tracker_events:
        if e["_event"] != "NNet.Replay.Tracker.SStatGameEvent" or e["m_eventName"] != b"EndOfGameTalentChoices":
            continue
        str_data = {d["m_key"]: d["m_value"] for d in (e["m_stringData"] or [])}
        if str_data.get(b"Hero") != b"HeroVarian":
            continue
        int_data = {d["m_key"]: d["m_value"] for d in (e["m_intData"] or [])}
        player_id = int_data.get(b"PlayerID")
        if not player_id or not (1 <= player_id <= len(game["players"])):
            continue
        choices = {v.decode("utf-8", "replace") for k, v in str_data.items() if k.startswith(b"Tier")}
        for talent, role in VARIAN_ULTIMATE_ROLE.items():
            if talent in choices:
                game["players"][player_id - 1]["class"] = role
                break
