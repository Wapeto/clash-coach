import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

MODEL = "gemini-2.5-flash"

# Rarity start levels — all cards max at 16 in-game,
# but the API returns levels relative to rarity.
RARITY_START_LEVEL = {
    "common": 1,
    "rare": 3,
    "epic": 6,
    "legendary": 9,
    "champion": 11,
}


def to_game_level(api_level: int, rarity: str) -> int:
    start = RARITY_START_LEVEL.get(rarity.lower(), 1)
    return start + api_level - 1


def fmt_level(api_level: int, rarity: str) -> str:
    return f"{to_game_level(api_level, rarity)}/16"


# Google Search grounding — lets Gemini look up current meta,
# balance changes, and card stats for free.
search_tool = types.Tool(google_search=types.GoogleSearch())


def ask_gemini(prompt: str) -> str:
    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[search_tool],
        ),
    )
    return response.text



def prompt_best_decks(player: dict, priorities: list, decks: list) -> str:
    card_list = [
        f"{c['name']} (Lvl {fmt_level(c['level'], c['rarity'])}, {c['rarity']})"
        for c in player["cards"]
    ]
    priority_list = [
        f"{p['name']} (score: {p['upgradeScore']}, lvl {fmt_level(p['level'], p['rarity'])})"
        for p in priorities[:10]
    ]
    recent_decks = [
        ", ".join(c["name"] for c in d["cards"])
        for d in decks
        if d["gameMode"] == "Ladder"
    ]

    prompt = f"""You are an expert Clash Royale coach. Be concise and specific.
Use Google Search to look up the current Clash Royale meta, recent balance changes,
and top ladder decks so your advice reflects the latest game state.

Player: {player['name']}
Trophies: {player['trophies']} (Royal Road)
King Level: {player['expLevel']}

Full card collection with levels (out of max 16):
{chr(10).join(card_list)}

Recent ladder decks used:
{chr(10).join(recent_decks) or 'None found'}

Top upgrade priorities (by usage + level gap):
{chr(10).join(priority_list)}

Task: Suggest the 3 best ladder decks this player can play RIGHT NOW with their current card levels.
For each deck:
1. Deck name and archetype
2. The 8 cards (only cards from their collection)
3. Average elixir cost
4. Why it suits their card levels specifically
5. One-line win condition summary

Then suggest 1 clan war deck separately.
"""
    return ask_gemini(prompt)


def prompt_upgrade_advice(priorities: list, player: dict) -> str:
    top = priorities[:15]
    lines = [
        f"{p['name']}: Lvl {fmt_level(p['level'], p['rarity'])}, used {p['appearances']}x, "
        f"WR {p['winRate']}%, rarity: {p['rarity']}"
        for p in top
    ]

    prompt = f"""You are an expert Clash Royale coach. Be concise and actionable.
Use Google Search to check the current Clash Royale meta and recent balance changes
to inform your upgrade recommendations.

Player trophies: {player['trophies']}
King Level: {player['expLevel']}

Cards ranked by upgrade impact (frequency × level gap × win rate potential):
{chr(10).join(lines)}

Note: All card levels shown are in-game levels out of a max of 16.

Task: Explain in plain language which 5 cards to upgrade first and why.
Consider: rarity (commons/rares are cheaper), how often they're used, how much a level
gap hurts at this trophy range, and whether the card is strong in the current meta.
Give a short, punchy reason for each pick.
"""
    return ask_gemini(prompt)


def prompt_deck_coach(deck_cards: list, trophies: int) -> str:
    card_lines = [
        f"{c['name']} (Lvl {fmt_level(c['level'], c['rarity'])}, {c['rarity']}, {c['elixirCost']} elixir)"
        for c in deck_cards
    ]
    avg_elixir = round(sum(c["elixirCost"] for c in deck_cards) / len(deck_cards), 2)

    prompt = f"""You are an expert Clash Royale coach. Be specific and practical.
Use Google Search to look up the current meta, recent balance changes, and how this
deck archetype performs on ladder right now. Reference specific current-season data
if available.

Deck to analyze:
{chr(10).join(card_lines)}
Average elixir: {avg_elixir}
Player trophy range: {trophies}

Note: All card levels shown are in-game levels out of a max of 16.

Give a full coaching breakdown:
1. Win condition and core game plan
2. Recommended opening play (first card to play and where)
3. Elixir management and cycle strategy
4. How to play vs these archetypes: Beatdown, Bait, Control, Bridge Spam, Hog Cycle
5. Top 3 mistakes players make with this deck and how to fix them
6. One specific drill or habit to practice this week to improve with this deck
7. Current meta relevance: is this deck strong/weak right now and why?
"""
    return ask_gemini(prompt)
