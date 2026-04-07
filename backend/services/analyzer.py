from collections import defaultdict


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
