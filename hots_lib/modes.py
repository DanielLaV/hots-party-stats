"""Game mode detection from Blizzard's matchmaking queue id (m_ammId), which
gets reissued periodically as map pools change -- each mode maps to a *set*
of ids seen in practice, not one fixed value. Storm League always drafts
with 3 bans; Quick Match and ARAM never ban and are told apart only by ammId."""

import sys

QUICK_MATCH_AMM_IDS = {50001, 50021, 50031}
STORM_LEAGUE_AMM_IDS = {50051, 50091}
ARAM_AMM_IDS = {50101}


def classify_mode(amm_id, bans):
    if amm_id in ARAM_AMM_IDS:
        return "ARAM"
    if amm_id in STORM_LEAGUE_AMM_IDS:
        return "Storm League"
    if amm_id in QUICK_MATCH_AMM_IDS:
        return "Quick Match"
    if amm_id is None:
        return "Custom/Brawl/Other"
    # Unseen ammId: fall back to the ban-phase heuristic and flag it so a new
    # id can be added to the right set above.
    guess = "Storm League" if bans else "Quick Match/ARAM (unconfirmed)"
    print(f"[mode] unrecognized ammId={amm_id}, bans={bans!r} -> guessing '{guess}'", file=sys.stderr)
    return guess
