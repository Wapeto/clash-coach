import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)

def ask_gemini(prompt: str) -> str:
    response = client.chat.completions.create(
        model="deepseek/deepseek-r1-0528:free",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content



def prompt_best_decks(player: dict, priorities: list, decks: list) -> str:
    card_list = [
        f"{c['name']} (Lvl {c['level']}/{c['maxLevel']}, {c['rarity']})"
        for c in player["cards"]
    ]
    priority_list = [
        f"{p['name']} (score: {p['upgradeScore']}, lvl {p['level']}/{p['maxLevel']})"
        for p in priorities[:10]
    ]
    recent_decks = [
        ", ".join(c["name"] for c in d["cards"])
        for d in decks
        if d["gameMode"] == "Ladder"
    ]

    prompt = f"""You are an expert Clash Royale coach. Be concise and specific.

Player: {player['name']}
Trophies: {player['trophies']} (Royal Road)
King Level: {player['expLevel']}

Full card collection with levels:
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
        f"{p['name']}: Lvl {p['level']}/{p['maxLevel']}, used {p['appearances']}x, "
        f"WR {p['winRate']}%, rarity: {p['rarity']}"
        for p in top
    ]

    prompt = f"""You are an expert Clash Royale coach. Be concise and actionable.

Player trophies: {player['trophies']}
King Level: {player['expLevel']}

Cards ranked by upgrade impact (frequency × level gap × win rate potential):
{chr(10).join(lines)}

Task: Explain in plain language which 5 cards to upgrade first and why.
Consider: rarity (commons/rares are cheaper), how often they're used, and how much a level
gap hurts at this trophy range. Give a short, punchy reason for each pick.
"""
    return ask_gemini(prompt)


def prompt_deck_coach(deck_cards: list, trophies: int) -> str:
    card_lines = [
        f"{c['name']} (Lvl {c['level']}, {c['rarity']}, {c['elixirCost']} elixir)"
        for c in deck_cards
    ]
    avg_elixir = round(sum(c["elixirCost"] for c in deck_cards) / len(deck_cards), 2)

    prompt = f"""You are an expert Clash Royale coach. Be specific and practical.

Deck to analyze:
{chr(10).join(card_lines)}
Average elixir: {avg_elixir}
Player trophy range: {trophies}

Give a full coaching breakdown:
1. Win condition and core game plan
2. Recommended opening play (first card to play and where)
3. Elixir management and cycle strategy
4. How to play vs these archetypes: Beatdown, Bait, Control, Bridge Spam, Hog Cycle
5. Top 3 mistakes players make with this deck and how to fix them
6. One specific drill or habit to practice this week to improve with this deck
"""
    return ask_gemini(prompt)
