"""Heroes of the Storm ranked season boundaries, sourced from
nexuscompendium.com/ranked. Cross-checked against the Tassadar role-rework
date in heroes.py -- it lands exactly on 2020 Season 2's start.

Each end date is the next season's start (seasons run back-to-back). The
last entry is open-ended ("9999-12-31") until its real end date is known;
replace it and add the next season as a new open-ended entry once it ends.
Anything after the last entry's end date (once set) falls back to "Unknown
(no confirmed season yet)" until this table is updated."""

SEASONS = [
    ("Preseason (2015-2016)", "2015-01-13", "2016-06-14"),
    ("2016 Season 1", "2016-06-14", "2016-09-13"),
    ("2016 Season 2", "2016-09-13", "2016-12-14"),
    ("2016 Season 3", "2016-12-14", "2017-03-14"),
    ("2017 Season 1", "2017-03-14", "2017-06-13"),
    ("2017 Season 2", "2017-06-13", "2017-09-05"),
    ("2017 Season 3", "2017-09-05", "2017-12-12"),
    ("2018 Season 1", "2017-12-12", "2018-03-06"),
    ("2018 Season 2", "2018-03-06", "2018-07-10"),
    ("2018 Season 3", "2018-07-10", "2018-09-25"),
    ("2018 Season 4", "2018-09-25", "2018-12-11"),
    ("2019 Season 1", "2018-12-11", "2019-03-26"),
    ("2019 Season 2 (Storm League launch)", "2019-03-26", "2019-08-06"),
    ("2019 Season 3", "2019-08-06", "2019-12-03"),
    ("2020 Season 1", "2019-12-03", "2020-04-14"),
    ("2020 Season 2", "2020-04-14", "2020-06-23"),
    ("2020 Season 3", "2020-06-23", "2020-09-08"),
    ("2020 Season 4", "2020-09-08", "2020-12-01"),
    ("2021 Season 1", "2020-12-01", "2021-05-18"),
    ("2021 Season 2", "2021-05-18", "2021-12-07"),
    ("2022 Season 1", "2021-12-07", "2022-07-12"),
    ("2022 Season 2", "2022-07-12", "2022-10-11"),
    ("2022 Season 3", "2022-10-11", "2023-02-08"),
    ("2023 Season 1", "2023-02-08", "2023-06-01"),
    ("2023 Season 2", "2023-06-01", "2023-10-03"),
    ("2023 Season 3", "2023-10-03", "2024-02-02"),
    ("2024 Season 1", "2024-02-02", "2024-06-02"),
    ("2024 Season 2", "2024-06-02", "2024-10-02"),
    ("2024 Season 3", "2024-10-02", "2025-02-02"),
    ("2025 Season 1", "2025-02-02", "2025-06-02"),
    ("2025 Season 2", "2025-06-02", "2025-10-02"),
    ("2025 Season 3", "2025-10-02", "2026-02-02"),
    ("2026 Season 1", "2026-02-02", "2026-06-02"),
    ("2026 Season 2", "2026-06-02", "9999-12-31"),
]

UNKNOWN_SEASON = "Unknown"
UNKNOWN_CURRENT_SEASON = "Unknown (no confirmed season yet)"


def season_for_date(date):
    if not date:
        return UNKNOWN_SEASON
    for label, start, end in SEASONS:
        if start <= date < end:
            return label
    if date >= SEASONS[-1][2]:
        return UNKNOWN_CURRENT_SEASON
    return UNKNOWN_SEASON
