from pydantic import BaseModel


class DeckConstraints(BaseModel):
    max_evos: int
    max_heroes: int
    max_evo_or_hero: int


# Default for unknown / very low arenas — no evos or heroes unlocked
_DEFAULT = DeckConstraints(max_evos=0, max_heroes=0, max_evo_or_hero=0)

# Path of Legends / top ladder rules: 1 Evo + 1 Hero, but only 1 total slot for Evo-or-Hero
_TOP_LADDER = DeckConstraints(max_evos=1, max_heroes=1, max_evo_or_hero=1)

# Mid-ladder (arena 7+): Evolutions unlocked, no Heroes yet
_MID_LADDER = DeckConstraints(max_evos=1, max_heroes=0, max_evo_or_hero=1)

# Arena IDs where evolutions are available (arena 7 = Rascal's Hideout, id >= 54000007)
# Arena IDs where heroes are available (Path of Legends, id >= 54000021 roughly)
# Source: Clash Royale API arena IDs (community-documented)
_ARENA_CONSTRAINTS: dict[int, DeckConstraints] = {
    # Arenas 1–6: no evos, no heroes
    **{i: _DEFAULT for i in range(54000001, 54000007)},
    # Arenas 7–20: evos available, no heroes
    **{i: _MID_LADDER for i in range(54000007, 54000021)},
    # Arena 21+ / Path of Legends and above: full rules
    **{i: _TOP_LADDER for i in range(54000021, 54000100)},
}

# Named arenas (fallback by name substring if ID lookup fails)
_NAME_OVERRIDES: list[tuple[str, DeckConstraints]] = [
    ("path of legends", _TOP_LADDER),
    ("legendary arena", _TOP_LADDER),
    ("ultimate champion", _TOP_LADDER),
    ("champion", _TOP_LADDER),
    ("master", _TOP_LADDER),
    ("challenger", _MID_LADDER),
    ("royale", _MID_LADDER),
    ("arena", _MID_LADDER),
]


def get_deck_constraints(arena: dict) -> DeckConstraints:
    """Return deck evo/hero constraints for the given arena dict from the CR API."""
    if not arena:
        return _TOP_LADDER  # assume top ladder if arena data missing

    arena_id = arena.get("id", 0)
    if arena_id in _ARENA_CONSTRAINTS:
        return _ARENA_CONSTRAINTS[arena_id]

    # Fallback: match by name
    name = arena.get("name", "").lower()
    for keyword, constraints in _NAME_OVERRIDES:
        if keyword in name:
            return constraints

    # If ID is high (>= 54000021) assume top ladder
    if arena_id >= 54000021:
        return _TOP_LADDER
    if arena_id >= 54000007:
        return _MID_LADDER

    return _DEFAULT


def validate_deck_constraints(
    card_names: list[str],
    player_cards: list[dict],
    constraints: DeckConstraints,
) -> tuple[bool, str]:
    """
    Check if a deck respects evo/hero limits.
    Returns (is_valid, error_message). error_message is empty string when valid.
    """
    card_lookup = {c["name"]: c for c in player_cards}
    evo_count = 0
    hero_count = 0

    for name in card_names:
        card = card_lookup.get(name)
        if not card:
            continue
        icon_urls = card.get("iconUrls", {})
        has_evo_form = bool(icon_urls.get("evolutionMedium"))
        has_hero_form = bool(icon_urls.get("heroMedium"))
        is_special = card.get("evolutionLevel", 0) > 0

        if is_special and has_hero_form:
            hero_count += 1
        elif is_special and has_evo_form:
            evo_count += 1

    total = evo_count + hero_count
    errors = []
    if evo_count > constraints.max_evos:
        errors.append(f"{evo_count} Evos (max {constraints.max_evos})")
    if hero_count > constraints.max_heroes:
        errors.append(f"{hero_count} Heroes (max {constraints.max_heroes})")
    if total > constraints.max_evo_or_hero:
        errors.append(f"{total} total Evo+Hero (max {constraints.max_evo_or_hero})")

    if errors:
        return False, "Deck violates constraints: " + ", ".join(errors)
    return True, ""
