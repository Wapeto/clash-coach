import re
from collections import defaultdict

_EVO_SUFFIX = re.compile(r'\s*\((EVOLVED?|HERO|EVO)\)\s*$', re.IGNORECASE)


def normalize_card_name(name: str) -> str:
    """Strip (EVOLVED)/(HERO)/(EVO) suffixes that AI sometimes adds."""
    return _EVO_SUFFIX.sub('', name).strip()

_START_LEVELS = {"common": 1, "rare": 3, "epic": 6, "legendary": 9, "champion": 11}
_MAX_GAME_LEVEL = 16
_OPTIMAL_ELIXIR = 3.6


def _to_game_level(api_level: int, rarity: str) -> int:
    start = _START_LEVELS.get(rarity.lower(), 1)
    return start + api_level - 1


def compute_deck_score(cards: list[dict], constraints=None) -> dict:
    """
    Score a deck 0–100 based on:
    - 50% average game level relative to max (16)
    - 20% level consistency (penalise a weak-link card far below average)
    - 15% elixir curve proximity to optimal (3.6)
    - 15% evo/hero presence bonus (capped by arena constraints)

    constraints: optional DeckConstraints — if provided, evo/hero count is capped
                 to the arena's actual active slot limits.
    """
    if not cards:
        return {"score": 0, "avg_level": 0, "min_level": 0, "level_pct": 0,
                "avg_elixir": 0, "evo_hero_count": 0, "weak_link": None}

    game_levels = [_to_game_level(c.get("level", 1), c.get("rarity", "common")) for c in cards]
    avg_level = sum(game_levels) / len(game_levels)
    min_level = min(game_levels)

    level_score = (avg_level / _MAX_GAME_LEVEL) * 100

    consistency_ratio = min_level / avg_level if avg_level > 0 else 1.0
    consistency_score = min(consistency_ratio, 1.0) * 100

    elixirs = [c.get("elixirCost", 0) for c in cards if c.get("elixirCost")]
    avg_elixir = sum(elixirs) / len(elixirs) if elixirs else _OPTIMAL_ELIXIR
    elixir_score = max(0.0, 100.0 - abs(avg_elixir - _OPTIMAL_ELIXIR) * 20)

    # Count evo and hero cards separately, then cap by arena constraints
    raw_evo = sum(
        1 for c in cards
        if c.get("evolutionLevel", 0) > 0
        and c.get("iconUrls", {}).get("evolutionMedium")
        and not c.get("iconUrls", {}).get("heroMedium")
    )
    raw_hero = sum(
        1 for c in cards
        if c.get("evolutionLevel", 0) > 0
        and c.get("iconUrls", {}).get("heroMedium")
    )

    if constraints is not None:
        active_evos = min(raw_evo, constraints.max_evos)
        active_heroes = min(raw_hero, constraints.max_heroes)
        evo_hero_count = min(active_evos + active_heroes, constraints.max_evo_or_hero)
    else:
        # No constraints: cap at top-arena max (3)
        evo_hero_count = min(raw_evo + raw_hero, 3)

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


def compute_win_probability(player_score: dict, opponent_score: dict) -> float:
    """
    Estimate win probability (0–100) using deck score as primary factor.
    Deck score captures levels, consistency, elixir curve, and evo/hero presence.
    Each 10-point deck score difference ≈ 8% win rate swing.
    Clamped to [15, 85] — never claim certainty.
    """
    p_score = player_score.get("score", 50.0)
    o_score = opponent_score.get("score", 50.0)
    diff = p_score - o_score
    raw = 0.50 + diff * 0.008
    return round(max(0.15, min(0.85, raw)) * 100, 1)


def _parse_game_mode(battle: dict) -> str:
    raw = battle.get("gameMode")
    if isinstance(raw, dict):
        return raw.get("name", "Unknown")
    if isinstance(raw, str):
        return raw
    return "Unknown"


def get_last_battles(battles: list, player_collection: list, n: int = 5, constraints=None) -> list:
    """
    Return the last n battles with player deck, opponent deck, deck scores,
    win probability, and match result.
    constraints: optional DeckConstraints for accurate evo/hero slot counting.
    """
    card_lookup = {c["name"].lower(): c for c in player_collection}
    result = []

    for battle in battles[:n * 3]:  # scan up to 3× to skip battles with missing data
        if len(result) >= n:
            break

        team = battle.get("team", [{}])[0]
        opponent_entry = battle.get("opponent", [{}])[0]

        player_cards = team.get("cards", [])
        opponent_cards = opponent_entry.get("cards", [])
        if not player_cards or not opponent_cards:
            continue

        trophy_change = team.get("trophyChange", 0)
        match_result = "win" if trophy_change > 0 else "loss" if trophy_change < 0 else "draw"

        # Enrich player cards with full collection data (evo/hero info)
        enriched_player_cards = [card_lookup.get(c["name"].lower(), c) for c in player_cards]

        player_score = compute_deck_score(enriched_player_cards, constraints)
        opponent_score = compute_deck_score(opponent_cards)
        win_prob = compute_win_probability(player_score, opponent_score)

        result.append({
            "battle_time": battle.get("battleTime", ""),
            "game_mode": _parse_game_mode(battle),
            "result": match_result,
            "trophy_change": trophy_change,
            "player_deck": {
                "cards": enriched_player_cards,
                "deck_score": player_score,
            },
            "opponent": {
                "name": opponent_entry.get("name", "Opponent"),
                "tag": opponent_entry.get("tag", ""),
                "deck": {
                    "cards": opponent_cards,
                    "deck_score": opponent_score,
                },
            },
            "win_probability": win_prob,
        })

    return result


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
