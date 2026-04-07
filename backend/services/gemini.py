import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

MODEL = "gemini-2.5-flash"

def ask_gemini(prompt: str) -> str:
    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[{"google_search": {}}],
            temperature=0.7,
        )
    )
    return response.text

def fmt_level(api_level: int, rarity: str) -> str:
    start_levels = {
        "common": 1,
        "rare": 3,
        "epic": 6,
        "legendary": 9,
        "champion": 11,
    }
    start = start_levels.get(rarity.lower(), 1)
    return str(start + api_level - 1)

def format_card_entry(c: dict) -> str:
    lvl = fmt_level(c["level"], c["rarity"])
    evo = " (EVOLVED)" if c.get("evolutionLevel", 0) > 0 else ""
    return f"{c['name']}{evo} (Lvl {lvl}/16, {c['rarity']})"

def prompt_best_decks(player: dict, priorities: list, decks: list) -> str:
    card_list = [format_card_entry(c) for c in player["cards"]]
    priority_list = [
        f"{p['name']} (score: {p['upgradeScore']}, lvl {fmt_level(p['level'], p['rarity'])})"
        for p in priorities[:10]
    ]
    recent_decks = [
        ", ".join(c["name"] for c in d["cards"])
        for d in decks
    ]

    prompt = f"""You are an expert Clash Royale coach.
Your job is to recommend the 3 best ladder decks and 1 clan war deck for the player based on their card levels and the CURRENT Meta.
Use Google Search grounding to find the absolute latest meta decks (e.g. from RoyaleAPI or top ladder).

Player Data:
- Trophies: {player.get("trophies", "Unknown")}
- Cards: {chr(10).join(card_list)}
- High Priority Upgrades (Cards they play often): {chr(10).join(priority_list)}
- Recently played decks: {chr(10).join(recent_decks)}

CRITICAL RULES FOR OUTPUT FORMATTING:
1. You MUST use rich Markdown formatting (H3 headers `###`, bold text `**`, and bullet points `- `).
2. DO NOT return a solid wall of text. Break up paragraphs.
3. For each deck, explicitly list:
   - **Archetype**: (e.g. Beatdown, Log Bait, etc)
   - **Cards**: (list all 8)
   - **Why it fits their levels**: (explain briefly)
   - **Win Condition Summary**: (1 sentence playstyle)
4. Highlight EVOLVED cards or CHAMPIONS strongly.
"""
    return ask_gemini(prompt)


def prompt_upgrade_advice(priorities: list, player: dict) -> str:
    top_picks = priorities[:5]
    details = []
    for i, p in enumerate(top_picks):
        lvl = fmt_level(p["level"], p["rarity"])
        evo = " (EVOLVED)" if p.get("evolutionLevel", 0) > 0 else ""
        details.append(
            f"{i+1}. {p['name']}{evo} (Lvl {lvl}/{p['maxLevel']}, {p['rarity']}) "
            f"- Win Rate: {p['winRate']}%, Score: {p['upgradeScore']}"
        )

    prompt = f"""You are an expert Clash Royale coach. Give upgrade advice based on the math.
Trophy range: {player.get('trophies', 'Unknown')}

Top 5 algorithmically recommended upgrades:
{chr(10).join(details)}

CRITICAL RULES FOR OUTPUT FORMATTING:
1. You MUST use rich Markdown formatting.
2. Use bullet points `- ` and bold text `**`.
3. Provide a 2-3 sentence explanation for why EACH of the 5 cards is a good upgrade right now.
4. Reference current meta strength using Google Search where relevant.
5. Consider rarity (commons/rares are easier to max).
6. Give a short, punchy reason for each pick using bolding.
"""
    return ask_gemini(prompt)


def prompt_deck_coach(deck_cards: list, trophies: int) -> str:
    card_lines = [
        f"- {c['name']}{' (EVOLVED)' if c.get('evolutionLevel', 0) > 0 else ''} (Lvl {fmt_level(c['level'], c['rarity'])}, {c['rarity']}, {c['elixirCost']} elixir)"
        for c in deck_cards
    ]
    avg_elixir = round(sum(c["elixirCost"] for c in deck_cards) / len(deck_cards), 2)

    prompt = f"""You are an expert Clash Royale coach. Be specific and practical.
Use Google Search to look up the current meta, recent balance changes, and how this deck archetype performs on ladder right now.

Deck to analyze:
{chr(10).join(card_lines)}
Average elixir: {avg_elixir}
Player trophy range: {trophies}

CRITICAL RULES FOR OUTPUT FORMATTING:
1. You MUST use rich Markdown formatting (`###` headers, bullet points, bold text).
2. DO NOT return a solid wall of text.
3. Structure your response EXACTLY with these markdown headers:
### ⚔️ Game Plan & Win Condition
(Explain core strategy)

### 🎯 Recommended Openers
(First cards to play and where)

### 💧 Elixir Management
(Cycle strategy)

### 🛡️ Matchups
- **Beatdown**: ...
- **Cycle/Bait**: ...

### ⚠️ Common Mistakes
(Top 3 mistakes with this deck)

### 📈 Meta Relevance
(Is this deck strong right now? Mention recent buffs/nerfs from search)
"""
    return ask_gemini(prompt)
