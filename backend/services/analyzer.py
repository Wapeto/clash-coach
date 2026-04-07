from collections import defaultdict

_START_LEVELS = {"common": 1, "rare": 3, "epic": 6, "legendary": 9, "champion": 11}
_MAX_GAME_LEVEL = 16
_OPTIMAL_ELIXIR = 3.6


def _to_game_level(api_level: int, rarity: str) -> int:
    start = _START_LEVELS.get(rarity.lower(), 1)
    return start + api_level - 1


def compute_deck_score(cards: list[dict]) -> dict:
    """
    Score a deck 0–100 based on:
    - 50% average game level relative to max (16)
    - 20% level consistency (penalise a weak-link card far below average)
    - 15% elixir curve proximity to optimal (3.6)
    - 15% evo/hero presence bonus

    cards: list of card objects with at minimum: level, rarity.
           Optionally: elixirCost, evolutionLevel, iconUrls, name.
    """
    if not cards:
        return {"score": 0, "avg_level": 0, "min_level": 0, "level_pct": 0,
                "avg_elixir": 0, "evo_hero_count": 0, "weak_link": None}

    game_levels = [_to_game_level(c.get("level", 1), c.get("rarity", "common")) for c in cards]
    avg_level = sum(game_levels) / len(game_levels)
    min_level = min(game_levels)

    # 50% — how close cards are to max level on average
    level_score = (avg_level / _MAX_GAME_LEVEL) * 100

    # 20% — weak-link penalty: if the lowest card is far below the average it drags the deck
    consistency_ratio = min_level / avg_level if avg_level > 0 else 1.0
    consistency_score = min(consistency_ratio, 1.0) * 100

    # 15% — elixir curve (peaks at _OPTIMAL_ELIXIR, ±1 elixir costs 20 pts)
    elixirs = [c.get("elixirCost", 0) for c in cards if c.get("elixirCost")]
    avg_elixir = sum(elixirs) / len(elixirs) if elixirs else _OPTIMAL_ELIXIR
    elixir_score = max(0.0, 100.0 - abs(avg_elixir - _OPTIMAL_ELIXIR) * 20)

    # 15% — evo/hero bonus (each unlocked evo/hero = +50 pts, capped at 100)
    evo_hero_count = sum(1 for c in cards if c.get("evolutionLevel", 0) > 0)
    evo_score = min(evo_hero_count * 50, 100)

    score = (
        level_score * 0.50
        + consistency_score * 0.20
        + elixir_score * 0.15
        + evo_score * 0.15
    )

    weak_link = None
    if consistency_ratio < 0.75:
        weakest_idx = game_levels.index(min_level)
        weak_link = cards[weakest_idx].get("name")

    return {
        "score": round(score, 1),
        "avg_level": round(avg_level, 1),
        "min_level": min_level,
        "level_pct": round(avg_level / _MAX_GAME_LEVEL * 100, 1),
        "avg_elixir": round(avg_elixir, 2),
        "evo_hero_count": evo_hero_count,
        "weak_link": weak_link,
    }


def compute_upgrade_priorities(player: dict, battles: list) -> list:
    # Build a map of card_name -> card data from collection
    collection = {c["name"]: c for c in player["cards"]}

    # Count how many times each card appears in winning vs all battles
    card_wins = defaultdict(int)
    card_appearances = defaultdict(int)

    for battle in battles:
        team = battle.get("team", [{}])[0]
        trophy_change = team.get("trophyChange", 0)
        won = trophy_change > 0
        cards_used = team.get("cards", [])

        for card in cards_used:
            name = card["name"]
            card_appearances[name] += 1
            if won:
                card_wins[name] += 1

    results = []

    for name, card in collection.items():
        level = card.get("level", 1)
        max_level = card.get("maxLevel", 14)
        levels_to_max = max_level - level
        appearances = card_appearances.get(name, 0)
        wins = card_wins.get(name, 0)
        win_rate = (wins / appearances) if appearances > 0 else 0

        # Score: how often you use it * how far from max * win rate boost potential
        # Cards you never use score 0 regardless
        score = appearances * levels_to_max * (1 - win_rate + 0.1)

        results.append({
            "name": name,
            "level": level,
            "maxLevel": max_level,
            "levelsToMax": levels_to_max,
            "rarity": card.get("rarity"),
            "appearances": appearances,
            "winRate": round(win_rate * 100, 1),
            "upgradeScore": round(score, 2),
            "iconUrl": card.get("iconUrls", {}).get("medium"),
            "iconUrls": card.get("iconUrls", {}),
            "evolutionLevel": card.get("evolutionLevel", 0),
        })

    # Sort by score descending, only cards you've actually used
    results.sort(key=lambda x: x["upgradeScore"], reverse=True)
    return results


def get_used_decks(battles: list) -> list:
    decks = []
    seen = set()

    for battle in battles:
        team = battle.get("team", [{}])[0]
        cards = team.get("cards", [])
        if not cards:
            continue

        key = frozenset(c["name"] for c in cards)
        if key in seen:
            continue
        seen.add(key)

        trophy_change = team.get("trophyChange", 0)
        game_mode_raw = battle.get("gameMode")
        if isinstance(game_mode_raw, dict):
            game_mode = game_mode_raw.get("name", "Unknown")
        elif isinstance(game_mode_raw, str):
            game_mode = game_mode_raw
        else:
            game_mode = "Unknown"
        decks.append({
            "cards": cards,
            "trophyChange": trophy_change,
            "gameMode": game_mode,
        })

    return decks
