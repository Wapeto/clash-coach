import os
import json
from google import genai
from google.genai import types
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL = "gemini-2.5-flash"


class SuggestedDeck(BaseModel):
    deck_name: str
    archetype: str
    cards: list[str]
    why_it_fits: str
    win_condition: str


class BestDecksResponse(BaseModel):
    ladder_decks: list[SuggestedDeck]
    clan_war_deck: SuggestedDeck


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


def ask_gemini_json(prompt: str, schema: type[BaseModel]) -> BaseModel:
    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[{"google_search": {}}],
            temperature=0.7,
            response_mime_type="application/json",
            response_schema=schema,
        )
    )
    return schema(**json.loads(response.text))


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
    evo = " (EVOLVED)" if c.get("iconUrls", {}).get("evolutionMedium") else ""
    hero = " (HERO)" if c.get("iconUrls", {}).get("heroMedium") else ""
    return f"{c['name']}{evo}{hero} (Lvl {lvl}/16, {c['rarity']}, {c['elixirCost']} elixir)"


def prompt_best_decks(player: dict, priorities: list, decks: list) -> BestDecksResponse:
    card_list = [format_card_entry(c) for c in player["cards"]]
    
    # Filter strictly for standard ladder/ranked modes if present
    ladder_decks = [d for d in decks if d.get("gameMode") in ["Ladder", "Ranked1v1", "Ranked", "Path of Legends"]]
    if not ladder_decks:
        ladder_decks = decks[:5]

    recent_decks = []
    for d in ladder_decks:
        recent_decks.append(f"[{d.get('gameMode', 'Unknown')}] " + ", ".join(c["name"] for c in d["cards"]))

    prompt = f"""You are an expert Clash Royale coach.
Your job is to recommend the 3 best LADDER decks and 1 CLAN WAR deck. 
Use Google Search grounding to find the absolute latest meta decks (e.g. from RoyaleAPI ranking).

Player Data:
- Trophies: {player.get("trophies", "Unknown")}
- Cards: {chr(10).join(card_list)}
- High Priority Upgrades: {", ".join(p['name'] for p in priorities[:10])}
- Recently played ladder decks: {chr(10).join(recent_decks)}

CRITICAL RULES:
1. ONLY return strict JSON matching the schema.
2. The `cards` array MUST exactly match the card names from the player's collection above (pay attention to spelling, capitalization). DO NOT include (EVOLVED) or level data in the `cards` array, just the base name.
3. Completely ignore any Clan Battle or 7x Elixir decks when designing Ladder decks.
4. If they have EVOLVED or HERO cards, design decks that take advantage of them.
"""
    return ask_gemini_json(prompt, BestDecksResponse)


def prompt_upgrade_advice(priorities: list, player: dict) -> str:
    top_picks = priorities[:5]
    details = []
    for i, p in enumerate(top_picks):
        details.append(f"{i+1}. {format_card_entry(p)} - Win Rate: {p['winRate']}%, Score: {p['upgradeScore']}")

    prompt = f"""You are an expert Clash Royale coach. Give upgrade advice based on the math.
Trophy range: {player.get('trophies', 'Unknown')}

Top 5 algorithmically recommended upgrades:
{chr(10).join(details)}

CRITICAL RULES FOR OUTPUT FORMATTING:
1. You MUST use rich Markdown formatting.
2. Use bullet points `- ` and bold text `**`.
3. Highlight Evos and Heroes strongly.
4. Give a short, punchy reason for each pick using bolding.
"""
    return ask_gemini(prompt)


def prompt_deck_coach(deck_cards: list, trophies: int) -> str:
    card_lines = ["- " + format_card_entry(c) for c in deck_cards]
    avg_elixir = round(sum(c["elixirCost"] for c in deck_cards) / len(deck_cards), 2)

    prompt = f"""You are an expert Clash Royale coach. Be specific and practical.
Use Google Search to look up the current meta, recent balance changes, and how this deck archetype performs on ladder right now.

Deck to analyze:
{chr(10).join(card_lines)}
Average elixir: {avg_elixir}
Player trophy range: {trophies}

CRITICAL RULES FOR OUTPUT FORMATTING:
1. You MUST use rich Markdown formatting (`###` headers, bullet points).
2. ONLY use bold text for Card Names or Key Terms, otherwise there's too much yellow.
3. Structure your response EXACTLY with these markdown headers:
### ⚔️ Game Plan & Win Condition
(Explain core strategy)

### 🎯 Recommended Openers
(First cards to play and where)

### 💧 Elixir Management
(Cycle strategy)

### 🛡️ Matchups
- Beatdown: ...
- Cycle/Bait: ...

### ⚠️ Common Mistakes
(Top 3 mistakes with this deck)

### 📈 Meta Relevance
(Is this deck strong right now?)
"""
    return ask_gemini(prompt)
