from pydantic import BaseModel


class DeckConstraints(BaseModel):
    max_evos: int
    max_heroes: int
    max_evo_or_hero: int   # total special cards allowed
    evo_slots: int = 0     # dedicated Evo-only deck slots
    hero_slots: int = 0    # dedicated Hero-only deck slots
    wild_slots: int = 0    # Evo-or-Hero interchangeable slots


# Default for unknown / very low arenas — no evos or heroes unlocked
_DEFAULT = DeckConstraints(max_evos=0, max_heroes=0, max_evo_or_hero=0)

# Arenas 7–14: Evolutions unlocked, no Heroes, 1 Evo slot
_MID_LADDER = DeckConstraints(max_evos=1, max_heroes=0, max_evo_or_hero=1, evo_slots=1)

# Arenas 15–20: Evolutions + Heroes unlocked, 1 Evo + 1 Hero slot, no wild
_HIGH_LADDER = DeckConstraints(max_evos=1, max_heroes=1, max_evo_or_hero=2, evo_slots=1, hero_slots=1)

# Arena 21+ / Path of Legends: 1 Evo + 1 Hero + 1 Wild slot = max 3 special cards
_TOP_LADDER = DeckConstraints(max_evos=2, max_heroes=2, max_evo_or_hero=3, evo_slots=1, hero_slots=1, wild_slots=1)


_ARENA_CONSTRAINTS: dict[int, DeckConstraints] = {
    # Arenas 1–6: no evos, no heroes
    **{i: _DEFAULT for i in range(54000001, 54000007)},
    # Arenas 7–14: evos available, no heroes
    **{i: _MID_LADDER for i in range(54000007, 54000015)},
    # Arenas 15–20: evos + heroes, no wild
    **{i: _HIGH_LADDER for i in range(54000015, 54000021)},
    # Arena 21+ / Path of Legends: full rules (1 evo + 1 hero + 1 wild)
    **{i: _TOP_LADDER for i in range(54000021, 54000100)},
}

_NAME_OVERRIDES: list[tuple[str, DeckConstraints]] = [
    ("path of legends", _TOP_LADDER),
    ("legendary arena", _TOP_LADDER),
    ("ultimate champion", _TOP_LADDER),
    ("champion", _TOP_LADDER),
    ("master", _HIGH_LADDER),
    ("challenger", _HIGH_LADDER),
    ("royal", _MID_LADDER),
    ("arena", _MID_LADDER),
]


def get_deck_constraints(arena: dict) -> DeckConstraints:
    """Return deck evo/hero constraints for the given arena dict from the CR API."""
    if not arena:
        return _TOP_LADDER  # assume top ladder if arena data missing

    arena_id = arena.get("id", 0)
    if arena_id in _ARENA_CONSTRAINTS:
        return _ARENA_CONSTRAINTS[arena_id]

    name = arena.get("name", "").lower()
    for keyword, constraints in _NAME_OVERRIDES:
        if keyword in name:
            return constraints

    if arena_id >= 54000021:
        return _TOP_LADDER
    if arena_id >= 54000015:
        return _HIGH_LADDER
    if arena_id >= 54000007:
        return _MID_LADDER

    return _DEFAULT


def validate_deck_constraints(
    card_names: list[str],
    player_cards: list[dict],
    constraints: DeckConstraints,
) -> tuple[bool, str]:
    """Check if a deck respects evo/hero limits."""
    card_lookup = {c["name"]: c for c in player_cards}
    evo_count = 0
    hero_count = 0

    for name in card_names:
        card = card_lookup.get(name)
        if not card:
            continue
        icon_urls = card.get("iconUrls", {})
        is_special = card.get("evolutionLevel", 0) > 0
        if is_special and icon_urls.get("heroMedium"):
            hero_count += 1
        elif is_special and icon_urls.get("evolutionMedium"):
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
